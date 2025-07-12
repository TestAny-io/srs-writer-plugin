/**
 * 任务完成工具 - 专家级任务完成信号
 * 
 * 用于专家向上级汇报任务完成状态，支持多专家协作和任务转交
 */

import { CallerType } from '../../types/index';
import { TaskCompletionResult, TaskCompletionType, NextStepType, Deliverables } from '../../types/taskCompletion';
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
- 建议下一步行动（继续、转交、用户确认、结束）
- 传递必要的上下文给后续步骤

重要：只有specialist可以调用此工具，orchestrator使用finalAnswer来真正结束对话`,
    
    parameters: {
        type: 'object',
        properties: {
            completionType: {
                type: 'string',
                enum: ['PARTIAL', 'REQUIRES_REVIEW', 'READY_FOR_NEXT', 'FULLY_COMPLETED'],
                description: '任务完成类型 - PARTIAL(部分完成), REQUIRES_REVIEW(需要确认), READY_FOR_NEXT(准备下一阶段), FULLY_COMPLETED(完全完成)'
            },
            nextStepType: {
                type: 'string', 
                enum: ['CONTINUE_SAME_SPECIALIST', 'HANDOFF_TO_SPECIALIST', 'USER_INTERACTION', 'TASK_FINISHED'],
                description: '下一步行动 - CONTINUE_SAME_SPECIALIST(继续), HANDOFF_TO_SPECIALIST(转交专家), USER_INTERACTION(用户交互), TASK_FINISHED(任务结束)'
            },
            summary: {
                type: 'string',
                description: '任务完成总结，描述已完成的工作'
            },
            deliverables: {
                oneOf: [
                    {
                        type: 'array',
                        items: { type: 'string' },
                        description: '交付成果列表（字符串数组格式）'
                    },
                    {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                path: { type: 'string', description: '文件路径' },
                                content: { type: 'string', description: '文件内容' },
                                type: { type: 'string', description: '文件类型（可选）' },
                                description: { type: 'string', description: '文件说明（可选）' }
                            },
                            required: ['path', 'content'],
                            description: '交付成果数据对象'
                        },
                        description: '交付成果列表（对象数组格式，支持文件内容传递）'
                    },
                    {
                        type: 'object',
                        additionalProperties: {
                            type: 'object',
                            properties: {
                                path: { type: 'string', description: '文件路径' },
                                content: { type: 'string', description: '文件内容' },
                                type: { type: 'string', description: '文件类型（可选）' },
                                description: { type: 'string', description: '文件说明（可选）' }
                            },
                            required: ['path', 'content'],
                            description: '交付成果数据对象'
                        },
                        description: '交付成果列表（对象字典格式，支持文件内容传递）'
                    }
                ],
                description: '具体的交付成果列表。支持三种格式：1) 字符串数组（兼容旧格式）；2) 对象数组（直观易用）；3) 对象字典（键值对格式）'
            },
            nextStepDetails: {
                type: 'object',
                properties: {
                    specialistType: {
                        type: 'string',
                        description: '下一个专家类型，如 "300_prototype", "400_lint_check"'
                    },
                    taskDescription: {
                        type: 'string', 
                        description: '分配给下一个专家的任务描述'
                    },
                    userQuestion: {
                        type: 'string',
                        description: '需要询问用户的问题'
                    },
                    continueInstructions: {
                        type: 'string',
                        description: '继续当前专家工作的指导说明'
                    }
                },
                description: '下一步的详细信息'
            },
            contextForNext: {
                type: 'object',
                properties: {
                    projectState: {
                        type: 'object',
                        description: '项目当前状态信息'
                    },
                    deliverables: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '已完成的交付成果'
                    },
                    decisions: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                decision: { type: 'string' },
                                reason: { type: 'string' },
                                timestamp: { type: 'string' }
                            }
                        },
                        description: '关键决策记录'
                    },
                    userPreferences: {
                        type: 'object',
                        description: '用户偏好设置'
                    }
                },
                description: '传递给下一步的上下文信息'
            }
        },
        required: ['completionType', 'nextStepType', 'summary', 'deliverables']
    },
    
    // 🚀 访问控制：只有specialist可以访问
    accessibleBy: [CallerType.SPECIALIST]
};

/**
 * taskComplete工具实现
 */
export const taskComplete = async (params: {
    completionType: TaskCompletionType;
    nextStepType: NextStepType;
    summary: string;
    deliverables: Deliverables;
    nextStepDetails?: any;
    contextForNext?: any;
}): Promise<TaskCompletionResult> => {
    
    // 验证参数
    if (!params.summary || params.summary.trim().length === 0) {
        throw new Error('taskComplete: summary is required and cannot be empty');
    }
    
    if (!params.deliverables) {
        throw new Error('taskComplete: deliverables is required');
    }
    
    // 验证deliverables格式
    if (Array.isArray(params.deliverables)) {
        if (params.deliverables.length === 0) {
            throw new Error('taskComplete: deliverables array cannot be empty');
        }
        
        // 检查是字符串数组还是对象数组
        const isStringArray = params.deliverables.every(item => typeof item === 'string');
        const isObjectArray = params.deliverables.every(item => 
            typeof item === 'object' && item !== null && 
            typeof item.path === 'string' && typeof item.content === 'string'
        );
        
        if (isStringArray) {
            // 验证字符串数组格式 - 无需额外验证
        } else if (isObjectArray) {
            // 验证对象数组格式 - 每个对象必须有path和content
            for (let i = 0; i < params.deliverables.length; i++) {
                const item = params.deliverables[i] as any; // 类型断言，因为我们已经验证了isObjectArray
                if (!item.path || typeof item.path !== 'string') {
                    throw new Error(`taskComplete: deliverable at index ${i} must have a valid path`);
                }
                if (!item.content || typeof item.content !== 'string') {
                    throw new Error(`taskComplete: deliverable at index ${i} must have valid content`);
                }
            }
        } else {
            throw new Error('taskComplete: deliverables array must contain either all strings or all objects with path and content');
        }
    } else if (typeof params.deliverables === 'object') {
        // 验证对象字典格式
        const deliverableKeys = Object.keys(params.deliverables);
        if (deliverableKeys.length === 0) {
            throw new Error('taskComplete: deliverables object cannot be empty');
        }
        
        // 验证每个deliverable对象的结构
        for (const key of deliverableKeys) {
            const item = params.deliverables[key];
            if (!item || typeof item !== 'object') {
                throw new Error(`taskComplete: deliverable "${key}" must be an object`);
            }
            if (!item.path || typeof item.path !== 'string') {
                throw new Error(`taskComplete: deliverable "${key}" must have a valid path`);
            }
            if (!item.content || typeof item.content !== 'string') {
                throw new Error(`taskComplete: deliverable "${key}" must have valid content`);
            }
        }
    } else {
        throw new Error('taskComplete: deliverables must be either an array or an object');
    }
    
    // 构建任务完成结果
    const result: TaskCompletionResult = {
        completionType: params.completionType,
        nextStepType: params.nextStepType,
        summary: params.summary,
        deliverables: params.deliverables,
        nextStepDetails: params.nextStepDetails,
        contextForNext: params.contextForNext
    };
    
    // 记录任务完成日志
    logger.info(`🎯 [taskComplete] Specialist task completed:`);
    logger.info(`   - Type: ${params.completionType}`);
    logger.info(`   - Next Step: ${params.nextStepType}`);
    
    // 记录deliverables信息
    if (Array.isArray(params.deliverables)) {
        const isStringArray = params.deliverables.every(item => typeof item === 'string');
        if (isStringArray) {
            logger.info(`   - Deliverables: ${params.deliverables.length} items (string array format)`);
        } else {
            logger.info(`   - Deliverables: ${params.deliverables.length} items (object array format with content)`);
        }
    } else {
        const deliverableKeys = Object.keys(params.deliverables);
        logger.info(`   - Deliverables: ${deliverableKeys.length} items (object dictionary format with content)`);
    }
    
    if (params.nextStepDetails?.specialistType) {
        logger.info(`   - Next Specialist: ${params.nextStepDetails.specialistType}`);
    }
    
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