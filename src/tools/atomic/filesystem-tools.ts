import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';
import { resolveWorkspacePath, getCurrentWorkspaceFolder } from '../../utils/path-resolver';

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
 * 检查文件扩展名是否为支持的文本格式
 */
function isSupportedTextFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = [
        // JSON和配置文件
        '.json', '.txt', '.csv', '.log', '.ini', '.env', '.gitignore', '.gitattributes',
        // 代码文件
        '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs',
        '.php', '.rb', '.go', '.rs', '.swift', '.kt',
        // 配置和脚本文件
        '.xml', '.toml', '.properties', '.conf', '.sh', '.bat', '.ps1', '.sql',
        // Web相关文件
        '.html', '.htm', '.css', '.scss', '.sass', '.less', '.svg',
        // 其他文本格式
        '.lock', '.editorconfig', '.npmrc', '.babelrc', '.eslintrc', '.prettierrc'
        // 注意：不包含 .md, .markdown, .yaml, .yml - 这些有专门的工具
    ];
    
    return supportedExtensions.includes(ext) || !ext; // 无扩展名的文件也视为文本文件
}

/**
 * 读取文本文件内容
 */
export const readTextFileToolDefinition = {
    name: "readTextFile",
    description: "Read text-based files (JSON, code files, configs, logs). Cannot read binary formats like .docx, .xlsx, .pdf, images. Excludes .md/.yaml/.yml files (use readMarkdownFile/readYAMLFiles instead). Supports .json, .txt, .csv, .log, .js, .ts, .py, .java, .xml, .html, .css, etc.",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "File path relative to project baseDir (or workspace root if no project is active). Do not include project name in path."
            },
            encoding: {
                type: "string",
                description: "File encoding (default: utf-8)",
                default: "utf-8"
            }
        },
        required: ["path"]
    },
    // 🚀 智能分类属性
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false,
    // 🚀 访问控制：文本文件读取是安全查询操作
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
        CallerType.SPECIALIST_CONTENT,
        CallerType.SPECIALIST_PROCESS,
        CallerType.DOCUMENT
    ]
};

export async function readTextFile(args: { 
    path: string; 
    encoding?: string 
}): Promise<{ 
    success: boolean; 
    content?: string; 
    fileSize?: number;
    fileType?: string;
    error?: string 
}> {
    try {
        logger.info(`📖 开始读取文本文件: ${args.path}`);

        // 1. 检查文件扩展名是否为支持的文本格式
        if (!isSupportedTextFile(args.path)) {
            const ext = path.extname(args.path).toLowerCase();
            return { 
                success: false, 
                error: `Unsupported file type: ${ext}. This tool only supports text-based files. For binary files like .docx, .xlsx, .pdf, .png, etc., use specialized tools.` 
            };
        }

        // 2. 解析文件路径（使用公共路径解析工具，启用存在性检查）
        const resolvedPath = await resolveWorkspacePath(args.path, { 
            contextName: '文本文件',
            checkExistence: true  // 🚀 启用存在性检查，触发智能回退
        });
        logger.info(`🔗 解析后的路径: ${resolvedPath}`);

        // 3. 读取文件内容（路径解析已确保文件存在）
        try {
            const fs = require('fs/promises');
            const stat = await fs.stat(resolvedPath);
            
            if (!stat.isFile()) {
                return { 
                    success: false, 
                    error: `Path is not a file: ${args.path}` 
                };
            }

            // 检查文件大小，避免读取过大的文件
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (stat.size > maxSize) {
                return { 
                    success: false, 
                    error: `File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB. Maximum supported size is 10MB.` 
                };
            }

            // 4. 读取文件内容
            const encoding = args.encoding || 'utf-8';
            const content = await fs.readFile(resolvedPath, encoding);
            
            // 5. 获取文件信息
            const fileExtension = path.extname(args.path).toLowerCase();
            const fileType = fileExtension || 'text';
            
            logger.info(`✅ 文本文件读取成功: ${args.path} (${content.length} 字符, ${(stat.size / 1024).toFixed(1)}KB)`);
            
            return {
                success: true,
                content,
                fileSize: stat.size,
                fileType: fileType.replace('.', '')
            };

        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code === 'EACCES') {
                return { 
                    success: false, 
                    error: `Permission denied: ${args.path}` 
                };
            }
            throw error;
        }

    } catch (error) {
        const errorMsg = `文本文件读取失败: ${(error as Error).message}`;
        logger.error(errorMsg, error as Error);
        return {
            success: false,
            error: errorMsg
        };
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
                description: "File path relative to project baseDir (or workspace root if no project is active). Do not include project name in path. Example: 'SRS.md' not 'projectName/SRS.md'"
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
        // CallerType.SPECIALIST_CONTENT,            // 内容专家可以创建文档
        CallerType.SPECIALIST_PROCESS,             // 流程专家可以创建配置文件
        CallerType.DOCUMENT,                       // 文档层的核心功能
        "prototype_designer"                       // 原型设计师可以创建原型文件
    ]
};

