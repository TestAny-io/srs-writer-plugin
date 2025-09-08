/**
 * 完整的项目切换集成测试
 * 模拟真实的项目切换+gitBranch更新流程
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

describe('Complete Project Switch Integration', () => {
    let sessionManager: SessionManager;
    let mockContext: vscode.ExtensionContext;
    let mockFs: jest.Mocked<typeof fs>;
    let mockFsSync: jest.Mocked<typeof fsSync>;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockContext = {
            subscriptions: [],
            workspaceState: { get: jest.fn(), update: jest.fn() },
            globalState: { get: jest.fn(), update: jest.fn() },
            globalStoragePath: '/test/global/storage',
            extensionPath: '/test/extension/path'
        } as any;

        mockFs = fs as jest.Mocked<typeof fs>;
        mockFsSync = fsSync as jest.Mocked<typeof fsSync>;
        
        mockFsSync.existsSync.mockReturnValue(true);
        mockFsSync.mkdirSync.mockReturnValue(undefined);
        
        sessionManager = SessionManager.getInstance(mockContext);
        
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
        (SessionManager as any)._instance = null;
    });

    describe('End-to-End Project Switch with GitBranch Update', () => {
        it('should complete full project switch flow without losing history data', async () => {
            // 步骤1：设置项目A的session
            const projectASession = {
                sessionContextId: 'project-a-session-id',
                projectName: 'projectA',
                baseDir: '/test/workspace/projectA',
                activeFiles: ['a1.md', 'a2.md'],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T08:00:00.000Z',
                    lastModified: '2024-01-01T08:30:00.000Z',
                    version: '5.0'
                }
            };
            sessionManager['currentSession'] = projectASession;

            // 步骤2：设置项目B的现有session文件（包含历史数据）
            const projectBSession = {
                sessionContextId: 'project-b-session-id',
                projectName: 'BlackpinkWebapp',
                baseDir: '/test/workspace/BlackpinkWebapp',
                activeFiles: ['index.html', 'style.css', 'app.js'],
                gitBranch: 'main',
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T07:00:00.000Z',
                    lastModified: '2024-01-01T07:45:00.000Z',
                    version: '5.0'
                }
            };

            const projectBOperations: OperationLogEntry[] = [
                {
                    timestamp: '2024-01-01T07:00:00.000Z',
                    type: OperationType.SESSION_CREATED,
                    sessionContextId: 'project-b-session-id',
                    operation: 'Created BlackpinkWebapp project',
                    success: true
                },
                {
                    timestamp: '2024-01-01T07:15:00.000Z',
                    type: OperationType.FILE_CREATED,
                    sessionContextId: 'project-b-session-id',
                    operation: 'Created index.html',
                    success: true
                },
                {
                    timestamp: '2024-01-01T07:30:00.000Z',
                    type: OperationType.FILE_CREATED,
                    sessionContextId: 'project-b-session-id',
                    operation: 'Created style.css',
                    success: true
                },
                {
                    timestamp: '2024-01-01T07:45:00.000Z',
                    type: OperationType.FILE_CREATED,
                    sessionContextId: 'project-b-session-id',
                    operation: 'Created app.js',
                    success: true
                }
            ];

            const projectBUnifiedFile: UnifiedSessionFile = {
                fileVersion: '5.0',
                currentSession: projectBSession,
                operations: projectBOperations,
                timeRange: { startDate: '2024-01-01', endDate: '2024-01-15' },
                createdAt: '2024-01-01T07:00:00.000Z',
                lastUpdated: '2024-01-01T07:45:00.000Z'
            };

            // Mock文件系统 - 需要为每次调用返回正确的内容
            mockFs.access.mockResolvedValue(undefined);
            
            // 第一次readFile调用（switchToProjectSession时）返回项目B的文件
            // 后续的readFile调用（updateSession时）返回已经包含PROJECT_SWITCHED的文件
            let callCount = 0;
            mockFs.readFile.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // 第一次调用：返回原始的项目B文件
                    return Promise.resolve(JSON.stringify(projectBUnifiedFile));
                } else {
                    // 后续调用：返回已经包含PROJECT_SWITCHED的文件
                    const updatedFile = {
                        ...projectBUnifiedFile,
                        operations: [
                            ...projectBUnifiedFile.operations,
                            {
                                timestamp: new Date().toISOString(),
                                type: OperationType.PROJECT_SWITCHED,
                                sessionContextId: 'project-b-session-id',
                                operation: 'Switched to existing project: BlackpinkWebapp (from: projectA)',
                                success: true
                            }
                        ]
                    };
                    return Promise.resolve(JSON.stringify(updatedFile));
                }
            });
            
            mockFs.writeFile.mockResolvedValue(undefined);

            // 步骤3：执行项目切换（模拟extension.ts中的调用）
            console.log('🔄 Step 1: Switching from projectA to BlackpinkWebapp...');
            await sessionManager.switchToProjectSession('BlackpinkWebapp');

            // 步骤4：执行gitBranch更新（模拟extension.ts:1059的调用）
            console.log('🌿 Step 2: Updating gitBranch to wip...');
            await sessionManager.updateSession({
                gitBranch: 'wip'
            });

            // 步骤5：验证最终结果
            console.log('✅ Step 3: Verifying final state...');

            // 验证当前session状态
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('BlackpinkWebapp');
            expect(currentSession?.sessionContextId).toBe('project-b-session-id');
            expect(currentSession?.gitBranch).toBe('wip'); // gitBranch应该被正确更新
            expect(currentSession?.activeFiles).toEqual(['index.html', 'style.css', 'app.js']); // 保留原有文件

            // 验证文件写入
            expect(mockFs.writeFile).toHaveBeenCalled();
            
            // 获取最后一次写入的内容（应该是gitBranch更新后的内容）
            const lastWriteCall = mockFs.writeFile.mock.calls[mockFs.writeFile.mock.calls.length - 1];
            const finalContent = JSON.parse(lastWriteCall[1] as string) as UnifiedSessionFile;

            // 🎯 关键验证：最终文件应该是UnifiedSessionFile格式
            expect(finalContent.fileVersion).toBe('5.0');
            expect(finalContent.currentSession).toBeDefined();
            expect(finalContent.operations).toBeDefined();
            expect(Array.isArray(finalContent.operations)).toBe(true);

            // 验证历史operations完全保留
            expect(finalContent.operations.length).toBeGreaterThanOrEqual(4); // 原有4个 + 新的日志
            
            // 验证原有的历史operations还在
            const originalOps = finalContent.operations.slice(0, 4);
            expect(originalOps[0].operation).toBe('Created BlackpinkWebapp project');
            expect(originalOps[1].operation).toBe('Created index.html');
            expect(originalOps[2].operation).toBe('Created style.css');
            expect(originalOps[3].operation).toBe('Created app.js');

            // 验证添加了新的操作日志
            const newOps = finalContent.operations.slice(4);
            console.log(`New operations count: ${newOps.length}`);
            console.log(`All operations types:`, finalContent.operations.map(op => op.type));
            console.log(`New operations:`, newOps.map(op => ({ type: op.type, operation: op.operation })));
            
            const hasProjectSwitched = newOps.some(op => op.type === OperationType.PROJECT_SWITCHED);
            const hasSessionUpdated = newOps.some(op => op.type === OperationType.SESSION_UPDATED);
            
            console.log(`Has PROJECT_SWITCHED: ${hasProjectSwitched}`);
            console.log(`Has SESSION_UPDATED: ${hasSessionUpdated}`);
            
            expect(hasProjectSwitched).toBe(true);
            expect(hasSessionUpdated).toBe(true);

            // 验证currentSession被正确更新
            expect(finalContent.currentSession?.projectName).toBe('BlackpinkWebapp');
            expect(finalContent.currentSession?.sessionContextId).toBe('project-b-session-id');
            expect(finalContent.currentSession?.gitBranch).toBe('wip');
            expect(finalContent.currentSession?.activeFiles).toEqual(['index.html', 'style.css', 'app.js']);

            // 🚨 关键验证：确保不是旧的SessionContext格式
            expect((finalContent as any).sessionContextId).toBeUndefined(); // SessionContext格式才有这个字段
            expect((finalContent as any).savedAt).toBeUndefined(); // SessionContext格式才有这个字段
            expect((finalContent as any).projectName).toBeUndefined(); // SessionContext格式才有这个字段

            console.log('✅ All verifications passed!');
        });
    });
});
