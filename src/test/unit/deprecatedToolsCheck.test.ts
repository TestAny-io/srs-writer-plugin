/**
 * 🚨 Deprecated Tools Verification Test
 * 
 * 验证已废弃的工具是否已正确从系统中移除
 */

import { toolRegistry } from '../../tools/index';

describe('Deprecated Tools Check', () => {
  
  it('should not include deprecated importFromMarkdown tool in registry', () => {
    // 🚨 验证 importFromMarkdown 工具已从工具注册表中移除
    const toolDefinition = toolRegistry.getToolDefinition('importFromMarkdown');
    expect(toolDefinition).toBeUndefined();
    
    // 验证工具不在可用工具列表中
    const allTools = toolRegistry.getAllDefinitions();
    const importFromMarkdownTool = allTools.find((tool: any) => tool.name === 'importFromMarkdown');
    expect(importFromMarkdownTool).toBeUndefined();
  });

  it('should not include deprecated parseMarkdownTable tool in registry', () => {
    // 🚨 验证 parseMarkdownTable 工具已从工具注册表中移除
    const toolDefinition = toolRegistry.getToolDefinition('parseMarkdownTable');
    expect(toolDefinition).toBeUndefined();
    
    // 验证工具不在可用工具列表中
    const allTools = toolRegistry.getAllDefinitions();
    const parseMarkdownTableTool = allTools.find((tool: any) => tool.name === 'parseMarkdownTable');
    expect(parseMarkdownTableTool).toBeUndefined();
  });

  it('should have other document tools still available', () => {
    // 🎯 验证其他文档工具仍然可用（作为sanity check）
    const readMarkdownTool = toolRegistry.getToolDefinition('readMarkdownFile');
    expect(readMarkdownTool).toBeDefined();
    
    const semanticEditTool = toolRegistry.getToolDefinition('executeMarkdownEdits');
    expect(semanticEditTool).toBeDefined();
  });

  it('should verify that deprecated tools have been properly removed', () => {
    // 🗑️ 验证废弃的工具文件已被完全移除
    const deprecatedToolFiles = [
      '../../tools/document/documentImporterTools',
      '../../tools/document/documentGeneratorTools', 
      '../../tools/document/requirementTools'
    ];
    
    deprecatedToolFiles.forEach(toolPath => {
      expect(() => {
        require(toolPath);
      }).toThrow(); // 应该抛出错误，因为文件不存在
    });
  });

  it('should provide clear migration path for deprecated functionality', () => {
    // 🔄 验证新的替代工具是否可用
    const alternatives = [
      'executeMarkdownEdits',     // 替代 markdown 处理
      'readMarkdownFile',         // 替代 markdown 读取
      'executeYAMLEdits',        // 替代 YAML 处理
      'generateRequirementScaffold' // 替代需求生成
    ];

    alternatives.forEach(toolName => {
      const tool = toolRegistry.getToolDefinition(toolName);
      expect(tool).toBeDefined();
      expect(tool?.name).toBe(toolName);
    });
  });

});

/**
 * 🚀 Deprecation Summary Report
 * 
 * 这个测试套件验证了以下废弃工具的正确移除：
 * 
 * ❌ 已废弃的工具：
 * - importFromMarkdown
 * - parseMarkdownTable
 * 
 * ✅ 推荐的替代方案：
 * - semantic-edit-engine.ts：语义编辑和Markdown处理
 * - requirementTools.ts：需求管理
 * - yamlEditorTools.ts：YAML文件操作
 * - enhanced-readfile-tools.ts：文件读取
 * 
 * 📅 废弃日期：2025-07-21
 */ 