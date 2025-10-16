/**
 * FindInFiles工具单元测试
 * 测试所有核心组件的功能正确性
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PatternMatcher } from '../../tools/atomic/findInFiles/PatternMatcher';
import { FileScanner } from '../../tools/atomic/findInFiles/FileScanner';
import { ResultFormatter } from '../../tools/atomic/findInFiles/ResultFormatter';
import { SimpleErrorHandler } from '../../tools/atomic/findInFiles/SimpleErrorHandler';
import { FindInFilesEngine } from '../../tools/atomic/findInFiles/FindInFilesEngine';
import { findInFiles } from '../../tools/atomic/smart-edit-tools';
import {
  FindInFilesArgs,
  FindInFilesResult,
  PatternCompileOptions,
  FileSearchResult,
  FindInFilesError,
  FindInFilesErrorType
} from '../../tools/atomic/findInFiles/types';

// Mock fs 模块
jest.mock('fs/promises');
const mockedFs = jest.mocked(fs);

// Mock vscode 模块
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
  },
  window: {
    activeTextEditor: undefined
  }
}));

describe('FindInFiles - Unit Tests', () => {

  describe('PatternMatcher', () => {
    let patternMatcher: PatternMatcher;

    beforeEach(() => {
      patternMatcher = new PatternMatcher();
    });

    describe('文本模式匹配', () => {
      test('应该正确匹配简单文本', () => {
        // Arrange
        const options: PatternCompileOptions = {
          pattern: 'function',
          regex: false,
          caseSensitive: false
        };

        // Act
        const compiled = patternMatcher.compile(options);
        const testText = 'export function test() {}';

        // Assert
        expect(compiled.type).toBe('text');
        expect(compiled.test(testText)).toBe(true);
        expect(compiled.test('no match here')).toBe(false);
      });

      test('应该支持大小写敏感匹配', () => {
        // Arrange
        const caseSensitiveOptions: PatternCompileOptions = {
          pattern: 'Function',
          regex: false,
          caseSensitive: true
        };
        const caseInsensitiveOptions: PatternCompileOptions = {
          pattern: 'Function',
          regex: false,
          caseSensitive: false
        };

        // Act
        const caseSensitive = patternMatcher.compile(caseSensitiveOptions);
        const caseInsensitive = patternMatcher.compile(caseInsensitiveOptions);
        const testText = 'export function test() {}';

        // Assert
        expect(caseSensitive.test(testText)).toBe(false);
        expect(caseInsensitive.test(testText)).toBe(true);
      });

      test('应该正确返回所有匹配位置', () => {
        // Arrange
        const options: PatternCompileOptions = {
          pattern: 'test',
          regex: false,
          caseSensitive: false
        };

        // Act
        const compiled = patternMatcher.compile(options);
        const testText = 'test function\nthis is a test\nanother test here';
        const matches = compiled.findAll(testText);

        // Assert
        expect(matches).toHaveLength(3);
        expect(matches[0].line).toBe(1);
        expect(matches[0].column).toBe(1);
        expect(matches[1].line).toBe(2);
        expect(matches[2].line).toBe(3);
      });
    });

    describe('正则模式匹配', () => {
      test('应该正确编译和匹配正则表达式', () => {
        // Arrange
        const options: PatternCompileOptions = {
          pattern: 'function\\s+\\w+',
          regex: true,
          caseSensitive: false
        };

        // Act
        const compiled = patternMatcher.compile(options);
        const testText = 'export function testFunc() {}';

        // Assert
        expect(compiled.type).toBe('regex');
        expect(compiled.test(testText)).toBe(true);
        expect(compiled.test('const variable = 5')).toBe(false);
      });

      test('应该处理无效正则表达式', () => {
        // Arrange
        const options: PatternCompileOptions = {
          pattern: '[unclosed',
          regex: true,
          caseSensitive: false
        };

        // Act & Assert
        expect(() => patternMatcher.compile(options)).toThrow(FindInFilesError);
      });

      test('应该正确处理复杂正则匹配', () => {
        // Arrange  
        const options: PatternCompileOptions = {
          pattern: 'class\\s+(\\w+)\\s+extends\\s+(\\w+)',
          regex: true,
          caseSensitive: false
        };

        // Act
        const compiled = patternMatcher.compile(options);
        const testText = 'export class MyClass extends BaseClass {\n  constructor() {}\n}';
        const matches = compiled.findAll(testText);

        // Assert
        expect(matches).toHaveLength(1);
        expect(matches[0].line).toBe(1);
        expect(matches[0].match).toContain('MyClass extends BaseClass');
      });
    });
  });

  describe('FileScanner', () => {
    let fileScanner: FileScanner;

    beforeEach(() => {
      fileScanner = new FileScanner();
      jest.clearAllMocks();
    });

    test('应该正确处理单文件', async () => {
      // Arrange
      const testFilePath = '/test/file.ts';
      mockedFs.stat.mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false
      } as any);

      // Act
      const result = await fileScanner.discoverFiles({
        targetPath: testFilePath,
        respectIgnoreFiles: false
      });

      // Assert
      expect(result).toEqual([testFilePath]);
      expect(mockedFs.stat).toHaveBeenCalledWith(testFilePath);
    });

    test('应该正确扫描目录', async () => {
      // Arrange
      const testDirPath = '/test/dir';
      mockedFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true
      } as any);

      mockedFs.readdir.mockResolvedValue([
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
        { name: 'file2.js', isDirectory: () => false, isFile: () => true },
        { name: 'file3.md', isDirectory: () => false, isFile: () => true },
        { name: 'node_modules', isDirectory: () => true, isFile: () => false }
      ] as any);

      // Act
      const result = await fileScanner.discoverFiles({
        targetPath: testDirPath,
        filePattern: '*.{ts,js}',
        respectIgnoreFiles: false
      });

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(mockedFs.readdir).toHaveBeenCalled();
    });

    test('应该处理文件不存在的情况', async () => {
      // Arrange
      const nonExistentPath = '/test/nonexistent';
      mockedFs.stat.mockRejectedValue({ code: 'ENOENT' });

      // Act & Assert
      await expect(fileScanner.discoverFiles({
        targetPath: nonExistentPath,
        respectIgnoreFiles: false
      })).rejects.toThrow(FindInFilesError);
    });

    test('typeToGlob应该正确转换文件类型', () => {
      // Act & Assert
      expect(fileScanner.typeToGlob('js')).toBe('*.{js,jsx}');
      expect(fileScanner.typeToGlob('ts')).toBe('*.{ts,tsx}');
      expect(fileScanner.typeToGlob('md')).toBe('*.md');
      expect(fileScanner.typeToGlob('yaml')).toBe('*.{yaml,yml}');
      expect(fileScanner.typeToGlob('unknown')).toBeUndefined();
      expect(fileScanner.typeToGlob(undefined)).toBeUndefined();
    });
  });

  describe('ResultFormatter', () => {
    let resultFormatter: ResultFormatter;

    beforeEach(() => {
      resultFormatter = new ResultFormatter();
    });

    const mockFileResults: FileSearchResult[] = [
      {
        filePath: '/test/file1.ts',
        matchCount: 2,
        matches: [
          { line: 10, column: 5, text: 'function test1() {}' },
          { line: 20, column: 8, text: '  function helper() {}' }
        ]
      },
      {
        filePath: '/test/file2.js',
        matchCount: 1,
        matches: [
          { line: 15, column: 1, text: 'function main() {}' }
        ]
      }
    ];

    test('content模式应该返回详细匹配信息', () => {
      // Arrange
      const args: FindInFilesArgs = { pattern: 'function', context: 0 };

      // Act
      const result = resultFormatter.format(mockFileResults, 'content', args);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalMatches).toBe(3);
      expect(result.matches).toHaveLength(3);
      
      const firstMatch = result.matches![0] as any;
      expect(firstMatch.file).toBe('/test/file1.ts');
      expect(firstMatch.line).toBe(10);
      expect(firstMatch.text).toBe('function test1() {}');
    });

    test('files模式应该只返回文件路径', () => {
      // Arrange
      const args: FindInFilesArgs = { pattern: 'function' };

      // Act
      const result = resultFormatter.format(mockFileResults, 'files', args);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalMatches).toBe(3);
      expect(result.matches).toHaveLength(2); // 2个文件
      
      const matches = result.matches as any[];
      expect(matches[0]).toEqual({ file: '/test/file1.ts' });
      expect(matches[1]).toEqual({ file: '/test/file2.js' });
    });

    test('count模式应该返回每个文件的匹配数量', () => {
      // Arrange
      const args: FindInFilesArgs = { pattern: 'function' };

      // Act
      const result = resultFormatter.format(mockFileResults, 'count', args);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalMatches).toBe(3);
      expect(result.matches).toHaveLength(2);
      
      const matches = result.matches as any[];
      expect(matches[0]).toEqual({ file: '/test/file1.ts', count: 2 });
      expect(matches[1]).toEqual({ file: '/test/file2.js', count: 1 });
    });

    test('应该正确处理无匹配结果', () => {
      // Arrange
      const args: FindInFilesArgs = { pattern: 'nonexistent' };

      // Act
      const result = resultFormatter.format([], 'content', args);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalMatches).toBe(0);
      expect(result.matches).toEqual([]);
    });

    test('limitResults应该正确限制结果数量', () => {
      // Arrange
      const matches = [
        { file: 'file1.ts' },
        { file: 'file2.ts' },
        { file: 'file3.ts' }
      ] as any[];

      // Act
      const limited = resultFormatter.limitResults(matches, 2);

      // Assert
      expect(limited).toHaveLength(2);
      expect(limited[0].file).toBe('file1.ts');
      expect(limited[1].file).toBe('file2.ts');
    });
  });

  describe('SimpleErrorHandler', () => {
    let errorHandler: SimpleErrorHandler;

    beforeEach(() => {
      errorHandler = new SimpleErrorHandler();
    });

    test('应该正确处理正则表达式错误', () => {
      // Arrange
      const error = new Error('Invalid regular expression');
      const args: FindInFilesArgs = { pattern: '[unclosed', regex: true };

      // Act
      const result = errorHandler.handleError(error, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid regex pattern');
      expect(result.errorType).toBe(FindInFilesErrorType.INVALID_REGEX);
      expect(result.suggestions).toContain('Try text search without regex');
    });

    test('应该正确处理路径不存在错误', () => {
      // Arrange
      const error = { message: 'ENOENT: no such file', code: 'ENOENT' } as any;
      const args: FindInFilesArgs = { pattern: 'test', path: 'nonexistent/' };

      // Act
      const result = errorHandler.handleError(error, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Path not found');
      expect(result.errorType).toBe(FindInFilesErrorType.PATH_NOT_FOUND);
      expect(result.suggestions).toContain('Check if path exists');
    });

    test('应该为未知错误提供通用处理', () => {
      // Arrange
      const error = new Error('Unknown error');
      const args: FindInFilesArgs = { pattern: 'test' };

      // Act
      const result = errorHandler.handleError(error, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Search failed');
      expect(result.errorType).toBe(FindInFilesErrorType.SEARCH_ERROR);
      expect(result.suggestions).toContain('Check parameters');
    });
  });

  describe('findInFiles主函数', () => {
    // Mock sessionManager
    beforeEach(() => {
      jest.doMock('../../../core/session-manager', () => ({
        SessionManager: {
          getInstance: () => ({
            getCurrentSession: async () => ({ baseDir: '/test/project' })
          })
        }
      }));
    });

    test('应该处理基础搜索参数', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'test'
      };

      // Mock文件系统
      mockedFs.stat.mockImplementation((filePath: any) => {
        if (filePath.includes('/test/project')) {
          return Promise.resolve({
            isFile: () => false,
            isDirectory: () => true
          } as any);
        }
        return Promise.reject({ code: 'ENOENT' });
      });

      mockedFs.readdir.mockResolvedValue([
        { name: 'test.md', isDirectory: () => false, isFile: () => true }
      ] as any);

      mockedFs.readFile.mockResolvedValue('This is a test file with test content.');

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      expect(result.matches).toBeDefined();
    });

    test('应该正确验证必填参数', async () => {
      // Arrange
      const args = { pattern: '' } as FindInFilesArgs;

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    test('应该支持不同的输出模式', async () => {
      // Arrange
      const baseArgs = { pattern: 'function' };

      // Mock基础的文件系统调用
      mockedFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true
      } as any);
      mockedFs.readdir.mockResolvedValue([]);

      // Act & Assert
      const contentResult = await findInFiles({ ...baseArgs, outputMode: 'content' });
      expect(contentResult.success).toBe(true);

      const filesResult = await findInFiles({ ...baseArgs, outputMode: 'files' });
      expect(filesResult.success).toBe(true);

      const countResult = await findInFiles({ ...baseArgs, outputMode: 'count' });
      expect(countResult.success).toBe(true);
    });
  });

  describe('参数验证', () => {
    test('应该验证context参数范围', async () => {
      // Arrange & Act & Assert
      const invalidContext1 = await findInFiles({ pattern: 'test', context: -1 });
      expect(invalidContext1.success).toBe(false);
      expect(invalidContext1.error).toContain('Context lines must be between 0 and 20');

      const invalidContext2 = await findInFiles({ pattern: 'test', context: 25 });
      expect(invalidContext2.success).toBe(false);
      expect(invalidContext2.error).toContain('Context lines must be between 0 and 20');

      // 有效的context参数应该通过参数验证（可能因为其他原因失败，如文件不存在）
      const validContext = await findInFiles({ pattern: 'test', context: 10 });
      if (!validContext.success) {
        expect(validContext.error).not.toContain('Context lines must be between');
      }
    });

    test('应该验证limit参数范围', async () => {
      // Arrange & Act & Assert
      const invalidLimit1 = await findInFiles({ pattern: 'test', limit: 0 });
      expect(invalidLimit1.success).toBe(false);

      const invalidLimit2 = await findInFiles({ pattern: 'test', limit: 1500 });
      expect(invalidLimit2.success).toBe(false);
    });
  });

  describe('Cursor风格API兼容性', () => {
    test('应该支持类似Cursor的基础调用方式', async () => {
      // Arrange - 模拟Cursor风格的调用
      const cursorStyleCalls = [
        { pattern: 'TODO' },                              // 基础搜索
        { pattern: 'function', path: 'src/' },            // 目录搜索
        { pattern: 'class', type: 'ts' },                 // 类型过滤
        { pattern: 'import', glob: '**/*.js' },           // glob模式
        { pattern: 'function\\s+\\w+', regex: true }      // 正则搜索
      ];

      // Mock基础调用
      mockedFs.stat.mockResolvedValue({
        isFile: () => false,
        isDirectory: () => true
      } as any);
      mockedFs.readdir.mockResolvedValue([]);

      // Act & Assert
      for (const args of cursorStyleCalls) {
        const result = await findInFiles(args);
        expect(result.success).toBe(true); // 所有调用都应该成功
      }
    });
  });
});
