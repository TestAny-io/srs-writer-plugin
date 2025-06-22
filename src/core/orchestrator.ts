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

/**
 * SRS规划编排器 v3.0 - 分层架构，智能分诊与对话式执行
 * 
 * 🚀 核心特性：
 * - 智能分诊：根据意图选择合适的执行模式
 * - 对话式执行：支持多轮思维链规划
 * - 自我修正：失败时自动调整策略
 * - 上下文管理：动态管理对话历史和工具结果
 * - 缓存优化：智能缓存工具定义，提升性能
 */
export class Orchestrator {
  private logger = Logger.getInstance();
  private useAIOrchestrator: boolean = true;
  
  // 🚀 旧的缓存变量保留用于向后兼容
  private availableToolsCache: any[] | null = null;
  private toolsJsonSchemaCache: string | null = null;
  
  // 拆分后的模块实例
  private planGenerator: PlanGenerator;
  private conversationalExecutor: ConversationalExecutor;
  private promptManager: PromptManager;
  private knowledgeRetriever: KnowledgeRetriever;
  private toolCacheManager: ToolCacheManager;
  private resultFormatter: ResultFormatter;
  private contextWindowManager: ContextWindowManager;
  
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
    
    this.logger.info('🚀 Orchestrator v3.0 initialized with modular architecture');
    
