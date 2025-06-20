import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';

/**
 * 原子层工具集 - 完全基于VSCode API的低阶工具
 * 这些是所有高阶工具的基础构建块
 * 
 * 分层架构：
 * 🟡 原子层（这一层）：直接封装 vscode API，无业务逻辑
 * 🟠 模块层：基于原子层的业务模块（如 FR 增删改查）
 * 🔴 文档层：基于模块层的复合操作（如 createNewSRS）
 * 
 * 设计原则：
 * ⚠️ 原子工具绝对不能理解"领域概念"
 * ✅ 提供通用的"刀"、"螺丝刀"、"剪刀"
 * ❌ 不提供专门用来"修理特定型号手表"的工具
 */

const logger = Logger.getInstance();

// ============================================================================
// A. 文件系统操作工具 (基于 vscode.workspace.fs) - 几乎完美
// ============================================================================

/**
 * 读取文件内容
 */
export const readFileToolDefinition = {
    name: "readFile",
    description: "Read the complete content of a file",
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

export async function readFile(args: { path: string }): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, args.path);
        const fileData = await vscode.workspace.fs.readFile(fileUri);
        const content = new TextDecoder().decode(fileData);
        
        logger.info(`✅ Read file: ${args.path} (${content.length} chars)`);
        return { success: true, content };
    } catch (error) {
        const errorMsg = `Failed to read file ${args.path}: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * 写入文件内容
 */
export const writeFileToolDefinition = {
    name: "writeFile",
    description: "Write content to a file (create or overwrite)",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "File path relative to workspace root"
            },
            content: {
                type: "string",
                description: "Content to write to the file"
            }
        },
        required: ["path", "content"]
    }
};

export async function writeFile(args: { path: string; content: string }): Promise<{ success: boolean; error?: string }> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, args.path);
        const contentBytes = new TextEncoder().encode(args.content);
        
        await vscode.workspace.fs.writeFile(fileUri, contentBytes);
        
        logger.info(`✅ Wrote file: ${args.path} (${args.content.length} chars)`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Failed to write file ${args.path}: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * 🚀 增强工具：追加文本到文件末尾
 * 高价值场景：生成操作日志、快速添加备注，比完整读写更高效
 */
export const appendTextToFileToolDefinition = {
    name: "appendTextToFile",
    description: "Append text to the end of a file (more efficient than read-modify-write for logs)",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "File path relative to workspace root"
            },
            textToAppend: {
                type: "string",
                description: "Text to append to the file"
            },
            addNewline: {
                type: "boolean",
                description: "Whether to add a newline before the text (default: true)"
            }
        },
        required: ["path", "textToAppend"]
    }
};

export async function appendTextToFile(args: { 
    path: string; 
    textToAppend: string; 
    addNewline?: boolean 
}): Promise<{ success: boolean; error?: string }> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, args.path);
        
        // 读取现有内容
        let existingContent = '';
        try {
            const existingData = await vscode.workspace.fs.readFile(fileUri);
            existingContent = new TextDecoder().decode(existingData);
        } catch (error) {
            // 文件不存在，创建新文件
            logger.info(`File ${args.path} doesn't exist, creating new file`);
        }
        
        // 构造新内容
        const addNewline = args.addNewline !== false; // 默认为true
        const newContent = existingContent + 
            (addNewline && existingContent && !existingContent.endsWith('\n') ? '\n' : '') + 
            args.textToAppend;
        
        // 写入更新后的内容
        const contentBytes = new TextEncoder().encode(newContent);
        await vscode.workspace.fs.writeFile(fileUri, contentBytes);
        
        logger.info(`✅ Appended ${args.textToAppend.length} chars to: ${args.path}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Failed to append to file ${args.path}: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * 创建目录
 */
export const createDirectoryToolDefinition = {
    name: "createDirectory",
    description: "Create a new directory",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Directory path relative to workspace root"
            }
        },
        required: ["path"]
    }
};

export async function createDirectory(args: { path: string }): Promise<{ success: boolean; error?: string }> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, args.path);
        await vscode.workspace.fs.createDirectory(dirUri);
        
        logger.info(`✅ Created directory: ${args.path}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Failed to create directory ${args.path}: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * 列出目录内容
 */
export const listFilesToolDefinition = {
    name: "listFiles",
    description: "List all files and directories in a directory",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Directory path relative to workspace root (use '.' for workspace root)"
            }
        },
        required: ["path"]
    }
};

