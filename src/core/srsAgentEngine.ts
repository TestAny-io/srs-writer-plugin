import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SessionContext, ISessionObserver, OperationType } from '../types/session';
import { SessionManager } from './session-manager';
import { AIPlan, AIResponseMode, ToolExecutionResult, createToolExecutionResult, ErrorCodes } from '../types/index';
import { toolRegistry, ToolDefinition } from '../tools/index';

// 导入拆分后的模块
import { AgentState, ExecutionStep, InteractionRequest, ToolCallResult, SpecialistResumeContext } from './engine/AgentState';
import { UserInteractionHandler } from './engine/UserInteractionHandler';
import { ToolClassifier } from './engine/ToolClassifier';
import { ToolExecutionHandler } from './engine/ToolExecutionHandler';
import { LoopDetector } from './engine/LoopDetector';
import { ContextManager } from './engine/ContextManager';
import { SpecialistExecutor } from './specialistExecutor';

/**
 * 🚀 SRS Agent Engine v3.0 - 观察者模式重构版
 * 
 * 核心改进：
 * - 👥 实现 ISessionObserver：自动接收SessionContext变更通知
 * - ⚡ 动态获取：不再持有过时的SessionContext快照
 * - 🔄 实时同步：SessionContext变更时自动更新内部状态
 * - 🏛️ 单例依赖：使用SessionManager单例获取最新数据
 * 
 * 基于业界最佳实践的Autonomous + Transparent执行模式
 */
export class SRSAgentEngine implements ISessionObserver {
  private state: AgentState;
  private stream: vscode.ChatResponseStream;
  private logger = Logger.getInstance();
  private selectedModel: vscode.LanguageModelChat;
  
