import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SessionContext } from '../types/session';
import { AIPlan, AIResponseMode, ToolExecutionResult, createToolExecutionResult, ErrorCodes } from '../types/index';
import { toolRegistry, ToolDefinition } from '../tools/index';

// 导入拆分后的模块
import { AgentState, ExecutionStep, InteractionRequest, ToolCallResult } from './engine/AgentState';
import { UserInteractionHandler } from './engine/UserInteractionHandler';
import { ToolClassifier } from './engine/ToolClassifier';
import { ToolExecutionHandler } from './engine/ToolExecutionHandler';
import { LoopDetector } from './engine/LoopDetector';
import { ContextManager } from './engine/ContextManager';

/**
 * SRS Agent Engine - 智能执行引擎架构
 * 基于业界最佳实践的Autonomous + Transparent执行模式
 */
export class SRSAgentEngine {
  private state: AgentState;
  private stream: vscode.ChatResponseStream;
  private logger = Logger.getInstance();
  private sessionContext: SessionContext;
  private selectedModel: vscode.LanguageModelChat;
  
  // 依赖注入的组件
  private orchestrator?: any;
  private toolExecutor?: any;
  
  // 🚀 新增：拆分后的模块实例
  private userInteractionHandler: UserInteractionHandler;
  private toolClassifier: ToolClassifier;
  private toolExecutionHandler: ToolExecutionHandler;
  private loopDetector: LoopDetector;
  private contextManager: ContextManager;
  
  // 🚀 新增：增强的循环检测历史记录
  private recentToolCallHistory: Array<{toolName: string, iteration: number}> = [];

  constructor(
    stream: vscode.ChatResponseStream,
    sessionContext: SessionContext,
    selectedModel: vscode.LanguageModelChat
  ) {
    this.stream = stream;
    this.sessionContext = sessionContext;
    this.selectedModel = selectedModel;
    
    this.state = {
      stage: 'planning',
      currentTask: '',
      executionHistory: [],
      iterationCount: 0,
      maxIterations: 15
    };

    // 初始化拆分后的模块
    this.userInteractionHandler = new UserInteractionHandler();
    this.toolClassifier = new ToolClassifier();
    this.toolExecutionHandler = new ToolExecutionHandler();
    this.loopDetector = new LoopDetector();
    this.contextManager = new ContextManager();

    this.logger.info('🚀 SRSAgentEngine initialized - Autonomous + Transparent mode');
  }

  /**
   * 设置依赖组件
   */
  public setDependencies(orchestrator: any, toolExecutor: any): void {
    this.orchestrator = orchestrator;
    this.toolExecutor = toolExecutor;
  }

  /**
   * 🚀 新增：更新当前交互参数但保持引擎状态
   * 
   * 这是持久化引擎架构的关键方法，允许引擎在多次交互间复用
   * 同时保持执行历史和等待状态
   */
  public updateStreamAndModel(
    stream: vscode.ChatResponseStream,
    model: vscode.LanguageModelChat
  ): void {
    this.stream = stream;
    this.selectedModel = model;
    // 注意：不重置state，保持引擎的记忆和状态
    this.logger.info('🔄 Engine stream and model updated, state preserved');
  }

  /**
   * 主执行循环 - 持久化版本 🚀 
   * 
   * 重要修改：新任务不再完全重置状态，而是保留执行历史
   * 这是实现持久化智能代理的关键
   */
  public async executeTask(userInput: string): Promise<void> {
    // 🐛 DEBUG: 记录接收到的userInput参数
    this.logger.info(`🔍 [DEBUG] executeTask received userInput: "${userInput}"`);
    
    // 如果引擎正在等待用户输入，这是一个错误的调用
    if (this.isAwaitingUser()) {
      this.logger.warn('executeTask called while engine is awaiting user input');
      return;
    }
    
    // 🚀 持久化架构：保留执行历史，只重置当前任务相关状态
    this.state.currentTask = userInput;
    this.state.stage = 'planning';
    this.state.iterationCount = 0;
    this.state.pendingInteraction = undefined;
    
    // 🐛 DEBUG: 记录设置后的currentTask值
    this.logger.info(`🔍 [DEBUG] executeTask set this.state.currentTask to: "${this.state.currentTask}"`);
    this.logger.info(`🔍 [DEBUG] executeTask state after setting: stage=${this.state.stage}, iterationCount=${this.state.iterationCount}`);
    
    // 🚀 关键修改：保留执行历史，添加任务分隔符
    if (this.state.executionHistory.length > 0) {
      this.recordExecution('result', `--- 新任务开始: ${userInput} ---`, true);
    }
    
    // 限制历史记录大小，避免内存无限增长
    if (this.state.executionHistory.length > 100) {
      this.state.executionHistory = this.state.executionHistory.slice(-50);
      this.logger.info('🗑️ Trimmed execution history to prevent memory overflow');
    }

    this.stream.markdown('🚀 **开始分析任务...**\n\n');

    // 调用新的执行循环方法
    await this._runExecutionLoop();

    // 根据最终状态显示总结
    this.displayExecutionSummary();
  }

