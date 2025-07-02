/**
 * 黄金测试集运行器
 * 
 * 核心功能：
 * 1. 运行specialist的黄金测试用例
 * 2. 检测prompt质量漂移
 * 3. 提供质量趋势分析
 * 4. 确保prompt修改后的质量稳定性
 */

import { PromptAssemblyEngine, SpecialistType } from './PromptAssemblyEngine';

// 黄金测试用例定义
export interface GoldenTestCase {
  id: string;
  specialist: SpecialistType;
  input: SpecialistInput;
  expectedOutput: {
    content: string;
    qualityMetrics: QualityMetrics;
    structuredData?: StructuredOutput;
  };
  testMetadata: {
    complexity: 'simple' | 'medium' | 'complex';
    domain: BusinessDomain;
    lastUpdated: Date;
    author: string;
    description: string;
  };
}

export interface SpecialistInput {
  userRequirements: string;
  projectMetadata?: any;
  structuredContext?: any;
  [key: string]: any;
}

export interface QualityMetrics {
  wordCount: number;
  qualityScore: number;
  completeness: number;
  readabilityScore: number;
  technicalAccuracy: number;
}

export interface StructuredOutput {
  type: string;
  data: any;
  confidence: number;
}

export interface BusinessDomain {
  name: string;
  industry: string;
  characteristics: string[];
}

// 测试结果定义
export interface TestResult {
  testId: string;
  specialist: string;
  passed: boolean;
  qualityDrift?: number;
  semanticSimilarity?: number;
  structuralCompliance?: number;
  executionTime: number;
  issues?: TestIssue[];
  recommendations?: string[];
  error?: string;
}

export interface TestIssue {
  type: 'execution_error' | 'quality_degradation' | 'format_violation' | 'content_mismatch';
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestion?: string;
}

export interface TestSuiteResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number;
  averageQualityScore: number;
  overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
  recommendations: string[];
  executedAt: Date;
}

export interface QualityTrendReport {
  period: string;
  trends: {
    qualityScoresTrend: TrendData;
    semanticSimilarityTrend: TrendData;
    passRateTrend: TrendData;
  };
  recommendations: string[];
  generatedAt: Date;
}

export interface TrendData {
  direction: 'improving' | 'stable' | 'degrading';
  magnitude: number;
  confidence: number;
  dataPoints: number;
}

export interface ComparisonResult {
  overallMatch: number;
  structuralCompliance: number;
  semanticSimilarity: number;
  qualityDrift: number;
  executionTime: number;
  issues: TestIssue[];
}

export class GoldenTestRunner {
  private testHistory: Map<string, TestResult[]> = new Map();
  
  constructor(
    private promptAssemblyEngine: PromptAssemblyEngine,
    private aiCommunicator: any // 简化的AI通信器接口
  ) {}

  /**
   * 运行单个specialist测试
   */
  async runSpecialistTest(
    specialist: SpecialistType,
    testCase: GoldenTestCase
  ): Promise<TestResult> {
    try {
      const startTime = Date.now();
      
      // 1. 组装specialist prompt
      const prompt = await this.promptAssemblyEngine.assembleSpecialistPrompt(
        specialist,
        testCase.input
      );

      // 2. 执行specialist
      const actualOutput = await this.executeSpecialist(prompt);

      // 3. 比较结果
      const comparison = await this.compareOutputs(
        testCase.expectedOutput,
        actualOutput
      );

      const executionTime = Date.now() - startTime;

      const result: TestResult = {
        testId: testCase.id,
        specialist: specialist.name,
        passed: comparison.overallMatch > 0.8,
        qualityDrift: comparison.qualityDrift,
        semanticSimilarity: comparison.semanticSimilarity,
        structuralCompliance: comparison.structuralCompliance,
        executionTime,
        issues: comparison.issues,
        recommendations: this.generateRecommendations(comparison)
      };

      // 记录测试历史
      this.recordTestResult(testCase.id, result);

      return result;
      
    } catch (error) {
      return {
        testId: testCase.id,
        specialist: specialist.name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: 0,
        issues: [{ 
          type: 'execution_error', 
          message: error instanceof Error ? error.message : String(error),
          severity: 'critical'
        }]
      };
    }
  }

  /**
   * 运行完整测试套件
   */
  async runFullTestSuite(): Promise<TestSuiteResult> {
    const allTestCases = await this.loadAllTestCases();
    const results: TestResult[] = [];

    for (const testCase of allTestCases) {
      const result = await this.runSpecialistTest(testCase.specialist, testCase);
      results.push(result);
    }

    return this.generateTestSuiteReport(results);
  }

