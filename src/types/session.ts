/**
 * v5.0 会话管理相关类型定义 - 统一混合存储架构
 */

/**
 * 🚀 v5.0新增：操作类型枚举
 * 定义所有可能的操作类型，用于事件溯源和审计
 */
export enum OperationType {
  // 🎯 会话生命周期管理
  "SESSION_CREATED" = "SESSION_CREATED",           // 新项目会话创建
  "SESSION_UPDATED" = "SESSION_UPDATED",           // 会话状态更新（activeFiles, baseDir等）
  "SESSION_ARCHIVED" = "SESSION_ARCHIVED",         // 会话归档到历史文件
  "SESSION_RESTORED" = "SESSION_RESTORED",         // 从归档恢复会话
  "SESSION_CLEARED" = "SESSION_CLEARED",           // 会话清理/重置
  
  // 🔧 工具执行记录
  "TOOL_EXECUTION_START" = "TOOL_EXECUTION_START", // 工具开始执行
  "TOOL_EXECUTION_END" = "TOOL_EXECUTION_END",     // 工具执行完成
  "TOOL_EXECUTION_FAILED" = "TOOL_EXECUTION_FAILED", // 工具执行失败
  
  // 📁 文件操作记录
  "FILE_CREATED" = "FILE_CREATED",                 // 文件创建
  "FILE_UPDATED" = "FILE_UPDATED",                 // 文件更新/修改
  "FILE_DELETED" = "FILE_DELETED",                 // 文件删除
  "FILE_READ" = "FILE_READ",                       // 文件读取
  "DIRECTORY_CREATED" = "DIRECTORY_CREATED",       // 目录创建
  
  // 👤 用户交互记录
  "USER_INPUT_RECEIVED" = "USER_INPUT_RECEIVED",   // 接收用户输入
  "USER_QUESTION_ASKED" = "USER_QUESTION_ASKED",   // 向用户提问（askQuestion）
  "USER_RESPONSE_RECEIVED" = "USER_RESPONSE_RECEIVED", // 接收用户回答
  "USER_CONFIRMATION_REQUESTED" = "USER_CONFIRMATION_REQUESTED", // 请求用户确认
  
  // 🧠 AI操作记录
  "AI_PLAN_GENERATED" = "AI_PLAN_GENERATED",       // AI生成执行计划
  "AI_RESPONSE_RECEIVED" = "AI_RESPONSE_RECEIVED", // AI响应接收
  "SPECIALIST_INVOKED" = "SPECIALIST_INVOKED",     // specialist规则调用
  
  // 📊 数据管理操作
  "DATA_BACKUP_CREATED" = "DATA_BACKUP_CREATED",   // 数据备份创建
  "DATA_MIGRATION_PERFORMED" = "DATA_MIGRATION_PERFORMED", // 数据迁移
  "CACHE_INVALIDATED" = "CACHE_INVALIDATED",       // 缓存失效
  
  // ⚠️ 错误和警告
  "ERROR_OCCURRED" = "ERROR_OCCURRED",             // 一般错误
  "WARNING_ISSUED" = "WARNING_ISSUED",             // 警告发出
  "CRITICAL_ERROR" = "CRITICAL_ERROR",             // 严重错误
  "RECOVERY_ATTEMPTED" = "RECOVERY_ATTEMPTED",     // 尝试恢复
  
  // 🔄 系统维护操作
  "SYSTEM_INITIALIZED" = "SYSTEM_INITIALIZED",     // 系统初始化
  "SYSTEM_SHUTDOWN" = "SYSTEM_SHUTDOWN",           // 系统关闭
  "MAINTENANCE_STARTED" = "MAINTENANCE_STARTED",   // 维护开始
  "MAINTENANCE_COMPLETED" = "MAINTENANCE_COMPLETED", // 维护完成
  
  // 📈 性能和监控
  "PERFORMANCE_LOGGED" = "PERFORMANCE_LOGGED",     // 性能记录
  "SLOW_OPERATION_DETECTED" = "SLOW_OPERATION_DETECTED", // 慢操作检测
  "MEMORY_USAGE_LOGGED" = "MEMORY_USAGE_LOGGED"    // 内存使用记录
}

export interface SessionContext {
  sessionContextId: string;        // 🆕 项目唯一标识符 (UUID)
  projectName: string | null;
  baseDir: string | null;
  activeFiles: string[];
  metadata: {
    srsVersion: string;      // SRS文档版本号，如"v1.0", "v1.1"
    created: string;         // ISO 8601 时间戳
    lastModified: string;    // ISO 8601 时间戳
    version: string;         // 会话格式版本号，如"5.0"
  };
}

/**
 * 🚀 v5.0更新：操作日志条目接口 - 支持类型化操作
 */
