/**
 * 创建新项目文件夹工具 - 智能项目创建与状态管理
 * 
 * 架构定位：
 * - 内部控制层：处理项目级别的状态转换
 * - AI意图检测响应：当AI检测到新项目创建意图时调用
 * - 状态清理：确保新项目开始时有干净的上下文
 */

import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';
import { OperationType } from '../../types/session';
import * as path from 'path';
import * as vscode from 'vscode';

const logger = Logger.getInstance();

/**
 * 创建新项目结果
 */
export interface CreateNewProjectResult {
    success: boolean;
    projectName: string | null;
    archivedProject?: string;
    message: string;
    error?: string;
    preservedFiles?: number;
    directoryName?: string;        // 🚀 新增：实际创建的目录名称
    directoryRenamed?: boolean;    // 🚀 新增：目录是否被自动重命名
    gitBranch?: {                  // 🚀 新增：Git分支操作结果
        created: boolean;
        name?: string;
        switched: boolean;
        autoCommitCreated?: boolean;
        autoCommitHash?: string;
        error?: string;
    };
}

/**
 * 创建新项目文件夹工具定义
 */
export const createNewProjectFolderToolDefinition = {
    name: 'createNewProjectFolder',
    description: `Archive current project and create a new project with clean state. Use when user wants to create a completely new project that differs from the current one.
    
Key capabilities:
- Safely archives current project (preserves all user files)
- Creates new project session with clean state
- Clears operation history and context pollution
- Provides transparent feedback to user

When to use:
- User expresses intent to create a new/different project
- Detected project name differs significantly from current project
- User wants to start fresh while preserving previous work`,
    parameters: {
        type: 'object',
        properties: {
            projectName: {
                type: 'string',
                description: 'Name for the new project (optional - will be auto-generated if not provided)'
            },
            summary: {
                type: 'string', 
                description: 'Summary for creating new project (for logging and user feedback)'
            },
            confirmWithUser: {
                type: 'boolean',
                description: 'Whether to ask user for confirmation before proceeding (default: true)',
                default: true
            }
        },
        required: ['summary']
    },
    // 🚀 访问控制：只有specialist可以创建新项目
    accessibleBy: [
        // CallerType.SPECIALIST_CONTENT,          // 内容specialist可以调用
        // CallerType.SPECIALIST_PROCESS,            // 流程specialist（特别是project_initializer）可以调用
        "project_initializer"
    ]
};

/**
 * 创建新项目文件夹工具实现
 */
