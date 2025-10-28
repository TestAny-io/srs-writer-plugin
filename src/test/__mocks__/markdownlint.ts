/**
 * Mock for markdownlint to avoid ESM import issues in tests
 *
 * 支持多种导入方式：
 * - import { lintSync } from 'markdownlint/sync'
 * - const { lint } = require('markdownlint/sync')
 * - import markdownlint from 'markdownlint'
 */

// 创建 mock 函数
export const lintSync = jest.fn(() => ({}));
export const readConfigSync = jest.fn(() => ({}));
export const lint = jest.fn();
export const readConfig = jest.fn();

// 支持 CommonJS require() - 特别是 require('markdownlint/sync')
// MarkdownChecker.ts 使用: const { lint: markdownlintSync } = require('markdownlint/sync');
module.exports = {
  lintSync,
  lint: lintSync,  // 'markdownlint/sync' 导出的是 { lint }
  readConfigSync,
  readConfig
};

// 支持 ES Module import
export default {
  lintSync,
  lint: lintSync,
  readConfigSync,
  readConfig
};