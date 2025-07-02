import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SessionContext } from '../types/session';
import { AIPlan, AIResponseMode, CallerType } from '../types/index';
import { toolExecutor } from './toolExecutor';

// 导入拆分后的模块
import { PlanGenerator } from './orchestrator/PlanGenerator';
import { ConversationalExecutor } from './orchestrator/ConversationalExecutor';
import { PromptManager } from './orchestrator/PromptManager';
import { KnowledgeRetriever } from './orchestrator/KnowledgeRetriever';
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
  private knowledgeRetriever: KnowledgeRetriever;
  private toolCacheManager: ToolCacheManager;
  private resultFormatter: ResultFormatter;
  private contextWindowManager: ContextWindowManager;
  private planExecutor: PlanExecutor; // 🚀 新增计划执行器
  
  constructor() {
    // 🔧 新增：注册工具缓存失效监听器
    this.toolCacheManager = new ToolCacheManager();
    
    // 初始化所有模块
    this.planGenerator = new PlanGenerator();
    this.conversationalExecutor = new ConversationalExecutor();
    this.promptManager = new PromptManager();
    this.knowledgeRetriever = new KnowledgeRetriever();
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
    existingPlan?: AIPlan  // 🚀 新增：可选的已有计划，避免重复调用LLM
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
          userInput
        );
        
        this.logger.info(`🔍 [DEBUG] PlanExecutor returned: intent=${planExecutionResult.intent}`);
        return planExecutionResult;
      }
      
      // 知识问答模式
      if (initialPlan.response_mode === AIResponseMode.KNOWLEDGE_QA) {
        this.logger.info(`🔍 [DEBUG] Processing KNOWLEDGE_QA mode`);
        if (initialPlan.tool_calls && initialPlan.tool_calls.length > 0) {
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
          // 无工具调用，基于已有知识直接回答
          return {
            intent: 'direct_response',
            result: {
              mode: 'knowledge_qa',
              response: initialPlan.direct_response || '根据我的知识，我来为您解答...',
              thought: initialPlan.thought
            }
          };
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
      this.toolCacheManager.getTools.bind(this.toolCacheManager),
      this.knowledgeRetriever.retrieveRelevantKnowledge.bind(this.knowledgeRetriever)
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
   * 获取系统状态
   */
  async getSystemStatus(): Promise<any> {
    return {
      mode: 'Intelligent Triage & Multi-Modal AI Agent with Plan Execution',
      version: '4.0',
      status: 'Active',
      capabilities: [
        '🧠 智能分诊 (Intelligent Triage)',
        '🚀 计划执行 (Plan Execution)', // 新增
        '💬 多模态响应 (Multi-Modal Response)',
        '🔄 对话式规划循环 (Conversational Planning)',
        '🚀 自我修正与适应 (Self-Correction)',
        '📚 RAG知识检索增强 (RAG Enhancement)',
        '🛠️ 智能工具协调执行 (Tool Orchestration)'
      ],
      responseMode: {
        PLAN_EXECUTION: 'For complex multi-step tasks requiring specialist coordination',
        TOOL_EXECUTION: 'For actionable tasks requiring tool execution',
        KNOWLEDGE_QA: 'For knowledge-based questions, expert advice, and general conversation'
      }
    };
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.logger.info('🧹 Orchestrator disposed');
  }
} 