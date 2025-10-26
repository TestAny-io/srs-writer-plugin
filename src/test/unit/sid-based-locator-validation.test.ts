/**
 * SidBasedSemanticLocator Validation Tests
 * 
 * Tests for Bug Fix: replace_section_content_only should error when no positioning info provided
 * 
 * Bug Description: Previously, replace_section_content_only with only sid would silently
 * call replaceEntireSection(), incorrectly including the title line.
 * 
 * Fix: Added explicit validation to require contentMatch or lineRange for *_content_only operations
 */

import { SidBasedSemanticLocator, TableOfContents } from '../../tools/atomic/sid-based-semantic-locator';

describe('SidBasedSemanticLocator - Validation Tests (Bug Fix)', () => {
    const markdownContent = `# Test Document

## Section 1

### FR-001: Test Requirement

- **Description**:
    - Feature A
    - Feature B
    - Feature C

## Section 2

### FR-002: Another Requirement

- **Description**:
    - Feature X
    - Feature Y`;

    const tocData: TableOfContents[] = [
        {
            sid: '/test-document',
            title: '# Test Document',
            normalizedTitle: 'Test Document',
            level: 1,
            line: 1,
            wordCount: 0,
            characterCount: 0,
            containsCode: false,
            containsTables: false,
            containsLists: false
        },
        {
            sid: '/test-document/section-1',
            title: '## Section 1',
            normalizedTitle: 'Section 1',
            level: 2,
            line: 3,
            parent: '/test-document',
            wordCount: 0,
            characterCount: 0,
            containsCode: false,
            containsTables: false,
            containsLists: false
        },
        {
            sid: '/test-document/section-1/fr-001-test-requirement',
            title: '### FR-001: Test Requirement',
            normalizedTitle: 'FR-001: Test Requirement',
            level: 3,
            line: 5,
            parent: '/test-document/section-1',
            wordCount: 15,
            characterCount: 80,
            containsCode: false,
            containsTables: false,
            containsLists: true,
            endLine: 11
        }
    ];

    let locator: SidBasedSemanticLocator;

    beforeEach(() => {
        locator = new SidBasedSemanticLocator(markdownContent, tocData);
    });

    // ========================================================================
    // BUG FIX: replace_section_content_only validation
    // ========================================================================

    describe('Bug Fix: replace_section_content_only requires positioning info', () => {
        it('should ERROR when only sid provided (no contentMatch, no lineRange)', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-1/fr-001-test-requirement'
                    // ❌ No contentMatch
                    // ❌ No lineRange
                },
                'replace_section_content_only'
            );

            expect(result.found).toBe(false);
            expect(result.error).toContain('requires positioning information');
            expect(result.error).toContain('contentMatch');
            expect(result.error).toContain('lineRange');
            expect(result.suggestions?.hint).toBeTruthy();
        });

        it('should work with contentMatch provided', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-1/fr-001-test-requirement',
                    contentMatch: {
                        matchContent: '    - Feature B'
                    }
                },
                'replace_section_content_only'
            );

            expect(result.found).toBe(true);
            expect(result.operationType).toBe('replace');
        });

        it('should work with lineRange provided', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-1/fr-001-test-requirement',
                    lineRange: {
                        startLine: 2,
                        endLine: 2
                    }
                },
                'replace_section_content_only'
            );

            expect(result.found).toBe(true);
            expect(result.operationType).toBe('replace');
        });
    });

    // ========================================================================
    // BUG FIX: insert_section_content_only validation
    // ========================================================================

    describe('Bug Fix: insert_section_content_only requires positioning info', () => {
        it('should ERROR when only sid provided (no contentMatch, no lineRange)', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-1/fr-001-test-requirement'
                    // ❌ No contentMatch
                    // ❌ No lineRange
                },
                'insert_section_content_only'
            );

            expect(result.found).toBe(false);
            expect(result.error).toContain('requires positioning information');
            expect(result.error).toContain('contentMatch');
            expect(result.error).toContain('lineRange');
        });

        it('should work with contentMatch provided', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-1/fr-001-test-requirement',
                    contentMatch: {
                        matchContent: '    - Feature B',
                        position: 'after'
                    }
                },
                'insert_section_content_only'
            );

            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
        });
    });

    // ========================================================================
    // Regression Test: replace_section_and_title still works with only sid
    // ========================================================================

    describe('Regression: replace_section_and_title with only sid', () => {
        it('should work with only sid (no positioning info needed)', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-1/fr-001-test-requirement'
                    // No contentMatch, no lineRange - this is OK for replace_section_and_title
                },
                'replace_section_and_title'
            );

            expect(result.found).toBe(true);
            expect(result.operationType).toBe('replace');
            expect(result.context?.includesTitle).toBe(true);
        });
    });

    // ========================================================================
    // Error Message Quality
    // ========================================================================

    describe('Error message quality', () => {
        it('should provide helpful example in error message', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-1/fr-001-test-requirement'
                },
                'replace_section_content_only'
            );

            expect(result.suggestions?.example).toBeTruthy();
            expect(result.suggestions?.example).toContain('contentMatch');
            expect(result.suggestions?.example).toContain('matchContent');
        });

        it('should provide section summary for debugging', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-1/fr-001-test-requirement'
                },
                'replace_section_content_only'
            );

            expect(result.suggestions?.sectionSummary).toBeTruthy();
            expect(result.suggestions?.sectionSummary?.title).toContain('FR-001');
            expect(result.suggestions?.sectionSummary?.totalContentLines).toBeGreaterThan(0);
            expect(result.suggestions?.sectionSummary?.sectionPreview).toBeTruthy();
        });
    });
});

