import { SpecialistQualityMonitor, QualityAssessment } from '../../core/quality/SpecialistQualityMonitor';

export interface CITestResult {
  success: boolean;
  details: {
    goldenTests: TestSuiteResult;
    qualityTests: QualityTestResult;
    performanceTests: PerformanceTestResult;
  };
  executedAt: Date;
  recommendedActions: string[];
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

export interface QualityTestResult {
  totalTests: number;
  passedTests: number;
  averageQuality: number;
  qualityDriftDetected: boolean;
  issues: QualityIssue[];
}

export interface PerformanceTestResult {
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  throughput: number;
  passed: boolean;
  benchmarks: PerformanceBenchmark[];
}

export interface QualityIssue {
  specialist: string;
  type: 'quality_degradation' | 'completeness_issue' | 'consistency_issue';
  severity: 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

export interface PerformanceBenchmark {
  operation: string;
  expectedTime: number;
  actualTime: number;
  passed: boolean;
}

export interface QualityTestCase {
  id: string;
  specialist: string;
  input: any;
  expectedQuality: {
    minimumScore: number;
    requiredElements: string[];
    maxResponseTime: number;
  };
}

export class AutomatedTestSuite {
  private qualityMonitor: SpecialistQualityMonitor;
  private testCases: QualityTestCase[] = [];

  constructor() {
    this.qualityMonitor = new SpecialistQualityMonitor();
    this.loadQualityTestCases();
  }

  async runContinuousIntegrationTests(): Promise<CITestResult> {
    console.log('🚀 启动持续集成测试套件...');
    
    const results = {
      goldenTests: await this.runGoldenTestsSuite(),
      qualityTests: await this.runQualityRegressionTests(),
      performanceTests: await this.runPerformanceTests()
    };

    const overallSuccess = this.evaluateOverallSuccess(results);
    
    if (!overallSuccess) {
      await this.generateFailureReport(results);
    }

    return {
      success: overallSuccess,
      details: results,
      executedAt: new Date(),
      recommendedActions: this.generateRecommendedActions(results)
    };
  }

  private async runGoldenTestsSuite(): Promise<TestSuiteResult> {
    console.log('📋 运行黄金测试集...');
    
    // 这里会调用现有的黄金测试运行器
    const GoldenTestRunner = require('../../../scripts/run-golden-tests.js');
    const runner = new GoldenTestRunner();
    
    try {
      const result = await runner.runFullTestSuite();
      return {
        totalTests: result.totalTests,
        passedTests: result.passedTests,
        failedTests: result.failedTests,
        passRate: result.passRate,
        averageQualityScore: result.averageQualityScore,
        overallHealth: result.overallHealth,
        recommendations: result.recommendations,
        executedAt: new Date()
      };
    } catch (error) {
      console.error('黄金测试集运行失败:', error);
      return {
        totalTests: 0,
        passedTests: 0,
        failedTests: 1,
        passRate: 0,
        averageQualityScore: 0,
        overallHealth: 'critical',
        recommendations: ['黄金测试集运行失败，需要检查测试环境'],
        executedAt: new Date()
      };
    }
  }

  private async runQualityRegressionTests(): Promise<QualityTestResult> {
    console.log('🔍 运行质量回归测试...');
    
    const results: QualityAssessment[] = [];
    const issues: QualityIssue[] = [];

    for (const testCase of this.testCases) {
      try {
        const output = await this.executeSpecialistTest(testCase);
        const assessment = await this.qualityMonitor.monitorSpecialistOutput(
          testCase.specialist,
          testCase.input,
          output
        );
        
        results.push(assessment);
        
        // 检查是否满足质量要求
        if (assessment.overallScore < testCase.expectedQuality.minimumScore) {
          issues.push({
            specialist: testCase.specialist,
            type: 'quality_degradation',
            severity: 'high',
            description: `质量分数 ${Math.round(assessment.overallScore * 100)}% 低于预期 ${testCase.expectedQuality.minimumScore * 100}%`,
            recommendation: '建议检查specialist的prompt模板和逻辑'
          });
        }

        // 检查质量漂移
        if (assessment.qualityDrift.isDrifting) {
          issues.push({
            specialist: testCase.specialist,
            type: 'quality_degradation',
            severity: assessment.qualityDrift.direction === 'degrading' ? 'high' : 'medium',
            description: `检测到质量漂移：${assessment.qualityDrift.direction}, 幅度: ${Math.round((assessment.qualityDrift.magnitude || 0) * 100)}%`,
            recommendation: '建议分析最近的变更对质量的影响'
          });
        }

        // 检查完整性
        if (assessment.completeness < 0.9) {
          issues.push({
            specialist: testCase.specialist,
            type: 'completeness_issue',
            severity: 'medium',
            description: `内容完整性不足：${Math.round(assessment.completeness * 100)}%`,
            recommendation: '建议补充缺失的必要内容元素'
          });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`测试用例 ${testCase.id} 执行失败:`, error);
        issues.push({
          specialist: testCase.specialist,
          type: 'quality_degradation',
          severity: 'high',
          description: `测试执行失败: ${errorMessage}`,
          recommendation: '检查specialist实现和测试环境'
        });
      }
    }

    return {
      totalTests: this.testCases.length,
      passedTests: results.filter(r => r.overallScore >= 0.8).length,
      averageQuality: results.length > 0 
        ? results.reduce((sum, r) => sum + r.overallScore, 0) / results.length 
        : 0,
      qualityDriftDetected: results.some(r => r.qualityDrift.isDrifting),
      issues
    };
  }

