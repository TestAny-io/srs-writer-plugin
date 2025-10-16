/**
 * listFiles Unit Tests (Refactored)
 * 
 * 单元测试重构后的 listFiles 工具的核心逻辑
 */

import { listFilesToolDefinition } from '../../tools/atomic/filesystem-tools';
import { CallerType } from '../../types/index';

describe('listFiles Unit Tests (Refactored)', () => {
    describe('工具定义验证', () => {
        test('should have correct tool name', () => {
            expect(listFilesToolDefinition.name).toBe('listFiles');
        });

        test('should have comprehensive description', () => {
            expect(listFilesToolDefinition.description).toBeTruthy();
            expect(listFilesToolDefinition.description).toContain('recursive');
            expect(listFilesToolDefinition.description).toContain('relative paths');
        });

        test('should have all required parameters', () => {
            const params = listFilesToolDefinition.parameters.properties;
            
            // 核心参数
            expect(params.path).toBeDefined();
            expect(params.recursive).toBeDefined();
            
            // 控制参数
            expect(params.maxDepth).toBeDefined();
            expect(params.maxItems).toBeDefined();
            expect(params.excludePatterns).toBeDefined();
            
            // 过滤参数
            expect(params.searchKeywords).toBeDefined();
            expect(params.dirsOnly).toBeDefined();
            expect(params.filesOnly).toBeDefined();
        });

        test('should have correct default values', () => {
            const params = listFilesToolDefinition.parameters.properties;
            
            expect(params.path.default).toBe('.');
            expect(params.recursive.default).toBe(false);
            expect(params.maxDepth.default).toBe(10);
            expect(params.maxItems.default).toBe(1000);
            expect(params.dirsOnly.default).toBe(false);
            expect(params.filesOnly.default).toBe(false);
        });

        test('should have correct access control', () => {
            const accessibleBy = listFilesToolDefinition.accessibleBy;
            
            expect(accessibleBy).toContain(CallerType.ORCHESTRATOR_KNOWLEDGE_QA);
            expect(accessibleBy).toContain(CallerType.SPECIALIST_PROCESS);
            expect(accessibleBy).toContain(CallerType.SPECIALIST_CONTENT);
            expect(accessibleBy).toContain(CallerType.DOCUMENT);
        });

        test('should not have required parameters (all optional)', () => {
            // 所有参数都应该是可选的
            const params = listFilesToolDefinition.parameters as any;
            expect(params.required).toBeUndefined();
        });
    });

    describe('参数验证', () => {
        test('path parameter should accept string', () => {
            const pathParam = listFilesToolDefinition.parameters.properties.path;
            expect(pathParam.type).toBe('string');
        });

        test('recursive parameter should be boolean', () => {
            const recursiveParam = listFilesToolDefinition.parameters.properties.recursive;
            expect(recursiveParam.type).toBe('boolean');
        });

        test('maxDepth parameter should be number', () => {
            const maxDepthParam = listFilesToolDefinition.parameters.properties.maxDepth;
            expect(maxDepthParam.type).toBe('number');
        });

        test('maxItems parameter should be number', () => {
            const maxItemsParam = listFilesToolDefinition.parameters.properties.maxItems;
            expect(maxItemsParam.type).toBe('number');
        });

        test('excludePatterns parameter should be array of strings', () => {
            const excludeParam = listFilesToolDefinition.parameters.properties.excludePatterns;
            expect(excludeParam.type).toBe('array');
            expect(excludeParam.items.type).toBe('string');
        });

        test('searchKeywords parameter should be array of strings', () => {
            const keywordsParam = listFilesToolDefinition.parameters.properties.searchKeywords;
            expect(keywordsParam.type).toBe('array');
            expect(keywordsParam.items.type).toBe('string');
        });
    });

    describe('设计原则验证', () => {
        test('should prioritize ease of use (complete paths)', () => {
            // 描述中应该提到返回完整路径
            expect(listFilesToolDefinition.description.toLowerCase()).toContain('complete');
        });

        test('should support both single-level and recursive modes', () => {
            const desc = listFilesToolDefinition.description.toLowerCase();
            expect(desc).toContain('recursive');
        });

        test('should have safe default (non-recursive)', () => {
            const recursiveParam = listFilesToolDefinition.parameters.properties.recursive;
            expect(recursiveParam.default).toBe(false);
        });

        test('should have reasonable performance limits', () => {
            const maxDepth = listFilesToolDefinition.parameters.properties.maxDepth.default;
            const maxItems = listFilesToolDefinition.parameters.properties.maxItems.default;
            
            expect(maxDepth).toBeLessThanOrEqual(10); // 不会太深
            expect(maxItems).toBeLessThanOrEqual(1000); // 不会太多
        });
    });

    describe('向后兼容性', () => {
        test('should accept old-style single path parameter', () => {
            // 旧代码：listFiles({ path: "src" })
            // 应该仍然可以工作（所有参数都是可选的）
            const params = listFilesToolDefinition.parameters.properties;
            
            // path 参数存在且是字符串
            expect(params.path).toBeDefined();
            expect(params.path.type).toBe('string');
        });

        test('default behavior should match old listFiles (non-recursive)', () => {
            const recursiveParam = listFilesToolDefinition.parameters.properties.recursive;
            expect(recursiveParam.default).toBe(false);
        });
    });

    describe('功能完整性', () => {
        test('should support all listAllFiles features', () => {
            const params = listFilesToolDefinition.parameters.properties;
            
            // 来自 listAllFiles 的功能
            expect(params.recursive).toBeDefined();
            expect(params.maxDepth).toBeDefined();
            expect(params.maxItems).toBeDefined();
            expect(params.excludePatterns).toBeDefined();
            expect(params.searchKeywords).toBeDefined();
            expect(params.dirsOnly).toBeDefined();
        });

        test('should add new feature: filesOnly', () => {
            const params = listFilesToolDefinition.parameters.properties;
            expect(params.filesOnly).toBeDefined();
        });

        test('should support starting from any directory', () => {
            const pathParam = listFilesToolDefinition.parameters.properties.path;
            expect(pathParam).toBeDefined();
            expect(pathParam.default).toBe('.');
        });
    });

    describe('返回值结构验证', () => {
        test('should document expected return structure', () => {
            // 通过工具描述或参数描述来验证返回值结构
            const desc = listFilesToolDefinition.description;
            
            // 应该提到返回路径信息
            expect(desc.toLowerCase()).toMatch(/path|list|files/);
        });

        test('should support both file and directory types', () => {
            const params = listFilesToolDefinition.parameters.properties;
            
            // 通过 dirsOnly 和 filesOnly 参数可以推断支持两种类型
            expect(params.dirsOnly).toBeDefined();
            expect(params.filesOnly).toBeDefined();
        });
    });

    describe('错误处理', () => {
        test('should have safe default for excludePatterns', () => {
            const excludeParam = listFilesToolDefinition.parameters.properties.excludePatterns;
            expect(excludeParam.default).toBeDefined();
            expect(Array.isArray(excludeParam.default)).toBe(true);
            
            // 应该默认排除常见的大目录
            expect(excludeParam.default).toContain('node_modules');
        });

        test('should have sensible maxItems default to prevent hangs', () => {
            const maxItemsParam = listFilesToolDefinition.parameters.properties.maxItems;
            expect(maxItemsParam.default).toBeLessThanOrEqual(1000);
            expect(maxItemsParam.default).toBeGreaterThan(0);
        });
    });

    describe('文档质量', () => {
        test('should have clear parameter descriptions', () => {
            const params = listFilesToolDefinition.parameters.properties;
            
            Object.entries(params).forEach(([name, param]: [string, any]) => {
                expect(param.description).toBeTruthy();
                expect(param.description.length).toBeGreaterThan(10);
            });
        });

        test('should mention complete paths in description', () => {
            expect(listFilesToolDefinition.description).toContain('complete');
        });
    });
});

