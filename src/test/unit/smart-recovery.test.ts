/**
 * 智能恢复功能单元测试
 * 测试基于Git分支的会话状态恢复机制
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

describe('Smart Recovery System', () => {
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

    describe('Exit Intention Flag Management', () => {
        it('should skip smart recovery when intentional exit flag is set and valid', async () => {
            // 设置退出意图标记（1分钟内）
            const recentTimestamp = Date.now() - 30000; // 30秒前
            mockContext.globalState.get.mockReturnValue({
                timestamp: recentTimestamp,
                reason: 'user_exit_current_project'
            });

            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            await sessionManager.autoInitialize();

            // 验证跳过了智能恢复
            expect(logSpy).toHaveBeenCalledWith('🚩 Detected intentional exit, skipping smart recovery');
            expect(mockContext.globalState.update).toHaveBeenCalledWith('srs-writer.intentional-exit-flag', undefined);
        });

        it('should proceed with smart recovery when exit flag is expired', async () => {
            // 设置过期的退出意图标记（超过1分钟）
            const expiredTimestamp = Date.now() - 120000; // 2分钟前
            mockContext.globalState.get.mockReturnValue({
                timestamp: expiredTimestamp,
                reason: 'user_exit_current_project'
            });

            mockGetCurrentBranch.mockResolvedValue('main');
            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            await sessionManager.autoInitialize();

            // 验证清除了过期标记并继续智能恢复
            expect(logSpy).toHaveBeenCalledWith('🚩 Cleared expired exit flag');
            expect(logSpy).toHaveBeenCalledWith('🔍 Starting smart recovery from Git branch detection');
        });

        it('should proceed with smart recovery when no exit flag exists', async () => {
            mockContext.globalState.get.mockReturnValue(undefined);
            mockGetCurrentBranch.mockResolvedValue('main');
            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            await sessionManager.autoInitialize();

            // 验证直接进行智能恢复
            expect(logSpy).toHaveBeenCalledWith('🔍 Starting smart recovery from Git branch detection');
        });
    });

    describe('Git Branch Detection', () => {
        beforeEach(() => {
            mockContext.globalState.get.mockReturnValue(undefined); // 无退出标记
        });

        it('should load main session when on non-project branch', async () => {
            mockGetCurrentBranch.mockResolvedValue('main');
            
            // Mock主会话文件存在
            const mockFs = fs as any;
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify({
                fileVersion: '5.0',
                currentSession: {
                    sessionContextId: 'test-main-session',
                    projectName: null,
                    baseDir: null,
                    activeFiles: [],
                    metadata: { created: new Date().toISOString(), lastModified: new Date().toISOString(), version: '5.0' }
                },
                operations: [],
                timeRange: { startDate: '2024-01-01', endDate: '2024-01-16' },
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }));

            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            await sessionManager.autoInitialize();

            expect(logSpy).toHaveBeenCalledWith('🔍 Current Git branch: main');
            expect(logSpy).toHaveBeenCalledWith('🔍 Not on a project branch, attempting to load main session');
            expect(logSpy).toHaveBeenCalledWith('✅ Loaded main session successfully');
        });

        it('should restore project session when on project branch and session exists', async () => {
            mockGetCurrentBranch.mockResolvedValue('SRS/testproject');
            
            // Mock项目会话文件存在
            const mockFs = fs as any;
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify({
                fileVersion: '5.0',
                currentSession: {
                    sessionContextId: 'test-project-session',
                    projectName: 'testproject',
                    baseDir: '/test/workspace/testproject',
                    activeFiles: [],
                    metadata: { created: new Date().toISOString(), lastModified: new Date().toISOString(), version: '5.0' }
                },
                operations: [
                    {
                        timestamp: new Date().toISOString(),
                        sessionContextId: 'test-project-session',
                        type: OperationType.SESSION_CREATED,
                        operation: 'Created new project: testproject',
                        success: true
                    }
                ],
                timeRange: { startDate: '2024-01-01', endDate: '2024-01-16' },
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }));

            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            await sessionManager.autoInitialize();

            expect(logSpy).toHaveBeenCalledWith('🔍 Current Git branch: SRS/testproject');
            expect(logSpy).toHaveBeenCalledWith('🔍 Detected project branch: SRS/testproject, project: testproject');
            expect(logSpy).toHaveBeenCalledWith('🔄 Smart recovery: Loading session for project testproject');
            expect(logSpy).toHaveBeenCalledWith('✅ Smart recovery: Restored session for project testproject');

            // 验证会话已正确设置
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession).toBeTruthy();
            expect(currentSession?.projectName).toBe('testproject');
            expect(currentSession?.baseDir).toBe('/test/workspace/testproject');
        });

        it('should create new session when on project branch but no session file exists', async () => {
            mockGetCurrentBranch.mockResolvedValue('SRS/newproject');
            
            // Mock项目会话文件不存在，但创建新会话成功
            const mockFs = fs as any;
            mockFs.access.mockRejectedValue(new Error('File not found'));
            mockFs.writeFile.mockResolvedValue(undefined);
            mockFs.mkdir.mockResolvedValue(undefined);

            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            await sessionManager.autoInitialize();

            expect(logSpy).toHaveBeenCalledWith('🔍 Current Git branch: SRS/newproject');
            expect(logSpy).toHaveBeenCalledWith('🔍 Detected project branch: SRS/newproject, project: newproject');
            expect(logSpy).toHaveBeenCalledWith('🔄 Smart recovery: Creating new session for existing project newproject');
            expect(logSpy).toHaveBeenCalledWith('✅ Smart recovery: Created new session for existing project newproject');
        });

        it('should handle git branch detection errors gracefully', async () => {
            mockGetCurrentBranch.mockRejectedValue(new Error('Git command failed'));
            
            const logSpy = jest.spyOn((sessionManager as any).logger, 'warn');

            await sessionManager.autoInitialize();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Smart recovery failed: Git command failed'));
        });

        it('should handle missing workspace folder', async () => {
            // Mock没有工作区文件夹
            (vscode.workspace as any).workspaceFolders = undefined;
            
            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            await sessionManager.autoInitialize();

            expect(logSpy).toHaveBeenCalledWith('🔍 No workspace folder, skipping Git branch detection');
        });
    });

    describe('Legacy Session Format Compatibility', () => {
        beforeEach(() => {
            mockContext.globalState.get.mockReturnValue(undefined);
            mockGetCurrentBranch.mockResolvedValue('SRS/legacyproject');
        });

        it('should convert legacy SessionContext format to UnifiedSessionFile', async () => {
            // Mock旧格式的会话文件
            const mockFs = fs as any;
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify({
                sessionContextId: 'legacy-session',
                projectName: 'legacyproject',
                baseDir: '/test/workspace/legacyproject',
                activeFiles: [],
                metadata: { 
                    created: '2024-01-01T00:00:00.000Z', 
                    lastModified: '2024-01-01T01:00:00.000Z', 
                    version: '4.0' 
                }
            }));

            const logSpy = jest.spyOn((sessionManager as any).logger, 'info');

            await sessionManager.autoInitialize();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Converting legacy session format to unified format'));
            expect(logSpy).toHaveBeenCalledWith('✅ Smart recovery: Restored session for project legacyproject');

            // 验证会话已正确转换和加载
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession).toBeTruthy();
            expect(currentSession?.projectName).toBe('legacyproject');
        });
    });

    describe('Error Handling and Fallbacks', () => {
        beforeEach(() => {
            mockContext.globalState.get.mockReturnValue(undefined);
        });

        it('should not throw errors even when smart recovery completely fails', async () => {
            mockGetCurrentBranch.mockRejectedValue(new Error('Catastrophic failure'));
            
            const logSpy = jest.spyOn((sessionManager as any).logger, 'error');

            // 应该不抛出异常
            await expect(sessionManager.autoInitialize()).resolves.not.toThrow();
            
            expect(logSpy).toHaveBeenCalledWith('Smart recovery failed, but continuing startup', expect.any(Error));
        });

        it('should fallback to main session when project session loading fails', async () => {
            mockGetCurrentBranch.mockResolvedValue('SRS/failproject');
            
            const mockFs = fs as any;
            // 第一次access调用（项目会话文件）失败
            // 第二次access调用（主会话文件）成功
            mockFs.access
                .mockResolvedValueOnce(undefined) // 项目文件存在
                .mockResolvedValueOnce(undefined); // 主文件也存在
            
            // 项目会话文件读取失败，主会话文件读取成功
            mockFs.readFile
                .mockRejectedValueOnce(new Error('Corrupted file'))
                .mockResolvedValueOnce(JSON.stringify({
                    fileVersion: '5.0',
                    currentSession: null,
                    operations: [],
                    timeRange: { startDate: '2024-01-01', endDate: '2024-01-16' },
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                }));

            const logSpy = jest.spyOn((sessionManager as any).logger, 'warn');

            await sessionManager.autoInitialize();

            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Smart recovery failed'));
        });
    });
});
