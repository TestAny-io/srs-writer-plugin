import { Logger } from '../../utils/logger';

/**
 * 结果输出工具 - 系统控制和任务流程管理
 * 
 * 包含功能：
 * - 任务完成信号
 * - 最终结果输出
 */

const logger = Logger.getInstance();

// ============================================================================
// 任务完成信号工具
// ============================================================================

/**
 * 🚀 任务完成信号工具 - AI明确表示任务完成
 * 核心价值：解决对话式循环的终止信号问题
 * 架构意义：让AI从"可能完成了"到"我明确宣布完成了"
 */
export const finalAnswerToolDefinition = {
    name: "finalAnswer",
    description: "Call this tool when you have completely finished the user's task and want to provide a final summary",
    parameters: {
        type: "object",
        properties: {
            summary: {
                type: "string",
                description: "A comprehensive summary of what was accomplished"
            },
            result: {
                type: "string",
                description: "The final result or outcome of the task"
            },
            achievements: {
                type: "array",
                items: { type: "string" },
                description: "List of specific achievements or actions completed"
            },
            nextSteps: {
                type: "string",
                description: "Optional suggestions for what the user might want to do next"
            }
        },
        required: ["summary", "result"]
    },
    // 🚀 智能分类属性
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false
};

export async function finalAnswer(args: {
    summary: string;
    result: string;
    achievements?: string[];
    nextSteps?: string;
}): Promise<{ 
    completed: true; 
    summary: string; 
    result: string; 
    achievements: string[];
    nextSteps?: string;
}> {
    logger.info(`🎯 Task completion signaled: ${args.summary}`);
    
    return {
        completed: true,
        summary: args.summary,
        result: args.result,
        achievements: args.achievements || [],
        nextSteps: args.nextSteps
    };
}

// ============================================================================
// 导出定义和实现
// ============================================================================

export const outputToolDefinitions = [
    finalAnswerToolDefinition
];

export const outputToolImplementations = {
    finalAnswer
}; 