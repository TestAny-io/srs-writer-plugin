/**
 * SID生成与验证契约测试
 * 
 * 🎯 目标：确保SID生成器和验证器的契约严格一致
 * 
 * Bug背景：测试工程师发现当标题包含特殊字符（如 &）时，
 * readMarkdownFile生成的SID无法通过executeMarkdownEdits的验证，
 * 导致文档编辑失败。
 * 
 * 修复方案：收紧生成器的字符处理，使用白名单模式，确保生成的SID
 * 100%能通过验证器的验证。
 */

import { SidBasedSemanticLocator } from '../../tools/atomic/sid-based-semantic-locator';
import * as vscode from 'vscode';
import { readMarkdownFile } from '../../tools/document/enhanced-readfile-tools';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SID生成与验证契约测试', () => {
    let tempDir: string;
    let testFile: vscode.Uri;

    beforeEach(async () => {
        // 创建临时目录和测试文件
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sid-contract-test-'));
        testFile = vscode.Uri.file(path.join(tempDir, 'test.md'));
    });

    afterEach(async () => {
        // 清理临时文件
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            // 忽略清理错误
        }
    });

    // Helper函数：扁平化TOC树
    const flattenToc = (nodes: any[]): any[] => {
        let result: any[] = [];
        for (const node of nodes) {
            result.push(node);
            if (node.children && node.children.length > 0) {
                result = result.concat(flattenToc(node.children));
            }
        }
        return result;
    };

    /**
     * 🎯 核心契约测试：所有生成的SID必须能通过验证器验证
     */
    describe('契约一致性测试', () => {
        const testCases = [
            // 原始bug场景
            {
                name: 'Bug场景：标题包含 & 符号',
                title: '### 数据隐私与安全需求 (Data Privacy & Security Requirements)',
                description: '原始bug：& 符号被保留在SID中，导致验证失败'
            },
            // 其他特殊字符
            {
                name: '标题包含 @ 符号',
                title: '## 用户管理 (user@domain.com)',
                description: '@ 符号应被替换'
            },
            {
                name: '标题包含 # 符号',
                title: '### Issue #123',
                description: '# 符号应被替换'
            },
            {
                name: '标题包含 $ 符号',
                title: '## 成本分析 ($100K+)',
                description: '$ 符号应被替换'
            },
            {
                name: '标题包含 % 符号',
                title: '### 完成度 (95%)',
                description: '% 符号应被替换'
            },
            {
                name: '标题包含 * 符号',
                title: '## 注意事项 (*重要*)',
                description: '* 符号应被替换'
            },
            {
                name: '标题包含 + 符号',
                title: '### A + B = C',
                description: '+ 符号应被替换'
            },
            {
                name: '标题包含 = 符号',
                title: '## 配置项 (key=value)',
                description: '= 符号应被替换'
            },
            {
                name: '标题包含 | 符号',
                title: '### 选项 A | B | C',
                description: '| 符号应被替换'
            },
            {
                name: '标题包含 ~ 符号',
                title: '## 版本 ~1.0.0',
                description: '~ 符号应被替换'
            },
            {
                name: '标题包含 ` 符号',
                title: '### 代码 `function()`',
                description: '反引号应被替换'
            },
            {
                name: '标题包含 {} 符号',
                title: '## 对象 {key: value}',
                description: '大括号应被替换'
            },
            // 多个特殊字符组合
            {
                name: '标题包含多个特殊字符',
                title: '### A & B | C @ D # E',
                description: '多个特殊字符应全部被替换'
            },
            // 中文测试
            {
                name: '纯中文标题',
                title: '## 功能需求',
                description: '中文字符应被保留'
            },
            {
                name: '中英文混合',
                title: '### 数据分析 (Data Analysis)',
                description: '中英文混合应正确处理'
            },
            // 日文测试
            {
                name: '日文平假名标题',
                title: '## データ分析',
                description: '日文字符应被保留'
            },
            {
                name: '日文片假名标题',
                title: '### システム概要',
                description: '日文片假名应被保留'
            },
            // 韩文测试
            {
                name: '韩文标题',
                title: '## 데이터 분석',
                description: '韩文字符应被保留'
            },
            // 标准标点符号
            {
                name: '标题包含标准标点',
                title: '## Hello, World! (Test)',
                description: '标准标点应被正确处理'
            }
        ];

        testCases.forEach(testCase => {
            it(`✅ ${testCase.name}`, async () => {
                // 1. 创建包含测试标题的Markdown文件
                const content = `# Document Title\n\n${testCase.title}\n\nSome content here.\n`;
                await fs.writeFile(testFile.fsPath, content, 'utf-8');

                // 2. 使用readMarkdownFile生成TOC（包含SID）
                const result = await readMarkdownFile({
                    path: testFile.fsPath,
                    parseMode: 'toc'
                });

                // 3. 验证readMarkdownFile成功
                expect(result.success).toBe(true);
                expect(result.tableOfContentsToCTree).toBeDefined();
                
                const toc = flattenToc(result.tableOfContentsToCTree!);
                expect(toc.length).toBeGreaterThan(0);

                // 4. 提取生成的SID
                const generatedSids = toc.map((section: any) => section.sid);
                
                // 5. 使用SidBasedSemanticLocator的验证逻辑验证每个SID
                const locator = new SidBasedSemanticLocator(content, toc);

                for (const sid of generatedSids) {
                    const validation = (locator as any).validateSid(sid);
                    
                    // 🎯 核心断言：所有生成的SID必须通过验证
                    expect(validation.isValid).toBe(true);
                    
                    if (!validation.isValid) {
                        console.error(`❌ SID验证失败:`, {
                            testCase: testCase.name,
                            title: testCase.title,
                            generatedSid: sid,
                            validationError: validation.error,
                            suggestion: validation.suggestions
                        });
                    }
                }
            });
        });
    });

    /**
     * 🎯 边界场景测试
     */
    describe('边界场景测试', () => {
        it('应正确处理纯特殊字符标题', async () => {
            const content = `# Document\n\n### @@@\n\nContent\n`;
            await fs.writeFile(testFile.fsPath, content, 'utf-8');

            const result = await readMarkdownFile({
                path: testFile.fsPath,
                parseMode: 'toc'
            });

            expect(result.success).toBe(true);
            const toc = flattenToc(result.tableOfContentsToCTree!);
            expect(toc.length).toBeGreaterThan(0);

            // SID应该是一个有效的fallback（使用哈希）
            const sid = toc[toc.length - 1].sid;
            expect(sid).toBeDefined();
            expect(sid.length).toBeGreaterThan(0);
            expect(sid).toMatch(/^\/[a-z0-9\-_\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\/]+$/);
            
            // 验证SID能通过验证器
            const locator = new SidBasedSemanticLocator(content, toc);
            const validation = (locator as any).validateSid(sid);
            expect(validation.isValid).toBe(true);
        });

        it('应正确处理连续特殊字符', async () => {
            const content = `# Document\n\n### A & | @ # $ B\n\nContent\n`;
            await fs.writeFile(testFile.fsPath, content, 'utf-8');

            const result = await readMarkdownFile({
                path: testFile.fsPath,
                parseMode: 'toc'
            });

            expect(result.success).toBe(true);
            const toc = flattenToc(result.tableOfContentsToCTree!);
            const sid = toc[toc.length - 1].sid;
            
            // 连续特殊字符应被合并为单个连字符
            expect(sid).not.toContain('--');
            
            // 验证SID
            const locator = new SidBasedSemanticLocator(content, toc);
            const validation = (locator as any).validateSid(sid);
            expect(validation.isValid).toBe(true);
        });

        it('应正确处理首尾特殊字符', async () => {
            const content = `# Document\n\n### @@@Title@@@\n\nContent\n`;
            await fs.writeFile(testFile.fsPath, content, 'utf-8');

            const result = await readMarkdownFile({
                path: testFile.fsPath,
                parseMode: 'toc'
            });

            expect(result.success).toBe(true);
            const toc = flattenToc(result.tableOfContentsToCTree!);
            const sid = toc[toc.length - 1].sid;
            
            // SID不应该以连字符开头或结尾
            const lastPart = sid.split('/').pop()!;
            expect(lastPart).not.toMatch(/^-/);
            expect(lastPart).not.toMatch(/-$/);
            
            // 验证SID
            const locator = new SidBasedSemanticLocator(content, toc);
            const validation = (locator as any).validateSid(sid);
            expect(validation.isValid).toBe(true);
        });

        it('应正确处理相似标题的特殊字符差异', async () => {
            const content = `# Document

## 数据隐私 & 安全需求

Content 1

## 数据隐私 | 安全需求

Content 2

## 数据隐私 @ 安全需求

Content 3
`;
            await fs.writeFile(testFile.fsPath, content, 'utf-8');

            const result = await readMarkdownFile({
                path: testFile.fsPath,
                parseMode: 'toc'
            });

            expect(result.success).toBe(true);
            const toc = flattenToc(result.tableOfContentsToCTree!);
            expect(toc.length).toBe(4); // 包括 "# Document"

            // 提取三个相似标题的SID
            const sids = toc.slice(1).map((s: any) => s.sid);
            
            // SID应该是不同的（通过哈希机制区分）
            expect(new Set(sids).size).toBe(3);
            
            // 所有SID都应通过验证
            const locator = new SidBasedSemanticLocator(content, toc);
            
            for (const sid of sids) {
                const validation = (locator as any).validateSid(sid);
                expect(validation.isValid).toBe(true);
            }
        });

        it('应正确处理Emoji（应被移除）', async () => {
            const content = `# Document\n\n### 功能 😀 说明\n\nContent\n`;
            await fs.writeFile(testFile.fsPath, content, 'utf-8');

            const result = await readMarkdownFile({
                path: testFile.fsPath,
                parseMode: 'toc'
            });

            expect(result.success).toBe(true);
            const toc = flattenToc(result.tableOfContentsToCTree!);
            const sid = toc[toc.length - 1].sid;
            
            // SID不应包含emoji
            expect(sid).not.toMatch(/[\u{1F600}-\u{1F64F}]/u);
            
            // 验证SID
            const locator = new SidBasedSemanticLocator(content, toc);
            const validation = (locator as any).validateSid(sid);
            expect(validation.isValid).toBe(true);
        });
    });

    /**
     * 🎯 SID唯一性测试
     */
    describe('SID唯一性测试', () => {
        it('不同标题应生成不同的SID', async () => {
            const content = `# Document

## Section A

Content

## Section B

Content

## Section C

Content
`;
            await fs.writeFile(testFile.fsPath, content, 'utf-8');

            const result = await readMarkdownFile({
                path: testFile.fsPath,
                parseMode: 'toc'
            });

            expect(result.success).toBe(true);
            const toc = flattenToc(result.tableOfContentsToCTree!);
            const sids = toc.map((s: any) => s.sid);
            
            // 所有SID应该是唯一的
            expect(new Set(sids).size).toBe(sids.length);
        });

        it('相同标题在不同层级应生成不同的SID', async () => {
            const content = `# Document

## Overview

### Overview

#### Overview
`;
            await fs.writeFile(testFile.fsPath, content, 'utf-8');

            const result = await readMarkdownFile({
                path: testFile.fsPath,
                parseMode: 'toc'
            });

            expect(result.success).toBe(true);
            const toc = flattenToc(result.tableOfContentsToCTree!);
            const sids = toc.map((s: any) => s.sid);
            
            // 由于层级不同，SID应该不同（通过父路径区分）
            expect(new Set(sids).size).toBe(sids.length);
        });
    });
});

