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
export type ParseMode = 'content' | 'structure' | 'toc' | 'full';

/**
 * 目标类型：章节或关键字搜索
 */
export interface TargetRequest {
    type: 'section' | 'keyword';
    
    // Section类型参数
    sid?: string;                        // section stable ID (当type为section时，必需)
    
    // Keyword类型参数
    query?: string[];                    // 搜索关键字数组 (AND关系，当type为keyword时)
    proximityRange?: number;             // 关键词相近度范围(字符数)，默认200
    searchScope?: 'title' | 'content' | 'both';  // 搜索范围
    maxResults?: number;                 // 最大返回结果数
    highlightMatches?: boolean;          // 是否返回高亮位置偏移
    matchingStrategy?: 'literal' | 'token' | 'ngram'; // 匹配策略
}

/**
 * 文本偏移信息 - 章节范围定位
 */
export interface TextOffset {
    // UTF-16编码单位 (VS Code友好) - 提供章节的完整行范围
    utf16: {
        startLine: number;      // 章节开始行（标题行）
        endLine: number;        // 章节结束行
        startColumn: number;    // 标题开始列
        endColumn: number;      // 标题结束列
    };
}

/**
 * 树状目录节点 (用于structure和full模式)
 */
export interface TableOfContentsTreeNode {
    sid: string;                         // 层级稳定ID (如: /introduction/system-overview)
    displayId: string;                   // 显示ID (如: "1.1")
    title: string;                       // 原始标题
    normalizedTitle: string;             // 规范化标题 (去除编号)
    level: number;                       // 标题级别 (1-6)
    line: number;                        // 所在行号
    offset: TextOffset;                  // 精确位置信息
    
    // 章节元数据
    wordCount: number;                   // 字数统计
    characterCount: number;              // 字符数统计
    containsCode: boolean;               // 是否包含代码块
    containsTables: boolean;             // 是否包含表格
    containsLists: boolean;              // 是否包含列表
    
    // 树状结构 - 只保留children，不保留parent
    children: TableOfContentsTreeNode[]; // 子章节数组
    
    // AI友好字段
    siblingIndex: number;                // 在同级中的位置 (0-based)
    siblingCount: number;                // 同级章节总数
    
    // 🆕 章节边界信息
    endLine?: number;                    // 章节结束行号（1-based，包含该行）
}

/**
 * ToC模式专用树状节点 (简化版)
 */
export interface TableOfContentsToCNode {
    sid: string;                         // 稳定ID
    displayId: string;                   // 显示ID
    title: string;                       // 原始标题
    level: number;                       // 标题级别
    characterCount: number;              // 字符数统计
    parent?: string;                     // 父级章节sid
    children: TableOfContentsToCNode[];  // 子章节数组
}

/**
 * 向后兼容的目录条目 (保持原有接口以免破坏现有代码)
 */
export interface TableOfContents {
    sid: string;                         // 层级稳定ID (如: /introduction/system-overview)
    displayId: string;                   // 显示ID (如: "1.1")
    title: string;                       // 原始标题
    normalizedTitle: string;             // 规范化标题 (去除编号)
    level: number;                       // 标题级别 (1-6)
    line: number;                        // 所在行号
    offset: TextOffset;                  // 精确位置信息
    
    // 章节元数据
    wordCount: number;                   // 字数统计
    characterCount: number;              // 字符数统计
    containsCode: boolean;               // 是否包含代码块
    containsTables: boolean;             // 是否包含表格
    containsLists: boolean;              // 是否包含列表
    
    // 层级关系
    parent?: string;                     // 父级章节sid
    children: TableOfContents[];         // 子章节列表
    
    // AI友好字段
    siblingIndex: number;                // 在同级中的位置 (0-based)
    siblingCount: number;                // 同级章节总数
    
