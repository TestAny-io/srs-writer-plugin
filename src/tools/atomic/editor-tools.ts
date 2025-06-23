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

/**
 * 获取用户当前选中的文本
 */
export const getUserSelectionToolDefinition = {
    name: "getUserSelection",
    description: "Get the text that user has currently selected in the active editor",
    parameters: {
        type: "object",
        properties: {},
        required: []
    }
};

export async function getUserSelection(): Promise<{ 
    success: boolean; 
    text?: string; 
    range?: { startLine: number; endLine: number }; 
    error?: string 
}> {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return { success: false, error: 'No active text editor' };
        }

        const selection = activeEditor.selection;
        const text = activeEditor.document.getText(selection);
        const range = {
            startLine: selection.start.line + 1, // 转为 1-based
            endLine: selection.end.line + 1
        };
        
        logger.info(`✅ Got user selection: lines ${range.startLine}-${range.endLine} (${text.length} chars)`);
        return { success: true, text, range };
    } catch (error) {
        const errorMsg = `Failed to get user selection: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

// ============================================================================
// 文本编辑工具
// ============================================================================

/**
 * 在指定位置插入文本
 */
export const insertTextToolDefinition = {
    name: "insertText",
    description: "Insert text at a specific position in the active editor",
    parameters: {
        type: "object",
        properties: {
            text: {
                type: "string",
                description: "Text to insert"
            },
            line: {
                type: "number",
                description: "Line number (1-based)"
            },
            character: {
                type: "number", 
                description: "Character position in the line (0-based)"
            }
        },
        required: ["text", "line", "character"]
    }
};

export async function insertText(args: { text: string; line: number; character: number }): Promise<{ success: boolean; error?: string }> {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return { success: false, error: 'No active text editor' };
        }

        const position = new vscode.Position(args.line - 1, args.character); // 转为 0-based
        await activeEditor.edit(editBuilder => {
            editBuilder.insert(position, args.text);
        });
        
        logger.info(`✅ Inserted text at line ${args.line}, char ${args.character}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Failed to insert text: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * 替换指定行范围的文本
 */
export const replaceTextToolDefinition = {
    name: "replaceText",
    description: "Replace text in a specific line range in the active editor",
    parameters: {
        type: "object",
        properties: {
            text: {
                type: "string",
                description: "New text to replace with"
            },
            startLine: {
                type: "number",
                description: "Start line number (1-based, inclusive)"
            },
            endLine: {
                type: "number",
                description: "End line number (1-based, inclusive)"
            }
        },
        required: ["text", "startLine", "endLine"]
    }
};

export async function replaceText(args: { text: string; startLine: number; endLine: number }): Promise<{ success: boolean; error?: string }> {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return { success: false, error: 'No active text editor' };
        }

        const startPos = new vscode.Position(args.startLine - 1, 0); // 转为 0-based
        const endPos = new vscode.Position(args.endLine, 0); // endLine 的下一行开头
        const range = new vscode.Range(startPos, endPos);
        
        await activeEditor.edit(editBuilder => {
            editBuilder.replace(range, args.text);
        });
        
        logger.info(`✅ Replaced text in lines ${args.startLine}-${args.endLine}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Failed to replace text: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

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

/**
 * 🚀 高价值增强工具：打开文件并高亮指定范围
 * 核心价值：将Agent从"报告者"提升为"导航员"
 * SRS场景：lint检查发现问题时，直接导航到SRS.md第25行
 */
export const openAndSelectRangeToolDefinition = {
    name: "openAndSelectRange",
    description: "Open a file and highlight/select a specific line range (perfect for navigation to problems)",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "File path relative to workspace root"
            },
            startLine: {
                type: "number",
                description: "Start line number (1-based, inclusive)"
            },
            endLine: {
                type: "number",
                description: "End line number (1-based, inclusive). If same as startLine, highlights single line"
            },
            focusOnRange: {
                type: "boolean",
                description: "Whether to center the view on the selected range (default: true)"
            }
        },
        required: ["path", "startLine", "endLine"]
    }
};

export async function openAndSelectRange(args: { 
    path: string; 
    startLine: number; 
    endLine: number; 
    focusOnRange?: boolean 
}): Promise<{ success: boolean; error?: string }> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, args.path);
        const document = await vscode.workspace.openTextDocument(fileUri);
        
        // 创建选择范围（转为0-based）
        const startPos = new vscode.Position(args.startLine - 1, 0);
        const endLineContent = document.lineAt(args.endLine - 1);
        const endPos = new vscode.Position(args.endLine - 1, endLineContent.text.length);
        const range = new vscode.Range(startPos, endPos);
        
        // 打开文档并设置选择范围
        const editor = await vscode.window.showTextDocument(document, {
            preview: false,
            viewColumn: vscode.ViewColumn.One
        });
        
        // 设置选择和光标位置
        editor.selection = new vscode.Selection(range.start, range.end);
        
        // 将视图聚焦到选中范围
        if (args.focusOnRange !== false) {
            editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        }
        
        logger.info(`✅ Opened ${args.path} and selected lines ${args.startLine}-${args.endLine}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Failed to open and select range in ${args.path}: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

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
    getUserSelectionToolDefinition,
    insertTextToolDefinition,
    replaceTextToolDefinition,
    openAndShowFileToolDefinition,
    openAndSelectRangeToolDefinition
];

export const editorToolImplementations = {
    getActiveDocumentContent,
    getUserSelection,
    insertText,
    replaceText,
    openAndShowFile,
    openAndSelectRange
}; 