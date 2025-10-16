/**
 * Text File Editor Tools
 * 
 * Provides precise text file editing capabilities using exact string matching.
 * Based on SuperDesign's edit-tool design pattern.
 * 
 * Key features:
 * - Exact string matching (including whitespace and newlines)
 * - Pre-validation before execution (safe failure)
 * - Expected replacements validation
 * - Supports CSS, HTML, JS, and other text files
 */

import * as fs from 'fs';
import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';
import { resolveWorkspacePath } from '../../utils/path-resolver';

const logger = Logger.getInstance();

// ============================================================================
// Type Definitions
// ============================================================================

export interface TextFileEditIntent {
    oldString: string;
    newString: string;
    expectedReplacements?: number;
    reason: string;
}

export interface ExecuteTextFileEditsArgs {
    summary: string;
    targetFile: string;
    edits: TextFileEditIntent[];
}

export interface ExecuteTextFileEditsResult {
    success: boolean;
    appliedEdits: number;
    totalEdits: number;
    details: Array<{
        editIndex: number;
        success: boolean;
        replacements?: number;
        error?: string;
    }>;
    error?: string;
}

interface CalculatedEdit {
    currentContent: string;
    newContent: string;
    occurrences: number;
    error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape special regex characters for exact string matching
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculate edit operation without executing it (pre-validation)
 */
function calculateEdit(
    currentContent: string,
    oldString: string,
    newString: string,
    expectedReplacements: number
): CalculatedEdit {
    // Normalize line endings to LF
    const normalizedContent = currentContent.replace(/\r\n/g, '\n');
    
    // Count occurrences using exact string matching
    const regex = new RegExp(escapeRegExp(oldString), 'g');
    const matches = normalizedContent.match(regex);
    const occurrences = matches ? matches.length : 0;
    
    // Validate occurrence count
    if (occurrences === 0) {
        return {
            currentContent: normalizedContent,
            newContent: normalizedContent,
            occurrences: 0,
            error: `Text not found in file. 0 occurrences of oldString found. Ensure exact text match including whitespace and indentation.`
        };
    }
    
    if (occurrences !== expectedReplacements) {
        return {
            currentContent: normalizedContent,
            newContent: normalizedContent,
            occurrences,
            error: `Expected ${expectedReplacements} replacement(s) but found ${occurrences} occurrence(s). Please provide more context to ensure unique matching.`
        };
    }
    
    // Apply replacement
    const newContent = normalizedContent.split(oldString).join(newString);
    
    return {
        currentContent: normalizedContent,
        newContent,
        occurrences
    };
}

// ============================================================================
// Tool Definition
// ============================================================================

export const executeTextFileEditsToolDefinition = {
    name: "executeTextFileEdits",
    description: `Execute precise text file editing operations using exact string matching. Suitable for CSS, HTML, JS, and other text files.
    
Key features:
- Exact string matching (whitespace and newlines must match exactly)
- Pre-validation before execution (safe failure if no match)
- Multiple edits in sequence
- Recommend including 3+ lines of context for unique matching

Important notes:
- Minor whitespace/indentation differences do not affect CSS/HTML syntax
- If matching fails, file remains unchanged (safe)
- Each edit is applied sequentially to the result of the previous edit`,
    parameters: {
        type: "object",
        properties: {
            summary: {
                type: "string",
                description: "Brief summary of what these edits will accomplish"
            },
            targetFile: {
                type: "string",
                description: "Target file path relative to project baseDir (or workspace root if no project is active). Do not include project name in path. Example: 'styles.css' not 'projectName/styles.css'"
            },
            edits: {
                type: "array",
                description: "Array of edit operations to execute sequentially",
                items: {
                    type: "object",
                    properties: {
                        oldString: {
                            type: "string",
                            description: "Exact text to find and replace. Must match exactly including whitespace, indentation, and newlines. Recommend including 3+ lines of context before and after the target text."
                        },
                        newString: {
                            type: "string",
                            description: "Text to replace oldString with. Should maintain proper indentation and formatting."
                        },
                        expectedReplacements: {
                            type: "number",
                            description: "Number of replacements expected (default: 1). Use to verify correct matching.",
                            default: 1
                        },
                        reason: {
                            type: "string",
                            description: "Explanation for this edit operation"
                        }
                    },
                    required: ["oldString", "newString", "reason"]
                }
            }
        },
        required: ["summary", "targetFile", "edits"]
    },
    accessibleBy: [
        "prototype_designer"  // v3.0: Individual-level access control
    ],
    layer: "document",
    category: "text-editing",
    interactionType: 'autonomous',
    riskLevel: 'medium',
    requiresConfirmation: false
};

// ============================================================================
// Tool Implementation
// ============================================================================

/**
 * Execute text file edits
 * 
 * Uses the same path resolution strategy as executeMarkdownEdits and executeYAMLEdits:
 * - Attempts to resolve path using SessionManager's baseDir
 * - Falls back to workspace root if baseDir is not available
 */
export async function executeTextFileEdits(args: ExecuteTextFileEditsArgs): Promise<ExecuteTextFileEditsResult> {
    logger.info(`Text file editing: ${args.targetFile} with ${args.edits.length} edit(s)`);
    logger.info(`Summary: ${args.summary}`);
    
    const startTime = Date.now();
    
    try {
        // Resolve file path using the same strategy as executeMarkdownEdits
        const resolvedPath = await resolveWorkspacePath(args.targetFile, {
            contextName: 'Text file'
        });
        
        logger.debug(`File path resolved: ${args.targetFile} -> ${resolvedPath}`);
        
        // Check if file exists
        if (!fs.existsSync(resolvedPath)) {
            return {
                success: false,
                appliedEdits: 0,
                totalEdits: args.edits.length,
                details: [],
                error: `File not found: ${args.targetFile}. Use writeFile to create new files.`
            };
        }
        
        // Read current file content
        let currentContent = fs.readFileSync(resolvedPath, 'utf8');
        logger.debug(`File read: ${currentContent.length} characters, ${currentContent.split('\n').length} lines`);
        
        const details: Array<{
            editIndex: number;
            success: boolean;
            replacements?: number;
            error?: string;
        }> = [];
        
        let appliedCount = 0;
        
        // Execute edits sequentially
        for (let i = 0; i < args.edits.length; i++) {
            const edit = args.edits[i];
            const expectedReplacements = edit.expectedReplacements || 1;
            
            logger.info(`Executing edit ${i + 1}/${args.edits.length}: ${edit.reason}`);
            
            // Calculate edit (pre-validation)
            const editResult = calculateEdit(
                currentContent,
                edit.oldString,
                edit.newString,
                expectedReplacements
            );
            
            if (editResult.error) {
                // Edit failed - record error but continue with next edit
                logger.warn(`Edit ${i + 1} failed: ${editResult.error}`);
                details.push({
                    editIndex: i + 1,
                    success: false,
                    error: editResult.error
                });
            } else {
                // Edit succeeded - apply to current content
                currentContent = editResult.newContent;
                appliedCount++;
                
                logger.info(`Edit ${i + 1} applied: ${editResult.occurrences} replacement(s)`);
                details.push({
                    editIndex: i + 1,
                    success: true,
                    replacements: editResult.occurrences
                });
            }
        }
        
        // Write updated content back to file
        if (appliedCount > 0) {
            fs.writeFileSync(resolvedPath, currentContent, 'utf8');
            logger.info(`File updated: ${appliedCount}/${args.edits.length} edits applied`);
        } else {
            logger.warn(`No edits applied - file unchanged`);
        }
        
        const duration = Date.now() - startTime;
        logger.info(`Text file editing completed in ${duration}ms`);
        
        return {
            success: appliedCount > 0,
            appliedEdits: appliedCount,
            totalEdits: args.edits.length,
            details
        };
        
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Text file editing failed after ${duration}ms:`, error as Error);
        
        return {
            success: false,
            appliedEdits: 0,
            totalEdits: args.edits.length,
            details: [],
            error: `Text file editing failed: ${(error as Error).message}`
        };
    }
}

// ============================================================================
// Exports
// ============================================================================

export const textFileEditorToolDefinitions = [
    executeTextFileEditsToolDefinition
];

export const textFileEditorToolImplementations = {
    executeTextFileEdits
};

export const textFileEditorToolsCategory = {
    name: 'Text File Editor',
    description: 'Text file editing tools for CSS, HTML, JS and other text files',
    tools: textFileEditorToolDefinitions.map(tool => tool.name),
    layer: 'document'
};
