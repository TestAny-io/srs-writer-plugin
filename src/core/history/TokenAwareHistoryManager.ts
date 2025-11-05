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
  totalBudget: number;      // 总token预算: 40000
  immediateRatio: number;   // 最近5轮: 55% (22000 tokens)
  recentRatio: number;      // 接下来4轮: 30% (12000 tokens)
  milestoneRatio: number;   // 更早轮次: 15% (6000 tokens)
}

interface HistoryEntry {
  iteration: number;
  type: 'plan' | 'result' | 'user_response';
  content: string;
  tokens: number;
  originalIndex: number;
}

interface TieredHistory {
  immediate: HistoryEntry[];    // 最近5轮
  recent: HistoryEntry[];       // 接下来4轮
  milestone: HistoryEntry[];    // 更早轮次
}

interface CompressedHistoryResult {
  immediate: string[];     // 最近5轮完整保留
  recent: string[];        // 接下来4轮保留 AI Plan + Tool Results
  milestone: string[];     // 更早轮次只保留 Tool Results
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
    immediateRatio: 0.55,   // 22000 tokens (55%)
    recentRatio: 0.30,      // 12000 tokens (30%)
    milestoneRatio: 0.15    // 6000 tokens (15%)
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

    // 🔍 [DEBUG_CONTEXT_MISSING] 记录输入历史的迭代编号范围
    const iterations = fullHistory
      .map(entry => {
        const match = entry.match(/迭代\s*(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(it => it !== null) as number[];
    const uniqueIterations = Array.from(new Set(iterations)).sort((a, b) => a - b);
    this.logger.info(`🔍 [DEBUG_CONTEXT_MISSING] 输入历史包含的迭代: [${uniqueIterations.join(', ')}], 共${uniqueIterations.length}个迭代`);

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

    // 🔍 [DEBUG_CONTEXT_MISSING] 记录分层边界
    const immediateBoundary = currentIteration - 4;
    const recentBoundary = currentIteration - 8;
    this.logger.info(`🔍 [DEBUG_CONTEXT_MISSING] 分层边界 - immediate: >=${immediateBoundary}, recent: >=${recentBoundary}, milestone: <${recentBoundary}`);

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

    // 🔍 [DEBUG_CONTEXT_MISSING] 详细记录每层包含的迭代编号
    const immediateIters = Array.from(new Set(immediate.map(e => e.iteration))).sort((a, b) => a - b);
    const recentIters = Array.from(new Set(recent.map(e => e.iteration))).sort((a, b) => a - b);
    const milestoneIters = Array.from(new Set(milestone.map(e => e.iteration))).sort((a, b) => a - b);

    this.logger.info(`📂 [HistoryManager] 分层结果: immediate=${immediate.length}, recent=${recent.length}, milestone=${milestone.length}`);
    this.logger.info(`🔍 [DEBUG_CONTEXT_MISSING] immediate层迭代: [${immediateIters.join(', ')}]`);
    this.logger.info(`🔍 [DEBUG_CONTEXT_MISSING] recent层迭代: [${recentIters.join(', ')}]`);
    this.logger.info(`🔍 [DEBUG_CONTEXT_MISSING] milestone层迭代: [${milestoneIters.join(', ')}]`);

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

    // 🔍 [DEBUG_CONTEXT_MISSING] 记录重构前各层的条目数
    this.logger.info(`🔍 [DEBUG_CONTEXT_MISSING] 重构历史 - immediate层: ${result.immediate.length}条, recent层: ${result.recent.length}条, milestone层: ${result.milestone.length}条`);

    // 添加immediate层
    if (result.immediate.length > 0) {
      this.logger.info(`🔍 [DEBUG_CONTEXT_MISSING] 添加immediate层: ${result.immediate.length}条`);
      history.push(...result.immediate);
    } else {
      this.logger.warn(`⚠️ [DEBUG_CONTEXT_MISSING] immediate层为空！`);
    }

    // 添加recent层摘要
    if (result.recent.length > 0) {
      this.logger.info(`🔍 [DEBUG_CONTEXT_MISSING] 添加recent层: ${result.recent.length}条`);
      this.logger.info(`🔍 [DEBUG_CONTEXT_MISSING] recent层内容格式示例: "${result.recent[0].substring(0, 100)}..."`);
      history.push(...result.recent);
    } else {
      this.logger.warn(`⚠️ [DEBUG_CONTEXT_MISSING] recent层为空！`);
    }

    // 添加milestone层摘要
    if (result.milestone.length > 0) {
      this.logger.info(`🔍 [DEBUG_CONTEXT_MISSING] 添加milestone层: ${result.milestone.length}条`);
      history.push(...result.milestone);
    } else {
      this.logger.warn(`⚠️ [DEBUG_CONTEXT_MISSING] milestone层为空！`);
    }

    this.logger.info(`🔍 [DEBUG_CONTEXT_MISSING] 重构后总条目数: ${history.length}条`);

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
   * recent层：第4-8轮前保留 AI Plan + Tool Results（按迭代编号降序）
   * 🚀 修复：不生成摘要，而是保留原始 entries，只过滤掉 User Reply 和 Thought
   */
  private compressRecent(entries: HistoryEntry[], budget: number): string[] {
    if (entries.length === 0) return [];

    // 过滤：只保留 AI计划 和 工具结果
    const filtered = entries.filter(entry =>
      entry.type === 'plan' || entry.type === 'result'
    );

    // 按迭代编号降序排序，同一迭代内按原始索引升序
    const sorted = filtered.sort((a, b) => {
      if (a.iteration !== b.iteration) {
        return b.iteration - a.iteration; // 降序
      }
      return a.originalIndex - b.originalIndex;
    });

    // 检查token预算并截断
    const contents = sorted.map(e => e.content);
    const totalTokens = sorted.reduce((sum, e) => sum + e.tokens, 0);

    if (totalTokens <= budget) {
      return contents;
    }

    // 超预算时截断
    return this.truncateToTokenBudget(contents, budget);
  }

  /**
   * milestone层：第9轮及以上前只保留 Tool Results（按迭代编号降序）
   * 🚀 修复：不生成摘要，而是保留原始 entries，只保留 Tool Results
   */
  private extractMilestones(entries: HistoryEntry[], budget: number): string[] {
    if (entries.length === 0) return [];

    // 过滤：只保留工具结果
    const filtered = entries.filter(entry => entry.type === 'result');

    // 按迭代编号降序排序，同一迭代内按原始索引升序
    const sorted = filtered.sort((a, b) => {
      if (a.iteration !== b.iteration) {
        return b.iteration - a.iteration; // 降序
      }
      return a.originalIndex - b.originalIndex;
    });

    // 检查token预算并截断
    const contents = sorted.map(e => e.content);
    const totalTokens = sorted.reduce((sum, e) => sum + e.tokens, 0);

    if (totalTokens <= budget) {
      return contents;
    }

    // 超预算时截断
    return this.truncateToTokenBudget(contents, budget);
  }

  // ========== 辅助方法 ==========

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
        // 超出预算时，检查是否为工具结果条目
        if (this.isToolResultEntry(entry)) {
          const warningEntry = this.generateToolResultWarning(entry);
          const warningTokens = this.estimateTokens(warningEntry);

          if (usedTokens + warningTokens <= budget) {
            result.push(warningEntry);
            usedTokens += warningTokens;
            this.logger.warn(`⚠️ [HistoryManager] 工具结果条目过大，已替换为警告: ${entryTokens}/${budget} tokens`);
          }
        }
        // 对于其他类型的条目，继续检查是否有其他较小的条目可以加入
        continue;
      }
    }

    return result;
  }

  /**
   * 检测是否为工具结果条目
   */
  private isToolResultEntry(entry: string): boolean {
    return entry.includes('- 工具结果:');
  }

  /**
   * 生成工具结果警告条目
   */
  private generateToolResultWarning(originalEntry: string): string {
    const iterationMatch = originalEntry.match(/迭代 (\d+) - 工具结果:/);
    const iteration = iterationMatch ? iterationMatch[1] : 'X';

    return `迭代 ${iteration} - 工具结果: Warning!!! Your previous tool call cause message exceeds token limit, please find different way to perform task successfully.`;
  }
}
