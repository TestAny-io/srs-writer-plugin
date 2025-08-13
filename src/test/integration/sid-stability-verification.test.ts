/**
 * SID稳定性验证测试
 * 
 * 验证readMarkdownFile工具生成的SID在不同场景下保持一致
 */

import { describe, it, expect } from '@jest/globals';
import { readMarkdownFile } from '../../tools/document/enhanced-readfile-tools';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('SID稳定性验证', () => {
  const testTempDir = '/Users/kailaichen/Downloads/Source Code/srs-writer-plugin/src/test/temp';
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

  beforeAll(async () => {
    // 确保测试目录存在
    await fs.mkdir(testTempDir, { recursive: true });
  });

  it('应该生成一致的SID（多次解析相同内容）', async () => {
    const testFile = path.join(testTempDir, 'test-consistency.md');
    await fs.writeFile(testFile, testMarkdown);

    // 多次解析同一文件
    const results = [];
    for (let i = 0; i < 3; i++) {
      const result = await readMarkdownFile({
        path: testFile,
        parseMode: 'toc'
      });
      expect(result.success).toBe(true);
      results.push(result.tableOfContentsToCTree);
    }

    // 验证所有结果的SID都一致
    const firstResult = results[0];
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toHaveLength(firstResult?.length || 0);
      
      for (let j = 0; j < (firstResult?.length || 0); j++) {
        expect(results[i]?.[j]?.sid).toBe(firstResult?.[j]?.sid);
        expect(results[i]?.[j]?.title).toBe(firstResult?.[j]?.title);
        expect(results[i]?.[j]?.level).toBe(firstResult?.[j]?.level);
      }
    }

    console.log('✅ 生成的SID列表:');
    firstResult?.forEach(item => {
      console.log(`   ${item.title}  SID: ${item.sid}`);
    });
  });

  it('应该处理重复标题的稳定性', async () => {
    const duplicateTitleMarkdown = `# 文档
## 概述
### 介绍
## 设计
### 介绍
## 实现
### 介绍
`;

    const testFile = path.join(testTempDir, 'test-duplicates.md');
    await fs.writeFile(testFile, duplicateTitleMarkdown);

    // 多次解析
    const results = [];
    for (let i = 0; i < 3; i++) {
      const result = await readMarkdownFile({
        path: testFile,
        parseMode: 'toc'
      });
      expect(result.success).toBe(true);
      results.push(result.tableOfContentsToCTree);
    }

    // 验证重复标题的SID都是唯一的且一致的
    const firstResult = results[0];
    
    // 检查所有"介绍"标题的SID都不相同
    const introSections = firstResult?.filter(item => item.title === '介绍') || [];
    expect(introSections.length).toBe(3);
    
    const sids = introSections.map(item => item.sid);
    const uniqueSids = new Set(sids);
    expect(uniqueSids.size).toBe(3); // 所有SID都应该是唯一的

    // 验证跨解析的稳定性
    for (let i = 1; i < results.length; i++) {
      const currentIntroSections = results[i]?.filter(item => item.title === '介绍') || [];
      expect(currentIntroSections.length).toBe(3);
      
      for (let j = 0; j < 3; j++) {
        expect(currentIntroSections[j].sid).toBe(introSections[j].sid);
      }
    }

    console.log('✅ 重复标题的SID生成:');
    introSections.forEach((item, index) => {
      console.log(`   第${index + 1}个"介绍"  SID: ${item.sid}`);
    });
  });

  it('应该在内容修改后保持结构稳定性', async () => {
    const originalMarkdown = `# 项目文档
## 概述
项目介绍内容...
## 功能
功能描述内容...
`;

    const modifiedMarkdown = `# 项目文档
## 概述
这里是修改后的项目介绍内容，内容完全不同了...
## 功能
这里是修改后的功能描述内容，也完全不同了...
`;

    const testFile = path.join(testTempDir, 'test-content-modification.md');
    
    // 解析原始版本
    await fs.writeFile(testFile, originalMarkdown);
    const originalResult = await readMarkdownFile({
      path: testFile,
      parseMode: 'toc'
    });

    // 解析修改版本
    await fs.writeFile(testFile, modifiedMarkdown);
    const modifiedResult = await readMarkdownFile({
      path: testFile,
      parseMode: 'toc'
    });

    expect(originalResult.success).toBe(true);
    expect(modifiedResult.success).toBe(true);

    // 标题结构相同时，SID应该保持一致
    expect(originalResult.tableOfContentsToCTree?.length).toBe(modifiedResult.tableOfContentsToCTree?.length);
    
    for (let i = 0; i < (originalResult.tableOfContentsToCTree?.length || 0); i++) {
      const original = originalResult.tableOfContentsToCTree?.[i];
      const modified = modifiedResult.tableOfContentsToCTree?.[i];
      
      expect(modified?.sid).toBe(original?.sid);
      expect(modified?.title).toBe(original?.title);
      expect(modified?.level).toBe(original?.level);
    }

    console.log('✅ 内容修改后SID保持稳定:');
    originalResult.tableOfContentsToCTree?.forEach(item => {
      console.log(`   ${item.title}  SID: ${item.sid}`);
    });
  });

  afterAll(async () => {
    // 清理测试文件
    try {
      await fs.rm(path.join(testTempDir, 'test-consistency.md'));
      await fs.rm(path.join(testTempDir, 'test-duplicates.md'));
      await fs.rm(path.join(testTempDir, 'test-content-modification.md'));
    } catch (error) {
      // 忽略清理错误
    }
  });
});
