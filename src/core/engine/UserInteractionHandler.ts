import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { InteractionRequest, ExecutionStep } from './AgentState';

/**
 * 用户交互处理系统 - 智能交互逻辑
 */
export class UserInteractionHandler {
  private logger = Logger.getInstance();

  /**
   * 处理确认响应
   */
  public async handleConfirmationResponse(
    response: string, 
    interaction: InteractionRequest,
    stream: vscode.ChatResponseStream,
    recordExecution: (type: ExecutionStep['type'], content: string, success?: boolean) => void,
    handleAutonomousTool: (toolCall: { name: string; args: any }) => Promise<void>
  ): Promise<{ shouldReturnToWaiting: boolean }> {
    const normalizedResponse = response.toLowerCase().trim();
    const isPositive = ['yes', 'y', '是', '确认', '同意', '继续', 'ok', 'okay'].includes(normalizedResponse);
    const isNegative = ['no', 'n', '否', '取消', '不', '拒绝', 'cancel'].includes(normalizedResponse);
    
    if (isPositive) {
        stream.markdown(`✅ **确认执行**\n\n`);
        
        if (interaction.toolCall) {
            // 执行之前被推迟的工具调用
            await handleAutonomousTool(interaction.toolCall);
        }
        return { shouldReturnToWaiting: false };
    } else if (isNegative) {
        stream.markdown(`❌ **操作已取消**\n\n`);
        recordExecution('user_interaction', '用户取消了操作', false);
        return { shouldReturnToWaiting: false };
    } else {
        // 响应不明确，再次询问
        stream.markdown(`❓ **请明确回复**: 请回复 "yes" 或 "no"\n\n`);
        return { shouldReturnToWaiting: true }; // 保持等待状态
    }
  }

  /**
   * 处理选择响应
   */
  public async handleChoiceResponse(
    response: string, 
    interaction: InteractionRequest,
    stream: vscode.ChatResponseStream,
    recordExecution: (type: ExecutionStep['type'], content: string, success?: boolean) => void,
    handleAutonomousTool: (toolCall: { name: string; args: any }) => Promise<void>
  ): Promise<{ shouldReturnToWaiting: boolean }> {
    if (!interaction.options || interaction.options.length === 0) {
        stream.markdown(`⚠️ 没有可用的选项\n\n`);
        return { shouldReturnToWaiting: false };
    }
    
    // 尝试解析用户选择
    let selectedIndex = -1;
    const normalizedResponse = response.trim();
    
    // 尝试解析数字选择
    const numberMatch = normalizedResponse.match(/^(\d+)$/);
    if (numberMatch) {
        selectedIndex = parseInt(numberMatch[1]) - 1; // 转为0-based
    } else {
        // 尝试文本匹配
        selectedIndex = interaction.options.findIndex(option => 
            option.toLowerCase().includes(normalizedResponse.toLowerCase()) ||
            normalizedResponse.toLowerCase().includes(option.toLowerCase())
        );
    }
    
    if (selectedIndex >= 0 && selectedIndex < interaction.options.length) {
        const selectedOption = interaction.options[selectedIndex];
        stream.markdown(`✅ **您选择了**: ${selectedOption}\n\n`);
        
        // 记录选择并继续处理
        recordExecution('user_interaction', `选择: ${selectedOption}`, true);
        
        if (interaction.toolCall) {
            // 🚀 新增：处理计划恢复选择
            if (interaction.toolCall.name === 'internal_plan_recovery') {
                if (selectedOption === '继续执行写作计划') {
                    stream.markdown(`✅ **开始恢复计划执行**\n\n`);
                    
                    // 触发计划恢复
                    await handleAutonomousTool({
                        name: 'internal_resume_plan',
                        args: { 
                            action: 'resume'
                        }
                    });
                    
                } else if (selectedOption === '结束写作计划') {
                    stream.markdown(`❌ **计划执行已终止**\n\n`);
                    
                    await handleAutonomousTool({
                        name: 'internal_resume_plan',
                        args: { 
                            action: 'terminate'
                        }
                    });
                }
                
            } else {
                // 原有的工具调用处理逻辑
                const updatedArgs = {
                    ...interaction.toolCall.args,
                    userChoice: selectedOption,
                    userChoiceIndex: selectedIndex
                };
                
                await handleAutonomousTool({
                    name: interaction.toolCall.name,
                    args: updatedArgs
                });
            }
        }
        return { shouldReturnToWaiting: false };
    } else {
        stream.markdown(`❓ **选择无效**: 请输入 1-${interaction.options.length} 之间的数字，或选项的关键词\n\n`);
        
        // 重新显示选项
        stream.markdown(`**可用选项**:\n`);
        interaction.options.forEach((option, index) => {
            stream.markdown(`${index + 1}. ${option}\n`);
        });
        stream.markdown(`\n`);
        
        return { shouldReturnToWaiting: true }; // 保持等待状态
    }
  }

  /**
   * 处理输入响应
   */
  public async handleInputResponse(
    response: string, 
    interaction: InteractionRequest,
    stream: vscode.ChatResponseStream,
    recordExecution: (type: ExecutionStep['type'], content: string, success?: boolean) => void,
    handleAutonomousTool: (toolCall: { name: string; args: any }) => Promise<void>
  ): Promise<{ shouldReturnToWaiting: boolean }> {
    if (!response || response.trim().length === 0) {
        stream.markdown(`⚠️ **输入为空**: 请提供有效的输入\n\n`);
        return { shouldReturnToWaiting: true }; // 保持等待状态
    }
    
    stream.markdown(`✅ **输入已接收**: ${response}\n\n`);
    recordExecution('user_interaction', `用户输入: ${response}`, true);
    
    if (interaction.toolCall) {
        // 将用户输入添加到工具参数中
        const updatedArgs = {
            ...interaction.toolCall.args,
            userInput: response.trim()
        };
        
        await handleAutonomousTool({
            name: interaction.toolCall.name,
            args: updatedArgs
        });
    }
    return { shouldReturnToWaiting: false };
  }
} 