export async function listFiles(args: { path: string }): Promise<{ 
    success: boolean; 
    files?: Array<{ name: string; type: 'file' | 'directory' }>; 
    error?: string 
}> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const dirUri = args.path === '.' 
            ? workspaceFolder.uri 
            : vscode.Uri.joinPath(workspaceFolder.uri, args.path);
            
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        const files = entries.map(([name, type]) => ({
            name,
            type: type === vscode.FileType.Directory ? 'directory' as const : 'file' as const
        }));
        
        logger.info(`✅ Listed ${files.length} items in: ${args.path}`);
        return { success: true, files };
    } catch (error) {
        const errorMsg = `Failed to list files in ${args.path}: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * 删除文件或目录
 */
export const deleteFileToolDefinition = {
    name: "deleteFile",
    description: "Delete a file or directory",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "File or directory path relative to workspace root"
            }
        },
        required: ["path"]
    }
};

export async function deleteFile(args: { path: string }): Promise<{ success: boolean; error?: string }> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const targetUri = vscode.Uri.joinPath(workspaceFolder.uri, args.path);
        await vscode.workspace.fs.delete(targetUri, { recursive: true, useTrash: true });
        
        logger.info(`✅ Deleted: ${args.path}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Failed to delete ${args.path}: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * 重命名或移动文件
 */
export const renameFileToolDefinition = {
    name: "renameFile",
    description: "Rename or move a file/directory",
    parameters: {
        type: "object",
        properties: {
            oldPath: {
                type: "string",
                description: "Current file path relative to workspace root"
            },
            newPath: {
                type: "string",
                description: "New file path relative to workspace root"
            }
        },
        required: ["oldPath", "newPath"]
    }
};

export async function renameFile(args: { oldPath: string; newPath: string }): Promise<{ success: boolean; error?: string }> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const oldUri = vscode.Uri.joinPath(workspaceFolder.uri, args.oldPath);
        const newUri = vscode.Uri.joinPath(workspaceFolder.uri, args.newPath);
        
        await vscode.workspace.fs.rename(oldUri, newUri);
        
        logger.info(`✅ Renamed: ${args.oldPath} → ${args.newPath}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Failed to rename ${args.oldPath} to ${args.newPath}: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

// ============================================================================
// B. 编辑器与文档交互工具 (基于 vscode.window 和 vscode.workspace) - 功能强大
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
// C. 用户界面与交互工具 (基于 vscode.window) - 基础完备
// ============================================================================

/**
 * 显示信息消息
 */
export const showInformationMessageToolDefinition = {
    name: "showInformationMessage",
    description: "Show an information message to the user",
    parameters: {
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "Information message to display"
            }
        },
        required: ["message"]
    }
};

export async function showInformationMessage(args: { message: string }): Promise<{ success: boolean }> {
    vscode.window.showInformationMessage(args.message);
    logger.info(`✅ Showed info message: ${args.message}`);
    return { success: true };
}

/**
 * 显示警告消息
 */
export const showWarningMessageToolDefinition = {
    name: "showWarningMessage",
    description: "Show a warning message to the user",
    parameters: {
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "Warning message to display"
            }
        },
        required: ["message"]
    }
};

export async function showWarningMessage(args: { message: string }): Promise<{ success: boolean }> {
    vscode.window.showWarningMessage(args.message);
    logger.info(`✅ Showed warning message: ${args.message}`);
    return { success: true };
}

/**
 * 询问用户输入
 */
export const askQuestionToolDefinition = {
    name: "askQuestion",
    description: "Ask the user for text input via an input box",
    parameters: {
        type: "object",
        properties: {
            question: {
                type: "string",
                description: "Question to ask the user"
            },
            placeholder: {
                type: "string",
                description: "Placeholder text for the input box (optional)"
            }
        },
        required: ["question"]
    }
};

export async function askQuestion(args: { question: string; placeholder?: string }): Promise<{ 
    success: boolean; 
    answer?: string; 
    cancelled?: boolean 
}> {
    try {
        const answer = await vscode.window.showInputBox({
            prompt: args.question,
            placeHolder: args.placeholder
        });
        
        if (answer === undefined) {
            logger.info(`❌ User cancelled question: ${args.question}`);
            return { success: true, cancelled: true };
        }
        
        logger.info(`✅ User answered question: ${args.question} → ${answer}`);
        return { success: true, answer };
    } catch (error) {
        const errorMsg = `Failed to ask question: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false };
    }
}

/**
 * 让用户从选项中选择
 */
export const askForChoiceToolDefinition = {
    name: "askForChoice",
    description: "Show the user a list of options to choose from",
    parameters: {
        type: "object",
        properties: {
            question: {
                type: "string",
                description: "Question to ask the user"
            },
            options: {
                type: "array",
                items: {
                    type: "string"
                },
                description: "List of options for the user to choose from"
            }
        },
        required: ["question", "options"]
    }
};

