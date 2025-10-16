/**
 * Semantic Edit Engine集成测试
 * 
 * 测试完整的语义编辑流程，包括文档分析、语义定位和原子性编辑
 */

import * as vscode from 'vscode';
import { executeSemanticEdits, validateSemanticIntents, SemanticEditIntent } from '../../../tools/document/semantic-edit-engine';
import { smartPathToSid } from '../../fixtures/sid-migration-helpers';
import { readMarkdownFile } from '../../../tools/document/enhanced-readfile-tools';

describe('Semantic Edit Engine Integration', () => {
    let testFileUri: vscode.Uri;
    let mockWorkspaceFolder: vscode.WorkspaceFolder;

    beforeEach(() => {
        // Mock workspace folder
        mockWorkspaceFolder = {
            uri: vscode.Uri.parse('file:///test-workspace'),
            name: 'test-workspace',
            index: 0
        };

        // Mock test file
        testFileUri = vscode.Uri.joinPath(mockWorkspaceFolder.uri, 'test-document.md');

        // Mock vscode.workspace methods
        jest.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue([mockWorkspaceFolder]);
        jest.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(createMockDocument());
        jest.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);
        jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(createMockDocumentSymbols());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Complete Semantic Editing Workflow', () => {
        it('should execute a complete read-analyze-edit workflow', async () => {
            // Step 1: Read file with structure analysis
            const readResult = await readMarkdownFile({
                path: 'test-document.md',
                parseMode: 'structure' // 只获取结构信息
            });

            expect(readResult.success).toBe(true);
            expect(readResult.tableOfContents).toBeDefined();

            // Step 2: Create semantic edit intents based on structure analysis
            const editIntents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_and_title',
                    target: {
                        sid: smartPathToSid(['功能需求'])
                    },
                    content: '# 功能需求\n\n这是更新后的功能需求内容。',
                    reason: '更新功能需求内容',
                    priority: 1
                },
                {
                    type: 'replace_section_and_title',
                    target: {
                        sid: smartPathToSid(['用户管理'])
                    },
                    content: '## 用户管理\n\n用户管理功能描述。\n\n## 权限管理\n\n新增的权限管理功能。',
                    reason: '新增权限管理章节',
                    priority: 2
                }
            ];

            // Step 3: Validate edit intents
            const validation = validateSemanticIntents(editIntents);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);

            // Step 4: Execute semantic edits
            const editResult = await executeSemanticEdits(editIntents, testFileUri);

            expect(editResult.success).toBe(true);
            expect(editResult.appliedIntents).toHaveLength(2);
            expect(editResult.failedIntents).toHaveLength(0);
            expect(editResult.metadata?.executionTime).toBeGreaterThan(0);
        });

        it('should handle partial editing failures gracefully', async () => {
            const editIntents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_and_title',
                    target: {
                        sid: smartPathToSid(['功能需求'])
                    },
                    content: '# 功能需求\n\n这是更新后的功能需求内容。',
                    reason: '更新功能需求内容',
                    priority: 1
                },
                {
                    type: 'replace_section_and_title',
                    target: {
                        sid: smartPathToSid(['不存在的章节'])
                    },
                    content: '## 新章节\n\n新增内容。',
                    reason: '新增章节',
                    priority: 2
                }
            ];

            const editResult = await executeSemanticEdits(editIntents, testFileUri);

            expect(editResult.success).toBe(false); // 整体失败，因为有失败的意图
            expect(editResult.appliedIntents).toHaveLength(1); // 第一个成功
            expect(editResult.failedIntents).toHaveLength(1); // 第二个失败
            expect(editResult.failedIntents).toBeDefined();
        });

        it('should provide detailed metadata and execution information', async () => {
            const editIntents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_and_title',
                    target: {
                        sid: smartPathToSid(['用户管理'])
                    },
                    content: '## 用户管理\n\n更新后的用户管理内容。',
                    reason: '更新用户管理功能描述',
                    priority: 1
                }
            ];

            const editResult = await executeSemanticEdits(editIntents, testFileUri);

            expect(editResult.metadata).toBeDefined();
            expect(editResult.metadata!.executionTime).toBeGreaterThan(0);
            expect(editResult.metadata!.timestamp).toBeDefined();
            expect(editResult.metadata!.astNodeCount).toBeGreaterThanOrEqual(0);
            expect(editResult.metadata!.documentLength).toBeGreaterThan(0);
        });
    });

    describe('Priority-based Execution', () => {
        it('should execute edits in priority order', async () => {
            const editIntents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_and_title',
                    target: { 
                        sid: smartPathToSid(['功能需求'])
                    },
                    content: '## 低优先级内容',
                    reason: '低优先级编辑',
                    priority: 1
                },
                {
                    type: 'replace_section_and_title',
                    target: { 
                        sid: smartPathToSid(['用户管理'])
                    },
                    content: '## 高优先级内容',
                    reason: '高优先级编辑',
                    priority: 5
                },
                {
                    type: 'replace_section_and_title',
                    target: { 
                        sid: smartPathToSid(['数据管理'])
                    },
                    content: '中等优先级内容',
                    reason: '中等优先级编辑',
                    priority: 3
                }
            ];

            const editResult = await executeSemanticEdits(editIntents, testFileUri);

            // 验证执行顺序（通过检查VSCode WorkspaceEdit的调用）
            const workspaceEditCalls = (vscode.workspace.applyEdit as jest.Mock).mock.calls;
            expect(workspaceEditCalls).toHaveLength(1); // 应该只调用一次applyEdit（原子性）
            
            expect(editResult.appliedIntents).toHaveLength(3);
            // 验证执行是按优先级顺序进行的
            expect(editResult.appliedIntents[0].originalIntent.priority).toBe(5); // 最高优先级
            expect(editResult.appliedIntents[1].originalIntent.priority).toBe(3); // 中等优先级
            expect(editResult.appliedIntents[2].originalIntent.priority).toBe(1); // 最低优先级
        });
    });

    describe('Error Handling and Validation', () => {
        it('should validate intents before execution', () => {
            const invalidIntents: SemanticEditIntent[] = [
                {
                    type: 'invalid_type' as any,
                    target: { 
                        sid: smartPathToSid(['功能需求'])
                    },
                    content: '',
                    reason: '',
                    priority: -1
                }
            ];

            const validation = validateSemanticIntents(invalidIntents);

            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('Invalid intent type: invalid_type');
            expect(validation.errors).toContain('Intent content must be a string');
            expect(validation.errors).toContain('Intent missing reason field');
            expect(validation.errors).toContain('Intent priority must be a non-negative integer');
        });

        it('should handle VSCode API failures gracefully', async () => {
            // Mock VSCode API failure
            jest.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(false);

            const editIntents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_and_title',
                    target: { 
                        sid: smartPathToSid(['功能需求'])
                    },
                    content: '新内容',
                    reason: '测试编辑',
                    priority: 1
                }
            ];

            const editResult = await executeSemanticEdits(editIntents, testFileUri);

            expect(editResult.success).toBe(false);
            expect(editResult.failedIntents?.[0]?.error).toBe('Failed to apply workspace edit');
            expect(editResult.appliedIntents).toHaveLength(0);
            expect(editResult.failedIntents).toHaveLength(1);
        });
    });

    describe('replace_section_content_only', () => {
        it('应该成功替换章节内的特定内容', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_section_content_only',
                target: {
                    sid: smartPathToSid(['功能需求']),
                    lineRange: { startLine: 1, endLine: 1 }
                },
                content: '增强的用户注册功能（支持多种验证方式）',
                reason: '增强用户注册功能描述',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents.length).toBe(1);
        });

        it('应该成功在子章节中替换内容', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_section_content_only',
                target: {
                    sid: smartPathToSid(['用户管理']),
                    lineRange: { startLine: 1, endLine: 1 }
                },
                content: '详细的用户信息管理',
                reason: '更新用户信息描述',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
        });
    });

    describe('replace_section_and_title', () => {
        it('应该成功替换整个章节', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_section_and_title',
                target: {
                    sid: smartPathToSid(['功能需求'])
                },
                content: '# 新的功能需求\n\n这是完全重写的功能需求章节。\n',
                reason: '重写功能需求章节',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
        });

        it('当目标章节不存在时应该返回失败', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_section_and_title',
                target: {
                    sid: smartPathToSid(['不存在的章节'])
                },
                content: '新内容',
                reason: '测试不存在的章节',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents.length).toBe(1);
        });
    });

    describe('insert_section_content_only', () => {
        it('应该在章节内插入内容', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_section_content_only',
                target: {
                    sid: smartPathToSid(['用户管理']),
                    lineRange: { startLine: 7, endLine: 7 } // 在用户管理章节的第7行插入
                },
                content: '新增功能：用户权限管理\n',
                reason: '添加权限管理功能',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
        });
    });

    describe('insert_section_and_title', () => {
        it('应该在指定位置插入新章节', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_section_and_title',
                target: {
                    sid: smartPathToSid(['功能需求']),
                    insertionPosition: 'after'
                },
                content: '# 性能需求\n\n系统性能相关的需求...\n',
                reason: '添加性能需求章节',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
        });

        it('应该支持同时插入多个章节', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'insert_section_and_title',
                    target: {
                        sid: smartPathToSid(['用户管理']),
                        insertionPosition: 'after'
                    },
                    content: '# 安全管理\n\n安全相关功能...\n',
                    reason: '添加安全管理',
                    priority: 1
                },
                {
                    type: 'insert_section_and_title',
                    target: {
                        sid: smartPathToSid(['数据管理']),
                        insertionPosition: 'before'
                    },
                    content: '# 备份管理\n\n数据备份功能...\n',
                    reason: '添加备份管理',
                    priority: 2
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents.length).toBe(2);
        });
    });

    describe('组合操作测试', () => {
        it('应该正确处理混合类型的编辑意图', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_content_only',
                    target: {
                        sid: smartPathToSid(['功能需求']),
                        lineRange: { startLine: 1, endLine: 1 }
                    },
                    content: '替换后的内容',
                    reason: '替换操作',
                    priority: 1
                },
                {
                    type: 'insert_section_and_title',
                    target: {
                        sid: smartPathToSid(['功能需求']),
                        insertionPosition: 'after'
                    },
                    content: '# 新章节\n\n新的内容...\n',
                    reason: '插入操作',
                    priority: 2
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
        });

        it('应该正确处理优先级排序', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_content_only',
                    target: {
                        sid: smartPathToSid(['功能需求']),
                        lineRange: { startLine: 1, endLine: 1 }
                    },
                    content: '低优先级替换',
                    reason: '低优先级操作',
                    priority: 1
                },
                {
                    type: 'replace_section_content_only',
                    target: {
                        sid: smartPathToSid(['功能需求']),
                        lineRange: { startLine: 1, endLine: 1 }
                    },
                    content: '高优先级替换',
                    reason: '高优先级操作',
                    priority: 10
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            // 高优先级应该先执行
            expect(result.appliedIntents[0].originalIntent.priority).toBe(10);
            expect(result.appliedIntents[1].originalIntent.priority).toBe(1);
        });
    });
});

