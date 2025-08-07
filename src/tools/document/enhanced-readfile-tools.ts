/**
 * Enhanced ReadMarkdownFile Tool - AI优化的Markdown文档解析器
 * 
 * 专为AI Agent设计的增强型Markdown文件读取工具
 * 支持结构化解析、多目标搜索、智能缓存等高级功能
 * 
 * @version 2.0.0 - 完全重写，不保持向后兼容
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import { visit } from 'unist-util-visit';
import { position } from 'unist-util-position';
import GithubSlugger from 'github-slugger';
import MiniSearch from 'minisearch';
import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';

import { Logger } from '../../utils/logger';
import { CallerType } from '../../types';

const logger = Logger.getInstance();

// ========== 接口定义 ==========

/**
 * 解析模式枚举
 */
export type ParseMode = 'content' | 'structure' | 'full';

/**
 * 目标类型：章节或关键字搜索
 */
export interface TargetRequest {
    type: 'section' | 'keyword';
    
    // Section类型参数
    sid?: string;                        // section stable ID (当type为section时)
    sectionTitle?: string;               // section标题 (sid优先级更高)
    
    // Keyword类型参数
    query?: string[];                    // 搜索关键字数组 (AND关系，当type为keyword时)
    proximityRange?: number;             // 关键词相近度范围(字符数)，默认200
    searchScope?: 'title' | 'content' | 'both';  // 搜索范围
    maxResults?: number;                 // 最大返回结果数
    highlightMatches?: boolean;          // 是否返回高亮位置偏移
    matchingStrategy?: 'literal' | 'token' | 'ngram'; // 匹配策略
}

/**
 * 文本偏移信息 - 支持三种编码单位
 */
export interface TextOffset {
    // UTF-16编码单位 (VS Code友好)
    utf16: {
        start: number;
        end: number;
        startLine: number;
        endLine: number;
        startColumn: number;
        endColumn: number;
    };
    // UTF-8编码单位 (I/O友好)
    utf8: {
        start: number;
        end: number;
    };
    // Unicode码点单位 (算法友好)
    codepoint: {
        start: number;
        end: number;
    };
}

/**
 * 目录条目
 */
export interface TableOfContents {
    sid: string;                         // 稳定ID (如: /introduction/system-overview)
    displayId: string;                   // 显示ID (如: "1.1")
    title: string;                       // 原始标题
    normalizedTitle: string;             // 规范化标题 (去除编号)
    level: number;                       // 标题级别 (1-6)
    line: number;                        // 所在行号
    offset: TextOffset;                  // 精确位置信息
    
    // 章节元数据
    wordCount: number;                   // 字数统计
    characterCount: number;              // 字符数统计
    estimatedReadingTime: number;        // 预估阅读时间(分钟)
    complexity: 'low' | 'medium' | 'high'; // 复杂度评估
    containsCode: boolean;               // 是否包含代码块
    containsTables: boolean;             // 是否包含表格
    containsLists: boolean;              // 是否包含列表
    
    // 层级关系
    parent?: string;                     // 父级章节sid
    children: TableOfContents[];         // 子章节列表
    
    // 🆕 AI 友好字段 (Phase 1 增强)
    childTitles: string[];               // 子章节标题列表 ["5.1 管理", "5.2 配置"]
    siblingIndex: number;                // 在同级中的位置 (0-based)
    siblingCount: number;                // 同级章节总数
}

/**
 * 匹配出现位置（优化版）
 */
export interface MatchOccurrence {
    keyword: string;                     // 匹配的关键字
    startIndex: number;                  // 在section content中的起始位置
    endIndex: number;                    // 在section content中的结束位置
    line: number;                        // 在section中的行号
    proximityGroup?: number;             // 相近组ID（相近的关键词归为一组）
}

/**
 * 匹配位置（向后兼容）
 */
export interface MatchPosition {
    keyword: string;
    startIndex: number;
    endIndex: number;
        line: number;
    surroundingText: string;
}

/**
 * 高亮位置偏移
 */
export interface HighlightOffset {
    start: number;                       // 在context中的起始位置
    end: number;                         // 在context中的结束位置
    keyword: string;                     // 对应的关键词
}

/**
 * 评分详情
 */
export interface ScoringDetails {
    keywordCoverage: number;             // 关键词覆盖率 (found/total)
    proximityScore: number;              // 相近度评分 (0-1)
    densityScore: number;                // 密度评分 (0-1)
    titleBonus: number;                  // 标题加分 (0-1)
}

/**
 * 关键字匹配结果（优化版）
 */
export interface KeywordMatch {
    sid: string;                         // 匹配的section stable ID
    sectionTitle: string;                // 匹配的section标题
    
    // 关键词覆盖信息（精简）
    foundKeywords: string[];             // 实际找到的关键词
    missingKeywords: string[];           // 未找到的关键词
    
    // 综合评分
    relevanceScore: number;              // 综合评分 (0-1)
    scoringDetails: ScoringDetails;      // 评分详情
    
    // 精简的位置和上下文信息
    context: string;                     // 原始上下文文本
    highlightOffsets?: HighlightOffset[]; // 高亮位置偏移（可选）
    occurrences: MatchOccurrence[];      // 详细匹配位置
    
    // section内容 (基于parseMode)
    content?: string;                    // 完整section内容
}

