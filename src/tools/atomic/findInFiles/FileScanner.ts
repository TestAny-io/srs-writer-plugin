/**
 * 文件扫描器 - 发现和过滤目标文件
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { FileScanOptions, FileInfo, FindInFilesError, FindInFilesErrorType } from './types';

const logger = Logger.getInstance();

export class FileScanner {
  private readonly DEFAULT_SUPPORTED_EXTENSIONS = '*.{md,ts,js,tsx,jsx,yaml,yml,json,html,css,txt}';
  private readonly DEFAULT_IGNORE_PATTERNS = [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '*.log',
    '.env*',
    '.DS_Store'
  ];

  /**
   * 发现匹配条件的文件
   */
  async discoverFiles(options: FileScanOptions): Promise<string[]> {
    try {
      logger.debug(`🔍 [FileScanner] 开始文件发现: ${options.targetPath}`);
      
      // 检查目标路径是否存在
      const stats = await fs.stat(options.targetPath);
      
      if (stats.isFile()) {
        // 单文件：直接返回
        return [options.targetPath];
      }
      
      if (stats.isDirectory()) {
        // 目录：扫描内容
        const pattern = options.filePattern || this.DEFAULT_SUPPORTED_EXTENSIONS;
        const files = await this.scanDirectory(options.targetPath, pattern, options.respectIgnoreFiles);
        
        logger.info(`🔍 [FileScanner] 发现 ${files.length} 个匹配文件`);
        return files;
      }
      
      throw new Error(`Unsupported file type: ${options.targetPath}`);
      
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FindInFilesError(
          FindInFilesErrorType.PATH_NOT_FOUND,
          `Path not found: ${options.targetPath}`
        );
      }
      
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new FindInFilesError(
          FindInFilesErrorType.PERMISSION_DENIED,
          `Permission denied: ${options.targetPath}`
        );
      }
      
      throw error;
    }
  }

  /**
   * 扫描目录，返回匹配模式的文件
   */
  private async scanDirectory(
    dirPath: string, 
    pattern: string, 
    respectIgnoreFiles: boolean = true
  ): Promise<string[]> {
    const files: string[] = [];
    const ignorePatterns = respectIgnoreFiles ? 
      await this.loadIgnorePatterns(dirPath) : 
      this.DEFAULT_IGNORE_PATTERNS;

    await this.scanDirectoryRecursive(dirPath, dirPath, pattern, ignorePatterns, files);
    return files;
  }

  /**
   * 递归扫描目录
   */
  private async scanDirectoryRecursive(
    basePath: string,
    currentPath: string, 
    pattern: string,
    ignorePatterns: string[],
    results: string[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);
        
        // 检查是否应该忽略
        if (this.shouldIgnore(relativePath, ignorePatterns)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          // 递归扫描子目录
          await this.scanDirectoryRecursive(basePath, fullPath, pattern, ignorePatterns, results);
        } else if (entry.isFile()) {
          // 检查文件是否匹配模式
          if (this.matchesPattern(relativePath, pattern)) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      logger.warn(`🔍 [FileScanner] 跳过无法访问的目录: ${currentPath}`);
    }
  }

  /**
   * 检查文件是否匹配模式 (简化版本，使用内置方法)
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    try {
      // 处理简单的glob模式
      if (pattern.includes('*') || pattern.includes('?')) {
        return this.simpleGlobMatch(filePath, pattern);
      }
      
      // 直接字符串匹配
      return filePath.toLowerCase().includes(pattern.toLowerCase());
    } catch (error) {
      logger.warn(`🔍 [FileScanner] 无效的模式: ${pattern}`);
      return false;
    }
  }

  /**
   * 简单的glob匹配实现
   */
  private simpleGlobMatch(filePath: string, pattern: string): boolean {
    // 处理简单的扩展名模式，如 *.ts, *.{js,ts}
    const fileName = path.basename(filePath).toLowerCase();
    const patternLower = pattern.toLowerCase();
    
    // 处理 *.ext 模式
    if (pattern.startsWith('*.') && !pattern.includes('{')) {
      const extension = pattern.substring(2);
      return fileName.endsWith('.' + extension);
    }
    
    // 处理 *.{ext1,ext2} 模式
    if (pattern.includes('{') && pattern.includes('}')) {
      const match = pattern.match(/\*\.{([^}]+)}/);
      if (match) {
        const extensions = match[1].split(',').map(ext => ext.trim());
        return extensions.some(ext => fileName.endsWith('.' + ext));
      }
    }
    
    // 处理 **/*.ext 模式
    if (pattern.startsWith('**/')) {
      const subPattern = pattern.substring(3);
      return this.simpleGlobMatch(fileName, subPattern);
    }
    
    // 简单的通配符匹配
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')  // ** -> .*
      .replace(/\*/g, '[^/]*') // * -> [^/]*
      .replace(/\?/g, '.');    // ? -> .
      
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filePath);
  }

  /**
   * 检查是否应该忽略文件/目录 (简化版本)
   */
  private shouldIgnore(relativePath: string, ignorePatterns: string[]): boolean {
    const pathLower = relativePath.toLowerCase();
    
    return ignorePatterns.some(pattern => {
      // 简单的模式匹配
      if (pattern.includes('*')) {
        return this.simpleGlobMatch(relativePath, pattern);
      }
      
      // 精确匹配或包含匹配
      return pathLower.includes(pattern.toLowerCase()) ||
             pathLower === pattern.toLowerCase();
    });
  }

  /**
   * 加载忽略规则文件
   */
  private async loadIgnorePatterns(basePath: string): Promise<string[]> {
    const patterns = [...this.DEFAULT_IGNORE_PATTERNS];
    
    // 尝试读取.gitignore
    try {
      const gitignorePath = path.join(basePath, '.gitignore');
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      const gitignorePatterns = this.parseIgnoreFile(gitignoreContent);
      patterns.push(...gitignorePatterns);
      
      logger.debug(`🔍 [FileScanner] 加载了 ${gitignorePatterns.length} 个 .gitignore 规则`);
    } catch (error) {
      // .gitignore不存在或无法读取，忽略
    }

    // 尝试读取.cursorignore
    try {
      const cursorignorePath = path.join(basePath, '.cursorignore');
      const cursorignoreContent = await fs.readFile(cursorignorePath, 'utf-8');
      const cursorignorePatterns = this.parseIgnoreFile(cursorignoreContent);
      patterns.push(...cursorignorePatterns);
      
      logger.debug(`🔍 [FileScanner] 加载了 ${cursorignorePatterns.length} 个 .cursorignore 规则`);
    } catch (error) {
      // .cursorignore不存在或无法读取，忽略
    }

    return patterns;
  }

  /**
   * 解析忽略文件内容
   */
  private parseIgnoreFile(content: string): string[] {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#')) // 过滤空行和注释
      .map(line => {
        // 处理特殊格式
        if (line.endsWith('/')) {
          return line + '**'; // 目录匹配
        }
        return line;
      });
  }

  /**
   * 文件类型转换为glob模式
   */
  typeToGlob(type?: string): string | undefined {
    const typeMapping = {
      'js': '*.{js,jsx}',
      'ts': '*.{ts,tsx}', 
      'md': '*.md',
      'yaml': '*.{yaml,yml}',
      'json': '*.json',
      'html': '*.html',
      'css': '*.css',
      'txt': '*.txt'
    };
    
    return type ? typeMapping[type as keyof typeof typeMapping] : undefined;
  }
}
