/**
 * 语法检查器主控制器
 * 协调 Markdown 和 YAML 检查器，生成统一的质量报告
 */

import { Logger } from '../../../utils/logger';
import { ScaffoldError, ScaffoldErrorType } from '../scaffoldGenerator/types';
import { FileTypeDetector } from './FileTypeDetector';
import { MarkdownChecker } from './MarkdownChecker';
import { YAMLChecker } from './YAMLChecker';
import { QualityReportWriter } from './QualityReportWriter';
import { SyntaxCheckerConfigLoader } from './SyntaxCheckerConfigLoader';
import { SyntaxCheckArgs, SyntaxCheckResult, Issue, FileCheckResult } from './types';

const logger = Logger.getInstance();

/**
 * 语法检查器主控制器
 */
export class SyntaxChecker {
  
  /**
   * 执行文件语法检查
   * @param args 检查参数
   * @returns 检查结果
   */
  async checkFiles(args: SyntaxCheckArgs): Promise<SyntaxCheckResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`🚀 Starting syntax check: ${args.summary}`);
      
      // 1. 检查工具是否启用
      const config = SyntaxCheckerConfigLoader.loadConfig();
      if (!config.enabled) {
        throw new ScaffoldError(
          ScaffoldErrorType.INVALID_SRS_FORMAT,
          'Syntax checker is disabled in VSCode settings'
        );
      }
      
      // 2. 文件类型分析
      const { markdownFiles, yamlFiles, unsupportedFiles } = FileTypeDetector.processFileList(args.files);
      
      // 3. 检查是否有可处理的文件
      if (markdownFiles.length === 0 && yamlFiles.length === 0) {
        if (unsupportedFiles.length > 0) {
          logger.warn(`No supported files found. All files are unsupported formats: ${unsupportedFiles.join(', ')}`);
          return {
            success: true,
            totalFiles: args.files.length,
            processedFiles: 0,
            skippedFiles: unsupportedFiles,
            issues: []
          };
        } else {
          throw new ScaffoldError(
            ScaffoldErrorType.FILE_NOT_FOUND,
            'No files provided for syntax checking'
          );
        }
      }
      
      // 4. 执行检查
      const allIssues: Issue[] = [];
      let processedFiles = 0;
      
      // 检查 Markdown 文件
      if (markdownFiles.length > 0 && config.markdown.enabled) {
        const markdownChecker = new MarkdownChecker();
        const markdownResults = await markdownChecker.checkMultiple(markdownFiles);
        
        // 收集问题和统计
        const markdownIssues = markdownResults.flatMap(result => result.issues);
        allIssues.push(...markdownIssues);
        processedFiles += markdownFiles.length;
        
        // 生成 Markdown 检查报告
        await this.generateMarkdownReport(markdownResults);
      }
      
      // 检查 YAML 文件
      if (yamlFiles.length > 0 && config.yaml.enabled) {
        const yamlChecker = new YAMLChecker();
        const yamlResults = await yamlChecker.checkMultiple(yamlFiles);
        
        // 收集问题和统计
        const yamlIssues = yamlResults.flatMap(result => result.issues);
        allIssues.push(...yamlIssues);
        processedFiles += yamlFiles.length;
        
        // 生成 YAML 检查报告
        await this.generateYAMLReport(yamlResults);
      }
      
      const executionTime = Date.now() - startTime;
      
      logger.info(`✅ Syntax check completed: ${processedFiles} files processed, ${allIssues.length} issues found in ${executionTime}ms`);
      
      return {
        success: true,
        totalFiles: args.files.length,
        processedFiles,
        skippedFiles: unsupportedFiles,
        issues: allIssues,
        executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (error instanceof ScaffoldError) {
        logger.error(`Syntax check failed: ${error.message}`);
        return {
          success: false,
          totalFiles: args.files.length,
          processedFiles: 0,
          skippedFiles: [],
          issues: [],
          executionTime,
          error: error.message
        };
      }
      
      const errorMsg = `Unexpected error during syntax check: ${(error as Error).message}`;
      logger.error(errorMsg, error as Error);
      
      return {
        success: false,
        totalFiles: args.files.length,
        processedFiles: 0,
        skippedFiles: [],
        issues: [],
        executionTime,
        error: errorMsg
      };
    }
  }
  
  /**
   * 生成 Markdown 检查报告
   */
  private async generateMarkdownReport(results: FileCheckResult[]): Promise<void> {
    try {
      const projectName = await this.getProjectName();
      const reportWriter = new QualityReportWriter();
      
      const allIssues = results.flatMap(result => result.issues);
      const filesChecked = results.filter(result => !result.skipped).length;
      
      await reportWriter.appendCheckToReport(
        projectName,
        'markdown-syntax',
        'syntax-checker',
        allIssues,
        { filesChecked }
      );
      
    } catch (error) {
      logger.warn(`Failed to generate markdown report: ${(error as Error).message}`);
    }
  }
  
  /**
   * 生成 YAML 检查报告
   */
  private async generateYAMLReport(results: FileCheckResult[]): Promise<void> {
    try {
      const projectName = await this.getProjectName();
      const reportWriter = new QualityReportWriter();
      
      const allIssues = results.flatMap(result => result.issues);
      const filesChecked = results.filter(result => !result.skipped).length;
      
      await reportWriter.appendCheckToReport(
        projectName,
        'yaml-syntax',
        'syntax-checker',
        allIssues,
        { filesChecked }
      );
      
    } catch (error) {
      logger.warn(`Failed to generate YAML report: ${(error as Error).message}`);
    }
  }
  
  /**
   * 获取当前项目名称
   * 复用现有的会话管理逻辑
   */
  private async getProjectName(): Promise<string> {
    try {
      const { SessionManager } = await import('../../../core/session-manager');
      const sessionManager = SessionManager.getInstance();
      const currentSession = await sessionManager.getCurrentSession();
      
      return currentSession?.projectName || 'unnamed';
    } catch (error) {
      logger.warn(`Failed to get project name: ${(error as Error).message}`);
      return 'unnamed';
    }
  }
}
