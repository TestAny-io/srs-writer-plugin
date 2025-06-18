/**
 * 插件相关常量
 */
export const PLUGIN_NAME = 'srs-writer-plugin';
export const PLUGIN_DISPLAY_NAME = 'SRS Writer Plugin';

/**
 * 命令常量
 */
export const COMMANDS = {
    START_CHAT: 'srs-writer.startChat',
    GENERATE_SRS: 'srs-writer.generateSRS',
} as const;

/**
 * 聊天参与者常量
 */
export const CHAT_PARTICIPANT_ID = 'srs-writer';

/**
 * 文件扩展名常量
 */
export const FILE_EXTENSIONS = {
    MARKDOWN: '.md',
    YAML: '.yml',
    JSON: '.json',
} as const;

/**
 * SRS模板常量
 */
export const SRS_SECTIONS = {
    INTRODUCTION: 'introduction',
    GENERAL_DESCRIPTION: 'general-description',
    FUNCTIONAL_REQUIREMENTS: 'functional-requirements',
    NON_FUNCTIONAL_REQUIREMENTS: 'non-functional-requirements',
    SYSTEM_FEATURES: 'system-features',
    EXTERNAL_INTERFACES: 'external-interfaces',
    APPENDICES: 'appendices',
} as const;

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
    AI_PROVIDER: 'openai',
    DEFAULT_LANGUAGE: 'zh-CN',
    OUTPUT_FORMAT: 'yaml',
    MAX_TOKENS: 4000,
    TEMPERATURE: 0.7,
    AUTO_SAVE: true,
    DEBUG_MODE: false,
} as const;

/**
 * API相关常量
 */
export const API = {
    TIMEOUT: 30000,
    RETRY_COUNT: 3,
    RETRY_DELAY: 1000,
} as const;

/**
 * 日志级别常量
 */
export const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
} as const;

/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
    API_KEY_MISSING: 'API密钥未配置',
    INVALID_FILE_FORMAT: '不支持的文件格式',
    PARSE_ERROR: '解析错误',
    NETWORK_ERROR: '网络连接错误',
    FILE_NOT_FOUND: '文件不存在',
    PERMISSION_DENIED: '权限不足',
} as const; 