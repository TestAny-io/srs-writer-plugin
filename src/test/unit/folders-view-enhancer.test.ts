/**
 * Folders视图增强器测试
 * 测试Git分支切换和会话集成功能
 */

import * as vscode from 'vscode';
import { FoldersViewEnhancer } from '../../core/FoldersViewEnhancer';

// Mock vscode模块
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }]
    },
    window: {
        showQuickPick: jest.fn(),
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        withProgress: jest.fn()
    },
    ProgressLocation: {
        Notification: 15
    },
    commands: {
        executeCommand: jest.fn()
    },
    ExtensionContext: jest.fn()
}));

// Mock git-operations模块
jest.mock('../../tools/atomic/git-operations', () => ({
    checkGitRepository: jest.fn(),
    getCurrentBranch: jest.fn(),
    checkWorkspaceGitStatus: jest.fn(),
    commitAllChanges: jest.fn(),
    discardAllChanges: jest.fn()
}));

// Mock session-manager模块
jest.mock('../../core/session-manager', () => ({
    SessionManager: {
        getInstance: jest.fn().mockReturnValue({
            getCurrentSession: jest.fn(),
            switchToProjectSession: jest.fn(),
            clearSession: jest.fn()
        })
    }
}));

// Mock child_process
jest.mock('child_process', () => ({
    execSync: jest.fn()
}));

