/**
 * ContentMatcher - Content-based positioning for Markdown edits
 * 
 * Provides robust content matching as an alternative to fragile line numbers.
 * Supports multi-line matching, context disambiguation, and enhanced error messages.
 * 
 * @module ContentMatcher
 * @version 1.0.0
 */

import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Match position information
 */
export interface MatchPosition {
    startIndex: number;      // Start index in content
    endIndex: number;        // End index in content
    lineNumber: number;      // Line number (1-based)
}

/**
 * Match details for error reporting
 */
export interface MatchDetails {
    position: MatchPosition;
    context: string;         // Surrounding context
    extendedContext: string; // Full lines for context
}

/**
 * Content match parameters
 */
export interface ContentMatchParams {
    matchContent: string;
    contextBefore?: string;
    contextAfter?: string;
}

/**
 * Error details for not found
 */
export interface NotFoundError {
    error: string;
    suggestion: string;
    sectionPreview: string;
    hint?: string;
    sectionInfo: {
        totalLines: number;
        sectionTitle: string;
        firstLine: string;
        lastLine: string;
    };
}

/**
 * Error details for multiple matches
 */
export interface MultipleMatchesError {
    error: string;
    matchCount: number;
    matchPreviews: Array<{
        lineNumber: number;
        startIndex: number;
        context: string;
        extendedContext: string;
    }>;
    suggestion: string;
    suggestedContexts?: Array<{
        forMatch: number;
        contextBefore: string;
        contextAfter: string;
        confidence: number;
    }>;
}

// ============================================================================
// ContentMatcher Class
// ============================================================================

/**
 * ContentMatcher - Robust content-based positioning
 * 
 * Design principles:
 * - Performance: Direct index comparison, minimal substring creation
 * - Robustness: Multi-line support, context disambiguation
 * - Debuggability: Enhanced error messages with hints
 */
export class ContentMatcher {
    /**
     * Find target content with optional context for disambiguation
     * 
     * Performance optimizations:
     * - Uses String.indexOf() for efficient matching (supports multi-line)
     * - Direct index comparison instead of substring creation
     * - Early exit when unique match found
     * 
     * @param sectionContent - Content of the section to search in
     * @param matchContent - Content to match (supports multi-line)
     * @param contextBefore - Optional context before match for disambiguation
     * @param contextAfter - Optional context after match for disambiguation
     * @returns Match position or null if no unique match found
     */
    findTarget(
        sectionContent: string,
        matchContent: string,
        contextBefore?: string,
        contextAfter?: string
    ): MatchPosition | null {
        logger.debug(`[ContentMatcher] Finding target: matchContent length=${matchContent.length}, hasContextBefore=${!!contextBefore}, hasContextAfter=${!!contextAfter}`);
        
        // Step 1: Find all exact matches of matchContent (supports multi-line)
        const allMatches = this.findAllExactMatches(sectionContent, matchContent);
        
        if (allMatches.length === 0) {
            logger.warn(`[ContentMatcher] No matches found for matchContent`);
            return null;
        }
        
        logger.debug(`[ContentMatcher] Found ${allMatches.length} initial match(es)`);
        
        // Step 2: Filter by contextBefore if provided
        // 🚀 Performance: Direct index comparison, minimal slice
        let candidates = allMatches;
        if (contextBefore) {
            candidates = candidates.filter(match => {
                const contextStartIndex = Math.max(0, match.startIndex - contextBefore.length - 20);
                const precedingText = sectionContent.slice(contextStartIndex, match.startIndex);
                const hasContext = precedingText.includes(contextBefore);
                logger.debug(`[ContentMatcher] Match at ${match.startIndex}: contextBefore check = ${hasContext}`);
                return hasContext;
            });
            
            logger.debug(`[ContentMatcher] After contextBefore filter: ${candidates.length} candidate(s)`);
        }
        
        // Step 3: Filter by contextAfter if provided
        // 🚀 Performance: Direct index comparison
        if (contextAfter) {
            candidates = candidates.filter(match => {
                const contextEndIndex = Math.min(sectionContent.length, match.endIndex + contextAfter.length + 20);
                const followingText = sectionContent.slice(match.endIndex, contextEndIndex);
                const hasContext = followingText.includes(contextAfter);
                logger.debug(`[ContentMatcher] Match at ${match.startIndex}: contextAfter check = ${hasContext}`);
                return hasContext;
            });
            
            logger.debug(`[ContentMatcher] After contextAfter filter: ${candidates.length} candidate(s)`);
        }
        
        // Step 4: Validate exactly one match remains
        if (candidates.length !== 1) {
            logger.warn(`[ContentMatcher] Expected 1 unique match, found ${candidates.length}`);
            return null;
        }
        
        // Step 5: Calculate line number and return position
        const match = candidates[0];
        const lineNumber = this.calculateLineNumber(sectionContent, match.startIndex);
        
        logger.info(`[ContentMatcher] ✅ Unique match found at line ${lineNumber}, index ${match.startIndex}`);
        
        return {
            startIndex: match.startIndex,
            endIndex: match.endIndex,
            lineNumber
        };
    }
    
