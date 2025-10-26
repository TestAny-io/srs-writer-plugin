/**
 * SidBasedSemanticLocator - 基于SID的语义定位器
 * 
 * 🆕 全新的定位器，完全基于 readMarkdownFile 输出的 sid 进行定位
 * 支持精确的行号定位，无需复杂的路径匹配
 * 
 * Breaking Changes:
 * - 完全废弃基于 path 数组的定位
 * - 完全废弃基于 targetContent 的内容匹配
 * - 只支持 sid + lineRange 的精确定位
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { SemanticTarget, LocationResult, LineInfo, SidBasedEditError } from '../../types/semanticEditing';
import { ContentMatcher } from '../document/ContentMatcher';

const logger = Logger.getInstance();

/**
 * 🆕 Phase 2: 完全兼容 readMarkdownFile 输出的章节信息接口
 */
export interface TableOfContents {
    sid: string;                         // 层级稳定ID (如: /introduction/system-overview)
    displayId?: string;                  // 显示ID (如: "1.1") - 可选，保持向后兼容
    title: string;                       // 原始标题
    normalizedTitle: string;             // 规范化标题 (去除编号)
    level: number;                       // 标题级别 (1-6)
    line: number;                        // 所在行号
    offset?: any;                        // 精确位置信息（可选）
    
    // 章节元数据
    wordCount?: number;                  // 字数统计
    characterCount?: number;             // 字符数统计
    containsCode?: boolean;              // 是否包含代码块
    containsTables?: boolean;            // 是否包含表格
    containsLists?: boolean;             // 是否包含列表
    
    // 层级关系
    parent?: string;                     // 父级章节sid
    children?: TableOfContents[];        // 子章节列表
    
    // AI友好字段
    siblingIndex?: number;               // 在同级中的位置 (0-based)
    siblingCount?: number;               // 同级章节总数
    
    // 向后兼容字段
    endLine?: number;                    // 结束行号（可选）
    content?: string;                    // 章节内容（如果可用）
}

/**
 * 章节节点信息（内部使用）
 */
interface SectionNode {
    sid: string;
    title: string;
    startLine: number;              // 全局起始行号
    endLine: number;                // 全局结束行号
    totalLines: number;             // section内总行数
    content: string[];              // section内容按行分割
}

/**
 * SidBasedSemanticLocator - 全新的基于SID的语义定位器
 */
export class SidBasedSemanticLocator {
    private sidToNodeMap: Map<string, SectionNode> = new Map();
    private markdownLines: string[] = [];
    private contentMatcher: ContentMatcher;  // 🆕 内容匹配器
    
    // 🆕 Phase 2: 性能优化 - 缓存机制
    private locationCache: Map<string, LocationResult> = new Map();
    private nearbyLinesCache: Map<string, LineInfo[]> = new Map();

    constructor(markdownContent: string, tocData: TableOfContents[]) {
        const startTime = Date.now();
        
        this.markdownLines = markdownContent.split('\n');
        this.contentMatcher = new ContentMatcher();  // 🆕 初始化内容匹配器
        this.buildSidMapping(tocData);
        
        const initTime = Date.now() - startTime;
        logger.info(`🚀 SidBasedSemanticLocator initialized with ${this.sidToNodeMap.size} sections in ${initTime}ms`);
        logger.debug(`📊 Content stats: ${this.markdownLines.length} lines, ${this.sidToNodeMap.size} SID mappings`);
        
        // 🆕 Phase 2: 详细的初始化日志
        const sidsList = Array.from(this.sidToNodeMap.keys());
        logger.debug(`📋 Available SIDs: ${sidsList.slice(0, 10).join(', ')}${sidsList.length > 10 ? '...' : ''}`);
        
        // 统计各级别的章节数量
        const levelStats = new Map<number, number>();
        tocData.forEach(section => {
            levelStats.set(section.level, (levelStats.get(section.level) || 0) + 1);
        });
        logger.debug(`📈 Level distribution: ${Array.from(levelStats.entries()).map(([level, count]) => `L${level}:${count}`).join(', ')}`);
    }