    // 🆕 章节边界信息（为 executeMarkdownEdits 提供支持）
    endLine?: number;                    // 章节结束行号（1-based，包含该行）
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
    content?: string;                           // 完整内容 (parseMode=content/full时提供)
    tableOfContents?: TableOfContents[];        // 内部兼容用，不在新输出中使用
    tableOfContentsTree?: TableOfContentsTreeNode[];  // 树状目录结构 (parseMode=structure/full时提供)
    tableOfContentsToCTree?: TableOfContentsToCNode[]; // ToC模式树状结构 (parseMode=toc时提供)
    contentSummary?: ContentSummary;            // 内容摘要 (parseMode=structure时提供)
    
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
                description: "File path relative to project baseDir (or workspace root if no project is active). Do not include project name in path. Must not contain '..' to prevent directory traversal attacks. Example: 'SRS.md' not 'projectName/SRS.md'"
            },
            parseMode: {
                type: "string",
                enum: ["content", "structure", "toc", "full"],
                description: "Parsing mode: content (content only), structure (tree TOC + all metadata for each section), toc (tree TOC), full (content + structure)",
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
                            description: "Section stable ID (e.g., '/introduction/system-overview'). Required when type='section'. Use readMarkdownFile with parseMode='toc' first to discover available SIDs."
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
        CallerType.SPECIALIST_CONTENT,
        CallerType.SPECIALIST_PROCESS,
        CallerType.DOCUMENT
    ]
};

// ========== 核心类实现 ==========

/**
 * 短哈希生成器 - 支持跨会话稳定哈希
 */
class HashGenerator {
    /**
     * 生成稳定的6位短哈希 (跨会话一致)
     * 基于文档结构上下文确保相同位置的标题总是生成相同哈希
     */
    static generateStableHash(stableInput: string): string {
        const hash = createHash('sha256').update(stableInput, 'utf-8').digest('hex');
        return hash.slice(0, 6);
    }
    
