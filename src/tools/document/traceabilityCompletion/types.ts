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
 * SRS-YAML ID一致性验证结果
 */
export interface ConsistencyValidationResult {
  consistent: boolean;
  srsIds: string[];
  yamlIds: string[];
  missingInYaml: string[];
  missingInSrs: string[];
  statistics: {
    srsTotal: number;
    yamlTotal: number;
    consistent: boolean;
    byType: Record<string, {srs: number, yaml: number, missing: number}>;
  };
  executionTime: number;
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
    consistencyValidated?: boolean;     // 新增：是否执行了一致性验证
  };
  consistencyResult?: ConsistencyValidationResult;  // 新增：一致性验证结果
  danglingReferences?: string[];
  error?: string;
}

/**
 * 追溯完成器参数
 */
export interface TraceabilityCompletionArgs {
  summary: string;
  targetFile: string;
  srsFile?: string;  // 新增：SRS.md文件路径，默认 "SRS.md"
}

/**
 * YAML文件结构 (requirements.yaml的预期结构)
 * 支持 Dictionary 结构（推荐）和 Array 结构（向后兼容）
 */
export interface RequirementsYAMLStructure {
  business_objectives?: RequirementEntity[] | Record<string, RequirementEntity>;
  business_requirements?: RequirementEntity[] | Record<string, RequirementEntity>;
  business_rules?: RequirementEntity[] | Record<string, RequirementEntity>;
  user_stories?: RequirementEntity[] | Record<string, RequirementEntity>;
  use_cases?: RequirementEntity[] | Record<string, RequirementEntity>;
  functional_requirements?: RequirementEntity[] | Record<string, RequirementEntity>;
  non_functional_requirements?: RequirementEntity[] | Record<string, RequirementEntity>;
  interface_requirements?: RequirementEntity[] | Record<string, RequirementEntity>;
  data_requirements?: RequirementEntity[] | Record<string, RequirementEntity>;
  assumptions?: RequirementEntity[] | Record<string, RequirementEntity>;
  dependencies?: RequirementEntity[] | Record<string, RequirementEntity>;
  constraints?: RequirementEntity[] | Record<string, RequirementEntity>;
  risk_analysis?: RequirementEntity[] | Record<string, RequirementEntity>;
  // 注意：测试相关实体（test_levels, test_types, test_environments, test_cases）不在 SRS 范围内
  // 测试策略和测试用例应该在独立的测试文档中管理（遵循 IEEE 829 标准）
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