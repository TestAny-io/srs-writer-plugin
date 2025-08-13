import { Logger } from '../../utils/logger';
import { SpecialistIterationManager } from '../config/SpecialistIterationManager';
import type { HistoryManagementConfig } from '../config/SpecialistIterationConfig';

/**
 * Token感知的历史记录管理器
 * 
 * 功能：
 * 1. 基于token预算的分层历史压缩
 * 2. 智能历史分类和摘要
 * 3. 保持重要信息的完整性
 */

interface HistoryTokenBudget {
  totalBudget: number;      // 总token预算: 10000
  immediateRatio: number;   // 最近3轮: 90% (9000 tokens)
  recentRatio: number;      // 第4-8轮前: 7% (700 tokens)  
  milestoneRatio: number;   // 第9轮及以上前: 3% (300 tokens)
}

interface HistoryEntry {
  iteration: number;
  type: 'plan' | 'result' | 'user_response';
  content: string;
  tokens: number;
  originalIndex: number;
}

interface TieredHistory {
  immediate: HistoryEntry[];    // 最近3轮
  recent: HistoryEntry[];       // 第4-8轮前
  milestone: HistoryEntry[];    // 第9轮及以上前
}

interface CompressedHistoryResult {
  immediate: string[];     // 最近3轮完整保留
  recent: string[];        // 第4-8轮前智能摘要
  milestone: string[];     // 第9轮及以上前里程碑提取
  totalTokens: number;
  compressionRatio: number;
  debugInfo?: {
    originalTokens: number;
    tiersTokens: {
      immediate: number;
      recent: number;
      milestone: number;
    };
  };
}

export class TokenAwareHistoryManager {
  private logger = Logger.getInstance();
  private iterationManager = SpecialistIterationManager.getInstance();
  
  private readonly DEFAULT_BUDGET_CONFIG: HistoryTokenBudget = {
    totalBudget: 40000,
    immediateRatio: 0.90,   // 9000 tokens
    recentRatio: 0.07,      // 700 tokens
    milestoneRatio: 0.03    // 300 tokens
  };

  /**
   * 获取历史管理配置
   */
  private getHistoryConfig(): HistoryTokenBudget {
    try {
      const config = this.iterationManager.getHistoryConfig();
      if (config && config.compressionEnabled) {
        return {
          totalBudget: config.tokenBudget,
          immediateRatio: config.tierRatios.immediate,
          recentRatio: config.tierRatios.recent,
          milestoneRatio: config.tierRatios.milestone
        };
      }
    } catch (error) {
      this.logger.warn('⚠️ [HistoryManager] 获取历史配置失败，使用默认配置');
    }
    
    return this.DEFAULT_BUDGET_CONFIG;
  }

  /**
   * 主要入口：压缩历史记录
   */
  compressHistory(fullHistory: string[], currentIteration: number): string[] {
    this.logger.info(`🧠 [HistoryManager] 开始压缩历史记录: ${fullHistory.length}条, 当前轮次: ${currentIteration}`);
    
    if (fullHistory.length === 0) {
      return [];
    }

    try {
      // 1. 解析和分类历史
      const parsedEntries = this.parseHistoryEntries(fullHistory);
      const tieredHistory = this.categorizeByTiers(parsedEntries, currentIteration);
      
      // 2. 获取配置并计算token预算
      const budgetConfig = this.getHistoryConfig();
      const budgets = this.calculateTierBudgets(budgetConfig);
      
      // 3. 分层压缩
      const result = this.compressTieredHistory(tieredHistory, budgets);
      
      // 4. 重构最终历史
      const finalHistory = this.reconstructHistory(result);
      
      this.logger.info(`✅ [HistoryManager] 压缩完成: ${fullHistory.length} → ${finalHistory.length}条, 压缩率: ${Math.round(result.compressionRatio * 100)}%`);
      this.logger.info(`📊 [HistoryManager] Token使用: ${result.totalTokens}/${budgetConfig.totalBudget} (${Math.round(result.totalTokens/budgetConfig.totalBudget*100)}%)`);
      
      return finalHistory;
      
    } catch (error) {
      this.logger.error('❌ [HistoryManager] 历史压缩失败，回退到原始历史', error as Error);
      return fullHistory; // 失败时回退
    }
  }

