import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { SessionContext } from '../../types/session';
import { toolExecutor } from '../toolExecutor';
import { AIPlan, CallerType } from '../../types/index';
import { TaskCompletionResult, NextStepType } from '../../types/taskCompletion';

/**
 * 对话式执行器 - 负责思维链和对话式规划循环
 */
export class ConversationalExecutor {
  private logger = Logger.getInstance();

  /**
   * 🚀 对话式规划循环执行器：实现思维链、自我修正和智能上下文管理
   */
  public async executeConversationalPlanning(
    userInput: string,
    sessionContext: SessionContext,
    selectedModel: vscode.LanguageModelChat,
    initialPlan: AIPlan, // 🚀 新增：接收来自"分诊台"的初始计划
    generateUnifiedPlan: (
      userInput: string,
      sessionContext: SessionContext,
      selectedModel: vscode.LanguageModelChat,
      historyContext: string,
      toolResultsContext: string
    ) => Promise<AIPlan>,
    formatToolResults: (toolResults: any[]) => string,
    callerType?: CallerType // 🚀 新增：调用者类型用于访问控制
  ): Promise<{ intent: string; result?: any }> {
    // 🔍 调试：检查 executeConversationalPlanning 接收到的 selectedModel
    this.logger.info(`🔍 [DEBUG] executeConversationalPlanning started with selectedModel: ${!!selectedModel}, name: ${selectedModel?.name}, type: ${typeof selectedModel}`);
    
    const conversationHistory: Array<{
      role: 'user' | 'ai' | 'system';
      content: string;
      toolResults?: any[];
      tokens?: number;
    }> = [];
    
    const allExecutionResults: any[] = [];
    let totalToolsExecuted = 0;
    const maxIterations = 8; // 增加到8轮，支持更复杂的任务
    let currentIteration = 0;
    
    // 初始用户输入
    conversationHistory.push({ role: 'user', content: userInput });

    // 🚀 使用初始计划作为第一轮的行动
    let currentPlan = initialPlan;
    
    while (currentIteration < maxIterations) {
      currentIteration++;
      this.logger.info(`🔄 Chain-of-Thought Iteration ${currentIteration}/${maxIterations}`);

      if (!currentPlan.tool_calls || currentPlan.tool_calls.length === 0) {
        this.logger.info('🎯 No more tools to execute in the current plan.');
        break;
      }
      
      // 🚀 关键修复：分离 finalAnswer、taskComplete 和其他工具调用
      const finalAnswerCall = currentPlan.tool_calls.find(tool => tool.name === 'finalAnswer');
      const taskCompleteCall = currentPlan.tool_calls.find(tool => tool.name === 'taskComplete');
      const otherToolCalls = currentPlan.tool_calls.filter(tool => 
        tool.name !== 'finalAnswer' && tool.name !== 'taskComplete'
      );
      
      // 🚀 先执行所有非 finalAnswer 的工具
      if (otherToolCalls.length > 0) {
        this.logger.info(`🔧 Executing ${otherToolCalls.length} tools before final answer in iteration ${currentIteration}`);
        const iterationResults = await this.executeToolCalls(otherToolCalls, callerType, selectedModel);
        
        allExecutionResults.push(...iterationResults);
        totalToolsExecuted += otherToolCalls.length;
        
        // 🚀 新增：检查是否有工具需要聊天交互
        const chatInteractionNeeded = iterationResults.find(result => 
          result.result?.needsChatInteraction === true
        );
        
        if (chatInteractionNeeded) {
          this.logger.info(`💬 Tool needs chat interaction: ${chatInteractionNeeded.result.chatQuestion}`);
          
          return {
            intent: 'chat_interaction_needed',
            result: {
              mode: 'chat_interaction',
              question: chatInteractionNeeded.result.chatQuestion,
              summary: `我正在为您创建SRS文档。现在需要您的确认：\n\n${chatInteractionNeeded.result.chatQuestion}`,
              toolName: chatInteractionNeeded.toolName,
              iterations: currentIteration,
              totalToolsExecuted,
              conversationHistory: conversationHistory.length,
              resumeContext: chatInteractionNeeded.result.resumeContext
            }
          };
        }
        
        // 将执行结果添加到对话历史中
        const resultsContent = formatToolResults(iterationResults);
        conversationHistory.push({
          role: 'system',
          content: resultsContent,
          toolResults: iterationResults
        });
        
        // 检查是否有失败的工具调用需要自我修正
        const failedTools = iterationResults.filter(r => !r.success);
        if (failedTools.length > 0) {
          this.logger.warn(`⚠️ ${failedTools.length} tools failed, will attempt self-correction in next iteration`);
        }
      }
      
      // 🚀 处理 taskComplete（如果存在）
      if (taskCompleteCall) {
        this.logger.info('🎯 Specialist called taskComplete - processing task completion signal');
        
        const taskCompleteResult = await toolExecutor.executeTool(
          'taskComplete',
          taskCompleteCall.args,
          callerType,
          selectedModel
        );
        
        if (taskCompleteResult.success) {
          const completionData: TaskCompletionResult = taskCompleteResult.result;
          return await this.handleTaskCompletion(completionData, taskCompleteCall, userInput, sessionContext, selectedModel, generateUnifiedPlan, formatToolResults, callerType);
        } else {
          this.logger.error('❌ taskComplete execution failed:', taskCompleteResult.error);
          // 继续执行，不中断流程
        }
      }
      
      // 🚀 现在处理 finalAnswer（如果存在）
      if (finalAnswerCall) {
        this.logger.info('🎯 AI called finalAnswer tool - task completion detected');
        
        // 🔍 调试：检查 finalAnswer 调用时的 selectedModel
        this.logger.info(`🔍 [DEBUG] finalAnswer call - selectedModel: ${!!selectedModel}, type: ${typeof selectedModel}`);
        
        const finalResult = await toolExecutor.executeTool(
          'finalAnswer', 
          finalAnswerCall.args, 
          callerType,  // caller 参数
          selectedModel  // model 参数
        );
        
        return {
          intent: 'task_completed',
          result: {
            mode: 'chain_of_thought_agent_completed',
            summary: finalResult.result?.summary || '任务已完成',
            finalResult: finalResult.result?.result || '',
            achievements: finalResult.result?.achievements || [],
            nextSteps: finalResult.result?.nextSteps,
            iterations: currentIteration,
            totalToolsExecuted,
            conversationHistory: conversationHistory.length,
            allResults: allExecutionResults
          }
        };
      }
      
      // 🚀 如果没有 finalAnswer，继续执行其他工具（兼容性保持）
      if (otherToolCalls.length === 0 && !finalAnswerCall) {
        // 这是旧逻辑的兼容性处理
        this.logger.info(`🔧 Executing ${currentPlan.tool_calls.length} tools in iteration ${currentIteration}`);
        const iterationResults = await this.executeToolCalls(currentPlan.tool_calls, callerType, selectedModel);
        
        allExecutionResults.push(...iterationResults);
        totalToolsExecuted += currentPlan.tool_calls.length;
        
        // 🚀 新增：检查是否有工具需要聊天交互
        const chatInteractionNeeded = iterationResults.find(result => 
          result.result?.needsChatInteraction === true
        );
        
        if (chatInteractionNeeded) {
          this.logger.info(`💬 Tool needs chat interaction: ${chatInteractionNeeded.result.chatQuestion}`);
          
          return {
            intent: 'chat_interaction_needed',
            result: {
              mode: 'chat_interaction',
              question: chatInteractionNeeded.result.chatQuestion,
              summary: `我已经创建了功能需求部分。现在需要您的确认：\n\n${chatInteractionNeeded.result.chatQuestion}`,
              toolName: chatInteractionNeeded.toolName,
              iterations: currentIteration,
              totalToolsExecuted,
              conversationHistory: conversationHistory.length,
              resumeContext: chatInteractionNeeded.result.resumeContext
            }
          };
        }
        
        // 将执行结果添加到对话历史中
        const resultsContent = formatToolResults(iterationResults);
        conversationHistory.push({
          role: 'system',
          content: resultsContent,
          toolResults: iterationResults
        });
        
        // 检查是否有失败的工具调用需要自我修正
        const failedTools = iterationResults.filter(r => !r.success);
        if (failedTools.length > 0) {
          this.logger.warn(`⚠️ ${failedTools.length} tools failed, will attempt self-correction in next iteration`);
        }
        
        // 检查是否达到了用户的完整意图（基于成功率和复杂度）
        const successRate = iterationResults.filter(r => r.success).length / iterationResults.length;
        if (successRate === 1.0 && this.isSimpleTask(userInput)) {
          this.logger.info('✅ Simple task completed successfully, ending conversation');
          break;
        }
      }

      // 生成下一轮计划（如果没有终结）
      if (!finalAnswerCall) {
        // 🚀 Code Review修复：构建字符串格式的上下文
        const historyContext = this.buildHistoryContext(conversationHistory);
        const toolResultsContext = formatToolResults(allExecutionResults);
        const nextPlan = await generateUnifiedPlan(userInput, sessionContext, selectedModel, historyContext, toolResultsContext);
        currentPlan = nextPlan;
      }
    }
    
    // 如果达到最大迭代次数，生成最终总结
    const successfulResults = allExecutionResults.filter(r => r.success);
    const failedResults = allExecutionResults.filter(r => !r.success);
    
    const resultSummary = this.summarizeConversationalResults(
      allExecutionResults, 
      currentIteration,
      conversationHistory
    );
    
    return {
      intent: 'conversational_tool_execution',
      result: {
        mode: 'chain_of_thought_agent',
        summary: resultSummary,
        iterations: currentIteration,
        totalToolsExecuted,
        successful: successfulResults.length,
        failed: failedResults.length,
        conversationHistory: conversationHistory.length,
        details: allExecutionResults,
        reachedMaxIterations: currentIteration >= maxIterations
      }
    };
  }

