import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { promises as fsPromises } from 'fs';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { 
    SessionContext, 
    ISessionManager, 
    ISessionObserver, 
    SyncStatus, 
    ArchivedSessionInfo, 
    ArchiveResult,
    ArchiveFileEntry,
    UnifiedSessionFile,
    OperationLogEntry,
    OperationType,
    SessionUpdateRequest
} from '../types/session';
import { SpecialistResumeContext } from './engine/AgentState';
// 🚀 修复：移除不需要的引擎相关导入

interface SessionEvent {
  type: 'user_new_session' | 'session_started' | 'task_completion' | 'user_response' | 'vscode_restart';
  timestamp: number;
  sessionId: string;
  details?: any;
}

interface PersistedSessionData {
  sessionId: string;
  projectName?: string;
  isAwaitingUser: boolean;
  resumeContext?: SpecialistResumeContext;
  lastActivity: number;
  events: SessionEvent[];
}

/**
 * 🚀 会话管理器 v5.0 - 统一混合存储架构 + 事件溯源模式
 * 
 * 核心改进：
 * - 🏛️ 单例模式：全局唯一实例，消除多头管理问题
 * - 👥 观察者模式：自动通知所有依赖组件，确保数据同步
 * - 🔍 同步检查：自动检测数据一致性问题
 * - ⚡ 强制同步：提供手动修复功能
 * - 🗄️ 归档系统：保护用户资产，维护项目历史
 * - 🎯 混合存储：currentSession + operations双重存储，快速恢复+完整审计
 * - 📊 事件溯源：所有操作类型化记录，支持完整的操作历史追踪
 * - 🔄 统一协调：specialistTools汇报模式，消除文件冲突
 * 
 * 负责统一管理项目会话状态和操作日志，是系统的唯一状态管理中心
 */
export class SessionManager implements ISessionManager {
    private static instance: SessionManager;
    private logger = Logger.getInstance();
    private currentSession: SessionContext | null = null;
    
    // 🚀 观察者模式支持
    private observers: Set<ISessionObserver> = new Set();

    // 🚀 修复：移除引擎管理，专注于会话状态管理
    private sessionFile: string;
    private isInitialized = false;

    private constructor(private context: vscode.ExtensionContext) {
        this.sessionFile = path.join(
            context.globalStoragePath,
            'srs-writer-session.json'
        );
        this.ensureStorageDirectory();
    }

