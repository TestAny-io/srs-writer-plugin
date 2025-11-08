/**
 * executeTextFileEdits Unit Tests
 * 
 * Tests core functionality without file system operations
 */

// Mock fs module
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn();

jest.mock('fs', () => ({
    readFileSync: (...args: any[]) => mockReadFileSync(...args),
    writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
    existsSync: (...args: any[]) => mockExistsSync(...args),
    statSync: jest.fn(),      // 🚀 Phase 1.1: Add for BaseDirValidator
    realpathSync: jest.fn()   // 🚀 Phase 1.1: Add for BaseDirValidator
}));

// Mock vscode
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }]
    }
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
    Logger: {
        getInstance: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            error: jest.fn()
        }))
    }
}));

// Mock path resolver
const mockResolveWorkspacePath = jest.fn();
jest.mock('../../utils/path-resolver', () => ({
    resolveWorkspacePath: (...args: any[]) => mockResolveWorkspacePath(...args)
}));

import { executeTextFileEdits, ExecuteTextFileEditsArgs } from '../../tools/document/textFileEditorTools';

describe('executeTextFileEdits Unit Tests', () => {
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup mock implementations for BaseDirValidator
        const fs = require('fs');
        (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
        (fs.realpathSync as jest.Mock).mockImplementation((p: string) => p);
    });

    describe('Basic functionality', () => {
        test('should apply single edit successfully', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = `:root {
  --primary: oklch(0.5555 0 0);
}`;
            const expectedContent = `:root {
  --primary: oklch(0.4200 0.1800 266);
}`;

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Update primary color',
                targetFile: 'style.css',
                edits: [{
                    oldString: '--primary: oklch(0.5555 0 0);',
                    newString: '--primary: oklch(0.4200 0.1800 266);',
                    reason: 'Change to blue'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(true);
            expect(result.appliedEdits).toBe(1);
            expect(result.totalEdits).toBe(1);
            expect(result.details).toHaveLength(1);
            expect(result.details[0].success).toBe(true);
            expect(result.details[0].replacements).toBe(1);
            expect(mockWriteFileSync).toHaveBeenCalledWith(
                mockFilePath,
                expectedContent,
                'utf8'
            );
        });

        test('should apply multiple edits sequentially', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = `:root {
  --primary: oklch(0.5555 0 0);
  --secondary: oklch(0.9700 0 0);
}`;

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Update colors',
                targetFile: 'style.css',
                edits: [
                    {
                        oldString: '--primary: oklch(0.5555 0 0);',
                        newString: '--primary: oklch(0.4200 0.1800 266);',
                        reason: 'Change primary'
                    },
                    {
                        oldString: '--secondary: oklch(0.9700 0 0);',
                        newString: '--secondary: oklch(0.8000 0.1500 260);',
                        reason: 'Change secondary'
                    }
                ]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(true);
            expect(result.appliedEdits).toBe(2);
            expect(result.totalEdits).toBe(2);
            expect(result.details).toHaveLength(2);
            expect(result.details[0].success).toBe(true);
            expect(result.details[1].success).toBe(true);
        });
    });

    describe('Error handling', () => {
        test('should handle file not found error', async () => {
            const mockFilePath = '/test/workspace/nonexistent.css';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(false);

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Try to edit',
                targetFile: 'nonexistent.css',
                edits: [{
                    oldString: 'old',
                    newString: 'new',
                    reason: 'test'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(false);
            expect(result.appliedEdits).toBe(0);
            expect(result.error).toContain('File not found');
            expect(mockWriteFileSync).not.toHaveBeenCalled();
        });

        test('should handle text not found error', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = ':root { --primary: red; }';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Try to replace non-existent text',
                targetFile: 'style.css',
                edits: [{
                    oldString: '--nonexistent: value;',
                    newString: '--new: value;',
                    reason: 'test'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(false);
            expect(result.appliedEdits).toBe(0);
            expect(result.details[0].success).toBe(false);
            expect(result.details[0].error).toContain('Text not found');
            expect(mockWriteFileSync).not.toHaveBeenCalled();
        });

        test('should handle occurrence count mismatch', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = `:root {
  --color: red;
  --color: red;
}`;

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Try with wrong expected count',
                targetFile: 'style.css',
                edits: [{
                    oldString: '--color: red;',
                    newString: '--color: blue;',
                    expectedReplacements: 1,
                    reason: 'test'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(false);
            expect(result.appliedEdits).toBe(0);
            expect(result.details[0].success).toBe(false);
            expect(result.details[0].error).toContain('Expected 1 replacement(s) but found 2');
            expect(mockWriteFileSync).not.toHaveBeenCalled();
        });
    });

    describe('Whitespace handling', () => {
        test('should normalize CRLF to LF', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = ':root {\r\n  --primary: red;\r\n}';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Edit with normalized line endings',
                targetFile: 'style.css',
                edits: [{
                    oldString: '--primary: red;',
                    newString: '--primary: blue;',
                    reason: 'test'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(true);
            expect(result.appliedEdits).toBe(1);
            // Should write with LF
            const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
            expect(writtenContent).not.toContain('\r\n');
            expect(writtenContent).toContain('\n');
        });

        test('should require exact whitespace match', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = ':root {\n  --primary: red;\n}';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Try with different whitespace',
                targetFile: 'style.css',
                edits: [{
                    oldString: '--primary:red;', // No space after colon
                    newString: '--primary:blue;',
                    reason: 'test'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(false);
            expect(result.appliedEdits).toBe(0);
            expect(result.details[0].error).toContain('Text not found');
        });
    });

    describe('Sequential editing', () => {
        test('should apply edits in sequence', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = 'a b c';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Sequential edits',
                targetFile: 'style.css',
                edits: [
                    {
                        oldString: 'a',
                        newString: 'x',
                        reason: 'first'
                    },
                    {
                        oldString: 'b',
                        newString: 'y',
                        reason: 'second'
                    },
                    {
                        oldString: 'c',
                        newString: 'z',
                        reason: 'third'
                    }
                ]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(true);
            expect(result.appliedEdits).toBe(3);
            const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
            expect(writtenContent).toBe('x y z');
        });

        test('should continue on partial failure', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = 'a b c';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Partial failure',
                targetFile: 'style.css',
                edits: [
                    {
                        oldString: 'a',
                        newString: 'x',
                        reason: 'first - success'
                    },
                    {
                        oldString: 'nonexistent',
                        newString: 'y',
                        reason: 'second - fail'
                    },
                    {
                        oldString: 'c',
                        newString: 'z',
                        reason: 'third - success'
                    }
                ]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(true);
            expect(result.appliedEdits).toBe(2);
            expect(result.totalEdits).toBe(3);
            expect(result.details[0].success).toBe(true);
            expect(result.details[1].success).toBe(false);
            expect(result.details[2].success).toBe(true);
        });
    });

    describe('Context-based matching', () => {
        test('should match with context', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = `:root {
  --primary: red;
  --secondary: red;
}`;

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Match with context',
                targetFile: 'style.css',
                edits: [{
                    oldString: '--primary: red;\n  --secondary: red;',
                    newString: '--primary: blue;\n  --secondary: red;',
                    reason: 'Change only primary'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(true);
            const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
            expect(writtenContent).toContain('--primary: blue;');
            expect(writtenContent).toContain('--secondary: red;');
        });
    });

    describe('Expected replacements validation', () => {
        test('should accept correct expectedReplacements', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = ':root { --color: red; --color: red; }';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Replace all',
                targetFile: 'style.css',
                edits: [{
                    oldString: '--color: red;',
                    newString: '--color: blue;',
                    expectedReplacements: 2,
                    reason: 'Replace both'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(true);
            expect(result.appliedEdits).toBe(1);
            expect(result.details[0].replacements).toBe(2);
        });

        test('should default expectedReplacements to 1', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = ':root { --color: red; }';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Default expected',
                targetFile: 'style.css',
                edits: [{
                    oldString: '--color: red;',
                    newString: '--color: blue;',
                    // No expectedReplacements specified
                    reason: 'Replace'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(true);
            expect(result.details[0].replacements).toBe(1);
        });
    });

    describe('Empty oldString handling (Bug fix)', () => {
        test('should insert content into empty file with empty oldString', async () => {
            const mockFilePath = '/test/workspace/new-file.js';
            const originalContent = ''; // Empty file

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const newContent = '// New file content\nconsole.log("Hello");';
            const args: ExecuteTextFileEditsArgs = {
                summary: 'Insert into empty file',
                targetFile: 'new-file.js',
                edits: [{
                    oldString: '',
                    newString: newContent,
                    expectedReplacements: 1,
                    reason: 'Insert content into empty file'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(true);
            expect(result.appliedEdits).toBe(1);
            expect(result.details[0].success).toBe(true);
            expect(mockWriteFileSync).toHaveBeenCalled();
            const writtenContent = mockWriteFileSync.mock.calls[0][1] as string;
            expect(writtenContent).toBe(newContent);
        });

        test('should reject empty oldString with non-empty file', async () => {
            const mockFilePath = '/test/workspace/existing.js';
            const originalContent = 'console.log("Existing content");';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Try to use empty oldString on non-empty file',
                targetFile: 'existing.js',
                edits: [{
                    oldString: '',
                    newString: 'new content',
                    expectedReplacements: 1,
                    reason: 'Invalid operation'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(false);
            expect(result.appliedEdits).toBe(0);
            expect(result.details[0].success).toBe(false);
            expect(result.details[0].error).toContain('Cannot use empty oldString to replace content in non-empty file');
            expect(mockWriteFileSync).not.toHaveBeenCalled();
        });

        test('should reject wrong expectedReplacements for empty file', async () => {
            const mockFilePath = '/test/workspace/empty.js';
            const originalContent = '';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Wrong expectedReplacements',
                targetFile: 'empty.js',
                edits: [{
                    oldString: '',
                    newString: 'content',
                    expectedReplacements: 2, // Wrong! Empty file has only 1 "occurrence"
                    reason: 'Invalid operation'
                }]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(false);
            expect(result.appliedEdits).toBe(0);
            expect(result.details[0].success).toBe(false);
            expect(result.details[0].error).toContain('Expected 2 replacement(s) but found 1 occurrence(s) in empty file');
            expect(mockWriteFileSync).not.toHaveBeenCalled();
        });
    });

    describe('Top-level error message formatting (Issue #4)', () => {
        test('should provide detailed error message when all edits fail', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = ':root { --primary: red; }';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Multiple failing edits',
                targetFile: 'style.css',
                edits: [
                    {
                        oldString: '',
                        newString: 'new content',
                        reason: 'Try empty oldString'
                    },
                    {
                        oldString: 'nonexistent text',
                        newString: 'replacement',
                        reason: 'Try non-existent text'
                    }
                ]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(false);
            expect(result.appliedEdits).toBe(0);
            expect(result.totalEdits).toBe(2);

            // Verify top-level error message exists and contains key information
            expect(result.error).toBeDefined();
            expect(result.error).toContain('2/2 edit(s) failed');
            expect(result.error).toContain('style.css');
            expect(result.error).toContain('Edit 1');
            expect(result.error).toContain('Edit 2');
            expect(result.error).toContain('Try empty oldString');
            expect(result.error).toContain('Try non-existent text');
            expect(result.error).toContain('Suggestion');
            expect(result.error).toContain('readFile');
        });

        test('should provide detailed error message for partial failures', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = 'a b c';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'Partial failure scenario',
                targetFile: 'style.css',
                edits: [
                    {
                        oldString: 'a',
                        newString: 'x',
                        reason: 'Success edit'
                    },
                    {
                        oldString: 'nonexistent',
                        newString: 'y',
                        reason: 'Failed edit'
                    }
                ]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(true); // Still success because one edit succeeded
            expect(result.appliedEdits).toBe(1);
            expect(result.totalEdits).toBe(2);

            // Verify top-level error message for the failed edit
            expect(result.error).toBeDefined();
            expect(result.error).toContain('1/2 edit(s) failed');
            expect(result.error).toContain('Edit 2');
            expect(result.error).toContain('Failed edit');
            expect(result.error).toContain('Text not found');
            // Should NOT contain suggestion since not all edits failed
            expect(result.error).not.toContain('Suggestion');
        });

        test('should not have error field when all edits succeed', async () => {
            const mockFilePath = '/test/workspace/style.css';
            const originalContent = 'a b c';

            mockResolveWorkspacePath.mockResolvedValue(mockFilePath);
            mockExistsSync.mockReturnValue(true);
            mockReadFileSync.mockReturnValue(originalContent);
            mockWriteFileSync.mockImplementation(() => {});

            const args: ExecuteTextFileEditsArgs = {
                summary: 'All success',
                targetFile: 'style.css',
                edits: [
                    {
                        oldString: 'a',
                        newString: 'x',
                        reason: 'First'
                    },
                    {
                        oldString: 'b',
                        newString: 'y',
                        reason: 'Second'
                    }
                ]
            };

            const result = await executeTextFileEdits(args);

            expect(result.success).toBe(true);
            expect(result.appliedEdits).toBe(2);
            expect(result.totalEdits).toBe(2);
            expect(result.error).toBeUndefined();
        });
    });
});