/**
 * 章节元数据
 */
export interface SectionMetadata {
    wordCount: number;
    characterCount: number;
    estimatedReadingTime: number;
    complexity: 'low' | 'medium' | 'high';
    containsCode: boolean;
    containsTables: boolean;
    containsLists: boolean;
}

/**
 * 内容摘要
 */
export interface ContentSummary {
    totalCharacters: number;             // 总字符数
    totalLines: number;                  // 总行数
    firstLines: string[];                // 前几行内容
    lastLines: string[];                 // 后几行内容
    sampleSections: SectionSample[];     // 代表性章节样本
}

/**
 * 章节样本
 */
export interface SectionSample {
    sid: string;                         // 章节stable ID
    title: string;                       // 章节标题
    preview: string;                     // 前几行预览
    wordCount: number;                   // 章节字数
}

/**
 * 错误码枚举
 */
export enum ErrorCode {
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    PATH_SECURITY_VIOLATION = 'PATH_SECURITY_VIOLATION',
    PARSE_ERROR = 'PARSE_ERROR',
    SECTION_NOT_FOUND = 'SECTION_NOT_FOUND',
    INVALID_PARAMETERS = 'INVALID_PARAMETERS',
    CACHE_ERROR = 'CACHE_ERROR'
}

/**
 * 错误详情
 */
export interface ErrorDetails {
    code: ErrorCode;
    message: string;
    suggestion?: string;                 // AI修正建议
    alternativeAction?: string;          // 替代操作建议
}

/**
 * 警告信息
 */
export interface WarningInfo {
    type: 'PARTIAL_SUCCESS' | 'PERFORMANCE_DEGRADED' | 'CACHE_MISS';
    message: string;
    affectedTargets?: number[];          // 受影响的target索引
}

/**
 * 目标处理结果
 */
export interface TargetResult {
    type: "section" | "keyword_search";
    success: boolean;
    
    // Section结果
    sid?: string;                        // section stable ID (当type为section时)
    sectionTitle?: string;               // section标题
    content?: string;                    // section内容 (基于parseMode)
    metadata?: SectionMetadata;          // section元数据
    
    // 关键字搜索结果
    query?: string[];                    // 搜索关键字 (当type为keyword_search时)
    matches?: KeywordMatch[];            // 匹配结果列表
    totalMatches?: number;               // 总匹配数
    
    // 通用字段
    error?: ErrorDetails;                // 错误详情
    warning?: string;                    // 该目标的警告信息
}

/**
 * 增强型文件读取结果
 */
export interface EnhancedReadFileResult {
    success: boolean;
    
    // 基础文件信息
    path: string;                        // 请求的文件路径
    resolvedPath: string;                // 解析后的绝对路径
    lastModified: Date;                  // 文件最后修改时间
    size: number;                        // 文件大小(字节)
    
    // 解析结果 (基于parseMode)
    content?: string;                    // 完整内容 (parseMode=content/full时提供)
    tableOfContents?: TableOfContents[]; // 目录结构 (parseMode=structure/full时提供)
    contentSummary?: ContentSummary;     // 内容摘要 (parseMode=structure时提供)
    
    // 多目标处理结果
    results: TargetResult[];             // 各个target的处理结果
    
    // 元信息
    parseTime: number;                   // 解析耗时(毫秒)
    cacheHit: boolean;                   // 是否命中缓存
    warnings?: WarningInfo[];            // 警告信息
    error?: ErrorDetails;                // 全局错误信息
}

// ========== 工具定义 ==========

/**
 * 增强型Markdown文件读取工具定义
 */
export const readMarkdownFileToolDefinition = {
    name: "readMarkdownFile",
    description: "Enhanced Markdown file reader with structured parsing, multi-target search, and intelligent caching capabilities for AI agents.",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "File path relative to baseDir root. Must not contain '..' to prevent directory traversal attacks."
            },
            parseMode: {
                type: "string",
                enum: ["content", "structure", "full"],
                description: "Parsing mode: content (content only), structure (TOC + summary only), full (content + structure)",
                default: "content"
            },
            targets: {
                type: "array",
                description: "Array of target requests for sections or keyword searches",
                items: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            enum: ["section", "keyword"],
                            description: "Target type: section (specific section) or keyword (keyword search)"
                        },
                        // Section target properties
                        sid: {
                            type: "string",
                            description: "Section stable ID (e.g., '/introduction/system-overview'). Used when type='section'"
                        },
                        sectionTitle: {
                            type: "string", 
                            description: "Section title for fuzzy matching. sid takes precedence if both provided. Used when type='section'"
                        },
                        // Keyword target properties
                        query: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of keywords to search for (AND relationship). Used when type='keyword'"
                        },
                        proximityRange: {
                            type: "number",
                            description: "Maximum distance between keywords in characters for AND matching. Default: 200",
                            default: 200
                        },
                        searchScope: {
                            type: "string",
                            enum: ["title", "content", "both"],
                            description: "Search scope for keywords. Default: 'both'",
                            default: "both"
                        },
                        maxResults: {
                            type: "number",
                            description: "Maximum number of results to return. Default: 10",
                            default: 10
                        },
                        highlightMatches: {
                type: "boolean", 
                            description: "Whether to return highlight offsets for matched keywords. Default: true",
                            default: true
                        },
                        matchingStrategy: {
                            type: "string",
                            enum: ["literal", "token", "ngram"],
                            description: "Matching strategy. Default: 'token'",
                            default: "token"
                        }
                    },
                    required: ["type"]
                },
                default: []
            }
        },
        required: ["path"]
    },
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
        CallerType.SPECIALIST,
        CallerType.DOCUMENT
    ]
};

