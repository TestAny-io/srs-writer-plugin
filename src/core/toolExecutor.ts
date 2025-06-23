/**
 * 工具执行器 v3.0 - 基于工具注册表的动态分发系统
 * 
 * 核心特性：
 * 🔄 动态工具分发：基于统一工具注册表的自动化工具调用
 * 🧠 智能错误处理：类型安全的参数验证和详细错误信息
 * ⚡ 并行执行支持：支持多个工具的并行调用优化
 * 🎯 统一接口：所有工具通过相同的接口调用，简化上层逻辑
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

const logger = Logger.getInstance();

// ============================================================================
// 类型定义与枚举
// ============================================================================

/**
 * 批量执行失败策略
 * 🚀 新增：支持不同的失败处理策略，增强系统的灵活性
 */
export enum BatchFailureStrategy {
    /** 遇到失败继续执行后续工具（默认策略，适用于独立任务） */
    CONTINUE_ON_FAILURE = 'continue',
    /** 遇到失败立即中断整个批量执行（适用于有依赖关系的任务序列） */
    HALT_ON_FAILURE = 'halt'
}

/**
 * 批量执行选项
 */
export interface BatchExecutionOptions {
    /** 失败策略，默认为 CONTINUE_ON_FAILURE */
    strategy?: BatchFailureStrategy;
    /** 是否记录详细的执行日志 */
    verbose?: boolean;
}

// ============================================================================
// 工具执行器核心类
// ============================================================================

export class ToolExecutor {
    private executionCount = 0;
    private lastExecutionTime: Date | null = null;
    // 🚀 添加工具定义缓存，避免重复日志打印
    private toolDefinitionsCache: any[] | null = null;

    /**
     * 获取所有可用工具的定义（用于AI工具调用）
     * 🚀 修复：添加缓存机制，避免重复日志打印
     */
    getAvailableTools() {
        if (this.toolDefinitionsCache) {
            // 使用缓存，不打印日志
            return this.toolDefinitionsCache;
        }
        
        const allDefinitions = getAllDefinitions();
        this.toolDefinitionsCache = allDefinitions;
        logger.info(`🛠️ Retrieved ${allDefinitions.length} tool definitions for AI`);
        return allDefinitions;
    }

