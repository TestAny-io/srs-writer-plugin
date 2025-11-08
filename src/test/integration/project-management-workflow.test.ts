/**
 * Phase 1.2 集成测试：项目管理工作流
 *
 * 测试目标：
 * 1. 完整的项目重命名工作流（三合一：projectName + 目录名 + baseDir）
 * 2. 完整的项目删除工作流
 * 3. 多个操作的组合工作流
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
            delete: jest.fn().mockResolvedValue(undefined)
        }
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    },
    FileType: {
        File: 1,
        Directory: 2
    },
    ExtensionContext: jest.fn()
}));

// Mock fs promises
jest.mock('fs', () => ({
    promises: {
        access: jest.fn().mockResolvedValue(undefined),
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue('{}'),
        unlink: jest.fn().mockResolvedValue(undefined),
        rename: jest.fn().mockResolvedValue(undefined)  // 🔧 Add rename support
    },
    existsSync: jest.fn().mockReturnValue(true),
    statSync: jest.fn(),
    realpathSync: jest.fn(),
    mkdirSync: jest.fn()
}));

describe('Phase 1.2 集成测试: 项目管理工作流', () => {
    let sessionManager: SessionManager;

    beforeEach(() => {
        // 清理单例
        (SessionManager as any).instance = null;

        // 创建新的实例
        const mockContext = {
            globalStoragePath: '/test/global-storage'
        } as any;

        sessionManager = SessionManager.getInstance(mockContext);

        // 重置所有 mocks
        jest.clearAllMocks();

        // Setup mock implementations
        const fs = require('fs');
        (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
        (fs.realpathSync as jest.Mock).mockImplementation((p: string) => p);
        (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    describe('Workflow 1: 完整的项目重命名流程', () => {

        test('应该能完整执行：创建 → 重命名 → 验证', async () => {
            const fs = require('fs');

            // Step 1: 创建初始项目
            const initialSession = await sessionManager.createNewSession('project-v1');
            expect(initialSession.projectName).toBe('project-v1');

            // Step 2: Mock access for rename (new name doesn't exist)
            jest.spyOn(fs.promises, 'access').mockImplementation((filePath: any) => {
                if (filePath && filePath.includes && filePath.includes('project-v2')) {
                    return Promise.reject(new Error('ENOENT'));
                }
                return Promise.resolve();
            });

            const writeFileSpy = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            const renameSpy = jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);
            const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

            // Step 3: 执行重命名
            await sessionManager.renameProject('project-v1', 'project-v2');

            // Step 4: 验证重命名结果
            const renamedSession = await sessionManager.getCurrentSession();
            expect(renamedSession?.projectName).toBe('project-v2');

            // Step 5: 验证文件操作
            // 🔧 修复后使用 rename 而不是 unlink（保留历史）
            expect(renameSpy).toHaveBeenCalled();
            expect(unlinkSpy).not.toHaveBeenCalled();  // 不应该删除文件
            expect(writeFileSpy).toHaveBeenCalled();
        });

        test('应该能处理重命名冲突', async () => {
            const fs = require('fs');

            // Step 1: 创建项目
            await sessionManager.createNewSession('existing-project');

            // Step 2: Mock access - 目标项目已存在
            jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);

            // Step 3: 尝试重命名到已存在的项目
            await expect(
                sessionManager.renameProject('existing-project', 'target-project')
            ).rejects.toThrow('already exists');

            // Step 4: 验证当前项目未被更改
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('existing-project');
        });
    });

    describe('Workflow 2: 完整的项目删除流程', () => {

        test('应该能完整执行：创建 → 删除 → 验证', async () => {
            const vscode = require('vscode');

            // Step 1: 创建项目
            await sessionManager.createNewSession('doomed-project');
            const session = await sessionManager.getCurrentSession();
            expect(session?.projectName).toBe('doomed-project');

            // Step 2: Mock VSCode delete API
            const deleteSpy = jest.spyOn(vscode.workspace.fs, 'delete').mockResolvedValue(undefined);

            // Step 3: 删除项目
            await sessionManager.deleteProject('doomed-project');

            // Step 4: 验证删除操作（session file + directory）
            expect(deleteSpy).toHaveBeenCalledTimes(2);

            // Step 5: 验证切换到main session
            const newSession = await sessionManager.getCurrentSession();
            expect(newSession?.projectName).not.toBe('doomed-project');
        });

        test('应该拒绝删除不匹配的项目', async () => {
            // Step 1: 创建项目A
            await sessionManager.createNewSession('project-a');

            // Step 2: 尝试删除项目B
            await expect(
                sessionManager.deleteProject('project-b')
            ).rejects.toThrow('Current project is not');

            // Step 3: 验证项目A仍然存在
            const currentSession = await sessionManager.getCurrentSession();
            expect(currentSession?.projectName).toBe('project-a');
        });
    });

    describe('Workflow 3: 组合操作工作流', () => {

        test('应该能执行：创建 → 重命名（三合一） → 验证', async () => {
            const fs = require('fs');

            // Step 1: 创建项目
            await sessionManager.createNewSession('initial-name');

            // Step 2: 重命名项目（三合一：projectName + 目录名 + baseDir）
            jest.spyOn(fs.promises, 'access').mockImplementation((filePath: any) => {
                if (filePath && filePath.includes && filePath.includes('renamed-name')) {
                    return Promise.reject(new Error('ENOENT'));
                }
                return Promise.resolve();
            });

            jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);

            await sessionManager.renameProject('initial-name', 'renamed-name');

            // Step 3: 验证最终状态（验证三合一）
            const finalSession = await sessionManager.getCurrentSession();
            expect(finalSession?.projectName).toBe('renamed-name');
            expect(finalSession?.baseDir).toBe('/test/workspace/renamed-name');
            expect(path.basename(finalSession!.baseDir!)).toBe(finalSession!.projectName);
        });

        test('应该能执行：创建 → 重命名 → 删除', async () => {
            const fs = require('fs');
            const vscode = require('vscode');

            // Step 1: 创建项目
            await sessionManager.createNewSession('temp-project');

            // Step 2: 重命名项目
            jest.spyOn(fs.promises, 'access').mockImplementation((filePath: any) => {
                if (filePath && filePath.includes && filePath.includes('final-project')) {
                    return Promise.reject(new Error('ENOENT'));
                }
                return Promise.resolve();
            });

            jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
            jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);

            await sessionManager.renameProject('temp-project', 'final-project');

            // Step 3: 删除项目
            jest.spyOn(vscode.workspace.fs, 'delete').mockResolvedValue(undefined);
            await sessionManager.deleteProject('final-project');

            // Step 4: 验证项目已删除
            const newSession = await sessionManager.getCurrentSession();
            expect(newSession?.projectName).not.toBe('final-project');
        });
    });

    describe('Workflow 4: 错误恢复流程', () => {

        test('应该在重命名失败后保持原状态', async () => {
            const fs = require('fs');

            // Step 1: 创建项目
            await sessionManager.createNewSession('stable-project');

            // Step 2: Mock写入失败
            jest.spyOn(fs.promises, 'access').mockImplementation((filePath: any) => {
                if (filePath && filePath.includes && filePath.includes('bad-name')) {
                    return Promise.reject(new Error('ENOENT'));
                }
                return Promise.resolve();
            });

            jest.spyOn(fs.promises, 'writeFile').mockRejectedValue(new Error('Write failed'));

            // Step 3: 尝试重命名
            await expect(
                sessionManager.renameProject('stable-project', 'bad-name')
            ).rejects.toThrow();

            // Step 4: 验证状态未改变
            const unchangedSession = await sessionManager.getCurrentSession();
            expect(unchangedSession?.projectName).toBe('stable-project');
        });
    });
});