    /**
     * 查找目标位置 - 主入口方法
     * @param target 语义目标（只支持 sid + lineRange）
     * @param operationType 操作类型，用于指导定位逻辑
     * @returns 定位结果
     */
    findTarget(target: SemanticTarget, operationType?: string): LocationResult {
        try {
            // 🆕 Phase 2: 性能优化 - 缓存查找
            const cacheKey = this.createCacheKey(target, operationType);
            const cachedResult = this.locationCache.get(cacheKey);
            if (cachedResult) {
                logger.debug(`⚡ Cache hit for ${cacheKey}`);
                return cachedResult;
            }
            
            logger.info(`🔍 Locating target: sid=${target.sid}, operation=${operationType}`);
            
            // 🆕 Phase 2: SID格式验证
            const formatValidation = this.validateSidFormat(target.sid);
            if (!formatValidation.isValid) {
                const errorResult = {
                    found: false,
                    error: formatValidation.error,
                    suggestions: formatValidation.suggestions
                };
                this.locationCache.set(cacheKey, errorResult);
                return errorResult;
            }
            
            // 查找参照section
            const section = this.sidToNodeMap.get(target.sid);
            if (!section) {
                const errorResult = this.createSidNotFoundError(target.sid);
                this.locationCache.set(cacheKey, errorResult);
                return errorResult;
            }

            // 🆕 处理删除操作
            let result: LocationResult;
            if (operationType === 'delete_section_and_title') {
                result = this.replaceEntireSection(section);
            }
            else if (operationType === 'delete_section_content_only') {
                // ⚠️ BREAKING CHANGE: 现在需要 contentMatch 来指定删除什么
                if (target.contentMatch) {
                    result = this.findByContentMatch(section, target.contentMatch, operationType);
                } else {
                    // 为了向后兼容，如果没有 contentMatch，返回错误提示
                    return {
                        found: false,
                        error: '⚠️ BREAKING CHANGE: delete_section_content_only now requires contentMatch to specify what to delete. To clear entire section, use replace_section_and_title with title-only content.',
                        suggestions: {
                            hint: 'Use target.contentMatch to specify the content to delete'
                        }
                    };
                }
            }
            // 🌟 优先使用内容匹配（如果提供）
            else if (target.contentMatch) {
                result = this.findByContentMatch(section, target.contentMatch, operationType);
            }
            // 处理插入操作
            else if (operationType?.startsWith('insert_')) {
                result = this.handleInsertionOperation(section, target, operationType);
            }
            // 处理基于行号的替换操作
            else if (target.lineRange) {
                result = this.findByLineRange(section, target.lineRange);
            }
            // 🔧 BUG FIX: replace_section_content_only 和 insert_section_content_only 必须提供定位信息
            else if (operationType === 'replace_section_content_only' || operationType === 'insert_section_content_only') {
                return {
                    found: false,
                    error: `${operationType} requires positioning information: provide contentMatch (recommended) or lineRange`,
                    suggestions: {
                        hint: 'Add target.contentMatch to use content matching (recommended), or target.lineRange to use line numbers',
                        example: `{
  "target": {
    "sid": "${target.sid}",
    "contentMatch": {
      "matchContent": "Content you want to ${operationType === 'replace_section_content_only' ? 'replace' : 'insert near'}"
    }
  }
}`,
                        sectionSummary: {
                            title: section.title,
                            totalContentLines: section.content.length,
                            availableRange: `1-${section.content.length}`,
                            sectionPreview: this.generateSectionPreview(section)
                        }
                    }
                };
            }
            // 替换整个章节（仅用于 replace_section_and_title）
            else {
                result = this.replaceEntireSection(section);
            }
            
            // 🆕 Phase 2: 缓存成功的结果
            this.locationCache.set(cacheKey, result);
            return result;
            
        } catch (error) {
            logger.error(`Failed to locate target: ${(error as Error).message}`);
            const errorResult = {
                found: false,
                error: `Failed to locate target: ${(error as Error).message}`
            };
            return errorResult;
        }
    }

    /**
     * 🆕 Phase 2: 生成缓存键（支持 contentMatch）
     */
    private createCacheKey(target: SemanticTarget, operationType?: string): string {
        const parts = [target.sid];
        
        if (target.contentMatch) {
            // 为内容匹配创建缓存键（使用内容哈希）
            const contentHash = this.hashString(target.contentMatch.matchContent);
            parts.push(`CM:${contentHash}`);
            if (target.contentMatch.contextBefore) {
                parts.push(`CB:${this.hashString(target.contentMatch.contextBefore)}`);
            }
            if (target.contentMatch.contextAfter) {
                parts.push(`CA:${this.hashString(target.contentMatch.contextAfter)}`);
            }
            if (target.contentMatch.position) {
                parts.push(`P:${target.contentMatch.position}`);
            }
        }
        
        if (target.lineRange) {
            parts.push(`L${target.lineRange.startLine}-${target.lineRange.endLine || target.lineRange.startLine}`);
        }
        
        if (target.insertionPosition) {
            parts.push(`pos:${target.insertionPosition}`);
        }
        
        if (operationType) {
            parts.push(`op:${operationType}`);
        }
        
        return parts.join('|');
    }
    
