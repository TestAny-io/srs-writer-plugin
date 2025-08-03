/**
 * Specialist动态注册系统类型定义
 * 
 * 🚀 重构目标：实现可配置的specialist注册机制
 * 类似于ToolRegistry的架构，但专门针对specialist管理
 */

/**
 * Specialist配置定义
 */
export interface SpecialistConfig {
  // 🔑 核心注册字段
  enabled: boolean;                           // 是否启用这个specialist
  id: string;                                 // specialist唯一标识符
  name: string;                               // 显示名称
  category: 'content' | 'process';            // 类别
  version?: string;                           // 版本号
  
  // 📋 描述信息
  description?: string;                       // 功能描述
  author?: string;                            // 开发者信息
  
  // 🛠️ 能力配置
  capabilities?: string[];                    // 支持的能力标签
  
  // 🎯 迭代配置
  iteration_config?: {
    max_iterations?: number;                  // 最大迭代次数
    default_iterations?: number;              // 默认迭代次数
  };
  
  // 🎨 模版配置
  template_config?: {
    include_base?: string[];                  // 要包含的base模版
    exclude_base?: string[];                  // 要排除的base模版
  };
  
  // 🏷️ 标签和分类
  tags?: string[];                            // 分类标签
}

/**
 * 完整的Specialist定义
 */
export interface SpecialistDefinition {
  // 基础配置
  config: SpecialistConfig;
  
  // 文件信息
  filePath: string;                           // 规则文件路径
  fileName: string;                           // 文件名
  lastModified: number;                       // 最后修改时间
  
  // 模板组装配置 (向后兼容)
  assemblyConfig?: {
    include_base?: string[];
    exclude_base?: string[];
    specialist_type?: string;
    specialist_name?: string;
    role_definition?: string;
  };
  
  // 规则内容
  ruleContent: string;                        // 去除YAML头部后的规则内容
}

/**
 * Specialist注册表统计信息
 */
export interface SpecialistRegistryStats {
  totalSpecialists: number;
  enabledSpecialists: number;
  disabledSpecialists: number;
  byCategory: {
    content: number;
    process: number;
  };
  byVersion: { [version: string]: number };
  lastScanTime: number;
  scanDuration: number;
}

/**
 * 文件扫描结果
 */
export interface SpecialistScanResult {
  foundFiles: string[];
  validSpecialists: SpecialistDefinition[];
  invalidFiles: Array<{
    filePath: string;
    error: string;
  }>;
  scanStats: {
    totalFiles: number;
    validFiles: number;
    invalidFiles: number;
    scanTime: number;
  };
}

/**
 * Specialist查询选项
 */
export interface SpecialistQueryOptions {
  enabled?: boolean;                          // 只返回启用的specialist
  category?: 'content' | 'process';          // 按类别过滤
  capabilities?: string[];                    // 必须包含的能力
  tags?: string[];                            // 必须包含的标签
}

/**
 * Specialist验证结果
 */
export interface SpecialistValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config?: SpecialistConfig;
}