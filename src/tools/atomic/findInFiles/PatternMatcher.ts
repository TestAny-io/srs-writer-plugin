/**
 * 模式匹配器 - 支持正则和文本匹配
 */

import { Logger } from '../../../utils/logger';
import { 
  PatternCompileOptions, 
  CompiledPattern, 
  PatternMatch,
  FindInFilesError,
  FindInFilesErrorType 
} from './types';

const logger = Logger.getInstance();

export class PatternMatcher {
  compile(options: PatternCompileOptions): CompiledPattern {
    if (options.regex) {
      return this.compileRegexPattern(options);
    } else {
      return this.compileTextPattern(options);
    }
  }
  
  private compileRegexPattern(options: PatternCompileOptions): CompiledPattern {
    try {
      const flags = this.buildRegexFlags(options);
      const regex = new RegExp(options.pattern, flags);
      
      return {
        type: 'regex',
        originalPattern: options.pattern,
        test: (text: string) => {
          regex.lastIndex = 0; // 重置regex状态
          return regex.test(text);
        },
        findAll: (text: string) => {
          const matches: PatternMatch[] = [];
          const lines = text.split('\n');
          
          lines.forEach((line, lineIndex) => {
            regex.lastIndex = 0; // 重置regex状态
            let match;
            while ((match = regex.exec(line)) !== null) {
              matches.push({
                match: match[0],
                index: match.index,
                line: lineIndex + 1, // 1-based line numbers
                column: match.index + 1 // 1-based column numbers
              });
              
              // 避免无限循环（对于零宽度匹配）
              if (match.index === regex.lastIndex) {
                regex.lastIndex++;
              }
            }
          });
          
          return matches;
        }
      };
    } catch (error) {
      throw new FindInFilesError(
        FindInFilesErrorType.INVALID_REGEX,
        `Invalid regex pattern: ${options.pattern}`
      );
    }
  }
  
  private compileTextPattern(options: PatternCompileOptions): CompiledPattern {
    const needle = options.caseSensitive ? 
      options.pattern : 
      options.pattern.toLowerCase();
      
    return {
      type: 'text',
      originalPattern: options.pattern,
      test: (text: string) => {
        const haystack = options.caseSensitive ? text : text.toLowerCase();
        return haystack.includes(needle);
      },
      findAll: (text: string) => {
        const matches: PatternMatch[] = [];
        const lines = text.split('\n');
        
        lines.forEach((line, lineIndex) => {
          const haystack = options.caseSensitive ? line : line.toLowerCase();
          let startIndex = 0;
          
          while (true) {
            const index = haystack.indexOf(needle, startIndex);
            if (index === -1) break;
            
            matches.push({
              match: line.substring(index, index + options.pattern.length),
              index: index,
              line: lineIndex + 1, // 1-based line numbers
              column: index + 1 // 1-based column numbers
            });
            
            startIndex = index + needle.length;
          }
        });
        
        return matches;
      }
    };
  }
  
  private buildRegexFlags(options: PatternCompileOptions): string {
    let flags = 'g'; // 全局匹配
    
    if (!options.caseSensitive) {
      flags += 'i'; // 忽略大小写
    }
    
    // 可以根据需要添加更多标志
    // flags += 'm'; // 多行模式
    // flags += 's'; // dotAll模式
    
    return flags;
  }
}
