/**
 * Create New Project WIP分支防御性检查测试
 * 测试项目创建时的分支切换和保护逻辑
 */

import * as vscode from 'vscode';
import { createNewProjectFolder } from '../../tools/internal/createNewProjectFolderTool';

// Mock vscode模块
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }],
        fs: {
            createDirectory: jest.fn(),
            stat: jest.fn()
        }
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    },
    FileType: {
        Directory: 1
    }
}));

// Mock git-operations模块
jest.mock('../../tools/atomic/git-operations', () => ({
    getCurrentBranch: jest.fn(),
    checkWorkspaceGitStatus: jest.fn(),
    commitAllChanges: jest.fn(),
    checkBranchExists: jest.fn()
}));

// Mock filesystem-tools
jest.mock('../../tools/atomic/filesystem-tools', () => ({
    createDirectory: jest.fn()
}));

// Mock session-manager
jest.mock('../../core/session-manager', () => ({
    SessionManager: {
        getInstance: jest.fn().mockReturnValue({
            getCurrentSession: jest.fn(),
            startNewSession: jest.fn(),
            updateSessionWithLog: jest.fn()
        })
    }
}));

// Mock child_process
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

describe('Create Project WIP Branch Defense', () => {
    let mockGetCurrentBranch: jest.MockedFunction<any>;
    let mockCheckWorkspaceGitStatus: jest.MockedFunction<any>;
    let mockCommitAllChanges: jest.MockedFunction<any>;
    let mockCheckBranchExists: jest.MockedFunction<any>;
    let mockExecSync: jest.MockedFunction<any>;
    let mockCreateDirectory: jest.MockedFunction<any>;
    let mockSessionManager: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // 获取mock函数
        const gitOps = require('../../tools/atomic/git-operations');
        mockGetCurrentBranch = gitOps.getCurrentBranch;
        mockCheckWorkspaceGitStatus = gitOps.checkWorkspaceGitStatus;
        mockCommitAllChanges = gitOps.commitAllChanges;
        mockCheckBranchExists = gitOps.checkBranchExists;
        
        const { execSync } = require('child_process');
        mockExecSync = execSync;
        
        const { createDirectory } = require('../../tools/atomic/filesystem-tools');
        mockCreateDirectory = createDirectory;
        
        const { SessionManager } = require('../../core/session-manager');
        mockSessionManager = SessionManager.getInstance();
        
        // 默认成功的mock设置
        mockSessionManager.getCurrentSession.mockResolvedValue(null);
        mockSessionManager.startNewSession.mockResolvedValue({
            success: true,
            newSession: {
                sessionContextId: 'test-session-id',
                projectName: 'testproject'
            }
        });
        mockCreateDirectory.mockResolvedValue({ success: true });
    });

    describe('WIP Branch Defense Scenarios', () => {
        it('should continue directly when already on wip branch', async () => {
            // 场景2: 用户已在wip分支
            mockGetCurrentBranch.mockResolvedValue('wip');
            
            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'user_requested_test'
            });
            
            expect(result.success).toBe(true);
            expect(result.gitBranch?.name).toBe('wip');
            expect(result.gitBranch?.switched).toBe(false); // 没有切换
            
            // 验证没有执行分支切换命令
            expect(mockExecSync).not.toHaveBeenCalledWith(
                expect.stringContaining('git checkout'),
                expect.any(Object)
            );
        });

        it('should auto-commit and switch when on main branch with changes', async () => {
            // 场景1: 用户在main分支且有未提交更改
            mockGetCurrentBranch.mockResolvedValue('main');
            mockCheckWorkspaceGitStatus.mockResolvedValue({
                hasChanges: true,
                hasStagedChanges: true,
                hasUnstagedChanges: true,
                workspaceRoot: '/test/workspace'
            });
            mockCommitAllChanges.mockResolvedValue({
                success: true,
                commitHash: 'abc1234567'
            });
            mockCheckBranchExists.mockResolvedValue(true); // wip分支存在
            
            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'user_requested_test'
            });
            
            expect(result.success).toBe(true);
            expect(result.gitBranch?.name).toBe('wip');
            expect(result.gitBranch?.switched).toBe(true);
            expect(result.gitBranch?.autoCommitCreated).toBe(true);
            expect(result.gitBranch?.autoCommitHash).toBe('abc1234567');
            
            // 验证执行了自动提交
            expect(mockCommitAllChanges).toHaveBeenCalledWith('/test/workspace');
            
            // 验证切换到wip分支
            expect(mockExecSync).toHaveBeenCalledWith(
                'git checkout wip',
                { cwd: '/test/workspace' }
            );
        });

        it('should create wip branch if it does not exist', async () => {
            // 场景: 用户在main分支，wip分支不存在
            mockGetCurrentBranch.mockResolvedValue('main');
            mockCheckWorkspaceGitStatus.mockResolvedValue({
                hasChanges: false
            });
            mockCheckBranchExists.mockResolvedValue(false); // wip分支不存在
            
            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'user_requested_test'
            });
            
            expect(result.success).toBe(true);
            expect(result.gitBranch?.switched).toBe(true);
            
            // 验证创建wip分支
            expect(mockExecSync).toHaveBeenCalledWith(
                'git checkout -b wip',
                { cwd: '/test/workspace' }
            );
        });

        it('should handle other branches (feature branches)', async () => {
            // 场景3: 用户在其他分支（如feature-x）
            mockGetCurrentBranch.mockResolvedValue('feature-x');
            mockCheckWorkspaceGitStatus.mockResolvedValue({
                hasChanges: true,
                hasStagedChanges: false,
                hasUnstagedChanges: true,
                workspaceRoot: '/test/workspace'
            });
            mockCommitAllChanges.mockResolvedValue({
                success: true,
                commitHash: 'def7890123'
            });
            mockCheckBranchExists.mockResolvedValue(true); // wip分支存在
            
            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'user_requested_test'
            });
            
            expect(result.success).toBe(true);
            expect(result.gitBranch?.name).toBe('wip');
            expect(result.gitBranch?.switched).toBe(true);
            expect(result.gitBranch?.autoCommitCreated).toBe(true);
            
            // 验证自动提交到feature-x分支
            expect(mockCommitAllChanges).toHaveBeenCalledWith('/test/workspace');
            
            // 验证切换到wip分支
            expect(mockExecSync).toHaveBeenCalledWith(
                'git checkout wip',
                { cwd: '/test/workspace' }
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle commit failure gracefully', async () => {
            mockGetCurrentBranch.mockResolvedValue('main');
            mockCheckWorkspaceGitStatus.mockResolvedValue({
                hasChanges: true
            });
            mockCommitAllChanges.mockResolvedValue({
                success: false,
                error: 'Commit failed'
            });
            
            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'user_requested_test'
            });
            
            expect(result.success).toBe(true); // 项目创建仍然成功
            expect(result.gitBranch?.error).toContain('Failed to commit changes in main');
        });

        it('should handle branch switch failure', async () => {
            mockGetCurrentBranch.mockResolvedValue('main');
            mockCheckWorkspaceGitStatus.mockResolvedValue({
                hasChanges: false
            });
            mockCheckBranchExists.mockResolvedValue(true);
            mockExecSync.mockImplementation(() => {
                throw new Error('Git checkout failed');
            });
            
            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'user_requested_test'
            });
            
            expect(result.success).toBe(true); // 项目创建仍然成功
            expect(result.gitBranch?.error).toContain('Failed to ensure wip branch');
        });

        it('should handle git command not available', async () => {
            mockGetCurrentBranch.mockRejectedValue(new Error('Git not found'));
            
            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'user_requested_test'
            });
            
            expect(result.success).toBe(true); // 项目创建仍然成功
            // Git操作失败不应该阻止项目创建
        });
    });

    describe('Integration with Session Management', () => {
        it('should log branch switch operation to session', async () => {
            mockGetCurrentBranch.mockResolvedValue('main');
            mockCheckWorkspaceGitStatus.mockResolvedValue({
                hasChanges: false
            });
            mockCheckBranchExists.mockResolvedValue(true);
            
            await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'user_requested_test'
            });
            
            // 验证记录了分支切换操作
            expect(mockSessionManager.updateSessionWithLog).toHaveBeenCalledWith({
                logEntry: expect.objectContaining({
                    type: 'GIT_BRANCH_SWITCHED',
                    operation: expect.stringContaining('Switched to wip branch for project creation')
                })
            });
        });

        it('should not log when already on wip branch', async () => {
            mockGetCurrentBranch.mockResolvedValue('wip');
            
            await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'user_requested_test'
            });
            
            // 验证没有记录分支切换操作
            expect(mockSessionManager.updateSessionWithLog).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    logEntry: expect.objectContaining({
                        type: 'GIT_BRANCH_SWITCHED'
                    })
                })
            );
        });
    });

    describe('User Feedback Messages', () => {
        it('should include branch switch info in success message', async () => {
            mockGetCurrentBranch.mockResolvedValue('main');
            mockCheckWorkspaceGitStatus.mockResolvedValue({
                hasChanges: true
            });
            mockCommitAllChanges.mockResolvedValue({
                success: true,
                commitHash: 'abc123'
            });
            mockCheckBranchExists.mockResolvedValue(false); // wip不存在，需要创建
            
            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'user_requested_test'
            });
            
            expect(result.success).toBe(true);
            expect(result.message).toContain('切换到wip工作分支');
            expect(result.message).toContain('已自动提交当前分支更改');
        });

        it('should show simple message when already on wip', async () => {
            mockGetCurrentBranch.mockResolvedValue('wip');
            
            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'user_requested_test'
            });
            
            expect(result.success).toBe(true);
            expect(result.message).toContain('在wip工作分支上');
            expect(result.message).not.toContain('切换');
        });
    });
});
