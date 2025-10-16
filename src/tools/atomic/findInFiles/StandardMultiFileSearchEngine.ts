/**
 * 标准多文件搜索引擎 - 核心搜索执行器
 */

import * as fs from 'fs/promises';
import { Logger } from '../../../utils/logger';
import { PatternMatcher } from './PatternMatcher';
import { FileScanner } from './FileScanner';
import { ResultFormatter } from './ResultFormatter';
import { SimpleErrorHandler } from './SimpleErrorHandler';
import { 
  FindInFilesArgs, 
  FindInFilesResult, 
  SearchScope, 
  FileSearchResult,
  CompiledPattern,
  LineMatch,
  FindInFilesError,
  FindInFilesErrorType
} from './types';

const logger = Logger.getInstance();

export class StandardMultiFileSearchEngine {
  private patternMatcher = new PatternMatcher();
  private fileScanner = new FileScanner();
  private resultFormatter = new ResultFormatter();
  private errorHandler = new SimpleErrorHandler();
  
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB - 适合中小项目
  private readonly BATCH_SIZE = 50; // 批处理大小
  
  /**
   * 执行多文件搜索
   */
  async execute(args: FindInFilesArgs, scope: SearchScope): Promise<FindInFilesResult> {
    try {
      logger.info(`🔍 [StandardMultiFileSearchEngine] 开始搜索: pattern="${args.pattern}", scope="${scope.type}"`);
      
      // 1. 参数验证
      this.validateArgs(args);
      
      // 2. 文件发现
      const targetFiles = await this.fileScanner.discoverFiles({
        targetPath: scope.targetPath,
        filePattern: scope.filePattern,
        respectIgnoreFiles: true
      });
      
      if (targetFiles.length === 0) {
        logger.info(`🔍 [StandardMultiFileSearchEngine] 未找到匹配的文件`);
        return {
          success: true,
          totalMatches: 0,
          matches: []
        };
      }
      
      // 3. 模式编译
      const matcher = this.patternMatcher.compile({
        pattern: args.pattern,
        regex: args.regex || false,
        caseSensitive: args.caseSensitive || false
      });
      
      // 4. 并行搜索执行
      const searchResults = await this.executeParallelSearch(targetFiles, matcher, args);
      
      // 5. 结果格式化
      const formattedResult = this.resultFormatter.format(
        searchResults, 
        args.outputMode || 'content',
        args
      );
      
      // 6. 应用结果数量限制
      if (args.limit && formattedResult.matches) {
        formattedResult.matches = this.resultFormatter.limitResults(formattedResult.matches, args.limit);
        // 重新计算totalMatches（如果被限制）
        if (args.outputMode === 'content') {
          formattedResult.totalMatches = formattedResult.matches.length;
        }
      }
      
      logger.info(`✅ [StandardMultiFileSearchEngine] 搜索完成: ${formattedResult.totalMatches}个匹配结果`);
      return formattedResult;
      
    } catch (error) {
      logger.error(`❌ [StandardMultiFileSearchEngine] 搜索失败`, error as Error);
      return this.errorHandler.handleError(error as Error, args);
    }
  }

  /**
   * 参数验证
   */
  private validateArgs(args: FindInFilesArgs): void {
    if (!args.pattern || args.pattern.trim().length === 0) {
      throw new FindInFilesError(
        FindInFilesErrorType.SEARCH_ERROR,
        'Search pattern cannot be empty'
      );
    }
    
    // 验证context参数
    if (args.context !== undefined && (args.context < 0 || args.context > 20)) {
      throw new FindInFilesError(
        FindInFilesErrorType.SEARCH_ERROR,
        'Context lines must be between 0 and 20'
      );
    }
    
    // 验证limit参数
    if (args.limit !== undefined && (args.limit < 1 || args.limit > 1000)) {
      throw new FindInFilesError(
        FindInFilesErrorType.SEARCH_ERROR,
        'Limit must be between 1 and 1000'
      );
    }
  }

  /**
   * 并行搜索执行 - 简化版本
   */
  private async executeParallelSearch(
    filePaths: string[],
    matcher: CompiledPattern,
    args: FindInFilesArgs
  ): Promise<FileSearchResult[]> {
    const results: FileSearchResult[] = [];
    
    logger.debug(`🔍 [StandardMultiFileSearchEngine] 开始搜索 ${filePaths.length} 个文件`);
    
    // 简化的批处理执行
    for (let i = 0; i < filePaths.length; i += this.BATCH_SIZE) {
      const batch = filePaths.slice(i, i + this.BATCH_SIZE);
      
      // 并行处理批次内的文件
      const batchPromises = batch.map(filePath => 
        this.searchSingleFile(filePath, matcher, args)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // 处理成功的结果
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          if (result.value.matchCount > 0) {
            results.push(result.value);
          }
        } else if (result.status === 'rejected') {
          logger.warn(`🔍 [StandardMultiFileSearchEngine] 搜索文件失败: ${batch[index]}, 原因: ${result.reason}`);
        }
      });
      
      // 简单的事件循环让步
      if (i + this.BATCH_SIZE < filePaths.length) {
        await new Promise(resolve => setImmediate(resolve));
      }
      
      // 提前停止（如果已达到足够的结果）
      if (args.limit && results.length >= args.limit) {
        logger.debug(`🔍 [StandardMultiFileSearchEngine] 达到结果数量限制，提前停止`);
        break;
      }
    }
    
    return results;
  }

  /**
   * 搜索单个文件
   */
  private async searchSingleFile(
    filePath: string, 
    matcher: CompiledPattern,
    args: FindInFilesArgs
  ): Promise<FileSearchResult | null> {
    try {
      // 检查文件大小
      const stats = await fs.stat(filePath);
      if (stats.size > this.MAX_FILE_SIZE) {
        logger.debug(`🔍 [StandardMultiFileSearchEngine] 跳过大文件: ${filePath} (${Math.round(stats.size / 1024 / 1024)}MB)`);
        return null;
      }
      
      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');
      
      // 执行模式匹配
      const patternMatches = matcher.findAll(content);
      
      if (patternMatches.length === 0) {
        return null;
      }
      
      // 转换为LineMatch格式，并提取实际的行文本
      const lines = content.split('\n');
      const lineMatches: LineMatch[] = patternMatches.map(match => ({
        line: match.line,
        column: match.column,
        text: lines[match.line - 1] || '' // 获取实际的行文本
      }));
      
      return {
        filePath: filePath,
        matches: lineMatches,
        matchCount: lineMatches.length
      };
      
    } catch (error) {
      // 文件读取失败，记录警告但不抛出错误
      logger.warn(`🔍 [StandardMultiFileSearchEngine] 无法读取文件: ${filePath}, 错误: ${(error as Error).message}`);
      return null;
    }
  }
}
