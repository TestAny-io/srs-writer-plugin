/**
 * SemanticLocator - 语义定位器
 * 
 * 基于AST语法树，实现精确的语义位置定位功能
 * 支持heading和list item的树状结构定位
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { Root as MdastRoot, Content as MdastContent, Heading as MdastHeading, List as MdastList, ListItem as MdastListItem } from 'mdast';

const logger = Logger.getInstance();

/**
 * 插入位置枚举
 */
export type InsertionPosition = 
    | 'before'    // 在参照章节之前插入
    | 'after'     // 在参照章节之后插入
    | 'inside';   // 在参照章节内部插入

/**
 * 结构化元素类型
 */
export type StructuralElementType = 'heading' | 'list_item';

/**
 * 结构化元素接口 - 支持树状结构
 */
export interface StructuralElement {
    // 基础信息
    type: StructuralElementType;
    name: string;                    // 显示名称
    identifier?: string;             // 提取的业务标识符 (如 UC-INFO-001)
    
    // 位置信息
    startLine: number;
    endLine: number;
    level: number;                   // 嵌套层级
    
    // 树状结构
    path: string[];                  // 从根到当前节点的完整路径
    parent?: StructuralElement;
    children: StructuralElement[];
    
    // 类型特定信息
    marker?: string;                 // list: '1.', '-', heading: '#'
    
    // 原始内容
    content: string;
    rawNode: MdastHeading | MdastListItem;  // 保留原始AST节点引用
}

/**
 * 🚨 废弃的语义目标接口 - 使用路径数组精确定位
 * @deprecated 请使用新的基于SID的SemanticTarget
 */
export interface LegacySemanticTarget {
    path: string[];                         // 目标路径数组（required）
    targetContent?: string;                 // 要替换的目标内容（replace_lines_in_section时required）
    insertionPosition?: InsertionPosition;  // 插入位置（insert操作时required）
    
    // 🆕 Phase 2 增强：精确章节定位（当insertionPosition="inside"时使用）
    siblingIndex?: number;                  // 兄弟节点索引 (0-based)
    siblingOperation?: 'before' | 'after'; // 相对于指定兄弟的操作
}

// 🚨 向后兼容别名 - 将在未来版本中移除
/** @deprecated 请使用 LegacySemanticTarget 或新的基于SID的SemanticTarget */
export type SemanticTarget = LegacySemanticTarget;

/**
 * 定位结果接口
 */
export interface LocationResult {
    found: boolean;
    range?: vscode.Range;               // 用于replace操作
    insertionPoint?: vscode.Position;   // 用于insert操作
    operationType?: 'replace' | 'insert'; // 操作类型指示
    error?: string;                     // 错误信息（当found为false时）
    context?: {
        beforeText: string;
        afterText: string;
        parentSection?: string;
    };
}