  /**
   * 内部执行循环 - 可重用的执行逻辑 🚀
   * 
   * 从executeTask中提取出来，以便在handleUserResponse中重新启动执行
   */
  private async _runExecutionLoop(): Promise<void> {
    while (this.shouldContinueExecution()) {
      try {
        await this.executeIteration();
        this.state.iterationCount++;
        
        if (this.loopDetector.detectInfiniteLoop(this.state)) {
          await this.loopDetector.handleInfiniteLoop(
            this.state,
            this.stream,
            this.recordExecution.bind(this)
          );
          break;
        }
        
      } catch (error) {
        await this.handleError(error as Error);
        break;
      }
    }
  }

  /**
   * 完整的用户响应处理逻辑
   */
  public async handleUserResponse(response: string): Promise<void> {
    if (this.state.stage !== 'awaiting_user' || !this.state.pendingInteraction) {
        this.stream.markdown('⚠️ 当前没有等待用户输入的操作。\n\n');
        return;
    }
    
    const interaction = this.state.pendingInteraction;
    this.stream.markdown(`👤 **您的回复**: ${response}\n\n`);
    
    // 记录用户交互
    this.recordExecution('user_interaction', `用户回复: ${response}`, true);
    
    try {
        let shouldReturnToWaiting = false;
        
        // 根据交互类型处理用户响应
        switch (interaction.type) {
            case 'confirmation':
                const confirmResult = await this.userInteractionHandler.handleConfirmationResponse(
                  response, 
                  interaction,
                  this.stream,
                  this.recordExecution.bind(this),
                  this.handleAutonomousTool.bind(this)
                );
                shouldReturnToWaiting = confirmResult.shouldReturnToWaiting;
                break;
                
            case 'choice':
                const choiceResult = await this.userInteractionHandler.handleChoiceResponse(
                  response, 
                  interaction,
                  this.stream,
                  this.recordExecution.bind(this),
                  this.handleAutonomousTool.bind(this)
                );
                shouldReturnToWaiting = choiceResult.shouldReturnToWaiting;
                break;
                
            case 'input':
                const inputResult = await this.userInteractionHandler.handleInputResponse(
                  response, 
                  interaction,
                  this.stream,
                  this.recordExecution.bind(this),
                  this.handleAutonomousTool.bind(this)
                );
                shouldReturnToWaiting = inputResult.shouldReturnToWaiting;
                break;
                
            default:
                this.stream.markdown(`⚠️ 未知的交互类型: ${interaction.type}\n\n`);
                break;
        }
        
        if (shouldReturnToWaiting) {
          this.state.stage = 'awaiting_user';
          return;
        }
        
    } catch (error) {
        this.logger.error('处理用户响应时出错', error as Error);
        this.stream.markdown(`❌ 处理您的回复时出现错误: ${(error as Error).message}\n\n`);
    }
    
    // 清除交互状态
    this.state.pendingInteraction = undefined;
    this.state.stage = 'executing';
    
    // 继续执行
    this.stream.markdown(`🔄 **继续执行任务...**\n\n`);

    // 🚀 核心修复：重新启动执行循环
    await this._runExecutionLoop();

    // 🚀 重要补充：当循环结束后，显示总结
    this.displayExecutionSummary();
  }

  // ============================================================================
  // 📦 基础执行方法
  // ============================================================================

