import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { toolRegistry } from '../../tools/index';
import { AgentState, InteractionRequest, ExecutionStep, ToolCallResult } from './AgentState';

/**
 * 工具执行处理器 - 负责各种类型工具的执行逻辑
 */
export class ToolExecutionHandler {
  private logger = Logger.getInstance();

  /**
   * 自主工具处理 - 透明执行 🚀 Code Review完整优化版本
   */
  public async handleAutonomousTool(
    toolCall: { name: string; args: any },
    stream: vscode.ChatResponseStream,
    state: AgentState,
    hasRecentToolExecution: (toolName: string, args: any) => ExecutionStep | null,
    recordExecution: (
      type: ExecutionStep['type'], 
      content: string, 
      success?: boolean,
      toolName?: string,
      result?: any,
      args?: any,
      duration?: number,
      errorCode?: string,
      retryCount?: number
    ) => void,
    toolExecutor?: any
  ): Promise<void> {
    // 🚀 架构师新增：重复检测机制
    const recentExecution = hasRecentToolExecution(toolCall.name, toolCall.args);
    if (recentExecution) {
      stream.markdown(`⏭️ **跳过重复调用**: ${toolCall.name} (30秒内已执行)\n`);
      recordExecution(
        'tool_call_skipped', 
        `跳过重复工具调用: ${toolCall.name}`, 
        true, 
        toolCall.name, 
        { reason: 'duplicate_in_time_window' }, 
        toolCall.args
      );
      return;
    }
    
    stream.markdown(`🔧 **执行工具**: ${toolCall.name}\n`);
    
    // 🚀 Code Review新增：记录开始时间
    const startTime = Date.now();
    recordExecution('tool_call', `开始执行工具: ${toolCall.name}`, undefined, toolCall.name, undefined, toolCall.args);
    
    try {
      const result = await this.executeTool(toolCall, toolExecutor);
      const duration = Date.now() - startTime;
      
      // 流式显示执行结果
      stream.markdown(`✅ **${toolCall.name}** 执行成功 (${duration}ms)\n`);
      if (result.output) {
        // 🚀 修复：正确处理对象输出，避免 [object Object] 问题
        let outputText: string;
        if (typeof result.output === 'string') {
          outputText = result.output;
        } else {
          // 对象类型需要序列化
          try {
            outputText = JSON.stringify(result.output, null, 2);
          } catch (serializeError) {
            outputText = `[输出序列化失败: ${(serializeError as Error).message}]`;
          }
        }
        stream.markdown(`\`\`\`json\n${outputText}\n\`\`\`\n\n`);
      }
      
      // 🚀 Code Review优化：记录完整的执行结果包含duration
      recordExecution(
        'tool_call', 
        `${toolCall.name} 执行成功`, 
        true, 
        toolCall.name, 
        result, 
        toolCall.args,
        duration // 🚀 新增：执行耗时
      );
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = (error as Error).message;
      
      // 🚀 Code Review新增：智能错误分类
      let errorCode = 'EXECUTION_FAILED';
      if (errorMsg.includes('not found')) {
        errorCode = 'TOOL_NOT_FOUND';
      } else if (errorMsg.includes('permission') || errorMsg.includes('access')) {
        errorCode = 'PERMISSION_DENIED';
      } else if (errorMsg.includes('timeout')) {
        errorCode = 'TIMEOUT';
      } else if (errorMsg.includes('network')) {
        errorCode = 'NETWORK_ERROR';
      }
      
      stream.markdown(`❌ **${toolCall.name}** 执行失败 (${duration}ms): ${errorMsg}\n\n`);
      
      // 🚀 Code Review优化：记录详细的错误信息包含duration和errorCode
      recordExecution(
        'tool_call', 
        `${toolCall.name} 执行失败: ${errorMsg}`, 
        false, 
        toolCall.name, 
        { error: errorMsg, stack: (error as Error).stack }, 
        toolCall.args,
        duration, // 🚀 执行耗时
        errorCode // 🚀 错误代码
      );
    }
  }

  /**
   * 交互工具处理 - 智能暂停
   */
  public async handleInteractiveTool(
    toolCall: { name: string; args: any },
    stream: vscode.ChatResponseStream,
    state: AgentState,
    recordExecution: (type: ExecutionStep['type'], content: string, success?: boolean) => void
  ): Promise<void> {
    state.stage = 'awaiting_user';
    
    // 创建交互请求
    const interaction: InteractionRequest = {
      type: this.determineInteractionType(toolCall),
      message: this.generateInteractionMessage(toolCall),
      options: toolCall.args.options,
      timeout: 300000, // 5分钟超时
      toolCall: toolCall
    };
    
    state.pendingInteraction = interaction;
    
    // 流式显示交互请求
    stream.markdown(`✋ **需要您的输入**\n\n`);
    stream.markdown(`${interaction.message}\n\n`);
    
    if (interaction.options) {
      interaction.options.forEach((option, index) => {
        stream.markdown(`${index + 1}. ${option}\n`);
      });
    }
    
    recordExecution('user_interaction', `等待用户输入: ${interaction.message}`);
  }

