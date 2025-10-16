/**
 * 简单错误处理器 - 提供清晰有用的错误信息
 */

import { Logger } from '../../../utils/logger';
import { FindInFilesArgs, FindInFilesResult, FindInFilesErrorType } from './types';

const logger = Logger.getInstance();

export class SimpleErrorHandler {
  
  /**
   * 处理错误并生成用户友好的错误响应
   */
  handleError(error: Error, args: FindInFilesArgs): FindInFilesResult {
    const errorType = this.classifyError(error);
    const errorMessage = this.createSimpleMessage(errorType, error, args);
    const suggestions = this.getQuickSuggestions(errorType);
    
    logger.error(`🚨 [FindInFiles] ${errorMessage}`, error);
    
    return {
      success: false,
      error: errorMessage,
      errorType: errorType,
      suggestions: suggestions
    };
  }

  /**
   * 错误分类
   */
  private classifyError(error: Error): string {
    // 检查自定义错误类型
    if (error instanceof Error && (error as any).type) {
      return (error as any).type;
    }
    
    // 基于错误消息分类
    const message = error.message.toLowerCase();
    
    if (message.includes('invalid regular expression') || message.includes('invalid regex')) {
      return FindInFilesErrorType.INVALID_REGEX;
    }
    
    if (message.includes('enoent') || message.includes('not found') || message.includes('no such file')) {
      return FindInFilesErrorType.PATH_NOT_FOUND;
    }
    
    if (message.includes('eacces') || message.includes('permission denied')) {
      return FindInFilesErrorType.PERMISSION_DENIED;
    }
    
    if (message.includes('workspace') || message.includes('folder')) {
      return FindInFilesErrorType.WORKSPACE_ERROR;
    }
    
    return FindInFilesErrorType.SEARCH_ERROR;
  }

  /**
   * 生成简洁的错误消息
   */
  private createSimpleMessage(errorType: string, error: Error, args: FindInFilesArgs): string {
    switch (errorType) {
      case FindInFilesErrorType.INVALID_REGEX:
        return `Invalid regex pattern: ${args.pattern}`;
      case FindInFilesErrorType.PATH_NOT_FOUND:
        return `Path not found: ${args.path}`;
      case FindInFilesErrorType.PERMISSION_DENIED:
        return `Permission denied: ${args.path}`;
      case FindInFilesErrorType.WORKSPACE_ERROR:
        return `Workspace not available`;
      default:
        return `Search failed: ${error.message}`;
    }
  }

  /**
   * 提供快速解决建议
   */
  private getQuickSuggestions(errorType: string): string[] {
    const suggestions = {
      [FindInFilesErrorType.INVALID_REGEX]: [
        'Try text search without regex',
        'Check regex syntax'
      ],
      [FindInFilesErrorType.PATH_NOT_FOUND]: [
        'Check if path exists',
        'Use listAllFiles to explore'
      ],
      [FindInFilesErrorType.PERMISSION_DENIED]: [
        'Check file permissions',
        'Try different path'
      ],
      [FindInFilesErrorType.WORKSPACE_ERROR]: [
        'Open project folder in VSCode'
      ],
      [FindInFilesErrorType.SEARCH_ERROR]: [
        'Check parameters',
        'Try simpler search pattern'
      ]
    };
    
    return suggestions[errorType as keyof typeof suggestions] || ['Check parameters'];
  }
}
