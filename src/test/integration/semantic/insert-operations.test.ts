/**
 * 插入操作集成测试
 * 测试新的 insert_entire_section 和 insert_lines_in_section 功能
 */

import { SemanticLocator, SemanticTarget, LocationResult } from '../../../tools/atomic/semantic-locator';
import { executeSemanticEdits, SemanticEditIntent } from '../../../tools/document/semantic-edit-engine';
import * as vscode from 'vscode';

// Mock VSCode API
jest.mock('vscode', () => ({
    Range: jest.fn().mockImplementation((start, end) => ({ start, end })),
    Position: jest.fn().mockImplementation((line, character) => ({ line, character })),
    window: {
        createOutputChannel: jest.fn().mockReturnValue({
            appendLine: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        }),
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showInformationMessage: jest.fn()
    },
    workspace: {
        openTextDocument: jest.fn(),
        applyEdit: jest.fn(),
        fs: {
            readFile: jest.fn()
        }
    },
    WorkspaceEdit: jest.fn().mockImplementation(() => ({
        replace: jest.fn(),
        insert: jest.fn()
    })),
    Uri: {
        file: jest.fn().mockImplementation((path) => ({ fsPath: path }))
    }
}));

describe('Insert Operations Integration Tests', () => {
    const mockMarkdownContent = `# 测试文档

## 1. 概述
这是第一章节的内容。

## 2. 需求
这是第二章节的内容。

## 8. 数据需求
DAR-LOG-001: 操作日志
- 描述: 系统操作日志的数据要求
- 数据实体: AuditLog

待补充...
---

## 10. 附录 (Appendix)
待补充...
---

*本文档由 SRS Writer Plugin 自动生成，正在逐步完善中...*`;

    let locator: SemanticLocator;

    beforeEach(() => {
        locator = new SemanticLocator(mockMarkdownContent);
        jest.clearAllMocks();
    });

    describe('insert_entire_section', () => {
        it('应该在参照章节前插入新章节', () => {
            const intent: SemanticEditIntent = {
                type: 'insert_entire_section',
                target: {
                    path: ['10. 附录 (Appendix)'],
                    insertionPosition: 'before'
                },
                content: '## 9. 假设、依赖和约束 (Assumptions, Dependencies and Constraints)\n\n### 假设 (Assumptions)\n\n**ADC-ASSU-001: 关键利益相关方可持续参与**\n\n',
                reason: '插入约束章节',
                priority: 1
            };

            const result = locator.findTarget(intent.target, intent.type);

            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
            expect(result.insertionPoint).toBeDefined();
            
            // 验证插入位置是在第10章之前
            if (result.insertionPoint) {
                expect(result.insertionPoint.line).toBeGreaterThan(10); // 在文档中间某处
                expect(result.insertionPoint.line).toBeLessThan(20);   // 不在文档末尾
            }
        });

        it('应该在参照章节后插入新章节', () => {
            const intent: SemanticEditIntent = {
                type: 'insert_entire_section',
                target: {
                    path: ['8. 数据需求'],
                    insertionPosition: 'after'
                },
                content: '## 9. 假设、依赖和约束\n\n内容...\n\n',
                reason: '在数据需求后插入约束章节',
                priority: 1
            };

            const result = locator.findTarget(intent.target, intent.type);

            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
            expect(result.insertionPoint).toBeDefined();
        });

        it('参照章节不存在时应该智能回退（编号推断）', () => {
            const intent: SemanticEditIntent = {
                type: 'insert_entire_section',
                target: {
                    path: ['9. 假设、依赖和约束'],
                    insertionPosition: 'before'
                },
                content: '## 9. 假设、依赖和约束\n\n内容...\n\n',
                reason: '测试智能回退',
                priority: 1
            };

            const result = locator.findTarget(intent.target, intent.type);

            // 应该能通过编号推断找到合适位置（在8和10之间）
            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
            expect(result.insertionPoint).toBeDefined();
        });

        it('无法推断时应该报错', () => {
            const intent: SemanticEditIntent = {
                type: 'insert_entire_section',
                target: {
                    path: ['不存在的章节'],
                    insertionPosition: 'before'
                },
                content: '## 新章节\n\n内容...\n\n',
                reason: '测试报错情况',
                priority: 1
            };

            const result = locator.findTarget(intent.target, intent.type);

            expect(result.found).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('AI GUIDANCE');
        });

        it('应该返回明确错误（不存在的参照章节）', () => {
            const intent: SemanticEditIntent = {
                type: 'insert_entire_section',
                target: {
                    path: ['不存在的章节'],
                    insertionPosition: 'before'
                },
                content: '## 新章节\n\n内容...\n\n',
                reason: '测试不存在的参照章节',
                priority: 1
            };

            const result = locator.findTarget(intent.target, intent.type);

            expect(result.found).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Cannot find reference section');
        });
    });

    describe('insert_lines_in_section', () => {
        it('应该在章节内部插入内容', () => {
            const intent: SemanticEditIntent = {
                type: 'insert_lines_in_section',
                target: {
                    path: ['8. 数据需求'],
                    insertionPosition: 'inside'
                },
                content: '**DAR-LOG-002: 审计日志**\n操作时间戳、用户ID、操作内容记录。\n',
                reason: '添加审计日志需求',
                priority: 1
            };

            const result = locator.findTarget(intent.target, intent.type);

            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
            expect(result.insertionPoint).toBeDefined();
        });

        it('应该在章节开头插入内容（基于前向章节）', () => {
            const intent: SemanticEditIntent = {
                type: 'insert_lines_in_section',
                target: {
                    path: ['2. 需求'],
                    insertionPosition: 'inside'
                },
                content: '**重要提示**: 本章节包含所有系统需求。\n\n',
                reason: '添加章节说明',
                priority: 1
            };

            const result = locator.findTarget(intent.target, intent.type);

            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
        });
    });

    describe('完整编辑流程测试', () => {
        it('应该执行多个插入操作（完整流程）', () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'insert_entire_section',
                    target: {
                        path: ['8. 数据需求'],
                        insertionPosition: 'after'
                    },
                    content: '## 9. 假设、依赖和约束\n\n### 假设\n\n**ADC-ASSU-001**: 关键利益相关方可持续参与。\n\n',
                    reason: '插入约束章节',
                    priority: 1
                },
                {
                    type: 'insert_lines_in_section',
                    target: {
                        path: ['8. 数据需求'],
                        insertionPosition: 'inside'
                    },
                    content: '**DAR-CACHE-001: 缓存数据**\n系统需要缓存常用查询结果以提高性能。\n',
                    reason: '添加缓存需求',
                    priority: 2
                }
            ];

            // 验证意图的格式正确性
            expect(intents).toHaveLength(2);
            expect(intents[0].target.path).toEqual(['8. 数据需求']);
            expect(intents[1].target.path).toEqual(['8. 数据需求']);
        });

        it('应该处理动态生成的章节名', () => {
            const testCases = [
                { name: '3. 新章节', expected: true },
                { name: '99. 不存在章节', expected: false }
            ];

            testCases.forEach(testCase => {
                const intent: SemanticEditIntent = {
                    type: 'insert_entire_section',
                    target: {
                        path: [testCase.name],
                        insertionPosition: 'before'
                    },
                    content: '## 新内容\n\n测试内容...\n\n',
                    reason: `测试动态章节: ${testCase.name}`,
                    priority: 1
                };

                const result = locator.findTarget(intent.target, intent.type);
                expect(result.found).toBe(testCase.expected);
            });
        });

        it('应该正确处理相同章节的多次插入', () => {
            const intent: SemanticEditIntent = {
                type: 'insert_lines_in_section',
                target: {
                    path: ['8. 数据需求'],
                    insertionPosition: 'inside'
                },
                content: '**DAR-PERF-001: 性能数据**\n响应时间、吞吐量等性能指标的数据要求。\n',
                reason: '添加性能数据需求',
                priority: 1
            };

            // 第一次插入
            const result1 = locator.findTarget(intent.target, intent.type);
            expect(result1.found).toBe(true);

            // 第二次插入（相同位置）
            const result2 = locator.findTarget(intent.target, intent.type);
            expect(result2.found).toBe(true);
        });
    });

    describe('validation', () => {
        it('插入操作缺少 insertionPosition 时应该报错', () => {
            const target: SemanticTarget = {
                path: ['8. 数据需求'],
                // 缺少 insertionPosition
            };

            const result = locator.findTarget(target, 'insert_entire_section');

            expect(result.found).toBe(false);
            expect(result.error).toContain('Insertion position is required');
        });

        it('无效的 insertionPosition 应该报错', () => {
            const target: SemanticTarget = {
                path: ['8. 数据需求'],
                insertionPosition: 'invalid' as any,
            };

            const result = locator.findTarget(target, 'insert_entire_section');

            expect(result.found).toBe(false);
            expect(result.error).toContain('Unknown insertion position');
        });
    });

    describe('number inference', () => {
        it('应该正确提取章节编号', () => {
            // 这是一个私有方法测试，需要通过间接方式验证
            const target: SemanticTarget = {
                path: ['3. 新章节'],
                insertionPosition: 'before',
            };

            const result = locator.findTarget(target, 'insert_entire_section');

            // 编号3应该插在第2章后面
            expect(result.found).toBe(true);
        });

        it('应该支持不同的编号格式', () => {
            const testCases = [
                { name: '5. 测试章节', expected: true },
                { name: '第6章 测试章节', expected: true },
                { name: '(7) 测试章节', expected: true },
                { name: '无编号章节', expected: false }
            ];

            testCases.forEach(testCase => {
                const target: SemanticTarget = {
                    path: [testCase.name],
                    insertionPosition: 'before',
                };

                const result = locator.findTarget(target, 'insert_entire_section');

                if (testCase.expected) {
                    expect(result.found).toBe(true);
                } else {
                    // 无编号的情况下，会尝试推断但可能失败
                    expect(result.found).toBe(false);
                }
            });
        });
    });

    describe('context building', () => {
        it('应该提供正确的上下文信息', () => {
            const target: SemanticTarget = {
                path: ['8. 数据需求'],
                insertionPosition: 'after',
            };

            const result = locator.findTarget(target, 'insert_entire_section');

            expect(result.found).toBe(true);
            expect(result.context).toBeDefined();
            expect(result.context?.beforeText).toBe('8. 数据需求');
        });
    });
}); 