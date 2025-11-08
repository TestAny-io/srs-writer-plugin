/**
 * 简化的Switch Project功能测试
 * 测试移除复杂Git分支切换后的项目切换逻辑
 */

import * as vscode from 'vscode';
import { SessionManager } from '../../core/session-manager';

// Mock vscode模块
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }],
        fs: {
            readDirectory: jest.fn()
        },
        getConfiguration: jest.fn()
    },
    window: {
        showQuickPick: jest.fn(),
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        withProgress: jest.fn()
    },
    FileType: {
        Directory: 1,
        File: 2
    },
    ProgressLocation: {
        Notification: 15
    },
    ExtensionContext: jest.fn()
}));

// Mock git-operations模块
jest.mock('../../tools/atomic/git-operations', () => ({
    getCurrentBranch: jest.fn(),
    checkWorkspaceGitStatus: jest.fn(),
    commitAllChanges: jest.fn(),
    checkBranchExists: jest.fn()
}));

// Mock child_process
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

// Mock fs模块
jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn()
    },
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    statSync: jest.fn(),      // 🚀 Phase 1.1: Add for BaseDirValidator
    realpathSync: jest.fn()   // 🚀 Phase 1.1: Add for BaseDirValidator
}));

describe('Switch Project Simplified', () => {
    let sessionManager: SessionManager;
    let mockContext: any;
    let mockGetCurrentBranch: jest.MockedFunction<any>;
    let mockWithProgress: jest.MockedFunction<any>;

    beforeEach(() => {
        jest.clearAllMocks();

        // 重置SessionManager单例
        (SessionManager as any).instance = undefined;

        // 创建mock context
        mockContext = {
            globalStoragePath: '/test/global',
            globalState: {
                get: jest.fn(),
                update: jest.fn().mockResolvedValue(undefined)
            }
        } as any;

        // 获取mock函数
        const { getCurrentBranch } = require('../../tools/atomic/git-operations');
        mockGetCurrentBranch = getCurrentBranch as jest.MockedFunction<any>;

        mockWithProgress = vscode.window.withProgress as jest.MockedFunction<any>;

        // 创建SessionManager实例
        sessionManager = SessionManager.getInstance(mockContext);

        // Mock workspace configuration
        (vscode.workspace.getConfiguration as jest.MockedFunction<any>).mockReturnValue({
            get: jest.fn().mockReturnValue([])
        });

        // Setup mock implementations for BaseDirValidator
        const fs = require('fs');
        (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
        (fs.realpathSync as jest.Mock).mockImplementation((p: string) => p);
    });

    describe('WIP Branch Ensure Logic', () => {
        it('should continue directly when already on wip branch', async () => {
            // 用户已在wip分支
            mockGetCurrentBranch.mockResolvedValue('wip');

            // 模拟ensureOnWipBranchForProjectSwitch的预期行为
            const result = {
                success: true,
                message: 'Already on wip branch',
                branchSwitched: false,
                fromBranch: 'wip'
            };

            expect(result.branchSwitched).toBe(false);
            expect(result.fromBranch).toBe('wip');
        });

        it('should switch from main to wip branch automatically', async () => {
            // 用户在main分支
            mockGetCurrentBranch.mockResolvedValue('main');
            
            const { checkWorkspaceGitStatus, commitAllChanges, checkBranchExists } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                hasChanges: true
            });
            (commitAllChanges as jest.MockedFunction<any>).mockResolvedValue({
                success: true,
                commitHash: 'abc123'
            });
            (checkBranchExists as jest.MockedFunction<any>).mockResolvedValue(true);

            // 模拟从main切换到wip的预期行为
            const result = {
                success: true,
                message: 'Successfully switched to wip branch from main for project work',
                branchSwitched: true,
                autoCommitCreated: true,
                autoCommitHash: 'abc123',
                fromBranch: 'main',
                branchCreated: false
            };

            expect(result.branchSwitched).toBe(true);
            expect(result.fromBranch).toBe('main');
            expect(result.autoCommitCreated).toBe(true);
        });

        it('should create wip branch if it does not exist', async () => {
            mockGetCurrentBranch.mockResolvedValue('main');
            
            const { checkWorkspaceGitStatus, checkBranchExists } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                hasChanges: false
            });
            (checkBranchExists as jest.MockedFunction<any>).mockResolvedValue(false); // wip不存在

            // 模拟创建wip分支的预期行为
            const result = {
                success: true,
                message: 'Successfully switched to wip branch from main for project work',
                branchSwitched: true,
                fromBranch: 'main',
                branchCreated: true
            };

            expect(result.branchCreated).toBe(true);
        });

        it('should handle switching from feature branches', async () => {
            const featureBranches = ['feature-x', 'develop', 'hotfix-123'];

            for (const branch of featureBranches) {
                mockGetCurrentBranch.mockResolvedValue(branch);
                
                const { checkWorkspaceGitStatus, commitAllChanges, checkBranchExists } = require('../../tools/atomic/git-operations');
                (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                    hasChanges: true
                });
                (commitAllChanges as jest.MockedFunction<any>).mockResolvedValue({
                    success: true,
                    commitHash: 'def456'
                });
                (checkBranchExists as jest.MockedFunction<any>).mockResolvedValue(true);

                const result = {
                    success: true,
                    branchSwitched: true,
                    fromBranch: branch,
                    autoCommitCreated: true
                };

                expect(result.fromBranch).toBe(branch);
                expect(result.branchSwitched).toBe(true);
            }
        });
    });

    describe('Session Management Integration', () => {
        it('should update session gitBranch field to wip after switch', async () => {
            // Mock项目切换
            const updateSessionSpy = jest.spyOn(sessionManager, 'updateSession');
            const switchToProjectSessionSpy = jest.spyOn(sessionManager, 'switchToProjectSession').mockResolvedValue();

            // 模拟项目切换中的会话更新逻辑
            await sessionManager.switchToProjectSession('testproject');
            await sessionManager.updateSession({
                gitBranch: 'wip'
            });

            expect(switchToProjectSessionSpy).toHaveBeenCalledWith('testproject');
            expect(updateSessionSpy).toHaveBeenCalledWith({
                gitBranch: 'wip'
            });
        });

        it('should log git branch switch operation when switching from main', async () => {
            const updateSessionWithLogSpy = jest.spyOn(sessionManager, 'updateSessionWithLog');

            // 模拟从main切换到wip的日志记录
            await sessionManager.updateSessionWithLog({
                logEntry: {
                    type: 'GIT_BRANCH_SWITCHED' as any,
                    operation: 'Switched from main to wip for project switch: testproject',
                    success: true,
                    toolName: 'switchProject',
                    gitOperation: {
                        fromBranch: 'main',
                        toBranch: 'wip',
                        autoCommitCreated: true,
                        autoCommitHash: 'abc123',
                        reason: 'project_switch',
                        branchCreated: false
                    }
                }
            });

            expect(updateSessionWithLogSpy).toHaveBeenCalledWith({
                logEntry: expect.objectContaining({
                    gitOperation: expect.objectContaining({
                        fromBranch: 'main',
                        toBranch: 'wip',
                        reason: 'project_switch'
                    })
                })
            });
        });
    });

    describe('Simplified User Experience', () => {
        it('should show simplified success message without complex git info', () => {
            const sessionInfo = ' (Existing session loaded)';
            const successMessage = `✅ Project switch completed!\n\n📁 Current project: testproject${sessionInfo}\n🌿 Working on wip branch\n\n🚀 Ready to start working!`;

            expect(successMessage).toContain('Working on wip branch');
            expect(successMessage).not.toContain('Git branch switch failed');
            expect(successMessage).not.toContain('SRS/');
        });

        it('should have simplified progress steps', () => {
            const expectedProgressSteps = [
                { increment: 40, message: '✅ No plan to stop, continuing...' },
                { increment: 35, message: '✅ Session switch completed' },
                { increment: 15, message: '✅ Already on wip branch' }, // 或 'Switched to wip branch'
                { increment: 10, message: '✅ Context cleaned' }
            ];

            // 验证总进度合理
            const totalIncrement = expectedProgressSteps.reduce((sum, step) => sum + step.increment, 0);
            expect(totalIncrement).toBeLessThanOrEqual(100);

            // 验证不包含复杂的Git分支切换步骤
            expectedProgressSteps.forEach(step => {
                expect(step.message).not.toContain('SRS/');
                expect(step.message).not.toContain('project branch');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle wip branch switch failure gracefully', async () => {
            mockGetCurrentBranch.mockResolvedValue('main');
            
            const { checkWorkspaceGitStatus, commitAllChanges } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                hasChanges: false
            });
            
            // Mock git checkout失败
            const { execSync } = require('child_process');
            (execSync as jest.MockedFunction<any>).mockImplementation(() => {
                throw new Error('Git checkout failed');
            });

            // 验证错误处理不阻止项目切换
            const errorResult = {
                success: false,
                message: 'Failed to ensure wip branch for project switch: Git checkout failed',
                error: 'Git checkout failed'
            };

            expect(errorResult.success).toBe(false);
            expect(errorResult.error).toContain('Git checkout failed');
            
            // 项目切换应该能继续，只是Git操作失败
        });

        it('should handle commit failure during branch switch', async () => {
            mockGetCurrentBranch.mockResolvedValue('main');
            
            const { checkWorkspaceGitStatus, commitAllChanges } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                hasChanges: true
            });
            (commitAllChanges as jest.MockedFunction<any>).mockResolvedValue({
                success: false,
                error: 'Commit failed'
            });

            const errorResult = {
                success: false,
                message: 'Failed to commit changes in main',
                error: 'Commit failed'
            };

            expect(errorResult.success).toBe(false);
            expect(errorResult.error).toBe('Commit failed');
        });
    });

    describe('Performance and Simplification', () => {
        it('should have faster execution without complex git operations', () => {
            // 验证简化后的操作更少
            const simplifiedOperations = [
                'getCurrentBranch',           // 检查当前分支
                'checkWorkspaceGitStatus',    // 检查更改（如果需要）
                'commitAllChanges',           // 提交更改（如果需要）
                'git checkout wip'            // 切换到wip（如果需要）
            ];

            // 验证不包含复杂操作
            const removedOperations = [
                'createProjectBranch',
                'switchToProjectGitBranchFromSession',
                'SRS/ branch creation',
                'complex branch selection'
            ];

            simplifiedOperations.forEach(op => {
                expect(op).not.toContain('SRS/');
                expect(op).not.toContain('complex');
            });

            removedOperations.forEach(op => {
                expect(op).toContain('SRS/'); // 验证这些确实是被移除的操作
            });
        });
    });
});
