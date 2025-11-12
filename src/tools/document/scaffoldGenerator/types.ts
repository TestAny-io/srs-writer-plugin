/**
 * 需求脚手架生成器类型定义
 * 用于ID解析、Schema加载和YAML生成的核心类型
 *
 * ⚠️ SHARED CODE - 保留原因 (2025-11-12):
 * 此文件虽位于 scaffoldGenerator/ 目录，但提供了跨工具系统共享的核心类型：
 *
 * 1. ScaffoldError & ScaffoldErrorType - 被 11+ 个文件使用：
 *    - yamlEditor/types.ts (re-export) → executeYAMLEdits 使用
 *    - syntaxChecker/types.ts (re-export) → 语法检查工具使用
 *    - traceabilityCompletion/types.ts (re-export) → 追溯性工具使用
 *    - 以及 YAMLChecker, SyntaxChecker, MarkdownChecker, QualityReportWriter 等
 *
 * 2. ExtractedId & IdStatistics - 被 IDParser 使用：
 *    - IDParser.ts (此目录下的共享代码)
 *    - traceabilityCompletion/SRSConsistencyValidator.ts (间接使用)
 *
 * 3. 已删除的类型（仅被 requirementScaffoldTool 使用）：
 *    - GenerateScaffoldParams, GenerateResult, GenerateOptions
 *    - SchemaConfig, EntitySchema 等 Schema 相关类型
 *    → 这些类型在 requirementScaffoldTool 删除后可以考虑清理
 *
 * 删除历史：requirementScaffoldTool 已于 2025-11-12 删除，但保留此共享类型定义。
 *
 * 相关文件：
 * - 使用方：yamlEditor/types.ts, syntaxChecker/types.ts, traceabilityCompletion/types.ts
 * - 使用方：IDParser.ts (本目录共享代码)
 */

// 提取的ID信息
export interface ExtractedId {
    id: string;                    // 完整的ID，如 "US-LOGIN-001", "ADC-ASSU-001", "RISK-001", "TEST-LEVEL-001"
    type: 'basic' | 'adc' | 'risk' | 'test';  // ID类型：基础实体、ADC复合实体、风险分析或测试项
    prefix: string;               // 前缀，如 "US", "FR", "ADC", "RISK", "TEST"
    subType?: string;             // 子类型：ADC子类型（"ASSU", "DEPEN", "CONST"）或TEST子类型（"LEVEL", "TYPE", "ENV"）
    fullMatch: string;            // 正则匹配的完整字符串
}

// Schema配置结构
export interface SchemaConfig {
    version: string;
    last_updated: string;
    compatible_versions: string[];
    description: string;
    metadata_template: Record<string, any>;
    entity_mappings: Record<string, EntitySchema>;
    adc_mappings: Record<string, EntitySchema>;
    test_mappings?: Record<string, EntitySchema>;  // 可选：测试项映射
    entity_output_order: string[];
    enums: Record<string, string[]>;
}

// 实体Schema定义
export interface EntitySchema {
    yaml_key: string;             // YAML输出键名，如 "user_stories"
    description: string;          // 实体描述
    template: Record<string, any>; // 字段模板
}

// YAML生成选项
export interface GenerateOptions {
    extractedIds: ExtractedId[];  // 提取的ID列表
    schemas: SchemaConfig;        // Schema配置
    includeMetadata: boolean;     // 是否包含元数据
}

// 生成结果
export interface GenerateResult {
    success: boolean;
    result?: {
        outputPath: string;       // 输出文件路径
        generatedIds: number;     // 生成的ID数量
        scaffoldSections: number; // 脚手架章节数量
        metadata?: any;           // 生成的元数据
    };
    error?: string;               // 错误信息
}

// 工具参数
export interface GenerateScaffoldParams {
    srsFilePath: string;          // SRS.md文件路径
    scaffoldDir?: string;         // 输出目录
    includeMetadata?: boolean;    // 是否包含元数据
}

// ID解析统计
export interface IdStatistics {
    totalIds: number;
    byType: Record<string, number>;
    duplicates: string[];
    malformed: string[];
}

// 错误类型
export enum ScaffoldErrorType {
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    INVALID_SRS_FORMAT = 'INVALID_SRS_FORMAT',
    SCHEMA_LOAD_FAILED = 'SCHEMA_LOAD_FAILED',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    OUTPUT_WRITE_FAILED = 'OUTPUT_WRITE_FAILED',
    VERSION_INCOMPATIBLE = 'VERSION_INCOMPATIBLE',
    ID_PARSING_FAILED = 'ID_PARSING_FAILED'
}

// 自定义错误类
export class ScaffoldError extends Error {
    constructor(
        public type: ScaffoldErrorType,
        public message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'ScaffoldError';
    }
} 