import * as vscode from 'vscode';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { ISessionManager, SessionContext } from '../types/session';
import { Logger } from '../utils/logger';

/**
 * 会话管理器
 * 负责管理用户的项目会话状态
 */
export class SessionManager implements ISessionManager {
    private logger = Logger.getInstance();
    private currentSession: SessionContext | null = null;

    constructor() {
        // No longer need to initialize session path in constructor
    }

    /**
     * 动态获取会话文件路径（优化：适应工作区变化）
     */
    private get sessionFilePath(): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            return path.join(workspaceFolder.uri.fsPath, '.vscode', 'srs-writer-session.json');
        }
        return null;
    }

    /**
     * 获取当前会话（v1.2异步版本）
     */
    public async getCurrentSession(): Promise<SessionContext | null> {
        return this.currentSession;
    }

    /**
     * 更新当前会话 - v1.2异步原子更新版本
     */
    public async updateSession(updates: Partial<SessionContext>): Promise<void> {
        if (!this.currentSession) {
            this.logger.warn('No active session to update');
            return;
        }

        // 🔧 v1.2修复：确保原子更新，避免状态覆盖
        const previousSession = { ...this.currentSession };
        
        try {
            // 深度合并更新，确保嵌套对象也被正确合并
            this.currentSession = {
                ...previousSession,
                ...updates,
                metadata: {
                    ...previousSession.metadata,
                    ...(updates.metadata || {}),
                    lastModified: new Date().toISOString()
                }
            };

            // 🔧 v1.2改进：只记录实际变更的字段，减少日志噪音
            const changedFields = this.getChangedFields(previousSession, updates);
            if (changedFields.length > 0) {
                this.logger.info(`Session updated - changed fields: ${changedFields.join(', ')}`);
            }
            
            // 同步保存到文件
            try {
                await this.saveSessionToFile();
            } catch (error) {
                this.logger.error('Failed to save session after update', error as Error);
                // 🔧 v1.2新增：保存失败时回滚状态
                this.currentSession = previousSession;
                throw error;
            }
            
        } catch (error) {
            // 🔧 v1.2新增：更新失败时回滚状态
            this.logger.error('Failed to update session, rolling back', error as Error);
            this.currentSession = previousSession;
            throw error;
        }
    }

    /**
     * 创建新会话 - v1.2异步版本
     */
    public async createNewSession(projectName?: string): Promise<SessionContext> {
        const now = new Date().toISOString();
        
        this.currentSession = {
            projectName: projectName || null,
            baseDir: projectName ? path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', projectName) : null,
            lastIntent: null,
            activeFiles: [],
            metadata: {
                srsVersion: 'v1.0',  // 新增：SRS文档版本号
                created: now,
                lastModified: now,
                version: '1.2'       // 会话格式版本号
            }
        };

        this.logger.info(`New session created${projectName ? ` for project: ${projectName}` : ''}`);
        
        // 同步保存到文件
        try {
            await this.saveSessionToFile();
        } catch (error) {
            this.logger.error('Failed to save new session', error as Error);
            // 即使保存失败，也返回已创建的会话对象
        }

        return this.currentSession;
    }

    /**
     * 清理会话 - v1.2异步版本
     */
    public async clearSession(): Promise<void> {
        this.currentSession = null;
        this.logger.info('Session cleared');
        
        // 删除会话文件
        try {
            await this.deleteSessionFile();
        } catch (error) {
            this.logger.error('Failed to delete session file', error as Error);
        }
    }

    /**
     * 保存会话到文件
     */
    public async saveSessionToFile(): Promise<void> {
        if (!this.currentSession || !this.sessionFilePath) {
            return;
        }

        try {
            // 确保.vscode目录存在
            const vscodeDirPath = path.dirname(this.sessionFilePath);
            try {
                await fsPromises.access(vscodeDirPath);
            } catch {
                await fsPromises.mkdir(vscodeDirPath, { recursive: true });
            }

            // 写入会话数据
            const sessionData = {
                ...this.currentSession,
                savedAt: new Date().toISOString()
            };

            await fsPromises.writeFile(this.sessionFilePath, JSON.stringify(sessionData, null, 2), 'utf8');
            this.logger.info(`Session saved to: ${this.sessionFilePath}`);
            
        } catch (error) {
            this.logger.error('Failed to save session to file', error as Error);
            throw error;
        }
    }

    /**
     * 从文件加载会话
     */
    public async loadSessionFromFile(): Promise<SessionContext | null> {
        if (!this.sessionFilePath) {
            this.logger.info('No workspace folder available');
            return null;
        }

        try {
            // 检查文件是否存在
            await fsPromises.access(this.sessionFilePath);
        } catch {
            this.logger.info('No session file found');
            return null;
        }

        try {
            const fileContent = await fsPromises.readFile(this.sessionFilePath, 'utf8');
            const sessionData = JSON.parse(fileContent);
            
            // 验证会话数据的有效性
            if (this.isValidSessionData(sessionData)) {
                this.currentSession = sessionData;
                this.logger.info(`Session loaded from file: ${sessionData.projectName || 'unnamed'}`);
                return this.currentSession;
            } else {
                this.logger.warn('Invalid session data in file, ignoring');
                return null;
            }
            
        } catch (error) {
            this.logger.error('Failed to load session from file', error as Error);
            return null;
        }
    }

    /**
     * 验证会话数据的有效性
     */
    private isValidSessionData(data: any): boolean {
        return (
            data &&
            typeof data === 'object' &&
            data.metadata &&
            typeof data.metadata.created === 'string' &&
            typeof data.metadata.version === 'string' &&
            Array.isArray(data.activeFiles)
        );
    }

    /**
     * 删除会话文件
     */
    private async deleteSessionFile(): Promise<void> {
        if (!this.sessionFilePath) {
            return;
        }

        try {
            // 检查文件是否存在，如果不存在会抛出异常
            await fsPromises.access(this.sessionFilePath);
            await fsPromises.unlink(this.sessionFilePath);
            this.logger.info('Session file deleted');
        } catch (error) {
            // 文件不存在或删除失败，都静默处理
            this.logger.debug('Session file deletion skipped (file may not exist)');
        }
    }

    /**
     * 检查会话是否过期（v1.2异步版本，保持接口一致性）
     */
    public async isSessionExpired(maxAgeHours: number = 24): Promise<boolean> {
        if (!this.currentSession) {
            return false;
        }

        const sessionAge = Date.now() - new Date(this.currentSession.metadata.created).getTime();
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
        
        return sessionAge > maxAgeMs;
    }

    /**
     * 自动初始化会话（在插件启动时调用）
     */
    public async autoInitialize(): Promise<void> {
        try {
            // 尝试从文件加载会话
            const loadedSession = await this.loadSessionFromFile();
            
            if (loadedSession) {
                // 检查会话是否过期
                if (await this.isSessionExpired()) {
                    this.logger.info('Loaded session is expired, clearing');
                    await this.clearSession();
                } else {
                    this.logger.info('Session auto-loaded successfully');
                }
            }
        } catch (error) {
            this.logger.error('Failed to auto-initialize session', error as Error);
        }
    }

    /**
     * 获取会话状态摘要（v1.2异步版本，保持接口一致性）
     */
    public async getSessionSummary(): Promise<string> {
        if (!this.currentSession) {
            return 'No active session';
        }

        const { projectName, lastIntent, activeFiles } = this.currentSession;
        return `Project: ${projectName || 'unnamed'}, Last Intent: ${lastIntent || 'none'}, Files: ${activeFiles.length}`;
    }

    /**
     * 强制刷新会话路径（优化：现在使用动态getter，此方法保留以维持接口兼容性）
     */
    public refreshSessionPath(): void {
        // 由于现在使用动态getter，路径会自动适应工作区变化
        // 此方法保留以维持接口兼容性
        this.logger.info('Session path is now dynamically retrieved (no refresh needed)');
    }

    /**
     * 获取变更的字段列表（用于优化日志输出）
     */
    private getChangedFields(previous: SessionContext, updates: Partial<SessionContext>): string[] {
        const changedFields: string[] = [];
        
        // 检查直接字段变更
        for (const key of Object.keys(updates) as (keyof SessionContext)[]) {
            if (key === 'metadata') continue; // metadata单独处理
            
            if (previous[key] !== updates[key]) {
                changedFields.push(key);
            }
        }
        
        // 检查metadata变更
        if (updates.metadata) {
            for (const metaKey of Object.keys(updates.metadata)) {
                if (metaKey === 'lastModified') continue; // 这个总是会变
                
                if (previous.metadata[metaKey as keyof typeof previous.metadata] !== 
                    updates.metadata[metaKey as keyof typeof updates.metadata]) {
                    changedFields.push(`metadata.${metaKey}`);
                }
            }
        }
        
        return changedFields;
    }
}
