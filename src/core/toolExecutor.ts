/**
 * 工具执行器 v3.0 - 基于工具注册表的动态分发系统
 * 
 * 核心特性：
 * - 动态工具分发：基于统一工具注册表的自动化工具调用
 * - 智能错误处理：类型安全的参数验证和详细错误信息
 * - 并行执行支持：支持多个工具的并行调用优化
 * - 统一接口：所有工具通过相同的接口调用，简化上层逻辑
 * - 智能成功检测：根据返回结果中的success字段判断业务操作是否成功
 * - v3.0: 支持 specialist ID 参数用于细粒度访问控制
 */

import { Logger } from '../utils/logger';
import { CallerType } from '../types/index';
import { 
    toolRegistry,
    getAllDefinitions,
    getImplementation,
    executeTool as executeToolFromRegistry,
    hasTool,
    getToolDefinition,
    generateToolInventoryText,
    getStats
} from '../tools/index';
import * as vscode from 'vscode';

const logger = Logger.getInstance();

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Batch Failure Strategy
 */
export enum BatchFailureStrategy {
    /** Continue on failure (default) */
    CONTINUE_ON_FAILURE = 'continue',
    /** Halt on failure */
    HALT_ON_FAILURE = 'halt'
}

/**
 * Batch Execution Options
 */
export interface BatchExecutionOptions {
    strategy?: BatchFailureStrategy;
    verbose?: boolean;
}

// ============================================================================
// Tool Executor Core Class
// ============================================================================

export class ToolExecutor {
    private executionCount = 0;
    private lastExecutionTime: Date | null = null;
    private toolDefinitionsCache: any[] | null = null;

    /**
     * Get all available tool definitions
     */
    getAvailableTools() {
        if (this.toolDefinitionsCache) {
            return this.toolDefinitionsCache;
        }
        
        const allDefinitions = getAllDefinitions();
        this.toolDefinitionsCache = allDefinitions;
        logger.info(`Retrieved ${allDefinitions.length} tool definitions for AI`);
        return allDefinitions;
    }

    /**
     * Execute single tool
     * v3.0: Supports specialist ID parameter for fine-grained access control
     */
    async executeTool(
        toolName: string, 
        args: any, 
        caller?: CallerType,
        selectedModel?: vscode.LanguageModelChat,
        specialistId?: string
    ): Promise<any> {
        const startTime = Date.now();
        this.executionCount++;
        this.lastExecutionTime = new Date();

        try {
            const callerDesc = specialistId && caller ? `${caller}:${specialistId}` : (caller || 'unknown');
            logger.info(`Executing tool: ${toolName} (caller: ${callerDesc}) with args: ${JSON.stringify(args, null, 2)}`);

            // Check if tool exists
            const toolDefinition = getToolDefinition(toolName);
            if (!toolDefinition) {
                const availableTools = getAllDefinitions().map(t => t.name).join(', ');
                throw new Error(`Unknown tool: ${toolName}. Available tools: ${availableTools}`);
            }

            // v3.0: Access control validation (supports specialist ID)
            if (caller) {
                const { ToolAccessController } = await import('./orchestrator/ToolAccessController');
                const accessController = new ToolAccessController();
                
                if (!accessController.validateAccess(caller, toolName, specialistId)) {
                    throw new Error(`Access denied: ${callerDesc} cannot access tool: ${toolName}`);
                }
            }

            // Add model parameter for specialist tools
            const toolArgs = { ...args };
            
            logger.info(`[DEBUG] Tool: ${toolName}, layer: ${toolDefinition.layer}, hasModel: ${!!selectedModel}`);
            
            if (selectedModel && toolDefinition.layer === 'specialist') {
                toolArgs.model = selectedModel;
                logger.info(`Added model parameter for specialist tool: ${toolName}`);
            } else {
                logger.info(`[DEBUG] Condition failed - selectedModel: ${!!selectedModel}, layer: ${toolDefinition.layer}`);
            }

            // Execute tool
            const result = await toolRegistry.executeTool(toolName, toolArgs);
            
            const duration = Date.now() - startTime;
            
            // Smart success detection
            let actualSuccess = true;
            let errorMessage: string | undefined;
            
            if (result && typeof result === 'object') {
                if ('success' in result && typeof result.success === 'boolean') {
                    actualSuccess = result.success;
                    if (!actualSuccess && 'error' in result) {
                        errorMessage = result.error as string;
                    }
                }
                else if ('error' in result && result.error) {
                    actualSuccess = false;
                    errorMessage = result.error as string;
                }
            }
            
            if (actualSuccess) {
                logger.info(`Tool ${toolName} executed successfully in ${duration}ms`);
                return {
                    success: true,
                    result,
                    metadata: {
                        toolName,
                        category: toolDefinition.category,
                        layer: toolDefinition.layer,
                        executionTime: duration,
                        timestamp: this.lastExecutionTime.toISOString()
                    }
                };
            } else {
                logger.warn(`Tool ${toolName} executed but operation failed: ${errorMessage}`);
                return {
                    success: false,
                    error: errorMessage || `Tool ${toolName} operation failed`,
                    result,
                    metadata: {
                        toolName,
                        category: toolDefinition.category,
                        layer: toolDefinition.layer,
                        executionTime: duration,
                        timestamp: this.lastExecutionTime.toISOString()
                    }
                };
            }

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = `Tool execution failed: ${toolName}`;
            
            logger.error(`${errorMsg}: ${(error as Error).message}`);
            
            return {
                success: false,
                error: errorMsg,
                details: (error as Error).message,
                metadata: {
                    toolName,
                    executionTime: duration,
                    timestamp: this.lastExecutionTime.toISOString()
                }
            };
        }
    }

