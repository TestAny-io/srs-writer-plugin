import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';

/**
 * 上下文窗口管理器 - 负责动态上下文窗口配置和管理
 */
export class ContextWindowManager {
  private logger = Logger.getInstance();
  
  // 动态模型配置缓存
  private static modelConfigCache = new Map<string, {
    maxTokens: number;
    warningThreshold: number;
    compressionThreshold: number;
    lastUpdated: number;
    confidence: 'low' | 'medium' | 'high';
  }>();

  /**
   * 🚀 动态上下文窗口配置：多层次自适应策略
   */
  public async getContextWindowConfig(selectedModel: vscode.LanguageModelChat): Promise<{
    maxTokens: number;
    warningThreshold: number;
    compressionThreshold: number;
  }> {
    const modelKey = selectedModel.name;
    
    // 1. 优先级1：用户配置覆盖
    const userConfig = await this.loadUserModelConfig(modelKey);
    if (userConfig) {
      const config = {
        maxTokens: userConfig.maxTokens || 8000,
        warningThreshold: userConfig.warningThreshold || Math.floor((userConfig.maxTokens || 8000) * 0.75),
        compressionThreshold: userConfig.compressionThreshold || Math.floor((userConfig.maxTokens || 8000) * 0.6)
      };
      this.logger.info(`👤 Using user config for ${modelKey}: ${config.maxTokens} tokens`);
      return config;
    }
    
    // 2. 优先级2：错误学习缓存（高置信度）
    const cached = ContextWindowManager.modelConfigCache.get(modelKey);
    if (cached && cached.confidence === 'high') {
      this.logger.info(`🎯 Using learned config for ${modelKey}: ${cached.maxTokens} tokens (high confidence)`);
      return {
        maxTokens: cached.maxTokens,
        warningThreshold: cached.warningThreshold,
        compressionThreshold: cached.compressionThreshold
      };
    }
    
    // 3. 优先级3：普通缓存（24小时有效）
    if (cached && (Date.now() - cached.lastUpdated) < 24 * 60 * 60 * 1000) {
      this.logger.info(`📋 Using cached config for ${modelKey} (confidence: ${cached.confidence})`);
      return {
        maxTokens: cached.maxTokens,
        warningThreshold: cached.warningThreshold,
        compressionThreshold: cached.compressionThreshold
      };
    }
    
    // 4. 优先级4：启发式推断（基于通用规则）
    const inferredConfig = this.inferModelCapabilities(selectedModel);
    
    // 5. 缓存推断结果
    ContextWindowManager.modelConfigCache.set(modelKey, {
      ...inferredConfig,
      lastUpdated: Date.now(),
      confidence: 'medium'
    });
    
    this.logger.info(`🔍 Inferred config for ${modelKey}: ${inferredConfig.maxTokens} tokens (medium confidence)`);
    return {
      maxTokens: inferredConfig.maxTokens,
      warningThreshold: inferredConfig.warningThreshold,
      compressionThreshold: inferredConfig.compressionThreshold
    };
  }

  /**
   * 🚀 启发式模型能力推断：基于名称模式和通用规则
   */
  private inferModelCapabilities(model: vscode.LanguageModelChat) {
    const modelName = model.name.toLowerCase();
    
    // 检查是否是新一代大上下文模型
    if (this.isLargeContextModel(modelName)) {
      return { maxTokens: 128000, warningThreshold: 100000, compressionThreshold: 80000 };
    }
    
    // 检查是否是中等上下文模型  
    if (this.isMediumContextModel(modelName)) {
      return { maxTokens: 32000, warningThreshold: 25000, compressionThreshold: 20000 };
    }
    
    // 检查是否是老模型或小模型
    if (this.isSmallContextModel(modelName)) {
      return { maxTokens: 4000, warningThreshold: 3000, compressionThreshold: 2000 };
    }
    
    // 默认保守估计
    return { maxTokens: 8000, warningThreshold: 6000, compressionThreshold: 4000 };
  }

  /**
   * 检查是否是大上下文模型
   */
  private isLargeContextModel(modelName: string): boolean {
    const largeContextIndicators = [
      'turbo', '128k', '200k', 'long', 'extended',
      'claude-3', 'claude-2.1', 'gemini-pro',
      '2024', '2023'  // 较新的模型通常有更大的上下文
    ];
    return largeContextIndicators.some(indicator => modelName.includes(indicator));
  }

  /**
   * 检查是否是中等上下文模型
   */
  private isMediumContextModel(modelName: string): boolean {
    const mediumContextIndicators = [
      'gpt-4', 'claude-2', 'gemini',
      '16k', '32k'
    ];
    return mediumContextIndicators.some(indicator => modelName.includes(indicator));
  }

  /**
   * 检查是否是小上下文模型
   */
  private isSmallContextModel(modelName: string): boolean {
    const smallContextIndicators = [
      'gpt-3.5', '4k', '2k', 
      '2022', '2021'  // 较老的模型
    ];
    return smallContextIndicators.some(indicator => modelName.includes(indicator));
  }

  /**
   * 🚀 Token数量估算：简单但有效的估算方法
   */
  public estimateTokens(text: string): number {
    // 简单估算：1 token ≈ 0.75 英文单词 ≈ 4 字符
    // 对于中文，1个字符大约等于1个token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length;
    
    return Math.ceil(chineseChars + englishWords * 1.3);
  }

