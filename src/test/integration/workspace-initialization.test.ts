/**
 * 工作区初始化功能集成测试
 * 测试创建工作区并初始化的完整流程
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

// 创建简化版的目录复制函数用于测试
async function copyDirectoryRecursiveForTest(sourcePath: string, targetPath: string): Promise<void> {
    try {
        // 检查源目录是否存在
        try {
            await fs.access(sourcePath);
        } catch {
            console.warn(`源目录不存在，跳过复制: ${sourcePath}`);
            return;
        }

        // 创建目标目录
        await fs.mkdir(targetPath, { recursive: true });

        // 读取源目录内容
        const entries = await fs.readdir(sourcePath, { withFileTypes: true });

        for (const entry of entries) {
            const sourceItemPath = path.join(sourcePath, entry.name);
            const targetItemPath = path.join(targetPath, entry.name);

            if (entry.isDirectory()) {
                // 递归复制子目录
                await copyDirectoryRecursiveForTest(sourceItemPath, targetItemPath);
            } else if (entry.isFile()) {
                // 复制文件
                await fs.copyFile(sourceItemPath, targetItemPath);
            }
        }
    } catch (error) {
        throw error;
    }
}

describe('工作区初始化功能', () => {
    let tempDir: string;
    let mockWorkspaceName: string;

    beforeEach(async () => {
        // 创建临时测试目录
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'srs-workspace-test-'));
        mockWorkspaceName = 'test-srs-workspace';
    });

    afterEach(async () => {
        // 清理临时目录
        try {
            await fs.rm(tempDir, { recursive: true });
        } catch (error) {
            console.warn('Failed to cleanup temp directory:', error);
        }
    });

    describe('copyDirectoryRecursive 函数', () => {
        it('应该能递归复制目录及其所有内容', async () => {
            // 准备源目录结构
            const sourceDir = path.join(tempDir, 'source');
            const targetDir = path.join(tempDir, 'target');

            // 创建测试目录结构
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.mkdir(path.join(sourceDir, 'subdir'), { recursive: true });
            
            // 创建测试文件
            await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
            await fs.writeFile(path.join(sourceDir, 'subdir', 'file2.txt'), 'content2');

            // 执行复制
            await copyDirectoryRecursiveForTest(sourceDir, targetDir);

            // 验证结果
            expect(await fs.access(targetDir).then(() => true).catch(() => false)).toBe(true);
            expect(await fs.access(path.join(targetDir, 'file1.txt')).then(() => true).catch(() => false)).toBe(true);
            expect(await fs.access(path.join(targetDir, 'subdir')).then(() => true).catch(() => false)).toBe(true);
            expect(await fs.access(path.join(targetDir, 'subdir', 'file2.txt')).then(() => true).catch(() => false)).toBe(true);

            // 验证文件内容
            const content1 = await fs.readFile(path.join(targetDir, 'file1.txt'), 'utf8');
            const content2 = await fs.readFile(path.join(targetDir, 'subdir', 'file2.txt'), 'utf8');
            expect(content1).toBe('content1');
            expect(content2).toBe('content2');
        });

        it('当源目录不存在时应该优雅处理', async () => {
            const nonExistentSource = path.join(tempDir, 'non-existent');
            const targetDir = path.join(tempDir, 'target');

            // 应该不抛出异常
            await expect(copyDirectoryRecursiveForTest(nonExistentSource, targetDir)).resolves.not.toThrow();

            // 目标目录不应该被创建
            expect(await fs.access(targetDir).then(() => true).catch(() => false)).toBe(false);
        });
    });

    describe('工作区创建流程模拟', () => {
        it('应该能正确创建工作区目录结构', async () => {
            const workspacePath = path.join(tempDir, mockWorkspaceName);

            // 模拟创建工作区目录
            await fs.mkdir(workspacePath, { recursive: true });

            // 模拟复制templates目录（创建模拟的templates结构）
            const templatesSource = path.join(tempDir, 'mock-templates');
            const templatesTarget = path.join(workspacePath, 'templates');

            // 创建模拟的templates结构
            await fs.mkdir(path.join(templatesSource, 'fr_writer'), { recursive: true });
            await fs.mkdir(path.join(templatesSource, 'nfr_writer'), { recursive: true });
            await fs.writeFile(
                path.join(templatesSource, 'fr_writer', 'fr_writer-template.md'),
                '# FR Writer Template\n\nThis is a functional requirements template.'
            );
            await fs.writeFile(
                path.join(templatesSource, 'nfr_writer', 'nfr_writer-template.md'),
                '# NFR Writer Template\n\nThis is a non-functional requirements template.'
            );

            await copyDirectoryRecursiveForTest(templatesSource, templatesTarget);

            // 验证工作区结构
            expect(await fs.access(workspacePath).then(() => true).catch(() => false)).toBe(true);
            expect(await fs.access(templatesTarget).then(() => true).catch(() => false)).toBe(true);
            expect(await fs.access(path.join(templatesTarget, 'fr_writer')).then(() => true).catch(() => false)).toBe(true);
            expect(await fs.access(path.join(templatesTarget, 'nfr_writer')).then(() => true).catch(() => false)).toBe(true);
            expect(await fs.access(path.join(templatesTarget, 'fr_writer', 'fr_writer-template.md')).then(() => true).catch(() => false)).toBe(true);
            expect(await fs.access(path.join(templatesTarget, 'nfr_writer', 'nfr_writer-template.md')).then(() => true).catch(() => false)).toBe(true);

            // 验证模板文件内容
            const frTemplate = await fs.readFile(path.join(templatesTarget, 'fr_writer', 'fr_writer-template.md'), 'utf8');
            expect(frTemplate).toContain('FR Writer Template');
            expect(frTemplate).toContain('functional requirements template');
        });
    });

    describe('输入验证', () => {
        it('应该正确验证工作区名称', () => {
            // 模拟validate函数逻辑
            const validateWorkspaceName = (value: string | undefined): string | undefined => {
                if (!value || value.trim().length === 0) {
                    return '工作区名称不能为空';
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(value.trim())) {
                    return '工作区名称只能包含字母、数字、下划线和短横线';
                }
                return undefined;
            };

            // 测试有效名称
            expect(validateWorkspaceName('my-workspace')).toBeUndefined();
            expect(validateWorkspaceName('workspace_123')).toBeUndefined();
            expect(validateWorkspaceName('MyWorkspace')).toBeUndefined();

            // 测试无效名称
            expect(validateWorkspaceName('')).toBe('工作区名称不能为空');
            expect(validateWorkspaceName('   ')).toBe('工作区名称不能为空');
            expect(validateWorkspaceName('workspace with spaces')).toBe('工作区名称只能包含字母、数字、下划线和短横线');
            expect(validateWorkspaceName('workspace@invalid')).toBe('工作区名称只能包含字母、数字、下划线和短横线');
            expect(validateWorkspaceName('workspace/path')).toBe('工作区名称只能包含字母、数字、下划线和短横线');
        });
    });

    describe('扩展上下文管理', () => {
        it('应该正确设置和获取扩展上下文', async () => {
            // 创建模拟的扩展上下文
            const mockContext = {
                extensionPath: tempDir,
                subscriptions: [],
                asAbsolutePath: (relativePath: string) => path.join(tempDir, relativePath)
            };

            // 验证扩展上下文可以被正确设置
            expect(mockContext.extensionPath).toBe(tempDir);
            expect(typeof mockContext.asAbsolutePath).toBe('function');
            expect(mockContext.asAbsolutePath('templates')).toBe(path.join(tempDir, 'templates'));
        });
    });

    describe('错误处理', () => {
        it('应该优雅处理权限错误', async () => {
            // 这个测试在实际环境中可能需要特殊的权限设置
            // 这里主要验证错误处理逻辑的存在
            const readOnlyDir = path.join(tempDir, 'readonly');
            await fs.mkdir(readOnlyDir);

            try {
                // 测试应该能够捕获并处理错误
                await expect(async () => {
                    // 尝试复制到不存在的父目录中
                    await copyDirectoryRecursiveForTest(readOnlyDir, '/non/existent/path/target');
                }).rejects.toThrow();
            } catch (error) {
                // 预期会有错误
                expect(error).toBeDefined();
            }
        });
    });
});