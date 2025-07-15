/**
 * SemanticLocator - 语义定位器
 * 
 * 基于AST语法树，实现精确的语义位置定位功能
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { Root as MdastRoot, Content as MdastContent, Heading as MdastHeading } from 'mdast';

const logger = Logger.getInstance();

/**
 * 语义目标接口
 */
export interface SemanticTarget {
    sectionName: string;
    subsection?: string;
    position?: 'before' | 'after' | 'replace' | 'append' | 'prepend';
    anchor?: string;
    
    // 🚀 新增：行内编辑定位字段
    targetContent?: string;      // 要修改/删除的目标内容
    afterContent?: string;       // 在此内容之后插入
    beforeContent?: string;      // 在此内容之前插入
    contentToRemove?: string;    // 要删除的具体内容
    
    // ✨ 新增：上下文锚点 - 用于精确定位重复内容
    contextAnchor?: string;      // 例如 "req-id: FR-PDF-005"，确保在正确的上下文中定位目标内容
}

/**
 * 定位结果接口
 */
export interface LocationResult {
    found: boolean;
    range?: vscode.Range;
    insertionPoint?: vscode.Position;
    context?: {
        beforeText: string;
        afterText: string;
        parentSection?: string;
    };
}

/**
 * AST章节信息接口
 */
interface ASTSectionInfo {
    name: string;
    level: number;
    startLine: number;
    endLine: number;
    content: string;
    node: MdastHeading;
}

/**
 * SemanticLocator - 基于AST的语义定位器
 */
export class SemanticLocator {
    private ast: MdastRoot;
    private sourceText: string;
    private sections: ASTSectionInfo[];
    private lines: string[];
    
    constructor(markdownContent: string) {
        this.sourceText = markdownContent;
        this.lines = markdownContent.split('\n');
        
        try {
            // 解析Markdown为AST
            this.ast = unified().use(remarkParse).parse(markdownContent) as MdastRoot;
            
            // 提取章节信息
            this.sections = this.extractSections();
            
            logger.info(`🎯 SemanticLocator initialized with AST: ${this.sections.length} sections found`);
            
            // 🔍 DEBUG: 详细输出所有解析的章节信息
            logger.info(`🔍 [DEBUG] All parsed sections:`);
            this.sections.forEach((section, index) => {
                logger.info(`🔍 [DEBUG] Section ${index}: "${section.name}" (level=${section.level}, lines=${section.startLine}-${section.endLine})`);
            });
        } catch (error) {
            logger.error(`Failed to parse markdown: ${(error as Error).message}`);
            this.ast = { type: 'root', children: [] };
            this.sections = [];
        }
    }
    
    /**
     * 查找目标位置
     * @param target 语义目标
     * @returns 定位结果
     */
    findTarget(target: SemanticTarget): LocationResult {
        try {
            logger.info(`🔍 Locating target: ${target.sectionName} (${target.position || 'replace'})`);
            
            // 查找目标section
            const section = this.findSectionByName(target.sectionName);
            if (!section) {
                logger.warn(`❌ Section not found: ${target.sectionName}`);
                return { found: false };
            }
            
            // 🚀 新增：处理行内编辑的内容定位
            if (target.targetContent || target.afterContent || target.beforeContent || target.contentToRemove) {
                return this.findContentInSection(section, target);
            }
            
            // 🚀 特殊处理：直接处理append_to_section和prepend_to_section操作
            if (target.position === 'append') {
                logger.info(`📝 Processing append_to_section operation`);
                return this.calculateAppendPosition(section);
            }
            
            if (target.position === 'prepend') {
                logger.info(`📝 Processing prepend_to_section operation`);
                return this.calculatePrependPosition(section);
            }
            
            // 根据position计算具体位置
            const result = this.calculatePosition(section, target);
            
            if (result.found) {
                logger.info(`✅ Target located successfully`);
            } else {
                logger.warn(`⚠️ Failed to calculate position for target`);
            }
            
            return result;
            
        } catch (error) {
            logger.error(`Failed to locate target: ${(error as Error).message}`);
            return { found: false };
        }
    }
    