  /**
   * 解析历史条目，提取轮次和类型信息
   */
  private parseHistoryEntries(history: string[]): HistoryEntry[] {
    return history.map((entry, index) => {
      const iteration = this.extractIteration(entry);
      const type = this.detectEntryType(entry);
      const tokens = this.estimateTokens(entry);
      
      return {
        iteration: iteration !== null ? iteration : 0,
        type,
        content: entry,
        tokens,
        originalIndex: index
      };
    });
  }

  /**
   * 从历史条目中提取迭代轮次
   */
  private extractIteration(entry: string): number | null {
    // 匹配 "迭代 X" 格式
    const iterationMatch = entry.match(/迭代\s*(\d+)/);
    if (iterationMatch) {
      return parseInt(iterationMatch[1], 10);
    }
    
    // 匹配其他可能的格式
    const altMatch = entry.match(/第(\d+)轮|Round\s*(\d+)|Iteration\s*(\d+)/i);
    if (altMatch) {
      return parseInt(altMatch[1] || altMatch[2] || altMatch[3], 10);
    }
    
    return null;
  }

  /**
   * 检测历史条目类型
   */
  private detectEntryType(entry: string): 'plan' | 'result' | 'user_response' {
    if (entry.includes('AI计划') || entry.includes('plan')) {
      return 'plan';
    }
    if (entry.includes('工具结果') || entry.includes('result')) {
      return 'result';
    }
    if (entry.includes('用户回复') || entry.includes('user')) {
      return 'user_response';
    }
    return 'result'; // 默认为结果类型
  }

  /**
   * 按轮次分层分类
   */
  private categorizeByTiers(entries: HistoryEntry[], currentIteration: number): TieredHistory {
    const immediate: HistoryEntry[] = [];
    const recent: HistoryEntry[] = [];
    const milestone: HistoryEntry[] = [];

    entries.forEach(entry => {
      // immediate层: 最近3轮 (当前轮次-2 到 当前轮次)
      // recent层: 第4-8轮前 (当前轮次-7 到 当前轮次-4)  
      // milestone层: 第9轮及以上前 (小于 当前轮次-7)
      
      if (entry.iteration >= currentIteration - 4) {
        immediate.push(entry); // 最近3轮（当前 + 前2轮）
      } else if (entry.iteration >= currentIteration - 8) {
        recent.push(entry); // 第4-8轮前
      } else {
        milestone.push(entry); // 第9轮及以上前
      }
    });

    this.logger.info(`📂 [HistoryManager] 分层结果: immediate=${immediate.length}, recent=${recent.length}, milestone=${milestone.length}`);
    return { immediate, recent, milestone };
  }

  /**
   * 计算各层token预算
   */
  private calculateTierBudgets(config: HistoryTokenBudget) {
    const { totalBudget, immediateRatio, recentRatio, milestoneRatio } = config;
    
    return {
      immediate: Math.floor(totalBudget * immediateRatio),
      recent: Math.floor(totalBudget * recentRatio),
      milestone: Math.floor(totalBudget * milestoneRatio)
    };
  }

  /**
   * 分层压缩历史
   */
  private compressTieredHistory(tiered: TieredHistory, budgets: any): CompressedHistoryResult {
    const immediate = this.preserveImmediate(tiered.immediate, budgets.immediate);
    const recent = this.compressRecent(tiered.recent, budgets.recent);
    const milestone = this.extractMilestones(tiered.milestone, budgets.milestone);
    
    const totalTokens = immediate.reduce((sum, entry) => sum + this.estimateTokens(entry), 0) +
                       recent.reduce((sum, entry) => sum + this.estimateTokens(entry), 0) +
                       milestone.reduce((sum, entry) => sum + this.estimateTokens(entry), 0);
    
    const originalTokens = [...tiered.immediate, ...tiered.recent, ...tiered.milestone]
      .reduce((sum, entry) => sum + entry.tokens, 0);
    
    return {
      immediate,
      recent,
      milestone,
      totalTokens,
      compressionRatio: originalTokens > 0 ? 1 - (totalTokens / originalTokens) : 0,
      debugInfo: {
        originalTokens,
        tiersTokens: {
          immediate: immediate.reduce((sum, entry) => sum + this.estimateTokens(entry), 0),
          recent: recent.reduce((sum, entry) => sum + this.estimateTokens(entry), 0),
          milestone: milestone.reduce((sum, entry) => sum + this.estimateTokens(entry), 0)
        }
      }
    };
  }

