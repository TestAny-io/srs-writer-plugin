/**
 * 智能路径解析修复测试
 * 
 * 验证修复后的紧急优先级工具能够正确处理绝对路径和相对路径
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { writeFile, listFiles, createDirectory } from '../../tools/atomic/filesystem-tools';

// Mock VSCode API
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [
            {
                uri: {
                    fsPath: '/mock/workspace/root'
                }
            }
        ],
        fs: {
            writeFile: jest.fn(),
            readDirectory: jest.fn(),
            createDirectory: jest.fn()
        }
    },
    Uri: {
        file: jest.fn((fsPath) => ({ fsPath })),
        joinPath: jest.fn((base, ...segments) => ({
            fsPath: path.join(base.fsPath, ...segments)
        }))
    },
    FileType: {
        Directory: 2,
        File: 1
    }
}));

// Mock SessionManager
const mockGetCurrentSession = jest.fn();
jest.mock('../../core/session-manager', () => ({
    SessionManager: {
        getInstance: () => ({
            getCurrentSession: mockGetCurrentSession
        })
    }
}));

// Mock Logger
jest.mock('../../utils/logger', () => ({
    Logger: {
        getInstance: () => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        })
    }
}));

describe('Smart Path Resolution Fix Tests', () => {
    let tempDir: string;
    const vscode = require('vscode');

    beforeAll(async () => {
        // 创建临时测试目录
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'smart-path-test-'));
        
        // Mock SessionContext 返回测试目录作为 baseDir
        mockGetCurrentSession.mockResolvedValue({
            baseDir: tempDir
        });
    });

    afterAll(async () => {
        // 清理测试文件
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('清理测试目录失败:', error);
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // 重置VSCode mocks
        vscode.workspace.fs.writeFile.mockResolvedValue(undefined);
        vscode.workspace.fs.createDirectory.mockResolvedValue(undefined);
        vscode.workspace.fs.readDirectory.mockResolvedValue([
            ['file1.txt', 1],
            ['subdir', 2],
            ['file2.json', 1]
        ]);
    });

    describe('writeFile 智能路径处理', () => {
        it('应该正确处理绝对路径', async () => {
            const absolutePath = '/absolute/path/to/file.json';
            
            const result = await writeFile({
                path: absolutePath,
                content: '{"test": true}'
            });

            expect(result.success).toBe(true);
            expect(vscode.Uri.file).toHaveBeenCalledWith(absolutePath);
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });

        it('应该正确处理相对路径', async () => {
            const result = await writeFile({
                path: 'config/app.json',
                content: '{"app": "config"}'
            });

            expect(result.success).toBe(true);
            // 应该使用 resolveWorkspacePath 解析后的路径
            expect(vscode.Uri.file).toHaveBeenCalledWith(
                expect.stringContaining('config/app.json')
            );
        });

        it('应该处理当前目录的相对路径', async () => {
            const result = await writeFile({
                path: 'package.json',
                content: '{"name": "test"}'
            });

            expect(result.success).toBe(true);
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });
    });

    describe('listFiles 智能路径处理', () => {
        it('应该正确处理当前目录', async () => {
            const result = await listFiles({ path: '.' });

            expect(result.success).toBe(true);
            expect(result.files).toHaveLength(3);
            // 🚀 更新：新格式包含 path 字段（完整相对路径）
            expect(result.files).toEqual([
                { name: 'file1.txt', path: 'file1.txt', type: 'file' },
                { name: 'file2.json', path: 'file2.json', type: 'file' },
                { name: 'subdir', path: 'subdir', type: 'directory' }
            ]);
        });

        it('应该正确处理绝对路径', async () => {
            const absolutePath = '/absolute/path/to/directory';
            
            const result = await listFiles({ path: absolutePath });

            expect(result.success).toBe(true);
            expect(vscode.Uri.file).toHaveBeenCalledWith(absolutePath);
            expect(vscode.workspace.fs.readDirectory).toHaveBeenCalled();
        });

        it('应该正确处理相对路径', async () => {
            const result = await listFiles({ path: 'subdirectory' });

            expect(result.success).toBe(true);
            // 应该使用 resolveWorkspacePath 解析
            expect(vscode.workspace.fs.readDirectory).toHaveBeenCalled();
        });
    });

    describe('createDirectory 智能路径处理', () => {
        it('应该正确处理绝对路径', async () => {
            const absolutePath = '/absolute/path/to/newdir';
            
            const result = await createDirectory({ path: absolutePath });

            expect(result.success).toBe(true);
            expect(vscode.Uri.file).toHaveBeenCalledWith(absolutePath);
            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
        });

        it('应该正确处理相对路径', async () => {
            const result = await createDirectory({ path: 'new-project' });

            expect(result.success).toBe(true);
            expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
        });

        it('应该正确处理项目目录注册', async () => {
            const result = await createDirectory({ 
                path: 'MyProject',
                isProjectDirectory: true 
            });

            expect(result.success).toBe(true);
            // 项目注册逻辑应该使用解析后的绝对路径
        });
    });

    describe('错误处理', () => {
        it('writeFile 应该处理文件写入错误', async () => {
            vscode.workspace.fs.writeFile.mockRejectedValue(new Error('Permission denied'));
            
            const result = await writeFile({
                path: 'readonly.txt',
                content: 'test'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Permission denied');
        });

        it('listFiles 应该处理目录不存在错误', async () => {
            vscode.workspace.fs.readDirectory.mockRejectedValue(new Error('Directory not found'));
            
            const result = await listFiles({ path: 'non-existent' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Directory not found');
        });

        it('createDirectory 应该处理创建失败错误', async () => {
            vscode.workspace.fs.createDirectory.mockRejectedValue(new Error('Cannot create directory'));
            
            const result = await createDirectory({ path: 'invalid-dir' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot create directory');
        });
    });

    describe('路径类型混合测试', () => {
        it('应该在同一会话中处理不同类型的路径', async () => {
            // 测试绝对路径
            const writeResult1 = await writeFile({
                path: '/absolute/config.json',
                content: '{}'
            });
            expect(writeResult1.success).toBe(true);

            // 测试相对路径
            const writeResult2 = await writeFile({
                path: 'relative/config.json',
                content: '{}'
            });
            expect(writeResult2.success).toBe(true);

            // 测试当前目录
            const listResult = await listFiles({ path: '.' });
            expect(listResult.success).toBe(true);

            // 测试相对目录
            const listResult2 = await listFiles({ path: 'subdir' });
            expect(listResult2.success).toBe(true);
        });
    });
});
