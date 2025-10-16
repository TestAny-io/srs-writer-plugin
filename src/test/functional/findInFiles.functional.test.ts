/**
 * FindInFiles工具功能测试
 * 测试真实的端到端使用场景和工作流程
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { findInFiles } from '../../tools/atomic/smart-edit-tools';
import { FindInFilesArgs } from '../../tools/atomic/findInFiles/types';

describe('FindInFiles - Functional Tests', () => {
  let testProjectDir: string;
  let originalCwd: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
    
    // 创建复杂的测试项目结构，模拟真实的开发项目
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'findinfiles-functional-test-'));
    testProjectDir = tempDir;
    
    // 创建典型的项目结构
    await fs.mkdir(path.join(testProjectDir, 'src', 'components'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'src', 'utils'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'src', 'types'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'tests', 'unit'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'tests', 'integration'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'docs'), { recursive: true });
    await fs.mkdir(path.join(testProjectDir, 'config'), { recursive: true });
    
    // 创建SRS相关文件
    await fs.writeFile(path.join(testProjectDir, 'SRS.md'), `
# Software Requirements Specification

## 1. Introduction
This document describes the requirements for our e-commerce platform.

### 1.1 Purpose
The purpose is to define functional requirements (FR-001, FR-002) and use cases (UC-001, UC-002).

## 2. Functional Requirements
- FR-001: User authentication system
- FR-002: Product catalog management  
- FR-003: Shopping cart functionality

## 3. Use Cases
- UC-001: User login process
- UC-002: Product browsing
- UC-003: Checkout process

TODO: Add more detailed specifications
`);

    await fs.writeFile(path.join(testProjectDir, 'requirements.yaml'), `
version: "1.0"
project_name: "E-commerce Platform"
requirements:
  FR-001:
    title: "User Authentication"
    description: "System shall provide secure user login"
    priority: "high"
    depends_on: []
  FR-002:
    title: "Product Catalog"
    description: "System shall manage product information"
    priority: "medium"
    depends_on: ["FR-001"]
`);

    // 创建代码文件
    await fs.writeFile(path.join(testProjectDir, 'src', 'components', 'LoginForm.tsx'), `
import React from 'react';

interface LoginFormProps {
  onSubmit: (credentials: UserCredentials) => void;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement form validation
    console.log('Login form submitted');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" placeholder="Email" />
      <input type="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>
  );
}

export default LoginForm;
`);

    await fs.writeFile(path.join(testProjectDir, 'src', 'utils', 'api.ts'), `
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async get(endpoint: string): Promise<any> {
    return fetch(\`\${this.baseUrl}/\${endpoint}\`);
  }

  async post(endpoint: string, data: any): Promise<any> {
    return fetch(\`\${this.baseUrl}/\${endpoint}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

// FIXME: Add proper error handling
export const API_BASE_URL = 'https://api.example.com';
`);

    await fs.writeFile(path.join(testProjectDir, 'src', 'types', 'index.ts'), `
export interface UserCredentials {
  email: string;
  password: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
}

export type ApiResponse<T> = {
  data: T;
  success: boolean;
  message?: string;
};
`);

    // 创建测试文件
    await fs.writeFile(path.join(testProjectDir, 'tests', 'unit', 'auth.test.ts'), `
import { validateEmail } from '../../src/utils/api';

describe('Authentication Utils', () => {
  test('validateEmail should work correctly', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('invalid-email')).toBe(false);
  });
});

// TODO: Add more comprehensive tests
`);

    // 创建配置文件
    await fs.writeFile(path.join(testProjectDir, 'config', 'database.json'), `
{
  "development": {
    "host": "localhost",
    "port": 5432,
    "database": "ecommerce_dev"
  },
  "production": {
    "host": "prod-db.example.com",
    "port": 5432,
    "database": "ecommerce_prod"
  }
}
`);

    // 创建文档文件
    await fs.writeFile(path.join(testProjectDir, 'docs', 'api-guide.md'), `
# API Guide

## Authentication Endpoints
- POST /auth/login - User login
- POST /auth/logout - User logout
- GET /auth/profile - Get user profile

## Product Endpoints  
- GET /products - List all products
- GET /products/:id - Get specific product
- POST /products - Create new product (admin only)

TODO: Document error responses
FIXME: Update authentication flow
`);

    await fs.writeFile(path.join(testProjectDir, 'README.md'), `
# E-commerce Platform

A full-featured e-commerce application built with modern web technologies.

## Features
- User authentication (FR-001)
- Product catalog (FR-002)
- Shopping cart (FR-003)

## Getting Started
1. Clone the repository
2. Install dependencies: npm install
3. Start the development server: npm run dev

## API Documentation
See docs/api-guide.md for detailed API documentation.

## Requirements
See SRS.md and requirements.yaml for detailed requirements.
`);

    // 创建应被忽略的文件和目录
    await fs.mkdir(path.join(testProjectDir, 'node_modules', 'react'), { recursive: true });
    await fs.writeFile(path.join(testProjectDir, 'node_modules', 'react', 'index.js'), 'module.exports = React;');
    await fs.writeFile(path.join(testProjectDir, 'debug.log'), 'Debug logging information...');
    await fs.writeFile(path.join(testProjectDir, '.env'), 'SECRET_KEY=abc123');

    // 创建.gitignore
    await fs.writeFile(path.join(testProjectDir, '.gitignore'), `
node_modules/
*.log
.env*
dist/
build/
coverage/
`);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  // Mock session manager
  beforeEach(() => {
    jest.doMock('../../../core/session-manager', () => ({
      SessionManager: {
        getInstance: () => ({
          getCurrentSession: async () => ({ baseDir: testProjectDir })
        })
      }
    }));
  });

  describe('端到端工作流测试', () => {
    test('工作流1: 新开发者了解项目结构', async () => {
      // 模拟场景：新开发者想了解项目有哪些主要功能
      
      // Step 1: 查找所有导出的函数和类
      const exportsResult = await findInFiles({
        pattern: 'export\\s+(function|class|interface)',
        regex: true,
        outputMode: 'files'
      });

      expect(exportsResult.success).toBe(true);
      expect(exportsResult.matches!.length).toBeGreaterThan(0);

      // Step 2: 查找所有TODO项了解待完成工作
      const todoResult = await findInFiles({
        pattern: 'TODO|FIXME',
        regex: true,
        outputMode: 'content',
        context: 2
      });

      expect(todoResult.success).toBe(true);
      
      if (todoResult.matches && todoResult.matches.length > 0) {
        // 验证有上下文信息
        const firstMatch = todoResult.matches[0] as any;
        expect(firstMatch.context).toBeDefined();
        expect(firstMatch.context.length).toBeGreaterThan(0);
      }
    });

    test('工作流2: 需求分析师追踪需求实现', async () => {
      // 模拟场景：需求分析师想了解FR-001在代码中的实现情况

      // Step 1: 查找所有需求ID引用
      const requirementsResult = await findInFiles({
        pattern: '(FR|UC|US)-\\d+',
        regex: true,
        outputMode: 'content'
      });

      expect(requirementsResult.success).toBe(true);

      // Step 2: 专门搜索FR-001的引用
      const fr001Result = await findInFiles({
        pattern: 'FR-001',
        outputMode: 'files'
      });

      expect(fr001Result.success).toBe(true);
      
      if (fr001Result.matches && fr001Result.matches.length > 0) {
        const files = (fr001Result.matches as any[]).map(m => path.basename(m.file));
        // 应该在SRS.md和requirements.yaml中找到
        expect(files.some(f => f.includes('SRS.md') || f.includes('requirements.yaml'))).toBe(true);
      }
    });

    test('工作流3: 代码审查查找潜在问题', async () => {
      // 模拟场景：代码审查者查找代码中的潜在问题

      // Step 1: 查找所有console.log（可能需要清理）
      const consoleResult = await findInFiles({
        pattern: 'console\\.(log|warn|error)',
        regex: true,
        type: 'ts',
        outputMode: 'count'
      });

      expect(consoleResult.success).toBe(true);

      // Step 2: 查找硬编码的配置值
      const hardcodedResult = await findInFiles({
        pattern: '(http://|https://|localhost|127\\.0\\.0\\.1)',
        regex: true,
        outputMode: 'content',
        context: 1
      });

      expect(hardcodedResult.success).toBe(true);

      // Step 3: 查找所有FIXME标记
      const fixmeResult = await findInFiles({
        pattern: 'FIXME',
        outputMode: 'files'
      });

      expect(fixmeResult.success).toBe(true);
    });

    test('工作流4: 技术文档维护', async () => {
      // 模拟场景：技术写作人员维护项目文档

      // Step 1: 查找所有文档文件中的API引用
      const apiRefsResult = await findInFiles({
        pattern: '/(auth|products|users)/',
        regex: true,
        type: 'md',
        outputMode: 'content'
      });

      expect(apiRefsResult.success).toBe(true);

      // Step 2: 查找文档中的断链和待更新内容
      const docIssuesResult = await findInFiles({
        pattern: 'TODO|TBD|\\[TBD\\]|\\?\\?\\?',
        regex: true,
        path: 'docs/',
        outputMode: 'count'
      });

      expect(docIssuesResult.success).toBe(true);

      // Step 3: 验证代码和文档的一致性
      const functionRefsResult = await findInFiles({
        pattern: 'validateEmail|LoginForm|ApiClient',
        regex: true,
        glob: '*.{ts,tsx,md}',
        outputMode: 'files'
      });

      expect(functionRefsResult.success).toBe(true);
    });
  });

  describe('性能和可靠性测试', () => {
    test('应该在大量文件的项目中保持性能', async () => {
      // Arrange - 创建更多文件模拟大项目
      const largeProjectDir = path.join(testProjectDir, 'large-scale');
      await fs.mkdir(largeProjectDir, { recursive: true });

      // 创建50个文件
      for (let i = 0; i < 50; i++) {
        await fs.writeFile(
          path.join(largeProjectDir, `module-${i}.ts`),
          `export function func${i}() {
  console.log('Function ${i}');
  return ${i};
}

export interface Interface${i} {
  value: number;
  name: string;
}

// TODO: Implement feature ${i}
`
        );
      }

      // Mock session to use large project
      jest.doMock('../../../core/session-manager', () => ({
        SessionManager: {
          getInstance: () => ({
            getCurrentSession: async () => ({ baseDir: largeProjectDir })
          })
        }
      }));

      // Act - 搜索所有函数定义
      const startTime = Date.now();
      const result = await findInFiles({
        pattern: 'export\\s+function\\s+\\w+',
        regex: true,
        outputMode: 'count'
      });
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(3000); // 应该在3秒内完成
      expect(result.totalMatches).toBe(50); // 应该找到50个函数
    });

    test('应该正确处理各种文件编码', async () => {
      // Arrange - 创建包含特殊字符的文件
      await fs.writeFile(
        path.join(testProjectDir, 'unicode-test.md'),
        `# 中文测试文档

## 功能描述
这是一个包含中文的function测试文档。

### API说明
- 用户认证接口：POST /auth/login
- 产品目录接口：GET /products

TODO: 添加更多中文文档
`
      );

      // Act
      const result = await findInFiles({
        pattern: '中文|function|TODO',
        regex: true,
        path: 'unicode-test.md'
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalMatches).toBeGreaterThan(0);
      
      if (result.matches && result.matches.length > 0) {
        const chineseMatches = (result.matches as any[]).filter(
          match => match.text.includes('中文')
        );
        expect(chineseMatches.length).toBeGreaterThan(0);
      }
    });

    test('应该优雅处理搜索限制', async () => {
      // Arrange - 测试各种边界条件
      const testCases = [
        { pattern: 'function', limit: 1 },    // 最小限制
        { pattern: '.*', regex: true, limit: 10 }, // 匹配所有内容但限制结果
        { pattern: 'nonexistent_pattern' }    // 无匹配结果
      ];

      // Act & Assert
      for (const testCase of testCases) {
        const result = await findInFiles(testCase);
        expect(result.success).toBe(true);
        
        if (testCase.limit && result.matches) {
          expect(result.matches.length).toBeLessThanOrEqual(testCase.limit);
        }
      }
    });
  });

  describe('复杂搜索模式测试', () => {
    test('应该支持复杂的正则表达式模式', async () => {
      // Arrange - 各种复杂的搜索模式
      const complexPatterns = [
        {
          name: '函数定义',
          pattern: 'export\\s+(function|const\\s+\\w+\\s*=\\s*\\([^)]*\\)\\s*=>)',
          regex: true
        },
        {
          name: '接口定义',
          pattern: 'interface\\s+\\w+\\s*{',
          regex: true
        },
        {
          name: 'HTTP方法调用',
          pattern: '\\.(get|post|put|delete)\\(',
          regex: true
        },
        {
          name: '注释标记',
          pattern: '(TODO|FIXME|HACK|BUG)\\s*:',
          regex: true
        }
      ];

      // Act & Assert
      for (const patternTest of complexPatterns) {
        const result = await findInFiles({
          pattern: patternTest.pattern,
          regex: patternTest.regex,
          outputMode: 'count'
        });

        expect(result.success).toBe(true);
        // 不要求必须有匹配，但应该成功执行
      }
    });

    test('应该支持文件类型组合搜索', async () => {
      // Arrange - 测试不同文件类型的搜索
      const fileTypeTests = [
        { type: 'ts', expectedPattern: /\.(ts|tsx)$/ },
        { type: 'js', expectedPattern: /\.(js|jsx)$/ },
        { type: 'md', expectedPattern: /\.md$/ },
        { type: 'json', expectedPattern: /\.json$/ }
      ];

      // Act & Assert
      for (const fileTypeTest of fileTypeTests) {
        const result = await findInFiles({
          pattern: '.*',
          regex: true,
          type: fileTypeTest.type,
          outputMode: 'files'
        });

        expect(result.success).toBe(true);
        
        if (result.matches && result.matches.length > 0) {
          // 验证所有结果都是正确的文件类型
          const allCorrectType = (result.matches as any[]).every(
            match => fileTypeTest.expectedPattern.test(match.file)
          );
          expect(allCorrectType).toBe(true);
        }
      }
    });
  });

  describe('与Cursor对标测试', () => {
    test('应该提供与Cursor grep相似的搜索结果', async () => {
      // 这个测试验证我们的搜索结果质量与预期一致
      
      // Arrange - 模拟典型的Cursor使用模式
      const cursorStyleSearches = [
        {
          description: '查找所有函数定义',
          args: { pattern: 'function', outputMode: 'count' as const }
        },
        {
          description: '查找特定目录中的TODO',
          args: { pattern: 'TODO', path: 'src/', outputMode: 'files' as const }
        },
        {
          description: '查找TypeScript接口',
          args: { pattern: 'interface', type: 'ts' as const }
        },
        {
          description: '正则搜索导入语句',
          args: { pattern: 'import.*from', regex: true }
        }
      ];

      // Act & Assert
      for (const search of cursorStyleSearches) {
        const result = await findInFiles(search.args);
        
        expect(result.success).toBe(true);
        expect(result.matches).toBeDefined();
        expect(result.totalMatches).toBeGreaterThanOrEqual(0);
        
        // 验证输出格式符合预期
        if (search.args.outputMode === 'count' && result.matches!.length > 0) {
          expect((result.matches![0] as any).count).toBeDefined();
        } else if (search.args.outputMode === 'files' && result.matches!.length > 0) {
          expect((result.matches![0] as any).line).toBeUndefined();
        } else if (result.matches!.length > 0) { // content模式
          expect((result.matches![0] as any).line).toBeDefined();
        }
      }
    });
  });

  describe('SRS项目特定测试', () => {
    test('应该高效搜索SRS文档结构', async () => {
      // Arrange - SRS项目特有的搜索模式
      const srsSearches = [
        {
          description: '查找所有需求ID',
          args: { pattern: '(FR|UC|US|NFR)-\\d+', regex: true, outputMode: 'files' as const }
        },
        {
          description: '查找SRS章节标题',
          args: { pattern: '^##\\s+\\d+\\.', regex: true, type: 'md' as const }
        },
        {
          description: '查找requirements.yaml中的依赖',
          args: { pattern: 'depends_on', type: 'yaml' as const }
        }
      ];

      // Act & Assert
      for (const search of srsSearches) {
        const result = await findInFiles(search.args);
        
        expect(result.success).toBe(true);
        // SRS项目中应该能找到这些模式
        expect(result.totalMatches).toBeGreaterThan(0);
      }
    });

    test('应该支持跨文档的需求引用搜索', async () => {
      // Arrange
      const args: FindInFilesArgs = {
        pattern: 'FR-001',
        outputMode: 'content',
        context: 3
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalMatches).toBeGreaterThan(0);
      
      // 验证在多个文件中找到了引用
      const fileSet = new Set((result.matches as any[]).map(m => path.basename(m.file)));
      expect(fileSet.has('SRS.md')).toBe(true);
      expect(fileSet.has('requirements.yaml')).toBe(true);
    });
  });

  describe('边界情况和鲁棒性测试', () => {
    test('应该处理空文件', async () => {
      // Arrange - 创建空文件
      await fs.writeFile(path.join(testProjectDir, 'empty.txt'), '');

      const args: FindInFilesArgs = {
        pattern: 'anything',
        path: 'empty.txt'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalMatches).toBe(0);
      expect(result.matches).toEqual([]);
    });

    test('应该处理非常长的行', async () => {
      // Arrange - 创建包含很长行的文件
      const longLine = 'x'.repeat(10000) + ' function test() {}';
      await fs.writeFile(path.join(testProjectDir, 'long-lines.js'), longLine);

      const args: FindInFilesArgs = {
        pattern: 'function',
        path: 'long-lines.js'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalMatches).toBe(1);
    });

    test('应该正确处理特殊字符', async () => {
      // Arrange - 创建包含特殊字符的文件
      await fs.writeFile(path.join(testProjectDir, 'special-chars.ts'), `
const specialString = "Hello (world) [test] {data} $var @user #tag %percent";
const regexPattern = /^[a-zA-Z]+$/;
const template = \`function \${name}() { return true; }\`;
`);

      const args: FindInFilesArgs = {
        pattern: '\\$\\{\\w+\\}',
        regex: true,
        path: 'special-chars.ts'
      };

      // Act
      const result = await findInFiles(args);

      // Assert
      expect(result.success).toBe(true);
      expect(result.totalMatches).toBeGreaterThan(0);
    });
  });
});
