/**
 * v1.2 双向同步相关类型定义
 */

import { SessionContext } from './session';

// === Orchestrator v3.0 智能分诊相关类型定义 ===

/**
 * AI响应模式枚举 - 支持智能分诊
 */
export enum AIResponseMode {
    TOOL_EXECUTION = 'TOOL_EXECUTION',
    KNOWLEDGE_QA = 'KNOWLEDGE_QA',
    GENERAL_CHAT = 'GENERAL_CHAT'
}

/**
 * AI计划接口 - 统一规划输出结构
 */
export interface AIPlan {
    thought: string;
    response_mode: AIResponseMode;
    direct_response: string | null;
    tool_calls: Array<{ name: string; args: any }>;
}

/**
 * 用户意图枚举 - 避免魔法字符串
 */
export const UserIntent = {
  CREATE: 'create',
  EDIT: 'edit',
  GIT: 'git',
  HELP: 'help',
  LINT: 'lint',
  PROTOTYPE: 'prototype'
} as const;

export type UserIntentType = typeof UserIntent[keyof typeof UserIntent];

/**
 * 同步状态类型
 */
export type SyncStatus = 
  | { status: 'synced' }
  | { status: 'conflict', dirtyFile: string }
  | { status: 'error', message: string };

/**
 * 支持的文件同步类型
 */
export enum SyncableFileType {
  SRS_MAIN = 'SRS.md',
  FUNCTIONAL_REQUIREMENTS = 'fr.yaml',
  NON_FUNCTIONAL_REQUIREMENTS = 'nfr.yaml',
  GLOSSARY = 'glossary.yaml',
  CLASSIFICATION = 'classification_decision.md',
  QUESTIONS = 'questions_and_suggestions.md'
}

/**
 * 同步检查器接口 - v1.2重构版（无状态、异步、职责单一）
 */
export interface ISyncChecker {
  /**
   * 检查给定会话上下文的同步状态
   * @param sessionContext 当前激活的会话上下文
   * @returns Promise<SyncStatus>
   */
  checkSyncStatus(sessionContext: SessionContext): Promise<SyncStatus>;
}

/**
 * 反向解析器接口 - v1.2增强版（依赖注入母文档路径）
 */
export interface IReverseParser {
  /**
   * 将脏文件的修改同步到母文档
   * @param dirtyFile 修改过的子文件路径
   * @param motherDocumentPath 母文档的完整路径（由SessionManager提供）
   */
  syncToMotherDocument(dirtyFile: string, motherDocumentPath: string): Promise<void>;
  canHandle(filePath: string): boolean;
  getSupportedFileTypes(): SyncableFileType[];
}

/**
 * 定义解析器的输出结构 - v1.2增强版（类型安全）
 * 
 * 推荐的文件名（提供类型提示和安全性）：
 * - 核心同步文件：使用 SyncableFileType 枚举值
 * - 母文档：'mother_document.md'
 * - 解析日志：'writer_log.json'
 * - 其他文件：任意有效的文件名
 */
export type ParsedArtifacts = Record<string, string>;

/**
 * 推荐的标准文件名 - 提供类型安全的常量
 * 在创建 ParsedArtifacts 时推荐使用这些常量
 */
export const StandardFileNames = {
  SRS_MAIN: SyncableFileType.SRS_MAIN,
  FUNCTIONAL_REQUIREMENTS: SyncableFileType.FUNCTIONAL_REQUIREMENTS,
  NON_FUNCTIONAL_REQUIREMENTS: SyncableFileType.NON_FUNCTIONAL_REQUIREMENTS,
  GLOSSARY: SyncableFileType.GLOSSARY,
  CLASSIFICATION: SyncableFileType.CLASSIFICATION,
  QUESTIONS: SyncableFileType.QUESTIONS,
  MOTHER_DOCUMENT: 'mother_document.md',
  WRITER_LOG: 'writer_log.json'
} as const;

/**
 * 定义解析选项，用于未来扩展
 */
export interface ParseOptions {
  outputFormat?: 'yaml' | 'json';
  includeMetadata?: boolean;
  errorHandling?: 'strict' | 'graceful';
  enableOptimizations?: boolean;
}

/**
 * AI交互模块的接口
 */
export interface IAICommunicator {
  /**
   * 基于用户输入生成母文档
   * @param userInput 用户的原始需求字符串
   * @returns Promise<string> AI生成的完整母文档内容
   */
  generateMotherDocument(userInput: string): Promise<string>;
}