export interface OperationLogEntry {
  timestamp: string;               // ISO 8601时间戳
  type: OperationType;             // 🆕 操作类型（枚举）
  sessionContextId: string;        // 关联的项目ID
  operation: string;               // 具体操作描述
  success: boolean;                // 执行是否成功
  
  // 可选字段，根据操作类型选择性使用
  toolName?: string;               // 工具名称（TOOL_*类型使用）
  targetFiles?: string[];          // 操作的文件列表
  userInput?: string;              // 触发操作的用户输入
  executionTime?: number;          // 执行耗时(ms)
  error?: string;                  // 如果失败，记录错误信息
  sessionData?: Partial<SessionContext>; // SESSION_*类型的会话数据变更
}

/**
 * 🚀 v5.0新增：统一会话文件接口 - 混合存储架构
 * 同时包含当前状态和完整操作历史
 */
export interface UnifiedSessionFile {
  fileVersion: string;             // 文件格式版本，如"5.0"
  
  // 🎯 当前状态 - 插件重启时直接加载，无需重播
  currentSession: SessionContext | null;
  
  // 🎯 操作历史 - 完整的审计记录，支持历史查询
  operations: OperationLogEntry[];
  
  // 时间管理
  timeRange: {
    startDate: string;             // 文件覆盖的开始日期
    endDate: string;               // 文件覆盖的结束日期
  };
  createdAt: string;               // 文件创建时间
  lastUpdated: string;             // 最后更新时间
}

/**
 * 🚀 v5.0新增：SessionManager统一更新请求接口
 * specialistTools调用SessionManager时使用此接口
 */
export interface SessionUpdateRequest {
  // 状态更新（可选）
  stateUpdates?: Partial<SessionContext>;
  
  // 日志记录（必需）
  logEntry: {
    type: OperationType;
    operation: string;
    toolName?: string;
    targetFiles?: string[];
    userInput?: string;
    success: boolean;
    error?: string;
    executionTime?: number;
    sessionData?: Partial<SessionContext>;
  };
}

/**
 * ⚠️ v5.0已废弃：会话日志文件接口
 * @deprecated 使用 UnifiedSessionFile 替代
 */
export interface SessionLogFile {
  fileVersion: string;
  timeRange: {
    startDate: string;
    endDate: string;
  };
  operations: OperationLogEntry[];
  createdAt: string;
  lastUpdated: string;
}

/**
 * 🚀 新增：SessionContext 观察者接口
 * 
 * 实现此接口的组件将自动接收SessionContext变更通知
 */
export interface ISessionObserver {
  /**
   * 当SessionContext发生变更时被调用
   * @param newContext 新的会话上下文，null表示会话被清理
   */
  onSessionChanged(newContext: SessionContext | null): void;
}

/**
 * 🚀 新增：同步状态检查结果
 */
export interface SyncStatus {
  isConsistent: boolean;
  inconsistencies: string[];
  lastSyncCheck: string;
}

/**
 * 🚀 v4.0新增：归档会话信息
 */
export interface ArchivedSessionInfo {
  archiveFileName: string;      // 归档文件名，如 srs-writer-session-20240115-20240130.json
  originalSession: SessionContext;
  archiveDate: string;          // 归档时间 ISO 8601
  daysCovered: number;          // 会话覆盖的天数
  reason: 'age_limit' | 'manual_archive' | 'new_project';  // 归档原因
}

/**
 * 🚀 v4.0修复：单个归档条目接口
 * 描述归档文件中单个项目的完整数据结构
 */
export interface ArchiveFileEntry {
  sessionContextId: string;
  projectName: string | null;
  baseDir: string | null;
  activeFiles: string[];
  metadata: {
    srsVersion: string;
    created: string;
    lastModified: string;
    version: string;
  };
  operations: OperationLogEntry[];  // 🚀 保留完整的操作历史
  timeRange: {
    startDate: string;
    endDate: string;
  };
  archivedAt: string;              // 归档时间戳
  archiveReason: 'age_limit' | 'manual_archive' | 'new_project';
  fileVersion: string;             // 归档格式版本
}

/**
 * 🚀 v4.0新增：归档操作结果
 */
export interface ArchiveResult {
  success: boolean;
  archivedSession?: ArchivedSessionInfo;
  newSession?: SessionContext;
  error?: string;
  filesPreserved: string[];     // 保留的用户文件列表
}

export interface RuleContext {
  sessionData: SessionContext;  // 当前会话状态
  userInput: string;        // 原始用户输入
  preparedContext?: any;    // Strategy预处理的上下文（可选）
}

