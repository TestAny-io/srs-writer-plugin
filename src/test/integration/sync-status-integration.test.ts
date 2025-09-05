/**
 * 同步状态检查功能集成测试
 * 测试完整的同步状态检查和修复流程
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
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        withProgress: jest.fn()
    },
    ProgressLocation: {
        Notification: 15
    },
    ExtensionContext: jest.fn()
}));

// Mock git-operations模块
jest.mock('../../tools/atomic/git-operations', () => ({
    getCurrentBranch: jest.fn()
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

describe('Sync Status Integration Tests', () => {
    let sessionManager: SessionManager;
    let mockContext: any;
    let mockGetCurrentBranch: jest.MockedFunction<any>;
    let mockShowInformationMessage: jest.MockedFunction<any>;
    let mockShowWarningMessage: jest.MockedFunction<any>;
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
        
        mockShowInformationMessage = vscode.window.showInformationMessage as jest.MockedFunction<any>;
        mockShowWarningMessage = vscode.window.showWarningMessage as jest.MockedFunction<any>;
        mockWithProgress = vscode.window.withProgress as jest.MockedFunction<any>;

        // 创建SessionManager实例
        sessionManager = SessionManager.getInstance(mockContext);
    });

    describe('Complete Sync Status Check Flow', () => {
        it('should show comprehensive status info when sync is healthy', async () => {
            // === 准备测试数据 ===
            const testSession = await sessionManager.createNewSession('healthyproject');
            testSession.activeFiles = ['file1.md', 'file2.md', 'file3.md'];
            
            // Mock Git分支匹配
            mockGetCurrentBranch.mockResolvedValue('SRS/healthyproject');
            
            // Mock会话文件存在且一致
            const mockUnifiedFile = {
                fileVersion: '5.0',
                currentSession: testSession,
                operations: [
                    {
                        timestamp: new Date().toISOString(),
                        sessionContextId: testSession.sessionContextId,
                        type: OperationType.SESSION_CREATED,
                        operation: 'Created new project: healthyproject',
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

            const fsAccessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
            const fsReadSpy = jest.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(mockUnifiedFile));

            // === 执行同步状态检查 ===
            const syncStatus = await sessionManager.checkSyncStatus();
            const statusInfo = await sessionManager.getCurrentStatusInfo();

            // === 验证结果 ===
            expect(syncStatus.isConsistent).toBe(true);
            expect(statusInfo.projectName).toBe('healthyproject');
            expect(statusInfo.activeFiles).toBe(3);
            expect(statusInfo.gitBranch).toBe('SRS/healthyproject');
            expect(statusInfo.fileFormat).toBe('UnifiedSessionFile v5.0');

            // 清理spy
            fsAccessSpy.mockRestore();
            fsReadSpy.mockRestore();
        });

        it('should detect and report multiple inconsistencies', async () => {
            // === 准备不一致的测试数据 ===
            const testSession = await sessionManager.createNewSession('problemproject');
            
            // Mock Git分支不匹配
            mockGetCurrentBranch.mockResolvedValue('SRS/differentproject');
            
            // Mock会话文件存在但内容不一致
            const mockUnifiedFile = {
                fileVersion: '4.0', // 旧版本格式
                currentSession: {
                    ...testSession,
                    projectName: 'anotherproject', // 不同的项目名
                    baseDir: '/different/path',    // 不同的路径
                    activeFiles: ['onlyfile.md']   // 不同的文件数量
                },
                operations: [],
                timeRange: {
                    startDate: '2024-01-01',
                    endDate: '2024-01-16'
                },
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };

            const fsAccessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
            const fsReadSpy = jest.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(mockUnifiedFile));

            // === 执行同步状态检查 ===
            const syncStatus = await sessionManager.checkSyncStatus();

            // === 验证检测到多个问题 ===
            expect(syncStatus.isConsistent).toBe(false);
            expect(syncStatus.inconsistencies.length).toBeGreaterThan(1);
            
            // 验证具体问题
            expect(syncStatus.inconsistencies).toContain(
                expect.stringContaining('Project name mismatch')
            );
            expect(syncStatus.inconsistencies).toContain(
                expect.stringContaining('Base directory mismatch')
            );
            expect(syncStatus.inconsistencies).toContain(
                expect.stringContaining('Active files count mismatch')
            );
            expect(syncStatus.inconsistencies).toContain(
                'Outdated file format: 4.0 (expected: 5.0)'
            );
            expect(syncStatus.inconsistencies).toContain(
                expect.stringContaining('Git branch project "differentproject" doesn\'t match session project "problemproject"')
            );

            // 清理spy
            fsAccessSpy.mockRestore();
            fsReadSpy.mockRestore();
        });

        it('should handle no workspace scenario', async () => {
            // Mock没有工作区
            (vscode.workspace as any).workspaceFolders = undefined;
            
            const syncStatus = await sessionManager.checkSyncStatus();
            const statusInfo = await sessionManager.getCurrentStatusInfo();

            // 应该能正常处理无工作区的情况
            expect(statusInfo.gitBranch).toBe('No workspace');
            // 不应该因为Git检查失败而报告不一致
            expect(syncStatus.inconsistencies).not.toContain(
                expect.stringContaining('Git')
            );
        });
    });

    describe('Force Sync Integration', () => {
        it('should complete full force sync workflow', async () => {
            // === 准备测试数据 ===
            mockWithProgress.mockImplementation(async (options: any, callback: any) => {
                const mockProgress = {
                    report: jest.fn()
                };
                return await callback(mockProgress);
            });

            // 创建项目会话
            const testSession = await sessionManager.createNewSession('syncproject');
            
            // Mock Git和文件系统
            mockGetCurrentBranch.mockResolvedValue('SRS/syncproject');
            const fsAccessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
            const fsReadSpy = jest.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify({
                fileVersion: '5.0',
                currentSession: testSession,
                operations: [],
                timeRange: {
                    startDate: '2024-01-01',
                    endDate: '2024-01-16'
                },
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }));

            // === 模拟执行强制同步 ===
            const { performForcedSync } = require('../../extension');
            
            // 由于我们无法直接访问 performForcedSync，我们测试其组成部分
            await sessionManager.autoInitialize();
            sessionManager.forceNotifyObservers();
            const syncStatus = await sessionManager.checkSyncStatus();
            const statusInfo = await sessionManager.getCurrentStatusInfo();

            // === 验证结果 ===
            expect(syncStatus.isConsistent).toBe(true);
            expect(statusInfo.projectName).toBe('syncproject');
            expect(statusInfo.gitBranch).toBe('SRS/syncproject');

            // 清理spy
            fsAccessSpy.mockRestore();
            fsReadSpy.mockRestore();
        });
    });

    describe('Edge Cases and Error Scenarios', () => {
        it('should handle corrupted session files during sync check', async () => {
            // 创建项目会话
            await sessionManager.createNewSession('corruptproject');
            
            // Mock文件存在但内容损坏
            const fsAccessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
            const fsReadSpy = jest.spyOn(fs.promises, 'readFile').mockResolvedValue('invalid json content');

            mockGetCurrentBranch.mockResolvedValue('SRS/corruptproject');

            const syncStatus = await sessionManager.checkSyncStatus();

            expect(syncStatus.isConsistent).toBe(false);
            expect(syncStatus.inconsistencies).toContain(
                expect.stringContaining('Project session consistency check failed')
            );

            // 清理spy
            fsAccessSpy.mockRestore();
            fsReadSpy.mockRestore();
        });

        it('should handle file system permission errors', async () => {
            // 创建项目会话
            await sessionManager.createNewSession('permissionproject');
            
            // Mock文件访问权限错误
            const fsAccessSpy = jest.spyOn(fs.promises, 'access').mockRejectedValue(new Error('Permission denied'));

            mockGetCurrentBranch.mockResolvedValue('SRS/permissionproject');

            const syncStatus = await sessionManager.checkSyncStatus();

            expect(syncStatus.isConsistent).toBe(false);
            expect(syncStatus.inconsistencies).toContain(
                'Project session file not found: permissionproject'
            );

            // 清理spy
            fsAccessSpy.mockRestore();
        });

        it('should provide meaningful status info even with errors', async () => {
            // 创建项目会话
            await sessionManager.createNewSession('errorproject');
            
            // Mock各种错误情况
            mockGetCurrentBranch.mockRejectedValue(new Error('Git error'));
            const fsAccessSpy = jest.spyOn(fs.promises, 'access').mockRejectedValue(new Error('File error'));

            const statusInfo = await sessionManager.getCurrentStatusInfo();

            expect(statusInfo.projectName).toBe('errorproject');
            expect(statusInfo.gitBranch).toBe('Git check failed');
            expect(statusInfo.fileFormat).toBe('Format check failed');

            // 清理spy
            fsAccessSpy.mockRestore();
        });
    });
});
