/**
 * SemanticLocator - 语义定位器
 * 
 * 基于DocumentAnalyzer提供的文档结构，
 * 实现精确的语义位置定位功能
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { DocumentStructure, SectionInfo } from './document-analyzer';

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
 * SemanticLocator - 语义定位器
 */
export class SemanticLocator {
    
    constructor(private structure: DocumentStructure) {
        logger.info(`🎯 SemanticLocator initialized with ${structure.sections.length} sections`);
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
     * 根据名称查找section
     * @param sectionName section名称
     * @returns 找到的section或undefined
     */
    findSectionByName(sectionName: string): SectionInfo | undefined {
        // 直接匹配
        let section = this.structure.sections.find(s => 
            this.normalizeText(s.name) === this.normalizeText(sectionName)
        );
        
        if (section) {
            return section;
        }
        
        // 模糊匹配
        section = this.structure.sections.find(s => 
            this.normalizeText(s.name).includes(this.normalizeText(sectionName)) ||
            this.normalizeText(sectionName).includes(this.normalizeText(s.name))
        );
        
        if (section) {
            logger.info(`📍 Found section by fuzzy match: '${sectionName}' -> '${section.name}'`);
        }
        
        return section;
    }
    
    /**
     * 计算插入点位置
     * @param section 目标section
     * @param position 位置类型
     * @returns 插入点位置
     */
    calculateInsertionPoint(section: SectionInfo, position?: 'before' | 'after'): vscode.Position {
        switch (position) {
            case 'before':
                return section.range.start;
                
            case 'after':
                // 找到section的结束位置
                const nextSection = this.findNextSameLevelSection(section);
                if (nextSection) {
                    return new vscode.Position(nextSection.range.start.line - 1, 0);
                } else {
                    return new vscode.Position(section.range.end.line + 1, 0);
                }
                
            default:
                return section.range.start;
        }
    }
    
    /**
     * 🚀 计算append_to_section的插入位置
     * 在章节内容的最后一行末尾插入，但不超出章节边界
     */
    private calculateAppendPosition(section: SectionInfo): LocationResult {
        try {
            // 计算章节内容的真实结束位置
            const nextSection = this.findNextSameLevelSection(section);
            let contentEndLine: number;
            
            if (nextSection) {
                // 如果有下一个同级section，在它之前插入
                contentEndLine = nextSection.range.start.line - 1;
            } else {
                // 如果没有下一个同级section，使用当前section的结束位置
                contentEndLine = section.range.end.line;
            }
            
            // 确保不会超出章节范围
            const insertionPoint = new vscode.Position(contentEndLine, 0);
            
            logger.info(`📍 Calculated append position at line ${contentEndLine + 1}`);
            
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
     * 在章节标题之后，内容开始之前插入
     */
    private calculatePrependPosition(section: SectionInfo): LocationResult {
        try {
            // 在章节标题的下一行插入
            const insertionPoint = new vscode.Position(section.range.start.line + 1, 0);
            
            logger.info(`📍 Calculated prepend position at line ${section.range.start.line + 2}`);
            
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
    private calculatePosition(section: SectionInfo, target: SemanticTarget): LocationResult {
        const position = target.position || 'replace';
        
        switch (position) {
            case 'replace':
                return {
                    found: true,
                    range: section.range,
                    context: this.buildContext(section)
                };
                
            case 'before':
                return {
                    found: true,
                    insertionPoint: this.calculateInsertionPoint(section, 'before'),
                    context: this.buildContext(section)
                };
                
            case 'after':
                return {
                    found: true,
                    insertionPoint: this.calculateInsertionPoint(section, 'after'),
                    context: this.buildContext(section)
                };
                
            case 'append':
                // 在section内容末尾追加 - 这是针对append_to_section操作
                return this.calculateAppendPosition(section);
                
            case 'prepend':
                // 在section内容开始处插入 - 这是针对prepend_to_section操作
                return this.calculatePrependPosition(section);
                
            default:
                logger.warn(`Unknown position type: ${position}`);
                return { found: false };
        }
    }
    
    /**
     * 查找下一个同级section
     */
    private findNextSameLevelSection(currentSection: SectionInfo): SectionInfo | undefined {
        const currentIndex = this.structure.sections.indexOf(currentSection);
        if (currentIndex === -1) return undefined;
        
        for (let i = currentIndex + 1; i < this.structure.sections.length; i++) {
            const section = this.structure.sections[i];
            if (section.level <= currentSection.level) {
                return section;
            }
        }
        
        return undefined;
    }
    
    /**
     * 构建上下文信息
     */
    private buildContext(section: SectionInfo): {
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
    private findPreviousSection(currentSection: SectionInfo): SectionInfo | undefined {
        const currentIndex = this.structure.sections.indexOf(currentSection);
        return currentIndex > 0 ? this.structure.sections[currentIndex - 1] : undefined;
    }
    
    /**
     * 查找后一个section
     */
    private findNextSection(currentSection: SectionInfo): SectionInfo | undefined {
        const currentIndex = this.structure.sections.indexOf(currentSection);
        return currentIndex < this.structure.sections.length - 1 ? 
               this.structure.sections[currentIndex + 1] : undefined;
    }
    
    /**
     * 查找父section
     */
    private findParentSection(currentSection: SectionInfo): SectionInfo | undefined {
        const currentIndex = this.structure.sections.indexOf(currentSection);
        if (currentIndex === -1) return undefined;
        
        // 向前查找更高级别的section
        for (let i = currentIndex - 1; i >= 0; i--) {
            const section = this.structure.sections[i];
            if (section.level < currentSection.level) {
                return section;
            }
        }
        
        return undefined;
    }
    
    /**
     * 🚀 新增：在章节内查找具体内容
     * @param section 目标章节
     * @param target 语义目标
     * @returns 内容定位结果
     */
    private findContentInSection(section: SectionInfo, target: SemanticTarget): LocationResult {
        try {
            logger.info(`🔍 Searching for content in section: ${section.name}`);
            
            // 获取章节内容
            const sectionContent = section.content || '';
            const lines = sectionContent.split('\n');
            
            // 处理不同类型的内容定位
            if (target.targetContent) {
                // 查找要替换的目标内容
                return this.findTargetContent(section, target.targetContent, lines);
            }
            
            if (target.contentToRemove) {
                // 查找要删除的内容
                return this.findTargetContent(section, target.contentToRemove, lines);
            }
            
            if (target.afterContent) {
                // 查找在某内容之后插入的位置
                return this.findInsertionAfterContent(section, target.afterContent, lines);
            }
            
            if (target.beforeContent) {
                // 查找在某内容之前插入的位置
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
    private findTargetContent(section: SectionInfo, targetContent: string, lines: string[]): LocationResult {
        const normalizedTarget = this.normalizeText(targetContent);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const normalizedLine = this.normalizeText(line);
            
            if (normalizedLine.includes(normalizedTarget)) {
                const startPos = new vscode.Position(section.range.start.line + i, 0);
                const endPos = new vscode.Position(section.range.start.line + i, line.length);
                
                logger.info(`✅ Found target content at line ${section.range.start.line + i + 1}`);
                
                return {
                    found: true,
                    range: new vscode.Range(startPos, endPos),
                    context: this.buildContext(section)
                };
            }
        }
        
        // 如果完全匹配失败，尝试模糊匹配
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(targetContent)) {
                const startIndex = line.indexOf(targetContent);
                const startPos = new vscode.Position(section.range.start.line + i, startIndex);
                const endPos = new vscode.Position(section.range.start.line + i, startIndex + targetContent.length);
                
                logger.info(`✅ Found target content with fuzzy match at line ${section.range.start.line + i + 1}`);
                
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
     * 查找在某内容之后的插入位置
     */
    private findInsertionAfterContent(section: SectionInfo, afterContent: string, lines: string[]): LocationResult {
        const normalizedAfter = this.normalizeText(afterContent);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const normalizedLine = this.normalizeText(line);
            
            if (normalizedLine.includes(normalizedAfter)) {
                const insertionPoint = new vscode.Position(section.range.start.line + i + 1, 0);
                
                logger.info(`✅ Found insertion point after content at line ${section.range.start.line + i + 2}`);
                
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
    private findInsertionBeforeContent(section: SectionInfo, beforeContent: string, lines: string[]): LocationResult {
        const normalizedBefore = this.normalizeText(beforeContent);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const normalizedLine = this.normalizeText(line);
            
            if (normalizedLine.includes(normalizedBefore)) {
                const insertionPoint = new vscode.Position(section.range.start.line + i, 0);
                
                logger.info(`✅ Found insertion point before content at line ${section.range.start.line + i + 1}`);
                
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
     * 🚀 静态方法：创建append_to_section目标
     * @param sectionName 章节名称
     * @returns 配置好的语义目标
     */
    static createAppendToSectionTarget(sectionName: string): SemanticTarget {
        return {
            sectionName,
            position: 'append'
        };
    }
    
    /**
     * 🚀 静态方法：创建prepend_to_section目标
     * @param sectionName 章节名称
     * @returns 配置好的语义目标
     */
    static createPrependToSectionTarget(sectionName: string): SemanticTarget {
        return {
            sectionName,
            position: 'prepend'
        };
    }
    
    /**
     * 🚀 静态方法：检测操作类型并创建相应的目标
     * @param operationType 操作类型字符串
     * @param sectionName 章节名称
     * @returns 配置好的语义目标，如果操作类型不匹配则返回null
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
}

/**
 * 🚀 使用示例：
 * 
 * // 在某个章节末尾追加内容
 * const appendIntent: SemanticEditIntent = {
 *     type: 'append_to_section',
 *     target: { sectionName: '功能需求' },
 *     content: '- 新增功能：用户登录验证',
 *     reason: '添加新的功能需求',
 *     priority: 1
 * };
 * 
 * // 在某个章节开头插入内容  
 * const prependIntent: SemanticEditIntent = {
 *     type: 'prepend_to_section',
 *     target: { sectionName: '项目概述' },
 *     content: '**重要提醒**: 本文档包含最新的需求变更',
 *     reason: '添加重要提醒信息',
 *     priority: 2
 * };
 * 
 * // 执行语义编辑
 * const result = await executeSemanticEdits([appendIntent, prependIntent], fileUri);
 * 
 * // 或者使用辅助方法创建目标
 * const appendTarget = SemanticLocator.createAppendToSectionTarget('功能需求');
 * const prependTarget = SemanticLocator.createPrependToSectionTarget('项目概述');
 */ 