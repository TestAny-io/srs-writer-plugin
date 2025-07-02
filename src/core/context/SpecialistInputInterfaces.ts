/**
 * 专业化输入接口系统
 * 
 * 目标：为每个Specialist提供专门设计的输入接口，而非统一的ContentInput
 * 解决specialist间隐性耦合的关键组件
 */

import { 
  BusinessDomain, 
  Stakeholder, 
  SystemRole, 
  Constraint, 
  FunctionalFeature, 
  Workflow,
  ComplianceReq
} from './StructuredProjectContext';

// ===== 基础类型定义 =====

export interface StakeholderRole {
  id: string;
  name: string;
  type: 'primary' | 'secondary' | 'external';
  responsibilities: string[];
  expectations: string[];
  influence: 'high' | 'medium' | 'low';
}

export interface BusinessDomainContext {
  name: string;
  industry: string;
  keyCharacteristics: string[];
  commonWorkflows: string[];
  industryStandards: string[];
  competitiveFactors: string[];
}

export interface SystemBoundary {
  includedFeatures: FunctionalFeature[];
  excludedFeatures: FunctionalFeature[];
  systemRoles: SystemRole[];
  keyConstraints: Constraint[];
  integrationPoints: IntegrationPoint[];
}

export interface IntegrationPoint {
  id: string;
  name: string;
  type: 'api' | 'database' | 'file' | 'message_queue' | 'other';
  description: string;
  provider: string;
  criticality: 'critical' | 'important' | 'optional';
}

export interface UserLoadProfile {
  concurrentUsers: {
    expected: number;
    peak: number;
    growth: number; // annual growth rate
  };
  dataVolume: {
    currentSize: string;
    growthRate: string;
    retentionPeriod: string;
  };
  transactionVolume: {
    daily: number;
    peak: number;
    seasonal: boolean;
  };
}

export interface CriticalityLevel {
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  userImpact: 'low' | 'medium' | 'high' | 'critical';
  financialImpact: 'low' | 'medium' | 'high' | 'critical';
  availabilityRequirement: string; // e.g., "99.9%"
}

export interface TechnicalConstraint {
  id: string;
  type: 'platform' | 'technology' | 'integration' | 'performance' | 'security';
  description: string;
  impact: 'high' | 'medium' | 'low';
  workaround?: string;
}

export interface UserStory {
  id: string;
  title: string;
  asA: string; // 作为...
  iWant: string; // 我希望...
  soThat: string; // 以便...
  acceptanceCriteria: string[];
  priority: 'must-have' | 'should-have' | 'could-have' | 'wont-have';
  estimatedPoints: number;
}

// ===== Overall Description Writer专用输入 =====

export interface OverallDescriptionWriterInput {
  userRequirements: string;
  projectMetadata: {
    name: string;
    domain: BusinessDomain;
    stakeholders: Stakeholder[];
    estimatedComplexity: 'low' | 'medium' | 'high';
    timeline: {
      startDate?: string;
      endDate?: string;
      milestones: string[];
    };
  };
  businessContext: {
    industryStandards: string[];
    regulatoryRequirements: string[];
    competitorAnalysis?: string;
    marketPosition: string;
    businessGoals: string[];
  };
  technicalContext: {
    platformRequirements: string[];
    integrationNeeds: string[];
    scalabilityExpectations: string;
    technologyPreferences: string[];
    existingInfrastructure?: string;
  };
  organizationalContext: {
    teamSize: number;
    skillsets: string[];
    developmentMethodology: string;
    qualityStandards: string[];
  };
}

// ===== FR Writer专用输入 =====

export interface FRWriterInput {
  userRequirements: string;
  systemBoundary: SystemBoundary;
  stakeholderRoles: StakeholderRole[];
  businessDomain: BusinessDomainContext;
  constraintsAndAssumptions: Constraint[];
  existingWorkflows?: Workflow[];
  priorityGuidance: {
    mustHaveFeatures: string[];
    shouldHaveFeatures: string[];
    couldHaveFeatures: string[];
    wontHaveFeatures: string[];
  };
  functionalCategories: {
    coreBusinessFunctions: string[];
    supportingFunctions: string[];
    administrativeFunctions: string[];
    integrationFunctions: string[];
  };
}

