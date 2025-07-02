/**
 * Enhanced ReadFile Tools - 增强版文件读取工具
 * 
 * 扩展基础readFile功能，提供文档结构分析和语义映射，
 * 为AI Agent提供精确的编辑目标信息
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { DocumentAnalyzer, DocumentStructure } from '../atomic/document-analyzer';
import { readFile } from '../atomic/filesystem-tools';

const logger = Logger.getInstance();

/**
 * 结构化文件读取结果接口
 */
export interface StructuredReadFileResult {
    success: boolean;
    content: string;                    // 原始内容（保持兼容）
    structure?: DocumentStructure;      // 新增：结构化信息
    semanticMap?: SemanticMap;         // 新增：语义映射表
    error?: string;
}

/**
 * 语义映射表接口
 */
export interface SemanticMap {
    headings: Array<{
        level: number;
        text: string;
        selector: string;               // "h2:section('功能需求')"
        anchorBefore: string;          // "h2:section('功能需求'):before"  
        anchorAfter: string;           // "h2:section('功能需求'):after"
        range: vscode.Range;
    }>;
    editTargets: Array<{
        name: string;
        selector: string;
        insertionPoints: {
            before: vscode.Position;
            after: vscode.Position;
        };
    }>;
}

/**
 * 增强版文件读取工具定义
 */
export const readFileWithStructureToolDefinition = {
    name: "readFileWithStructure",
    description: "Read file content with optional document structure analysis for semantic editing",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "File path relative to workspace root"
            },
            includeStructure: {
                type: "boolean", 
                description: "Include document structure analysis for semantic editing (default: false)",
                default: false
            },
            includeSemanticMap: {
                type: "boolean",
                description: "Include semantic mapping table for AI-friendly editing targets (default: false)",
                default: false
            }
        },
        required: ["path"]
    }
};

/**
 * 增强版文件读取函数
 * @param args 读取参数
 * @returns 结构化读取结果
 */
export async function readFileWithStructure(args: {
    path: string;
    includeStructure?: boolean;
    includeSemanticMap?: boolean;
}): Promise<StructuredReadFileResult> {
    try {
        logger.info(`📖 Reading file with structure analysis: ${args.path}`);
        
        // 首先读取原始文件内容
        const basicReadResult = await readFile({ path: args.path });
        
        if (!basicReadResult.success) {
            return {
                success: false,
                content: '',
                error: basicReadResult.error
            };
        }
        
        const content = basicReadResult.content!;
        
        // 如果不需要结构分析，直接返回基础结果
        if (!args.includeStructure && !args.includeSemanticMap) {
            return {
                success: true,
                content
            };
        }
        
        // 执行文档结构分析
        let structure: DocumentStructure | undefined;
        let semanticMap: SemanticMap | undefined;
        
        if (args.includeStructure || args.includeSemanticMap) {
            structure = await analyzeDocumentStructure(args.path);
            
            if (args.includeSemanticMap && structure) {
                semanticMap = buildSemanticMap(structure);
            }
        }
        
        logger.info(`✅ Enhanced file read complete: ${content.length} chars, ${structure?.headings.length || 0} headings`);
        
        return {
            success: true,
            content,
            structure,
            semanticMap
        };
        
    } catch (error) {
        const errorMsg = `Enhanced file read failed for ${args.path}: ${(error as Error).message}`;
        logger.error(errorMsg);
        
        return {
            success: false,
            content: '',
            error: errorMsg
        };
    }
}

/**
 * 分析文档结构
 */
async function analyzeDocumentStructure(filePath: string): Promise<DocumentStructure | undefined> {
    try {
        // 获取工作区
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            logger.warn('No workspace folder found for document analysis');
            return undefined;
        }
        
        // 构建文件URI
        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
        
        // 打开文档
        const document = await vscode.workspace.openTextDocument(fileUri);
        
        // 创建分析器并分析文档
        const analyzer = new DocumentAnalyzer();
        const structure = await analyzer.analyzeDocument(document);
        
        return structure;
        
    } catch (error) {
        logger.error(`Document structure analysis failed: ${(error as Error).message}`);
        return undefined;
    }
}

/**
 * 构建语义映射表
 */
function buildSemanticMap(structure: DocumentStructure): SemanticMap {
    const headings = structure.headings.map(heading => ({
        level: heading.level,
        text: heading.text,
        selector: heading.selector,
        anchorBefore: `${heading.selector}:before`,
        anchorAfter: `${heading.selector}:after`,
        range: heading.range
    }));
    
    const editTargets = structure.sections.map(section => {
        // 计算插入点
        const beforePoint = section.range.start;
        const afterPoint = new vscode.Position(section.range.end.line + 1, 0);
        
        return {
            name: section.name,
            selector: section.selector,
            insertionPoints: {
                before: beforePoint,
                after: afterPoint
            }
        };
    });
    
    logger.info(`🗺️ Built semantic map: ${headings.length} headings, ${editTargets.length} targets`);
    
    return {
        headings,
        editTargets
    };
}

/**
 * 获取当前工作区文件夹
 */
function getCurrentWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0] : undefined;
}

/**
 * 工具实现映射
 */
export const enhancedReadFileToolImplementations = {
    readFileWithStructure
};

/**
 * 工具定义数组
 */
export const enhancedReadFileToolDefinitions = [
    readFileWithStructureToolDefinition
];

/**
 * Enhanced ReadFile 工具分类信息
 */
export const enhancedReadFileToolsCategory = {
    name: 'Enhanced ReadFile Tools',
    description: 'Enhanced file reading with document structure analysis for semantic editing',
    tools: enhancedReadFileToolDefinitions.map(tool => tool.name),
    layer: 'document'
}; 