// ========== 核心类实现 ==========

/**
 * 短哈希生成器
 */
class HashGenerator {
    /**
     * 生成6位短哈希
     */
    static generateShortHash(content: string): string {
        // 使用Node.js内置的crypto，模拟xxhash行为
        const hash = createHash('sha256').update(content).digest('hex');
        return hash.slice(0, 6); // 取前6位
    }
}

/**
 * 路径安全校验器
 */
class PathValidator {
    /**
     * 验证路径安全性
     */
    static validatePath(inputPath: string, baseDir: string): {valid: boolean, resolvedPath?: string, error?: string} {
        try {
            // 1. 规范化路径
            const normalizedPath = path.normalize(inputPath);
            
            // 2. 检查是否包含 '..'
            if (normalizedPath.includes('..')) {
                return {
                    valid: false,
                    error: "Path must not contain '..' to prevent directory traversal"
                };
            }
            
            // 3. 构建完整路径
            const resolvedPath = path.resolve(baseDir, normalizedPath);
            
            // 4. 确保解析后的路径仍在baseDir内
            const relativePath = path.relative(baseDir, resolvedPath);
            if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
                return {
                    valid: false,
                    error: "Resolved path must stay within baseDir boundary"
                };
            }
            
            return {valid: true, resolvedPath};
        } catch (error) {
            return {
                valid: false, 
                error: `Path validation failed: ${(error as Error).message}`
            };
        }
    }
}

/**
 * 标题编号去除器
 */
class TitleNormalizer {
    private static readonly numberPrefixPatterns = [
        /^[\d\.]+\s+/,                    // 数字编号：1. 1.1 1.2.3. 等
        /^[\d\.]+\.\s+/,                  // 带点结尾：1. 2.1. 3.2.1. 等
        /^[（\(][一二三四五六七八九十\d][）\)]\s+/, // 中文括号：（一） (1) (二) 等
        /^第[一二三四五六七八九十\d]+[章节部分]\s+/, // 中文章节：第一章 第二节 第三部分 等
        /^[IVXLCDM]+[\.\s]+/,            // 罗马数字：I. II III. 等
        /^[A-Z][\.\)]\s+/,               // 字母编号：A. B) C. 等
    ];

    /**
     * 去除标题前缀编号
     */
    static removeNumberPrefix(title: string): string {
        let cleanTitle = title.trim();
        for (const pattern of this.numberPrefixPatterns) {
            cleanTitle = cleanTitle.replace(pattern, '');
        }
        return cleanTitle.trim();
    }
}

/**
 * 解析引擎 - 负责Markdown文档解析
 */
class ParsingEngine {
    private processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkFrontmatter);

    /**
     * 解析Markdown文档
     */
    async parseDocument(content: string): Promise<any> {
        try {
            return this.processor.parse(content);
        } catch (error) {
            throw new Error(`Markdown parsing failed: ${(error as Error).message}`);
        }
    }
}

/**
 * 结构分析器 - 负责生成TOC和元数据
 */
class StructureAnalyzer {
    private slugger = new GithubSlugger();

    /**
     * 生成目录结构
     */
    generateTableOfContents(ast: any, content: string): TableOfContents[] {
        const toc: TableOfContents[] = [];
        const lines = content.split('\n');
        const slugTracker = new Map<string, number>(); // 跟踪slug重复

        this.slugger.reset();

        visit(ast, 'heading', (node: any) => {
            const pos = position(node);
            if (!pos) return;

            const title = this.extractHeadingText(node);
            const normalizedTitle = TitleNormalizer.removeNumberPrefix(title);
            
            // 生成稳定ID
            const baseSlug = this.slugger.slug(normalizedTitle);
            let finalSlug = baseSlug;
            
            // 处理重复slug
            if (slugTracker.has(baseSlug)) {
                const count = slugTracker.get(baseSlug)! + 1;
                slugTracker.set(baseSlug, count);
                const hashContent = `${baseSlug}${count}`;
                const shortHash = HashGenerator.generateShortHash(hashContent);
                finalSlug = `${baseSlug}-${shortHash}`;
            } else {
                slugTracker.set(baseSlug, 1);
            }

            const sid = `/${finalSlug}`;
            
            // 计算文本偏移
            const offset = this.calculateTextOffset(content, pos);
            
            // 分析章节内容
            const sectionContent = this.extractSectionContent(lines, pos.start.line - 1, node.depth);
            const metadata = this.analyzeSectionContent(sectionContent);
            
            // 生成displayId (这里简化实现，实际需要考虑层级关系)
            const displayId = toc.length + 1;

            const tocEntry: TableOfContents = {
                sid,
                displayId: displayId.toString(),
                title,
                normalizedTitle,
                level: node.depth,
                line: pos.start.line,
                offset,
                ...metadata,
                parent: undefined, // TODO: 实现父子关系
                children: [],
                // 🆕 AI 友好字段初始值
                childTitles: [],
                siblingIndex: 0,
                siblingCount: 0
            };

            toc.push(tocEntry);
        });

        // 建立父子关系
        this.buildHierarchy(toc);
        
        // 🆕 计算AI友好字段
        this.calculateAIFriendlyFields(toc);

        return toc;
    }

