/**
 * 文件类型检测器
 * 基于扩展名检测文件类型，支持未来扩展内容检测
 */

import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { FileType } from './types';

const logger = Logger.getInstance();

/**
 * 文件类型检测器
 */
export class FileTypeDetector {
  
  /**
   * 检测单个文件的类型
   * @param filePath 文件路径
   * @returns 文件类型
   */
  static detectFileType(filePath: string): FileType {
    const ext = path.extname(filePath).toLowerCase();
    
    // 基于扩展名的检测
    if (ext === '.md' || ext === '.markdown') return 'markdown';
    if (ext === '.yaml' || ext === '.yml') return 'yaml';
    
    // TODO: 未来可扩展基于文件内容的检测
    // - 检测文件头部的YAML front matter
    // - 检测文件内容特征（如Markdown语法特征）
    
    return 'unsupported';
  }
  
  /**
   * 处理文件列表，按类型分类
   * @param files 文件对象数组
   * @returns 分类后的文件列表
   */
  static processFileList(files: Array<{ path: string }>): {
    markdownFiles: string[];
    yamlFiles: string[];
    unsupportedFiles: string[];
  } {
    const markdownFiles: string[] = [];
    const yamlFiles: string[] = [];
    const unsupportedFiles: string[] = [];
    
    for (const file of files) {
      const fileType = this.detectFileType(file.path);
      switch (fileType) {
        case 'markdown':
          markdownFiles.push(file.path);
          break;
        case 'yaml':
          yamlFiles.push(file.path);
          break;
        case 'unsupported':
          unsupportedFiles.push(file.path);
          break;
      }
    }
    
    // 对不支持的文件给出警告，但不中断执行
    if (unsupportedFiles.length > 0) {
      logger.warn(`Skipping unsupported file formats: ${unsupportedFiles.join(', ')}. Only .md, .markdown, .yaml, .yml files are supported.`);
    }
    
    logger.info(`📊 File type analysis: ${markdownFiles.length} markdown, ${yamlFiles.length} yaml, ${unsupportedFiles.length} unsupported`);
    
    return { markdownFiles, yamlFiles, unsupportedFiles };
  }
  
  /**
   * 检查是否为支持的文件类型
   * @param filePath 文件路径
   * @returns 是否支持
   */
  static isSupportedFileType(filePath: string): boolean {
    return this.detectFileType(filePath) !== 'unsupported';
  }
  
  /**
   * 获取支持的文件扩展名列表
   * @returns 支持的扩展名数组
   */
  static getSupportedExtensions(): string[] {
    return ['.md', '.markdown', '.yaml', '.yml'];
  }
}