  // 🚀 v3.0修改：使用SessionManager单例替代快照副本
  private sessionManager: SessionManager;
  
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
    selectedModel: vscode.LanguageModelChat
  ) {
    this.stream = stream;
    this.selectedModel = selectedModel;
    
    // 🚀 v3.0重构：使用SessionManager单例并订阅变更
    this.sessionManager = SessionManager.getInstance();
    this.sessionManager.subscribe(this);
    
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

    this.logger.info('🚀 SRSAgentEngine v3.0 initialized - Observer pattern with dynamic SessionContext');
  }

  /**
   * 🚀 v3.0新增：实现观察者接口，接收SessionContext变更通知
   */
  public onSessionChanged(newContext: SessionContext | null): void {
    this.logger.info(`🔄 Engine received session context update: ${newContext?.projectName || 'null'}`);
    
    // 这里可以根据需要添加特定的处理逻辑
    // 例如：如果会话被清理，可能需要重置某些状态
    if (!newContext && this.state.stage === 'awaiting_user') {
      this.logger.info('🧹 Session cleared while awaiting user, resetting engine state');
      this.state.stage = 'completed';
      this.state.pendingInteraction = undefined;
    }
  }

  /**
   * 🚀 v3.0新增：动态获取最新的SessionContext
   */
  private async getCurrentSessionContext(): Promise<SessionContext | null> {
    return await this.sessionManager.getCurrentSession();
  }

  /**
   * 设置依赖组件
   */
  public setDependencies(orchestrator: any, toolExecutor: any): void {
    this.orchestrator = orchestrator;
    this.toolExecutor = toolExecutor;
  }

  /**
   * 🚀 更新当前交互参数但保持引擎状态 - v3.0简化版
   * 
   * 注意：移除了sessionContext参数，因为现在动态获取
   */
  public updateStreamAndModel(
    stream: vscode.ChatResponseStream,
    model: vscode.LanguageModelChat
  ): void {
    this.stream = stream;
    this.selectedModel = model;
    // 注意：不重置state，保持引擎的记忆和状态
    // 注意：不需要更新sessionContext，因为现在动态获取
    this.logger.info('🔄 Engine stream and model updated, state preserved, SessionContext dynamically retrieved');
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
      await this.recordExecution('result', `--- 新任务开始: ${userInput} ---`, true);
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
    await this.recordExecution('user_interaction', `用户回复: ${response}`, true);
    
    // 🚀 关键修复：检查是否需要恢复specialist执行
    if (this.state.resumeContext) {
      this.logger.info(`🔄 Resuming specialist execution with user response: ${response}`);
      
      try {
        // 🚀 新架构：使用扩展的resumeContext恢复PlanExecutor状态
        if (this.state.resumeContext.planExecutorState) {
          this.stream.markdown(`🔄 **正在恢复PlanExecutor执行状态...**\n\n`);
          
          await this.resumePlanExecutorWithUserResponse(response);
          
        } else {
          // 🚀 兼容性：处理旧格式的resumeContext
          this.stream.markdown(`⚠️ **检测到旧格式的resumeContext**\n\n`);
          this.stream.markdown(`正在尝试兼容性处理...\n\n`);
          
          await this.handleLegacyResumeContext(response);
        }
        
      } catch (error) {
        this.logger.error(`❌ 恢复specialist执行失败: ${(error as Error).message}`);
        this.stream.markdown(`❌ **恢复执行失败**: ${(error as Error).message}\n\n`);
        this.stream.markdown(`请重新开始您的任务。\n\n`);
        
        // 清除状态
        this.state.resumeContext = undefined;
        this.state.pendingInteraction = undefined;
        this.state.stage = 'completed';
        
        await this.recordExecution('result', `恢复执行失败: ${(error as Error).message}`, false);
        return;
      }
      
    } else {
      // 没有resumeContext，按照原来的逻辑处理
      this.logger.info(`💬 Processing user response without resume context`);
      
      // 处理普通的用户交互
      await this.handleStandardUserInteraction(response, interaction);
    }
    
    // 清除交互状态
    this.state.pendingInteraction = undefined;
    this.state.resumeContext = undefined; // 🚀 确保清除resumeContext
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
    
    // 🔍 DEBUG: 记录生成的计划详情
    this.logger.info(`🔍 [DEBUG] Generated plan details:`);
    this.logger.info(`🔍 [DEBUG] - response_mode: ${plan.response_mode}`);
    this.logger.info(`🔍 [DEBUG] - has tool_calls: ${!!plan.tool_calls && plan.tool_calls.length > 0}`);
    this.logger.info(`🔍 [DEBUG] - has execution_plan: ${!!(plan as any).execution_plan}`);
    this.logger.info(`🔍 [DEBUG] - thought: ${plan.thought.substring(0, 100)}...`);
    
    // 2. 透明显示AI思考过程
    this.stream.markdown(`> 🤖 **AI思考**: ${plan.thought}\n\n`);
    this.recordExecution('thought', plan.thought);
    
    // 🚀 新增：检查PLAN_EXECUTION模式
    if (plan.response_mode === 'PLAN_EXECUTION' && (plan as any).execution_plan) {
      this.logger.info(`🚀 [DEBUG] 检测到PLAN_EXECUTION模式，移交给orchestrator.planAndExecute处理`);
      
      try {
        // 🚀 修复递归调用：传递已有的计划，避免重复调用generateUnifiedPlan
        const executionResult = await this.orchestrator.planAndExecute(
          this.state.currentTask,
          await this.getCurrentSessionContext(),
          this.selectedModel,
          plan  // 🚀 关键：传递已生成的plan，避免重复LLM调用
        );
        
        this.logger.info(`🔍 [DEBUG] planAndExecute result: intent=${executionResult.intent}`);
        
        // 根据执行结果更新引擎状态
        if (executionResult.intent === 'plan_completed') {
          this.stream.markdown(`✅ **计划执行完成**: ${executionResult.result?.summary}\n\n`);
          await this.recordExecution('result', `计划执行完成: ${executionResult.result?.summary}`, true);
          this.state.stage = 'completed';
          return;
        } else if (executionResult.intent === 'plan_failed') {
          this.stream.markdown(`❌ **计划执行失败**: ${executionResult.result?.error}\n\n`);
          await this.recordExecution('result', `计划执行失败: ${executionResult.result?.error}`, false);
          this.state.stage = 'error';
          return;
        } else if (executionResult.intent === 'user_interaction_required') {
          // 需要用户交互
          this.logger.info(`💬 [DEBUG] 计划执行需要用户交互`);
          this.state.stage = 'awaiting_user';
          this.state.pendingInteraction = {
            type: 'input',
            message: executionResult.result?.question || '需要您的确认',
            options: []
          };
          this.state.resumeContext = executionResult.result?.resumeContext;
          
          this.stream.markdown(`💬 **${executionResult.result?.question}**\n\n`);
          await this.recordExecution('user_interaction', `向用户提问: ${executionResult.result?.question}`, true);
          return;
        } else {
          // 其他情况，记录并继续
          this.logger.info(`🔍 [DEBUG] 未知的planAndExecute结果: ${executionResult.intent}`);
          this.stream.markdown(`ℹ️ **计划执行状态**: ${executionResult.intent}\n\n`);
        }
        
      } catch (error) {
        this.logger.error(`❌ [DEBUG] planAndExecute执行失败`, error as Error);
        this.stream.markdown(`❌ **计划执行出错**: ${(error as Error).message}\n\n`);
        await this.recordExecution('result', `计划执行出错: ${(error as Error).message}`, false);
        this.state.stage = 'error';
        return;
      }
    }
    
    // 3. 检查响应模式
    if (plan.response_mode === AIResponseMode.KNOWLEDGE_QA) {
      // 🚀 修复：KNOWLEDGE_QA现在支持工具调用
      if (plan.direct_response) {
        // 有直接回复，显示并完成
        this.stream.markdown(`💬 **AI回复**: ${plan.direct_response}\n\n`);
        await this.recordExecution('result', plan.direct_response, true);
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
              // 🚀 新增：特殊处理specialist工具的用户交互需求
              if (toolCall.name.includes('specialist')) {
                const result = await this.handleSpecialistTool(toolCall);
                if (result?.needsUserInteraction) {
                  return; // 暂停执行，等待用户响应
                }
              } else {
                // 风险评估后允许自动执行
                await this.handleAutonomousTool(toolCall);
              }
            }
            break;
            
          case 'autonomous':
          default:
            // 🚀 新增：特殊处理specialist工具的用户交互需求
            if (toolCall.name.includes('specialist')) {
              const result = await this.handleSpecialistTool(toolCall);
              if (result?.needsUserInteraction) {
                return; // 暂停执行，等待用户响应
              }
            } else {
              // 自主工具：直接执行
              await this.handleAutonomousTool(toolCall);
            }
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
      // 🔍 DEBUG: 记录没有工具调用的情况
      this.logger.info(`🔍 [DEBUG] 没有工具调用，任务可能已完成`);
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
      
      this.logger.info(`🔍 [DEBUG] Context prepared for orchestrator:`);
      this.logger.info(`🔍 [DEBUG] - historyContext length: ${historyContext.length}`);
      this.logger.info(`🔍 [DEBUG] - toolResultsContext length: ${toolResultsContext.length}`);
      this.logger.info(`🔍 [DEBUG] - sessionContext available: ${!!(await this.getCurrentSessionContext())}`);
      
      // 调用Orchestrator的规划方法
      this.logger.info(`🔍 [DEBUG] Calling orchestrator.generateUnifiedPlan...`);
      
      const plan = await this.orchestrator.generateUnifiedPlan(
        this.state.currentTask,
        await this.getCurrentSessionContext(),
        this.selectedModel,
        historyContext, // 🚀 历史上下文
        toolResultsContext // 🚀 工具结果上下文
      );
      
      this.logger.info(`🔍 [DEBUG] orchestrator.generateUnifiedPlan returned successfully`);
      this.logger.info(`🔍 [DEBUG] Plan response_mode: ${plan.response_mode}`);
      this.logger.info(`🔍 [DEBUG] Plan has execution_plan: ${!!(plan as any).execution_plan}`);
      this.logger.info(`🔍 [DEBUG] Plan has tool_calls: ${!!plan.tool_calls && plan.tool_calls.length > 0}`);
      
      return plan;
    } catch (error) {
      this.logger.error('❌ [DEBUG] 规划生成失败', error as Error);
      // 返回安全的降级计划
      return {
        thought: '规划生成失败，使用降级策略',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '抱歉，我在规划时遇到了问题。能请您换一种方式表达吗？',
        tool_calls: []
      };
    }
  }

  /**
   * 🚀 v5.0更新：记录执行历史的封装方法 - 添加选择性汇报机制
   */
  private async recordExecution(
    type: ExecutionStep['type'], 
    content: string, 
    success?: boolean,
    toolName?: string,
    result?: any,
    args?: any,
    duration?: number,
    errorCode?: string,
    retryCount?: number
  ): Promise<void> {
    // 1. 保持现有的运行时内存记录
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
    
    // 2. v5.0新增：选择性汇报重要业务事件到SessionManager
    if (this.isBusinessEvent(type, content, toolName)) {
      try {
        const operationType = this.mapToOperationType(type, content, success, toolName);
        
        await this.sessionManager.updateSessionWithLog({
          logEntry: {
            type: operationType,
            operation: content,
            toolName,
            success: success ?? true,
            executionTime: duration,
            error: success === false ? content : undefined
          }
        });
        
        this.logger.info(`📋 Business event reported to SessionManager: ${operationType} - ${content.substring(0, 50)}...`);
      } catch (error) {
        // 错误隔离：汇报失败不影响主流程
        this.logger.warn(`Failed to report business event to SessionManager: ${(error as Error).message}`);
      }
    }
  }

  /**
   * 显示执行总结
   */
  private displayExecutionSummary(): void {
    this.contextManager.displayExecutionSummary(this.state, this.stream);
  }

  /**
   * 🚀 v5.0新增：判断是否为需要汇报的业务事件
   */
  private isBusinessEvent(
    type: ExecutionStep['type'], 
    content: string, 
    toolName?: string
  ): boolean {
    switch (type) {
      case 'user_interaction':
        // 所有用户交互都是重要的业务事件
        return true;
        
      case 'tool_call':
        // specialist工具 (deprecated tools removed)
        return toolName?.includes('specialist') ?? false;
               
      case 'result':
        // 重要的业务结果和里程碑
        return content.includes('专家') || 
               content.includes('任务完成') ||
               content.includes('新任务开始') ||
               content.includes('specialist') ||
               content.includes('恢复执行');
               
      default:
        return false;
    }
  }

  /**
   * 🚀 v5.0新增：将ExecutionStep类型映射到OperationType
   */
  private mapToOperationType(
    type: ExecutionStep['type'], 
    content: string, 
    success?: boolean,
    toolName?: string
  ): OperationType {
    switch (type) {
      case 'user_interaction':
        // 根据内容判断是用户响应还是向用户提问
        return content.includes('用户回复') ? 
          OperationType.USER_RESPONSE_RECEIVED : 
          OperationType.USER_QUESTION_ASKED;
          
      case 'tool_call':
        // specialist工具特殊处理
        if (toolName?.includes('specialist')) {
          return OperationType.SPECIALIST_INVOKED;
        }
        
        // 普通工具根据成功状态判断
        if (success === true) return OperationType.TOOL_EXECUTION_END;
        if (success === false) return OperationType.TOOL_EXECUTION_FAILED;
        return OperationType.TOOL_EXECUTION_START;
        
      case 'result':
        // 根据内容判断具体的结果类型
        if (content.includes('专家') || content.includes('specialist')) {
          return OperationType.SPECIALIST_INVOKED;
        }
        return OperationType.AI_RESPONSE_RECEIVED;
        
      default:
        return OperationType.AI_RESPONSE_RECEIVED;
    }
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
      this.toolExecutor,
      this.selectedModel
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
      this.toolExecutor,
      this.selectedModel
    );
  }

  // 🚀 新增：特殊处理specialist工具的用户交互需求
  private async handleSpecialistTool(toolCall: { name: string; args: any }): Promise<{ needsUserInteraction: boolean } | undefined> {
    this.stream.markdown(`🧠 **需求文档专家正在工作**: ${toolCall.name}\n`);
    
    const startTime = Date.now();
    await this.recordExecution('tool_call', `需求文档专家正在使用工具: ${toolCall.name}`, undefined, toolCall.name, undefined, toolCall.args);
    
    try {
      const result = await this.toolExecutor.executeTool(
        toolCall.name, 
        toolCall.args,
        undefined,  // caller 参数
        this.selectedModel  // model 参数
      );
      
      const duration = Date.now() - startTime;
      
      // 🚀 关键：检查是否需要用户交互
      if (result.success && result.result && typeof result.result === 'object') {
        // 尝试解析result.result（可能是JSON字符串）
        let parsedResult = result.result;
        if (typeof result.result === 'string') {
          try {
            parsedResult = JSON.parse(result.result);
          } catch (parseError) {
            // 如果不是JSON，保持原样
            parsedResult = result.result;
          }
        }
        
        // 检查是否需要聊天交互
        if (parsedResult.needsChatInteraction) {
          this.logger.info(`💬 Specialist tool ${toolCall.name} needs chat interaction: ${parsedResult.chatQuestion}`);
          
          // 🚀 保存resumeContext到引擎状态
          this.state.resumeContext = {
            ruleId: parsedResult.resumeContext?.ruleId || 'unknown',
            context: parsedResult.resumeContext?.context || {},
            currentIteration: parsedResult.currentIteration || 0,
            conversationHistory: parsedResult.conversationHistory || [],
            toolExecutionResults: parsedResult.toolExecutionResults || [],
            pendingPlan: parsedResult.pendingPlan || {},
            // 🚀 添加必需的新字段（临时空值）
            planExecutorState: {
              plan: { planId: 'unknown', description: 'legacy', steps: [] },
              currentStep: {},
              stepResults: {},
              sessionContext: {},
              userInput: '',
              specialistLoopState: {
                specialistId: 'unknown',
                currentIteration: 0,
                maxIterations: 5,
                executionHistory: [],
                isLooping: false,
                startTime: Date.now()
              }
            },
            askQuestionContext: {
              toolCall: { name: 'askQuestion', args: {} },
              question: parsedResult.chatQuestion || '需要您的确认',
              originalResult: parsedResult,
              timestamp: Date.now()
            },
            resumeGuidance: {
              nextAction: 'continue_specialist_execution',
              resumePoint: 'next_iteration',
              expectedUserResponseType: 'answer',
              contextualHints: ['遗留的resumeContext，建议重新开始任务']
            }
          };
          
          // 设置等待用户输入状态
          this.state.stage = 'awaiting_user';
          this.state.pendingInteraction = {
            type: 'input',
            message: parsedResult.chatQuestion,
            toolCall: toolCall,
            originalResult: parsedResult
          };
          
          // 在聊天中显示问题
          this.stream.markdown(`💬 **${parsedResult.chatQuestion}**\n\n`);
          this.stream.markdown(`请在下方输入您的回答...\n\n`);
          
          await this.recordExecution(
            'user_interaction',
            `专家工具 ${toolCall.name} 需要用户交互: ${parsedResult.chatQuestion}`,
            true,
            toolCall.name,
            parsedResult,
            toolCall.args,
            duration
          );
          
          return { needsUserInteraction: true };
        }
      }
      
      // 正常处理（无用户交互需求）
      this.stream.markdown(`✅ **${toolCall.name}** 执行成功 (${duration}ms)\n`);
      if (result.result) {
        let outputText: string;
        if (typeof result.result === 'string') {
          outputText = result.result;
        } else {
          try {
            outputText = JSON.stringify(result.result, null, 2);
          } catch (serializeError) {
            outputText = `[输出序列化失败: ${(serializeError as Error).message}]`;
          }
        }
        this.stream.markdown(`\`\`\`json\n${outputText}\n\`\`\`\n\n`);
      }
      
      await this.recordExecution(
        'tool_call', 
        `${toolCall.name} 执行成功`, 
        true, 
        toolCall.name, 
        result, 
        toolCall.args,
        duration
      );
      
      return { needsUserInteraction: false };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = (error as Error).message;
      
      this.stream.markdown(`❌ **${toolCall.name}** 执行失败 (${duration}ms): ${errorMsg}\n\n`);
      
      await this.recordExecution(
        'tool_call', 
        `${toolCall.name} 执行失败: ${errorMsg}`, 
        false, 
        toolCall.name, 
        { error: errorMsg, stack: (error as Error).stack }, 
        toolCall.args,
        duration,
        'EXECUTION_FAILED'
      );
      
      return { needsUserInteraction: false };
    }
  }

  /**
   * 🚀 新增：使用用户回复恢复PlanExecutor执行状态
   */
  private async resumePlanExecutorWithUserResponse(userResponse: string): Promise<void> {
    const resumeContext = this.state.resumeContext!;
    const planExecutorState = resumeContext.planExecutorState;
    
    this.logger.info(`🔄 恢复PlanExecutor状态: specialist=${planExecutorState.specialistLoopState.specialistId}, iteration=${planExecutorState.specialistLoopState.currentIteration}`);
    
    // 1. 创建PlanExecutor实例
    const { PlanExecutor } = await import('./orchestrator/PlanExecutor');
    const { SpecialistExecutor } = await import('./specialistExecutor');
    
    const specialistExecutor = new SpecialistExecutor();
    const planExecutor = new PlanExecutor(specialistExecutor);
    
    // 2. 恢复SessionContext
    const sessionContext = await this.restoreSessionContext(planExecutorState.sessionContext);
    
    // 3. 构建带有用户回复的增强上下文
    const enhancedContext = this.buildResumeContextWithUserResponse(
      planExecutorState,
      userResponse,
      resumeContext
    );
    
    // 4. 恢复specialist的执行
    this.stream.markdown(`🔄 **恢复specialist执行**: ${planExecutorState.specialistLoopState.specialistId} (第${planExecutorState.specialistLoopState.currentIteration}轮)\n\n`);
    
    try {
      // 🚀 关键：调用specialist继续执行，传入用户回复
      const continuedResult = await specialistExecutor.execute(
        planExecutorState.specialistLoopState.specialistId,
        enhancedContext,
        this.selectedModel
      );
      
      // 处理specialist的继续执行结果
      if (continuedResult.success) {
        this.stream.markdown(`✅ **Specialist执行成功**\n\n`);
        
        // 如果specialist完成了任务，更新状态
        if (continuedResult.structuredData?.nextStepType === 'TASK_FINISHED') {
          this.state.stage = 'completed';
          this.stream.markdown(`🎉 **任务完成**: ${continuedResult.structuredData.summary}\n\n`);
        } else {
          // 如果specialist需要继续或转交，重新启动计划执行
          this.stream.markdown(`🔄 **继续执行计划**...\n\n`);
          
          // 重新构建计划并继续执行
          const remainingPlan = this.reconstructRemainingPlan(planExecutorState, continuedResult);
          
          const finalResult = await planExecutor.execute(
            remainingPlan,
            sessionContext,
            this.selectedModel,
            planExecutorState.userInput
          );
          
          await this.handlePlanExecutionResult(finalResult);
        }
        
      } else {
        const errorMsg = ('error' in continuedResult) ? continuedResult.error : '执行失败';
        this.stream.markdown(`❌ **Specialist执行失败**: ${errorMsg}\n\n`);
        await this.recordExecution('result', `Specialist恢复执行失败: ${errorMsg}`, false);
      }
      
    } catch (error) {
      this.logger.error(`❌ Specialist恢复执行异常: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 🚀 新增：恢复SessionContext
   */
  private async restoreSessionContext(serializedContext: any): Promise<any> {
    try {
      // 获取当前的SessionContext
      const currentContext = await this.getCurrentSessionContext();
      
      // 如果序列化的上下文包含重要更新，合并它们
      if (serializedContext) {
        return {
          ...currentContext,
          ...serializedContext,
          // 确保某些关键字段来自当前上下文
          baseDir: currentContext?.baseDir || serializedContext.baseDir,
          projectName: currentContext?.projectName || serializedContext.projectName
        };
      }
      
      return currentContext;
      
    } catch (error) {
      this.logger.error(`❌ 恢复SessionContext失败: ${(error as Error).message}`);
      // 返回当前上下文作为fallback
      return await this.getCurrentSessionContext();
    }
  }

  /**
   * 🚀 新增：构建带有用户回复的增强上下文
   */
  private buildResumeContextWithUserResponse(
    planExecutorState: any,
    userResponse: string,
    resumeContext: any
  ): any {
    // 从原有上下文开始
    const baseContext = resumeContext.context || {};
    
    // 添加用户回复
    const enhancedContext = {
      ...baseContext,
      
      // 🚀 关键：添加用户回复到上下文中
      userResponse: userResponse,
      
      // 🚀 恢复specialist循环状态
      specialistLoopContext: {
        ...baseContext.specialistLoopContext,
        
        // 更新迭代信息
        currentIteration: planExecutorState.specialistLoopState.currentIteration,
        totalIterations: planExecutorState.specialistLoopState.executionHistory.length,
        
        // 添加用户交互信息
        userInteractionHistory: [
          ...(baseContext.specialistLoopContext?.userInteractionHistory || []),
          {
            iteration: planExecutorState.specialistLoopState.currentIteration,
            question: resumeContext.askQuestionContext.question,
            userResponse: userResponse,
            timestamp: new Date().toISOString()
          }
        ],
        
        // 更新指导信息
        loopGuidance: {
          ...baseContext.specialistLoopContext?.loopGuidance,
          userResponseReceived: userResponse,
          resumeInstructions: [
            "用户已经回复了您的问题",
            `用户回复: "${userResponse}"`,
            "请基于用户的回复继续您的工作",
            "如果任务完成，请使用taskComplete with nextStepType: 'TASK_FINISHED'"
          ]
        }
      },
      
      // 🚀 保持原有的计划上下文
      currentStep: planExecutorState.currentStep,
      dependentResults: planExecutorState.stepResults,
      sessionData: planExecutorState.sessionContext,
      userInput: planExecutorState.userInput,
      
      // 🚀 添加恢复指导
      resumeGuidance: resumeContext.resumeGuidance
    };
    
    this.logger.info(`🔍 构建增强上下文：添加用户回复 "${userResponse}"`);
    
    return enhancedContext;
  }

  /**
   * 🚀 新增：重构剩余的计划
   */
  private reconstructRemainingPlan(planExecutorState: any, lastResult: any): any {
    const originalPlan = planExecutorState.plan;
    const currentStep = planExecutorState.currentStep;
    
    // 找到当前步骤在原计划中的位置
    const currentStepIndex = originalPlan.steps.findIndex(
      (step: any) => step.step === currentStep.step
    );
    
    // 构建剩余步骤
    const remainingSteps = originalPlan.steps.slice(currentStepIndex);
    
    // 更新第一个步骤的状态（已部分完成）
    if (remainingSteps.length > 0) {
      remainingSteps[0] = {
        ...remainingSteps[0],
        partialResult: lastResult,
        resumedFromUserInteraction: true
      };
    }
    
    return {
      planId: `${originalPlan.planId}_resumed`,
      description: `恢复执行: ${originalPlan.description}`,
      steps: remainingSteps
    };
  }

  /**
   * 🚀 新增：处理计划执行结果
   */
  private async handlePlanExecutionResult(result: any): Promise<void> {
    switch (result.intent) {
      case 'plan_completed':
        this.stream.markdown(`✅ **计划执行完成**: ${result.result?.summary}\n\n`);
        this.state.stage = 'completed';
        break;
        
      case 'plan_failed':
        this.stream.markdown(`❌ **计划执行失败**: ${result.result?.error}\n\n`);
        this.state.stage = 'error';
        break;
        
      case 'user_interaction_required':
        this.stream.markdown(`💬 **需要进一步用户交互**: ${result.result?.question}\n\n`);
        this.state.stage = 'awaiting_user';
        this.state.pendingInteraction = {
          type: 'input',
          message: result.result?.question || '需要您的确认',
          options: []
        };
        this.state.resumeContext = result.result?.resumeContext;
        break;
        
      default:
        this.stream.markdown(`ℹ️ **计划执行状态**: ${result.intent}\n\n`);
        this.state.stage = 'completed';
        break;
    }
    
    await this.recordExecution('result', `计划执行结果: ${result.intent}`, result.intent !== 'plan_failed');
  }

  /**
   * 🚀 新增：处理旧格式的resumeContext（兼容性）
   */
  private async handleLegacyResumeContext(userResponse: string): Promise<void> {
    // 这里可以实现对旧格式resumeContext的兼容处理
    // 目前暂时显示升级提示
    this.stream.markdown(`⚠️ **架构升级通知**\n\n`);
    this.stream.markdown(`检测到旧格式的恢复上下文。新架构提供了更强大的状态管理能力。\n`);
    this.stream.markdown(`您的回复已记录: "${userResponse}"\n\n`);
    this.stream.markdown(`请重新开始您的任务以使用新的架构特性。\n\n`);
    
    await this.recordExecution('result', `旧格式resumeContext处理: ${userResponse}`, true);
  }

  /**
   * 🚀 新增：处理标准用户交互（非specialist恢复）
   */
  private async handleStandardUserInteraction(userResponse: string, interaction: any): Promise<void> {
    this.stream.markdown(`💬 **处理用户交互**: ${userResponse}\n\n`);
    
    // 这里可以实现对非specialist恢复的用户交互处理
    // 例如确认操作、选择选项等
    
    await this.recordExecution('user_interaction', `标准用户交互: ${userResponse}`, true);
  }

  // ============================================================================
  // 🧹 资源管理
  // ============================================================================

  /**
   * 🚀 v3.0新增：清理引擎资源，取消观察者订阅
   */
  public dispose(): void {
    this.logger.info('🧹 Disposing SRSAgentEngine and unsubscribing from session changes');
    this.sessionManager.unsubscribe(this);
  }

  /**
   * 🚀 v3.0新增：获取引擎统计信息（用于调试和监控）
   */
  public getEngineStats(): { 
    stage: string; 
    iterationCount: number; 
    isAwaitingUser: boolean;
    executionHistoryLength: number;
    currentTask: string;
  } {
    return {
      stage: this.state.stage,
      iterationCount: this.state.iterationCount,
      isAwaitingUser: this.isAwaitingUser(),
      executionHistoryLength: this.state.executionHistory.length,
      currentTask: this.state.currentTask
    };
  }
}