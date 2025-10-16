/**
 * 插入操作集成测试 - 修复版本
 * 测试新的自包含 executeSemanticEdits 功能
 */

import { executeSemanticEdits, SemanticEditIntent } from '../../../tools/document/semantic-edit-engine';
import { smartPathToSid } from '../../fixtures/sid-migration-helpers';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

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
    },
    workspace: {
        openTextDocument: jest.fn(),
        applyEdit: jest.fn().mockResolvedValue(true),
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

// Mock fs module
jest.mock('fs/promises');

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

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock file system
        (fs.readFile as jest.Mock).mockResolvedValue(mockMarkdownContent);
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
            Buffer.from(mockMarkdownContent)
        );
    });

    describe('insert_section_and_title', () => {
        it('应该在参照章节前插入新章节', async () => {
            const intent: SemanticEditIntent = {
                type: 'insert_section_and_title',
                target: {
                    sid: smartPathToSid(['10. 附录 (Appendix)']),
                    insertionPosition: 'before'
                },
                content: '## 9. 假设、依赖和约束 (Assumptions, Dependencies and Constraints)\n\n### 假设 (Assumptions)\n\n**ADC-ASSU-001: 关键利益相关方可持续参与**\n\n',
                reason: '插入约束章节',
                priority: 1
            };

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits([intent], testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents).toHaveLength(1);
            expect(result.failedIntents).toHaveLength(0);
        });

        it('应该在参照章节后插入新章节', async () => {
            const intent: SemanticEditIntent = {
                type: 'insert_section_and_title',
                target: {
                    sid: smartPathToSid(['8. 数据需求']),
                    insertionPosition: 'after'
                },
                content: '## 9. 接口需求\n\n系统接口需求说明...\n\n',
                reason: '添加接口需求章节',
                priority: 1
            };

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits([intent], testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents).toHaveLength(1);
        });

        it('参照章节不存在时应该失败', async () => {
            const intent: SemanticEditIntent = {
                type: 'insert_section_and_title',
                target: {
                    sid: smartPathToSid(['不存在的章节']),
                    insertionPosition: 'before'
                },
                content: '## 新章节\n\n内容...\n\n',
                reason: '测试不存在的章节',
                priority: 1
            };

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits([intent], testFileUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents).toHaveLength(1);
            expect(result.failedIntents[0].error).toContain('not found');
        });
    });

    describe('批量操作', () => {
        it('应该正确处理多个插入操作', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'insert_section_and_title',
                    target: {
                        sid: smartPathToSid(['8. 数据需求']),
                        insertionPosition: 'after'
                    },
                    content: '## 8.1 数据结构\n\n数据结构定义...\n\n',
                    reason: '添加数据结构',
                    priority: 2
                },
                {
                    type: 'insert_section_and_title',
                    target: {
                        sid: smartPathToSid(['8. 数据需求']),
                        insertionPosition: 'after'
                    },
                    content: '## 8.2 数据关系\n\n数据关系说明...\n\n',
                    reason: '添加数据关系',
                    priority: 1
                }
            ];

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.totalIntents).toBe(2);
            expect(result.successfulIntents).toBe(2);
        });
    });
});