    /**
     * Find all exact matches (supports multi-line content)
     * 
     * Implementation note: Uses String.indexOf() which naturally handles
     * multi-line content by treating newlines (\n) as regular characters.
     * 
     * @param content - Content to search in
     * @param matchContent - Content to match (can contain newlines)
     * @returns Array of match positions
     */
    private findAllExactMatches(
        content: string,
        matchContent: string
    ): Array<{ startIndex: number; endIndex: number }> {
        const matches: Array<{ startIndex: number; endIndex: number }> = [];
        let searchIndex = 0;
        
        while (searchIndex < content.length) {
            const foundIndex = content.indexOf(matchContent, searchIndex);
            if (foundIndex === -1) break;
            
            matches.push({
                startIndex: foundIndex,
                endIndex: foundIndex + matchContent.length
            });
            
            // Continue searching for duplicates (start from next character)
            searchIndex = foundIndex + 1;
        }
        
        return matches;
    }
    
    /**
     * Calculate line number from character index
     * 
     * @param content - Full content
     * @param index - Character index
     * @returns Line number (1-based)
     */
    private calculateLineNumber(content: string, index: number): number {
        const precedingContent = content.substring(0, index);
        const lineNumber = (precedingContent.match(/\n/g) || []).length + 1;
        return lineNumber;
    }
    
    /**
     * Get match details for error reporting
     * 
     * @param content - Section content
     * @param match - Match position
     * @param contextLength - Length of context to extract
     * @returns Match details with context
     */
    getMatchDetails(
        content: string,
        match: { startIndex: number; endIndex: number },
        contextLength: number = 50
    ): MatchDetails {
        const lines = content.split('\n');
        const lineNumber = this.calculateLineNumber(content, match.startIndex);
        
        // Extract surrounding context
        const contextStart = Math.max(0, match.startIndex - contextLength);
        const contextEnd = Math.min(content.length, match.endIndex + contextLength);
        const context = content.substring(contextStart, contextEnd);
        
        // Extract full lines for extended context
        const matchLineStart = lineNumber - 1;
        const matchLineEnd = lineNumber + 1;
        const extendedContext = lines.slice(
            Math.max(0, matchLineStart - 1),
            Math.min(lines.length, matchLineEnd + 2)
        ).join('\n');
        
        return {
            position: {
                startIndex: match.startIndex,
                endIndex: match.endIndex,
                lineNumber
            },
            context: `...${context}...`,
            extendedContext
        };
    }
    
    /**
     * Generate enhanced "not found" error
     * 
     * Includes fuzzy matching hints to help debug why match failed.
     * 
     * @param sectionContent - Section content that was searched
     * @param matchContent - Content that wasn't found
     * @param sectionTitle - Title of the section (for context)
     * @returns Enhanced error details
     */
    generateNotFoundError(
        sectionContent: string,
        matchContent: string,
        sectionTitle: string
    ): NotFoundError {
        const lines = sectionContent.split('\n');
        
        // Find closest match using fuzzy similarity
        const { closestLine, closestLineNumber, similarity } = this.findClosestMatch(
            sectionContent,
            matchContent
        );
        
        let hint: string | undefined;
        if (similarity > 0.5) {
            hint = `Tip: Did you mean content near line ${closestLineNumber}? The closest match is: "${closestLine.substring(0, 50)}..."`;
        }
        
        return {
            error: "Match content not found in section",
            suggestion: "Verify matchContent matches exactly (including whitespace and newlines)",
            sectionPreview: sectionContent.substring(0, 300) + (sectionContent.length > 300 ? '...' : ''),
            hint,
            sectionInfo: {
                totalLines: lines.length,
                sectionTitle,
                firstLine: lines[0] || '',
                lastLine: lines[lines.length - 1] || ''
            }
        };
    }
    
