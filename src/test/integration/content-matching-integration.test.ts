/**
 * Content Matching Integration Tests
 * 
 * Tests the complete content matching flow through executeMarkdownEdits
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { executeSemanticEdits } from '../../tools/document/semantic-edit-engine';
import { SemanticEditIntent } from '../../types/semanticEditing';

describe('Content Matching Integration Tests', () => {
    let testFileUri: vscode.Uri;
    let testFilePath: string;
    
    beforeEach(async () => {
        // Create a temporary test file
        const tmpDir = os.tmpdir();
        testFilePath = path.join(tmpDir, `test-content-matching-${Date.now()}.md`);
        
        const initialContent = `# Test Document

## FR-001: Ingredient Recognition

- **Description**:
    - System supports photo-based input
    - Recognition accuracy >= 90%
    - AI results can be corrected
    - Results saved to database

- **Source Story**: [US-001]

## FR-002: Recipe Management

- **Description**:
    - Users can create recipes
    - Recipes stored in cloud
    - Offline mode supported

- **Priority**: High`;
        
        fs.writeFileSync(testFilePath, initialContent, 'utf-8');
        testFileUri = vscode.Uri.file(testFilePath);
    });
    
    afterEach(() => {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });
    
    // ========================================================================
    // Replace Operations with Content Matching
    // ========================================================================
    
    describe('replace_section_content_only with contentMatch', () => {
        it('should replace single line using content matching', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_section_content_only',
                target: {
                    sid: '/fr-001-ingredient-recognition',
                    contentMatch: {
                        matchContent: '    - Recognition accuracy >= 90%'
                    }
                },
                content: '    - Recognition accuracy >= 95%',
                reason: 'Update accuracy requirement',
                priority: 1
            }];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);
            expect(result.failedIntents).toHaveLength(0);
            
            // Verify file content
            const updatedContent = fs.readFileSync(testFilePath, 'utf-8');
            expect(updatedContent).toContain('Recognition accuracy >= 95%');
            expect(updatedContent).not.toContain('Recognition accuracy >= 90%');
        });
        
        it('should replace multi-line content', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_section_content_only',
                target: {
                    sid: '/fr-001-ingredient-recognition',
                    contentMatch: {
                        matchContent: `    - Recognition accuracy >= 90%
    - AI results can be corrected`
                    }
                },
                content: `    - Recognition accuracy >= 95%
    - AI results must be verified by user`,
                reason: 'Update requirements',
                priority: 1
            }];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);
            
            // Verify file content
            const updatedContent = fs.readFileSync(testFilePath, 'utf-8');
            expect(updatedContent).toContain('Recognition accuracy >= 95%');
            expect(updatedContent).toContain('must be verified by user');
            expect(updatedContent).not.toContain('can be corrected');
        });
        
        it('should use context disambiguation for duplicate content', async () => {
            // First, add duplicate content
            const contentWithDuplicates = `# Test Document

## FR-001: Ingredient Recognition

- **Part A**:
    - Common feature
    - Details A

- **Part B**:
    - Common feature
    - Details B`;
            
            fs.writeFileSync(testFilePath, contentWithDuplicates, 'utf-8');
            
            const intents: SemanticEditIntent[] = [{
                type: 'replace_section_content_only',
                target: {
                    sid: '/fr-001-ingredient-recognition',
                    contentMatch: {
                        matchContent: '    - Common feature',
                        contextBefore: '- **Part B**:',
                        contextAfter: '    - Details B'
                    }
                },
                content: '    - Updated feature in Part B',
                reason: 'Update Part B only',
                priority: 1
            }];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(true);
            
            // Verify only Part B was updated
            const updatedContent = fs.readFileSync(testFilePath, 'utf-8');
            const lines = updatedContent.split('\n');
            
            // Part A should still have "Common feature"
            expect(updatedContent).toContain('- **Part A**:\n    - Common feature');
            
            // Part B should have "Updated feature"
            expect(updatedContent).toContain('- **Part B**:\n    - Updated feature in Part B');
        });
    });
    
    // ========================================================================
    // Insert Operations with Content Matching
    // ========================================================================
    
    describe('insert_section_content_only with contentMatch', () => {
        it('should insert after matched content', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_section_content_only',
                target: {
                    sid: '/fr-001-ingredient-recognition',
                    contentMatch: {
                        matchContent: '    - System supports photo-based input',
                        position: 'after'
                    }
                },
                content: '    - Voice input also supported',
                reason: 'Add voice input feature',
                priority: 1
            }];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);
            
            // Verify insertion
            const updatedContent = fs.readFileSync(testFilePath, 'utf-8');
            expect(updatedContent).toContain('Voice input also supported');
            
            // Verify order: voice input should come after photo input
            const photoIndex = updatedContent.indexOf('photo-based input');
            const voiceIndex = updatedContent.indexOf('Voice input');
            expect(voiceIndex).toBeGreaterThan(photoIndex);
        });
        
        it('should insert before matched content', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_section_content_only',
                target: {
                    sid: '/fr-001-ingredient-recognition',
                    contentMatch: {
                        matchContent: '    - Results saved to database',
                        position: 'before'
                    }
                },
                content: '    - Results validated before saving',
                reason: 'Add validation step',
                priority: 1
            }];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(true);
            
            // Verify insertion
            const updatedContent = fs.readFileSync(testFilePath, 'utf-8');
            expect(updatedContent).toContain('Results validated before saving');
            
            // Verify order: validation should come before database
            const validationIndex = updatedContent.indexOf('validated before saving');
            const databaseIndex = updatedContent.indexOf('saved to database');
            expect(validationIndex).toBeLessThan(databaseIndex);
        });
    });
    
    // ========================================================================
    // Delete Operations with Content Matching (BREAKING CHANGE)
    // ========================================================================
    
    describe('delete_section_content_only with contentMatch (BREAKING CHANGE)', () => {
        it('should delete specific matched content', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'delete_section_content_only',
                target: {
                    sid: '/fr-001-ingredient-recognition',
                    contentMatch: {
                        matchContent: '    - AI results can be corrected'
                    }
                },
                content: '',  // Ignored for delete operations
                reason: 'Remove outdated requirement',
                priority: 1
            }];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);
            
            // Verify deletion
            const updatedContent = fs.readFileSync(testFilePath, 'utf-8');
            expect(updatedContent).not.toContain('AI results can be corrected');
            
            // Verify other content still exists
            expect(updatedContent).toContain('System supports photo-based input');
            expect(updatedContent).toContain('Recognition accuracy >= 90%');
            expect(updatedContent).toContain('Results saved to database');
        });
        
        it('should fail if contentMatch not provided (BREAKING CHANGE)', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'delete_section_content_only',
                target: {
                    sid: '/fr-001-ingredient-recognition'
                    // No contentMatch provided
                },
                content: '',
                reason: 'Try to delete without contentMatch',
                priority: 1
            }];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(false);
            expect(result.failedIntents).toHaveLength(1);
            expect(result.failedIntents[0].error).toContain('BREAKING CHANGE');
            expect(result.failedIntents[0].error).toContain('contentMatch');
        });
    });
    
    // ========================================================================
    // Backward Compatibility (Line Numbers)
    // ========================================================================
    
    describe('Backward compatibility with line numbers', () => {
        it('should still support lineRange positioning', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_section_content_only',
                target: {
                    sid: '/fr-001-ingredient-recognition',
                    lineRange: {
                        startLine: 2,
                        endLine: 2
                    }
                },
                content: '    - Updated via line numbers',
                reason: 'Test backward compatibility',
                priority: 1
            }];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);
        });
    });
    
    // ========================================================================
    // Error Handling
    // ========================================================================
    
    describe('Error handling', () => {
        it('should provide helpful error when match not found', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_section_content_only',
                target: {
                    sid: '/fr-001-ingredient-recognition',
                    contentMatch: {
                        matchContent: '    - This content does not exist'
                    }
                },
                content: '    - Replacement',
                reason: 'Test not found error',
                priority: 1
            }];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(false);
            expect(result.failedIntents).toHaveLength(1);
            expect(result.failedIntents[0].error).toContain('not found');
        });
        
        it('should provide helpful error when multiple matches found', async () => {
            // Create content with duplicates
            const duplicateContent = `# Test Document

## FR-001: Test

- **Description**:
    - Duplicate line
    - Other content
    - Duplicate line
    - More content
    - Duplicate line`;
            
            fs.writeFileSync(testFilePath, duplicateContent, 'utf-8');
            
            const intents: SemanticEditIntent[] = [{
                type: 'replace_section_content_only',
                target: {
                    sid: '/fr-001-test',
                    contentMatch: {
                        matchContent: '    - Duplicate line'
                        // No context provided
                    }
                },
                content: '    - Updated line',
                reason: 'Test multiple matches error',
                priority: 1
            }];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(false);
            expect(result.failedIntents).toHaveLength(1);
            // Note: Current implementation may not detect multiple matches yet
            // This test documents expected behavior
        });
    });
    
    // ========================================================================
    // Mixed Scenarios (Content Match + Line Numbers)
    // ========================================================================
    
    describe('Mixed positioning methods', () => {
        it('should handle some intents with contentMatch and some with lineRange', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_section_content_only',
                    target: {
                        sid: '/fr-001-ingredient-recognition',
                        contentMatch: {
                            matchContent: '    - System supports photo-based input'
                        }
                    },
                    content: '    - System supports multiple input methods',
                    reason: 'Update via content matching',
                    priority: 1
                },
                {
                    type: 'replace_section_content_only',
                    target: {
                        sid: '/fr-002-recipe-management',
                        lineRange: {
                            startLine: 1,
                            endLine: 1
                        }
                    },
                    content: '    - Users can create and share recipes',
                    reason: 'Update via line numbers',
                    priority: 2
                }
            ];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(2);
            expect(result.failedIntents).toHaveLength(0);
        });
    });
    
    // ========================================================================
    // Real-World Scenario: "Move" Operation
    // ========================================================================
    
    describe('Real-world: Move operation using AI-native workflow', () => {
        it('should simulate moving content by read → reorganize → replace', async () => {
            // This test documents the AI-native workflow for "moving" content
            // Step 1: Read would be done via readMarkdownFile (not tested here)
            
            // Step 2: AI reorganizes in memory (simulated)
            const originalContent = fs.readFileSync(testFilePath, 'utf-8');
            const lines = originalContent.split('\n');
            
            // Find and move "Recognition accuracy" to end of list
            const targetLineIndex = lines.findIndex(line => line.includes('Recognition accuracy'));
            const targetLine = lines.splice(targetLineIndex, 1)[0];
            const databaseLineIndex = lines.findIndex(line => line.includes('Results saved to database'));
            lines.splice(databaseLineIndex + 1, 0, targetLine);
            
            const reorganizedContent = lines.join('\n');
            
            // Step 3: Replace entire section
            // Extract just the FR-001 section content for this test
            const sectionStart = reorganizedContent.indexOf('## FR-001');
            const sectionEnd = reorganizedContent.indexOf('## FR-002');
            const fr001Content = reorganizedContent.substring(sectionStart, sectionEnd).trim();
            
            const intents: SemanticEditIntent[] = [{
                type: 'replace_section_and_title',
                target: {
                    sid: '/fr-001-ingredient-recognition'
                },
                content: fr001Content,
                reason: 'Reorder requirements: move accuracy to end',
                priority: 1
            }];
            
            const result = await executeSemanticEdits(intents, testFileUri);
            
            expect(result.success).toBe(true);
            
            // Verify accuracy requirement moved to after database line
            const finalContent = fs.readFileSync(testFilePath, 'utf-8');
            const accuracyIndex = finalContent.indexOf('Recognition accuracy');
            const databaseIndex = finalContent.indexOf('Results saved to database');
            expect(accuracyIndex).toBeGreaterThan(databaseIndex);
        });
    });
});

