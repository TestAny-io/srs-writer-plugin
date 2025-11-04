/**
 * YAML编辑器类型定义
 * 复用scaffoldGenerator的错误处理类型，扩展新的YAML编辑功能
 */

// 🚀 真正复用：直接导入scaffoldGenerator的类型，不复制代码
export { ScaffoldError, ScaffoldErrorType } from '../scaffoldGenerator/types';

/**
 * YAML结构分析结果
 */
export interface YAMLStructure {
    keyPaths: string[];                     // 所有可编辑的键路径列表
    keyTypes: Record<string, string>;       // 键路径对应的数据类型
    depth: number;                          // 最大嵌套深度
    totalKeys: number;                      // 总键数量
}

/**
 * YAML解析模式
 * - structure: 仅返回结构信息（键路径、类型、深度），不返回实际内容
 * - content: 返回完整内容和解析后的数据，不返回结构信息
 * - full: 返回所有信息（内容 + 数据 + 结构）
 */
export type ParseMode = 'structure' | 'content' | 'full';

/**
 * 目标提取请求
 */
export interface TargetRequest {
    type: 'keyPath';                       // 目标类型（目前仅支持keyPath）
    path: string;                          // 要提取的键路径（如 "functional_requirements.0.title"）
    maxDepth?: number;                     // 对于对象/数组值，分析的最大深度（默认：5）
}

/**
 * 目标提取结果
 */
export interface TargetResult {
    type: 'keyPath';                       // 结果类型
    path: string;                          // 键路径
    success: boolean;                      // 是否成功提取
    value?: any;                           // 提取的值
    valueType?: string;                    // 值的类型
    structure?: YAMLStructure;             // 如果值是对象/数组，其结构信息
    error?: {
        message: string;
        details?: string;
    };
}

/**
 * YAML读取参数
 */
export interface ReadYAMLArgs {
    path: string;                           // YAML文件路径（相对于工作区根目录）
    parseMode?: ParseMode;                  // 解析模式（默认：'content'）
    targets?: TargetRequest[];              // 目标提取列表（指定后忽略parseMode）
    includeStructure?: boolean;             // [已废弃] 是否包含结构信息（使用parseMode替代）
    maxDepth?: number;                      // 结构分析的最大深度（默认：5）
}

/**
 * YAML读取结果
 */
export interface ReadYAMLResult {
    success: boolean;
    content: string;                        // 原始YAML内容（parseMode='structure'时为空）
    parsedData?: any;                       // 解析后的JavaScript对象（parseMode='structure'时不返回）
    structure?: YAMLStructure;              // YAML结构信息（parseMode='content'时不返回）
    targets?: TargetResult[];               // 目标提取结果（指定targets参数时返回）
    error?: string;
}

/**
 * YAML编辑操作
 */
export interface YAMLEditOperation {
    type: 'set' | 'delete' | 'append';     // 操作类型：设置值、删除键或向数组追加元素
    keyPath: string;                       // 点分隔的键路径
    value?: any;                           // 新值（delete操作不需要）
    valueType?: 'string' | 'number' | 'boolean' | 'array' | 'object'; // 值类型提示
    reason: string;                        // 操作原因
}

/**
 * YAML编辑参数
 */
export interface ExecuteYAMLEditsArgs {
    targetFile: string;                    // 目标YAML文件路径
    edits: YAMLEditOperation[];            // 编辑操作数组
    createBackup?: boolean;                // 是否创建备份（默认：false）
}

/**
 * YAML编辑结果
 */
export interface ExecuteYAMLEditsResult {
    success: boolean;
    appliedEdits: YAMLEditOperation[];     // 成功应用的操作
    failedEdits: YAMLEditOperation[];      // 失败的操作
    backupPath?: string;                   // 备份文件路径（如果创建了备份）
    error?: string;
    metadata?: {
        totalOperations: number;
        executionTime: number;
        fileSize: number;
    };
}

/**
 * YAML编辑选项
 */
export interface YAMLEditOptions {
    createBackup: boolean;
    validateAfterEdit: boolean;
} 