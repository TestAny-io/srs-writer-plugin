/**
 * v2.0 会话管理相关类型定义 - 工具代理模式简化版
 */

export interface SessionContext {
  projectName: string | null;
  baseDir: string | null;
  activeFiles: string[];
  metadata: {
    srsVersion: string;      // SRS文档版本号，如"v1.0", "v1.1"
    created: string;         // ISO 8601 时间戳
    lastModified: string;    // ISO 8601 时间戳
    version: string;         // 会话格式版本号，如"2.0"
  };
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
   * 清除当前会话状态，删除会话文件。
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
}
