/**
 * YAML 语法检查器
 * 复用现有的 YAMLReader 基础设施进行语法检查
 * 支持分级检查和 requirements.yaml 特定规则
 */

import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { YAMLReader } from '../yamlEditor/YAMLReader';
import { ScaffoldError, ScaffoldErrorType } from '../scaffoldGenerator/types';
import { SyntaxCheckerConfigLoader } from './SyntaxCheckerConfigLoader';
import { Issue, FileCheckResult, YAMLConfig } from './types';

const logger = Logger.getInstance();

/**
 * YAML 语法检查器
 */
export class YAMLChecker {
  
  /**
   * 检查单个 YAML 文件
   * @param filePath 文件路径（相对于项目根目录）
   * @returns 检查结果
   */
  async check(filePath: string): Promise<FileCheckResult> {
    try {
      logger.info(`📄 Checking YAML file: ${filePath}`);
      
      // 加载配置
      const config = SyntaxCheckerConfigLoader.loadYAMLConfig();
      if (!config.enabled) {
        return {
          file: filePath,
          fileType: 'yaml',
          issues: [],
          skipped: true,
          skipReason: 'YAML checking disabled in configuration'
        };
      }
      
      // 使用 YAMLReader 进行基础语法检查
      const readResult = await YAMLReader.readAndParse({
        path: filePath,
        includeStructure: false
      });
      
      const issues: Issue[] = [];
      
      // 基础语法检查
      if (!readResult.success) {
        issues.push({
          file: filePath,
          line: this.extractLineNumber(readResult.error || ''),
          severity: 'error',
          message: this.formatYAMLError(readResult.error || 'YAML parsing failed')
        });
      } else if (config.checkStructure && readResult.parsedData) {
        // 结构检查（仅在语法正确时进行）
        const structureIssues = await this.validateStructure(filePath, readResult.parsedData, config);
        issues.push(...structureIssues);
      }
      
      logger.info(`📄 YAML check completed for ${filePath}: ${issues.length} issues found`);
      
      return {
        file: filePath,
        fileType: 'yaml',
        issues
      };
      
    } catch (error) {
      if (error instanceof ScaffoldError) {
        throw error;
      }
      
      const errorMsg = `YAML check failed for ${filePath}: ${(error as Error).message}`;
      logger.error(errorMsg, error as Error);
      
      // 返回包含错误信息的结果
      return {
        file: filePath,
        fileType: 'yaml',
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
   * 批量检查 YAML 文件
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
        logger.warn(`Skipping YAML file ${filePath}: ${(error as Error).message}`);
        results.push({
          file: filePath,
          fileType: 'yaml',
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
   * 验证 YAML 结构
   */
  private async validateStructure(
    filePath: string, 
    data: any, 
    config: YAMLConfig
  ): Promise<Issue[]> {
    const issues: Issue[] = [];
    
    try {
      // 基本结构检查
      if (config.level === 'standard' || config.level === 'strict') {
        issues.push(...this.validateBasicStructure(filePath, data));
      }
      
      // requirements.yaml 特定检查
      if (config.checkRequirementsYaml && this.isRequirementsFile(filePath)) {
        issues.push(...this.validateRequirementsYamlStructure(filePath, data));
      }
      
    } catch (error) {
      logger.warn(`Structure validation failed for ${filePath}: ${(error as Error).message}`);
      issues.push({
        file: filePath,
        line: 0,
        severity: 'warning',
        message: `Structure validation failed: ${(error as Error).message}`
      });
    }
    
    return issues;
  }
  
  /**
   * 基本结构验证
   */
  private validateBasicStructure(filePath: string, data: any): Issue[] {
    const issues: Issue[] = [];
    
    // 检查是否为空文件
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      issues.push({
        file: filePath,
        line: 1,
        severity: 'warning',
        message: 'YAML file appears to be empty'
      });
    }
    
    // 检查顶级结构是否为对象
    if (data && typeof data !== 'object') {
      issues.push({
        file: filePath,
        line: 1,
        severity: 'warning',
        message: 'YAML root should be an object, not a primitive value'
      });
    }
    
    return issues;
  }
  
  /**
   * requirements.yaml 特定结构验证
   */
  private validateRequirementsYamlStructure(filePath: string, data: any): Issue[] {
    const issues: Issue[] = [];
    
    // 检查必需的顶级字段
    const requiredFields = [
      'user_stories',
      'functional_requirements', 
      '_metadata'
    ];
    
    const recommendedFields = [
      'use_cases',
      'non_functional_requirements',
      'interface_requirements'
    ];
    
    // 必需字段检查
    for (const field of requiredFields) {
      if (!(field in data)) {
        issues.push({
          file: filePath,
          line: 0,
          severity: 'error',
          message: `Missing required field: ${field}`
        });
      }
    }
    
    // 推荐字段检查
    for (const field of recommendedFields) {
      if (!(field in data)) {
        issues.push({
          file: filePath,
          line: 0,
          severity: 'warning',
          message: `Missing recommended field: ${field}`
        });
      }
    }
    
    // 检查 _metadata 结构
    if (data._metadata) {
      if (!data._metadata.schema_version) {
        issues.push({
          file: filePath,
          line: 0,
          severity: 'warning',
          message: 'Missing recommended field: _metadata.schema_version'
        });
      }
    }
    
    return issues;
  }
  
  /**
   * 判断是否为 requirements.yaml 文件
   */
  private isRequirementsFile(filePath: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    return fileName === 'requirements.yaml' || fileName === 'requirements.yml';
  }
  
  /**
   * 从错误消息中提取行号
   */
  private extractLineNumber(errorMessage: string): number | undefined {
    const lineMatch = errorMessage.match(/line (\d+)/i);
    return lineMatch ? parseInt(lineMatch[1], 10) : undefined;
  }
  
  /**
   * 格式化 YAML 错误消息
   */
  private formatYAMLError(errorMessage: string): string {
    // 简化 js-yaml 的错误消息，使其更用户友好
    if (errorMessage.includes('duplicated mapping key')) {
      return 'Duplicate key found in YAML file';
    }
    
    if (errorMessage.includes('bad indentation')) {
      return 'Incorrect indentation in YAML file';
    }
    
    if (errorMessage.includes('unexpected end of the stream')) {
      return 'Unexpected end of YAML file - check for unclosed structures';
    }
    
    return errorMessage;
  }
}
