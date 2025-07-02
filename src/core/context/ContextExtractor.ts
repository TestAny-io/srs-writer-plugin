/**
 * 上下文提取器 - 修正版
 * 
 * 核心理念：避免"鸡生蛋"悖论 - LLM生成文本再解析文本的问题
 * 解决方案：直接从Specialist的结构化输出中获取信息
 */

import { 
  StructuredProjectContext, 
  StructuredContext, 
  ConsistencyReport,
  Inconsistency,
  SystemRole,
  FunctionalFeature,
  BusinessDomain,
  Constraint
} from './StructuredProjectContext';

// Specialist增强输出格式（包含必需的结构化数据）
export interface SpecialistEnhancedOutput {
  content: string; // 生成的Markdown内容
  structuredData: {
    type: 'SystemBoundary' | 'FunctionalFeatures' | 'NonFunctionalRequirements' | 'UserJourneys';
    data: any; // 根据type的具体结构化数据
    confidence: number;
    extractionNotes?: string;
  };
  metadata: {
    wordCount: number;
    qualityScore: number;
    completeness: number;
    estimatedReadingTime: string;
  };
  qualityAssessment: {
    strengths: string[];
    weaknesses: string[];
    confidenceLevel: number;
  };
  suggestedImprovements?: string[];
  nextSteps?: string[];
}

export class ContextExtractor {
  constructor() {
    // 移除aiCommunicator依赖 - 不再直接调用LLM
  }

  /**
   * 直接从Specialist的结构化输出中获取系统边界信息
   * 避免"鸡生蛋"悖论：LLM生成文本再解析文本的问题
   */
  extractFromSpecialistOutput(specialistOutput: SpecialistEnhancedOutput): StructuredContext {
    if (!specialistOutput.structuredData) {
      throw new Error('Specialist output missing required structuredData field');
    }

    return this.validateAndNormalizeStructuredData(specialistOutput.structuredData);
  }

  /**
   * 验证和规范化从Specialist直接获取的结构化数据
   */
  private validateAndNormalizeStructuredData(data: any): StructuredContext {
    // 验证数据结构完整性
    this.validateStructuredDataSchema(data);
    
    // 数据规范化处理
    return {
      type: data.type,
      data: this.normalizeData(data.data),
      confidence: data.confidence || 0.9,
      extractedAt: new Date(),
      source: 'specialist_direct_output'
    };
  }

