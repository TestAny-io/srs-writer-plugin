/**
 * Semantic Editing Types - 语义编辑类型定义
 * 
 * 定义语义编辑系统的所有接口和类型，
 * 支持基于VSCode原生API的精确文档编辑
 * 
 * 重构后的架构：
 * - 4种操作类型：replace_section_and_title, replace_section_content_only, insert_section_and_title, insert_section_content_only
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
 * 
 * 🎯 命名规则：
 * - *_and_title: 操作包含标题（content 必须包含完整标题）
 * - *_content_only: 操作仅针对内容（content 不应包含标题）
 */
export type SemanticEditType = 
    | 'replace_section_and_title'      // 替换整个章节(包括标题) - content MUST include title
    | 'replace_section_content_only'   // 替换章节内特定内容(不含标题) - content must NOT include title
    | 'insert_section_and_title'       // 插入整个章节(包括标题) - content MUST include title
    | 'insert_section_content_only';   // 插入内容到章节内(不含标题) - content must NOT include title

/**
 * 插入位置枚举 - 🔄 简化：只用于 insert_section_and_title
 */
export type InsertionPosition = 
    | 'before'    // 在参照章节之前插入
    | 'after';    // 在参照章节之后插入

/**
 * 语义目标定位接口 - 🔄 简化字段依赖关系
 * 
 * 字段使用规则：
 * - replace_section_and_title: 只需 sid
 * - replace_section_content_only: sid + lineRange (必需)
 * - insert_section_and_title: sid + insertionPosition (必需)
 * - insert_section_content_only: sid + lineRange (必需)
 */
export interface SemanticTarget {
    sid: string;                            // Section ID，来自 readMarkdownFile（必需）
    
    // 🔄 条件必需：用于行级别操作
    lineRange?: {
        startLine: number;                  // 目标起始行号（章节内相对行号，1-based，Line 1 = 章节标题后第一行内容）
        endLine: number;                    // 目标结束行号（章节内相对行号，1-based，必需避免歧义）
    };
    
    // 🔄 条件必需：用于整章节插入
    insertionPosition?: InsertionPosition;  // 插入位置：'before' | 'after'
    
    // 🔄 高级定位（可选）
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
 * 语义编辑结果接口 - 🆕 支持多intents智能处理
 */
export interface SemanticEditResult {
    success: boolean;                       // 是否有任何操作成功
    totalIntents: number;                   // 总intent数
    successfulIntents: number;              // 成功的intent数
    appliedIntents: AppliedIntent[];        // 成功执行的操作详情
    failedIntents: FailedIntent[];          // 失败的操作详情
    warnings?: IntentWarning[];             // 警告信息（如自动调整）
    metadata?: {
        executionTime: number;              // 执行时间（毫秒）
        timestamp: string;                  // 时间戳
        astNodeCount?: number;              // AST节点数量
        documentLength?: number;            // 文档长度
    };
}

/**
 * 成功应用的intent详情
 */
export interface AppliedIntent {
    originalIntent: SemanticEditIntent;
    adjustedIntent?: SemanticEditIntent;    // 如果有自动调整
    adjustmentReason?: string;              // 调整原因
    executionOrder: number;                 // 实际执行顺序
}

/**
 * 失败的intent详情
 */
export interface FailedIntent {
    originalIntent: SemanticEditIntent;
    error: string;                          // 失败原因
    suggestion?: string;                    // 修复建议
    canRetry: boolean;                      // 是否可以重试
}

/**
 * Intent警告信息
 */
export interface IntentWarning {
    intent: SemanticEditIntent;
    warningType: 'AUTO_ADJUSTED' | 'POTENTIAL_CONFLICT' | 'PERFORMANCE_IMPACT';
    message: string;
    details?: any;
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
 * 定位结果接口 - 🆕 基于sid的增强定位
 */
export interface LocationResult {
    found: boolean;                 // 是否找到目标
    range?: vscode.Range;           // 目标范围（用于替换操作）
    insertionPoint?: vscode.Position; // 插入点（用于插入操作）
    operationType?: 'replace' | 'insert'; // 操作类型
    context?: {
        sectionTitle?: string;      // 章节标题
        targetLines?: string[];     // 目标行内容
        lineRange?: { startLine: number; endLine: number }; // 行号范围
        // 🚀 新增：相对行号到绝对行号的转换信息
        relativeToAbsolute?: {
            sectionRelativeStart: number;   // 章节内相对起始行号
            sectionRelativeEnd: number;     // 章节内相对结束行号
            documentAbsoluteStart: number;  // 文档绝对起始行号
            documentAbsoluteEnd: number;    // 文档绝对结束行号
        };
        // 🚀 新增：插入操作的行号信息
        sectionRelativeInsertLine?: number;  // 章节内相对插入行号
        documentAbsoluteInsertLine?: number; // 文档绝对插入行号
        // 🚀 新增：替换操作的标识信息
        includesTitle?: boolean;             // 是否包含章节标题（用于replace_section_and_title）
    };
    error?: string;                 // 错误信息
    suggestions?: {
        availableSids?: string[];   // 可用的 sid 列表
        similarSids?: string[];     // 相似的 sid
        autoFix?: SemanticTarget;   // 自动修复建议
        validRange?: string;        // 有效行号范围
        nearbyLines?: LineInfo[];   // 附近行信息
        // 🆕 Phase 2: 新增的建议字段
        correctedSid?: string;      // 修正后的 SID
        correctedLineRange?: { startLine: number; endLine?: number }; // 修正后的行号范围
        hint?: string;              // 提示信息
        sectionSummary?: {          // 章节摘要信息
            title?: string;
            totalLines?: number;
            totalContentLines?: number;  // 章节内容行数（不包括标题）
            availableRange?: string;
        };
        // 🔄 新增字段：字段验证建议
        availablePositions?: string[];  // 可用的插入位置
        availableTypes?: string[];      // 可用的操作类型
        sectionPreview?: string;        // 章节内容预览（用于相对行号参考）
    };
}

/**
 * 行信息接口
 */
export interface LineInfo {
    lineNumber: number;             // 行号
    content: string;                // 行内容
    isTarget: boolean;              // 是否为目标行
}

/**
 * 基于sid的编辑错误
 */
export interface SidBasedEditError {
    code: 'SID_NOT_FOUND' | 'INVALID_SID_FORMAT' | 'LINE_OUT_OF_RANGE' | 'VALIDATION_FAILED' | 'INTERNAL_ERROR';
    message: string;
    targetSid: string;
    targetLine?: number;            // 如果是行号相关错误
    suggestions: {
        availableSids: string[];
        similarSids: string[];
        correctionHint?: string;
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
    | { type: 'replace_section_and_title'; target: SemanticTarget; content: string; }
    | { type: 'replace_section_content_only'; target: SemanticTarget; content: string; }
    | { type: 'insert_section_and_title'; target: SemanticTarget; content: string; }
    | { type: 'insert_section_content_only'; target: SemanticTarget; content: string; };

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