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

    describe('Semantic Edit Tools Registration', () => {
        it('should have readFileWithStructure tool registered', () => {
            const hasReadFileWithStructure = toolRegistry.hasTool('readFileWithStructure');
            expect(hasReadFileWithStructure).toBe(true);

            const implementation = getImplementation('readFileWithStructure');
            expect(implementation).toBeDefined();
        });

        it('should have executeSemanticEdits tool registered', () => {
            const hasExecuteSemanticEdits = toolRegistry.hasTool('executeSemanticEdits');
            expect(hasExecuteSemanticEdits).toBe(true);

            const implementation = getImplementation('executeSemanticEdits');
            expect(implementation).toBeDefined();
        });

        it('should have correct access control for semantic tools', async () => {
            const documentLayerTools = await cacheManager.getTools(CallerType.DOCUMENT);
            const toolNames = documentLayerTools.definitions.map(tool => tool.name);

            expect(toolNames).toContain('readFileWithStructure');
            expect(toolNames).toContain('executeSemanticEdits');
        });

        it('should have semantic edit tools in document layer', () => {
            const documentTools = toolRegistry.getToolsByLayer('document');
            const toolNames = documentTools.map(tool => tool.name);

            expect(toolNames).toContain('readFileWithStructure');
            expect(toolNames).toContain('executeSemanticEdits');
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
                category: 'test'
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
                category: 'test'
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
        it('should include semantic tools in statistics', () => {
            const stats = toolRegistry.getStats();

            expect(stats.byLayer.document).toBeGreaterThan(0);
            expect(stats.totalTools).toBeGreaterThan(0);

            // 验证至少包含我们新增的语义编辑工具
            const documentTools = toolRegistry.getToolsByLayer('document');
            const semanticToolsCount = documentTools.filter(tool => 
                tool.name === 'readFileWithStructure' || 
                tool.name === 'executeSemanticEdits'
            ).length;

            expect(semanticToolsCount).toBe(2);
        });

        it('should have correct tool categories for semantic tools', () => {
            const categories = toolRegistry.getAllCategories();
            const categoryNames = categories.map(cat => cat.name);

            expect(categoryNames).toContain('Enhanced ReadFile Tools');
            expect(categoryNames).toContain('Semantic Edit Engine');
        });
    });

    describe('Access Control Validation', () => {
        it('should respect access control for different caller types', async () => {
            // 验证DOCUMENT层调用者可以访问语义编辑工具
            const documentTools = await cacheManager.getTools(CallerType.DOCUMENT);
            const documentToolNames = documentTools.definitions.map(tool => tool.name);

            expect(documentToolNames).toContain('readFileWithStructure');
            expect(documentToolNames).toContain('executeSemanticEdits');

            // 验证SPECIALIST层调用者也可以访问这些工具
            const specialistTools = await cacheManager.getTools(CallerType.SPECIALIST);
            const specialistToolNames = specialistTools.definitions.map(tool => tool.name);

            expect(specialistToolNames).toContain('readFileWithStructure');
            expect(specialistToolNames).toContain('executeSemanticEdits');
        });

        it('should validate individual tool access correctly', () => {
            const hasDocumentAccess = cacheManager.validateAccess(CallerType.DOCUMENT, 'executeSemanticEdits');
            const hasSpecialistAccess = cacheManager.validateAccess(CallerType.SPECIALIST, 'executeSemanticEdits');

            expect(hasDocumentAccess).toBe(true);
            expect(hasSpecialistAccess).toBe(true);
        });
    });
}); 