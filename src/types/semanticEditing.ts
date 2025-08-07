/**
 * Semantic Editing Types - 语义编辑类型定义
 * 
 * 定义语义编辑系统的所有接口和类型，
 * 支持基于VSCode原生API的精确文档编辑
 * 
 * 重构后的架构：
 * - 4种操作类型：replace_entire_section_with_title, replace_lines_in_section, insert_entire_section, insert_lines_in_section
 * - 核心字段：sectionName, startFromAnchor, targetContent, insertionPosition
 * - startFromAnchor为必需字段，提供精确定位
 * - 搜索范围：前向5行，提高定位精度
 */

import * as vscode from 'vscode';

// ============================================================================
// 核心语义编辑类型
// ============================================================================

/**
 * 语义编辑意图类型枚举
 */
export type SemanticEditType = 
    | 'replace_entire_section_with_title'     // 替换整个章节(包括标题)
    | 'replace_lines_in_section'   // 替换章节内特定内容
    | 'insert_entire_section'      // 插入整个章节
    | 'insert_lines_in_section';   // 插入内容到章节内

/**
 * 插入位置枚举
 */
export type InsertionPosition = 
    | 'before'    // 在参照章节之前插入
    | 'after'     // 在参照章节之后插入
    | 'inside';   // 在参照章节内部插入

/**
 * 语义目标定位接口 - 使用路径数组精确定位
 */
export interface SemanticTarget {
    path: string[];                         // 目标路径数组（required）
    targetContent?: string;                 // 要替换的目标内容（replace_lines_in_section时required）
    insertionPosition?: InsertionPosition;  // 插入位置（insert操作时required）
    
    // 🆕 Phase 2 增强：精确章节定位（当insertionPosition="inside"时使用）
    siblingIndex?: number;                  // 兄弟节点索引 (0-based)
    siblingOperation?: 'before' | 'after'; // 相对于指定兄弟的操作
}

/**
 * 语义编辑意图接口
 */
export interface SemanticEditIntent {
    type: SemanticEditType;     // 编辑类型
    target: SemanticTarget;     // 目标位置
    content: string;            // 编辑内容
    reason: string;             // 编辑原因
    priority: number;           // 优先级（数字越大优先级越高）
    
    // 🆕 Phase 2 增强：验证模式
    validateOnly?: boolean;     // 仅验证，不实际执行编辑
}

/**
 * 语义编辑结果接口
 */
export interface SemanticEditResult {
    success: boolean;                       // 整体是否成功
    appliedIntents: SemanticEditIntent[];   // 成功应用的意图
    failedIntents: SemanticEditIntent[];    // 失败的意图
    error?: string;                         // 主要错误信息
    semanticErrors?: string[];              // 语义特有的错误列表
    metadata?: {
        executionTime: number;              // 执行时间（毫秒）
        timestamp: string;                  // 时间戳
        astNodeCount?: number;              // AST节点数量
        documentLength?: number;            // 文档长度
    };
}

// ============================================================================
// 文档结构分析类型 (🚨 已废弃 - 使用AST-based SemanticLocator)
// ============================================================================

/**
 * 文档结构信息接口
 * @deprecated 已废弃 - SemanticLocator现在直接使用AST，不再需要此接口
 */
export interface DocumentStructure {
    sections: SectionInfo[];                            // 章节信息
    headings: HeadingInfo[];                           // 标题信息
    symbols: vscode.DocumentSymbol[];                  // VSCode原生符号
    symbolMap: Map<string, vscode.DocumentSymbol>;    // 符号映射表
}

/**
 * 章节信息接口
 * @deprecated 已废弃 - SemanticLocator现在直接使用AST，不再需要此接口
 */
export interface SectionInfo {
    name: string;               // 章节名称
    level: number;              // 层级（1, 2, 3...）
    range: vscode.Range;        // VSCode范围对象
    content: string;            // 章节内容
    subsections: SectionInfo[]; // 子章节
    selector: string;           // 语义选择器
}

/**
 * 标题信息接口
 * @deprecated 已废弃 - SemanticLocator现在直接使用AST，不再需要此接口
 */
export interface HeadingInfo {
    level: number;          // 标题级别（1-6）
    text: string;           // 标题文本
    line: number;           // 行号（1-based）
    range: vscode.Range;    // VSCode范围对象
    selector: string;       // 语义选择器
}

/**
 * 定位结果接口
 */
export interface LocationResult {
    found: boolean;                 // 是否找到目标
    range?: vscode.Range;           // 目标范围（用于替换操作）
    insertionPoint?: vscode.Position; // 插入点（用于插入操作）
    context?: {
        beforeText: string;         // 前置文本
        afterText: string;          // 后置文本
        parentSection?: string;     // 父章节名称
    };
}

