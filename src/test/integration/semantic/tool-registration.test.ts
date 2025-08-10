/**
 * 工具注册和缓存失效机制集成测试
 * 
 * 验证新语义编辑工具的注册和缓存失效机制是否正常工作
 */

import { ToolCacheManager } from '../../../core/orchestrator/ToolCacheManager';
import { toolRegistry, getImplementation } from '../../../tools/index';
import { CallerType } from '../../../types/index';

describe('Tool Registration Integration', () => {
    let cacheManager: ToolCacheManager;

    beforeEach(() => {
        cacheManager = new ToolCacheManager();
    });

    describe('Document Layer Tools Registration', () => {
        it('should have readMarkdownFile tool registered', () => {
            const hasReadMarkdownFile = toolRegistry.hasTool('readMarkdownFile');
            expect(hasReadMarkdownFile).toBe(true);

            const implementation = getImplementation('readMarkdownFile');
            expect(implementation).toBeDefined();
        });

        it('should have executeMarkdownEdits tool registered', () => {
            const hasExecuteMarkdownEdits = toolRegistry.hasTool('executeMarkdownEdits');
            expect(hasExecuteMarkdownEdits).toBe(true);

            const implementation = getImplementation('executeMarkdownEdits');
            expect(implementation).toBeDefined();
        });

        it('should have correct access control for document tools', async () => {
            const documentLayerTools = await cacheManager.getTools(CallerType.DOCUMENT);
            const toolNames = documentLayerTools.definitions.map(tool => tool.name);

            expect(toolNames).toContain('readMarkdownFile');
            expect(toolNames).toContain('executeMarkdownEdits');
        });

        it('should have document tools in document layer', () => {
            const documentTools = toolRegistry.getToolsByLayer('document');
            const toolNames = documentTools.map(tool => tool.name);

            expect(toolNames).toContain('readMarkdownFile');
            expect(toolNames).toContain('executeMarkdownEdits');
        });
    });

    describe('Cache Invalidation Mechanism', () => {
        it('should invalidate cache when tool is registered dynamically', async () => {
            // 获取初始工具列表
            const initialTools = await cacheManager.getTools(CallerType.DOCUMENT);
            const initialCount = initialTools.definitions.length;

            // 动态注册一个新工具
            const testToolDefinition = {
                name: 'testSemanticTool',
                description: 'Test tool for cache invalidation',
                parameters: { type: 'object', properties: {} },
                layer: 'document' as const,
                category: 'test',
                accessibleBy: [CallerType.DOCUMENT]
            };

            const testImplementation = async () => ({ success: true });

            toolRegistry.registerTool(testToolDefinition, testImplementation);

            // 再次获取工具列表，验证缓存已失效
            const updatedTools = await cacheManager.getTools(CallerType.DOCUMENT);
            const updatedCount = updatedTools.definitions.length;

            expect(updatedCount).toBe(initialCount + 1);
            expect(updatedTools.definitions.some(tool => tool.name === 'testSemanticTool')).toBe(true);

            // 清理测试工具
            toolRegistry.unregisterTool('testSemanticTool');
        });

        it('should invalidate cache when tool is unregistered', async () => {
            // 先注册一个工具
            const testToolDefinition = {
                name: 'tempTestTool',
                description: 'Temporary test tool',
                parameters: { type: 'object', properties: {} },
                layer: 'document' as const,
                category: 'test',
                accessibleBy: [CallerType.DOCUMENT]
            };

            toolRegistry.registerTool(testToolDefinition);

            // 获取工具列表
            const toolsWithTemp = await cacheManager.getTools(CallerType.DOCUMENT);
            const countWithTemp = toolsWithTemp.definitions.length;

            // 移除工具
            const removed = toolRegistry.unregisterTool('tempTestTool');
            expect(removed).toBe(true);

            // 验证缓存已失效，工具列表已更新
            const toolsWithoutTemp = await cacheManager.getTools(CallerType.DOCUMENT);
            const countWithoutTemp = toolsWithoutTemp.definitions.length;

            expect(countWithoutTemp).toBe(countWithTemp - 1);
            expect(toolsWithoutTemp.definitions.some(tool => tool.name === 'tempTestTool')).toBe(false);
        });
    });

    describe('Tool Registry Statistics', () => {
        it('should include document tools in statistics', () => {
            const stats = toolRegistry.getStats();

            expect(stats.byLayer.document).toBeGreaterThan(0);
            expect(stats.totalTools).toBeGreaterThan(0);

            // 验证包含核心文档工具
            const documentTools = toolRegistry.getToolsByLayer('document');
            const coreToolsCount = documentTools.filter(tool => 
                tool.name === 'readMarkdownFile' || 
                tool.name === 'executeMarkdownEdits'
            ).length;

            expect(coreToolsCount).toBe(2);
        });

        it('should have correct tool categories for document tools', () => {
            const categories = toolRegistry.getAllCategories();
            const categoryNames = categories.map(cat => cat.name);

            expect(categoryNames).toContain('Enhanced ReadMarkdownFile Tool');
            expect(categoryNames).toContain('Markdown Semantic Edit Engine');
        });
    });

    describe('Access Control Validation', () => {
        it('should respect access control for different caller types', async () => {
            // 验证DOCUMENT层调用者可以访问文档工具
            const documentTools = await cacheManager.getTools(CallerType.DOCUMENT);
            const documentToolNames = documentTools.definitions.map(tool => tool.name);

            expect(documentToolNames).toContain('readMarkdownFile');
            expect(documentToolNames).toContain('executeMarkdownEdits');

            // 验证SPECIALIST层调用者也可以访问这些工具
            const specialistContentTools = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT);
            const specialistProcessTools = await cacheManager.getTools(CallerType.SPECIALIST_PROCESS);
            const contentToolNames = specialistContentTools.definitions.map(tool => tool.name);
            const processToolNames = specialistProcessTools.definitions.map(tool => tool.name);

            // 两种类型的specialist都应该能访问这些核心工具
            expect(contentToolNames).toContain('readMarkdownFile');
            expect(contentToolNames).toContain('executeMarkdownEdits');
            expect(processToolNames).toContain('readMarkdownFile');
            expect(processToolNames).toContain('executeMarkdownEdits');
        });

        it('should validate individual tool access correctly', () => {
            const hasDocumentAccess = cacheManager.validateAccess(CallerType.DOCUMENT, 'executeMarkdownEdits');
            const hasContentSpecialistAccess = cacheManager.validateAccess(CallerType.SPECIALIST_CONTENT, 'executeMarkdownEdits');
            const hasProcessSpecialistAccess = cacheManager.validateAccess(CallerType.SPECIALIST_PROCESS, 'executeMarkdownEdits');

            expect(hasDocumentAccess).toBe(true);
            expect(hasContentSpecialistAccess).toBe(true);
            expect(hasProcessSpecialistAccess).toBe(true);
        });
    });
}); 