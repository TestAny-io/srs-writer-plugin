/**
 * 追溯性同步工具类型定义
 * 复用现有的ScaffoldError类型，扩展追溯性计算功能
 */

// 🚀 复用：直接导入scaffoldGenerator的错误类型
export { ScaffoldError, ScaffoldErrorType } from '../scaffoldGenerator/types';

/**
 * 需求实体接口
 */
export interface RequirementEntity {
  id: string;
  source_requirements?: string[];     // 来源需求ID列表
  impacted_requirements?: string[];   // 影响需求ID列表
  derived_fr?: string[];              // [computed] 衍生的技术需求
  ADC_related?: string[];             // [computed] 相关的ADC约束
  [key: string]: any;                 // 其他字段
}

/**
 * 追溯映射表
 */
export interface TraceabilityMap {
  // 正向映射：source_id → 被谁依赖
  sourceToDependent: Map<string, Set<string>>;
  
  // 反向映射：dependent_id → 依赖谁
  dependentToSource: Map<string, Set<string>>;
  
  // ADC映射：技术需求 → 引用的ADC约束
  technicalToADC: Map<string, Set<string>>;
  
  // 悬空引用记录
  danglingReferences: Set<string>;
}

/**
 * 追溯关系同步结果
 */
export interface TraceabilitySyncResult {
  success: boolean;
  stats: {
    entitiesProcessed: number;
    derivedFrAdded: number;
    adcRelatedAdded: number;
    techSpecRelatedAdded: number;
    danglingReferencesFound: number;
    executionTime: number;
  };
  danglingReferences?: string[];
  error?: string;
}

/**
 * 追溯完成器参数
 */
export interface TraceabilityCompletionArgs {
  description: string;
  targetFile: string;
}

/**
 * YAML文件结构 (requirements.yaml的预期结构)
 */
export interface RequirementsYAMLStructure {
  user_stories?: RequirementEntity[];
  use_cases?: RequirementEntity[];
  functional_requirements?: RequirementEntity[];
  non_functional_requirements?: RequirementEntity[];
  interface_requirements?: RequirementEntity[];
  data_requirements?: RequirementEntity[];
  assumptions?: RequirementEntity[];
  dependencies?: RequirementEntity[];
  constraints?: RequirementEntity[];
}

/**
 * 实体统计信息
 */
export interface EntityStatistics {
  totalEntities: number;
  businessRequirements: number;      // US + UC
  technicalRequirements: number;     // FR + NFR + IFR + DAR
  adcConstraints: number;            // ADC-*
  derivedFrFieldsAdded: number;
  adcRelatedFieldsAdded: number;
} 