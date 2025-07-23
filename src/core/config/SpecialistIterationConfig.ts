/**
 * Specialist迭代限制配置系统
 * 
 * 支持：
 * 1. 按specialist类型设置默认迭代限制
 * 2. 按特定specialist ID设置个性化限制
 * 3. 动态配置管理
 */

export type SpecialistCategory = 'content' | 'process';

/**
 * Specialist迭代配置接口
 */
export interface SpecialistIterationConfig {
    /** 默认类别配置 */
    categoryDefaults: {
        [K in SpecialistCategory]: number;
    };
    
    /** 特定specialist的个性化配置 */
    specialistOverrides: {
        [specialistId: string]: number;
    };
    
    /** 全局默认值（当specialist无法分类时使用） */
    globalDefault: number;
}

/**
 * 默认配置
 */
export const DEFAULT_SPECIALIST_ITERATION_CONFIG: SpecialistIterationConfig = {
    categoryDefaults: {
        content: 15,  // 内容specialist需要更多轮数来完善内容质量
        process: 8    // 流程specialist通常比较确定，较少轮数即可
    },
    
    specialistOverrides: {
        // 内容类specialist的具体配置
        'fr_writer': 10,           
        'nfr_writer': 10,          
        'overall_description_writer': 10, 
        'user_journey_writer': 10, 
        'summary_writer': 10,       
        'prototype_designer': 20,  // 原型设计最复杂，需要最多轮数
        
        // 流程类specialist的具体配置
        'project_initializer': 3,  // 项目初始化相对简单
        'git_operator': 10,         // Git操作通常确定性强
        'document_formatter': 5,   // 文档格式化中等复杂度
        'requirement_syncer': 30,  // 需求同步可能需要更多轮数
        
        // 辅助类specialist
        'help_response': 3,        // 帮助响应简单
    },
    
    globalDefault: 10  // 当specialist无法识别时的默认值
};

/**
 * Specialist分类映射
 * 用于将specialist ID映射到类别
 */
export const SPECIALIST_CATEGORY_MAPPING: { [specialistId: string]: SpecialistCategory } = {
    // 内容类specialists
    'fr_writer': 'content',
    'nfr_writer': 'content', 
    'overall_description_writer': 'content',
    'user_journey_writer': 'content',
    'summary_writer': 'content',
    'prototype_designer': 'content',
    
    // 流程类specialists
    'project_initializer': 'process',
    'git_operator': 'process',
    'document_formatter': 'process', 
    'requirement_syncer': 'process',
    
    // 可以根据需要扩展更多specialist
}; 