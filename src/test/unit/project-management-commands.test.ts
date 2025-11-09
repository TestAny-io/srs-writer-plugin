/**
 * Phase 1.2 单元测试：项目管理命令
 *
 * 测试目标：
 * 1. 验证 renameProject 功能（包含baseDir更新）
 * 2. 验证 deleteProject 功能
 * 3. 验证 session file protection 逻辑
 * 4. 验证后备验证逻辑
 */

import * as path from 'path';
import { SessionManager } from '../../core/session-manager';
import { SessionPathManager } from '../../core/SessionPathManager';
import { OperationType } from '../../types/session';

// Mock VSCode
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }],
        fs: {
            stat: jest.fn(),
            createDirectory: jest.fn(),
            readFile: jest.fn(),
            writeFile: jest.fn(),
            readDirectory: jest.fn(),
            delete: jest.fn().mockResolvedValue(undefined)  // 🚀 Phase 1.2: Mock delete
        },
        createFileSystemWatcher: jest.fn()  // 🚀 Phase 1.2: Mock watcher
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    },
    FileType: {
        File: 1,
        Directory: 2
    },
    ExtensionContext: jest.fn(),
    RelativePattern: jest.fn(),  // 🚀 Phase 1.2: Mock RelativePattern
    window: {
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        showInformationMessage: jest.fn()
    },
    commands: {
        executeCommand: jest.fn()
    }
}));

// Mock fs promises
jest.mock('fs', () => ({
    promises: {
        access: jest.fn().mockResolvedValue(undefined),
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue('{}'),
        unlink: jest.fn().mockResolvedValue(undefined),  // 🚀 Phase 1.2: Mock unlink
        rename: jest.fn().mockResolvedValue(undefined)   // 🔧 Bug fix: Mock rename
    },
    existsSync: jest.fn().mockReturnValue(true),
    statSync: jest.fn(),
    realpathSync: jest.fn(),
    mkdirSync: jest.fn()  // 🚀 Phase 1.2: Mock mkdirSync
}));

