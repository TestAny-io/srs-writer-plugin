/**
 * v1.2 双向同步相关类型定义
 */

import { SessionContext } from './session';

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
 * 解析器模块的接口 - v1.0 (最终版)
 */
export interface ISRSParser {
  /**
   * 解析母文档，生成所有最终文件。
   * 必须实现"优雅降级"：即使部分内容解析失败，也应尽力返回成功解析的部分，
   * 并将错误信息包含在返回结果的'writer_log.json'中。
   * @param motherDocumentContent AI生成的母文档字符串
   * @param options 解析选项，用于未来扩展
   * @returns Promise<ParsedArtifacts> 包含所有成功生成的文件和日志的对象
   */
  parse(motherDocumentContent: string, options?: ParseOptions): Promise<ParsedArtifacts>;

  /**
   * 为未来的Web Worker实现预留的异步接口。
   * MVP阶段无需实现此方法。
   */
  parseAsync?(motherDocumentContent: string, options?: ParseOptions): Promise<ParsedArtifacts>;
}

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
