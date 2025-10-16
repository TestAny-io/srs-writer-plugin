/**
 * FindInFiles工具的类型定义
 * 基于Cursor风格的简洁设计
 */

// ========== 核心参数接口 ==========

export interface FindInFilesArgs {
  // 🎯 核心搜索参数
  pattern: string;                    // 搜索模式(必填)
  regex?: boolean;                    // 使用正则表达式
  caseSensitive?: boolean;            // 大小写敏感
  
  // 🎯 搜索范围控制 (Cursor风格)
  path?: string;                      // 文件或目录路径 (相对于baseDir)
  glob?: string;                      // 文件模式: "*.ts", "**/*.{md,ts}"
  type?: string;                      // 文件类型: "js", "md", "yaml" 
  
  // 📊 输出控制
  outputMode?: 'content' | 'files' | 'count';  // 输出格式
  context?: number;                   // 上下文行数 (默认5)
  limit?: number;                     // 结果数量限制 (默认100)
}

// ========== 输出接口 ==========

export interface FindInFilesResult {
  success: boolean;
  matches?: Match[];
  totalMatches?: number;
  error?: string;
  errorType?: string;
  suggestions?: string[];
}

// 根据outputMode动态调整Match结构
export type Match = ContentMatch | FileMatch | CountMatch;

export interface ContentMatch {
  file: string;
  line: number;
  text: string;
  context?: string[];  // 上下文行(仅在context>0时提供)
}

export interface FileMatch {
  file: string;
}

export interface CountMatch {
  file: string;
  count: number;
}

// ========== 内部处理接口 ==========

export interface SearchScope {
  type: 'single_file' | 'directory_search' | 'filtered_search' | 'full_search';
  targetPath: string;
  filePattern?: string;
}

export interface PatternCompileOptions {
  pattern: string;
  regex: boolean;
  caseSensitive: boolean;
}

export interface CompiledPattern {
  type: 'regex' | 'text';
  originalPattern: string;
  test: (text: string) => boolean;
  findAll: (text: string) => PatternMatch[];
}

export interface PatternMatch {
  match: string;
  index: number;
  line: number;
  column: number;
}

export interface FileSearchResult {
  filePath: string;
  matches: LineMatch[];
  matchCount: number;
}

export interface LineMatch {
  line: number;
  column: number;
  text: string;
}

// ========== 错误处理接口 ==========

export enum FindInFilesErrorType {
  INVALID_REGEX = 'INVALID_REGEX',
  PATH_NOT_FOUND = 'PATH_NOT_FOUND', 
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  WORKSPACE_ERROR = 'WORKSPACE_ERROR',
  SEARCH_ERROR = 'SEARCH_ERROR'
}

export class FindInFilesError extends Error {
  constructor(
    public type: FindInFilesErrorType,
    public message: string
  ) {
    super(message);
    this.name = 'FindInFilesError';
  }
}

// ========== 文件扫描接口 ==========

export interface FileScanOptions {
  targetPath: string;
  filePattern?: string;
  respectIgnoreFiles?: boolean;
}

export interface FileInfo {
  path: string;
  isDirectory: boolean;
  size: number;
}
