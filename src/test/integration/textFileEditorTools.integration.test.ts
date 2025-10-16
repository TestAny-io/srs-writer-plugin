/**
 * executeTextFileEdits Integration Tests
 * 
 * Tests integration with file system and path resolution
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { executeTextFileEdits } from '../../tools/document/textFileEditorTools';

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

// Note: SessionManager is handled by resolveWorkspacePath internally
// We don't need to mock it for these tests

describe('executeTextFileEdits Integration', () => {
    let tempDir: string;
    let testFile: string;

    beforeEach(() => {
        // Create temp directory for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-edit-test-'));
        testFile = path.join(tempDir, 'test.css');
    });

    afterEach(() => {
        // Cleanup
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Real file operations', () => {
        test('should edit real CSS file', async () => {
            // Create test file
            const originalContent = `:root {
  --primary: oklch(0.5555 0 0);
  --secondary: oklch(0.9700 0 0);
}`;
            fs.writeFileSync(testFile, originalContent, 'utf8');

            // Mock path resolution to use our temp file
            jest.spyOn(require('../../utils/path-resolver'), 'resolveWorkspacePath')
                .mockResolvedValue(testFile);

            // Execute edit
            const result = await executeTextFileEdits({
                summary: 'Change primary color',
                targetFile: 'test.css',
                edits: [{
                    oldString: '--primary: oklch(0.5555 0 0);',
                    newString: '--primary: oklch(0.4200 0.1800 266);',
                    reason: 'Update to blue'
                }]
            });

            expect(result.success).toBe(true);
            expect(result.appliedEdits).toBe(1);

            // Verify file content
            const newContent = fs.readFileSync(testFile, 'utf8');
            expect(newContent).toContain('oklch(0.4200 0.1800 266)');
            expect(newContent).not.toContain('oklch(0.5555 0 0)');
        });

        test('should handle multiple sequential edits on real file', async () => {
            const originalContent = `:root {
  --primary: oklch(0.5555 0 0);
  --secondary: oklch(0.9700 0 0);
  --radius: 0.5rem;
}`;
            fs.writeFileSync(testFile, originalContent, 'utf8');

            jest.spyOn(require('../../utils/path-resolver'), 'resolveWorkspacePath')
                .mockResolvedValue(testFile);

            const result = await executeTextFileEdits({
                summary: 'Multiple updates',
                targetFile: 'test.css',
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
            });

            expect(result.success).toBe(true);
            expect(result.appliedEdits).toBe(2);

            const newContent = fs.readFileSync(testFile, 'utf8');
            expect(newContent).toContain('oklch(0.4200 0.1800 266)');
            expect(newContent).toContain('oklch(0.8000 0.1500 260)');
        });
    });

    describe('HTML editing scenarios', () => {
        test('should safely edit HTML structure', async () => {
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <div class="container">
    <h1>Welcome</h1>
  </div>
</body>
</html>`;
            fs.writeFileSync(testFile, htmlContent, 'utf8');

            jest.spyOn(require('../../utils/path-resolver'), 'resolveWorkspacePath')
                .mockResolvedValue(testFile);

            const result = await executeTextFileEdits({
                summary: 'Add paragraph to HTML',
                targetFile: 'test.html',
                edits: [{
                    oldString: `    <h1>Welcome</h1>
  </div>`,
                    newString: `    <h1>Welcome</h1>
    <p>This is a description</p>
  </div>`,
                    reason: 'Add description'
                }]
            });

            expect(result.success).toBe(true);

            const newContent = fs.readFileSync(testFile, 'utf8');
            expect(newContent).toContain('<p>This is a description</p>');
        });
    });

    describe('Error recovery', () => {
        test('should not modify file if all edits fail', async () => {
            const originalContent = 'original content';
            fs.writeFileSync(testFile, originalContent, 'utf8');

            jest.spyOn(require('../../utils/path-resolver'), 'resolveWorkspacePath')
                .mockResolvedValue(testFile);

            const result = await executeTextFileEdits({
                summary: 'Failed edits',
                targetFile: 'test.txt',
                edits: [{
                    oldString: 'non-existent',
                    newString: 'new',
                    reason: 'Will fail'
                }]
            });

            expect(result.success).toBe(false);
            expect(result.appliedEdits).toBe(0);

            // File should remain unchanged
            const content = fs.readFileSync(testFile, 'utf8');
            expect(content).toBe(originalContent);
        });
    });
});
