import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';

/**
 * 文件系统操作工具 - 基于 vscode.workspace.fs API
 * 
 * 包含功能：
 * - 文件读写操作
 * - 目录管理（创建、列出、删除）
 * - 文件重命名和移动
 * - 智能项目检测
 */

const logger = Logger.getInstance();

// ============================================================================
// 文件操作工具
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
    },
    // 🚀 智能分类属性
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    // 🚀 访问控制：读取文件是安全操作，大部分调用者都可以使用
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // 用户询问文件内容，现在归入知识问答模式
        CallerType.SPECIALIST,                    // 专家需要读取现有文档
        CallerType.DOCUMENT                       // 文档层读取操作
    ]
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
    },
    // 🚀 智能分类属性
    interactionType: 'confirmation',
    riskLevel: 'medium',
    requiresConfirmation: true,
    // 🚀 访问控制：写文件是危险操作，只有明确的执行任务可以进行
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,  // 明确的文件操作任务
        // ❌ KNOWLEDGE_QA 模式通常不应该写文件（除非特殊需求）
        CallerType.SPECIALIST,                    // 专家可以创建文档
        CallerType.DOCUMENT                       // 文档层的核心功能
    ]
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

// ============================================================================
// 目录操作工具
// ============================================================================

/**
 * 🚀 智能目录创建工具：创建目录并自动管理项目状态
 * 核心价值：解决AI创建项目目录后SessionManager状态不一致的问题
 * 智能检测：当创建的目录看起来像项目时，自动更新会话状态
 */
export const createDirectoryToolDefinition = {
    name: "createDirectory",
    description: "Create a new directory (automatically detects and registers new projects)",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Directory path relative to workspace root"
            },
            isProjectDirectory: {
                type: "boolean",
                description: "Whether this is a project root directory (optional, auto-detected)"
            }
        },
        required: ["path"]
    }
};

export async function createDirectory(args: { 
    path: string; 
    isProjectDirectory?: boolean 
}): Promise<{ 
    success: boolean; 
    error?: string;
    projectRegistered?: boolean;
}> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, args.path);
        await vscode.workspace.fs.createDirectory(dirUri);
        
        logger.info(`✅ Created directory: ${args.path}`);
        
        // 🚀 智能项目检测：检测是否是项目目录
        const shouldRegisterAsProject = args.isProjectDirectory ?? _isLikelyProjectDirectory(args.path);
        let projectRegistered = false;
        
        if (shouldRegisterAsProject) {
            try {
                // 🚀 v3.0重构：使用SessionManager单例，解决多头管理问题
                const { SessionManager } = await import('../../core/session-manager');
                const sessionManager = SessionManager.getInstance();
                
                // 获取当前会话，如果没有项目则更新为新创建的项目
                const currentSession = await sessionManager.getCurrentSession();
                if (!currentSession?.projectName) {
                    const projectName = _extractProjectNameFromPath(args.path);
                    const baseDir = workspaceFolder.uri.fsPath + '/' + args.path;
                    
                    if (currentSession) {
                        // 更新现有会话
                        await sessionManager.updateSession({
                            projectName,
                            baseDir
                        });
                    } else {
                        // 创建新会话
                        await sessionManager.createNewSession(projectName);
                        await sessionManager.updateSession({ baseDir });
                    }
                    
                    projectRegistered = true;
                    logger.info(`🎯 Auto-registered new project: ${projectName}`);
                }
            } catch (sessionError) {
                logger.warn(`Failed to update session for new project: ${sessionError}`);
                // 即使会话更新失败，目录创建仍然成功
            }
        }
        
        return { 
            success: true, 
            projectRegistered 
        };
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
    },
    // 🚀 访问控制：列出文件是安全查询操作
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // "项目里有什么文件？"现在归入知识问答模式
        CallerType.SPECIALIST,                    // 专家探索项目结构
        CallerType.DOCUMENT                       // 文档层需要了解文件结构
    ]
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
    },
    // 🚀 智能分类属性
    interactionType: 'confirmation',
    riskLevel: 'high',
    requiresConfirmation: true
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
// 辅助函数
// ============================================================================

/**
 * 🔧 内部函数：检测路径是否像项目目录
 */
function _isLikelyProjectDirectory(path: string): boolean {
    // 项目特征检测
    const projectIndicators = [
        'project',
        'srs-',
        '项目',
        'webapp',
        'app',
        'system',
        '系统'
    ];
    
    const pathLower = path.toLowerCase();
    return projectIndicators.some(indicator => pathLower.includes(indicator));
}

/**
 * 🔧 内部函数：从路径中提取项目名
 */
function _extractProjectNameFromPath(path: string): string {
    // 移除前导斜杠，取最后一段作为项目名
    return path.replace(/^\/+/, '').split('/').pop() || path;
}

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

export const filesystemToolDefinitions = [
    readFileToolDefinition,
    writeFileToolDefinition,
    appendTextToFileToolDefinition,
    createDirectoryToolDefinition,
    listFilesToolDefinition,
    deleteFileToolDefinition,
    renameFileToolDefinition
];

export const filesystemToolImplementations = {
    readFile,
    writeFile,
    appendTextToFile,
    createDirectory,
    listFiles,
    deleteFile,
    renameFile
}; 