    /**
     * Execute multiple tools in parallel
     * v3.0: Supports specialist ID parameter
     */
    async executeToolsParallel(
        toolCalls: Array<{ name: string; args: any }>,
        caller?: CallerType,
        selectedModel?: vscode.LanguageModelChat,
        specialistId?: string
    ): Promise<any[]> {
        logger.info(`Executing ${toolCalls.length} tools in parallel`);
        
        const startTime = Date.now();
        
        try {
            const promises = toolCalls.map(toolCall => 
                this.executeTool(toolCall.name, toolCall.args, caller, selectedModel, specialistId)
            );
            
            const results = await Promise.all(promises);
            
            const duration = Date.now() - startTime;
            const successCount = results.filter(r => r.success).length;
            
            logger.info(`Parallel execution completed: ${successCount}/${toolCalls.length} successful in ${duration}ms`);
            
            return results;
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`Parallel execution failed after ${duration}ms: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Execute tools in batch (sequential with failure strategy)
     * v3.0: Supports specialist ID parameter
     */
    async executeToolsBatch(
        toolCalls: Array<{ name: string; args: any }>, 
        options: BatchExecutionOptions = {},
        caller?: CallerType,
        selectedModel?: vscode.LanguageModelChat,
        specialistId?: string
    ): Promise<any[]> {
        const strategy = options.strategy || BatchFailureStrategy.CONTINUE_ON_FAILURE;
        const verbose = options.verbose !== false;
        
        if (verbose) {
            logger.info(`Executing ${toolCalls.length} tools in sequence with strategy: ${strategy}`);
        }
        
        const results: any[] = [];
        const startTime = Date.now();
        
        for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i];
            
            if (verbose) {
                logger.info(`Executing tool ${i + 1}/${toolCalls.length}: ${toolCall.name}`);
            }
            
            const result = await this.executeTool(toolCall.name, toolCall.args, caller, selectedModel, specialistId);
            results.push(result);
            
            if (!result.success) {
                if (strategy === BatchFailureStrategy.HALT_ON_FAILURE) {
                    logger.error(`Tool ${toolCall.name} failed, halting batch execution`);
                    break;
                } else {
                    logger.warn(`Tool ${toolCall.name} failed, continuing with next tool`);
                }
            }
        }
        
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        
        if (verbose) {
            logger.info(`Batch execution completed: ${successCount}/${toolCalls.length} successful, ${failureCount} failed in ${duration}ms`);
        }
        
        return results;
    }

    /**
     * Get execution statistics
     */
    getExecutionStats() {
        const stats = getStats();
        return {
            totalExecutions: this.executionCount,
            lastExecutionTime: this.lastExecutionTime,
            availableToolsCount: stats.totalTools,
            toolSystemInfo: stats
        };
    }

    /**
     * Validate tool parameters
     */
    validateToolParameters(toolName: string, args: any): { valid: boolean; errors?: string[] } {
        const toolDefinition = getToolDefinition(toolName);
        if (!toolDefinition) {
            return { valid: false, errors: [`Unknown tool: ${toolName}`] };
        }

        const errors: string[] = [];
        const requiredParams = toolDefinition.parameters.required || [];
        
        for (const param of requiredParams) {
            if (!(param in args)) {
                errors.push(`Missing required parameter: ${param}`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    /**
     * Search tools
     */
    searchTools(query: string): Array<{name: string; description: string; category: string}> {
        const queryLower = query.toLowerCase();
        
        return getAllDefinitions()
            .filter(tool => 
                tool.name.toLowerCase().includes(queryLower) ||
                tool.description.toLowerCase().includes(queryLower) ||
                (tool.category && tool.category.toLowerCase().includes(queryLower)) ||
                (tool.layer && tool.layer.toLowerCase().includes(queryLower))
            )
            .map(tool => ({
                name: tool.name,
                description: tool.description,
                category: `${tool.category || 'Unknown'}/${tool.layer || 'Unknown'}`
            }));
    }

    /**
     * Reset execution statistics
     */
    resetStats() {
        this.executionCount = 0;
        this.lastExecutionTime = null;
        this.toolDefinitionsCache = null;
        logger.info('Tool execution statistics reset');
    }
}

// ============================================================================
// Tool Executor Instance
// ============================================================================

/**
 * Global tool executor instance
 */
export const toolExecutor = new ToolExecutor();

// ============================================================================
// Convenience Functions (backward compatible)
// ============================================================================

/**
 * Execute single tool (convenience function)
 * v3.0: Supports specialist ID parameter
 */
export async function executeTool(
    toolName: string, 
    args: any, 
    caller?: CallerType,
    selectedModel?: vscode.LanguageModelChat,
    specialistId?: string
) {
    return await toolExecutor.executeTool(toolName, args, caller, selectedModel, specialistId);
}

/**
 * Get all available tools (convenience function)
 */
export function getAvailableTools() {
    return toolExecutor.getAvailableTools();
}

/**
 * Validate tool parameters (convenience function)
 */
export function validateToolParameters(toolName: string, args: any) {
    return toolExecutor.validateToolParameters(toolName, args);
}

/**
 * Search tools (convenience function)
 */
export function searchTools(query: string) {
    return toolExecutor.searchTools(query);
}

/**
 * Execute tools in parallel (convenience function)
 * v3.0: Supports specialist ID parameter
 */
export async function executeToolsParallel(
    toolCalls: Array<{ name: string; args: any }>,
    caller?: CallerType,
    selectedModel?: vscode.LanguageModelChat,
    specialistId?: string
) {
    return await toolExecutor.executeToolsParallel(toolCalls, caller, selectedModel, specialistId);
}

/**
 * Execute tools in batch (convenience function)
 * v3.0: Supports specialist ID parameter
 */
export async function executeToolsBatch(
    toolCalls: Array<{ name: string; args: any }>,
    options?: BatchExecutionOptions,
    caller?: CallerType,
    selectedModel?: vscode.LanguageModelChat,
    specialistId?: string
) {
    return await toolExecutor.executeToolsBatch(toolCalls, options, caller, selectedModel, specialistId);
}
