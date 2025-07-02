/**
 * DocumentAnalyzer - VSCode原生语义文档分析器
 * 
 * 利用VSCode的DocumentSymbolProvider解析文档结构，
 * 为语义编辑提供精确的文档理解能力
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

/**
 * 文档结构信息接口
 */
export interface DocumentStructure {
    sections: SectionInfo[];
    headings: HeadingInfo[];
    symbols: vscode.DocumentSymbol[];
    symbolMap: Map<string, vscode.DocumentSymbol>;
}

/**
 * 章节信息接口
 */
export interface SectionInfo {
    name: string;
    level: number;
    range: vscode.Range;
    content: string;
    subsections: SectionInfo[];
    selector: string;           // 语义选择器
}

/**
 * 标题信息接口
 */
export interface HeadingInfo {
    level: number;
    text: string;
    line: number;
    range: vscode.Range;
    selector: string;
}

/**
 * DocumentAnalyzer - 文档语义分析器
 */
export class DocumentAnalyzer {
    
    /**
     * 分析文档结构
     * @param document VSCode文档对象
     * @returns 结构化的文档信息
     */
    async analyzeDocument(document: vscode.TextDocument): Promise<DocumentStructure> {
        try {
            logger.info(`🔍 Analyzing document structure: ${document.fileName}`);
            
            // 调用 VSCode 原生 DocumentSymbolProvider
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider', 
                document.uri
            );
            
            if (!symbols || symbols.length === 0) {
                logger.warn(`No symbols found for document: ${document.fileName}`);
                return this.createEmptyStructure();
            }
            
            // 构建文档结构
            const structure = await this.buildStructureFromSymbols(symbols, document);
            
            logger.info(`✅ Document analysis complete: ${structure.headings.length} headings, ${structure.sections.length} sections`);
            return structure;
            
        } catch (error) {
            logger.error(`Failed to analyze document: ${(error as Error).message}`);
            throw error;
        }
    }
    
    /**
     * 获取文档符号
     * @param uri 文档URI
     * @returns 文档符号数组
     */
    async getDocumentSymbols(uri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider', 
                uri
            );
            return symbols || [];
        } catch (error) {
            logger.error(`Failed to get document symbols: ${(error as Error).message}`);
            return [];
        }
    }
    
    /**
     * 从VSCode符号构建结构化信息
     * @param symbols VSCode文档符号
     * @param document 文档对象
     * @returns 文档结构
     */
    private async buildStructureFromSymbols(symbols: vscode.DocumentSymbol[], document: vscode.TextDocument): Promise<DocumentStructure> {
        const headings: HeadingInfo[] = [];
        const sections: SectionInfo[] = [];
        const symbolMap = new Map<string, vscode.DocumentSymbol>();
        
        // 递归处理符号
        this.processSymbols(symbols, headings, sections, symbolMap, document);
        
        return {
            sections,
            headings,
            symbols,
            symbolMap
        };
    }
    
    /**
     * 递归处理符号
     */
    private processSymbols(
        symbols: vscode.DocumentSymbol[], 
        headings: HeadingInfo[], 
        sections: SectionInfo[], 
        symbolMap: Map<string, vscode.DocumentSymbol>,
        document: vscode.TextDocument,
        parentLevel: number = 0
    ): void {
        for (const symbol of symbols) {
            // 将符号添加到映射
            symbolMap.set(symbol.name, symbol);
            
            // 处理标题类型的符号
            if (this.isHeadingSymbol(symbol)) {
                const level = this.extractHeadingLevel(symbol, parentLevel);
                const headingInfo: HeadingInfo = {
                    level,
                    text: symbol.name,
                    line: symbol.range.start.line + 1, // 转为1-based
                    range: symbol.range,
                    selector: this.generateHeadingSelector(symbol.name, level)
                };
                headings.push(headingInfo);
                
                // 创建对应的section
                const sectionInfo: SectionInfo = {
                    name: symbol.name,
                    level,
                    range: symbol.range,
                    content: document.getText(symbol.range),
                    subsections: [],
                    selector: this.generateSectionSelector(symbol.name)
                };
                sections.push(sectionInfo);
            }
            
            // 递归处理子符号
            if (symbol.children && symbol.children.length > 0) {
                this.processSymbols(symbol.children, headings, sections, symbolMap, document, parentLevel + 1);
            }
        }
    }
    
    /**
     * 判断是否为标题符号
     */
    private isHeadingSymbol(symbol: vscode.DocumentSymbol): boolean {
        // 对于Markdown，标题通常被识别为String类型或其他特定类型
        return symbol.kind === vscode.SymbolKind.String ||
               symbol.kind === vscode.SymbolKind.Module ||
               symbol.name.startsWith('#') ||
               /^#+\s/.test(symbol.name);
    }
    
    /**
     * 提取标题级别
     */
    private extractHeadingLevel(symbol: vscode.DocumentSymbol, parentLevel: number): number {
        // 尝试从符号名称中提取级别
        const match = symbol.name.match(/^(#+)/);
        if (match) {
            return match[1].length;
        }
        
        // 基于层级推断
        return parentLevel + 1;
    }
    
    /**
     * 生成标题选择器
     */
    private generateHeadingSelector(name: string, level: number): string {
        const cleanName = name.replace(/^#+\s*/, '').trim();
        return `h${level}:section('${cleanName}')`;
    }
    
    /**
     * 生成章节选择器
     */
    private generateSectionSelector(name: string): string {
        const cleanName = name.replace(/^#+\s*/, '').trim();
        return `section('${cleanName}')`;
    }
    
    /**
     * 创建空的文档结构
     */
    private createEmptyStructure(): DocumentStructure {
        return {
            sections: [],
            headings: [],
            symbols: [],
            symbolMap: new Map()
        };
    }
} 