export interface QualityScore {
  completeness: number;
  clarity: number;
  technicalAccuracy: number;
  consistency: number;
  formatting: number;
  overallScore: number;
  timestamp: Date;
}

export interface QualityDrift {
  isDrifting: boolean;
  magnitude?: number;
  direction?: 'improving' | 'degrading';
  confidence: number;
}

export interface QualityAssessment {
  overallScore: number;
  completeness: number;
  clarity: number;
  technicalAccuracy: number;
  consistency: number;
  formatting: number;
  qualityDrift: QualityDrift;
  recommendations: string[];
}

export interface Inconsistency {
  type: 'scope_mismatch' | 'priority_conflict' | 'dependency_missing';
  description: string;
  severity: 'error' | 'warning' | 'info';
  suggestions: string[];
}

export class SpecialistQualityMonitor {
  private qualityHistory = new Map<string, QualityScore[]>();
  private readonly DRIFT_THRESHOLD = 0.1; // 10% threshold
  private readonly MIN_HISTORY_FOR_DRIFT = 5;
  
  async monitorSpecialistOutput(
    specialistName: string,
    input: any,
    output: any
  ): Promise<QualityAssessment> {
    const assessment = await this.assessOutputQuality(output);
    
    // 记录质量历史
    this.recordQualityScore(specialistName, assessment);
    
    // 检查质量漂移
    const drift = this.detectQualityDrift(specialistName);
    
    if (drift.isDrifting) {
      await this.triggerQualityAlert(specialistName, drift);
    }

    return {
      overallScore: assessment.overallScore,
      completeness: assessment.completeness,
      clarity: assessment.clarity,
      technicalAccuracy: assessment.technicalAccuracy,
      consistency: assessment.consistency,
      formatting: assessment.formatting,
      qualityDrift: drift,
      recommendations: this.generateQualityRecommendations(assessment)
    };
  }

  private async assessOutputQuality(output: any): Promise<QualityScore> {
    const metrics = {
      completeness: await this.assessCompleteness(output),
      clarity: await this.assessClarity(output.content),
      technicalAccuracy: await this.assessTechnicalAccuracy(output),
      consistency: await this.assessConsistency(output),
      formatting: this.assessFormatting(output)
    };

    const overallScore = Object.values(metrics).reduce((sum, score) => sum + score, 0) / Object.keys(metrics).length;

    return {
      ...metrics,
      overallScore,
      timestamp: new Date()
    };
  }

  private async assessCompleteness(output: any): Promise<number> {
    // 评估内容完整性
    const requiredElements = this.getRequiredElements(output);
    const presentElements = this.countPresentElements(output, requiredElements);
    
    return presentElements / requiredElements.length;
  }

  private async assessClarity(content: string): Promise<number> {
    // 评估内容清晰度
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;
    
    // 理想句子长度为15-25词
    const clarityScore = avgSentenceLength > 30 ? 0.6 : 
                        avgSentenceLength < 10 ? 0.7 : 0.9;
    
    return clarityScore;
  }

  private async assessTechnicalAccuracy(output: any): Promise<number> {
    // 评估技术准确性
    if (!output.structuredData) return 0.5;
    
    const hasValidStructure = this.validateStructuredData(output.structuredData);
    const hasRequiredFields = this.checkRequiredFields(output.structuredData);
    
    return (hasValidStructure && hasRequiredFields) ? 0.9 : 0.6;
  }

  private async assessConsistency(output: any): Promise<number> {
    // 评估内容一致性
    const hasConsistentTerminology = this.checkTerminologyConsistency(output.content);
    const hasConsistentFormatting = this.checkFormattingConsistency(output.content);
    
    return (hasConsistentTerminology && hasConsistentFormatting) ? 0.9 : 0.7;
  }

