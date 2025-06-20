import { Logger } from '../utils/logger';

/**
 * 基础质量检查规则 - v1.3 MVP版本
 * 实现Stephan要求的基础Lint功能
 */

export interface LintResult {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  suggestion?: string;
}

export interface LintReport {
  fileName: string;
  results: LintResult[];
  score: number; // 0-100
  passed: boolean;
}

export interface SRSDocument {
  fileName: string;
  content: string;
  type: 'srs' | 'fr' | 'nfr' | 'glossary';
}

/**
 * 基础Lint规则接口
 */
export interface LintRule {
  id: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (doc: SRSDocument) => LintResult[];
}

/**
 * SRS文档质量检查器
 */
export class LintChecker {
  private logger = Logger.getInstance();
  private rules: LintRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * 初始化基础检查规则
   */
  private initializeRules(): void {
    this.rules = [
      // 1. 逻辑一致性检查
      {
        id: 'logical-consistency',
        description: '检查功能需求是否在概述中提到',
        severity: 'warning',
        check: this.checkLogicalConsistency.bind(this)
      },
      
      // 2. SMART原则检查
      {
        id: 'smart-criteria',
        description: '验收标准是否符合SMART原则',
        severity: 'warning', 
        check: this.checkSMARTCriteria.bind(this)
      },
      
      // 3. ID格式检查
      {
        id: 'id-format',
        description: '需求ID格式规范性检查',
        severity: 'error',
        check: this.checkIDFormat.bind(this)
      },
      
      // 4. 必需章节检查
      {
        id: 'required-sections',
        description: '检查必需的文档章节',
        severity: 'error',
        check: this.checkRequiredSections.bind(this)
      },
      
      // 5. Markdown语法检查
      {
        id: 'markdown-syntax',
        description: 'Markdown语法正确性',
        severity: 'info',
        check: this.checkMarkdownSyntax.bind(this)
      }
    ];
    
    this.logger.info(`Initialized ${this.rules.length} lint rules`);
  }

  /**
   * 对单个文档执行质量检查
   */
  public async checkDocument(doc: SRSDocument): Promise<LintReport> {
    this.logger.info(`Checking document: ${doc.fileName}`);
    
    const allResults: LintResult[] = [];
    
    // 执行所有规则
    for (const rule of this.rules) {
      try {
        const results = rule.check(doc);
        allResults.push(...results);
      } catch (error) {
        this.logger.error(`Rule ${rule.id} failed`, error as Error);
        allResults.push({
          rule: rule.id,
          severity: 'error',
          message: `规则执行失败: ${(error as Error).message}`
        });
      }
    }
    
    // 计算质量分数
    const score = this.calculateScore(allResults);
    const passed = score >= 70; // 70分及以上为通过
    
    return {
      fileName: doc.fileName,
      results: allResults,
      score,
      passed
    };
  }

  /**
   * 检查多个文档的质量
   */
  public async checkDocumentSet(docs: SRSDocument[]): Promise<LintReport[]> {
    const reports: LintReport[] = [];
    
    for (const doc of docs) {
      const report = await this.checkDocument(doc);
      reports.push(report);
    }
    
    return reports;
  }

