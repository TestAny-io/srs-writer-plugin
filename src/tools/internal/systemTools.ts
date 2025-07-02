/**
 * 系统内部工具 - 系统控制和管理工具
 * 
 * 架构定位：
 * - 内部控制层：不直接操作外部资源，而是控制系统行为
 * - AI系统交互：为AI提供明确的任务完成、状态控制信号
 * - 流程管理：控制对话流程、任务边界、系统状态
 */

import { CallerType } from '../../types/index';

/**
 * 最终答案结构
 */
export interface FinalAnswer {
    summary: string;
    achievements: string[];
    nextSteps: string[];
    metadata?: {
        taskType?: string;
        executionTime?: number;
        toolsUsed?: number;
    };
}

/**
 * 系统状态信息
 */
export interface SystemStatus {
    mode: string;
    activeProject?: string;
    toolsAvailable: number;
    sessionInfo: {
        created: string;
        lastModified: string;
        version: string;
    };
}

/**
 * 系统内部工具定义
 */
export const systemToolDefinitions = [
    {
        name: 'finalAnswer',
        description: `Provide the final answer and mark task completion. REQUIRED when you have completed all user requests.
        
Key purposes:
- Signal explicit task completion (stops conversation loop)
- Provide comprehensive task summary
- List concrete achievements 
- Suggest logical next steps

Usage: Call this when you have successfully completed the user's request, whether it's creating a project, editing files, running checks, or providing information.`,
        parameters: {
            type: 'object',
            properties: {
                summary: {
                    type: 'string',
                    description: 'Comprehensive summary of what was accomplished'
                },
                achievements: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of concrete achievements/deliverables'
                },
                nextSteps: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Suggested logical next steps for the user'
                },
                taskType: {
                    type: 'string',
                    description: 'Type of task completed (e.g. "project_creation", "file_editing", "status_inquiry")'
                }
            },
            required: ['summary', 'achievements', 'nextSteps']
        },
        // 🚀 访问控制：只有orchestrator可以标记最终完成
        accessibleBy: [
            CallerType.ORCHESTRATOR_TOOL_EXECUTION   // 只有orchestrator可以调用finalAnswer
            // 注意：移除了CallerType.SPECIALIST，specialist现在使用taskComplete
        ]
    },
    {
        name: 'reportProgress',
        description: `Report current progress on a multi-step task. Use for long-running operations to keep user informed.`,
        parameters: {
            type: 'object',
            properties: {
                currentStep: {
                    type: 'string',
                    description: 'Description of current step being executed'
                },
                completedSteps: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of steps already completed'
                },
                remainingSteps: {
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'List of steps still to be completed'
                },
                estimatedTimeRemaining: {
                    type: 'string',
                    description: 'Estimated time to completion (optional)'
                }
            },
            required: ['currentStep', 'completedSteps', 'remainingSteps']
        }
    },
    {
        name: 'getSystemStatus',
        description: `Get comprehensive system status including current project, available tools, and session information.`,
        parameters: {
            type: 'object',
            properties: {
                includeToolInventory: {
                    type: 'boolean',
                    description: 'Whether to include detailed tool inventory in response'
                },
                includeSessionDetails: {
                    type: 'boolean', 
                    description: 'Whether to include detailed session information'
                }
            }
        }
    }
];

/**
 * 系统内部工具实现
 */
export const systemToolImplementations = {
    
    /**
     * 提供最终答案并标记任务完成
     */
    finalAnswer: async (params: {
        summary: string;
        achievements: string[];
        nextSteps: string[];
        taskType?: string;
    }): Promise<FinalAnswer> => {
        const finalAnswer: FinalAnswer = {
            summary: params.summary,
            achievements: params.achievements,
            nextSteps: params.nextSteps,
            metadata: {
                taskType: params.taskType || 'general',
                executionTime: Date.now(),
                toolsUsed: 0 // This will be filled by the caller
            }
        };

        // 记录任务完成日志
        console.log(`[SystemTools] Task completed: ${params.taskType || 'general'}`);
        console.log(`[SystemTools] Achievements: ${params.achievements.length} items`);
        console.log(`[SystemTools] Next steps: ${params.nextSteps.length} suggestions`);

        return finalAnswer;
    },

    /**
     * 报告当前进度
     */
    reportProgress: async (params: {
        currentStep: string;
        completedSteps: string[];
        remainingSteps: string[];
        estimatedTimeRemaining?: string;
    }): Promise<{ status: string; progress: any }> => {
        const totalSteps = params.completedSteps.length + 1 + params.remainingSteps.length;
        const progressPercentage = Math.round((params.completedSteps.length / totalSteps) * 100);

        const progress = {
            currentStep: params.currentStep,
            completedSteps: params.completedSteps,
            remainingSteps: params.remainingSteps,
            progressPercentage,
            estimatedTimeRemaining: params.estimatedTimeRemaining,
            totalSteps
        };

        console.log(`[SystemTools] Progress Update: ${progressPercentage}% complete`);
        console.log(`[SystemTools] Current Step: ${params.currentStep}`);

        return {
            status: 'progress_reported',
            progress
        };
    },

    /**
     * 获取系统状态
     */
    getSystemStatus: async (params: {
        includeToolInventory?: boolean;
        includeSessionDetails?: boolean;
    } = {}): Promise<SystemStatus> => {
        // 这里需要从实际的系统组件获取状态
        // 暂时返回模拟数据，实际实现时会注入真实的状态获取逻辑
        
        const status: SystemStatus = {
            mode: 'AI_TOOL_AGENT',
            activeProject: undefined, // Will be filled by actual session manager
            toolsAvailable: 0, // Will be filled by actual tool registry
            sessionInfo: {
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                version: '2.0'
            }
        };

        console.log(`[SystemTools] System status requested`);
        console.log(`[SystemTools] Mode: ${status.mode}`);

        return status;
    }
};

/**
 * 系统工具类别信息
 */
export const systemToolsCategory = {
    name: 'System Control Tools',
    description: 'Internal tools for system control, task completion signaling, and status management',
    tools: systemToolDefinitions.map(tool => tool.name),
    layer: 'internal'
}; 