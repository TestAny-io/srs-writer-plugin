/**
 * Git 分支管理工具
 * 
 * 这个文件包含了项目切换时的 Git 分支管理功能
 * 包括从会话中读取分支信息、智能分支切换等功能
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

/**
 * 从 SessionContext 获取项目的 Git 分支信息
 */
async function getProjectGitBranchFromSession(projectName: string): Promise<string | null> {
    try {
        const { SessionManager } = await import('../../core/session-manager');
        const sessionManager = SessionManager.getInstance();
        
        // 获取当前会话信息
        const currentSession = await sessionManager.getCurrentSession();
        
        // 如果是当前项目，直接从当前会话获取
        if (currentSession?.projectName === projectName) {
            return currentSession.gitBranch || null;
        }
        
        // TODO: 如果不是当前项目，需要从归档的会话数据中查找
        // 这需要 SessionManager 提供查询历史会话的方法
        
        // 暂时返回 null，表示需要使用默认分支名称
        return null;
        
    } catch (error) {
        logger.warn(`Failed to get Git branch from session for project ${projectName}: ${(error as Error).message}`);
        return null;
    }
}

/**
 * 智能 Git 分支切换：优先使用会话中存储的分支信息
 */
async function switchToProjectGitBranchFromSession(
    projectDir: string, 
    projectName: string
): Promise<{
    success: boolean;
    message: string;
    branchName?: string;
    operation: 'switched' | 'created' | 'no-change' | 'failed';
    error?: string;
}> {
    try {
        const { checkGitRepository, getCurrentBranch, checkBranchExists } = 
            await import('../atomic/git-operations');
        
        // 1. 检查是否为Git仓库
        if (!await checkGitRepository(projectDir)) {
            return {
                success: false,
                message: 'Not a Git repository',
                operation: 'failed',
                error: 'NOT_GIT_REPO'
            };
        }
        
        // 2. 获取当前分支
        const currentBranch = await getCurrentBranch(projectDir);
        
        // 3. 🚀 优先从会话中获取分支信息
        let targetBranch = await getProjectGitBranchFromSession(projectName);
        
        // 4. 如果会话中没有分支信息，使用默认命名规则
        if (!targetBranch) {
            targetBranch = `SRS/${projectName}`;
            logger.info(`🌿 [switchProject] No Git branch in session, using default: ${targetBranch}`);
        } else {
            logger.info(`🌿 [switchProject] Found Git branch in session: ${targetBranch}`);
        }
        
        // 5. 如果已经在正确的分支上
        if (currentBranch === targetBranch) {
            return {
                success: true,
                message: `Already on correct branch: ${targetBranch}`,
                branchName: targetBranch,
                operation: 'no-change'
            };
        }
        
        // 6. 检查目标分支是否存在
        const branchExists = await checkBranchExists(projectDir, targetBranch);
        
        if (branchExists) {
            // 分支存在，直接切换
            const { execSync } = await import('child_process');
            execSync(`git checkout "${targetBranch}"`, { cwd: projectDir });
            
            return {
                success: true,
                message: `Switched to existing branch: ${targetBranch}`,
                branchName: targetBranch,
                operation: 'switched'
            };
        } else {
            // 分支不存在，创建新分支
            const { createProjectBranch } = await import('../atomic/git-operations');
            const result = await createProjectBranch(projectDir, projectName);
            
            return {
                success: result.success,
                message: result.message,
                branchName: result.branchName,
                operation: result.success ? 'created' : 'failed',
                error: result.error
            };
        }
        
    } catch (error) {
        return {
            success: false,
            message: `Git operation failed: ${(error as Error).message}`,
            operation: 'failed',
            error: (error as Error).message
        };
    }
}

/**
 * 更新会话中的 Git 分支信息（用于 switchProject）
 */
async function updateSessionGitBranchForSwitch(branchName: string) {
    try {
        const { SessionManager } = await import('../../core/session-manager');
        const sessionManager = SessionManager.getInstance();
        
        await sessionManager.updateSession({
            gitBranch: branchName
        });
        
        logger.info(`🌿 [switchProject] Updated session Git branch: ${branchName}`);
    } catch (error) {
        logger.warn(`Failed to update session Git branch during switch: ${(error as Error).message}`);
    }
}

/**
 * 记录项目切换时的 Git 操作到会话日志
 */
