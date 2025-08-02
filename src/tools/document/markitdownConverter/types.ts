/**
 * MarkItDown 转换器类型定义
 * 定义了文档转换相关的所有接口和类型
 */

/**
 * 文档信息接口
 */
export interface DocumentInfo {
    /** 文件名 */
    name: string;
    /** 相对于workspace的路径 */
    path: string;
    /** 绝对路径 */
    absolutePath: string;
    /** 文件扩展名 */
    extension: string;
    /** 文件大小（字节） */
    size: number;
    /** 最后修改时间戳 */
    lastModified: number;
    /** 文件所在目录 */
    directory: string;
}

/**
 * 转换选项接口
 */
export interface ConvertOptions {
    /** 输出文件路径（可选，不指定则自动生成） */
    outputPath?: string;
    /** 是否启用YouTube转录（用于视频链接） */
    enableYoutubeTranscript?: boolean;
    /** YouTube转录语言 */
    youtubeTranscriptLanguage?: string;
    /** LLM模型配置（用于图片描述） */
    llmModel?: any;
    /** LLM提示词 */
    llmPrompt?: string;
    /** 是否保留原始文件 */
    preserveOriginal?: boolean;
    /** 是否进行后处理清理 */
    postProcess?: boolean;
    /** 是否清理提取的临时文件 */
    cleanup_extracted?: boolean;
}

/**
 * 转换元数据接口
 */
export interface ConversionMetadata {
    /** 原始文件大小（字节） */
    fileSize: number;
    /** 转换耗时（毫秒） */
    conversionTime: number;
    /** 检测到的文件格式 */
    detectedFormat: string;
    /** 转换后内容长度（字符数） */
    contentLength: number;
    /** 转换时间戳 */
    timestamp: string;
    /** 支持的格式检查结果 */
    isSupported: boolean;
}

/**
 * 转换结果接口
 */
export interface ConvertResult {
    /** 转换是否成功 */
    success: boolean;
    /** 文档标题（可能为空） */
    title: string | null;
    /** 转换后的Markdown内容 */
    markdownContent: string;
    /** 原始文件路径 */
    originalPath: string;
    /** 输出文件路径 */
    outputPath?: string;
    /** 转换元数据 */
    metadata: ConversionMetadata;
    /** 错误信息（转换失败时） */
    error?: string;
}

/**
 * 批量转换选项接口
 */
export interface BatchConvertOptions {
    /** 要包含的文件扩展名列表 */
    fileExtensions: string[];
    /** 输出目录 */
    outputDirectory: string;
    /** 最大并发转换数 */
    maxConcurrent?: number;
    /** 进度回调函数 */
    onProgress?: (current: number, total: number, currentFile: string) => void;
    /** 是否覆盖已存在的文件 */
    overwriteExisting?: boolean;
}

/**
 * 批量转换结果接口
 */
export interface BatchConvertResult {
    /** 输入文件路径 */
    inputFile: string;
    /** 输出文件路径 */
    outputFile: string;
    /** 是否成功 */
    success: boolean;
    /** 错误信息（失败时） */
    error?: string;
    /** 转换元数据 */
    metadata?: ConversionMetadata;
}

/**
 * 文档扫描选项接口
 */
export interface ScanOptions {
    /** 要扫描的文件扩展名 */
    extensions: string[];
    /** 最大扫描深度 */
    maxDepth: number;
    /** 排除的目录名称 */
    excludeDirectories: string[];
    /** 是否包含隐藏文件 */
    includeHidden: boolean;
}

/**
 * 文档扫描结果接口
 */
export interface ScanResult {
    /** 扫描是否成功 */
    success: boolean;
    /** 找到的文档列表 */
    documents: DocumentInfo[];
    /** 文档总数 */
    totalCount: number;
    /** 扫描的目录数 */
    directoriesScanned: number;
    /** 扫描耗时（毫秒） */
    scanTime: number;
    /** 错误信息（失败时） */
    error?: string;
}

/**
 * 支持的文件格式配置
 */
export interface SupportedFormats {
    /** 已实现的格式 */
    implemented: string[];
    /** 计划中的格式 */
    planned: string[];
    /** 需要额外依赖的格式 */
    requiresExtraDeps: Record<string, string[]>;
}

/**
 * 转换器配置接口
 */
export interface ConverterConfig {
    /** 默认输出目录 */
    defaultOutputDir: string;
    /** 最大文件大小限制（字节） */
    maxFileSize: number;
    /** 支持的格式配置 */
    supportedFormats: SupportedFormats;
    /** 是否启用调试日志 */
    enableDebugLog: boolean;
    /** 临时文件目录 */
    tempDirectory: string;
}

/**
 * 用户界面选项接口
 */
export interface UIQuickPickItem {
    /** 显示标签 */
    label: string;
    /** 描述文本 */
    description: string;
    /** 详细信息 */
    detail: string;
    /** 关联的文档信息 */
    document: DocumentInfo;
}

/**
 * 进度报告接口
 */
export interface ProgressReport {
    /** 当前步骤 */
    step: string;
    /** 进度百分比 (0-100) */
    percentage: number;
    /** 当前处理的文件 */
    currentFile?: string;
    /** 已完成数量 */
    completed: number;
    /** 总数量 */
    total: number;
}

/**
 * 错误类型枚举
 */
export enum ConverterErrorType {
    /** 文件不存在 */
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    /** 不支持的格式 */
    UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
    /** 文件过大 */
    FILE_TOO_LARGE = 'FILE_TOO_LARGE',
    /** 转换失败 */
    CONVERSION_FAILED = 'CONVERSION_FAILED',
    /** 权限不足 */
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    /** 网络错误 */
    NETWORK_ERROR = 'NETWORK_ERROR',
    /** 配置错误 */
    CONFIG_ERROR = 'CONFIG_ERROR'
}

/**
 * 转换器错误类
 */
export class ConverterError extends Error {
    constructor(
        public type: ConverterErrorType,
        message: string,
        public filePath?: string,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'ConverterError';
    }
}