export async function createNewProjectFolder(args: {
    projectName?: string;
    summary: string;
    confirmWithUser?: boolean;
}): Promise<CreateNewProjectResult> {
    try {
        logger.info(`🚀 [createNewProjectFolder] Starting new project creation: ${args.projectName || 'auto-generated'}`);
        logger.info(`🚀 [createNewProjectFolder] Summary: ${args.summary}`);

        // 动态导入 SessionManager 以避免循环依赖
        const { SessionManager } = await import('../../core/session-manager');
        const sessionManager = SessionManager.getInstance();

        // 1. 获取当前会话信息
        const currentSession = await sessionManager.getCurrentSession();
        const currentProjectName = currentSession?.projectName;

        // 2. 如果需要用户确认，返回确认请求（这里简化处理，实际应该通过chat interaction）
        if (args.confirmWithUser !== false && currentProjectName) {
            logger.info(`🤔 [createNewProjectFolder] Current project "${currentProjectName}" will be archived`);
        }

        // 🚀 3. 先确定最终的项目目录名称（包含自动重命名逻辑）
        let finalProjectName = args.projectName || 'unnamed';
        let directoryRenamed = false;
        
        if (finalProjectName && finalProjectName !== 'unnamed') {
            try {
                // 动态导入 atomic 层的工具
                const { checkDirectoryExists } = await import('../atomic/filesystem-tools');
                
                // 🚀 实现自动重命名逻辑 - 在创建会话之前！
                let counter = 1;
                const originalName = finalProjectName;
                while (await checkDirectoryExists(finalProjectName)) {
                    finalProjectName = `${originalName}_${counter}`;
                    counter++;
                    logger.info(`📁 [createNewProjectFolder] Directory "${originalName}" exists, trying "${finalProjectName}"`);
                }
                
                // 记录是否发生了重命名
                if (finalProjectName !== originalName) {
                    directoryRenamed = true;
                    logger.info(`📁 [createNewProjectFolder] Auto-renamed directory: "${originalName}" → "${finalProjectName}"`);
                }
            } catch (error) {
                logger.warn(`📁 [createNewProjectFolder] Failed to check directory existence, using original name: ${finalProjectName}. Error: ${(error as Error).message}`);
            }
        }

        // 🚀 4. 使用最终确定的项目名称创建新会话
        const result = await sessionManager.startNewSession(
            finalProjectName !== 'unnamed' ? finalProjectName : undefined
        );

        if (result.success) {
            const newProjectName = result.newSession?.projectName || 'unnamed';
            const archivedProject = currentProjectName;

            // 🚀 5. 创建实际的项目目录（现在名称已经一致了）
            let directoryCreated = false;
            
            if (newProjectName && newProjectName !== 'unnamed') {
                try {
                    // 动态导入 atomic 层的工具
                    const { createDirectory } = await import('../atomic/filesystem-tools');
                    
                    // 调用 createDirectory 创建实际目录（名称现在已经一致）
                    const dirResult = await createDirectory({
                        path: newProjectName,  // 现在使用会话中的项目名称，应该与最终目录名一致
                        isProjectDirectory: true
                    });
                    
                    if (dirResult.success) {
                        directoryCreated = true;
                        logger.info(`📁 [createNewProjectFolder] Successfully created project directory: ${newProjectName}`);
                    } else {
                        logger.warn(`⚠️ [createNewProjectFolder] Failed to create directory: ${dirResult.error}`);
                    }
                } catch (dirError) {
                    logger.warn(`⚠️ [createNewProjectFolder] Exception creating directory: ${(dirError as Error).message}`);
                }
            }

            // 🚀 重构：防御性检查，确保在wip分支上创建项目
            let wipBranchResult: any = null;
            
            if (directoryCreated) {
                try {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (workspaceFolder) {
                        const gitRepoDir = workspaceFolder.uri.fsPath;
                        
                        wipBranchResult = await ensureOnWipBranch(gitRepoDir);
                        
                        if (wipBranchResult.success) {
                            logger.info(`✅ [createNewProjectFolder] ${wipBranchResult.message}`);
                            
                            // 🚀 修复：更新会话中的gitBranch字段
                            await sessionManager.updateSession({
                                gitBranch: 'wip'
                            });
                            
                            // 记录wip分支切换操作到会话日志
                            if (wipBranchResult.branchSwitched) {
                                await sessionManager.updateSessionWithLog({
                                    logEntry: {
                                        type: OperationType.GIT_BRANCH_SWITCHED,
                                        operation: `Switched from ${wipBranchResult.fromBranch} to ${wipBranchResult.toBranch} for project creation: ${newProjectName}`,
                                        success: true,
                                        sessionData: result.newSession,
                                        gitOperation: {
                                            fromBranch: wipBranchResult.fromBranch!,
                                            toBranch: wipBranchResult.toBranch!,
                                            autoCommitCreated: wipBranchResult.autoCommitCreated,
                                            autoCommitHash: wipBranchResult.autoCommitHash,
                                            reason: 'project_creation',
                                            branchCreated: wipBranchResult.branchCreated
                                        }
                                    }
                                });
                            }
                        } else {
                            logger.warn(`⚠️ [createNewProjectFolder] WIP branch check failed: ${wipBranchResult.error}`);
                            // 不阻止项目创建，但记录警告
                        }
                    }
                } catch (wipError) {
                    logger.warn(`⚠️ [createNewProjectFolder] Exception during WIP branch operations: ${(wipError as Error).message}`);
                }
            }

            // 🚀 生成用户友好的反馈消息，包含目录重命名和 Git 分支信息
            const directoryInfo = directoryCreated 
                ? (directoryRenamed 
                    ? ` 及项目目录 "${newProjectName}" (自动重命名避免冲突)` 
                    : ` 及项目目录 "${newProjectName}"`)
                : '';
            
            // WIP 分支信息
            const branchInfo = wipBranchResult?.success 
                ? (wipBranchResult.branchSwitched 
                    ? ` 并切换到wip工作分支${wipBranchResult.autoCommitCreated ? ' (已自动提交当前分支更改)' : ''}` 
                    : ` 在wip工作分支上`)
                : (wipBranchResult 
                    ? ` (WIP分支操作失败: ${wipBranchResult.error})` 
                    : '');
                
            const message = currentProjectName 
                ? `✅ 成功创建新项目 "${newProjectName}"${directoryInfo}${branchInfo}！原项目 "${currentProjectName}" 会话已清理。`
                : `✅ 成功创建新项目 "${newProjectName}"${directoryInfo}${branchInfo}！`;

            logger.info(`✅ [createNewProjectFolder] Success: ${message}`);

            return {
                success: true,
                projectName: newProjectName,
                archivedProject: currentProjectName || undefined,
                message,
                preservedFiles: 0,  // 🚀 阶段4简化：不再统计保护文件
                directoryName: directoryCreated ? newProjectName : undefined,
                directoryRenamed: directoryRenamed,
                gitBranch: wipBranchResult ? {
                    created: false, // wip分支可能已存在
                    name: 'wip',
                    switched: wipBranchResult.branchSwitched || false,
                    autoCommitCreated: wipBranchResult.autoCommitCreated || false,
                    autoCommitHash: wipBranchResult.autoCommitHash,
                    error: wipBranchResult.success ? undefined : wipBranchResult.error
                } : undefined
            };
        } else {
            const errorMessage = result.error || '未知错误';
            logger.error(`❌ [createNewProjectFolder] Failed: ${errorMessage}`);

            return {
                success: false,
                projectName: null,
                message: `❌ 创建新项目失败: ${errorMessage}`,
                error: errorMessage
            };
        }

    } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error(`❌ [createNewProjectFolder] Exception: ${errorMessage}`, error as Error);

        return {
            success: false,
            projectName: null,
            message: `❌ 创建新项目时发生错误: ${errorMessage}`,
            error: errorMessage
        };
    }
}