/**
 * 🚫 DEPRECATED - ISRSParser接口已废弃
 * 
 * 原因：SRSParser已被重构为分层工具架构：
 * - documentGeneratorTools: 生成完整SRS报告
 * - documentImporterTools: 从Markdown导入解析
 * 
 * 新的解析功能通过工具执行器调用具体工具实现。
 */
// export interface ISRSParser - 已废弃

/**
 * 文件系统管理模块的接口
 */
export interface IFileSystemManager {
  /**
   * 将解析后的产物写入本地文件系统
   * @param artifacts 解析器返回的文件对象集
   * @param baseDir 要写入的基础目录名, e.g., "srs-task-manager"
   * @returns Promise<void>
   */
  writeArtifacts(artifacts: ParsedArtifacts, baseDir: string): Promise<void>;
}

/**
 * 错误分级枚举
 */
export enum ErrorSeverity {
  CRITICAL = 'critical',    // 导致整个流程失败
  HIGH = 'high',           // 影响核心文件生成
  MEDIUM = 'medium',       // 影响辅助文件生成
  LOW = 'low'              // 仅影响格式或元数据
}

/**
 * 解析错误接口
 */
export interface ParseError {
  severity: ErrorSeverity;
  message: string;
  section?: string;
  details?: any;
}

/**
 * 解析结果接口（包含错误信息）
 */
export interface ParseResult {
  artifacts: ParsedArtifacts;
  errors: ParseError[];
  warnings: ParseError[];
  metadata: {
    timestamp: string;
    promptVersion?: string;
    parserVersion: string;
    processedSections: string[];
  };
}

// === 以下为原有接口，保持兼容性 ===

/**
 * SRS文档结构接口
 */
export interface SRSDocument {
    version: string;
    title: string;
    project: ProjectInfo;
    sections: SRSSection[];
    metadata: DocumentMetadata;
}

/**
 * 项目信息接口
 */
export interface ProjectInfo {
    name: string;
    description: string;
    version: string;
    stakeholders: string[];
    scope: string;
}

/**
 * SRS章节接口
 */
export interface SRSSection {
    id: string;
    title: string;
    content: string;
    subsections?: SRSSection[];
    requirements?: Requirement[];
}

/**
 * 需求接口
 */
export interface Requirement {
    id: string;
    title: string;
    description: string;
    priority: RequirementPriority;
    type: RequirementType;
    status: RequirementStatus;
    dependencies?: string[];
    acceptanceCriteria?: string[];
}

/**
 * 需求优先级枚举
 */
export enum RequirementPriority {
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low'
}

/**
 * 需求类型枚举
 */
export enum RequirementType {
    FUNCTIONAL = 'functional',
    NON_FUNCTIONAL = 'non-functional',
    INTERFACE = 'interface',
    CONSTRAINT = 'constraint'
}

/**
 * 需求状态枚举
 */
export enum RequirementStatus {
    DRAFT = 'draft',
    REVIEW = 'review',
    APPROVED = 'approved',
    IMPLEMENTED = 'implemented'
}

/**
 * 文档元数据接口
 */
export interface DocumentMetadata {
    createdAt: Date;
    updatedAt: Date;
    author: string;
    reviewers?: string[];
    tags?: string[];
}

/**
 * AI通信配置接口
 */
export interface AICommunicatorConfig {
    apiKey: string;
    model: string;
    baseUrl?: string;
    maxTokens?: number;
    temperature?: number;
}

/**
 * 聊天消息接口
 */
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}

/**
 * 聊天会话接口
 */
export interface ChatSession {
    id: string;
    messages: ChatMessage[];
    context?: SRSDocument;
    createdAt: Date;
}

/**
 * 解析器选项接口
 */
export interface ParserOptions {
    language: string;
    format: 'yaml' | 'json' | 'markdown';
    includeMetadata: boolean;
    validateStructure: boolean;
}

/**
 * 文件操作结果接口
 */
export interface FileOperationResult {
    success: boolean;
    filePath?: string;
    error?: string;
    data?: any;
}

/**
 * 插件配置接口
 */
export interface PluginConfig {
    aiProvider: string;
    defaultLanguage: string;
    outputFormat: string;
    autoSave: boolean;
    debugMode: boolean;
}

// ============================================================================
// 🔧 统一错误处理系统 - 解决各组件错误处理格式不一致问题
// ============================================================================

/**
 * 统一的工具执行结果接口 - v1.0
 * 
 * 设计原则：
 * - 一致性：所有工具执行都使用相同的结果格式
 * - 完整性：包含执行成功/失败、结果数据、错误信息、元数据
 * - 可追踪性：记录执行时间和时间戳，便于调试和性能分析
 * - 可扩展性：支持未来添加更多元数据字段
 */
