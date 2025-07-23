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
    description: `Expert-level structured thinking record tool - externalize and record the thinking process into the internal history
    
The specialist uses this tool to:
- Record the analysis and planning process for complex tasks
- Structure the thinking process for subsequent iterations
- Improve the execution quality and consistency of multi-step tasks
- Provide a clear derivation plan for complex document generation

Typical usage scenarios:
- Planning before generating complex requirements documents
- Decomposition and strategy development for multi-step tasks
- Record the analysis process for complex problems

Important: Only the specialist can call this tool, and the recorded thoughts will be visible in the next iteration`,
    
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
    accessibleBy: [CallerType.SPECIALIST],
    
    // 🚀 智能分类属性
    interactionType: 'autonomous' as const,
    riskLevel: 'low' as const,
    requiresConfirmation: false,
    
    // 🚀 AI指导系统
    callingGuide: {
        whenToUse: "Record the thinking process before generating complex content, especially for tasks that require multi-step reasoning or planning",
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