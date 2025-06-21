import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { AgentState, ExecutionStep } from './AgentState';

/**
 * 上下文和历史记录管理器 - 负责执行历史和上下文的管理
 */
export class ContextManager {
  private logger = Logger.getInstance();

  /**
   * 🚀 Code Review新增：构建分离的上下文信息
   * 
   * 将执行历史分离为历史概要和详细工具结果，
   * 配合新的提示词架构优化AI理解
   */
  public buildContextForPrompt(executionHistory: ExecutionStep[]): { historyContext: string, toolResultsContext: string } {
    const historyItems: string[] = [];
    const toolResultItems: string[] = [];

    executionHistory.forEach(step => {
      if (step.type === 'thought') {
        // 截断过长的思考过程
        const truncatedThought = step.content.length > 200 
          ? step.content.substring(0, 200) + '...' 
          : step.content;
        historyItems.push(`- AI Thought: ${truncatedThought}`);
      } else if (step.type === 'tool_call') {
        const status = step.success ? '✅ Succeeded' : '❌ Failed';
        const duration = step.duration ? ` (${step.duration}ms)` : '';
        historyItems.push(`- Tool Call: ${step.toolName} - ${status}${duration}`);
        
        // 🚀 关键：将结构化的工具结果放入专门的上下文
        if (step.result) {
          try {
            const resultData = step.result.output || step.result.error || step.result;
            const resultString = typeof resultData === 'string' 
              ? resultData 
              : JSON.stringify(resultData, null, 2);
            
            toolResultItems.push(`### Result of \`${step.toolName}\`:\n\`\`\`json\n${resultString}\n\`\`\``);
          } catch (jsonError) {
            // JSON序列化失败时的后备处理
            toolResultItems.push(`### Result of \`${step.toolName}\`:\n[Result could not be serialized]`);
          }
        }
      } else if (step.type === 'user_interaction') {
        historyItems.push(`- User: ${step.content}`);
      } else if (step.type === 'tool_call_skipped') {
        historyItems.push(`- Skipped: ${step.toolName} (duplicate)`);
      } else if (step.type === 'forced_response') {
        historyItems.push(`- System: ${step.content}`);
      }
    });

    return {
      historyContext: historyItems.join('\n'),
      toolResultsContext: toolResultItems.join('\n\n')
    };
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
} 