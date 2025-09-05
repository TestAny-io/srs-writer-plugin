import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SessionContext } from '../types/session';
import { AIPlan, AIResponseMode, CallerType, SpecialistProgressCallback } from '../types/index';
import { toolExecutor } from './toolExecutor';

// 导入拆分后的模块
import { PlanGenerator } from './orchestrator/PlanGenerator';
import { ConversationalExecutor } from './orchestrator/ConversationalExecutor';
import { PromptManager } from './orchestrator/PromptManager';
import { ToolCacheManager } from './orchestrator/ToolCacheManager';
import { ResultFormatter } from './orchestrator/ResultFormatter';
import { ContextWindowManager } from './orchestrator/ContextWindowManager';
import { PlanExecutor } from './orchestrator/PlanExecutor';
import { SpecialistExecutor } from './specialistExecutor';

/**
 * SRS规划编排器 v4.0 - 新增计划执行模式
 * 
 * 🚀 核心特性：
 * - 智能分诊：根据意图选择合适的执行模式
 * - 计划执行：新增PLAN_EXECUTION模式，支持复杂多步骤任务
 * - 对话式执行：支持多轮思维链规划
 * - 自我修正：失败时自动调整策略
 * - 上下文管理：动态管理对话历史和工具结果
 * - 缓存优化：智能缓存工具定义，提升性能
 */
export class Orchestrator {
  private logger = Logger.getInstance();
  private useAIOrchestrator: boolean = true;
  
  // 拆分后的模块实例
  private planGenerator: PlanGenerator;
  private conversationalExecutor: ConversationalExecutor;
  private promptManager: PromptManager;
  private toolCacheManager: ToolCacheManager;
  private resultFormatter: ResultFormatter;
  private contextWindowManager: ContextWindowManager;
  public planExecutor: PlanExecutor; // 🚀 改为 public，供 SRSAgentEngine 访问
  
  constructor() {
    // 🔧 新增：注册工具缓存失效监听器
    this.toolCacheManager = new ToolCacheManager();
    
    // 初始化所有模块
    this.planGenerator = new PlanGenerator();
    this.conversationalExecutor = new ConversationalExecutor();
    this.promptManager = new PromptManager();
    this.resultFormatter = new ResultFormatter();
    this.contextWindowManager = new ContextWindowManager();
    
    // 🚀 新增：初始化计划执行器，注入专家执行器
    this.planExecutor = new PlanExecutor(new SpecialistExecutor());
    
    this.logger.info('🚀 Orchestrator v4.0 initialized with PLAN_EXECUTION support');
    
    // 加载配置
    this.loadConfiguration();
  }

  /**
   * 🚀 智能规划引擎入口（v4.0版本）- 基于意图的智能分诊 + 计划执行
   */
  public async planAndExecute(
    userInput: string,
    sessionContext: SessionContext,
    selectedModel: vscode.LanguageModelChat,
    existingPlan?: AIPlan,  // 🚀 新增：可选的已有计划，避免重复调用LLM
    progressCallback?: SpecialistProgressCallback  // 🚀 新增：specialist进度回调
  ): Promise<{ intent: string; result?: any }> {
    this.logger.info(`🎯 Planning for: ${userInput}`);

    try {
      // 🚀 修复递归调用：优先使用已有计划，避免重复生成
      let initialPlan: AIPlan;
      if (existingPlan) {
        this.logger.info(`🔍 [DEBUG] planAndExecute: Using existing plan, skipping generateUnifiedPlan`);
        initialPlan = existingPlan;
      } else {
        // 第一阶段：智能分诊 - 🚀 新架构的核心
        this.logger.info(`🔍 [DEBUG] planAndExecute: Calling generateUnifiedPlan...`);
        initialPlan = await this.generateUnifiedPlan(userInput, sessionContext, selectedModel);
      }
      
      this.logger.info(`🔍 [DEBUG] planAndExecute: Initial plan generated with mode: ${initialPlan.response_mode}`);
      
      // 🚀 新增：计划执行模式 - 处理复杂的多步骤任务
      if (initialPlan.response_mode === AIResponseMode.PLAN_EXECUTION && initialPlan.execution_plan) {
        this.logger.info(`🚀 检测到PLAN_EXECUTION模式，移交给PlanExecutor处理`);
        this.logger.info(`🔍 [DEBUG] Execution plan details: planId=${initialPlan.execution_plan.planId}, steps=${initialPlan.execution_plan.steps?.length || 0}`);
        
        const planExecutionResult = await this.planExecutor.execute(
          initialPlan.execution_plan,
          sessionContext,
          selectedModel,
          userInput,
          progressCallback
        );
        
        this.logger.info(`🔍 [DEBUG] PlanExecutor returned: intent=${planExecutionResult.intent}`);
        return planExecutionResult;
      }
      
      // 知识问答模式
      if (initialPlan.response_mode === AIResponseMode.KNOWLEDGE_QA) {
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] Orchestrator处理KNOWLEDGE_QA模式`);
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - 是否有direct_response: ${!!initialPlan.direct_response}`);
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - 是否有tool_calls: ${!!(initialPlan.tool_calls && initialPlan.tool_calls.length > 0)}`);
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - thought: ${initialPlan.thought?.substring(0, 100) || 'null'}`);
        
