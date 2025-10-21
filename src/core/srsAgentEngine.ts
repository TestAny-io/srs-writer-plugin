import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SessionContext, ISessionObserver, OperationType } from '../types/session';
import { SessionManager } from './session-manager';
import { AIPlan, AIResponseMode, ToolExecutionResult, createToolExecutionResult, ErrorCodes, SpecialistProgressCallback } from '../types/index';
import { toolRegistry, ToolDefinition } from '../tools/index';

// 导入拆分后的模块
import { AgentState, ExecutionStep, InteractionRequest, ToolCallResult, SpecialistResumeContext } from './engine/AgentState';
import { UserInteractionHandler } from './engine/UserInteractionHandler';
import { ToolClassifier } from './engine/ToolClassifier';
import { ToolExecutionHandler } from './engine/ToolExecutionHandler';
import { LoopDetector } from './engine/LoopDetector';
import { ContextManager } from './engine/ContextManager';
import { SpecialistExecutor } from './specialistExecutor';
import { SpecialistOutput } from '../types';
import { PlanInterruptionState } from './engine/AgentState';

/**
 * 🚀 SRS Agent Engine v6.0 - 全局引擎架构
 * 
 * 核心特性：
 * - 🌐 全局单例模式：一个插件实例一个引擎
 * - 👥 观察者模式：自动接收SessionContext变更通知
 * - ⚡ 动态会话适配：动态获取最新SessionContext，无需绑定特定会话
 * - 🔄 状态保持：跨会话切换保持执行状态和记忆
 * - 🏛️ 透明代理：完全委托给智能引擎执行
 * 
 * 基于Autonomous + Transparent执行模式
 */
export class SRSAgentEngine implements ISessionObserver {
  private state: AgentState;
  private stream: vscode.ChatResponseStream;
  private logger = Logger.getInstance();
  private selectedModel: vscode.LanguageModelChat;
  
  // 🚀 v6.0：使用SessionManager单例获取动态会话上下文
  private sessionManager: SessionManager;
  
  // 依赖注入的组件
  private orchestrator?: any;
  private toolExecutor?: any;
  private planExecutor?: any;  // 🚀 新增：PlanExecutor 实例
  
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
    
    // 🚀 v6.0：使用SessionManager单例并订阅变更
    this.sessionManager = SessionManager.getInstance();
    this.sessionManager.subscribe(this);
    
    this.state = {
      stage: 'planning',
      currentTask: '',
      executionHistory: [],
      iterationCount: 0,
      maxIterations: 15,
      cancelled: false
    };

    // 初始化拆分后的模块
    this.userInteractionHandler = new UserInteractionHandler();
    this.toolClassifier = new ToolClassifier();
    this.toolExecutionHandler = new ToolExecutionHandler();
    this.loopDetector = new LoopDetector();
    this.contextManager = new ContextManager();

