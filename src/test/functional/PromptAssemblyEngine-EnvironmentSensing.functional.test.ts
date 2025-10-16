/**
 * 环境感知功能功能测试
 * 测试环境感知功能在实际使用场景中的端到端行为
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PromptAssemblyEngine, SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';

describe('PromptAssemblyEngine - Environment Sensing Functional Tests', () => {
  let testProjectDir: string;
  let originalCwd: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
    
    // 创建复杂的测试项目结构，模拟真实的SRS项目
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'srs-functional-test-'));
    testProjectDir = tempDir;
    
    // 创建典型的SRS项目结构
    await fs.mkdir(path.join(testProjectDir, 'prototype'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'docs'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'assets'), { recursive: true });
    
    // 创建SRS相关文件
    await fs.writeFile(path.join(testProjectDir, 'SRS.md'), `# Software Requirements Specification
## 1. Introduction
## 2. Overall Description
## 3. Specific Requirements`);
    
    await fs.writeFile(path.join(testProjectDir, 'requirements.yaml'), `version: "1.0"
project_name: "E-commerce Platform"
modules:
  - user_management
  - product_catalog
  - shopping_cart`);
    
    await fs.writeFile(path.join(testProjectDir, 'source_draft.md'), `# Original Requirements
This is the brownfield source document.`);
    
    // 创建prototype文件
    await fs.writeFile(path.join(testProjectDir, 'prototype', 'index.html'), 
`<!DOCTYPE html>
<html>
<head><title>E-commerce Platform</title></head>
<body><h1>Welcome</h1></body>
</html>`);
    
    await fs.writeFile(path.join(testProjectDir, 'prototype', 'style.css'), 
`body { font-family: Arial, sans-serif; }
.header { background: #333; color: white; }`);
    
    await fs.writeFile(path.join(testProjectDir, 'prototype', 'script.js'), 
`document.addEventListener('DOMContentLoaded', function() {
  console.log('App loaded');
});`);
    
    // 创建文档文件
    await fs.writeFile(path.join(testProjectDir, 'docs', 'api.md'), '# API Documentation');
    await fs.writeFile(path.join(testProjectDir, 'docs', 'setup.md'), '# Setup Guide');
    
    // 创建README
    await fs.writeFile(path.join(testProjectDir, 'README.md'), 
`# E-commerce Platform
A comprehensive e-commerce solution.`);
    
    // 创建配置文件（应该被过滤）
    await fs.writeFile(path.join(testProjectDir, '.gitignore'), 'node_modules/\n*.log');
    await fs.mkdir(path.join(testProjectDir, 'node_modules'), { recursive: true });
    
    // 创建rules目录结构用于模板
    const rulesDir = path.join(testProjectDir, 'rules');
    await fs.mkdir(path.join(rulesDir, 'base'), { recursive: true });
    await fs.mkdir(path.join(rulesDir, 'specialists', 'content'), { recursive: true });
    await fs.mkdir(path.join(rulesDir, 'specialists', 'process'), { recursive: true });
    
    // 创建基础模板
    await fs.writeFile(path.join(rulesDir, 'base', 'output-format-schema.md'), 
`# Output Format Schema
All responses must be in JSON format with structuredData field.`);
    
    await fs.writeFile(path.join(rulesDir, 'base', 'quality-guidelines.md'), 
`# Quality Guidelines
- Use clear, concise language
- Follow industry standards`);
    
    // 创建specialist模板
    await fs.writeFile(path.join(rulesDir, 'specialists', 'content', 'prototype_designer.md'),
`---
specialist_config:
  enabled: true
  id: "prototype_designer"
  name: "Prototype Designer"
  category: "content"
  template_config:
    include_base:
      - "output-format-schema.md"
---

# Prototype Designer
You are a front-end prototype specialist.`);
    
    await fs.writeFile(path.join(rulesDir, 'specialists', 'process', 'project_initializer.md'),
`---
specialist_config:
  enabled: true
  id: "project_initializer"
  name: "Project Initializer"
  category: "process"
---

# Project Initializer
You initialize new SRS projects.`);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  describe('Real-world Usage Scenarios', () => {
    test('场景1: Content Specialist在项目根目录工作', async () => {
      // Arrange
      process.chdir(testProjectDir);
      const rulesDir = path.join(testProjectDir, 'rules');
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'prototype_designer', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: '为电商平台创建响应式原型设计',
        workflow_mode: 'greenfield',
        projectMetadata: { baseDir: testProjectDir },
        TOOLS_JSON_SCHEMA: JSON.stringify([
          { name: 'writeToFile', description: 'Write content to file' },
          { name: 'readFile', description: 'Read file content' }
        ])
      };

      // Act
      const assembledPrompt = await engine.assembleSpecialistPrompt(specialistType, context);

      // Assert - 验证环境信息的完整性和准确性
      expect(assembledPrompt).toContain('## 🌍 Environment Context');
      expect(assembledPrompt).toContain(`**Project Directory (Absolute Path)**: \`${testProjectDir}\``);
      
      // 验证项目文件列表的完整性
      expect(assembledPrompt).toContain('- ./SRS.md');
      expect(assembledPrompt).toContain('- ./requirements.yaml');
      expect(assembledPrompt).toContain('- ./source_draft.md');
      expect(assembledPrompt).toContain('- ./prototype (directory)');
      expect(assembledPrompt).toContain('- ./docs (directory)');
      expect(assembledPrompt).toContain('- ./README.md');
      
      // 验证过滤了不需要的文件
      expect(assembledPrompt).not.toContain('.gitignore');
      expect(assembledPrompt).not.toContain('node_modules');
      
      // 不应该包含 Current Directory Files
      expect(assembledPrompt).not.toContain('**Current Directory Files (Relative to baseDir)**:');
    });

    test('场景2: Content Specialist忽略process.cwd并只从baseDir读取', async () => {
      // Arrange
      // 改变工作目录到子目录，验证系统忽略它
      const prototypeDir = path.join(testProjectDir, 'prototype');
      process.chdir(prototypeDir);
      
      const rulesDir = path.join(testProjectDir, 'rules');
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'prototype_designer', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: '优化现有的HTML原型',
        workflow_mode: 'brownfield',
        projectMetadata: { baseDir: testProjectDir },
        TOOLS_JSON_SCHEMA: JSON.stringify([
          { name: 'writeToFile', description: 'Write content to file' },
          { name: 'readFile', description: 'Read file content' },
          { name: 'listFiles', description: 'List directory files' }
        ])
      };

      // Act
      const assembledPrompt = await engine.assembleSpecialistPrompt(specialistType, context);

      // Assert
      expect(assembledPrompt).toContain('## 🌍 Environment Context');
      expect(assembledPrompt).toContain(`**Project Directory (Absolute Path)**: \`${testProjectDir}\``);
      
      // 验证只显示项目根目录的文件（忽略process.cwd）
      expect(assembledPrompt).toContain('- ./SRS.md');
      expect(assembledPrompt).toContain('- ./requirements.yaml');
      expect(assembledPrompt).toContain('- ./prototype (directory)');
      
      // 不应该包含子目录中的文件（因为不再读取 currentDirectory）
      expect(assembledPrompt).not.toContain('- ./prototype/index.html');
      expect(assembledPrompt).not.toContain('**Current Directory Files (Relative to baseDir)**:');
    });

    test('场景3: Process Specialist执行项目初始化', async () => {
      // Arrange
      process.chdir(testProjectDir);
      
      const rulesDir = path.join(testProjectDir, 'rules');
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'project_initializer', category: 'process' as const };
      const context: SpecialistContext = {
        userRequirements: '初始化一个新的电商平台SRS项目',
        workflow_mode: 'greenfield',
        projectMetadata: { baseDir: testProjectDir },
        TOOLS_JSON_SCHEMA: JSON.stringify([
          { name: 'createNewProjectFolder', description: 'Create new project folder' },
          { name: 'writeToFile', description: 'Write content to file' },
          { name: 'createDirectory', description: 'Create directory' }
        ])
      };

      // Act
      const assembledPrompt = await engine.assembleSpecialistPrompt(specialistType, context);

      // Assert
      expect(assembledPrompt).toContain('## 🌍 Environment Context');
      
      // Process specialist也应该能看到完整的项目环境
      expect(assembledPrompt).toContain('- ./SRS.md');
      expect(assembledPrompt).toContain('- ./requirements.yaml');
      expect(assembledPrompt).toContain('- ./prototype (directory)');
      
      // 验证环境信息能帮助Process specialist理解当前项目状态
      // 例如，如果看到已经有SRS.md，就知道这不是一个全新的项目
      expect(assembledPrompt).toContain(`**Project Directory (Absolute Path)**: \`${testProjectDir}\``);
    });

    test('场景4: 处理复杂目录结构的文件排序和过滤', async () => {
      // Arrange
      process.chdir(testProjectDir);
      
      const rulesDir = path.join(testProjectDir, 'rules');
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'prototype_designer', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: '分析项目结构',
        projectMetadata: { baseDir: testProjectDir }
      };

      // Act
      const assembledPrompt = await engine.assembleSpecialistPrompt(specialistType, context);

      // Assert
      const projectFilesStart = assembledPrompt.indexOf('**Project Files (Relative to baseDir)**:');
      const nextSection = assembledPrompt.indexOf('## ', projectFilesStart + 1);
      const projectFilesSection = assembledPrompt.substring(projectFilesStart, nextSection);
      
      // 验证文件排序：目录在前，然后按字母排序
      const lines = projectFilesSection.split('\n').filter(line => line.startsWith('- ./'));
      const directories = lines.filter(line => line.includes('(directory)'));
      const files = lines.filter(line => !line.includes('(directory)'));
      
      // 目录应该在文件之前
      expect(directories.length).toBeGreaterThan(0);
      expect(files.length).toBeGreaterThan(0);
      
      // 验证目录按字母排序
      const dirNames = directories.map(d => d.match(/- \.\/(.+?) \(directory\)/)?.[1] || '');
      const sortedDirNames = [...dirNames].sort();
      expect(dirNames).toEqual(sortedDirNames);
      
      // 验证文件按字母排序
      const fileNames = files.map(f => f.match(/- \.\/(.+)$/)?.[1] || '');
      const sortedFileNames = [...fileNames].sort();
      expect(fileNames).toEqual(sortedFileNames);
    });

    test('场景5: 环境信息应该提供足够的上下文帮助AI做决策', async () => {
      // Arrange
      process.chdir(testProjectDir);
      
      const rulesDir = path.join(testProjectDir, 'rules');
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'prototype_designer', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: '我需要创建登录页面的原型',
        projectMetadata: { baseDir: testProjectDir },
        TOOLS_JSON_SCHEMA: JSON.stringify([
          { name: 'writeToFile', description: 'Write content to file' },
          { name: 'readFile', description: 'Read file content' }
        ])
      };

      // Act
      const assembledPrompt = await engine.assembleSpecialistPrompt(specialistType, context);

      // Assert
      // AI应该能够从环境信息中了解：
      
      // 1. 项目已经有了基础结构
      expect(assembledPrompt).toContain('- ./SRS.md');
      expect(assembledPrompt).toContain('- ./requirements.yaml');
      
      // 2. 有现有的prototype目录，可能已经有一些原型文件
      expect(assembledPrompt).toContain('- ./prototype (directory)');
      
      // 3. 有需求文档，可以参考
      expect(assembledPrompt).toContain('- ./requirements.yaml');
      
      // 4. 完整的工具列表，知道可以使用什么工具
      expect(assembledPrompt).toContain('writeToFile');
      expect(assembledPrompt).toContain('readFile');
      
      // 验证结构化信息的组织
      expect(assembledPrompt).toContain('**# 6. DYNAMIC CONTEXT**');
      expect(assembledPrompt).toContain('## 🌍 Environment Context');
      expect(assembledPrompt).toContain('**# 8. YOUR TOOLS LIST**');
      
      // 这些信息组合在一起应该让AI知道：
      // - 这是一个现有项目（不是从零开始）
      // - 有prototype目录可以直接使用
      // - 可以读取requirements.yaml了解需求
      // - 可以使用writeToFile创建新的原型文件
    });

    test('场景6: 验证环境信息在多次调用间的一致性', async () => {
      // Arrange
      process.chdir(testProjectDir);
      
      const rulesDir = path.join(testProjectDir, 'rules');
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const baseContext: SpecialistContext = {
        userRequirements: '测试一致性',
        projectMetadata: { baseDir: testProjectDir }
      };

      // Act - 多次调用相同的specialist
      const result1 = await engine.assembleSpecialistPrompt(
        { name: 'prototype_designer', category: 'content' }, 
        baseContext
      );
      
      const result2 = await engine.assembleSpecialistPrompt(
        { name: 'prototype_designer', category: 'content' }, 
        baseContext
      );

      // Assert - 环境信息应该保持一致
      const extractEnvironmentContext = (prompt: string) => {
        const start = prompt.indexOf('## 🌍 Environment Context');
        const end = prompt.indexOf('## Current Step', start);
        return prompt.substring(start, end);
      };
      
      const env1 = extractEnvironmentContext(result1);
      const env2 = extractEnvironmentContext(result2);
      
      expect(env1).toBe(env2);
      
      // 验证关键信息一致
      expect(result1).toContain(`**Project Directory (Absolute Path)**: \`${testProjectDir}\``);
      expect(result2).toContain(`**Project Directory (Absolute Path)**: \`${testProjectDir}\``);
      
      const extractFileList = (prompt: string, section: string) => {
        const start = prompt.indexOf(section);
        const end = prompt.indexOf('**', start + section.length);
        return prompt.substring(start, end);
      };
      
      const files1 = extractFileList(result1, '**Project Files (Relative to baseDir)**:');
      const files2 = extractFileList(result2, '**Project Files (Relative to baseDir)**:');
      expect(files1).toBe(files2);
    });
  });
});