  /**
   * 确认工具处理 - 智能确认
   */
  public async handleConfirmationTool(
    toolCall: { name: string; args: any }, 
    classification: { type: string; riskLevel: 'low' | 'medium' | 'high'; requiresConfirmation: boolean },
    stream: vscode.ChatResponseStream,
    state: AgentState,
    recordExecution: (type: ExecutionStep['type'], content: string, success?: boolean) => void,
    handleAutonomousTool: (toolCall: { name: string; args: any }) => Promise<void>
  ): Promise<void> {
    // 使用新的分类信息（如果提供）或回退到旧的评估方式
    let riskLevel: 'low' | 'medium' | 'high' = classification.riskLevel;
    
    if (riskLevel === 'low') {
      // 低风险操作直接执行
      await handleAutonomousTool(toolCall);
    } else {
      // 高风险操作需要确认
      const riskIcon = riskLevel === 'high' ? '🔴' : '🟡';
      stream.markdown(`${riskIcon} **需要确认** (${riskLevel}风险): 即将执行 ${toolCall.name}\n`);
      stream.markdown(`参数: ${JSON.stringify(toolCall.args, null, 2)}\n\n`);
      stream.markdown(`是否继续？(输入 'yes' 继续，'no' 取消)\n\n`);
      
      state.stage = 'awaiting_user';
      state.pendingInteraction = {
        type: 'confirmation',
        message: `确认执行 ${toolCall.name}？`,
        options: ['yes', 'no'],
        toolCall: toolCall
      };
      
      recordExecution('user_interaction', `等待用户确认执行: ${toolCall.name} (${riskLevel}风险)`);
    }
  }

  /**
   * 处理finalAnswer工具
   */
  public async handleFinalAnswer(
    toolCall: { name: string; args: any },
    stream: vscode.ChatResponseStream,
    recordExecution: (
      type: ExecutionStep['type'], 
      content: string, 
      success?: boolean,
      toolName?: string,
      result?: any,
      args?: any,
      duration?: number,
      errorCode?: string,
      retryCount?: number
    ) => void,
    toolExecutor?: any
  ): Promise<void> {
    stream.markdown(`🎯 **AI给出最终答案**\n\n`);
    
    const startTime = Date.now();
    try {
      const result = await this.executeTool(toolCall, toolExecutor);
      const duration = Date.now() - startTime;
      
      // 🚀 修复：使用正确的字段名 result.output
      if (result.success && result.output) {
        // 解析finalAnswer的结构化输出
        try {
          let finalResult;
          
          // 🚀 修复：检查返回值是否已经是对象
          if (typeof result.output === 'string') {
            finalResult = JSON.parse(result.output);
          } else {
            finalResult = result.output; // 已经是对象了
          }
          
          if (finalResult.summary) {
            stream.markdown(`### ✅ 任务完成\n\n${finalResult.summary}\n\n`);
          }
          
          if (finalResult.result) {
            stream.markdown(`**执行结果**：${finalResult.result}\n\n`);
          }
          
          if (finalResult.achievements && finalResult.achievements.length > 0) {
            stream.markdown('**完成的工作：**\n');
            finalResult.achievements.forEach((achievement: string, index: number) => {
              stream.markdown(`${index + 1}. ${achievement}\n`);
            });
            stream.markdown('\n');
          }
          
          if (finalResult.nextSteps) {
            stream.markdown(`**建议的后续步骤：** ${finalResult.nextSteps}\n\n`);
          }
          
        } catch (parseError) {
          // 🚀 修复：如果解析失败，安全地输出字符串
          const outputText = typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2);
          stream.markdown(`${outputText}\n\n`);
        }
      } else if (result.success) {
        // 如果成功但没有output，显示简单完成消息
        stream.markdown(`✅ 任务已完成\n\n`);
      }
      
      recordExecution('result', 'finalAnswer执行完成', true, toolCall.name, result, toolCall.args, duration);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = (error as Error).message;
      stream.markdown(`❌ **finalAnswer执行失败**: ${errorMsg}\n\n`);
      recordExecution('result', `finalAnswer执行失败: ${errorMsg}`, false, toolCall.name, { error: errorMsg }, toolCall.args, duration, 'EXECUTION_FAILED');
    }
  }

  /**
   * 执行工具 - 调用ToolExecutor 🚀 Code Review优化版本
   */
  private async executeTool(toolCall: { name: string; args: any }, toolExecutor?: any): Promise<ToolCallResult> {
    if (!toolExecutor) {
      throw new Error('ToolExecutor未初始化');
    }
    
    try {
      const result = await toolExecutor.executeTool(toolCall.name, toolCall.args);
      
      return {
        success: result.success || false,
        output: result.result || result.output,
        toolName: toolCall.name,
        args: toolCall.args
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        toolName: toolCall.name,
        args: toolCall.args
      };
    }
  }

  /**
   * 辅助方法
   */
  private determineInteractionType(toolCall: { name: string; args: any }): 'confirmation' | 'choice' | 'input' {
    if (toolCall.args.options && Array.isArray(toolCall.args.options)) {
      return 'choice';
    }
    if (toolCall.name.includes('confirm') || toolCall.name.includes('Confirm')) {
      return 'confirmation';
    }
    return 'input';
  }

  private generateInteractionMessage(toolCall: { name: string; args: any }): string {
    if (toolCall.args.message) {
      return toolCall.args.message;
    }
    return `工具 ${toolCall.name} 需要您的输入。请提供必要的信息。`;
  }
} 