// ============================================================================
// 增强型文件读取类型
// ============================================================================

/**
 * 结构化文件读取结果接口
 */
export interface StructuredReadFileResult {
    success: boolean;               // 是否成功
    content: string;                // 原始文件内容
    structure?: DocumentStructure;  // 文档结构信息（可选）- 🚨 已废弃
    semanticMap?: SemanticMap;     // 语义映射表（可选）- 🚨 已废弃
    error?: string;                 // 错误信息
}

/**
 * 语义映射表接口
 */
export interface SemanticMap {
    headings: Array<{
        level: number;              // 标题级别
        text: string;               // 标题文本
        selector: string;           // 语义选择器
        anchorBefore: string;       // 前置锚点
        anchorAfter: string;        // 后置锚点
        range: vscode.Range;        // 范围对象
    }>;
    editTargets: Array<{
        name: string;               // 编辑目标名称
        selector: string;           // 语义选择器
        insertionPoints: {
            before: vscode.Position; // 前置插入点
            after: vscode.Position;  // 后置插入点
        };
    }>;
}

// ============================================================================
// 工具定义类型
// ============================================================================

/**
 * 语义编辑工具参数接口
 */
export interface SemanticEditToolArgs {
    intents: SemanticEditIntent[];  // 编辑意图列表
    targetFileUri: vscode.Uri;      // 目标文件URI
}

/**
 * 增强型读取工具参数接口
 */
export interface EnhancedReadFileArgs {
    path: string;                   // 文件路径
    includeStructure?: boolean;     // 是否包含结构分析
    includeSemanticMap?: boolean;   // 是否包含语义映射表
}

// ============================================================================
// 验证和错误处理类型
// ============================================================================

/**
 * 验证结果接口
 */
export interface ValidationResult {
    valid: boolean;         // 是否有效
    errors: string[];       // 错误列表
    warnings?: string[];    // 警告列表（可选）
}

/**
 * 语义编辑错误类型枚举
 */
export enum SemanticEditErrorType {
    TARGET_NOT_FOUND = 'TARGET_NOT_FOUND',           // 目标未找到
    INVALID_INTENT_TYPE = 'INVALID_INTENT_TYPE',     // 无效的意图类型
    MISSING_CONTENT = 'MISSING_CONTENT',             // 缺少内容
    WORKSPACE_EDIT_FAILED = 'WORKSPACE_EDIT_FAILED', // WorkspaceEdit失败
    DOCUMENT_ANALYSIS_FAILED = 'DOCUMENT_ANALYSIS_FAILED', // 文档分析失败
    PERMISSION_DENIED = 'PERMISSION_DENIED'          // 权限拒绝
}

/**
 * 语义编辑错误接口
 */
export interface SemanticEditError {
    type: SemanticEditErrorType;    // 错误类型
    message: string;                // 错误消息
    intent?: SemanticEditIntent;    // 相关的编辑意图
    details?: any;                  // 详细信息
}

// ============================================================================
// 配置和选项类型
// ============================================================================

/**
 * 语义编辑配置接口
 */
export interface SemanticEditConfig {
    enableFuzzyMatching: boolean;       // 启用模糊匹配
    maxRetryAttempts: number;           // 最大重试次数
    enableStructureCache: boolean;      // 启用结构缓存
    debugMode: boolean;                 // 调试模式
}

/**
 * 文档分析选项接口
 */
export interface DocumentAnalysisOptions {
    analyzeHeadings: boolean;           // 分析标题
    analyzeContentBlocks: boolean;      // 分析内容块
    includeLineMap: boolean;            // 包含行映射
    enableSymbolExtraction: boolean;    // 启用符号提取
}

// ============================================================================
// 导出便利类型
// ============================================================================

/**
 * 语义编辑操作联合类型 - 完整版本
 * 支持四种核心操作类型
 */
export type SemanticEditOperation = 
    | { type: 'replace_entire_section_with_title'; target: SemanticTarget; content: string; }
    | { type: 'replace_lines_in_section'; target: SemanticTarget; content: string; }
    | { type: 'insert_entire_section'; target: SemanticTarget; content: string; }
    | { type: 'insert_lines_in_section'; target: SemanticTarget; content: string; };

/**
 * 位置类型联合
 */
export type PositionType = 'before' | 'after' | 'replace' | 'append';

/**
 * 选择器类型联合
 */
export type SelectorType = 
    | `h${number}:section('${string}')`          // 标题选择器
    | `section('${string}')`                      // 章节选择器
    | `h${number}:section('${string}'):before`    // 前置锚点
    | `h${number}:section('${string}'):after`;    // 后置锚点