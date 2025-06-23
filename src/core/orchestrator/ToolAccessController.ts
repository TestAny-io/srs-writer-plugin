import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';
import { ToolDefinition, getAllDefinitions, getToolDefinition } from '../../tools/index';

/**
 * 工具访问控制器 - 分布式权限管理
 * 
 * 基于工具自身的 accessibleBy 属性实现细粒度访问控制
 * 支持不同调用者类型的工具过滤和权限验证
 */
export class ToolAccessController {
    private logger = Logger.getInstance();

    /**
     * 获取指定调用者可访问的工具列表
     */
    public getAvailableTools(caller: CallerType): ToolDefinition[] {
        const allTools = getAllDefinitions();
        
        const filteredTools = allTools.filter(tool => this.isToolAccessible(tool, caller));
        
        this.logger.info(`🔒 Access control: ${caller} can access ${filteredTools.length}/${allTools.length} tools`);
        
        return filteredTools;
    }

    /**
     * 验证调用者是否可以访问指定工具
     */
    public validateAccess(caller: CallerType, toolName: string): boolean {
        const tool = getToolDefinition(toolName);
        if (!tool) {
            this.logger.warn(`🚫 Access denied: Tool not found: ${toolName}`);
            return false;
        }

        const hasAccess = this.isToolAccessible(tool, caller);
        
        if (!hasAccess) {
            this.logger.warn(`🚫 Access denied: ${caller} cannot access tool: ${toolName}`);
        }

        return hasAccess;
    }

    /**
     * 检查工具是否对调用者可访问
     */
    private isToolAccessible(tool: ToolDefinition, caller: CallerType): boolean {
        // 如果工具没有定义 accessibleBy，则应用默认策略
        if (!tool.accessibleBy || tool.accessibleBy.length === 0) {
            return this.getDefaultAccess(tool, caller);
        }

        // 检查调用者是否在工具的允许列表中
        return tool.accessibleBy.includes(caller);
    }

    /**
     * 为未定义 accessibleBy 的工具提供默认访问策略
     * 基于工具层级和调用者类型的合理默认值
     */
    private getDefaultAccess(tool: ToolDefinition, caller: CallerType): boolean {
        // 基于层级和调用者的默认策略
        switch (tool.layer) {
            case 'specialist':
                // 专家工具：只有 orchestrator 的 TOOL_EXECUTION 模式可以访问
                return caller === CallerType.ORCHESTRATOR_TOOL_EXECUTION;

            case 'document':
                // 文档工具：orchestrator TOOL_EXECUTION 和 specialist 可以访问
                return caller === CallerType.ORCHESTRATOR_TOOL_EXECUTION || 
                       caller === CallerType.SPECIALIST;

            case 'atomic':
                // 原子工具：orchestrator 所有模式都可以访问，specialist 通过 document 层访问
                return caller === CallerType.ORCHESTRATOR_TOOL_EXECUTION ||
                       caller === CallerType.ORCHESTRATOR_KNOWLEDGE_QA ||
                       caller === CallerType.SPECIALIST;

            case 'internal':
                // 内部工具：所有AI层都可以访问
                return caller === CallerType.ORCHESTRATOR_TOOL_EXECUTION ||
                       caller === CallerType.ORCHESTRATOR_KNOWLEDGE_QA ||
                       caller === CallerType.SPECIALIST;

            default:
                // 未分层的工具：向后兼容，TOOL_EXECUTION 可以访问
                this.logger.warn(`🤔 Tool ${tool.name} has no layer definition, applying conservative access policy`);
                return caller === CallerType.ORCHESTRATOR_TOOL_EXECUTION;
        }
    }

    /**
     * 获取访问控制统计信息
     */
    public getAccessStats(caller: CallerType): {
        totalTools: number;
        accessibleTools: number;
        deniedTools: number;
        byLayer: { [layer: string]: number };
    } {
        const allTools = getAllDefinitions();
        const accessibleTools = this.getAvailableTools(caller);
        
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
     */
    public generateAccessReport(caller: CallerType): string {
        const stats = this.getAccessStats(caller);
        const accessibleTools = this.getAvailableTools(caller);
        
        let report = `# Access Control Report for ${caller}\n\n`;
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