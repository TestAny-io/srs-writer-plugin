/**
 * 统一会话日志记录服务
 * 
 * 负责将所有组件的重要业务事件记录到 srs-writer-session_{{projectName}}.json 文件中
 * 
 * 设计原则：
 * 1. 通用性：支持 specialist、工具、orchestrator 等所有组件
 * 2. 一致性：与现有的 orchestrator 记录路径保持一致
 * 3. 扩展性：易于添加新的记录类型和格式
 * 4. 职责单一：专门负责会话日志记录
 * 5. 错误隔离：日志记录失败不影响主业务流程
 */

import { SessionManager } from './session-manager';
import { OperationType } from '../types/session';
import { NextStepType } from '../types/taskCompletion';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

/**
 * Specialist 任务完成上下文
 */
export interface SpecialistTaskContext {
    specialistId: string;
    specialistName?: string;                        // 🚀 新增：specialist 显示名称
    planId?: string;                                // 🚀 新增：执行计划ID
    taskCompleteArgs: {
        nextStepType: NextStepType;
        summary: string;
        contextForNext?: any;
    };
    executionTime?: number;
    iterationCount?: number;
}

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
    executor: string;           // 执行者标识：'specialist' | 'traceability_tool' | 'orchestrator'
    toolName: string;           // 工具名称
    operation: string;          // 操作描述
    success: boolean;           // 执行是否成功
    targetFiles?: string[];     // 影响的文件列表
    executionTime?: number;     // 执行时间（毫秒）
    args?: any;                 // 工具参数
    result?: any;               // 执行结果
    error?: string;             // 错误信息
    metadata?: any;             // 额外元数据
}

/**
 * 生命周期事件上下文
 */
export interface LifecycleEventContext {
    eventType: 'project_created' | 'project_switched' | 'session_archived' | 'specialist_started' | 'specialist_completed' | 'plan_failed';  // 🚀 新增 plan_failed
    description: string;
    entityId?: string;          // 相关实体ID（项目名、specialist ID等）
    metadata?: any;
}

/**
 * 统一会话日志记录服务
 */
export class SessionLogService {
    private sessionManager: SessionManager;
    private logger: Logger;
    
    constructor() {
        this.sessionManager = SessionManager.getInstance();
        this.logger = Logger.getInstance();
        this.logger.info('📋 SessionLogService initialized');
    }
    
    /**
     * 记录 specialist taskComplete 事件
     */
    async recordSpecialistTaskCompletion(context: SpecialistTaskContext): Promise<void> {
        try {
            if (!this.isImportantEvent({ type: 'specialist', context })) {
                this.logger.debug(`Skipping non-important specialist task: ${context.specialistId}`);
                return;
            }
            
            const operation = `Specialist ${context.specialistId} 完成任务: ${context.taskCompleteArgs.summary}`;
            
            await this.sessionManager.updateSessionWithLog({
                logEntry: {
                    type: OperationType.SPECIALIST_INVOKED,
                    operation: operation,
                    success: true,
                    toolName: 'taskComplete',
                    executionTime: context.executionTime,
                    // 🚀 修复E：直接使用 JSON 对象，而不是字符串
                    userInput: {
                        specialistId: context.specialistId,
                        specialistName: context.specialistName,
                        planId: context.planId,
                        nextStepType: context.taskCompleteArgs.nextStepType,
                        summary: context.taskCompleteArgs.summary,
                        deliverables: context.taskCompleteArgs.contextForNext?.deliverables,
                        iterationCount: context.iterationCount,
                        taskDuration: context.executionTime
                    } as any  // 类型断言以匹配 string 类型的 userInput 字段
                }
            });
            
            this.logger.info(`📋 Specialist task completion recorded: ${context.specialistId}`);
            
        } catch (error) {
            // 错误隔离：记录失败不影响主流程
            this.logger.warn(`Failed to record specialist task completion for ${context.specialistId}: ${(error as Error).message}`);
        }
    }
    
    /**
     * 记录工具执行事件（通用）
     */
    async recordToolExecution(context: ToolExecutionContext): Promise<void> {
        try {
            if (!this.isImportantEvent({ type: 'tool', context })) {
                this.logger.debug(`Skipping non-important tool execution: ${context.toolName}`);
                return;
            }
            
            const operationType = this.mapToOperationType(context.toolName, context.success, context);
            const targetFiles = this.extractTargetFiles(context.args);
            
            await this.sessionManager.updateSessionWithLog({
                logEntry: {
                    type: operationType,
                    operation: context.operation,
                    success: context.success,
                    toolName: context.toolName,
                    targetFiles: targetFiles.length > 0 ? targetFiles : (context.targetFiles || []),
                    executionTime: context.executionTime,
                    error: context.error,
                    // 🚀 修复E：直接使用 JSON 对象
                    userInput: this.formatSessionData(context) as any
                }
            });
            
            this.logger.info(`📋 Tool execution recorded: ${context.toolName} (${context.success ? 'success' : 'failed'})`);
            
        } catch (error) {
            // 错误隔离：记录失败不影响主流程
            this.logger.warn(`Failed to record tool execution for ${context.toolName}: ${(error as Error).message}`);
        }
    }
    
