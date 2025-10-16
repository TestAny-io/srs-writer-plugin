import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { PromptManager } from '../../core/orchestrator/PromptManager';
import { SessionContext } from '../../types/session';

/**
 * Functional Tests - Test the complete workflow and user-visible behavior
 */
describe('PromptManager - Functional Tests (Workspace Context Workflow)', () => {
  let tempDir: string;
  let promptManager: PromptManager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `pm-functional-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    promptManager = new PromptManager();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  describe('Scenario: New SRS project setup', () => {
    test('should display complete project context for new SRS project', async () => {
      // Arrange - Simulate a new SRS project
      const projectName = 'MyNewSRSProject';
      const projectDir = path.join(tempDir, projectName);
      await fs.mkdir(projectDir, { recursive: true });

      // Create initial project files
      await fs.writeFile(
        path.join(projectDir, 'SRS.md'),
        '# Software Requirements Specification\n\n## Overview\n'
      );
      await fs.writeFile(
        path.join(projectDir, 'requirements.yaml'),
        'project: MyNewSRSProject\nversion: 1.0.0\n'
      );
      await fs.mkdir(path.join(projectDir, 'prototype'), { recursive: true });

      const sessionContext: SessionContext = {
        sessionContextId: 'session-001',
        projectName: projectName,
        baseDir: projectDir,
        activeFiles: [],
        metadata: {
          srsVersion: 'v1.0',
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: '5.0'
        }
      };

      // Act - Get project files section
      const projectFilesSection = await (promptManager as any).getProjectFilesSection(projectDir);

      // Assert - Verify complete project context
      expect(projectFilesSection).toContain('- Project Files (Relative to baseDir):');
      expect(projectFilesSection).toContain('- ./prototype (directory)');
      expect(projectFilesSection).toContain('- ./requirements.yaml');
      expect(projectFilesSection).toContain('- ./SRS.md');

      // Verify files are listed in correct order (directories first)
      const lines = projectFilesSection.split('\n').filter((l: string) => l.trim().startsWith('- ./'));
      expect(lines[0]).toContain('prototype (directory)');
    });
  });

  describe('Scenario: SRS project with backups', () => {
    test('should handle project with multiple backup files', async () => {
      // Arrange - Create realistic project structure with backups
      const backupFiles = [
        'requirements.yaml.backup.2025-10-16T06-37-34-093Z',
        'requirements.yaml.backup.2025-10-16T06-39-46-447Z',
        'requirements.yaml.backup.2025-10-16T06-40-45-253Z',
        'requirements.yaml.backup.2025-10-16T06-42-04-055Z'
      ];

      for (const backupFile of backupFiles) {
        await fs.writeFile(path.join(tempDir, backupFile), 'backup content');
      }

      await fs.writeFile(path.join(tempDir, 'requirements.yaml'), 'current version');
      await fs.writeFile(path.join(tempDir, 'SRS.md'), '# SRS');
      await fs.mkdir(path.join(tempDir, 'prototype'), { recursive: true });

      // Act
      const projectFiles = await (promptManager as any).listProjectFiles(tempDir);
      const filesSection = await (promptManager as any).getProjectFilesSection(tempDir);

      // Assert
      const names = projectFiles.map((f: any) => f.name);
      expect(names).toContain('requirements.yaml');
      backupFiles.forEach(file => {
        expect(names).toContain(file);
      });

      // Verify all backups appear in formatted section
      backupFiles.forEach(file => {
        expect(filesSection).toContain(`./` + file);
      });

      // Verify directories are listed first
      const directoryLines = filesSection
        .split('\n')
        .filter((l: string) => l.includes('(directory)'));
      expect(directoryLines.length).toBe(1); // Only prototype
      expect(directoryLines[0]).toContain('./prototype');
    });
  });

  describe('Scenario: Project with quality check reports', () => {
    test('should list project with SRS review reports', async () => {
      // Arrange
      const reportFiles = [
        'srs_quality_check_report_vscodeapitestplugin.json',
        'srs_review_report_VSCodeApiTestPlugin.md'
      ];

      for (const reportFile of reportFiles) {
        await fs.writeFile(path.join(tempDir, reportFile), 'report content');
      }

      await fs.writeFile(path.join(tempDir, 'SRS.md'), '# SRS');
      await fs.writeFile(path.join(tempDir, 'project.log'), 'log entries');

      // Act
      const filesSection = await (promptManager as any).getProjectFilesSection(tempDir);

      // Assert
      reportFiles.forEach(file => {
        expect(filesSection).toContain(`./` + file);
      });

      expect(filesSection).toContain('./project.log');
      expect(filesSection).toContain('./SRS.md');
    });
  });

  describe('Scenario: Large project with many files', () => {
    test('should efficiently handle project with many files', async () => {
      // Arrange - Create a project with many files and directories
      const fileCount = 50;
      const dirs = ['src', 'docs', 'tests', 'prototype', 'resources'];

      for (const dir of dirs) {
        await fs.mkdir(path.join(tempDir, dir), { recursive: true });
      }

      for (let i = 0; i < fileCount; i++) {
        await fs.writeFile(
          path.join(tempDir, `file_${i.toString().padStart(3, '0')}.txt`),
          'content'
        );
      }

      // Act
      const startTime = Date.now();
      const projectFiles = await (promptManager as any).listProjectFiles(tempDir);
      const endTime = Date.now();

      // Assert
      expect(projectFiles.length).toBe(fileCount + dirs.length);
      // Should complete quickly (under 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Verify correct ordering
      const directories = projectFiles.filter((f: any) => f.isDirectory);
      const files = projectFiles.filter((f: any) => !f.isDirectory);

      expect(directories.length).toBe(dirs.length);
      expect(files.length).toBe(fileCount);
    });
  });

  describe('Scenario: Project with special directory structures', () => {
    test('should correctly handle nested directories', async () => {
      // Arrange
      const structure = {
        'src': ['main.ts', 'utils.ts'],
        'docs': ['api.md', 'guide.md'],
        'tests': [],
        'prototype': []
      };

      for (const [dir, files] of Object.entries(structure)) {
        await fs.mkdir(path.join(tempDir, dir), { recursive: true });
        for (const file of files) {
          await fs.writeFile(path.join(tempDir, dir, file), 'content');
        }
      }

      // Act
      const projectFiles = await (promptManager as any).listProjectFiles(tempDir);

      // Assert - Should only list top-level items
      expect(projectFiles.length).toBe(4); // 4 directories
      const names = projectFiles.map((f: any) => f.name);
      expect(names).toEqual(['docs', 'prototype', 'src', 'tests']);
    });
  });

  describe('User experience: Output format validation', () => {
    test('should format output exactly as user specified', async () => {
      // Arrange
      await fs.mkdir(path.join(tempDir, 'prototype'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'project.log'), '');
      await fs.writeFile(path.join(tempDir, 'requirements.yaml'), '');
      await fs.writeFile(path.join(tempDir, 'requirements.yaml.backup.2025-10-16T06-37-34-093Z'), '');
      await fs.writeFile(path.join(tempDir, 'requirements.yaml.backup.2025-10-16T06-39-46-447Z'), '');
      await fs.writeFile(path.join(tempDir, 'requirements.yaml.backup.2025-10-16T06-40-45-253Z'), '');
      await fs.writeFile(path.join(tempDir, 'requirements.yaml.backup.2025-10-16T06-42-04-055Z'), '');
      await fs.writeFile(path.join(tempDir, 'srs_quality_check_report_vscodeapitestplugin.json'), '');
      await fs.writeFile(path.join(tempDir, 'srs_review_report_VSCodeApiTestPlugin.md'), '');
      await fs.writeFile(path.join(tempDir, 'SRS.md'), '');

      // Act
      const filesSection = await (promptManager as any).getProjectFilesSection(tempDir);

      // Assert - Verify exact format from user's example
      const expectedLines = [
        '- Project Files (Relative to baseDir):',
        '- ./prototype (directory)',
        '- ./project.log',
        '- ./requirements.yaml',
        '- ./requirements.yaml.backup.2025-10-16T06-37-34-093Z',
        '- ./requirements.yaml.backup.2025-10-16T06-39-46-447Z',
        '- ./requirements.yaml.backup.2025-10-16T06-40-45-253Z',
        '- ./requirements.yaml.backup.2025-10-16T06-42-04-055Z',
        '- ./srs_quality_check_report_vscodeapitestplugin.json',
        '- ./srs_review_report_VSCodeApiTestPlugin.md',
        '- ./SRS.md'
      ];

      expectedLines.forEach(line => {
        expect(filesSection).toContain(line);
      });

      // Verify directories marked with (directory)
      const dirLines = filesSection.split('\n').filter((l: string) => l.includes('(directory)'));
      expect(dirLines.length).toBe(1);
      expect(dirLines[0]).toContain('./prototype (directory)');

      // Verify no files are marked as directory
      const fileLines = filesSection.split('\n').filter((l: string) => 
        l.trim().startsWith('- ./') && !l.includes('(directory)')
      );
      expect(fileLines.length).toBe(9); // 9 files (not counting the directory)
    });
  });

  describe('Edge cases and robustness', () => {
    test('should handle project directory with spaces and special chars', async () => {
      // Arrange
      const specialDir = path.join(tempDir, 'Project Dir (Test) 2025');
      await fs.mkdir(specialDir, { recursive: true });
      await fs.writeFile(path.join(specialDir, 'file with spaces.txt'), '');
      await fs.mkdir(path.join(specialDir, 'dir-with-dashes'), { recursive: true });

      // Act
      const projectFiles = await (promptManager as any).listProjectFiles(specialDir);
      const filesSection = await (promptManager as any).getProjectFilesSection(specialDir);

      // Assert
      expect(projectFiles).toHaveLength(2);
      expect(filesSection).toContain('./dir-with-dashes (directory)');
      expect(filesSection).toContain('./file with spaces.txt');
    });

    test('should maintain consistency across multiple calls', async () => {
      // Arrange
      await fs.writeFile(path.join(tempDir, 'file1.txt'), '');
      await fs.mkdir(path.join(tempDir, 'dir1'), { recursive: true });

      // Act - Call multiple times
      const result1 = await (promptManager as any).listProjectFiles(tempDir);
      const result2 = await (promptManager as any).listProjectFiles(tempDir);
      const result3 = await (promptManager as any).listProjectFiles(tempDir);

      // Assert
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });

  describe('Integration: Complete context output', () => {
    test('should generate context matching user expectations', async () => {
      // Arrange - Build expected output based on user requirements
      const projectDir = path.join(tempDir, 'test-project');
      await fs.mkdir(projectDir, { recursive: true });

      // Create files matching user's example
      const files = [
        { path: 'prototype', isDir: true },
        { path: 'project.log', isDir: false },
        { path: 'requirements.yaml', isDir: false },
        { path: 'requirements.yaml.backup.2025-10-16T06-37-34-093Z', isDir: false },
        { path: 'requirements.yaml.backup.2025-10-16T06-39-46-447Z', isDir: false },
        { path: 'requirements.yaml.backup.2025-10-16T06-40-45-253Z', isDir: false },
        { path: 'requirements.yaml.backup.2025-10-16T06-42-04-055Z', isDir: false },
        { path: 'srs_quality_check_report_vscodeapitestplugin.json', isDir: false },
        { path: 'srs_review_report_VSCodeApiTestPlugin.md', isDir: false },
        { path: 'SRS.md', isDir: false }
      ];

      for (const file of files) {
        const fullPath = path.join(projectDir, file.path);
        if (file.isDir) {
          await fs.mkdir(fullPath, { recursive: true });
        } else {
          await fs.writeFile(fullPath, '');
        }
      }

      // Act
      const filesSection = await (promptManager as any).getProjectFilesSection(projectDir);

      // Assert - Verify user-specified format
      expect(filesSection).toContain('- Project Files (Relative to baseDir):');

      // All files should be present
      for (const file of files) {
        const expectedLine = file.isDir
          ? `- ./${file.path} (directory)`
          : `- ./${file.path}`;
        expect(filesSection).toContain(expectedLine);
      }

      // Verify single directory is listed first
      const lines = filesSection.split('\n').filter((l: string) => l.trim().startsWith('- ./'));
      expect(lines[0]).toContain('(directory)');
    });
  });
});