        if (initialPlan.tool_calls && initialPlan.tool_calls.length > 0) {
          this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] 有工具调用，进入ConversationalExecutor`);
          // 有工具调用（如知识检索），进入执行流程
          return await this.conversationalExecutor.executeConversationalPlanning(
            userInput,
            sessionContext,
            selectedModel,
            initialPlan,
            this.generateUnifiedPlan.bind(this),
            this.formatToolResults.bind(this),
            CallerType.ORCHESTRATOR_KNOWLEDGE_QA
          );
        } else {
          this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] 无工具调用，直接返回响应`);
          this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - direct_response长度: ${initialPlan.direct_response?.length || 0}`);
          
          const result = {
            intent: 'direct_response',
            result: {
              mode: 'knowledge_qa',
              response: initialPlan.direct_response || '根据我的知识，我来为您解答...',
              thought: initialPlan.thought
            }
          };
          
          this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] 准备返回结果:`);
          this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - intent: ${result.intent}`);
          this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - result.mode: ${result.result.mode}`);
          this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - result.response长度: ${result.result.response.length}`);
          
          return result;
        }
      }
    
      // 工具执行模式
      if (initialPlan.response_mode === AIResponseMode.TOOL_EXECUTION) {
        this.logger.info(`🔍 [DEBUG] Processing TOOL_EXECUTION mode`);
        if (initialPlan.tool_calls && initialPlan.tool_calls.length > 0) {
          try {
            // 🚀 对话式执行：多轮思维链 + 自我修正
            const executionResult = await this.conversationalExecutor.executeConversationalPlanning(
              userInput,
              sessionContext,
              selectedModel,
              initialPlan,
              this.generateUnifiedPlan.bind(this),
              this.formatToolResults.bind(this),
              CallerType.ORCHESTRATOR_TOOL_EXECUTION
            );
            
            // 🚀 处理聊天交互需求
            if (executionResult.intent === 'chat_interaction_needed') {
              return {
                intent: 'user_interaction_required',
                result: {
                  mode: 'chat_question',
                  question: executionResult.result.question,
                  summary: executionResult.result.summary,
                  response: executionResult.result.summary,
                  thought: `任务进行中，需要用户确认：${executionResult.result.question}`,
                  awaitingUserResponse: true,
                  resumeContext: executionResult.result.resumeContext
                }
              };
            }
            
            return executionResult;
          } catch (error) {
            // 🚀 降级策略：TOOL_EXECUTION 失败时降级到 KNOWLEDGE_QA
            this.logger.warn(`TOOL_EXECUTION failed, falling back to KNOWLEDGE_QA mode: ${(error as Error).message}`);
            
            const fallbackPlan: AIPlan = {
              thought: `原始工具执行失败，现在以知识问答模式回答：${userInput}`,
              response_mode: AIResponseMode.KNOWLEDGE_QA,
              direct_response: null,
              tool_calls: [
                { name: 'readLocalKnowledge', args: { query: userInput } }
              ]
            };
            
            return await this.conversationalExecutor.executeConversationalPlanning(
              userInput,
              sessionContext,
              selectedModel,
              fallbackPlan,
              this.generateUnifiedPlan.bind(this),
              this.formatToolResults.bind(this),
              CallerType.ORCHESTRATOR_KNOWLEDGE_QA
            );
          }
        } else {
          // 没有有效工具调用时，降级到 KNOWLEDGE_QA 模式
          this.logger.info('No valid tool calls in TOOL_EXECUTION, falling back to KNOWLEDGE_QA');
          return {
            intent: 'fallback_to_knowledge',
            result: {
              mode: 'knowledge_qa',
              response: `我理解您想要：${userInput}。让我用知识问答的方式来帮助您。`,
              thought: `没有找到合适的工具执行，转为知识问答模式`
            }
          };
        }
      }

      // 兜底：未知模式的处理
      this.logger.warn(`Unknown response mode: ${initialPlan.response_mode}`);
      return {
        intent: 'unknown_mode',
        result: {
          mode: 'fallback',
          response: '抱歉，我无法理解您的请求。能请您换一种方式表达吗？',
          thought: initialPlan.thought
        }
      };
      
    } catch (error) {
      this.logger.error('Planning and execution failed', error as Error);
      return {
        intent: 'execution_error',
        result: {
          mode: 'error',
          error: (error as Error).message,
          response: '抱歉，在处理您的请求时遇到了技术问题。请稍后重试。'
        }
      };
    }
  }

  /**
   * 🚀 生成统一的AI执行计划（v4.0版本：支持PLAN_EXECUTION模式）
   */
  public async generateUnifiedPlan(
    userInput: string,
    sessionContext: SessionContext,
    selectedModel: vscode.LanguageModelChat,
    historyContext?: string,
    toolResultsContext?: string
  ): Promise<AIPlan> {
    return await this.planGenerator.generateUnifiedPlan(
      userInput,
      sessionContext,
      selectedModel,
      (userInput: string, sessionContext: SessionContext, historyContext: string, toolResultsContext: string) => 
        this.buildAdaptiveToolPlanningPrompt(userInput, sessionContext, historyContext, toolResultsContext),
      historyContext,
      toolResultsContext
    );
  }

  /**
   * 🚀 构建自适应工具规划提示词
   */
  public async buildAdaptiveToolPlanningPrompt(
    userInput: string,
    sessionContext: SessionContext,
    historyContext: string,
    toolResultsContext: string
  ): Promise<string> {
    return await this.promptManager.buildAdaptiveToolPlanningPrompt(
      userInput,
      sessionContext,
      historyContext,
      toolResultsContext,
      this.toolCacheManager.getTools.bind(this.toolCacheManager)
    );
  }

  /**
   * 🚀 工具结果格式化
   */
  public formatToolResults(toolResults: any[]): string {
    return this.resultFormatter.formatToolResults(toolResults);
  }

  /**
   * 🚀 获取工具定义
   */
  public async getTools(caller?: CallerType): Promise<{ definitions: any[], jsonSchema: string }> {
    return await this.toolCacheManager.getTools(caller || CallerType.ORCHESTRATOR_TOOL_EXECUTION);
  }

  /**
   * 加载配置
   */
  private loadConfiguration(): void {
    try {
      const config = vscode.workspace.getConfiguration('srs-writer');
      this.useAIOrchestrator = config.get('useAIOrchestrator', true);
      
      this.logger.info(`Orchestrator configuration loaded: AI=${this.useAIOrchestrator}`);
    } catch (error) {
      this.logger.warn(`Failed to load configuration: ${(error as Error).message}`);
    }
  }

  /**
   * 获取系统状态 - 简化版本，只返回基本信息
   */
  async getSystemStatus(): Promise<any> {
    // 动态获取真实的插件版本
    const packageJson = require('../../package.json');
    return {
      version: packageJson.version,
      architecture: 'Global Engine v6.0',
      status: 'Active'
    };
  }

  /**
   * 清理资源
   */
  /**
   * 🚀 v6.0：设置Plan执行取消检查回调
   * 
   * 用于让PlanExecutor能够检查全局引擎是否被取消
   */
  public setPlanCancelledCheckCallback(callback: () => boolean): void {
    this.planExecutor.setCancelledCheckCallback(callback);
  }

  /**
   * 🚀 v6.0：清理项目上下文
   * 
   * 在项目切换后清理Orchestrator的所有缓存状态，防止上下文污染
   * 注意：必须在archive完成后调用，确保数据落盘安全
   */
  public clearProjectContext(): void {
    this.logger.info('🧹 [CONTEXT CLEANUP] Starting project context cleanup...');
    
    try {
      // 1. 清理工具缓存
      this.toolCacheManager.invalidateToolCache();
      this.logger.info('✅ [CONTEXT CLEANUP] Tool cache cleared');
      
      // 2. 清理上下文窗口缓存
      // ContextWindowManager使用静态缓存，需要清理
      const contextCacheSize = (ContextWindowManager as any).modelConfigCache?.size || 0;
      if ((ContextWindowManager as any).modelConfigCache) {
        (ContextWindowManager as any).modelConfigCache.clear();
        this.logger.info(`✅ [CONTEXT CLEANUP] Context window cache cleared (${contextCacheSize} entries)`);
      }
      
      // 3. 重新初始化核心组件以确保干净状态
      this.planGenerator = new PlanGenerator();
      this.conversationalExecutor = new ConversationalExecutor();
      this.promptManager = new PromptManager();
      this.resultFormatter = new ResultFormatter();
      // toolCacheManager 和 contextWindowManager 保持实例但已清理缓存
      
      this.logger.info('✅ [CONTEXT CLEANUP] Project context cleanup completed successfully');
      
    } catch (error) {
      this.logger.error('❌ [CONTEXT CLEANUP] Failed to clear project context:', error as Error);
      // 即使清理失败也不应该阻止项目切换，记录错误即可
    }
  }

  public dispose(): void {
    this.logger.info('🧹 Orchestrator disposed');
  }
} 