  /**
   * 执行工具调用 - 使用新的工具执行器 + 访问控制
   */
  private async executeToolCalls(
    toolCalls: Array<{ name: string; args: any }>, 
    caller?: CallerType,
    selectedModel?: vscode.LanguageModelChat  // 🚀 新增：model 参数
  ): Promise<any[]> {
    // 🔍 调试：检查参数传递
    this.logger.info(`🔍 [DEBUG] executeToolCalls called with selectedModel: ${!!selectedModel}, type: ${typeof selectedModel}`);
    
    const results = [];

    for (const toolCall of toolCalls) {
      try {
        this.logger.info(`🔧 Executing tool: ${toolCall.name}`);
        
        // 🔍 调试：在每次工具调用前检查 selectedModel
        this.logger.info(`🔍 [DEBUG] About to call ${toolCall.name} with selectedModel: ${!!selectedModel}`);
        
        const result = await toolExecutor.executeTool(
          toolCall.name,
          toolCall.args,
          caller,
          selectedModel  // 🚀 新增：传递 model 参数
        );
        
        results.push({
          success: result.success,
          result: result.result,
          toolName: toolCall.name
        });
        
      } catch (error) {
        this.logger.error(`❌ Tool execution failed: ${toolCall.name}`);
        results.push({
          success: false,
          error: (error as Error).message,
          toolName: toolCall.name
        });
      }
    }

    return results;
  }

