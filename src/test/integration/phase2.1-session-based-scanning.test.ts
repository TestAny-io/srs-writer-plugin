/**
 * 🚀 Phase 2.1 集成测试：基于会话的项目扫描与baseDir验证
 *
 * 测试目标：
 * 1. listProjectSessions() 正确扫描 .session-log/ 目录
 * 2. 返回的 ProjectSessionInfo 包含完整的 baseDir 验证信息
 * 3. baseDir 验证逻辑正确（存在检查、workspace内检查）
 * 4. 项目切换时正确阻止无效 baseDir 的项目
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SessionManager } from '../../core/session-manager';
import { Logger } from '../../utils/logger';
import { UnifiedSessionFile, SessionContext } from '../../types/session';

// Mock vscode.Uri
(vscode as any).Uri = {
    joinPath: jest.fn().mockImplementation((base, ...paths) => {
        return {
            fsPath: path.join(base.fsPath || base, ...paths),
            toString: () => path.join(base.fsPath || base, ...paths)
        };
    }),
    file: jest.fn().mockImplementation((filePath) => ({ fsPath: filePath }))
};

// Mock vscode.workspace.fs
(vscode.workspace as any).fs = {
    stat: jest.fn().mockImplementation(async (uri) => {
        const fsPath = uri.fsPath;
        try {
            const stats = fs.statSync(fsPath);
            return {
                type: stats.isFile() ? vscode.FileType.File : vscode.FileType.Directory,
                size: stats.size,
                ctime: stats.ctimeMs,
                mtime: stats.mtimeMs
            };
        } catch (error) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }),
    readDirectory: jest.fn().mockImplementation(async (uri) => {
        const fsPath = uri.fsPath;
        const files = fs.readdirSync(fsPath);
        return files.map(file => {
            const filePath = path.join(fsPath, file);
            const stats = fs.statSync(filePath);
            return [file, stats.isFile() ? vscode.FileType.File : vscode.FileType.Directory] as [string, vscode.FileType];
        });
    }),
    readFile: jest.fn().mockImplementation(async (uri) => {
        const fsPath = uri.fsPath;
        const content = fs.readFileSync(fsPath, 'utf-8');
        return Buffer.from(content, 'utf-8');
    }),
    writeFile: jest.fn().mockImplementation(async (uri, content) => {
        const fsPath = uri.fsPath;
        fs.writeFileSync(fsPath, content, 'utf-8');
    })
};

// Mock vscode.FileType
(vscode as any).FileType = {
    File: 1,
    Directory: 2,
    SymbolicLink: 64
};

// Mock vscode.FileSystemError
(vscode as any).FileSystemError = {
    FileNotFound: (uri: any) => {
        const error: any = new Error(`File not found: ${uri.fsPath}`);
        error.code = 'FileNotFound';
        return error;
    }
};

describe('Phase 2.1: 基于会话的项目扫描与baseDir验证', () => {
    let sessionManager: SessionManager;
    let mockContext: vscode.ExtensionContext;
    let tempDir: string;
    let sessionLogDir: string;
    let workspaceRoot: string;

    beforeEach(() => {
        // 创建临时目录结构
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase2.1-test-'));
        sessionLogDir = path.join(tempDir, '.session-log');
        workspaceRoot = tempDir;

        fs.mkdirSync(sessionLogDir, { recursive: true });

        // 重置 SessionManager 单例
        (SessionManager as any).instance = null;

        // 创建 mock context
        mockContext = {
            extensionPath: '/mock/extension/path',
            extensionUri: { fsPath: '/mock/extension/path' } as any,
            globalStoragePath: tempDir,
            subscriptions: [],
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            },
            workspaceState: {
                get: jest.fn(),
                update: jest.fn()
            }
        } as any;

        // Mock workspace folders
        (vscode.workspace as any).workspaceFolders = [
            { uri: { fsPath: workspaceRoot } }
        ];

        // 初始化 SessionManager
        sessionManager = SessionManager.getInstance(mockContext);
    });

    afterEach(() => {
        // 清理临时目录
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (error) {
            // 忽略清理错误
        }
    });

    /**
     * 辅助函数：创建会话文件
     */
    function createSessionFile(
        projectName: string,
        baseDir: string | null,
        additionalOps: number = 0
    ): string {
        const sessionContext: SessionContext = {
            sessionContextId: `test-id-${projectName}`,
            projectName,
            baseDir,
            activeFiles: [],
            metadata: {
                srsVersion: 'v1.0',
                created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                version: '5.0'
            }
        };

        const sessionFile: UnifiedSessionFile = {
            fileVersion: '5.0',
            currentSession: sessionContext,
            operations: Array(additionalOps).fill({
                timestamp: new Date().toISOString(),
                type: 'SESSION_UPDATED',
                sessionContextId: sessionContext.sessionContextId,
                operation: 'Test operation',
                success: true
            }),
            timeRange: {
                startDate: sessionContext.metadata.created,
                endDate: sessionContext.metadata.lastModified
            },
            createdAt: sessionContext.metadata.created,
            lastUpdated: sessionContext.metadata.lastModified
        };

        const sessionFilePath = path.join(sessionLogDir, `srs-writer-session_${projectName.replace(/\s+/g, '-')}.json`);
        fs.writeFileSync(sessionFilePath, JSON.stringify(sessionFile, null, 2), 'utf-8');

        return sessionFilePath;
    }

    describe('测试1: listProjectSessions() 基本功能', () => {
        test('应该能扫描 .session-log/ 目录并返回项目列表', async () => {
            // 创建3个有效项目
            const validBaseDir1 = path.join(workspaceRoot, 'project-a');
            const validBaseDir2 = path.join(workspaceRoot, 'project-b');
            const validBaseDir3 = path.join(workspaceRoot, 'project-c');

            fs.mkdirSync(validBaseDir1, { recursive: true });
            fs.mkdirSync(validBaseDir2, { recursive: true });
            fs.mkdirSync(validBaseDir3, { recursive: true });

            createSessionFile('project-a', validBaseDir1, 10);
            createSessionFile('project-b', validBaseDir2, 5);
            createSessionFile('project-c', validBaseDir3, 20);

            // 执行扫描
            const projects = await sessionManager.listProjectSessions();

            // 验证
            expect(projects).toHaveLength(3);
            expect(projects.map(p => p.projectName).sort()).toEqual(['project-a', 'project-b', 'project-c']);
        });

        test('应该能正确读取项目元数据', async () => {
            const validBaseDir = path.join(workspaceRoot, 'test-project');
            fs.mkdirSync(validBaseDir, { recursive: true });
            createSessionFile('test-project', validBaseDir, 15);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(1);
            const project = projects[0];

            expect(project.projectName).toBe('test-project');
            expect(project.baseDir).toBe(validBaseDir);
            expect(project.operationCount).toBe(15);
            expect(project.lastModified).toBeTruthy();
            expect(project.sessionFile).toBeTruthy();
        });

        test('空目录应该返回空数组', async () => {
            const projects = await sessionManager.listProjectSessions();
            expect(projects).toEqual([]);
        });
    });

    describe('测试2: baseDir 验证 - 有效路径', () => {
        test('存在的workspace内路径应该标记为有效', async () => {
            const validBaseDir = path.join(workspaceRoot, 'valid-project');
            fs.mkdirSync(validBaseDir, { recursive: true });
            createSessionFile('valid-project', validBaseDir);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(1);
            expect(projects[0].baseDirValidation.isValid).toBe(true);
            expect(projects[0].baseDirValidation.error).toBeUndefined();
        });

        test('多层嵌套的有效路径应该通过验证', async () => {
            const nestedBaseDir = path.join(workspaceRoot, 'level1', 'level2', 'my-project');
            fs.mkdirSync(nestedBaseDir, { recursive: true });
            createSessionFile('nested-project', nestedBaseDir);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(1);
            expect(projects[0].baseDirValidation.isValid).toBe(true);
        });
    });

    describe('测试3: baseDir 验证 - 无效路径', () => {
        test('null baseDir 应该标记为无效', async () => {
            createSessionFile('no-basedir-project', null);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(1);
            expect(projects[0].baseDirValidation.isValid).toBe(false);
            expect(projects[0].baseDirValidation.error).toBe('BaseDir is not set');
        });

        test('不存在的路径应该标记为无效', async () => {
            const nonExistentPath = path.join(workspaceRoot, 'nonexistent-project');
            createSessionFile('broken-project', nonExistentPath);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(1);
            expect(projects[0].baseDirValidation.isValid).toBe(false);
            expect(projects[0].baseDirValidation.error).toContain('does not exist');
        });

        test('文件路径（非目录）应该标记为无效', async () => {
            const filePath = path.join(workspaceRoot, 'not-a-directory.txt');
            fs.writeFileSync(filePath, 'test content', 'utf-8');
            createSessionFile('file-project', filePath);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(1);
            expect(projects[0].baseDirValidation.isValid).toBe(false);
            expect(projects[0].baseDirValidation.error).toContain('is not a directory');
        });

        test('workspace外的路径应该标记为无效', async () => {
            const outsidePath = path.join(os.tmpdir(), 'outside-project');
            fs.mkdirSync(outsidePath, { recursive: true });
            createSessionFile('outside-project', outsidePath);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(1);
            expect(projects[0].baseDirValidation.isValid).toBe(false);
            expect(projects[0].baseDirValidation.error).toContain('outside workspace');

            // 清理
            fs.rmSync(outsidePath, { recursive: true, force: true });
        });
    });

    describe('测试4: 混合场景', () => {
        test('应该正确区分有效和无效项目', async () => {
            // 创建1个有效项目
            const validBaseDir = path.join(workspaceRoot, 'valid-project');
            fs.mkdirSync(validBaseDir, { recursive: true });
            createSessionFile('valid-project', validBaseDir);

            // 创建1个无效项目（路径不存在）
            const invalidBaseDir = path.join(workspaceRoot, 'deleted-project');
            createSessionFile('invalid-project', invalidBaseDir);

            // 创建1个null baseDir项目
            createSessionFile('no-basedir', null);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(3);

            const validProject = projects.find(p => p.projectName === 'valid-project');
            const invalidProject = projects.find(p => p.projectName === 'invalid-project');
            const noBaseDirProject = projects.find(p => p.projectName === 'no-basedir');

            expect(validProject?.baseDirValidation.isValid).toBe(true);
            expect(invalidProject?.baseDirValidation.isValid).toBe(false);
            expect(noBaseDirProject?.baseDirValidation.isValid).toBe(false);
        });

        test('当前活动项目应该正确标记', async () => {
            const projectABaseDir = path.join(workspaceRoot, 'project-a');
            const projectBBaseDir = path.join(workspaceRoot, 'project-b');

            fs.mkdirSync(projectABaseDir, { recursive: true });
            fs.mkdirSync(projectBBaseDir, { recursive: true });

            createSessionFile('project-a', projectABaseDir);
            createSessionFile('project-b', projectBBaseDir);

            // 切换到 project-a
            await sessionManager.createNewSession('project-a');
            await sessionManager.updateSession({ baseDir: projectABaseDir });

            const projects = await sessionManager.listProjectSessions();

            const projectA = projects.find(p => p.projectName === 'project-a');
            const projectB = projects.find(p => p.projectName === 'project-b');

            expect(projectA?.isActive).toBe(true);
            expect(projectB?.isActive).toBe(false);
        });
    });

    describe('测试5: 边界情况', () => {
        test('会话文件格式错误应该跳过', async () => {
            // 创建格式错误的会话文件
            const invalidSessionPath = path.join(sessionLogDir, 'invalid-session.json');
            fs.writeFileSync(invalidSessionPath, '{ invalid json', 'utf-8');

            // 创建1个有效项目
            const validBaseDir = path.join(workspaceRoot, 'valid-project');
            fs.mkdirSync(validBaseDir, { recursive: true });
            createSessionFile('valid-project', validBaseDir);

            const projects = await sessionManager.listProjectSessions();

            // 应该只返回有效项目，跳过格式错误的
            expect(projects).toHaveLength(1);
            expect(projects[0].projectName).toBe('valid-project');
        });

        test('非JSON文件应该被忽略', async () => {
            // 创建非JSON文件
            fs.writeFileSync(path.join(sessionLogDir, 'readme.txt'), 'test', 'utf-8');
            fs.writeFileSync(path.join(sessionLogDir, '.DS_Store'), 'test', 'utf-8');

            // 创建1个有效项目
            const validBaseDir = path.join(workspaceRoot, 'valid-project');
            fs.mkdirSync(validBaseDir, { recursive: true });
            createSessionFile('valid-project', validBaseDir);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(1);
            expect(projects[0].projectName).toBe('valid-project');
        });

        test('空的会话文件应该跳过', async () => {
            // 创建空文件
            const emptySessionPath = path.join(sessionLogDir, 'empty-session.json');
            fs.writeFileSync(emptySessionPath, '', 'utf-8');

            // 创建1个有效项目
            const validBaseDir = path.join(workspaceRoot, 'valid-project');
            fs.mkdirSync(validBaseDir, { recursive: true });
            createSessionFile('valid-project', validBaseDir);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(1);
            expect(projects[0].projectName).toBe('valid-project');
        });
    });

    describe('测试6: 性能和规模', () => {
        test('应该能处理大量项目', async () => {
            const projectCount = 50;

            // 创建50个项目
            for (let i = 0; i < projectCount; i++) {
                const projectName = `project-${i}`;
                const baseDir = path.join(workspaceRoot, projectName);
                fs.mkdirSync(baseDir, { recursive: true });
                createSessionFile(projectName, baseDir, i % 10);
            }

            const startTime = Date.now();
            const projects = await sessionManager.listProjectSessions();
            const duration = Date.now() - startTime;

            expect(projects).toHaveLength(projectCount);
            expect(duration).toBeLessThan(5000); // 应该在5秒内完成
        });
    });

    describe('测试7: 与Phase 1.1/1.2的集成', () => {
        test('baseDir验证应该使用Phase 1.1的BaseDirValidator', async () => {
            // 验证相对路径被拒绝（Phase 1.1要求绝对路径）
            const relativeBaseDir = './relative-project';
            createSessionFile('relative-project', relativeBaseDir);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(1);
            expect(projects[0].baseDirValidation.isValid).toBe(false);
            // 相对路径应该被Phase 1.1的验证器拒绝
        });

        test('ProjectSessionInfo接口应该包含Phase 2.1新增字段', async () => {
            const validBaseDir = path.join(workspaceRoot, 'test-project');
            fs.mkdirSync(validBaseDir, { recursive: true });
            createSessionFile('test-project', validBaseDir);

            const projects = await sessionManager.listProjectSessions();

            expect(projects).toHaveLength(1);
            const project = projects[0];

            // 验证Phase 2.1新增字段存在
            expect(project).toHaveProperty('baseDir');
            expect(project).toHaveProperty('baseDirValidation');
            expect(project.baseDirValidation).toHaveProperty('isValid');
            expect(typeof project.baseDirValidation.isValid).toBe('boolean');
        });
    });
});