    /**
     * 从AST提取章节信息（支持递归遍历嵌套结构）
     * @returns 章节信息数组
     */
    private extractSections(): ASTSectionInfo[] {
        const sections: ASTSectionInfo[] = [];
        
        const traverse = (nodes: MdastContent[], parentContext?: string) => {
            nodes.forEach((node, index) => {
                if (node.type === 'heading') {
                    const heading = node as MdastHeading;
                    const name = this.extractHeadingText(heading);
                    const startLine = (heading.position?.start.line || 1) - 1; // 转为0-based
                    
                    // 在当前层级中查找结束行
                    const endLine = this.calculateSectionEndLineInContext(heading, nodes, index);
                    const content = this.lines.slice(startLine, endLine + 1).join('\n');
                    
                    sections.push({
                        name: parentContext ? `${parentContext} > ${name}` : name, // 保留层级信息
                        level: heading.depth,
                        startLine,
                        endLine,
                        content,
                        node: heading
                    });
                }
                
                // 递归处理子节点
                if ('children' in node && node.children) {
                    const contextName = node.type === 'heading' ? 
                        this.extractHeadingText(node as MdastHeading) : parentContext;
                    traverse(node.children as MdastContent[], contextName);
                }
            });
        };
        
        traverse(this.ast.children);
        
        return sections.sort((a, b) => a.startLine - b.startLine);
    }
    
    /**
     * 从标题节点提取文本
     */
    private extractHeadingText(heading: MdastHeading): string {
        const extractText = (node: any): string => {
            if (node.type === 'text') {
                return node.value;
            }
            if (node.children) {
                return node.children.map(extractText).join('');
            }
            return '';
        };
        
        return heading.children.map(extractText).join('').trim();
    }
    
    /**
     * 在当前上下文中计算章节结束行
     */
    private calculateSectionEndLineInContext(
        heading: MdastHeading, 
        siblingNodes: MdastContent[], 
        nodeIndex: number
    ): number {
        let endLine = this.lines.length - 1;
        
        // 在同一层级中查找下一个标题
        for (let i = nodeIndex + 1; i < siblingNodes.length; i++) {
            const nextNode = siblingNodes[i];
            if (nextNode.type === 'heading') {
                const nextHeading = nextNode as MdastHeading;
                if (nextHeading.depth <= heading.depth) {
                    endLine = (nextHeading.position?.start.line || 1) - 2; // 前一行
                    break;
                }
            }
        }
        
        return endLine;
    }
    
