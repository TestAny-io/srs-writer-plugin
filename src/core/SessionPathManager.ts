/**
 * Session 路径管理器 - 负责会话文件路径的统一管理
 * 
 * 架构定位：
 * - 核心基础设施：提供路径解析和验证功能
 * - 为 Session 重构奠定基础：支持项目级别的会话文件管理
 * - 路径安全：处理特殊字符和命名规范
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

/**
 * Session 路径管理器
 */
export class SessionPathManager {
    private readonly SESSION_DIR = '.session-log';
    private readonly MAIN_SESSION_FILE = 'srs-writer-session_main.json';
    
    constructor(private workspaceRoot: string) {
        logger.info(`SessionPathManager initialized for workspace: ${workspaceRoot}`);
    }

    /**
     * 获取会话目录路径
     */
    getSessionDirectory(): string {
        return path.join(this.workspaceRoot, this.SESSION_DIR);
    }

    /**
     * 获取主会话文件路径
     */
    getMainSessionPath(): string {
        return path.join(this.getSessionDirectory(), this.MAIN_SESSION_FILE);
    }

    /**
     * 获取项目会话文件路径（为阶段3做准备）
     */
    getProjectSessionPath(projectName: string): string {
        const sessionDir = this.getSessionDirectory();
        const safeProjectName = this.sanitizeProjectName(projectName);
        return path.join(sessionDir, `srs-writer-session_${safeProjectName}.json`);
    }

    /**
     * 确保会话目录存在
     */
    async ensureSessionDirectory(): Promise<void> {
        const sessionDir = this.getSessionDirectory();
        const sessionDirUri = vscode.Uri.file(sessionDir);
        
        try {
            // 检查目录是否已存在
            await vscode.workspace.fs.stat(sessionDirUri);
            logger.info(`Session directory already exists: ${sessionDir}`);
        } catch {
            // 目录不存在，创建它
            await vscode.workspace.fs.createDirectory(sessionDirUri);
            logger.info(`✅ Created session directory: ${sessionDir}`);
        }
    }

    /**
     * 检查主会话文件是否存在
     */
    async mainSessionFileExists(): Promise<boolean> {
        const mainSessionPath = this.getMainSessionPath();
        const fileUri = vscode.Uri.file(mainSessionPath);
        
        try {
            await vscode.workspace.fs.stat(fileUri);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 项目名安全处理 - 确保文件名安全
     * 
     * MVP策略：保留中文和其他Unicode字符，只过滤文件系统明确禁止的字符
     * - 支持中文项目名（如"智能食谱"）
     * - 使用 NFC 正规化确保跨平台一致性（macOS/Windows）
     * - 只替换文件系统禁止字符：\ / : * ? " < > | null
     */
    private sanitizeProjectName(projectName: string): string {
        // 1. Unicode正规化 - 避免macOS(NFD)和Windows(NFC)的编码差异
        const normalized = projectName.normalize('NFC');
        
        // 2. 只过滤文件系统明确禁止的字符
        return normalized
            .trim()
            .replace(/[\\/:"*?<>|\x00]/g, '_')  // Windows/macOS/Linux禁止字符
            .substring(0, 50);                  // 限制长度（中文字符占3字节）
    }

    /**
     * 验证工作区路径是否有效
     */
    validateWorkspacePath(): boolean {
        if (!this.workspaceRoot || this.workspaceRoot.trim().length === 0) {
            logger.warn('Invalid workspace root path');
            return false;
        }

        // 检查路径长度（Windows 有260字符限制）
        const sessionDirPath = this.getSessionDirectory();
        if (sessionDirPath.length > 240) { // 留一些余量给文件名
            logger.warn(`Session directory path too long: ${sessionDirPath.length} characters`);
            return false;
        }

        return true;
    }
}
