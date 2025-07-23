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
// 文件操作工具 (内部实现)
// ============================================================================

/**
 * [内部函数] 读取文件内容的基础实现。
 * 不再作为独立的工具注册。
 */
const _internalReadFileToolDefinition = {
    name: "_internalReadFile",
    description: "Internal function to read the complete content of a file",
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

export async function _internalReadFile(args: { path: string }): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, args.path);
        const fileData = await vscode.workspace.fs.readFile(fileUri);
        const content = new TextDecoder().decode(fileData);
        
        logger.info(`[_internalReadFile] Read file: ${args.path} (${content.length} chars)`);
        return { success: true, content };
    } catch (error) {
        const errorMsg = `[_internalReadFile] Failed to read file ${args.path}: ${(error as Error).message}`;
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
    // 🚀 访问控制：写文件是危险操作，orchestrator不应直接使用
    accessibleBy: [
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
    },
    // 🚀 智能分类属性
    interactionType: 'confirmation',
    riskLevel: 'medium',
    requiresConfirmation: true,
    // 🚀 访问控制：追加文件是写操作，orchestrator不应直接使用
    accessibleBy: [
        CallerType.DOCUMENT                       // 文档层的核心功能
        // 注意：移除了CallerType.SPECIALIST，specialist应使用高层文档工具
    ]
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
    },
    // 🚀 智能分类属性
    interactionType: 'confirmation',
    riskLevel: 'medium',
    requiresConfirmation: true,
    // 🚀 访问控制：创建目录是重要操作，orchestrator不应直接使用
    accessibleBy: [
        CallerType.SPECIALIST,                    // 专家需要创建项目结构
        CallerType.INTERNAL                       // 内部工具（如createNewProjectFolder）
    ]
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
    description: "List all files and directories in a specific directory",
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
        //CallerType.SPECIALIST,                    // 专家探索项目结构
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
 * Recursively list all files and directories
 */
export const listAllFilesToolDefinition = {
    name: "listAllFiles",
    description: "Recursively list all non-hidden files and directories from workspace root with optional keyword search (automatically excludes all hidden directories starting with '.')",
    parameters: {
        type: "object",
        properties: {
            maxDepth: {
                type: "number",
                description: "Maximum recursion depth to prevent excessively deep directory structures, defaults to 10 levels",
                default: 10
            },
            maxItems: {
                type: "number",
                description: "Maximum number of items to prevent excessively long output, defaults to 1000",
                default: 1000
            },
            excludePatterns: {
                type: "array",
                items: { type: "string" },
                description: "Array of directory/file patterns to exclude, defaults to common non-source directories",
                default: ["node_modules", "coverage", "dist", "build"]
            },
            dirsOnly: {
                type: "boolean",
                description: "Whether to return only directory structure (excluding files), defaults to false",
                default: false
            },
            searchKeywords: {
                type: "array",
                items: { type: "string" },
                description: "Keywords to search in file/directory names. Only items containing any of these keywords will be returned. Case insensitive search."
            }
        }
    },
    // 🚀 智能分类属性
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    // 🚀 Access control: Consistent with listFiles, safe query operation
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // Key tool for AI project structure exploration
        CallerType.SPECIALIST,                    // Specialists exploring project structure
        CallerType.DOCUMENT                       // Document layer needs to understand file structure
    ]
};

