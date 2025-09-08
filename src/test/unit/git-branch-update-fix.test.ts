/**
 * GitBranch字段更新修复测试
 * 验证更新gitBranch字段不会覆盖UnifiedSessionFile格式的历史数据
 */

import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import { SessionManager } from '../../core/session-manager';
import { OperationType, UnifiedSessionFile, OperationLogEntry } from '../../types/session';

// Mock vscode
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }],
        fs: {
            readFile: jest.fn(),
            writeFile: jest.fn(),
            createDirectory: jest.fn()
        }
    },
    Uri: {
        file: jest.fn((path: string) => ({ fsPath: path }))
    },
    ExtensionContext: {}
}));

// Mock fs
jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn()
    },
    existsSync: jest.fn(),
    mkdirSync: jest.fn()
}));

// Mock git operations
jest.mock('../../tools/atomic/git-operations', () => ({
    getCurrentBranch: jest.fn().mockResolvedValue('main')
}));

describe('GitBranch Update Fix', () => {
    let sessionManager: SessionManager;
    let mockContext: vscode.ExtensionContext;
    let mockFs: jest.Mocked<typeof fs>;
    let mockFsSync: jest.Mocked<typeof fsSync>;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockContext = {
            subscriptions: [],
            workspaceState: {
                get: jest.fn(),
                update: jest.fn()
            },
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            },
            globalStoragePath: '/test/global/storage',
            extensionPath: '/test/extension/path'
        } as any;

        mockFs = fs as jest.Mocked<typeof fs>;
        mockFsSync = fsSync as jest.Mocked<typeof fsSync>;
        
        // Setup fs sync mocks
        mockFsSync.existsSync.mockReturnValue(true);
        mockFsSync.mkdirSync.mockReturnValue(undefined);
        
        sessionManager = SessionManager.getInstance(mockContext);
        
        // Mock PathManager methods
        const mockPathManager = {
            getProjectSessionPath: jest.fn((projectName: string) => 
                `/test/workspace/.session-log/srs-writer-session_${projectName}.json`
            ),
            getMainSessionPath: jest.fn(() => 
                '/test/workspace/.session-log/srs-writer-session_main.json'
            ),
            validateWorkspacePath: jest.fn(() => true),
            ensureSessionDirectory: jest.fn().mockResolvedValue(undefined)
        };
        
        sessionManager['pathManager'] = mockPathManager as any;
    });

    afterEach(() => {
        // Reset singleton
        (SessionManager as any)._instance = null;
    });

    describe('updateSession with gitBranch', () => {
        it('should preserve UnifiedSessionFile format when updating gitBranch', async () => {
            // 设置一个已有的项目session，包含历史operations
            const existingSession = {
                sessionContextId: 'test-session-id',
                projectName: 'testproject',
                baseDir: '/test/workspace/testproject',
                activeFiles: ['test1.md', 'test2.md'],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T10:00:00.000Z',
                    lastModified: '2024-01-01T10:00:00.000Z',
                    version: '5.0'
                }
            };

            const existingOperations: OperationLogEntry[] = [
                {
                    timestamp: '2024-01-01T10:00:00.000Z',
                    type: OperationType.SESSION_CREATED,
                    sessionContextId: 'test-session-id',
                    operation: 'Created test project session',
                    success: true
                },
                {
                    timestamp: '2024-01-01T10:30:00.000Z',
                    type: OperationType.FILE_CREATED,
                    sessionContextId: 'test-session-id',
                    operation: 'Created test1.md',
                    success: true
                },
                {
                    timestamp: '2024-01-01T11:00:00.000Z',
                    type: OperationType.FILE_CREATED,
                    sessionContextId: 'test-session-id',
                    operation: 'Created test2.md',
                    success: true
                }
            ];

            const existingUnifiedFile: UnifiedSessionFile = {
                fileVersion: '5.0',
                currentSession: existingSession,
                operations: existingOperations,
                timeRange: { startDate: '2024-01-01', endDate: '2024-01-15' },
                createdAt: '2024-01-01T10:00:00.000Z',
                lastUpdated: '2024-01-01T11:00:00.000Z'
            };

            // 设置当前session
            sessionManager['currentSession'] = existingSession;

            // Mock文件读取返回现有的UnifiedSessionFile
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify(existingUnifiedFile));
            mockFs.writeFile.mockResolvedValue(undefined);

            // 执行gitBranch更新（这是引发问题的操作）
            await sessionManager.updateSession({
                gitBranch: 'wip'
            });

            // 验证writeFile被调用
            expect(mockFs.writeFile).toHaveBeenCalled();
            
            // 获取写入的内容
            const writeCall = mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1];
            const writtenContent = JSON.parse(writeCall[1] as string);

            // 🎯 关键验证：写入的应该是UnifiedSessionFile格式，不是SessionContext格式
            expect(writtenContent.fileVersion).toBe('5.0');
            expect(writtenContent.currentSession).toBeDefined();
            expect(writtenContent.operations).toBeDefined();
            expect(Array.isArray(writtenContent.operations)).toBe(true);

            // 验证历史operations被保留
            expect(writtenContent.operations.length).toBeGreaterThanOrEqual(3); // 原有3个 + 新的SESSION_UPDATED

            // 验证gitBranch被正确更新
            expect(writtenContent.currentSession.gitBranch).toBe('wip');

            // 验证原有的activeFiles等数据被保留
            expect(writtenContent.currentSession.activeFiles).toEqual(['test1.md', 'test2.md']);
            expect(writtenContent.currentSession.sessionContextId).toBe('test-session-id');

            // 验证不是旧的SessionContext格式
            expect(writtenContent.sessionContextId).toBeUndefined(); // SessionContext格式会有这个字段
            expect(writtenContent.savedAt).toBeUndefined(); // SessionContext格式会有这个字段
        });

        it('should add SESSION_UPDATED log when gitBranch is changed', async () => {
            // 类似的设置
            const existingSession = {
                sessionContextId: 'test-session-id',
                projectName: 'testproject',
                baseDir: '/test/workspace/testproject',
                activeFiles: [],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T10:00:00.000Z',
                    lastModified: '2024-01-01T10:00:00.000Z',
                    version: '5.0'
                }
            };

            const existingUnifiedFile: UnifiedSessionFile = {
                fileVersion: '5.0',
                currentSession: existingSession,
                operations: [
                    {
                        timestamp: '2024-01-01T10:00:00.000Z',
                        type: OperationType.SESSION_CREATED,
                        sessionContextId: 'test-session-id',
                        operation: 'Created session',
                        success: true
                    }
                ],
                timeRange: { startDate: '2024-01-01', endDate: '2024-01-15' },
                createdAt: '2024-01-01T10:00:00.000Z',
                lastUpdated: '2024-01-01T10:00:00.000Z'
            };

            sessionManager['currentSession'] = existingSession;
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify(existingUnifiedFile));
            mockFs.writeFile.mockResolvedValue(undefined);

            await sessionManager.updateSession({
                gitBranch: 'wip'
            });

            // 验证添加了SESSION_UPDATED日志
            const writeCall = mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1];
            const writtenContent = JSON.parse(writeCall[1] as string) as UnifiedSessionFile;

            expect(writtenContent.operations.length).toBe(2); // 原有1个 + 新的SESSION_UPDATED
            
            const lastOperation = writtenContent.operations[writtenContent.operations.length - 1];
            expect(lastOperation.type).toBe(OperationType.SESSION_UPDATED);
            expect(lastOperation.operation).toContain('gitBranch');
        });
    });
});