  // 基础方法实现
  private shouldContinueExecution(): boolean {
    return this.state.stage !== 'completed' && 
           this.state.stage !== 'error' &&
           this.state.stage !== 'awaiting_user' &&
           this.state.iterationCount < this.state.maxIterations;
  }

  private async executeIteration(): Promise<void> {
    this.logger.info(`🔄 执行第 ${this.state.iterationCount + 1} 轮迭代`);
    
    // 1. AI规划阶段
    const plan = await this.generatePlan();
    
    // 2. 透明显示AI思考过程
    this.stream.markdown(`> 🤖 **AI思考**: ${plan.thought}\n\n`);
    this.recordExecution('thought', plan.thought);
    
    // 3. 检查响应模式
    if (plan.response_mode === AIResponseMode.KNOWLEDGE_QA) {
      // 🚀 修复：KNOWLEDGE_QA现在支持工具调用
      if (plan.direct_response) {
        // 有直接回复，显示并完成
        this.stream.markdown(`💬 **AI回复**: ${plan.direct_response}\n\n`);
        this.recordExecution('result', plan.direct_response, true);
        this.state.stage = 'completed';
        return;
      } else if (plan.tool_calls && plan.tool_calls.length > 0) {
        // 没有直接回复但有工具调用，继续执行工具（如知识检索）
        // 不要return，让代码继续到工具执行部分
      } else {
        // 既没有回复也没有工具调用，任务完成
        this.state.stage = 'completed';
        return;
      }
    }
    
    // 4. 工具执行模式 - 🚀 使用增强的智能分类系统
    if (plan.tool_calls && plan.tool_calls.length > 0) {
      let hasNewToolCalls = false;
      
      for (const toolCall of plan.tool_calls) {
        // 检查是否是finalAnswer工具
        if (toolCall.name === 'finalAnswer') {
          await this.handleFinalAnswer(toolCall);
          this.state.stage = 'completed';
          return;
        }
        
        // 🚀 Code Review修复：添加整体重复检测
        const recentExecution = this.loopDetector.hasRecentToolExecution(toolCall.name, toolCall.args, this.state.executionHistory);
        if (recentExecution) {
          this.stream.markdown(`⏭️ **跳过重复调用**: ${toolCall.name} (30秒内已执行)\n`);
          this.recordExecution(
            'tool_call_skipped', 
            `跳过重复: ${toolCall.name}`, 
            true, 
            toolCall.name, 
            { reason: 'duplicate_in_time_window' }, 
            toolCall.args
          );
          continue; // 跳过这个工具
        }
        
        hasNewToolCalls = true;
        
        // 🚀 使用增强的工具分类系统
        const classification = this.toolClassifier.classifyTool(toolCall, this.state.executionHistory);
        
        // 根据分类结果执行不同的处理逻辑
        switch (classification.type) {
          case 'interactive':
            // 交互工具：需要用户输入
            await this.handleInteractiveTool(toolCall);
            return; // 暂停执行，等待用户响应
            
          case 'confirmation':
            // 确认工具：根据requiresConfirmation决定是否需要确认
            if (classification.requiresConfirmation) {
              await this.handleConfirmationTool(toolCall, classification);
              return; // 等待用户确认
            } else {
              // 风险评估后允许自动执行
              await this.handleAutonomousTool(toolCall);
            }
            break;
            
          case 'autonomous':
          default:
            // 自主工具：直接执行
            await this.handleAutonomousTool(toolCall);
            break;
        }
      }
      
      // 🚀 Code Review修复：关键逻辑 - 如果所有工具都被跳过
      if (!hasNewToolCalls) {
        this.stream.markdown(`🔄 **所有工具都已执行过，启动智能总结**\n\n`);
        await this.loopDetector.forceDirectResponse(
          this.state,
          this.stream,
          this.recordExecution.bind(this)
        );
        return;
      }
    } else {
      // 没有工具调用，任务可能完成
      this.state.stage = 'completed';
    }
  }

  private async handleError(error: Error): Promise<void> {
    this.logger.error('Agent执行错误', error as Error);
    this.state.stage = 'error';
    this.stream.markdown(`❌ **执行过程中发生错误**: ${error.message}\n\n`);
  }

