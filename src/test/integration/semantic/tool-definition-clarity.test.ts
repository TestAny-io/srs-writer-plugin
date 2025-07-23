/**
 * 测试工具定义的清晰度
 * 
 * 验证executeMarkdownEdits工具定义是否明确禁止层级跳跃
 */

import { executeMarkdownEditsToolDefinition } from '../../../tools/document/semantic-edit-engine';

describe('Tool Definition Clarity Tests', () => {
    
    test('executeMarkdownEdits工具定义应该明确禁止层级跳跃', () => {
        const pathDesc = executeMarkdownEditsToolDefinition.parameters.properties.intents.items.properties.target.properties.path.description;
        
        // 验证描述包含关键的禁止跳跃信息
        expect(pathDesc).toContain('NO LEVEL SKIPPING');
        expect(pathDesc).toContain('MUST include ALL hierarchical levels');
        expect(pathDesc).toContain('Incomplete paths will fail matching');
        
        // 验证包含具体的例子说明
        expect(pathDesc).toContain("CANNOT use path ['Level2', 'Level4']");
        expect(pathDesc).toContain("MUST use complete path ['Level2', 'Level3', 'Level4']");
        
        console.log('✅ 工具定义已更新，现在明确禁止AI跳层级：');
        console.log('🔍 Path参数描述包含:');
        console.log('  - NO LEVEL SKIPPING allowed');
        console.log('  - MUST include ALL hierarchical levels');
        console.log('  - Incomplete paths will fail matching');
        console.log('  - 具体的错误/正确示例');
    });
    
    test('工具定义结构完整性检查', () => {
        // 确保工具定义的基本结构没有因为修改而破坏
        expect(executeMarkdownEditsToolDefinition.name).toBe('executeMarkdownEdits');
        expect(executeMarkdownEditsToolDefinition.parameters.properties.intents.items.properties.target.properties.path.type).toBe('array');
        expect(executeMarkdownEditsToolDefinition.parameters.properties.intents.items.properties.target.required).toContain('path');
    });
}); 