    /**
     * Generate enhanced "multiple matches" error
     * 
     * Includes smart context suggestions to help disambiguate.
     * 
     * @param content - Section content
     * @param matches - All matches found
     * @returns Enhanced error details
     */
    generateMultipleMatchesError(
        content: string,
        matches: Array<{ startIndex: number; endIndex: number }>
    ): MultipleMatchesError {
        const matchPreviews = matches.map(match => {
            const details = this.getMatchDetails(content, match, 30);
            return {
                lineNumber: details.position.lineNumber,
                startIndex: match.startIndex,
                context: details.context,
                extendedContext: details.extendedContext
            };
        });
        
        // Generate smart context suggestions for first match
        const suggestedContexts = this.generateContextSuggestions(content, matches[0]);
        
        return {
            error: "Match content found at multiple locations",
            matchCount: matches.length,
            matchPreviews,
            suggestion: "Add contextBefore or contextAfter to disambiguate. Suggested contexts:",
            suggestedContexts
        };
    }
    
    /**
     * Find closest match using simple similarity metric
     * 
     * @param content - Content to search in
     * @param target - Target content to match
     * @returns Closest line, line number, and similarity score
     */
    private findClosestMatch(
        content: string,
        target: string
    ): { closestLine: string; closestLineNumber: number; similarity: number } {
        const lines = content.split('\n');
        let maxSimilarity = 0;
        let closestLine = '';
        let closestLineNumber = 1;
        
        lines.forEach((line, index) => {
            const similarity = this.calculateSimilarity(line, target);
            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                closestLine = line;
                closestLineNumber = index + 1;
            }
        });
        
        return { closestLine, closestLineNumber, similarity: maxSimilarity };
    }
    
    /**
     * Calculate simple similarity score between two strings
     * 
     * @param str1 - First string
     * @param str2 - Second string
     * @returns Similarity score (0-1)
     */
    private calculateSimilarity(str1: string, str2: string): number {
        // Simple Jaccard similarity on character bigrams
        const getBigrams = (str: string): Set<string> => {
            const bigrams = new Set<string>();
            for (let i = 0; i < str.length - 1; i++) {
                bigrams.add(str.substring(i, i + 2));
            }
            return bigrams;
        };
        
        const bigrams1 = getBigrams(str1);
        const bigrams2 = getBigrams(str2);
        
        const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
        const union = new Set([...bigrams1, ...bigrams2]);
        
        return union.size === 0 ? 0 : intersection.size / union.size;
    }
    
    /**
     * Generate smart context suggestions
     * 
     * Analyzes surrounding content to suggest optimal contextBefore/After.
     * 
     * @param content - Section content
     * @param match - Match position
     * @returns Suggested contexts with confidence scores
     */
    private generateContextSuggestions(
        content: string,
        match: { startIndex: number; endIndex: number }
    ): Array<{ forMatch: number; contextBefore: string; contextAfter: string; confidence: number }> {
        const suggestions: Array<{ forMatch: number; contextBefore: string; contextAfter: string; confidence: number }> = [];
        
        // Extract preceding line
        const beforeStart = Math.max(0, match.startIndex - 200);
        const precedingText = content.substring(beforeStart, match.startIndex);
        const precedingLines = precedingText.split('\n');
        const contextBefore = precedingLines[precedingLines.length - 2] || precedingLines[precedingLines.length - 1];
        
        // Extract following line
        const afterEnd = Math.min(content.length, match.endIndex + 200);
        const followingText = content.substring(match.endIndex, afterEnd);
        const followingLines = followingText.split('\n');
        const contextAfter = followingLines[1] || followingLines[0];
        
        if (contextBefore && contextAfter) {
            suggestions.push({
                forMatch: 1,
                contextBefore: contextBefore.trim().substring(0, 50),
                contextAfter: contextAfter.trim().substring(0, 50),
                confidence: 0.95
            });
        }
        
        return suggestions;
    }
}

// ============================================================================
// Exports
// ============================================================================

export default ContentMatcher;

