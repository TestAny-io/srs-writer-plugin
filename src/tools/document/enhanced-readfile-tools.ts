/**
 * ReadFile Tool - 统一的文件读取工具
 * 
 * 对外暴露的唯一文件读取接口。
 * 具备基础的文档结构分析能力，为AI Agent提供编辑目标信息。
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { SemanticLocator } from '../atomic/semantic-locator';
// 导入内部读取函数
import { _internalReadFile } from '../atomic/filesystem-tools';
import { CallerType } from '../../types';

const logger = Logger.getInstance();

/**
 * 简化的文档结构信息
 */
export interface SimpleDocumentStructure {
    sectionCount: number;
    headings: Array<{
        level: number;
        text: string;
        line: number;
    }>;
}

/**
 * 结构化文件读取结果接口
 */
export interface StructuredReadFileResult {
    success: boolean;
    content: string;                              // 原始内容（保持兼容）
    structure?: SimpleDocumentStructure;          // 新增：简化的结构化信息
    error?: string;
}

/**
 * Markdown文件读取工具定义
 */
export const readMarkdownFileToolDefinition = {
    name: "readMarkdownFile",
    description: "Read Markdown file content with optional document structure analysis. Specialized for .md files and Markdown-based documents.",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "File path relative to workspace root"
            },
            includeStructure: {
                type: "boolean", 
                description: "Include basic document structure information (e.g., for Markdown files). Default: false",
                default: false
            }
        },
        required: ["path"]
    },
    // 继承之前 readFile 的智能分类属性
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

/**
 * Markdown文件读取函数
 * @param args 读取参数
 * @returns 结构化读取结果
 */
export async function readMarkdownFile(args: {
    path: string;
    includeStructure?: boolean;
}): Promise<StructuredReadFileResult> {
    try {
        logger.info(`📖 Reading file with optional structure analysis: ${args.path}`);
        
        // 调用内部基础读取函数
        const basicReadResult = await _internalReadFile({ path: args.path });
        
        if (!basicReadResult.success) {
            return {
                success: false,
                content: '',
                error: basicReadResult.error
            };
        }
        
        const content = basicReadResult.content!;
        
        // 如果不需要结构分析，直接返回基础结果
        if (!args.includeStructure) {
            logger.info(`✅ Basic file read complete: ${content.length} chars`);
            return {
                success: true,
                content
            };
        }
        
        // 使用SemanticLocator进行基础的结构分析
        let structure: SimpleDocumentStructure | undefined;
        
        try {
            const locator = new SemanticLocator(content);
            structure = {
                sectionCount: locator.getNodeCount(),
                // 暂时简化版本，不提供详细标题信息（SemanticLocator不暴露sections）
                headings: []
            };
        } catch (error) {
            logger.warn(`Structure analysis failed, but returning content: ${(error as Error).message}`);
            // 即使结构分析失败，文件读取本身是成功的，所以只记录警告
            structure = undefined;
        }
        
        logger.info(`✅ Enhanced file read complete: ${content.length} chars, ${structure?.sectionCount ?? 0} sections`);
        
        return {
            success: true,
            content,
            structure
        };
        
    } catch (error) {
        const errorMsg = `Read file failed for ${args.path}: ${(error as Error).message}`;
        logger.error(errorMsg);
        
        return {
            success: false,
            content: '',
            error: errorMsg
        };
    }
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
    name: 'ReadMarkdownFile Tool',
    description: 'Markdown file reading with optional document structure analysis',
    tools: readMarkdownFileToolDefinitions.map(tool => tool.name),
    layer: 'document'
}; 