// ============================================================================
// 测试辅助函数
// ============================================================================

function createMockDocument(): vscode.TextDocument {
    return {
        fileName: 'test-document.md',
        uri: vscode.Uri.parse('file:///test-workspace/test-document.md'),
        getText: jest.fn().mockReturnValue(sampleDocumentContent),
        lineCount: 10,
        languageId: 'markdown',
        version: 1,
        isDirty: false,
        isClosed: false,
        eol: vscode.EndOfLine.LF,
        save: jest.fn(),
        lineAt: jest.fn(),
        offsetAt: jest.fn(),
        positionAt: jest.fn(),
        getWordRangeAtPosition: jest.fn(),
        validateRange: jest.fn(),
        validatePosition: jest.fn()
    } as any;
}

function createMockDocumentSymbols(): vscode.DocumentSymbol[] {
    return [
        new vscode.DocumentSymbol(
            '# 功能需求',
            '',
            vscode.SymbolKind.String,
            new vscode.Range(0, 0, 2, 0),
            new vscode.Range(0, 0, 0, 6)
        ),
        new vscode.DocumentSymbol(
            '## 用户管理',
            '',
            vscode.SymbolKind.String,
            new vscode.Range(3, 0, 5, 0),
            new vscode.Range(3, 0, 3, 6)
        ),
        new vscode.DocumentSymbol(
            '## 数据管理',
            '',
            vscode.SymbolKind.String,
            new vscode.Range(6, 0, 8, 0),
            new vscode.Range(6, 0, 6, 6)
        )
    ];
}

const sampleDocumentContent = `# 功能需求

这是功能需求的内容。

## 用户管理

用户管理功能描述。

## 数据管理

数据管理功能描述。
`; 