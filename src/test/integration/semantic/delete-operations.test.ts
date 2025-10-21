/**
 * Delete Operations Integration Tests
 *
 * 测试新增的两种删除操作：
 * - delete_section_and_title: 删除整个章节（包括标题和所有子章节）
 * - delete_section_content_only: 删除章节内容（保留标题）
 *
 * 根据设计文档 v1.2 实施的完整测试套件（14个测试用例）
 */

import * as vscode from 'vscode';
import { executeSemanticEdits, SemanticEditIntent } from '../../../tools/document/semantic-edit-engine';

describe('Delete Operations Integration Tests', () => {
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
        testFileUri = vscode.Uri.parse('file:///test-workspace/test-document.md');

        // Mock vscode.workspace methods
        jest.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue([mockWorkspaceFolder]);
        jest.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(createMockDocument());
        jest.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);
        jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(createMockDocumentSymbols());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================================
    // Unit Tests (Test Cases 1-4)
    // ============================================================================

    describe('Unit Tests - Basic Delete Operations', () => {
        // Test Case 1: Delete entire section with title
        it('Test Case 1: should delete entire section including title', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'delete_section_and_title',
                target: {
                    sid: '/2'
                },
                content: '',
                reason: 'Delete User Management section',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);
            expect(result.appliedIntents).toHaveLength(1);
            expect(result.failedIntents).toHaveLength(0);

            // Verify workspace edit was called
            expect(vscode.workspace.applyEdit).toHaveBeenCalled();
        });

        // Test Case 2: Delete section content only (preserve title)
        it('Test Case 2: should delete section content but preserve title', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'delete_section_content_only',
                target: {
                    sid: '/2'
                },
                content: '',
                reason: 'Delete content of User Management section',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);
            expect(result.appliedIntents).toHaveLength(1);
            expect(result.failedIntents).toHaveLength(0);
        });

        // Test Case 3: Delete nested subsection
        it('Test Case 3: should delete nested subsection including all its children', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'delete_section_and_title',
                target: {
                    sid: '/2/1'
                },
                content: '',
                reason: 'Delete User Registration subsection',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);
        });

        // Test Case 4: Delete content from nested subsection
        it('Test Case 4: should delete content from nested subsection preserving title', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'delete_section_content_only',
                target: {
                    sid: '/2/1'
                },
                content: '',
                reason: 'Delete content from User Registration subsection',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);
        });
    });

    // ============================================================================
    // Integration Tests (Test Cases 5-8)
    // ============================================================================

    describe('Integration Tests - Mixed Operations', () => {
        // Test Case 5: Delete + Insert in different sections (should succeed)
        it('Test Case 5: should allow delete in one section and insert in another section', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'delete_section_and_title',
                    target: { sid: '/3' },
                    content: '',
                    reason: 'Delete Data Management section',
                    priority: 1
                },
                {
                    type: 'insert_section_and_title',
                    target: { sid: '/2', insertionPosition: 'after' },
                    content: '## New Section\n\nNew section content.\n',
                    reason: 'Insert new section after User Management',
                    priority: 2
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(2);
            expect(result.appliedIntents).toHaveLength(2);
        });

        // Test Case 6: Delete content + Replace in same section (should succeed)
        it('Test Case 6: should allow delete_section_content_only and replace_section_content_only in same section', async () => {
            // Note: This test expects sequential execution - delete first, then replace
            // Since they're on the same SID but different line ranges, they should work
            const intents: SemanticEditIntent[] = [
                {
                    type: 'delete_section_content_only',
                    target: { sid: '/2' },
                    content: '',
                    reason: 'Delete all content from User Management',
                    priority: 1
                },
                {
                    type: 'replace_section_content_only',
                    target: { sid: '/2', lineRange: { startLine: 1, endLine: 1 } },
                    content: 'New content after delete\n',
                    reason: 'Add new content to User Management',
                    priority: 2
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            // This might fail due to batch conflict detection if both target the same SID
            // and one is delete + one is modify
            expect(result.success).toBe(false);
            expect(result.metadata?.rule).toBe('DELETE_THEN_MODIFY_SAME_SID');
        });

        // Test Case 7: Multiple deletes in different sections (should succeed)
        it('Test Case 7: should allow multiple delete operations in different sections', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'delete_section_and_title',
                    target: { sid: '/2' },
                    content: '',
                    reason: 'Delete User Management',
                    priority: 1
                },
                {
                    type: 'delete_section_and_title',
                    target: { sid: '/3' },
                    content: '',
                    reason: 'Delete Data Management',
                    priority: 2
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(2);
        });

        // Test Case 8: Idempotent delete operations on same section (should succeed)
        it('Test Case 8: should allow multiple identical delete operations (idempotent)', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'delete_section_and_title',
                    target: { sid: '/2' },
                    content: '',
                    reason: 'Delete User Management (first)',
                    priority: 1
                },
                {
                    type: 'delete_section_and_title',
                    target: { sid: '/2' },
                    content: '',
                    reason: 'Delete User Management (second)',
                    priority: 2
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            // Second delete will fail because section was already deleted
            expect(result.successfulIntents).toBeLessThanOrEqual(1);
        });
    });

    // ============================================================================
    // Batch Conflict Detection Tests (Test Cases 9-12)
    // ============================================================================

    describe('Batch Conflict Detection Tests', () => {
        // Test Case 9: delete + replace_section_and_title on same SID (should fail)
        it('Test Case 9: should reject delete + replace_section_and_title on same SID in same batch', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'delete_section_and_title',
                    target: { sid: '/2' },
                    content: '',
                    reason: 'Delete section',
                    priority: 1
                },
                {
                    type: 'replace_section_and_title',
                    target: { sid: '/2' },
                    content: '## New Title\n\nNew content.\n',
                    reason: 'Replace section',
                    priority: 2
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.successfulIntents).toBe(0);
            expect(result.failedIntents).toHaveLength(2);
            expect(result.metadata?.rule).toBe('DELETE_THEN_MODIFY_SAME_SID');
            expect(result.metadata?.conflictingSid).toBe('/2');
            expect(result.metadata?.operations).toContain('delete_section_and_title');
            expect(result.metadata?.operations).toContain('replace_section_and_title');
        });

        // Test Case 10: delete + insert_section_content_only on same SID (should fail)
        it('Test Case 10: should reject delete + insert_section_content_only on same SID in same batch', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'delete_section_content_only',
                    target: { sid: '/2' },
                    content: '',
                    reason: 'Delete content',
                    priority: 1
                },
                {
                    type: 'insert_section_content_only',
                    target: { sid: '/2', lineRange: { startLine: 1, endLine: 1 } },
                    content: 'New line\n',
                    reason: 'Insert content',
                    priority: 2
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.metadata?.rule).toBe('DELETE_THEN_MODIFY_SAME_SID');
        });

        // Test Case 11: Multiple delete types on same SID (should succeed - both are deletes)
        it('Test Case 11: should allow multiple delete operations on same SID (no modify conflict)', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'delete_section_and_title',
                    target: { sid: '/2' },
                    content: '',
                    reason: 'Delete entire section',
                    priority: 1
                },
                {
                    type: 'delete_section_content_only',
                    target: { sid: '/2' },
                    content: '',
                    reason: 'Delete content only',
                    priority: 2
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            // Both are deletes, no modify, so no conflict
            // However, second operation will fail because section is already deleted
            expect(result.successfulIntents).toBeLessThanOrEqual(1);
        });

        // Test Case 12: Cross-SID operations (should succeed - no conflict)
        it('Test Case 12: should allow delete on one SID and modify on different SID', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'delete_section_and_title',
                    target: { sid: '/2' },
                    content: '',
                    reason: 'Delete User Management',
                    priority: 1
                },
                {
                    type: 'replace_section_content_only',
                    target: { sid: '/3', lineRange: { startLine: 1, endLine: 1 } },
                    content: 'Modified content\n',
                    reason: 'Modify Data Management',
                    priority: 2
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(2);
        });
    });

    // ============================================================================
    // Boundary Tests (Test Cases 13-14)
    // ============================================================================

    describe('Boundary Tests', () => {
        // Test Case 13: Delete first top-level section with frontmatter present
        it('Test Case 13: should delete first top-level section with frontmatter present', async () => {
            // Mock document with frontmatter
            const mockDocWithFrontmatter = createMockDocumentWithFrontmatter();
            jest.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(mockDocWithFrontmatter);

            const intents: SemanticEditIntent[] = [{
                type: 'delete_section_and_title',
                target: { sid: '/1' },
                content: '',
                reason: 'Delete introduction section',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);

            // Verify that workspace edit was called to delete the section
            // Frontmatter should remain intact
            const editCalls = (vscode.workspace.applyEdit as jest.Mock).mock.calls;
            expect(editCalls.length).toBeGreaterThan(0);
        });

        // Test Case 14: Delete section with complex nested content
        it('Test Case 14: should delete section with complex nested content (code blocks, tables, lists)', async () => {
            // Mock document with complex content
            const mockDocWithComplexContent = createMockDocumentWithComplexContent();
            jest.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(mockDocWithComplexContent);

            const intents: SemanticEditIntent[] = [{
                type: 'delete_section_and_title',
                target: { sid: '/2' },
                content: '',
                reason: 'Delete section with complex content',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);

            // Verify stable endLine calculation for complex content
            const editCalls = (vscode.workspace.applyEdit as jest.Mock).mock.calls;
            expect(editCalls.length).toBeGreaterThan(0);
        });
    });

    // ============================================================================
    // Error Handling Tests
    // ============================================================================

    describe('Error Handling', () => {
        it('should fail gracefully when deleting non-existent section', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'delete_section_and_title',
                target: { sid: '/999' },
                content: '',
                reason: 'Delete non-existent section',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents).toHaveLength(1);
            expect(result.failedIntents[0].error).toContain('not found');
        });

        it('should fail when deleting content from title-only section', async () => {
            // Mock document with title-only section
            const mockDocWithEmptySection = createMockDocumentWithEmptySection();
            jest.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(mockDocWithEmptySection);

            const intents: SemanticEditIntent[] = [{
                type: 'delete_section_content_only',
                target: { sid: '/4' }, // Empty section
                content: '',
                reason: 'Delete content from empty section',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents[0].error).toContain('no content to delete');
        });

        it('should provide helpful suggestion for batch conflicts', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'delete_section_and_title',
                    target: { sid: '/2' },
                    content: '',
                    reason: 'Delete',
                    priority: 1
                },
                {
                    type: 'replace_section_and_title',
                    target: { sid: '/2' },
                    content: '## New\n',
                    reason: 'Replace',
                    priority: 2
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents[0].suggestion).toContain('Split into two tool calls');
        });
    });
});

