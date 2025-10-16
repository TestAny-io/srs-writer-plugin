/**
 * SmartIntentExecutor - 多次编辑稳定性集成测试
 * 
 * 回归测试：https://github.com/user/srs-writer-plugin/issues/XXX
 * 问题描述：编辑时会"吃掉"编辑部分的最后一个换行或者空格
 * 
 * 测试场景：
 * - 编辑前：abcdefg\n\nABCDEFG
 * - 第一次编辑后：应该是 abcdefghijklmn\n\nABCDEFG
 * - 第二次编辑后：应该仍保持换行结构
 * 
 * 测试目标：确保多次编辑时，换行符不会被丢失
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SmartIntentExecutor } from '../../../tools/atomic/smart-intent-executor';
import { SemanticEditIntent } from '../../../types/semanticEditing';
import { TableOfContents } from '../../../tools/atomic/sid-based-semantic-locator';
import { Logger } from '../../../utils/logger';

const logger = Logger.getInstance();

describe('SmartIntentExecutor - Multiple Edits Stability (Regression Test)', () => {
    const testDir = path.join(__dirname, '../../fixtures/multi-edit-test');
    const testFilePath = path.join(testDir, 'test-document.md');

    // 准备测试文件
    beforeAll(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    // 清理测试文件
    afterAll(() => {
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });

    /**
     * 场景1：基本的多次编辑（用户报告的原始问题）
     */
    test('应该在多次编辑后保持换行符完整性 - 基础场景', async () => {
        // 准备初始内容
        const initialContent = `abcdefg

ABCDEFG
`;
        fs.writeFileSync(testFilePath, initialContent, 'utf-8');

        // 构建 ToC
        const toc: TableOfContents[] = [
            {
                sid: '/section-a',
                title: 'abcdefg',
                normalizedTitle: 'section-a',
                level: 1,
                line: 1
            },
            {
                sid: '/section-b',
                title: 'ABCDEFG',
                normalizedTitle: 'section-b',
                level: 1,
                line: 3
            }
        ];

        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
        const executor = new SmartIntentExecutor(document.getText(), toc, document.uri);

        // 第一次编辑：替换第一行
        const firstEditIntent: SemanticEditIntent = {
            type: 'replace_section_content_only',
            target: {
                sid: '/section-a',
                lineRange: { startLine: 1, endLine: 1 }
            },
            content: 'abcdefghijklmn',  // 替换为更长的文本，无末尾换行
            reason: 'First edit - extend text',
            priority: 1
        };

        let result = await executor.execute([firstEditIntent]);
        expect(result.success).toBe(true);
        expect(result.successfulIntents).toBe(1);

        // 模拟文件保存（实际应由VSCode完成）
        let currentContent = document.getText();
        logger.info(`After first edit:\n${JSON.stringify(currentContent)}`);
        
        // 验证第一次编辑后的结构
        expect(currentContent).toContain('abcdefghijklmn');
        expect(currentContent).toContain('ABCDEFG');
        
        // 计算换行符数量（应该至少有1个空行 = 2个连续\n）
        const lineCount1 = currentContent.split('\n').length;
        logger.info(`Line count after first edit: ${lineCount1}`);

        // 第二次编辑：再次编辑第一行
        const secondEditIntent: SemanticEditIntent = {
            type: 'replace_section_content_only',
            target: {
                sid: '/section-a',
                lineRange: { startLine: 1, endLine: 1 }
            },
            content: 'abcdefghijklmnopqrst',  // 再次替换，仍无末尾换行
            reason: 'Second edit - extend text again',
            priority: 1
        };

        // 重新创建executor（模拟重新读取文件）
        currentContent = document.getText();
        const executor2 = new SmartIntentExecutor(currentContent, toc, document.uri);
        
        result = await executor2.execute([secondEditIntent]);
        expect(result.success).toBe(true);
        expect(result.successfulIntents).toBe(1);

        currentContent = document.getText();
        logger.info(`After second edit:\n${JSON.stringify(currentContent)}`);

        // 验证第二次编辑后的结构 - 关键验证：空行不应该被丢失
        expect(currentContent).toContain('abcdefghijklmnopqrst');
        expect(currentContent).toContain('ABCDEFG');
        
        // 计算换行符数量（应该保持和第一次编辑后一样的结构）
        const lineCount2 = currentContent.split('\n').length;
        logger.info(`Line count after second edit: ${lineCount2}`);
        
        // 验证没有连续行被合并
        expect(currentContent).not.toMatch(/abcdefghijklmnopqrstABCDEFG/);
        
        // 应该能找到空行（两个\n连续）
        expect(currentContent).toContain('\n\n');
    });

    /**
     * 场景2：多行内容的多次编辑
     */
    test('应该在多次编辑多行内容后保持结构完整', async () => {
        const initialContent = `# Section 1

Content line 1
Content line 2

# Section 2

More content
`;
        fs.writeFileSync(testFilePath, initialContent, 'utf-8');

        const toc: TableOfContents[] = [
            {
                sid: '/section-1',
                title: '# Section 1',
                normalizedTitle: 'Section 1',
                level: 1,
                line: 1
            },
            {
                sid: '/section-2',
                title: '# Section 2',
                normalizedTitle: 'Section 2',
                level: 1,
                line: 6
            }
        ];

        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
        
        // 第一轮编辑
        {
            const executor = new SmartIntentExecutor(document.getText(), toc, document.uri);
            
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_content_only',
                    target: {
                        sid: '/section-1',
                        lineRange: { startLine: 1, endLine: 2 }
                    },
                    content: 'New content line 1\nNew content line 2',
                    reason: 'Replace section 1 content',
                    priority: 1
                }
            ];

            const result = await executor.execute(intents);
            expect(result.success).toBe(true);
        }

        // 第二轮编辑
        {
            const currentContent = document.getText();
            const executor = new SmartIntentExecutor(currentContent, toc, document.uri);
            
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_content_only',
                    target: {
                        sid: '/section-2',
                        lineRange: { startLine: 1, endLine: 1 }
                    },
                    content: 'Updated more content',
                    reason: 'Update section 2 content',
                    priority: 1
                }
            ];

            const result = await executor.execute(intents);
            expect(result.success).toBe(true);
        }

        // 第三轮编辑
        {
            const currentContent = document.getText();
            const executor = new SmartIntentExecutor(currentContent, toc, document.uri);
            
            const intents: SemanticEditIntent[] = [
                {
                    type: 'insert_section_content_only',
                    target: {
                        sid: '/section-2',
                        lineRange: { startLine: 2, endLine: 2 }
                    },
                    content: 'Additional content line',
                    reason: 'Insert new line in section 2',
                    priority: 1
                }
            ];

            const result = await executor.execute(intents);
            expect(result.success).toBe(true);
        }

        // 最终验证
        const finalContent = document.getText();
        logger.info(`Final content:\n${finalContent}`);
        
        // 检查结构完整性
        const sections = finalContent.split(/^# /m);
        expect(sections.length).toBeGreaterThanOrEqual(2);
        
        // 每个section之间应该有空行
        expect(finalContent).toMatch(/\n\n#/);
    });

    /**
     * 场景3：连续插入和替换操作
     */
    test('应该正确处理连续的插入和替换操作', async () => {
        const initialContent = `# Features

- Feature A
- Feature B

# Requirements

Requirement 1
`;
        fs.writeFileSync(testFilePath, initialContent, 'utf-8');

        const toc: TableOfContents[] = [
            {
                sid: '/features',
                title: '# Features',
                normalizedTitle: 'Features',
                level: 1,
                line: 1
            },
            {
                sid: '/requirements',
                title: '# Requirements',
                normalizedTitle: 'Requirements',
                level: 1,
                line: 6
            }
        ];

        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
        
        // 第一个操作：在Features中插入
        {
            const executor = new SmartIntentExecutor(document.getText(), toc, document.uri);
            
            const intents: SemanticEditIntent[] = [
                {
                    type: 'insert_section_content_only',
                    target: {
                        sid: '/features',
                        lineRange: { startLine: 3, endLine: 3 }
                    },
                    content: '- Feature C',
                    reason: 'Insert new feature',
                    priority: 1
                }
            ];

            const result = await executor.execute(intents);
            expect(result.success).toBe(true);
        }

        // 第二个操作：替换Requirements中的内容
        {
            const currentContent = document.getText();
            const executor = new SmartIntentExecutor(currentContent, toc, document.uri);
            
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_content_only',
                    target: {
                        sid: '/requirements',
                        lineRange: { startLine: 1, endLine: 1 }
                    },
                    content: 'Requirement 1 (updated)\nRequirement 2 (new)',
                    reason: 'Update requirements',
                    priority: 1
                }
            ];

            const result = await executor.execute(intents);
            expect(result.success).toBe(true);
        }

        // 第三个操作：在Requirements中再插入
        {
            const currentContent = document.getText();
            const executor = new SmartIntentExecutor(currentContent, toc, document.uri);
            
            const intents: SemanticEditIntent[] = [
                {
                    type: 'insert_section_content_only',
                    target: {
                        sid: '/requirements',
                        lineRange: { startLine: 3, endLine: 3 }
                    },
                    content: 'Requirement 3',
                    reason: 'Add requirement 3',
                    priority: 1
                }
            ];

            const result = await executor.execute(intents);
            expect(result.success).toBe(true);
        }

        // 最终验证：确保sections之间的空行被保留
        const finalContent = document.getText();
        logger.info(`Final multi-operation content:\n${finalContent}`);
        
        // 应该有清晰的分段
        expect(finalContent).toMatch(/# Features[\s\S]*# Requirements/);
        
        // Features和Requirements之间应该有空行
        const [featuresSection, requirementsSection] = finalContent.split('# Requirements');
        expect(featuresSection.trim().endsWith('\n')).toBe(true);
    });

    /**
     * 场景4：边界情况 - 文件末尾编辑
     */
    test('应该正确处理文件末尾的编辑', async () => {
        const initialContent = `# Main

Initial content
`;
        fs.writeFileSync(testFilePath, initialContent, 'utf-8');

        const toc: TableOfContents[] = [
            {
                sid: '/main',
                title: '# Main',
                normalizedTitle: 'Main',
                level: 1,
                line: 1
            }
        ];

        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));

        // 编辑末尾
        {
            const executor = new SmartIntentExecutor(document.getText(), toc, document.uri);
            
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_content_only',
                    target: {
                        sid: '/main',
                        lineRange: { startLine: 1, endLine: 1 }
                    },
                    content: 'Updated content without newline',
                    reason: 'Replace final content',
                    priority: 1
                }
            ];

            const result = await executor.execute(intents);
            expect(result.success).toBe(true);
        }

        // 再次编辑
        {
            const currentContent = document.getText();
            const executor = new SmartIntentExecutor(currentContent, toc, document.uri);
            
            const intents: SemanticEditIntent[] = [
                {
                    type: 'insert_section_content_only',
                    target: {
                        sid: '/main',
                        lineRange: { startLine: 2, endLine: 2 }
                    },
                    content: 'Another line',
                    reason: 'Insert additional line',
                    priority: 1
                }
            ];

            const result = await executor.execute(intents);
            expect(result.success).toBe(true);
        }

        const finalContent = document.getText();
        logger.info(`Final end-of-file edit:\n${finalContent}`);
        
        // 内容应该被正确分割
        expect(finalContent.split('\n').length).toBeGreaterThan(3);
    });
});
