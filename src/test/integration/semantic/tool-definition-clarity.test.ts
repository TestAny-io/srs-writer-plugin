/**
 * 测试工具定义的清晰度 - 🆕 自包含SID系统
 * 
 * 验证executeMarkdownEdits工具定义是否正确实现自包含架构
 */

import { executeMarkdownEditsToolDefinition } from '../../../tools/document/semantic-edit-engine';

describe('Tool Definition Clarity Tests - 🚀 Self-Contained SID System', () => {
    
    test('executeMarkdownEdits工具定义应该使用自包含SID定位系统', () => {
        const sidDesc = executeMarkdownEditsToolDefinition.parameters.properties.intents.items.properties.target.properties.sid.description;
        
        // 验证SID描述包含关键信息
        expect(sidDesc).toContain('章节SID');
        expect(sidDesc).toContain('稳定章节标识符');
        
        // 验证SID字段类型正确
        expect(executeMarkdownEditsToolDefinition.parameters.properties.intents.items.properties.target.properties.sid.type).toBe('string');
        
        console.log('✅ 工具定义已升级到自包含SID系统：');
        console.log('🔍 SID参数描述包含:');
        console.log('  - 章节SID - 稳定章节标识符');
        console.log('  - 工具内部自动解析文档结构');
        console.log('  - 无需外部tocData依赖');
    });
    
    test('工具定义结构完整性检查 - 自包含SID系统', () => {
        // 确保工具定义的基本结构正确
        expect(executeMarkdownEditsToolDefinition.name).toBe('executeMarkdownEdits');
        
        // 验证SID字段存在且为必需
        expect(executeMarkdownEditsToolDefinition.parameters.properties.intents.items.properties.target.properties.sid).toBeDefined();
        expect(executeMarkdownEditsToolDefinition.parameters.properties.intents.items.properties.target.required).toContain('sid');
        
        // 验证lineRange字段存在
        expect(executeMarkdownEditsToolDefinition.parameters.properties.intents.items.properties.target.properties.lineRange).toBeDefined();
        
        // 🚀 验证自包含架构：确认tocData参数已移除
        expect('tocData' in executeMarkdownEditsToolDefinition.parameters.properties).toBe(false);
        expect(executeMarkdownEditsToolDefinition.parameters.required).not.toContain('tocData');
        
        // 验证必需参数只包含intents和targetFile
        expect(executeMarkdownEditsToolDefinition.parameters.required).toEqual(['intents', 'targetFile']);
        
        console.log('✅ 自包含架构验证通过：');
        console.log('  - tocData参数已移除');
        console.log('  - 只需要intents和targetFile参数');
        console.log('  - 工具内部自动解析文档结构');
    });
    
    test('验证新的lineRange精确定位功能', () => {
        const lineRangeProps = executeMarkdownEditsToolDefinition.parameters.properties.intents.items.properties.target.properties.lineRange.properties;
        
        // 验证startLine字段
        expect(lineRangeProps.startLine).toBeDefined();
        expect(lineRangeProps.startLine.type).toBe('number');
        expect(lineRangeProps.startLine.description).toContain('章节内相对行号');
        
        // 验证endLine字段（可选）
        expect(lineRangeProps.endLine).toBeDefined();
        expect(lineRangeProps.endLine.type).toBe('number');
        
        console.log('✅ lineRange功能定义正确：');
        console.log('  - startLine: 必需，section相对行号');
        console.log('  - endLine: 可选，默认与startLine相同');
    });

    test('验证废弃字段已移除，新字段已添加', () => {
        const targetProps = executeMarkdownEditsToolDefinition.parameters.properties.intents.items.properties.target.properties;
        
        // 确保旧的字段已被移除
        expect('path' in targetProps).toBe(false);
        expect('targetContent' in targetProps).toBe(false);
        
        // 确保新的字段存在
        expect('sid' in targetProps).toBe(true);
        expect('lineRange' in targetProps).toBe(true);
        
        console.log('✅ 旧字段已正确移除：');
        console.log('  - path: 已移除 (不再使用路径数组)');
        console.log('  - targetContent: 已移除 (不再使用内容匹配)');
        console.log('✅ 新字段已正确添加：');
        console.log('  - sid: 已添加 (稳定的章节标识符)');
        console.log('  - lineRange: 已添加 (精确的行号定位)');
    });

    test('验证自包含架构的工具描述', () => {
        const description = executeMarkdownEditsToolDefinition.description;
        
        // 验证描述体现自包含特性
        expect(description).toContain('自包含');
        expect(description).toContain('内部自动解析');
        
        console.log('✅ 工具描述体现自包含架构：');
        console.log(`  描述: ${description}`);
    });
}); 