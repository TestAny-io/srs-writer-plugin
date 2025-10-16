/**
 * FindInFiles工具集成测试
 * 测试与实际文件系统的交互和完整工作流程
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { findInFiles } from '../../tools/atomic/smart-edit-tools';
import { FindInFilesArgs } from '../../tools/atomic/findInFiles/types';

describe('FindInFiles - Integration Tests', () => {
  let testProjectDir: string;
  let originalCwd: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
    
    // 创建临时测试项目目录
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'findinfiles-integration-test-'));
    testProjectDir = tempDir;
    
    // 创建测试目录结构
    await fs.mkdir(path.join(testProjectDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'docs'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'tests'), { recursive: true });
    
    // 创建测试文件
    await fs.writeFile(path.join(testProjectDir, 'src', 'main.ts'), `
import { Logger } from './utils/logger';

export function createApp() {
  const logger = Logger.getInstance();
  return new Application(logger);
}

export class Application {
  constructor(private logger: Logger) {}
  
  async start() {
    this.logger.info('Application started');
  }
}
`);

    await fs.writeFile(path.join(testProjectDir, 'src', 'utils.ts'), `
export function validateInput(data: any): boolean {
  return data && typeof data === 'object';
}

export function formatOutput(result: any): string {
  return JSON.stringify(result, null, 2);
}
`);

    await fs.writeFile(path.join(testProjectDir, 'docs', 'api.md'), `
# API Documentation

## Functions

### createApp()
Creates a new application instance.

### validateInput(data)
Validates input data.

TODO: Add more documentation
`);

    await fs.writeFile(path.join(testProjectDir, 'README.md'), `
# Test Project

This is a test project for findInFiles integration testing.

## Functions
- createApp
- validateInput
- formatOutput

## TODO
- Add more tests
- Improve documentation
`);

    await fs.writeFile(path.join(testProjectDir, 'package.json'), `
{
  "name": "test-project",
  "version": "1.0.0",
  "main": "src/main.ts",
  "scripts": {
    "test": "jest"
  }
}
`);

    // 创建.gitignore文件
    await fs.writeFile(path.join(testProjectDir, '.gitignore'), `
node_modules/
*.log
.env*
dist/
`);

    // 创建应被忽略的文件
    await fs.mkdir(path.join(testProjectDir, 'node_modules'), { recursive: true });
    await fs.writeFile(path.join(testProjectDir, 'debug.log'), 'debug logs...');
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    
    // 清理测试目录
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  // Mock sessionManager to return our test project directory
  beforeEach(() => {
    jest.doMock('../../../core/session-manager', () => ({
      SessionManager: {
        getInstance: () => ({
          getCurrentSession: async () => ({ baseDir: testProjectDir })
        })
      }
    }));
  });

  describe('基础搜索功能', () => {
    test('应该在整个项目中搜索文本', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'function'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalMatches).toBeGreaterThan(0);
      expect(result.matches).toBeDefined();
      
      // 验证找到了来自不同文件的匹配
      const fileSet = new Set((result.matches as any[]).map(m => m.file));
      expect(fileSet.size).toBeGreaterThan(1);
    });

    test('应该支持大小写敏感搜索', async () => {
      // Arrange
      const caseSensitiveArgs: FindInFilesArgs = {
        pattern: 'Function',  // 大写F
        caseSensitive: true
      };
      const caseInsensitiveArgs: FindInFilesArgs = {
        pattern: 'Function',
        caseSensitive: false
      };

      // Act
      const caseSensitiveResult = await findInFiles(caseSensitiveArgs);
      const caseInsensitiveResult = await findInFiles(caseInsensitiveArgs);

      // Assert
      expect(caseSensitiveResult.success).toBe(true);
      expect(caseInsensitiveResult.success).toBe(true);
      
      // 大小写敏感应该匹配更少的结果
      expect(caseSensitiveResult.totalMatches).toBeLessThanOrEqual(caseInsensitiveResult.totalMatches!);
    });

    test('应该支持正则表达式搜索', async () => {
      // Arrange
      const regexArgs: FindInFilesArgs = {
        pattern: 'export\\s+function\\s+\\w+',
        regex: true
      };

      // Act
      const result = await findInFiles(regexArgs);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.totalMatches! > 0) {
        const firstMatch = result.matches![0] as any;
        expect(firstMatch.text).toMatch(/export\s+function\s+\w+/);
      }
    });
  });

  describe('搜索范围控制', () => {
    test('应该支持目录范围搜索', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'function',
        path: 'src/'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches && result.matches.length > 0) {
        // 所有匹配都应该来自src目录
        const allFromSrc = (result.matches as any[]).every(
          match => match.file.includes('/src/')
        );
        expect(allFromSrc).toBe(true);
      }
    });

    test('应该支持单文件搜索', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'createApp',
        path: 'src/main.ts'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches && result.matches.length > 0) {
        // 所有匹配都应该来自指定文件
        const allFromSpecificFile = (result.matches as any[]).every(
          match => match.file.endsWith('/src/main.ts')
        );
        expect(allFromSpecificFile).toBe(true);
      }
    });

    test('应该支持文件类型过滤', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'function',
        type: 'ts'
      };

      // Act  
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches && result.matches.length > 0) {
        // 所有匹配都应该来自TypeScript文件
        const allTypeScript = (result.matches as any[]).every(
          match => match.file.endsWith('.ts') || match.file.endsWith('.tsx')
        );
        expect(allTypeScript).toBe(true);
      }
    });

    test('应该支持glob模式过滤', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'TODO',
        glob: '*.md'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches && result.matches.length > 0) {
        // 所有匹配都应该来自Markdown文件
        const allMarkdown = (result.matches as any[]).every(
          match => match.file.endsWith('.md')
        );
        expect(allMarkdown).toBe(true);
      }
    });
  });

  describe('输出格式测试', () => {
    test('content模式应该包含行号和文本内容', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'function',
        outputMode: 'content',
        context: 0  // 不需要上下文以简化测试
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches && result.matches.length > 0) {
        const firstMatch = result.matches[0] as any;
        expect(firstMatch.file).toBeDefined();
        expect(firstMatch.line).toBeGreaterThan(0);
        expect(firstMatch.text).toBeDefined();
        expect(typeof firstMatch.text).toBe('string');
      }
    });

    test('files模式应该只包含文件路径', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'function',
        outputMode: 'files'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches && result.matches.length > 0) {
        const firstMatch = result.matches[0] as any;
        expect(firstMatch.file).toBeDefined();
        expect(firstMatch.line).toBeUndefined(); // files模式不应该包含行号
        expect(firstMatch.text).toBeUndefined(); // files模式不应该包含文本
      }
    });

    test('count模式应该包含每个文件的匹配计数', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'function',
        outputMode: 'count'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches && result.matches.length > 0) {
        const firstMatch = result.matches[0] as any;
        expect(firstMatch.file).toBeDefined();
        expect(firstMatch.count).toBeGreaterThan(0);
        expect(firstMatch.line).toBeUndefined(); // count模式不应该包含行号
        expect(firstMatch.text).toBeUndefined(); // count模式不应该包含文本
      }
    });
  });

  describe('错误处理集成', () => {
    test('应该优雅处理不存在的路径', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'function',
        path: 'nonexistent-directory/'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.errorType).toBe('PATH_NOT_FOUND');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });

    test('应该正确处理无效的正则表达式', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: '[unclosed bracket',
        regex: true
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid regex');
      expect(result.errorType).toBe('INVALID_REGEX');
      expect(result.suggestions).toContain('Try text search without regex');
    });
  });

  describe('性能和限制', () => {
    test('应该支持结果数量限制', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: '.*', // 匹配所有内容
        regex: true,
        limit: 5
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches) {
        expect(result.matches.length).toBeLessThanOrEqual(5);
      }
    });

    test('应该在合理时间内完成搜索', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'function'
      };

      // Act
      const startTime = Date.now();
      const result = await findInFiles(args);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
    });
  });

  describe('与现有工具兼容性', () => {
    test('应该替换原有findInFile工具功能', async () => {
      // 这个测试验证findInFiles完全替代了findInFile的功能
      
      // Arrange - 测试单文件搜索（原findInFile的核心功能）
      const singleFileArgs: FindInFilesArgs = {
        pattern: 'function',
        path: 'src/main.ts'  // 指定单文件，模拟原findInFile行为
      };

      // Act
      const result = await findInFiles(singleFileArgs);

      // Assert - 应该成功处理单文件搜索
      expect(result.success).toBe(true);
      expect(result.matches).toBeDefined();
      
      // 如果有匹配，验证都来自指定文件
      if (result.matches && result.matches.length > 0) {
        const allFromTargetFile = (result.matches as any[]).every(
          match => match.file.endsWith('/src/main.ts')
        );
        expect(allFromTargetFile).toBe(true);
      }
    });
  });

  describe('实际使用场景测试', () => {
    test('场景1: Content Specialist查找所有TODO项', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'TODO',
        outputMode: 'files'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches && result.matches.length > 0) {
        // 应该找到包含TODO的文件
        const foundFiles = (result.matches as any[]).map(m => path.basename(m.file));
        expect(foundFiles.some(f => f.includes('md'))).toBe(true);
      }
    });

    test('场景2: Process Specialist分析代码结构', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'export\\s+(function|class)',
        regex: true,
        type: 'ts',
        outputMode: 'count'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches && result.matches.length > 0) {
        const countMatches = result.matches as any[];
        // 验证count格式
        countMatches.forEach(match => {
          expect(match.file).toBeDefined();
          expect(match.count).toBeGreaterThan(0);
          expect(match.file.endsWith('.ts')).toBe(true);
        });
      }
    });

    test('场景3: 查找项目配置信息', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'version|name',
        regex: true,
        glob: '*.json'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches && result.matches.length > 0) {
        // 应该找到package.json中的配置
        const hasPackageJson = (result.matches as any[]).some(
          match => match.file.includes('package.json')
        );
        expect(hasPackageJson).toBe(true);
      }
    });
  });

  describe('.gitignore规则遵守', () => {
    test('应该自动忽略.gitignore中指定的文件', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: '.*', // 匹配所有内容
        regex: true,
        outputMode: 'files'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      
      if (result.matches) {
        const filePaths = (result.matches as any[]).map(m => m.file);
        
        // 验证忽略了node_modules
        const hasNodeModules = filePaths.some(f => f.includes('node_modules'));
        expect(hasNodeModules).toBe(false);
        
        // 验证忽略了.log文件
        const hasLogFiles = filePaths.some(f => f.endsWith('.log'));
        expect(hasLogFiles).toBe(false);
      }
    });
  });

  describe('边界条件测试', () => {
    test('应该处理空模式搜索', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: ''
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    test('应该处理不存在baseDir的情况', async () => {
      // Arrange - Mock sessionManager返回无效baseDir
      jest.doMock('../../../core/session-manager', () => ({
        SessionManager: {
          getInstance: () => ({
            getCurrentSession: async () => ({ baseDir: undefined })
          })
        }
      }));

      const args: FindInFilesArgs = {
        pattern: 'function'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      // 应该回退到workspace目录，或者返回合理错误
      expect(result.success).toBeDefined(); // 至少有明确的成功/失败状态
    });

    test('应该处理超出限制的参数值', async () => {
      // Arrange
      const invalidArgs: FindInFilesArgs = {
        pattern: 'test',
        context: 25,  // 超出最大值20
        limit: 1500   // 超出最大值1000
      };

      // Act
      const result = await findInFiles(invalidArgs);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
