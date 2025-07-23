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
  public buildContextForPrompt(executionHistory: ExecutionStep[]): { historyContext: string, toolResultsContext: string } {
    this.logger.info(`🔍 [DEBUG-CONTEXT] === ContextManager.buildContextForPrompt START ===`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] Input: received ${executionHistory.length} execution steps`);
    
    const historyItems: string[] = [];
    const toolResultItems: string[] = [];

    executionHistory.forEach((step, index) => {
      this.logger.info(`🔍 [DEBUG-CONTEXT] Processing step[${index}]: type=${step.type}, content="${step.content?.substring(0, 50)}..."`);
      
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
            // 🚀 Phase 2新增：语义编辑结果的特殊处理
            const formattedResult = this.formatToolResultForContext(step.toolName || 'unknown', step.result);
            toolResultItems.push(`### Result of \`${step.toolName || 'unknown'}\`:\n${formattedResult}`);
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
      } else if (step.type === 'result' && step.content) {
        // Include content from 'result' steps, which includes new task markers
        // and other general results recorded by the system.
        // 🚀 新增：检测并特殊处理PLAN_EXECUTION结果
        if (this.isPlanExecutionResult(step)) {
          historyItems.push(this.formatPlanExecutionContext(step));
        } else {
          historyItems.push(`- System Note: ${step.content}`);
        }
      }
    });

    const result = {
      historyContext: historyItems.join('\n'),
      toolResultsContext: toolResultItems.join('\n\n')
    };
    
    this.logger.info(`🔍 [DEBUG-CONTEXT] === ContextManager.buildContextForPrompt RESULT ===`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] historyItems.length: ${historyItems.length}`);
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
} 