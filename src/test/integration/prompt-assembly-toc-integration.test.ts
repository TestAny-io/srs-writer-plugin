/**
 * 🚀 PromptAssemblyEngine ToC集成测试
 * 
 * 测试PromptAssemblyEngine中readMarkdownFile ToC模式的集成功能
 * 包括成功场景、错误处理、边界情况等
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PromptAssemblyEngine, SpecialistType, SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';
import { 
  readMarkdownFile, 
  EnhancedReadFileResult, 
  TableOfContentsToCNode
} from '../../tools/document/enhanced-readfile-tools';

// 模拟readMarkdownFile工具
jest.mock('../../tools/document/enhanced-readfile-tools', () => ({
  readMarkdownFile: jest.fn()
}));
const mockReadMarkdownFile = readMarkdownFile as jest.MockedFunction<typeof readMarkdownFile>;

// Helper函数：创建完整的mock结果
function createMockResult(
  tableOfContentsToCTree: TableOfContentsToCNode[],
  hasError: boolean = false,
  errorMessage?: string
): EnhancedReadFileResult {
  const baseResult: EnhancedReadFileResult = {
    success: !hasError,
    path: 'test.md',
    resolvedPath: '/test/test.md',
    lastModified: new Date(),
    size: 1000,
    results: [],
    parseTime: 10,
    cacheHit: false,
    tableOfContentsToCTree
  };

  if (hasError && errorMessage) {
    baseResult.error = {
      code: 'FILE_NOT_FOUND' as any,
      message: errorMessage
    };
  }

  return baseResult;
}

// Helper函数：创建ToC节点
function createToCNode(
  sid: string,
  title: string,
  level: number,
  children: TableOfContentsToCNode[] = []
): TableOfContentsToCNode {
  return {
    sid,
    displayId: '1',
    title,
    level,
    characterCount: title.length,
    children
  };
}

describe('PromptAssemblyEngine ToC Integration', () => {
  let promptAssemblyEngine: PromptAssemblyEngine;
  let testTempDir: string;
  
  beforeEach(async () => {
    // 创建临时测试目录
    testTempDir = path.join(__dirname, '../temp/prompt-assembly-toc-test');
    await fs.mkdir(testTempDir, { recursive: true });
    
    // 初始化PromptAssemblyEngine
    promptAssemblyEngine = new PromptAssemblyEngine(testTempDir);
    
    // 重置mock
    mockReadMarkdownFile.mockReset();
  });

  afterEach(async () => {
    // 清理临时目录
    try {
      await fs.rm(testTempDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('SRS ToC加载功能', () => {
    it('应该成功加载SRS.md的目录结构', async () => {
      // 准备测试数据
      const tocTree = [
        createToCNode('/this-is-a-srs-document', 'This is a srs document', 1, [
          createToCNode('/executive-summary', 'executive summary', 2),
          createToCNode('/overall-description', 'overall description', 2, [
            createToCNode('/in-scope', 'in-scope', 3),
            createToCNode('/out-of-scope', 'out-of-scope', 3)
          ])
        ])
      ];

      const mockToCResult = createMockResult(tocTree);
      mockReadMarkdownFile.mockResolvedValue(mockToCResult);

      // 创建测试context
      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: testTempDir
        }
      };

      const specialistType: SpecialistType = {
        name: 'test_specialist',
        category: 'content'
      };

      // 执行测试
      const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      // 验证readMarkdownFile被正确调用
      expect(mockReadMarkdownFile).toHaveBeenCalledWith({
        path: 'SRS.md',
        parseMode: 'toc'
      });

      // 验证context中设置了正确的ToC内容
      expect(context.SRS_TOC).toBeDefined();
      expect(context.CURRENT_SRS_TOC).toBeDefined();
      expect(context.SRS_TOC).toBe(context.CURRENT_SRS_TOC);

      // 验证ToC格式
      const expectedToC = [
        '# This is a srs document  SID: /this-is-a-srs-document',
        '## executive summary  SID: /executive-summary',
        '## overall description  SID: /overall-description',
        '### in-scope  SID: /in-scope',
        '### out-of-scope  SID: /out-of-scope'
      ].join('\n');

      expect(context.SRS_TOC).toBe(expectedToC);

      // 验证提示词包含正确的ToC内容（已经被替换）
      expect(result).toContain('# This is a srs document  SID: /this-is-a-srs-document');
      expect(result).toContain('## executive summary  SID: /executive-summary');
    });

    it('应该尝试多个可能的SRS文件路径', async () => {
      // 第一次调用失败，第二次成功
      const failureResult = createMockResult([], true, 'File not found');
      const successResult = createMockResult([
        createToCNode('/test-document', 'Test Document', 1)
      ]);
      
      mockReadMarkdownFile
        .mockResolvedValueOnce(failureResult)  // SRS.md失败
        .mockResolvedValueOnce(successResult); // srs.md成功

      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: testTempDir
        }
      };

      const specialistType: SpecialistType = {
        name: 'test_specialist',
        category: 'content'
      };

      await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      // 验证两次调用
      expect(mockReadMarkdownFile).toHaveBeenCalledTimes(2);
      expect(mockReadMarkdownFile).toHaveBeenNthCalledWith(1, {
        path: 'SRS.md',
        parseMode: 'toc'
      });
      expect(mockReadMarkdownFile).toHaveBeenNthCalledWith(2, {
        path: 'srs.md',
        parseMode: 'toc'
      });

      // 验证最终设置了正确内容
      expect(context.SRS_TOC).toBe('# Test Document  SID: /test-document');
    });

    it('应该处理空的目录结构', async () => {
      const emptyResult = createMockResult([]);
      mockReadMarkdownFile.mockResolvedValue(emptyResult);

      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: testTempDir
        }
      };

      const specialistType: SpecialistType = {
        name: 'test_specialist',
        category: 'content'
      };

      await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      // 应该继续尝试下一个文件
      expect(mockReadMarkdownFile).toHaveBeenCalledTimes(4); // 尝试所有4个可能的路径
      expect(context.SRS_TOC).toBe('');
      expect(context.CURRENT_SRS_TOC).toBe('');
    });

    it('应该处理readMarkdownFile工具抛出的异常', async () => {
      mockReadMarkdownFile.mockRejectedValue(new Error('Parse error'));

      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: testTempDir
        }
      };

      const specialistType: SpecialistType = {
        name: 'test_specialist',
        category: 'content'
      };

      // 应该不抛出异常
      await expect(promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context)).resolves.toBeDefined();

      // 验证设置了默认空值
      expect(context.SRS_TOC).toBe('');
      expect(context.CURRENT_SRS_TOC).toBe('');
    });

    it('应该处理没有baseDir的情况', async () => {
      const context: SpecialistContext = {
        projectMetadata: undefined
      };

      const specialistType: SpecialistType = {
        name: 'test_specialist',
        category: 'content'
      };

      await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      // 不应该调用readMarkdownFile
      expect(mockReadMarkdownFile).not.toHaveBeenCalled();

      // 应该没有设置ToC字段
      expect(context.SRS_TOC).toBeUndefined();
      expect(context.CURRENT_SRS_TOC).toBeUndefined();
    });
  });

  describe('ToC格式转换功能', () => {
    it('应该正确转换复杂的嵌套结构', async () => {
      const complexToCTree = [
        createToCNode('/introduction', 'Introduction', 1, [
          createToCNode('/purpose', 'Purpose', 2),
          createToCNode('/scope', 'Scope', 2, [
            createToCNode('/in-scope', 'In Scope', 3, [
              createToCNode('/functional-requirements', 'Functional Requirements', 4)
            ]),
            createToCNode('/out-of-scope', 'Out of Scope', 3)
          ])
        ]),
        createToCNode('/system-overview', 'System Overview', 1)
      ];

      const complexToCResult = createMockResult(complexToCTree);
      mockReadMarkdownFile.mockResolvedValue(complexToCResult);

      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: testTempDir
        }
      };

      const specialistType: SpecialistType = {
        name: 'test_specialist',
        category: 'content'
      };

      await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      const expectedToC = [
        '# Introduction  SID: /introduction',
        '## Purpose  SID: /purpose',
        '## Scope  SID: /scope',
        '### In Scope  SID: /in-scope',
        '#### Functional Requirements  SID: /functional-requirements',
        '### Out of Scope  SID: /out-of-scope',
        '# System Overview  SID: /system-overview'
      ].join('\n');

      expect(context.SRS_TOC).toBe(expectedToC);
    });

    it('应该正确处理特殊字符和空格', async () => {
      const specialCharToCTree = [
        createToCNode('/special-chars-test', 'Special Chars & Test (v2.0)', 1, [
          createToCNode('/multi-word-title', 'Multi Word Title', 2)
        ])
      ];

      const specialCharToCResult = createMockResult(specialCharToCTree);
      mockReadMarkdownFile.mockResolvedValue(specialCharToCResult);

      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: testTempDir
        }
      };

      const specialistType: SpecialistType = {
        name: 'test_specialist',
        category: 'content'
      };

      await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      const expectedToC = [
        '# Special Chars & Test (v2.0)  SID: /special-chars-test',
        '## Multi Word Title  SID: /multi-word-title'
      ].join('\n');

      expect(context.SRS_TOC).toBe(expectedToC);
    });
  });

  describe('requirements.yaml集成测试', () => {
    it('应该继续加载requirements.yaml文件', async () => {
      // Mock SRS ToC成功
      const successResult = createMockResult([
        createToCNode('/test', 'Test', 1)
      ]);
      mockReadMarkdownFile.mockResolvedValue(successResult);

      // 创建测试requirements.yaml文件
      const testYamlContent = 'test: yaml content';
      await fs.writeFile(path.join(testTempDir, 'requirements.yaml'), testYamlContent);

      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: testTempDir
        }
      };

      const specialistType: SpecialistType = {
        name: 'test_specialist',
        category: 'content'
      };

      await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      // 验证两个功能都正常工作
      expect(context.SRS_TOC).toBe('# Test  SID: /test');
      expect(context.REQUIREMENTS_YAML_CONTENT).toBe(testYamlContent);
      expect(context.CURRENT_REQUIREMENTS_YAML).toBe(testYamlContent);
    });
  });

  describe('非content specialist测试', () => {
    it('process specialist中的requirement_syncer应该加载SRS ToC', async () => {
      const successResult = createMockResult([
        createToCNode('/test', 'Test', 1)
      ]);
      mockReadMarkdownFile.mockResolvedValue(successResult);

      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: testTempDir
        }
      };

      const specialistType: SpecialistType = {
        name: 'requirement_syncer',
        category: 'process'
      };

      await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      expect(mockReadMarkdownFile).toHaveBeenCalled();
      expect(context.SRS_TOC).toBe('# Test  SID: /test');
    });

    it('其他process specialist不应该加载SRS ToC', async () => {
      const context: SpecialistContext = {
        projectMetadata: {
          baseDir: testTempDir
        }
      };

      const specialistType: SpecialistType = {
        name: 'other_process_specialist',
        category: 'process'
      };

      await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);

      expect(mockReadMarkdownFile).not.toHaveBeenCalled();
      expect(context.SRS_TOC).toBeUndefined();
    });
  });
});