  /**
   * 生成质量趋势报告
   */
  async generateQualityTrendReport(): Promise<QualityTrendReport> {
    // 分析过去30天的测试结果
    const historicalResults = await this.loadHistoricalResults(30);
    
    const trends = {
      qualityScoresTrend: this.calculateTrend(
        historicalResults.map(r => r.qualityDrift || 0)
      ),
      semanticSimilarityTrend: this.calculateTrend(
        historicalResults.map(r => r.semanticSimilarity || 0)
      ),
      passRateTrend: this.calculateTrend(
        historicalResults.map(r => r.passed ? 1 : 0)
      )
    };

    return {
      period: '30 days',
      trends,
      recommendations: this.generateTrendRecommendations(trends),
      generatedAt: new Date()
    };
  }

  /**
   * 执行specialist（模拟LLM调用）
   */
  private async executeSpecialist(prompt: string): Promise<any> {
    // 这里应该调用实际的LLM
    // 为了演示，返回模拟数据
    if (this.aiCommunicator && this.aiCommunicator.callLLM) {
      return await this.aiCommunicator.callLLM(prompt);
    }
    
    // 模拟输出
    return {
      content: "模拟生成的Markdown内容",
      structuredData: {
        type: "FunctionalFeatures",
        data: { features: [] },
        confidence: 0.9
      },
      metadata: {
        wordCount: 500,
        qualityScore: 8.5,
        completeness: 95
      },
      qualityAssessment: {
        strengths: ["清晰的结构"],
        weaknesses: [],
        confidenceLevel: 85
      }
    };
  }

  /**
   * 比较期望输出和实际输出
   */
  private async compareOutputs(
    expected: any,
    actual: any
  ): Promise<ComparisonResult> {
    const startTime = Date.now();

    // 结构化比较
    const structuralMatch = this.compareStructure(expected, actual);
    
    // 语义相似度比较（使用增强的确定性算法）
    const semanticSimilarity = this.calculateEnhancedSimilarity(
      expected.content || '',
      actual.content || ''
    );
    
    // 质量指标比较
    const qualityDrift = this.calculateQualityDrift(
      expected.qualityMetrics,
      actual.metadata
    );

    const executionTime = Date.now() - startTime;

    return {
      overallMatch: (structuralMatch + semanticSimilarity) / 2,
      structuralCompliance: structuralMatch,
      semanticSimilarity,
      qualityDrift,
      executionTime,
      issues: this.identifyIssues(expected, actual)
    };
  }

  /**
   * 计算增强的语义相似度（确定性算法）
   */
  private calculateEnhancedSimilarity(expectedContent: string, actualContent: string): number {
    // 增强的简单相似度算法，专门用于检测质量漂移
    const expectedTokens = this.tokenizeForComparison(expectedContent);
    const actualTokens = this.tokenizeForComparison(actualContent);
    
    // 1. 基础词汇重叠度
    const commonTokens = expectedTokens.filter(token => actualTokens.includes(token)).length;
    const unionTokens = new Set([...expectedTokens, ...actualTokens]).size;
    const jaccardSimilarity = unionTokens > 0 ? commonTokens / unionTokens : 0;
    
    // 2. 长度相似度（检测内容是否明显偏长或偏短）
    const lengthSimilarity = expectedTokens.length > 0 && actualTokens.length > 0 ? 
      Math.min(expectedTokens.length, actualTokens.length) / 
      Math.max(expectedTokens.length, actualTokens.length) : 0;
    
    // 3. 结构相似度（检测章节结构是否一致）
    const structuralSimilarity = this.calculateStructuralSimilarity(expectedContent, actualContent);
    
    // 加权平均，专注于检测显著变化而非精确语义
    return (jaccardSimilarity * 0.5) + (lengthSimilarity * 0.3) + (structuralSimilarity * 0.2);
  }

  /**
   * 智能分词用于比较
   */
  private tokenizeForComparison(content: string): string[] {
    // 智能分词，保留重要术语
    return content
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ') // 保留连字符
      .split(/\s+/)
      .filter(token => token.length > 2) // 过滤短词
      .filter(token => !this.isStopWord(token)); // 过滤停用词
  }

