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
    existsSync: (...args: any[]) => mockExistsSync(...args)
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
});