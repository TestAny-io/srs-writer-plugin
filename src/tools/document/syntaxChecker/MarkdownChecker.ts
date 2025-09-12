/**
 * Markdown 语法检查器
 * 使用 markdownlint 库进行语法和格式检查
 * 支持预设配置和简化的错误处理
 */

import * as fs from 'fs/promises';
import * as path from 'path';
const { lint: markdownlintSync } = require('markdownlint/sync');
import { Logger } from '../../../utils/logger';
import { resolveWorkspacePath } from '../../../utils/path-resolver';
import { ScaffoldError, ScaffoldErrorType } from '../scaffoldGenerator/types';
import { SyntaxCheckerConfigLoader } from './SyntaxCheckerConfigLoader';
import { Issue, FileCheckResult, MarkdownConfig } from './types';

const logger = Logger.getInstance();

/**
 * Markdown 语法检查器
 */
export class MarkdownChecker {
  
  /**
   * 检查单个 Markdown 文件
   * @param filePath 文件路径（相对于项目根目录）
   * @returns 检查结果
   */
  async check(filePath: string): Promise<FileCheckResult> {
    try {
      logger.info(`📝 Checking Markdown file: ${filePath}`);
      
      // 加载配置
      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
      if (!config.enabled) {
        return {
          file: filePath,
          fileType: 'markdown',
          issues: [],
          skipped: true,
          skipReason: 'Markdown checking disabled in configuration'
        };
      }
      
      // 读取文件内容
      const content = await this.readFileContent(filePath);
      
      // 执行 markdownlint 检查
      const results = markdownlintSync({
        strings: { [filePath]: content },
        config: config.rules
      });
      
      const markdownlintIssues = results[filePath] || [];
      
      // 转换为统一的问题格式
      const issues = this.convertMarkdownlintIssues(filePath, markdownlintIssues);
      
      logger.info(`📝 Markdown check completed for ${filePath}: ${issues.length} issues found`);
      
      return {
        file: filePath,
        fileType: 'markdown',
        issues
      };
      
    } catch (error) {
      if (error instanceof ScaffoldError) {
        throw error;
      }
      
      const errorMsg = `Markdown check failed for ${filePath}: ${(error as Error).message}`;
      logger.error(errorMsg, error as Error);
      
      // 返回包含错误信息的结果，而不是抛出异常
      return {
        file: filePath,
        fileType: 'markdown',
        issues: [{
          file: filePath,
          line: 0,
          severity: 'error',
          message: `File check failed: ${(error as Error).message}`
        }]
      };
    }
  }
  
  /**
   * 批量检查 Markdown 文件
   * @param filePaths 文件路径数组
   * @returns 检查结果数组
   */
  async checkMultiple(filePaths: string[]): Promise<FileCheckResult[]> {
    const results: FileCheckResult[] = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.check(filePath);
        results.push(result);
      } catch (error) {
        logger.warn(`Skipping markdown file ${filePath}: ${(error as Error).message}`);
        results.push({
          file: filePath,
          fileType: 'markdown',
          issues: [{
            file: filePath,
            line: 0,
            severity: 'error',
            message: `File access failed: ${(error as Error).message}`
          }]
        });
      }
    }
    
    return results;
  }
  
  /**
   * 读取文件内容
   */
  private async readFileContent(filePath: string): Promise<string> {
    try {
      const resolvedPath = await resolveWorkspacePath(filePath, {
        errorType: 'scaffold',
        contextName: 'Markdown文件'
      });
      const content = await fs.readFile(resolvedPath, 'utf-8');
      
      logger.debug(`📄 File read successfully: ${filePath} (${Buffer.byteLength(content, 'utf-8')} bytes)`);
      return content;
      
    } catch (error) {
      throw new ScaffoldError(
        ScaffoldErrorType.FILE_NOT_FOUND,
        `Cannot read markdown file: ${filePath} - ${(error as Error).message}`
      );
    }
  }
  
  // 🚀 路径解析现在使用公共工具 resolveWorkspacePath
  
  /**
   * 转换 markdownlint 问题为统一格式
   */
  private convertMarkdownlintIssues(filePath: string, issues: any[]): Issue[] {
    return issues.map(issue => ({
      file: filePath,
      line: issue.lineNumber,
      column: issue.columnNumber,
      rule: issue.ruleNames[0], // 使用第一个规则名
      severity: this.determineSeverity(issue),
      message: this.formatErrorMessage(issue)
    }));
  }
  
  /**
   * 确定问题严重程度
   * 大部分 markdownlint 问题都是警告级别，只有少数是错误级别
   */
  private determineSeverity(issue: any): 'error' | 'warning' {
    // 严重的语法错误
    const errorRules = ['MD001', 'MD002', 'MD003']; // 标题层级错误
    
    if (errorRules.some(rule => issue.ruleNames.includes(rule))) {
      return 'error';
    }
    
    return 'warning'; // 默认为警告
  }
  
  /**
   * 格式化错误消息
   */
  private formatErrorMessage(issue: any): string {
    const ruleDescription = issue.ruleDescription || '';
    const detail = issue.errorDetail || '';
    
    if (detail) {
      return `${ruleDescription}: ${detail}`;
    }
    
    return ruleDescription;
  }
}
