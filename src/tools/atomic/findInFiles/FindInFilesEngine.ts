/**
 * FindInFiles主搜索引擎 - 智能范围检测和搜索协调
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';
import { StandardMultiFileSearchEngine } from './StandardMultiFileSearchEngine';
import { FileScanner } from './FileScanner';
import { SimpleErrorHandler } from './SimpleErrorHandler';
import { 
  FindInFilesArgs, 
  FindInFilesResult, 
  SearchScope,
  FindInFilesError,
  FindInFilesErrorType
} from './types';

const logger = Logger.getInstance();

export class FindInFilesEngine {
  private multiFileSearchEngine = new StandardMultiFileSearchEngine();
  private fileScanner = new FileScanner();
  private errorHandler = new SimpleErrorHandler();

  /**
   * 主搜索方法 - 智能范围检测和执行
   */
  async search(args: FindInFilesArgs): Promise<FindInFilesResult> {
    try {
      logger.info(`🔍 [FindInFilesEngine] 开始搜索: pattern="${args.pattern}"`);
      
      // 1. 智能检测搜索范围
      const searchScope = await this.detectSearchScope(args);
      
      logger.debug(`🔍 [FindInFilesEngine] 搜索范围: type=${searchScope.type}, targetPath=${searchScope.targetPath}`);
      
      // 2. 执行搜索
      const result = await this.multiFileSearchEngine.execute(args, searchScope);
      
      return result;
      
    } catch (error) {
      return this.errorHandler.handleError(error as Error, args);
    }
  }

  /**
   * 智能检测搜索范围
   */
  private async detectSearchScope(args: FindInFilesArgs): Promise<SearchScope> {
    const baseDir = await this.getBaseDir();
    
    // 📁 单文件或目录搜索：path参数指定
    if (args.path) {
      const targetPath = path.resolve(baseDir, args.path);
      
      try {
        const stats = await fs.stat(targetPath);
        
        if (stats.isFile()) {
          return {
            type: 'single_file',
            targetPath: targetPath
          };
        }
        
        if (stats.isDirectory()) {
          return {
            type: 'directory_search',
            targetPath: targetPath,
            filePattern: args.glob || this.fileScanner.typeToGlob(args.type)
          };
        }
      } catch (error) {
        throw new FindInFilesError(
          FindInFilesErrorType.PATH_NOT_FOUND,
          `Path not found: ${args.path}`
        );
      }
    }
    
    // 🎯 过滤搜索：使用glob或type过滤baseDir
    if (args.glob || args.type) {
      return {
        type: 'filtered_search',
        targetPath: baseDir,
        filePattern: args.glob || this.fileScanner.typeToGlob(args.type)
      };
    }
    
    // 🚀 默认模式：搜索整个baseDir
    return {
      type: 'full_search',
      targetPath: baseDir,
      filePattern: '*.{md,ts,js,tsx,jsx,yaml,yml,json,html,css}' // 默认支持的文件类型
    };
  }

  /**
   * 获取项目baseDir
   */
  private async getBaseDir(): Promise<string> {
    const workspaceFolder = this.getCurrentWorkspaceFolder();
    if (!workspaceFolder) {
      throw new FindInFilesError(
        FindInFilesErrorType.WORKSPACE_ERROR,
        'No workspace folder is open'
      );
    }
    
    // 尝试从会话管理器获取baseDir
    try {
      const { SessionManager } = await import('../../../core/session-manager');
      const sessionManager = SessionManager.getInstance();
      const sessionData = await sessionManager.getCurrentSession();
      
      if (sessionData?.baseDir) {
        const resolvedBaseDir = path.resolve(sessionData.baseDir);
        logger.debug(`🔍 [FindInFilesEngine] 使用会话baseDir: ${resolvedBaseDir}`);
        return resolvedBaseDir;
      }
    } catch (error) {
      logger.debug(`🔍 [FindInFilesEngine] 无法获取会话baseDir，使用工作空间根目录`);
    }
    
    // 回退到工作空间根目录
    const workspaceRoot = workspaceFolder.uri.fsPath;
    logger.debug(`🔍 [FindInFilesEngine] 使用工作空间根目录: ${workspaceRoot}`);
    return workspaceRoot;
  }

  /**
   * 获取当前工作空间文件夹
   */
  private getCurrentWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }
    
    // 如果有活动编辑器，尝试使用其所在的工作空间
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const activeFileWorkspace = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
      if (activeFileWorkspace) {
        return activeFileWorkspace;
      }
    }
    
    // 回退到第一个工作空间文件夹
    return workspaceFolders[0];
  }
}