    // 加载配置
    this.loadConfiguration();
  }



  /**
   * 🚀 智能规划引擎入口（v3.0版本）- 基于意图的智能分诊
   */
  public async planAndExecute(
    userInput: string,
    sessionContext: SessionContext,
    selectedModel: vscode.LanguageModelChat
  ): Promise<{ intent: string; result?: any }> {
    this.logger.info(`🎯 Planning for: ${userInput}`);

    try {
      // 第一阶段：智能分诊 - 🚀 新架构的核心
      const initialPlan = await this.generateUnifiedPlan(userInput, sessionContext, selectedModel);
      
      // 🚀 核心逻辑：基于AI的智能分诊
      if (initialPlan.response_mode === AIResponseMode.GENERAL_CHAT || 
          initialPlan.response_mode === AIResponseMode.KNOWLEDGE_QA) {
        // 直接对话模式：无需工具，立即响应
        return {
          intent: 'direct_response',
          result: {
            mode: 'direct_chat',
            response: initialPlan.direct_response || '我已理解您的需求。',
            thought: initialPlan.thought
          }
        };
      }
      
      // 第二阶段：工具执行模式 - 判断是否有有效的工具调用
      if (initialPlan.response_mode === AIResponseMode.TOOL_EXECUTION) {
        // 检查是否有有效的工具调用
        if (initialPlan.tool_calls && initialPlan.tool_calls.length > 0) {
          // 🚀 对话式执行：多轮思维链 + 自我修正
          return await this.conversationalExecutor.executeConversationalPlanning(
            userInput,
            sessionContext,
            selectedModel,
            initialPlan, // 🚀 传递初始计划
            this.generateUnifiedPlan.bind(this), // 传递生成器方法
            this.formatToolResults.bind(this) // 传递格式化器方法
          );
        } else {
          // 没有有效工具调用时，返回指导性响应
          const guidanceResponse = await this.generateGuidanceResponse(userInput, sessionContext);
          return {
            intent: 'guidance_response',
            result: {
              mode: 'guidance',
              response: guidanceResponse,
              thought: initialPlan.thought
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
   * 🚀 生成统一的AI执行计划（v3.0版本：支持智能分诊、对话式执行和状态管理）
   * 
   * Code Review优化：支持分离的上下文参数
   */
  public async generateUnifiedPlan(
    userInput: string,
    sessionContext: SessionContext,
    selectedModel: vscode.LanguageModelChat,
    historyContext?: string, // 🚀 Code Review修复：接受字符串历史上下文
    toolResultsContext?: string // 🚀 Code Review修复：接受字符串工具结果上下文
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

  // ============================================================================
  // 📦 基础辅助方法 - 保持向后兼容性
  // ============================================================================

  /**
   * 🚀 解析AI计划响应（v3.0版本：支持智能分诊格式）
   */
  public parseAIPlanFromResponse(responseText: string): AIPlan {
    return this.planGenerator.parseAIPlanFromResponse(responseText);
  }

  /**
   * 🚀 解析AI返回的工具规划（增强版：支持思维链格式）
   */
  public parseToolPlanFromResponse(response: string): Array<{ name: string; args: any }> {
    return this.planGenerator.parseToolPlanFromResponse(response);
  }

  /**
   * 🚀 构建自适应工具规划提示词（v3.0版本：基于orchestrator.md模板）
   * 
   * Code Review优化：支持分离的上下文参数
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
   * 🚀 健壮的模板路径解析 - 多环境支持
   */
  public async resolveTemplatePath(templateFileName: string): Promise<string> {
    return await this.promptManager.resolveTemplatePath(templateFileName);
  }

  /**
   * 🚀 RAG知识检索：基于用户输入和上下文检索相关知识（增强版：集成预处理分析）
   */
  public async retrieveRelevantKnowledge(userInput: string, sessionContext: SessionContext): Promise<string | null> {
    return await this.knowledgeRetriever.retrieveRelevantKnowledge(userInput, sessionContext);
  }

  /**
   * 🚀 工具结果格式化：生成结构化的执行报告
   */
  public formatToolResults(toolResults: any[]): string {
    return this.resultFormatter.formatToolResults(toolResults);
  }

  /**
   * 🚀 获取工具定义（向后兼容）
   */
  public async getTools(caller?: CallerType): Promise<{ definitions: any[], jsonSchema: string }> {
    // 默认使用 TOOL_EXECUTION 模式，拥有最高权限（向后兼容）
    return await this.toolCacheManager.getTools(caller || CallerType.ORCHESTRATOR_TOOL_EXECUTION);
  }

  /**
   * 生成指导性响应（当无法生成工具计划时）
   */
  private async generateGuidanceResponse(userInput: string, sessionContext: SessionContext): Promise<string> {
    // 🚀 修复：使用缓存机制获取工具定义
    const { definitions } = await this.getTools();
    const availableTools = definitions.map(t => t.name);
    const hasProject = !!sessionContext.projectName;
    
    if (!hasProject) {
      return `目前没有活跃的项目。可用的操作包括：${availableTools.join(', ')}。请先创建一个项目或打开现有项目。`;
    }
    
    return `我理解您的请求是："${userInput}"。当前可用的工具有：${availableTools.join(', ')}。请尝试更具体地描述您想要执行的操作。`;
  }

  /**
   * 检查模型使用权限
   */
  private async checkModelPermissions(model: vscode.LanguageModelChat): Promise<boolean> {
    try {
      return model && typeof model.sendRequest === 'function';
    } catch (error) {
      this.logger.warn('Failed to check model permissions');
      return false;
    }
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
   * 动态切换AI模式
   */
  public setAIMode(enabled: boolean): void {
    this.useAIOrchestrator = enabled;
    this.logger.info(`Orchestrator AI mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 🔧 工具缓存失效机制 - 解决工具更新不被感知的问题
   */
  public invalidateToolCache(): void {
    this.availableToolsCache = null;
    this.toolsJsonSchemaCache = null;
    this.toolCacheManager.invalidateToolCache();
    this.logger.info('🔄 Tool cache invalidated - tools will be reloaded on next access');
  }

  /**
   * 获取当前状态
   */
  public async getStatus(): Promise<{ 
    aiMode: boolean; 
    toolMode: boolean;
    availableTools: string[];
  }> {
    // 🚀 修复：使用缓存机制获取工具定义
    const { definitions } = await this.getTools();
    return {
      aiMode: this.useAIOrchestrator,
      toolMode: true, // v3.0 always in tool mode
      availableTools: definitions.map(t => t.name)
    };
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<any> {
    const toolStats = toolExecutor.getExecutionStats();

    return {
      mode: 'Intelligent Triage & Multi-Modal AI Agent',
      version: '3.0',
      status: 'Active',
      toolSystem: toolStats,
      capabilities: [
        '🧠 智能分诊 (Intelligent Triage)',
        '💬 多模态响应 (Multi-Modal Response)',
        '🔄 对话式规划循环 (Conversational Planning)',
        '🚀 自我修正与适应 (Self-Correction)',
        '📚 RAG知识检索增强 (RAG Enhancement)',
        '🛠️ 智能工具协调执行 (Tool Orchestration)',
        '📝 智能需求管理 (Requirement Management)',
        '📄 基于模板的提示词生成 (Template-based Prompting)',
        '🔧 编辑器深度集成 (Editor Integration)'
      ],
      features: {
        intelligentTriage: true,
        multiModalResponse: true,
        templateBasedPrompting: true,
        chainOfThought: true,
        conversationalPlanning: true,
        selfCorrection: true,
        ragKnowledgeRetrieval: true,
        adaptiveToolExecution: true,
        jsonRepairSupport: true
      },
      responseMode: {
        TOOL_EXECUTION: 'For actionable tasks requiring tool execution',
        KNOWLEDGE_QA: 'For knowledge-based questions and expert advice',
        GENERAL_CHAT: 'For casual conversation and greetings'
      }
    };
  }

  /**
   * 重置系统状态
   */
  async resetSystem(): Promise<void> {
    toolExecutor.resetStats();
    
    // 🚀 新增：清理工具缓存，以便下次使用时重新加载
    this.availableToolsCache = null;
    this.toolsJsonSchemaCache = null;
    
    this.toolCacheManager.invalidateToolCache();
    
    this.logger.info('🔄 System reset completed (including tool cache)');
  }

  // ============================================================================
  // 🔧 废弃的方法保留 - 向后兼容
  // ============================================================================

  /**
   * @deprecated 请使用 planAndExecute 方法
   */
  public async orchestratePlanning(
    userInput: string,
    sessionContext: SessionContext,
    selectedModel: vscode.LanguageModelChat
  ): Promise<{ intent: string; result?: any }> {
    this.logger.warn('⚠️ orchestratePlanning is deprecated, use planAndExecute instead');
    return await this.planAndExecute(userInput, sessionContext, selectedModel);
  }

  /**
   * @deprecated 请使用 planAndExecute 方法
   */
  public async processUserInput(
    userInput: string, 
    sessionContext: SessionContext,
    selectedModel: vscode.LanguageModelChat
  ): Promise<{ intent: string; result?: any }> {
    this.logger.warn('⚠️ processUserInput is deprecated, use planAndExecute instead');
    return await this.planAndExecute(userInput, sessionContext, selectedModel);
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.logger.info('🧹 Orchestrator disposed');
  }
}
