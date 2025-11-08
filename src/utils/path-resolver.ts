/**
 * 智能路径解析工具
 * 
 * 统一处理项目中的路径解析逻辑，避免代码重复
 * 优先使用 SessionContext 的 baseDir，回退到 VSCode 工作区根目录
 * 
 * 仅供以下5个工具使用：
 * - filesystem-tools.ts (readTextFile)
 * - yamlEditor/YAMLReader.ts & YAMLEditor.ts
 * - semantic-edit-engine.ts (executeMarkdownEdits)
 * - traceabilityCompletion/TraceabilityCompleter.ts
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from './logger';
import { BaseDirValidator } from './baseDir-validator';

const logger = Logger.getInstance();

/**
 * 路径解析选项
 */
export interface PathResolutionOptions {
    /** 错误类型：standard 抛出 Error，scaffold 抛出 ScaffoldError */
    errorType?: 'standard' | 'scaffold';
    /** 上下文名称，用于错误消息和日志 */
    contextName?: string;
    /** 是否检查文件存在性，如果为true且文件不存在则尝试回退 */
    checkExistence?: boolean;
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * 获取当前工作区文件夹
 * 
 * @returns 当前工作区文件夹，如果没有则返回 undefined
 */
export function getCurrentWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0];
}

/**
 * 智能路径解析
 * 
 * 解析策略：
 * 1. 如果是绝对路径，直接返回
 * 2. 优先使用 SessionContext 的 baseDir 进行解析
 * 3. 回退到 VSCode 工作区根目录
 * 
 * @param relativePath 相对路径
 * @param options 解析选项
 * @returns 解析后的绝对路径
 * @throws Error 或 ScaffoldError（根据 errorType）
 */
export async function resolveWorkspacePath(
    relativePath: string, 
    options: PathResolutionOptions = {}
): Promise<string> {
    const { errorType = 'standard', contextName = 'file', checkExistence = false } = options;
    
    // 1. 如果已经是绝对路径，直接返回
    if (path.isAbsolute(relativePath)) {
        logger.info(`🔗 路径解析（绝对路径）: ${relativePath}`);
        return relativePath;
    }

    try {
        // 2. 优先获取SessionContext的baseDir
        const { SessionManager } = await import('../core/session-manager');
        const sessionManager = SessionManager.getInstance();
        const currentSession = await sessionManager.getCurrentSession();

        if (currentSession?.baseDir) {
            // 🚀 Phase 1.1：验证 baseDir 的有效性
            let validatedBaseDir: string;
            try {
                validatedBaseDir = BaseDirValidator.validateBaseDir(
                    currentSession.baseDir,
                    { checkWithinWorkspace: true }
                );
                logger.info(`✅ BaseDir validation passed: ${validatedBaseDir}`);
            } catch (error) {
                // 验证失败，记录错误并回退到工作区根目录
                logger.error(`❌ Invalid baseDir in session: ${currentSession.baseDir}`, error as Error);
                logger.warn(`⚠️ BaseDir validation failed, falling back to workspace root`);
                throw error;  // 抛出异常，触发回退逻辑
            }

            const absolutePath = BaseDirValidator.validatePathWithinBaseDir(
                relativePath,
                validatedBaseDir
            );
            logger.info(`🔗 路径解析（使用项目baseDir）: ${relativePath} -> ${absolutePath}`);
            logger.info(`📂 项目baseDir: ${validatedBaseDir}`);

            // 🚀 新增：存在性检查（如果启用）
            if (checkExistence) {
                const exists = await fileExists(absolutePath);
                if (exists) {
                    logger.info(`✅ 文件存在性验证通过: ${absolutePath}`);
                    return absolutePath;
                } else {
                    logger.warn(`⚠️ 文件在项目baseDir中不存在，触发回退机制: ${absolutePath}`);
                    // 继续执行回退逻辑，不要直接返回
                }
            } else {
                // 不检查存在性，直接返回（保持原有行为）
                return absolutePath;
            }
        } else {
            logger.warn(`⚠️ SessionContext中没有baseDir，回退到工作区根目录`);
        }
    } catch (error) {
        logger.warn(`⚠️ 获取SessionContext失败或baseDir验证失败，回退到工作区根目录: ${(error as Error).message}`);
    }

    // 3. 回退策略：使用VSCode工作区根目录
    const workspaceFolder = getCurrentWorkspaceFolder();
    if (!workspaceFolder) {
        const errorMsg = `未找到VSCode工作区，无法解析${contextName}路径`;
        
        if (errorType === 'scaffold') {
            // 动态导入ScaffoldError以避免循环依赖
            try {
                const { ScaffoldError, ScaffoldErrorType } = await import('../tools/document/scaffoldGenerator/types');
                throw new ScaffoldError(ScaffoldErrorType.SCHEMA_LOAD_FAILED, errorMsg);
            } catch (importError) {
                // 如果无法导入ScaffoldError，回退到标准Error
                logger.warn(`⚠️ 无法导入ScaffoldError，使用标准Error: ${(importError as Error).message}`);
                throw new Error(errorMsg);
            }
        } else {
            throw new Error(errorMsg);
        }
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
    const fallbackPath = path.resolve(workspaceRoot, relativePath);

    // 🚀 新增：回退路径的存在性检查
    if (checkExistence) {
        const exists = await fileExists(fallbackPath);
        if (exists) {
            logger.info(`🔗 路径解析（回退到工作区根目录，文件存在）: ${relativePath} -> ${fallbackPath}`);
            return fallbackPath;
        } else {
            // 两个位置都不存在文件，抛出错误
            const errorMsg = `${contextName}在所有位置都不存在: ${relativePath}`;
            if (errorType === 'scaffold') {
                try {
                    const { ScaffoldError, ScaffoldErrorType } = await import('../tools/document/scaffoldGenerator/types');
                    throw new ScaffoldError(ScaffoldErrorType.FILE_NOT_FOUND, errorMsg);
                } catch (importError) {
                    throw new Error(errorMsg);
                }
            } else {
                throw new Error(errorMsg);
            }
        }
    } else {
        // 不检查存在性，直接返回回退路径
        logger.info(`🔗 路径解析（回退到工作区根目录）: ${relativePath} -> ${fallbackPath}`);
        return fallbackPath;
    }
}

/**
 * VSCode工作区专用路径解析（不使用SessionContext）
 * 
 * 专门用于直接基于VSCode工作区的工具，如 writeFile
 * 注意：此函数不在本次重构范围内，仅供未来扩展使用
 * 
 * @param relativePath 相对路径
 * @returns VSCode URI
 * @throws Error 如果没有工作区
 */
export function resolveWorkspaceOnlyPath(relativePath: string): vscode.Uri {
    const workspaceFolder = getCurrentWorkspaceFolder();
    if (!workspaceFolder) {
        throw new Error('No workspace folder is open');
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
}
