/**
 * 环境感知功能单元测试
 * 测试 PromptAssemblyEngine 的环境感知增强功能
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PromptAssemblyEngine, SpecialistContext, EnvironmentContext, FileInfo } from '../../core/prompts/PromptAssemblyEngine';

// Mock fs 模块
jest.mock('fs/promises');
const mockedFs = jest.mocked(fs);

// Mock path 模块
jest.mock('path');
const mockedPath = jest.mocked(path);

// Mock process.cwd
const originalCwd = process.cwd;
const mockCwd = jest.fn();

describe('PromptAssemblyEngine - Environment Sensing', () => {
  let promptAssemblyEngine: PromptAssemblyEngine;
  const mockProjectDir = '/test/project';
  const mockCurrentDir = '/test/project/subdir';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = mockCwd;
    mockCwd.mockReturnValue(mockCurrentDir);
    
    // Setup path mocks
    mockedPath.join.mockImplementation((...args) => args.join('/'));
    mockedPath.relative.mockImplementation((from, to) => {
      if (from === '/test/project' && to === '/test/project/SRS.md') return 'SRS.md';
      if (from === '/test/project' && to === '/test/project/prototype') return 'prototype';
      if (from === '/test/project' && to === '/test/project/subdir/index.html') return 'subdir/index.html';
      return 'unknown';
    });
    
    // Initialize engine
    promptAssemblyEngine = new PromptAssemblyEngine(mockProjectDir);
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  describe('gatherEnvironmentContext', () => {
    test('应该成功收集环境感知信息', async () => {
      // Arrange
      const context: SpecialistContext = {
        projectMetadata: { baseDir: mockProjectDir }
      };

      // Mock fs.readdir for project directory
      mockedFs.readdir.mockImplementation((dirPath: any) => {
        if (dirPath === mockProjectDir) {
          return Promise.resolve([
            { name: 'SRS.md', isDirectory: () => false },
            { name: 'requirements.yaml', isDirectory: () => false },
            { name: 'prototype', isDirectory: () => true },
            { name: '.git', isDirectory: () => true }, // Should be filtered out
            { name: 'node_modules', isDirectory: () => true } // Should be filtered out
          ] as any);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await (promptAssemblyEngine as any).gatherEnvironmentContext(context);

      // Assert
      expect(result).toEqual({
        projectDirectory: mockProjectDir,
        projectFiles: [
          { name: 'prototype', isDirectory: true, relativePath: './prototype' },
          { name: 'SRS.md', isDirectory: false, relativePath: './SRS.md' },
          { name: 'requirements.yaml', isDirectory: false, relativePath: './requirements.yaml' }
        ]
      });

      expect(mockedFs.readdir).toHaveBeenCalledTimes(1);
      expect(mockedFs.readdir).toHaveBeenCalledWith(mockProjectDir, { withFileTypes: true });
    });

    test('应该处理缺少baseDir的情况', async () => {
      // Arrange
      const context: SpecialistContext = {
        projectMetadata: {}
      };

      // Act
      const result = await (promptAssemblyEngine as any).gatherEnvironmentContext(context);

      // Assert
      expect(result).toEqual({
        projectDirectory: '',
        projectFiles: []
      });

      expect(mockedFs.readdir).not.toHaveBeenCalled();
    });

    test('应该处理文件系统错误', async () => {
      // Arrange
      const context: SpecialistContext = {
        projectMetadata: { baseDir: mockProjectDir }
      };

      mockedFs.readdir.mockRejectedValue(new Error('Permission denied'));

      // Act
      const result = await (promptAssemblyEngine as any).gatherEnvironmentContext(context);

      // Assert
      expect(result).toEqual({
        projectDirectory: mockProjectDir,
        projectFiles: []
      });
    });
  });

  describe('listDirectoryFiles', () => {
    test('应该正确列出目录文件并排序', async () => {
      // Arrange
      mockedFs.readdir.mockResolvedValue([
        { name: 'file.txt', isDirectory: () => false },
        { name: 'subdir', isDirectory: () => true },
        { name: 'another.md', isDirectory: () => false },
        { name: '.hidden', isDirectory: () => false }, // Should be filtered
        { name: 'node_modules', isDirectory: () => true } // Should be filtered
      ] as any);

      // Act
      const result = await (promptAssemblyEngine as any).listDirectoryFiles(mockProjectDir, mockProjectDir);

      // Assert
      expect(result).toEqual([
        { name: 'subdir', isDirectory: true, relativePath: './subdir' },
        { name: 'another.md', isDirectory: false, relativePath: './another.md' },
        { name: 'file.txt', isDirectory: false, relativePath: './file.txt' }
      ]);
    });

    test('应该处理空目录', async () => {
      // Arrange
      mockedFs.readdir.mockResolvedValue([]);

      // Act
      const result = await (promptAssemblyEngine as any).listDirectoryFiles(mockProjectDir, mockProjectDir);

      // Assert
      expect(result).toEqual([]);
    });

    test('应该处理目录读取错误', async () => {
      // Arrange
      mockedFs.readdir.mockRejectedValue(new Error('Directory not found'));

      // Act
      const result = await (promptAssemblyEngine as any).listDirectoryFiles(mockProjectDir, mockProjectDir);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('assembleSpecialistPrompt - Environment Integration', () => {
    test('应该在组装的提示词中包含环境信息', async () => {
      // Arrange
      const specialistType = { name: 'test_writer', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Test task',
        projectMetadata: { baseDir: mockProjectDir },
        TOOLS_JSON_SCHEMA: '[]'
      };

      // Mock template loading
      mockedFs.readFile.mockImplementation((filePath: any) => {
        if (filePath.includes('test_writer')) {
          return Promise.resolve('---\nspecialist_config:\n  enabled: true\n---\n\n# Test Writer Template');
        }
        if (filePath.includes('output-format-schema.md')) {
          return Promise.resolve('# Output Format Schema');
        }
        return Promise.resolve('# Mock Template');
      });

      // Mock directory listing
      mockedFs.readdir.mockImplementation((dirPath: any) => {
        if (dirPath === mockProjectDir) {
          return Promise.resolve([
            { name: 'SRS.md', isDirectory: () => false },
            { name: 'requirements.yaml', isDirectory: () => false }
          ] as any);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      // Assert
      expect(result).toContain('## 🌍 Environment Context');
      expect(result).toContain(`**Project Directory (Absolute Path)**: \`${mockProjectDir}\``);
      expect(result).toContain('**Project Files (Relative to baseDir)**:');
      expect(result).toContain('- ./SRS.md');
      expect(result).toContain('- ./requirements.yaml');
    });

    test('应该处理没有环境上下文的情况', async () => {
      // Arrange
      const specialistType = { name: 'test_writer', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Test task',
        projectMetadata: {}, // No baseDir
        TOOLS_JSON_SCHEMA: '[]'
      };

      // Mock template loading
      mockedFs.readFile.mockImplementation((filePath: any) => {
        if (filePath.includes('test_writer')) {
          return Promise.resolve('---\nspecialist_config:\n  enabled: true\n---\n\n# Test Writer Template');
        }
        return Promise.resolve('# Mock Template');
      });

      // Act
      const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      // Assert
      expect(result).toContain('## 🌍 Environment Context');
      expect(result).toContain('Environment context not available');
    });
  });

  describe('mergeTemplates - Environment Context Integration', () => {
    test('应该正确合并环境上下文到动态上下文中', () => {
      // Arrange
      const templates = ['template1'];
      const context: SpecialistContext = {
        userRequirements: 'Test requirements',
        projectMetadata: { baseDir: mockProjectDir }
      };
      const environmentContext: EnvironmentContext = {
        projectDirectory: mockProjectDir,
        projectFiles: [
          { name: 'SRS.md', isDirectory: false, relativePath: './SRS.md' },
          { name: 'prototype', isDirectory: true, relativePath: './prototype' }
        ]
      };

      // Act
      const result = (promptAssemblyEngine as any).mergeTemplates(
        templates, 
        context, 
        {}, 
        [], 
        ['template1'],
        environmentContext
      );

      // Assert
      expect(result).toContain('## 🌍 Environment Context');
      expect(result).toContain(`**Project Directory (Absolute Path)**: \`${mockProjectDir}\``);
      expect(result).toContain('- ./SRS.md');
      expect(result).toContain('- ./prototype (directory)');
    });

    test('应该处理空文件列表', () => {
      // Arrange
      const templates = ['template1'];
      const context: SpecialistContext = {
        userRequirements: 'Test requirements'
      };
      const environmentContext: EnvironmentContext = {
        projectDirectory: mockProjectDir,
        projectFiles: []
      };

      // Act
      const result = (promptAssemblyEngine as any).mergeTemplates(
        templates, 
        context, 
        {}, 
        [], 
        ['template1'],
        environmentContext
      );

      // Assert
      expect(result).toContain('## 🌍 Environment Context');
      expect(result).toContain('- No files found in project directory');
    });
  });
});