    this.logger.info('🚀 SRSAgentEngine v6.0 initialized - Global engine with dynamic SessionContext');
  }

  /**
   * 🚀 v6.0：实现观察者接口，接收SessionContext变更通知
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
   * 🚀 v6.0新增：全局引擎专用的会话上下文变更通知
   */
  public onSessionContextChanged(newContext: SessionContext | null): void {
    this.logger.info(`🌐 Global engine adapting to new session context: ${newContext?.projectName || 'null'}`);
    
    // 全局引擎动态适应新的会话上下文
    // 当项目切换时，引擎会在下次任务执行时自动获取最新的会话上下文
    if (newContext) {
      this.logger.info(`🌐 Global engine now ready for project: ${newContext.projectName}`);
    } else {
      this.logger.info(`🌐 Global engine session context cleared`);
    }
  }

  /**
   * 🚀 v6.0：动态获取最新的SessionContext
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
    
    // 🚀 新增：获取 PlanExecutor 实例
    if (orchestrator && orchestrator.planExecutor) {
      this.planExecutor = orchestrator.planExecutor;
      this.logger.info('📋 PlanExecutor instance injected into SRSAgentEngine');
    }
    
    // 🚀 v6.0：设置Plan取消检查回调，让PlanExecutor能够检查取消状态
    if (orchestrator && typeof orchestrator.setPlanCancelledCheckCallback === 'function') {
      orchestrator.setPlanCancelledCheckCallback(() => {
        return this.state.cancelled === true;
      });
    }
  }

  /**
   * 🚀 v6.0：取消当前执行的Plan
   * 
   * 用于项目切换时中止正在执行的计划，避免输出混乱
   */
  public cancelCurrentExecution(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.info('🛑 Cancelling current plan execution for project switch');
      
      // 设置取消标志
      this.state.cancelled = true;
      
      // 如果正在等待用户输入，也要清理这个状态
      if (this.state.stage === 'awaiting_user') {
        this.state.pendingInteraction = undefined;
      }
      
      // 设置引擎状态为已完成
      this.state.stage = 'completed';
      
      // 记录取消操作
      this.recordExecution('result', '计划执行已取消 - 项目切换', false, 'system', null)
        .then(() => {
          this.logger.info('✅ Plan execution cancelled successfully');
          resolve();
        })
        .catch((error) => {
          this.logger.error(`❌ Error recording cancellation: ${(error as Error).message}`);
          resolve(); // 即使记录失败也要继续
        });
    });
  }

  /**
   * 🚀 更新当前交互参数但保持引擎状态 - v6.0全局引擎版
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
    this.state.cancelled = false; // 重置取消状态
    
    // 🐛 DEBUG: 记录设置后的currentTask值
    this.logger.info(`🔍 [DEBUG] executeTask set this.state.currentTask to: "${this.state.currentTask}"`);
    this.logger.info(`🔍 [DEBUG] executeTask state after setting: stage=${this.state.stage}, iterationCount=${this.state.iterationCount}`);
    
    // 🔍 [DEBUG-CONTEXT] === NEW TASK STARTING ===
    this.logger.info(`🔍 [DEBUG-CONTEXT] executeTask called with: "${userInput}"`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] Current executionHistory.length BEFORE separator: ${this.state.executionHistory.length}`);
    
    // 🚀 关键修改：保留执行历史，添加任务分隔符
    if (this.state.executionHistory.length > 0) {
      await this.recordExecution('result', `--- 新任务开始: ${userInput} ---`, true);
      this.logger.info(`🔍 [DEBUG-CONTEXT] Task separator added. New executionHistory.length: ${this.state.executionHistory.length}`);
    } else {
      this.logger.warn(`🔍 [DEBUG-CONTEXT] ⚠️ No previous execution history found. Starting fresh.`);
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
    
    // 🚀 修复：用户回复后，无条件清除当前的pendingInteraction
    // specialist如果需要新的交互，会通过askQuestion工具重新设置
    this.state.pendingInteraction = undefined;
    
    // 🚀 关键修复：检查是否需要恢复specialist执行
    if (this.state.resumeContext) {
      this.logger.info(`🔄 Resuming specialist execution with user response: ${response}`);
      
      try {
        // 🚀 新架构：使用扩展的resumeContext恢复PlanExecutor状态
        if (this.state.resumeContext.planExecutorState) {
          this.stream.markdown(`🔄 **正在恢复PlanExecutor执行状态...**\n\n`);
          
          const resumeResult = await this.resumePlanExecutorWithUserResponse(response);
          
          // 🚀 v2.0 (2025-10-08): 使用明确的intent处理，消除boolean歧义
          // 
          // 改进说明：
          // - 之前使用boolean返回值，无法区分"继续执行"和"需要用户交互"两种true语义
          // - 现在使用intent明确表达三种状态，清晰无歧义
          // - 同时修复了L1447的状态覆盖问题，保留planExecutorState
          this.logger.info(`🔍 [RESUME_RESULT] Specialist恢复结果intent: ${resumeResult.intent}`);
          
          if (resumeResult.intent === 'user_interaction_required') {
            // Specialist需要新的用户交互
            this.logger.info(`💬 Specialist恢复后需要新的用户交互，保持等待状态`);
            this.logger.info(`💬 等待用户回答: "${resumeResult.result?.question || '新问题'}"`);
            this.logger.info(`🔍 [RESUME_STATE] resumeContext.planExecutorState preserved: ${!!this.state.resumeContext?.planExecutorState}`);
            // state已在resumePlanExecutorWithUserResponse中正确设置
            // 包括：state.stage = 'awaiting_user', state.pendingInteraction, state.resumeContext（保留了planExecutorState）
            return; // 保持awaiting_user状态，等待下一次用户回复
            
          } else if (resumeResult.intent === 'specialist_continued') {
            // Specialist成功完成或继续执行
            this.logger.info(`✅ Specialist恢复成功，继续执行`);
            // specialist已通过resumePlanExecutorLoop继续执行或完成
            return; // 正常结束handleUserResponse
            
          } else if (resumeResult.intent === 'specialist_failed') {
            // Specialist恢复执行失败，需要重新规划
            this.logger.warn(`⚠️ Specialist恢复失败，错误: ${resumeResult.result?.error || '未知错误'}`);
            this.logger.warn(`⚠️ 将重新规划任务`);
            // 不return，继续执行到下面的重新规划逻辑
          }
          
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
        this.state.stage = 'completed';
        
        await this.recordExecution('result', `恢复执行失败: ${(error as Error).message}`, false);
        return;
      }
      
    } else {
      // ####################################################################
      // ##################### 关键修复区域开始 #########################
      // ####################################################################
      
      this.logger.info(`💬 Processing standard user interaction of type: ${interaction.type}`);
      
      let handlerResult: { shouldReturnToWaiting: boolean };

      switch (interaction.type) {
        case 'confirmation':
          handlerResult = await this.userInteractionHandler.handleConfirmationResponse(
            response,
            interaction,
            this.stream,
            this.recordExecution.bind(this),
            // 关键：将 this.handleAutonomousTool 作为一个回调函数传递进去
            this.handleAutonomousTool.bind(this) 
          );
          break;
        
        case 'choice':
          handlerResult = await this.userInteractionHandler.handleChoiceResponse(
            response,
            interaction,
            this.stream,
            this.recordExecution.bind(this),
            this.handleAutonomousTool.bind(this)
          );
          break;

        case 'input':
        default:
          handlerResult = await this.userInteractionHandler.handleInputResponse(
            response,
            interaction,
            this.stream,
            this.recordExecution.bind(this),
            this.handleAutonomousTool.bind(this)
          );
          break;
      }
      
      // 根据交互处理结果决定下一步
      if (handlerResult.shouldReturnToWaiting) {
        // 如果用户的回复不明确（例如，既不是yes也不是no），则需要再次等待用户输入
        this.state.stage = 'awaiting_user';
        this.state.pendingInteraction = interaction; // 重新设置，以便再次提问
        this.logger.info(`🔄 User response was ambiguous. Returning to 'awaiting_user' stage.`);
        return; // 直接返回，等待下一次用户输入
      }

      // 如果交互处理完成（例如，用户确认了操作且工具已执行，或用户取消了操作）
      // 检查工具执行是否可能改变了引擎状态
      this.logger.info(`✅ Interaction handled successfully. Current stage: ${this.state.stage}`);
      
      // 工具执行后，如果状态没有被设置为终止状态，继续执行循环
      if (this.state.stage === 'awaiting_user' || this.state.stage === 'planning') {
        // 工具执行后，继续执行循环以进行下一步规划
        this.logger.info(`🔄 Continuing execution loop after interaction.`);
        this.state.stage = 'executing';
        await this._runExecutionLoop();
        this.displayExecutionSummary();
      } else {
        // 如果在交互处理中状态已经被设置为完成或错误（例如，某些工具会直接完成任务）
        this.logger.info(`✅ Task completed or stopped during interaction handling.`);
        this.displayExecutionSummary();
      }

      // 关键：不要再执行旧的重新规划逻辑了，因为正确的操作（执行或取消）已经完成。
      return; 
      // ####################################################################
      // ##################### 修复区域结束 ###############################
      // ####################################################################
    }
  }

  // ============================================================================
  // 📦 基础执行方法
  // ============================================================================

  // 基础方法实现
  private shouldContinueExecution(): boolean {
    return this.state.stage !== 'completed' && 
           this.state.stage !== 'error' &&
           this.state.stage !== 'awaiting_user' &&
           this.state.iterationCount < this.state.maxIterations &&
           !this.state.cancelled;
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
        // 🚀 新增：创建specialist进度回调 - 简化显示模式
        let executionSummary: Array<{iteration: number, tools: string[], duration: number, success: boolean}> = [];
        
        const progressCallback: SpecialistProgressCallback = {
          onSpecialistStart: (specialistId) => {
            this.stream.markdown(`🧠 **需求文档专家正在工作**: ${specialistId}\n\n`);
            executionSummary = []; // 重置执行摘要
          },
          onIterationStart: (current, max) => {
            // 只显示进度，不显示详细步骤
            this.stream.progress(`第 ${current}/${max} 轮迭代...`);
          },
          onToolsStart: (toolCalls) => {
            // 静默执行，不显示工具启动信息
          },
          onToolsComplete: (toolCalls, results, duration) => {
            const success = results.every(r => r.success);
            const toolNames = toolCalls.map(t => t.name);
            
            // 记录到执行摘要中
            const iterationNum = executionSummary.length + 1;
            executionSummary.push({
              iteration: iterationNum,
              tools: toolNames,
              duration,
              success
            });
            
            // 只显示关键工具的执行结果
            if (toolNames.includes('executeMarkdownEdits') || toolNames.includes('taskComplete')) {
              const status = success ? '✅' : '❌';
              const displayText = this.formatToolsDisplay(toolCalls);
              
              if (toolNames.includes('taskComplete')) {
                // taskComplete 只显示简单的状态信息，避免与最终任务完成信息重复
                if (success) {
                  this.stream.markdown(`${status} **${displayText}** 完成 (${duration}ms)\n\n`);
                } else {
                  const errors = results.filter(r => !r.success).map(r => r.error).join('; ');
                  this.stream.markdown(`${status} **${displayText}** 失败 - ${errors} (${duration}ms)\n\n`);
                }
              } else {
                // executeMarkdownEdits 等其他工具显示详细摘要
                const smartSummary = this.generateToolsSummary(results);
                if (success) {
                  this.stream.markdown(`${status} **${displayText}** 完成${smartSummary ? ` - ${smartSummary}` : ''} (${duration}ms)\n\n`);
                } else {
                  const errors = results.filter(r => !r.success).map(r => r.error).join('; ');
                  this.stream.markdown(`${status} **${displayText}** 失败 - ${errors} (${duration}ms)\n\n`);
                }
              }
            }
          },
          onTaskComplete: (summary) => {
            // 显示执行摘要
            if (executionSummary.length > 1) {
              this.stream.markdown(`\n---\n### 📊 执行摘要\n\n`);
              this.stream.markdown(`总共完成 **${executionSummary.length}** 轮迭代：\n\n`);
              
              executionSummary.forEach(item => {
                const statusIcon = item.success ? '✅' : '❌';
                const toolList = item.tools.join(', ');
                this.stream.markdown(`- ${statusIcon} 第${item.iteration}轮: ${toolList} (${item.duration}ms)\n`);
              });
              
              this.stream.markdown(`\n---\n\n`);
            }
            
            this.stream.markdown(`📝 **任务完成** - ${summary}\n\n`);
          }
        };
        
        // 🚀 新增：记录orchestrator生成的execution_plan到执行历史
        if (plan.response_mode === 'PLAN_EXECUTION' && plan.execution_plan) {
          await this.recordExecution(
            'plan_execution',
            `Orchestrator生成执行计划: ${plan.execution_plan.planId}`,
            true,
            'orchestrator',
            plan.execution_plan  // 完整的execution_plan JSON
          );
        }
        
        // 🚀 修复递归调用：传递已有的计划，避免重复调用generateUnifiedPlan
        const executionResult = await this.orchestrator.planAndExecute(
          this.state.currentTask,
          await this.getCurrentSessionContext(),
          this.selectedModel,
          plan,  // 🚀 关键：传递已生成的plan，避免重复LLM调用
          progressCallback  // 🚀 新增：传递进度回调
        );
        
        this.logger.info(`🔍 [DEBUG] planAndExecute result: intent=${executionResult.intent}`);
        
        // 根据执行结果更新引擎状态
        if (executionResult.intent === 'plan_completed') {
          this.stream.markdown(`✅ **计划执行完成**: ${executionResult.result?.summary}\n\n`);
          this.logger.info(`🔍 [DEBUG-CONTEXT] === PLAN EXECUTION COMPLETED ===`);
        this.logger.info(`🔍 [DEBUG-CONTEXT] About to record execution: "计划执行完成: ${executionResult.result?.summary}"`);
        await this.recordExecution('result', `计划执行完成: ${executionResult.result?.summary}`, true, 'planExecutor', executionResult.result?.planExecutionContext);
                  this.logger.info(`🔍 [DEBUG-CONTEXT] Plan execution recorded. New executionHistory.length: ${this.state.executionHistory.length}`);
          
          // 🔍 [DEBUG-SESSION-SYNC] 检查计划完成后的session状态
          this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] === TASK COMPLETION IN SRSAgentEngine ===`);
          const currentSessionAfterPlan = await this.getCurrentSessionContext();
          if (currentSessionAfterPlan) {
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] Session after plan completion:`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] - sessionId: ${currentSessionAfterPlan.sessionContextId}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] - lastModified: ${currentSessionAfterPlan.metadata.lastModified}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] - projectName: ${currentSessionAfterPlan.projectName}`);
          } else {
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] ⚠️ NO SESSION found after plan completion!`);
          }
          
          this.state.stage = 'completed';
          this.logger.info(`🔍 [DEBUG-CONTEXT] Task completed. Final executionHistory.length: ${this.state.executionHistory.length}`);
          return;
        } else if (executionResult.intent === 'plan_failed') {
          // 🚀 新增：使用完整的恢复检测逻辑
          await this.handlePlanFailedWithRecovery(executionResult);
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
          this.stream.markdown(`⏸️ **等待您的回复...**\n\n`);  // 🚀 修复3：添加明确的等待提示
          await this.recordExecution('user_interaction', `向用户提问: ${executionResult.result?.question}`, true);
          return;
        } else {
          // 其他情况，记录并继续
          this.logger.info(`🔍 [DEBUG] 未知的planAndExecute结果: ${executionResult.intent}`);
          this.stream.markdown(`ℹ️ **计划执行状态**: ${executionResult.intent}\n\n`);
          // 🚀 新增：plan_execution模式下设置完成状态，避免显示执行总结
          this.state.stage = 'completed';
          return;
        }
        
      } catch (error) {
        this.logger.error(`❌ [DEBUG] planAndExecute执行失败`, error as Error);
        this.stream.markdown(`❌ **计划执行出错**: ${(error as Error).message}\n\n`);
        await this.recordExecution('result', `计划执行出错: ${(error as Error).message}`, false, 'planExecutor', null);
        this.state.stage = 'error';
        return;
      }
    }
    
    // 3. 检查响应模式
    if (plan.response_mode === AIResponseMode.KNOWLEDGE_QA) {
      this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] 进入KNOWLEDGE_QA模式处理`);
      this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - 是否有direct_response: ${!!plan.direct_response}`);
      this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - 是否有tool_calls: ${!!(plan.tool_calls && plan.tool_calls.length > 0)}`);
      
      // 🚀 修复：优先级调整 - 先检查是否有工具调用，支持"先回复+再搜索"的交互模式
      if (plan.tool_calls && plan.tool_calls.length > 0) {
        // 情况1: 有工具调用（可能同时有 direct_response）
        if (plan.direct_response) {
          this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] 有tool_calls和direct_response，先显示回复再执行工具`);
          this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - direct_response长度: ${plan.direct_response.length}`);
          this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - direct_response前100字符: ${plan.direct_response.substring(0, 100)}`);
          
          // 先显示初步回复
          this.stream.markdown(`💬 **AI回复**: ${plan.direct_response}\n\n`);
          this.stream.markdown(`🔍 正在搜索更多信息...\n\n`);
          
          await this.recordExecution('result', plan.direct_response, true);
        } else {
          this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] 只有tool_calls没有direct_response，继续执行工具`);
        }
        // ⚠️ 关键：不要return，让代码继续到第658行的工具执行部分
        
      } else if (plan.direct_response) {
        // 情况2: 只有 direct_response，没有工具调用
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] 只有direct_response没有tool_calls，显示后完成`);
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - direct_response长度: ${plan.direct_response.length}`);
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - direct_response前100字符: ${plan.direct_response.substring(0, 100)}`);
        
        // 检查是否是错误响应
        const isErrorResponse = plan.direct_response.includes('❌') || 
                               plan.direct_response.includes('错误') ||
                               plan.thought?.includes('Error');
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - 是否为错误响应: ${isErrorResponse}`);
        
        // 显示回复并完成任务
        this.stream.markdown(`💬 **AI回复**: ${plan.direct_response}\n\n`);
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] 已调用stream.markdown显示响应`);
        
        await this.recordExecution('result', plan.direct_response, true);
        this.state.stage = 'completed';
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] 设置state.stage为completed，准备返回`);
        return;
        
      } else {
        // 情况3: 既没有 direct_response 也没有 tool_calls
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] 既没有direct_response也没有tool_calls，任务完成`);
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
        this.stream.markdown(`�� **所有工具都已执行过，启动智能总结**\n\n`);
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
      // 🔍 [DEBUG] 详细分析executionHistory内容
      this.logger.info(`🔍 [DEBUG-CONTEXT] === EXECUTION HISTORY ANALYSIS ===`);
      this.logger.info(`🔍 [DEBUG-CONTEXT] executionHistory.length: ${this.state.executionHistory.length}`);
      
      if (this.state.executionHistory.length === 0) {
        this.logger.warn(`🔍 [DEBUG-CONTEXT] ⚠️ executionHistory is EMPTY! This will cause "No actions have been taken yet"`);
      } else {
        this.logger.info(`🔍 [DEBUG-CONTEXT] executionHistory contents:`);
        this.state.executionHistory.forEach((step, index) => {
          this.logger.info(`🔍 [DEBUG-CONTEXT] [${index}] ${step.type}: "${step.content}" (success: ${step.success}, toolName: ${step.toolName})`);
        });
      }
      
      // 🚀 Code Review修复：构建分离的上下文，传入currentTask来处理第一轮用户输入
      const { historyContext, toolResultsContext } = this.contextManager.buildContextForPrompt(this.state.executionHistory, this.state.currentTask);
      
      // this.logger.info(`🔍 [DEBUG] Context prepared for orchestrator:`);
      // this.logger.info(`🔍 [DEBUG] - historyContext length: ${historyContext.length}`);
      // this.logger.info(`🔍 [DEBUG] - toolResultsContext length: ${toolResultsContext.length}`);
      // this.logger.info(`🔍 [DEBUG] - sessionContext available: ${!!(await this.getCurrentSessionContext())}`);
      
      // 🔍 [DEBUG] 输出完整的context内容
      const sessionContext = await this.getCurrentSessionContext();
      // this.logger.info(`🔍 [DEBUG] === FULL CONTEXT CONTENT ===`);
      // this.logger.info(`🔍 [DEBUG] historyContext:\n${historyContext}`);
      // this.logger.info(`🔍 [DEBUG] toolResultsContext:\n${toolResultsContext}`);
      // this.logger.info(`🔍 [DEBUG] sessionContext:\n${JSON.stringify(sessionContext, null, 2)}`);
      // this.logger.info(`🔍 [DEBUG] === END CONTEXT CONTENT ===`);
      
      // 调用Orchestrator的规划方法
      this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] 准备调用orchestrator.generateUnifiedPlan`);
      this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - currentTask长度: ${this.state.currentTask.length}`);
      this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - historyContext长度: ${historyContext.length}`);
      this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - toolResultsContext长度: ${toolResultsContext.length}`);
      this.logger.info(`🔧 [FIX] - iterationCount: ${this.state.iterationCount}`);

      const plan = await this.orchestrator.generateUnifiedPlan(
        this.state.currentTask,
        await this.getCurrentSessionContext(),
        this.selectedModel,
        historyContext, // 🚀 历史上下文
        toolResultsContext, // 🚀 工具结果上下文
        this.state.iterationCount  // 🔧 传递迭代计数
      );
      
      this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] orchestrator.generateUnifiedPlan返回成功`);
      this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - 返回的plan.response_mode: ${plan.response_mode}`);
      this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - 返回的plan.direct_response存在: ${!!plan.direct_response}`);
      this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - 返回的plan.thought前100字符: ${plan.thought?.substring(0, 100) || 'null'}`);
      
      if (plan.direct_response) {
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - plan.direct_response长度: ${plan.direct_response.length}`);
        this.logger.info(`🚨 [TOKEN_LIMIT_DEBUG] - plan.direct_response前100字符: ${plan.direct_response.substring(0, 100)}`);
      }
      
      // this.logger.info(`🔍 [DEBUG] orchestrator.generateUnifiedPlan returned successfully`);
      // this.logger.info(`🔍 [DEBUG] Plan response_mode: ${plan.response_mode}`);
      // this.logger.info(`🔍 [DEBUG] Plan has execution_plan: ${!!(plan as any).execution_plan}`);
      // this.logger.info(`🔍 [DEBUG] Plan has tool_calls: ${!!plan.tool_calls && plan.tool_calls.length > 0}`);
      
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

  // ============================================================================
  // 🚀 Specialist进度显示辅助方法
  // ============================================================================

  /**
   * 格式化工具显示文本 - 实现用户建议的显示策略
   * @param toolCalls 工具调用数组
   * @returns 格式化的显示文本
   */
  private formatToolsDisplay(toolCalls: Array<{ name: string; args: any }>): string {
    if (toolCalls.length === 1) {
      return toolCalls[0].name;
    } else {
      return `${toolCalls[0].name} 和其它共${toolCalls.length}个工具`;
    }
  }

  /**
   * 生成工具执行结果的智能摘要
   * @param results 工具执行结果数组
   * @returns 智能摘要文本或undefined
   */
  private generateToolsSummary(results: Array<{
    toolName: string;
    success: boolean;
    result?: any;
    error?: string;
  }>): string | undefined {
    const successResults = results.filter(r => r.success);
    if (successResults.length === 0) return undefined;

    // 使用第一个成功结果生成摘要
    const firstResult = successResults[0];
    return this.generateSmartSummary(firstResult.toolName, firstResult.result);
  }

  /**
   * 为不同工具生成智能摘要
   * @param toolName 工具名称
   * @param result 工具结果
   * @returns 智能摘要
   */
  private generateSmartSummary(toolName: string, result: any): string {
    if (!result) return '';

    switch (toolName) {
      case 'executeSemanticEdits':
      case 'executeMarkdownEdits':
        return `应用${result.appliedCount || result.appliedIntents?.length || 0}个编辑`;
      
      case 'readFileWithStructure':
      case 'readMarkdownFile':
        const sizeKB = Math.round((result.metadata?.documentLength || result.content?.length || 0) / 1024);
        return `读取文件 (${sizeKB}KB)`;
      
      case 'taskComplete':
        return result.summary || '任务完成';
      
      case 'askQuestion':
        return `等待用户输入：${result.question || result.chatQuestion || ''}`;

      case 'listFiles':
        return `发现${result.structure?.totalCount || 0}个文件`;

      case 'createDirectory':
        return '创建目录';

      case 'writeFile':
        return '写入文件';
      
      default:
        return '';
    }
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
    // 🚀 新增：处理内部计划恢复工具
    if (toolCall.name === 'internal_resume_plan') {
      await this.handleInternalPlanRecoveryTool(toolCall);
      return;
    }
    
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

  // 🚀 新增：处理内部计划恢复工具
  private async handleInternalPlanRecoveryTool(toolCall: { name: string; args: any }): Promise<void> {
    if (toolCall.name === 'internal_resume_plan') {
      if (toolCall.args.action === 'resume') {
        await this.resumePlanFromInterruption();
      } else if (toolCall.args.action === 'terminate') {
        await this.terminatePlan();
      }
    }
  }

  // 🚀 新增：特殊处理specialist工具的用户交互需求
  private async handleSpecialistTool(toolCall: { name: string; args: any }): Promise<{ needsUserInteraction: boolean } | undefined> {
    this.stream.markdown(`🧠 **需求文档专家正在工作**: ${toolCall.name}\n`);
    
    const startTime = Date.now();
    // 🚀 修复：移除重复记录，只保留最终结果记录
    
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
      
      // 🚀 修复：正确检查工具执行结果状态
      if (!result.success) {
        // 工具执行失败的处理
        const errorMsg = result.error || '未知错误';
        this.stream.markdown(`❌ **${toolCall.name}** 执行失败 (${duration}ms): ${errorMsg}\n\n`);
        
        await this.recordExecution(
          'tool_call', 
          `${toolCall.name} 执行失败: ${errorMsg}`, 
          false, 
          toolCall.name, 
          result, 
          toolCall.args,
          duration
        );
        
        return { needsUserInteraction: false };
      }
      
      // 正常处理（工具执行成功且无用户交互需求）
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
   * 🚀 新增：提取原始specialist上下文
   */
  private extractOriginalSpecialistContext(resumeContext: any): any {
    this.logger.info(`🔍 提取原始specialist上下文`);
    
    // 从复杂的resumeContext中提取原始的specialist状态
    if (resumeContext.askQuestionContext?.originalResult?.resumeContext) {
      this.logger.info(`🔍 从askQuestionContext.originalResult.resumeContext提取`);
      return resumeContext.askQuestionContext.originalResult.resumeContext;
    }
    
    // 检查是否是直接的specialist resumeContext
    if (resumeContext.specialist && resumeContext.iteration !== undefined) {
      this.logger.info(`🔍 直接使用specialist resumeContext`);
      return resumeContext;
    }
    
    // 兼容性处理 - 从旧格式中提取
    this.logger.warn(`⚠️ 使用兼容性处理提取specialist上下文`);
    return {
      specialist: resumeContext.ruleId || 'unknown',
      iteration: resumeContext.currentIteration || 0,
      internalHistory: resumeContext.conversationHistory || [],
      contextForThisStep: resumeContext.context || {},
      toolResults: [],
      currentPlan: resumeContext.pendingPlan || {},
      startTime: Date.now()
    };
  }

  /**
   * 🚀 新增：使用用户回复恢复PlanExecutor执行状态
   * 
   * @param userResponse 用户的回复内容
   * @returns 明确的恢复结果，包含intent和相关数据
   * 
   * 🔄 v2.0 (2025-10-08): 改用intent机制替代boolean，消除语义歧义
   * 返回值结构：
   * - intent: 'specialist_continued' | 'user_interaction_required' | 'specialist_failed'
   * - result: 相关数据
   * - metadata: 调试信息
   */
  private async resumePlanExecutorWithUserResponse(userResponse: string): Promise<{
    intent: 'specialist_continued' | 'user_interaction_required' | 'specialist_failed';
    result?: any;
    metadata?: {
      specialistId?: string;
      iteration?: number;
      needsUserInteraction?: boolean;
    };
  }> {
    const resumeContext = this.state.resumeContext!;
    const planExecutorState = resumeContext.planExecutorState;
    
    this.logger.info(`🔄 恢复PlanExecutor状态: specialist=${planExecutorState.specialistLoopState.specialistId}, iteration=${planExecutorState.specialistLoopState.currentIteration}`);
    
    // 🚀 关键修复：从原始的SpecialistInteractionResult恢复specialist状态
    const originalSpecialistResumeContext = this.extractOriginalSpecialistContext(resumeContext);
    
    // 1. 创建SpecialistExecutor实例
    const { SpecialistExecutor } = await import('./specialistExecutor');
    const specialistExecutor = new SpecialistExecutor();
    
    // 2. 恢复SessionContext
    const sessionContext = await this.restoreSessionContext(planExecutorState.sessionContext);
    
    // 3. 恢复specialist执行
    this.stream.markdown(`🔄 **恢复specialist执行**: ${planExecutorState.specialistLoopState.specialistId} (第${originalSpecialistResumeContext.iteration}轮)\n\n`);
    
    try {
      // 🚀 关键修复：使用新的resumeState参数正确恢复specialist执行
      const continuedResult = await specialistExecutor.execute(
        planExecutorState.specialistLoopState.specialistId,
        originalSpecialistResumeContext.contextForThisStep,
        this.selectedModel,
        {
          iteration: originalSpecialistResumeContext.iteration,
          internalHistory: originalSpecialistResumeContext.internalHistory,
          currentPlan: originalSpecialistResumeContext.currentPlan,
          toolResults: originalSpecialistResumeContext.toolResults,
          userResponse: userResponse,  // 🚀 关键：传递用户回复
          contextForThisStep: originalSpecialistResumeContext.contextForThisStep
        },
        undefined, // progressCallback 
        () => this.state.cancelled === true // 🚀 v6.0：传递取消检查回调
      );
      
      // 🚀 如果specialist成功继续，需要更新PlanExecutor的循环状态
      if (continuedResult.success) {
        this.stream.markdown(`✅ **Specialist执行成功**\n\n`);
        
        // 🚀 CRITICAL FIX: 移除对TASK_FINISHED的错误特殊处理
        // 无论specialist返回什么nextStepType，都让PlanExecutor来决定是否继续执行剩余步骤
        // 这修复了specialist的TASK_FINISHED错误终止多步骤计划的critical bug
        await this.resumePlanExecutorLoop(planExecutorState, continuedResult, userResponse);
        
        // 🚀 v2.0 (2025-10-08): 返回明确的intent
        return {
          intent: 'specialist_continued',
          result: continuedResult,
          metadata: {
            specialistId: planExecutorState.specialistLoopState.specialistId,
            iteration: planExecutorState.specialistLoopState.currentIteration,
            needsUserInteraction: false
          }
        };
        
      } else if ('needsChatInteraction' in continuedResult && continuedResult.needsChatInteraction) {
        // 🚀 处理specialist需要进一步用户交互的情况
        this.logger.info(`💬 Specialist恢复后仍需要用户交互: "${continuedResult.question}"`);
        
        // 重新设置等待用户输入状态
        this.state.stage = 'awaiting_user';
        this.state.pendingInteraction = {
          type: 'input',
          message: continuedResult.question || '需要您的确认',
          options: []
        };
        
        // 🚀 CRITICAL FIX (2025-10-08): 保留planExecutorState，不要直接覆盖
        // 
        // 问题：specialist返回的resumeContext不包含planExecutorState
        // 如果直接覆盖，会丢失第一次恢复时保存的完整PlanExecutor上下文
        // 导致第二次恢复时无法识别为新格式，走到旧格式分支
        // 
        // 解决：合并对象，但强制保留planExecutorState
        this.logger.info(`🔍 [RESUME_STATE] 合并resumeContext，保留planExecutorState`);
        this.logger.info(`🔍 [RESUME_STATE] 当前planExecutorState存在: ${!!this.state.resumeContext?.planExecutorState}`);
        
        this.state.resumeContext = {
          ...this.state.resumeContext!,  // 保留原有的完整上下文（非空断言，前面已检查）
          ...continuedResult.resumeContext,  // 合并specialist的新状态
          // 🚀 强制保留关键字段，确保不被覆盖
          planExecutorState: this.state.resumeContext!.planExecutorState,
          // 更新askQuestionContext记录新的问题
          askQuestionContext: {
            toolCall: { name: 'askQuestion', args: {} },
            question: continuedResult.question,
            originalResult: continuedResult,
            timestamp: Date.now()
          }
        };
        
        this.logger.info(`🔍 [RESUME_STATE] 合并后planExecutorState存在: ${!!this.state.resumeContext?.planExecutorState}`);
        
        this.stream.markdown(`💬 **${continuedResult.question}**\n\n`);
        this.stream.markdown(`⏸️ **等待您的回复...**\n\n`);  // 🚀 修复3：添加明确的等待提示
        
        // 🚀 v2.0 (2025-10-08): 返回明确的intent
        return {
          intent: 'user_interaction_required',
          result: {
            question: continuedResult.question,
            resumeContext: this.state.resumeContext
          },
          metadata: {
            specialistId: planExecutorState.specialistLoopState.specialistId,
            iteration: planExecutorState.specialistLoopState.currentIteration,
            needsUserInteraction: true
          }
        };
        
      } else {
        const errorMsg = ('error' in continuedResult) ? continuedResult.error : '执行失败';
        this.stream.markdown(`❌ **Specialist执行失败**: ${errorMsg}\n\n`);
        await this.recordExecution('result', `Specialist恢复执行失败: ${errorMsg}`, false);
        
        // 🚀 v2.0 (2025-10-08): 返回明确的intent
        return {
          intent: 'specialist_failed',
          result: {
            error: errorMsg
          }
        };
      }
      
    } catch (error) {
      this.logger.error(`❌ Specialist恢复执行异常: ${(error as Error).message}`);
      this.stream.markdown(`❌ **恢复执行异常**: ${(error as Error).message}\n\n`);
      
      // 🚀 v2.0 (2025-10-08): 返回明确的intent
      return {
        intent: 'specialist_failed',
        result: {
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * 🚀 新增：恢复PlanExecutor循环
   */
  private async resumePlanExecutorLoop(
    planExecutorState: any, 
    specialistResult: SpecialistOutput, 
    userResponse: string
  ): Promise<void> {
    this.logger.info(`🔄 恢复PlanExecutor循环执行`);
    
    // 重新创建PlanExecutor，但恢复其循环状态
    const { PlanExecutor } = await import('./orchestrator/PlanExecutor');
    const { SpecialistExecutor } = await import('./specialistExecutor');
    
    const specialistExecutor = new SpecialistExecutor();
    const planExecutor = new PlanExecutor(specialistExecutor);
    
    // 🚀 关键：恢复循环状态到PlanExecutor
    planExecutor.restoreLoopState(
      planExecutorState.specialistLoopState.specialistId,
      planExecutorState.specialistLoopState
    );
    
    // 🚀 继续执行计划的剩余部分
    const sessionContext = await this.restoreSessionContext(planExecutorState.sessionContext);
    const finalResult = await planExecutor.continueExecution(
      planExecutorState.plan,
      planExecutorState.currentStep,
      planExecutorState.stepResults,
      sessionContext,
      this.selectedModel,
      planExecutorState.userInput,
      specialistResult  // 传入specialist的最新结果
    );
    
    await this.handlePlanExecutionResult(finalResult);
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



  // ============================================================================
  // 🧹 资源管理
  // ============================================================================

  /**
   * 🚀 v6.0：清理引擎资源，取消观察者订阅
   */
  public dispose(): void {
    // 🚨 新增：Engine销毁追踪
    const timestamp = new Date().toISOString();
    const disposeStack = new Error().stack;
    
    this.logger.warn(`🚨 [ENGINE DISPOSE] Engine being disposed at ${timestamp}`);
    this.logger.warn(`🚨 [ENGINE DISPOSE] Engine state: stage=${this.state.stage}, task="${this.state.currentTask}"`);
    this.logger.warn(`🚨 [ENGINE DISPOSE] Execution history length: ${this.state.executionHistory.length}`);
    this.logger.warn(`🚨 [ENGINE DISPOSE] Call stack:`);
    this.logger.warn(disposeStack || 'No stack trace available');
    
    this.logger.info('🧹 Disposing SRSAgentEngine and unsubscribing from session changes');
    this.sessionManager.unsubscribe(this);
    
    this.logger.warn(`🚨 [ENGINE DISPOSE] Engine disposed successfully`);
  }

  /**
   * 🚀 v6.0：获取引擎统计信息（用于调试和监控）
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

  // ============================================================================
  // 🚀 新增：计划恢复增强功能
  // ============================================================================

  /**
   * 🚀 检测是否为被动中断（使用二分法 - MECE原则）
   * 策略：明确识别"主动失败"，其余全部归类为"被动中断"
   */
  private detectPassiveInterruption(executionResult: any): boolean {
    const error = executionResult.result?.error || '';
    
    // 🚀 二分法：明确的"主动失败"模式（业务逻辑错误，不应自动恢复）
    const activeFailurePatterns = [
      // 业务逻辑错误
      '业务逻辑验证失败',
      '业务规则冲突',
      '数据完整性检查失败',
      
      // 参数和格式错误
      '参数验证错误',
      '参数格式错误',
      'JSON格式错误',
      '缺少必需字段',
      '无效的参数值',
      
      // 权限和配置错误
      '权限不足',
      '访问被拒绝',
      '文件权限错误',
      '工具不存在',
      '配置错误',
      
      // 用户输入错误
      '用户输入无效',
      '用户取消操作',
      '用户拒绝确认',
      
      // Specialist 输出格式错误
      'Specialist返回了无效',
      '输出格式不符合要求',
      '必需的工具调用缺失',
      
      // 文件系统错误（非临时性）
      '文件不存在且无法创建',
      '磁盘空间不足',
      '路径无效'
    ];
    
    // 🚀 检查是否为明确的主动失败
    const isActiveFailure = activeFailurePatterns.some(pattern => 
      error.includes(pattern)
    );
    
    // 🚀 二分法核心：不是主动失败的，都视为被动中断（可恢复）
    const isPassiveInterruption = !isActiveFailure;
    
    this.logger.info(`🔍 中断检测 (二分法): ${isPassiveInterruption ? '被动中断' : '主动失败'} - ${error.substring(0, 100)}`);
    this.logger.info(`🔍 检测逻辑: ${isActiveFailure ? '匹配主动失败模式' : '未匹配主动失败模式，归类为被动中断'}`);
    
    return isPassiveInterruption;
  }

  /**
   * 🚀 提取已完成步骤的结果
   */
  private extractCompletedStepResults(executionResult: any): { [key: number]: SpecialistOutput } {
    const completedWork = executionResult.result?.planExecutionContext?.completedWork || [];
    const stepResults: { [key: number]: SpecialistOutput } = {};
    
    // 从 planExecutionContext 中恢复已完成步骤的结果
    completedWork.forEach((work: any) => {
      if (work.status === 'completed') {
        stepResults[work.step] = {
          success: true,
          content: work.summary || '',
          requires_file_editing: false,  // 🚀 添加必需字段
          metadata: {
            specialist: work.specialist,
            iterations: 0,
            executionTime: 0,
            timestamp: new Date().toISOString()
          }
        };
      }
    });
    
    this.logger.info(`📊 提取已完成步骤: ${Object.keys(stepResults).length} 个`);
    return stepResults;
  }

  /**
   * 🚀 序列化会话上下文
   */
  private serializeSessionContext(sessionContext: SessionContext | null): any {
    if (!sessionContext) return null;
    
    return {
      sessionContextId: sessionContext.sessionContextId,
      projectName: sessionContext.projectName,
      baseDir: sessionContext.baseDir,
      activeFiles: sessionContext.activeFiles,
      gitBranch: sessionContext.gitBranch,
      metadata: sessionContext.metadata
    };
  }

  /**
   * 🚀 显示计划恢复选项
   */
  private async showPlanRecoveryOptions(): Promise<void> {
    const state = this.state.planInterruptionState!;
    
    this.stream.markdown(`❌ **计划执行中断**: ${state.interruptionReason}\n\n`);
    this.stream.markdown(`📋 **计划信息**:\n`);
    this.stream.markdown(`- 计划: ${state.planDescription}\n`);
    this.stream.markdown(`- 失败步骤: ${state.failedStep}\n`);
    this.stream.markdown(`- 已完成: ${Object.keys(state.completedStepResults).length} 步骤\n`);
    this.stream.markdown(`- 剩余: ${state.originalPlan.steps.length - state.failedStep + 1} 步骤\n\n`);
    
    // 🚀 复用现有的选择交互机制
    this.state.stage = 'awaiting_user';
    this.state.pendingInteraction = {
      type: 'choice',
      message: '计划执行遇到临时问题，您希望如何处理？',
      options: [
        '继续执行写作计划',
        '结束写作计划'
      ],
      toolCall: {
        name: 'internal_plan_recovery',
        args: { action: 'user_choice_pending' }
      }
    };
    
    this.stream.markdown(`**请选择**:\n`);
    this.stream.markdown(`1. 继续执行写作计划 (从步骤 ${state.failedStep} 重新开始)\n`);
    this.stream.markdown(`2. 结束写作计划\n\n`);
  }

  /**
   * 🚀 持久化中断状态
   */
  private async persistInterruptionState(interruptionState: PlanInterruptionState): Promise<void> {
    try {
      await this.sessionManager.updateSessionWithLog({
        logEntry: {
          type: OperationType.PLAN_INTERRUPTED,
          operation: `计划 ${interruptionState.planId} 被动中断，已保存恢复状态`,
          success: true,
          userInput: {
            planId: interruptionState.planId,
            failedStep: interruptionState.failedStep,
            completedSteps: Object.keys(interruptionState.completedStepResults).length,
            interruptionReason: interruptionState.interruptionReason,
            canResume: interruptionState.canResume
          } as any
        }
      });
      
      this.logger.info(`📋 计划中断状态已持久化: ${interruptionState.planId}`);
      
    } catch (error) {
      this.logger.warn(`Failed to persist interruption state: ${(error as Error).message}`);
    }
  }

  /**
   * 🚀 恢复计划执行
   */
  private async resumePlanFromInterruption(): Promise<void> {
    const interruptionState = this.state.planInterruptionState!;
    
    this.stream.markdown(`🔄 **正在恢复计划执行...**\n\n`);
    this.stream.markdown(`📋 从步骤 ${interruptionState.failedStep} 重新开始\n\n`);
    
    try {
      // 🚀 关键：调用 PlanExecutor.resumeFromStep() 保持原始上下文
      const executionResult = await this.planExecutor.resumeFromStep(
        interruptionState.originalPlan,
        interruptionState.failedStep,
        interruptionState.completedStepResults,
        interruptionState.sessionContext,
        interruptionState.userInput,
        this.selectedModel,  // 🚀 传递 selectedModel
        this.createProgressCallback()
      );
      
      // 记录恢复执行
      await this.sessionManager.updateSessionWithLog({
        logEntry: {
          type: OperationType.PLAN_RESUMED,
          operation: `计划 ${interruptionState.planId} 恢复执行`,
          success: executionResult.intent === 'plan_completed',
          userInput: {
            planId: interruptionState.planId,
            resumedFromStep: interruptionState.failedStep,
            result: executionResult.intent
          } as any
        }
      });
      
      // 处理恢复结果
      if (executionResult.intent === 'plan_completed') {
        this.stream.markdown(`✅ **计划恢复执行成功完成**\n\n`);
        this.state.stage = 'completed';
        this.state.planInterruptionState = undefined; // 清除中断状态
        
      } else if (executionResult.intent === 'plan_failed') {
        // 恢复执行又失败了，再次检查是否可以继续恢复
        const isStillPassiveInterruption = this.detectPassiveInterruption(executionResult);
        if (isStillPassiveInterruption && this.state.planInterruptionState) {
          // 更新中断状态并再次显示选项
          this.state.planInterruptionState.failedStep = executionResult.result?.failedStep;
          this.state.planInterruptionState.interruptionReason = executionResult.result?.error;
          this.state.planInterruptionState.interruptionTimestamp = new Date().toISOString();
          await this.showPlanRecoveryOptions();
        } else {
          // 不可恢复的失败
          this.stream.markdown(`❌ **计划恢复执行失败**: ${executionResult.result?.error}\n\n`);
          this.state.stage = 'error';
          this.state.planInterruptionState = undefined;
        }
      }
      
    } catch (error) {
      this.logger.error(`❌ 恢复计划执行异常: ${(error as Error).message}`);
      this.stream.markdown(`❌ **恢复执行异常**: ${(error as Error).message}\n\n`);
      this.state.stage = 'error';
      this.state.planInterruptionState = undefined;
    }
  }

  /**
   * 🚀 终止计划执行
   */
  private async terminatePlan(): Promise<void> {
    const interruptionState = this.state.planInterruptionState!;
    
    this.stream.markdown(`❌ **计划执行已终止**\n\n`);
    this.stream.markdown(`📋 **执行总结**:\n`);
    this.stream.markdown(`- 计划: ${interruptionState.planDescription}\n`);
    this.stream.markdown(`- 已完成: ${Object.keys(interruptionState.completedStepResults).length} 步骤\n`);
    this.stream.markdown(`- 终止原因: 用户选择终止\n\n`);
    
    // 记录计划终止
    await this.sessionManager.updateSessionWithLog({
      logEntry: {
        type: OperationType.PLAN_TERMINATED,
        operation: `计划 ${interruptionState.planId} 用户选择终止`,
        success: true,
        userInput: {
          planId: interruptionState.planId,
          terminatedAtStep: interruptionState.failedStep,
          completedSteps: Object.keys(interruptionState.completedStepResults).length,
          reason: '用户选择终止'
        } as any
      }
    });
    
    this.state.stage = 'completed';
    this.state.planInterruptionState = undefined; // 清除中断状态
  }

  /**
   * 🚀 处理 plan_failed 的完整逻辑（包含恢复检测）
   */
  private async handlePlanFailedWithRecovery(executionResult: any): Promise<void> {
    const isPassiveInterruption = this.detectPassiveInterruption(executionResult);
    
    if (isPassiveInterruption) {
      // 🚀 被动中断：保存状态并显示恢复选项
      this.state.planInterruptionState = {
        planId: executionResult.result?.planExecutionContext?.originalExecutionPlan?.planId || 'unknown',
        planDescription: executionResult.result?.planExecutionContext?.originalExecutionPlan?.description || 'unknown',
        originalPlan: executionResult.result?.planExecutionContext?.originalExecutionPlan,
        failedStep: executionResult.result?.failedStep || 0,
        completedStepResults: this.extractCompletedStepResults(executionResult),
        sessionContext: this.serializeSessionContext(await this.getCurrentSessionContext()),
        userInput: this.state.currentTask,
        interruptionReason: executionResult.result?.error || 'unknown error',
        interruptionTimestamp: new Date().toISOString(),
        canResume: true
      };
      
      // 🚀 持久化中断状态
      await this.persistInterruptionState(this.state.planInterruptionState);
      
      // 🚀 显示恢复选项
      await this.showPlanRecoveryOptions();
      return; // 等待用户选择
      
    } else {
      // 原有的失败处理逻辑（无法恢复的失败）
      this.stream.markdown(`❌ **计划执行失败**: ${executionResult.result?.error}\n\n`);
      this.logger.info(`🔍 [DEBUG-CONTEXT] === PLAN EXECUTION FAILED (不可恢复) ===`);
      
      this.logger.info(`🔍 [DEBUG-CONTEXT] About to record execution: "计划执行失败: ${executionResult.result?.error}"`);
      await this.recordExecution('result', `计划执行失败: ${executionResult.result?.error}`, false, 'planExecutor', executionResult.result?.planExecutionContext);
      this.logger.info(`🔍 [DEBUG-CONTEXT] Plan execution failure recorded. New executionHistory.length: ${this.state.executionHistory.length}`);
        
      // 🚨 新增：Engine状态变为error的详细追踪
      const errorStack = new Error().stack;
      const timestamp = new Date().toISOString();
      this.logger.warn(`🚨 [ENGINE ERROR] Engine state changing to ERROR at ${timestamp}`);
      this.logger.warn(`🚨 [ENGINE ERROR] Failure reason: ${executionResult.result?.error}`);
      this.logger.warn(`🚨 [ENGINE ERROR] Failed step: ${executionResult.result?.failedStep || 'unknown'}`);
      this.logger.warn(`🚨 [ENGINE ERROR] Specialist: ${executionResult.result?.failedSpecialist || 'unknown'}`);
      this.logger.warn(`🚨 [ENGINE ERROR] Call stack:`);
      this.logger.warn(errorStack || 'No stack trace available');
      
      this.state.stage = 'error';
      this.logger.info(`🔍 [DEBUG-CONTEXT] Task failed. Final executionHistory.length: ${this.state.executionHistory.length}`);
      
      // 🚨 新增：Engine进入error状态后的状态检查
      this.logger.warn(`🚨 [ENGINE ERROR] Engine now in ERROR state - stage: ${this.state.stage}`);
      this.logger.warn(`🚨 [ENGINE ERROR] This Engine may become orphaned if not properly handled`);
    }
  }

  /**
   * 🚀 创建进度回调
   */
  private createProgressCallback(): any {
    return {
      onSpecialistStart: (specialistId: string) => {
        this.stream.markdown(`🧠 **需求文档专家正在工作**: ${specialistId}\n\n`);
      },
      onIterationStart: (current: number, max: number) => {
        this.stream.progress(`第 ${current}/${max} 轮迭代...`);
      },
      onTaskComplete: (summary: string) => {
        this.stream.markdown(`📝 **任务完成** - ${summary}\n\n`);
      }
    };
  }
}