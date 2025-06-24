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
        // 创建specialist executor实例
        const specialistExecutor = new SpecialistExecutor();
        
        // 准备恢复上下文，添加用户回复
        const resumeContextWithResponse = {
          ...this.state.resumeContext,
          userResponse: response
        };
        
        this.stream.markdown(`🔄 **正在恢复专家任务执行...**\n\n`);
        
        // 调用specialist恢复方法
        const result = await specialistExecutor.resumeSpecialistExecution(
          resumeContextWithResponse,
          this.selectedModel
        );
        
        // 解析specialist的恢复结果
        try {
          const parsedResult = JSON.parse(result);
          
          // 🚀 检查是否又需要用户交互
          if (parsedResult.needsChatInteraction) {
            this.logger.info(`💬 Specialist needs another chat interaction: ${parsedResult.chatQuestion}`);
            
            // 更新resumeContext
            this.state.resumeContext = {
              ruleId: parsedResult.resumeContext?.ruleId || this.state.resumeContext.ruleId,
              context: parsedResult.resumeContext?.context || this.state.resumeContext.context,
              currentIteration: parsedResult.currentIteration || this.state.resumeContext.currentIteration,
              conversationHistory: parsedResult.conversationHistory || this.state.resumeContext.conversationHistory,
              toolExecutionResults: parsedResult.toolExecutionResults || this.state.resumeContext.toolExecutionResults,
              pendingPlan: parsedResult.pendingPlan || this.state.resumeContext.pendingPlan
            };
            
            // 设置新的交互状态
            this.state.pendingInteraction = {
              type: 'input',
              message: parsedResult.chatQuestion,
              toolCall: interaction.toolCall,
              originalResult: parsedResult
            };
            
            // 显示新问题
            this.stream.markdown(`💬 **${parsedResult.chatQuestion}**\n\n`);
            this.stream.markdown(`请在下方输入您的回答...\n\n`);
            
            return; // 继续等待用户输入
          }
          
          // 🚀 Specialist执行完成
          if (parsedResult.completed) {
            this.logger.info(`✅ Specialist execution completed: ${parsedResult.summary}`);
            
            this.stream.markdown(`✅ **任务完成**\n\n`);
            this.stream.markdown(`${parsedResult.summary}\n\n`);
            
            if (parsedResult.resumedFromUserInteraction) {
              this.stream.markdown(`🎯 专家任务在您的协助下成功完成！\n\n`);
            }
            
            // 清除状态
            this.state.resumeContext = undefined;
            this.state.pendingInteraction = undefined;
            this.state.stage = 'completed';
            
            await this.recordExecution('result', parsedResult.summary, true);
            this.displayExecutionSummary();
            return;
          }
          
          // 🚀 Specialist部分完成
          this.stream.markdown(`⚠️ **任务部分完成**\n\n`);
          this.stream.markdown(`${parsedResult.summary}\n\n`);
          
        } catch (parseError) {
          // 如果不是JSON格式，按文本处理
          this.stream.markdown(`✅ **专家任务恢复完成**\n\n`);
          this.stream.markdown(`${result}\n\n`);
        }
        
        // 清除状态
        this.state.resumeContext = undefined;
        this.state.pendingInteraction = undefined;
        this.state.stage = 'completed';
        
        await this.recordExecution('result', '专家任务恢复执行完成', true);
        this.displayExecutionSummary();
        return;
        
      } catch (error) {
        this.logger.error('恢复specialist执行失败', error as Error);
        this.stream.markdown(`❌ 恢复任务执行时出现错误: ${(error as Error).message}\n\n`);
        
        // 清除错误状态，回退到正常交互处理
        this.state.resumeContext = undefined;
        this.logger.info('Falling back to normal interaction handling');
      }
    }
    
    // 🚀 原有的交互处理逻辑（作为fallback或者非specialist的交互）
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
    
    // 2. 透明显示AI思考过程
    this.stream.markdown(`> 🤖 **AI思考**: ${plan.thought}\n\n`);
    this.recordExecution('thought', plan.thought);
    
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
              if (toolCall.name === 'createComprehensiveSRS' || toolCall.name.includes('specialist')) {
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
            if (toolCall.name === 'createComprehensiveSRS' || toolCall.name.includes('specialist')) {
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
        await this.getCurrentSessionContext(),
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
        // specialist工具 或 重要的业务工具
        return toolName?.includes('specialist') || 
               toolName === 'createComprehensiveSRS' ||
               toolName === 'editSRSDocument' ||
               toolName === 'lintSRSDocument' ||
               toolName === 'classifyProjectComplexity';
               
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
        if (toolName?.includes('specialist') || 
            toolName === 'createComprehensiveSRS' ||
            toolName === 'editSRSDocument') {
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
    this.stream.markdown(`🧠 **执行专家工具**: ${toolCall.name}\n`);
    
    const startTime = Date.now();
    await this.recordExecution('tool_call', `开始执行专家工具: ${toolCall.name}`, undefined, toolCall.name, undefined, toolCall.args);
    
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
            pendingPlan: parsedResult.pendingPlan || {}
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