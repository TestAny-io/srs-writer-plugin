/**
 * Folders视图增强器
 * 在现有的Folders视图中添加Git分支切换功能
 */

import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

/**
 * Folders视图增强器
 * 提供Git分支选择和切换功能，直接影响Folders视图显示的内容
 */
export class FoldersViewEnhancer {
    private currentViewBranch: string | undefined;

    /**
     * 为Folders视图选择Git分支
     * 用户选择分支后，实际切换Git工作区到该分支
     */
    async selectBranchForFolders(): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showWarningMessage('No workspace folder available');
                return;
            }

            // 检查是否为Git仓库
            const { checkGitRepository } = await import('../tools/atomic/git-operations');
            if (!await checkGitRepository(workspaceFolder.uri.fsPath)) {
                vscode.window.showInformationMessage('Current workspace is not a Git repository');
                return;
            }

            // 获取所有Git分支
            const branches = await this.getAllGitBranches(workspaceFolder.uri.fsPath);
            if (branches.length === 0) {
                vscode.window.showInformationMessage('No Git branches found');
                return;
            }

            // 获取当前分支
            const { getCurrentBranch } = await import('../tools/atomic/git-operations');
            const currentBranch = await getCurrentBranch(workspaceFolder.uri.fsPath);

            // 构建QuickPick选项
            const quickPickItems = branches.map(branch => ({
                label: `🌿 ${branch}`,
                description: branch === currentBranch ? '(current)' : '',
                detail: branch === currentBranch 
                    ? 'Currently checked out - Folders view is showing this branch' 
                    : 'Click to switch Folders view to this branch',
                branchName: branch,
                isCurrent: branch === currentBranch
            }));

            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Select Git branch to display in Folders view',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!selected) {
                return;
            }

            // 如果选择的是当前分支，无需切换
            if (selected.isCurrent) {
                vscode.window.showInformationMessage(
                    `📂 Folders view is already showing branch: ${selected.branchName}`
                );
                return;
            }

            // 检查是否有未提交的更改
            const hasChanges = await this.checkForUncommittedChanges(workspaceFolder.uri.fsPath);
            
            if (hasChanges) {
                const action = await vscode.window.showWarningMessage(
                    `⚠️ You have uncommitted changes in the current branch.\n\nSwitching branches will affect your working directory.`,
                    { modal: true },
                    'Commit and Switch',
                    'Discard and Switch', 
                    'Cancel'
                );

                if (action === 'Cancel' || !action) {
                    return;
                }

                if (action === 'Commit and Switch') {
                    const success = await this.commitCurrentChanges(workspaceFolder.uri.fsPath);
                    if (!success) {
                        return; // 提交失败，取消切换
                    }
                } else if (action === 'Discard and Switch') {
                    const success = await this.discardCurrentChanges(workspaceFolder.uri.fsPath);
                    if (!success) {
                        return; // 丢弃失败，取消切换
                    }
                }
            }

            // 执行分支切换
            await this.switchToGitBranch(workspaceFolder.uri.fsPath, selected.branchName);
            
            // 🚀 集成会话管理：切换分支后同步项目会话
            await this.syncProjectSessionAfterBranchSwitch(selected.branchName);

        } catch (error) {
            logger.error('Failed to select branch for Folders view', error as Error);
            vscode.window.showErrorMessage(`Failed to switch branch: ${(error as Error).message}`);
        }
    }

    /**
     * 获取所有Git分支
     */
    private async getAllGitBranches(workspaceRoot: string): Promise<string[]> {
        try {
            const branchesOutput = execSync('git branch -a', {
                cwd: workspaceRoot,
                encoding: 'utf8'
            });

            return branchesOutput
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('remotes/origin/HEAD'))
                .map(line => line.replace(/^\*\s*/, '').replace(/^remotes\/origin\//, ''))
                .filter((branch, index, self) => self.indexOf(branch) === index) // 去重
                .sort();

        } catch (error) {
            logger.warn(`Failed to get Git branches: ${(error as Error).message}`);
            return [];
        }
    }

    /**
     * 检查未提交的更改
     */
    private async checkForUncommittedChanges(workspaceRoot: string): Promise<boolean> {
        try {
            const { checkWorkspaceGitStatus } = await import('../tools/atomic/git-operations');
            const gitStatus = await checkWorkspaceGitStatus();
            return gitStatus.hasChanges;
        } catch (error) {
            logger.warn(`Failed to check Git status: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * 提交当前更改
     */
    private async commitCurrentChanges(workspaceRoot: string): Promise<boolean> {
        try {
            const { commitAllChanges } = await import('../tools/atomic/git-operations');
            const result = await commitAllChanges(workspaceRoot);
            
            if (result.success) {
                vscode.window.showInformationMessage(
                    `✅ Changes committed${result.commitHash ? `: ${result.commitHash.substring(0, 7)}` : ''}`
                );
                return true;
            } else {
                vscode.window.showErrorMessage(`Failed to commit changes: ${result.error}`);
                return false;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Commit failed: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * 丢弃当前更改
     */
    private async discardCurrentChanges(workspaceRoot: string): Promise<boolean> {
        try {
            const { discardAllChanges } = await import('../tools/atomic/git-operations');
            const result = await discardAllChanges(workspaceRoot);
            
            if (result.success) {
                vscode.window.showInformationMessage('✅ All changes discarded');
                return true;
            } else {
                vscode.window.showErrorMessage(`Failed to discard changes: ${result.error}`);
                return false;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Discard failed: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * 切换到指定Git分支
     */
    private async switchToGitBranch(workspaceRoot: string, branchName: string): Promise<void> {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Switching Folders view to branch: ${branchName}`,
                cancellable: false
            }, async (progress) => {
                
                progress.report({ increment: 50, message: 'Switching Git branch...' });
                
                // 执行Git分支切换
                execSync(`git checkout "${branchName}"`, { cwd: workspaceRoot });
                
                progress.report({ increment: 100, message: 'Branch switched successfully!' });
                
                // 显示成功消息
                vscode.window.showInformationMessage(
                    `📂 Folders view switched to branch: ${branchName}\n\n✅ Files now show content from this branch`
                );
                
                logger.info(`Folders view switched to Git branch: ${branchName}`);
            });

        } catch (error) {
            throw new Error(`Git checkout failed: ${(error as Error).message}`);
        }
    }

    /**
     * 🚀 同步项目会话（分支切换后）
     * 如果切换到SRS/项目分支，自动加载对应的项目会话
     */
    private async syncProjectSessionAfterBranchSwitch(branchName: string): Promise<void> {
        try {
            // 检查是否为项目分支
            if (branchName.startsWith('SRS/')) {
                const projectName = branchName.substring(4);
                logger.info(`Detected project branch switch: ${branchName}, project: ${projectName}`);
                
                // 获取SessionManager并切换到对应项目会话
                const { SessionManager } = await import('./session-manager');
                const sessionManager = SessionManager.getInstance();
                
                // 切换到项目会话
                await sessionManager.switchToProjectSession(projectName);
                
                vscode.window.showInformationMessage(
                    `🔄 Switched to project session: ${projectName}\n\n📂 Folders view now shows files from branch: ${branchName}`
                );
                
                logger.info(`Successfully synced project session after branch switch: ${projectName}`);
            } else {
                // 切换到主分支，清理项目会话
                logger.info(`Switched to main branch: ${branchName}, clearing project session`);
                
                const { SessionManager } = await import('./session-manager');
                const sessionManager = SessionManager.getInstance();
                
                // 如果当前有项目会话，询问用户是否要清理
                const currentSession = await sessionManager.getCurrentSession();
                if (currentSession?.projectName) {
                    const action = await vscode.window.showInformationMessage(
                        `📂 Switched to main branch: ${branchName}\n\nCurrent project session: ${currentSession.projectName}`,
                        'Keep Project Session',
                        'Clear Project Session'
                    );
                    
                    if (action === 'Clear Project Session') {
                        await sessionManager.clearSession();
                        vscode.window.showInformationMessage('🧹 Project session cleared');
                    }
                }
            }
        } catch (error) {
            logger.warn(`Failed to sync project session after branch switch: ${(error as Error).message}`);
            // 不阻止分支切换，只记录警告
        }
    }

    /**
     * 获取当前查看的分支
     */
    public getCurrentViewBranch(): string | undefined {
        return this.currentViewBranch;
    }
}