  /**
   * 构建对话历史上下文摘要
   */
  public buildHistoryContext(conversationHistory: Array<{ role: string; content: string; toolResults?: any[] }>): string {
    const historyItems: string[] = [];
    
    conversationHistory.forEach((item, index) => {
      if (item.role === 'system' && item.toolResults) {
        const successCount = item.toolResults.filter(r => r.success).length;
        const totalCount = item.toolResults.length;
        const toolNames = item.toolResults.map(r => r.toolName).join(', ');
        
        historyItems.push(`**Step ${Math.floor(index/2) + 1}**: Executed tools [${toolNames}] - ${successCount}/${totalCount} successful`);
        
        // 添加失败工具的详细信息
        const failures = item.toolResults.filter(r => !r.success);
        if (failures.length > 0) {
          failures.forEach(failure => {
            historyItems.push(`  ❌ ${failure.toolName} failed: ${failure.error || 'Unknown error'}`);
          });
        }
      }
    });
    
    return historyItems.join('\n');
  }

  /**
   * 判断是否为简单任务
   */
  private isSimpleTask(userInput: string): boolean {
    const simpleKeywords = ['列出', '显示', '查看', '获取', '状态'];
    return simpleKeywords.some(keyword => userInput.includes(keyword));
  }

  /**
   * 处理任务完成信号
   */
  private async handleTaskCompletion(
    completionData: TaskCompletionResult,
    originalToolCall: any,
    userInput: string,
    sessionContext: SessionContext,
    selectedModel: vscode.LanguageModelChat,
    generateUnifiedPlan: (
      userInput: string,
      sessionContext: SessionContext,
      selectedModel: vscode.LanguageModelChat,
      historyContext: string,
      toolResultsContext: string
    ) => Promise<AIPlan>,
    formatToolResults: (toolResults: any[]) => string,
    callerType?: CallerType
  ): Promise<{ intent: string; result?: any }> {
    
    this.logger.info(`🎯 Processing task completion: ${completionData.nextStepType}`);
    
    // 分析下一步类型并执行相应逻辑
    switch (completionData.nextStepType) {
      case NextStepType.TASK_FINISHED:
        // 真正完成，调用finalAnswer结束对话
        this.logger.info('✅ Task fully completed, calling finalAnswer');
        
        const finalResult = await toolExecutor.executeTool(
          'finalAnswer',
          {
            summary: `任务圆满完成。${completionData.summary}`,
            achievements: completionData.deliverables || [],
            nextSteps: ['项目已完成，可以进行测试或部署'],
            taskType: 'specialist_collaboration'
          },
          callerType,
          selectedModel
        );
        
        return {
          intent: 'task_completed',
          result: {
            mode: 'specialist_collaboration_completed',
            summary: completionData.summary,
            deliverables: completionData.deliverables,
            finalResult: finalResult.result,
            collaborationType: 'single_specialist_completion'
          }
        };
        
      case NextStepType.HANDOFF_TO_SPECIALIST:
        // 转交给其他专家
        if (!completionData.nextStepDetails?.specialistType) {
          throw new Error('HANDOFF_TO_SPECIALIST requires nextStepDetails.specialistType');
        }
        
        this.logger.info(`🔄 Handing off to specialist: ${completionData.nextStepDetails.specialistType}`);
        
        return await this.executeSpecialistHandoff(
          completionData,
          userInput,
          sessionContext,
          selectedModel,
          generateUnifiedPlan,
          formatToolResults,
          callerType
        );
        
      case NextStepType.USER_INTERACTION:
        // 需要用户交互
        this.logger.info('💬 Requesting user interaction');
        
        return {
          intent: 'user_interaction_required',
          result: {
            mode: 'chat_question',
            question: completionData.nextStepDetails?.userQuestion || '需要您的确认来继续任务',
            summary: `${completionData.summary}\n\n${completionData.nextStepDetails?.userQuestion}`,
            response: completionData.summary,
            thought: `专家已完成阶段性工作，需要用户确认：${completionData.nextStepDetails?.userQuestion}`,
            awaitingUserResponse: true,
            resumeContext: {
              completionData,
              originalToolCall,
              userInput,
              sessionContext
            }
          }
        };
        
      case NextStepType.CONTINUE_SAME_SPECIALIST:
        // 同一专家继续工作
        this.logger.info('🔄 Same specialist continuing work');
        
        // 这种情况下我们不结束对话，让循环继续
        return {
          intent: 'specialist_continuing',
          result: {
            mode: 'specialist_continuation',
            summary: completionData.summary,
            continueInstructions: completionData.nextStepDetails?.continueInstructions,
            // 不返回最终结果，让外层循环继续
          }
        };
        
      default:
        throw new Error(`Unknown nextStepType: ${completionData.nextStepType}`);
    }
  }

