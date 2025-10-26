/**
 * ContentMatcher Unit Tests
 * 
 * Comprehensive tests for content-based positioning functionality
 * Covers: single-line, multi-line, context disambiguation, edge cases, errors
 */

import { ContentMatcher } from '../../tools/document/ContentMatcher';

describe('ContentMatcher', () => {
    let matcher: ContentMatcher;
    
    beforeEach(() => {
        matcher = new ContentMatcher();
    });
    
    // ========================================================================
    // Basic Single-Line Matching
    // ========================================================================
    
    describe('Single-line content matching', () => {
        // Note: No leading newline in template literal
        const sectionContent = [
            '#### FR-001: Requirements',
            '- **Description**:',
            '    - System supports photo-based input',
            '    - Recognition accuracy >= 90%',
            '    - AI results can be corrected',
            '- **Source Story**: [US-001]'
        ].join('\n');
        
        it('should find exact single-line match', () => {
            const result = matcher.findTarget(
                sectionContent,
                '    - System supports photo-based input'
            );
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(3);
            expect(result!.startIndex).toBeGreaterThan(0);
            expect(result!.endIndex).toBeGreaterThan(result!.startIndex);
        });
        
        it('should return null if content not found', () => {
            const result = matcher.findTarget(
                sectionContent,
                '    - This content does not exist'
            );
            
            expect(result).toBeNull();
        });
        
        it('should match content with exact whitespace', () => {
            const result = matcher.findTarget(
                sectionContent,
                '    - System supports photo-based input'  // 4 spaces indentation
            );
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(3);  // This line has 4-space indentation
        });
        
        it('should NOT match if whitespace differs', () => {
            // Create controlled test content with explicit line structure
            const testContent = [
                '#### Test Section',
                '- Parent item:',
                '    - Child with 4 spaces indentation',
                '    - Another child with 4 spaces'
            ].join('\n');
            
            // Should find exact match with 4 spaces
            const result4Spaces = matcher.findTarget(testContent, '    - Child with 4 spaces indentation');
            expect(result4Spaces).not.toBeNull();
            expect(result4Spaces!.lineNumber).toBe(3);
            
            // Should NOT match with 2 spaces (different indentation) - content simply doesn't exist
            const result2Spaces = matcher.findTarget(testContent, '  - Child with 4 spaces indentation');
            expect(result2Spaces).toBeNull();
            
            // Should NOT match with 6 spaces
            const result6Spaces = matcher.findTarget(testContent, '      - Child with 4 spaces indentation');
            expect(result6Spaces).toBeNull();
        });
    });
    
    // ========================================================================
    // Multi-Line Matching (Architect Feedback #1)
    // ========================================================================
    
    describe('Multi-line content matching', () => {
        const sectionContent = `#### FR-002: Advanced Features
- **Description**:
    - System supports photo-based input
    - Recognition accuracy >= 90%
    - AI results can be corrected
    - Results saved to database
- **Priority**: High
- **Status**: In Progress`;
        
        it('should match 2-line content block', () => {
            const matchContent = `    - System supports photo-based input
    - Recognition accuracy >= 90%`;
            
            const result = matcher.findTarget(sectionContent, matchContent);
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(3);
        });
        
        it('should match 3-line content block', () => {
            const matchContent = `    - Recognition accuracy >= 90%
    - AI results can be corrected
    - Results saved to database`;
            
            const result = matcher.findTarget(sectionContent, matchContent);
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(4);
        });
        
        it('should match content with varying indentation levels', () => {
            const content = `- Level 1
    - Level 2
        - Level 3
    - Back to Level 2
- Back to Level 1`;
            
            const matchContent = `    - Level 2
        - Level 3
    - Back to Level 2`;
            
            const result = matcher.findTarget(content, matchContent);
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(2);
        });
        
        it('should match content with empty lines in between', () => {
            const content = `- First item

- Second item (with empty line above)

- Third item`;
            
            const matchContent = `- Second item (with empty line above)

- Third item`;
            
            const result = matcher.findTarget(content, matchContent);
            
            expect(result).not.toBeNull();
        });
        
        it('should handle 5-line content block', () => {
            const matchContent = `- **Description**:
    - System supports photo-based input
    - Recognition accuracy >= 90%
    - AI results can be corrected
    - Results saved to database`;
            
            const result = matcher.findTarget(sectionContent, matchContent);
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(2);
        });
    });
    
    // ========================================================================
    // Context Disambiguation
    // ========================================================================
    
    describe('Context disambiguation', () => {
        const sectionContent = `#### FR-003: Duplicate Content
- **Part A**:
    - Common requirement text
    - More details A
- **Part B**:
    - Common requirement text
    - More details B
- **Part C**:
    - Common requirement text
    - More details C`;
        
        it('should disambiguate with contextBefore', () => {
            const result = matcher.findTarget(
                sectionContent,
                '    - Common requirement text',
                '- **Part B**:'  // contextBefore
            );
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(6);  // Second occurrence
        });
        
        it('should disambiguate with contextAfter', () => {
            const result = matcher.findTarget(
                sectionContent,
                '    - Common requirement text',
                undefined,
                '    - More details C'  // contextAfter
            );
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(9);  // Third occurrence
        });
        
        it('should disambiguate with both contexts', () => {
            const result = matcher.findTarget(
                sectionContent,
                '    - Common requirement text',
                '- **Part A**:',         // contextBefore
                '    - More details A'   // contextAfter
            );
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(3);  // First occurrence
        });
        
        it('should return null if context does not match', () => {
            const result = matcher.findTarget(
                sectionContent,
                '    - Common requirement text',
                '- **Nonexistent Part**:'  // contextBefore doesn't exist
            );
            
            expect(result).toBeNull();
        });
    });
    
    // ========================================================================
    // Edge Cases
    // ========================================================================
    
    describe('Edge cases', () => {
        it('should match content at section start', () => {
            const content = `#### Title
- First line
- Second line`;
            
            const result = matcher.findTarget(content, '- First line');
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(2);
        });
        
        it('should match content at section end', () => {
            const content = `#### Title
- First line
- Second line
- Last line`;
            
            const result = matcher.findTarget(content, '- Last line');
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(4);
        });
        
        it('should handle special characters in content', () => {
            const content = `- Feature with special chars: [ID-001]
- Pattern: /api/v1/users/{id}
- Formula: accuracy >= 90%`;
            
            const result = matcher.findTarget(content, '- Pattern: /api/v1/users/{id}');
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(2);
        });
        
        it('should handle content with tabs vs spaces consistently', () => {
            const content = `- Item with spaces
    - Indented with 4 spaces
- Another item`;
            
            // Exact match required
            const result1 = matcher.findTarget(content, '    - Indented with 4 spaces');
            expect(result1).not.toBeNull();
            
            // Different whitespace should not match
            const result2 = matcher.findTarget(content, '\t- Indented with 4 spaces');
            expect(result2).toBeNull();
        });
        
        it('should match content spanning multiple paragraphs', () => {
            const content = `Paragraph 1 line 1
Paragraph 1 line 2

Paragraph 2 line 1
Paragraph 2 line 2`;
            
            const matchContent = `Paragraph 1 line 2

Paragraph 2 line 1`;
            
            const result = matcher.findTarget(content, matchContent);
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(2);
        });
    });
    
    // ========================================================================
    // Error Cases
    // ========================================================================
    
    describe('Error handling', () => {
        const sectionContent = `#### FR-004: Error Test
- Requirement 1
- Requirement 2
- Requirement 3`;
        
        it('should generate helpful error for not found', () => {
            const error = matcher.generateNotFoundError(
                sectionContent,
                '- Nonexistent requirement',
                '#### FR-004: Error Test'
            );
            
            expect(error.error).toContain('not found');
            expect(error.suggestion).toContain('exactly');
            expect(error.sectionPreview).toBeTruthy();
            expect(error.sectionInfo.totalLines).toBeGreaterThan(0);
            expect(error.sectionInfo.sectionTitle).toBe('#### FR-004: Error Test');
        });
        
        it('should include hint for similar content', () => {
            const error = matcher.generateNotFoundError(
                sectionContent,
                '- Requirement 4',  // Similar to "Requirement 1/2/3"
                '#### FR-004: Error Test'
            );
            
            expect(error.hint).toBeTruthy();
            expect(error.hint).toContain('near line');
        });
        
        it('should generate error for multiple matches', () => {
            const duplicateContent = `- Duplicate item
- Different item
- Duplicate item
- Another different item
- Duplicate item`;
            
            // Find all occurrences of "Duplicate item"
            const matches = [
                { startIndex: 0, endIndex: 15 },
                { startIndex: 32, endIndex: 47 },
                { startIndex: 72, endIndex: 87 }
            ];
            
            const error = matcher.generateMultipleMatchesError(duplicateContent, matches);
            
            expect(error.error).toContain('multiple locations');
            expect(error.matchCount).toBe(3);
            expect(error.matchPreviews).toHaveLength(3);
            expect(error.suggestion).toContain('contextBefore');
            expect(error.suggestedContexts).toBeTruthy();
        });
    });
    
    // ========================================================================
    // Performance Tests (Architect Feedback #2)
    // ========================================================================
    
    describe('Performance optimization', () => {
        it('should handle large sections efficiently', () => {
            // Generate a large section (>1000 lines)
            const lines: string[] = [];
            for (let i = 1; i <= 1000; i++) {
                lines.push(`- Line ${i}`);
            }
            lines.push('- TARGET LINE TO FIND');
            for (let i = 1001; i <= 2000; i++) {
                lines.push(`- Line ${i}`);
            }
            
            const largeContent = lines.join('\n');
            
            const startTime = Date.now();
            const result = matcher.findTarget(largeContent, '- TARGET LINE TO FIND');
            const duration = Date.now() - startTime;
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(1001);
            expect(duration).toBeLessThan(100);  // Should complete in <100ms
        });
        
        it('should handle context filtering efficiently', () => {
            // Generate content with pattern where item 5 appears multiple times
            // but we can uniquely identify one occurrence with context
            const lines: string[] = [];
            lines.push('- Unique prefix for item 4');
            lines.push('- Target item 5');
            lines.push('- Unique suffix for item 6');
            
            for (let i = 1; i <= 500; i++) {
                lines.push(`- Common item ${i % 10}`);
            }
            
            const content = lines.join('\n');
            
            const startTime = Date.now();
            const result = matcher.findTarget(
                content,
                '- Target item 5',
                '- Unique prefix for item 4',  // contextBefore
                '- Unique suffix for item 6'   // contextAfter
            );
            const duration = Date.now() - startTime;
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(2);
            expect(duration).toBeLessThan(50);  // Context filtering should be fast
        });
    });
    
    // ========================================================================
    // Integration with Different Operation Types
    // ========================================================================
    
    describe('Integration scenarios', () => {
        const sectionContent = `#### FR-005: Integration Test
- **Description**:
    - Feature A description
    - Feature B description
    - Feature C description
- **Acceptance Criteria**:
    - [ ] Criterion 1
    - [ ] Criterion 2`;
        
        it('should support replace operation scenario', () => {
            // Find content to replace
            const result = matcher.findTarget(
                sectionContent,
                '    - Feature B description'
            );
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(4);
            
            // Verify we can extract the matched content
            const lines = sectionContent.split('\n');
            const matchedLine = lines[result!.lineNumber - 1];
            expect(matchedLine).toBe('    - Feature B description');
        });
        
        it('should support insert after operation scenario', () => {
            // Find content to insert after
            const result = matcher.findTarget(
                sectionContent,
                '    - Feature B description'
            );
            
            expect(result).not.toBeNull();
            
            // For insert after, we'd use lineNumber + 1
            const insertLineNumber = result!.lineNumber + 1;
            expect(insertLineNumber).toBe(5);  // Should insert after line 4
        });
        
        it('should support delete operation scenario', () => {
            // Find content to delete
            const result = matcher.findTarget(
                sectionContent,
                '    - [ ] Criterion 2',
                '    - [ ] Criterion 1'  // contextBefore for precision
            );
            
            expect(result).not.toBeNull();
            expect(result!.lineNumber).toBe(8);
        });
    });
    
    // ========================================================================
    // Character-Level Accuracy
    // ========================================================================
    
    describe('Character-level accuracy', () => {
        it('should return correct start and end indices', () => {
            const content = 'First line\nSecond line\nThird line';
            const result = matcher.findTarget(content, 'Second line');
            
            expect(result).not.toBeNull();
            expect(result!.startIndex).toBe(11);  // After "First line\n"
            expect(result!.endIndex).toBe(22);    // "Second line" is 11 chars
        });
        
        it('should handle multi-line indices correctly', () => {
            const content = 'Line 1\nLine 2\nLine 3\nLine 4';
            const matchContent = 'Line 2\nLine 3';
            
            const result = matcher.findTarget(content, matchContent);
            
            expect(result).not.toBeNull();
            expect(result!.startIndex).toBe(7);   // After "Line 1\n"
            expect(result!.endIndex).toBe(20);    // "Line 2\nLine 3" is 13 chars
        });
    });
});