  public getState(): AgentState {
    return { ...this.state };
  }

  public isAwaitingUser(): boolean {
    return this.state.stage === 'awaiting_user';
  }

  // ============================================================================
  // 核心方法实现
  // ============================================================================

  /**
   * 生成执行计划 - 调用Orchestrator规划专家 🚀 Code Review优化版本
   */
  private async generatePlan(): Promise<AIPlan> {
    if (!this.orchestrator) {
      throw new Error('Orchestrator未初始化');
    }
    
    // 🐛 DEBUG: 记录generatePlan中使用的currentTask值
    this.logger.info(`🔍 [DEBUG] generatePlan using this.state.currentTask: "${this.state.currentTask}"`);
    this.logger.info(`🔍 [DEBUG] generatePlan state context: stage=${this.state.stage}, iterationCount=${this.state.iterationCount}, executionHistory.length=${this.state.executionHistory.length}`);
    
    try {
      // 🚀 Code Review修复：构建分离的上下文
      const { historyContext, toolResultsContext } = this.contextManager.buildContextForPrompt(this.state.executionHistory);
      
      // 调用Orchestrator的规划方法
      const plan = await this.orchestrator.generateUnifiedPlan(
        this.state.currentTask,
        this.sessionContext,
        this.selectedModel,
        historyContext, // 🚀 历史上下文
        toolResultsContext // 🚀 工具结果上下文
      );
      
      return plan;
    } catch (error) {
      this.logger.error('规划生成失败', error as Error);
      // 返回安全的降级计划
      return {
        thought: '规划生成失败，使用降级策略',
                    response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '抱歉，我在规划时遇到了问题。能请您换一种方式提问吗？',
        tool_calls: []
      };
    }
  }

  /**
   * 记录执行历史的封装方法
   */
  private recordExecution(
    type: ExecutionStep['type'], 
    content: string, 
    success?: boolean,
    toolName?: string,
    result?: any,
    args?: any,
    duration?: number,
    errorCode?: string,
    retryCount?: number
  ): void {
    this.contextManager.recordExecution(
      this.state.executionHistory,
      this.state.iterationCount,
      type,
      content,
      success,
      toolName,
      result,
      args,
      duration,
      errorCode,
      retryCount
    );
  }

  /**
   * 显示执行总结
   */
  private displayExecutionSummary(): void {
    this.contextManager.displayExecutionSummary(this.state, this.stream);
  }

  // ============================================================================
  // 🔧 工具执行方法 - 使用拆分后的模块
  // ============================================================================

  /**
   * 自主工具处理 - 使用ToolExecutionHandler
   */
  private async handleAutonomousTool(toolCall: { name: string; args: any }): Promise<void> {
    await this.toolExecutionHandler.handleAutonomousTool(
      toolCall,
      this.stream,
      this.state,
      (toolName, args) => this.loopDetector.hasRecentToolExecution(toolName, args, this.state.executionHistory),
      this.recordExecution.bind(this),
      this.toolExecutor
    );
  }

  /**
   * 交互工具处理 - 使用ToolExecutionHandler
   */
  private async handleInteractiveTool(toolCall: { name: string; args: any }): Promise<void> {
    await this.toolExecutionHandler.handleInteractiveTool(
      toolCall,
      this.stream,
      this.state,
      this.recordExecution.bind(this)
    );
  }

  /**
   * 确认工具处理 - 使用ToolExecutionHandler
   */
  private async handleConfirmationTool(
    toolCall: { name: string; args: any }, 
    classification: { type: string; riskLevel: 'low' | 'medium' | 'high'; requiresConfirmation: boolean }
  ): Promise<void> {
    await this.toolExecutionHandler.handleConfirmationTool(
      toolCall,
      classification,
      this.stream,
      this.state,
      this.recordExecution.bind(this),
      this.handleAutonomousTool.bind(this)
    );
  }

  /**
   * 处理finalAnswer工具 - 使用ToolExecutionHandler
   */
  private async handleFinalAnswer(toolCall: { name: string; args: any }): Promise<void> {
    await this.toolExecutionHandler.handleFinalAnswer(
      toolCall,
      this.stream,
      this.recordExecution.bind(this),
      this.toolExecutor
    );
  }
}