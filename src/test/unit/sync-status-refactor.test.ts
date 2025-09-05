/**
 * 同步状态检查功能重构测试
 * 测试新的UnifiedSessionFile格式支持和增强的状态检查逻辑
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
import { SessionManager } from '../../core/session-manager';
import { SessionContext, OperationType } from '../../types/session';

// Mock vscode模块
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }]
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

describe('Sync Status Check Refactor', () => {
    let sessionManager: SessionManager;
    let mockContext: any;
    let mockGetCurrentBranch: jest.MockedFunction<any>;

    beforeEach(() => {
        // 重置所有mocks
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

    afterEach(() => {
        jest.resetModules();
    });

    describe('Enhanced checkSyncStatus', () => {
        it('should check project session consistency when project exists', async () => {
            // 创建项目会话
            const testSession = await sessionManager.createNewSession('testproject');
            
            // Mock项目会话文件存在且一致
            const mockFs = fs as any;
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify({
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

            mockGetCurrentBranch.mockResolvedValue('SRS/testproject');

            const syncStatus = await sessionManager.checkSyncStatus();

            expect(syncStatus.isConsistent).toBe(true);
            expect(syncStatus.inconsistencies).toHaveLength(0);
        });

        it('should detect project name inconsistency', async () => {
            // 创建项目会话
            const testSession = await sessionManager.createNewSession('testproject');
            
            // Mock项目会话文件存在但项目名不一致
            const mockFs = fs as any;
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify({
                fileVersion: '5.0',
                currentSession: {
                    ...testSession,
                    projectName: 'differentproject' // 不一致的项目名
                },
                operations: [],
                timeRange: {
                    startDate: '2024-01-01',
                    endDate: '2024-01-16'
                },
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }));

            mockGetCurrentBranch.mockResolvedValue('SRS/testproject');

            const syncStatus = await sessionManager.checkSyncStatus();

            expect(syncStatus.isConsistent).toBe(false);
            expect(syncStatus.inconsistencies).toContain(
                expect.stringContaining('Project name mismatch')
            );
        });

        it('should detect Git branch inconsistency', async () => {
            // 创建项目会话
            const testSession = await sessionManager.createNewSession('testproject');
            
            // Mock项目会话文件一致
            const mockFs = fs as any;
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify({
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

            // Git分支与项目不匹配
            mockGetCurrentBranch.mockResolvedValue('SRS/differentproject');

            const syncStatus = await sessionManager.checkSyncStatus();

            expect(syncStatus.isConsistent).toBe(false);
            expect(syncStatus.inconsistencies).toContain(
                expect.stringContaining('Git branch project "differentproject" doesn\'t match session project "testproject"')
            );
        });

        it('should detect main branch with project session inconsistency', async () => {
            // 创建项目会话
            await sessionManager.createNewSession('testproject');
            
            // Mock项目会话文件一致
            const mockFs = fs as any;
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify({
                fileVersion: '5.0',
                currentSession: {
                    sessionContextId: 'test-id',
                    projectName: 'testproject',
                    baseDir: '/test/workspace/testproject',
                    activeFiles: [],
                    metadata: {
                        created: new Date().toISOString(),
                        lastModified: new Date().toISOString(),
                        version: '5.0'
                    }
                },
                operations: [],
                timeRange: {
                    startDate: '2024-01-01',
                    endDate: '2024-01-16'
                },
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }));

            // 在主分支但有项目会话
            mockGetCurrentBranch.mockResolvedValue('main');

            const syncStatus = await sessionManager.checkSyncStatus();

            expect(syncStatus.isConsistent).toBe(false);
            expect(syncStatus.inconsistencies).toContain(
                expect.stringContaining('On main branch "main" but session has project "testproject"')
            );
        });

        it('should detect outdated file format', async () => {
            // 创建项目会话
            const testSession = await sessionManager.createNewSession('testproject');
            
            // Mock旧版本格式的会话文件
            const mockFs = fs as any;
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify({
                fileVersion: '4.0', // 旧版本
                currentSession: testSession,
                operations: [],
                timeRange: {
                    startDate: '2024-01-01',
                    endDate: '2024-01-16'
                },
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }));

            mockGetCurrentBranch.mockResolvedValue('SRS/testproject');

            const syncStatus = await sessionManager.checkSyncStatus();

            expect(syncStatus.isConsistent).toBe(false);
            expect(syncStatus.inconsistencies).toContain(
                'Outdated file format: 4.0 (expected: 5.0)'
            );
        });

        it('should handle main session when no project', async () => {
            // 没有项目会话
            mockGetCurrentBranch.mockResolvedValue('main');
            
            // Mock主会话文件不存在
            const mockFs = fs as any;
            mockFs.access.mockRejectedValue(new Error('File not found'));

            const syncStatus = await sessionManager.checkSyncStatus();

            // 没有会话，没有文件，这是一致的
            expect(syncStatus.isConsistent).toBe(true);
        });

        it('should detect missing project session file', async () => {
            // 创建项目会话
            await sessionManager.createNewSession('testproject');
            
            // Mock项目会话文件不存在
            const mockFs = fs as any;
            mockFs.access.mockRejectedValue(new Error('File not found'));

            mockGetCurrentBranch.mockResolvedValue('SRS/testproject');

            const syncStatus = await sessionManager.checkSyncStatus();

            expect(syncStatus.isConsistent).toBe(false);
            expect(syncStatus.inconsistencies).toContain(
                'Project session file not found: testproject'
            );
        });
    });

    describe('getCurrentStatusInfo', () => {
        it('should return comprehensive status information', async () => {
            // 创建项目会话
            const testSession = await sessionManager.createNewSession('testproject');
            testSession.activeFiles = ['file1.md', 'file2.md'];
            
            // Mock Git分支
            mockGetCurrentBranch.mockResolvedValue('SRS/testproject');
            
            // Mock会话文件
            const mockFs = fs as any;
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify({
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

            const statusInfo = await sessionManager.getCurrentStatusInfo();

            expect(statusInfo.projectName).toBe('testproject');
            expect(statusInfo.baseDirectory).toBe(testSession.baseDir);
            expect(statusInfo.activeFiles).toBe(2);
            expect(statusInfo.gitBranch).toBe('SRS/testproject');
            expect(statusInfo.sessionId).toBe(testSession.sessionContextId);
            expect(statusInfo.fileFormat).toBe('UnifiedSessionFile v5.0');
        });

        it('should handle no project scenario', async () => {
            // 没有项目会话
            mockGetCurrentBranch.mockResolvedValue('main');

            const statusInfo = await sessionManager.getCurrentStatusInfo();

            expect(statusInfo.projectName).toBe('No project');
            expect(statusInfo.baseDirectory).toBe('No base directory');
            expect(statusInfo.activeFiles).toBe(0);
            expect(statusInfo.gitBranch).toBe('main');
            expect(statusInfo.sessionId).toBe('No session');
        });

        it('should handle Git check failures gracefully', async () => {
            // 创建项目会话
            await sessionManager.createNewSession('testproject');
            
            // Mock Git检查失败
            mockGetCurrentBranch.mockRejectedValue(new Error('Git not found'));

            const statusInfo = await sessionManager.getCurrentStatusInfo();

            expect(statusInfo.gitBranch).toBe('Git check failed');
        });

        it('should handle no workspace scenario', async () => {
            // Mock没有工作区
            (vscode.workspace as any).workspaceFolders = undefined;
            
            const statusInfo = await sessionManager.getCurrentStatusInfo();

            expect(statusInfo.gitBranch).toBe('No workspace');
        });
    });

    describe('Error Handling', () => {
        it('should handle sync check errors gracefully', async () => {
            // 创建项目会话
            await sessionManager.createNewSession('testproject');
            
            // Mock文件读取失败
            const mockFs = fs as any;
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockRejectedValue(new Error('File read error'));

            const syncStatus = await sessionManager.checkSyncStatus();

            expect(syncStatus.isConsistent).toBe(false);
            expect(syncStatus.inconsistencies).toContain(
                expect.stringContaining('Project session consistency check failed')
            );
        });

        it('should handle PathManager not available', async () => {
            // 创建项目会话
            await sessionManager.createNewSession('testproject');
            
            // Mock PathManager不可用
            (sessionManager as any).pathManager = null;

            const syncStatus = await sessionManager.checkSyncStatus();

            expect(syncStatus.isConsistent).toBe(false);
            expect(syncStatus.inconsistencies).toContain(
                'PathManager not available for project session check'
            );
        });
    });
});