export async function writeFile(args: { path: string; content: string }): Promise<{ success: boolean; error?: string }> {
    try {
        let fileUri: vscode.Uri;
        
        // 🚀 智能路径检测（方案一）
        if (path.isAbsolute(args.path)) {
            // 绝对路径：直接使用
            fileUri = vscode.Uri.file(args.path);
            logger.info(`🔗 检测到绝对路径: ${args.path}`);
        } else {
            // 相对路径：使用公共路径解析工具
            const resolvedPath = await resolveWorkspacePath(args.path, {
                contextName: '文件'
            });
            fileUri = vscode.Uri.file(resolvedPath);
            logger.info(`🔗 相对路径解析: ${args.path} -> ${resolvedPath}`);
        }
        
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
            content: {
                type: "string",
                description: "Text to append to the file"
            },
            addNewline: {
                type: "boolean",
                description: "Whether to add a newline before the text",
                default: true
            }
        },
        required: ["path", "content"]
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
    content: string; 
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
            args.content;
        
        // 写入更新后的内容
        const contentBytes = new TextEncoder().encode(newContent);
        await vscode.workspace.fs.writeFile(fileUri, contentBytes);
        
        logger.info(`✅ Appended ${args.content.length} chars to: ${args.path}`);
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
                description: "Directory path. For project directories (isProjectDirectory=true): relative to workspace root. For regular directories: relative to project baseDir. Do not include project name for regular directories."
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
        // CallerType.SPECIALIST_CONTENT,            // 内容专家需要创建项目结构
        //CallerType.SPECIALIST_PROCESS,             // 流程专家需要创建项目结构
        CallerType.INTERNAL,                       // 内部工具（如createNewProjectFolder）
        "project_initializer"                      // 仅Project_initializer需要创建项目结构
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
        let dirUri: vscode.Uri;
        let resolvedDirPath: string;
        
        // 🚀 智能路径检测（方案一）
        if (path.isAbsolute(args.path)) {
            // 绝对路径：直接使用
            dirUri = vscode.Uri.file(args.path);
            resolvedDirPath = args.path;
            logger.info(`🔗 检测到绝对路径: ${args.path}`);
        } else {
            // 🚀 修复：项目目录创建时强制使用工作区根目录
            if (args.isProjectDirectory) {
                // 项目目录：强制使用工作区根目录，避免嵌套路径问题
                const workspaceFolder = getCurrentWorkspaceFolder();
                if (!workspaceFolder) {
                    throw new Error('未找到VSCode工作区，无法创建项目目录');
                }
                resolvedDirPath = path.resolve(workspaceFolder.uri.fsPath, args.path);
                logger.info(`🎯 项目目录路径解析（使用工作区根目录）: ${args.path} -> ${resolvedDirPath}`);
            } else {
                // 非项目目录：使用原有的智能路径解析逻辑
                resolvedDirPath = await resolveWorkspacePath(args.path, {
                    contextName: '目录'
                });
                logger.info(`🔗 相对路径解析: ${args.path} -> ${resolvedDirPath}`);
            }
            dirUri = vscode.Uri.file(resolvedDirPath);
        }
        
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
                    const baseDir = resolvedDirPath;  // 🚀 使用解析后的绝对路径
                    
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
 * 🚀 统一的目录列表工具：支持单层列表和递归搜索
 * 重构说明：合并了原 listFiles 和 listAllFiles 的功能
 */
export const listFilesToolDefinition = {
    name: "listFiles",
    description: "List files and directories in a specified directory with optional recursive search and filtering. Returns complete relative paths for easy use.",
    parameters: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Directory path relative to project baseDir (or workspace root if no project is active). Use '.' for project root. Do not include project name in path. Default: '.'",
                default: "."
            },
            recursive: {
                type: "boolean",
                description: "Whether to recursively list subdirectories (default: false)",
                default: false
            },
            maxDepth: {
                type: "number",
                description: "Maximum recursion depth when recursive=true (default: 10)",
                default: 10
            },
            maxItems: {
                type: "number",
                description: "Maximum number of items to return (default: 1000)",
                default: 1000
            },
            excludePatterns: {
                type: "array",
                items: { type: "string" },
                description: "Patterns to exclude (default: ['node_modules', 'coverage', 'dist', 'build'])",
                default: ["node_modules", "coverage", "dist", "build"]
            },
            searchKeywords: {
                type: "array",
                items: { type: "string" },
                description: "Keywords to search in file/directory names (case insensitive)"
            },
            dirsOnly: {
                type: "boolean",
                description: "Return only directories (default: false)",
                default: false
            },
            filesOnly: {
                type: "boolean",
                description: "Return only files (default: false)",
                default: false
            }
        }
    },
    // 🚀 访问控制：列出文件是安全查询操作
    accessibleBy: [
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // "项目里有什么文件？"现在归入知识问答模式
        CallerType.SPECIALIST_PROCESS,           // 流程专家探索项目结构
        CallerType.SPECIALIST_CONTENT,           // 内容专家需要了解文件结构
        CallerType.DOCUMENT                      // 文档层需要了解文件结构
    ]
};