    /**
     * 提取标题文本
     */
    private extractHeadingText(node: any): string {
        let text = '';
        visit(node, 'text', (textNode: any) => {
            text += textNode.value;
        });
        return text;
    }

    /**
     * 计算文本偏移 (简化实现)
     */
    private calculateTextOffset(content: string, pos: any): TextOffset {
        const lines = content.split('\n');
        let utf16Start = 0;
        
        // 计算到目标行的偏移
        for (let i = 0; i < pos.start.line - 1; i++) {
            utf16Start += lines[i].length + 1; // +1 for newline
        }
        utf16Start += pos.start.column - 1;

        // 简化实现，假设UTF-8和Unicode码点相同
            return {
            utf16: {
                start: utf16Start,
                end: utf16Start + 100, // 简化
                startLine: pos.start.line,
                endLine: pos.end.line,
                startColumn: pos.start.column,
                endColumn: pos.end.column
            },
            utf8: {
                start: utf16Start,
                end: utf16Start + 100
            },
            codepoint: {
                start: utf16Start,
                end: utf16Start + 100
            }
        };
    }

    /**
     * 提取章节内容
     */
    private extractSectionContent(lines: string[], startLine: number, currentLevel: number): string {
        const content = [];
        
        for (let i = startLine + 1; i < lines.length; i++) {
            const line = lines[i];
            
            // 检查是否遇到同级或更高级别的标题
            const headingMatch = line.match(/^(#{1,6})\s+/);
            if (headingMatch && headingMatch[1].length <= currentLevel) {
                break;
            }
            
            content.push(line);
        }
        
        return content.join('\n');
    }

    /**
     * 分析章节内容
     */
    private analyzeSectionContent(content: string): SectionMetadata {
        const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
        const characterCount = content.length;
        const estimatedReadingTime = Math.ceil(wordCount / 200); // 假设每分钟200字
        
        const containsCode = /```/.test(content);
        const containsTables = /\|.*\|/.test(content);
        const containsLists = /^[\s]*[-*+]\s/.test(content);
        
        let complexity: 'low' | 'medium' | 'high' = 'low';
        if (wordCount > 500 || containsCode || containsTables) {
            complexity = 'high';
        } else if (wordCount > 200 || containsLists) {
            complexity = 'medium';
        }

            return {
            wordCount,
            characterCount,
            estimatedReadingTime,
            complexity,
            containsCode,
            containsTables,
            containsLists
        };
    }

    /**
     * 建立TOC层级关系
     */
    private buildHierarchy(toc: TableOfContents[]): void {
        const stack: TableOfContents[] = [];
        
        for (const entry of toc) {
            // 清理栈，保留比当前级别小的条目
            while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) {
                stack.pop();
            }
            
            // 设置父子关系
            if (stack.length > 0) {
                const parent = stack[stack.length - 1];
                entry.parent = parent.sid;
                parent.children.push(entry);
            }
            
            stack.push(entry);
        }
    }

    /**
     * 计算AI友好字段 (🆕 Phase 1 增强)
     */
    private calculateAIFriendlyFields(toc: TableOfContents[]): void {
        // 递归计算每个节点的AI友好字段
        const calculateForNode = (node: TableOfContents, siblings: TableOfContents[]) => {
            // 计算siblingIndex和siblingCount
            node.siblingIndex = siblings.indexOf(node);
            node.siblingCount = siblings.length;
            
            // 计算childTitles
            node.childTitles = node.children.map(child => child.title);
            
            // 递归处理子节点
            if (node.children.length > 0) {
                for (const child of node.children) {
                    calculateForNode(child, node.children);
                }
            }
        };
        
        // 获取根级节点（没有parent的节点）
        const rootNodes = toc.filter(entry => !entry.parent);
        
        // 计算根级节点
        for (const rootNode of rootNodes) {
            calculateForNode(rootNode, rootNodes);
        }
    }
}

/**
 * 搜索引擎 - 负责关键字搜索和相关度评分
 */
class SearchEngine {
    private searchIndex?: MiniSearch<any>;
    private documentMap = new Map<string, {section: TableOfContents, content: string}>();
    private fullContent = '';

    /**
     * 构建搜索索引
     */
    buildSearchIndex(toc: TableOfContents[], content: string): void {
        this.fullContent = content;
        this.documentMap.clear();

        const documents = toc.map(entry => {
            const sectionContent = this.extractSectionContent(content, entry);
            this.documentMap.set(entry.sid, { section: entry, content: sectionContent });
        
        return {
                id: entry.sid,
                title: entry.title,
                normalizedTitle: entry.normalizedTitle,
                content: sectionContent,
                level: entry.level,
                wordCount: entry.wordCount,
                characterCount: entry.characterCount
            };
        });

        this.searchIndex = new MiniSearch({
            fields: ['title', 'normalizedTitle', 'content'],
            storeFields: ['title', 'normalizedTitle', 'content', 'level', 'wordCount', 'characterCount'],
            searchOptions: {
                boost: { 
                    title: 3,           // 标题权重最高
                    normalizedTitle: 2, // 规范化标题次之
                    content: 1          // 内容权重最低
                },
                fuzzy: 0.15,           // 轻微模糊匹配
                prefix: true,          // 支持前缀匹配
                combineWith: 'AND'     // 多词必须都匹配
            }
        });

        this.searchIndex.addAll(documents);
    }

    /**
     * 执行关键字搜索（AND逻辑 + 相近度检测）
     */
    search(target: TargetRequest): KeywordMatch[] {
        if (!this.searchIndex || !target.query) {
            return [];
        }

        const keywords = Array.isArray(target.query) ? target.query : [target.query];
        const searchScope = target.searchScope || 'both';
        const maxResults = target.maxResults || 10;
        const highlightMatches = target.highlightMatches !== false;
        const matchingStrategy = target.matchingStrategy || 'token';
        const proximityRange = target.proximityRange || 200;

        // 使用AND逻辑搜索
        const andMatches = this.searchWithAndLogic(
            keywords,
            searchScope,
            matchingStrategy,
            proximityRange,
            highlightMatches
        );

        // 按综合评分排序
        andMatches.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return andMatches.slice(0, maxResults);
    }

    /**
     * AND逻辑搜索：所有关键词必须在相近范围内出现
     */
    private searchWithAndLogic(
        keywords: string[],
        searchScope: string,
        matchingStrategy: string,
        proximityRange: number,
        includeHighlightOffsets: boolean
    ): KeywordMatch[] {
        if (keywords.length === 0) return [];
        
        const matches: KeywordMatch[] = [];
        
        // 遍历所有sections
        for (const [sid, docData] of this.documentMap) {
            const { section, content } = docData;
            
            // 对每个关键词在该section中查找所有出现位置
            const allOccurrences: MatchOccurrence[] = [];
            const keywordOccurrenceMap = new Map<string, MatchOccurrence[]>();
            
            for (const keyword of keywords) {
                const occurrences = this.findExactMatches(keyword, content, section.title, matchingStrategy);
                const mappedOccurrences = occurrences.map(occ => ({
                    keyword,
                    startIndex: occ.startIndex,
                    endIndex: occ.endIndex,
                    line: occ.line
                }));
                
                keywordOccurrenceMap.set(keyword, mappedOccurrences);
                allOccurrences.push(...mappedOccurrences);
            }
            
            // 检查是否所有关键词都被找到
            const foundKeywords = Array.from(keywordOccurrenceMap.keys()).filter(
                keyword => keywordOccurrenceMap.get(keyword)!.length > 0
            );
            
            if (foundKeywords.length === 0) continue; // 一个关键词都没找到，跳过
            
            // 查找相近的关键词组合
            const proximityGroups = this.findProximityGroups(allOccurrences, proximityRange);
            const validGroups = proximityGroups.filter(group => 
                this.hasAllKeywords(group, keywords)
            );
            
            // 如果是严格AND模式，只有包含所有关键词的组才有效
            if (validGroups.length === 0 && foundKeywords.length < keywords.length) {
                continue; // 没有包含所有关键词的相近组，跳过该section
            }
            
            // 计算最佳上下文和评分
            const bestOccurrences = validGroups.length > 0 ? 
                validGroups[0] : // 使用第一个有效组
                allOccurrences.filter(occ => foundKeywords.includes(occ.keyword)); // 或使用所有找到的关键词
            
            const missingKeywords = keywords.filter(k => !foundKeywords.includes(k));
            
            // 生成上下文和高亮偏移
            const contextResult = this.generateOptimizedContext(
            content,
                bestOccurrences, 
                200,
                includeHighlightOffsets
            );
            
            // 计算综合评分
            const scoringResult = this.calculateComprehensiveScore(
                keywords,
                section,
                content,
                keywordOccurrenceMap,
                bestOccurrences
            );
            
            matches.push({
                sid: section.sid,
                sectionTitle: section.title,
                foundKeywords,
                missingKeywords,
                relevanceScore: scoringResult.score,
                scoringDetails: scoringResult.details,
                context: contextResult.context,
                highlightOffsets: contextResult.highlightOffsets,
                occurrences: bestOccurrences,
                content: content
            });
        }
        
        return matches;
    }



    /**
     * 查找相近度组
     */
    private findProximityGroups(
        occurrences: MatchOccurrence[],
        proximityRange: number
    ): MatchOccurrence[][] {
        if (occurrences.length === 0) return [];
        
        // 按位置排序
        const sorted = occurrences.sort((a, b) => a.startIndex - b.startIndex);
        
        // 分组：相近的匹配归为一组
        const groups: MatchOccurrence[][] = [];
        let currentGroup: MatchOccurrence[] = [sorted[0]];
        
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            const last = currentGroup[currentGroup.length - 1];
            const distance = current.startIndex - last.endIndex;
            
            if (distance <= proximityRange) {
                currentGroup.push(current);
            } else {
                groups.push(currentGroup);
                currentGroup = [current];
            }
        }
        
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }
        
        // 为每个组分配ID
        return groups.map((group, groupIndex) => 
            group.map(occ => ({ ...occ, proximityGroup: groupIndex }))
        );
    }

    /**
     * 检查组是否包含所有关键词
     */
    private hasAllKeywords(group: MatchOccurrence[], requiredKeywords: string[]): boolean {
        const groupKeywords = new Set(group.map(occ => occ.keyword));
        return requiredKeywords.every(keyword => groupKeywords.has(keyword));
    }

    /**
     * 生成优化的上下文
     */
    private generateOptimizedContext(
        content: string,
        occurrences: MatchOccurrence[],
        contextLength: number,
        includeHighlightOffsets: boolean
    ): { context: string; highlightOffsets?: HighlightOffset[] } {
        if (occurrences.length === 0) {
            return { context: '' };
        }

        // 找到覆盖最多关键词的最佳窗口
        const bestWindow = this.findOptimalContextWindow(occurrences, contextLength);
        const context = content.substring(bestWindow.start, bestWindow.end);
        
        let highlightOffsets: HighlightOffset[] | undefined;
        
        if (includeHighlightOffsets) {
            // 计算相对于context的偏移位置
            highlightOffsets = occurrences
                .filter(occ => occ.startIndex >= bestWindow.start && occ.endIndex <= bestWindow.end)
                .map(occ => ({
                    start: occ.startIndex - bestWindow.start,
                    end: occ.endIndex - bestWindow.start,
                    keyword: occ.keyword
                }));
        }
        
        return { context, highlightOffsets };
    }

    /**
     * 查找最佳上下文窗口
     */
    private findOptimalContextWindow(
        occurrences: MatchOccurrence[],
        contextLength: number
    ): { start: number; end: number } {
        if (occurrences.length === 0) {
            return { start: 0, end: 0 };
        }

        // 简单策略：以第一个匹配为中心
        const firstMatch = occurrences[0];
        const center = (firstMatch.startIndex + firstMatch.endIndex) / 2;
        const halfLength = contextLength / 2;
        
        return {
            start: Math.max(0, Math.floor(center - halfLength)),
            end: Math.floor(center + halfLength)
        };
    }

    /**
     * 计算综合评分
     */
    private calculateComprehensiveScore(
        keywords: string[],
        section: TableOfContents,
        content: string,
        keywordOccurrenceMap: Map<string, MatchOccurrence[]>,
        bestOccurrences: MatchOccurrence[]
    ): { score: number; details: ScoringDetails } {
        // 1. 关键词覆盖率 (30%)
        const foundCount = Array.from(keywordOccurrenceMap.keys()).filter(
            keyword => keywordOccurrenceMap.get(keyword)!.length > 0
        ).length;
        const keywordCoverage = foundCount / keywords.length;
        
        // 2. 相近度评分 (25%)
        const proximityScore = this.calculateProximityScore(bestOccurrences);
        
        // 3. 密度评分 (20%)
        const totalMatches = bestOccurrences.length;
        const densityScore = Math.min(totalMatches / Math.max(section.wordCount, 1) * 100, 1);
        
        // 4. 标题加分 (15%)
        const titleBonus = bestOccurrences.some(occ => occ.line <= 1) ? 1 : 0;
        
        // 5. 完整性加分 (10%)
        const completenessBonus = foundCount === keywords.length ? 1 : 0;
        
        const finalScore = (
            keywordCoverage * 0.3 +
            proximityScore * 0.25 +
            densityScore * 0.2 +
            titleBonus * 0.15 +
            completenessBonus * 0.1
        );
        
        return {
            score: Math.min(finalScore, 1),
            details: {
                keywordCoverage,
                proximityScore,
                densityScore,
                titleBonus
            }
        };
    }

    /**
     * 计算相近度评分
     */
    private calculateProximityScore(occurrences: MatchOccurrence[]): number {
        if (occurrences.length <= 1) return 1;
        
        // 计算平均间距
        let totalDistance = 0;
        for (let i = 1; i < occurrences.length; i++) {
            const distance = occurrences[i].startIndex - occurrences[i-1].endIndex;
            totalDistance += distance;
        }
        
        const avgDistance = totalDistance / (occurrences.length - 1);
        
        // 距离越小，评分越高
        return Math.max(0, 1 - avgDistance / 500); // 500字符以内认为是相近的
    }

    /**
     * 查找精确匹配位置（更新返回类型）
     */
    private findExactMatches(keyword: string, content: string, title: string, strategy: string): { startIndex: number; endIndex: number; line: number; keyword: string; surroundingText: string }[] {
        const matches: { startIndex: number; endIndex: number; line: number; keyword: string; surroundingText: string }[] = [];
        const lines = content.split('\n');
        
        // 根据策略创建匹配正则
        let regex: RegExp;
        switch (strategy) {
            case 'literal':
                regex = new RegExp(this.escapeRegex(keyword), 'gi');
                break;
            case 'ngram':
                // 字符级匹配，适合中文
                regex = new RegExp(this.escapeRegex(keyword), 'gi');
                break;
            case 'token':
            default:
                // 词级匹配，考虑词边界
                const escaped = this.escapeRegex(keyword);
                regex = new RegExp(`\\b${escaped}\\b|${escaped}`, 'gi');
                break;
        }

        // 在内容中查找匹配
        lines.forEach((line, lineIndex) => {
            let match;
            while ((match = regex.exec(line)) !== null) {
                const startIndex = content.split('\n').slice(0, lineIndex).join('\n').length + 
                                 (lineIndex > 0 ? 1 : 0) + match.index;
                
                matches.push({
                    keyword,
                    startIndex,
                    endIndex: startIndex + match[0].length,
                    line: lineIndex + 1,
                    surroundingText: this.getSurroundingText(line, match.index, 50)
                });
            }
            regex.lastIndex = 0; // 重置正则状态
        });

        return matches;
    }

    /**
     * 获取周围文本
     */
    private getSurroundingText(line: string, position: number, length: number): string {
        const start = Math.max(0, position - length / 2);
        const end = Math.min(line.length, position + length / 2);
        return line.substring(start, end);
    }

    /**
     * 正则转义
     */
    private escapeRegex(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 提取章节内容 (精确实现)
     */
    private extractSectionContent(content: string, entry: TableOfContents): string {
        const lines = content.split('\n');
        const startLine = entry.line - 1;
        const sectionLines = [];
        
        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            
            // 检查是否遇到同级或更高级别的标题
            const headingMatch = line.match(/^(#{1,6})\s+/);
            if (headingMatch && headingMatch[1].length <= entry.level && i > startLine) {
                break;
            }
            
            sectionLines.push(line);
        }
        
        return sectionLines.join('\n');
    }
}

/**
 * 缓存管理器
 */
class CacheManager {
    private cache = new LRUCache<string, any>({
        max: 10,
        ttl: 24 * 60 * 60 * 1000 // 24小时
    });

    /**
     * 生成缓存键
     */
    generateCacheKey(filePath: string, mtime: Date, size: number): string {
        const content = `${filePath}#${mtime.getTime()}#${size}`;
        return createHash('sha256').update(content).digest('hex').slice(0, 16);
    }

    /**
     * 获取缓存
     */
    get(key: string): any {
        return this.cache.get(key);
    }

    /**
     * 设置缓存
     */
    set(key: string, value: any): void {
        this.cache.set(key, value);
    }
}

// ========== 主类实现 ==========

/**
 * 增强型Markdown文件读取器
 */
class EnhancedMarkdownReader {
    private parsingEngine = new ParsingEngine();
    private structureAnalyzer = new StructureAnalyzer();
    private searchEngine = new SearchEngine();
    private cacheManager = new CacheManager();

    /**
     * 主要读取方法
     */
    async readFile(args: {
        path: string;
        parseMode?: ParseMode;
        targets?: TargetRequest[];
    }): Promise<EnhancedReadFileResult> {
        const startTime = Date.now();
        
        try {
            // 1. 路径解析和安全验证
            const baseDir = await this.getBaseDir();
            const pathValidation = PathValidator.validatePath(args.path, baseDir);
            
            if (!pathValidation.valid) {
                return this.createErrorResult(args.path, ErrorCode.PATH_SECURITY_VIOLATION, pathValidation.error!);
            }

            const resolvedPath = pathValidation.resolvedPath!;

            // 2. 文件读取
            const fileStats = await fs.stat(resolvedPath);
            const content = await fs.readFile(resolvedPath, 'utf-8');

            // 3. 缓存检查
            const cacheKey = this.cacheManager.generateCacheKey(resolvedPath, fileStats.mtime, fileStats.size);
            let parsedData = this.cacheManager.get(cacheKey);
            let cacheHit = !!parsedData;

            if (!parsedData) {
                // 4. 文档解析
                const ast = await this.parsingEngine.parseDocument(content);
                const toc = this.structureAnalyzer.generateTableOfContents(ast, content);
                
                parsedData = { ast, toc };
                this.cacheManager.set(cacheKey, parsedData);
            }

            // 5. 构建搜索索引 (如果需要)
            if (args.targets?.some(t => t.type === 'keyword')) {
                this.searchEngine.buildSearchIndex(parsedData.toc, content);
            }

            // 6. 处理多目标请求
            const results = await this.processTargets(args.targets || [], parsedData.toc, content);

            // 7. 构建结果
            return this.buildResult(args, resolvedPath, fileStats, content, parsedData.toc, results, cacheHit, startTime);
        
    } catch (error) {
            logger.error(`Enhanced markdown read failed: ${(error as Error).message}`);
            return this.createErrorResult(args.path, ErrorCode.PARSE_ERROR, (error as Error).message);
        }
    }

    /**
     * 处理多目标请求
     */
    private async processTargets(targets: TargetRequest[], toc: TableOfContents[], content: string): Promise<TargetResult[]> {
        const results: TargetResult[] = [];

        for (const target of targets) {
            try {
                if (target.type === 'section') {
                    results.push(await this.processSectionTarget(target, toc, content));
                } else if (target.type === 'keyword') {
                    results.push(await this.processKeywordTarget(target));
                }
            } catch (error) {
                results.push({
                    type: target.type === 'keyword' ? 'keyword_search' : 'section',
                    success: false,
                    error: {
                        code: ErrorCode.PARSE_ERROR,
                        message: (error as Error).message
                    }
                });
            }
        }

        return results;
    }

    /**
     * 处理章节目标
     */
    private async processSectionTarget(target: TargetRequest, toc: TableOfContents[], content: string): Promise<TargetResult> {
        // 查找匹配的章节
        let section: TableOfContents | undefined;
        
        if (target.sid) {
            section = toc.find(s => s.sid === target.sid);
        } else if (target.sectionTitle) {
            section = toc.find(s => 
                s.title.toLowerCase().includes(target.sectionTitle!.toLowerCase()) ||
                s.normalizedTitle.toLowerCase().includes(target.sectionTitle!.toLowerCase())
            );
        }

        if (!section) {
        return {
                type: 'section',
            success: false,
                error: {
                    code: ErrorCode.SECTION_NOT_FOUND,
                    message: `Section not found: ${target.sid || target.sectionTitle}`,
                    suggestion: `Available sections: ${toc.map(s => s.sid).join(', ')}`
                }
            };
        }

        // 提取章节内容
        const sectionContent = this.extractSectionContent(content, section);

        return {
            type: 'section',
            success: true,
            sid: section.sid,
            sectionTitle: section.title,
            content: sectionContent,
            metadata: {
                wordCount: section.wordCount,
                characterCount: section.characterCount,
                estimatedReadingTime: section.estimatedReadingTime,
                complexity: section.complexity,
                containsCode: section.containsCode,
                containsTables: section.containsTables,
                containsLists: section.containsLists
            }
        };
    }

    /**
     * 处理关键字目标
     */
    private async processKeywordTarget(target: TargetRequest): Promise<TargetResult> {
        const matches = this.searchEngine.search(target);

        return {
            type: 'keyword_search',
            success: true,
            query: target.query,
            matches,
            totalMatches: matches.length
        };
    }

    /**
     * 提取章节内容
     */
    private extractSectionContent(content: string, section: TableOfContents): string {
        const lines = content.split('\n');
        const startLine = section.line - 1;
        const sectionLines = [];
        
        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            
            // 检查是否遇到同级或更高级别的标题
            const headingMatch = line.match(/^(#{1,6})\s+/);
            if (headingMatch && headingMatch[1].length <= section.level && i > startLine) {
                break;
            }
            
            sectionLines.push(line);
        }
        
        return sectionLines.join('\n');
    }

    /**
     * 构建最终结果
     */
    private buildResult(
        args: any,
        resolvedPath: string,
        fileStats: any,
        content: string,
        toc: TableOfContents[],
        results: TargetResult[],
        cacheHit: boolean,
        startTime: number
    ): EnhancedReadFileResult {
        const parseMode = args.parseMode || 'content';
        
        return {
            success: true,
            path: args.path,
            resolvedPath,
            lastModified: fileStats.mtime,
            size: fileStats.size,
            // 条件返回content：只有在没有targets时才返回完整内容，避免重复和浪费
            content: (args.targets && args.targets.length > 0) ? undefined : 
                     (parseMode === 'content' || parseMode === 'full' ? content : undefined),
            tableOfContents: parseMode === 'structure' || parseMode === 'full' ? toc : undefined,
            contentSummary: parseMode === 'structure' ? this.generateContentSummary(content, toc) : undefined,
            results,
            parseTime: Date.now() - startTime,
            cacheHit
        };
    }

    /**
     * 生成内容摘要
     */
    private generateContentSummary(content: string, toc: TableOfContents[]): ContentSummary {
        const lines = content.split('\n');
        
        return {
            totalCharacters: content.length,
            totalLines: lines.length,
            firstLines: lines.slice(0, 3),
            lastLines: lines.slice(-3),
            sampleSections: toc.slice(0, 3).map(section => ({
                sid: section.sid,
                title: section.title,
                preview: this.extractSectionContent(content, section).slice(0, 100) + '...',
                wordCount: section.wordCount
            }))
        };
    }

    /**
     * 创建错误结果
     */
    private createErrorResult(path: string, code: ErrorCode, message: string): EnhancedReadFileResult {
        return {
            success: false,
            path,
            resolvedPath: '',
            lastModified: new Date(),
            size: 0,
            results: [],
            parseTime: 0,
            cacheHit: false,
            error: {
                code,
                message
            }
        };
    }

    /**
     * 获取基础目录
     */
    private async getBaseDir(): Promise<string> {
        try {
        const { SessionManager } = await import('../../core/session-manager');
        const sessionManager = SessionManager.getInstance();
        const currentSession = await sessionManager.getCurrentSession();
        
        if (currentSession?.baseDir) {
                return currentSession.baseDir;
        }
    } catch (error) {
            logger.warn(`Failed to get baseDir from session: ${(error as Error).message}`);
    }

        // 回退到VSCode工作区
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace found');
        }

        return workspaceFolders[0].uri.fsPath;
    }
}

// ========== 导出部分 ==========

/**
 * 增强型Markdown文件读取函数 (主入口)
 */
export async function readMarkdownFile(args: {
    path: string;
    parseMode?: ParseMode;
    targets?: TargetRequest[];
}): Promise<EnhancedReadFileResult> {
    const reader = new EnhancedMarkdownReader();
    return await reader.readFile(args);
}

/**
 * 工具实现映射
 */
export const readMarkdownFileToolImplementations = {
    readMarkdownFile
};

/**
 * 工具定义数组
 */
export const readMarkdownFileToolDefinitions = [
    readMarkdownFileToolDefinition
];

/**
 * ReadMarkdownFile 工具分类信息
 */
export const readMarkdownFileToolsCategory = {
    name: 'Enhanced ReadMarkdownFile Tool',
    description: 'AI-optimized Markdown file reader with structured parsing and multi-target search',
    tools: readMarkdownFileToolDefinitions.map(tool => tool.name),
    layer: 'document'
}; 