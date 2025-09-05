/**
 * 智能恢复功能集成测试
 * 测试完整的退出项目 → 重启 → 智能恢复流程
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SessionManager } from '../../core/session-manager';
import { OperationType } from '../../types/session';

// Mock vscode模块
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }]
    },
    window: {
        showWarningMessage: jest.fn(),
        withProgress: jest.fn()
    },
    commands: {
        executeCommand: jest.fn()
    },
    ProgressLocation: {
        Notification: 15
    },
    ExtensionContext: jest.fn()
}));

// Mock git-operations模块
jest.mock('../../tools/atomic/git-operations', () => ({
    getCurrentBranch: jest.fn(),
    checkGitRepository: jest.fn(),
    execSync: jest.fn()
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

describe('Smart Recovery Integration Tests', () => {
    let sessionManager: SessionManager;
    let mockContext: any;
    let mockGetCurrentBranch: jest.MockedFunction<any>;
    let mockShowWarningMessage: jest.MockedFunction<any>;
    let mockWithProgress: jest.MockedFunction<any>;

    beforeEach(() => {
        jest.clearAllMocks();
        
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
        
        mockShowWarningMessage = vscode.window.showWarningMessage as jest.MockedFunction<any>;
        mockWithProgress = vscode.window.withProgress as jest.MockedFunction<any>;

        // 创建SessionManager实例
        sessionManager = SessionManager.getInstance(mockContext);
    });

    describe('Complete Exit and Recovery Flow', () => {
        it('should handle full user exit → restart → recovery cycle', async () => {
            // === 阶段1: 模拟用户在项目分支上工作 ===
            mockGetCurrentBranch.mockResolvedValue('SRS/workingproject');
            
            // 创建初始项目会话
            const initialSession = await sessionManager.createNewSession('workingproject');
            expect(initialSession.projectName).toBe('workingproject');
            
            // === 阶段2: 模拟用户点击"Exit Current Project" ===
            mockShowWarningMessage.mockResolvedValue('Exit project');
            mockWithProgress.mockImplementation(async (options: any, callback: any) => {
                const mockProgress = {
                    report: jest.fn()
                };
                return await callback(mockProgress);
            });

            // 模拟restartPlugin()的退出标记设置逻辑
            await mockContext.globalState.update('srs-writer.intentional-exit-flag', {
                timestamp: Date.now(),
                reason: 'user_exit_current_project'
            });

            // 模拟会话清理
            await sessionManager.clearSession();
            
            // 验证会话已清理
            const clearedSession = await sessionManager.getCurrentSession();
            expect(clearedSession).toBeNull();

            // === 阶段3: 模拟插件重启（用户主动退出场景） ===
            mockContext.globalState.get.mockReturnValue({
                timestamp: Date.now() - 30000, // 30秒前设置的标记
                reason: 'user_exit_current_project'
            });

            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            // 创建新的SessionManager实例模拟重启
            const restartedSessionManager = SessionManager.getInstance(mockContext);
            await restartedSessionManager.autoInitialize();

            // 验证跳过了智能恢复
            expect(logSpy).toHaveBeenCalledWith('🚩 Detected intentional exit, skipping smart recovery');
            expect(mockContext.globalState.update).toHaveBeenCalledWith('srs-writer.intentional-exit-flag', undefined);
            
            // 验证没有恢复项目会话
            const noRecoverySession = await restartedSessionManager.getCurrentSession();
            expect(noRecoverySession).toBeNull();
        });

        it('should handle accidental restart and smart recovery', async () => {
            // === 阶段1: 模拟用户在项目分支上工作 ===
            mockGetCurrentBranch.mockResolvedValue('SRS/accidentproject');
            
            // 创建并保存项目会话（模拟会话文件存在）
            const workingSession = await sessionManager.createNewSession('accidentproject');
            
            // 模拟会话文件存在于文件系统
            const mockUnifiedFile = {
                fileVersion: '5.0',
                currentSession: workingSession,
                operations: [
                    {
                        timestamp: new Date().toISOString(),
                        sessionContextId: workingSession.sessionContextId,
                        type: OperationType.SESSION_CREATED,
                        operation: 'Created new project: accidentproject',
                        success: true
                    }
                ],
                timeRange: {
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                },
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };

            // Mock文件系统操作
            const fsAccessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
            const fsReadSpy = jest.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(mockUnifiedFile));

            // === 阶段2: 模拟意外重启（无退出标记） ===
            mockContext.globalState.get.mockReturnValue(undefined); // 无退出标记
            
            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            // 创建新的SessionManager实例模拟重启
            const restartedSessionManager = SessionManager.getInstance(mockContext);
            await restartedSessionManager.autoInitialize();

            // 验证进行了智能恢复
            expect(logSpy).toHaveBeenCalledWith('🔍 Starting smart recovery from Git branch detection');
            expect(logSpy).toHaveBeenCalledWith('🔍 Current Git branch: SRS/accidentproject');
            expect(logSpy).toHaveBeenCalledWith('🔍 Detected project branch: SRS/accidentproject, project: accidentproject');
            expect(logSpy).toHaveBeenCalledWith('🔄 Smart recovery: Loading session for project accidentproject');
            expect(logSpy).toHaveBeenCalledWith('✅ Smart recovery: Restored session for project accidentproject');

            // 验证项目会话已正确恢复
            const recoveredSession = await restartedSessionManager.getCurrentSession();
            expect(recoveredSession).toBeTruthy();
            expect(recoveredSession?.projectName).toBe('accidentproject');
            expect(recoveredSession?.sessionContextId).toBe(workingSession.sessionContextId);

            // 清理spy
            fsAccessSpy.mockRestore();
            fsReadSpy.mockRestore();
        });

        it('should handle mixed scenario: expired exit flag + project branch', async () => {
            // === 阶段1: 模拟过期的退出标记（超过1分钟） ===
            const expiredTimestamp = Date.now() - 120000; // 2分钟前
            mockContext.globalState.get.mockReturnValue({
                timestamp: expiredTimestamp,
                reason: 'user_exit_current_project'
            });

            // === 阶段2: 模拟用户在项目分支，且有对应会话文件 ===
            mockGetCurrentBranch.mockResolvedValue('SRS/expiredproject');
            
            const mockSession = {
                sessionContextId: 'expired-session-id',
                projectName: 'expiredproject',
                baseDir: '/test/workspace/expiredproject',
                activeFiles: [],
                metadata: {
                    created: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    version: '5.0'
                }
            };

            const mockUnifiedFile = {
                fileVersion: '5.0',
                currentSession: mockSession,
                operations: [],
                timeRange: {
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                },
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };

            // Mock文件系统操作
            const fsAccessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
            const fsReadSpy = jest.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(mockUnifiedFile));

            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            await sessionManager.autoInitialize();

            // 验证清除了过期标记并进行了智能恢复
            expect(logSpy).toHaveBeenCalledWith('🚩 Cleared expired exit flag');
            expect(logSpy).toHaveBeenCalledWith('🔍 Starting smart recovery from Git branch detection');
            expect(logSpy).toHaveBeenCalledWith('✅ Smart recovery: Restored session for project expiredproject');

            // 验证会话已恢复
            const recoveredSession = await sessionManager.getCurrentSession();
            expect(recoveredSession?.projectName).toBe('expiredproject');

            // 清理spy
            fsAccessSpy.mockRestore();
            fsReadSpy.mockRestore();
        });
    });

    describe('Edge Cases and Error Scenarios', () => {
        it('should handle corrupted session files gracefully', async () => {
            mockContext.globalState.get.mockReturnValue(undefined);
            mockGetCurrentBranch.mockResolvedValue('SRS/corruptproject');

            // Mock文件存在但内容损坏
            const fsAccessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
            const fsReadSpy = jest.spyOn(fs.promises, 'readFile').mockResolvedValue('invalid json content');

            const logSpy = jest.spyOn((sessionManager as any).logger, 'warn');

            await sessionManager.autoInitialize();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid JSON in session file'));

            // 清理spy
            fsAccessSpy.mockRestore();
            fsReadSpy.mockRestore();
        });

        it('should handle git command failures without crashing', async () => {
            mockContext.globalState.get.mockReturnValue(undefined);
            mockGetCurrentBranch.mockRejectedValue(new Error('Git not found'));

            const logSpy = jest.spyOn((sessionManager as any).logger, 'warn');

            // 不应该抛出异常
            await expect(sessionManager.autoInitialize()).resolves.not.toThrow();
            
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Smart recovery failed: Git not found'));
        });

        it('should handle filesystem permission errors', async () => {
            mockContext.globalState.get.mockReturnValue(undefined);
            mockGetCurrentBranch.mockResolvedValue('SRS/permissionproject');

            // Mock文件访问权限错误
            const fsAccessSpy = jest.spyOn(fs.promises, 'access').mockRejectedValue(new Error('Permission denied'));

            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            await sessionManager.autoInitialize();

            expect(logSpy).toHaveBeenCalledWith('🔄 Smart recovery: Creating new session for existing project permissionproject');

            // 清理spy
            fsAccessSpy.mockRestore();
        });
    });

    describe('Performance and Stability', () => {
        it('should complete smart recovery within reasonable time', async () => {
            mockContext.globalState.get.mockReturnValue(undefined);
            mockGetCurrentBranch.mockResolvedValue('SRS/perfproject');

            const startTime = Date.now();
            
            await sessionManager.autoInitialize();
            
            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // 智能恢复应该在1秒内完成
            expect(executionTime).toBeLessThan(1000);
        });

        it('should not cause memory leaks with repeated initializations', async () => {
            mockContext.globalState.get.mockReturnValue(undefined);
            mockGetCurrentBranch.mockResolvedValue('main');

            // 多次初始化不应该导致内存泄漏或错误
            for (let i = 0; i < 10; i++) {
                await expect(sessionManager.autoInitialize()).resolves.not.toThrow();
            }
        });
    });
});