/**
 * 🚀 统一的目录列表函数
 * 支持单层列表（默认）和递归列表（可选）
 * 始终返回完整的相对路径，方便 AI 直接使用
 */
export async function listFiles(args: { 
    path?: string;
    recursive?: boolean;
    maxDepth?: number;
    maxItems?: number;
    excludePatterns?: string[];
    searchKeywords?: string[];
    dirsOnly?: boolean;
    filesOnly?: boolean;
}): Promise<{ 
    success: boolean; 
    files?: Array<{ 
        name: string;           // 文件/目录名
        path: string;           // 完整相对路径（相对于工作区根目录）
        type: 'file' | 'directory' 
    }>; 
    totalCount?: number;        // 返回的项目总数
    truncated?: boolean;        // 是否因超过 maxItems 而被截断
    scannedDepth?: number;      // 实际扫描的最大深度（仅 recursive=true 时）
    error?: string 
}> {
    try {
        // 1. 参数初始化
        const {
            path: dirPath = ".",
            recursive = false,
            maxDepth = 10,
            maxItems = 1000,
            excludePatterns = ["node_modules", "coverage", "dist", "build"],
            searchKeywords,
            dirsOnly = false,
            filesOnly = false
        } = args;

        logger.info(`📂 listFiles: path="${dirPath}", recursive=${recursive}, maxDepth=${maxDepth}`);

        // 2. 路径解析
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        let dirUri: vscode.Uri;
        let normalizedBasePath: string; // 规范化的基础路径（用于构建完整路径）

        if (dirPath === '.') {
            // 特殊情况：工作区根目录
            dirUri = workspaceFolder.uri;
            normalizedBasePath = "";
            logger.info(`🔗 使用工作区根目录: ${workspaceFolder.uri.fsPath}`);
        } else if (path.isAbsolute(dirPath)) {
            // 绝对路径：直接使用
            dirUri = vscode.Uri.file(dirPath);
            // 计算相对于工作区根目录的相对路径
            normalizedBasePath = path.relative(workspaceFolder.uri.fsPath, dirPath);
            logger.info(`🔗 绝对路径: ${dirPath}, 相对路径: ${normalizedBasePath}`);
        } else {
            // 相对路径：使用公共路径解析工具
            const resolvedPath = await resolveWorkspacePath(dirPath, {
                contextName: '目录',
                checkExistence: true
            });
            dirUri = vscode.Uri.file(resolvedPath);
            normalizedBasePath = dirPath;
            logger.info(`🔗 相对路径解析: ${dirPath} -> ${resolvedPath}`);
        }

        // 3. 分支处理：非递归 vs 递归
        if (!recursive) {
            // 非递归模式：列出单层目录
            return await listSingleLevel(dirUri, normalizedBasePath, {
                maxItems,
                excludePatterns,
                searchKeywords,
                dirsOnly,
                filesOnly
            });
        } else {
            // 递归模式：遍历子目录
            return await listRecursively(workspaceFolder, normalizedBasePath, {
                maxDepth,
                maxItems,
                excludePatterns,
                searchKeywords,
                dirsOnly,
                filesOnly
            });
        }
    } catch (error) {
        const errorMsg = `Failed to list files: ${(error as Error).message}`;
        logger.error(errorMsg, error as Error);
        return { success: false, error: errorMsg };
    }
}