  /**
   * 🚀 对话上下文管理：智能压缩历史记录 + 错误反馈学习
   */
  public async manageConversationContext(
    conversationHistory: Array<{ role: string; content: string; tokens?: number; toolResults?: any[] }>,
    contextConfig: { maxTokens: number; warningThreshold: number; compressionThreshold: number },
    selectedModel: vscode.LanguageModelChat
  ): Promise<void> {
    const totalTokens = conversationHistory.reduce((sum, item) => sum + (item.tokens || 0), 0);
    
    if (totalTokens <= contextConfig.compressionThreshold) {
      return; // 无需压缩
    }
    
    this.logger.warn(`💭 Context approaching limit (${totalTokens}/${contextConfig.maxTokens} tokens), compressing history`);
    
    // 保留最新的2轮对话和初始用户输入
    const originalUserInput = conversationHistory[0];
    const recentHistory = conversationHistory.slice(-4); // 最近2轮对话
    
    // 压缩中间历史为摘要
    const middleHistory = conversationHistory.slice(1, -4);
    if (middleHistory.length > 0) {
      const compressionSummary = await this.compressHistoryToSummary(middleHistory, selectedModel);
      
      // 重构对话历史
      conversationHistory.length = 0; // 清空数组
      conversationHistory.push(originalUserInput);
      
      if (compressionSummary) {
        conversationHistory.push({
          role: 'system',
          content: `📋 **历史摘要**: ${compressionSummary}`,
          tokens: this.estimateTokens(compressionSummary)
        });
      }
      
      conversationHistory.push(...recentHistory);
      
      const newTotalTokens = conversationHistory.reduce((sum, item) => sum + (item.tokens || 0), 0);
      this.logger.info(`✅ Context compressed: ${totalTokens} → ${newTotalTokens} tokens`);
    }
  }

  /**
   * 🚀 错误反馈学习：从实际API错误中学习模型限制
   */
  public async handleContextError(
    error: Error,
    selectedModel: vscode.LanguageModelChat,
    estimatedTokens: number
  ): Promise<void> {
    const errorMessage = error.message.toLowerCase();
    
    // 检查是否是上下文超限错误
    if (this.isContextLimitError(errorMessage)) {
      const modelKey = selectedModel.name;
      const cached = ContextWindowManager.modelConfigCache.get(modelKey);
      
      if (cached) {
        // 根据错误调整配置（保守降低）
        const newMaxTokens = Math.floor(estimatedTokens * 0.8); // 降低20%
        const updatedConfig = {
          maxTokens: newMaxTokens,
          warningThreshold: Math.floor(newMaxTokens * 0.8),
          compressionThreshold: Math.floor(newMaxTokens * 0.6),
          lastUpdated: Date.now(),
          confidence: 'high' as const // 从实际错误学习，置信度最高
        };
        
        ContextWindowManager.modelConfigCache.set(modelKey, updatedConfig);
        
        this.logger.warn(`🔧 Learned from context error for ${modelKey}: ${cached.maxTokens} → ${newMaxTokens} tokens`);
      }
    }
  }

  /**
   * 检查错误是否为上下文限制错误
   */
  private isContextLimitError(errorMessage: string): boolean {
    const contextErrorIndicators = [
      'context length',
      'token limit',
      'maximum context',
      'too long',
      'context size',
      '4096', '8192', '16384', '32768'
    ];
    return contextErrorIndicators.some(indicator => errorMessage.includes(indicator));
  }

  /**
   * 🚀 用户配置覆盖：允许用户手动指定模型配置
   */
  private async loadUserModelConfig(modelName: string): Promise<{
    maxTokens?: number;
    warningThreshold?: number;
    compressionThreshold?: number;
  } | null> {
    try {
      const config = vscode.workspace.getConfiguration('srs-writer');
      const userModelConfigs = config.get<Record<string, any>>('modelConfigs', {});
      
      const userConfig = userModelConfigs[modelName];
      if (userConfig && typeof userConfig === 'object') {
        this.logger.info(`👤 Using user-defined config for ${modelName}`);
        return userConfig;
      }
    } catch (error) {
      this.logger.warn(`Failed to load user model config: ${(error as Error).message}`);
    }
    return null;
  }

  /**
   * 🚀 历史压缩：将多轮对话压缩为简洁摘要
   */
  private async compressHistoryToSummary(
    historyToCompress: Array<{ role: string; content: string; toolResults?: any[] }>,
    selectedModel: vscode.LanguageModelChat
  ): Promise<string | null> {
    try {
      // 构建压缩提示词
      const historyText = historyToCompress.map((item, index) => {
        if (item.toolResults) {
          const successCount = item.toolResults.filter(r => r.success).length;
          const toolNames = item.toolResults.map(r => r.toolName).join(', ');
          return `第${index + 1}步: 执行工具[${toolNames}] - ${successCount}/${item.toolResults.length}成功`;
        }
        return `${item.role}: ${item.content.substring(0, 100)}...`;
      }).join('\n');

      const compressionPrompt = `请将以下对话历史压缩为1-2句话的简洁摘要，重点关注：
1. 完成了哪些关键操作
2. 是否有失败需要修正
3. 当前进展状态

历史记录：
${historyText}

摘要（1-2句话）：`;

      const messages = [vscode.LanguageModelChatMessage.User(compressionPrompt)];
      const response = await selectedModel.sendRequest(messages, {
        justification: 'Compress conversation history for context management'
      });

      let summary = '';
      for await (const fragment of response.text) {
        summary += fragment;
      }

      return summary.trim();
    } catch (error) {
      this.logger.warn(`Failed to compress history: ${(error as Error).message}`);
      return null;
    }
  }
} 