  /**
   * 1. 逻辑一致性检查
   * 检查功能需求是否在概述中被提及
   */
  private checkLogicalConsistency(doc: SRSDocument): LintResult[] {
    if (doc.type !== 'srs') return [];
    
    const results: LintResult[] = [];
    const content = doc.content.toLowerCase();
    
    // 提取功能需求ID
    const frMatches = doc.content.match(/FR-[A-Z]+-\d+/g) || [];
    const uniqueFRs = [...new Set(frMatches)];
    
    // 查找概述章节
    const overviewMatch = content.match(/## 2\. 整体说明[\s\S]*?(?=## 3\.|$)/i);
    if (!overviewMatch) {
      results.push({
        rule: 'logical-consistency',
        severity: 'warning',
        message: '未找到"整体说明"章节，无法验证逻辑一致性',
        suggestion: '添加第2章"整体说明"章节'
      });
      return results;
    }
    
    const overviewContent = overviewMatch[0].toLowerCase();
    
    // 检查功能需求是否在概述中提到
    let mentionedCount = 0;
    for (const fr of uniqueFRs) {
      if (overviewContent.includes(fr.toLowerCase())) {
        mentionedCount++;
      }
    }
    
    if (uniqueFRs.length > 0) {
      const mentionRate = mentionedCount / uniqueFRs.length;
      if (mentionRate < 0.5) {
        results.push({
          rule: 'logical-consistency',
          severity: 'warning',
          message: `只有${Math.round(mentionRate * 100)}%的功能需求在概述中被提及`,
          suggestion: '在概述章节中提及主要的功能需求，确保逻辑一致性'
        });
      }
    }
    
    return results;
  }

  /**
   * 2. SMART原则检查
   * 检查验收标准是否符合SMART原则
   */
  private checkSMARTCriteria(doc: SRSDocument): LintResult[] {
    if (doc.type !== 'srs') return [];
    
    const results: LintResult[] = [];
    
    // 查找验收标准表格
    const tableMatches = doc.content.match(/\|[^|]*验收标准[^|]*\|[\s\S]*?(?=\n\n|\n#|$)/gi) || [];
    
    if (tableMatches.length === 0) {
      results.push({
        rule: 'smart-criteria',
        severity: 'warning',
        message: '未找到验收标准列，无法验证SMART原则',
        suggestion: '在需求表格中添加"验收标准"列'
      });
      return results;
    }
    
    let totalCriteria = 0;
    let smartCriteria = 0;
    
    for (const table of tableMatches) {
      const rows = table.split('\n').filter(line => line.includes('|') && !line.includes('---'));
      
      for (const row of rows.slice(1)) { // 跳过表头
        const cells = row.split('|').map(cell => cell.trim());
        const criteriaCell = cells.find(cell => 
          cell.length > 10 && !cell.match(/^(FR-|NFR-|High|Medium|Low|Critical)/)
        );
        
        if (criteriaCell) {
          totalCriteria++;
          
          // 检查是否符合SMART原则
          const hasSpecific = /具体|明确|准确/.test(criteriaCell);
          const hasMeasurable = /\d+|百分比|秒|次|个/.test(criteriaCell);
          const hasTestable = /验证|测试|检查|确认/.test(criteriaCell);
          
          if (hasSpecific && hasMeasurable && hasTestable) {
            smartCriteria++;
          }
        }
      }
    }
    
    if (totalCriteria > 0) {
      const smartRate = smartCriteria / totalCriteria;
      if (smartRate < 0.7) {
        results.push({
          rule: 'smart-criteria',
          severity: 'warning',
          message: `只有${Math.round(smartRate * 100)}%的验收标准符合SMART原则`,
          suggestion: '验收标准应该具体、可测量、可验证。例如："系统响应时间应小于2秒，通过性能测试验证"'
        });
      }
    }
    
    return results;
  }

  /**
   * 3. ID格式检查
   * 检查需求ID是否符合标准格式
   */
  private checkIDFormat(doc: SRSDocument): LintResult[] {
    if (doc.type !== 'srs') return [];
    
    const results: LintResult[] = [];
    
    // 查找所有可能的需求ID
    const frMatches = doc.content.match(/FR-[^\s|]+/g) || [];
    const nfrMatches = doc.content.match(/NFR-[^\s|]+/g) || [];
    
    const allIDs = [...frMatches, ...nfrMatches];
    
    // 标准格式：FR-MODULE-001 或 NFR-MODULE-001
    const standardPattern = /^(FR|NFR)-[A-Z0-9_]+-\d{3}$/;
    
    let invalidCount = 0;
    for (const id of allIDs) {
      if (!standardPattern.test(id)) {
        invalidCount++;
      }
    }
    
    if (invalidCount > 0) {
      results.push({
        rule: 'id-format',
        severity: 'error',
        message: `发现${invalidCount}个不符合标准格式的需求ID`,
        suggestion: '需求ID应使用格式：FR-MODULE-001 或 NFR-MODULE-001（MODULE为3-8位大写字母，编号为3位数字）'
      });
    }
    
    return results;
  }

  /**
   * 4. 必需章节检查
   * 检查SRS文档是否包含必需的章节
   */
  private checkRequiredSections(doc: SRSDocument): LintResult[] {
    if (doc.type !== 'srs') return [];
    
    const results: LintResult[] = [];
    
    const requiredSections = [
      { title: '引言', pattern: /## 1\.\s*引言/ },
      { title: '整体说明', pattern: /## 2\.\s*整体说明/ },
      { title: '功能需求', pattern: /## 3\.\s*功能需求/ },
      { title: '非功能性需求', pattern: /## 4\.\s*非功能性需求/ },
      { title: '验收标准', pattern: /## 5\.\s*验收标准/ }
    ];
    
    for (const section of requiredSections) {
      if (!section.pattern.test(doc.content)) {
        results.push({
          rule: 'required-sections',
          severity: 'error',
          message: `缺少必需章节：${section.title}`,
          suggestion: `添加"${section.title}"章节`
        });
      }
    }
    
    return results;
  }

  /**
   * 5. Markdown语法检查
   * 基础的Markdown语法检查
   */
  private checkMarkdownSyntax(doc: SRSDocument): LintResult[] {
    const results: LintResult[] = [];
    const lines = doc.content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // 检查表格语法
      if (line.includes('|')) {
        const cells = line.split('|');
        if (cells.length < 3) {
          results.push({
            rule: 'markdown-syntax',
            severity: 'info',
            message: '表格行格式可能不正确',
            line: lineNum,
            suggestion: '确保表格行有正确的列分隔符'
          });
        }
      }
      
      // 检查标题语法
      if (line.startsWith('#')) {
        if (!line.match(/^#+\s+/)) {
          results.push({
            rule: 'markdown-syntax',
            severity: 'info',
            message: '标题格式不规范',
            line: lineNum,
            suggestion: '标题应在#后添加空格'
          });
        }
      }
    }
    
    return results;
  }

  /**
   * 计算文档质量分数
   */
  private calculateScore(results: LintResult[]): number {
    if (results.length === 0) return 100;
    
    let deduction = 0;
    
    for (const result of results) {
      switch (result.severity) {
        case 'error':
          deduction += 15;
          break;
        case 'warning':
          deduction += 8;
          break;
        case 'info':
          deduction += 2;
          break;
      }
    }
    
    return Math.max(0, 100 - deduction);
  }

  /**
   * 获取可用的规则列表
   */
  public getAvailableRules(): LintRule[] {
    return [...this.rules];
  }

  /**
   * 生成质量报告摘要
   */
  public generateSummary(reports: LintReport[]): string {
    const totalDocs = reports.length;
    const passedDocs = reports.filter(r => r.passed).length;
    const avgScore = reports.reduce((sum, r) => sum + r.score, 0) / totalDocs;
    
    const allResults = reports.flatMap(r => r.results);
    const errorCount = allResults.filter(r => r.severity === 'error').length;
    const warningCount = allResults.filter(r => r.severity === 'warning').length;
    
    return `## 📊 质量检查摘要

**整体评分**: ${Math.round(avgScore)}/100
**通过率**: ${passedDocs}/${totalDocs} (${Math.round(passedDocs/totalDocs*100)}%)

**问题统计**:
- 🔴 错误: ${errorCount}个
- 🟡 警告: ${warningCount}个
- 🔵 建议: ${allResults.length - errorCount - warningCount}个

**建议**: ${avgScore >= 80 ? '文档质量良好！' : avgScore >= 60 ? '建议修复主要问题后再发布' : '需要大幅改进文档质量'}`;
  }
}
