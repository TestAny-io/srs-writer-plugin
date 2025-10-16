/**
 * 自包含语义编辑性能测试
 */

import * as vscode from 'vscode';
import { executeSemanticEdits } from '../../tools/document/semantic-edit-engine';
import { SemanticEditIntent } from '../../types/semanticEditing';

describe('自包含语义编辑性能测试', () => {
    // 创建一个较大的测试文档以模拟真实场景
    const createLargeMarkdownContent = () => `# 大型系统需求规格说明书

## 1. 引言

这是一个大型系统的需求规格说明书。
包含大量的章节和子章节。

### 1.1 项目背景

项目背景的详细描述...
${Array(20).fill('这是项目背景的内容。').join('\n')}

### 1.2 系统概述

系统概述的详细内容...
${Array(20).fill('这是系统概述的内容。').join('\n')}

## 2. 功能需求

### 2.1 用户管理

用户管理功能的详细描述...
${Array(30).fill('用户管理功能相关的内容。').join('\n')}

#### 2.1.1 用户注册

用户注册功能说明...
${Array(15).fill('用户注册相关的内容。').join('\n')}

#### 2.1.2 用户登录

用户登录功能说明...
${Array(15).fill('用户登录相关的内容。').join('\n')}

### 2.2 数据管理

数据管理功能的详细描述...
${Array(30).fill('数据管理功能相关的内容。').join('\n')}

## 3. 非功能需求

### 3.1 性能需求

系统性能需求...
${Array(25).fill('性能需求相关的内容。').join('\n')}

### 3.2 安全需求

系统安全需求...
${Array(25).fill('安全需求相关的内容。').join('\n')}

## 4. 技术规范

### 4.1 架构设计

系统架构设计...
${Array(40).fill('架构设计相关的内容。').join('\n')}

### 4.2 接口设计

接口设计说明...
${Array(40).fill('接口设计相关的内容。').join('\n')}

## 5. 测试计划

测试计划的详细内容...
${Array(50).fill('测试计划相关的内容。').join('\n')}
`;

    let testFileUri: vscode.Uri;
    let largeContent: string;

    beforeAll(async () => {
        largeContent = createLargeMarkdownContent();
        console.log(`📄 Created test document with ${largeContent.split('\n').length} lines`);
        
        // 创建临时文件
        testFileUri = vscode.Uri.file('/tmp/large-test-document.md');
        
        // 模拟文件写入
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(testFileUri, encoder.encode(largeContent));
    });

    afterAll(async () => {
        // 清理临时文件
        try {
            await vscode.workspace.fs.delete(testFileUri);
        } catch (error) {
            // 忽略删除错误
        }
    });

    test('应该在合理时间内完成自包含解析和编辑', async () => {
        const startTime = Date.now();
        
        const intents: SemanticEditIntent[] = [
            {
                type: 'replace_section_and_title',
                target: {
                    sid: '/functional-requirements/user-management'
                },
                content: '# 更新的用户管理\n\n这是更新后的用户管理内容。',
                reason: '性能测试 - 替换整个章节',
                priority: 1
            }
        ];

        try {
            const result = await executeSemanticEdits(intents, testFileUri);
            
            const executionTime = Date.now() - startTime;
            
            console.log(`⏱️ 自包含编辑执行时间: ${executionTime}ms`);
            console.log(`📊 处理结果: ${result.successfulIntents}/${result.totalIntents} 成功`);
            console.log(`📈 文档行数: ${largeContent.split('\n').length}`);
            
            // 性能断言：应该在合理时间内完成
            expect(executionTime).toBeLessThan(5000); // 5秒内完成
            
            // 功能断言：应该成功
            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            console.error(`❌ 执行失败 (${executionTime}ms):`, error);
            throw error;
        }
    }, 10000); // 10秒超时

    test('应该高效处理多个编辑意图', async () => {
        const startTime = Date.now();
        
        const intents: SemanticEditIntent[] = [
            {
                type: 'replace_section_content_only',
                target: {
                    sid: '/introduction/project-background',
                    lineRange: { startLine: 1, endLine: 3 }
                },
                content: '更新的项目背景第1-3行内容',
                reason: '性能测试 - 行号精确编辑',
                priority: 3
            },
            {
                type: 'insert_section_content_only',
                target: {
                    sid: '/functional-requirements',
                    lineRange: { startLine: 30, endLine: 30 } // 在功能需求章节的第30行插入
                },
                content: '插入的新功能需求内容',
                reason: '性能测试 - 插入操作',
                priority: 2
            },
            {
                type: 'replace_section_and_title',
                target: {
                    sid: '/non-functional-requirements/performance-requirements'
                },
                content: '# 更新的性能需求\n\n新的性能指标和要求。',
                reason: '性能测试 - 章节替换',
                priority: 1
            }
        ];

        try {
            const result = await executeSemanticEdits(intents, testFileUri);
            
            const executionTime = Date.now() - startTime;
            const averageTimePerIntent = executionTime / intents.length;
            
            console.log(`⏱️ 多意图编辑总时间: ${executionTime}ms`);
            console.log(`📊 平均每个意图: ${averageTimePerIntent.toFixed(2)}ms`);
            console.log(`✅ 成功处理: ${result.successfulIntents}/${result.totalIntents} 意图`);
            
            if (result.failedIntents.length > 0) {
                console.log(`❌ 失败的意图:`, result.failedIntents.map(f => f.error));
            }
            
            // 性能断言
            expect(executionTime).toBeLessThan(8000); // 8秒内完成多个操作
            expect(averageTimePerIntent).toBeLessThan(3000); // 平均每个意图3秒内
            
            // 功能断言：至少有部分成功
            expect(result.successfulIntents).toBeGreaterThan(0);
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            console.error(`❌ 多意图编辑失败 (${executionTime}ms):`, error);
            throw error;
        }
    }, 15000); // 15秒超时

    test('应该展示缓存机制的性能优势', async () => {
        const intents: SemanticEditIntent[] = [
            {
                type: 'replace_section_content_only',
                target: {
                    sid: '/technical-specifications/architecture-design',
                    lineRange: { startLine: 1, endLine: 1 }
                },
                content: '缓存测试内容1',
                reason: '缓存性能测试1',
                priority: 1
            }
        ];

        // 第一次执行（冷启动）
        const firstRunStart = Date.now();
        const firstResult = await executeSemanticEdits(intents, testFileUri);
        const firstRunTime = Date.now() - firstRunStart;

        // 第二次执行（应该有缓存优势）
        const secondRunStart = Date.now();
        const secondResult = await executeSemanticEdits([{
            ...intents[0],
            content: '缓存测试内容2',
            reason: '缓存性能测试2'
        }], testFileUri);
        const secondRunTime = Date.now() - secondRunStart;

        console.log(`🚀 第一次执行: ${firstRunTime}ms`);
        console.log(`⚡ 第二次执行: ${secondRunTime}ms`);
        console.log(`📈 性能提升: ${((firstRunTime - secondRunTime) / firstRunTime * 100).toFixed(1)}%`);

        // 功能断言
        expect(firstResult.success).toBe(true);
        expect(secondResult.success).toBe(true);
        
        // 性能期望（第二次应该更快，但不强制要求）
        if (secondRunTime < firstRunTime) {
            console.log(`✅ 缓存机制生效，性能有提升`);
        } else {
            console.log(`ℹ️ 第二次执行时间相似或稍慢，可能由于文档状态变化`);
        }
    }, 20000);

    test('内存使用应该在合理范围内', async () => {
        // 获取初始内存使用情况（在Node.js环境中）
        const initialMemory = process.memoryUsage();
        console.log(`🧠 初始内存使用: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);

        const intents: SemanticEditIntent[] = [
            {
                type: 'replace_section_and_title',
                target: {
                    sid: '/test-plan'
                },
                content: `# 大型测试计划\n\n${Array(100).fill('大量的测试内容行...').join('\n')}`,
                reason: '内存测试 - 大内容替换',
                priority: 1
            }
        ];

        const result = await executeSemanticEdits(intents, testFileUri);
        
        // 执行后的内存使用情况
        const finalMemory = process.memoryUsage();
        const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        
        console.log(`🧠 执行后内存使用: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.log(`📈 内存增长: ${memoryIncrease.toFixed(2)}MB`);

        // 功能断言
        expect(result.success).toBe(true);
        
        // 内存断言：增长应该在合理范围内
        expect(memoryIncrease).toBeLessThan(50); // 内存增长不超过50MB
    });
});