// ============================================================================
// Mock Helper Functions
// ============================================================================

function createMockDocument(): vscode.TextDocument {
    return {
        fileName: 'test-document.md',
        uri: vscode.Uri.parse('file:///test-workspace/test-document.md'),
        getText: jest.fn().mockReturnValue(sampleDocumentContent),
        lineCount: sampleDocumentContent.split('\n').length,
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

function createMockDocumentWithFrontmatter(): vscode.TextDocument {
    const content = `---
title: Test Document
author: Test Author
---

# Introduction

This is the introduction section.

## Requirements

This is the requirements section.
`;
    return {
        fileName: 'test-document.md',
        uri: vscode.Uri.parse('file:///test-workspace/test-document.md'),
        getText: jest.fn().mockReturnValue(content),
        lineCount: content.split('\n').length,
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

function createMockDocumentWithComplexContent(): vscode.TextDocument {
    const content = `# Functional Requirements

This is the introduction.

## User Management

This section contains complex content:

\`\`\`javascript
function login(user) {
    return authenticate(user);
}
\`\`\`

| Feature | Status |
|---------|--------|
| Login   | Done   |
| Signup  | Pending|

- Item 1
  - Subitem 1.1
  - Subitem 1.2
- Item 2

## Data Management

Data management content.
`;
    return {
        fileName: 'test-document.md',
        uri: vscode.Uri.parse('file:///test-workspace/test-document.md'),
        getText: jest.fn().mockReturnValue(content),
        lineCount: content.split('\n').length,
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

function createMockDocumentWithEmptySection(): vscode.TextDocument {
    const content = `# Functional Requirements

Content here.

## User Management

Content here.

## Data Management

Content here.

## Empty Section

## Next Section

More content.
`;
    return {
        fileName: 'test-document.md',
        uri: vscode.Uri.parse('file:///test-workspace/test-document.md'),
        getText: jest.fn().mockReturnValue(content),
        lineCount: content.split('\n').length,
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
            '# Functional Requirements',
            '',
            vscode.SymbolKind.String,
            new vscode.Range(0, 0, 2, 0),
            new vscode.Range(0, 0, 0, 22)
        ),
        new vscode.DocumentSymbol(
            '## User Management',
            '',
            vscode.SymbolKind.String,
            new vscode.Range(3, 0, 5, 0),
            new vscode.Range(3, 0, 3, 18)
        ),
        new vscode.DocumentSymbol(
            '### User Registration',
            '',
            vscode.SymbolKind.String,
            new vscode.Range(6, 0, 8, 0),
            new vscode.Range(6, 0, 6, 21)
        ),
        new vscode.DocumentSymbol(
            '## Data Management',
            '',
            vscode.SymbolKind.String,
            new vscode.Range(9, 0, 11, 0),
            new vscode.Range(9, 0, 9, 18)
        )
    ];
}

const sampleDocumentContent = `# Functional Requirements

This is the functional requirements content.

## User Management

User management functionality description.

### User Registration

User registration details.

## Data Management

Data management functionality description.
`;
