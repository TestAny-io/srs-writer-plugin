/**
 * 工具字段过滤功能集成测试
 * 
 * 测试 ToolCacheManager.getToolsForPrompt() 方法是否正确过滤了指定的6个字段：
 * - interactionType
 * - riskLevel
 * - requiresConfirmation
 * - accessibleBy
 * - layer
 * - category
 */

import { ToolCacheManager } from '../../core/orchestrator/ToolCacheManager';
import { CallerType } from '../../types';

describe('工具字段过滤功能', () => {
    let toolCacheManager: ToolCacheManager;

    beforeEach(() => {
        toolCacheManager = new ToolCacheManager();
    });

    afterEach(() => {
        // 清理缓存
        toolCacheManager.invalidateToolCache();
    });

    test('getToolsForPrompt应该过滤掉指定的6个字段', async () => {
        // 获取完整版本的工具
        const fullTools = await toolCacheManager.getTools(CallerType.SPECIALIST_CONTENT);
        
        // 获取过滤版本的工具
        const filteredTools = await toolCacheManager.getToolsForPrompt(CallerType.SPECIALIST_CONTENT);

        // 验证数量相同
        expect(filteredTools.definitions.length).toBe(fullTools.definitions.length);
        expect(filteredTools.definitions.length).toBeGreaterThan(0);

        // 检查每个工具定义
        for (let i = 0; i < filteredTools.definitions.length; i++) {
            const originalTool = fullTools.definitions[i];
            const filteredTool = filteredTools.definitions[i];

            // 验证基础字段保留
            expect(filteredTool.name).toBe(originalTool.name);
            expect(filteredTool.description).toBe(originalTool.description);
            
            // 验证参数保留（如果存在）
            if (originalTool.parameters || originalTool.parametersSchema) {
                expect(filteredTool.parameters || filteredTool.parametersSchema).toBeDefined();
            }

            // 验证指定的6个字段被过滤掉
            expect(filteredTool).not.toHaveProperty('interactionType');
            expect(filteredTool).not.toHaveProperty('riskLevel');
            expect(filteredTool).not.toHaveProperty('requiresConfirmation');
            expect(filteredTool).not.toHaveProperty('accessibleBy');
            expect(filteredTool).not.toHaveProperty('layer');
            expect(filteredTool).not.toHaveProperty('category');

            // 验证原始工具确实有这些字段（至少部分工具应该有）
            // 这确保测试是有意义的
        }

        // 验证至少一些原始工具有被过滤的字段
        const hasFilteredFields = fullTools.definitions.some(tool => 
            tool.interactionType || 
            tool.riskLevel || 
            tool.requiresConfirmation || 
            tool.accessibleBy || 
            tool.layer || 
            tool.category
        );
        
        expect(hasFilteredFields).toBe(true); // 确保测试是有效的

        console.log(`✅ 测试通过: ${filteredTools.definitions.length} 个工具的字段过滤正确`);
    });

    test('getToolsForPrompt的JSON Schema应该比完整版本更小', async () => {
        // 获取完整版本和过滤版本
        const fullTools = await toolCacheManager.getTools(CallerType.SPECIALIST_CONTENT);
        const filteredTools = await toolCacheManager.getToolsForPrompt(CallerType.SPECIALIST_CONTENT);

        // 过滤版本的JSON Schema应该更小（因为每个工具少了6个字段）
        expect(filteredTools.jsonSchema.length).toBeLessThan(fullTools.jsonSchema.length);

        // 计算token节省（大概估算）
        const savings = fullTools.jsonSchema.length - filteredTools.jsonSchema.length;
        const percentageSaved = (savings / fullTools.jsonSchema.length) * 100;

        console.log(`📊 JSON Schema大小对比:`);
        console.log(`- 完整版本: ${fullTools.jsonSchema.length} 字符`);
        console.log(`- 过滤版本: ${filteredTools.jsonSchema.length} 字符`);
        console.log(`- 节省空间: ${savings} 字符 (${percentageSaved.toFixed(1)}%)`);

        // 期望至少节省5%的空间
        expect(percentageSaved).toBeGreaterThan(5);
    });

    test('应该保留核心字段如name, description, parameters', async () => {
        const filteredTools = await toolCacheManager.getToolsForPrompt(CallerType.SPECIALIST_CONTENT);

        // 找一个有参数的工具来测试
        const toolWithParams = filteredTools.definitions.find(tool => 
            tool.parameters || tool.parametersSchema
        );

        if (toolWithParams) {
            expect(toolWithParams.name).toBeDefined();
            expect(typeof toolWithParams.name).toBe('string');
            
            expect(toolWithParams.description).toBeDefined();
            expect(typeof toolWithParams.description).toBe('string');
            
            expect(toolWithParams.parameters || toolWithParams.parametersSchema).toBeDefined();
            expect(typeof (toolWithParams.parameters || toolWithParams.parametersSchema)).toBe('object');

            console.log(`✅ 核心字段保留正确: ${toolWithParams.name}`);
        }
    });

    test('不同CallerType应该都能正确过滤', async () => {
        const callerTypes = [
            CallerType.SPECIALIST_CONTENT,
            CallerType.SPECIALIST_PROCESS,
            CallerType.ORCHESTRATOR_TOOL_EXECUTION
        ];

        for (const callerType of callerTypes) {
            const filteredTools = await toolCacheManager.getToolsForPrompt(callerType);
            
            expect(filteredTools.definitions.length).toBeGreaterThanOrEqual(0);
            
            // 检查过滤效果
            for (const tool of filteredTools.definitions) {
                expect(tool).not.toHaveProperty('interactionType');
                expect(tool).not.toHaveProperty('riskLevel');
                expect(tool).not.toHaveProperty('requiresConfirmation');
                expect(tool).not.toHaveProperty('accessibleBy');
                expect(tool).not.toHaveProperty('layer');
                expect(tool).not.toHaveProperty('category');
            }

            console.log(`✅ ${callerType} 过滤正确: ${filteredTools.definitions.length} 个工具`);
        }
    });

    test('JSON Schema格式应该正确', async () => {
        const filteredTools = await toolCacheManager.getToolsForPrompt(CallerType.SPECIALIST_CONTENT);
        
        // 验证JSON Schema是有效的JSON
        expect(() => JSON.parse(filteredTools.jsonSchema)).not.toThrow();
        
        // 解析后验证结构
        const parsedSchema = JSON.parse(filteredTools.jsonSchema);
        expect(Array.isArray(parsedSchema)).toBe(true);
        expect(parsedSchema.length).toBe(filteredTools.definitions.length);

        // 验证每个工具在JSON Schema中的结构
        for (const tool of parsedSchema) {
            expect(tool.name).toBeDefined();
            expect(tool.description).toBeDefined();
            
            // 确保过滤字段不存在于JSON Schema中
            expect(tool.interactionType).toBeUndefined();
            expect(tool.riskLevel).toBeUndefined();
            expect(tool.requiresConfirmation).toBeUndefined();
            expect(tool.accessibleBy).toBeUndefined();
            expect(tool.layer).toBeUndefined();
            expect(tool.category).toBeUndefined();
        }

        console.log(`✅ JSON Schema格式正确，包含 ${parsedSchema.length} 个工具定义`);
    });
});
