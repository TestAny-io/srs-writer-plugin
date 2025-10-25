import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { promises as fsPromises } from 'fs';
import * as fs from 'fs';
import { Logger } from '../utils/logger';
import { SessionPathManager } from './SessionPathManager';
import { 
    SessionContext, 
    ISessionManager, 
    ISessionObserver, 
    SyncStatus, 
    UnifiedSessionFile,
    OperationLogEntry,
    OperationType,
    SessionUpdateRequest,
    ProjectSessionInfo,
    NewSessionResult
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

    // 🚀 阶段1新增：路径管理器
    private pathManager: SessionPathManager | null = null;

    // 🚀 修复：移除引擎管理，专注于会话状态管理
    private sessionFile: string; // 保留作为全局存储的备份
    private isInitialized = false;

    private constructor(private context: vscode.ExtensionContext) {
        // 保留全局存储作为备份
        this.sessionFile = path.join(
            context.globalStoragePath,
            'srs-writer-session.json'
        );
        this.ensureStorageDirectory();
        
        // 🚀 阶段1新增：初始化路径管理器
        this.initializePathManager();
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
     * 🚀 阶段1新增：初始化路径管理器
     */
    private initializePathManager(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            this.pathManager = new SessionPathManager(workspaceFolder.uri.fsPath);
            this.logger.info('SessionPathManager initialized for current workspace');
        } else {
            this.logger.info('No workspace folder available, PathManager will be initialized when workspace opens');
        }
    }

    /**
     * 🚀 阶段2修改：动态获取会话文件路径 - 根据项目名选择正确的会话文件
     */
    private get sessionFilePath(): string | null {
        const currentProjectName = this.currentSession?.projectName;
        const currentSessionId = this.currentSession?.sessionContextId;
        
        this.logger.warn(`🔍 [SESSION PATH] ===== GETTING SESSION FILE PATH =====`);
        this.logger.warn(`🔍 [SESSION PATH] Current session project: ${currentProjectName || 'none'}`);
        this.logger.warn(`🔍 [SESSION PATH] Current session ID: ${currentSessionId || 'none'}`);
        
        if (!this.pathManager || !this.pathManager.validateWorkspacePath()) {
            // 降级到旧位置（向后兼容）
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const legacyPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'srs-writer-session.json');
                this.logger.warn(`🔍 [SESSION PATH] Using legacy path: ${legacyPath}`);
                return legacyPath;
            }
            this.logger.warn(`🔍 [SESSION PATH] No workspace folder, returning null`);
            return null;
        }

        // 🚀 阶段2新逻辑：根据当前会话的项目名选择文件路径
        if (currentProjectName) {
            // 有具体项目名，使用项目级会话文件
            const projectPath = this.pathManager.getProjectSessionPath(currentProjectName);
            this.logger.warn(`🔍 [SESSION PATH] Using project path: ${projectPath}`);
            return projectPath;
        } else {
            // 没有项目名，使用主会话文件
            const mainPath = this.pathManager.getMainSessionPath();
            this.logger.warn(`🔍 [SESSION PATH] Using main path: ${mainPath}`);
            return mainPath;
        }
    }

    /**
     * 获取当前会话（v3.0异步版本）
     * 🚀 v6.0修复：移除过期检查逻辑
     * 原因：在持久化架构下，session保存在磁盘，不需要强制过期
     * - 内存只有一个currentSession引用，不存在资源泄漏
     * - 用户应该可以随时切换回任何老项目
     * - 强制过期破坏用户体验和审计追踪完整性
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
            // 🔧 v3.0改进：只记录实际变更的字段，减少日志噪音
            const changedFields = this.getChangedFields(previousSession, updates);
            if (changedFields.length > 0) {
                this.logger.info(`Session updated - changed fields: ${changedFields.join(', ')}`);
            }
            
            // 🚀 修复：使用UnifiedSessionFile格式保存，避免覆盖operations历史
            // updateSessionWithLog会自动更新状态和通知观察者
            await this.updateSessionWithLog({
                stateUpdates: updates,
                logEntry: {
                    type: OperationType.SESSION_UPDATED,
                    operation: `Session updated - fields: ${changedFields.join(', ')}`,
                    success: true,
                    sessionData: updates
                }
            });
            
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
        
        // 🚀 修复：获取当前Git分支信息
        let currentGitBranch: string | undefined;
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const { getCurrentBranch } = await import('../tools/atomic/git-operations');
                currentGitBranch = await getCurrentBranch(workspaceFolder.uri.fsPath) || undefined;
                this.logger.info(`🌿 [createNewSession] Detected current Git branch: ${currentGitBranch || 'unknown'}`);
            }
        } catch (error) {
            this.logger.warn(`🌿 [createNewSession] Failed to get Git branch: ${(error as Error).message}`);
            // Git检查失败不阻止会话创建
        }
        
        this.currentSession = {
            sessionContextId: crypto.randomUUID(),  // 🚀 新增：项目唯一标识符
            projectName: projectName || null,
            baseDir: projectName ? path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', projectName) : null,
            activeFiles: [],
            gitBranch: currentGitBranch,  // 🚀 修复：初始化Git分支字段
            metadata: {
                srsVersion: 'v1.0',  // SRS文档版本号
                created: now,
                lastModified: now,
                version: '5.0'       // 🚀 会话格式版本号更新为5.0
            }
        };

        this.logger.info(`New session created${projectName ? ` for project: ${projectName}` : ''}`);
        
        // 🚀 修复：使用UnifiedSessionFile格式保存，避免覆盖operations历史
        // updateSessionWithLog会自动通知观察者
        try {
            await this.updateSessionWithLog({
                logEntry: {
                    type: OperationType.SESSION_CREATED,
                    operation: `Created new session${projectName ? ` for project: ${projectName}` : ''}`,
                    success: true,
                    sessionData: this.currentSession
                }
            });
        } catch (error) {
            this.logger.error('Failed to save new session', error as Error);
            // 即使保存失败，也返回已创建的会话对象
        }

        return this.currentSession!;
    }

    /**
     * 🚀 清理会话 - v3.0观察者通知版本
     */
    public async clearSession(): Promise<void> {
        // 🕵️ 添加犯罪现场日志 - 记录调用栈
        const stack = new Error().stack;
        this.logger.warn('🚨 [CRIME SCENE] clearSession() called! Call stack:');
        this.logger.warn(stack || 'No stack trace available');
        this.logger.warn(`🚨 [BEFORE CLEAR] currentSession exists: ${this.currentSession !== null}`);
        if (this.currentSession) {
            this.logger.warn(`🚨 [BEFORE CLEAR] currentSession.projectName: ${this.currentSession.projectName}`);
            this.logger.warn(`🚨 [BEFORE CLEAR] currentSession.sessionContextId: ${this.currentSession.sessionContextId}`);
        }
        
        this.currentSession = null;
        this.logger.warn('🚨 [AFTER CLEAR] currentSession set to null');
        this.logger.info('Session cleared');
        
        // 🚀 阶段3重构：废弃文件删除逻辑，保留所有会话文件
        // 会话文件将保留在 .session-log/ 目录中，用户可以随时切换回来
        this.logger.info('Session files preserved in .session-log/ directory for future access');

        // 🚀 v3.0新增：通知所有观察者
        this.notifyObservers();
        this.logger.warn('🚨 [CLEAR COMPLETE] All observers notified of session clear');
    }

    /**
     * 🚀 阶段1修改：保存会话到文件 - 使用新的路径管理器
     */
    public async saveSessionToFile(): Promise<void> {
        if (!this.currentSession || !this.sessionFilePath) {
            return;
        }

        try {
            // 🚀 阶段1新增：确保 session-log 目录存在
            if (this.pathManager) {
                await this.pathManager.ensureSessionDirectory();
            }
            
            // 确保目标目录存在
            const sessionDirPath = path.dirname(this.sessionFilePath);
            try {
                await fsPromises.access(sessionDirPath);
            } catch {
                await fsPromises.mkdir(sessionDirPath, { recursive: true });
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
        this.logger.warn(`🔍 [SAVE UNIFIED] ===== SAVING UNIFIED SESSION FILE =====`);
        this.logger.warn(`🔍 [SAVE UNIFIED] Operation type: ${newLogEntry.type}`);
        this.logger.warn(`🔍 [SAVE UNIFIED] Operation: ${newLogEntry.operation}`);
        this.logger.warn(`🔍 [SAVE UNIFIED] Current sessionFilePath: ${this.sessionFilePath}`);
        this.logger.warn(`🔍 [SAVE UNIFIED] Current session: ${this.currentSession?.projectName} (${this.currentSession?.sessionContextId})`);
        
        if (!this.sessionFilePath) {
            this.logger.warn(`🔍 [SAVE UNIFIED] No sessionFilePath, returning`);
            return;
        }

        // 🚀 修复：如果没有当前会话，且操作不是会话创建，则不保存
        if (!this.currentSession && newLogEntry.type !== OperationType.SESSION_CREATED) {
            this.logger.warn('Attempted to save unified session file without current session');
            return;
        }

        try {
            // 🚀 阶段1新增：确保 session-log 目录存在
            if (this.pathManager) {
                await this.pathManager.ensureSessionDirectory();
            }
            
            // 确保目标目录存在
            const sessionDirPath = path.dirname(this.sessionFilePath);
            try {
                await fsPromises.access(sessionDirPath);
            } catch {
                await fsPromises.mkdir(sessionDirPath, { recursive: true });
            }

            this.logger.warn(`🔍 [SAVE UNIFIED] About to read existing file from: ${this.sessionFilePath}`);
            // 读取现有文件或创建新文件
            const existingFile = await this.loadUnifiedSessionFile();
            this.logger.warn(`🔍 [SAVE UNIFIED] Existing file loaded, operations count: ${existingFile.operations.length}`);
            this.logger.warn(`🔍 [SAVE UNIFIED] Existing file currentSession: ${existingFile.currentSession?.projectName} (${existingFile.currentSession?.sessionContextId})`);
            
            // 更新unified文件
            const updatedFile: UnifiedSessionFile = {
                ...existingFile,
                currentSession: this.currentSession,
                operations: [...existingFile.operations, newLogEntry],
                lastUpdated: new Date().toISOString()
            };
            
            this.logger.warn(`🔍 [SAVE UNIFIED] Updated file will have operations count: ${updatedFile.operations.length}`);
            this.logger.warn(`🔍 [SAVE UNIFIED] Updated file currentSession: ${updatedFile.currentSession?.projectName} (${updatedFile.currentSession?.sessionContextId})`);
            
            // 写入文件
            this.logger.warn(`🔍 [SAVE UNIFIED] About to write to: ${this.sessionFilePath}`);
            await fsPromises.writeFile(this.sessionFilePath, JSON.stringify(updatedFile, null, 2), 'utf8');
            this.logger.warn(`🔍 [SAVE UNIFIED] File written successfully to: ${this.sessionFilePath}`);
            this.logger.info(`Unified session file saved to: ${this.sessionFilePath}`);
            
        } catch (error) {
            this.logger.error('Failed to save unified session file', error as Error);
            throw error;
        }
        
        this.logger.warn(`🔍 [SAVE UNIFIED] ===== SAVE UNIFIED SESSION FILE COMPLETED =====`);
    }

    /**
     * 🚀 v5.0新增：加载混合存储文件
     * 如果文件不存在或格式错误，返回默认结构
     */
    private async loadUnifiedSessionFile(): Promise<UnifiedSessionFile> {
        this.logger.warn(`🔍 [LOAD UNIFIED] ===== LOADING UNIFIED SESSION FILE =====`);
        this.logger.warn(`🔍 [LOAD UNIFIED] Loading from path: ${this.sessionFilePath}`);
        
        if (!this.sessionFilePath) {
            this.logger.warn(`🔍 [LOAD UNIFIED] No sessionFilePath, creating default file`);
            return this.createDefaultUnifiedFile();
        }

        try {
            // 检查文件是否存在
            await fsPromises.access(this.sessionFilePath);
            this.logger.warn(`🔍 [LOAD UNIFIED] File exists, reading content...`);
            const fileContent = await fsPromises.readFile(this.sessionFilePath, 'utf8');
            
            if (!fileContent || fileContent.trim().length === 0) {
                this.logger.warn(`🔍 [LOAD UNIFIED] File is empty, creating default file`);
                return this.createDefaultUnifiedFile();
            }
            
            this.logger.warn(`🔍 [LOAD UNIFIED] File content length: ${fileContent.length} chars`);
            
            let parsedData;
            try {
                parsedData = JSON.parse(fileContent);
                this.logger.warn(`🔍 [LOAD UNIFIED] JSON parsed successfully`);
            } catch (parseError) {
                this.logger.warn('Invalid JSON in session file, creating new unified file');
                return this.createDefaultUnifiedFile();
            }
            
            // 检查是否是新的UnifiedSessionFile格式
            if (this.isUnifiedSessionFile(parsedData)) {
                this.logger.warn(`🔍 [LOAD UNIFIED] Valid UnifiedSessionFile format detected`);
                this.logger.warn(`🔍 [LOAD UNIFIED] File currentSession: ${parsedData.currentSession?.projectName} (${parsedData.currentSession?.sessionContextId})`);
                this.logger.warn(`🔍 [LOAD UNIFIED] File operations count: ${parsedData.operations.length}`);
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
            this.logger.warn(`🔍 [LOAD UNIFIED] File access failed: ${(error as Error).message}, creating default file`);
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
        // 🕵️ 添加文件加载追踪
        this.logger.warn('🔍 [LOAD SESSION] loadSessionFromFile() called');
        this.logger.warn(`🔍 [LOAD SESSION] sessionFilePath: ${this.sessionFilePath}`);
        this.logger.warn(`🔍 [LOAD SESSION] currentSession before load: ${this.currentSession ? 'EXISTS' : 'NULL'}`);
        
        if (!this.sessionFilePath) {
            this.logger.warn('🔍 [LOAD SESSION] No sessionFilePath, returning null');
            this.logger.info('No workspace folder available');
            return null;
        }

        try {
            // 加载统一文件
            const unifiedFile = await this.loadUnifiedSessionFile();
            this.logger.warn(`🔍 [LOAD SESSION] Unified file loaded, currentSession in file: ${unifiedFile.currentSession ? 'EXISTS' : 'NULL'}`);
            
            // 从currentSession字段直接获取状态
            if (unifiedFile.currentSession) {
                this.logger.warn(`🔍 [LOAD SESSION] Setting currentSession from file: ${unifiedFile.currentSession.projectName} (${unifiedFile.currentSession.sessionContextId})`);
                this.currentSession = unifiedFile.currentSession;
                this.logger.info(`Session loaded from unified file: ${unifiedFile.currentSession.projectName || 'unnamed'}`);
                this.logger.info(`Loaded ${unifiedFile.operations.length} operation records`);
                
                // 🚀 v5.0：加载后通知观察者
                this.notifyObservers();
                
                this.logger.warn(`🔍 [LOAD SESSION] Successfully loaded and set currentSession`);
                return this.currentSession;
            } else {
                this.logger.warn('🔍 [LOAD SESSION] No currentSession found in unified file, keeping currentSession as-is');
                this.logger.info('No current session found in unified file');
                return null;
            }
            
        } catch (error) {
            this.logger.error('Failed to load session from unified file', error as Error);
            this.logger.warn('🔍 [LOAD SESSION] Load failed, returning null');
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
     * 🚀 v5.0重构：增强的同步状态检查
     * 支持新的UnifiedSessionFile格式和项目级会话管理
     */
    public async checkSyncStatus(): Promise<SyncStatus> {
        const inconsistencies: string[] = [];
        
        try {
            // 检查当前项目的会话文件一致性
            const projectName = this.currentSession?.projectName;
            if (projectName) {
                // 检查项目级会话文件
                await this.checkProjectSessionConsistency(projectName, inconsistencies);
            } else {
                // 检查主会话文件
                await this.checkMainSessionConsistency(inconsistencies);
            }
            
            // 检查Git分支一致性
            await this.checkGitBranchConsistency(inconsistencies);
            
            // 检查路径管理器状态
            await this.checkPathManagerConsistency(inconsistencies);
            
        } catch (error) {
            inconsistencies.push(`Sync check failed: ${(error as Error).message}`);
            this.logger.error('Sync status check failed', error as Error);
        }
        
        return {
            isConsistent: inconsistencies.length === 0,
            inconsistencies,
            lastSyncCheck: new Date().toISOString()
        };
    }

    /**
     * 🚀 v5.0新增：检查项目会话文件一致性
     */
    private async checkProjectSessionConsistency(projectName: string, inconsistencies: string[]): Promise<void> {
        try {
            const projectSessionPath = this.pathManager?.getProjectSessionPath(projectName);
            if (!projectSessionPath) {
                inconsistencies.push('PathManager not available for project session check');
                return;
            }

            // 检查文件是否存在
            try {
                await fsPromises.access(projectSessionPath);
            } catch {
                inconsistencies.push(`Project session file not found: ${projectName}`);
                return;
            }

            // 加载并检查统一会话文件
            const unifiedFile = await this.loadUnifiedSessionFileFromPath(projectSessionPath);
            
            if (!unifiedFile.currentSession) {
                inconsistencies.push('Project session file exists but contains no current session');
                return;
            }

            const fileSession = unifiedFile.currentSession;
            
            // 检查基本字段一致性
            if (fileSession.projectName !== this.currentSession?.projectName) {
                inconsistencies.push(`Project name mismatch: file="${fileSession.projectName}", memory="${this.currentSession?.projectName}"`);
            }
            
            if (fileSession.baseDir !== this.currentSession?.baseDir) {
                inconsistencies.push(`Base directory mismatch: file="${fileSession.baseDir}", memory="${this.currentSession?.baseDir}"`);
            }
            
            if (fileSession.activeFiles.length !== (this.currentSession?.activeFiles.length || 0)) {
                inconsistencies.push(`Active files count mismatch: file=${fileSession.activeFiles.length}, memory=${this.currentSession?.activeFiles.length || 0}`);
            }

            // 检查会话ID一致性
            if (fileSession.sessionContextId !== this.currentSession?.sessionContextId) {
                inconsistencies.push(`Session ID mismatch: file="${fileSession.sessionContextId}", memory="${this.currentSession?.sessionContextId}"`);
            }

            // 检查文件格式版本
            if (unifiedFile.fileVersion !== '5.0') {
                inconsistencies.push(`Outdated file format: ${unifiedFile.fileVersion} (expected: 5.0)`);
            }

        } catch (error) {
            inconsistencies.push(`Project session consistency check failed: ${(error as Error).message}`);
        }
    }

    /**
     * 🚀 v5.0新增：检查主会话文件一致性
     */
    private async checkMainSessionConsistency(inconsistencies: string[]): Promise<void> {
        try {
            const mainSessionPath = this.pathManager?.getMainSessionPath();
            if (!mainSessionPath) {
                inconsistencies.push('PathManager not available for main session check');
                return;
            }

            // 检查文件是否存在
            try {
                await fsPromises.access(mainSessionPath);
                
                // 如果文件存在但内存中没有会话，这是不一致的
                if (!this.currentSession) {
                    inconsistencies.push('Main session file exists but no session in memory');
                }
            } catch {
                // 如果文件不存在但内存中有会话，这也是不一致的
                if (this.currentSession) {
                    inconsistencies.push('Session exists in memory but main session file not found');
                }
            }
        } catch (error) {
            inconsistencies.push(`Main session consistency check failed: ${(error as Error).message}`);
        }
    }

    /**
     * 🚀 v5.0新增：检查Git分支一致性
     */
    private async checkGitBranchConsistency(inconsistencies: string[]): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                // 没有工作区，跳过Git检查
                return;
            }

            const { getCurrentBranch } = await import('../tools/atomic/git-operations');
            const currentBranch = await getCurrentBranch(workspaceFolder.uri.fsPath);
            
            if (!currentBranch) {
                // 不是Git仓库或无法获取分支信息
                return;
            }

            const currentSession = this.currentSession;
            
            // 检查项目分支一致性
            if (currentBranch.startsWith('SRS/')) {
                const branchProjectName = currentBranch.substring(4);
                
                if (!currentSession) {
                    inconsistencies.push(`On project branch "${currentBranch}" but no session in memory`);
                } else if (currentSession.projectName !== branchProjectName) {
                    inconsistencies.push(`Git branch project "${branchProjectName}" doesn't match session project "${currentSession.projectName}"`);
                }
            } else {
                // 在主分支上
                if (currentSession?.projectName) {
                    inconsistencies.push(`On main branch "${currentBranch}" but session has project "${currentSession.projectName}"`);
                }
            }

        } catch (error) {
            // Git检查失败不算严重错误，只记录警告
            this.logger.warn(`Git branch consistency check failed: ${(error as Error).message}`);
        }
    }

    /**
     * 🚀 v5.0新增：检查路径管理器状态一致性
     */
    private async checkPathManagerConsistency(inconsistencies: string[]): Promise<void> {
        try {
            if (!this.pathManager) {
                inconsistencies.push('PathManager not initialized');
                return;
            }

            // 检查工作区路径有效性
            if (!this.pathManager.validateWorkspacePath()) {
                inconsistencies.push('PathManager workspace path validation failed');
            }

        } catch (error) {
            inconsistencies.push(`PathManager consistency check failed: ${(error as Error).message}`);
        }
    }

    /**
     * 🚀 v5.0新增：获取当前状态信息（用于状态显示）
     */
    public async getCurrentStatusInfo(): Promise<{
        projectName: string;
        baseDirectory: string;
        activeFiles: number;
        gitBranch: string;
        sessionId: string;
        fileFormat: string;
    }> {
        const currentSession = this.currentSession;
        let gitBranch = 'Unknown';
        let fileFormat = 'Unknown';

        // 获取Git分支信息
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const { getCurrentBranch } = await import('../tools/atomic/git-operations');
                const branch = await getCurrentBranch(workspaceFolder.uri.fsPath);
                gitBranch = branch || 'Not a Git repository';
            } else {
                gitBranch = 'No workspace';
            }
        } catch (error) {
            gitBranch = 'Git check failed';
        }

        // 获取文件格式信息
        try {
            const projectName = currentSession?.projectName;
            if (projectName) {
                const projectSessionPath = this.pathManager?.getProjectSessionPath(projectName);
                if (projectSessionPath) {
                    const unifiedFile = await this.loadUnifiedSessionFileFromPath(projectSessionPath);
                    fileFormat = `UnifiedSessionFile v${unifiedFile.fileVersion}`;
                }
            } else {
                const mainSessionPath = this.pathManager?.getMainSessionPath();
                if (mainSessionPath) {
                    try {
                        await fsPromises.access(mainSessionPath);
                        const unifiedFile = await this.loadUnifiedSessionFileFromPath(mainSessionPath);
                        fileFormat = `UnifiedSessionFile v${unifiedFile.fileVersion}`;
                    } catch {
                        fileFormat = 'No session file';
                    }
                }
            }
        } catch (error) {
            fileFormat = 'Format check failed';
        }

        return {
            projectName: currentSession?.projectName || 'No project',
            baseDirectory: currentSession?.baseDir || 'No base directory',
            activeFiles: currentSession?.activeFiles.length || 0,
            gitBranch,
            sessionId: currentSession?.sessionContextId || 'No session',
            fileFormat
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
        // 🚨 新增：观察者通知详细追踪
        const notifyTimestamp = new Date().toISOString();
        const notifyStack = new Error().stack;
        
        this.logger.warn(`🚨 [NOTIFY OBSERVERS] Starting observer notification at ${notifyTimestamp}`);
        this.logger.warn(`🚨 [NOTIFY OBSERVERS] Total observers: ${this.observers.size}`);
        this.logger.warn(`🚨 [NOTIFY OBSERVERS] Current session: ${this.currentSession?.sessionContextId || 'null'}`);
        this.logger.warn(`🚨 [NOTIFY OBSERVERS] Call stack:`);
        this.logger.warn(notifyStack || 'No stack trace available');
        
        let observerIndex = 0;
        this.observers.forEach(observer => {
            observerIndex++;
            this.logger.warn(`🚨 [NOTIFY OBSERVERS] Calling observer ${observerIndex}/${this.observers.size}`);
            this.logger.warn(`🚨 [NOTIFY OBSERVERS] Observer type: ${observer.constructor.name}`);
            
            try {
                observer.onSessionChanged(this.currentSession);
                this.logger.warn(`🚨 [NOTIFY OBSERVERS] Observer ${observerIndex} completed successfully`);
            } catch (error) {
                this.logger.error(`❌ [NOTIFY OBSERVERS] Observer ${observerIndex} failed: ${(error as Error).message}`, error as Error);
                // 移除有问题的观察者
                this.observers.delete(observer);
                this.logger.warn(`🚨 [NOTIFY OBSERVERS] Removed faulty observer ${observerIndex}`);
            }
        });
        
        this.logger.warn(`🚨 [NOTIFY OBSERVERS] All observers notified`);
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

    // 🚀 阶段3重构：废弃 deleteSessionFile() 方法
    // 根据重构设计，不再删除会话文件，所有会话文件都保留用于后续访问

    /**
     * 🚀 智能会话初始化 - 支持基于Git分支的状态恢复
     * 区分用户主动退出和意外重启，确保状态一致性
     */
    public async autoInitialize(): Promise<void> {
        const stack = new Error().stack;
        this.logger.info('🚀 [SMART RECOVERY] autoInitialize() called');
        this.logger.debug(`Call stack: ${stack || 'No stack trace available'}`);
        
        try {
            // 1. 检查退出意图标记
            const exitFlag = this.context.globalState.get('srs-writer.intentional-exit-flag') as any;
            const isIntentionalExit = exitFlag && (Date.now() - exitFlag.timestamp < 60000); // 1分钟内有效
            
            if (isIntentionalExit) {
                // 用户主动退出，清除标记并保持清理状态
                await this.context.globalState.update('srs-writer.intentional-exit-flag', undefined);
                this.logger.info('🚩 Detected intentional exit, skipping smart recovery');
                return;
            }
            
            // 2. 清除可能的过期标记
            if (exitFlag) {
                await this.context.globalState.update('srs-writer.intentional-exit-flag', undefined);
                this.logger.info('🚩 Cleared expired exit flag');
            }
            
            // 3. 直接进行智能Git分支检测和恢复
            // 跳过常规 loadSessionFromFile()，因为它只会加载主会话文件
            this.logger.info('🔍 Starting smart recovery from Git branch detection');
            await this.attemptSmartRecoveryFromGitBranch();
            
        } catch (error) {
            this.logger.error('Smart recovery failed, but continuing startup', error as Error);
            // 不抛出错误，确保插件能正常启动
        }
        
        this.logger.info('🚀 [SMART RECOVERY] autoInitialize() completed');
    }

    /**
     * 🚀 智能Git分支检测和恢复
     * 基于当前Git分支智能恢复对应的项目会话
     */
    private async attemptSmartRecoveryFromGitBranch(): Promise<void> {
        try {
            // 1. 检测当前Git分支
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                this.logger.info('🔍 No workspace folder, skipping Git branch detection');
                return;
            }
            
            const { getCurrentBranch } = await import('../tools/atomic/git-operations');
            const currentBranch = await getCurrentBranch(workspaceFolder.uri.fsPath);
            
            this.logger.info(`🔍 Current Git branch: ${currentBranch || 'unknown'}`);
            
            // 2. 检查是否为项目分支 (SRS/xxx 格式)
            if (!currentBranch || !currentBranch.startsWith('SRS/')) {
                this.logger.info('🔍 Not on a project branch, attempting to load main session');
                await this.attemptLoadMainSession();
                return;
            }
            
            // 3. 提取项目名
            const projectName = currentBranch.substring(4); // 移除 "SRS/" 前缀
            this.logger.info(`🔍 Detected project branch: ${currentBranch}, project: ${projectName}`);
            
            // 4. 检查对应的项目会话文件是否存在并加载
            const projectSessionPath = this.pathManager?.getProjectSessionPath(projectName);
            if (!projectSessionPath) {
                this.logger.warn('🔍 PathManager not available, cannot determine project session path');
                return;
            }
            
            try {
                await fsPromises.access(projectSessionPath);
                // 会话文件存在，加载它
                this.logger.info(`🔄 Smart recovery: Loading session for project ${projectName}`);
                await this.loadProjectSessionDirect(projectName);
            } catch {
                // 会话文件不存在，创建新的项目会话
                this.logger.info(`🔄 Smart recovery: Creating new session for existing project ${projectName}`);
                await this.createProjectSessionForExistingProject(projectName);
            }
            
        } catch (error) {
            this.logger.warn(`Smart recovery failed: ${(error as Error).message}`);
            // 静默失败，尝试加载主会话作为fallback
            await this.attemptLoadMainSession();
        }
    }

    /**
     * 🚀 尝试加载主会话文件
     */
    private async attemptLoadMainSession(): Promise<void> {
        try {
            const mainSessionPath = this.pathManager?.getMainSessionPath();
            if (!mainSessionPath) {
                this.logger.info('🔍 PathManager not available for main session');
                return;
            }
            
            try {
                await fsPromises.access(mainSessionPath);
                const unifiedFile = await this.loadUnifiedSessionFileFromPath(mainSessionPath);
                if (unifiedFile.currentSession) {
                    this.currentSession = unifiedFile.currentSession;
                    this.logger.info('✅ Loaded main session successfully');
                    this.notifyObservers();
                } else {
                    this.logger.info('🔍 Main session file exists but contains no current session');
                }
            } catch {
                this.logger.info('🔍 No main session file found, starting fresh');
            }
        } catch (error) {
            this.logger.warn(`Failed to load main session: ${(error as Error).message}`);
        }
    }

    /**
     * 🚀 为现有项目创建会话（智能恢复场景）
     */
    private async createProjectSessionForExistingProject(projectName: string): Promise<void> {
        try {
            // 创建新的项目会话
            const newSession = await this.createNewSession(projectName);
            
            // 记录会话创建事件
            await this.updateSessionWithLog({
                logEntry: {
                    type: OperationType.SESSION_CREATED,
                    operation: `Smart recovery: Created session for existing project: ${projectName}`,
                    success: true,
                    sessionData: newSession
                }
            });
            
            this.logger.info(`✅ Smart recovery: Created new session for existing project ${projectName}`);
        } catch (error) {
            this.logger.error(`Failed to create session for existing project ${projectName}: ${(error as Error).message}`);
        }
    }

    /**
     * 🚀 直接加载项目会话（用于智能恢复）
     */
    private async loadProjectSessionDirect(projectName: string): Promise<void> {
        const projectSessionPath = this.pathManager?.getProjectSessionPath(projectName);
        if (!projectSessionPath) {
            throw new Error('PathManager not available');
        }
        
        try {
            const unifiedFile = await this.loadUnifiedSessionFileFromPath(projectSessionPath);
            if (unifiedFile.currentSession) {
                this.currentSession = unifiedFile.currentSession;
                this.logger.info(`✅ Smart recovery: Restored session for project ${projectName}`);
                this.notifyObservers();
            } else {
                this.logger.warn(`Project session file exists but contains no current session: ${projectName}`);
            }
        } catch (error) {
            throw new Error(`Failed to load project session directly: ${(error as Error).message}`);
        }
    }

    /**
     * 🚀 从指定路径加载统一会话文件（用于智能恢复）
     */
    private async loadUnifiedSessionFileFromPath(filePath: string): Promise<UnifiedSessionFile> {
        try {
            // 检查文件是否存在
            await fsPromises.access(filePath);
            const fileContent = await fsPromises.readFile(filePath, 'utf8');
            
            if (!fileContent || fileContent.trim().length === 0) {
                return this.createDefaultUnifiedFile();
            }
            
            let parsedData;
            try {
                parsedData = JSON.parse(fileContent);
            } catch (parseError) {
                this.logger.warn(`Invalid JSON in session file ${filePath}, creating new unified file`);
                return this.createDefaultUnifiedFile();
            }
            
            // 检查是否为新格式的UnifiedSessionFile
            if (this.isUnifiedSessionFile(parsedData)) {
                return parsedData as UnifiedSessionFile;
            }
            
            // 兼容旧格式：如果是SessionContext格式，转换为UnifiedSessionFile
            if (this.isValidSessionData(parsedData)) {
                this.logger.info(`Converting legacy session format to unified format: ${filePath}`);
                return {
                    fileVersion: '5.0',
                    currentSession: parsedData as SessionContext,
                    operations: [],
                    timeRange: {
                        startDate: new Date().toISOString().split('T')[0],
                        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    },
                    createdAt: parsedData.metadata?.created || new Date().toISOString(),
                    lastUpdated: new Date().toISOString()
                };
            }
            
            // 无效格式，返回默认结构
            this.logger.warn(`Unrecognized session file format: ${filePath}`);
            return this.createDefaultUnifiedFile();
            
        } catch (error) {
            this.logger.warn(`Failed to load session file ${filePath}: ${(error as Error).message}`);
            return this.createDefaultUnifiedFile();
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
     * 🚀 新增：获取最近活动文件信息
     * 扫描项目目录中最近修改的文件，返回格式化的活动信息
     */
    public async getRecentActivity(): Promise<string> {
        if (!this.currentSession?.baseDir) {
            return 'No project';
        }

        try {
            const recentFiles = await this.scanRecentFiles(this.currentSession.baseDir, 3);
            
            if (recentFiles.length === 0) {
                return 'No activity';
            }

            const activities = recentFiles.map(file => {
                const timeAgo = this.formatTimeAgo(file.modifiedTime);
                return `${file.name} (${timeAgo})`;
            });

            return activities.join(' | ');
        } catch (error) {
            this.logger.error('Failed to get recent activity', error as Error);
            return 'Failed to get recent activity';
        }
    }

    /**
     * 扫描目录中最近修改的文件
     */
    private async scanRecentFiles(baseDir: string, limit: number = 3): Promise<Array<{name: string, modifiedTime: Date}>> {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            
            // 读取目录内容
            const entries = await fs.readdir(baseDir, { withFileTypes: true });
            const files: Array<{name: string, modifiedTime: Date}> = [];
            
            for (const entry of entries) {
                // 跳过隐藏文件和目录，以及常见的排除目录
                if (entry.name.startsWith('.') || 
                    ['node_modules', 'dist', 'build', 'coverage'].includes(entry.name)) {
                    continue;
                }
                
                const fullPath = path.join(baseDir, entry.name);
                try {
                    const stats = await fs.stat(fullPath);
                    
                    // 只处理文件，且优先处理项目相关文件
                    if (entry.isFile() && this.isProjectRelevantFile(entry.name)) {
                        files.push({
                            name: entry.name,
                            modifiedTime: stats.mtime
                        });
                    }
                } catch (statError) {
                    // 忽略无法访问的文件
                    continue;
                }
            }
            
            // 按修改时间排序，最新的在前
            files.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
            
            return files.slice(0, limit);
        } catch (error) {
            this.logger.error('Failed to scan recent files', error as Error);
            return [];
        }
    }

    /**
     * 判断是否为项目相关文件
     */
    private isProjectRelevantFile(fileName: string): boolean {
        const relevantExtensions = ['.md', '.yaml', '.yml', '.json', '.txt'];
        const relevantNames = ['SRS.md', 'requirements.yaml', 'requirements_scaffold.yaml', 'README.md'];
        
        // 优先显示重要文件
        if (relevantNames.includes(fileName)) {
            return true;
        }
        
        // 其次显示相关扩展名的文件
        return relevantExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    }

    /**
     * 格式化时间为用户友好的"多久之前"格式
     */
    private formatTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) {
            return 'Just now';
        } else if (diffMinutes < 60) {
            return `${diffMinutes} minutes ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hours ago`;
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * 🚀 阶段1修改：强制刷新会话路径 - 重新初始化路径管理器
     */
    public refreshSessionPath(): void {
        this.initializePathManager();
        this.logger.info('SessionPathManager refreshed for workspace changes');
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

    // 🚀 阶段4清理：移除 generateArchiveFileName 方法

    // 🚀 阶段4清理：移除 archiveDirectoryPath getter

    /**
     * 🚀 阶段3新增：扫描所有项目会话文件
     */
    public async listProjectSessions(): Promise<ProjectSessionInfo[]> {
        if (!this.pathManager) {
            this.logger.warn('PathManager not initialized, cannot list project sessions');
            return [];
        }
        
        const sessionDir = this.pathManager.getSessionDirectory();
        const projects: ProjectSessionInfo[] = [];
        
        try {
            const sessionDirUri = vscode.Uri.file(sessionDir);
            
            // 检查会话目录是否存在
            try {
                await vscode.workspace.fs.stat(sessionDirUri);
            } catch {
                this.logger.info('Session directory does not exist yet');
                return [];
            }
            
            // 读取目录内容
            const files = await vscode.workspace.fs.readDirectory(sessionDirUri);
            
            for (const [fileName, fileType] of files) {
                // 只处理会话文件
                if (fileType === vscode.FileType.File && fileName.startsWith('srs-writer-session_') && fileName.endsWith('.json')) {
                    // 跳过主会话文件
                    if (fileName === 'srs-writer-session_main.json') {
                        continue;
                    }
                    
                    // 解析项目名
                    const projectName = this.extractProjectNameFromSessionFile(fileName);
                    if (projectName) {
                        const sessionFilePath = path.join(sessionDir, fileName);
                        
                        try {
                            // 读取会话文件元数据
                            const sessionData = await this.loadSessionFileContent(sessionFilePath);
                            
                            projects.push({
                                projectName,
                                sessionFile: sessionFilePath,
                                lastModified: sessionData.metadata?.lastModified || '',
                                isActive: projectName === this.currentSession?.projectName,
                                operationCount: sessionData.operations?.length || 0,
                                gitBranch: sessionData.gitBranch  // 🚀 阶段3新增：从会话文件中读取Git分支信息
                            });
                            
                            this.logger.debug(`Found project session: ${projectName}`);
        } catch (error) {
                            this.logger.warn(`Failed to read session file ${fileName}: ${(error as Error).message}`);
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.error('Failed to scan session directory', error as Error);
        }
        
        return projects;
    }

    /**
     * 🚀 阶段3新增：从会话文件名解析项目名
     */
    private extractProjectNameFromSessionFile(fileName: string): string | null {
        // 文件名格式: srs-writer-session_{projectName}.json
        const match = fileName.match(/^srs-writer-session_(.+)\.json$/);
        return match ? match[1] : null;
    }

    /**
     * 🚀 阶段3新增：加载会话文件内容（不影响当前会话）
     */
    private async loadSessionFileContent(sessionFilePath: string): Promise<any> {
        const fileUri = vscode.Uri.file(sessionFilePath);
        const content = await vscode.workspace.fs.readFile(fileUri);
        return JSON.parse(content.toString());
    }

    /**
     * 🚀 阶段3新增：项目会话切换
     */
    public async switchToProjectSession(projectName: string): Promise<void> {
        try {
            this.logger.warn(`🔍 [SWITCH DEBUG] ===== STARTING PROJECT SWITCH =====`);
            this.logger.warn(`🔍 [SWITCH DEBUG] Target project: ${projectName}`);
            
            // 记录切换前的状态
            const sourceProjectName = this.currentSession?.projectName || undefined;
            const sourceSessionId = this.currentSession?.sessionContextId || 'none';
            this.logger.warn(`🔍 [SWITCH DEBUG] Source project: ${sourceProjectName || 'workspace root'}`);
            this.logger.warn(`🔍 [SWITCH DEBUG] Source session ID: ${sourceSessionId}`);
            this.logger.warn(`🔍 [SWITCH DEBUG] Current sessionFilePath BEFORE switch: ${this.sessionFilePath}`);
            
            // 1. 加载或创建目标项目会话
            this.logger.warn(`🔍 [SWITCH DEBUG] Calling loadOrCreateProjectSession...`);
            const targetSession = await this.loadOrCreateProjectSession(projectName, sourceProjectName);
            
            this.logger.warn(`🔍 [SWITCH DEBUG] Target session loaded: ${targetSession.projectName} (${targetSession.sessionContextId})`);
            this.logger.warn(`🔍 [SWITCH DEBUG] Current sessionFilePath AFTER loadOrCreate: ${this.sessionFilePath}`);
            
            // 2. 更新当前会话
            this.logger.warn(`🔍 [SWITCH DEBUG] Setting currentSession to target session...`);
            this.currentSession = targetSession;
            this.logger.warn(`🔍 [SWITCH DEBUG] Current sessionFilePath AFTER setting currentSession: ${this.sessionFilePath}`);
            
            // 3. 通知观察者
            this.notifyObservers();
            
            this.logger.warn(`🔍 [SWITCH DEBUG] ===== PROJECT SWITCH COMPLETED =====`);
            this.logger.info(`Successfully switched to project session: ${projectName}`);
        } catch (error) {
            this.logger.error(`Failed to switch to project session: ${projectName}`, error as Error);
            throw error;
        }
    }

    /**
     * 🚀 彻底修复：项目会话切换逻辑重构
     * 简化为两种情况：使用目标项目session或创建新session，避免混合状态
     */
    private async loadOrCreateProjectSession(projectName: string, sourceProjectName?: string): Promise<SessionContext> {
        this.logger.warn(`🔍 [LOAD OR CREATE] ===== STARTING LOAD OR CREATE PROJECT SESSION =====`);
        this.logger.warn(`🔍 [LOAD OR CREATE] Target project: ${projectName}`);
        this.logger.warn(`🔍 [LOAD OR CREATE] Source project: ${sourceProjectName || 'none'}`);
        this.logger.warn(`🔍 [LOAD OR CREATE] Current session BEFORE: ${this.currentSession?.projectName} (${this.currentSession?.sessionContextId})`);
        this.logger.warn(`🔍 [LOAD OR CREATE] Current sessionFilePath BEFORE: ${this.sessionFilePath}`);
        
        if (!this.pathManager) throw new Error('PathManager not initialized');
        
        const sessionPath = this.pathManager.getProjectSessionPath(projectName);
        this.logger.warn(`🔍 [LOAD OR CREATE] Target session file path: ${sessionPath}`);
        
        try {
            this.logger.warn(`🔍 [LOAD OR CREATE] Attempting to load target session file...`);
            // 尝试加载目标项目的session文件
            const unifiedFile = await this.loadUnifiedSessionFileFromPath(sessionPath);
            this.logger.warn(`🔍 [LOAD OR CREATE] Target file loaded successfully`);
            this.logger.warn(`🔍 [LOAD OR CREATE] Target file currentSession: ${unifiedFile.currentSession?.projectName} (${unifiedFile.currentSession?.sessionContextId})`);
            this.logger.warn(`🔍 [LOAD OR CREATE] Target file operations count: ${unifiedFile.operations.length}`);
            
            if (unifiedFile.currentSession?.sessionContextId) {
                // 情况1：目标项目有有效session，直接使用
                this.logger.warn(`🔍 [LOAD OR CREATE] Target has valid session, loading it...`);
                this.logger.warn(`🔍 [LOAD OR CREATE] Current session BEFORE loadTargetProjectSession: ${this.currentSession?.projectName} (${this.currentSession?.sessionContextId})`);
                
                const result = await this.loadTargetProjectSession(unifiedFile, projectName, sourceProjectName);
                
                this.logger.warn(`🔍 [LOAD OR CREATE] loadTargetProjectSession completed`);
                this.logger.warn(`🔍 [LOAD OR CREATE] Current session AFTER loadTargetProjectSession: ${this.currentSession?.projectName} (${this.currentSession?.sessionContextId})`);
                this.logger.warn(`🔍 [LOAD OR CREATE] Returning result: ${result.projectName} (${result.sessionContextId})`);
                
                return result;
            } else {
                // 情况2：目标项目session无效，创建新session
                this.logger.warn(`🔍 [LOAD OR CREATE] Target session invalid, creating new session...`);
                this.logger.warn(`🔍 [LOAD OR CREATE] Current session BEFORE createNewSessionForProject: ${this.currentSession?.projectName} (${this.currentSession?.sessionContextId})`);
                
                const result = await this.createNewSessionForProject(projectName, sourceProjectName);
                
                this.logger.warn(`🔍 [LOAD OR CREATE] createNewSessionForProject completed`);
                this.logger.warn(`🔍 [LOAD OR CREATE] Current session AFTER createNewSessionForProject: ${this.currentSession?.projectName} (${this.currentSession?.sessionContextId})`);
                this.logger.warn(`🔍 [LOAD OR CREATE] Returning result: ${result.projectName} (${result.sessionContextId})`);
                
                return result;
            }
            
        } catch (error) {
            // 情况3：目标项目文件不存在，创建新session
            this.logger.warn(`🔍 [LOAD OR CREATE] Target file not found, creating new session...`);
            this.logger.warn(`🔍 [LOAD OR CREATE] Error: ${(error as Error).message}`);
            this.logger.warn(`🔍 [LOAD OR CREATE] Current session BEFORE createNewSessionForProject (catch): ${this.currentSession?.projectName} (${this.currentSession?.sessionContextId})`);
            
            const result = await this.createNewSessionForProject(projectName, sourceProjectName);
            
            this.logger.warn(`🔍 [LOAD OR CREATE] createNewSessionForProject (catch) completed`);
            this.logger.warn(`🔍 [LOAD OR CREATE] Current session AFTER createNewSessionForProject (catch): ${this.currentSession?.projectName} (${this.currentSession?.sessionContextId})`);
            this.logger.warn(`🔍 [LOAD OR CREATE] Returning result (catch): ${result.projectName} (${result.sessionContextId})`);
            
            return result;
        }
    }

    /**
     * 🚀 彻底修复：加载目标项目的现有session并记录切换日志
     */
    private async loadTargetProjectSession(unifiedFile: UnifiedSessionFile, projectName: string, sourceProjectName?: string): Promise<SessionContext> {
        if (!unifiedFile.currentSession) {
            throw new Error('No valid session in unified file');
        }
        
        this.logger.warn(`🔍 [LOAD TARGET] ===== LOADING TARGET PROJECT SESSION =====`);
        
        // 直接使用目标项目的原有session
        const targetSession = unifiedFile.currentSession;
        this.logger.warn(`🔍 [LOAD TARGET] Target session from file: ${targetSession.projectName} (${targetSession.sessionContextId})`);
        this.logger.warn(`🔍 [LOAD TARGET] Target session activeFiles: ${JSON.stringify(targetSession.activeFiles)}`);
        this.logger.warn(`🔍 [LOAD TARGET] Current sessionFilePath BEFORE setting: ${this.sessionFilePath}`);
        
        // 设置为当前session
        this.currentSession = targetSession;
        this.logger.warn(`🔍 [LOAD TARGET] Current sessionFilePath AFTER setting: ${this.sessionFilePath}`);
        
        // 只记录项目切换日志，一次写入完成
        this.logger.warn(`🔍 [LOAD TARGET] About to call updateSessionWithLog...`);
        await this.updateSessionWithLog({
            logEntry: {
                type: OperationType.PROJECT_SWITCHED,
                operation: `Switched to existing project: ${projectName}${sourceProjectName ? ` (from: ${sourceProjectName})` : ''}`,
                success: true,
                projectName: projectName,
                sessionData: targetSession
            }
        });
        this.logger.warn(`🔍 [LOAD TARGET] updateSessionWithLog completed`);
        
        this.logger.warn(`🔍 [LOAD TARGET] ===== TARGET SESSION LOAD COMPLETED =====`);
        return targetSession;
    }

    /**
     * 🚀 彻底修复：为项目创建新会话（处理文件不存在或无效的情况）
     */
    private async createNewSessionForProject(projectName: string, sourceProjectName?: string): Promise<SessionContext> {
        this.logger.warn(`🔍 [CREATE NEW] ===== CREATING NEW SESSION FOR PROJECT =====`);
        this.logger.warn(`🔍 [CREATE NEW] Target project: ${projectName}`);
        this.logger.warn(`🔍 [CREATE NEW] Source project: ${sourceProjectName || 'none'}`);
        this.logger.warn(`🔍 [CREATE NEW] Current session BEFORE: ${this.currentSession?.projectName} (${this.currentSession?.sessionContextId})`);
        this.logger.warn(`🔍 [CREATE NEW] Current sessionFilePath BEFORE: ${this.sessionFilePath}`);
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const projectBaseDir = workspaceFolder ? path.join(workspaceFolder.uri.fsPath, projectName) : null;
        this.logger.warn(`🔍 [CREATE NEW] Project base dir: ${projectBaseDir}`);
        
        // 创建全新的目标项目session
        this.logger.warn(`🔍 [CREATE NEW] Creating new session without saving...`);
        const newSession = await this.createNewSessionWithoutSaving(projectName);
        this.logger.warn(`🔍 [CREATE NEW] New session created: ${newSession.projectName} (${newSession.sessionContextId})`);
        
        // 更新项目基础目录
        if (projectBaseDir) {
            newSession.baseDir = projectBaseDir;
            this.logger.warn(`🔍 [CREATE NEW] Updated baseDir: ${newSession.baseDir}`);
        }
        
        // 设置为当前session
        this.logger.warn(`🔍 [CREATE NEW] Setting as current session...`);
        this.logger.warn(`🔍 [CREATE NEW] Current sessionFilePath BEFORE setting: ${this.sessionFilePath}`);
        this.currentSession = newSession;
        this.logger.warn(`🔍 [CREATE NEW] Current sessionFilePath AFTER setting: ${this.sessionFilePath}`);
        this.logger.warn(`🔍 [CREATE NEW] Current session is now: ${this.currentSession?.projectName} (${this.currentSession?.sessionContextId})`);
        
        // 记录项目切换日志，一次写入完成
        this.logger.warn(`🔍 [CREATE NEW] About to call updateSessionWithLog...`);
        await this.updateSessionWithLog({
            logEntry: {
                type: OperationType.PROJECT_SWITCHED,
                operation: `Created new session for project: ${projectName}${sourceProjectName ? ` (switched from: ${sourceProjectName})` : ''}`,
                success: true,
                projectName: projectName,
                sessionData: newSession
            }
        });
        this.logger.warn(`🔍 [CREATE NEW] updateSessionWithLog completed`);
        
        this.logger.warn(`🔍 [CREATE NEW] ===== CREATE NEW SESSION COMPLETED =====`);
        return newSession;
    }




    /**
     * 🚀 修复：创建新session但不自动保存（避免覆盖文件）
     */
    private async createNewSessionWithoutSaving(projectName?: string): Promise<SessionContext> {
        const now = new Date().toISOString();
        
        // 🚀 修复：获取当前Git分支信息
        let currentGitBranch: string | undefined;
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const { getCurrentBranch } = await import('../tools/atomic/git-operations');
                currentGitBranch = await getCurrentBranch(workspaceFolder.uri.fsPath) || undefined;
                this.logger.info(`🌿 [createNewSessionWithoutSaving] Detected current Git branch: ${currentGitBranch || 'unknown'}`);
            }
        } catch (error) {
            this.logger.warn(`🌿 [createNewSessionWithoutSaving] Failed to get Git branch: ${(error as Error).message}`);
        }
        
        const newSession: SessionContext = {
            sessionContextId: crypto.randomUUID(),
            projectName: projectName || null,
            baseDir: projectName 
                ? path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', projectName)
                : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            activeFiles: [],
            gitBranch: currentGitBranch,
            metadata: {
                srsVersion: 'v1.0',
                created: now,
                lastModified: now,
                version: '5.0'
            }
        };

        this.currentSession = newSession;
        this.logger.info(`New session created without auto-save${projectName ? ` for project: ${projectName}` : ''}`);
        
        // 🚀 通知观察者但不自动保存
        this.notifyObservers();

        return newSession;
    }


    /**
     * 🚀 阶段4重命名：简化的新会话创建方法
     * 原 archiveCurrentAndStartNew 方法的重构版本，专注于创建新会话
     */
    public async startNewSession(newProjectName?: string): Promise<NewSessionResult> {
        try {
            this.logger.info(`🚀 [Phase4] Creating new session: ${newProjectName || 'unnamed'}`);
            
            // 如果有当前会话，简单清理（不归档）
            const previousProjectName = this.currentSession?.projectName;
            if (this.currentSession) {
                this.logger.info(`🧹 [Phase4] Clearing previous session: ${previousProjectName}`);
                // 简单清理，不保存到归档
                this.currentSession = null;
            }

            // 创建新会话
            const newSession = await this.createNewSession(newProjectName);

            this.logger.info(`✅ [Phase4] Successfully started new session: ${newSession.projectName || 'unnamed'}`);
            
            return {
                success: true,
                newSession
            };

        } catch (error) {
            this.logger.error('Failed to start new session', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * 🚀 阶段4兼容性：保持旧方法名的向后兼容
     * @deprecated 使用 startNewSession 替代
     */
    public async archiveCurrentAndStartNew(
        newProjectName?: string, 
        archiveReason?: string
    ): Promise<NewSessionResult> {
        this.logger.warn('🚨 [DEPRECATED] archiveCurrentAndStartNew is deprecated, use startNewSession instead');
        return this.startNewSession(newProjectName);
    }

    // 🚀 阶段4清理：移除 archiveCurrentSession 方法

    // 🚀 阶段4清理：移除 listArchivedSessions 方法

    // 🚀 阶段4清理：移除 autoArchiveExpiredSessions 方法

    // 🚀 阶段4清理：移除 getUserAssetFiles 方法

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