    /**
     * 记录生命周期事件
     */
    async recordLifecycleEvent(context: LifecycleEventContext): Promise<void> {
        try {
            const operationType = this.mapLifecycleEventToOperationType(context.eventType);
            
            await this.sessionManager.updateSessionWithLog({
                logEntry: {
                    type: operationType,
                    operation: context.description,
                    success: true,
                    // 🚀 修复E：直接使用 JSON 对象
                    userInput: {
                        eventType: context.eventType,
                        entityId: context.entityId,
                        metadata: context.metadata
                    } as any
                }
            });
            
            this.logger.info(`📋 Lifecycle event recorded: ${context.eventType}`);
            
        } catch (error) {
            // 错误隔离：记录失败不影响主流程
            this.logger.warn(`Failed to record lifecycle event ${context.eventType}: ${(error as Error).message}`);
        }
    }
    
    /**
     * 判断是否为重要事件
     */
    private isImportantEvent(event: { type: 'specialist' | 'tool' | 'lifecycle', context: any }): boolean {
        switch (event.type) {
            case 'specialist':
                // Specialist 的 taskComplete 始终重要
                return true;
                
            case 'tool':
                const toolContext = event.context as ToolExecutionContext;
                const importantTools = [
                    'taskComplete',
                    'traceability-completion-tool',
                    'executeSemanticEdits',
                    'createNewProjectFolder',
                    'executeMarkdownEdits',
                    'executeYAMLEdits',
                    'specialist_execution',      // 🚀 specialist 执行失败记录
                    'specialist_step_execution'  // 🚀 新增：specialist 步骤执行记录
                ];
                return importantTools.includes(toolContext.toolName);
                
            case 'lifecycle':
                // 所有生命周期事件都重要
                return true;
                
            default:
                return false;
        }
    }
    
    /**
     * 将工具名称映射到操作类型
     */
    private mapToOperationType(
        toolName: string, 
        success: boolean, 
        context?: any
    ): OperationType {
        switch (toolName) {
            case 'taskComplete':
                // 使用现有的 SPECIALIST_INVOKED 枚举值
                return OperationType.SPECIALIST_INVOKED;
                
            case 'traceability-completion-tool':
                return success ? 
                    OperationType.TOOL_EXECUTION_END : 
                    OperationType.TOOL_EXECUTION_FAILED;
                    
            case 'executeSemanticEdits':
            case 'executeMarkdownEdits':
            case 'executeYAMLEdits':
                return success ? 
                    OperationType.FILE_UPDATED : 
                    OperationType.TOOL_EXECUTION_FAILED;
                    
            case 'createNewProjectFolder':
                return success ? 
                    OperationType.SESSION_CREATED : 
                    OperationType.TOOL_EXECUTION_FAILED;
                    
            default:
                return success ? 
                    OperationType.TOOL_EXECUTION_END : 
                    OperationType.TOOL_EXECUTION_FAILED;
        }
    }
    
    /**
     * 将生命周期事件映射到操作类型
     */
    private mapLifecycleEventToOperationType(eventType: LifecycleEventContext['eventType']): OperationType {
        switch (eventType) {
            case 'project_created':
                return OperationType.SESSION_CREATED;
            case 'project_switched':
                return OperationType.SESSION_UPDATED;
            case 'session_archived':
                return OperationType.SESSION_ARCHIVED;
            case 'specialist_started':
            case 'specialist_completed':
                return OperationType.SPECIALIST_INVOKED;
            case 'plan_failed':                             // 🚀 新增
                return OperationType.ERROR_OCCURRED;
            default:
                return OperationType.SYSTEM_INITIALIZED;
        }
    }
    
    /**
     * 从工具参数中提取目标文件
     */
    private extractTargetFiles(args: any): string[] {
        if (!args || typeof args !== 'object') {
            return [];
        }
        
        const files: string[] = [];
        
        // 常见的文件参数名
        const fileParams = ['targetFile', 'target_file', 'path', 'filePath', 'fileName'];
        
        for (const param of fileParams) {
            if (args[param]) {
                files.push(args[param]);
            }
        }
        
        // 处理数组类型的文件参数
        if (args.files && Array.isArray(args.files)) {
            files.push(...args.files);
        }
        
        return files.filter(file => file && typeof file === 'string');
    }
    
    /**
     * 格式化会话数据
     */
    private formatSessionData(context: ToolExecutionContext): any {
        return {
            executor: context.executor,
            toolName: context.toolName,
            success: context.success,
            executionTime: context.executionTime,
            metadata: context.metadata,
            // 只包含重要的参数信息，避免敏感数据
            argsKeys: context.args ? Object.keys(context.args) : [],
            resultType: context.result ? typeof context.result : undefined
        };
    }
}