    /**
     * 向后兼容的短哈希方法
     * @deprecated 使用 generateStableHash 替代，现有代码迁移后可移除
     */
    static generateShortHash(content: string): string {
        return this.generateStableHash(content);
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
            
            // 1.5. 如果是绝对路径，直接返回（与 resolveWorkspacePath 保持一致）
            if (path.isAbsolute(normalizedPath)) {
                return {valid: true, resolvedPath: normalizedPath};
            }
            
            // 2. 检查是否包含 '..' (防止目录遍历)
            if (normalizedPath.includes('..')) {
                return {
                    valid: false,
                    error: "Path must not contain '..' to prevent directory traversal"
                };
            }
            
            // 3. 构建完整路径并返回
            const resolvedPath = path.resolve(baseDir, normalizedPath);
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
export class ParsingEngine {
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
export class StructureAnalyzer {
    private slugger = new GithubSlugger();

    /**
     * 生成目录结构 - 支持跨会话稳定哈希
     */
    generateTableOfContents(ast: any, content: string): TableOfContents[] {
        const toc: TableOfContents[] = [];
        const lines = content.split('\n');
        
        // 稳定哈希需要的追踪结构
        const levelStack: Array<{level: number, slug: string}> = [];
        const parentChildCount = new Map<string, Map<string, number>>();
        const slugOccurrences = new Map<string, number>(); // 追踪每个slug在特定父级下的出现次数

        this.slugger.reset();

        visit(ast, 'heading', (node: any) => {
            const pos = position(node);
            if (!pos) return;

            const title = this.extractHeadingText(node);
            const normalizedTitle = TitleNormalizer.removeNumberPrefix(title);
            const headingLevel = node.depth;
            
            // 1. 计算父级路径
            const parentPath = this.calculateParentPath(levelStack, headingLevel);
            
            // 2. 生成基础slug（中文友好）
            const baseSlug = this.generateChineseFriendlySlug(normalizedTitle);
            
            // 🔍 调试：输出slug生成过程（仅在需要时启用）
            // logger.debug(`🔍 SID生成调试: title="${title}" -> normalizedTitle="${normalizedTitle}" -> baseSlug="${baseSlug}" -> parentPath="${parentPath}"`);
            
            // 3. 计算稳定位置
            const stablePosition = this.calculateStablePosition(parentChildCount, parentPath, normalizedTitle);
            
            // 4. 检查是否需要短哈希去重
            let finalSlug = baseSlug;
            const slugKey = `${parentPath}#${baseSlug}`;
            
            if (slugOccurrences.has(slugKey)) {
                // 需要短哈希去重
                const stableHashInput = [
                    baseSlug,
                    parentPath,
                    stablePosition.toString(),
                    normalizedTitle,
                    headingLevel.toString()
                ].join('|');
                
                const shortHash = HashGenerator.generateStableHash(stableHashInput);
                finalSlug = `${baseSlug}-${shortHash}`;
            }
            
            slugOccurrences.set(slugKey, (slugOccurrences.get(slugKey) || 0) + 1);
            
            // 5. 生成层级SID
            const sid = parentPath && parentPath.length > 0 ? `/${parentPath}/${finalSlug}` : `/${finalSlug}`;
            
            // 6. 更新层级堆栈
            this.updateLevelStack(levelStack, headingLevel, finalSlug);
            
            // 计算文本偏移（暂时不包含endLine，将在calculateSectionEndLines后更新）
            const offset = this.calculateTextOffset(pos);
            
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
                parent: undefined, // 将在buildHierarchy中设置
                children: [],
                // AI友好字段初始值
                siblingIndex: 0,
                siblingCount: 0
            };

            toc.push(tocEntry);
        });

        // 建立父子关系
        this.buildHierarchy(toc);
        
        // 🆕 计算AI友好字段
        this.calculateAIFriendlyFields(toc);

        // 🆕 计算所有章节的 endLine（为 executeMarkdownEdits 提供支持）
        this.calculateSectionEndLines(toc, lines.length);

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
     * 🚀 生成中文友好的slug
     * 解决github-slugger对中文支持不好的问题
     */
    private generateChineseFriendlySlug(title: string): string {
        if (!title || title.trim().length === 0) {
            return 'untitled';
        }

        // 1. 基本清理
        let slug = title.trim().toLowerCase();
        
        // 2. 🔧 Bug Fix: 使用白名单模式处理字符，确保与SID验证器契约一致
        // 只保留：字母(a-z)、数字(0-9)、中文(CJK统一表意文字)、日文平假名/片假名、韩文、连字符、下划线
        // 这确保生成的SID能通过 sid-based-semantic-locator.ts 中的验证
        slug = slug
            .replace(/\s+/g, '-')           // 空格转为连字符
            // 白名单：保留安全字符，移除所有其他字符（包括 &, @, #, $, %, *, +, =, |, ~ 等）
            .replace(/[^a-z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\-_]/g, '-')
            .replace(/-+/g, '-')            // 多个连字符合并为一个
            .replace(/^-+|-+$/g, '');       // 去除首尾连字符

        // 3. 改进的fallback处理（处理纯特殊字符标题）
        if (!slug || slug.length === 0) {
            // 3.1 尝试提取任何字母数字字符
            const sanitized = title.replace(/[^a-zA-Z0-9]/g, '');
            if (sanitized && sanitized.length > 0) {
                slug = this.slugger.slug(sanitized);
            }
            
            // 3.2 如果仍然无法生成有效slug，使用稳定哈希作为fallback
            if (!slug || slug.length === 0) {
                const hash = HashGenerator.generateStableHash(title);
                slug = `section-${hash}`;
            }
        }

        // 4. 确保不以数字开头（如果是，添加前缀）
        if (/^\d/.test(slug)) {
            slug = `section-${slug}`;
        }

        return slug;
    }

    /**
     * 计算父级路径 - 用于稳定哈希
     */
    private calculateParentPath(levelStack: Array<{level: number, slug: string}>, currentLevel: number): string {
        // 清理不再是父级的节点
        while (levelStack.length > 0 && levelStack[levelStack.length - 1].level >= currentLevel) {
            levelStack.pop();
        }
        
        return levelStack.map(item => item.slug).join('/');
    }

    /**
     * 计算稳定位置 - 基于父级路径和标题的出现次数
     */
    private calculateStablePosition(
        parentChildCount: Map<string, Map<string, number>>, 
        parentPath: string, 
        normalizedTitle: string
    ): number {
        if (!parentChildCount.has(parentPath)) {
            parentChildCount.set(parentPath, new Map());
        }
        
        const childMap = parentChildCount.get(parentPath)!;
        const currentCount = childMap.get(normalizedTitle) || 0;
        const newCount = currentCount + 1;
        childMap.set(normalizedTitle, newCount);
        
        return newCount;
    }

    /**
     * 更新层级堆栈 - 维护当前文档层级结构
     */
    private updateLevelStack(
        levelStack: Array<{level: number, slug: string}>, 
        currentLevel: number, 
        currentSlug: string
    ): void {
        // 清理同级和更深层级的节点
        while (levelStack.length > 0 && levelStack[levelStack.length - 1].level >= currentLevel) {
            levelStack.pop();
        }
        
        // 添加当前节点到堆栈
        levelStack.push({level: currentLevel, slug: currentSlug});
    }

    /**
     * 计算文本偏移 - 章节范围定位
     */
    private calculateTextOffset(pos: any, sectionEndLine?: number): TextOffset {
        return {
            utf16: {
                startLine: pos.start.line,          // 章节开始行（标题行）
                endLine: sectionEndLine || pos.start.line,  // 章节结束行（如果已计算）
                startColumn: pos.start.column,      // 标题开始列
                endColumn: pos.end.column           // 标题结束列
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
     * 生成树状目录结构 (用于structure和full模式)
     */
    generateTableOfContentsTree(ast: any, content: string): TableOfContentsTreeNode[] {
        const flatToc = this.generateTableOfContents(ast, content);
        return this.convertToTreeStructure(flatToc);
    }

    /**
     * 生成ToC模式树状结构 (简化版)
     */
    generateTableOfContentsToCTree(ast: any, content: string): TableOfContentsToCNode[] {
        const flatToc = this.generateTableOfContents(ast, content);
        return this.convertToToCTreeStructure(flatToc);
    }

    /**
     * 将扁平的目录转换为树状结构
     */
    private convertToTreeStructure(flatToc: TableOfContents[]): TableOfContentsTreeNode[] {
        const rootNodes: TableOfContentsTreeNode[] = [];
        const nodeMap = new Map<string, TableOfContentsTreeNode>();

        // 创建所有节点
        for (const item of flatToc) {
            const treeNode: TableOfContentsTreeNode = {
                sid: item.sid,
                displayId: item.displayId,
                title: item.title,
                normalizedTitle: item.normalizedTitle,
                level: item.level,
                line: item.line,
                offset: item.offset,
                wordCount: item.wordCount,
                characterCount: item.characterCount,
                containsCode: item.containsCode,
                containsTables: item.containsTables,
                containsLists: item.containsLists,
                children: [],
                siblingIndex: item.siblingIndex,
                siblingCount: item.siblingCount,
                endLine: item.endLine  // 🆕 复制章节结束行号
            };
            nodeMap.set(item.sid, treeNode);
        }

        // 建立树状关系
        for (const item of flatToc) {
            const node = nodeMap.get(item.sid)!;
            if (item.parent) {
                const parentNode = nodeMap.get(item.parent);
                if (parentNode) {
                    parentNode.children.push(node);
                }
            } else {
                rootNodes.push(node);
            }
        }

        return rootNodes;
    }

    /**
     * 将扁平的目录转换为ToC树状结构
     */
    private convertToToCTreeStructure(flatToc: TableOfContents[]): TableOfContentsToCNode[] {
        const rootNodes: TableOfContentsToCNode[] = [];
        const nodeMap = new Map<string, TableOfContentsToCNode>();

        // 创建所有节点
        for (const item of flatToc) {
            const tocNode: TableOfContentsToCNode = {
                sid: item.sid,
                displayId: item.displayId,
                title: item.title,
                level: item.level,
                characterCount: item.characterCount,
                parent: item.parent,
                children: []
            };
            nodeMap.set(item.sid, tocNode);
        }

        // 建立树状关系
        for (const item of flatToc) {
            const node = nodeMap.get(item.sid)!;
            if (item.parent) {
                const parentNode = nodeMap.get(item.parent);
                if (parentNode) {
                    parentNode.children.push(node);
                }
            } else {
                rootNodes.push(node);
            }
        }

        return rootNodes;
    }

    /**
     * 分析章节内容 (移除废弃字段)
     */
    private analyzeSectionContent(content: string): SectionMetadata {
        const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
        const characterCount = content.length;
        
        const containsCode = /```/.test(content);
        const containsTables = /\|.*\|/.test(content);
        const containsLists = /^[\s]*[-*+]\s/.test(content);

        return {
            wordCount,
            characterCount,
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
     * 计算AI友好字段 (移除childTitles字段)
     */
    private calculateAIFriendlyFields(toc: TableOfContents[]): void {
        // 递归计算每个节点的AI友好字段
        const calculateForNode = (node: TableOfContents, siblings: TableOfContents[]) => {
            // 计算siblingIndex和siblingCount
            node.siblingIndex = siblings.indexOf(node);
            node.siblingCount = siblings.length;
            
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

    /**
     * 🆕 计算所有章节的结束行号
     * 这是为 executeMarkdownEdits 提供的关键功能
     * 
     * 🔧 修复：最后一个heading级别的endLine计算错误
     * - 原问题：预设错误初始值导致最后一个同级章节无法包含所有子章节
     * - 修复：默认到文档末尾，只有找到真正边界才缩小范围
     */
    private calculateSectionEndLines(toc: TableOfContents[], totalLines: number): void {
        // 按行号排序，确保顺序处理
        const sortedToc = [...toc].sort((a, b) => a.line - b.line);
        
        for (let i = 0; i < sortedToc.length; i++) {
            const currentSection = sortedToc[i];
            
            // ✅ 修复：默认到文档末尾，只有找到真正边界才缩小范围
            let endLine = totalLines;
            
            // 寻找下一个同级或更高级别的标题作为边界
            for (let j = i + 1; j < sortedToc.length; j++) {
                const candidateSection = sortedToc[j];
                
                // 如果遇到同级或更高级别的标题，这就是真正的边界
                if (candidateSection.level <= currentSection.level) {
                    endLine = candidateSection.line - 1;
                    break;
                }
            }
            
            // 设置结果，确保不小于起始行
            currentSection.endLine = Math.max(endLine, currentSection.line);
            
            // 🆕 更新 offset 中的 endLine
            currentSection.offset.utf16.endLine = currentSection.endLine;
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
                const tocTree = this.structureAnalyzer.generateTableOfContentsTree(ast, content);
                const tocToCTree = this.structureAnalyzer.generateTableOfContentsToCTree(ast, content);
                
                parsedData = { ast, toc, tocTree, tocToCTree };
                this.cacheManager.set(cacheKey, parsedData);
            }

            // 5. 构建搜索索引 (如果需要)
            if (args.targets?.some(t => t.type === 'keyword')) {
                this.searchEngine.buildSearchIndex(parsedData.toc, content);
            }

            // 6. 处理多目标请求
            const results = await this.processTargets(args.targets || [], parsedData.toc, content);

            // 7. 构建结果
            return this.buildResult(args, resolvedPath, fileStats, content, parsedData, results, cacheHit, startTime);
        
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
        // 验证 SID 是否提供
        if (!target.sid) {
            return {
                type: 'section',
                success: false,
                error: {
                    code: ErrorCode.SECTION_NOT_FOUND,
                    message: `SID is required for section target. Use parseMode='toc' first to discover available SIDs.`,
                    suggestion: `Available SIDs: ${toc.slice(0, 5).map(s => s.sid).join(', ')}${toc.length > 5 ? ` (showing first 5 of ${toc.length})` : ''}`
                }
            };
        }
        
        // 查找匹配的章节
        const section = toc.find(s => s.sid === target.sid);

        if (!section) {
            // 查找相似的SID建议
            const similarSids = toc.filter(s => 
                s.sid.toLowerCase().includes(target.sid!.toLowerCase()) ||
                s.title.toLowerCase().includes(target.sid!.replace(/[-_]/g, ' ').toLowerCase())
            ).slice(0, 3);
            
            let suggestions = `Available SIDs: ${toc.slice(0, 5).map(s => s.sid).join(', ')}`;
            if (toc.length > 5) {
                suggestions += ` (showing first 5 of ${toc.length})`;
            }
            
            if (similarSids.length > 0) {
                suggestions = `Similar SIDs found: ${similarSids.map(s => `${s.sid} ("${s.title}")`).join(', ')}. Check for typos in the SID.`;
            }
            
            return {
                type: 'section',
                success: false,
                error: {
                    code: ErrorCode.SECTION_NOT_FOUND,
                    message: `Section not found with SID: ${target.sid}`,
                    suggestion: suggestions
                }
            };
        }

        // 提取章节内容
        const sectionContent = this.extractSectionContent(content, section);

        const result: TargetResult = {
            type: 'section' as const,
            success: true,
            sid: section.sid,
            sectionTitle: section.title,
            content: sectionContent,
            metadata: {
                wordCount: section.wordCount,
                characterCount: section.characterCount,
                containsCode: section.containsCode,
                containsTables: section.containsTables,
                containsLists: section.containsLists
            }
        };
        
        // SID 匹配成功，记录日志
        logger.info(`✅ Section found: "${section.title}" (sid: ${section.sid})`);
        
        return result;
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
        parsedData: { ast: any, toc: TableOfContents[], tocTree: TableOfContentsTreeNode[], tocToCTree: TableOfContentsToCNode[] },
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
            // 树状目录结构
            tableOfContentsTree: parseMode === 'structure' || parseMode === 'full' ? 
                this.getFilteredStructure(parsedData.tocTree, args.targets) : undefined,
            // ToC模式的简化树状结构
            tableOfContentsToCTree: parseMode === 'toc' ? parsedData.tocToCTree : undefined,
            contentSummary: parseMode === 'structure' ? this.generateContentSummary(content, parsedData.toc) : undefined,
            results: parseMode === 'structure' ? [] : results,
            parseTime: Date.now() - startTime,
            cacheHit
        };
    }

    /**
     * 根据 targets 过滤结构树
     */
    private getFilteredStructure(
        tocTree: TableOfContentsTreeNode[], 
        targets?: TargetRequest[]
    ): TableOfContentsTreeNode[] {
        // 无 targets 时返回完整结构
        if (!targets || targets.length === 0) {
            return tocTree;
        }
        
        // 提取目标 SIDs
        const targetSids = targets
            .filter(t => t.type === 'section' && t.sid)
            .map(t => t.sid!);
        
        if (targetSids.length === 0) {
            return tocTree;
        }
        
        return this.filterTreeByTargets(tocTree, targetSids);
    }

    /**
     * 递归过滤树结构
     */
    private filterTreeByTargets(
        nodes: TableOfContentsTreeNode[], 
        targetSids: string[]
    ): TableOfContentsTreeNode[] {
        const result: TableOfContentsTreeNode[] = [];
        
        for (const node of nodes) {
            // 检查当前节点是否匹配
            const isMatch = targetSids.some(sid => node.sid === sid);
            
            // 递归检查子节点
            const filteredChildren = this.filterTreeByTargets(node.children, targetSids);
            
            // 如果当前节点匹配或有匹配的子节点，则保留
            if (isMatch || filteredChildren.length > 0) {
                result.push({
                    ...node,
                    children: isMatch ? node.children : filteredChildren
                });
            }
        }
        
        return result;
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