export interface StrategyOutput {
  specialistContext: any;   // 传给专家的预处理数据（更清晰的命名）
  ruleToInvoke: string;     // 要调用的specialist文件名
  skipAI?: boolean;         // 某些情况下直接跳过AI调用
  errorMessage?: string;    // 预处理阶段的错误消息
}

export interface OrchestratorCapabilities {
  routeIntent: (input: string, session: SessionContext) => 'create' | 'edit' | 'git' | 'help';
  detectProjectContext: (input: string) => { projectName?: string, scope?: string };
  validateSessionState: (session: SessionContext) => boolean;
}

/**
 * 会话管理器接口 - v2.0 简化版（全异步，移除意图管理）
 * 
 * ⚠️ 重要架构修正：所有方法都必须是异步的
 * 原因：SessionManager需要与文件系统交互，而文件I/O在Node.js/VSCode环境中
 * 必须使用异步操作，否则会阻塞VSCode主线程导致UI卡死
 * 
 * 🚀 v2.0 变更：移除 lastIntent 管理，简化为纯粹的项目会话状态管理
 * 🚀 v3.0 变更：添加观察者模式支持和强制同步功能
 * 🚀 v4.0 变更：添加归档功能，保护用户资产
 */
export interface ISessionManager {
  /**
   * 获取当前会话上下文。如果不存在，则返回null。
   */
  getCurrentSession(): Promise<SessionContext | null>;

  /**
   * 更新当前会话。只更新提供的字段，自动保存到文件。
   * metadata.lastModified会自动更新为当前时间
   * @param updates 要更新的字段的部分SessionContext对象
   */
  updateSession(updates: Partial<SessionContext>): Promise<void>;

  /**
   * 基于项目名创建一个全新的会话，并将其设为当前会话。
   * 自动设置baseDir、创建时间等字段
   * @param projectName 新项目的名称（可选）
   */
  createNewSession(projectName?: string): Promise<SessionContext>;

  /**
   * ⚠️ 已废弃：使用 archiveCurrentAndStartNew() 替代
   * @deprecated 此方法会删除用户资产，已被归档功能替代
   */
  clearSession(): Promise<void>;

  /**
   * 从文件系统显式保存当前会话。
   * 注：updateSession等方法会自动保存，此方法用于强制保存
   */
  saveSessionToFile(): Promise<void>;

  /**
   * 从文件系统加载会话。在插件激活时调用。
   */
  loadSessionFromFile(): Promise<SessionContext | null>;

  /**
   * 🚀 新增：订阅会话变更通知
   */
  subscribe(observer: ISessionObserver): void;

  /**
   * 🚀 新增：取消订阅会话变更通知
   */
  unsubscribe(observer: ISessionObserver): void;

  /**
   * 🚀 新增：检查同步状态
   */
  checkSyncStatus(): Promise<SyncStatus>;

  /**
   * 🚀 新增：强制通知所有观察者
   */
  forceNotifyObservers(): void;

  /**
   * 🚀 v4.0新增：归档当前会话并开始新项目
   * 这是"Start New Project"的正确实现 - 保护用户资产，归档历史
   * @param newProjectName 新项目名称（可选）
   * @param archiveReason 归档原因，默认为'new_project'
   */
  archiveCurrentAndStartNew(newProjectName?: string, archiveReason?: 'age_limit' | 'manual_archive' | 'new_project'): Promise<ArchiveResult>;

  /**
   * 🚀 v4.0新增：手动归档当前会话（不创建新会话）
   * 用于定期整理或手动备份
   */
  archiveCurrentSession(reason?: 'age_limit' | 'manual_archive'): Promise<ArchivedSessionInfo | null>;

  /**
   * 🚀 v4.0新增：列出所有归档的会话
   * @param limit 返回的最大归档数量，默认为20
   */
  listArchivedSessions(limit?: number): Promise<ArchivedSessionInfo[]>;

  /**
   * 🚀 v4.0新增：自动归档过期会话
   * 将超过指定天数的会话自动归档
   * @param maxAgeDays 会话最大年龄（天），默认15天
   */
  autoArchiveExpiredSessions(maxAgeDays?: number): Promise<ArchivedSessionInfo[]>;

  /**
   * 🚀 v4.0新增：获取用户资产文件列表
   * 返回当前项目中用户生成的所有文件，用于归档时确认保护
   */
  getUserAssetFiles(): Promise<string[]>;

  /**
   * 🚀 v5.0新增：统一状态+日志更新入口
   * specialistTools调用此方法汇报执行结果
   */
  updateSessionWithLog(request: SessionUpdateRequest): Promise<void>;

  /**
   * 🚀 v5.0新增：项目初始化专用方法
   * 创建新SessionContext并记录SESSION_CREATED事件
   */
  initializeProject(projectName?: string): Promise<SessionContext>;
}