    /**
     * 简单字符串哈希（用于缓存键生成）
     */
    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < Math.min(str.length, 50); i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36).substring(0, 6);
    }

    /**
     * 🌟 基于内容匹配的精确定位（推荐方式）
     * 
     * 使用 ContentMatcher 在章节内容中查找匹配位置
     * 支持多行匹配和上下文消歧义
     */
    private findByContentMatch(
        section: SectionNode,
        contentMatch: NonNullable<SemanticTarget['contentMatch']>,
        operationType?: string
    ): LocationResult {
        logger.info(`🌟 [ContentMatch] Locating by content in section: ${section.sid}`);
        logger.debug(`🌟 [ContentMatch] matchContent length: ${contentMatch.matchContent.length}, hasContextBefore: ${!!contentMatch.contextBefore}, hasContextAfter: ${!!contentMatch.contextAfter}`);
        
        // 获取章节内容（不包括标题行）
        const sectionContent = section.content.join('\n');
        
        // 使用 ContentMatcher 查找位置
        const matchPosition = this.contentMatcher.findTarget(
            sectionContent,
            contentMatch.matchContent,
            contentMatch.contextBefore,
            contentMatch.contextAfter
        );
        
        if (!matchPosition) {
            // 查找失败，生成增强的错误信息
            const notFoundError = this.contentMatcher.generateNotFoundError(
                sectionContent,
                contentMatch.matchContent,
                section.title
            );
            
            logger.warn(`🌟 [ContentMatch] Match not found: ${notFoundError.error}`);
            
            return {
                found: false,
                error: notFoundError.error,
                suggestions: {
                    hint: notFoundError.hint,
                    sectionPreview: notFoundError.sectionPreview,
                    sectionSummary: {
                        title: notFoundError.sectionInfo.sectionTitle,
                        totalLines: notFoundError.sectionInfo.totalLines,
                        totalContentLines: section.content.length,
                        availableRange: `1-${section.content.length}`
                    }
                }
            };
        }
        
        logger.info(`🌟 [ContentMatch] ✅ Match found at line ${matchPosition.lineNumber} (section-relative)`);
        
        // 转换为文档绝对位置
        // matchPosition.lineNumber 是章节内容的相对行号（1-based）
        // section.startLine 是章节内容第一行的绝对行号（0-based）
        const sectionRelativeLineNumber = matchPosition.lineNumber;
        const documentAbsoluteStartLine = section.startLine + (sectionRelativeLineNumber - 1);
        
        // 根据 position 参数确定操作类型
        const position = contentMatch.position || 'replace';
        
        // 计算匹配内容占用的行数
        const matchedLines = contentMatch.matchContent.split('\n').length;
        const documentAbsoluteEndLine = documentAbsoluteStartLine + matchedLines - 1;
        
        if (position === 'replace' || operationType === 'delete_section_content_only') {
            const isDeleteOperation = operationType === 'delete_section_content_only';
            
            // 🔍 智能检测：matchContent 是否占据完整行（基于实际匹配位置，不依赖AI输入）
            let isFullLineMatch = false;
            if (isDeleteOperation) {
                // 找到匹配内容所在行的起始位置
                const lineStartIndex = matchPosition.startIndex === 0 
                    ? 0 
                    : sectionContent.lastIndexOf('\n', matchPosition.startIndex - 1) + 1;
                
                // 找到匹配内容所在行的结束位置
                const lineEndIndexInSection = sectionContent.indexOf('\n', matchPosition.startIndex);
                const lineEnd = lineEndIndexInSection === -1 ? sectionContent.length : lineEndIndexInSection;
                
                // 🔧 关键修复：检查match之前的内容是否只有空白字符（缩进）
                // 这样可以正确识别带缩进的列表项为"完整行"
                const precedingContent = sectionContent.substring(lineStartIndex, matchPosition.startIndex);
                const isPrecedingOnlyWhitespace = /^\s*$/.test(precedingContent);
                
                // 完整行判断：前面只有空格 && 到达行尾
                isFullLineMatch = isPrecedingOnlyWhitespace && (matchPosition.endIndex === lineEnd);
                
                logger.debug(`🔍 [DeleteCheck] Analyzing full-line match:`);
                logger.debug(`  - matchStart=${matchPosition.startIndex}, lineStart=${lineStartIndex}`);
                logger.debug(`  - precedingContent="${precedingContent}" (length=${precedingContent.length}), isPrecedingOnlyWhitespace=${isPrecedingOnlyWhitespace}`);
                logger.debug(`  - matchEnd=${matchPosition.endIndex}, lineEnd=${lineEnd}, atLineEnd=${matchPosition.endIndex === lineEnd}`);
                logger.debug(`  - isFullLineMatch=${isFullLineMatch}`);
            }
            
            // 检查是否为文档最后一行
            const isLastLine = documentAbsoluteEndLine >= this.markdownLines.length - 1;
            
            // 对于delete操作：如果是完整行匹配且不是最后一行，需要包含换行符
            const shouldIncludeNewline = isDeleteOperation && isFullLineMatch && !isLastLine;
            
            const rangeEnd = shouldIncludeNewline
                ? new vscode.Position(documentAbsoluteEndLine + 1, 0)  // 包含换行符，扩展到下一行开头
                : new vscode.Position(documentAbsoluteEndLine, this.getLineLength(documentAbsoluteEndLine));  // 不含换行符，到行尾
            
            logger.debug(`🔍 [DeleteCheck] Range decision:`);
            logger.debug(`  - isLastLine=${isLastLine}`);
            logger.debug(`  - shouldIncludeNewline=${shouldIncludeNewline}`);
            logger.debug(`  - rangeEnd=Position(${rangeEnd.line}, ${rangeEnd.character})`);
            
            // 替换或删除匹配的内容
            return {
                found: true,
                operationType: 'replace',
                range: new vscode.Range(
                    new vscode.Position(documentAbsoluteStartLine, 0),
                    rangeEnd
                ),
                context: {
                    sectionTitle: section.title,
                    targetLines: this.getLines(documentAbsoluteStartLine, documentAbsoluteEndLine),
                    relativeToAbsolute: {
                        sectionRelativeStart: sectionRelativeLineNumber,
                        sectionRelativeEnd: sectionRelativeLineNumber + matchedLines - 1,
                        documentAbsoluteStart: documentAbsoluteStartLine + 1,
                        documentAbsoluteEnd: documentAbsoluteEndLine + 1
                    }
                }
            };
        } else if (position === 'before') {
            // 在匹配内容之前插入
            return {
                found: true,
                operationType: 'insert',
                insertionPoint: new vscode.Position(documentAbsoluteStartLine, 0),
                context: {
                    sectionTitle: section.title,
                    sectionRelativeInsertLine: sectionRelativeLineNumber,
                    documentAbsoluteInsertLine: documentAbsoluteStartLine + 1
                }
            };
        } else if (position === 'after') {
            // 在匹配内容之后插入
            const insertLine = documentAbsoluteEndLine + 1;
            return {
                found: true,
                operationType: 'insert',
                insertionPoint: new vscode.Position(insertLine, 0),
                context: {
                    sectionTitle: section.title,
                    sectionRelativeInsertLine: sectionRelativeLineNumber + matchedLines,
                    documentAbsoluteInsertLine: insertLine + 1
                }
            };
        }
        
        throw new Error(`Unknown content match position: ${position}`);
    }
    
    /**
     * 🚀 基于相对行号的精确定位 - 将章节内相对行号转换为文档绝对行号
     */
    private findByLineRange(section: SectionNode, lineRange: { startLine: number; endLine?: number }): LocationResult {
        const { startLine, endLine } = lineRange;
        
        // 🆕 验证 endLine 必须存在（避免歧义）
        if (endLine === undefined) {
            return {
                found: false,
                error: `endLine is required for replace_section_content_only operations to avoid ambiguity. Please specify both startLine and endLine.`,
                suggestions: {
                    hint: `Use: { "startLine": ${startLine}, "endLine": ${startLine} } to replace a single line, or specify the actual endLine number for multi-line replacement`,
                    correctedLineRange: { startLine, endLine: startLine }
                }
            };
        }
        
        // 🆕 验证相对行号范围（基于章节内容）
        const sectionContentLines = section.content.length;
        
        if (startLine < 1 || startLine > sectionContentLines) {
            return {
                found: false,
                error: `Section-relative line ${startLine} out of range. Section "${section.title}" has ${sectionContentLines} content lines.`,
                suggestions: {
                    validRange: `1-${sectionContentLines}`,
                    hint: `Use section-relative line numbers. Line 1 = first content line after section title.`,
                    sectionPreview: this.generateSectionPreview(section)
                }
            };
        }

        if (endLine < startLine || endLine > sectionContentLines) {
            return {
                found: false,
                error: `Invalid section-relative line range: ${startLine}-${endLine}. Section "${section.title}" has ${sectionContentLines} content lines.`,
                suggestions: {
                    validRange: `1-${sectionContentLines}`,
                    hint: `Use section-relative line numbers. Line ${startLine} is valid, but line ${endLine} exceeds section content.`,
                    sectionPreview: this.generateSectionPreview(section)
                }
            };
        }
        
        // 🚀 关键转换：将相对行号转换为文档绝对行号
        // section.startLine 是章节内容开始的绝对行号（0-based）
        // 相对行号 1 对应章节内容的第一行
        const globalStartLine = section.startLine + (startLine - 1); // 转换为绝对行号（0-based）
        const globalEndLine = section.startLine + (endLine - 1);     // 转换为绝对行号（0-based）
        
        logger.info(`✅ Found target at section-relative lines ${startLine}-${endLine}, converted to absolute lines ${globalStartLine + 1}-${globalEndLine + 1} (0-based: ${globalStartLine}-${globalEndLine})`);
        
        return {
            found: true,
            operationType: 'replace',
            range: new vscode.Range(
                new vscode.Position(globalStartLine, 0),
                new vscode.Position(globalEndLine, this.getLineLength(globalEndLine))
            ),
            context: {
                sectionTitle: section.title,
                targetLines: this.getLines(globalStartLine, globalEndLine),
                lineRange: { startLine, endLine },
                relativeToAbsolute: { 
                    sectionRelativeStart: startLine, 
                    sectionRelativeEnd: endLine,
                    documentAbsoluteStart: globalStartLine + 1, 
                    documentAbsoluteEnd: globalEndLine + 1 
                }
            }
        };
    }

    /**
     * 🚀 替换整个章节（包括标题）
     */
    private replaceEntireSection(section: SectionNode): LocationResult {
        // 🚀 关键修改：replace_section_and_title 应该包括标题行
        // section.startLine 是内容开始行，我们需要包括标题行
        const titleLine = section.startLine - 1; // 标题行的绝对行号（0-based）

        return {
            found: true,
            operationType: 'replace',
            range: new vscode.Range(
                new vscode.Position(titleLine, 0),        // 从标题行开始
                new vscode.Position(section.endLine, this.getLineLength(section.endLine)) // 到内容结束
            ),
            context: {
                sectionTitle: section.title,
                targetLines: this.getLines(titleLine, section.endLine), // 包括标题和内容
                includesTitle: true  // 标记包含标题
            }
        };
    }

    /**
     * 🆕 删除章节内容（保留标题）
     * 
     * ⚠️ 注意：这个方法已废弃，现在 delete_section_content_only 需要 contentMatch
     * 保留此方法仅用于兼容性，实际不应该被调用
     */
    private handleDeleteContentOnly(section: SectionNode): LocationResult {
        // 如果章节没有内容，返回错误
        if (section.content.length === 0) {
            return {
                found: false,
                error: `Section "${section.title}" has no content to delete (title-only section)`,
                suggestions: {
                    hint: 'Use delete_section_and_title to delete the entire section including the title'
                }
            };
        }

        // 🔧 BUG FIX: 删除操作需要包含换行符，避免留下空行
        const isLastLine = section.endLine >= this.markdownLines.length - 1;
        
        const rangeEnd = isLastLine
            ? new vscode.Position(section.endLine, this.getLineLength(section.endLine))  // 最后一行：到行尾
            : new vscode.Position(section.endLine + 1, 0);  // 非最后一行：包含换行符
        
        logger.debug(`🔍 [DeleteContentOnly] Deleting section content with newline handling:`);
        logger.debug(`  - contentLines: ${section.startLine} to ${section.endLine}`);
        logger.debug(`  - isLastLine=${isLastLine}`);
        logger.debug(`  - rangeEnd=Position(${rangeEnd.line}, ${rangeEnd.character})`);

        return {
            found: true,
            operationType: 'replace',
            range: new vscode.Range(
                new vscode.Position(section.startLine, 0),        // 从内容第一行开始
                rangeEnd  // 智能处理换行符
            ),
            context: {
                sectionTitle: section.title,
                targetLines: this.getLines(section.startLine, section.endLine), // 只包括内容
                includesTitle: false  // 不包含标题
            }
        };
    }

    /**
     * 处理插入操作 - 🔄 简化：根据操作类型严格验证字段
     */
    private handleInsertionOperation(section: SectionNode, target: SemanticTarget, operationType: string): LocationResult {
        // 🔄 根据操作类型验证必需字段
        if (operationType === 'insert_section_and_title') {
            // insert_section_and_title: 必须有 insertionPosition，忽略 lineRange
            if (!target.insertionPosition) {
                return {
                    found: false,
                    error: "insertionPosition ('before' or 'after') is required for insert_section_and_title operations",
                    suggestions: {
                        hint: "Use 'before' to insert before the reference section, or 'after' to insert after it",
                        availablePositions: ['before', 'after']
                    }
                };
            }

            // 验证 insertionPosition 值
            if (!['before', 'after'].includes(target.insertionPosition)) {
                return {
                    found: false,
                    error: `Invalid insertionPosition '${target.insertionPosition}'. Only 'before' and 'after' are supported for insert_section_and_title.`,
                    suggestions: {
                        hint: "Use 'before' or 'after' for insert_section_and_title operations",
                        availablePositions: ['before', 'after']
                    }
                };
            }

            let insertionPoint: vscode.Position;
            switch (target.insertionPosition) {
                case 'before':
                    insertionPoint = new vscode.Position(section.startLine, 0);
                    break;
                case 'after':
                    insertionPoint = new vscode.Position(section.endLine + 1, 0);
                    break;
            }

            return {
                found: true,
                operationType: 'insert',
                insertionPoint,
                context: {
                    sectionTitle: section.title
                }
            };

        } else if (operationType === 'insert_section_content_only') {
            // 🔧 BUG FIX: insert_section_content_only 必须有 contentMatch 或 lineRange
            if (!target.contentMatch && !target.lineRange) {
                return {
                    found: false,
                    error: "insert_section_content_only requires positioning information: provide contentMatch (recommended) or lineRange",
                    suggestions: {
                        hint: "Add target.contentMatch to use content matching, or target.lineRange to use line numbers",
                        example: `{
  "target": {
    "sid": "${target.sid}",
    "contentMatch": {
      "matchContent": "Content to insert near",
      "position": "after"
    }
  }
}`,
                        sectionSummary: {
                            title: section.title,
                            totalContentLines: section.content.length,
                            availableRange: `1-${section.content.length + 1}`,
                            sectionPreview: this.generateSectionPreview(section)
                        }
                    }
                };
            }
            
            // 如果提供了 contentMatch，使用内容匹配
            if (target.contentMatch) {
                // Content matching已经在前面处理（第158行），这里不应该到达
                // 但为了防御性编程，还是调用一次
                return this.findByContentMatch(section, target.contentMatch, operationType);
            }
            
            // 否则使用 lineRange（已经验证过存在）
            // 🚀 使用相对行号进行插入
            const { startLine } = target.lineRange!;  // Non-null assertion: 已在上面验证过
            const sectionContentLines = section.content.length;

            // 插入位置可以是 1 到 sectionContentLines + 1（在最后插入）
            if (startLine < 1 || startLine > sectionContentLines + 1) {
                return {
                    found: false,
                    error: `Section-relative insert line ${startLine} out of range. Valid range: 1-${sectionContentLines + 1}`,
                    suggestions: {
                        validRange: `1-${sectionContentLines + 1}`,
                        hint: `Use section-relative line numbers. To insert at the end of section content, use line ${sectionContentLines + 1}.`,
                        sectionPreview: this.generateSectionPreview(section)
                    }
                };
            }

            // 🚀 转换相对行号为绝对行号
            const globalInsertLine = section.startLine + (startLine - 1); // 转换为绝对行号（0-based）
            const insertionPoint = new vscode.Position(globalInsertLine, 0);

            logger.info(`✅ Insert at section-relative line ${startLine}, converted to absolute line ${globalInsertLine + 1} (0-based: ${globalInsertLine})`);

            return {
                found: true,
                operationType: 'insert',
                insertionPoint,
                context: {
                    sectionTitle: section.title,
                    sectionRelativeInsertLine: startLine,
                    documentAbsoluteInsertLine: globalInsertLine + 1,
                    lineRange: target.lineRange
                }
            };

        } else {
            return {
                found: false,
                error: `Unknown insertion operation type: ${operationType}`,
                suggestions: {
                    hint: "Supported insertion types: 'insert_section_and_title', 'insert_section_content_only'",
                    availableTypes: ['insert_section_and_title', 'insert_section_content_only']
                }
            };
        }
    }

    /**
     * 🚀 构建 sid -> SectionNode 的直接映射（支持相对行号）
     */
    private buildSidMapping(tocData: TableOfContents[]): void {
        for (const section of tocData) {
            // 计算章节内容行（排除标题行）
            const sectionTitleLine = section.line - 1; // 转为0-based，标题行
            const sectionEndLine = this.calculateEndLine(section);
            
            // 🚀 关键修改：内容从标题行的下一行开始
            const contentStartLine = sectionTitleLine + 1; // 跳过标题行，内容开始的绝对行号（0-based）
            const contentEndLine = sectionEndLine;
            
            // 提取章节内容行数组（不包括标题行）
            const sectionContentLines = this.markdownLines.slice(contentStartLine, contentEndLine + 1);
            
            const sectionNode: SectionNode = {
                sid: section.sid,
                title: section.title,
                startLine: contentStartLine,      // 内容开始的绝对行号（0-based）
                endLine: contentEndLine,          // 内容结束的绝对行号（0-based）
                totalLines: sectionContentLines.length,
                content: sectionContentLines     // 章节内容行数组
            };
            
            this.sidToNodeMap.set(section.sid, sectionNode);
            logger.debug(`📝 Mapped SID '${section.sid}' -> content lines ${contentStartLine + 1}-${contentEndLine + 1} (${sectionContentLines.length} content lines, title at ${sectionTitleLine + 1})`);
            
            // 递归处理子章节
            if (section.children && section.children.length > 0) {
                this.buildSidMapping(section.children);
            }
        }
    }

    /**
     * 🆕 Phase 2: 智能计算章节结束行号
     */
    private calculateEndLine(section: TableOfContents): number {
        if (section.endLine) {
            return section.endLine - 1; // 转为0-based索引
        }
        
        // 如果没有endLine，尝试基于字符数估算
        if (section.characterCount && section.characterCount > 0) {
            // 估算：平均每行50个字符
            const estimatedLines = Math.ceil(section.characterCount / 50);
            return section.line - 1 + estimatedLines;
        }
        
        // 默认为单行
        return section.line - 1;
    }

    /**
     * 🆕 Phase 2: 计算章节行数（增强版）
     */
    private calculateSectionLines(section: TableOfContents): number {
        const endLine = this.calculateEndLine(section);
        const startLine = section.line - 1;
        return endLine - startLine + 1;
    }

    /**
     * 🚀 提取章节内容（已废弃，现在在buildSidMapping中直接处理）
     */
    private extractSectionContent(section: TableOfContents): string[] {
        // 这个方法已不再使用，内容提取现在在buildSidMapping中处理
        return [];
    }

    /**
     * 🆕 生成章节预览，帮助AI理解章节内容结构
     */
    private generateSectionPreview(section: SectionNode): string {
        const maxLines = 10; // 最多显示10行
        const preview = section.content.slice(0, maxLines).map((line, index) => {
            const lineNumber = index + 1; // 相对行号（1-based）
            const truncatedLine = line.length > 80 ? line.substring(0, 80) + '...' : line;
            return `${lineNumber}: ${truncatedLine}`;
        }).join('\n');
        
        const hasMore = section.content.length > maxLines;
        return preview + (hasMore ? `\n... (${section.content.length - maxLines} more lines)` : '');
    }

    /**
     * 获取指定行的长度
     */
    private getLineLength(lineIndex: number): number {
        return this.markdownLines[lineIndex]?.length || 0;
    }

    /**
     * 获取指定范围的行内容
     */
    private getLines(startLine: number, endLine: number): string[] {
        return this.markdownLines.slice(startLine, endLine + 1);
    }

    /**
     * 🆕 Phase 2: 智能错误恢复 - 获取附近行信息（带缓存优化）
     */
    private getNearbyLinesInfo(section: SectionNode, targetLine: number): LineInfo[] {
        // 🆕 Phase 2: 缓存优化
        const cacheKey = `${section.sid}:${targetLine}`;
        const cached = this.nearbyLinesCache.get(cacheKey);
        if (cached) {
            logger.debug(`⚡ NearbyLines cache hit for ${cacheKey}`);
            return cached;
        }
        
        const range = 3; // 前后3行
        const start = Math.max(1, targetLine - range);
        const end = Math.min(section.totalLines, targetLine + range);
        
        const result = this.getLines(start - 1, end - 1).map((content, index) => ({
            lineNumber: start + index,
            content: content.substring(0, 100), // 截断长行
            isTarget: start + index === targetLine
        }));
        
        // 缓存结果
        this.nearbyLinesCache.set(cacheKey, result);
        return result;
    }

    /**
     * 🆕 Phase 2: SID格式验证
     */
    private validateSidFormat(sid: string): {
        isValid: boolean;
        error?: string;
        suggestions?: any;
    } {
        // 基本格式检查
        if (!sid) {
            return {
                isValid: false,
                error: "SID cannot be empty",
                suggestions: {
                    hint: "SID should start with '/' and follow the pattern like '/section-1' or '/section-1/subsection-2'",
                    availableSids: Array.from(this.sidToNodeMap.keys()).slice(0, 5)
                }
            };
        }

        if (!sid.startsWith('/')) {
            return {
                isValid: false,
                error: `SID '${sid}' must start with '/'`,
                suggestions: {
                    correctedSid: `/${sid}`,
                    hint: "SID should follow the pattern like '/section-1' or '/section-1/subsection-2'",
                    similarSids: this.findSimilarSids(sid)
                }
            };
        }

        // 检查是否包含连续的斜杠
        if (sid.includes('//')) {
            return {
                isValid: false,
                error: `SID '${sid}' contains consecutive slashes '//'`,
                suggestions: {
                    correctedSid: sid.replace(/\/+/g, '/'),
                    hint: "SID should not contain consecutive slashes"
                }
            };
        }

        // 检查是否以斜杠结尾（除了根路径）
        if (sid.length > 1 && sid.endsWith('/')) {
            return {
                isValid: false,
                error: `SID '${sid}' should not end with '/'`,
                suggestions: {
                    correctedSid: sid.slice(0, -1),
                    hint: "SID should not end with '/' unless it's the root '/'"
                }
            };
        }

        // 检查是否包含无效字符 (支持Unicode字符，包括中文)
        // 允许：字母(包括Unicode)、数字、连字符、下划线、斜杠
        const invalidChars = sid.match(/[^\w\-\/\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g);
        if (invalidChars) {
            return {
                isValid: false,
                error: `SID '${sid}' contains invalid characters: ${invalidChars.join(', ')}`,
                suggestions: {
                    hint: "SID should contain letters (including Unicode), numbers, hyphens, underscores, and forward slashes",
                    correctedSid: sid.replace(/[^\w\-\/\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, '-'),
                    availableSids: Array.from(this.sidToNodeMap.keys()).slice(0, 5)
                }
            };
        }

        return { isValid: true };
    }

    /**
     * 🆕 Phase 2: 性能优化 - 清理缓存
     */
    public clearCache(): void {
        this.locationCache.clear();
        this.nearbyLinesCache.clear();
        logger.debug(`🧹 Locator cache cleared`);
    }

    /**
     * 🆕 Phase 2: 性能统计
     */
    public getCacheStats(): { locationCacheSize: number; nearbyLinesCacheSize: number } {
        return {
            locationCacheSize: this.locationCache.size,
            nearbyLinesCacheSize: this.nearbyLinesCache.size
        };
    }

    /**
     * 创建SID未找到的错误
     */
    private createSidNotFoundError(targetSid: string): LocationResult {
        const availableSids = Array.from(this.sidToNodeMap.keys());
        const similarSids = this.findSimilarSids(targetSid);
        
        logger.warn(`❌ Section with sid '${targetSid}' not found`);
        
        return {
            found: false,
            error: `Section with sid '${targetSid}' not found`,
            suggestions: {
                availableSids,
                similarSids
            }
        };
    }

    /**
     * 智能建议相似的 sid
     */
    private findSimilarSids(targetSid: string): string[] {
        const allSids = Array.from(this.sidToNodeMap.keys());
        
        return allSids
            .filter(sid => this.calculateSimilarity(sid, targetSid) > 0.5)
            .sort((a, b) => this.calculateSimilarity(b, targetSid) - this.calculateSimilarity(a, targetSid))
            .slice(0, 3);
    }

    /**
     * 计算字符串相似度（简单的相似度算法）
     */
    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * 计算编辑距离
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * 获取所有可用的 sids（用于调试）
     */
    getAvailableSids(): string[] {
        return Array.from(this.sidToNodeMap.keys());
    }

    /**
     * 获取章节信息（用于调试）
     */
    getSectionInfo(sid: string): SectionNode | undefined {
        return this.sidToNodeMap.get(sid);
    }
}
