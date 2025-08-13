/**
 * 9部分提示词结构测试
 * 
 * 验证新的SRS ToC集成后，提示词结构是否正确
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PromptAssemblyEngine, SpecialistType, SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';
import * as path from 'path';

// 模拟readMarkdownFile工具
jest.mock('../../tools/document/enhanced-readfile-tools', () => ({
  readMarkdownFile: jest.fn().mockResolvedValue({
    success: true,
    tableOfContentsToCTree: [
      {
        sid: '/test-srs-document',
        title: 'Test SRS Document',
        level: 1,
        children: []
      }
    ]
  })
}));

describe('9部分提示词结构测试', () => {
  let promptAssemblyEngine: PromptAssemblyEngine;
  const testRulesPath = path.join(__dirname, '..', 'temp', 'nine-part-test-rules');

  beforeEach(async () => {
    // 创建测试rules目录结构
    const fs = require('fs').promises;
    
    try {
      await fs.mkdir(path.join(testRulesPath, 'base'), { recursive: true });
      await fs.mkdir(path.join(testRulesPath, 'specialists', 'content'), { recursive: true });
      
      // 创建base模板
      await fs.writeFile(
        path.join(testRulesPath, 'base', 'common-role-definition.md'),
        '你是一个专业的软件需求分析师。'
      );
      
      // 创建specialist模板
      await fs.writeFile(
        path.join(testRulesPath, 'specialists', 'content', 'test_specialist.md'),
        `# 测试专家

你需要分析和编写软件需求。

## SRS目录结构参考

当前项目的SRS文档结构如下：
{{SRS_TOC}}

## 任务指导

请根据上述SRS结构完成你的任务。`
      );
      
      promptAssemblyEngine = new PromptAssemblyEngine(testRulesPath);
    } catch (error) {
      console.warn('测试环境设置可能有问题:', error);
      // 使用默认路径作为fallback
      promptAssemblyEngine = new PromptAssemblyEngine();
    }
  });

  it('应该生成9部分结构化提示词', async () => {
    const specialistType: SpecialistType = {
      name: 'test_specialist',
      category: 'content'
    };

    const context: SpecialistContext = {
      userRequirements: '请帮我分析需求',
      projectMetadata: {
        baseDir: '/test/project'
      },
      SRS_TOC: `# 测试SRS文档  SID: /test-srs-document
## 概述  SID: /overview
## 功能需求  SID: /functional-requirements
### 用户管理  SID: /user-management
### 数据管理  SID: /data-management`,
      TOOLS_JSON_SCHEMA: JSON.stringify({ tools: [] })
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

    console.log('\\n=== 生成的9部分提示词结构 ===');
    console.log(result);
    console.log('\\n=== 提示词结构验证 ===');

    // 验证9部分结构
    expect(result).toContain('Table of Contents:');
    
    // 验证目录包含9个部分
    expect(result).toContain('1. SPECIALIST INSTRUCTIONS');
    expect(result).toContain('2. CURRENT TASK');
    expect(result).toContain('3. LATEST RESPONSE FROM USER');
    expect(result).toContain('4. TABLE OF CONTENTS OF CURRENT SRS');
    expect(result).toContain('5. TEMPLATE FOR YOUR CHAPTERS');
    expect(result).toContain('6. DYNAMIC CONTEXT');
    expect(result).toContain('7. GUIDELINES AND SAMPLE OF TOOLS USING');
    expect(result).toContain('8. YOUR TOOLS LIST');
    expect(result).toContain('9. FINAL INSTRUCTION');

    // 验证实际的部分标题
    expect(result).toContain('**# 1. SPECIALIST INSTRUCTIONS**');
    expect(result).toContain('**# 2. CURRENT TASK**');
    expect(result).toContain('**# 3. LATEST RESPONSE FROM USER**');
    expect(result).toContain('**# 4. TABLE OF CONTENTS OF CURRENT SRS**');
    expect(result).toContain('**# 5. TEMPLATE FOR YOUR CHAPTERS**');
    expect(result).toContain('**# 6. DYNAMIC CONTEXT**');
    expect(result).toContain('**# 7. GUIDELINES AND SAMPLE OF TOOLS USING**');
    expect(result).toContain('**# 8. YOUR TOOLS LIST**');
    expect(result).toContain('**# 9. FINAL INSTRUCTION**');

    // 验证SRS ToC内容被正确包含
    expect(result).toContain('# 测试SRS文档  SID: /test-srs-document');
    expect(result).toContain('## 概述  SID: /overview');
    expect(result).toContain('### 用户管理  SID: /user-management');

    console.log('✅ 所有9个部分都存在');
    console.log('✅ SRS ToC内容正确包含');
  });

  it('应该在SRS ToC不可用时显示友好信息', async () => {
    const specialistType: SpecialistType = {
      name: 'test_specialist',
      category: 'content'
    };

    const context: SpecialistContext = {
      userRequirements: '请帮我分析需求',
      projectMetadata: {
        baseDir: '/test/project'
      },
      // 故意不提供SRS_TOC
      TOOLS_JSON_SCHEMA: JSON.stringify({ tools: [] })
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

    // 验证第4部分存在但显示友好的信息
    expect(result).toContain('**# 4. TABLE OF CONTENTS OF CURRENT SRS**');
    expect(result).toContain('No SRS document structure available - you may be working on a new document or the SRS file could not be located.');

    console.log('✅ 在没有SRS ToC时显示友好信息');
  });

  it('应该支持CURRENT_SRS_TOC别名', async () => {
    const specialistType: SpecialistType = {
      name: 'test_specialist',
      category: 'content'
    };

    const context: SpecialistContext = {
      userRequirements: '请帮我分析需求',
      projectMetadata: {
        baseDir: '/test/project'
      },
      CURRENT_SRS_TOC: `# 替代SRS文档  SID: /alternative-srs
## 系统设计  SID: /system-design`,
      TOOLS_JSON_SCHEMA: JSON.stringify({ tools: [] })
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

    // 验证使用CURRENT_SRS_TOC别名
    expect(result).toContain('# 替代SRS文档  SID: /alternative-srs');
    expect(result).toContain('## 系统设计  SID: /system-design');

    console.log('✅ CURRENT_SRS_TOC别名正常工作');
  });

  afterEach(async () => {
    // 清理测试文件
    try {
      const fs = require('fs').promises;
      await fs.rm(testRulesPath, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });
});