describe('Folders View Enhancer', () => {
    let enhancer: FoldersViewEnhancer;
    let mockShowQuickPick: jest.MockedFunction<any>;
    let mockShowInformationMessage: jest.MockedFunction<any>;
    let mockShowWarningMessage: jest.MockedFunction<any>;
    let mockWithProgress: jest.MockedFunction<any>;
    let mockExecSync: jest.MockedFunction<any>;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // 获取mock函数
        mockShowQuickPick = vscode.window.showQuickPick as jest.MockedFunction<any>;
        mockShowInformationMessage = vscode.window.showInformationMessage as jest.MockedFunction<any>;
        mockShowWarningMessage = vscode.window.showWarningMessage as jest.MockedFunction<any>;
        mockWithProgress = vscode.window.withProgress as jest.MockedFunction<any>;
        
        const { execSync } = require('child_process');
        mockExecSync = execSync as jest.MockedFunction<any>;
        
        // Mock git-operations
        const { checkGitRepository, getCurrentBranch } = require('../../tools/atomic/git-operations');
        (checkGitRepository as jest.MockedFunction<any>).mockResolvedValue(true);
        (getCurrentBranch as jest.MockedFunction<any>).mockResolvedValue('main');
        
        // 创建实例
        enhancer = new FoldersViewEnhancer();
    });

    describe('Branch Selection', () => {
        it('should show branch selection menu', async () => {
            // Mock Git分支列表
            mockExecSync.mockReturnValue('  main\n* SRS/project1\n  SRS/project2\n');
            
            mockShowQuickPick.mockResolvedValue({
                label: '🌿 SRS/project1',
                branchName: 'SRS/project1',
                isCurrent: false
            });

            mockWithProgress.mockImplementation(async (options: any, callback: any) => {
                const mockProgress = { report: jest.fn() };
                return await callback(mockProgress);
            });

            await enhancer.selectBranchForFolders();

            expect(mockShowQuickPick).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        label: '🌿 main',
                        description: '(current)'
                    }),
                    expect.objectContaining({
                        label: '🌿 SRS/project1',
                        description: ''
                    })
                ]),
                expect.objectContaining({
                    placeHolder: 'Select Git branch to display in Folders view'
                })
            );
        });

        it('should handle no workspace folder', async () => {
            (vscode.workspace as any).workspaceFolders = undefined;

            await enhancer.selectBranchForFolders();

            expect(mockShowWarningMessage).toHaveBeenCalledWith('No workspace folder available');
        });

        it('should handle non-git repository', async () => {
            const { checkGitRepository } = require('../../tools/atomic/git-operations');
            (checkGitRepository as jest.MockedFunction<any>).mockResolvedValue(false);

            await enhancer.selectBranchForFolders();

            expect(mockShowInformationMessage).toHaveBeenCalledWith('Current workspace is not a Git repository');
        });

        it('should handle current branch selection', async () => {
            mockExecSync.mockReturnValue('* main\n  SRS/project1\n');
            
            mockShowQuickPick.mockResolvedValue({
                label: '🌿 main',
                branchName: 'main',
                isCurrent: true
            });

            await enhancer.selectBranchForFolders();

            expect(mockShowInformationMessage).toHaveBeenCalledWith(
                '📂 Folders view is already showing branch: main'
            );
        });
    });

    describe('Uncommitted Changes Handling', () => {
        beforeEach(() => {
            mockExecSync.mockReturnValue('  main\n* SRS/project1\n');
            mockShowQuickPick.mockResolvedValue({
                label: '🌿 main',
                branchName: 'main',
                isCurrent: false
            });
        });

        it('should handle commit and switch option', async () => {
            // Mock有未提交更改
            const { checkWorkspaceGitStatus, commitAllChanges } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                hasChanges: true
            });
            (commitAllChanges as jest.MockedFunction<any>).mockResolvedValue({
                success: true,
                commitHash: 'abc1234'
            });

            mockShowWarningMessage.mockResolvedValue('Commit and Switch');
            mockWithProgress.mockImplementation(async (options: any, callback: any) => {
                const mockProgress = { report: jest.fn() };
                return await callback(mockProgress);
            });

            await enhancer.selectBranchForFolders();

            expect(mockShowWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('You have uncommitted changes'),
                { modal: true },
                'Commit and Switch',
                'Discard and Switch',
                'Cancel'
            );
            expect(commitAllChanges).toHaveBeenCalled();
        });

        it('should handle discard and switch option', async () => {
            // Mock有未提交更改
            const { checkWorkspaceGitStatus, discardAllChanges } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                hasChanges: true
            });
            (discardAllChanges as jest.MockedFunction<any>).mockResolvedValue({
                success: true
            });

            mockShowWarningMessage.mockResolvedValue('Discard and Switch');
            mockWithProgress.mockImplementation(async (options: any, callback: any) => {
                const mockProgress = { report: jest.fn() };
                return await callback(mockProgress);
            });

            await enhancer.selectBranchForFolders();

            expect(discardAllChanges).toHaveBeenCalled();
        });

        it('should handle cancel option', async () => {
            // Mock有未提交更改
            const { checkWorkspaceGitStatus } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                hasChanges: true
            });

            mockShowWarningMessage.mockResolvedValue('Cancel');

            await enhancer.selectBranchForFolders();

            // 应该不执行Git切换
            expect(mockWithProgress).not.toHaveBeenCalled();
        });
    });

    describe('Session Integration', () => {
        beforeEach(() => {
            mockExecSync.mockReturnValue('  main\n* SRS/project1\n');
            mockWithProgress.mockImplementation(async (options: any, callback: any) => {
                const mockProgress = { report: jest.fn() };
                return await callback(mockProgress);
            });
        });

        it('should sync project session when switching to SRS branch', async () => {
            const { checkWorkspaceGitStatus } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                hasChanges: false
            });

            mockShowQuickPick.mockResolvedValue({
                label: '🌿 SRS/testproject',
                branchName: 'SRS/testproject',
                isCurrent: false
            });

            const { SessionManager } = require('../../core/session-manager');
            const mockSessionManager = SessionManager.getInstance();

            await enhancer.selectBranchForFolders();

            expect(mockSessionManager.switchToProjectSession).toHaveBeenCalledWith('testproject');
            expect(mockShowInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Switched to project session: testproject')
            );
        });

        it('should handle main branch switch with project session', async () => {
            const { checkWorkspaceGitStatus } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                hasChanges: false
            });

            mockShowQuickPick.mockResolvedValue({
                label: '🌿 main',
                branchName: 'main',
                isCurrent: false
            });

            const { SessionManager } = require('../../core/session-manager');
            const mockSessionManager = SessionManager.getInstance();
            mockSessionManager.getCurrentSession.mockResolvedValue({
                projectName: 'currentproject'
            });

            mockShowInformationMessage.mockResolvedValue('Clear Project Session');

            await enhancer.selectBranchForFolders();

            expect(mockSessionManager.clearSession).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle git command failures', async () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('Git command failed');
            });

            await enhancer.selectBranchForFolders();

            expect(mockShowInformationMessage).toHaveBeenCalledWith('No Git branches found');
        });

        it('should handle branch switch failures', async () => {
            const { checkWorkspaceGitStatus } = require('../../tools/atomic/git-operations');
            (checkWorkspaceGitStatus as jest.MockedFunction<any>).mockResolvedValue({
                hasChanges: false
            });

            mockExecSync
                .mockReturnValueOnce('  main\n  SRS/project1\n') // 获取分支列表成功
                .mockImplementationOnce(() => { // git checkout失败
                    throw new Error('Checkout failed');
                });

            mockShowQuickPick.mockResolvedValue({
                label: '🌿 SRS/project1',
                branchName: 'SRS/project1',
                isCurrent: false
            });

            mockWithProgress.mockImplementation(async (options: any, callback: any) => {
                const mockProgress = { report: jest.fn() };
                return await callback(mockProgress);
            });

            const mockShowErrorMessage = vscode.window.showErrorMessage as jest.MockedFunction<any>;

            await enhancer.selectBranchForFolders();

            expect(mockShowErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to switch branch')
            );
        });
    });
});