// ===== NFR Writer专用输入 =====

export interface NFRWriterInput {
  userRequirements: string;
  functionalFeatures: FunctionalFeature[];
  expectedUserLoad: UserLoadProfile;
  businessCriticality: CriticalityLevel;
  complianceRequirements: ComplianceReq[];
  technicalConstraints: TechnicalConstraint[];
  qualityExpectations: {
    performance: {
      responseTimeTargets: Record<string, string>; // function -> target
      throughputRequirements: Record<string, string>;
      resourceUtilizationLimits: Record<string, string>;
    };
    reliability: {
      uptimeRequirements: string;
      errorRateThresholds: Record<string, string>;
      recoveryTimeObjectives: Record<string, string>;
    };
    security: {
      authenticationMethods: string[];
      authorizationLevels: string[];
      dataProtectionRequirements: string[];
      auditingNeeds: string[];
    };
    usability: {
      userExperienceGoals: string[];
      accessibilityRequirements: string[];
      localizationNeeds: string[];
    };
  };
}

// ===== User Journey Writer专用输入 =====

export interface UserJourneyWriterInput {
  userRequirements: string;
  functionalFeatures: FunctionalFeature[];
  stakeholderRoles: StakeholderRole[];
  systemWorkflows: Workflow[];
  existingUserStories?: UserStory[];
  userPersonas: UserPersona[];
  businessScenarios: BusinessScenario[];
  touchpointAnalysis: {
    digitalTouchpoints: string[];
    physicalTouchpoints: string[];
    systemInterfaces: string[];
    humanInteractions: string[];
  };
}

export interface UserPersona {
  id: string;
  name: string;
  role: string;
  characteristics: {
    techSavvy: 'low' | 'medium' | 'high';
    frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
    goals: string[];
    painPoints: string[];
    motivations: string[];
  };
  context: {
    environment: string;
    devices: string[];
    constraints: string[];
  };
}

export interface BusinessScenario {
  id: string;
  name: string;
  description: string;
  actors: string[];
  preconditions: string[];
  steps: ScenarioStep[];
  expectedOutcome: string;
  businessValue: string;
  frequency: 'high' | 'medium' | 'low';
}

export interface ScenarioStep {
  stepNumber: number;
  actor: string;
  action: string;
  system: string;
  expectedResult: string;
  alternativeFlows?: string[];
}

// ===== Summary Writer专用输入 =====

export interface SummaryWriterInput {
  userRequirements: string;
  projectOverview: {
    name: string;
    vision: string;
    objectives: string[];
    scope: string;
    keyBenefits: string[];
  };
  businessJustification: {
    problemStatement: string;
    proposedSolution: string;
    expectedBenefits: string[];
    successMetrics: string[];
    riskAssessment: string[];
  };
  executiveSummaryGuidance: {
    targetAudience: string[];
    keyMessaging: string[];
    criticalDecisionPoints: string[];
    budgetConsiderations?: string;
    timelineHighlights: string[];
  };
}

// ===== Prototype Designer专用输入 =====

export interface PrototypeDesignerInput {
  userRequirements: string;
  functionalFeatures: FunctionalFeature[];
  userJourneys: UserJourney[];
  designRequirements: {
    uiStyleGuide?: string;
    brandingGuidelines?: string;
    accessibilityStandards: string[];
    deviceTargets: string[];
    browserSupport: string[];
  };
  prototypingScope: {
    fidelityLevel: 'low' | 'medium' | 'high';
    includedFlows: string[];
    priorityScreens: string[];
    interactionTypes: string[];
  };
  technicalContext: {
    frontendFramework?: string;
    designTools: string[];
    assetRequirements: string[];
  };
}

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

// ===== 输入验证接口 =====

export interface InputValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
}

export interface ValidationWarning {
  field: string;
  message: string;
  impact: 'quality' | 'completeness' | 'consistency';
}

// ===== 输入验证器 =====

export class SpecialistInputValidator {
  
  /**
   * 验证Overall Description Writer输入
   */
  validateOverallDescriptionInput(input: OverallDescriptionWriterInput): InputValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // 必需字段验证
    if (!input.userRequirements?.trim()) {
      errors.push({
        field: 'userRequirements',
        message: '用户需求不能为空',
        severity: 'critical'
      });
    }

