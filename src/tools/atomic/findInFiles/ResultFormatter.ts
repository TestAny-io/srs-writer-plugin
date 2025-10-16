/**
 * 结果格式化器 - 将搜索结果格式化为不同输出模式
 */

import { Logger } from '../../../utils/logger';
import { FindInFilesResult, Match, ContentMatch, FileMatch, CountMatch, FileSearchResult, FindInFilesArgs } from './types';

const logger = Logger.getInstance();

export class ResultFormatter {
  
  /**
   * 格式化搜索结果为指定的输出模式
   */
  format(
    rawResults: FileSearchResult[], 
    outputMode: 'content' | 'files' | 'count',
    args: FindInFilesArgs
  ): FindInFilesResult {
    
    const totalMatches = rawResults.reduce((sum, result) => sum + result.matchCount, 0);
    
    logger.debug(`📊 [ResultFormatter] 格式化结果: ${rawResults.length}个文件, ${totalMatches}个匹配, 模式=${outputMode}`);
    
    if (totalMatches === 0) {
      return {
        success: true,
        totalMatches: 0,
        matches: []
      };
    }

    let formattedMatches: Match[];
    
    switch (outputMode) {
      case 'content':
        formattedMatches = this.formatContentMode(rawResults, args);
        break;
      case 'files':
        formattedMatches = this.formatFilesMode(rawResults);
        break;
      case 'count':
        formattedMatches = this.formatCountMode(rawResults);
        break;
      default:
        formattedMatches = this.formatContentMode(rawResults, args);
    }

    return {
      success: true,
      totalMatches,
      matches: formattedMatches
    };
  }

  /**
   * content模式：显示详细匹配内容和上下文
   */
  private formatContentMode(rawResults: FileSearchResult[], args: FindInFilesArgs): ContentMatch[] {
    const contentMatches: ContentMatch[] = [];
    const contextLines = args.context || 5;
    
    rawResults.forEach(fileResult => {
      if (fileResult.matches.length === 0) return;
      
      // 读取文件内容以提取上下文（在实际实现中应该从搜索过程中保存）
      fileResult.matches.forEach(match => {
        const contentMatch: ContentMatch = {
          file: fileResult.filePath,
          line: match.line,
          text: match.text
        };
        
        // 如果需要上下文且大于0，添加上下文信息
        if (contextLines > 0) {
          contentMatch.context = this.extractContext(
            match.text, // 在实际实现中这里应该是完整的文件行数组
            match.line,
            contextLines
          );
        }
        
        contentMatches.push(contentMatch);
      });
    });

    // 按文件路径和行号排序
    contentMatches.sort((a, b) => {
      if (a.file !== b.file) {
        return a.file.localeCompare(b.file);
      }
      return a.line - b.line;
    });

    return contentMatches;
  }

  /**
   * files模式：只显示文件路径
   */
  private formatFilesMode(rawResults: FileSearchResult[]): FileMatch[] {
    const fileMatches: FileMatch[] = rawResults
      .filter(result => result.matchCount > 0)
      .map(result => ({
        file: result.filePath
      }));

    // 按文件路径排序
    fileMatches.sort((a, b) => a.file.localeCompare(b.file));
    
    return fileMatches;
  }

  /**
   * count模式：显示每个文件的匹配数量
   */
  private formatCountMode(rawResults: FileSearchResult[]): CountMatch[] {
    const countMatches: CountMatch[] = rawResults
      .filter(result => result.matchCount > 0)
      .map(result => ({
        file: result.filePath,
        count: result.matchCount
      }));

    // 按匹配数量降序排列，然后按文件名排序
    countMatches.sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count; // 匹配多的在前
      }
      return a.file.localeCompare(b.file);
    });
    
    return countMatches;
  }

  /**
   * 提取上下文行 (简化版本 - 为了保持接口简洁，暂时返回占位符)
   * 实际使用中，StandardMultiFileSearchEngine应该在搜索过程中保存文件内容
   * 并传递给ResultFormatter以便提取真实的上下文
   */
  private extractContext(currentLine: string, lineNumber: number, contextLines: number): string[] {
    // 简化实现：返回以当前行为中心的上下文占位符
    const context: string[] = [];
    
    // 添加简化的上下文指示
    for (let i = -contextLines; i <= contextLines; i++) {
      const actualLineNum = lineNumber + i;
      if (actualLineNum === lineNumber) {
        context.push(currentLine); // 当前匹配行
      } else if (actualLineNum > 0) {
        context.push(`/* Line ${actualLineNum} context */`); // 占位符
      }
    }
    
    return context;
  }

  /**
   * 限制结果数量
   */
  limitResults<T extends Match>(matches: T[], limit?: number): T[] {
    if (!limit || matches.length <= limit) {
      return matches;
    }
    
    logger.info(`📊 [ResultFormatter] 限制结果数量: ${matches.length} → ${limit}`);
    return matches.slice(0, limit);
  }
}
