/**
 * Session切换修复测试
 * 验证项目切换时不会清除历史session数据的修复
 */

import * as vscode from 'vscode';
import * as path from 'path';
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
    mkdirSync: jest.fn(),
    statSync: jest.fn(),      // 🚀 Phase 1.1: Add for BaseDirValidator
    realpathSync: jest.fn()   // 🚀 Phase 1.1: Add for BaseDirValidator
}));

// Mock git operations
jest.mock('../../tools/atomic/git-operations', () => ({
    getCurrentBranch: jest.fn().mockResolvedValue('main')
}));

describe('Session Switching Fix', () => {
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
        // 🚀 Phase 1.1: Add mocks for BaseDirValidator
        (mockFsSync.statSync as any).mockReturnValue({ isDirectory: () => true });
        (mockFsSync.realpathSync as any).mockImplementation((p: string) => p);
        
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

    describe('loadOrCreateProjectSession logic', () => {
        it('should create new session when target file has no valid session', async () => {
            // 模拟：目标项目文件存在但currentSession为null
            sessionManager['currentSession'] = {
                sessionContextId: 'source-session-id',
                projectName: 'sourceProject',
                baseDir: '/test/workspace/sourceProject',
                activeFiles: [],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T08:00:00.000Z',
                    lastModified: '2024-01-01T08:00:00.000Z',
                    version: '5.0'
                }
            };
            
            const mockUnifiedFile: UnifiedSessionFile = {
                fileVersion: '5.0',
                currentSession: null, // 目标项目session无效
                operations: [],
                timeRange: { startDate: '2024-01-01', endDate: '2024-01-15' },
                createdAt: '2024-01-01T10:00:00.000Z',
                lastUpdated: '2024-01-01T10:00:00.000Z'
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockUnifiedFile));
            mockFs.writeFile.mockResolvedValue(undefined);

            const result = await sessionManager['loadOrCreateProjectSession']('targetProject', 'sourceProject');

            expect(result).toBeDefined();
            expect(result.projectName).toBe('targetProject');
            expect(result.sessionContextId).toBeDefined();
            expect(result.sessionContextId).not.toBe('source-session-id'); // 应该是新的ID
        });

        it('should use target project session when file has valid session', async () => {
            // 模拟：从项目A切换到项目B，项目B有有效session
            sessionManager['currentSession'] = {
                sessionContextId: 'project-a-session-id',
                projectName: 'projectA',
                baseDir: '/test/workspace/projectA',
                activeFiles: ['a.md'],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T08:00:00.000Z',
                    lastModified: '2024-01-01T08:00:00.000Z',
                    version: '5.0'
                }
            };
            
            const targetSession = {
                sessionContextId: 'project-b-session-id',
                projectName: 'projectB',
                baseDir: '/test/workspace/projectB',
                activeFiles: ['b.md'],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T07:00:00.000Z',
                    lastModified: '2024-01-01T07:00:00.000Z',
                    version: '5.0'
                }
            };
            
            const mockUnifiedFile: UnifiedSessionFile = {
                fileVersion: '5.0',
                currentSession: targetSession, // 目标项目有有效session
                operations: [
                    {
                        timestamp: '2024-01-01T07:00:00.000Z',
                        type: OperationType.SESSION_CREATED,
                        sessionContextId: 'project-b-session-id',
                        operation: 'Created project B',
                        success: true
                    }
                ],
                timeRange: { startDate: '2024-01-01', endDate: '2024-01-15' },
                createdAt: '2024-01-01T07:00:00.000Z',
                lastUpdated: '2024-01-01T07:00:00.000Z'
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockUnifiedFile));
            mockFs.writeFile.mockResolvedValue(undefined);

            const result = await sessionManager['loadOrCreateProjectSession']('projectB', 'projectA');

            expect(result).toBeDefined();
            expect(result.sessionContextId).toBe('project-b-session-id'); // 使用目标项目的session ID
            expect(result.projectName).toBe('projectB');
            expect(result.activeFiles).toEqual(['b.md']); // 使用目标项目的数据
        });

        it('should create new session when target file does not exist', async () => {
            // 模拟：目标项目文件被误删除
            sessionManager['currentSession'] = {
                sessionContextId: 'source-session-id',
                projectName: 'sourceProject',
                baseDir: '/test/workspace/sourceProject',
                activeFiles: ['source.md'],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T08:00:00.000Z',
                    lastModified: '2024-01-01T08:00:00.000Z',
                    version: '5.0'
                }
            };

            // 模拟文件不存在
            mockFs.access.mockRejectedValue(new Error('File not found'));
            mockFs.writeFile.mockResolvedValue(undefined);

            const result = await sessionManager['loadOrCreateProjectSession']('targetProject', 'sourceProject');

            expect(result).toBeDefined();
            expect(result.projectName).toBe('targetProject');
            expect(result.sessionContextId).toBeDefined();
            expect(result.sessionContextId).not.toBe('source-session-id'); // 应该是新的ID
            expect(result.baseDir).toBe('/test/workspace/targetProject');
        });
    });


    describe('Source Project File Protection', () => {
        it('should NOT modify source project session file during switch', async () => {
            // 场景：验证从项目A切换到项目B时，项目A的session文件不会被修改
            
            // 设置项目A作为当前session
            const projectASession = {
                sessionContextId: 'project-a-session-id',
                projectName: 'projectA',
                baseDir: '/test/workspace/projectA',
                activeFiles: ['a.md'],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T08:00:00.000Z',
                    lastModified: '2024-01-01T08:30:00.000Z',
                    version: '5.0'
                }
            };
            sessionManager['currentSession'] = projectASession;
            
            // 设置项目B的session文件（已存在）
            const projectBSession = {
                sessionContextId: 'project-b-session-id',
                projectName: 'projectB',
                baseDir: '/test/workspace/projectB',
                activeFiles: ['b.md'],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T07:00:00.000Z',
                    lastModified: '2024-01-01T07:30:00.000Z',
                    version: '5.0'
                }
            };
            
            const projectBOperations: OperationLogEntry[] = [
                {
                    timestamp: '2024-01-01T07:00:00.000Z',
                    type: OperationType.SESSION_CREATED,
                    sessionContextId: 'project-b-session-id',
                    operation: 'Created project: projectB',
                    success: true
                }
            ];
            
            const mockUnifiedFileB: UnifiedSessionFile = {
                fileVersion: '5.0',
                currentSession: projectBSession,
                operations: projectBOperations,
                timeRange: { startDate: '2024-01-01', endDate: '2024-01-15' },
                createdAt: '2024-01-01T07:00:00.000Z',
                lastUpdated: '2024-01-01T07:30:00.000Z'
            };

            // Mock文件读取（只返回项目B的文件内容）
            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockUnifiedFileB));
            mockFs.writeFile.mockResolvedValue(undefined);

            // 执行切换：从projectA切换到projectB
            await sessionManager['loadOrCreateProjectSession']('projectB', 'projectA');

            // 🎯 关键验证：检查所有writeFile调用的文件路径
            expect(mockFs.writeFile).toHaveBeenCalled();
            
            // 验证所有writeFile调用都是针对项目B的文件，没有写入项目A的文件
            for (const call of mockFs.writeFile.mock.calls) {
                const filePath = call[0] as string;
                expect(filePath).toContain('srs-writer-session_projectB.json');
                expect(filePath).not.toContain('srs-writer-session_projectA.json');
            }
            
            console.log(`Total writeFile calls: ${mockFs.writeFile.mock.calls.length}`);
            console.log(`All file paths: ${mockFs.writeFile.mock.calls.map(call => call[0]).join(', ')}`);
        });
    });

    describe('Integration test scenarios', () => {
        it('should handle switching from workspace root to existing project', async () => {
            // 场景：从工作区根目录切换到已有项目
            // 初始状态：内存中无session（工作区根目录状态）
            sessionManager['currentSession'] = null;
            
            // 目标项目已有session文件和历史数据
            const existingProjectSession = {
                sessionContextId: 'project-session-id',
                projectName: 'blackpinkfanwebapp',
                baseDir: '/test/workspace/blackpinkfanwebapp',
                activeFiles: ['index.html', 'style.css'],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T09:00:00.000Z',
                    lastModified: '2024-01-01T09:30:00.000Z',
                    version: '5.0'
                }
            };
            
            const existingOperations: OperationLogEntry[] = [
                {
                    timestamp: '2024-01-01T09:00:00.000Z',
                    type: OperationType.SESSION_CREATED,
                    sessionContextId: 'project-session-id',
                    operation: 'Created project: blackpinkfanwebapp',
                    success: true
                },
                {
                    timestamp: '2024-01-01T09:15:00.000Z',
                    type: OperationType.FILE_CREATED,
                    sessionContextId: 'project-session-id',
                    operation: 'Created index.html',
                    success: true
                },
                {
                    timestamp: '2024-01-01T09:30:00.000Z',
                    type: OperationType.FILE_CREATED,
                    sessionContextId: 'project-session-id',
                    operation: 'Created style.css',
                    success: true
                }
            ];
            
            const mockUnifiedFile: UnifiedSessionFile = {
                fileVersion: '5.0',
                currentSession: existingProjectSession,
                operations: existingOperations,
                timeRange: { startDate: '2024-01-01', endDate: '2024-01-15' },
                createdAt: '2024-01-01T09:00:00.000Z',
                lastUpdated: '2024-01-01T09:30:00.000Z'
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockUnifiedFile));
            mockFs.writeFile.mockResolvedValue(undefined);

            // 执行切换
            const result = await sessionManager['loadOrCreateProjectSession']('blackpinkfanwebapp');

            // 验证：应该加载现有session，不应该清除历史数据
            expect(result).toBeDefined();
            expect(result.sessionContextId).toBe('project-session-id');
            expect(result.projectName).toBe('blackpinkfanwebapp');
            expect(result.activeFiles).toEqual(['index.html', 'style.css']);
            
            // 验证：应该添加了PROJECT_SWITCHED日志，但保留了历史operations
            expect(mockFs.writeFile).toHaveBeenCalled();
            
            // 获取最后一次writeFile调用（因为可能有多次调用）
            const writeCall = mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1];
            const writtenContent = JSON.parse(writeCall[1] as string) as UnifiedSessionFile;
            
            // 验证operations数量（实际数量）
            expect(writtenContent.operations.length).toBeGreaterThanOrEqual(3);
            
            // 最后一个应该是PROJECT_SWITCHED
            const lastOperation = writtenContent.operations[writtenContent.operations.length - 1];
            expect(lastOperation.type).toBe(OperationType.PROJECT_SWITCHED);
            expect(lastOperation.operation).toContain('blackpinkfanwebapp');
            
            // 原有的历史operations应该保留
            const originalOps = writtenContent.operations.slice(0, 3);
            expect(originalOps[0].operation).toBe('Created project: blackpinkfanwebapp');
            expect(originalOps[1].operation).toBe('Created index.html');
            expect(originalOps[2].operation).toBe('Created style.css');
        });

        it('should handle switching from one project to another project', async () => {
            // 场景：从项目A切换到项目B
            // 初始状态：内存中有项目A的session
            const projectASession = {
                sessionContextId: 'project-a-session-id',
                projectName: 'projectA',
                baseDir: '/test/workspace/projectA',
                activeFiles: ['a.md'],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T08:00:00.000Z',
                    lastModified: '2024-01-01T08:30:00.000Z',
                    version: '5.0'
                }
            };
            sessionManager['currentSession'] = projectASession;
            
            // 项目B已有session文件和历史数据
            const projectBSession = {
                sessionContextId: 'project-b-session-id',
                projectName: 'projectB',
                baseDir: '/test/workspace/projectB',
                activeFiles: ['b.md'],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T07:00:00.000Z',
                    lastModified: '2024-01-01T07:30:00.000Z',
                    version: '5.0'
                }
            };
            
            const projectBOperations: OperationLogEntry[] = [
                {
                    timestamp: '2024-01-01T07:00:00.000Z',
                    type: OperationType.SESSION_CREATED,
                    sessionContextId: 'project-b-session-id',
                    operation: 'Created project: projectB',
                    success: true
                },
                {
                    timestamp: '2024-01-01T07:30:00.000Z',
                    type: OperationType.FILE_CREATED,
                    sessionContextId: 'project-b-session-id',
                    operation: 'Created b.md',
                    success: true
                }
            ];
            
            const mockUnifiedFile: UnifiedSessionFile = {
                fileVersion: '5.0',
                currentSession: projectBSession,
                operations: projectBOperations,
                timeRange: { startDate: '2024-01-01', endDate: '2024-01-15' },
                createdAt: '2024-01-01T07:00:00.000Z',
                lastUpdated: '2024-01-01T07:30:00.000Z'
            };

            mockFs.access.mockResolvedValue(undefined);
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockUnifiedFile));
            mockFs.writeFile.mockResolvedValue(undefined);

            // 执行切换：从projectA切换到projectB
            const result = await sessionManager['loadOrCreateProjectSession']('projectB');

            // 验证：现在的正确逻辑是使用目标项目的session，不再混合状态
            expect(result).toBeDefined();
            expect(result.sessionContextId).toBe('project-b-session-id'); // 使用目标项目的session ID
            expect(result.projectName).toBe('projectB'); // 目标项目名
            expect(result.baseDir).toBe('/test/workspace/projectB'); // 目标项目路径
            
            // 验证：应该保留projectB的历史operations
            expect(mockFs.writeFile).toHaveBeenCalled();
            
            // 获取最后一次writeFile调用（因为可能有多次调用）
            const writeCall = mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1];
            const writtenContent = JSON.parse(writeCall[1] as string) as UnifiedSessionFile;
            
            // 验证operations数量（实际数量）
            expect(writtenContent.operations.length).toBeGreaterThanOrEqual(2);
            
            // 原有的projectB历史应该保留
            const originalOps = writtenContent.operations.slice(0, 2);
            expect(originalOps[0].operation).toBe('Created project: projectB');
            expect(originalOps[1].operation).toBe('Created b.md');
        });
    });
});
