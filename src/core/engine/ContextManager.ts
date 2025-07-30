import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { AgentState, ExecutionStep } from './AgentState';

/**
 * 上下文和历史记录管理器 - 负责执行历史和上下文的管理
 * 
 * 🚀 Phase 2新增：支持语义编辑结果的特殊处理
 */
export class ContextManager {
  private logger = Logger.getInstance();

  /**
   * 🚀 Code Review新增：构建分离的上下文信息
   * 
   * 将执行历史分离为历史概要和详细工具结果，
   * 配合新的提示词架构优化AI理解
   */
  public buildContextForPrompt(executionHistory: ExecutionStep[], currentTask?: string): { historyContext: string, toolResultsContext: string } {
    this.logger.info(`🔍 [DEBUG-CONTEXT] === ContextManager.buildContextForPrompt START ===`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] Input: received ${executionHistory.length} execution steps, currentTask="${currentTask || 'N/A'}"`);
    
    const toolResultItems: string[] = [];
    
    // 🚀 新架构：使用Turn格式组织对话历史，传入currentTask来处理第一轮用户输入
    const turnBasedHistory = this.buildTurnBasedHistory(executionHistory, currentTask);

    // 仍然需要收集工具结果用于toolResultsContext
    executionHistory.forEach((step, index) => {
      this.logger.info(`🔍 [DEBUG-CONTEXT] Processing step[${index}]: type=${step.type}, content="${step.content?.substring(0, 50)}..."`);
      
      if (step.type === 'tool_call' && step.result) {
        try {
          // 🚀 Phase 2新增：语义编辑结果的特殊处理
          const formattedResult = this.formatToolResultForContext(step.toolName || 'unknown', step.result);
          toolResultItems.push(`### Result of \`${step.toolName || 'unknown'}\`:\n${formattedResult}`);
        } catch (jsonError) {
          // JSON序列化失败时的后备处理
          toolResultItems.push(`### Result of \`${step.toolName}\`:\n[Result could not be serialized]`);
        }
      }
    });

    const result = {
      historyContext: turnBasedHistory,
      toolResultsContext: toolResultItems.join('\n\n')
    };
    
    this.logger.info(`🔍 [DEBUG-CONTEXT] === ContextManager.buildContextForPrompt RESULT ===`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] turnBasedHistory.length: ${turnBasedHistory.length}`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] toolResultItems.length: ${toolResultItems.length}`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] historyContext.length: ${result.historyContext.length}`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] toolResultsContext.length: ${result.toolResultsContext.length}`);
    
    if (result.historyContext.length === 0) {
      this.logger.warn(`🔍 [DEBUG-CONTEXT] ⚠️ historyContext is EMPTY! Will trigger "No actions have been taken yet"`);
    }
    if (result.toolResultsContext.length === 0) {
      this.logger.warn(`🔍 [DEBUG-CONTEXT] ⚠️ toolResultsContext is EMPTY! Will trigger "No tool results available"`);
    }
    
    this.logger.info(`🔍 [DEBUG-CONTEXT] === ContextManager.buildContextForPrompt END ===`);
    return result;
  }

  /**
   * 记录执行历史 🚀 Code Review完整优化版本
   */
  public recordExecution(
    executionHistory: ExecutionStep[],
    iterationCount: number,
    type: ExecutionStep['type'], 
    content: string, 
    success?: boolean,
    toolName?: string,
    result?: any,
    args?: any,
    // 🚀 Code Review新增：增强监控字段
    duration?: number,
    errorCode?: string,
    retryCount?: number
  ): void {
    executionHistory.push({
      type,
      content,
      timestamp: Date.now(),
      success,
      toolName,
      result,
      args,
      iteration: iterationCount + 1,
      // 🚀 Code Review新增字段
      duration,
      errorCode,
      retryCount
    });
    
    // 调试日志（可选）
    if (duration && duration > 5000) {
      this.logger.warn(`慢操作检测: ${toolName} 耗时 ${duration}ms`);
    }
  }

  /**
   * 构建对话历史上下文
   */
  public buildConversationHistory(executionHistory: ExecutionStep[]): Array<{ role: string; content: string; toolResults?: any[] }> {
    const history: Array<{ role: string; content: string; toolResults?: any[] }> = [];
    
    // 将执行历史转换为对话历史格式
    executionHistory.forEach(step => {
      if (step.type === 'thought') {
        history.push({
          role: 'ai',
          content: step.content
        });
      } else if (step.type === 'tool_call') {
        history.push({
          role: 'system',
          content: `Tool executed: ${step.toolName}`,
          toolResults: [{
            toolName: step.toolName,
            success: step.success,
            content: step.content
          }]
        });
      }
    });
    
    return history;
  }

  /**
   * 显示执行总结
   */
  public displayExecutionSummary(state: AgentState, stream: vscode.ChatResponseStream): void {
    const stage = state.stage as string;
    
    switch (stage) {
      case 'completed':
        stream.markdown('\n✅ **任务执行完成**\n\n');
        this.generateExecutionSummary(state, stream);
        break;
      case 'error':
        stream.markdown('\n❌ **任务执行中断**\n\n');
        break;
      case 'awaiting_user':
        stream.markdown('\n⏸️ **等待用户输入**\n\n');
        break;
      default:
        break;
    }
  }

  /**
   * 生成详细的执行总结 🚀 Code Review优化版本
   */
  private generateExecutionSummary(state: AgentState, stream: vscode.ChatResponseStream): void {
    const successful = state.executionHistory.filter(s => s.success === true).length;
    const failed = state.executionHistory.filter(s => s.success === false).length;
    const toolCalls = state.executionHistory.filter(s => s.type === 'tool_call').length;
    const skipped = state.executionHistory.filter(s => s.type === 'tool_call_skipped').length;
    
    // 🚀 Code Review新增：计算总耗时
    const totalDuration = state.executionHistory
      .filter(s => s.duration)
      .reduce((sum, s) => sum + (s.duration || 0), 0);
    
    stream.markdown('---\n');
    stream.markdown('### 🎯 执行总结\n\n');
    stream.markdown(`**迭代轮次**: ${state.iterationCount}\n`);
    stream.markdown(`**工具调用**: ${toolCalls} (跳过: ${skipped})\n`);
    stream.markdown(`**成功/失败**: ${successful} / ${failed}\n`);
    if (totalDuration > 0) {
      stream.markdown(`**总耗时**: ${totalDuration}ms\n`);
    }
    stream.markdown(`**执行模式**: 智能状态机 + 分层工具执行\n\n`);
  }

  // ============================================================================
  // 🚀 Phase 2新增：语义编辑结果格式化支持
  // ============================================================================

  /**
   * 格式化工具结果用于上下文构建
   * 
   * 为不同类型的工具提供特定的格式化，特别是语义编辑工具
   */
  private formatToolResultForContext(toolName: string, result: any): string {
    // 语义编辑结果的特殊处理
    if (toolName === 'executeMarkdownEdits' || toolName === 'executeYAMLEdits') {
      return this.formatSemanticEditResultForContext(result);
    }
    
    // 增强版读取文件结果的特殊处理
    if (toolName === 'readFileWithStructure') {
      return this.formatStructuredReadResultForContext(result);
    }
    
    // 默认处理方式
    const resultData = result.output || result.error || result;
    const resultString = typeof resultData === 'string' 
      ? resultData 
      : JSON.stringify(resultData, null, 2);
    
    return `\`\`\`json\n${resultString}\n\`\`\``;
  }

  /**
   * 格式化语义编辑结果用于上下文
   */
  private formatSemanticEditResultForContext(result: any): string {
    if (!result.appliedIntents && !result.failedIntents) {
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    }

    const appliedCount = result.appliedIntents?.length || 0;
    const failedCount = result.failedIntents?.length || 0;
    const successRate = appliedCount + failedCount > 0 ? 
      ((appliedCount / (appliedCount + failedCount)) * 100).toFixed(1) : '0';

    let summary = `**语义编辑执行结果**\n`;
    summary += `- 成功应用: ${appliedCount}个编辑操作\n`;
    summary += `- 执行失败: ${failedCount}个编辑操作\n`;
    summary += `- 成功率: ${successRate}%\n`;
    
    if (result.metadata?.executionTime) {
      summary += `- 执行时间: ${result.metadata.executionTime}ms\n`;
    }

    // 如果有失败的操作，列出失败原因
    if (result.failedIntents?.length > 0) {
      summary += `\n**失败的编辑操作**:\n`;
      result.failedIntents.forEach((intent: any, index: number) => {
        summary += `${index + 1}. ${intent.type} → "${intent.target.sectionName}"\n`;
      });
    }

    // 如果有语义错误，也要列出
    if (result.semanticErrors?.length > 0) {
      summary += `\n**语义分析问题**: ${result.semanticErrors.join(', ')}\n`;
    }

    return summary;
  }

  /**
   * 格式化结构化读取结果用于上下文
   */
  private formatStructuredReadResultForContext(result: any): string {
    if (!result.structure && !result.semanticMap) {
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    }

    let summary = `**文档结构分析结果**\n`;
    summary += `- 文件内容: ${result.content?.length || 0}字符\n`;
    
    if (result.structure) {
      summary += `- 标题数量: ${result.structure.headings?.length || 0}个\n`;
      summary += `- 章节数量: ${result.structure.sections?.length || 0}个\n`;
      
      // 列出主要标题结构
      if (result.structure.headings?.length > 0) {
        summary += `\n**文档结构**:\n`;
        result.structure.headings.slice(0, 5).forEach((heading: any, index: number) => {
          const indent = '  '.repeat(Math.max(0, heading.level - 1));
          summary += `${indent}- ${heading.text} (H${heading.level})\n`;
        });
        
        if (result.structure.headings.length > 5) {
          summary += `  ... 还有 ${result.structure.headings.length - 5} 个标题\n`;
        }
      }
    }

    if (result.semanticMap?.editTargets?.length > 0) {
      summary += `\n**可编辑的语义目标**: ${result.semanticMap.editTargets.length}个\n`;
    }

    return summary;
  }

  /**
   * 🚀 新增：检测是否为计划执行相关的结果
   */
  private isPlanExecutionResult(step: ExecutionStep): boolean {
    return step.toolName === 'planExecutor' && 
           step.result && 
           typeof step.result === 'object' &&
           'originalExecutionPlan' in step.result;
  }

  /**
   * 🚀 新增：格式化计划执行上下文信息
   */
  private formatPlanExecutionContext(step: ExecutionStep): string {
    const ctx = step.result;
    if (!ctx || !ctx.originalExecutionPlan) {
      return `- System Note: ${step.content}`;
    }
    
    const status = step.success ? 'Completed' : 'Failed';
    const progress = `${ctx.completedSteps}/${ctx.totalSteps}`;
    const planDesc = ctx.originalExecutionPlan.description || 'Unknown Plan';
    
    if (step.success) {
      // 成功完成的计划
      return `- Plan Execution: "${planDesc}" | Status: ${status} | Progress: ${progress} steps completed`;
    } else {
      // 失败的计划
      const failedStepInfo = ctx.failedStep ? 
        ` at step ${ctx.failedStep} (${ctx.failedSpecialist || 'unknown'})` : '';
      const errorInfo = ctx.error ? ` | Error: ${ctx.error}` : '';
      
      return `- Plan Execution: "${planDesc}" | Status: ${status}${failedStepInfo} | Progress: ${progress} steps${errorInfo}`;
    }
  }

  /**
   * 🚀 新方法：构建基于Turn的对话历史格式
   * 按照用户建议的格式组织：User input -> Your Thought -> Your Response -> Your Action Taken
   * 
   * 🔧 修复：处理孤立的AI思考和回复，支持不同执行时序
   */
  private buildTurnBasedHistory(executionHistory: ExecutionStep[], currentTask?: string): string {
    if (!executionHistory || executionHistory.length === 0) {
      return 'No previous interactions.';
    }

    const turns: Array<{
      userInput?: string;
      thought?: string;
      response?: string;
      actions: Array<{ toolName: string; success: boolean; duration?: number }>;
    }> = [];

    let currentTurn: any = null;
    
    // 🚀 新增：临时存储孤立的思考和回复
    let pendingThought: string | null = null;
    let pendingResponse: string | null = null;
    let pendingActions: Array<{ toolName: string; success: boolean; duration?: number }> = [];

    // 🚀 修复：应用累积的数据到Turn
    const applyPendingDataToTurn = (turn: any) => {
      if (pendingThought) {
        turn.thought = pendingThought;
        pendingThought = null;
      }
      if (pendingResponse) {
        turn.response = pendingResponse;
        pendingResponse = null;
      }
      if (pendingActions.length > 0) {
        turn.actions.push(...pendingActions);
        pendingActions = [];
      }
    };

    executionHistory.forEach((step, index) => {
      this.logger.info(`🔍 [DEBUG-TURN] Processing step[${index}]: type=${step.type}, content="${step.content?.substring(0, 30)}..."`);

      switch (step.type) {
        case 'thought':
          // 🚀 修复：无论是否有currentTurn都要保存思考
          const thoughtContent = step.content.length > 300 ? step.content.substring(0, 300) + '...' : step.content;
          if (currentTurn) {
            currentTurn.thought = thoughtContent;
          } else {
            pendingThought = thoughtContent;
            this.logger.info(`🔍 [DEBUG-TURN] Saved pending thought: "${thoughtContent.substring(0, 50)}..."`);
          }
          break;

        case 'tool_call':
          // 🚀 修复：无论是否有currentTurn都要保存工具调用
          const action = {
            toolName: step.toolName || 'unknown',
            success: step.success === true,
            duration: step.duration
          };
          if (currentTurn) {
            currentTurn.actions.push(action);
          } else {
            pendingActions.push(action);
            this.logger.info(`🔍 [DEBUG-TURN] Saved pending action: ${action.toolName}`);
          }
          break;

        case 'result':
          // 🚀 正确识别：检查是否是用户输入（包含"新任务开始"标记）
          if (step.content && step.content.includes('--- 新任务开始:')) {
            // 提取真正的用户输入，去掉标记
            const userInput = step.content
              .replace(/^--- 新任务开始:\s*/, '')  // 去掉前缀
              .replace(/\s*---$/, '')             // 去掉后缀
              .trim();                            // 去掉多余空格
            
            // 开始新的Turn
            currentTurn = {
              userInput: userInput,
              actions: []
            };
            turns.push(currentTurn);
            
            // 🚀 修复：应用之前累积的数据
            applyPendingDataToTurn(currentTurn);
            
            this.logger.info(`🔍 [DEBUG-TURN] Found user input: "${userInput}"`);
          }
          // 🚀 正确识别：AI的直接回复（不包含"新任务开始"标记）
          else if (step.content && !step.content.includes('--- 新任务开始:')) {
            const responseContent = step.content.length > 200 ? step.content.substring(0, 200) + '...' : step.content;
            // 🚀 修复：无论是否有currentTurn都要保存回复
            if (currentTurn) {
              currentTurn.response = responseContent;
              this.logger.info(`🔍 [DEBUG-TURN] Found AI response: "${step.content.substring(0, 50)}..."`);
            } else {
              pendingResponse = responseContent;
              this.logger.info(`🔍 [DEBUG-TURN] Saved pending response: "${step.content.substring(0, 50)}..."`);
            }
          }
          break;

        case 'user_interaction':
          // 传统的用户交互格式（如果有的话）
          currentTurn = {
            userInput: step.content,
            actions: []
          };
          turns.push(currentTurn);
          applyPendingDataToTurn(currentTurn);
          break;

        case 'forced_response':
        case 'system':
          // 系统消息可以添加到当前Turn的响应中
          const systemMessage = `[System: ${step.content}]`;
          if (currentTurn) {
            if (currentTurn.response) {
              currentTurn.response += '\n' + systemMessage;
            } else {
              currentTurn.response = systemMessage;
            }
          } else {
            // 如果没有currentTurn，添加到pending response
            if (pendingResponse) {
              pendingResponse += '\n' + systemMessage;
            } else {
              pendingResponse = systemMessage;
            }
          }
          break;

        // 忽略其他类型如 'tool_call_skipped'
      }
    });

    // 🚀 新增：如果有孤立的数据但没有Turn，创建一个基于currentTask的Turn
    if ((pendingThought || pendingResponse || pendingActions.length > 0) && turns.length === 0 && currentTask) {
      const firstTurn = {
        userInput: currentTask,
        actions: []
      };
      turns.push(firstTurn);
      applyPendingDataToTurn(firstTurn);
      this.logger.info(`🔍 [DEBUG-TURN] Created first turn with currentTask: "${currentTask}"`);
    }

    // 🚀 修复：排除最新的未完成Turn（当前正在处理的轮次）
    // 检查最后一个Turn是否完整：需要有用户输入且至少有思考或回复
    const completedTurns = turns.filter((turn, index) => {
      const isLastTurn = index === turns.length - 1;
      if (!isLastTurn) {
        return true; // 非最后一个Turn，保留
      }
      
      // 最后一个Turn，检查是否完整
      const hasUserInput = turn.userInput && turn.userInput !== 'N/A';
      const hasThoughtOrResponse = (turn.thought && turn.thought !== 'N/A') || 
                                  (turn.response && turn.response !== 'N/A');
      
      const isComplete = hasUserInput && hasThoughtOrResponse;
      
      this.logger.info(`🔍 [DEBUG-TURN] Last turn completeness check: hasUserInput=${hasUserInput}, hasThoughtOrResponse=${hasThoughtOrResponse}, isComplete=${isComplete}`);
      
      return isComplete;
    });
    
    if (completedTurns.length === 0) {
      return 'No structured interactions found.';
    }

    const formattedTurns = completedTurns.map((turn, index) => {
      const turnNumber = index + 1;
      let turnText = `### Turn ${turnNumber}:`;

      // User input
      turnText += `\n- User input: ${turn.userInput || 'N/A'}`;

      // Your Thought
      turnText += `\n- Your Thought: ${turn.thought || 'N/A'}`;

      // Your Response
      turnText += `\n- Your Response: ${turn.response || 'N/A'}`;

      // Your Action Taken
      if (turn.actions.length > 0) {
        const actionDescriptions = turn.actions.map(action => {
          const status = action.success ? '✅ Succeeded' : '❌ Failed';
          const duration = action.duration ? ` (${action.duration}ms)` : '';
          return `${action.toolName} - ${status}${duration}`;
        });
        turnText += `\n- Your Action Taken: ${actionDescriptions.join(', ')}`;
      } else {
        turnText += `\n- Your Action Taken: N/A`;
      }

      return turnText;
    });

    return formattedTurns.join('\n\n');
  }

  /**
   * 辅助方法：判断内容是否像是direct response
   */
  private looksLikeDirectResponse(content: string): boolean {
    if (!content) return false;
    
    // 简单的启发式规则：如果内容看起来像是对用户的直接回复
    const directResponseIndicators = [
      '我已经', '已完成', '根据您的', '您的请求', '我理解', '我将', '我正在',
      'I have', 'I will', 'I am', 'Based on your', 'Your request', 'I understand'
    ];
    
    return directResponseIndicators.some(indicator => 
      content.toLowerCase().includes(indicator.toLowerCase())
    );
  }
} 