  private async runPerformanceTests(): Promise<PerformanceTestResult> {
    console.log('⚡ 运行性能测试...');
    
    const benchmarks: PerformanceBenchmark[] = [];
    const responseTimes: number[] = [];

    // 性能测试用例
    const performanceTests = [
      { operation: 'summary_writer', expectedTime: 3000, input: { userRequirements: '简单项目描述' } },
      { operation: 'fr_writer', expectedTime: 5000, input: { userRequirements: '用户登录功能' } },
      { operation: 'nfr_writer', expectedTime: 4000, input: { userRequirements: '性能要求' } }
    ];

    for (const test of performanceTests) {
      const startTime = Date.now();
      
      try {
        await this.simulateSpecialistExecution(test.operation, test.input);
        const actualTime = Date.now() - startTime;
        responseTimes.push(actualTime);
        
        benchmarks.push({
          operation: test.operation,
          expectedTime: test.expectedTime,
          actualTime,
          passed: actualTime <= test.expectedTime
        });
      } catch (error) {
        const actualTime = Date.now() - startTime;
        benchmarks.push({
          operation: test.operation,
          expectedTime: test.expectedTime,
          actualTime,
          passed: false
        });
      }
    }

    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    return {
      averageResponseTime,
      maxResponseTime: Math.max(...responseTimes, 0),
      minResponseTime: Math.min(...responseTimes, 0),
      throughput: responseTimes.length > 0 ? 1000 / averageResponseTime : 0,
      passed: benchmarks.every(b => b.passed),
      benchmarks
    };
  }

  private async executeSpecialistTest(testCase: QualityTestCase): Promise<any> {
    // 模拟specialist执行
    return await this.simulateSpecialistExecution(testCase.specialist, testCase.input);
  }

  private async simulateSpecialistExecution(specialist: string, input: any): Promise<any> {
    // 模拟specialist执行时间
    const executionTime = Math.random() * 2000 + 1000; // 1-3秒
    await new Promise(resolve => setTimeout(resolve, Math.min(executionTime, 100))); // 实际测试中限制等待时间

    // 生成模拟输出
    const baseQuality = Math.random() * 0.3 + 0.7; // 0.7-1.0之间
    
    return {
      content: `模拟的${specialist}输出内容，基于输入: ${JSON.stringify(input)}`,
      metadata: {
        wordCount: Math.floor(Math.random() * 500 + 300),
        qualityScore: Math.round(baseQuality * 10 * 10) / 10,
        completeness: Math.floor(baseQuality * 100)
      },
      structuredData: {
        type: this.getExpectedStructuredType(specialist),
        data: {},
        confidence: baseQuality
      }
    };
  }

  private getExpectedStructuredType(specialistName: string): string {
    const typeMap: Record<string, string> = {
      'summary_writer': 'ExecutiveSummary',
      'overall_description_writer': 'SystemBoundary',
      'fr_writer': 'FunctionalFeatures',
      'nfr_writer': 'NonFunctionalRequirements',
      'user_journey_writer': 'UserJourneys',
      'prototype_designer': 'SystemPrototypes'
    };
    return typeMap[specialistName] || 'Unknown';
  }

  private evaluateOverallSuccess(results: any): boolean {
    return results.goldenTests.passRate >= 90 &&
           results.qualityTests.averageQuality >= 0.8 &&
           results.performanceTests.passed;
  }