  /**
   * 计算结构相似度
   */
  private calculateStructuralSimilarity(expected: string, actual: string): number {
    // 比较标题数量、列表项数量等结构特征
    const expectedHeaders = (expected.match(/^#{1,6}\s+/gm) || []).length;
    const actualHeaders = (actual.match(/^#{1,6}\s+/gm) || []).length;
    
    const expectedListItems = (expected.match(/^[\s]*[-*+]\s+/gm) || []).length;
    const actualListItems = (actual.match(/^[\s]*[-*+]\s+/gm) || []).length;
    
    const headerSimilarity = expectedHeaders === 0 ? 1 : 
      Math.min(expectedHeaders, actualHeaders) / Math.max(expectedHeaders, actualHeaders);
    
    const listSimilarity = expectedListItems === 0 ? 1 :
      Math.min(expectedListItems, actualListItems) / Math.max(expectedListItems, actualListItems);
    
    return (headerSimilarity + listSimilarity) / 2;
  }

  /**
   * 判断是否为停用词
   */
  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by'];
    return stopWords.includes(word);
  }

  /**
   * 比较结构匹配度
   */
  private compareStructure(expected: any, actual: any): number {
    let score = 0;
    let totalChecks = 0;

    // 检查必需字段
    const requiredFields = ['content', 'metadata', 'qualityAssessment'];
    for (const field of requiredFields) {
      totalChecks++;
      if (actual[field]) {
        score++;
      }
    }

    // 检查structuredData
    totalChecks++;
    if (actual.structuredData && actual.structuredData.type && actual.structuredData.data) {
      score++;
    }

    // 检查metadata字段
    if (actual.metadata) {
      const metadataFields = ['wordCount', 'qualityScore', 'completeness'];
      for (const field of metadataFields) {
        totalChecks++;
        if (typeof actual.metadata[field] === 'number') {
          score++;
        }
      }
    }

    return totalChecks > 0 ? score / totalChecks : 0;
  }

  /**
   * 计算质量漂移
   */
  private calculateQualityDrift(expectedMetrics: QualityMetrics, actualMetadata: any): number {
    if (!expectedMetrics || !actualMetadata) {
      return 1.0; // 最大漂移
    }

    let totalDrift = 0;
    let driftCount = 0;

    // 质量评分漂移
    if (expectedMetrics.qualityScore && actualMetadata.qualityScore) {
      const drift = Math.abs(expectedMetrics.qualityScore - actualMetadata.qualityScore) / 10;
      totalDrift += drift;
      driftCount++;
    }

    // 完整性漂移
    if (expectedMetrics.completeness && actualMetadata.completeness) {
      const drift = Math.abs(expectedMetrics.completeness - actualMetadata.completeness) / 100;
      totalDrift += drift;
      driftCount++;
    }

    // 字数变化（作为内容变化的指标）
    if (expectedMetrics.wordCount && actualMetadata.wordCount) {
      const wordCountRatio = Math.abs(expectedMetrics.wordCount - actualMetadata.wordCount) / 
                            Math.max(expectedMetrics.wordCount, actualMetadata.wordCount);
      totalDrift += Math.min(wordCountRatio, 1.0); // 限制在1.0以内
      driftCount++;
    }

    return driftCount > 0 ? totalDrift / driftCount : 1.0;
  }

  /**
   * 识别问题
   */
  private identifyIssues(expected: any, actual: any): TestIssue[] {
    const issues: TestIssue[] = [];

    // 检查格式合规性
    if (!actual.structuredData) {
      issues.push({
        type: 'format_violation',
        message: 'Missing required structuredData field',
        severity: 'critical',
        suggestion: 'Ensure specialist output includes structuredData field'
      });
    }

    // 检查质量评分
    if (actual.metadata?.qualityScore && actual.metadata.qualityScore < 7.0) {
      issues.push({
        type: 'quality_degradation',
        message: `Quality score ${actual.metadata.qualityScore} below threshold of 7.0`,
        severity: 'high',
        suggestion: 'Review and improve content quality'
      });
    }

    // 检查完整性
    if (actual.metadata?.completeness && actual.metadata.completeness < 80) {
      issues.push({
        type: 'content_mismatch',
        message: `Completeness ${actual.metadata.completeness}% below threshold of 80%`,
        severity: 'medium',
        suggestion: 'Ensure all required sections are included'
      });
    }

    return issues;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(comparison: ComparisonResult): string[] {
    const recommendations: string[] = [];

    if (comparison.semanticSimilarity < 0.7) {
      recommendations.push('语义相似度较低，建议检查prompt模板或调整内容生成策略');
    }

    if (comparison.qualityDrift > 0.2) {
      recommendations.push('检测到质量漂移，建议审查prompt变更或模型参数');
    }

    if (comparison.structuralCompliance < 0.8) {
      recommendations.push('输出格式不完全符合要求，建议强化格式指导');
    }

    if (comparison.issues.length > 0) {
      recommendations.push('发现格式或质量问题，建议逐一修复');
    }

    return recommendations;
  }

  /**
   * 记录测试结果
   */
  private recordTestResult(testId: string, result: TestResult): void {
    if (!this.testHistory.has(testId)) {
      this.testHistory.set(testId, []);
    }
    
    const history = this.testHistory.get(testId)!;
    history.push(result);
    
    // 保持最近100次记录
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * 加载所有测试用例
   */
  private async loadAllTestCases(): Promise<GoldenTestCase[]> {
    // 这里应该从文件或数据库加载实际的测试用例
    // 为了演示，返回模拟数据
    return [
      {
        id: 'test-summary-001',
        specialist: { name: 'summary-writer', category: 'content' },
        input: {
          userRequirements: '创建一个电商平台的项目摘要',
          projectMetadata: {
            name: '电商平台',
            domain: { name: '电商', industry: '零售', characteristics: ['在线购物'] }
          }
        },
        expectedOutput: {
          content: '示例摘要内容',
          qualityMetrics: {
            wordCount: 300,
            qualityScore: 8.5,
            completeness: 95,
            readabilityScore: 8.0,
            technicalAccuracy: 8.0
          }
        },
        testMetadata: {
          complexity: 'medium',
          domain: { name: '电商', industry: '零售', characteristics: ['在线购物'] },
          lastUpdated: new Date(),
          author: 'test-author',
          description: '基础电商摘要生成测试'
        }
      }
    ];
  }

  /**
   * 生成测试套件报告
   */
  private generateTestSuiteReport(results: TestResult[]): TestSuiteResult {
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;
    const passRate = results.length > 0 ? passedTests / results.length : 0;
    
    const qualityScores = results
      .map(r => r.qualityDrift)
      .filter(score => score !== undefined) as number[];
    
    const averageQualityScore = qualityScores.length > 0 
      ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
      : 0;

    let overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
    if (passRate >= 0.95 && averageQualityScore <= 0.1) {
      overallHealth = 'excellent';
    } else if (passRate >= 0.8 && averageQualityScore <= 0.2) {
      overallHealth = 'good';
    } else if (passRate >= 0.6 && averageQualityScore <= 0.4) {
      overallHealth = 'warning';
    } else {
      overallHealth = 'critical';
    }

    return {
      totalTests: results.length,
      passedTests,
      failedTests,
      passRate,
      averageQualityScore,
      overallHealth,
      recommendations: this.generateSuiteRecommendations(results),
      executedAt: new Date()
    };
  }

  /**
   * 生成套件级别建议
   */
  private generateSuiteRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];
    
    const failedTests = results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} 个测试失败，需要优先修复`);
    }

    const highDriftTests = results.filter(r => (r.qualityDrift || 0) > 0.3);
    if (highDriftTests.length > 0) {
      recommendations.push(`${highDriftTests.length} 个测试显示质量漂移，建议检查prompt变更`);
    }

    return recommendations;
  }

  /**
   * 计算趋势数据
   */
  private calculateTrend(dataPoints: number[]): TrendData {
    if (dataPoints.length < 2) {
      return {
        direction: 'stable',
        magnitude: 0,
        confidence: 0,
        dataPoints: dataPoints.length
      };
    }

    // 简单的线性趋势计算
    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    const magnitude = Math.abs(difference);
    
    let direction: 'improving' | 'stable' | 'degrading';
    if (magnitude < 0.05) {
      direction = 'stable';
    } else if (difference > 0) {
      direction = 'improving';
    } else {
      direction = 'degrading';
    }

    return {
      direction,
      magnitude,
      confidence: Math.min(dataPoints.length / 10, 1.0), // 数据点越多，置信度越高
      dataPoints: dataPoints.length
    };
  }

  /**
   * 生成趋势建议
   */
  private generateTrendRecommendations(trends: QualityTrendReport['trends']): string[] {
    const recommendations: string[] = [];

    if (trends.qualityScoresTrend.direction === 'degrading') {
      recommendations.push('质量评分呈下降趋势，建议审查最近的prompt修改');
    }

    if (trends.passRateTrend.direction === 'degrading') {
      recommendations.push('测试通过率下降，建议加强质量控制');
    }

    if (trends.semanticSimilarityTrend.direction === 'degrading') {
      recommendations.push('语义相似度下降，可能存在内容漂移问题');
    }

    return recommendations;
  }

  /**
   * 加载历史结果
   */
  private async loadHistoricalResults(days: number): Promise<TestResult[]> {
    // 这里应该从持久化存储加载历史数据
    // 为了演示，返回模拟数据
    const results: TestResult[] = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      results.push({
        testId: `hist-${i}`,
        specialist: 'test-specialist',
        passed: Math.random() > 0.1,
        qualityDrift: Math.random() * 0.3,
        semanticSimilarity: 0.7 + Math.random() * 0.3,
        structuralCompliance: 0.8 + Math.random() * 0.2,
        executionTime: 1000 + Math.random() * 2000
      });
    }
    
    return results;
  }
} 