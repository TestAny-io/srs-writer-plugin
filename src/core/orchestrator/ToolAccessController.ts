import { Logger } from '../../utils/logger';
import { CallerType, CallerName, AccessControl } from '../../types/index';
import { ToolDefinition, getAllDefinitions, getToolDefinition } from '../../tools/index';
import { getSpecialistRegistry, SpecialistRegistry } from '../specialistRegistry';

/**
 * 工具访问控制器 - 分布式权限管理 v3.0
 * 
 * v3.0 新特性：
 * - 支持混合访问控制（CallerType + CallerName）
 * - 利用 SpecialistRegistry 实现动态 specialist 验证
 * - 细粒度的个体级别权限控制
 * 
 * 基于工具自身的 accessibleBy 属性实现细粒度访问控制
 * 支持不同调用者类型和个体的工具过滤和权限验证
 */
export class ToolAccessController {
    private logger = Logger.getInstance();
    private specialistRegistry: SpecialistRegistry;  // 🚀 v3.0 新增
    
    constructor() {
        this.specialistRegistry = getSpecialistRegistry();
    }

    /**
     * 获取指定调用者可访问的工具列表
     * 🚀 v3.0: 支持 specialist ID 参数
     */
    public getAvailableTools(caller: CallerType, specialistId?: string): ToolDefinition[] {
        const allTools = getAllDefinitions();
        
        const filteredTools = allTools.filter(tool => this.isToolAccessible(tool, caller, specialistId));
        
        const callerDesc = specialistId ? `${caller}:${specialistId}` : caller;
        this.logger.info(`🔒 Access control: ${callerDesc} can access ${filteredTools.length}/${allTools.length} tools`);
        
        return filteredTools;
    }

    /**
     * 验证调用者是否可以访问指定工具
     * 🚀 v3.0: 支持 specialist ID 参数
     */
    public validateAccess(caller: CallerType, toolName: string, specialistId?: string): boolean {
        const tool = getToolDefinition(toolName);
        if (!tool) {
            this.logger.warn(`🚫 Access denied: Tool not found: ${toolName}`);
            return false;
        }

        const hasAccess = this.isToolAccessible(tool, caller, specialistId);
        
        if (!hasAccess) {
            const callerDesc = specialistId ? `${caller}:${specialistId}` : caller;
            this.logger.warn(`🚫 Access denied: ${callerDesc} cannot access tool: ${toolName}`);
        }

        return hasAccess;
    }

    /**
     * 检查工具是否对调用者可访问
     * 🚀 v3.0: 支持混合访问控制（CallerType + CallerName）
     */
    private isToolAccessible(tool: ToolDefinition, caller: CallerType, specialistId?: string): boolean {
        // 如果工具没有定义 accessibleBy，则应用默认策略
        if (!tool.accessibleBy || tool.accessibleBy.length === 0) {
            return this.getDefaultAccess(tool, caller);
        }

        // 遍历 accessibleBy 数组，支持混合类型
        for (const accessor of tool.accessibleBy) {
            // 情况1: CallerType（枚举值）- 类型级别控制
            if (this.isCallerType(accessor)) {
                if (accessor === caller) {
                    return true;
                }
            }
            // 情况2: CallerName（specialist ID 字符串）- 个体级别控制
            else if (typeof accessor === 'string') {
                if (specialistId && accessor === specialistId) {
                    // 验证 specialist 是否真实存在
                    if (this.specialistRegistry.isSpecialistAvailable(accessor)) {
                        return true;
                    } else {
                        this.logger.warn(`⚠️ 工具 ${tool.name} 引用了不存在或未启用的 specialist: ${accessor}`);
                    }
                }
            }
        }

        return false;
    }
    
    /**
     * 🚀 v3.0 新增：类型守卫，检查值是否为 CallerType
     */
    private isCallerType(value: any): value is CallerType {
        return Object.values(CallerType).includes(value as CallerType);
    }

    /**
     * 为未定义 accessibleBy 的工具提供默认访问策略
     * 基于工具层级和调用者类型的合理默认值
     */
    private getDefaultAccess(tool: ToolDefinition, caller: CallerType): boolean {
        // 基于层级和调用者的默认策略
        switch (tool.layer) {
            case 'specialist':
                // 专家工具：只有 specialist 可以访问（支持两种类型）
                return caller === CallerType.SPECIALIST_CONTENT || 
                       caller === CallerType.SPECIALIST_PROCESS;

            case 'document':
                // 文档工具：orchestrator TOOL_EXECUTION 和 specialist 可以访问
                return caller === CallerType.ORCHESTRATOR_TOOL_EXECUTION || 
                       caller === CallerType.SPECIALIST_CONTENT ||
                       caller === CallerType.SPECIALIST_PROCESS;

            case 'atomic':
                // 原子工具：orchestrator 所有模式都可以访问，specialist 通过 document 层访问
                return caller === CallerType.ORCHESTRATOR_TOOL_EXECUTION ||
                       caller === CallerType.ORCHESTRATOR_KNOWLEDGE_QA ||
                       caller === CallerType.SPECIALIST_CONTENT ||
                       caller === CallerType.SPECIALIST_PROCESS;

            case 'internal':
                // 内部工具：所有AI层都可以访问
                return caller === CallerType.ORCHESTRATOR_TOOL_EXECUTION ||
                       caller === CallerType.ORCHESTRATOR_KNOWLEDGE_QA ||
                       caller === CallerType.SPECIALIST_CONTENT ||
                       caller === CallerType.SPECIALIST_PROCESS;

            default:
                // 未分层的工具：向后兼容，TOOL_EXECUTION 可以访问
                this.logger.warn(`🤔 Tool ${tool.name} has no layer definition, applying conservative access policy`);
                return caller === CallerType.ORCHESTRATOR_TOOL_EXECUTION;
        }
    }

    /**
     * 获取访问控制统计信息
     * 🚀 v3.0: 支持 specialist ID 参数
     */
    public getAccessStats(caller: CallerType, specialistId?: string): {
        totalTools: number;
        accessibleTools: number;
        deniedTools: number;
        byLayer: { [layer: string]: number };
    } {
        const allTools = getAllDefinitions();
        const accessibleTools = this.getAvailableTools(caller, specialistId);
        
        const byLayer: { [layer: string]: number } = {};
        accessibleTools.forEach(tool => {
            const layer = tool.layer || 'unknown';
            byLayer[layer] = (byLayer[layer] || 0) + 1;
        });

        return {
            totalTools: allTools.length,
            accessibleTools: accessibleTools.length,
            deniedTools: allTools.length - accessibleTools.length,
            byLayer
        };
    }

    /**
     * 生成访问控制报告 (用于调试)
     * 🚀 v3.0: 支持 specialist ID 参数
     */
    public generateAccessReport(caller: CallerType, specialistId?: string): string {
        const stats = this.getAccessStats(caller, specialistId);
        const accessibleTools = this.getAvailableTools(caller, specialistId);
        
        const callerDesc = specialistId ? `${caller}:${specialistId}` : caller;
        
        let report = `# Access Control Report for ${callerDesc}\n\n`;
        report += `**Summary**: ${stats.accessibleTools}/${stats.totalTools} tools accessible\n\n`;
        
        report += `**By Layer**:\n`;
        Object.entries(stats.byLayer).forEach(([layer, count]) => {
            report += `- ${layer}: ${count} tools\n`;
        });
        
        report += `\n**Accessible Tools**:\n`;
        accessibleTools.forEach(tool => {
            report += `- ${tool.name} (${tool.layer}/${tool.category})\n`;
        });

        return report;
    }
} 