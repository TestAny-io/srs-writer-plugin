/**
 * 环境感知功能集成测试
 * 测试 PromptAssemblyEngine 与实际文件系统的环境感知交互
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PromptAssemblyEngine, SpecialistContext, FileInfo } from '../../core/prompts/PromptAssemblyEngine';

describe('PromptAssemblyEngine - Environment Sensing Integration', () => {
  let promptAssemblyEngine: PromptAssemblyEngine;
  let testProjectDir: string;
  let originalCwd: string;

  beforeAll(async () => {
    // 保存原始工作目录
    originalCwd = process.cwd();
    
    // 创建临时测试项目目录
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'srs-env-test-'));
    testProjectDir = tempDir;
    
    // 创建测试目录结构
    await fs.mkdir(path.join(testProjectDir, 'prototype'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'docs'), { recursive: true });
    
    // 创建测试文件
    await fs.writeFile(path.join(testProjectDir, 'SRS.md'), '# Test SRS Document');
    await fs.writeFile(path.join(testProjectDir, 'requirements.yaml'), 'version: 1.0');
    await fs.writeFile(path.join(testProjectDir, 'README.md'), '# Test Project');
    await fs.writeFile(path.join(testProjectDir, 'prototype', 'index.html'), '<html></html>');
    await fs.writeFile(path.join(testProjectDir, 'prototype', 'style.css'), 'body {}');
    await fs.writeFile(path.join(testProjectDir, 'docs', 'api.md'), '# API Documentation');
    
    // 创建基础模板文件以避免模板加载错误
    const rulesDir = path.join(testProjectDir, 'rules');
    await fs.mkdir(path.join(rulesDir, 'base'), { recursive: true });
    await fs.mkdir(path.join(rulesDir, 'specialists', 'content'), { recursive: true });
    
    await fs.writeFile(
      path.join(rulesDir, 'base', 'output-format-schema.md'), 
      '# Output Format Schema\nstructuredData format'
    );
    await fs.writeFile(
      path.join(rulesDir, 'specialists', 'content', 'test_writer.md'),
      '---\nspecialist_config:\n  enabled: true\n  id: "test_writer"\n  name: "Test Writer"\n  category: "content"\n---\n\n# Test Writer Template'
    );
    
    // 初始化 PromptAssemblyEngine
    promptAssemblyEngine = new PromptAssemblyEngine(rulesDir);
  });

  afterAll(async () => {
    // 恢复工作目录
    process.chdir(originalCwd);
    
    // 清理测试目录
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  describe('Real File System Integration', () => {
    test('应该正确读取项目根目录的文件', async () => {
      // Arrange
      process.chdir(testProjectDir);
      const context: SpecialistContext = {
        userRequirements: 'Test integration',
        projectMetadata: { baseDir: testProjectDir }
      };

      // Act
      const environmentContext = await (promptAssemblyEngine as any).gatherEnvironmentContext(context);

      // Assert
      expect(environmentContext.projectDirectory).toBe(testProjectDir);
      
      // 验证项目文件列表
      const projectFileNames = environmentContext.projectFiles.map((f: FileInfo) => f.name);
      expect(projectFileNames).toContain('SRS.md');
      expect(projectFileNames).toContain('requirements.yaml');
      expect(projectFileNames).toContain('README.md');
      expect(projectFileNames).toContain('prototype');
      expect(projectFileNames).toContain('docs');
      expect(projectFileNames).toContain('rules');
      
      // 验证文件类型标识
      const prototypeFile = environmentContext.projectFiles.find((f: FileInfo) => f.name === 'prototype');
      expect(prototypeFile?.isDirectory).toBe(true);
      
      const srsFile = environmentContext.projectFiles.find((f: FileInfo) => f.name === 'SRS.md');
      expect(srsFile?.isDirectory).toBe(false);
      
      // 验证相对路径
      expect(srsFile?.relativePath).toBe('./SRS.md');
      expect(prototypeFile?.relativePath).toBe('./prototype');
    });

    test('应该忽略process.cwd并只从baseDir读取文件', async () => {
      // Arrange
      // 改变当前工作目录到子目录
      const prototypeDir = path.join(testProjectDir, 'prototype');
      process.chdir(prototypeDir);
      
      const context: SpecialistContext = {
        userRequirements: 'Test subdir integration',
        projectMetadata: { baseDir: testProjectDir }
      };

      // Act
      const environmentContext = await (promptAssemblyEngine as any).gatherEnvironmentContext(context);

      // Assert
      expect(environmentContext.projectDirectory).toBe(testProjectDir);
      
      // 验证项目文件（只从项目根目录 baseDir 读取）
      const projectFileNames = environmentContext.projectFiles.map((f: FileInfo) => f.name);
      expect(projectFileNames).toContain('SRS.md');
      expect(projectFileNames).toContain('prototype');
      expect(projectFileNames).toContain('docs');
      
      // 不应该包含子目录中的文件（因为不再读取 currentDirectory）
      expect(projectFileNames).not.toContain('index.html');
      expect(projectFileNames).not.toContain('style.css');
    });

    test('应该在完整的提示词组装中正确集成环境信息', async () => {
      // Arrange
      process.chdir(testProjectDir);
      
      const specialistType = { name: 'test_writer', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Write test content',
        projectMetadata: { baseDir: testProjectDir },
        TOOLS_JSON_SCHEMA: JSON.stringify([{ name: 'test_tool', description: 'Test tool' }])
      };

      // Act
      const assembledPrompt = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      // Assert
      expect(assembledPrompt).toContain('## 🌍 Environment Context');
      expect(assembledPrompt).toContain(`**Project Directory (Absolute Path)**: \`${testProjectDir}\``);
      expect(assembledPrompt).toContain('**Project Files (Relative to baseDir)**:');
      expect(assembledPrompt).toContain('- ./SRS.md');
      expect(assembledPrompt).toContain('- ./requirements.yaml');
      expect(assembledPrompt).toContain('- ./prototype (directory)');
      expect(assembledPrompt).toContain('- ./docs (directory)');
      
      // 不应该包含 Current Directory Files
      expect(assembledPrompt).not.toContain('**Current Directory Files (Relative to baseDir)**:');
      
      // 验证环境信息出现在正确的位置（DYNAMIC CONTEXT部分）
      const dynamicContextIndex = assembledPrompt.indexOf('**# 6. DYNAMIC CONTEXT**');
      const environmentContextIndex = assembledPrompt.indexOf('## 🌍 Environment Context');
      expect(dynamicContextIndex).toBeGreaterThan(-1);
      expect(environmentContextIndex).toBeGreaterThan(dynamicContextIndex);
    });

    test('应该正确处理不存在的项目目录', async () => {
      // Arrange
      const nonExistentDir = path.join(testProjectDir, 'non-existent');
      const context: SpecialistContext = {
        userRequirements: 'Test non-existent dir',
        projectMetadata: { baseDir: nonExistentDir }
      };

      // Act
      const environmentContext = await (promptAssemblyEngine as any).gatherEnvironmentContext(context);

      // Assert
      expect(environmentContext.projectDirectory).toBe(nonExistentDir);
      expect(environmentContext.projectFiles).toEqual([]);
    });

    test('应该过滤隐藏文件和node_modules', async () => {
      // Arrange
      // 创建一些需要过滤的文件/目录
      await fs.writeFile(path.join(testProjectDir, '.hidden'), 'hidden content');
      await fs.mkdir(path.join(testProjectDir, 'node_modules'), { recursive: true });
      await fs.writeFile(path.join(testProjectDir, '.gitignore'), 'ignored files');
      
      process.chdir(testProjectDir);
      const context: SpecialistContext = {
        userRequirements: 'Test filtering',
        projectMetadata: { baseDir: testProjectDir }
      };

      // Act
      const environmentContext = await (promptAssemblyEngine as any).gatherEnvironmentContext(context);

      // Assert
      const fileNames = environmentContext.projectFiles.map((f: FileInfo) => f.name);
      expect(fileNames).not.toContain('.hidden');
      expect(fileNames).not.toContain('node_modules');
      expect(fileNames).not.toContain('.gitignore');
      
      // 但应该包含正常文件
      expect(fileNames).toContain('SRS.md');
      expect(fileNames).toContain('requirements.yaml');
    });

    test('应该正确排序文件列表（目录在前，然后按字母排序）', async () => {
      // Arrange
      process.chdir(testProjectDir);
      const context: SpecialistContext = {
        userRequirements: 'Test sorting',
        projectMetadata: { baseDir: testProjectDir }
      };

      // Act
      const environmentContext = await (promptAssemblyEngine as any).gatherEnvironmentContext(context);

      // Assert
      const files = environmentContext.projectFiles;
      
      // 找到第一个非目录文件的索引
      const firstFileIndex = files.findIndex((f: FileInfo) => !f.isDirectory);
      const lastDirIndex = files.findLastIndex((f: FileInfo) => f.isDirectory);
      
      // 所有目录应该在文件之前
      expect(firstFileIndex).toBeGreaterThan(lastDirIndex);
      
      // 目录内部应该按字母排序
      const directories = files.filter((f: FileInfo) => f.isDirectory);
      const dirNames = directories.map((d: FileInfo) => d.name);
      const sortedDirNames = [...dirNames].sort();
      expect(dirNames).toEqual(sortedDirNames);
      
      // 文件内部应该按字母排序
      const regularFiles = files.filter((f: FileInfo) => !f.isDirectory);
      const fileNames = regularFiles.map((f: FileInfo) => f.name);
      const sortedFileNames = [...fileNames].sort();
      expect(fileNames).toEqual(sortedFileNames);
    });
  });
});
