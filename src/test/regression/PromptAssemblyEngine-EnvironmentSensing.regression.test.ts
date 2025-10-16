/**
 * 环境感知功能回归测试
 * 确保新增的环境感知功能不会破坏现有的提示词组装功能
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PromptAssemblyEngine, SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';

describe('PromptAssemblyEngine - Environment Sensing Regression Tests', () => {
  let testProjectDir: string;
  let rulesDir: string;
  let originalCwd: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
    
    // 创建测试环境
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'srs-regression-test-'));
    testProjectDir = tempDir;
    rulesDir = path.join(testProjectDir, 'rules');
    
    // 创建完整的rules目录结构
    await fs.mkdir(path.join(rulesDir, 'base'), { recursive: true });
    await fs.mkdir(path.join(rulesDir, 'specialists', 'content'), { recursive: true });
    await fs.mkdir(path.join(rulesDir, 'specialists', 'process'), { recursive: true });
    
    // 创建所有基础模板
    await fs.writeFile(path.join(rulesDir, 'base', 'common-role-definition.md'), 
`# Role Definition
You are a professional software requirements specialist.`);
    
    await fs.writeFile(path.join(rulesDir, 'base', 'output-format-schema.md'), 
`# Output Format Schema
All responses must contain structuredData field in JSON format.

Expected format:
\`\`\`json
{
  "structuredData": {
    "success": true,
    "content": "...",
    "metadata": {}
  }
}
\`\`\``);
    
    await fs.writeFile(path.join(rulesDir, 'base', 'quality-guidelines.md'), 
`# Quality Guidelines
- Use professional language
- Follow IEEE standards
- Maintain consistency`);
    
    await fs.writeFile(path.join(rulesDir, 'base', 'boundary-constraints.md'), 
`# Boundary Constraints
- Stay within your specialist domain
- Don't modify files outside your scope`);
    
    await fs.writeFile(path.join(rulesDir, 'base', 'content-specialist-workflow.md'), 
`# Content Specialist Workflow
1. Analyze requirements
2. Generate content
3. Validate output`);
    
    // 创建specialist模板
    await fs.writeFile(path.join(rulesDir, 'specialists', 'content', 'test_content_specialist.md'),
`---
specialist_config:
  enabled: true
  id: "test_content_specialist"
  name: "Test Content Specialist"
  category: "content"
  version: "1.0.0"
  template_config:
    include_base:
      - "output-format-schema.md"
      - "quality-guidelines.md"
    exclude_base:
      - "boundary-constraints.md"
---

# Test Content Specialist
You are a test content specialist for regression testing.

## Your Role
Generate test content based on requirements.

## Output Requirements
Always provide structured JSON output.`);
    
    await fs.writeFile(path.join(rulesDir, 'specialists', 'process', 'test_process_specialist.md'),
`---
specialist_config:
  enabled: true
  id: "test_process_specialist"
  name: "Test Process Specialist"
  category: "process"
  version: "1.0.0"
  template_config:
    exclude_base:
      - "content-specialist-workflow.md"
---

# Test Process Specialist
You are a test process specialist for regression testing.

## Your Role
Handle process-related tasks.`);
    
    // 创建项目文件
    await fs.writeFile(path.join(testProjectDir, 'SRS.md'), '# Test SRS Document');
    await fs.writeFile(path.join(testProjectDir, 'requirements.yaml'), 'version: 1.0\nproject: regression-test');
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  describe('Backward Compatibility', () => {
    test('应该保持原有的9部分提示词结构', async () => {
      // Arrange
      process.chdir(testProjectDir);
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'test_content_specialist', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Test backward compatibility',
        projectMetadata: { baseDir: testProjectDir },
        TOOLS_JSON_SCHEMA: JSON.stringify([{ name: 'test_tool' }])
      };

      // Act
      const result = await engine.assembleSpecialistPrompt(specialistType, context);

      // Assert - 验证所有9个标准部分仍然存在
      const expectedSections = [
        '**# 0. YOUR PREVIOUS THOUGHTS**',
        '**# 1. SPECIALIST INSTRUCTIONS**',
        '**# 2. CURRENT TASK**',
        '**# 3. LATEST RESPONSE FROM USER**',
        '**# 4. TABLE OF CONTENTS OF CURRENT SRS**',
        '**# 5. TEMPLATE FOR YOUR CHAPTERS**',
        '**# 6. DYNAMIC CONTEXT**',
        '**# 7. GUIDELINES AND SAMPLE OF TOOLS USING**',
        '**# 8. YOUR TOOLS LIST**',
        '**# 9. FINAL INSTRUCTION**'
      ];

      expectedSections.forEach(section => {
        expect(result).toContain(section);
      });

      // 验证Table of Contents仍然正确
      expect(result).toContain('Table of Contents:');
      expect(result).toContain('0. YOUR PREVIOUS THOUGHTS');
      expect(result).toContain('1. SPECIALIST INSTRUCTIONS');
      expect(result).toContain('9. FINAL INSTRUCTION');
    });

    test('应该保持原有的模板配置解析功能', async () => {
      // Arrange
      process.chdir(testProjectDir);
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'test_content_specialist', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Test template config',
        projectMetadata: { baseDir: testProjectDir },
        TOOLS_JSON_SCHEMA: '[]'
      };

      // Act
      const result = await engine.assembleSpecialistPrompt(specialistType, context);

      // Assert - 验证模板配置仍然正确工作
      // 应该包含 output-format-schema.md 和 quality-guidelines.md
      expect(result).toContain('structuredData field in JSON format');
      expect(result).toContain('Use professional language');
      
      // 应该排除 boundary-constraints.md
      expect(result).not.toContain('Stay within your specialist domain');
    });

    test('应该保持原有的变量替换功能', async () => {
      // Arrange
      process.chdir(testProjectDir);
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'test_content_specialist', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Test variable replacement',
        projectMetadata: { baseDir: testProjectDir },
        TEST_VARIABLE: 'Test Value',
        structuredContext: {
          ANOTHER_VARIABLE: 'Another Value'
        },
        TOOLS_JSON_SCHEMA: '[]'
      };

      // 创建一个包含变量的临时模板
      await fs.writeFile(path.join(rulesDir, 'specialists', 'content', 'variable_test.md'),
`---
specialist_config:
  enabled: true
  id: "variable_test"
  name: "Variable Test"
  category: "content"
---

# Variable Test Specialist
Test variable: {{TEST_VARIABLE}}
Another variable: {{ANOTHER_VARIABLE}}
Non-existent: {{NON_EXISTENT}}`);

      // Act
      const result = await engine.assembleSpecialistPrompt(
        { name: 'variable_test', category: 'content' }, 
        context
      );

      // Assert - 验证变量替换仍然工作
      expect(result).toContain('Test variable: Test Value');
      expect(result).toContain('Another variable: Another Value');
      expect(result).toContain('Non-existent: {{NON_EXISTENT}}'); // 未找到的变量应该保持原样
    });

    test('应该保持原有的SRS内容加载功能', async () => {
      // Arrange
      process.chdir(testProjectDir);
      
      // 创建SRS文件，包含标题结构
      await fs.writeFile(path.join(testProjectDir, 'SRS.md'), 
`# Software Requirements Specification
## 1. Introduction
### 1.1 Purpose
### 1.2 Scope
## 2. Overall Description
### 2.1 Product Perspective
## 3. Specific Requirements`);
      
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'test_content_specialist', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Test SRS loading',
        projectMetadata: { baseDir: testProjectDir },
        TOOLS_JSON_SCHEMA: '[]'
      };

      // Act
      const result = await engine.assembleSpecialistPrompt(specialistType, context);

      // Assert - 验证SRS TOC仍然正确加载
      expect(result).toContain('**# 4. TABLE OF CONTENTS OF CURRENT SRS**');
      // SRS TOC应该包含层级结构
      expect(result).toContain('# Software Requirements Specification  SID: ');
      expect(result).toContain('## 1. Introduction  SID: ');
      expect(result).toContain('### 1.1 Purpose  SID: ');
    });

    test('应该保持原有的最终指令格式', async () => {
      // Arrange
      process.chdir(testProjectDir);
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'test_content_specialist', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Test final instruction',
        projectMetadata: { baseDir: testProjectDir },
        TOOLS_JSON_SCHEMA: '[]'
      };

      // Act
      const result = await engine.assembleSpecialistPrompt(specialistType, context);

      // Assert - 验证最终指令格式不变
      expect(result).toContain('**# 9. FINAL INSTRUCTION**');
      expect(result).toContain('Based on all the instructions and context above, generate a valid JSON object');
      expect(result).toContain('**CRITICAL: Your entire response MUST be a single JSON object');
      expect(result).toContain('starting with `{` and ending with `}`');
    });
  });

  describe('Performance Impact', () => {
    test('新增环境感知功能不应显著影响性能', async () => {
      // Arrange
      process.chdir(testProjectDir);
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'test_content_specialist', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Performance test',
        projectMetadata: { baseDir: testProjectDir },
        TOOLS_JSON_SCHEMA: '[]'
      };

      // Act & Assert - 测试性能
      const startTime = Date.now();
      
      const result = await engine.assembleSpecialistPrompt(specialistType, context);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 验证功能正常
      expect(result).toContain('## 🌍 Environment Context');
      expect(result).toContain('**# 9. FINAL INSTRUCTION**');
      
      // 验证性能影响合理（应该在几秒内完成）
      expect(duration).toBeLessThan(5000); // 5秒内
      
      // 多次调用测试一致性
      const startTime2 = Date.now();
      const result2 = await engine.assembleSpecialistPrompt(specialistType, context);
      const endTime2 = Date.now();
      const duration2 = endTime2 - startTime2;
      
      expect(duration2).toBeLessThan(5000);
      
      // 环境信息部分应该一致
      const extractEnvContext = (prompt: string) => {
        const start = prompt.indexOf('## 🌍 Environment Context');
        const end = prompt.indexOf('## Current Step', start);
        return prompt.substring(start, end);
      };
      
      expect(extractEnvContext(result)).toBe(extractEnvContext(result2));
    });

    test('应该正确处理大量文件的项目', async () => {
      // Arrange - 创建包含大量文件的测试项目
      const largeProjectDir = path.join(testProjectDir, 'large-project');
      await fs.mkdir(largeProjectDir, { recursive: true });
      
      // 创建多个目录和文件
      for (let i = 0; i < 20; i++) {
        await fs.mkdir(path.join(largeProjectDir, `subdir-${i}`), { recursive: true });
        await fs.writeFile(path.join(largeProjectDir, `file-${i}.md`), `# File ${i}`);
        await fs.writeFile(path.join(largeProjectDir, `subdir-${i}`, `nested-${i}.txt`), `Content ${i}`);
      }
      
      process.chdir(largeProjectDir);
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'test_content_specialist', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Handle large project',
        projectMetadata: { baseDir: largeProjectDir },
        TOOLS_JSON_SCHEMA: '[]'
      };

      // Act
      const startTime = Date.now();
      const result = await engine.assembleSpecialistPrompt(specialistType, context);
      const endTime = Date.now();

      // Assert
      expect(result).toContain('## 🌍 Environment Context');
      
      // 验证文件列表包含创建的文件
      expect(result).toContain('- ./file-0.md');
      expect(result).toContain('- ./subdir-0 (directory)');
      
      // 验证性能仍然可接受
      expect(endTime - startTime).toBeLessThan(10000); // 10秒内
      
      // 验证文件排序正确（目录在前）
      const projectFilesStart = result.indexOf('**Project Files (Relative to baseDir)**:');
      const nextSection = result.indexOf('## ', projectFilesStart + 1);
      const projectFilesSection = result.substring(projectFilesStart, nextSection);
      
      const lines = projectFilesSection.split('\n').filter(line => line.startsWith('- ./'));
      const directories = lines.filter(line => line.includes('(directory)'));
      const files = lines.filter(line => !line.includes('(directory)'));
      
      // 应该有20个目录和20个文件
      expect(directories.length).toBe(20);
      expect(files.length).toBe(20);
    });
  });

  describe('Error Handling Regression', () => {
    test('应该优雅处理无效的baseDir', async () => {
      // Arrange
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'test_content_specialist', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Test invalid baseDir',
        projectMetadata: { baseDir: '/non/existent/directory' },
        TOOLS_JSON_SCHEMA: '[]'
      };

      // Act & Assert - 不应该抛出异常
      await expect(engine.assembleSpecialistPrompt(specialistType, context)).resolves.toBeDefined();
      
      const result = await engine.assembleSpecialistPrompt(specialistType, context);
      
      // 验证基本结构仍然完整
      expect(result).toContain('**# 9. FINAL INSTRUCTION**');
      expect(result).toContain('## 🌍 Environment Context');
      
      // 环境信息应该显示为不可用或空
      expect(result).toContain('- No files found in project directory');
    });

    test('应该处理缺少projectMetadata的情况', async () => {
      // Arrange
      const engine = new PromptAssemblyEngine(rulesDir);
      
      const specialistType = { name: 'test_content_specialist', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Test missing metadata',
        // 没有 projectMetadata
        TOOLS_JSON_SCHEMA: '[]'
      };

      // Act & Assert
      const result = await engine.assembleSpecialistPrompt(specialistType, context);
      
      // 验证不会崩溃，且基本结构完整
      expect(result).toContain('**# 9. FINAL INSTRUCTION**');
      expect(result).toContain('## 🌍 Environment Context');
      expect(result).toContain('Environment context not available');
    });

    test('应该保持原有的错误处理机制', async () => {
      // Arrange
      const engine = new PromptAssemblyEngine('/non/existent/rules/path');
      
      const specialistType = { name: 'non_existent_specialist', category: 'content' as const };
      const context: SpecialistContext = {
        userRequirements: 'Test error handling',
        projectMetadata: { baseDir: testProjectDir },
        TOOLS_JSON_SCHEMA: '[]'
      };

      // Act & Assert - 应该抛出适当的错误
      await expect(engine.assembleSpecialistPrompt(specialistType, context))
        .rejects.toThrow(/Failed to assemble prompt/);
    });
  });
});
