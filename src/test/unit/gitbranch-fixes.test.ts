/**
 * Git分支字段和切换记录修复测试
 * 测试gitBranch字段初始化和增强的分支切换记录
 */

import * as vscode from 'vscode';
import { SessionManager } from '../../core/session-manager';
import { createNewProjectFolder } from '../../tools/internal/createNewProjectFolderTool';
import { OperationType } from '../../types/session';

// Mock vscode模块
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }],
        fs: {
            createDirectory: jest.fn()
        }
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
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

// Mock filesystem-tools
jest.mock('../../tools/atomic/filesystem-tools', () => ({
    createDirectory: jest.fn()
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
    mkdirSync: jest.fn()
}));

describe('Git Branch Fixes', () => {
    let sessionManager: SessionManager;
    let mockContext: any;
    let mockGetCurrentBranch: jest.MockedFunction<any>;

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

        // 创建SessionManager实例
        sessionManager = SessionManager.getInstance(mockContext);
    });

    describe('Fix 1: gitBranch Field in Session Creation', () => {
        it('should include gitBranch field when creating new session', async () => {
            // Mock当前在wip分支
            mockGetCurrentBranch.mockResolvedValue('wip');
            
            const newSession = await sessionManager.createNewSession('testproject');
            
            expect(newSession.gitBranch).toBe('wip');
            expect(mockGetCurrentBranch).toHaveBeenCalled();
        });

        it('should handle git branch detection failure gracefully', async () => {
            // Mock Git检查失败
            mockGetCurrentBranch.mockRejectedValue(new Error('Git not found'));
            
            const newSession = await sessionManager.createNewSession('testproject');
            
            expect(newSession.gitBranch).toBeUndefined();
            expect(newSession.projectName).toBe('testproject');
        });

        it('should set gitBranch for different branches', async () => {
            const testCases = [
                'main',
                'wip', 
                'SRS/oldproject',
                'feature-branch'
            ];

            for (const branch of testCases) {
                // 重置单例
                (SessionManager as any).instance = undefined;
                const sm = SessionManager.getInstance(mockContext);
                
                mockGetCurrentBranch.mockResolvedValue(branch);
                
                const session = await sm.createNewSession('testproject');
                expect(session.gitBranch).toBe(branch);
            }
        });

        it('should handle no workspace folder', async () => {
            // Mock没有工作区
            (vscode.workspace as any).workspaceFolders = undefined;
            
            const newSession = await sessionManager.createNewSession('testproject');
            
            expect(newSession.gitBranch).toBeUndefined();
            expect(newSession.projectName).toBe('testproject');
        });
    });

    describe('Fix 2: Enhanced Git Branch Switch Records', () => {
        beforeEach(() => {
            // Mock成功的依赖
            const { createDirectory } = require('../../tools/atomic/filesystem-tools');
            (createDirectory as jest.MockedFunction<any>).mockResolvedValue({ success: true });
            
            const { checkWorkspaceGitStatus, commitAllChanges, checkBranchExists } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({ hasChanges: false });
            (commitAllChanges as jest.MockedFunction<any>).mockResolvedValue({ success: true });
            (checkBranchExists as jest.MockedFunction<any>).mockResolvedValue(true);
        });

        it('should record complete git operation info when switching from main to wip', async () => {
            // Mock从main分支切换到wip
            mockGetCurrentBranch
                .mockResolvedValueOnce('main') // createNewSession时
                .mockResolvedValueOnce('main'); // ensureOnWipBranch时
            
            const { checkWorkspaceGitStatus, commitAllChanges } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                hasChanges: true
            });
            (commitAllChanges as jest.MockedFunction<any>).mockResolvedValue({
                success: true,
                commitHash: 'abc123456'
            });

            const updateSessionWithLogSpy = jest.spyOn(sessionManager, 'updateSessionWithLog');

            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'test_git_operation_logging'
            });

            expect(result.success).toBe(true);
            
            // 验证记录了完整的Git操作信息
            expect(updateSessionWithLogSpy).toHaveBeenCalledWith({
                logEntry: expect.objectContaining({
                    type: OperationType.GIT_BRANCH_SWITCHED,
                    operation: expect.stringContaining('Switched from main to wip for project creation'),
                    gitOperation: expect.objectContaining({
                        fromBranch: 'main',
                        toBranch: 'wip',
                        autoCommitCreated: true,
                        autoCommitHash: 'abc123456',
                        reason: 'project_creation',
                        branchCreated: false
                    })
                })
            });
        });

        it('should record branch creation when wip branch does not exist', async () => {
            mockGetCurrentBranch
                .mockResolvedValueOnce('main')
                .mockResolvedValueOnce('main');
            
            const { checkBranchExists } = require('../../tools/atomic/git-operations');
            (checkBranchExists as jest.MockedFunction<any>).mockResolvedValue(false); // wip分支不存在

            const updateSessionWithLogSpy = jest.spyOn(sessionManager, 'updateSessionWithLog');

            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'test_branch_creation'
            });

            expect(result.success).toBe(true);
            
            // 验证记录了分支创建信息
            expect(updateSessionWithLogSpy).toHaveBeenCalledWith({
                logEntry: expect.objectContaining({
                    gitOperation: expect.objectContaining({
                        fromBranch: 'main',
                        toBranch: 'wip',
                        branchCreated: true
                    })
                })
            });
        });

        it('should not log when already on wip branch', async () => {
            mockGetCurrentBranch
                .mockResolvedValueOnce('wip')
                .mockResolvedValueOnce('wip');

            const updateSessionWithLogSpy = jest.spyOn(sessionManager, 'updateSessionWithLog');

            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'test_no_switch_needed'
            });

            expect(result.success).toBe(true);
            
            // 验证没有记录分支切换操作
            expect(updateSessionWithLogSpy).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    logEntry: expect.objectContaining({
                        type: OperationType.GIT_BRANCH_SWITCHED
                    })
                })
            );
        });

        it('should record different branch scenarios', async () => {
            const testScenarios = [
                { from: 'feature-x', to: 'wip', hasChanges: true },
                { from: 'develop', to: 'wip', hasChanges: false },
                { from: 'hotfix-123', to: 'wip', hasChanges: true }
            ];

            for (const scenario of testScenarios) {
                // 重置mocks
                jest.clearAllMocks();
                (SessionManager as any).instance = undefined;
                const sm = SessionManager.getInstance(mockContext);
                
                mockGetCurrentBranch
                    .mockResolvedValueOnce(scenario.from)
                    .mockResolvedValueOnce(scenario.from);
                
                const { checkWorkspaceGitStatus, commitAllChanges, createDirectory } = require('../../tools/atomic/git-operations');
                (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                    hasChanges: scenario.hasChanges
                });
                (commitAllChanges as jest.MockedFunction<any>).mockResolvedValue({
                    success: true,
                    commitHash: 'test123'
                });
                
                const { createDirectory: mockCreateDir } = require('../../tools/atomic/filesystem-tools');
                (mockCreateDir as jest.MockedFunction<any>).mockResolvedValue({ success: true });

                const updateSessionWithLogSpy = jest.spyOn(sm, 'updateSessionWithLog');

                const result = await createNewProjectFolder({
                    projectName: 'testproject',
                    reason: 'test_scenario'
                });

                expect(result.success).toBe(true);
                
                // 验证记录了正确的分支信息
                expect(updateSessionWithLogSpy).toHaveBeenCalledWith({
                    logEntry: expect.objectContaining({
                        gitOperation: expect.objectContaining({
                            fromBranch: scenario.from,
                            toBranch: 'wip',
                            autoCommitCreated: scenario.hasChanges
                        })
                    })
                });
            }
        });
    });

    describe('Session gitBranch Field Update', () => {
        it('should update session gitBranch field after wip switch', async () => {
            mockGetCurrentBranch
                .mockResolvedValueOnce('main')
                .mockResolvedValueOnce('main');
            
            const { createDirectory } = require('../../tools/atomic/filesystem-tools');
            (createDirectory as jest.MockedFunction<any>).mockResolvedValue({ success: true });

            const updateSessionSpy = jest.spyOn(sessionManager, 'updateSession');

            const result = await createNewProjectFolder({
                projectName: 'testproject',
                reason: 'test_session_update'
            });

            expect(result.success).toBe(true);
            
            // 验证更新了会话中的gitBranch字段
            expect(updateSessionSpy).toHaveBeenCalledWith({
                gitBranch: 'wip'
            });
        });
    });
});
