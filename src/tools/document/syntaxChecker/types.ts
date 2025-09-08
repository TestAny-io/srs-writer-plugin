/**
 * Syntax Checker 工具类型定义
 * 提供 Markdown 和 YAML 语法检查的核心类型
 */

// 复用现有错误处理系统
export { ScaffoldError, ScaffoldErrorType } from '../scaffoldGenerator/types';

/**
 * 文件类型枚举
 */
export type FileType = 'markdown' | 'yaml' | 'unsupported';

/**
 * 检查严重程度
 */
export type Severity = 'error' | 'warning';

/**
 * 统一的问题格式
 */
export interface Issue {
  file: string;
  line?: number;
  column?: number;
  rule?: string;
  severity: Severity;
  message: string;
}

/**
 * 单个文件检查结果
 */
export interface FileCheckResult {
  file: string;
  fileType: FileType;
  issues: Issue[];
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Markdown 配置
 */
export interface MarkdownConfig {
  enabled: boolean;
  preset: 'all' | 'standard' | 'no' | 'custom';
  rules?: any; // markdownlint 规则对象
}

/**
 * YAML 配置
 */
export interface YAMLConfig {
  enabled: boolean;
  level: 'basic' | 'standard' | 'strict';
  checkSyntax: boolean;
  checkStructure: boolean;
  checkRequirementsYaml: boolean;
}

/**
 * 语法检查器配置
 */
export interface SyntaxCheckerConfig {
  enabled: boolean;
  markdown: MarkdownConfig;
  yaml: YAMLConfig;
}

/**
 * 语法检查参数
 */
export interface SyntaxCheckArgs {
  description: string;
  files: Array<{ path: string }>;
}

/**
 * 语法检查结果
 */
export interface SyntaxCheckResult {
  success: boolean;
  totalFiles: number;
  processedFiles: number;
  skippedFiles: string[];
  issues: Issue[];
  executionTime?: number;
  error?: string;
}

/**
 * 质量报告结构
 */
export interface QualityReport {
  projectName: string;
  generatedAt: string;
  summary: {
    totalChecks: number;
    totalFiles: number;
    filesWithIssues: number;
    totalErrors: number;
    totalWarnings: number;
  };
  checks: QualityCheckEntry[];
}

/**
 * 质量检查条目
 */
export interface QualityCheckEntry {
  checkType: string;
  toolName: string;
  timestamp: string;
  summary: {
    filesChecked?: number;
    errors: number;
    warnings: number;
    [key: string]: any; // 允许其他工具添加自定义统计
  };
  issues?: Issue[];
  results?: any; // 兼容其他工具的结果格式
}