  /**
   * 重构最终历史数组
   */
  private reconstructHistory(result: CompressedHistoryResult): string[] {
    const history: string[] = [];
    
    // 添加immediate层
    if (result.immediate.length > 0) {
      history.push(...result.immediate);
    }
    
    // 添加recent层摘要
    if (result.recent.length > 0) {
      history.push(...result.recent);
    }
    
    // 添加milestone层摘要
    if (result.milestone.length > 0) {
      history.push(...result.milestone);
    }
    
    return history;
  }

  /**
   * Token估算 (复用ContextWindowManager的算法)
   */
  private estimateTokens(text: string): number {
    // 复用现有的token估算算法
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length;
    
    return Math.ceil(chineseChars + englishWords * 1.3);
  }

  // ========== 分层处理方法 ==========

  /**
   * immediate层：最近3轮保持完整，按迭代编号降序排列（最新在前）
   */
  private preserveImmediate(entries: HistoryEntry[], budget: number): string[] {
    if (entries.length === 0) return [];
    
    // 按迭代编号降序排序，同一迭代内按原始索引升序（保持执行顺序）
    const sortedEntries = entries.sort((a, b) => {
      if (a.iteration !== b.iteration) {
        return b.iteration - a.iteration; // 迭代编号降序 (最新在前)
      }
      return a.originalIndex - b.originalIndex; // 同一迭代内按原始顺序
    });
    
    const contents = sortedEntries.map(e => e.content);
    const totalTokens = sortedEntries.reduce((sum, e) => sum + e.tokens, 0);
    
    if (totalTokens <= budget) {
      this.logger.info(`✅ [HistoryManager] immediate层预算充足: ${totalTokens}/${budget} tokens`);
      return contents;
    }
    
    // 预算不足时，按排序后的顺序截断
    this.logger.warn(`⚠️ [HistoryManager] immediate层预算超限: ${totalTokens}/${budget} tokens，开始截断`);
    
    return this.truncateToTokenBudget(contents, budget);
  }

  /**
   * recent层：第4-8轮前分轮摘要（不要标题，按迭代编号降序）
   */
  private compressRecent(entries: HistoryEntry[], budget: number): string[] {
    if (entries.length === 0) return [];
    
    // 按迭代分组
    const iterationGroups = this.groupByIteration(entries);
    
    // 生成分轮摘要，按迭代编号降序
    const summaries: string[] = [];
    const sortedIterations = Object.keys(iterationGroups)
      .map(k => parseInt(k))
      .sort((a, b) => b - a); // 降序排列
    
    for (const iteration of sortedIterations) {
      const iterationEntries = iterationGroups[iteration];
      const summary = this.generateIterationSummary(iteration, iterationEntries);
      if (summary) {
        summaries.push(summary);
        
        // 检查token预算
        const usedTokens = summaries.reduce((sum, s) => sum + this.estimateTokens(s), 0);
        if (usedTokens > budget) {
          summaries.pop(); // 移除最后一个超预算的摘要
          break;
        }
      }
    }
    
    return summaries;
  }

  /**
   * milestone层：第9轮及以上前提取里程碑
   */
  private extractMilestones(entries: HistoryEntry[], budget: number): string[] {
    if (entries.length === 0) return [];
    
    const milestones = this.identifyMilestones(entries);
    const summary = this.generateMilestoneSummary(milestones, budget);
    
    return summary ? [summary] : [];
  }

  // ========== 辅助方法 ==========

  /**
   * 按成功/失败分类条目
   */
  private categorizeByOutcome(entries: HistoryEntry[]): { successes: HistoryEntry[], failures: HistoryEntry[] } {
    const successes: HistoryEntry[] = [];
    const failures: HistoryEntry[] = [];
    
    entries.forEach(entry => {
      if (this.isSuccessfulEntry(entry.content)) {
        successes.push(entry);
      } else {
        failures.push(entry);
      }
    });
    
    return { successes, failures };
  }

