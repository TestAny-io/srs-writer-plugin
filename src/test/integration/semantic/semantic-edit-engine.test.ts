/**
 * Semantic Edit Engine集成测试
 * 
 * 测试完整的语义编辑流程，包括文档分析、语义定位和原子性编辑
 */

import * as vscode from 'vscode';
import { executeSemanticEdits, validateSemanticIntents, SemanticEditIntent } from '../../../tools/document/semantic-edit-engine';
import { readFile } from '../../../tools/document/enhanced-readfile-tools';

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
            const readResult = await readFile({
                path: 'test-document.md',
                includeStructure: true
            });

            expect(readResult.success).toBe(true);
            expect(readResult.structure).toBeDefined();

            // Step 2: Create semantic edit intents based on structure analysis
            const editIntents: SemanticEditIntent[] = [
                {
                    type: 'replace_entire_section',
                    target: {
                        sectionName: '功能需求',
                        startFromAnchor: '# 功能需求'
                    },
                    content: '# 功能需求\n\n这是更新后的功能需求内容。',
                    reason: '更新功能需求内容',
                    priority: 1
                },
                {
                    type: 'replace_entire_section',
                    target: {
                        sectionName: '用户管理',
                        startFromAnchor: '## 用户管理'
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
                    type: 'replace_entire_section',
                    target: {
                        sectionName: '功能需求',
                        startFromAnchor: '# 功能需求'
                    },
                    content: '# 功能需求\n\n这是更新后的功能需求内容。',
                    reason: '更新功能需求内容',
                    priority: 1
                },
                {
                    type: 'replace_entire_section',
                    target: {
                        sectionName: '不存在的章节',
                        startFromAnchor: '## 不存在的章节'
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
            expect(editResult.semanticErrors).toBeDefined();
        });

        it('should provide detailed metadata and execution information', async () => {
            const editIntents: SemanticEditIntent[] = [
                {
                    type: 'replace_entire_section',
                    target: {
                        sectionName: '用户管理',
                        startFromAnchor: '## 用户管理'
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
                    type: 'replace_entire_section',
                    target: { 
                        sectionName: '功能需求',
                        startFromAnchor: '# 功能需求'
                    },
                    content: '## 低优先级内容',
                    reason: '低优先级编辑',
                    priority: 1
                },
                {
                    type: 'replace_entire_section',
                    target: { 
                        sectionName: '用户管理',
                        startFromAnchor: '## 用户管理'
                    },
                    content: '## 高优先级内容',
                    reason: '高优先级编辑',
                    priority: 5
                },
                {
                    type: 'replace_entire_section',
                    target: { 
                        sectionName: '数据管理',
                        startFromAnchor: '## 数据管理'
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
            expect(editResult.appliedIntents[0].priority).toBe(5); // 最高优先级
            expect(editResult.appliedIntents[1].priority).toBe(3); // 中等优先级
            expect(editResult.appliedIntents[2].priority).toBe(1); // 最低优先级
        });
    });

    describe('Error Handling and Validation', () => {
        it('should validate intents before execution', () => {
            const invalidIntents: SemanticEditIntent[] = [
                {
                    type: 'invalid_type' as any,
                    target: { 
                        sectionName: '功能需求',
                        startFromAnchor: '# 功能需求'
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
                    type: 'replace_entire_section',
                    target: { 
                        sectionName: '功能需求',
                        startFromAnchor: '# 功能需求'
                    },
                    content: '新内容',
                    reason: '测试编辑',
                    priority: 1
                }
            ];

            const editResult = await executeSemanticEdits(editIntents, testFileUri);

            expect(editResult.success).toBe(false);
            expect(editResult.error).toBe('Failed to apply workspace edit');
            expect(editResult.appliedIntents).toHaveLength(0);
            expect(editResult.failedIntents).toHaveLength(1);
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