/**
 * 🚀 防御性检查：确保在wip分支上创建项目
 * 如果不在wip分支，自动提交当前更改并切换到wip分支
 */
async function ensureOnWipBranch(workspaceRoot: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
    branchSwitched?: boolean;
    autoCommitCreated?: boolean;
    autoCommitHash?: string;
    fromBranch?: string;
    toBranch?: string;
    branchCreated?: boolean;
}> {
    try {
        logger.info(`🔍 [ensureOnWipBranch] Checking current branch in: ${workspaceRoot}`);
        
        const { getCurrentBranch } = await import('../atomic/git-operations');
        const currentBranch = await getCurrentBranch(workspaceRoot);
        
        if (currentBranch === 'wip') {
            logger.info(`✅ [ensureOnWipBranch] Already on wip branch`);
            return {
                success: true,
                message: 'Already on wip branch',
                branchSwitched: false,
                fromBranch: currentBranch || 'unknown',
                toBranch: 'wip'
            };
        }
        
        logger.info(`🔄 [ensureOnWipBranch] Current branch: ${currentBranch}, need to switch to wip`);
        
        // 1. 检查并自动提交当前更改
        const { checkWorkspaceGitStatus, commitAllChanges } = await import('../atomic/git-operations');
        const gitStatus = await checkWorkspaceGitStatus();
        
        let autoCommitHash: string | undefined;
        
        if (gitStatus.hasChanges) {
            logger.info(`💾 [ensureOnWipBranch] Auto-committing changes in ${currentBranch} before switching to wip`);
            
            const commitResult = await commitAllChanges(workspaceRoot);
            if (!commitResult.success) {
                return {
                    success: false,
                    message: `Failed to commit changes in ${currentBranch}`,
                    error: commitResult.error
                };
            }
            
            autoCommitHash = commitResult.commitHash;
            logger.info(`✅ [ensureOnWipBranch] Auto-committed changes: ${autoCommitHash || 'no hash'}`);
        }
        
        // 2. 切换到wip分支（如果不存在则创建）
        const { checkBranchExists } = await import('../atomic/git-operations');
        const wipExists = await checkBranchExists(workspaceRoot, 'wip');
        
        const { execSync } = await import('child_process');
        
        let branchCreated = false;
        if (wipExists) {
            execSync('git checkout wip', { cwd: workspaceRoot });
            logger.info(`🔄 [ensureOnWipBranch] Switched to existing wip branch`);
        } else {
            execSync('git checkout -b wip', { cwd: workspaceRoot });
            logger.info(`🆕 [ensureOnWipBranch] Created and switched to new wip branch`);
            branchCreated = true;
        }
        
        return {
            success: true,
            message: `Successfully switched to wip branch from ${currentBranch}`,
            branchSwitched: true,
            autoCommitCreated: !!autoCommitHash,
            autoCommitHash,
            fromBranch: currentBranch || 'unknown',
            toBranch: 'wip',
            branchCreated
        };
        
    } catch (error) {
        const errorMessage = `Failed to ensure wip branch: ${(error as Error).message}`;
        logger.error(`❌ [ensureOnWipBranch] ${errorMessage}`);
        return {
            success: false,
            message: errorMessage,
            error: (error as Error).message
        };
    }
}

