import { SessionManager } from '../../core/session-manager';
import { SessionContext } from '../../types/session';
import * as vscode from 'vscode';

// Mock VSCode API
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: {
                fsPath: '/test/workspace'
            }
        }]
    }
}));

// Mock fs module
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    unlinkSync: jest.fn()
}));

describe('SessionManager v1.2 - 原子更新测试', () => {
    let sessionManager: SessionManager;
    let mockFs: any;

    beforeEach(() => {
        sessionManager = new SessionManager();
        mockFs = require('fs');
        
        // 重置所有mock
        jest.clearAllMocks();
        
        // 设置默认的fs行为
        mockFs.existsSync.mockReturnValue(false);
    });

    describe('原子更新功能', () => {
        test('应该创建新会话', async () => {
            const projectName = 'test-project';
            const session = await sessionManager.createNewSession(projectName);

            expect(session).toBeDefined();
            expect(session.projectName).toBe(projectName);
            expect(session.metadata.version).toBe('1.2');
            expect(session.metadata.srsVersion).toBe('v1.0');
            expect(session.activeFiles).toEqual([]);
        });

        test('应该原子性地更新会话状态', async () => {
            // 创建初始会话
            const initialSession = await sessionManager.createNewSession('initial-project');
            
            // 更新会话
            await sessionManager.updateSession({
                projectName: 'updated-project',
                lastIntent: 'edit'
            });

            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('updated-project');
            expect(currentSession?.lastIntent).toBe('edit');
            expect(currentSession?.activeFiles).toEqual([]); // 应该保持原有值
        });

        test('应该深度合并metadata', async () => {
            const initialSession = await sessionManager.createNewSession('test-project');
            const originalCreated = initialSession.metadata.created;

            // 更新metadata的部分字段
            await sessionManager.updateSession({
                metadata: {
                    ...initialSession.metadata,
                    version: '1.3'
                } as any
            });

            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.metadata.version).toBe('1.3');
            expect(currentSession?.metadata.created).toBe(originalCreated); // 应该保持原有值
            expect(currentSession?.metadata.lastModified).toBeDefined(); // 应该被更新
        });

        test('应该处理多个字段的同时更新', async () => {
            await sessionManager.createNewSession('test-project');

            const updates = {
                projectName: 'multi-update-project',
                lastIntent: 'create' as const,
                activeFiles: ['file1.md', 'file2.yaml'],
                baseDir: '/new/base/dir'
            };

            await sessionManager.updateSession(updates);

            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('multi-update-project');
            expect(currentSession?.lastIntent).toBe('create');
            expect(currentSession?.activeFiles).toEqual(['file1.md', 'file2.yaml']);
            expect(currentSession?.baseDir).toBe('/new/base/dir');
        });

        test('当没有活跃会话时应该警告', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            await sessionManager.updateSession({
                projectName: 'should-not-work'
            });

            // 应该没有创建会话
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession).toBeNull();
            
            consoleSpy.mockRestore();
        });
    });

    describe('会话持久化', () => {
        test('应该保存会话到文件', async () => {
            sessionManager.createNewSession('persistence-test');
            
            await sessionManager.saveSessionToFile();
            
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('srs-writer-session.json'),
                expect.stringContaining('persistence-test'),
                'utf8'
            );
        });

        test('应该从文件加载会话', async () => {
            const mockSessionData = {
                projectName: 'loaded-project',
                baseDir: '/test/dir',
                lastIntent: 'create',
                activeFiles: ['test.md'],
                metadata: {
                    created: '2023-01-01T00:00:00.000Z',
                    lastModified: '2023-01-01T01:00:00.000Z',
                    version: '1.2'
                }
            };

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(mockSessionData));

            const loadedSession = await sessionManager.loadSessionFromFile();

            expect(loadedSession).toBeDefined();
            expect(loadedSession?.projectName).toBe('loaded-project');
            expect(sessionManager.getCurrentSession()).toEqual(loadedSession);
        });
    });

    describe('会话状态管理', () => {
        test('应该正确检测会话过期', async () => {
            const session = await sessionManager.createNewSession('expiry-test');
            
            // 模拟一个很久以前的会话
            session.metadata.created = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25小时前

            expect(await sessionManager.isSessionExpired()).toBe(true);
            expect(await sessionManager.isSessionExpired(48)).toBe(false); // 48小时的过期时间
        });

        test('应该生成正确的会话摘要', async () => {
            await sessionManager.createNewSession('summary-test');
            await sessionManager.updateSession({
                lastIntent: 'edit',
                activeFiles: ['file1.md', 'file2.yaml']
            });

            const summary = await sessionManager.getSessionSummary();
            
            expect(summary).toContain('summary-test');
            expect(summary).toContain('edit');
            expect(summary).toContain('2');
        });

        test('无会话时应该返回适当的摘要', async () => {
            const summary = await sessionManager.getSessionSummary();
            expect(summary).toBe('No active session');
        });
    });
}); 