export async function askForChoice(args: { question: string; options: string[] }): Promise<{ 
    success: boolean; 
    choice?: string; 
    cancelled?: boolean 
}> {
    try {
        const choice = await vscode.window.showQuickPick(args.options, {
            placeHolder: args.question
        });
        
        if (choice === undefined) {
            logger.info(`❌ User cancelled choice: ${args.question}`);
            return { success: true, cancelled: true };
        }
        
        logger.info(`✅ User made choice: ${args.question} → ${choice}`);
        return { success: true, choice };
    } catch (error) {
        const errorMsg = `Failed to ask for choice: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false };
    }
}

/**
 * 🚀 用户体验增强工具：显示进度指示器
 * 高价值场景：长时间操作时提供进度反馈，避免界面卡住
 * SRS场景：调用远程RAG生成完整SRS文档时显示"正在生成，请稍候..."
 */
export const showProgressIndicatorToolDefinition = {
    name: "showProgressIndicator",
    description: "Show a progress indicator while performing a long-running operation",
    parameters: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "Title of the progress indicator"
            },
            message: {
                type: "string",
                description: "Message to display during the operation"
            },
            cancellable: {
                type: "boolean",
                description: "Whether the operation can be cancelled (default: false)"
            }
        },
        required: ["title", "message"]
    }
};

// 注意：这个工具比较特殊，它需要配合具体的异步任务使用
// 在实际的specialist层中，会与其他工具组合使用
export async function showProgressIndicator(args: { 
    title: string; 
    message: string; 
    cancellable?: boolean 
}): Promise<{ success: boolean; error?: string }> {
    try {
        // 这是一个模拟的进度指示器，实际的specialist层会传入具体的任务
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: args.title,
            cancellable: args.cancellable || false
        }, async (progress, token) => {
            progress.report({ message: args.message });
            
            // 模拟一个短暂的操作
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (token.isCancellationRequested) {
                throw new Error('Operation was cancelled');
            }
        });
        
        logger.info(`✅ Progress indicator completed: ${args.title}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Progress indicator failed: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

// ============================================================================
// D. 系统控制工具 (任务流程控制) - 关键基础设施
// ============================================================================

/**
 * 🚀 任务完成信号工具 - AI明确表示任务完成
 * 核心价值：解决对话式循环的终止信号问题
 * 架构意义：让AI从"可能完成了"到"我明确宣布完成了"
 */
export const finalAnswerToolDefinition = {
    name: "finalAnswer",
    description: "Call this tool when you have completely finished the user's task and want to provide a final summary",
    parameters: {
        type: "object",
        properties: {
            summary: {
                type: "string",
                description: "A comprehensive summary of what was accomplished"
            },
            result: {
                type: "string",
                description: "The final result or outcome of the task"
            },
            achievements: {
                type: "array",
                items: { type: "string" },
                description: "List of specific achievements or actions completed"
            },
            nextSteps: {
                type: "string",
                description: "Optional suggestions for what the user might want to do next"
            }
        },
        required: ["summary", "result"]
    }
};

export async function finalAnswer(args: {
    summary: string;
    result: string;
    achievements?: string[];
    nextSteps?: string;
}): Promise<{ 
    completed: true; 
    summary: string; 
    result: string; 
    achievements: string[];
    nextSteps?: string;
}> {
    logger.info(`🎯 Task completion signaled: ${args.summary}`);
    
    return {
        completed: true,
        summary: args.summary,
        result: args.result,
        achievements: args.achievements || [],
        nextSteps: args.nextSteps
    };
}

// ============================================================================
// 辅助函数
// ============================================================================

function getCurrentWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0];
}

/**
 * 所有原子层工具的定义数组
 * 🚀 已增强：包含了所有高价值工具
 */
export const atomicToolDefinitions = [
    // 文件系统操作 (几乎完美)
    readFileToolDefinition,
    writeFileToolDefinition,
    appendTextToFileToolDefinition,  // 🚀 新增：高效追加
    createDirectoryToolDefinition,
    listFilesToolDefinition,
    deleteFileToolDefinition,
    renameFileToolDefinition,
    
    // 编辑器交互 (功能强大)
    getActiveDocumentContentToolDefinition,
    getUserSelectionToolDefinition,
    insertTextToolDefinition,
    replaceTextToolDefinition,
    openAndShowFileToolDefinition,
    openAndSelectRangeToolDefinition,  // 🚀 新增：导航利器
    
    // 用户界面交互 (基础完备)
    showInformationMessageToolDefinition,
    showWarningMessageToolDefinition,
    askQuestionToolDefinition,
    askForChoiceToolDefinition,
    showProgressIndicatorToolDefinition,  // 🚀 新增：用户体验增强
    
    // 系统控制工具 (关键基础设施)
    finalAnswerToolDefinition  // 🚀 新增：任务完成信号
];

/**
 * 所有原子层工具的实现映射
 */
export const atomicToolImplementations = {
    // 文件系统操作
    readFile,
    writeFile,
    appendTextToFile,
    createDirectory,
    listFiles,
    deleteFile,
    renameFile,
    
    // 编辑器交互
    getActiveDocumentContent,
    getUserSelection,
    insertText,
    replaceText,
    openAndShowFile,
    openAndSelectRange,
    
    // 用户界面交互
    showInformationMessage,
    showWarningMessage,
    askQuestion,
    askForChoice,
    showProgressIndicator,
    
    // 系统控制
    finalAnswer
};

/**
 * 原子层工具分类信息
 */
export const atomicToolsCategory = {
    name: 'Atomic Tools',
    description: 'Basic VSCode API operations - file system, editor interaction, UI',
    tools: atomicToolDefinitions.map(tool => tool.name),
    layer: 'atomic'
};

/**
 * 获取所有原子层工具的定义 (向后兼容)
 * 🚀 已增强：包含了所有高价值工具
 */
export function getAllAtomicToolDefinitions() {
    return atomicToolDefinitions;
} 