export interface ToolExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
    metadata?: {
        toolName: string;
        executionTime: number;      // 执行时长(ms)
        timestamp: string;          // ISO 8601格式时间戳
        args?: any;                 // 执行参数(可选，用于调试)
        retryCount?: number;        // 重试次数(可选)
        version?: string;           // 工具版本(可选)
    };
}

/**
 * 批量操作结果接口
 */
export interface BatchExecutionResult {
    overall: {
        success: boolean;
        totalCount: number;
        successCount: number;
        failedCount: number;
        executionTime: number;
        timestamp: string;
    };
    results: ToolExecutionResult[];
    summary?: string;
}

/**
 * 错误详情接口 - 增强版
 */
export interface ErrorDetail {
    code: string;                   // 错误代码
    message: string;                // 用户友好的错误消息
    details?: string;               // 技术详情(可选)
    context?: any;                  // 错误上下文(可选)
    timestamp: string;              // 错误发生时间
    source: string;                 // 错误源组件
}

 /**
  * 统一的操作结果接口 - 用于文件、网络等操作
  */
 export interface OperationResult<T = any> {
     success: boolean;
     data?: T;
     error?: ErrorDetail;
     metadata?: {
         operationType: string;      // 操作类型
         executionTime: number;
         timestamp: string;
         resource?: string;          // 操作的资源标识(文件路径、URL等)
     };
 }

 // ============================================================================
 // 📋 现有接口迁移指南和兼容性辅助工具
 // ============================================================================

 /**
  * 迁移指南：
  * 
  * 当前代码中发现的不一致格式：
  * 1. atomicTools: { success: boolean; error?: string }
  * 2. toolExecutor: { valid: boolean; errors?: string[] } 
  * 3. markdownProcessor: { isValid: boolean; errors: string[] }
  * 4. requirementTools: { success: boolean; message: string; requirementId?: string }
  * 
  * 建议迁移顺序：
  * 1. 新开发的工具和函数直接使用 ToolExecutionResult
  * 2. 对现有关键路径逐步迁移（如核心工具执行）
  * 3. 保持向后兼容性，旧接口可以与新接口并存
  * 
  * 迁移示例：
  * // 旧格式
  * return { success: false, error: "File not found" };
  * 
  * // 新格式  
  * return {
  *   success: false,
  *   error: "File not found",
  *   metadata: {
  *     toolName: "readFile",
  *     executionTime: Date.now() - startTime,
  *     timestamp: new Date().toISOString()
  *   }
  * };
  */

 /**
  * 辅助函数：将旧格式转换为新格式
  */
 export function createToolExecutionResult(
     success: boolean,
     toolName: string,
     result?: any,
     error?: string,
     executionStartTime?: number,
     additionalMetadata?: any
 ): ToolExecutionResult {
     const timestamp = new Date().toISOString();
     const executionTime = executionStartTime ? Date.now() - executionStartTime : 0;
     
     return {
         success,
         result,
         error,
         metadata: {
             toolName,
             executionTime,
             timestamp,
             ...additionalMetadata
         }
     };
 }

 /**
  * 辅助函数：将旧的简单错误格式转换为统一格式
  */
 export function createErrorDetail(
     code: string,
     message: string,
     source: string,
     details?: string,
     context?: any
 ): ErrorDetail {
     return {
         code,
         message,
         details,
         context,
         timestamp: new Date().toISOString(),
         source
     };
 }

 /**
  * 常用错误代码枚举
  */
 export const ErrorCodes = {
     // 文件操作错误
     FILE_NOT_FOUND: 'FILE_NOT_FOUND',
     FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',
     FILE_WRITE_FAILED: 'FILE_WRITE_FAILED',
     
     // 网络错误
     NETWORK_ERROR: 'NETWORK_ERROR',
     TIMEOUT: 'TIMEOUT',
     
     // 工具执行错误
     TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
     INVALID_PARAMETERS: 'INVALID_PARAMETERS',
     EXECUTION_FAILED: 'EXECUTION_FAILED',
     
     // AI相关错误
     AI_MODEL_ERROR: 'AI_MODEL_ERROR',
     CONTEXT_TOO_LARGE: 'CONTEXT_TOO_LARGE',
     
     // 系统错误
     UNKNOWN_ERROR: 'UNKNOWN_ERROR',
     CONFIGURATION_ERROR: 'CONFIGURATION_ERROR'
 } as const;

 export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