/**
 * 废弃的接口 - 保留以防编译错误，但不再使用
 * @deprecated 使用StructuralElement代替
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
    private sections: StructuralElement[];
    private lines: string[];
    
    constructor(markdownContent: string) {
        this.sourceText = markdownContent;
        this.lines = markdownContent.split('\n');
        
        try {
            // 解析Markdown为AST
            this.ast = unified().use(remarkParse).parse(markdownContent) as MdastRoot;
            
            // 提取章节信息
            this.sections = this.extractStructuralElements();
            
            // logger.info(`🎯 SemanticLocator initialized with AST: ${this.sections.length} sections found`);
            
            // 🔍 DEBUG: 详细输出所有解析的章节信息
            // logger.info(`🔍 [DEBUG] All parsed sections:`);
            this.sections.forEach((section, index) => {
                // logger.info(`🔍 [DEBUG] Section ${index}: "${section.name}" (level=${section.level}, lines=${section.startLine}-${section.endLine})`);
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
     * @param operationType 操作类型，用于指导定位逻辑
     * @returns 定位结果
     */
    findTarget(target: LegacySemanticTarget, operationType?: string): LocationResult {
        try {
            // logger.info(`🔍 Locating target: ${target.path.join(' > ')} (operation: ${operationType})`);
            
            // 查找参照section
            const section = this.findSectionByPath(target.path);
            if (!section) {
                logger.warn(`❌ Section not found: ${target.path.join(' > ')}`);
                
                // 对insert操作，提供智能回退
                if (operationType?.startsWith('insert_')) {
                    return this.handleInsertionFallback(target, operationType);
                }
                
                return { 
                    found: false,
                    error: `Section "${target.path.join(' > ')}" not found`
                };
            }

            // 处理插入操作
            if (operationType?.startsWith('insert_')) {
                return this.handleInsertionOperation(section, target, operationType);
            }
            
            // 处理替换操作（现有逻辑）
            if (target.targetContent) {
                const result = this.findContentInSection(section, target);
                if (result.found) {
                    result.operationType = 'replace';
                }
                return result;
            }
            
            // 替换整个章节
            return {
                found: true,
                operationType: 'replace',
                range: new vscode.Range(
                    new vscode.Position(section.startLine, 0),
                    new vscode.Position(section.endLine, this.lines[section.endLine]?.length || 0)
                ),
                context: this.buildContext(section)
            };
            
        } catch (error) {
            logger.error(`Failed to locate target: ${(error as Error).message}`);
            return { 
                found: false,
                error: `Failed to locate target: ${(error as Error).message}`
            };
        }
    }
    
    /**
     * 从AST提取结构化元素（支持heading和list item的正确语义结构）
     * @returns 结构化元素数组
     */
    private extractStructuralElements(): StructuralElement[] {
        const elements: StructuralElement[] = [];
        const headingStack: StructuralElement[] = []; // 🔑 维护heading层级栈
        
        const traverse = (nodes: MdastContent[]) => {
            nodes.forEach((node, index) => {
                if (node.type === 'heading') {
                    // 🔑 修复：先创建临时heading来确定栈更新，然后构建正确的路径
                    const tempHeading = this.createTemporaryHeading(node as MdastHeading);
                    
                    // 🔑 关键：先更新栈，获得正确的父级context
                    const parentPath = this.calculateParentPath(headingStack, tempHeading);
                    this.updateHeadingStack(headingStack, tempHeading);
                    
                    // 然后创建完整的heading元素
                    const headingElement = this.processHeading(node as MdastHeading, elements, nodes, index, parentPath);
                    
                    // 更新栈中的元素为完整的element
                    if (headingStack.length > 0) {
                        headingStack[headingStack.length - 1] = headingElement;
                    }
                    
                } else if (node.type === 'list') {
                    // list item使用栈顶heading作为父级
                    const currentParent = headingStack[headingStack.length - 1];
                    this.processList(node as MdastList, elements, currentParent);
                }
                
                // 递归处理子节点（保持当前heading context）
                if ('children' in node && node.children) {
                    traverse(node.children as MdastContent[]);
                }
            });
        };
        
        traverse(this.ast.children);
        
        return elements.sort((a, b) => a.startLine - b.startLine);
    }
    
    /**
     * 创建临时heading元素（用于栈管理）
     */
    private createTemporaryHeading(heading: MdastHeading): StructuralElement {
        const name = this.extractHeadingText(heading);
        return {
            type: 'heading',
            name: name,
            startLine: (heading.position?.start.line || 1) - 1,
            endLine: (heading.position?.start.line || 1) - 1,
            level: heading.depth,
            path: [], // 临时路径，稍后设置
            parent: undefined,
            children: [],
            marker: '#'.repeat(heading.depth),
            content: '',
            rawNode: heading
        };
    }
    
    /**
     * 计算父级路径（基于当前栈状态和新heading）
     */
    private calculateParentPath(stack: StructuralElement[], newHeading: StructuralElement): string[] {
        // 模拟栈更新，但不修改实际栈
        const tempStack = [...stack];
        while (tempStack.length > 0 && tempStack[tempStack.length - 1].level >= newHeading.level) {
            tempStack.pop();
        }
        return tempStack.map(h => h.name);
    }
    
    /**
     * 更新heading栈，维护正确的层级关系
     */
    private updateHeadingStack(stack: StructuralElement[], newHeading: StructuralElement): void {
        // 🔑 关键修复：弹出所有level >= 新heading的元素
        // 这确保同级heading有相同的父级
        while (stack.length > 0 && stack[stack.length - 1].level >= newHeading.level) {
            stack.pop();
        }
        // 推入新heading
        stack.push(newHeading);
        
        // 🔍 DEBUG: 显示栈状态
        logger.info(`🔍 [STACK] Updated heading stack after "${newHeading.name}" (level=${newHeading.level}): [${stack.map(h => `${h.name}(${h.level})`).join(' → ')}]`);
    }
    
    /**
     * 处理heading节点 - 构建正确的层级路径
     */
    private processHeading(
        heading: MdastHeading, 
        elements: StructuralElement[], 
        siblingNodes: MdastContent[], 
        nodeIndex: number,
        parentPath: string[]
    ): StructuralElement {
        const name = this.extractHeadingText(heading);
        
        // 🔑 正确的路径构建：基于传入的父级路径
        const currentPath = [...parentPath, name];
        
        const startLine = (heading.position?.start.line || 1) - 1; // 转为0-based
        const endLine = this.calculateHeadingEndLineInContext(heading, siblingNodes, nodeIndex);
        const content = this.lines.slice(startLine, endLine + 1).join('\n');
        
        // 🔑 正确的父级关系：从parentPath推导
        const parentElement = elements.find(el => 
            el.type === 'heading' && 
            parentPath.length > 0 && 
            el.name === parentPath[parentPath.length - 1]
        );
        
        const element: StructuralElement = {
            type: 'heading',
            name: name,
            startLine,
            endLine,
            level: heading.depth,
            path: currentPath,
            parent: parentElement,
            children: [],
            marker: '#'.repeat(heading.depth),
            content,
            rawNode: heading
        };
        
        elements.push(element);
        
        // 将子元素添加到父元素的children中
        if (parentElement) {
            parentElement.children.push(element);
        }
        
        return element;
    }
    
    /**
     * 处理list节点 - 支持所有列表标记类型
     */
    private processList(
        list: MdastList, 
        elements: StructuralElement[], 
        parentElement?: StructuralElement
    ): void {
        list.children.forEach((listItem, index) => {
            this.processListItem(listItem, elements, list, index, parentElement);
        });
    }
    
    /**
     * 处理list item节点 - 构建正确的语义路径
     */
    private processListItem(
        listItem: MdastListItem,
        elements: StructuralElement[],
        parentList: MdastList,
        itemIndex: number,
        parentElement?: StructuralElement
    ): void {
        const name = this.extractListItemText(listItem);
        const identifier = this.extractIdentifierFromText(name);
        
        // 🔑 正确的路径构建：继承父heading的路径
        const parentPath = parentElement ? parentElement.path : [];
        const currentPath = [...parentPath, name];
        
        const startLine = (listItem.position?.start.line || 1) - 1; // 转为0-based
        const endLine = this.calculateListItemEndLine(listItem, parentList, itemIndex);
        const content = this.lines.slice(startLine, endLine + 1).join('\n');
        
        // 🔑 支持所有列表标记类型
        const marker = this.getListMarker(parentList, itemIndex, startLine);
        
        // 🔑 正确的level计算：基于父级level + 1
        const level = parentElement ? parentElement.level + 1 : 1;
        
        const element: StructuralElement = {
            type: 'list_item',
            name: name,
            identifier: identifier,
            startLine,
            endLine,
            level: level,
            path: currentPath,
            parent: parentElement,
            children: [],
            marker: marker,
            content,
            rawNode: listItem
        };
        
        elements.push(element);
        
        // 将子元素添加到父元素的children中
        if (parentElement) {
            parentElement.children.push(element);
        }
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
     * 从list item节点提取文本
     */
    private extractListItemText(listItem: MdastListItem): string {
        const extractText = (node: any): string => {
            if (node.type === 'text') {
                return node.value;
            }
            if (node.children) {
                return node.children.map(extractText).join('');
            }
            return '';
        };
        
        // 只取第一段的文本作为名称
        if (listItem.children && listItem.children.length > 0) {
            const firstChild = listItem.children[0];
            return extractText(firstChild).trim();
        }
        
        return '';
    }
    
    /**
     * 从文本中提取标识符（如UC-INFO-001）
     */
    private extractIdentifierFromText(text: string): string | undefined {
        // 常见的标识符模式
        const patterns = [
            /\b(UC-[A-Z]+-\d+)\b/,           // UC-INFO-001
            /\b(FR-[A-Z]+-\d+)\b/,           // FR-AUTH-001
            /\b(NFR-[A-Z]+-\d+)\b/,          // NFR-PERF-001
            /\b(US-[A-Z]+-\d+)\b/,           // US-INFO-001
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        return undefined;
    }
    
    /**
     * 计算heading结束行
     */
    private calculateHeadingEndLineInContext(
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
     * 计算list item结束行
     */
    private calculateListItemEndLine(
        listItem: MdastListItem,
        parentList: MdastList,
        itemIndex: number
    ): number {
        // 如果有下一个list item，结束行就是下一个item的前一行
        if (itemIndex < parentList.children.length - 1) {
            const nextItem = parentList.children[itemIndex + 1];
            return (nextItem.position?.start.line || 1) - 2;
        }
        
        // 如果是最后一个item，结束行就是整个list的结束行
        return (parentList.position?.end.line || this.lines.length) - 1;
    }
    
    /**
     * 获取list marker - 支持所有列表标记类型
     */
    private getListMarker(list: MdastList, itemIndex: number, startLine: number): string {
        // 🔑 从原始行文本中检测实际使用的标记
        const line = this.lines[startLine];
        if (!line) {
            return list.ordered ? '1.' : '-'; // 默认值
        }
        
        const trimmedLine = line.trim();
        
        if (list.ordered) {
            // 有序列表：支持 "数字." 和 "数字)" 格式
            const dotMatch = trimmedLine.match(/^(\d+)\.\s/);
            if (dotMatch) {
                return dotMatch[1] + '.';
            }
            
            const parenMatch = trimmedLine.match(/^(\d+)\)\s/);
            if (parenMatch) {
                return parenMatch[1] + ')';
            }
            
            // 回退：使用列表的起始编号
            const start = list.start || 1;
            const number = start + itemIndex;
            return `${number}.`;
        } else {
            // 无序列表：支持 "-", "+", "*" 格式
            if (trimmedLine.startsWith('- ')) {
                return '-';
            } else if (trimmedLine.startsWith('+ ')) {
                return '+';
            } else if (trimmedLine.startsWith('* ')) {
                return '*';
            }
            
            // 默认使用 '-'
            return '-';
        }
    }
    
    /**
     * 标准化名称，去除markdown前缀以提高匹配容错性
     * @param name 原始名称
     * @returns 标准化后的名称
     */
    private normalizeName(name: string): string {
        return name
            .toLowerCase()
            .trim()
            .replace(/^#{1,6}\s*/, '')        // 去除 # ## ### 等markdown标题前缀
            .replace(/^[-*+]\s*/, '')         // 去除 - * + 列表前缀  
            .replace(/^\*\*(.+)\*\*$/, '$1')  // 去除 **bold** 格式
            .replace(/^\d+\.\s*/, '')         // 去除数字编号前缀
            .replace(/^\d+\)\s*/, '')         // 去除数字)前缀
            .trim();                          // 再次去除可能的空格
    }

    /**
     * 标准化路径组件，移除markdown格式符号
     */
    private normalizePathComponent(component: string): string {
        return component
            .replace(/^\*\*(.*)\*\*$/, '$1') // 移除粗体标记 **text** -> text
            .replace(/^_(.*_)$/, '$1') // 移除斜体标记 _text_ -> text
            .replace(/^`(.*)`$/, '$1') // 移除代码标记 `text` -> text
            .trim();
    }

    /**
     * 检测文档是否只有一个根标题（level 1 heading）
     * @returns 如果只有一个根标题返回true，否则返回false
     */
    private hasSingleRootHeading(): boolean {
        const level1Headings = this.sections.filter(section => 
            section.type === 'heading' && section.level === 1
        );
        return level1Headings.length === 1;
    }

    /**
     * 包含式路径组件匹配
     * 支持双向包含匹配：任一方包含另一方都算匹配
     * @param sectionComponent 文档中的实际路径组件
     * @param searchComponent 搜索的路径组件
     * @returns 是否匹配
     */
    private pathComponentMatches(sectionComponent: string, searchComponent: string): boolean {
        const normalizedSection = this.normalizePathComponent(sectionComponent).toLowerCase();
        const normalizedSearch = this.normalizePathComponent(searchComponent).toLowerCase();
        
        // 双向包含匹配：任一方包含另一方都算匹配
        return normalizedSection.includes(normalizedSearch) || 
               normalizedSearch.includes(normalizedSection);
    }
    
    /**
     * 通过路径查找元素（支持路径标准化、自动跳过单根标题、包含式匹配、简化路径匹配）
     */
    findSectionByPath(path: string[]): StructuralElement | undefined {
        logger.info(`🔍 [DEBUG] Searching for element by path: "${path.join(' > ')}"`);
        
        // 检测是否只有一个根标题
        const singleRoot = this.hasSingleRootHeading();
        if (singleRoot) {
            logger.info(`🔍 [DEBUG] Document has single root heading, enabling smart path matching`);
        }

        // 🚀 第一步：尝试完整路径匹配（现有逻辑）
        const exactMatches = this.sections.filter(section => {
            let sectionPath = section.path;
            let searchPath = path;
            
            // 如果只有一个根标题且搜索路径更短，尝试跳过根标题匹配
            if (singleRoot && searchPath.length === sectionPath.length - 1) {
                sectionPath = sectionPath.slice(1); // 跳过第一级（根标题）
                // logger.info(`🔍 [DEBUG] Skipping root heading for comparison: "${section.path[0]}"`);
            }
            
            // 检查路径长度是否匹配
            if (sectionPath.length !== searchPath.length) {
                return false;
            }
            
            // 使用包含式匹配而非精确匹配
            return sectionPath.every((pathPart, index) => 
                this.pathComponentMatches(pathPart, searchPath[index])
            );
        });
        
        // 如果找到唯一的完整匹配，直接返回
        if (exactMatches.length === 1) {
            const matchingElement = exactMatches[0];
            logger.info(`🔍 [DEBUG] Found exact matching element: "${matchingElement.name}" (type=${matchingElement.type}, level=${matchingElement.level}, lines=${matchingElement.startLine}-${matchingElement.endLine})`);
            return matchingElement;
        }
        
        // 🚀 第二步：如果完整匹配失败且满足条件，尝试简化路径匹配
        if (singleRoot && path.length >= 2 && exactMatches.length === 0) {
            logger.info(`🔍 [SIMPLIFIED] Attempting simplified path matching for: "${path.join(' > ')}"`);
            
            const simplifiedMatches = this.sections.filter(section => {
                const sectionPath = section.path;
                
                // 简化匹配条件：
                // 1. 实际路径长度 > 搜索路径长度（至少多出根标题）
                // 2. 第一层匹配（跳过根标题后的第一层，即heading 2）
                // 3. 最后一层匹配（目标元素）
                if (sectionPath.length <= path.length) {
                    return false;
                }
                
                const adjustedSectionPath = sectionPath.slice(1); // 跳过根标题
                
                // 检查是否至少有 heading 2 层级
                if (adjustedSectionPath.length === 0) {
                    return false;
                }
                
                // 第一层匹配：heading 2
                const firstMatches = this.pathComponentMatches(
                    adjustedSectionPath[0], 
                    path[0]
                );
                
                // 最后一层匹配：目标元素
                const lastMatches = this.pathComponentMatches(
                    adjustedSectionPath[adjustedSectionPath.length - 1],
                    path[path.length - 1]
                );
                
                const isMatch = firstMatches && lastMatches;
                
                if (isMatch) {
                    logger.info(`🔍 [SIMPLIFIED] Potential match found: "${sectionPath.join(' > ')}" 
                        -> first: "${adjustedSectionPath[0]}" matches "${path[0]}" (${firstMatches})
                        -> last: "${adjustedSectionPath[adjustedSectionPath.length - 1]}" matches "${path[path.length - 1]}" (${lastMatches})`);
                }
                
                return isMatch;
            });
            
            // 处理简化匹配结果
            if (simplifiedMatches.length === 1) {
                const matchingElement = simplifiedMatches[0];
                logger.info(`✅ [SIMPLIFIED] Found unique match via simplified path: "${matchingElement.path.join(' > ')}"`);
                return matchingElement;
            } else if (simplifiedMatches.length > 1) {
                // 🚨 多重匹配错误
                const matchedPaths = simplifiedMatches.map(s => s.path.join(' > '));
                logger.error(`❌ [SIMPLIFIED] Multiple matches found for simplified path "${path.join(' > ')}"`);
                logger.error(`❌ [SIMPLIFIED] Matched paths: ${matchedPaths.join(', ')}`);
                
                throw new Error(`Simplified path "${path.join(' > ')}" matches multiple locations:

${matchedPaths.map(p => `  - "${p}"`).join('\n')}

Please provide the complete path to disambiguate. Choose one of the above complete paths.`);
            } else {
                logger.info(`🔍 [SIMPLIFIED] No matches found via simplified path matching`);
            }
        }

        // 🚀 第三步：如果所有匹配都失败，提供调试信息
        logger.warn(`🔍 [DEBUG] No matching element found for path: "${path.join(' > ')}"`);
        logger.info(`🔍 [DEBUG] Available paths (${singleRoot ? 'with single root detection' : 'standard mode'}):`);
        this.sections.forEach((section, index) => {
            const displayPath = singleRoot && section.path.length > 1 ? 
                `[ROOT SKIPPABLE] ${section.path.slice(1).join(' > ')}` : 
                section.path.join(' > ');
            logger.info(`🔍 [DEBUG] ${index}: "${displayPath}" (${section.type})`);
        });
        
        // 🚀 增强：如果是单根状态，提供简化路径建议
        if (singleRoot && path.length >= 2) {
            logger.info(`💡 [SUGGESTION] You can try simplified paths in single-root documents. Format: [heading2, target]`);
            logger.info(`💡 [SUGGESTION] For example, instead of the full path, try: ["Section Name", "Target Element"]`);
        }
        
        return undefined;
    }
    
    /**
     * 构建上下文信息
     */
    private buildContext(section: StructuralElement): {
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
    private findPreviousSection(currentSection: StructuralElement): StructuralElement | undefined {
        const currentIndex = this.sections.indexOf(currentSection);
        return currentIndex > 0 ? this.sections[currentIndex - 1] : undefined;
    }

    /**
     * 查找后一个section
     */
    private findNextSection(currentSection: StructuralElement): StructuralElement | undefined {
        const currentIndex = this.sections.indexOf(currentSection);
        return currentIndex < this.sections.length - 1 ? this.sections[currentIndex + 1] : undefined;
    }

    /**
     * 查找父section
     */
    private findParentSection(currentSection: StructuralElement): StructuralElement | undefined {
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
     * 处理插入操作的位置计算
     */
    private handleInsertionOperation(
        referenceSection: StructuralElement, 
        target: SemanticTarget, 
        operationType: string
    ): LocationResult {
        if (!target.insertionPosition) {
            logger.error(`❌ Insertion position is required for ${operationType}`);
            return { 
                found: false,
                error: `Insertion position is required for ${operationType}` 
            };
        }

        let insertionPoint: vscode.Position;

        switch (target.insertionPosition) {
            case 'before':
                insertionPoint = new vscode.Position(referenceSection.startLine, 0);
                logger.info(`📍 Insert before section: line ${referenceSection.startLine + 1}`);
                break;
                
            case 'after':
                insertionPoint = new vscode.Position(referenceSection.endLine + 1, 0);
                logger.info(`📍 Insert after section: line ${referenceSection.endLine + 2}`);
                break;
                
            case 'inside':
                if (operationType === 'insert_lines_in_section') {
                    return this.findInsideInsertionPoint(referenceSection, target);
                } else {
                    // 🆕 Phase 2 增强：处理 siblingIndex 定位
                    if (target.siblingIndex !== undefined && target.siblingOperation) {
                        return this.findSiblingInsertionPoint(referenceSection, target);
                    } else {
                        // insert_entire_section with 'inside' - 在章节内容开始处插入
                        insertionPoint = new vscode.Position(referenceSection.startLine + 1, 0);
                        logger.info(`📍 Insert inside section: line ${referenceSection.startLine + 2}`);
                    }
                }
                break;
                
            default:
                logger.error(`❌ Unknown insertion position: ${target.insertionPosition}`);
                return { 
                    found: false,
                    error: `Unknown insertion position: ${target.insertionPosition}` 
                };
        }

        return {
            found: true,
            operationType: 'insert',
            insertionPoint,
            context: this.buildContext(referenceSection)
        };
    }

    /**
     * 在章节内查找精确插入位置
     */
    private findInsideInsertionPoint(
        section: StructuralElement, 
        target: SemanticTarget
    ): LocationResult {
        try {
            logger.info(`🔍 Finding inside insertion point in section: ${section.name}`);
            
            const sectionContent = section.content || '';
            const lines = sectionContent.split('\n');
            
            // 使用路径的最后一个元素作为锚点定位章节内的插入点
            const anchorText = target.path[target.path.length - 1];
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(anchorText.toLowerCase())) {
                    // 在锚点的下一行插入
                    const insertionPoint = new vscode.Position(section.startLine + i + 1, 0);
                    logger.info(`✅ Found inside insertion point after anchor: line ${section.startLine + i + 2}`);
                    
                    return {
                        found: true,
                        operationType: 'insert',
                        insertionPoint,
                        context: this.buildContext(section)
                    };
                }
            }
            
            // 如果没找到锚点，插入在章节内容开始处
            logger.warn(`⚠️ Anchor "${anchorText}" not found, inserting at section start`);
            return {
                found: true,
                operationType: 'insert',
                insertionPoint: new vscode.Position(section.startLine + 1, 0),
                context: this.buildContext(section)
            };
            
        } catch (error) {
            logger.error(`Failed to find inside insertion point: ${(error as Error).message}`);
            return { 
                found: false,
                error: `Failed to find inside insertion point: ${(error as Error).message}` 
            };
        }
    }

    /**
     * 🚀 在章节内查找具体内容
     */
    private findContentInSection(section: StructuralElement, target: SemanticTarget): LocationResult {
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
            
            // 直接在章节内查找目标内容（路径已经提供精确定位）
            return this.findTargetContent(section, target.targetContent, lines);
            
        } catch (error) {
            logger.error(`Failed to find content in section: ${(error as Error).message}`);
            return { found: false };
        }
    }
    
    /**
     * 查找目标内容的位置
     */
    private findTargetContent(section: StructuralElement, targetContent: string, lines: string[]): LocationResult {
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
     * 插入操作的智能回退处理 - 暂时禁用，避免AI迷惑
     */
    private handleInsertionFallback(
        target: SemanticTarget, 
        operationType: string
    ): LocationResult {
        logger.info(`🔄 Insertion fallback requested for: ${target.path.join(' > ')}`);
        
        // 根据用户要求，不提供降级定位，直接返回明确错误
        logger.warn(`❌ Cannot determine insertion point for: ${target.path.join(' > ')}`);
        
        return {
            found: false,
            error: `Cannot find reference section "${target.path.join(' > ')}".

AI GUIDANCE: Please use an existing section path as reference with insertionPosition:
- Use "after" with a section path that exists before your target position  
- Use "before" with a section path that exists after your target position

Available sections: ${this.sections.map(s => `"${s.path.join(' > ')}"`).slice(0, 10).join(', ')}${this.sections.length > 10 ? '...' : ''}`,
            context: {
                beforeText: '',
                afterText: '',
                parentSection: 'Insertion Failed'
            }
        };
    }

    /**
     * 基于章节编号推断插入位置 - 已禁用
     */
    private inferInsertionByNumber(targetPath: string[]): LocationResult {
        // 根据用户要求，不提供推断逻辑避免AI迷惑
        return { found: false };
    }

    /**
     * 从章节名称中提取编号 - 已禁用
     */
    private extractSectionNumber(sectionName: string): number | null {
        // 根据用户要求，不提供编号推断避免AI迷惑
        return null;
    }

    /**
     * 🆕 Phase 2 增强：基于 siblingIndex 查找插入点
     */
    private findSiblingInsertionPoint(
        parentSection: StructuralElement,
        target: SemanticTarget
    ): LocationResult {
        try {
            logger.info(`🔍 Finding sibling insertion point: siblingIndex=${target.siblingIndex}, operation=${target.siblingOperation}`);
            
            // 找到父章节的所有直接子章节
            const childSections = this.sections.filter(section => 
                section.parent?.name === parentSection.name && 
                section.level === parentSection.level + 1
            );
            
            logger.info(`📊 Found ${childSections.length} child sections under "${parentSection.name}"`);
            
            const siblingIndex = target.siblingIndex!;
            const operation = target.siblingOperation!;
            
            // 验证索引范围
            if (siblingIndex < 0 || siblingIndex >= childSections.length) {
                return {
                    found: false,
                    error: `Sibling index ${siblingIndex} out of range (0-${childSections.length - 1})`
                };
            }
            
            const targetSibling = childSections[siblingIndex];
            let insertionPoint: vscode.Position;
            
            if (operation === 'before') {
                insertionPoint = new vscode.Position(targetSibling.startLine, 0);
                logger.info(`📍 Insert before sibling ${siblingIndex}: line ${targetSibling.startLine + 1}`);
            } else { // 'after'
                insertionPoint = new vscode.Position(targetSibling.endLine + 1, 0);
                logger.info(`📍 Insert after sibling ${siblingIndex}: line ${targetSibling.endLine + 2}`);
            }
            
            return {
                found: true,
                operationType: 'insert',
                insertionPoint,
                context: this.buildContext(targetSibling)
            };
            
        } catch (error) {
            logger.error(`❌ Failed to find sibling insertion point: ${(error as Error).message}`);
            return {
                found: false,
                error: `Failed to find sibling insertion point: ${(error as Error).message}`
            };
        }
    }

    /**
     * 获取AST节点统计信息
     */
    public getNodeCount(): number {
        return this.sections.length;
    }
}