    /**
     * 标准化章节名称，去除markdown前缀以提高匹配容错性
     * @param sectionName 原始章节名称
     * @returns 标准化后的章节名称
     */
    private normalizeSectionName(sectionName: string): string {
        return sectionName
            .toLowerCase()
            .trim()
            .replace(/^#{1,6}\s*/, '')        // 去除 # ## ### 等markdown标题前缀
            .replace(/^[-*+]\s*/, '')         // 去除 - * + 列表前缀  
            .trim();                          // 再次去除可能的空格
    }

    /**
     * 根据名称查找section
     * @param sectionName section名称
     * @returns 找到的section或undefined
     */
    findSectionByName(sectionName: string): ASTSectionInfo | undefined {
        // 🔍 DEBUG: 显示查找目标
        logger.info(`🔍 [DEBUG] Searching for section: "${sectionName}"`);
        
        const normalizedTargetName = this.normalizeSectionName(sectionName);
        
        const result = this.sections.find(section => {
            const normalizedSectionName = this.normalizeSectionName(section.name);
            const isMatch = normalizedSectionName === normalizedTargetName || 
                           normalizedSectionName.includes(normalizedTargetName);
            
            // 🔍 DEBUG: 显示每个章节的匹配过程
            logger.info(`🔍 [DEBUG] Comparing "${section.name}" vs "${sectionName}" (normalized: "${normalizedSectionName}" vs "${normalizedTargetName}") -> match: ${isMatch}`);
            
            return isMatch;
        });
        
        if (result) {
            logger.info(`🔍 [DEBUG] Found matching section: "${result.name}" (level=${result.level}, lines=${result.startLine}-${result.endLine})`);
        } else {
            logger.warn(`🔍 [DEBUG] No matching section found for: "${sectionName}"`);
        }
        
        return result;
    }
    
    /**
     * 计算插入点位置
     * @param section 目标section
     * @param position 位置类型
     * @returns 插入点位置
     */
    calculateInsertionPoint(section: ASTSectionInfo, position?: 'before' | 'after'): vscode.Position {
        // 🔍 DEBUG: 开始计算插入点
        logger.info(`🔍 [DEBUG] Calculating insertion point for "${section.name}" with position="${position}"`);
        logger.info(`🔍 [DEBUG] Section info: startLine=${section.startLine}, endLine=${section.endLine}, level=${section.level}`);
        
        switch (position) {
            case 'before':
                const beforePos = new vscode.Position(section.startLine, 0);
                logger.info(`🔍 [DEBUG] Before position calculated: line ${section.startLine + 1}`);
                return beforePos;
                
            case 'after':
                logger.info(`🔍 [DEBUG] Calculating after position - searching for next same-level section...`);
                // 找到下一个同级或更高级别的section
                const nextSection = this.findNextSameLevelSection(section);
                if (nextSection) {
                    const afterPos = new vscode.Position(nextSection.startLine - 1, 0);
                    logger.info(`🔍 [DEBUG] After position calculated using next section: line ${nextSection.startLine} (inserting at line ${nextSection.startLine})`);
                    return afterPos;
                } else {
                    const afterPos = new vscode.Position(section.endLine + 1, 0);
                    logger.info(`🔍 [DEBUG] After position calculated using section end: line ${section.endLine + 2} (total lines: ${this.lines.length})`);
                    return afterPos;
                }
                
            default:
                const defaultPos = new vscode.Position(section.startLine, 0);
                logger.info(`🔍 [DEBUG] Default position calculated: line ${section.startLine + 1}`);
                return defaultPos;
        }
    }
    
    /**
     * 🚀 计算append_to_section的插入位置
     */
    private calculateAppendPosition(section: ASTSectionInfo): LocationResult {
        try {
            // 在章节内容的最后一行之后插入新行
            const insertionPoint = new vscode.Position(section.endLine + 1, 0);
            
            logger.info(`📍 Calculated append position at line ${section.endLine + 2}`);
            
            return {
                found: true,
                insertionPoint,
                context: this.buildContext(section)
            };
            
        } catch (error) {
            logger.error(`Failed to calculate append position: ${(error as Error).message}`);
            return { found: false };
        }
    }
    
    /**
     * 🚀 计算prepend_to_section的插入位置
     */
    private calculatePrependPosition(section: ASTSectionInfo): LocationResult {
        try {
            // 在章节标题的下一行插入
            const insertionPoint = new vscode.Position(section.startLine + 1, 0);
            
            logger.info(`📍 Calculated prepend position at line ${section.startLine + 2}`);
            
            return {
                found: true,
                insertionPoint,
                context: this.buildContext(section)
            };
            
        } catch (error) {
            logger.error(`Failed to calculate prepend position: ${(error as Error).message}`);
            return { found: false };
        }
    }
    
    /**
     * 计算具体位置
     */
    private calculatePosition(section: ASTSectionInfo, target: SemanticTarget): LocationResult {
        const position = target.position || 'replace';
        
        switch (position) {
            case 'replace':
                return {
                    found: true,
                    range: new vscode.Range(
                        new vscode.Position(section.startLine, 0),
                        new vscode.Position(section.endLine, this.lines[section.endLine]?.length || 0)
                    ),
                    context: this.buildContext(section)
                };
                
            case 'before':
                return {
                    found: true,
                    insertionPoint: this.calculateInsertionPoint(section, 'before'),
                    context: this.buildContext(section)
                };
                
            case 'after':
                const insertionPoint = this.calculateInsertionPoint(section, 'after');
                logger.info(`🔍 [DEBUG] After case - insertionPoint calculated: line ${insertionPoint.line + 1}, character ${insertionPoint.character}`);
                
                return {
                    found: true,
                    insertionPoint: insertionPoint,
                    context: this.buildContext(section)
                };
                
            case 'append':
                return this.calculateAppendPosition(section);
                
            case 'prepend':
                return this.calculatePrependPosition(section);
                
            default:
                logger.warn(`Unknown position type: ${position}`);
                return { found: false };
        }
    }
    
    /**
     * 查找下一个同级section
     */
    private findNextSameLevelSection(currentSection: ASTSectionInfo): ASTSectionInfo | undefined {
        // 🔍 DEBUG: 开始查找下一个同级章节
        logger.info(`🔍 [DEBUG] Finding next same-level section for: "${currentSection.name}" (level=${currentSection.level})`);
        
        const currentIndex = this.sections.indexOf(currentSection);
        if (currentIndex === -1) {
            logger.warn(`🔍 [DEBUG] Current section not found in sections array`);
            return undefined;
        }
        
        logger.info(`🔍 [DEBUG] Current section index: ${currentIndex} of ${this.sections.length} sections`);
        
        for (let i = currentIndex + 1; i < this.sections.length; i++) {
            const section = this.sections[i];
            logger.info(`🔍 [DEBUG] Checking section ${i}: "${section.name}" (level=${section.level}) vs current level ${currentSection.level}`);
            
            if (section.level <= currentSection.level) {
                logger.info(`🔍 [DEBUG] Found next same-level section: "${section.name}" at index ${i}`);
                return section;
            } else {
                logger.info(`🔍 [DEBUG] Skipping section "${section.name}" (level ${section.level} > ${currentSection.level})`);
            }
        }
        
        logger.info(`🔍 [DEBUG] No next same-level section found after "${currentSection.name}"`);
        return undefined;
    }
    
    /**
     * 构建上下文信息
     */
    private buildContext(section: ASTSectionInfo): {
        beforeText: string;
        afterText: string;
        parentSection?: string;
    } {
        const beforeSection = this.findPreviousSection(section);
        const afterSection = this.findNextSection(section);
        
        return {
            beforeText: beforeSection ? beforeSection.name : '',
            afterText: afterSection ? afterSection.name : '',
            parentSection: this.findParentSection(section)?.name
        };
    }
    
    /**
     * 查找前一个section
     */
    private findPreviousSection(currentSection: ASTSectionInfo): ASTSectionInfo | undefined {
        const currentIndex = this.sections.indexOf(currentSection);
        return currentIndex > 0 ? this.sections[currentIndex - 1] : undefined;
    }
    
    /**
     * 查找后一个section
     */
    private findNextSection(currentSection: ASTSectionInfo): ASTSectionInfo | undefined {
        const currentIndex = this.sections.indexOf(currentSection);
        return currentIndex < this.sections.length - 1 ? 
               this.sections[currentIndex + 1] : undefined;
    }
    
    /**
     * 查找父section
     */
    private findParentSection(currentSection: ASTSectionInfo): ASTSectionInfo | undefined {
        const currentIndex = this.sections.indexOf(currentSection);
        if (currentIndex === -1) return undefined;
        
        // 向前查找更高级别的section
        for (let i = currentIndex - 1; i >= 0; i--) {
            const section = this.sections[i];
            if (section.level < currentSection.level) {
                return section;
            }
        }
        
        return undefined;
    }
    
    /**
     * 🚀 新增：在章节内查找具体内容
     */
    private findContentInSection(section: ASTSectionInfo, target: SemanticTarget): LocationResult {
        try {
            logger.info(`🔍 Searching for content in section: ${section.name}`);
            
            // 获取章节内容
            const sectionContent = section.content || '';
            const lines = sectionContent.split('\n');
            
            // 处理不同类型的内容定位
            if (target.targetContent) {
                // ✨ 使用新的上下文感知定位方法
                return this.findTargetContentWithContext(section, target, lines);
            }
            
            if (target.contentToRemove) {
                // ✨ 对contentToRemove也使用上下文感知定位
                return this.findTargetContentWithContext(section, { 
                    ...target, 
                    targetContent: target.contentToRemove 
                }, lines);
            }
            
            if (target.afterContent) {
                return this.findInsertionAfterContent(section, target.afterContent, lines);
            }
            
            if (target.beforeContent) {
                return this.findInsertionBeforeContent(section, target.beforeContent, lines);
            }
            
            logger.warn(`⚠️ No content locator specified in target`);
            return { found: false };
            
        } catch (error) {
            logger.error(`Failed to find content in section: ${(error as Error).message}`);
            return { found: false };
        }
    }
    
    /**
     * 查找目标内容的位置
     */
    private findTargetContent(section: ASTSectionInfo, targetContent: string, lines: string[]): LocationResult {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 在原始行上使用不区分大小写的搜索来找到起始索引
            const startIndex = line.toLowerCase().indexOf(targetContent.toLowerCase());

            if (startIndex !== -1) {
                const startPos = new vscode.Position(section.startLine + i, startIndex);
                const endPos = new vscode.Position(section.startLine + i, startIndex + targetContent.length);
                
                logger.info(`✅ Found precise target content at line ${section.startLine + i + 1}, cols ${startIndex}-${startIndex + targetContent.length} ("${targetContent}")`);
                
                return {
                    found: true,
                    range: new vscode.Range(startPos, endPos),
                    context: this.buildContext(section)
                };
            }
        }
        
        logger.warn(`❌ Target content not found: ${targetContent}`);
        return { found: false };
    }

