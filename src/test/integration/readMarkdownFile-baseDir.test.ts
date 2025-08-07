/**
 * readMarkdownFile baseDir路径解析集成测试
 * 验证readMarkdownFile工具现在能正确使用SessionContext的baseDir
 */

import { readMarkdownFile } from '../../tools/document/enhanced-readfile-tools';
import { SessionManager } from '../../core/session-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

// Mock VSCode
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: {
                fsPath: '/mock/workspace'
            }
        }]
    },
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            append: jest.fn(),
            clear: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        }))
    }
}));

// Mock SessionManager
jest.mock('../../core/session-manager', () => ({
    SessionManager: {
        getInstance: jest.fn()
    }
}));

// Mock fs
jest.mock('fs/promises', () => ({
    readFile: jest.fn()
}));

describe('readMarkdownFile baseDir路径解析', () => {
    const mockSessionManager = SessionManager.getInstance as jest.MockedFunction<typeof SessionManager.getInstance>;
    const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('应该优先使用SessionContext的baseDir解析路径', async () => {
        // 设置mock session with baseDir
        const mockSession = {
            baseDir: '/project/my-srs-project',
            projectName: 'my-srs-project'
        };

        mockSessionManager.mockReturnValue({
            getCurrentSession: jest.fn().mockResolvedValue(mockSession)
        } as any);

        // Mock文件内容
        const testContent = '# Test Markdown\n\nThis is a test file.';
        mockReadFile.mockResolvedValue(testContent);

        // 调用readMarkdownFile
        const result = await readMarkdownFile({
            path: 'docs/README.md'
        });

        // 验证结果
        expect(result.success).toBe(true);
        expect(result.content).toBe(testContent);

        // 验证fs.readFile被调用时使用的是baseDir拼接的路径
        expect(mockReadFile).toHaveBeenCalledWith(
            path.resolve('/project/my-srs-project', 'docs/README.md'),
            'utf-8'
        );
    });

    it('当没有baseDir时应该回退到VSCode工作区根目录', async () => {
        // 设置mock session without baseDir
        const mockSession = {
            baseDir: null,
            projectName: 'my-srs-project'
        };

        mockSessionManager.mockReturnValue({
            getCurrentSession: jest.fn().mockResolvedValue(mockSession)
        } as any);

        // Mock文件内容
        const testContent = '# Test Markdown\n\nThis is a test file.';
        mockReadFile.mockResolvedValue(testContent);

        // 调用readMarkdownFile
        const result = await readMarkdownFile({
            path: 'docs/README.md'
        });

        // 验证结果
        expect(result.success).toBe(true);
        expect(result.content).toBe(testContent);

        // 验证fs.readFile被调用时使用的是工作区根目录拼接的路径
        expect(mockReadFile).toHaveBeenCalledWith(
            path.resolve('/mock/workspace', 'docs/README.md'),
            'utf-8'
        );
    });

    it('当SessionManager抛出异常时应该回退到VSCode工作区根目录', async () => {
        // 设置SessionManager抛出异常
        mockSessionManager.mockReturnValue({
            getCurrentSession: jest.fn().mockRejectedValue(new Error('Session error'))
        } as any);

        // Mock文件内容
        const testContent = '# Test Markdown\n\nThis is a test file.';
        mockReadFile.mockResolvedValue(testContent);

        // 调用readMarkdownFile
        const result = await readMarkdownFile({
            path: 'docs/README.md'
        });

        // 验证结果
        expect(result.success).toBe(true);
        expect(result.content).toBe(testContent);

        // 验证fs.readFile被调用时使用的是工作区根目录拼接的路径
        expect(mockReadFile).toHaveBeenCalledWith(
            path.resolve('/mock/workspace', 'docs/README.md'),
            'utf-8'
        );
    });

    it('处理绝对路径时应该直接使用不做拼接', async () => {
        // 设置mock session
        const mockSession = {
            baseDir: '/project/my-srs-project',
            projectName: 'my-srs-project'
        };

        mockSessionManager.mockReturnValue({
            getCurrentSession: jest.fn().mockResolvedValue(mockSession)
        } as any);

        // Mock文件内容
        const testContent = '# Test Markdown\n\nThis is a test file.';
        mockReadFile.mockResolvedValue(testContent);

        // 使用绝对路径调用readMarkdownFile
        const absolutePath = '/absolute/path/to/file.md';
        const result = await readMarkdownFile({
            path: absolutePath
        });

        // 验证结果
        expect(result.success).toBe(true);
        expect(result.content).toBe(testContent);

        // 验证fs.readFile被调用时使用的是原始绝对路径
        expect(mockReadFile).toHaveBeenCalledWith(absolutePath, 'utf-8');
    });

    it('文件不存在时应该返回适当的错误信息', async () => {
        // 设置mock session
        const mockSession = {
            baseDir: '/project/my-srs-project',
            projectName: 'my-srs-project'
        };

        mockSessionManager.mockReturnValue({
            getCurrentSession: jest.fn().mockResolvedValue(mockSession)
        } as any);

        // Mock文件不存在错误
        const enoentError = new Error('File not found') as NodeJS.ErrnoException;
        enoentError.code = 'ENOENT';
        mockReadFile.mockRejectedValue(enoentError);

        // 调用readMarkdownFile
        const result = await readMarkdownFile({
            path: 'docs/nonexistent.md'
        });

        // 验证结果
        expect(result.success).toBe(false);
        expect(result.content).toBe('');
        expect(result.error).toContain('Markdown文件不存在');
        expect(result.error).toContain('/project/my-srs-project/docs/nonexistent.md');
    });

    it('权限错误时应该返回适当的错误信息', async () => {
        // 设置mock session
        const mockSession = {
            baseDir: '/project/my-srs-project',
            projectName: 'my-srs-project'
        };

        mockSessionManager.mockReturnValue({
            getCurrentSession: jest.fn().mockResolvedValue(mockSession)
        } as any);

        // Mock权限错误
        const eaccesError = new Error('Permission denied') as NodeJS.ErrnoException;
        eaccesError.code = 'EACCES';
        mockReadFile.mockRejectedValue(eaccesError);

        // 调用readMarkdownFile
        const result = await readMarkdownFile({
            path: 'docs/protected.md'
        });

        // 验证结果
        expect(result.success).toBe(false);
        expect(result.content).toBe('');
        expect(result.error).toContain('没有权限读取Markdown文件');
        expect(result.error).toContain('/project/my-srs-project/docs/protected.md');
    });

    it('结构分析功能应该正常工作', async () => {
        // 设置mock session
        const mockSession = {
            baseDir: '/project/my-srs-project',
            projectName: 'my-srs-project'
        };

        mockSessionManager.mockReturnValue({
            getCurrentSession: jest.fn().mockResolvedValue(mockSession)
        } as any);

        // Mock包含多个章节的文件内容
        const testContent = `# Main Title

## Section 1
Content 1

## Section 2
Content 2

### Subsection 2.1
More content`;

        mockReadFile.mockResolvedValue(testContent);

        // 调用readMarkdownFile with structure analysis
        const result = await readMarkdownFile({
            path: 'docs/structured.md',
            parseMode: 'full' // 获取内容和结构
        });

        // 验证结果
        expect(result.success).toBe(true);
        expect(result.content).toBe(testContent);
        expect(result.tableOfContents).toBeDefined();
        expect(result.tableOfContents!.length).toBeGreaterThan(0);
    });
});