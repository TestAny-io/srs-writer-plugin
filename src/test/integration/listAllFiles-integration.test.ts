/**
 * listAllFiles Tool Integration Tests
 * 
 * Test various functionalities and edge cases of the new recursive file listing tool
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { listAllFiles } from '../../tools/atomic/filesystem-tools';

describe('listAllFiles Integration Tests', () => {
    let workspaceUri: vscode.Uri;

    beforeAll(async () => {
        // Ensure workspace is available
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder available for testing');
        }
        workspaceUri = workspaceFolders[0].uri;
    });

    describe('Basic Functionality Tests', () => {
        test('should list all files from workspace root', async () => {
            const result = await listAllFiles({});
            
            expect(result.success).toBe(true);
            expect(result.structure).toBeDefined();
            expect(result.structure!.paths).toBeInstanceOf(Array);
            expect(result.structure!.totalCount).toBeGreaterThan(0);
            
            // Verify expected files are included
            const paths = result.structure!.paths;
            expect(paths.some(p => p.includes('package.json'))).toBe(true);
            expect(paths.some(p => p.includes('src'))).toBe(true);
            
            console.log(`✅ Listed ${result.structure!.totalCount} items from root directory`);
        });

        test('should exclude hidden files and default patterns', async () => {
            const result = await listAllFiles({});
            
            expect(result.success).toBe(true);
            const paths = result.structure!.paths;
            
            // 不应包含隐藏文件和默认排除的目录
            expect(paths.some(p => p.startsWith('.git'))).toBe(false);
            expect(paths.some(p => p.includes('node_modules'))).toBe(false);
            expect(paths.some(p => p.includes('coverage'))).toBe(false);
            expect(paths.some(p => p.startsWith('.vscode'))).toBe(false);
            
            console.log('✅ 正确排除了隐藏文件和默认模式');
        });

        test('should sort paths alphabetically', async () => {
            const result = await listAllFiles({ maxItems: 100 });
            
            expect(result.success).toBe(true);
            const paths = result.structure!.paths;
            
            // 验证排序
            const sortedPaths = [...paths].sort();
            expect(paths).toEqual(sortedPaths);
            
            console.log('✅ 路径按字母顺序正确排序');
        });
    });

    describe('参数功能测试', () => {
        test('should respect maxDepth parameter', async () => {
            const shallowResult = await listAllFiles({ maxDepth: 1 });
            const deepResult = await listAllFiles({ maxDepth: 5 });
            
            expect(shallowResult.success).toBe(true);
            expect(deepResult.success).toBe(true);
            
            expect(shallowResult.structure!.depth).toBeLessThanOrEqual(1);
            expect(deepResult.structure!.depth).toBeGreaterThan(shallowResult.structure!.depth);
            
            console.log(`✅ 深度限制工作正常: 浅层 ${shallowResult.structure!.depth}, 深层 ${deepResult.structure!.depth}`);
        });

        test('should respect maxItems parameter', async () => {
            const limitedResult = await listAllFiles({ maxItems: 50 });
            
            expect(limitedResult.success).toBe(true);
            expect(limitedResult.structure!.totalCount).toBeLessThanOrEqual(50);
            
            if (limitedResult.structure!.totalCount === 50) {
                expect(limitedResult.structure!.truncated).toBe(true);
            }
            
            console.log(`✅ 项目数量限制工作正常: ${limitedResult.structure!.totalCount} 个项目`);
        });

        test('should filter to directories only when dirsOnly=true', async () => {
            const dirsOnlyResult = await listAllFiles({ dirsOnly: true, maxItems: 100 });
            const allResult = await listAllFiles({ maxItems: 100 });
            
            expect(dirsOnlyResult.success).toBe(true);
            expect(allResult.success).toBe(true);
            
            expect(dirsOnlyResult.structure!.totalCount).toBeLessThan(allResult.structure!.totalCount);
            
            console.log(`✅ 目录过滤工作正常: 仅目录 ${dirsOnlyResult.structure!.totalCount}, 全部 ${allResult.structure!.totalCount}`);
        });

        test('should respect custom excludePatterns', async () => {
            const customExcludeResult = await listAllFiles({
                excludePatterns: ['src', 'test'],
                maxItems: 200
            });
            
            expect(customExcludeResult.success).toBe(true);
            const paths = customExcludeResult.structure!.paths;
            
            expect(paths.some(p => p.startsWith('src/'))).toBe(false);
            expect(paths.some(p => p.includes('test'))).toBe(false);
            
            console.log('✅ 自定义排除模式工作正常');
        });

        // 🚀 注释：startPath参数已移除，工具现在固定从workspace根目录开始扫描
        // test('should start from custom startPath', async () => {
        //     const srcResult = await listAllFiles({ 
        //         startPath: 'src',
        //         maxItems: 100 
        //     });
        //     
        //     expect(srcResult.success).toBe(true);
        //     const paths = srcResult.structure!.paths;
        //     
        //     // 所有路径都应该以相对于src的路径开始
        //     expect(paths.every(p => !p.startsWith('src/'))).toBe(true);
        //     expect(paths.some(p => p.includes('tools'))).toBe(true);
        //     
        //     console.log(`✅ 自定义起始路径工作正常: 从src目录列出了 ${srcResult.structure!.totalCount} 个项目`);
        // });

        test('should always start from workspace root', async () => {
            const result = await listAllFiles({ maxItems: 100 });
            
            expect(result.success).toBe(true);
            const paths = result.structure!.paths;
            
            // 验证从根目录开始，应该包含顶级目录
            expect(paths.some(p => p.startsWith('src'))).toBe(true);
            expect(paths.some(p => p === 'package.json')).toBe(true);
            
            console.log(`✅ 固定从workspace根目录开始: 列出了 ${result.structure!.totalCount} 个项目`);
        });
    });

    describe('边界情况测试', () => {
        // 🚀 注释：startPath参数已移除，此测试不再适用
        // test('should handle non-existent startPath gracefully', async () => {
        //     const result = await listAllFiles({ startPath: 'non-existent-directory' });
        //     
        //     expect(result.success).toBe(false);
        //     expect(result.error).toBeDefined();
        //     expect(result.error).toContain('non-existent-directory');
        //     
        //     console.log('✅ 正确处理不存在的起始路径');
        // });

        test('should handle maxDepth=0', async () => {
            const result = await listAllFiles({ maxDepth: 0 });
            
            expect(result.success).toBe(true);
            expect(result.structure!.depth).toBe(0);
            expect(result.structure!.paths.length).toBeGreaterThan(0);
            
            // 确保没有子目录路径
            expect(result.structure!.paths.every(p => !p.includes('/'))).toBe(true);
            
            console.log('✅ 正确处理maxDepth=0的情况');
        });

        test('should handle maxItems=1', async () => {
            const result = await listAllFiles({ maxItems: 1 });
            
            expect(result.success).toBe(true);
            expect(result.structure!.totalCount).toBe(1);
            expect(result.structure!.truncated).toBe(true);
            
            console.log('✅ 正确处理maxItems=1的情况');
        });

        test('should handle empty excludePatterns array', async () => {
            const result = await listAllFiles({ 
                excludePatterns: [],
                maxItems: 200 
            });
            
            expect(result.success).toBe(true);
            // 应该包含更多文件，因为没有排除任何模式
            expect(result.structure!.totalCount).toBeGreaterThan(0);
            
            console.log('✅ 正确处理空的排除模式数组');
        });
    });

    describe('性能和稳定性测试', () => {
        test('should not exceed performance limits', async () => {
            const startTime = Date.now();
            
            const result = await listAllFiles({
                maxDepth: 8,
                maxItems: 500
            });
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(5000); // 不超过5秒
            expect(result.structure!.totalCount).toBeLessThanOrEqual(500);
            
            console.log(`✅ 性能测试通过: ${duration}ms, ${result.structure!.totalCount} 个项目`);
        });

        test('should handle wildcards in excludePatterns', async () => {
            const result = await listAllFiles({
                excludePatterns: ['*.test.*', '*.spec.*'],
                maxItems: 200
            });
            
            expect(result.success).toBe(true);
            const paths = result.structure!.paths;
            
            // 不应包含测试文件
            expect(paths.some(p => p.includes('.test.'))).toBe(false);
            expect(paths.some(p => p.includes('.spec.'))).toBe(false);
            
            console.log('✅ 通配符排除模式工作正常');
        });
    });

    describe('工具注册测试', () => {
        test('should be properly registered in toolRegistry', async () => {
            // 这个测试确保工具被正确注册
            const { getAllDefinitions } = await import('../../tools/index');
            const definitions = getAllDefinitions();
            
            const listAllFilesDef = definitions.find(def => def.name === 'listAllFiles');
            expect(listAllFilesDef).toBeDefined();
            expect(listAllFilesDef!.description).toContain('递归列出');
            expect(listAllFilesDef!.layer).toBe('atomic');
            expect(listAllFilesDef!.accessibleBy).toContain('orchestrator:TOOL_EXECUTION');
            
            console.log('✅ 工具在注册表中正确注册');
        });
    });
}); 