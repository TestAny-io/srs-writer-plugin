/**
 * 思考记录工具 - 专家级结构化思考过程记录
 * 
 * 用于专家记录和外化思考过程，支持多迭代工作流中的思考持久化
 */

import { CallerType } from '../../types/index';
import { Logger } from '../../utils/logger';

const logger = Logger.getInstance();

/**
 * 思考类型枚举
 */
export type ThinkingType = 'planning' | 'analysis' | 'synthesis' | 'reflection' | 'derivation';

/**
 * recordThought工具定义
 */
export const recordThoughtToolDefinition = {
    name: 'recordThought',
    description: `专家级结构化思考记录工具 - 将思考过程外化并记录到内部历史中
    
专家使用此工具来：
- 记录复杂任务的分析和规划过程
- 为后续迭代构建思考过程结构
- 提高多步骤任务的执行质量和一致性
- 为复杂文档生成提供清晰的推导计划

典型使用场景：
- 生成复杂需求文档前的规划
- 多步骤任务的分解和策略制定
- 复杂问题的分析过程记录

重要：只有专家可以调用此工具，记录的思考将在下次迭代中可见`,
    
    parameters: {
        type: 'object',
        properties: {
            thinkingType: {
                type: 'string',
                enum: ['planning', 'analysis', 'synthesis', 'reflection', 'derivation'],
                description: 'Thinking type - planning(planning), analysis(analysis), synthesis(synthesis), reflection(reflection), derivation(derivation)'
            },
            content: {
                type: 'object',
                description: 'Structured thinking content, which can contain any key-value pairs to organize the thinking process',
                additionalProperties: true
            },
            nextSteps: {
                type: 'array',
                items: { type: 'string' },
                description: 'Next specific actions based on this thinking plan'
            },
            context: {
                type: 'string',
                description: 'Background context of the thinking, helping to understand the source and goal of the thinking'
            }
        },
        required: ['thinkingType', 'content']
    },
    
    // 🚀 访问控制：只有specialist可以访问
    accessibleBy: [CallerType.SPECIALIST_CONTENT, CallerType.SPECIALIST_PROCESS],
    
    // 🚀 智能分类属性
    interactionType: 'autonomous' as const,
    riskLevel: 'low' as const,
    requiresConfirmation: false,
    
    // 🚀 AI指导系统
    callingGuide: {
        whenToUse: "复杂内容前记录思考过程，特别是需要多步推理或规划的任务",
        prerequisites: "Need to have clear thinking content and type",
        inputRequirements: {
            thinkingType: "Select the type that best matches the current thinking nature",
            content: "Structured thinking content, it is recommended to use object form to organize",
            nextSteps: "Specific action plan based on thinking"
        },
        internalWorkflow: [
            "Receive thinking content parameters",
            "Verify thinking type and content format",
            "Record into internal history for subsequent iterations",
            "Return confirmation information"
        ],
        commonPitfalls: [
            "Do not overuse in simple tasks",
            "Ensure that the thinking content is structured rather than pure text",
            "Avoid recording overly long thinking processes"
        ]
    }
};

/**
 * 思考记录结果接口
 */
export interface ThoughtRecord {
    thinkingType: ThinkingType;
    content: any;
    nextSteps?: string[];
    context?: string;
    timestamp: string;
    thoughtId: string;
}

/**
 * recordThought工具实现
 */
export const recordThought = async (params: {
    thinkingType: ThinkingType;
    content: any;
    nextSteps?: string[];
    context?: string;
}): Promise<{ success: boolean; thoughtRecord: ThoughtRecord }> => {
    
    // 验证参数
    if (!params.content || (typeof params.content !== 'object' && typeof params.content !== 'string')) {
        throw new Error('recordThought: content is required and must be an object or string');
    }
    
    // 生成思考记录
    const thoughtRecord: ThoughtRecord = {
        thinkingType: params.thinkingType,
        content: params.content,
        nextSteps: params.nextSteps,
        context: params.context,
        timestamp: new Date().toISOString(),
        thoughtId: `thought_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // 记录思考过程日志
    logger.info(`🧠 [recordThought] Specialist thought recorded:`);
    logger.info(`   - Type: ${params.thinkingType}`);
    logger.info(`   - Context: ${params.context || 'Not specified'}`);
    logger.info(`   - Content Keys: ${typeof params.content === 'object' ? Object.keys(params.content).join(', ') : 'String content'}`);
    logger.info(`   - Next Steps: ${params.nextSteps?.length || 0} planned actions`);
    
    return {
        success: true,
        thoughtRecord
    };
};

/**
 * 工具分类信息
 */
export const recordThoughtToolsCategory = {
    name: 'Thinking Tools',
    description: '思考记录工具 - 支持专家级结构化思考过程外化和持久化',
    tools: ['recordThought'],
    layer: 'internal'
};

/**
 * 导出定义和实现
 */
export const recordThoughtToolDefinitions = [recordThoughtToolDefinition];
export const recordThoughtToolImplementations = { recordThought }; 