  /**
   * 判断是否为成功的条目
   */
  private isSuccessfulEntry(content: string): boolean {
    return content.includes('成功: true') || 
           content.includes('✅') ||
           content.includes('success') ||
           !content.includes('❌') && !content.includes('失败');
  }

  /**
   * 按迭代编号分组
   */
  private groupByIteration(entries: HistoryEntry[]): { [iteration: number]: HistoryEntry[] } {
    const groups: { [iteration: number]: HistoryEntry[] } = {};
    
    entries.forEach(entry => {
      if (!groups[entry.iteration]) {
        groups[entry.iteration] = [];
      }
      groups[entry.iteration].push(entry);
    });
    
    return groups;
  }
  
  /**
   * 生成单个迭代的摘要
   */
  private generateIterationSummary(iteration: number, entries: HistoryEntry[]): string | null {
    if (entries.length === 0) return null;
    
    const { successes, failures } = this.categorizeByOutcome(entries);
    const totalOps = successes.length + failures.length;
    
    if (totalOps === 0) return null;
    
    // 提取工具使用信息
    const successTools = this.extractToolUsage(successes);
    const failureTools = this.extractToolUsage(failures);
    
    let summary = `迭代 ${iteration}: ${totalOps}次操作`;
    
    if (successTools.length > 0) {
      summary += ` ✅ ${successTools.join(', ')}`;
    }
    
    if (failureTools.length > 0) {
      summary += ` ❌ ${failureTools.join(', ')}`;
    }
    
    return summary;
  }
  
  /**
   * 提取工具使用信息
   */
  private extractToolUsage(entries: HistoryEntry[]): string[] {
    const toolCounts: { [tool: string]: number } = {};
    
    entries.forEach(entry => {
      const toolMatch = entry.content.match(/工具:\s*(\w+)/);
      if (toolMatch) {
        const tool = toolMatch[1];
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      }
    });
    
    return Object.entries(toolCounts)
      .map(([tool, count]) => count > 1 ? `${tool}(${count}次)` : tool)
      .slice(0, 3); // 限制显示数量
  }



  /**
   * 识别里程碑事件
   */
  private identifyMilestones(entries: HistoryEntry[]): HistoryEntry[] {
    const milestones: HistoryEntry[] = [];
    
    entries.forEach(entry => {
      if (this.isMilestone(entry.content)) {
        milestones.push(entry);
      }
    });
    
    return milestones;
  }

  /**
   * 判断是否为里程碑事件
   */
  private isMilestone(content: string): boolean {
    const milestonePatterns = [
      /文件创建成功/,
      /项目初始化/,
      /重大修改完成/,
      /任务阶段完成/,
      /用户交互完成/,
      /taskComplete/,
      /专家任务执行完成/
    ];
    
    return milestonePatterns.some(pattern => pattern.test(content));
  }

  /**
   * 生成里程碑摘要
   */
  private generateMilestoneSummary(milestones: HistoryEntry[], budget: number): string | null {
    if (milestones.length === 0) return null;
    
    const summary = `## 🎯 关键里程碑 (早期历史)
📌 共${milestones.length}个重要节点: ${milestones.map(m => `迭代${m.iteration}`).join(', ')}
🏆 最新里程碑: ${this.extractMilestoneType(milestones[milestones.length - 1].content)}`;
    
    if (this.estimateTokens(summary) <= budget) {
      return summary;
    }
    
    return `## 🎯 里程碑: ${milestones.length}个节点`;
  }

  /**
   * 提取里程碑类型
   */
  private extractMilestoneType(content: string): string {
    if (content.includes('taskComplete')) return '任务完成';
    if (content.includes('文件创建')) return '文件创建';
    if (content.includes('项目初始化')) return '项目初始化';
    return '重要操作';
  }

  /**
   * 按token预算截断内容
   */
  private truncateToTokenBudget(entries: string[], budget: number): string[] {
    const result: string[] = [];
    let usedTokens = 0;

    for (const entry of entries) {
      const entryTokens = this.estimateTokens(entry);
      if (usedTokens + entryTokens <= budget) {
        result.push(entry);
        usedTokens += entryTokens;
      } else {
        // 预算不足，停止添加
        break;
      }
    }

    return result;
  }
}