    /**
     * 🚀 获取单例实例
     */
    public static getInstance(context?: vscode.ExtensionContext): SessionManager {
        if (!SessionManager.instance) {
            if (!context) {
                throw new Error('SessionManager requires context for first initialization');
            }
            SessionManager.instance = new SessionManager(context);
        }
        return SessionManager.instance;
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
     * 获取当前会话（v3.0异步版本）
     */
    public async getCurrentSession(): Promise<SessionContext | null> {
        return this.currentSession;
    }

    /**
     * 🚀 更新当前会话 - v3.0观察者通知版本
     */
    public async updateSession(updates: Partial<SessionContext>): Promise<void> {
        if (!this.currentSession) {
            this.logger.warn('No active session to update');
            return;
        }

        // 🔧 v3.0修复：确保原子更新，避免状态覆盖
        const previousSession = { ...this.currentSession };
        
        try {
            // 深度合并更新，确保嵌套对象也被正确合并
            this.currentSession = {
                ...previousSession,
                ...updates,
                metadata: {
                    ...previousSession.metadata,
                    ...(updates.metadata || {}),
                    lastModified: new Date().toISOString(),
                    version: '3.0' // 🚀 更新版本号为3.0
                }
            };

            // 🔧 v3.0改进：只记录实际变更的字段，减少日志噪音
            const changedFields = this.getChangedFields(previousSession, updates);
            if (changedFields.length > 0) {
                this.logger.info(`Session updated - changed fields: ${changedFields.join(', ')}`);
            }
            
            // 同步保存到文件
            try {
                await this.saveSessionToFile();
            } catch (error) {
                this.logger.error('Failed to save session after update', error as Error);
                // 🔧 v3.0新增：保存失败时回滚状态
                this.currentSession = previousSession;
                throw error;
            }
            
            // 🚀 v3.0新增：通知所有观察者
            this.notifyObservers();
            
        } catch (error) {
            // 🔧 v3.0新增：更新失败时回滚状态
            this.logger.error('Failed to update session, rolling back', error as Error);
            this.currentSession = previousSession;
            throw error;
        }
    }

    /**
     * 🚀 创建新会话 - v3.0观察者通知版本
     */
    public async createNewSession(projectName?: string): Promise<SessionContext> {
        const now = new Date().toISOString();
        
        this.currentSession = {
            sessionContextId: crypto.randomUUID(),  // 🚀 新增：项目唯一标识符
            projectName: projectName || null,
            baseDir: projectName ? path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', projectName) : null,
            activeFiles: [],
            metadata: {
                srsVersion: 'v1.0',  // SRS文档版本号
                created: now,
                lastModified: now,
                version: '5.0'       // 🚀 会话格式版本号更新为5.0
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

        // 🚀 v3.0新增：通知所有观察者
        this.notifyObservers();

        return this.currentSession!;
    }

    /**
     * 🚀 清理会话 - v3.0观察者通知版本
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

        // 🚀 v3.0新增：通知所有观察者
        this.notifyObservers();
    }

    /**
     * 保存会话到文件 - v4.0兼容版本
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
     * 🚀 v5.0新增：保存到混合存储文件
     * 同时更新currentSession和operations数组
     * 修复：确保不会在没有会话时意外保存空文件
     */
    private async saveUnifiedSessionFile(newLogEntry: OperationLogEntry): Promise<void> {
        if (!this.sessionFilePath) {
            return;
        }

        // 🚀 修复：如果没有当前会话，且操作不是会话创建，则不保存
        if (!this.currentSession && newLogEntry.type !== OperationType.SESSION_CREATED) {
            this.logger.warn('Attempted to save unified session file without current session');
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

            // 读取现有文件或创建新文件
            const existingFile = await this.loadUnifiedSessionFile();
            
            // 更新unified文件
            const updatedFile: UnifiedSessionFile = {
                ...existingFile,
                currentSession: this.currentSession,
                operations: [...existingFile.operations, newLogEntry],
                lastUpdated: new Date().toISOString()
            };
            
            // 写入文件
            await fsPromises.writeFile(this.sessionFilePath, JSON.stringify(updatedFile, null, 2), 'utf8');
            this.logger.info(`Unified session file saved to: ${this.sessionFilePath}`);
            
        } catch (error) {
            this.logger.error('Failed to save unified session file', error as Error);
            throw error;
        }
    }

    /**
     * 🚀 v5.0新增：加载混合存储文件
     * 如果文件不存在或格式错误，返回默认结构
     */
    private async loadUnifiedSessionFile(): Promise<UnifiedSessionFile> {
        if (!this.sessionFilePath) {
            return this.createDefaultUnifiedFile();
        }

        try {
            // 检查文件是否存在
            await fsPromises.access(this.sessionFilePath);
            const fileContent = await fsPromises.readFile(this.sessionFilePath, 'utf8');
            
            if (!fileContent || fileContent.trim().length === 0) {
                return this.createDefaultUnifiedFile();
            }
            
            let parsedData;
            try {
                parsedData = JSON.parse(fileContent);
            } catch (parseError) {
                this.logger.warn('Invalid JSON in session file, creating new unified file');
                return this.createDefaultUnifiedFile();
            }
            
            // 检查是否是新的UnifiedSessionFile格式
            if (this.isUnifiedSessionFile(parsedData)) {
                return parsedData as UnifiedSessionFile;
            }
            
            // 检查是否是旧的SessionContext格式，进行迁移
            if (this.isValidSessionData(parsedData)) {
                this.logger.info('Migrating old session format to unified format');
                return this.migrateToUnifiedFormat(parsedData);
            }
            
            // 格式无法识别，创建新文件
            this.logger.warn('Unrecognized session file format, creating new unified file');
            return this.createDefaultUnifiedFile();
            
        } catch (error) {
            // 文件不存在或读取失败，返回默认结构
            return this.createDefaultUnifiedFile();
        }
    }

    /**
     * 🚀 v5.0新增：创建默认的UnifiedSessionFile结构
     * 修复：确保不会意外清空currentSession
     */
    private createDefaultUnifiedFile(): UnifiedSessionFile {
        const now = new Date().toISOString();
        const today = now.split('T')[0];
        const endDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        return {
            fileVersion: '5.0',
            currentSession: null, // 🚀 修复：始终从null开始，避免意外覆盖已有会话
            operations: [],
            timeRange: {
                startDate: today,
                endDate: endDate
            },
            createdAt: now,
            lastUpdated: now
        };
    }

    /**
     * 🚀 v5.0新增：检查是否是UnifiedSessionFile格式
     */
    private isUnifiedSessionFile(data: any): boolean {
        return (
            data &&
            typeof data === 'object' &&
            typeof data.fileVersion === 'string' &&
            data.currentSession !== undefined &&
            Array.isArray(data.operations) &&
            data.timeRange &&
            typeof data.timeRange.startDate === 'string' &&
            typeof data.timeRange.endDate === 'string'
        );
    }

    /**
     * 🚀 v5.0新增：将旧格式迁移到UnifiedSessionFile
     */
    private migrateToUnifiedFormat(oldSessionData: SessionContext): UnifiedSessionFile {
        const now = new Date().toISOString();
        const defaultFile = this.createDefaultUnifiedFile();
        
        // 创建迁移日志条目
        const migrationLogEntry: OperationLogEntry = {
            timestamp: now,
            type: OperationType.DATA_MIGRATION_PERFORMED,
            sessionContextId: oldSessionData.sessionContextId || crypto.randomUUID(),
            operation: 'Migrated session from old format to unified format',
            success: true
        };
        
        return {
            ...defaultFile,
            currentSession: oldSessionData,
            operations: [migrationLogEntry]
        };
    }

    /**
     * 🚀 v5.0更新：从混合存储文件加载会话
     * 支持新的UnifiedSessionFile格式，向后兼容旧格式
     */
    public async loadSessionFromFile(): Promise<SessionContext | null> {
        if (!this.sessionFilePath) {
            this.logger.info('No workspace folder available');
            return null;
        }

        try {
            // 加载统一文件
            const unifiedFile = await this.loadUnifiedSessionFile();
            
            // 从currentSession字段直接获取状态
            if (unifiedFile.currentSession) {
                this.currentSession = unifiedFile.currentSession;
                this.logger.info(`Session loaded from unified file: ${unifiedFile.currentSession.projectName || 'unnamed'}`);
                this.logger.info(`Loaded ${unifiedFile.operations.length} operation records`);
                
                // 🚀 v5.0：加载后通知观察者
                this.notifyObservers();
                
                return this.currentSession;
            } else {
                this.logger.info('No current session found in unified file');
                return null;
            }
            
        } catch (error) {
            this.logger.error('Failed to load session from unified file', error as Error);
            return null;
        }
    }

    /**
     * 🚀 v3.0新增：订阅会话变更通知
     */
    public subscribe(observer: ISessionObserver): void {
        this.observers.add(observer);
        this.logger.info(`Session observer registered, total observers: ${this.observers.size}`);
    }

    /**
     * 🚀 v3.0新增：取消订阅会话变更通知
     */
    public unsubscribe(observer: ISessionObserver): void {
        this.observers.delete(observer);
        this.logger.info(`Session observer unregistered, total observers: ${this.observers.size}`);
    }

    /**
     * 🚀 v3.0新增：检查同步状态
     */
    public async checkSyncStatus(): Promise<SyncStatus> {
        const inconsistencies: string[] = [];
        
        try {
            // 检查文件vs内存一致性
            const fileSession = await this.loadSessionFromFileInternal();
            if (fileSession && this.currentSession) {
                if (fileSession.projectName !== this.currentSession.projectName) {
                    inconsistencies.push('项目名称不一致');
                }
                if (fileSession.baseDir !== this.currentSession.baseDir) {
                    inconsistencies.push('基础目录不一致');
                }
                if (fileSession.activeFiles.length !== this.currentSession.activeFiles.length) {
                    inconsistencies.push('活跃文件数量不一致');
                }
            } else if (!fileSession && this.currentSession) {
                inconsistencies.push('内存中有会话但文件不存在');
            } else if (fileSession && !this.currentSession) {
                inconsistencies.push('文件中有会话但内存中不存在');
            }
        } catch (error) {
            inconsistencies.push(`文件读取失败: ${(error as Error).message}`);
        }
        
        return {
            isConsistent: inconsistencies.length === 0,
            inconsistencies,
            lastSyncCheck: new Date().toISOString()
        };
    }

    /**
     * 🚀 v3.0新增：强制通知所有观察者
     */
    public forceNotifyObservers(): void {
        this.logger.info('Force notifying all session observers');
        this.notifyObservers();
    }

    /**
     * 🚀 v3.0新增：通知所有观察者
     */
    private notifyObservers(): void {
        this.observers.forEach(observer => {
            try {
                observer.onSessionChanged(this.currentSession);
            } catch (error) {
                this.logger.error('Observer notification failed', error as Error);
                // 移除有问题的观察者
                this.observers.delete(observer);
            }
        });
    }

    /**
     * 内部文件加载方法（不触发观察者通知）
     */
    private async loadSessionFromFileInternal(): Promise<SessionContext | null> {
        if (!this.sessionFilePath) {
            return null;
        }

        try {
            await fsPromises.access(this.sessionFilePath);
            const fileContent = await fsPromises.readFile(this.sessionFilePath, 'utf8');
            
            // 🚀 修复：检查文件内容是否为空
            if (!fileContent || fileContent.trim().length === 0) {
                return null;
            }
            
            let sessionData;
            try {
                sessionData = JSON.parse(fileContent);
            } catch (parseError) {
                // 静默处理JSON解析错误，返回null
                return null;
            }
            
            if (this.isValidSessionData(sessionData)) {
                return sessionData;
            }
            return null;
        } catch {
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
     * 🚀 v5.0修复：检查会话是否过期 - 基于最后活跃时间而非创建时间
     */
    public async isSessionExpired(maxAgeHours: number = 24): Promise<boolean> {
        if (!this.currentSession) {
            return false;
        }

        // ✅ 修复：使用lastModified（最后活跃时间）而不是created（创建时间）
        const lastActivity = new Date(this.currentSession.metadata.lastModified).getTime();
        const inactivityPeriod = Date.now() - lastActivity;
        const maxInactivityMs = maxAgeHours * 60 * 60 * 1000;
        
        // 🐛 修复日志：记录过期检查的详细信息
        const hoursInactive = Math.round(inactivityPeriod / (1000 * 60 * 60) * 10) / 10;
        this.logger.debug(`Session expiry check: ${hoursInactive}h inactive (max: ${maxAgeHours}h)`);
        
        return inactivityPeriod > maxInactivityMs;
    }

    /**
     * 自动初始化会话（在插件启动时调用）
     * 修复：确保不会意外清空有效会话文件
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
            } else {
                // 🚀 修复：如果没有加载到会话，不要做任何操作
                // 避免意外创建或清空会话文件
                this.logger.info('No existing session found during auto-initialization');
            }
        } catch (error) {
            this.logger.error('Failed to auto-initialize session', error as Error);
            // 🚀 修复：出错时不要清空会话，只记录错误
        }
    }

    /**
     * 获取会话状态摘要（v3.0异步版本，简化版本）
     */
    public async getSessionSummary(): Promise<string> {
        if (!this.currentSession) {
            return 'No active session';
        }

        const { projectName, activeFiles } = this.currentSession;
        return `Project: ${projectName || 'unnamed'}, Files: ${activeFiles.length}`;
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

    /**
     * 🚀 v3.0新增：获取观察者统计信息
     */
    public getObserverStats(): { count: number; types: string[] } {
        return {
            count: this.observers.size,
            types: Array.from(this.observers).map(observer => observer.constructor.name)
        };
    }

    /**
     * 🚀 v5.0新增：统一状态+日志更新入口
     * specialistTools调用此方法汇报执行结果
     */
    public async updateSessionWithLog(request: SessionUpdateRequest): Promise<void> {
        const startTime = Date.now();
        
        try {
            // 1. 更新内存状态（如果有状态更新）
            if (request.stateUpdates && this.currentSession) {
                const previousSession = { ...this.currentSession };
                
                this.currentSession = {
                    ...previousSession,
                    ...request.stateUpdates,
                    metadata: {
                        ...previousSession.metadata,
                        ...(request.stateUpdates.metadata || {}),
                        lastModified: new Date().toISOString(),
                        version: '5.0' // 🚀 更新版本号为5.0
                    }
                };
                
                this.logger.info(`Session state updated via updateSessionWithLog`);
            }
            
            // 2. 确保有SessionContext ID
            const sessionContextId = this.currentSession?.sessionContextId || crypto.randomUUID();
            if (this.currentSession && !this.currentSession.sessionContextId) {
                this.currentSession.sessionContextId = sessionContextId;
            }
            
            // 3. 构造完整的日志条目
            const completeLogEntry: OperationLogEntry = {
                timestamp: new Date().toISOString(),
                sessionContextId,
                type: request.logEntry.type,
                operation: request.logEntry.operation,
                success: request.logEntry.success,
                toolName: request.logEntry.toolName,
                targetFiles: request.logEntry.targetFiles,
                userInput: request.logEntry.userInput,
                executionTime: request.logEntry.executionTime || (Date.now() - startTime),
                error: request.logEntry.error,
                sessionData: request.logEntry.sessionData
            };
            
            // 4. 保存到混合存储文件
            await this.saveUnifiedSessionFile(completeLogEntry);
            
            // 5. 通知观察者
            this.notifyObservers();
            
        } catch (error) {
            this.logger.error('Failed to update session with log', error as Error);
            throw error;
        }
    }

    /**
     * 🚀 v5.0新增：项目初始化专用方法
     * 创建新SessionContext并记录SESSION_CREATED事件
     */
    public async initializeProject(projectName?: string): Promise<SessionContext> {
        const newSession = await this.createNewSession(projectName);
        
        // 记录项目创建事件
        await this.updateSessionWithLog({
            logEntry: {
                type: OperationType.SESSION_CREATED,
                operation: `Created new project: ${projectName || 'unnamed'}`,
                success: true,
                sessionData: newSession
            }
        });
        
        return newSession;
    }

    /**
     * 🚀 v4.0修复：生成归档文件名 - 避免项目冲突
     * 格式：srs-writer-session-YYYYMMDD-YYYYMMDD+15-[projectId].json
     */
    private generateArchiveFileName(session: SessionContext): string {
        const createdDate = new Date(session.metadata.created);
        const endDate = new Date(createdDate.getTime() + 15 * 24 * 60 * 60 * 1000); // +15天
        
        const formatDate = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '');
        
        // 🚀 修复：添加项目标识符以避免文件名冲突
        // 使用会话ID的前8位作为唯一标识符，确保不同项目有不同文件名
        const projectId = session.sessionContextId ? session.sessionContextId.slice(0, 8) : Date.now().toString(36);
        
        return `srs-writer-session-${formatDate(createdDate)}-${formatDate(endDate)}-${projectId}.json`;
    }

    /**
     * 🚀 v4.0新增：获取归档目录路径
     */
    private get archiveDirectoryPath(): string | null {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            return path.join(workspaceFolder.uri.fsPath, '.vscode', 'session-archives');
        }
        return null;
    }

    /**
     * 🚀 v4.0新增：归档当前会话并开始新项目
     */
    public async archiveCurrentAndStartNew(
        newProjectName?: string, 
        archiveReason: 'age_limit' | 'manual_archive' | 'new_project' = 'new_project'
    ): Promise<ArchiveResult> {
        const filesPreserved: string[] = [];
        
        try {
            // 1. 获取用户资产文件列表
            const userAssets = await this.getUserAssetFiles();
            filesPreserved.push(...userAssets);

            // 2. 归档当前会话（如果存在）
            let archivedSession: ArchivedSessionInfo | undefined;
            if (this.currentSession) {
                const reason = archiveReason === 'new_project' ? 'manual_archive' : archiveReason;
                const archiveInfo = await this.archiveCurrentSession(reason);
                if (archiveInfo) {
                    archivedSession = archiveInfo;
                }
            }

            // 3. 创建新会话
            const newSession = await this.createNewSession(newProjectName);

            this.logger.info(`Successfully started new project. Preserved ${filesPreserved.length} user files.`);
            
            return {
                success: true,
                archivedSession,
                newSession,
                filesPreserved
            };

        } catch (error) {
            this.logger.error('Failed to archive and start new project', error as Error);
            return {
                success: false,
                error: (error as Error).message,
                filesPreserved
            };
        }
    }

    /**
     * 🚀 v4.0修复：手动归档当前会话 - 保留完整历史 + 追加模式
     */
    public async archiveCurrentSession(
        reason: 'age_limit' | 'manual_archive' = 'manual_archive'
    ): Promise<ArchivedSessionInfo | null> {
        if (!this.currentSession || !this.archiveDirectoryPath) {
            return null;
        }

        try {
            // 确保归档目录存在
            await fsPromises.mkdir(this.archiveDirectoryPath, { recursive: true });

            // 生成归档文件名和路径
            const archiveFileName = this.generateArchiveFileName(this.currentSession);
            const archiveFilePath = path.join(this.archiveDirectoryPath, archiveFileName);

            // 🚀 修复1：读取完整的当前会话文件（包含operations历史）
            const unifiedFile = await this.loadUnifiedSessionFile();
            
            // 创建归档数据（包含完整历史）
            const newArchiveEntry = {
                sessionContextId: this.currentSession.sessionContextId,
                projectName: this.currentSession.projectName,
                baseDir: this.currentSession.baseDir,
                activeFiles: this.currentSession.activeFiles,
                metadata: this.currentSession.metadata,
                operations: unifiedFile.operations, // 🚀 保留所有operations历史
                timeRange: unifiedFile.timeRange,
                archivedAt: new Date().toISOString(),
                archiveReason: reason,
                fileVersion: unifiedFile.fileVersion
            };

            // 🚀 修复2：读取现有归档文件，如果存在的话
            let existingArchives: any[] = [];
            try {
                if (await this.fileExists(archiveFilePath)) {
                    const existingContent = await fsPromises.readFile(archiveFilePath, 'utf8');
                    if (existingContent.trim()) {
                        const parsed = JSON.parse(existingContent);
                        // 支持两种格式：单个对象（旧格式）或数组（新格式）
                        existingArchives = Array.isArray(parsed) ? parsed : [parsed];
                    }
                }
            } catch (parseError) {
                this.logger.warn(`Failed to parse existing archive file, starting fresh: ${(parseError as Error).message}`);
                existingArchives = [];
            }

            // 🚀 修复3：追加新的归档条目
            existingArchives.push(newArchiveEntry);

            // 🚀 修复4：写入合并后的数据
            await fsPromises.writeFile(archiveFilePath, JSON.stringify(existingArchives, null, 2), 'utf8');

            // 计算会话覆盖的天数
            const created = new Date(this.currentSession.metadata.created);
            const lastModified = new Date(this.currentSession.metadata.lastModified);
            const daysCovered = Math.ceil((lastModified.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

            const archiveInfo: ArchivedSessionInfo = {
                archiveFileName,
                originalSession: { ...this.currentSession },
                archiveDate: new Date().toISOString(),
                daysCovered: Math.max(daysCovered, 1),
                reason
            };

            this.logger.info(`Session archived: ${archiveFileName} (${daysCovered} days covered, ${existingArchives.length} total entries)`);
            return archiveInfo;

        } catch (error) {
            this.logger.error('Failed to archive session', error as Error);
            return null;
        }
    }

    /**
     * 🚀 v4.0修复：列出所有归档的会话 - 支持新的数组格式
     */
    public async listArchivedSessions(limit: number = 20): Promise<ArchivedSessionInfo[]> {
        if (!this.archiveDirectoryPath) {
            return [];
        }

        try {
            // 检查归档目录是否存在
            await fsPromises.access(this.archiveDirectoryPath);
            
            const files = await fsPromises.readdir(this.archiveDirectoryPath);
            const archiveFiles = files
                .filter(file => file.startsWith('srs-writer-session-') && file.endsWith('.json'))
                .sort()
                .reverse(); // 最新的在前

            const archives: ArchivedSessionInfo[] = [];
            
            for (const fileName of archiveFiles) {
                try {
                    const filePath = path.join(this.archiveDirectoryPath!, fileName);
                    const fileContent = await fsPromises.readFile(filePath, 'utf8');
                    
                    // 🚀 修复：检查归档文件内容是否为空
                    if (!fileContent || fileContent.trim().length === 0) {
                        this.logger.warn(`Archive file ${fileName} is empty, skipping`);
                        continue;
                    }
                    
                    let archiveData;
                    try {
                        archiveData = JSON.parse(fileContent);
                    } catch (parseError) {
                        this.logger.warn(`Archive file ${fileName} contains invalid JSON: ${(parseError as Error).message}`);
                        continue;
                    }
                    
                    // 🚀 修复：处理新的数组格式和旧的单对象格式
                    const archiveEntries = Array.isArray(archiveData) ? archiveData : [archiveData];
                    
                    for (const entry of archiveEntries) {
                        if (this.isValidSessionData(entry)) {
                            const created = new Date(entry.metadata.created);
                            const lastModified = new Date(entry.metadata.lastModified);
                            const daysCovered = Math.ceil((lastModified.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

                            archives.push({
                                archiveFileName: fileName,
                                originalSession: {
                                    sessionContextId: entry.sessionContextId,
                                    projectName: entry.projectName,
                                    baseDir: entry.baseDir,
                                    activeFiles: entry.activeFiles,
                                    metadata: entry.metadata
                                },
                                archiveDate: entry.archivedAt || entry.metadata.lastModified,
                                daysCovered: Math.max(daysCovered, 1),
                                reason: entry.archiveReason || 'manual_archive'
                            });
                        }
                    }
                } catch (fileError) {
                    this.logger.warn(`Failed to read archive file ${fileName}: ${(fileError as Error).message}`);
                }
            }

            // 按归档日期排序，最新的在前，然后应用limit
            return archives
                .sort((a, b) => new Date(b.archiveDate).getTime() - new Date(a.archiveDate).getTime())
                .slice(0, limit);

        } catch (error) {
            this.logger.debug('Archive directory not found or empty');
            return [];
        }
    }

    /**
     * 🚀 v5.0修复：自动归档过期会话 - 基于最后活跃时间而非创建时间
     */
    public async autoArchiveExpiredSessions(maxAgeDays: number = 15): Promise<ArchivedSessionInfo[]> {
        const archived: ArchivedSessionInfo[] = [];

        if (!this.currentSession) {
            return archived;
        }

        // ✅ 修复：使用lastModified（最后活跃时间）而不是created（创建时间）
        const lastActivity = new Date(this.currentSession.metadata.lastModified).getTime();
        const inactivityPeriod = Date.now() - lastActivity;
        const maxInactivityMs = maxAgeDays * 24 * 60 * 60 * 1000;

        if (inactivityPeriod > maxInactivityMs) {
            const archiveInfo = await this.archiveCurrentSession('age_limit');
            if (archiveInfo) {
                archived.push(archiveInfo);
                const daysInactive = Math.round(inactivityPeriod / (1000 * 60 * 60 * 24) * 10) / 10;
                this.logger.info(`Auto-archived expired session (${daysInactive} days inactive)`);
            }
        }

        return archived;
    }

    /**
     * 🚀 v4.0新增：获取用户资产文件列表
     */
    public async getUserAssetFiles(): Promise<string[]> {
        const assetFiles: string[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder || !this.currentSession?.baseDir) {
            return assetFiles;
        }

        try {
            // 定义用户资产文件模式
            const assetPatterns = [
                'SRS.md',
                'fr.yaml',
                'nfr.yaml', 
                'glossary.yaml',
                'classification_decision.md',
                'questions_and_suggestions.md',
                'writer_log.json',
                'mother_document.md',
                'SRS_Report.md',
                '*.backup.*' // 备份文件
            ];

            // 检查项目目录中的文件
            const projectPath = this.currentSession.baseDir;
            if (await this.directoryExists(projectPath)) {
                const files = await fsPromises.readdir(projectPath);
                
                for (const pattern of assetPatterns) {
                    if (pattern.includes('*')) {
                        // 处理通配符模式
                        const matchingFiles = files.filter(file => {
                            if (pattern === '*.backup.*') {
                                return file.includes('.backup.');
                            }
                            return false;
                        });
                        assetFiles.push(...matchingFiles.map(file => path.join(projectPath, file)));
                    } else {
                        // 精确匹配
                        const filePath = path.join(projectPath, pattern);
                        if (await this.fileExists(filePath)) {
                            assetFiles.push(filePath);
                        }
                    }
                }
            }

        } catch (error) {
            this.logger.warn(`Failed to scan user asset files: ${(error as Error).message}`);
        }

        return assetFiles;
    }

    /**
     * 辅助方法：检查文件是否存在
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fsPromises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 辅助方法：检查目录是否存在
     */
    private async directoryExists(dirPath: string): Promise<boolean> {
        try {
            const stat = await fsPromises.stat(dirPath);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * 🎯 核心方法：基于ChatContext生成稳定的会话标识
     */
    private generateSessionId(chatContext: vscode.ChatContext): string {
        // 使用Chat历史记录的哈希值作为标识
        if (chatContext.history.length > 0) {
            const historyHash = this.hashChatHistory(chatContext.history);
            return `chat_${historyHash}`;
        }
        
        // 如果是全新会话，生成新的ID
        return `chat_${Date.now()}`;
    }

    /**
     * 为ChatContext.history生成哈希值作为稳定标识
     */
    private hashChatHistory(history: readonly (vscode.ChatRequestTurn | vscode.ChatResponseTurn)[]): string {
        // 使用第一条和最后一条消息的内容生成简单哈希
        if (history.length === 0) return 'empty';
        
        const first = history[0];
        const last = history[history.length - 1];
        
        let hashInput = '';
        if (first instanceof vscode.ChatRequestTurn) {
            hashInput += first.prompt;
        }
        if (last instanceof vscode.ChatRequestTurn) {
            hashInput += last.prompt;
        }
        
        // 简单哈希算法
        let hash = 0;
        for (let i = 0; i < hashInput.length; i++) {
            const char = hashInput.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * 🔍 检测用户意图：是主动开新会话还是意外重启？
     */
    private async detectUserIntent(
        chatContext: vscode.ChatContext, 
        request: vscode.ChatRequest
    ): Promise<'intentional_new' | 'accidental_restart' | 'continue_existing'> {
        
        // 1. 如果使用了 /new 命令，明确表示用户想要新会话
        if (request.command === 'new') {
            await this.recordSessionEvent('user_new_session', 'new_session', {
                command: 'new',
                userPrompt: request.prompt
            });
            return 'intentional_new';
        }

        // 2. 如果有历史记录，说明是现有会话的延续
        if (chatContext.history.length > 0) {
            return 'continue_existing';
        }

        // 3. 没有历史记录 - 检查是否是意外重启
        const persistedData = await this.loadPersistedSession();
        if (persistedData && persistedData.events.length > 0) {
            const lastEvent = persistedData.events[persistedData.events.length - 1];
            
            // 如果最后一次事件不是用户主动开新会话，可能是意外重启
            if (lastEvent.type !== 'user_new_session' && 
                Date.now() - lastEvent.timestamp < 24 * 60 * 60 * 1000) { // 24小时内
                
                await this.recordSessionEvent('vscode_restart', 'recovery_attempt', {
                    lastEvent: lastEvent.type,
                    timeSinceLastEvent: Date.now() - lastEvent.timestamp
                });
                return 'accidental_restart';
            }
        }

        // 4. 默认情况，当作新会话
        return 'intentional_new';
    }

    // 🚀 修复：移除引擎管理方法，引擎管理由 SRSChatParticipant 负责

    // 🚀 修复：移除引擎相关的辅助方法，这些职责转移到 SRSChatParticipant

    /**
     * 💾 记录会话事件到持久化文件
     */
    private async recordSessionEvent(
        eventType: SessionEvent['type'], 
        sessionId: string, 
        details?: any
    ): Promise<void> {
        try {
            const event: SessionEvent = {
                type: eventType,
                timestamp: Date.now(),
                sessionId,
                details
            };

            const existingData = await this.loadPersistedSession();
            const events = existingData ? existingData.events : [];
            events.push(event);

            // 保持最近100个事件
            const recentEvents = events.slice(-100);

            const dataToSave: PersistedSessionData = {
                sessionId,
                projectName: existingData?.projectName,
                isAwaitingUser: existingData?.isAwaitingUser || false,
                resumeContext: existingData?.resumeContext,
                lastActivity: Date.now(),
                events: recentEvents
            };

            await fs.promises.writeFile(this.sessionFile, JSON.stringify(dataToSave, null, 2));
            this.logger.info(`📝 Recorded session event: ${eventType} for ${sessionId}`);
            
        } catch (error) {
            this.logger.error(`❌ Failed to record session event: ${error}`);
        }
    }

    // 🚀 修复：移除引擎状态保存方法，引擎状态由 SRSChatParticipant 管理

    /**
     * 📖 从持久化文件加载会话数据
     */
    private async loadPersistedSession(): Promise<PersistedSessionData | null> {
        try {
            if (!fs.existsSync(this.sessionFile)) {
                return null;
            }
            
            const content = await fs.promises.readFile(this.sessionFile, 'utf8');
            return JSON.parse(content) as PersistedSessionData;
            
        } catch (error) {
            this.logger.error(`❌ Failed to load persisted session: ${error}`);
            return null;
        }
    }

    // 🚀 修复：移除引擎清理方法，引擎生命周期由 SRSChatParticipant 管理

    /**
     * 🔧 初始化会话管理器 - 修复：移除引擎清理逻辑
     */
    private async initialize(): Promise<void> {
        try {
            this.ensureStorageDirectory();
            
            // 🚀 修复：移除引擎清理逻辑，专注于会话状态管理
            
            this.isInitialized = true;
            this.logger.info(`✅ SessionManager initialized`);
            
        } catch (error) {
            this.logger.error(`❌ SessionManager initialization failed: ${error}`);
        }
    }

    private ensureStorageDirectory(): void {
        const dir = path.dirname(this.sessionFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    // 兼容性方法保持现有API
    public async getSession(workspacePath: string): Promise<SessionContext> {
        this.logger.warn('🚨 Deprecated method getSession() called - use getOrCreateEngine() instead');
        return {
            sessionContextId: `legacy_${Date.now()}`,
            projectName: 'legacy-project',
            baseDir: null,
            activeFiles: [],
            metadata: {
                srsVersion: "v1.0",
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                version: "5.0"
            }
        };
    }
}