  private assessFormatting(output: any): number {
    // 评估格式规范性
    const content = output.content;
    const hasProperHeaders = /^#{1,6}\s+/.test(content);
    const hasProperLists = /^[\s]*[-*+]\s+/m.test(content);
    const hasProperCodeBlocks = /```[\s\S]*?```/.test(content);
    
    let score = 0.7; // 基础分
    if (hasProperHeaders) score += 0.1;
    if (hasProperLists) score += 0.1;
    if (hasProperCodeBlocks) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private recordQualityScore(specialistName: string, assessment: QualityScore): void {
    if (!this.qualityHistory.has(specialistName)) {
      this.qualityHistory.set(specialistName, []);
    }
    
    const history = this.qualityHistory.get(specialistName)!;
    history.push(assessment);
    
    // 保持最近50次记录
    if (history.length > 50) {
      history.shift();
    }
  }

  private detectQualityDrift(specialistName: string): QualityDrift {
    const history = this.qualityHistory.get(specialistName) || [];
    
    if (history.length < this.MIN_HISTORY_FOR_DRIFT) {
      return { isDrifting: false, confidence: 0 };
    }

    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    
    if (older.length === 0) {
      return { isDrifting: false, confidence: 0 };
    }
    
    const recentAvg = recent.reduce((sum, score) => sum + score.overallScore, 0) / recent.length;
    const olderAvg = older.reduce((sum, score) => sum + score.overallScore, 0) / older.length;
    
    const drift = Math.abs(recentAvg - olderAvg);
    
    return {
      isDrifting: drift > this.DRIFT_THRESHOLD,
      magnitude: drift,
      direction: recentAvg > olderAvg ? 'improving' : 'degrading',
      confidence: Math.min(drift * 10, 1.0)
    };
  }

  private async triggerQualityAlert(specialistName: string, drift: QualityDrift): Promise<void> {
    console.warn(`⚠️ Quality drift detected for ${specialistName}:`, {
      magnitude: drift.magnitude,
      direction: drift.direction,
      confidence: drift.confidence
    });
    
    // 在实际实现中，这里可以发送通知或记录日志
  }

  private generateQualityRecommendations(assessment: QualityScore): string[] {
    const recommendations: string[] = [];
    
    if (assessment.completeness < 0.8) {
      recommendations.push('建议补充缺失的必要内容元素');
    }
    
    if (assessment.clarity < 0.8) {
      recommendations.push('建议优化句子结构，提高内容清晰度');
    }
    
    if (assessment.technicalAccuracy < 0.8) {
      recommendations.push('建议检查技术术语和结构化数据的准确性');
    }
    
    if (assessment.consistency < 0.8) {
      recommendations.push('建议保持术语和格式的一致性');
    }
    
    if (assessment.formatting < 0.8) {
      recommendations.push('建议规范Markdown格式，改善文档结构');
    }
    
    return recommendations;
  }

  // 工具方法
  private getRequiredElements(output: any): string[] {
    // 根据specialist类型返回必需的元素
    const type = output.structuredData?.type;
    const requiredElementsMap: Record<string, string[]> = {
      'ExecutiveSummary': ['项目概述', '业务价值', '技术方案', '实施计划'],
      'SystemBoundary': ['项目范围', '操作环境', '假设与依赖', '高层架构'],
      'FunctionalFeatures': ['需求ID', '描述', '验收标准', '优先级'],
      'NonFunctionalRequirements': ['性能需求', '安全需求', '可用性需求']
    };
    
    return requiredElementsMap[type] || [];
  }

  private countPresentElements(output: any, requiredElements: string[]): number {
    const content = output.content.toLowerCase();
    return requiredElements.filter(element => 
      content.includes(element.toLowerCase())
    ).length;
  }

  private validateStructuredData(structuredData: any): boolean {
    return structuredData && 
           structuredData.type && 
           structuredData.data && 
           typeof structuredData.confidence === 'number';
  }

  private checkRequiredFields(structuredData: any): boolean {
    const requiredFields = ['type', 'data', 'confidence'];
    return requiredFields.every(field => field in structuredData);
  }

  private checkTerminologyConsistency(content: string): boolean {
    // 简单的术语一致性检查
    const terms = ['需求', '功能', '系统', '用户'];
    const inconsistencies = terms.filter(term => {
      const regex = new RegExp(`${term}[^ ]*`, 'gi');
      const matches = content.match(regex) || [];
      const uniqueVariants = new Set(matches.map(m => m.toLowerCase()));
      return uniqueVariants.size > 2; // 允许少量变体
    });
    
    return inconsistencies.length === 0;
  }

  private checkFormattingConsistency(content: string): boolean {
    // 检查格式一致性
    const lines = content.split('\n');
    const headerStyles = lines.filter(line => /^#{1,6}\s+/.test(line))
                             .map(line => line.match(/^(#{1,6})/)?.[1]);
    
    // 检查是否使用了一致的标题样式
    return new Set(headerStyles).size <= 6; // 最多6级标题
  }

  // 公共方法：获取质量报告
  async generateQualityReport(specialistName: string): Promise<any> {
    const history = this.qualityHistory.get(specialistName) || [];
    
    if (history.length === 0) {
      return {
        specialist: specialistName,
        status: 'No data available',
        recommendations: ['需要更多数据来生成质量报告']
      };
    }

    const recent = history.slice(-10);
    const averageQuality = recent.reduce((sum, score) => sum + score.overallScore, 0) / recent.length;
    const drift = this.detectQualityDrift(specialistName);

    return {
      specialist: specialistName,
      averageQuality: Math.round(averageQuality * 100),
      totalAssessments: history.length,
      drift,
      lastAssessment: recent[recent.length - 1],
      trend: this.calculateTrend(recent.map(s => s.overallScore)),
      recommendations: this.generateTrendRecommendations(drift, averageQuality)
    };
  }

  private calculateTrend(scores: number[]): 'improving' | 'stable' | 'declining' {
    if (scores.length < 3) return 'stable';
    
    const first = scores.slice(0, Math.floor(scores.length / 2));
    const second = scores.slice(Math.floor(scores.length / 2));
    
    const firstAvg = first.reduce((sum, s) => sum + s, 0) / first.length;
    const secondAvg = second.reduce((sum, s) => sum + s, 0) / second.length;
    
    const diff = secondAvg - firstAvg;
    
    if (diff > 0.05) return 'improving';
    if (diff < -0.05) return 'declining';
    return 'stable';
  }

  private generateTrendRecommendations(drift: QualityDrift, averageQuality: number): string[] {
    const recommendations: string[] = [];
    
    if (drift.isDrifting && drift.direction === 'degrading') {
      recommendations.push('检测到质量下降趋势，建议检查prompt模板或specialist逻辑');
    }
    
    if (averageQuality < 0.8) {
      recommendations.push('整体质量偏低，建议优化specialist的领域知识');
    }
    
    if (averageQuality > 0.95) {
      recommendations.push('质量表现优秀，可作为其他specialist的参考标准');
    }
    
    return recommendations;
  }
} 