export async function listAllFiles(args: {
    maxDepth?: number;
    maxItems?: number;
    excludePatterns?: string[];
    dirsOnly?: boolean;
    searchKeywords?: string[];
}): Promise<{
    success: boolean;
    structure?: {
        paths: string[];
        totalCount: number;
        truncated: boolean;
        depth: number;
    };
    error?: string;
}> {
    try {
        // 🔍 [DEBUG] 添加详细调试信息
        logger.info(`🔍 [listAllFiles DEBUG] === 开始执行 listAllFiles ===`);
        logger.info(`🔍 [listAllFiles DEBUG] 参数: ${JSON.stringify(args)}`);
        
        const workspaceFolder = getCurrentWorkspaceFolder();
        logger.info(`🔍 [listAllFiles DEBUG] getCurrentWorkspaceFolder() 返回: ${workspaceFolder ? workspaceFolder.uri.fsPath : 'undefined'}`);
        
        if (!workspaceFolder) {
            logger.error(`🔍 [listAllFiles DEBUG] 错误: 没有工作区文件夹打开`);
            return { success: false, error: 'No workspace folder is open' };
        }
        
        // 🚀 新增：显示搜索关键词信息
        if (args.searchKeywords && args.searchKeywords.length > 0) {
            logger.info(`🔍 [listAllFiles DEBUG] 🔎 搜索关键词: [${args.searchKeywords.join(', ')}]`);
            logger.info(`🔍 [listAllFiles DEBUG] 🔎 关键词匹配模式: 精确匹配 + 包含匹配 + 文件名基础匹配`);
        } else {
            logger.info(`🔍 [listAllFiles DEBUG] 🔎 无关键词限制，返回所有文件`);
        }

        const {
            maxDepth = 10,
            maxItems = 1000,
            excludePatterns = ["node_modules", "coverage", "dist", "build"],
            dirsOnly = false,
            searchKeywords
        } = args;

        // 🚀 固定从workspace根目录开始扫描
        const startPath = '.';

        const results: string[] = [];
        let totalCount = 0;
        let maxDepthReached = 0;

        // Helper function: Check if a file/directory should be excluded
        function shouldExclude(name: string, patterns: string[]): boolean {
            return patterns.some(pattern => {
                if (pattern.includes('*')) {
                    // Simple wildcard matching
                    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                    return regex.test(name);
                }
                return name === pattern;
            });
        }

        // Helper function: Check if a file/directory matches search keywords
        function matchesSearchKeywords(name: string, keywords?: string[]): boolean {
            if (!keywords || keywords.length === 0) return true;
            
            const targetName = name.toLowerCase(); // Case insensitive search
            const searchTerms = keywords.map(k => k.toLowerCase());
            
            // 🚀 改进匹配逻辑：支持精确匹配和包含匹配
            return searchTerms.some(keyword => {
                // 精确匹配（完整文件名）
                if (targetName === keyword) {
                    return true;
                }
                // 包含匹配（关键词在文件名中）
                if (targetName.includes(keyword)) {
                    return true;
                }
                // 如果关键词包含扩展名，尝试匹配文件名部分
                if (keyword.includes('.')) {
                    const keywordBase = keyword.split('.')[0];
                    if (targetName.includes(keywordBase)) {
                        return true;
                    }
                }
                return false;
            });
        }

        // Recursively traverse directory
        async function traverseDirectory(relativePath: string, currentDepth: number): Promise<void> {
            logger.info(`🔍 [listAllFiles DEBUG] 📁 遍历目录: "${relativePath}" (深度: ${currentDepth})`);
            
            if (currentDepth > maxDepth || totalCount >= maxItems) {
                logger.info(`🔍 [listAllFiles DEBUG] ⏹️ 停止遍历: 深度=${currentDepth}, 最大深度=${maxDepth}, 计数=${totalCount}, 最大项目=${maxItems}`);
                return;
            }

            maxDepthReached = Math.max(maxDepthReached, currentDepth);

            try {
                const dirUri = relativePath === '.'
                    ? workspaceFolder!.uri
                    : vscode.Uri.joinPath(workspaceFolder!.uri, relativePath);

                logger.info(`🔍 [listAllFiles DEBUG] 📍 目录URI: ${dirUri.toString()}`);
                
                const entries = await vscode.workspace.fs.readDirectory(dirUri);
                logger.info(`🔍 [listAllFiles DEBUG] 📋 找到 ${entries.length} 个条目`);

                for (const [name, type] of entries) {
                    const isDirectory = type === vscode.FileType.Directory;
                    logger.info(`🔍 [listAllFiles DEBUG]   🔍 检查: "${name}" (${isDirectory ? '目录' : '文件'})`);
                    
                    // Skip hidden files and excluded patterns
                    if (name.startsWith('.')) {
                        logger.info(`🔍 [listAllFiles DEBUG]     ⏭️ 跳过隐藏文件: ${name}`);
                        continue;
                    }
                    
                    if (shouldExclude(name, excludePatterns)) {
                        logger.info(`🔍 [listAllFiles DEBUG]     ⏭️ 被排除模式忽略: ${name}`);
                        continue;
                    }

                    // 🚀 修复关键词匹配逻辑：区分文件和目录的处理
                    const matchesKeywords = matchesSearchKeywords(name, searchKeywords);
                    logger.info(`🔍 [listAllFiles DEBUG]     🔎 关键词匹配: ${name} -> ${matchesKeywords}`);
                    
                    if (totalCount >= maxItems) {
                        logger.info(`🔍 [listAllFiles DEBUG]     ⏹️ 达到最大项目数限制: ${maxItems}`);
                        break;
                    }

                    const fullPath = relativePath === '.' ? name : `${relativePath}/${name}`;

                    // 🚀 修复：对文件和目录采用不同的关键词匹配策略
                    if (isDirectory) {
                        // 目录：总是递归进入，不管目录名是否匹配关键词
                        logger.info(`🔍 [listAllFiles DEBUG]     📁 目录始终递归搜索: ${fullPath}`);
                        
                        // 如果目录名匹配关键词且允许目录，则添加到结果
                        if (matchesKeywords && dirsOnly) {
                            results.push(fullPath);
                            totalCount++;
                            logger.info(`🔍 [listAllFiles DEBUG]     ✅ 添加匹配目录到结果: "${fullPath}" (总计: ${totalCount})`);
                        }
                        
                        // 递归进入子目录搜索文件
                        await traverseDirectory(fullPath, currentDepth + 1);
                        
                    } else {
                        // 文件：只有匹配关键词才添加到结果
                        if (matchesKeywords) {
                            results.push(fullPath);
                            totalCount++;
                            logger.info(`🔍 [listAllFiles DEBUG]     ✅ 添加匹配文件到结果: "${fullPath}" (总计: ${totalCount})`);
                        } else {
                            logger.info(`🔍 [listAllFiles DEBUG]     ⏭️ 文件不匹配关键词，跳过: ${name}`);
                        }
                    }
                }
            } catch (error) {
                // Ignore inaccessible directories, log warning but continue processing
                logger.warn(`🔍 [listAllFiles DEBUG] ❌ 遍历目录出错: ${relativePath} - ${(error as Error).message}`);
                logger.warn(`🔍 [listAllFiles DEBUG] 错误详情: ${JSON.stringify(error)}`);
            }
        }

        await traverseDirectory(startPath, 0);

        const searchInfo = searchKeywords && searchKeywords.length > 0 
            ? ` with keywords: [${searchKeywords.join(', ')}]` 
            : '';
            
        logger.info(`🔍 [listAllFiles DEBUG] === 遍历完成 ===`);
        logger.info(`🔍 [listAllFiles DEBUG] 找到文件数: ${results.length}`);
        logger.info(`🔍 [listAllFiles DEBUG] 最大深度: ${maxDepthReached}`);
        if (results.length > 0) {
            logger.info(`🔍 [listAllFiles DEBUG] 匹配文件列表: ${results.slice(0, 10).join(', ')}${results.length > 10 ? `... (共${results.length}个)` : ''}`);
        }
        
        logger.info(`✅ Listed ${results.length} items recursively from: ${startPath} (depth: ${maxDepthReached})${searchInfo}`);

        const finalResult = {
            success: true,
            structure: {
                paths: results.sort(), // Sort alphabetically for easy viewing
                totalCount: results.length,
                truncated: totalCount >= maxItems,
                depth: maxDepthReached
            }
        };
        
        logger.info(`🔍 [listAllFiles DEBUG] === 最终返回结果 ===`);
        logger.info(`🔍 [listAllFiles DEBUG] ${JSON.stringify(finalResult, null, 2)}`);
        
        return finalResult;

    } catch (error) {
        const errorMsg = `Failed to list all files from workspace root: ${(error as Error).message}`;
        logger.error(`🔍 [listAllFiles DEBUG] ❌ 顶层错误: ${errorMsg}`);
        logger.error(`🔍 [listAllFiles DEBUG] 错误对象: ${JSON.stringify(error)}`);
        logger.error(`🔍 [listAllFiles DEBUG] 错误堆栈: ${(error as Error).stack}`);
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
    requiresConfirmation: true,
    // 🚀 访问控制：删除操作是高风险操作，orchestrator不应直接使用
    accessibleBy: [
        CallerType.INTERNAL                       // 内部工具（如清理操作）
        // 注意：故意不包含SPECIALIST和KNOWLEDGE_QA，删除操作风险太高
    ]
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
    },
    // 🚀 智能分类属性
    interactionType: 'confirmation',
    riskLevel: 'medium',
    requiresConfirmation: true,
    // 🚀 访问控制：重命名/移动是有风险的操作，orchestrator不应直接使用
    accessibleBy: [
        CallerType.SPECIALIST,                    // 专家可能需要重构文件结构
        CallerType.INTERNAL                       // 内部工具（如项目重构）
    ]
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
    writeFileToolDefinition,
    appendTextToFileToolDefinition,
    createDirectoryToolDefinition,
    listFilesToolDefinition,
    listAllFilesToolDefinition,
    deleteFileToolDefinition,
    renameFileToolDefinition
];

export const filesystemToolImplementations = {
    writeFile,
    appendTextToFile,
    createDirectory,
    listFiles,
    listAllFiles,
    deleteFile,
    renameFile,
    _internalReadFile
}; 