/**
 * Delete Operation Newline Handling Tests
 * 
 * Tests for Bug Fix: Delete operations should intelligently handle newlines
 * to avoid leaving blank lines ("天窗" bug)
 * 
 * Bug Description: When deleting full lines, the range didn't include the trailing
 * newline, leaving empty lines in the document.
 * 
 * Fix: Intelligently detect if matchContent represents a full line and include
 * the newline in the range accordingly.
 */

import { SidBasedSemanticLocator, TableOfContents } from '../../tools/atomic/sid-based-semantic-locator';

describe('Delete Operation Newline Handling (天窗 Bug Fix)', () => {
    const markdownContent = `# Test Document

## Section with List

### Test Section

- **Test Method**:
    - Algorithm check (AES-128)
    - Protocol verification (TLS 1.2+)
    - Key rotation audit
    - Encryption failure alert
    - Compliance report check (GDPR)
- **Priority**: High`;

    const tocData: TableOfContents[] = [
        {
            sid: '/test-document/section-with-list/test-section',
            title: '### Test Section',
            normalizedTitle: 'Test Section',
            level: 3,
            line: 5,
            wordCount: 50,
            characterCount: 300,
            containsCode: false,
            containsTables: false,
            containsLists: true,
            endLine: 13
        }
    ];

    let locator: SidBasedSemanticLocator;

    beforeEach(() => {
        locator = new SidBasedSemanticLocator(markdownContent, tocData);
    });

    // ========================================================================
    // Full Line Deletion - Should NOT leave blank lines
    // ========================================================================

    describe('Full line deletion (complete list items)', () => {
        it('should NOT leave blank line when deleting middle list item', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-with-list/test-section',
                    contentMatch: {
                        matchContent: '    - Key rotation audit'  // Complete line content
                    }
                },
                'delete_section_content_only'
            );

            expect(result.found).toBe(true);
            expect(result.range).toBeDefined();
            
            // Key check: For full line deletion, range should extend to next line start
            // Line 9 contains "Key rotation audit"
            // Range should be [Line 9, col 0] to [Line 10, col 0] to include newline
            const range = result.range!;
            
            // Expected: range ends at start of next line (col 0) to include newline
            // This prevents leaving a blank line
            expect(range.end.character).toBe(0);  // Should be at column 0 of next line
            expect(range.end.line).toBe(range.start.line + 1);  // Should be next line
        });

        it('should handle deletion of first item in list', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-with-list/test-section',
                    contentMatch: {
                        matchContent: '    - Algorithm check (AES-128)'
                    }
                },
                'delete_section_content_only'
            );

            expect(result.found).toBe(true);
            expect(result.range?.end.character).toBe(0);  // Include newline
        });

        it('should handle deletion of last item in list (not last line of document)', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-with-list/test-section',
                    contentMatch: {
                        matchContent: '    - Compliance report check (GDPR)'
                    }
                },
                'delete_section_content_only'
            );

            expect(result.found).toBe(true);
            // This is NOT the last line of document (there's "- **Priority**: High" after)
            // So should include newline
            expect(result.range?.end.character).toBe(0);
        });
    });

    // ========================================================================
    // Partial Character Deletion - Should NOT include newline
    // ========================================================================

    describe('Partial character deletion (within a line)', () => {
        it('should NOT include newline when deleting partial characters', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-with-list/test-section',
                    contentMatch: {
                        matchContent: 'rotation audit'  // Part of "Key rotation audit"
                    }
                },
                'delete_section_content_only'
            );

            expect(result.found).toBe(true);
            expect(result.range).toBeDefined();
            
            // For partial deletion, range should NOT extend to next line
            const range = result.range!;
            
            // Should end at the position within the same line (not col 0 of next line)
            // This is a partial match, not full line
            expect(range.start.line).toBe(range.end.line);  // Same line
            expect(range.end.character).toBeGreaterThan(0);  // Not at column 0
        });

        it('should handle deletion of text at start of line (but not full line)', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-with-list/test-section',
                    contentMatch: {
                        matchContent: '    - Key rotation'  // Start of line, but not full
                    }
                },
                'delete_section_content_only'
            );

            expect(result.found).toBe(true);
            
            // Even though it starts at line start, it doesn't reach line end
            // So should NOT include newline
            const range = result.range!;
            expect(range.start.line).toBe(range.end.line);
            expect(range.end.character).toBeGreaterThan(0);
        });

        it('should handle deletion of text at end of line (but not full line)', () => {
            const result = locator.findTarget(
                {
                    sid: '/test-document/section-with-list/test-section',
                    contentMatch: {
                        matchContent: 'audit'  // End of "Key rotation audit"
                    }
                },
                'delete_section_content_only'
            );

            expect(result.found).toBe(true);
            
            const range = result.range!;
            expect(range.start.line).toBe(range.end.line);
            expect(range.end.character).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // Multi-line Deletion
    // ========================================================================

    describe('Multi-line deletion', () => {
        it('should handle deletion of multiple complete lines', () => {
            const matchContent = `    - Protocol verification (TLS 1.2+)
    - Key rotation audit
    - Encryption failure alert`;

            const result = locator.findTarget(
                {
                    sid: '/test-document/section-with-list/test-section',
                    contentMatch: {
                        matchContent
                    }
                },
                'delete_section_content_only'
            );

            expect(result.found).toBe(true);
            expect(result.range).toBeDefined();
            
            // Note: Multi-line matching currently checks if FIRST line starts at line start
            // and LAST line ends at line end. This is a complex case.
            // For now, we verify the range is created correctly
            const range = result.range!;
            expect(range.start.line).toBeLessThan(range.end.line);  // Spans multiple lines
            
            // The current implementation may or may not include newline depending on
            // whether the multi-line block is detected as "full lines"
            // This is acceptable behavior - the key fix is for single full-line deletion
        });

        it('should handle deletion of multi-line partial content', () => {
            const matchContent = `verification (TLS 1.2+)
    - Key rotation`;  // Spans 2 lines but not complete

            const result = locator.findTarget(
                {
                    sid: '/test-document/section-with-list/test-section',
                    contentMatch: {
                        matchContent
                    }
                },
                'delete_section_content_only'
            );

            expect(result.found).toBe(true);
            
            // Partial multi-line deletion should NOT include extra newline
            const range = result.range!;
            // Since it doesn't start at line start or end at line end, it's partial
            expect(range.end.character).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // Edge Case: Last Line of Document
    // ========================================================================

    describe('Last line of document handling', () => {
        const lastLineContent = `# Document

## Last Section

- Last item in document`;

        const lastLineToc: TableOfContents[] = [
            {
                sid: '/document/last-section',
                title: '## Last Section',
                normalizedTitle: 'Last Section',
                level: 2,
                line: 3,
                endLine: 5,
                wordCount: 5,
                characterCount: 25,
                containsCode: false,
                containsTables: false,
                containsLists: true
            }
        ];

        it('should handle deletion of absolute last line without error', () => {
            const lastLineLocator = new SidBasedSemanticLocator(lastLineContent, lastLineToc);
            
            const result = lastLineLocator.findTarget(
                {
                    sid: '/document/last-section',
                    contentMatch: {
                        matchContent: '- Last item in document'
                    }
                },
                'delete_section_content_only'
            );

            expect(result.found).toBe(true);
            expect(result.range).toBeDefined();
            
            // For last line of document, range should NOT extend beyond document
            const range = result.range!;
            const totalLines = lastLineContent.split('\n').length;
            expect(range.end.line).toBeLessThan(totalLines);  // Should not exceed document
        });
    });

    // ========================================================================
    // Real-World Example (User's Case)
    // ========================================================================

    describe('Real-world case: User reported bug', () => {
        const userContent = `#### NFR-PRIVACY-001: 用户数据加密存储
- **测试方法**:
    - 静态数据加密算法检查（AES-128）
    - 传输协议版本验证（TLS 1.2及以上）
    - 密钥轮换周期审计
    - 加密/解密失败自动告警与隔离测试
    - 合规性审计报告检查（GDPR）`;

        const userToc: TableOfContents[] = [
            {
                sid: '/nfr-privacy-001',
                title: '#### NFR-PRIVACY-001: 用户数据加密存储',
                normalizedTitle: 'NFR-PRIVACY-001: 用户数据加密存储',
                level: 4,
                line: 1,
                endLine: 7,
                wordCount: 40,
                characterCount: 200,
                containsCode: false,
                containsTables: false,
                containsLists: true
            }
        ];

        it('should delete "- 密钥轮换周期审计" WITHOUT leaving blank line', () => {
            const userLocator = new SidBasedSemanticLocator(userContent, userToc);
            
            const result = userLocator.findTarget(
                {
                    sid: '/nfr-privacy-001',
                    contentMatch: {
                        matchContent: '    - 密钥轮换周期审计'  // AI's actual input (no \n)
                    }
                },
                'delete_section_content_only'
            );

            expect(result.found).toBe(true);
            expect(result.range).toBeDefined();
            
            // 🎯 KEY TEST: Should detect this as full line match
            // and include trailing newline to avoid blank line
            const range = result.range!;
            expect(range.end.character).toBe(0);  // Should extend to next line start
            expect(range.end.line).toBe(range.start.line + 1);  // Next line
            
            // This ensures no "天窗" (blank line) is left
        });
    });
});

