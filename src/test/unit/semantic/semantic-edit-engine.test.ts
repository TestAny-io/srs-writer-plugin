import * as vscode from 'vscode';
import { executeSemanticEdits, validateSemanticIntents, SemanticEditIntent } from '../../../tools/document/semantic-edit-engine';

// Mock vscode
jest.mock('vscode', () => ({
    workspace: {
        openTextDocument: jest.fn(),
        applyEdit: jest.fn()
    },
    WorkspaceEdit: jest.fn().mockImplementation(() => ({
        replace: jest.fn(),
        insert: jest.fn(),
        delete: jest.fn()
    })),
    Uri: {
        file: jest.fn().mockImplementation((path: string) => ({ fsPath: path }))
    },
    Range: jest.fn().mockImplementation((start, end) => ({ start, end })),
    Position: jest.fn().mockImplementation((line, char) => ({ line, char }))
}));

describe('SemanticEditEngine - Error Handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('incorrect tool usage validation', () => {
        test('should reject replace_lines_in_section with only startFromAnchor', async () => {
            const intent: SemanticEditIntent = {
                type: 'replace_lines_in_section',
                target: {
                    path: ['功能需求']
                    // 缺少 targetContent - 这应该导致验证失败
                },
                content: '替换的内容',
                reason: '测试缺少targetContent的情况',
                priority: 1
            };

            const validationResult = await validateSemanticIntents([intent]);

            expect(validationResult.valid).toBe(false);
            expect(validationResult.errors).toContain(
                expect.stringContaining('targetContent is required for replace_lines_in_section')
            );
        });

        test('should successfully handle replace_lines_in_section with both startFromAnchor and targetContent', async () => {
            const intent: SemanticEditIntent = {
                type: 'replace_lines_in_section',
                target: {
                    path: ['功能需求'],
                    targetContent: '用户注册'
                },
                content: '增强的用户注册功能',
                reason: '更新用户注册功能描述',
                priority: 1
            };

            const validationResult = await validateSemanticIntents([intent]);

            expect(validationResult.valid).toBe(true);
            expect(validationResult.errors).toHaveLength(0);
        });
    });
}); 