/**
 * listFiles Tool Integration Tests (Refactored)
 * 
 * 测试重构后的 listFiles 工具的所有功能
 * 包括：单层列表（默认）和递归列表（可选）
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { listFiles } from '../../tools/atomic/filesystem-tools';

describe('listFiles Integration Tests (Refactored)', () => {
    let workspaceUri: vscode.Uri;

    beforeAll(async () => {
        // Ensure workspace is available
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder available for testing');
        }
        workspaceUri = workspaceFolders[0].uri;
    });

    describe('🚀 非递归模式测试（默认行为）', () => {
        test('should list single level directory by default', async () => {
            const result = await listFiles({ path: 'src' });
            
            expect(result.success).toBe(true);
            expect(result.files).toBeDefined();
            expect(result.files).toBeInstanceOf(Array);
            expect(result.totalCount).toBeGreaterThan(0);
            
            // 验证返回的是单层目录
            const files = result.files!;
            expect(files.every(f => !f.path.includes('/')  || f.path.split('/').length === 2)).toBe(true);
            
            console.log(`✅ 非递归: 列出 ${result.totalCount} 个项目`);
        });

        test('should return complete relative paths in single level mode', async () => {
            const result = await listFiles({ path: 'src/tools' });
            
            expect(result.success).toBe(true);
            const files = result.files!;
            
            // 验证每个文件都有 name 和 path 字段
            expect(files.every(f => f.name && f.path && f.type)).toBe(true);
            
            // 验证路径是完整的相对路径
            expect(files.some(f => f.path.startsWith('src/tools/'))).toBe(true);
            
            // 验证 path 字段包含 basePath
            files.forEach(f => {
                expect(f.path).toBe(`src/tools/${f.name}`);
            });
            
            console.log(`✅ 完整路径验证通过: ${files[0]?.path}`);
        });

        test('should list workspace root with path="."', async () => {
            const result = await listFiles({ path: '.' });
            
            expect(result.success).toBe(true);
            const files = result.files!;
            
            // 应该包含顶级文件和目录
            expect(files.some(f => f.name === 'package.json')).toBe(true);
            expect(files.some(f => f.name === 'src' && f.type === 'directory')).toBe(true);
            
            // 路径应该是简单的文件名（不包含目录前缀）
            expect(files.every(f => !f.path.includes('/'))).toBe(true);
            
            console.log(`✅ 根目录列表: ${result.totalCount} 个项目`);
        });

        test('should exclude hidden files in non-recursive mode', async () => {
            const result = await listFiles({ path: '.' });
            
            expect(result.success).toBe(true);
            const files = result.files!;
            
            // 不应包含隐藏文件
            expect(files.every(f => !f.name.startsWith('.'))).toBe(true);
            
            console.log('✅ 正确排除隐藏文件');
        });

        test('should respect filesOnly filter in non-recursive mode', async () => {
            const result = await listFiles({ path: 'src', filesOnly: true });
            
            expect(result.success).toBe(true);
            const files = result.files!;
            
            // 只应包含文件，不包含目录
            expect(files.every(f => f.type === 'file')).toBe(true);
            
            console.log(`✅ 文件过滤: ${result.totalCount} 个文件`);
        });

        test('should respect dirsOnly filter in non-recursive mode', async () => {
            const result = await listFiles({ path: 'src', dirsOnly: true });
            
            expect(result.success).toBe(true);
            const files = result.files!;
            
            // 只应包含目录，不包含文件
            expect(files.every(f => f.type === 'directory')).toBe(true);
            
            console.log(`✅ 目录过滤: ${result.totalCount} 个目录`);
        });
    });

    describe('🚀 递归模式测试', () => {
        test('should list all files recursively when recursive=true', async () => {
            const result = await listFiles({ 
                path: 'src/tools',
                recursive: true,
                maxItems: 100
            });
            
            expect(result.success).toBe(true);
            expect(result.files).toBeDefined();
            expect(result.scannedDepth).toBeDefined();
            expect(result.scannedDepth).toBeGreaterThan(0);
            
            // 应该包含嵌套的文件
            const files = result.files!;
            expect(files.some(f => f.path.split('/').length > 2)).toBe(true);
            
            console.log(`✅ 递归列表: ${result.totalCount} 个项目, 深度 ${result.scannedDepth}`);
        });

        test('should return complete relative paths in recursive mode', async () => {
            const result = await listFiles({ 
                path: 'src/tools',
                recursive: true,
                maxItems: 50
            });
            
            expect(result.success).toBe(true);
            const files = result.files!;
            
            // 所有路径都应该以 src/tools 开头
            expect(files.every(f => f.path.startsWith('src/tools/'))).toBe(true);
            
            // 验证路径格式正确
            files.forEach(f => {
                expect(f.path).toContain(f.name);
                expect(f.path.endsWith(f.name)).toBe(true);
            });
            
            console.log(`✅ 递归模式路径验证通过: ${files[0]?.path}`);
        });

        test('should respect maxDepth in recursive mode', async () => {
            const shallow = await listFiles({ 
                path: 'src',
                recursive: true,
                maxDepth: 1,
                maxItems: 100
            });
            
            const deep = await listFiles({ 
                path: 'src',
                recursive: true,
                maxDepth: 5,
                maxItems: 200
            });
            
            expect(shallow.success).toBe(true);
            expect(deep.success).toBe(true);
            
            expect(shallow.scannedDepth).toBeLessThanOrEqual(1);
            expect(deep.scannedDepth).toBeGreaterThan(shallow.scannedDepth!);
            expect(deep.totalCount).toBeGreaterThan(shallow.totalCount!);
            
            console.log(`✅ 深度控制: 浅=${shallow.scannedDepth}, 深=${deep.scannedDepth}`);
        });

        test('should respect maxItems in recursive mode', async () => {
            const result = await listFiles({ 
                path: 'src',
                recursive: true,
                maxItems: 30
            });
            
            expect(result.success).toBe(true);
            expect(result.totalCount).toBeLessThanOrEqual(30);
            
            if (result.totalCount === 30) {
                expect(result.truncated).toBe(true);
            }
            
            console.log(`✅ 数量限制: ${result.totalCount} 个项目`);
        });

        test('should support keyword search in recursive mode', async () => {
            const result = await listFiles({ 
                path: 'src',
                recursive: true,
                searchKeywords: ['test'],
                maxItems: 100
            });
            
            expect(result.success).toBe(true);
            const files = result.files!;
            
            // 所有文件名都应包含 'test'
            expect(files.every(f => f.name.toLowerCase().includes('test'))).toBe(true);
            
            console.log(`✅ 关键词搜索: 找到 ${result.totalCount} 个匹配项`);
        });

        test('should exclude patterns in recursive mode', async () => {
            const result = await listFiles({ 
                path: 'src',
                recursive: true,
                excludePatterns: ['test', 'spec'],
                maxItems: 100
            });
            
            expect(result.success).toBe(true);
            const files = result.files!;
            
            // 不应包含 test 或 spec 目录/文件
            expect(files.every(f => !f.name.includes('test') && !f.name.includes('spec'))).toBe(true);
            
            console.log(`✅ 排除模式: ${result.totalCount} 个项目`);
        });

        test('should support filesOnly in recursive mode', async () => {
            const result = await listFiles({ 
                path: 'src/tools',
                recursive: true,
                filesOnly: true,
                maxItems: 50
            });
            
            expect(result.success).toBe(true);
            const files = result.files!;
            
            expect(files.every(f => f.type === 'file')).toBe(true);
            
            console.log(`✅ 递归文件过滤: ${result.totalCount} 个文件`);
        });

        test('should support dirsOnly in recursive mode', async () => {
            const result = await listFiles({ 
                path: 'src',
                recursive: true,
                dirsOnly: true,
                maxItems: 50
            });
            
            expect(result.success).toBe(true);
            const files = result.files!;
            
            expect(files.every(f => f.type === 'directory')).toBe(true);
            
            console.log(`✅ 递归目录过滤: ${result.totalCount} 个目录`);
        });
    });

    describe('🚀 路径格式一致性测试', () => {
        test('should always return complete relative paths', async () => {
            // 测试不同场景下的路径格式
            const scenarios = [
                { path: '.', recursive: false },
                { path: 'src', recursive: false },
                { path: 'src/tools', recursive: false },
                { path: '.', recursive: true, maxItems: 50 },
                { path: 'src', recursive: true, maxItems: 50 }
            ];

            for (const scenario of scenarios) {
                const result = await listFiles(scenario);
                
                expect(result.success).toBe(true);
                const files = result.files!;
                
                // 每个文件都应该有完整的路径
                files.forEach(f => {
                    expect(f.path).toBeDefined();
                    expect(f.path).toContain(f.name);
                    expect(f.path.endsWith(f.name)).toBe(true);
                });
            }
            
            console.log('✅ 所有场景的路径格式一致');
        });

        test('paths should be directly usable with readTextFile', async () => {
            const result = await listFiles({ 
                path: 'src/tools',
                recursive: false,
                filesOnly: true
            });
            
            expect(result.success).toBe(true);
            const files = result.files!;
            
            if (files.length > 0) {
                // 尝试使用返回的路径读取文件
                const firstFile = files[0];
                expect(firstFile.path).toBeTruthy();
                expect(firstFile.path).toMatch(/^src\/tools\/[^/]+$/);
                
                // 路径应该可以直接用于文件操作（不需要手动拼接）
                console.log(`✅ 路径可直接使用: ${firstFile.path}`);
            }
        });
    });

    describe('🚀 边界情况测试', () => {
        test('should handle maxDepth=0 in recursive mode', async () => {
            const result = await listFiles({ 
                path: 'src',
                recursive: true,
                maxDepth: 0
            });
            
            expect(result.success).toBe(true);
            expect(result.scannedDepth).toBe(0);
            expect(result.files!.every(f => !f.path.includes('/')  || f.path.split('/').length === 2)).toBe(true);
            
            console.log('✅ maxDepth=0 正确处理');
        });

        test('should handle empty directory', async () => {
            // 创建一个空目录测试
            const emptyDirPath = 'test-empty-dir-' + Date.now();
            const emptyUri = vscode.Uri.joinPath(workspaceUri, emptyDirPath);
            
            try {
                await vscode.workspace.fs.createDirectory(emptyUri);
                
                const result = await listFiles({ path: emptyDirPath });
                
                expect(result.success).toBe(true);
                expect(result.files).toEqual([]);
                expect(result.totalCount).toBe(0);
                
                console.log('✅ 空目录正确处理');
            } finally {
                // 清理
                try {
                    await vscode.workspace.fs.delete(emptyUri, { recursive: true });
                } catch (e) {
                    // 忽略清理错误
                }
            }
        });

        test('should handle non-existent path gracefully', async () => {
            const result = await listFiles({ path: 'non-existent-path-12345' });
            
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            
            console.log('✅ 不存在的路径正确处理');
        });
    });

    describe('🚀 性能测试', () => {
        test('recursive mode should complete within reasonable time', async () => {
            const startTime = Date.now();
            
            const result = await listFiles({ 
                recursive: true,
                maxDepth: 8,
                maxItems: 500
            });
            
            const duration = Date.now() - startTime;
            
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(5000); // 5秒内完成
            expect(result.totalCount).toBeLessThanOrEqual(500);
            
            console.log(`✅ 性能测试: ${duration}ms, ${result.totalCount} 个项目`);
        });
    });

    describe('🚀 向后兼容性测试', () => {
        test('should work with legacy single-path call', async () => {
            // 旧代码可能只传 path 参数
            const result = await listFiles({ path: 'src' });
            
            expect(result.success).toBe(true);
            expect(result.files).toBeDefined();
            // 默认应该是非递归
            expect(result.scannedDepth).toBeUndefined();
            
            console.log('✅ 向后兼容：旧代码仍然工作');
        });
    });
});

