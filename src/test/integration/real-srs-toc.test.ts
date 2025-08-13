/**
 * 使用真实SRS.md文件测试ToC集成功能
 */

import { describe, it, expect } from '@jest/globals';
import { PromptAssemblyEngine, SpecialistType, SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';
import { readMarkdownFile } from '../../tools/document/enhanced-readfile-tools';
import * as path from 'path';

// 模拟readMarkdownFile工具
jest.mock('../../tools/document/enhanced-readfile-tools', () => ({
  readMarkdownFile: jest.fn()
}));

const mockReadMarkdownFile = readMarkdownFile as jest.MockedFunction<typeof readMarkdownFile>;

describe('真实SRS文件ToC测试', () => {
  it('应该正确解析SRS.md文件的目录结构', async () => {
    // 创建模拟的真实SRS文档结构
    const realSRSToCTree = [
      {
        sid: '/ai-generated-project-analysis-srs-for-srs-writer-plugin-for-vscode-mvp',
        displayId: '1',
        title: 'AI-Generated Project Analysis & SRS for "SRS Writer Plugin for VSCode (MVP)"',
        level: 1,
        characterCount: 88,
        children: [
          {
            sid: '/software-requirements-specification',
            displayId: '1.1',
            title: '《SRS Writer Plugin for VSCode - 软件需求规格说明书 - v0.2 (MVP)》',
            level: 1,
            characterCount: 67,
            children: [
              {
                sid: '/document-control',
                displayId: '1.1.1',
                title: '文档控制信息 (Document Control)',
                level: 2,
                characterCount: 29,
                children: [
                  {
                    sid: '/revision-history',
                    displayId: '1.1.1.1',
                    title: '变更历史 (Revision History)',
                    level: 3,
                    characterCount: 24,
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        sid: '/introduction',
        displayId: '2',
        title: '引言 (Introduction)',
        level: 2,
        characterCount: 16,
        children: [
          {
            sid: '/purpose',
            displayId: '2.1',
            title: '目的 (Purpose)',
            level: 3,
            characterCount: 12,
            children: []
          },
          {
            sid: '/product-overview',
            displayId: '2.2',
            title: '产品概述 (Product Overview)',
            level: 3,
            characterCount: 23,
            children: []
          },
          {
            sid: '/scope',
            displayId: '2.3',
            title: '范围 (Scope)',
            level: 3,
            characterCount: 11,
            children: [
              {
                sid: '/in-scope',
                displayId: '2.3.1',
                title: '范围内 (In Scope) - **我们要做这些**',
                level: 4,
                characterCount: 33,
                children: []
              },
              {
                sid: '/out-of-scope',
                displayId: '2.3.2',
                title: '范围外 (Out of Scope) - **我们坚决不做这些**',
                level: 4,
                characterCount: 37,
                children: []
              }
            ]
          }
        ]
      },
      {
        sid: '/overall-description',
        displayId: '3',
        title: '整体说明 (Overall Description)',
        level: 2,
        characterCount: 27,
        children: [
          {
            sid: '/product-vision-mvp-goal',
            displayId: '3.1',
            title: '产品愿景与MVP目标 (Product Vision & MVP Goal)',
            level: 3,
            characterCount: 37,
            children: []
          },
          {
            sid: '/target-users',
            displayId: '3.2',
            title: '目标用户 (Target Users)',
            level: 3,
            characterCount: 19,
            children: []
          },
          {
            sid: '/user-journey',
            displayId: '3.3',
            title: '用户使用流程 (User Journey)',
            level: 3,
            characterCount: 22,
            children: []
          }
        ]
      },
      {
        sid: '/functional-requirements',
        displayId: '4',
        title: '功能需求 (Functional Requirements)',
        level: 2,
        characterCount: 28,
        children: []
      },
      {
        sid: '/non-functional-requirements',
        displayId: '5',
        title: '非功能性需求 (Non-Functional Requirements)',
        level: 2,
        characterCount: 35,
        children: []
      }
    ];

    const mockResult = {
      success: true,
      path: 'SRS.md',
      resolvedPath: '/test/SRS.md',
      lastModified: new Date(),
      size: 10000,
      results: [],
      parseTime: 50,
      cacheHit: false,
      tableOfContentsToCTree: realSRSToCTree
    };

    mockReadMarkdownFile.mockResolvedValue(mockResult);

    const engine = new PromptAssemblyEngine(path.join(process.cwd(), 'rules'));
    
    const context: SpecialistContext = {
      projectMetadata: {
        baseDir: path.join(process.cwd(), 'srs_writer_plugin_for_vscode_requirement')
      }
    };

    const specialistType: SpecialistType = {
      name: 'overall_description_writer',
      category: 'content'
    };

    await engine.assembleSpecialistPrompt(specialistType, context);

    // 验证ToC内容
    expect(context.SRS_TOC).toBeDefined();
    expect(context.CURRENT_SRS_TOC).toBeDefined();
    expect(context.SRS_TOC).toBe(context.CURRENT_SRS_TOC);

    // 验证ToC格式
    const expectedLines = [
      '# AI-Generated Project Analysis & SRS for "SRS Writer Plugin for VSCode (MVP)"  SID: /ai-generated-project-analysis-srs-for-srs-writer-plugin-for-vscode-mvp',
      '# 《SRS Writer Plugin for VSCode - 软件需求规格说明书 - v0.2 (MVP)》  SID: /software-requirements-specification',
      '## 文档控制信息 (Document Control)  SID: /document-control',
      '### 变更历史 (Revision History)  SID: /revision-history',
      '## 引言 (Introduction)  SID: /introduction',
      '### 目的 (Purpose)  SID: /purpose',
      '### 产品概述 (Product Overview)  SID: /product-overview',
      '### 范围 (Scope)  SID: /scope',
      '#### 范围内 (In Scope) - **我们要做这些**  SID: /in-scope',
      '#### 范围外 (Out of Scope) - **我们坚决不做这些**  SID: /out-of-scope',
      '## 整体说明 (Overall Description)  SID: /overall-description',
      '### 产品愿景与MVP目标 (Product Vision & MVP Goal)  SID: /product-vision-mvp-goal',
      '### 目标用户 (Target Users)  SID: /target-users',
      '### 用户使用流程 (User Journey)  SID: /user-journey',
      '## 功能需求 (Functional Requirements)  SID: /functional-requirements',
      '## 非功能性需求 (Non-Functional Requirements)  SID: /non-functional-requirements'
    ];

    const expectedToC = expectedLines.join('\n');
    expect(context.SRS_TOC).toBe(expectedToC);

    // 验证包含关键章节
    expect(context.SRS_TOC).toContain('引言 (Introduction)');
    expect(context.SRS_TOC).toContain('整体说明 (Overall Description)');
    expect(context.SRS_TOC).toContain('功能需求 (Functional Requirements)');
    expect(context.SRS_TOC).toContain('非功能性需求 (Non-Functional Requirements)');

    // 验证层级结构
    expect(context.SRS_TOC).toContain('## 引言');  // 二级标题
    expect(context.SRS_TOC).toContain('### 目的');  // 三级标题
    expect(context.SRS_TOC).toContain('#### 范围内');  // 四级标题

    // 验证SID格式
    expect(context.SRS_TOC).toContain('SID: /introduction');
    expect(context.SRS_TOC).toContain('SID: /purpose');
    expect(context.SRS_TOC).toContain('SID: /in-scope');

    console.log('\n=== 生成的真实SRS ToC ===');
    console.log(context.SRS_TOC);
    console.log('=========================\n');

    // 统计信息
    const lines = context.SRS_TOC!.split('\n');
    const h1Count = lines.filter(line => line.startsWith('# ') && !line.startsWith('## ')).length;
    const h2Count = lines.filter(line => line.startsWith('## ') && !line.startsWith('### ')).length;
    const h3Count = lines.filter(line => line.startsWith('### ') && !line.startsWith('#### ')).length;
    const h4Count = lines.filter(line => line.startsWith('#### ')).length;

    console.log(`统计信息:`);
    console.log(`  一级标题: ${h1Count}`);
    console.log(`  二级标题: ${h2Count}`);
    console.log(`  三级标题: ${h3Count}`);
    console.log(`  四级标题: ${h4Count}`);
    console.log(`  总行数: ${lines.length}`);

    expect(h1Count).toBeGreaterThan(0);
    expect(h2Count).toBeGreaterThan(0);
    expect(h3Count).toBeGreaterThan(0);
    expect(h4Count).toBeGreaterThan(0);
  });
});
