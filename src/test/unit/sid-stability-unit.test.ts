/**
 * SID稳定性单元测试 - 直接测试解析引擎的SID生成逻辑
 */

import { describe, it, expect } from '@jest/globals';
import { StructureAnalyzer, ParsingEngine } from '../../tools/document/enhanced-readfile-tools';

describe('SID生成稳定性单元测试', () => {
  let structureAnalyzer: StructureAnalyzer;
  let parsingEngine: ParsingEngine;

  beforeEach(() => {
    structureAnalyzer = new StructureAnalyzer();
    parsingEngine = new ParsingEngine();
  });

  it('应该为相同内容生成一致的SID', async () => {
    const testMarkdown = `# 项目文档
## 概述
### 项目介绍
## 需求分析
### 功能需求
#### 用户管理
#### 数据管理
### 非功能需求
## 设计方案
### 架构设计
### 数据库设计
`;

    // 多次解析同一内容
    const results = [];
    for (let i = 0; i < 3; i++) {
      const ast = await parsingEngine.parseDocument(testMarkdown);
      const toc = structureAnalyzer.generateTableOfContents(ast, testMarkdown);
      results.push(toc);
    }

    // 验证所有结果的SID都一致
    const firstResult = results[0];
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toHaveLength(firstResult.length);
      
      for (let j = 0; j < firstResult.length; j++) {
        expect(results[i][j].sid).toBe(firstResult[j].sid);
        expect(results[i][j].title).toBe(firstResult[j].title);
        expect(results[i][j].level).toBe(firstResult[j].level);
      }
    }

    console.log('✅ 生成的SID列表:');
    firstResult.forEach(item => {
      console.log(`   Level ${item.level}: ${item.title}  SID: ${item.sid}`);
    });

    // 验证具体的SID格式
    const expectedSids = [
      '/项目文档',
      '/概述', 
      '/项目介绍',
      '/需求分析',
      '/功能需求',
      '/用户管理',
      '/数据管理',
      '/非功能需求',
      '/设计方案',
      '/架构设计',
      '/数据库设计'
    ];

    firstResult.forEach((item, index) => {
      expect(item.sid).toBe(expectedSids[index]);
    });
  });

  it('应该正确处理重复标题的哈希稳定性', async () => {
    const duplicateTitleMarkdown = `# 文档
## 概述
### 介绍
## 设计
### 介绍
## 实现
### 介绍
`;

    // 多次解析
    const results = [];
    for (let i = 0; i < 3; i++) {
      const ast = await parsingEngine.parseDocument(duplicateTitleMarkdown);
      const toc = structureAnalyzer.generateTableOfContents(ast, duplicateTitleMarkdown);
      results.push(toc);
    }

    // 验证重复标题的SID都是唯一的且一致的
    const firstResult = results[0];
    
    // 检查所有"介绍"标题的SID都不相同
    const introSections = firstResult.filter(item => item.title === '介绍');
    expect(introSections.length).toBe(3);
    
    const sids = introSections.map(item => item.sid);
    const uniqueSids = new Set(sids);
    expect(uniqueSids.size).toBe(3); // 所有SID都应该是唯一的

    // 验证跨解析的稳定性
    for (let i = 1; i < results.length; i++) {
      const currentIntroSections = results[i].filter(item => item.title === '介绍');
      expect(currentIntroSections.length).toBe(3);
      
      for (let j = 0; j < 3; j++) {
        expect(currentIntroSections[j].sid).toBe(introSections[j].sid);
      }
    }

    console.log('✅ 重复标题的SID生成:');
    introSections.forEach((item, index) => {
      console.log(`   第${index + 1}个"介绍" (父级: ${item.parent || 'root'})  SID: ${item.sid}`);
    });

    // 验证SID应该包含哈希以区分重复项
    // 由于具体的哈希值可能变化，这里只验证格式
    introSections.forEach(section => {
      expect(section.sid).toMatch(/^\/介绍(-[a-f0-9]{6})?$/);
    });
  });

  it('应该在内容修改时保持结构稳定性', async () => {
    const originalMarkdown = `# 项目文档
## 概述
项目介绍内容...
## 功能
功能描述内容...
`;

    const modifiedMarkdown = `# 项目文档
## 概述
这里是修改后的项目介绍内容，内容完全不同了...

包含多行和额外的内容。

## 功能
这里是修改后的功能描述内容，也完全不同了...
`;

    // 解析原始版本
    const originalAst = await parsingEngine.parseDocument(originalMarkdown);
    const originalToc = structureAnalyzer.generateTableOfContents(originalAst, originalMarkdown);

    // 解析修改版本
    const modifiedAst = await parsingEngine.parseDocument(modifiedMarkdown);
    const modifiedToc = structureAnalyzer.generateTableOfContents(modifiedAst, modifiedMarkdown);

    // 标题结构相同时，SID应该保持一致
    expect(originalToc.length).toBe(modifiedToc.length);
    
    for (let i = 0; i < originalToc.length; i++) {
      expect(modifiedToc[i].sid).toBe(originalToc[i].sid);
      expect(modifiedToc[i].title).toBe(originalToc[i].title);
      expect(modifiedToc[i].level).toBe(originalToc[i].level);
    }

    console.log('✅ 内容修改后SID保持稳定:');
    originalToc.forEach(item => {
      console.log(`   ${item.title}  SID: ${item.sid}`);
    });
  });

  it('应该处理复杂层级结构的稳定性', async () => {
    const complexMarkdown = `# 软件需求规格说明书

## 1. 引言
### 1.1 目的
### 1.2 范围
#### 1.2.1 功能范围
##### 1.2.1.1 核心功能
##### 1.2.1.2 扩展功能
#### 1.2.2 技术范围

## 2. 整体描述
### 2.1 产品概述
### 2.2 用户类别
#### 2.2.1 管理员
#### 2.2.2 普通用户

## 3. 具体需求
### 3.1 功能需求
#### 3.1.1 用户管理
##### 3.1.1.1 用户注册
##### 3.1.1.2 用户登录
#### 3.1.2 数据管理
### 3.2 性能需求
`;

    // 多次解析复杂结构
    const results = [];
    for (let i = 0; i < 3; i++) {
      const ast = await parsingEngine.parseDocument(complexMarkdown);
      const toc = structureAnalyzer.generateTableOfContents(ast, complexMarkdown);
      results.push(toc);
    }

    // 验证稳定性
    const firstResult = results[0];
    expect(firstResult.length).toBeGreaterThan(10); // 应该有很多章节

    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toHaveLength(firstResult.length);
      
      for (let j = 0; j < firstResult.length; j++) {
        expect(results[i][j].sid).toBe(firstResult[j].sid);
        expect(results[i][j].title).toBe(firstResult[j].title);
        expect(results[i][j].level).toBe(firstResult[j].level);
      }
    }

    console.log('✅ 复杂层级结构的SID列表:');
    firstResult.forEach(item => {
      const indent = '  '.repeat(item.level - 1);
      console.log(`${indent}Level ${item.level}: ${item.title}  SID: ${item.sid}`);
    });
  });
});
