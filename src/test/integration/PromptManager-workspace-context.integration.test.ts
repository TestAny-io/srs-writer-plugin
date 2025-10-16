import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { PromptManager } from '../../core/orchestrator/PromptManager';
import { SessionContext } from '../../types/session';

describe('PromptManager - Integration Tests (Workspace Context)', () => {
  let tempDir: string;
  let promptManager: PromptManager;
  let mockSessionContext: SessionContext;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(os.tmpdir(), `prompt-manager-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    promptManager = new PromptManager();
    mockSessionContext = {
      sessionContextId: 'integration-test-session',
      projectName: 'integration-test-project',
      baseDir: tempDir,
      activeFiles: [],
      metadata: {
        srsVersion: 'v1.0',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '5.0'
      }
    };
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('listProjectFiles with real filesystem', () => {
    test('should correctly list files and directories in project directory', async () => {
      // Arrange - Create test file structure
      await fs.mkdir(path.join(tempDir, 'prototype'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'docs'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'SRS.md'), '# SRS');
      await fs.writeFile(path.join(tempDir, 'requirements.yaml'), 'version: 1.0');
      await fs.writeFile(path.join(tempDir, '.gitignore'), '**/node_modules');

      // Act
      const result = await (promptManager as any).listProjectFiles(tempDir);

      // Assert
      expect(result).toHaveLength(4); // Should exclude .gitignore
      const names = result.map((f: any) => f.name);
      expect(names).toContain('prototype');
      expect(names).toContain('docs');
      expect(names).toContain('SRS.md');
      expect(names).toContain('requirements.yaml');
      expect(names).not.toContain('.gitignore');

      // Verify directories are marked correctly
      const prototypeFile = result.find((f: any) => f.name === 'prototype');
      expect(prototypeFile.isDirectory).toBe(true);

      const srsFile = result.find((f: any) => f.name === 'SRS.md');
      expect(srsFile.isDirectory).toBe(false);
    });

    test('should exclude node_modules directory', async () => {
      // Arrange
      await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

      // Act
      const result = await (promptManager as any).listProjectFiles(tempDir);

      // Assert
      const names = result.map((f: any) => f.name);
      expect(names).toContain('src');
      expect(names).toContain('package.json');
      expect(names).not.toContain('node_modules');
    });

    test('should generate correct relative paths with forward slashes', async () => {
      // Arrange
      await fs.mkdir(path.join(tempDir, 'subdir'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'test');

      // Act
      const result = await (promptManager as any).listProjectFiles(tempDir);

      // Assert
      result.forEach((file: any) => {
        expect(file.relativePath).toMatch(/^\.\//);
        expect(file.relativePath).not.toContain('\\\\');
      });
    });

    test('should sort directories before files alphabetically', async () => {
      // Arrange
      await fs.mkdir(path.join(tempDir, 'zfolder'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'afolder'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'zfile.txt'), '');
      await fs.writeFile(path.join(tempDir, 'afile.txt'), '');

      // Act
      const result = await (promptManager as any).listProjectFiles(tempDir);

      // Assert
      expect(result).toHaveLength(4);
      // Directories should come first
      expect(result[0].isDirectory).toBe(true);
      expect(result[1].isDirectory).toBe(true);
      // Then files
      expect(result[2].isDirectory).toBe(false);
      expect(result[3].isDirectory).toBe(false);
      // Alphabetically within each group
      expect(result[0].name).toBe('afolder');
      expect(result[1].name).toBe('zfolder');
      expect(result[2].name).toBe('afile.txt');
      expect(result[3].name).toBe('zfile.txt');
    });

    test('should handle special characters in filenames', async () => {
      // Arrange
      await fs.writeFile(path.join(tempDir, 'file-with-dash.txt'), '');
      await fs.writeFile(path.join(tempDir, 'file_with_underscore.md'), '');
      await fs.writeFile(path.join(tempDir, 'file.backup.2025-10-16T06-37-34-093Z'), '');

      // Act
      const result = await (promptManager as any).listProjectFiles(tempDir);

      // Assert
      expect(result).toHaveLength(3);
      const names = result.map((f: any) => f.name);
      expect(names).toContain('file-with-dash.txt');
      expect(names).toContain('file_with_underscore.md');
      expect(names).toContain('file.backup.2025-10-16T06-37-34-093Z');
    });
  });

  describe('getProjectFilesSection with real filesystem', () => {
    test('should generate complete project files section', async () => {
      // Arrange
      await fs.mkdir(path.join(tempDir, 'prototype'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'project.log'), 'log content');
      await fs.writeFile(path.join(tempDir, 'requirements.yaml'), 'version: 1.0');
      await fs.writeFile(path.join(tempDir, 'SRS.md'), '# SRS');

      // Act
      const result = await (promptManager as any).getProjectFilesSection(tempDir);

      // Assert
      expect(result).toContain('- Project Files (Relative to baseDir):');
      expect(result).toContain('- ./prototype (directory)');
      expect(result).toContain('- ./project.log');
      expect(result).toContain('- ./requirements.yaml');
      expect(result).toContain('- ./SRS.md');
    });

    test('should handle empty directory', async () => {
      // Act
      const result = await (promptManager as any).getProjectFilesSection(tempDir);

      // Assert
      expect(result).toContain('- Project Files (Relative to baseDir): No files found');
    });

    test('should handle directory with only hidden files', async () => {
      // Arrange
      await fs.writeFile(path.join(tempDir, '.gitignore'), '');
      await fs.writeFile(path.join(tempDir, '.env'), '');

      // Act
      const result = await (promptManager as any).getProjectFilesSection(tempDir);

      // Assert
      expect(result).toContain('No files found');
    });

    test('should handle non-existent directory gracefully', async () => {
      // Act
      const result = await (promptManager as any).getProjectFilesSection('/non/existent/directory');

      // Assert
      // The function returns "No files found" when readdir fails (catches error and returns [])
      expect(result).toContain('- Project Files (Relative to baseDir): No files found');
    });
  });

  describe('Project structure examples', () => {
    test('should handle realistic SRS project structure', async () => {
      // Arrange - Create realistic project structure
      const structure = [
        'prototype',
        'docs',
        'SRS.md',
        'requirements.yaml',
        'requirements.yaml.backup.2025-10-16T06-37-34-093Z',
        'requirements.yaml.backup.2025-10-16T06-39-46-447Z',
        'project.log',
        'srs_quality_check_report.json',
        'srs_review_report.md'
      ];

      for (const item of structure) {
        const fullPath = path.join(tempDir, item);
        if (item.includes('.')) {
          await fs.writeFile(fullPath, '');
        } else {
          await fs.mkdir(fullPath, { recursive: true });
        }
      }

      // Act
      const result = await (promptManager as any).listProjectFiles(tempDir);

      // Assert
      expect(result.length).toBe(structure.length);
      const names = result.map((f: any) => f.name);
      structure.forEach(item => {
        expect(names).toContain(item);
      });

      // Verify format
      const formattedSection = await (promptManager as any).getProjectFilesSection(tempDir);
      expect(formattedSection).toContain('- ./prototype (directory)');
      expect(formattedSection).toContain('- ./docs (directory)');
      expect(formattedSection).toContain('- ./SRS.md');
      expect(formattedSection).toContain('- ./requirements.yaml');
    });
  });

  describe('Integration with buildWorkspaceContext', () => {
    test('should integrate project files listing into workspace context', async () => {
      // This would require mocking vscode, so we test the components separately
      // but document that they work together
      
      // Arrange
      await fs.mkdir(path.join(tempDir, 'prototype'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'SRS.md'), '# SRS');
      await fs.writeFile(path.join(tempDir, 'requirements.yaml'), 'version: 1.0');

      // Act - Call the individual methods
      const projectFiles = await (promptManager as any).listProjectFiles(tempDir);
      const filesSection = await (promptManager as any).getProjectFilesSection(tempDir);

      // Assert
      expect(projectFiles).toHaveLength(3);
      expect(filesSection).toContain('- Project Files (Relative to baseDir):');
      expect(filesSection).toContain('- ./prototype (directory)');
      expect(filesSection).toContain('- ./SRS.md');
      expect(filesSection).toContain('- ./requirements.yaml');
    });
  });
});