async function logGitOperationForSwitch(branchResult: any, sessionContextId?: string) {
    if (!sessionContextId) return;
    
    try {
        const { SessionManager } = await import('../../core/session-manager');
        const { OperationType } = await import('../../types/session');
        const sessionManager = SessionManager.getInstance();
        
        // 记录分支创建/切换操作
        if (branchResult.operation === 'created') {
            await sessionManager.updateSessionWithLog({
                logEntry: {
                    type: OperationType.GIT_BRANCH_CREATED,
                    operation: `Created Git branch during project switch: ${branchResult.branchName}`,
                    success: true,
                    toolName: 'switchProject'
                }
            });
        }
        
        if (branchResult.operation === 'switched') {
            await sessionManager.updateSessionWithLog({
                logEntry: {
                    type: OperationType.GIT_BRANCH_SWITCHED,
                    operation: `Switched to Git branch during project switch: ${branchResult.branchName}`,
                    success: true,
                    toolName: 'switchProject'
                }
            });
        }
        
    } catch (logError) {
        logger.warn(`Failed to log Git operations for project switch: ${(logError as Error).message}`);
    }
}

/**
 * 要插入到 switchProject 函数中的 Git 分支切换代码
 * 
 * 这段代码应该插入到第895行之前（阶段3：清理项目上下文之前）
 */
export const gitBranchSwitchCode = `
// 阶段2.5：🌿 切换到项目对应的Git分支
let gitBranchResult: any = null;
progress.report({ 
    increment: 0, 
    message: '🌿 正在检查Git分支状态...' 
});

try {
    // 获取目标项目的目录路径
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        const projectDir = path.join(workspaceFolder.uri.fsPath, targetProjectName);
        
        // 🚀 使用智能分支切换（优先从会话读取分支信息）
        const { switchToProjectGitBranchFromSession, updateSessionGitBranchForSwitch, logGitOperationForSwitch } = 
            await import('./tools/internal/git-branch-management');
        gitBranchResult = await switchToProjectGitBranchFromSession(projectDir, targetProjectName);
        
        if (gitBranchResult.success) {
            logger.info(\`🌿 [switchProject] \${gitBranchResult.message}\`);
            
            // 根据操作类型显示不同的进度消息
            const progressMessage = {
                'switched': \`✅ 已切换到分支 "\${gitBranchResult.branchName}"\`,
                'created': \`✅ 已创建并切换到分支 "\${gitBranchResult.branchName}"\`,
                'no-change': \`✅ 已在正确分支 "\${gitBranchResult.branchName}"\`
            }[gitBranchResult.operation] || '✅ Git分支操作完成';
            
            progress.report({ 
                increment: 10, 
                message: progressMessage
            });
            
            // 🚀 更新当前会话的 Git 分支信息
            if (gitBranchResult.branchName) {
                await updateSessionGitBranchForSwitch(gitBranchResult.branchName);
            }
            
            // 记录到会话日志
            await logGitOperationForSwitch(gitBranchResult, sessionResult.newSession?.sessionContextId);
            
        } else {
            logger.warn(\`⚠️ [switchProject] Git branch operation failed: \${gitBranchResult.error}\`);
            progress.report({ 
                increment: 10, 
                message: \`⚠️ Git分支操作失败: \${gitBranchResult.error}\` 
            });
        }
    } else {
        progress.report({ 
            increment: 10, 
            message: '⚠️ 无工作区，跳过Git分支操作' 
        });
    }
} catch (gitError) {
    logger.warn(\`⚠️ [switchProject] Exception during Git branch operation: \${(gitError as Error).message}\`);
    progress.report({ 
        increment: 10, 
        message: \`⚠️ Git分支操作异常: \${(gitError as Error).message}\` 
    });
}
`;

/**
 * 要插入到成功反馈消息中的 Git 分支信息代码
 */
export const gitBranchSuccessMessageCode = `
// 🚀 新增：Git分支信息
const branchInfo = gitBranchResult?.success 
    ? (gitBranchResult.operation === 'created'
        ? \`\\n🌿 已创建并切换到分支: \${gitBranchResult.branchName}\`
        : gitBranchResult.operation === 'switched'
        ? \`\\n🌿 已切换到分支: \${gitBranchResult.branchName}\`
        : gitBranchResult.operation === 'no-change'
        ? \`\\n🌿 已在正确分支: \${gitBranchResult.branchName}\`
        : '')
    : (gitBranchResult 
        ? \`\\n⚠️ Git分支操作失败: \${gitBranchResult.error}\` 
        : '');

const successMessage = \`✅ 项目切换完成！

📁 当前项目: \${targetProjectName}\${archiveInfo}\${branchInfo}
📄 保留 \${preservedCount} 个活动文件

🚀 准备开始新的工作！\`;
`;

// 导出所有需要的函数
export {
    getProjectGitBranchFromSession,
    switchToProjectGitBranchFromSession,
    updateSessionGitBranchForSwitch,
    logGitOperationForSwitch
};
