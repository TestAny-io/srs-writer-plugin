module.exports = {
  // 基础配置
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // 测试文件匹配
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.spec.ts'
  ],
  
  // TypeScript配置 - 使用新的transform格式
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2020',
        lib: ['ES2020'],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        declaration: false,
        declarationMap: false,
        sourceMap: false
      }
    }]
  },
  
  // 模块解析和Mock配置
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^vscode$': '<rootDir>/src/test/__mocks__/vscode.ts',
    '^unified$': '<rootDir>/src/test/__mocks__/unified.ts',
    '^remark-parse$': '<rootDir>/src/test/__mocks__/remark-parse.ts'
  },
  
  // 代码覆盖率
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/test/**/*'
  ],
  
  // Jest setup
  setupFilesAfterEnv: [],
  
  // 忽略的目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/code-parking-lot/'
  ],
  
  // 超时设置
  testTimeout: 10000,
  
  // 并行执行
  maxWorkers: '50%'
}; 