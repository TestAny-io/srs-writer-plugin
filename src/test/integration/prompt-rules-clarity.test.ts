/**
 * 测试提示词规则清晰度
 * 
 * 验证output-format-schema.md中的规则是否清晰明确
 */

import { readFileSync } from 'fs';
import { join } from 'path';

describe('Prompt Rules Clarity Tests', () => {
    
    let schemaContent: string;
    
    beforeAll(() => {
        const schemaPath = join(__dirname, '../../../rules/base/output-format-schema.md');
        schemaContent = readFileSync(schemaPath, 'utf-8');
    });
    
    test('应该包含强化的必须遵守规则', () => {
        // 验证包含"必须遵守的规则"章节
        expect(schemaContent).toContain('#### **必须遵守的规则**');
        
        // 验证关键的必须规则
        expect(schemaContent).toContain('**必须提供完整的层级路径**');
        expect(schemaContent).toContain('path数组必须包含从根章节到目标章节的所有中间层级，不得跳过任何层级');
        expect(schemaContent).toContain('**必须使用精确的章节名称**');
        expect(schemaContent).toContain('**必须使用正确的操作类型**');
        expect(schemaContent).toContain('**必须提供targetContent**');
        expect(schemaContent).toContain('**必须包含reason字段**');
        
        console.log('✅ 所有"必须"规则已正确添加');
    });
    
    test('应该包含强化的禁止行为规则', () => {
        // 验证包含"禁止的行为"章节
        expect(schemaContent).toContain('#### **禁止的行为**');
        
        // 验证关键的禁止规则
        expect(schemaContent).toContain('**禁止跳跃层级**');
        expect(schemaContent).toContain('绝对不允许在path中省略中间层级');
        expect(schemaContent).toContain('禁止使用["Level2", "Level4"]，必须使用["Level2", "Level3", "Level4"]');
        expect(schemaContent).toContain('**禁止使用模糊匹配**');
        expect(schemaContent).toContain('**禁止混用不同文档的工具**');
        expect(schemaContent).toContain('**禁止在单次调用中混合大量操作**');
        
        console.log('✅ 所有"禁止"规则已正确添加');
    });
    
    test('应该包含具体的正确和错误示例', () => {
        // 验证正确示例
        expect(schemaContent).toContain('#### 正确示例');
        expect(schemaContent).toContain('✅ 正确：完整路径，包含所有层级');
        expect(schemaContent).toContain('["4. 用户故事和用例视图", "用例视图", "用例规格说明", "UC-ALERT-001"]');
        
        // 验证错误示例
        expect(schemaContent).toContain('#### 错误示例');
        expect(schemaContent).toContain('❌ 错误：跳过了"用例视图"层级');
        expect(schemaContent).toContain('❌ 错误：章节名称不精确');
        
        console.log('✅ 正确和错误示例已正确添加');
    });
    
    test('应该包含路径构建最佳实践章节', () => {
        expect(schemaContent).toContain('### 🎯 **路径构建最佳实践**');
        expect(schemaContent).toContain('🚨 **关键规则：必须严格遵守**');
        
        console.log('✅ 路径构建最佳实践章节已添加');
    });
    
    test('规则组织结构应该清晰', () => {
        // 验证章节结构
        const sections = [
            '🚨 **关键规则：必须严格遵守**',
            '**必须遵守的规则**',
            '**禁止的行为**',
            '🎯 **路径构建最佳实践**',
            '`executeMarkdownEdits`参数详解',
            '`executeYAMLEdits`参数详解'
        ];
        
        sections.forEach(section => {
            expect(schemaContent).toContain(section);
        });
        
        console.log('✅ 规则章节结构组织清晰');
    });
}); 