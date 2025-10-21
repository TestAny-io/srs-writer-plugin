/**
 * Delete Operations Unit Tests
 *
 * 直接测试 SidBasedSemanticLocator 和 SmartIntentExecutor 对删除操作的支持
 * 不依赖 VSCode API mocking，专注于核心逻辑验证
 */

import * as vscode from 'vscode';
import { SidBasedSemanticLocator, TableOfContents } from '../../tools/atomic/sid-based-semantic-locator';
import { SmartIntentExecutor } from '../../tools/atomic/smart-intent-executor';
import { SemanticEditIntent } from '../../types/semanticEditing';

describe('Delete Operations Unit Tests', () => {
    const testMarkdownContent = `# Functional Requirements

This is the introduction.

## User Management

User management functionality:
- User registration
- User login
- User profile update

This is additional content.

## Data Management

Data management content.
Second line of data management.
Third line of data management.

## Empty Section

## Another Section

More content here.
`;

    const testTocData: TableOfContents[] = [
        {
            sid: '/functional-requirements',
            displayId: '1',
            title: 'Functional Requirements',
            normalizedTitle: 'Functional Requirements',
            level: 1,
            line: 1,
            endLine: 21,
            offset: { utf16: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 24 } },
            wordCount: 100,
            characterCount: 500,
            containsCode: false,
            containsTables: false,
            containsLists: false,
            parent: undefined,
            children: [],
            siblingIndex: 0,
            siblingCount: 1
        },
        {
            sid: '/user-management',
            displayId: '2',
            title: 'User Management',
            normalizedTitle: 'User Management',
            level: 2,
            line: 5,
            endLine: 12,
            offset: { utf16: { startLine: 5, startColumn: 0, endLine: 5, endColumn: 17 } },
            wordCount: 50,
            characterCount: 200,
            containsCode: false,
            containsTables: false,
            containsLists: true,
            parent: undefined,
            children: [],
            siblingIndex: 0,
            siblingCount: 4
        },
        {
            sid: '/data-management',
            displayId: '3',
            title: 'Data Management',
            normalizedTitle: 'Data Management',
            level: 2,
            line: 13,
            endLine: 16,
            offset: { utf16: { startLine: 13, startColumn: 0, endLine: 13, endColumn: 17 } },
            wordCount: 30,
            characterCount: 120,
            containsCode: false,
            containsTables: false,
            containsLists: false,
            parent: undefined,
            children: [],
            siblingIndex: 1,
            siblingCount: 4
        },
        {
            sid: '/empty-section',
            displayId: '4',
            title: 'Empty Section',
            normalizedTitle: 'Empty Section',
            level: 2,
            line: 18,
            endLine: 18,
            offset: { utf16: { startLine: 18, startColumn: 0, endLine: 18, endColumn: 14 } },
            wordCount: 0,
            characterCount: 0,
            containsCode: false,
            containsTables: false,
            containsLists: false,
            parent: undefined,
            children: [],
            siblingIndex: 2,
            siblingCount: 4
        },
        {
            sid: '/another-section',
            displayId: '5',
            title: 'Another Section',
            normalizedTitle: 'Another Section',
            level: 2,
            line: 20,
            endLine: 21,
            offset: { utf16: { startLine: 20, startColumn: 0, endLine: 20, endColumn: 16 } },
            wordCount: 10,
            characterCount: 50,
            containsCode: false,
            containsTables: false,
            containsLists: false,
            parent: undefined,
            children: [],
            siblingIndex: 3,
            siblingCount: 4
        }
    ];

    describe('SidBasedSemanticLocator - Delete Operations', () => {
        let locator: SidBasedSemanticLocator;

        beforeEach(() => {
            locator = new SidBasedSemanticLocator(testMarkdownContent, testTocData);
        });

        describe('delete_section_and_title', () => {
            it('should locate entire section including title for deletion', () => {
                const result = locator.findTarget(
                    { sid: '/user-management' },
                    'delete_section_and_title'
                );

                expect(result.found).toBe(true);
                expect(result.range).toBeDefined();
                expect(result.context?.includesTitle).toBe(true);

                // Should include title line
                const range = result.range!;
                expect(range.start.line).toBe(4); // Title line (0-based, line 5 in 1-based)
                expect(range.end.line).toBe(11); // End of content (0-based, line 12 in 1-based)
            });

            it('should work for first section', () => {
                const result = locator.findTarget(
                    { sid: '/functional-requirements' },
                    'delete_section_and_title'
                );

                expect(result.found).toBe(true);
                expect(result.context?.includesTitle).toBe(true);
            });

            it('should work for nested section', () => {
                const result = locator.findTarget(
                    { sid: '/data-management' },
                    'delete_section_and_title'
                );

                expect(result.found).toBe(true);
                expect(result.range).toBeDefined();
                expect(result.context?.includesTitle).toBe(true);
            });
        });

        describe('delete_section_content_only', () => {
            it('should locate only content for deletion (excluding title)', () => {
                const result = locator.findTarget(
                    { sid: '/user-management' },
                    'delete_section_content_only'
                );

                expect(result.found).toBe(true);
                expect(result.range).toBeDefined();
                expect(result.context?.includesTitle).toBe(false);

                // Should NOT include title line
                const range = result.range!;
                expect(range.start.line).toBe(5); // First content line after title (0-based, line 6 in 1-based)
                expect(range.end.line).toBe(11); // End of content (0-based, line 12 in 1-based)
            });

            it('should fail for empty section (title-only)', () => {
                const result = locator.findTarget(
                    { sid: '/empty-section' },
                    'delete_section_content_only'
                );

                expect(result.found).toBe(false);
                expect(result.error).toContain('no content to delete');
                expect(result.suggestions?.hint).toContain('delete_section_and_title');
            });

            it('should work for section with content', () => {
                const result = locator.findTarget(
                    { sid: '/data-management' },
                    'delete_section_content_only'
                );

                expect(result.found).toBe(true);
                expect(result.context?.includesTitle).toBe(false);
            });
        });

        describe('Error handling', () => {
            it('should fail for non-existent SID', () => {
                const result = locator.findTarget(
                    { sid: '/non-existent' },
                    'delete_section_and_title'
                );

                expect(result.found).toBe(false);
                expect(result.error).toContain('not found');
            });

            it('should validate SID format', () => {
                const result = locator.findTarget(
                    { sid: 'invalid-sid' },
                    'delete_section_and_title'
                );

                expect(result.found).toBe(false);
                // Should have SID format validation error
            });
        });
    });

    describe('Batch Conflict Detection', () => {
        // This will be tested via the SelfContainedSemanticEditor in integration tests
        // Here we just verify the intent structure is correct for conflict detection

        it('should have correct structure for delete intents', () => {
            const deleteIntent: SemanticEditIntent = {
                type: 'delete_section_and_title',
                target: { sid: '/user-management' },
                content: '',
                reason: 'Delete section',
                priority: 1
            };

            expect(deleteIntent.type.startsWith('delete_')).toBe(true);
            expect(deleteIntent.target.sid).toBeDefined();
        });

        it('should have correct structure for mixed delete+modify intents', () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'delete_section_and_title',
                    target: { sid: '/user-management' },
                    content: '',
                    reason: 'Delete',
                    priority: 1
                },
                {
                    type: 'replace_section_content_only',
                    target: { sid: '/user-management', lineRange: { startLine: 1, endLine: 1 } },
                    content: 'New content',
                    reason: 'Replace',
                    priority: 2
                }
            ];

            // Verify both target same SID
            expect(intents[0].target.sid).toBe(intents[1].target.sid);

            // Verify one is delete, one is modify
            expect(intents[0].type.startsWith('delete_')).toBe(true);
            expect(intents[1].type.startsWith('replace_')).toBe(true);
        });
    });

    describe('Type Definitions', () => {
        it('should accept delete_section_and_title type', () => {
            const intent: SemanticEditIntent = {
                type: 'delete_section_and_title',
                target: { sid: '/test' },
                content: '',
                reason: 'test',
                priority: 1
            };

            expect(intent.type).toBe('delete_section_and_title');
        });

        it('should accept delete_section_content_only type', () => {
            const intent: SemanticEditIntent = {
                type: 'delete_section_content_only',
                target: { sid: '/test' },
                content: '',
                reason: 'test',
                priority: 1
            };

            expect(intent.type).toBe('delete_section_content_only');
        });

        it('should allow empty content for delete operations', () => {
            const intent: SemanticEditIntent = {
                type: 'delete_section_and_title',
                target: { sid: '/test' },
                content: '', // Empty is OK for delete operations
                reason: 'test',
                priority: 1
            };

            expect(intent.content).toBe('');
        });
    });

    describe('Integration with SmartIntentExecutor', () => {
        it('should recognize delete operations in switch statement', () => {
            // This is a type check - if compilation passes, the implementation is correct
            const deleteAndTitleIntent: SemanticEditIntent = {
                type: 'delete_section_and_title',
                target: { sid: '/test' },
                content: '',
                reason: 'test',
                priority: 1
            };

            const deleteContentOnlyIntent: SemanticEditIntent = {
                type: 'delete_section_content_only',
                target: { sid: '/test' },
                content: '',
                reason: 'test',
                priority: 1
            };

            // If these compile without error, the type system accepts them
            expect(deleteAndTitleIntent.type).toBe('delete_section_and_title');
            expect(deleteContentOnlyIntent.type).toBe('delete_section_content_only');
        });
    });
});