  /**
   * 执行专家转交
   */
  private async executeSpecialistHandoff(
    completionData: TaskCompletionResult,
    userInput: string,
    sessionContext: SessionContext,
    selectedModel: vscode.LanguageModelChat,
    generateUnifiedPlan: (
      userInput: string,
      sessionContext: SessionContext,
      selectedModel: vscode.LanguageModelChat,
      historyContext: string,
      toolResultsContext: string
    ) => Promise<AIPlan>,
    formatToolResults: (toolResults: any[]) => string,
    callerType?: CallerType
  ): Promise<{ intent: string; result?: any }> {
    
    const nextSpecialistType = completionData.nextStepDetails!.specialistType!;
    const taskDescription = completionData.nextStepDetails!.taskDescription || 
      `继续${userInput}的工作，基于之前专家的成果`;
    
    // 构建包含上下文的新计划
    const handoffPlan: AIPlan = {
      thought: `专家转交：${completionData.summary}。现在将任务转交给${nextSpecialistType}专家继续处理。`,
      response_mode: 'TOOL_EXECUTION' as any,
      direct_response: null,
      tool_calls: [
        {
          name: nextSpecialistType,
          args: {
            userInput: taskDescription,
            inheritedContext: completionData.contextForNext,
            previousSpecialistSummary: completionData.summary,
            previousDeliverables: completionData.deliverables
          }
        }
      ]
    };
    
    // 继续执行新专家（递归调用对话式执行器）
    return await this.executeConversationalPlanning(
      taskDescription,
      sessionContext,
      selectedModel,
      handoffPlan,
      generateUnifiedPlan,
      formatToolResults,
      callerType
    );
  }

  /**
   * 汇总对话式执行结果
   */
  public summarizeConversationalResults(
    results: any[], 
    iterations: number, 
    conversationHistory: any[]
  ): string {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    let summary = `✅ 通过 ${iterations} 轮对话完成任务：`;
    summary += `\n  - 成功执行：${successful.length} 个工具`;
    
    if (failed.length > 0) {
      summary += `\n  - 执行失败：${failed.length} 个工具`;
    }
    
    summary += `\n  - 对话轮次：${iterations}`;
    
    return summary;
  }
} 