/**
 * 🔧 内部函数：列出单层目录内容
 */
async function listSingleLevel(
    dirUri: vscode.Uri,
    basePath: string,
    options: {
        maxItems: number;
        excludePatterns: string[];
        searchKeywords?: string[];
        dirsOnly: boolean;
        filesOnly: boolean;
    }
): Promise<{
    success: boolean;
    files?: Array<{ name: string; path: string; type: 'file' | 'directory' }>;
    totalCount?: number;
    truncated?: boolean;
    error?: string;
}> {
    try {
        const entries = await vscode.workspace.fs.readDirectory(dirUri);
        const results: Array<{ name: string; path: string; type: 'file' | 'directory' }> = [];

        for (const [name, type] of entries) {
            // 跳过隐藏文件
            if (name.startsWith('.')) {
                continue;
            }

            // 检查排除模式
            if (shouldExclude(name, options.excludePatterns)) {
                continue;
            }

            const isDirectory = type === vscode.FileType.Directory;
            const itemType: 'file' | 'directory' = isDirectory ? 'directory' : 'file';

            // 检查类型过滤
            if (!shouldIncludeByType(itemType, options.dirsOnly, options.filesOnly)) {
                continue;
            }

            // 检查关键词匹配
            if (!matchesSearchKeywords(name, options.searchKeywords)) {
                continue;
            }

            // 构建完整相对路径
            const fullPath = basePath ? `${basePath}/${name}` : name;

            results.push({
                name,
                path: fullPath,
                type: itemType
            });

            // 检查数量限制
            if (results.length >= options.maxItems) {
                break;
            }
        }

        logger.info(`✅ Listed ${results.length} items in single level: ${basePath || '.'}`);
        
        return {
            success: true,
            files: results.sort((a, b) => a.path.localeCompare(b.path)),
            totalCount: results.length,
            truncated: results.length >= options.maxItems
        };
    } catch (error) {
        throw error;
    }
}

/**
 * 🔧 内部函数：递归列出目录内容
 */