    if (!input.projectMetadata?.name?.trim()) {
      errors.push({
        field: 'projectMetadata.name',
        message: '项目名称不能为空',
        severity: 'critical'
      });
    }

    // 业务上下文验证
    if (!input.businessContext?.industryStandards?.length) {
      warnings.push({
        field: 'businessContext.industryStandards',
        message: '建议提供行业标准信息以提高内容质量',
        impact: 'quality'
      });
    }

    // 技术上下文验证
    if (!input.technicalContext?.platformRequirements?.length) {
      warnings.push({
        field: 'technicalContext.platformRequirements',
        message: '建议明确平台需求',
        impact: 'completeness'
      });
    }

    // 生成改进建议
    if (input.businessContext?.competitorAnalysis) {
      suggestions.push('已提供竞争对手分析，将有助于生成更具针对性的项目描述');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * 验证FR Writer输入
   */
  validateFRWriterInput(input: FRWriterInput): InputValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // 必需字段验证
    if (!input.userRequirements?.trim()) {
      errors.push({
        field: 'userRequirements',
        message: '用户需求不能为空',
        severity: 'critical'
      });
    }

    // 系统边界验证
    if (!input.systemBoundary?.includedFeatures?.length) {
      errors.push({
        field: 'systemBoundary.includedFeatures',
        message: '必须定义包含的功能特性',
        severity: 'high'
      });
    }

    // 利益相关者验证
    if (!input.stakeholderRoles?.length) {
      warnings.push({
        field: 'stakeholderRoles',
        message: '建议定义利益相关者角色以提高需求准确性',
        impact: 'quality'
      });
    }

    // 优先级指导验证
    if (!input.priorityGuidance?.mustHaveFeatures?.length) {
      warnings.push({
        field: 'priorityGuidance.mustHaveFeatures',
        message: '建议明确必须实现的功能',
        impact: 'completeness'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * 验证NFR Writer输入
   */
  validateNFRWriterInput(input: NFRWriterInput): InputValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // 基础验证
    if (!input.userRequirements?.trim()) {
      errors.push({
        field: 'userRequirements',
        message: '用户需求不能为空',
        severity: 'critical'
      });
    }

    if (!input.functionalFeatures?.length) {
      errors.push({
        field: 'functionalFeatures',
        message: 'NFR Writer需要功能特性作为输入',
        severity: 'high'
      });
    }

    // 用户负载验证
    if (!input.expectedUserLoad?.concurrentUsers?.expected) {
      warnings.push({
        field: 'expectedUserLoad.concurrentUsers.expected',
        message: '建议提供预期并发用户数以制定性能目标',
        impact: 'quality'
      });
    }

    // 业务关键性验证
    if (input.businessCriticality?.businessImpact === 'critical' && 
        !input.qualityExpectations?.reliability?.uptimeRequirements) {
      warnings.push({
        field: 'qualityExpectations.reliability.uptimeRequirements',
        message: '关键业务系统建议明确可用性要求',
        impact: 'completeness'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * 验证User Journey Writer输入
   */
  validateUserJourneyWriterInput(input: UserJourneyWriterInput): InputValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // 基础验证
    if (!input.userRequirements?.trim()) {
      errors.push({
        field: 'userRequirements',
        message: '用户需求不能为空',
        severity: 'critical'
      });
    }

    if (!input.functionalFeatures?.length) {
      errors.push({
        field: 'functionalFeatures',
        message: 'User Journey Writer需要功能特性作为基础',
        severity: 'high'
      });
    }

    // 用户角色验证
    if (!input.stakeholderRoles?.length) {
      warnings.push({
        field: 'stakeholderRoles',
        message: '建议定义利益相关者角色以创建准确的用户旅程',
        impact: 'quality'
      });
    }

    // 用户画像验证
    if (!input.userPersonas?.length) {
      warnings.push({
        field: 'userPersonas',
        message: '建议提供用户画像以创建更具针对性的旅程',
        impact: 'quality'
      });
    }

    // 业务场景验证
    if (!input.businessScenarios?.length) {
      suggestions.push('考虑添加业务场景以丰富用户旅程的上下文');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }
} 