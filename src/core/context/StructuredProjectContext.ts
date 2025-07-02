/**
 * 结构化项目上下文系统
 * 目标：解决Specialist间的隐性耦合问题，为Phase 2 Memory Interface做准备
 */

// 业务领域定义
export interface BusinessDomain {
  name: string;
  industry: string;
  regulations: string[];
  commonPatterns: string[];
}

// 利益相关者定义
export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  responsibilities: string[];
  influence: 'high' | 'medium' | 'low';
  availability: 'full-time' | 'part-time' | 'on-demand';
}

// 功能特性定义
export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  complexity: 'simple' | 'moderate' | 'complex';
  dependencies: string[];
  estimatedEffort: number; // 工作量估算（小时）
  businessValue: number; // 业务价值评分 1-10
}

// 系统角色定义
export interface SystemRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  workflows: string[];
}

// 约束条件定义
export interface Constraint {
  id: string;
  type: 'technical' | 'business' | 'regulatory' | 'time' | 'budget';
  description: string;
  impact: 'high' | 'medium' | 'low';
  mitigation?: string;
}

// 集成点定义
export interface IntegrationPoint {
  id: string;
  name: string;
  type: 'api' | 'database' | 'file' | 'message_queue' | 'other';
  description: string;
  provider: string;
  criticality: 'critical' | 'important' | 'optional';
}

// 工作流定义
export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  actors: string[];
  triggers: string[];
  outcomes: string[];
  estimatedDuration: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  actor: string;
  inputs: string[];
  outputs: string[];
  dependencies: string[];
}

// 用户旅程定义
export interface UserJourney {
  id: string;
  name: string;
  userType: string;
  scenario: string;
  steps: UserJourneyStep[];
  painPoints: string[];
  opportunities: string[];
}

export interface UserJourneyStep {
  id: string;
  action: string;
  expectation: string;
  touchpoint: string;
  emotion: 'positive' | 'neutral' | 'negative';
}

// 数据实体定义
export interface DataEntity {
  id: string;
  name: string;
  description: string;
  attributes: DataAttribute[];
  relationships: EntityRelationship[];
  lifecycle: string[];
}

export interface DataAttribute {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface EntityRelationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  target: string;
  description: string;
}

// 业务规则定义
export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  priority: 'critical' | 'important' | 'normal';
  source: string; // 规则来源（法规、业务需求等）
}

// 功能特性详细定义
export interface FunctionalFeature {
  id: string;
  name: string;
  description: string;
  userStories: string[];
  acceptanceCriteria: string[];
  dependencies: string[];
  priority: 'must-have' | 'should-have' | 'could-have' | 'wont-have';
  estimatedComplexity: number; // 1-10
}

// 性能目标定义
export interface PerformanceTarget {
  id: string;
  metric: string;
  target: string;
  measurement: string;
  rationale: string;
  priority: 'critical' | 'important' | 'nice-to-have';
}

// 安全需求定义
export interface SecurityReq {
  id: string;
  category: 'authentication' | 'authorization' | 'encryption' | 'audit' | 'compliance';
  requirement: string;
  implementation: string;
  standard: string; // 遵循的安全标准
  riskLevel: 'high' | 'medium' | 'low';
}

// 可扩展性需求定义
export interface ScalabilityReq {
  id: string;
  dimension: 'users' | 'data' | 'transactions' | 'geographical';
  currentScale: string;
  targetScale: string;
  timeframe: string;
  strategy: string;
}

// 合规要求定义
export interface ComplianceReq {
  id: string;
  regulation: string;
  requirement: string;
  implementation: string;
  verification: string;
  deadline?: string;
}

/**
 * 结构化项目上下文 - 核心接口
 * 
 * 这个接口定义了项目的完整结构化信息，用于：
 * 1. 解决specialist间的隐性耦合
 * 2. 为各specialist提供精确的上下文信息
 * 3. 为Phase 2的Memory Interface提供结构化数据
 */
export interface StructuredProjectContext {
  // 项目元数据
  metadata: {
    name: string;
    domain: BusinessDomain;
    complexity: 'low' | 'medium' | 'high';
    stakeholders: Stakeholder[];
    createdAt: Date;
    lastUpdated: Date;
    version: string;
  };

  // 系统边界和角色（Overall Description Writer输出）
  systemBoundary: {
    includedFeatures: Feature[];
    excludedFeatures: Feature[];
    systemRoles: SystemRole[];
    keyConstraints: Constraint[];
    integrationPoints: IntegrationPoint[];
  };

  // 功能性上下文（FR Writer输出）
  functionalContext: {
    coreWorkflows: Workflow[];
    userJourneys: UserJourney[];
    dataEntities: DataEntity[];
    businessRules: BusinessRule[];
    functionalFeatures: FunctionalFeature[];
  };

  // 质量上下文（NFR Writer输出）
  qualityContext: {
    performanceTargets: PerformanceTarget[];
    securityRequirements: SecurityReq[];
    scalabilityNeeds: ScalabilityReq[];
    complianceRequirements: ComplianceReq[];
  };
}

/**
 * 结构化上下文片段 - 用于单个specialist的输入
 */
export interface StructuredContext {
  type: 'SystemBoundary' | 'FunctionalFeatures' | 'NonFunctionalRequirements' | 'UserJourneys';
  data: any; // 根据type的具体数据
  confidence: number; // 数据质量置信度 0-1
  extractedAt: Date;
  source: 'specialist_direct_output' | 'document_extraction' | 'manual_input';
}

/**
 * 一致性检查报告
 */
export interface ConsistencyReport {
  isConsistent: boolean;
  inconsistencies: Inconsistency[];
  overallScore: number; // 一致性评分 0-100
  validatedAt: Date;
}

export interface Inconsistency {
  type: 'scope_mismatch' | 'priority_conflict' | 'dependency_missing' | 'logical_contradiction';
  description: string;
  severity: 'error' | 'warning' | 'info';
  suggestions: string[];
  affectedComponents: string[];
} 