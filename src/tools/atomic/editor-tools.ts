import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';

/**
 * 编辑器操作工具 - 基于 vscode.window 和 vscode.workspace API
 * 
 * 包含功能：
 * - 获取文档内容和用户选择
 * - 文本插入和替换
 * - 文件打开和导航
 * - 智能范围选择
 */

const logger = Logger.getInstance();

// ============================================================================
// 文档内容获取工具
// ============================================================================

/**
 * 获取当前活动文档内容
 */
export const getActiveDocumentContentToolDefinition = {
    name: "getActiveDocumentContent",
    description: "Get the complete text content of the currently active editor",
    parameters: {
        type: "object",
        properties: {},
        required: []
    }
};

export async function getActiveDocumentContent(): Promise<{ 
    success: boolean; 
    content?: string; 
    filePath?: string; 
    error?: string 
}> {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return { success: false, error: 'No active text editor' };
        }

        const content = activeEditor.document.getText();
        const filePath = vscode.workspace.asRelativePath(activeEditor.document.uri);
        
        logger.info(`✅ Got active document content: ${filePath} (${content.length} chars)`);
        return { success: true, content, filePath };
    } catch (error) {
        const errorMsg = `Failed to get active document content: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

// DEPRECATED: getUserSelection tool has been removed

// ============================================================================
// 文本编辑工具
// ============================================================================

// DEPRECATED: insertText tool has been removed

// DEPRECATED: replaceText tool has been removed

// ============================================================================
// 文件导航工具
// ============================================================================

/**
 * 在编辑器中打开文件
 */
export const openAndShowFileToolDefinition = {
    name: "openAndShowFile",
    description: "Open a file in the editor and show it to the user",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "File path relative to workspace root"
            }
        },
        required: ["path"]
    }
};

export async function openAndShowFile(args: { path: string }): Promise<{ success: boolean; error?: string }> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, args.path);
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document, {
            preview: false,
            viewColumn: vscode.ViewColumn.One
        });
        
        logger.info(`✅ Opened and showed file: ${args.path}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Failed to open file ${args.path}: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

// DEPRECATED: openAndSelectRange tool has been removed

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取当前工作区文件夹
 */
function getCurrentWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0];
}

// ============================================================================
// 导出定义和实现
// ============================================================================

export const editorToolDefinitions = [
    getActiveDocumentContentToolDefinition,
    openAndShowFileToolDefinition
];

export const editorToolImplementations = {
    getActiveDocumentContent,
    openAndShowFile
}; 