  /**
   * 跨章节一致性检查 - 基于结构化数据直接比较
   */
  async validateCrossChapterConsistency(
    structuredContexts: StructuredContext[]
  ): Promise<ConsistencyReport> {
    const inconsistencies: Inconsistency[] = [];
    
    // 按类型分组结构化数据
    const contextsByType = this.groupContextsByType(structuredContexts);
    
    // 检查系统边界与功能需求一致性
    if (contextsByType.SystemBoundary && contextsByType.FunctionalFeatures) {
      const boundaryInconsistencies = this.validateBoundaryConsistency(
        contextsByType.SystemBoundary,
        contextsByType.FunctionalFeatures
      );
      inconsistencies.push(...boundaryInconsistencies);
    }

    // 检查非功能需求与功能需求的关联性
    if (contextsByType.FunctionalFeatures && contextsByType.NonFunctionalRequirements) {
      const nfrInconsistencies = this.validateNFRConsistency(
        contextsByType.FunctionalFeatures,
        contextsByType.NonFunctionalRequirements
      );
      inconsistencies.push(...nfrInconsistencies);
    }

    // 检查用户旅程与功能需求的对应关系
    if (contextsByType.FunctionalFeatures && contextsByType.UserJourneys) {
      const journeyInconsistencies = this.validateJourneyConsistency(
        contextsByType.FunctionalFeatures,
        contextsByType.UserJourneys
      );
      inconsistencies.push(...journeyInconsistencies);
    }

    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies,
      overallScore: Math.max(0, 100 - inconsistencies.length * 10),
      validatedAt: new Date()
    };
  }

  /**
   * 验证结构化数据的模式合规性
   */
  private validateStructuredDataSchema(data: any): void {
    if (!data.type || !data.data) {
      throw new Error('Invalid structured data: missing type or data fields');
    }

    const validTypes = ['SystemBoundary', 'FunctionalFeatures', 'NonFunctionalRequirements', 'UserJourneys'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid structured data type: ${data.type}`);
    }

    // 根据类型进行具体的模式验证
    this.validateTypeSpecificSchema(data.type, data.data);
  }

  private validateTypeSpecificSchema(type: string, data: any): void {
    switch (type) {
      case 'SystemBoundary':
        this.validateSystemBoundarySchema(data);
        break;
      case 'FunctionalFeatures':
        this.validateFunctionalFeaturesSchema(data);
        break;
      case 'NonFunctionalRequirements':
        this.validateNFRSchema(data);
        break;
      case 'UserJourneys':
        this.validateUserJourneysSchema(data);
        break;
    }
  }

  private validateSystemBoundarySchema(data: any): void {
    const required = ['includedFeatures', 'excludedFeatures', 'systemRoles', 'keyConstraints'];
    for (const field of required) {
      if (!Array.isArray(data[field])) {
        throw new Error(`SystemBoundary missing required array field: ${field}`);
      }
    }
  }

  private validateFunctionalFeaturesSchema(data: any): void {
    if (!Array.isArray(data.features)) {
      throw new Error('FunctionalFeatures must contain features array');
    }
    
    // 验证每个功能特性的必需字段
    for (const feature of data.features) {
      const required = ['id', 'name', 'description', 'priority'];
      for (const field of required) {
        if (!feature[field]) {
          throw new Error(`Feature missing required field: ${field}`);
        }
      }
    }
  }

  private validateNFRSchema(data: any): void {
    const categories = ['performance', 'security', 'scalability', 'compliance'];
    let hasAtLeastOne = false;
    
    for (const category of categories) {
      if (data[category] && Array.isArray(data[category])) {
        hasAtLeastOne = true;
        break;
      }
    }
    
    if (!hasAtLeastOne) {
      throw new Error('NonFunctionalRequirements must contain at least one category');
    }
  }

  private validateUserJourneysSchema(data: any): void {
    if (!Array.isArray(data.journeys)) {
      throw new Error('UserJourneys must contain journeys array');
    }
    
    for (const journey of data.journeys) {
      const required = ['id', 'name', 'userType', 'steps'];
      for (const field of required) {
        if (!journey[field]) {
          throw new Error(`UserJourney missing required field: ${field}`);
        }
      }
    }
  }

  /**
   * 数据规范化处理
   */
  private normalizeData(data: any): any {
    // 确保所有ID都是字符串
    if (data.features) {
      data.features = data.features.map((feature: any) => ({
        ...feature,
        id: String(feature.id),
        dependencies: Array.isArray(feature.dependencies) ? feature.dependencies : []
      }));
    }

    // 规范化优先级枚举
    if (data.features) {
      data.features = data.features.map((feature: any) => ({
        ...feature,
        priority: this.normalizePriority(feature.priority)
      }));
    }

    return data;
  }

  private normalizePriority(priority: any): 'high' | 'medium' | 'low' {
    const str = String(priority).toLowerCase();
    if (['high', 'critical', 'urgent'].includes(str)) return 'high';
    if (['medium', 'normal', 'moderate'].includes(str)) return 'medium';
    return 'low';
  }

  /**
   * 按类型分组上下文数据
   */
  private groupContextsByType(contexts: StructuredContext[]): Record<string, StructuredContext> {
    const grouped: Record<string, StructuredContext> = {};
    
    for (const context of contexts) {
      grouped[context.type] = context;
    }
    
    return grouped;
  }

  /**
   * 验证系统边界与功能需求的一致性
   */
  private validateBoundaryConsistency(
    boundaryContext: StructuredContext,
    featuresContext: StructuredContext
  ): Inconsistency[] {
    const inconsistencies: Inconsistency[] = [];
    
    const boundaryData = boundaryContext.data;
    const featuresData = featuresContext.data;
    
    // 检查包含的功能是否在功能需求中有对应实现
    const includedFeatureIds = boundaryData.includedFeatures?.map((f: any) => f.id) || [];
    const implementedFeatureIds = featuresData.features?.map((f: any) => f.id) || [];
    
    const missingImplementations = includedFeatureIds.filter((id: string) => 
      !implementedFeatureIds.includes(id)
    );
    
    if (missingImplementations.length > 0) {
      inconsistencies.push({
        type: 'scope_mismatch',
        description: `系统边界中定义的功能 [${missingImplementations.join(', ')}] 在功能需求中缺少具体实现`,
        severity: 'error',
        suggestions: [
          '在功能需求章节中添加缺失功能的详细描述',
          '或者从系统边界中移除这些功能'
        ],
        affectedComponents: ['SystemBoundary', 'FunctionalFeatures']
      });
    }

    // 检查是否有功能需求超出了系统边界
    const extraFeatures = implementedFeatureIds.filter((id: string) => 
      !includedFeatureIds.includes(id)
    );
    
    if (extraFeatures.length > 0) {
      inconsistencies.push({
        type: 'scope_mismatch',
        description: `功能需求中的功能 [${extraFeatures.join(', ')}] 未在系统边界中定义`,
        severity: 'warning',
        suggestions: [
          '将这些功能添加到系统边界的包含列表中',
          '或者评估这些功能是否应该被移除'
        ],
        affectedComponents: ['SystemBoundary', 'FunctionalFeatures']
      });
    }

    return inconsistencies;
  }

  /**
   * 验证非功能需求与功能需求的一致性
   */
  private validateNFRConsistency(
    featuresContext: StructuredContext,
    nfrContext: StructuredContext
  ): Inconsistency[] {
    const inconsistencies: Inconsistency[] = [];
    
    const featuresData = featuresContext.data;
    const nfrData = nfrContext.data;
    
    // 检查高优先级功能是否有对应的性能需求
    const highPriorityFeatures = featuresData.features?.filter((f: any) => 
      f.priority === 'high' || f.priority === 'must-have'
    ) || [];
    
    const hasPerformanceReqs = nfrData.performance && nfrData.performance.length > 0;
    
    if (highPriorityFeatures.length > 0 && !hasPerformanceReqs) {
      inconsistencies.push({
        type: 'priority_conflict',
        description: '存在高优先级功能但缺少相应的性能需求定义',
        severity: 'warning',
        suggestions: [
          '为关键功能定义性能目标',
          '明确响应时间和吞吐量要求'
        ],
        affectedComponents: ['FunctionalFeatures', 'NonFunctionalRequirements']
      });
    }

    return inconsistencies;
  }

  /**
   * 验证用户旅程与功能需求的一致性
   */
  private validateJourneyConsistency(
    featuresContext: StructuredContext,
    journeysContext: StructuredContext
  ): Inconsistency[] {
    const inconsistencies: Inconsistency[] = [];
    
    const featuresData = featuresContext.data;
    const journeysData = journeysContext.data;
    
    // 检查用户旅程是否覆盖了主要功能
    const coreFeatures = featuresData.features?.filter((f: any) => 
      f.priority === 'high' || f.priority === 'must-have'
    ) || [];
    
    const journeySteps = journeysData.journeys?.flatMap((j: any) => 
      j.steps?.map((s: any) => s.action) || []
    ) || [];
    
    // 简化的覆盖检查（基于关键词匹配）
    const uncoveredFeatures = coreFeatures.filter((feature: any) => {
      const featureKeywords = this.extractKeywords(feature.name);
      return !journeySteps.some((step: string) => 
        featureKeywords.some(keyword => step.toLowerCase().includes(keyword.toLowerCase()))
      );
    });
    
    if (uncoveredFeatures.length > 0) {
      inconsistencies.push({
        type: 'logical_contradiction',
        description: `核心功能 [${uncoveredFeatures.map((f: any) => f.name).join(', ')}] 在用户旅程中未得到体现`,
        severity: 'info',
        suggestions: [
          '在用户旅程中添加这些核心功能的使用场景',
          '或者重新评估这些功能的优先级'
        ],
        affectedComponents: ['FunctionalFeatures', 'UserJourneys']
      });
    }

    return inconsistencies;
  }

  /**
   * 从文本中提取关键词
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3); // 取前3个关键词
  }

  /**
   * 从文档内容中提取业务领域信息
   * 这个方法用于处理遗留文档或初始输入
   */
  extractBusinessDomain(input: string): BusinessDomain {
    // 简化的领域识别逻辑
    const domain: BusinessDomain = {
      name: this.inferDomainName(input),
      industry: this.inferIndustry(input),
      regulations: this.extractRegulations(input),
      commonPatterns: this.identifyPatterns(input)
    };

    return domain;
  }

  private inferDomainName(input: string): string {
    // 从输入中推断领域名称
    const domainKeywords = {
      '电商': ['电商', 'e-commerce', '购物', '商城', '订单'],
      '金融': ['银行', '支付', '交易', '金融', '贷款'],
      '教育': ['教育', '学习', '课程', '学生', '教师'],
      '医疗': ['医疗', '健康', '医院', '患者', '诊断'],
      '企业管理': ['CRM', 'ERP', '管理', '企业', '流程']
    };

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(keyword => input.toLowerCase().includes(keyword))) {
        return domain;
      }
    }

    return '通用软件系统';
  }

  private inferIndustry(input: string): string {
    const industryKeywords = {
      '零售': ['零售', '商店', '销售'],
      '金融服务': ['银行', '保险', '投资'],
      '科技': ['软件', '技术', '开发'],
      '教育': ['学校', '培训', '教育'],
      '医疗健康': ['医院', '诊所', '健康']
    };

    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      if (keywords.some(keyword => input.toLowerCase().includes(keyword))) {
        return industry;
      }
    }

    return '信息技术';
  }

  private extractRegulations(input: string): string[] {
    const regulations: string[] = [];
    
    // 常见法规关键词
    const regPatterns = [
      /GDPR|通用数据保护条例/i,
      /SOX|萨班斯法案/i,
      /PCI DSS|支付卡行业数据安全标准/i,
      /HIPAA|健康保险便携性和责任法案/i,
      /网络安全法/i,
      /个人信息保护法/i
    ];

    for (const pattern of regPatterns) {
      const match = input.match(pattern);
      if (match) {
        regulations.push(match[0]);
      }
    }

    return regulations;
  }

  private identifyPatterns(input: string): string[] {
    const patterns: string[] = [];
    
    // 识别常见的业务模式
    if (/用户.*注册.*登录/i.test(input)) {
      patterns.push('用户账户管理');
    }
    
    if (/订单.*支付.*发货/i.test(input)) {
      patterns.push('电商订单流程');
    }
    
    if (/权限.*角色.*审批/i.test(input)) {
      patterns.push('权限管理');
    }
    
    if (/数据.*分析.*报表/i.test(input)) {
      patterns.push('数据分析');
    }

    return patterns;
  }
} 