    /**
     * 执行单个工具
     * 🚀 升级：使用新的统一工具执行接口 + 访问控制
     */
    async executeTool(toolName: string, args: any, caller?: CallerType): Promise<any> {
        const startTime = Date.now();
        this.executionCount++;
        this.lastExecutionTime = new Date();

        try {
            logger.info(`🚀 Executing tool: ${toolName} with args: ${JSON.stringify(args, null, 2)}`);

            // 检查工具是否存在
            const toolDefinition = getToolDefinition(toolName);
            if (!toolDefinition) {
                const availableTools = getAllDefinitions().map(t => t.name).join(', ');
                throw new Error(`Unknown tool: ${toolName}. Available tools: ${availableTools}`);
            }

            // 🚀 新增：访问控制验证
            if (caller) {
                const { ToolAccessController } = await import('./orchestrator/ToolAccessController');
                const accessController = new ToolAccessController();
                
                if (!accessController.validateAccess(caller, toolName)) {
                    throw new Error(`🚫 Access denied: ${caller} cannot access tool: ${toolName}`);
                }
            }

            // 执行工具
            const result = await toolRegistry.executeTool(toolName, args);
            
            const duration = Date.now() - startTime;
            logger.info(`✅ Tool ${toolName} executed successfully in ${duration}ms`);
            
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
     * 并行执行多个工具
     * 🚀 新功能：支持多工具并行执行，提升性能
     */
    async executeToolsParallel(toolCalls: Array<{ name: string; args: any }>): Promise<any[]> {
        logger.info(`🔄 Executing ${toolCalls.length} tools in parallel`);
        
        const startTime = Date.now();
        
        try {
            const promises = toolCalls.map(toolCall => 
                this.executeTool(toolCall.name, toolCall.args)
            );
            
            const results = await Promise.all(promises);
            
            const duration = Date.now() - startTime;
            const successCount = results.filter(r => r.success).length;
            
            logger.info(`✅ Parallel execution completed: ${successCount}/${toolCalls.length} successful in ${duration}ms`);
            
            return results;
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`❌ Parallel execution failed after ${duration}ms: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * 批量执行工具（顺序执行，支持依赖关系）
     * 🚀 增强：现在支持不同的失败策略，适应各种执行场景
     */
    async executeToolsBatch(
        toolCalls: Array<{ name: string; args: any }>, 
        options: BatchExecutionOptions = {}
    ): Promise<any[]> {
        const strategy = options.strategy || BatchFailureStrategy.CONTINUE_ON_FAILURE;
        const verbose = options.verbose !== false; // 默认为 true
        
        if (verbose) {
            logger.info(`📋 Executing ${toolCalls.length} tools in sequence with strategy: ${strategy}`);
        }
        
        const results: any[] = [];
        const startTime = Date.now();
        
        for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i];
            
            if (verbose) {
                logger.info(`📝 Executing tool ${i + 1}/${toolCalls.length}: ${toolCall.name}`);
            }
            
            const result = await this.executeTool(toolCall.name, toolCall.args);
            results.push(result);
            
            // 根据失败策略处理执行结果
            if (!result.success) {
                if (strategy === BatchFailureStrategy.HALT_ON_FAILURE) {
                    logger.error(`❌ Tool ${toolCall.name} failed, halting batch execution due to HALT_ON_FAILURE strategy`);
                    break; // 立即中断整个批次执行
                } else {
                    logger.warn(`⚠️ Tool ${toolCall.name} failed, continuing with next tool due to CONTINUE_ON_FAILURE strategy`);
                }
            }
        }
        
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        
        if (verbose) {
            logger.info(`✅ Batch execution completed: ${successCount}/${toolCalls.length} successful, ${failureCount} failed in ${duration}ms`);
        }
        
        return results;
    }

    /**
     * 获取工具执行统计信息
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
     * 验证工具参数
     * 🚀 新功能：基于工具定义进行参数验证
     */
    validateToolParameters(toolName: string, args: any): { valid: boolean; errors?: string[] } {
        const toolDefinition = getToolDefinition(toolName);
        if (!toolDefinition) {
            return { valid: false, errors: [`Unknown tool: ${toolName}`] };
        }

        const errors: string[] = [];
        const requiredParams = toolDefinition.parameters.required || [];
        
        // 检查必需参数
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
     * 搜索可用工具
     * 🚀 新功能：按名称、描述或类别搜索工具
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
     * 重置执行统计
     */
    resetStats() {
        this.executionCount = 0;
        this.lastExecutionTime = null;
        this.toolDefinitionsCache = null; // 🚀 清理工具定义缓存
        logger.info('🔄 Tool execution statistics reset');
    }
}

// ============================================================================
// 工具执行器实例
// ============================================================================

/**
 * 全局工具执行器实例
 * 🚀 升级：现在是完全基于工具注册表的动态系统
 */
export const toolExecutor = new ToolExecutor();

// ============================================================================
// 便捷函数导出（向后兼容）
// ============================================================================

/**
 * 快速执行单个工具的便捷函数
 */
export async function executeTool(toolName: string, args: any, caller?: CallerType) {
    return await toolExecutor.executeTool(toolName, args, caller);
}

/**
 * 获取所有可用工具定义的便捷函数
 */
export function getAvailableTools() {
    return toolExecutor.getAvailableTools();
}

/**
 * 验证工具参数的便捷函数
 */
export function validateToolParameters(toolName: string, args: any) {
    return toolExecutor.validateToolParameters(toolName, args);
}

/**
 * 搜索工具的便捷函数
 */
export function searchTools(query: string) {
    return toolExecutor.searchTools(query);
}

/**
 * 批量执行工具的便捷函数
 * 🚀 新增：支持失败策略配置的便捷函数
 */
export async function executeToolsBatch(
    toolCalls: Array<{ name: string; args: any }>,
    options?: BatchExecutionOptions
) {
    return await toolExecutor.executeToolsBatch(toolCalls, options);
}