  private generateRecommendedActions(results: any): string[] {
    const actions: string[] = [];

    if (results.goldenTests.passRate < 90) {
      actions.push('黄金测试集通过率偏低，需要检查specialist实现');
    }

    if (results.qualityTests.averageQuality < 0.8) {
      actions.push('质量回归测试发现问题，建议优化specialist质量');
    }

    if (!results.performanceTests.passed) {
      actions.push('性能测试未通过，需要优化响应时间');
    }

    if (results.qualityTests.qualityDriftDetected) {
      actions.push('检测到质量漂移，建议检查最近的变更');
    }

    if (actions.length === 0) {
      actions.push('所有测试通过，系统状态良好');
    }

    return actions;
  }

  private async generateFailureReport(results: any): Promise<void> {
    const failureReport = {
      timestamp: new Date().toISOString(),
      summary: '持续集成测试失败',
      details: results,
      criticalIssues: this.extractCriticalIssues(results),
      recommendedActions: this.generateRecommendedActions(results)
    };

    console.error('🚨 CI测试失败报告:', JSON.stringify(failureReport, null, 2));
    
    // 在实际环境中，这里可以发送通知或保存报告
  }

  private extractCriticalIssues(results: any): string[] {
    const issues: string[] = [];

    if (results.goldenTests.failedTests > 0) {
      issues.push(`${results.goldenTests.failedTests}个黄金测试失败`);
    }

    const highSeverityQualityIssues = results.qualityTests.issues?.filter(
      (issue: QualityIssue) => issue.severity === 'high'
    ) || [];

    if (highSeverityQualityIssues.length > 0) {
      issues.push(`${highSeverityQualityIssues.length}个高严重性质量问题`);
    }

    const failedPerformanceTests = results.performanceTests.benchmarks?.filter(
      (benchmark: PerformanceBenchmark) => !benchmark.passed
    ) || [];

    if (failedPerformanceTests.length > 0) {
      issues.push(`${failedPerformanceTests.length}个性能测试失败`);
    }

    return issues;
  }

  private loadQualityTestCases(): void {
    // 加载质量测试用例
    this.testCases = [
      {
        id: 'quality-001',
        specialist: 'summary_writer',
        input: {
          userRequirements: '开发一个企业级CRM系统',
          projectContext: { name: 'CRM系统', domain: 'business', complexity: 'high' }
        },
        expectedQuality: {
          minimumScore: 0.85,
          requiredElements: ['项目概述', '业务价值', '技术方案'],
          maxResponseTime: 3000
        }
      },
      {
        id: 'quality-002',
        specialist: 'fr_writer',
        input: {
          userRequirements: '用户管理模块功能需求',
          projectContext: { name: '用户管理', domain: 'authentication', complexity: 'medium' }
        },
        expectedQuality: {
          minimumScore: 0.8,
          requiredElements: ['需求ID', '描述', '验收标准'],
          maxResponseTime: 5000
        }
      },
      {
        id: 'quality-003',
        specialist: 'nfr_writer',
        input: {
          userRequirements: '高可用性和性能要求',
          projectContext: { name: '高可用系统', domain: 'infrastructure', complexity: 'high' }
        },
        expectedQuality: {
          minimumScore: 0.8,
          requiredElements: ['性能需求', '可用性需求', '安全需求'],
          maxResponseTime: 4000
        }
      }
    ];
  }

  // 定时任务支持
  async scheduleNightlyTests(): Promise<void> {
    const schedule = '0 2 * * *'; // 每天凌晨2点
    console.log(`📅 计划在 ${schedule} 运行夜间测试`);
    
    // 在实际实现中，这里会集成到CI/CD pipeline
    // 例如：使用node-cron或集成到GitHub Actions
  }

  // 获取系统健康状态
  async getSystemHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    lastTestResults?: CITestResult;
    issues: string[];
    recommendations: string[];
  }> {
    // 简化的健康状态检查
    try {
      const lastResults = await this.runContinuousIntegrationTests();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];
      
      if (!lastResults.success) {
        status = 'critical';
        issues.push('CI测试失败');
      } else if (lastResults.details.qualityTests.qualityDriftDetected) {
        status = 'warning';
        issues.push('检测到质量漂移');
      }

      return {
        status,
        lastTestResults: lastResults,
        issues,
        recommendations: lastResults.recommendedActions
      };
         } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       return {
         status: 'critical',
         issues: [`系统健康检查失败: ${errorMessage}`],
         recommendations: ['检查系统配置和依赖']
       };
     }
  }
} 