/**
 * 任务完成工具 - 专家级任务完成信号
 * 
 * 用于专家向上级汇报任务完成状态，支持多专家协作和任务转交
 */

import { CallerType } from '../../types/index';
import { TaskCompletionResult, NextStepType } from '../../types/taskCompletion';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

/**
 * taskComplete工具定义
 */
export const taskCompleteToolDefinition = {
    name: 'taskComplete',
    description: `专家级任务完成信号工具 - 向上级汇报任务已完成并提供下一步建议
    
专家使用此工具来：
- 明确表示自己的任务已完成
- 建议下一步行动（继续、转交、结束）
- 传递必要的上下文给后续步骤

重要：只有specialist可以调用此工具，orchestrator使用finalAnswer来真正结束对话`,
    
    parameters: {
        type: 'object',
        properties: {
            nextStepType: {
                type: 'string', 
                enum: ['CONTINUE_SAME_SPECIALIST', 'HANDOFF_TO_SPECIALIST', 'TASK_FINISHED'],
                description: '下一步行动 - CONTINUE_SAME_SPECIALIST(继续), HANDOFF_TO_SPECIALIST(转交专家), TASK_FINISHED(任务结束)'
            },
            summary: {
                type: 'string',
                description: '任务完成总结，描述已完成的工作'
            },
            contextForNext: {
                type: 'object',
                properties: {
                    deliverables: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '已完成的交付成果'
                    }
                },
                description: '传递给下一步的上下文信息'
            }
        },
        required: ['nextStepType', 'summary']
    },
    
    // 🚀 访问控制：只有specialist可以访问
    accessibleBy: [CallerType.SPECIALIST_CONTENT, CallerType.SPECIALIST_PROCESS]
};

/**
 * taskComplete工具实现
 */
export const taskComplete = async (params: {
    nextStepType: NextStepType;
    summary: string;
    contextForNext?: any;
}): Promise<TaskCompletionResult> => {
    
    // 验证参数
    if (!params.summary || params.summary.trim().length === 0) {
        throw new Error('taskComplete: summary is required and cannot be empty');
    }
    
    // 构建任务完成结果
    const result: TaskCompletionResult = {
        nextStepType: params.nextStepType,
        summary: params.summary,
        contextForNext: params.contextForNext
    };
    
    // 记录任务完成日志
    logger.info(`🎯 [taskComplete] Specialist task completed:`);
    logger.info(`   - Next Step: ${params.nextStepType}`);
    logger.info(`   - Summary: ${params.summary}`);
    
    return result;
};

/**
 * 工具分类信息
 */
export const taskCompleteToolsCategory = {
    name: 'Task Completion Tools',
    description: '任务完成信号工具 - 支持专家级任务完成汇报和多专家协作',
    tools: ['taskComplete'],
    layer: 'internal'
};

/**
 * 导出定义和实现
 */
export const taskCompleteToolDefinitions = [taskCompleteToolDefinition];
export const taskCompleteToolImplementations = { taskComplete }; 