    /**
     * ✨ 新增：基于上下文锚点的精确内容定位
     * 解决重复内容定位问题：当文档中存在多个相同的targetContent时，
     * 通过contextAnchor确保定位到正确的目标
     */
    private findTargetContentWithContext(section: ASTSectionInfo, target: SemanticTarget, lines: string[]): LocationResult {
        const { targetContent, contextAnchor } = target;

        if (!targetContent) {
            logger.warn(`⚠️ targetContent is missing`);
            return { found: false };
        }

        let anchorFound = !contextAnchor; // 如果没有提供锚点，则默认已找到
        let anchorLineIndex = -1;
        let searchStartIndex = 0;

        // 第一遍：寻找上下文锚点
        if (contextAnchor) {
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(contextAnchor.toLowerCase())) {
                    anchorFound = true;
                    anchorLineIndex = i;
                    searchStartIndex = i;
                    logger.info(`✅ Context anchor found: "${contextAnchor}" at line ${section.startLine + i + 1}`);
                    break;
                }
            }

            if (!anchorFound) {
                logger.warn(`❌ Context anchor "${contextAnchor}" not found in section`);
                return { found: false };
            }
        }

        // 第二遍：在锚点附近寻找目标内容
        const searchRange = contextAnchor ? 10 : lines.length; // 锚点附近10行内搜索
        const searchEndIndex = Math.min(lines.length, searchStartIndex + searchRange);

        for (let i = searchStartIndex; i < searchEndIndex; i++) {
            const line = lines[i];
            const startIndex = line.toLowerCase().indexOf(targetContent.toLowerCase());

            if (startIndex !== -1) {
                const startPos = new vscode.Position(section.startLine + i, startIndex);
                const endPos = new vscode.Position(section.startLine + i, startIndex + targetContent.length);
                
                if (contextAnchor) {
                    logger.info(`✅ Found target content with context anchor: "${targetContent}" at line ${section.startLine + i + 1}, cols ${startIndex}-${startIndex + targetContent.length} (near anchor "${contextAnchor}")`);
                } else {
                    logger.info(`✅ Found target content: "${targetContent}" at line ${section.startLine + i + 1}, cols ${startIndex}-${startIndex + targetContent.length}`);
                }
                
                return {
                    found: true,
                    range: new vscode.Range(startPos, endPos),
                    context: this.buildContext(section)
                };
            }
        }

        const searchInfo = contextAnchor 
            ? `within ${searchRange} lines of anchor "${contextAnchor}"`
            : `in section`;
        logger.warn(`❌ Target content "${targetContent}" not found ${searchInfo}`);
        return { found: false };
    }
    
    /**
     * 查找在某内容之后的插入位置
     */
    private findInsertionAfterContent(section: ASTSectionInfo, afterContent: string, lines: string[]): LocationResult {
        const normalizedAfter = this.normalizeText(afterContent);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const normalizedLine = this.normalizeText(line);
            
            if (normalizedLine.includes(normalizedAfter)) {
                const insertionPoint = new vscode.Position(section.startLine + i + 1, 0);
                
                logger.info(`✅ Found insertion point after content at line ${section.startLine + i + 2}`);
                
                return {
                    found: true,
                    insertionPoint,
                    context: this.buildContext(section)
                };
            }
        }
        
        logger.warn(`❌ After content not found: ${afterContent}`);
        return { found: false };
    }
    
    /**
     * 查找在某内容之前的插入位置
     */
    private findInsertionBeforeContent(section: ASTSectionInfo, beforeContent: string, lines: string[]): LocationResult {
        const normalizedBefore = this.normalizeText(beforeContent);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const normalizedLine = this.normalizeText(line);
            
            if (normalizedLine.includes(normalizedBefore)) {
                const insertionPoint = new vscode.Position(section.startLine + i, 0);
                
                logger.info(`✅ Found insertion point before content at line ${section.startLine + i + 1}`);
                
                return {
                    found: true,
                    insertionPoint,
                    context: this.buildContext(section)
                };
            }
        }
        
        logger.warn(`❌ Before content not found: ${beforeContent}`);
        return { found: false };
    }
    
    /**
     * 规范化文本（用于比较）
     */
    private normalizeText(text: string): string {
        return text.toLowerCase()
                  .replace(/^#+\s*/, '')  // 移除markdown标记
                  .replace(/[^\w\s]/g, '') // 移除特殊字符
                  .trim();
    }
    
    /**
     * 获取AST节点统计信息
     */
    public getNodeCount(): number {
        return this.sections.length;
    }
    
    /**
     * 🚀 静态方法：创建append_to_section目标
     */
    static createAppendToSectionTarget(sectionName: string): SemanticTarget {
        return {
            sectionName,
            position: 'append'
        };
    }
    
    /**
     * 🚀 静态方法：创建prepend_to_section目标
     */
    static createPrependToSectionTarget(sectionName: string): SemanticTarget {
        return {
            sectionName,
            position: 'prepend'
        };
    }
    
    /**
     * 🚀 静态方法：根据操作类型创建目标
     */
    static createTargetForOperation(operationType: string, sectionName: string): SemanticTarget | null {
        switch (operationType) {
            case 'append_to_section':
                return SemanticLocator.createAppendToSectionTarget(sectionName);
            case 'prepend_to_section':
                return SemanticLocator.createPrependToSectionTarget(sectionName);
            default:
                return null;
        }
    }
    
    /**
     * 🚀 使用示例和测试辅助方法
     * 
     * 使用示例：
     * ```typescript
     * const appendTarget = SemanticLocator.createAppendToSectionTarget('功能需求');
     * const prependTarget = SemanticLocator.createPrependToSectionTarget('项目概述');
     * ```
     */
}