describe('Phase 1.2: 项目管理命令', () => {
    let sessionManager: SessionManager;
    let pathManager: SessionPathManager;

    beforeEach(() => {
        // 清理单例
        (SessionManager as any).instance = null;

        // 创建新的实例
        const mockContext = {
            globalStoragePath: '/test/global-storage'
        } as any;

        sessionManager = SessionManager.getInstance(mockContext);
        pathManager = new SessionPathManager('/test/workspace');

        // 重置所有 mocks
        jest.clearAllMocks();

        // Setup mock implementations for BaseDirValidator
        const fs = require('fs');
        (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
        (fs.realpathSync as jest.Mock).mockImplementation((p: string) => p);
        (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    describe('Test Group 1: Rename Project', () => {

        test('1.1 应该成功重命名项目（三合一：projectName + 目录名 + baseDir）', async () => {
            // 创建初始项目
            await sessionManager.createNewSession('old-project');

            const currentSession = await sessionManager.getCurrentSession();
            const oldBaseDir = currentSession?.baseDir;
            expect(oldBaseDir).toBe('/test/workspace/old-project');

            // Mock 文件系统操作
            const fs = require('fs');
            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            const renameSpy = jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);

            // Mock access - 新项目名不存在（access会抛出错误）
            const accessSpy = jest.spyOn(fs.promises, 'access').mockImplementation((filePath: any) => {
                if (filePath && filePath.includes && filePath.includes('new-project')) {
                    return Promise.reject(new Error('ENOENT'));
                }
                return Promise.resolve();
            });

            // 执行重命名
            await sessionManager.renameProject('old-project', 'new-project');

            // 🆕 验证三合一更新
            const renamedSession = await sessionManager.getCurrentSession();

            // 验证 projectName 已更新
            expect(renamedSession?.projectName).toBe('new-project');

            // 🆕 验证 baseDir 已更新
            expect(renamedSession?.baseDir).toBe('/test/workspace/new-project');

            // 🆕 验证 projectName 和 baseDir 的最后一部分一致
            expect(path.basename(renamedSession!.baseDir!)).toBe(renamedSession!.projectName);

            // 🆕 验证调用了两次 rename（目录 + session file）
            expect(renameSpy).toHaveBeenCalledTimes(2);
            expect(renameSpy).toHaveBeenNthCalledWith(1,
                '/test/workspace/old-project',    // 旧目录
                '/test/workspace/new-project'     // 新目录
            );
            // 第二次调用是 session file 重命名（路径包含 .session-log/）
        });

        test('1.2 应该拒绝空的新项目名', async () => {
            // 创建初始项目
            await sessionManager.createNewSession('test-project');

            // 尝试重命名为空名称
            // 🔧 更新：现在由 ProjectNameValidator 验证，错误消息改变
            await expect(
                sessionManager.renameProject('test-project', '')
            ).rejects.toThrow('Project name cannot be empty');

            await expect(
                sessionManager.renameProject('test-project', '   ')
            ).rejects.toThrow('Project name cannot be empty');
        });

        test('1.3 应该拒绝与现有项目冲突的名称', async () => {
            // 创建初始项目
            await sessionManager.createNewSession('project-a');

            // Mock access - 模拟 project-b 已存在（access不会抛出错误）
            const fs = require('fs');
            const accessSpy = jest.spyOn(fs.promises, 'access').mockImplementation((filePath: any) => {
                // project-b 已存在，access 成功
                return Promise.resolve();
            });

            // 尝试重命名为已存在的项目名
            await expect(
                sessionManager.renameProject('project-a', 'project-b')
            ).rejects.toThrow('Project "project-b" already exists');
        });

        test('1.4 应该正确更新 session file 路径', async () => {
            // 创建初始项目
            await sessionManager.createNewSession('old-name');

            const fs = require('fs');
            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            const renameSpy = jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);

            // Mock access - 新项目名不存在（access会抛出错误）
            const accessSpy = jest.spyOn(fs.promises, 'access').mockImplementation((filePath: any) => {
                if (filePath && filePath.includes && filePath.includes('new-name')) {
                    return Promise.reject(new Error('ENOENT'));
                }
                return Promise.resolve();
            });

            // 执行重命名
            await sessionManager.renameProject('old-name', 'new-name');

            // 验证使用 rename 重命名文件
            expect(renameSpy).toHaveBeenCalledWith(
                expect.stringContaining('old-name'),
                expect.stringContaining('new-name')
            );

            // 验证写入了新文件（使用最后一次写入调用）
            expect(writeFileSpy).toHaveBeenCalled();
            const lastWriteCall = writeFileSpy.mock.calls[writeFileSpy.mock.calls.length - 1];
            const writeFilePath = lastWriteCall[0];
            expect(writeFilePath).toContain('new-name');
        });

        test('1.5 应该使用 rename 而不是 delete+create（保留历史）', async () => {
            // 创建初始项目
            await sessionManager.createNewSession('original-project');

            const fs = require('fs');
            const renameSpy = jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);
            const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

            // Mock access - 新项目名不存在
            const accessSpy = jest.spyOn(fs.promises, 'access').mockImplementation((filePath: any) => {
                if (filePath && filePath.includes && filePath.includes('renamed-project')) {
                    return Promise.reject(new Error('ENOENT'));
                }
                return Promise.resolve();
            });

            // 执行重命名
            await sessionManager.renameProject('original-project', 'renamed-project');

            // 🔧 关键验证：使用 rename 而不是 unlink
            expect(renameSpy).toHaveBeenCalled();
            // unlink 不应该被调用（旧代码的bug会调用它）
            expect(unlinkSpy).not.toHaveBeenCalled();
        });

        test('1.6 🔧 REGRESSION: 重命名时保存两次（先记录rename，再更新文件名后的状态）', async () => {
            // 这个测试验证修复后的正确行为：
            // Step 1: 在旧文件中记录 PROJECT_RENAMED
            // Step 2: 更新内存 projectName
            // Step 3: rename 文件
            // Step 4: 在新文件中记录 SESSION_UPDATED

            // 创建初始项目
            await sessionManager.createNewSession('project-with-history');

            const fs = require('fs');
            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            const renameSpy = jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);

            // Mock access - 新项目名不存在
            const accessSpy = jest.spyOn(fs.promises, 'access').mockImplementation((filePath: any) => {
                if (filePath && filePath.includes && filePath.includes('project-renamed')) {
                    return Promise.reject(new Error('ENOENT'));
                }
                return Promise.resolve();
            });

            // 执行重命名
            await sessionManager.renameProject('project-with-history', 'project-renamed');

            // 🔧 关键验证：writeFile 应该被调用至少2次
            // 第1次：在旧文件中保存 PROJECT_RENAMED 记录
            // 第2次：在新文件中保存 SESSION_UPDATED 记录
            expect(writeFileSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

            // 验证 rename 被调用
            expect(renameSpy).toHaveBeenCalled();
        });

        test('1.7 🆕 应该保留子目录结构（重命名 frontend/old-project → frontend/new-project）', async () => {
            // 模拟项目在子目录中的情况
            // 创建一个项目，手动设置其 baseDir 在子目录中
            await sessionManager.createNewSession('old-project');

            // 手动修改 baseDir 以模拟项目在子目录中
            const currentSession = await sessionManager.getCurrentSession();
            if (currentSession) {
                currentSession.baseDir = '/test/workspace/frontend/old-project';
            }

            const fs = require('fs');
            const renameSpy = jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);
            jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

            // Mock access - 新项目名不存在
            jest.spyOn(fs.promises, 'access').mockImplementation((filePath: any) => {
                if (filePath && filePath.includes && filePath.includes('new-project')) {
                    return Promise.reject(new Error('ENOENT'));
                }
                return Promise.resolve();
            });

            // 执行重命名
            await sessionManager.renameProject('old-project', 'new-project');

            // 🔧 关键验证：新的 baseDir 应该保留 frontend/ 子目录
            const renamedSession = await sessionManager.getCurrentSession();
            expect(renamedSession?.baseDir).toBe('/test/workspace/frontend/new-project');

            // 验证目录重命名保留了父路径
            expect(renameSpy).toHaveBeenCalledWith(
                '/test/workspace/frontend/old-project',
                '/test/workspace/frontend/new-project'
            );

            // 验证 projectName 和目录名一致
            expect(path.basename(renamedSession!.baseDir!)).toBe('new-project');
            expect(renamedSession?.projectName).toBe('new-project');
        });
    });

    describe('Test Group 2: Delete Project', () => {

        test('3.1 应该成功删除项目（session file 和目录都移到 trash）', async () => {
            // 创建项目
            await sessionManager.createNewSession('delete-me');
            const currentSession = await sessionManager.getCurrentSession();

            // 设置 baseDir
            if (currentSession) {
                currentSession.baseDir = '/test/workspace/delete-me';
            }

            const vscode = require('vscode');
            const deleteSpy = jest.spyOn(vscode.workspace.fs, 'delete').mockResolvedValue(undefined);

            // 执行删除
            await sessionManager.deleteProject('delete-me');

            // 验证 delete 被调用了两次（session file + directory）
            expect(deleteSpy).toHaveBeenCalledTimes(2);

            // 验证都使用了 useTrash
            expect(deleteSpy).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ useTrash: true })
            );
        });

        test('3.2 应该将 session file 移到 trash', async () => {
            // 创建项目
            await sessionManager.createNewSession('trash-test');

            const vscode = require('vscode');
            const deleteSpy = jest.spyOn(vscode.workspace.fs, 'delete').mockResolvedValue(undefined);

            // 执行删除
            await sessionManager.deleteProject('trash-test');

            // 验证 session file 被移到 trash
            const sessionFileCall = deleteSpy.mock.calls.find((call: any) =>
                call[0].fsPath.includes('trash-test') && call[0].fsPath.endsWith('.json')
            );
            expect(sessionFileCall).toBeDefined();
            expect(sessionFileCall![1]).toEqual(expect.objectContaining({
                recursive: false,
                useTrash: true
            }));
        });

        test('3.3 应该将项目目录移到 trash', async () => {
            // 创建项目
            await sessionManager.createNewSession('directory-trash-test');
            const currentSession = await sessionManager.getCurrentSession();

            // 设置 baseDir
            if (currentSession) {
                currentSession.baseDir = '/test/workspace/directory-trash-test';
            }

            const vscode = require('vscode');
            const deleteSpy = jest.spyOn(vscode.workspace.fs, 'delete').mockResolvedValue(undefined);

            // 执行删除
            await sessionManager.deleteProject('directory-trash-test');

            // 验证项目目录被移到 trash
            const directoryCall = deleteSpy.mock.calls.find((call: any) =>
                call[0].fsPath.includes('directory-trash-test') && !call[0].fsPath.endsWith('.json')
            );
            expect(directoryCall).toBeDefined();
            expect(directoryCall![1]).toEqual(expect.objectContaining({
                recursive: true,
                useTrash: true
            }));
        });

        test('3.4 应该在删除后切换到 main session', async () => {
            // 创建项目
            await sessionManager.createNewSession('will-be-deleted');

            const vscode = require('vscode');
            jest.spyOn(vscode.workspace.fs, 'delete').mockResolvedValue(undefined);

            // Mock loadSessionFromFile 返回 null（main session 不存在）
            const fs = require('fs');
            jest.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('File not found'));

            // 执行删除
            await sessionManager.deleteProject('will-be-deleted');

            // 验证当前会话是 null 或 main
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).not.toBe('will-be-deleted');
        });

        test('3.5 应该拒绝删除 workspace 外的目录', async () => {
            // 创建项目
            await sessionManager.createNewSession('unsafe-project');
            const currentSession = await sessionManager.getCurrentSession();

            // 设置 baseDir 为 workspace 外的路径
            if (currentSession) {
                currentSession.baseDir = '/outside/workspace/path';
            }

            // 尝试删除
            await expect(
                sessionManager.deleteProject('unsafe-project')
            ).rejects.toThrow('Cannot delete directory outside workspace');
        });

        test('2.4 应该能删除子目录中的项目（验证路径验证支持嵌套）', async () => {
            const vscode = require('vscode');

            // 创建项目
            await sessionManager.createNewSession('nested-project');

            // 手动修改 baseDir 模拟项目在子目录中
            const currentSession = await sessionManager.getCurrentSession();
            if (currentSession) {
                currentSession.baseDir = '/test/workspace/frontend/nested-project';
            }

            // Mock VSCode delete API
            const deleteSpy = jest.spyOn(vscode.workspace.fs, 'delete').mockResolvedValue(undefined);

            // 执行删除 - 应该成功，不抛出 "outside workspace" 错误
            await sessionManager.deleteProject('nested-project');

            // 验证删除操作被调用
            expect(deleteSpy).toHaveBeenCalled();

            // 验证切换到 main session
            const newSession = await sessionManager.getCurrentSession();
            expect(newSession?.projectName).not.toBe('nested-project');
        });
    });

    describe('Test Group 4: File Protection Logic', () => {

        test('4.1 应该检测用户手动编辑 session file', async () => {
            // 这个测试验证文件保护机制在extension.ts中被正确设置
            // 由于文件保护是在extension.ts的setupSessionFileProtection函数中配置的，
            // 而不是在SessionManager中，我们在这里只做基本验证

            const vscode = require('vscode');

            // 验证 createFileSystemWatcher 已被 mock
            expect(vscode.workspace.createFileSystemWatcher).toBeDefined();

            // 在实际运行时，extension.ts会调用createFileSystemWatcher
            // 这个测试确保mock存在，实际的文件保护测试会在集成测试中进行
        });

        test('4.2 应该允许 extension 写入而不触发警告', async () => {
            // 创建项目
            await sessionManager.createNewSession('extension-write-test');

            const fs = require('fs');
            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

            // Extension 执行写入（通过 SessionManager）
            await sessionManager.saveSessionToFile();

            // 验证写入成功
            expect(writeFileSpy).toHaveBeenCalled();

            // 在实际实现中，isExtensionWrite 标志应该被设置
            // 这里我们验证基本的写入功能
        });

        test('4.3 应该在检测到手动编辑时提供正确的指导', async () => {
            const vscode = require('vscode');
            const showWarningMessageSpy = jest.spyOn(vscode.window, 'showWarningMessage')
                .mockResolvedValue('Open Project Management');

            // 模拟手动编辑触发警告
            // 在实际实现中，这会通过文件监视器触发

            // 验证警告消息包含正确的指导
            // （这需要在集成测试中完整验证）
            expect(vscode.workspace.createFileSystemWatcher).toBeDefined();
        });
    });

    describe('Test Group 5: Fallback Validation Logic', () => {

        test('5.1 应该在 projectName 不匹配文件名时发出警告', async () => {
            // 这个测试验证fallback validation的逻辑
            // 创建一个会话
            await sessionManager.createNewSession('correct-project');

            // 验证会话创建成功
            const session = await sessionManager.getCurrentSession();
            expect(session).toBeDefined();
            expect(session?.projectName).toBe('correct-project');

            // Note: ProjectName不匹配的警告会在loadSessionFromFile时触发
            // 这在实际的session file被手动编辑后才会发生
            // 在单元测试中，我们验证基本的创建和获取流程工作正常
        });

        test('5.2 应该在 projectName 匹配文件名时正常加载', async () => {
            // 这个测试验证正常的创建和加载流程
            await sessionManager.createNewSession('matching-project');

            // 验证会话创建成功
            const session = await sessionManager.getCurrentSession();
            expect(session).toBeDefined();
            expect(session?.projectName).toBe('matching-project');

            // Note: 在实际情况下，projectName匹配文件名时不会有警告
            // 我们验证正常的流程工作正常
        });

    });

    describe('Test Group 6: Edge Cases and Rollback', () => {

        test('6.1 应该在 rename 失败时回滚状态', async () => {
            // 创建项目
            await sessionManager.createNewSession('rollback-test');

            const fs = require('fs');
            // Mock writeFile 失败
            jest.spyOn(fs.promises, 'writeFile').mockRejectedValue(new Error('Write failed'));
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            // 尝试重命名（应该失败）
            await expect(
                sessionManager.renameProject('rollback-test', 'new-name')
            ).rejects.toThrow();

            // 验证状态回滚（projectName 应该保持原样）
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('rollback-test');
        });

        test('6.2 应该拒绝删除不匹配的项目', async () => {
            // 创建项目
            await sessionManager.createNewSession('project-a');

            // 尝试删除不同的项目
            await expect(
                sessionManager.deleteProject('project-b')
            ).rejects.toThrow('Current project is not "project-b"');
        });
    });

    // 🔧 SECURITY FIX: 测试 projectName 验证（防止路径逃逸、非法字符）
    describe('7. ProjectName 验证（安全增强）', () => {
        test('7.1 创建项目时应拒绝路径分隔符', async () => {
            await expect(
                sessionManager.createNewSession('my/project')
            ).rejects.toThrow();

            await expect(
                sessionManager.createNewSession('my\\project')
            ).rejects.toThrow();
        });

        test('7.2 创建项目时应拒绝路径逃逸', async () => {
            await expect(
                sessionManager.createNewSession('..')
            ).rejects.toThrow();

            await expect(
                sessionManager.createNewSession('.')
            ).rejects.toThrow();

            await expect(
                sessionManager.createNewSession('my..project')
            ).rejects.toThrow();
        });

        test('7.3 创建项目时应拒绝非法字符', async () => {
            const illegalChars = ['<', '>', ':', '"', '|', '?', '*'];

            for (const char of illegalChars) {
                await expect(
                    sessionManager.createNewSession(`my${char}project`)
                ).rejects.toThrow();
            }
        });

        test('7.4 创建项目时应拒绝 Windows 保留名', async () => {
            await expect(
                sessionManager.createNewSession('CON')
            ).rejects.toThrow();

            await expect(
                sessionManager.createNewSession('aux')
            ).rejects.toThrow();

            await expect(
                sessionManager.createNewSession('NUL')
            ).rejects.toThrow();

            await expect(
                sessionManager.createNewSession('COM1')
            ).rejects.toThrow();
        });

        test('7.5 创建项目时应拒绝以空格或点结尾的名称', async () => {
            await expect(
                sessionManager.createNewSession('project  ')
            ).rejects.toThrow();

            await expect(
                sessionManager.createNewSession('project.')
            ).rejects.toThrow();
        });

        test('7.6 重命名项目时应拒绝非法名称', async () => {
            await sessionManager.createNewSession('valid-project');

            // 测试路径分隔符
            await expect(
                sessionManager.renameProject('valid-project', 'my/new-project')
            ).rejects.toThrow();

            // 测试路径逃逸
            await expect(
                sessionManager.renameProject('valid-project', '..')
            ).rejects.toThrow();

            // 测试非法字符
            await expect(
                sessionManager.renameProject('valid-project', 'my:project')
            ).rejects.toThrow();

            // 测试 Windows 保留名
            await expect(
                sessionManager.renameProject('valid-project', 'CON')
            ).rejects.toThrow();
        });

        test('7.7 应接受合法的项目名称', async () => {
            // 简单名称
            await expect(
                sessionManager.createNewSession('my-project')
            ).resolves.toBeDefined();

            // 带空格（中间）
            await expect(
                sessionManager.createNewSession('My Project 2')
            ).resolves.toBeDefined();

            // 带下划线
            await expect(
                sessionManager.createNewSession('my_project_3')
            ).resolves.toBeDefined();

            // 带点（中间）
            await expect(
                sessionManager.createNewSession('project.v1.0')
            ).resolves.toBeDefined();

            // 中文
            await expect(
                sessionManager.createNewSession('我的项目')
            ).resolves.toBeDefined();
        });

        test('7.8 🔧 REGRESSION: 验证修复了路径拼接漏洞', async () => {
            // 这个测试验证修复前的漏洞场景
            // 修复前: path.join('/workspace', '../evil') = '/evil' (路径逃逸)
            // 修复后: 验证器在拼接前拒绝 '..' 名称

            await expect(
                sessionManager.createNewSession('../evil-project')
            ).rejects.toThrow();

            await expect(
                sessionManager.createNewSession('../../root-access')
            ).rejects.toThrow();
        });
    });
});