/**
 * 辅助函数：更新会话中的 Git 分支信息
 */
async function updateSessionGitBranch(sessionManager: any, sessionContextId: string, branchName: string) {
    try {
        await sessionManager.updateSession({
            gitBranch: branchName
        });
        logger.info(`🌿 [createNewProjectFolder] Updated session Git branch: ${branchName}`);
    } catch (error) {
        logger.warn(`Failed to update session Git branch: ${(error as Error).message}`);
    }
}

/**
 * 辅助函数：记录 Git 操作到会话日志
 */
async function logGitOperation(branchResult: any, sessionContextId?: string, sessionManager?: any) {
    if (!sessionContextId || !sessionManager) return;
    
    try {
        // 记录分支创建/切换操作
        if (branchResult.wasCreated) {
            await sessionManager.logOperation({
                type: OperationType.GIT_BRANCH_CREATED,
                operation: `Created Git branch: ${branchResult.branchName}`,
                success: true,
                sessionContextId,
                toolName: 'createNewProjectFolder'
            });
        }
        
        if (branchResult.wasSwitched) {
            await sessionManager.logOperation({
                type: OperationType.GIT_BRANCH_SWITCHED,
                operation: `Switched to Git branch: ${branchResult.branchName}`,
                success: true,
                sessionContextId,
                toolName: 'createNewProjectFolder'
            });
        }
        
        // 记录自动提交（如果有）
        if (branchResult.commitCreated && branchResult.commitHash) {
            await sessionManager.logOperation({
                type: OperationType.GIT_COMMIT_CREATED,
                operation: `Auto-commit before branch creation: ${branchResult.commitHash}`,
                success: true,
                sessionContextId,
                toolName: 'createNewProjectFolder'
            });
        }
        
    } catch (logError) {
        logger.warn(`Failed to log Git operations: ${(logError as Error).message}`);
    }
}

/**
 * 工具导出 - 符合注册表格式
 */
export const createNewProjectFolderToolDefinitions = [createNewProjectFolderToolDefinition];

export const createNewProjectFolderToolImplementations = {
    createNewProjectFolder: createNewProjectFolder
};

/**
 * 工具类别信息
 */
export const createNewProjectFolderToolCategory = {
    name: 'Project Management Tools',
    description: 'Tools for intelligent project creation and state management',
    tools: ['createNewProjectFolder'],
    layer: 'internal'
}; 