async function listRecursively(
    workspaceFolder: vscode.WorkspaceFolder,
    basePath: string,
    options: {
        maxDepth: number;
        maxItems: number;
        excludePatterns: string[];
        searchKeywords?: string[];
        dirsOnly: boolean;
        filesOnly: boolean;
    }
): Promise<{
    success: boolean;
    files?: Array<{ name: string; path: string; type: 'file' | 'directory' }>;
    totalCount?: number;
    truncated?: boolean;
    scannedDepth?: number;
    error?: string;
}> {
    const results: Array<{ name: string; path: string; type: 'file' | 'directory' }> = [];
    let totalCount = 0;
    let maxDepthReached = 0;

    async function traverseDirectory(relativePath: string, currentDepth: number): Promise<void> {
        if (currentDepth > options.maxDepth || totalCount >= options.maxItems) {
            return;
        }

        maxDepthReached = Math.max(maxDepthReached, currentDepth);

        try {
            const dirUri = relativePath === '' || relativePath === '.'
                ? workspaceFolder.uri
                : vscode.Uri.joinPath(workspaceFolder.uri, relativePath);

            const entries = await vscode.workspace.fs.readDirectory(dirUri);

            for (const [name, type] of entries) {
                const isDirectory = type === vscode.FileType.Directory;

                // 跳过隐藏文件
                if (name.startsWith('.')) {
                    continue;
                }

                // 检查排除模式
                if (shouldExclude(name, options.excludePatterns)) {
                    continue;
                }

                // 检查数量限制
                if (totalCount >= options.maxItems) {
                    break;
                }

                // 构建完整路径
                const fullPath = relativePath === '' || relativePath === '.' 
                    ? name 
                    : `${relativePath}/${name}`;

                const itemType: 'file' | 'directory' = isDirectory ? 'directory' : 'file';

                // 对于目录：总是递归进入（即使目录名不匹配关键词）
                if (isDirectory) {
                    // 如果目录名匹配且需要目录，则添加到结果
                    if (matchesSearchKeywords(name, options.searchKeywords) && 
                        shouldIncludeByType('directory', options.dirsOnly, options.filesOnly)) {
                        results.push({
                            name,
                            path: fullPath,
                            type: 'directory'
                        });
                        totalCount++;
                    }

                    // 递归进入子目录
                    await traverseDirectory(fullPath, currentDepth + 1);
                } else {
                    // 文件：只有匹配关键词且类型符合才添加
                    if (matchesSearchKeywords(name, options.searchKeywords) &&
                        shouldIncludeByType('file', options.dirsOnly, options.filesOnly)) {
                        results.push({
                            name,
                            path: fullPath,
                            type: 'file'
                        });
                        totalCount++;
                    }
                }
            }
        } catch (error) {
            // 忽略无法访问的目录，记录警告但继续处理
            logger.warn(`Failed to access directory: ${relativePath} - ${(error as Error).message}`);
        }
    }

    // 从指定的基础路径开始遍历
    await traverseDirectory(basePath, 0);

    const searchInfo = options.searchKeywords && options.searchKeywords.length > 0
        ? ` with keywords: [${options.searchKeywords.join(', ')}]`
        : '';

    logger.info(`✅ Listed ${results.length} items recursively from: ${basePath || '.'} (depth: ${maxDepthReached})${searchInfo}`);

    return {
        success: true,
        files: results.sort((a, b) => a.path.localeCompare(b.path)),
        totalCount: results.length,
        truncated: totalCount >= options.maxItems,
        scannedDepth: maxDepthReached
    };
}

/**
 * 🔧 辅助函数：检查是否应该排除
 */
function shouldExclude(name: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
        if (pattern.includes('*')) {
            // 简单的通配符匹配
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(name);
        }
        return name === pattern;
    });
}

/**
 * 🔧 辅助函数：检查是否匹配搜索关键词
 */
