/**
 * 质量报告写入器
 * 可复用组件，支持多个工具共享使用
 * 实现简化的报告格式和原子性写入
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { ScaffoldError, ScaffoldErrorType } from '../scaffoldGenerator/types';
import { QualityReport, QualityCheckEntry, Issue } from './types';

const logger = Logger.getInstance();

/**
 * 质量报告写入器
 */
export class QualityReportWriter {
  
  /**
   * 添加检查项到质量报告
   * @param projectName 项目名称
   * @param checkType 检查类型 (如 'markdown-syntax', 'yaml-syntax', 'traceability-sync')
   * @param toolName 工具名称
   * @param issues 问题列表
   * @param customSummary 自定义统计信息（用于其他工具）
   */
  async appendCheckToReport(
    projectName: string,
    checkType: string,
    toolName: string,
    issues: Issue[] = [],
    customSummary: Record<string, any> = {}
  ): Promise<void> {
    try {
      const reportPath = await this.getReportFilePath(projectName);
      
      // 确保目录存在
      await this.ensureReportDirectory(reportPath);
      
      // 读取现有报告
      let report = await this.loadExistingReport(reportPath);
      
      // 创建新的检查条目
      const checkEntry: QualityCheckEntry = {
        checkType,
        toolName,
        timestamp: new Date().toISOString(),
        summary: {
          errors: issues.filter(issue => issue.severity === 'error').length,
          warnings: issues.filter(issue => issue.severity === 'warning').length,
          ...customSummary
        },
        ...(issues.length > 0 ? { issues } : {})
        // 移除 results 字段，所有数据都合并到 summary 中
      };
      
      // 移除同类型的旧检查记录（避免重复）
      report.checks = report.checks.filter(check => 
        !(check.checkType === checkType && check.toolName === toolName)
      );
      
      // 添加新检查
      report.checks.push(checkEntry);
      
      // 更新整体摘要
      report.summary = this.calculateOverallSummary(report.checks);
      report.generatedAt = new Date().toISOString();
      
      // 原子性写入
      await this.atomicWriteReport(reportPath, report);
      
      logger.info(`✅ Quality report updated: ${checkType} results written to ${path.basename(reportPath)}`);
      
    } catch (error) {
      const errorMsg = `Failed to write quality report: ${(error as Error).message}`;
      logger.error(errorMsg, error as Error);
      
      throw new ScaffoldError(
        ScaffoldErrorType.OUTPUT_WRITE_FAILED,
        errorMsg
      );
    }
  }
  
  /**
   * 获取报告文件路径
   */
  private async getReportFilePath(projectName: string): Promise<string> {
    const sanitizedName = this.sanitizeProjectName(projectName);
    
    try {
      // 复用项目的路径解析逻辑
      const baseDir = await this.getBaseDir();
      return path.join(baseDir, `srs_quality_check_report_${sanitizedName}.json`);
    } catch (error) {
      logger.warn(`Failed to get base directory: ${(error as Error).message}`);
      // 使用当前工作目录作为回退
      return `srs_quality_check_report_${sanitizedName}.json`;
    }
  }
  
  /**
   * 确保报告目录存在
   */
  private async ensureReportDirectory(reportPath: string): Promise<void> {
    const dir = path.dirname(reportPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // 目录可能已存在，忽略错误
    }
  }
  
  /**
   * 加载现有报告
   */
  private async loadExistingReport(reportPath: string): Promise<QualityReport> {
    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      // 验证报告格式
      if (this.isValidReportFormat(parsed)) {
        return parsed;
      }
      
      logger.warn(`Invalid report format in ${reportPath}, creating new report`);
      return await this.createEmptyReport();
      
    } catch (error) {
      // 文件不存在或读取失败，创建新报告
      return await this.createEmptyReport();
    }
  }
  
  /**
   * 原子性写入报告
   */
  private async atomicWriteReport(reportPath: string, report: QualityReport): Promise<void> {
    const tempPath = `${reportPath}.tmp`;
    
    try {
      // 写入临时文件
      await fs.writeFile(tempPath, JSON.stringify(report, null, 2), 'utf-8');
      
      // 原子性重命名
      await fs.rename(tempPath, reportPath);
      
    } catch (error) {
      // 清理临时文件
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        logger.warn(`Failed to cleanup temp file: ${tempPath}`);
      }
      
      throw error;
    }
  }
  
  /**
   * 创建空报告
   */
  private async createEmptyReport(): Promise<QualityReport> {
    const projectName = await this.getProjectName();
    
    return {
      projectName: this.sanitizeProjectName(projectName),
      generatedAt: new Date().toISOString(),
      summary: {
        totalChecks: 0,
        totalFiles: 0,
        filesWithIssues: 0,
        totalErrors: 0,
        totalWarnings: 0
      },
      checks: []
    };
  }
  
  /**
   * 计算整体摘要
   */
  private calculateOverallSummary(checks: QualityCheckEntry[]): QualityReport['summary'] {
    let totalFiles = 0;
    let filesWithIssues = 0;
    let totalErrors = 0;
    let totalWarnings = 0;
    
    for (const check of checks) {
      if (check.summary.filesChecked) {
        totalFiles += check.summary.filesChecked;
      }
      
      totalErrors += check.summary.errors || 0;
      totalWarnings += check.summary.warnings || 0;
      
      // 统计有问题的文件数（避免重复计算）
      if (check.issues && check.issues.length > 0) {
        const uniqueFiles = new Set(check.issues.map(issue => issue.file));
        filesWithIssues += uniqueFiles.size;
      }
    }
    
    return {
      totalChecks: checks.length,
      totalFiles,
      filesWithIssues,
      totalErrors,
      totalWarnings
    };
  }
  
  /**
   * 验证报告格式
   */
  private isValidReportFormat(report: any): boolean {
    return (
      report &&
      typeof report === 'object' &&
      typeof report.projectName === 'string' &&
      typeof report.generatedAt === 'string' &&
      Array.isArray(report.checks) &&
      report.summary &&
      typeof report.summary.totalChecks === 'number'
    );
  }
  
  /**
   * 获取基础目录
   * 复用现有的会话管理逻辑
   */
  private async getBaseDir(): Promise<string> {
    try {
      const { SessionManager } = await import('../../../core/session-manager');
      const sessionManager = SessionManager.getInstance();
      const currentSession = await sessionManager.getCurrentSession();
      
      if (currentSession?.baseDir) {
        return currentSession.baseDir;
      }
    } catch (error) {
      logger.warn(`Failed to get baseDir from session: ${(error as Error).message}`);
    }

    // 回退到VSCode工作区
    const workspaceFolders = require('vscode').workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace found');
    }

    return workspaceFolders[0].uri.fsPath;
  }
  
  /**
   * 获取当前项目名称
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
  
  /**
   * 项目名称安全处理
   * 复用 SessionPathManager 的处理逻辑
   */
  private sanitizeProjectName(projectName: string): string {
    return projectName
      .replace(/[^a-zA-Z0-9_-]/g, '_')  // 替换特殊字符为下划线
      .replace(/_{2,}/g, '_')           // 合并多个连续下划线
      .toLowerCase()                    // 转为小写
      .substring(0, 30);               // 限制长度
  }
}
