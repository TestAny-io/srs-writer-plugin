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
    sectionName: string;                    // 目标章节名称（required）
    targetContent?: string;                 // 要替换的目标内容（replace_lines_in_section时required）
    startFromAnchor: string;                // 前置锚点，从此处开始搜索targetContent（required）
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
            logger.info(`🔍 Locating target: ${target.sectionName}`);
            
            // 查找目标section
            const section = this.findSectionByName(target.sectionName);
            if (!section) {
                logger.warn(`❌ Section not found: ${target.sectionName}`);
                return { found: false };
            }
            
            // 如果有targetContent，进行精确内容定位
            if (target.targetContent) {
                return this.findContentInSection(section, target);
            }
            
            // 否则返回整个章节的范围（用于replace_entire_section）
            return {
                found: true,
                range: new vscode.Range(
                    new vscode.Position(section.startLine, 0),
                    new vscode.Position(section.endLine, this.lines[section.endLine]?.length || 0)
                ),
                context: this.buildContext(section)
            };
            
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
        return currentIndex < this.sections.length - 1 ? this.sections[currentIndex + 1] : undefined;
    }

    /**
     * 查找父section
     */
    private findParentSection(currentSection: ASTSectionInfo): ASTSectionInfo | undefined {
        const currentIndex = this.sections.indexOf(currentSection);
        
        for (let i = currentIndex - 1; i >= 0; i--) {
            const section = this.sections[i];
            if (section.level < currentSection.level) {
                return section;
            }
        }
        
        return undefined;
    }
    
    /**
     * 🚀 在章节内查找具体内容
     */
    private findContentInSection(section: ASTSectionInfo, target: SemanticTarget): LocationResult {
        try {
            logger.info(`🔍 Searching for content in section: ${section.name}`);
            
            // 获取章节内容
            const sectionContent = section.content || '';
            const lines = sectionContent.split('\n');
            
            // 验证必需字段
            if (!target.targetContent) {
                logger.error(`❌ targetContent is required for replace_lines_in_section operation`);
                return { found: false };
            }
            
            // 使用startFromAnchor进行精确定位
            return this.findTargetContentWithStartAnchor(section, target, lines);
            
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
     * ✨ 基于前置锚点的精确内容定位
     * 解决重复内容定位问题：使用startFromAnchor确保定位到正确的目标
     */
    private findTargetContentWithStartAnchor(section: ASTSectionInfo, target: SemanticTarget, lines: string[]): LocationResult {
        const { targetContent, startFromAnchor } = target;

        if (!targetContent) {
            logger.warn(`⚠️ targetContent is missing`);
            return { found: false };
        }

        let anchorFound = false;
        let searchStartIndex = 0;

        // 第一遍：寻找前置锚点
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(startFromAnchor.toLowerCase())) {
                anchorFound = true;
                searchStartIndex = i;
                logger.info(`✅ Start anchor found: "${startFromAnchor}" at line ${section.startLine + i + 1}`);
                break;
            }
        }

        if (!anchorFound) {
            logger.warn(`❌ Start anchor "${startFromAnchor}" not found in section`);
            return { found: false };
        }

        // 第二遍：在锚点后5行内寻找目标内容
        const searchRange = 5; // 锚点附近5行内搜索
        const searchEndIndex = Math.min(lines.length, searchStartIndex + searchRange);

        for (let i = searchStartIndex; i < searchEndIndex; i++) {
            const line = lines[i];
            const startIndex = line.toLowerCase().indexOf(targetContent.toLowerCase());

            if (startIndex !== -1) {
                const startPos = new vscode.Position(section.startLine + i, startIndex);
                const endPos = new vscode.Position(section.startLine + i, startIndex + targetContent.length);
                
                logger.info(`✅ Found target content with start anchor: "${targetContent}" at line ${section.startLine + i + 1}, cols ${startIndex}-${startIndex + targetContent.length} (near anchor "${startFromAnchor}")`);
                
                return {
                    found: true,
                    range: new vscode.Range(startPos, endPos),
                    context: this.buildContext(section)
                };
            }
        }

        logger.warn(`❌ Target content "${targetContent}" not found within ${searchRange} lines of anchor "${startFromAnchor}"`);
        return { found: false };
    }

    /**
     * 获取AST节点统计信息
     */
    public getNodeCount(): number {
        return this.sections.length;
    }
}