function matchesSearchKeywords(name: string, keywords?: string[]): boolean {
    if (!keywords || keywords.length === 0) {
        return true;
    }

    const targetName = name.toLowerCase();
    const searchTerms = keywords.map(k => k.toLowerCase());

    return searchTerms.some(keyword => {
        // 精确匹配
        if (targetName === keyword) {
            return true;
        }
        // 包含匹配
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

/**
 * 🔧 辅助函数：检查是否应该根据类型包含
 */
function shouldIncludeByType(
    type: 'file' | 'directory',
    dirsOnly: boolean,
    filesOnly: boolean
): boolean {
    if (dirsOnly && type !== 'directory') {
        return false;
    }
    if (filesOnly && type !== 'file') {
        return false;
    }
    return true;
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
export const moveAndRenameFileToolDefinition = {
    name: "moveAndRenameFile",
    description: "Move and/or rename a file/directory to a new location",
    parameters: {
        type: "object",
        properties: {
            sourcePath: {
                type: "string",
                description: "Current file path relative to workspace root"
            },
            targetPath: {
                type: "string",
                description: "New file path relative to workspace root"
            }
        },
        required: ["sourcePath", "targetPath"]
    },
    // 🚀 智能分类属性
    interactionType: 'confirmation',
    riskLevel: 'medium',
    requiresConfirmation: true,
    // 🚀 访问控制：重命名/移动是有风险的操作，orchestrator不应直接使用
    accessibleBy: [
        // CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
        // CallerType.SPECIALIST_CONTENT,            // 内容专家可能需要重构文件结构
        // CallerType.SPECIALIST_PROCESS,             // 流程专家可能需要重构文件结构
        CallerType.INTERNAL                       // 内部工具（如项目重构）
    ]
};

export async function moveAndRenameFile(args: { sourcePath: string; targetPath: string }): Promise<{ success: boolean; error?: string }> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const oldUri = vscode.Uri.joinPath(workspaceFolder.uri, args.sourcePath);
        const newUri = vscode.Uri.joinPath(workspaceFolder.uri, args.targetPath);
        
        await vscode.workspace.fs.rename(oldUri, newUri);
        
        logger.info(`✅ Renamed: ${args.sourcePath} → ${args.targetPath}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Failed to rename ${args.sourcePath} to ${args.targetPath}: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

/**
 * 复制文件并重命名到新位置
 */
export const copyAndRenameFileToolDefinition = {
    name: "copyAndRenameFile",
    description: "Copy a file/directory to a new location with optional renaming",
    parameters: {
        type: "object",
        properties: {
            sourcePath: {
                type: "string",
                description: "Source file path relative to workspace root"
            },
            targetPath: {
                type: "string",
                description: "Target file path relative to workspace root"
            },
            overwrite: {
                type: "boolean",
                description: "Whether to overwrite existing target file (default: false)",
                default: false
            }
        },
        required: ["sourcePath", "targetPath"]
    },
    // 🚀 智能分类属性 - 与moveAndRenameFile保持一致
    interactionType: 'confirmation',
    riskLevel: 'medium',
    requiresConfirmation: true,
    // 🚀 访问控制：与moveAndRenameFile保持完全一致
    accessibleBy: [
        // CallerType.SPECIALIST_CONTENT,            // 内容专家可能需要复制文件模板
        // CallerType.SPECIALIST_PROCESS,             // 流程专家可能需要复制文件模板
        "project_initializer",                      // 仅Project_initializer可能需要复制文件
        CallerType.INTERNAL                       // 内部工具（如项目模板复制）
    ]
};

export async function copyAndRenameFile(args: { 
    sourcePath: string; 
    targetPath: string; 
    overwrite?: boolean 
}): Promise<{ success: boolean; error?: string }> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder is open' };
        }

        const sourceUri = vscode.Uri.joinPath(workspaceFolder.uri, args.sourcePath);
        const targetUri = vscode.Uri.joinPath(workspaceFolder.uri, args.targetPath);
        
        // 检查源文件是否存在
        try {
            await vscode.workspace.fs.stat(sourceUri);
        } catch {
            return { success: false, error: `Source file does not exist: ${args.sourcePath}` };
        }
        
        // 检查目标文件是否存在（如果不允许覆盖）
        if (!args.overwrite) {
            try {
                await vscode.workspace.fs.stat(targetUri);
                return { success: false, error: `Target file already exists: ${args.targetPath}. Use overwrite=true to replace.` };
            } catch {
                // 目标文件不存在，这是期待的情况
            }
        }
        
        // 执行复制
        await vscode.workspace.fs.copy(sourceUri, targetUri, { overwrite: args.overwrite || false });
        
        logger.info(`✅ Copied: ${args.sourcePath} → ${args.targetPath}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Failed to copy ${args.sourcePath} to ${args.targetPath}: ${(error as Error).message}`;
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

// 🚀 getCurrentWorkspaceFolder 现在从公共工具导入

/**
 * 🚀 新增：检查目录是否存在
 * 用于支持自动重命名功能
 */
export async function checkDirectoryExists(path: string): Promise<boolean> {
    try {
        const workspaceFolder = getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return false;
        }

        const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, path);
        const stat = await vscode.workspace.fs.stat(dirUri);
        return stat.type === vscode.FileType.Directory;
    } catch (error) {
        // 如果stat失败，说明目录不存在
        return false;
    }
}

// ============================================================================
// 导出定义和实现
// ============================================================================

export const filesystemToolDefinitions = [
    readTextFileToolDefinition,
    writeFileToolDefinition,
    appendTextToFileToolDefinition,
    createDirectoryToolDefinition,
    listFilesToolDefinition,
    // listAllFilesToolDefinition, // 🚀 已废弃：功能已合并到 listFiles
    deleteFileToolDefinition,
    moveAndRenameFileToolDefinition,
    copyAndRenameFileToolDefinition
];

export const filesystemToolImplementations = {
    readTextFile,
    writeFile,
    appendTextToFile,
    createDirectory,
    listFiles,
    // listAllFiles, // 🚀 已废弃：功能已合并到 listFiles
    deleteFile,
    moveAndRenameFile,
    copyAndRenameFile,
    _internalReadFile,
    checkDirectoryExists
}; 