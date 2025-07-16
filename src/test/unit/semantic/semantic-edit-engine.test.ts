import * as vscode from 'vscode';
import { executeSemanticEdits, SemanticEditIntent } from '../../../tools/document/semantic-edit-engine';

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
            const mockDocument = `
# Test Document

## Functional Requirements

<!-- req-id: FR-001, priority: should-have -->
Some requirement content here.

<!-- req-id: FR-002, priority: must-have -->
Another requirement here.
`;

            // Mock vscode.workspace.openTextDocument
            const mockTextDocument = {
                getText: jest.fn().mockReturnValue(mockDocument)
            } as any;
            
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockTextDocument);

            const testUri = vscode.Uri.file('/test/file.md');
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_lines_in_section',
                    target: {
                        sectionName: 'Functional Requirements',
                        startFromAnchor: 'req-id: FR-001'
                        // Missing targetContent - this should cause an error
                    },
                    content: '<!-- req-id: FR-001, priority: must-have -->',
                    reason: 'Test incorrect usage - missing targetContent',
                    priority: 1
                }
            ];

            const result = await executeSemanticEdits(intents, testUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents).toHaveLength(1);
            expect(result.appliedIntents).toHaveLength(0);
            expect(result.semanticErrors).toContain(
                'Failed to apply intent: replace_lines_in_section -> Functional Requirements'
            );
        });

        test('should successfully handle replace_lines_in_section with both startFromAnchor and targetContent', async () => {
            const mockDocument = `
# Test Document

## Functional Requirements

<!-- req-id: FR-001, priority: should-have -->
Some requirement content here.

<!-- req-id: FR-002, priority: must-have -->
Another requirement here.
`;

            // Mock vscode.workspace.openTextDocument
            const mockTextDocument = {
                getText: jest.fn().mockReturnValue(mockDocument)
            } as any;
            
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockTextDocument);
            (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);

            const testUri = vscode.Uri.file('/test/file.md');
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_lines_in_section',
                    target: {
                        sectionName: 'Functional Requirements',
                        startFromAnchor: 'req-id: FR-001',
                        targetContent: '<!-- req-id: FR-001, priority: should-have -->'
                    },
                    content: '<!-- req-id: FR-001, priority: must-have -->',
                    reason: 'Test correct usage with targetContent',
                    priority: 1
                }
            ];

            const result = await executeSemanticEdits(intents, testUri);

            expect(result.success).toBe(true);
            expect(result.failedIntents).toHaveLength(0);
            expect(result.appliedIntents).toHaveLength(1);
        });
    });
}); 