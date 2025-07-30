/**
 * 工具注册表 v2.0 - 分层架构聚合器
 * 
 * 架构升级：
 * ├── 🟡 原子层 (atomic/): 基于VSCode API的基础工具 (18个)
 * ├── 🟠 专家层 (specialist/): 专家工具 (专家规则)
 * ├── 🔴 文档层 (document/): 文档操作工具 (文档具体内容生成、编辑与导入)
 * └── 🟣 内部层 (internal/): 系统控制工具 (finalAnswer等)
 * 
 * 设计原则：
 * - 动态注册：支持插件式扩展
 * - 分层管理：清晰的职责边界
 * - 类型安全：完整的TypeScript支持
 * - 统计分析：工具使用情况监控
 */

// 导入各层级工具
import { 
    atomicToolDefinitions, 
    atomicToolImplementations,
    atomicToolsCategory 
} from './atomic';

// Specialist tools have been removed as they are deprecated

import { 
    requirementToolDefinitions, 
    requirementToolImplementations,
    requirementToolsCategory 
} from './document/requirementTools';

import { 
    documentGeneratorToolDefinitions, 
    documentGeneratorToolImplementations,
    documentGeneratorToolsCategory 
} from './document/documentGeneratorTools';

// 🚨 DEPRECATED: Document importer tools are deprecated and no longer used
// import { 
//     documentImporterToolDefinitions, 
//     documentImporterToolImplementations,
//     documentImporterToolsCategory 
// } from './document/documentImporterTools';

import { 
    systemToolDefinitions, 
    systemToolImplementations,
    systemToolsCategory 
} from './internal/systemTools';

import { 
    createNewProjectFolderToolDefinitions, 
    createNewProjectFolderToolImplementations,
    createNewProjectFolderToolCategory 
} from './internal/createNewProjectFolderTool';

import { 
    taskCompleteToolDefinitions, 
    taskCompleteToolImplementations,
    taskCompleteToolsCategory 
} from './internal/taskCompleteTools';

import { 
    recordThoughtToolDefinitions, 
    recordThoughtToolImplementations,
    recordThoughtToolsCategory 
} from './internal/recordThoughtTools';

// 🚀 Markdown文件读取工具
import { 
    readMarkdownFileToolDefinitions, 
    readMarkdownFileToolImplementations,
    readMarkdownFileToolsCategory 
} from './document/enhanced-readfile-tools';

import { 
    semanticEditEngineToolDefinitions, 
    semanticEditEngineToolImplementations,
    semanticEditEngineToolsCategory 
} from './document/semantic-edit-engine';

import { 
    requirementScaffoldToolDefinitions, 
    requirementScaffoldToolImplementations,
    requirementScaffoldToolsCategory 
} from './document/requirementScaffoldTools';

import {
    yamlEditorToolDefinitions,
    yamlEditorToolImplementations,
    yamlEditorToolsCategory
} from './document/yamlEditorTools';

import {
    traceabilityCompletionToolDefinitions,
    traceabilityCompletionToolImplementations,
    traceabilityCompletionToolsCategory
} from './document/traceabilityCompletionTools';

// 导入访问控制类型
import { CallerType } from '../types/index';

/**
 * 调用指南接口 - AI智能工具使用指导系统
 */
export interface CallingGuide {
    whenToUse: string;                              // 何时使用这个工具
    prerequisites?: string;                         // 前置条件
    inputRequirements?: {                           // 输入要求详解
        [param: string]: string;
    };
    internalWorkflow?: string[];                    // 内部工作流程步骤
    commonPitfalls?: string[];                      // 常见陷阱和错误
    performanceNotes?: string[];                    // 性能注意事项
    examples?: Array<{                              // 使用示例
        scenario: string;
        parameters: any;
        expectedResult: string;
    }>;
}

/**
 * 工具定义接口 - v3.0 智能分类增强版 + 分布式访问控制 + AI指导系统
 */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: any;
    layer?: 'atomic' | 'specialist' | 'document' | 'internal';
    category?: string;
    deprecated?: boolean;
    experimental?: boolean;
    // 🚀 新增：智能分类属性
    interactionType?: 'autonomous' | 'confirmation' | 'interactive';
    riskLevel?: 'low' | 'medium' | 'high';
    requiresConfirmation?: boolean;
    // 🚀 新增：分布式访问控制
    accessibleBy?: CallerType[];
    // 🚀 新增：AI智能指导系统
    callingGuide?: CallingGuide;
}

/**
 * 工具实现接口
 */
export interface ToolImplementation {
    [key: string]: (...args: any[]) => Promise<any>;
}

/**
 * 工具分类信息
 */
export interface ToolCategory {
    name: string;
    description: string;
    tools: string[];
    layer: string;
    count?: number;
}

/**
 * 工具注册表统计
 */
export interface ToolRegistryStats {
    totalTools: number;
    byLayer: {
        atomic: number;
        specialist: number;
        document: number;
        internal: number;
    };
    byCategory: { [category: string]: number };
    experimental: number;
    deprecated: number;
}

/**
 * 统一工具注册表 v2.0
 */
class ToolRegistry {
    private definitions: Map<string, ToolDefinition> = new Map();
    private implementations: Map<string, Function> = new Map();
    private categories: Map<string, ToolCategory> = new Map();
    private usage: Map<string, number> = new Map();
    
    // 🔧 新增：缓存失效监听器机制
    private cacheInvalidationListeners: Array<() => void> = [];

    constructor() {
        this.initialize();
    }

    /**
     * 初始化所有工具
     */
    private initialize(): void {
        // 注册原子层工具
        this.registerToolsFromCategory(
            atomicToolDefinitions,
            atomicToolImplementations,
            atomicToolsCategory,
            'atomic'
        );

        // Specialist tools have been removed as they are deprecated

        // 注册文档层工具 - 生成器
        this.registerToolsFromCategory(
            documentGeneratorToolDefinitions,
            documentGeneratorToolImplementations,
            documentGeneratorToolsCategory,
            'document'
        );

        // 注册文档层工具 - 导入器
        // this.registerToolsFromCategory(
        //     documentImporterToolDefinitions,
        //     documentImporterToolImplementations,
        //     documentImporterToolsCategory,
        //     'document'
        // );

        // 注册文档层工具 - 需求管理
        this.registerToolsFromCategory(
            requirementToolDefinitions,
            requirementToolImplementations,
            requirementToolsCategory,
            'document'
        );

        // 注册内部工具
        this.registerToolsFromCategory(
            systemToolDefinitions,
            systemToolImplementations,
            systemToolsCategory,
            'internal'
        );

        // 注册项目管理工具
        this.registerToolsFromCategory(
            createNewProjectFolderToolDefinitions,
            createNewProjectFolderToolImplementations,
            createNewProjectFolderToolCategory,
            'internal'
        );

        // 注册任务完成工具
        this.registerToolsFromCategory(
            taskCompleteToolDefinitions,
            taskCompleteToolImplementations,
            taskCompleteToolsCategory,
            'internal'
        );

        // 注册思考记录工具
        this.registerToolsFromCategory(
            recordThoughtToolDefinitions,
            recordThoughtToolImplementations,
            recordThoughtToolsCategory,
            'internal'
        );

        // 🚀 Phase 1新增：注册Markdown文件读取工具
        this.registerToolsFromCategory(
            readMarkdownFileToolDefinitions,
            readMarkdownFileToolImplementations,
            readMarkdownFileToolsCategory,
            'document'
        );

        this.registerToolsFromCategory(
            semanticEditEngineToolDefinitions,
            semanticEditEngineToolImplementations,
            semanticEditEngineToolsCategory,
            'document'
        );

        // 🚀 新增：注册需求脚手架生成工具
        this.registerToolsFromCategory(
            requirementScaffoldToolDefinitions,
            requirementScaffoldToolImplementations,
            requirementScaffoldToolsCategory,
            'document'
        );

        this.registerToolsFromCategory(
            yamlEditorToolDefinitions,
            yamlEditorToolImplementations,
            yamlEditorToolsCategory,
            'document'
        );

        // 🚀 新增：注册追溯性同步工具
        this.registerToolsFromCategory(
            traceabilityCompletionToolDefinitions,
            traceabilityCompletionToolImplementations,
            traceabilityCompletionToolsCategory,
            'document'
        );

        console.log(`[ToolRegistry] Initialized with ${this.definitions.size} tools across ${this.categories.size} categories`);
    }

    /**
     * 从分类注册工具
     */
    private registerToolsFromCategory(
        definitions: any[],
        implementations: any,
        category: ToolCategory,
        layer: string
    ): void {
        // 注册分类
        this.categories.set(category.name, {
            ...category,
            layer,
            count: definitions.length
        });

        // 注册每个工具
        definitions.forEach(def => {
            const toolDef: ToolDefinition = {
                ...def,
                layer: layer as any,
                category: category.name
            };

            this.definitions.set(def.name, toolDef);
            
            if (implementations[def.name]) {
                this.implementations.set(def.name, implementations[def.name]);
            }

            // 初始化使用计数
            this.usage.set(def.name, 0);
        });
    }

    /**
     * 获取所有工具定义
     */
    public getAllDefinitions(): ToolDefinition[] {
        return Array.from(this.definitions.values());
    }

    /**
     * 获取特定层级的工具
     */
    public getToolsByLayer(layer: 'atomic' | 'specialist' | 'document' | 'internal'): ToolDefinition[] {
        return this.getAllDefinitions().filter(tool => tool.layer === layer);
    }

    /**
     * 获取特定分类的工具
     */
    public getToolsByCategory(categoryName: string): ToolDefinition[] {
        return this.getAllDefinitions().filter(tool => tool.category === categoryName);
    }

    /**
     * 获取工具实现
     */
    public getImplementation(toolName: string): Function | undefined {
        return this.implementations.get(toolName);
    }

    /**
     * 执行工具
     */
    public async executeTool(toolName: string, params: any): Promise<any> {
        const implementation = this.implementations.get(toolName);
        if (!implementation) {
            throw new Error(`Tool implementation not found: ${toolName}`);
        }

        // 记录使用
        this.usage.set(toolName, (this.usage.get(toolName) || 0) + 1);

        try {
            const result = await implementation(params);
            console.log(`[ToolRegistry] Tool '${toolName}' executed successfully`);
            return result;
        } catch (error) {
            console.error(`[ToolRegistry] Tool '${toolName}' execution failed:`, (error as Error).message || error);
            throw error;
        }
    }

    /**
     * 检查工具是否存在
     */
    public hasTool(toolName: string): boolean {
        return this.definitions.has(toolName);
    }

    /**
     * 获取工具定义
     */
    public getToolDefinition(toolName: string): ToolDefinition | undefined {
        return this.definitions.get(toolName);
    }

    /**
     * 获取所有分类
     */
    public getAllCategories(): ToolCategory[] {
        return Array.from(this.categories.values());
    }

    /**
     * 获取注册表统计
     */
    public getStats(): ToolRegistryStats {
        const tools = this.getAllDefinitions();
        
        const byLayer = {
            atomic: tools.filter(t => t.layer === 'atomic').length,
            specialist: tools.filter(t => t.layer === 'specialist').length,
            document: tools.filter(t => t.layer === 'document').length,
            internal: tools.filter(t => t.layer === 'internal').length
        };

        const byCategory: { [category: string]: number } = {};
        this.categories.forEach((category, name) => {
            byCategory[name] = category.count || 0;
        });

        return {
            totalTools: tools.length,
            byLayer,
            byCategory,
            experimental: tools.filter(t => t.experimental).length,
            deprecated: tools.filter(t => t.deprecated).length
        };
    }

    /**
     * 获取使用统计
     */
    public getUsageStats(): { [toolName: string]: number } {
        return Object.fromEntries(this.usage);
    }

    /**
     * 生成工具清单文本（用于AI Prompt）
     */
    public generateToolInventoryText(): string {
        const categories = this.getAllCategories();
        let inventory = '# Available Tools\n\n';

        categories.forEach(category => {
            inventory += `## ${category.name} (${category.layer} layer)\n`;
            inventory += `${category.description}\n\n`;
            
            const tools = this.getToolsByCategory(category.name);
            tools.forEach(tool => {
                inventory += `### ${tool.name}\n`;
                inventory += `${tool.description}\n\n`;
            });
        });

        return inventory;
    }

    /**
     * 生成精简的工具列表（用于快速参考）
     */
    public generateCompactToolList(): string {
        const stats = this.getStats();
        let list = `# Tools Summary (${stats.totalTools} total)\n\n`;

        Object.entries(stats.byLayer).forEach(([layer, count]) => {
            if (count > 0) {
                list += `**${layer.toUpperCase()}** (${count}): `;
                const tools = this.getToolsByLayer(layer as any);
                list += tools.map(t => t.name).join(', ') + '\n\n';
            }
        });

        return list;
    }

    // ============================================================================
    // 🔧 缓存失效监听器机制 - 解决Orchestrator工具缓存问题
    // ============================================================================

    /**
     * 注册缓存失效监听器
     */
    public onCacheInvalidation(listener: () => void): void {
        this.cacheInvalidationListeners.push(listener);
        console.log(`[ToolRegistry] Cache invalidation listener registered. Total listeners: ${this.cacheInvalidationListeners.length}`);
    }

    /**
     * 移除缓存失效监听器
     */
    public offCacheInvalidation(listener: () => void): void {
        const index = this.cacheInvalidationListeners.indexOf(listener);
        if (index > -1) {
            this.cacheInvalidationListeners.splice(index, 1);
            console.log(`[ToolRegistry] Cache invalidation listener removed. Total listeners: ${this.cacheInvalidationListeners.length}`);
        }
    }

    /**
     * 通知所有监听器缓存需要失效
     */
    private notifyCacheInvalidation(): void {
        if (this.cacheInvalidationListeners.length > 0) {
            console.log(`[ToolRegistry] Notifying ${this.cacheInvalidationListeners.length} cache invalidation listeners`);
            this.cacheInvalidationListeners.forEach(listener => {
                try {
                    listener();
                        } catch (error) {
            console.error('[ToolRegistry] Error in cache invalidation listener:', (error as Error).message || error);
                }
            });
        }
    }

    /**
     * 🔧 动态注册新工具（触发缓存失效）
     */
    public registerTool(definition: ToolDefinition, implementation?: Function): void {
        this.definitions.set(definition.name, definition);
        
        if (implementation) {
            this.implementations.set(definition.name, implementation);
        }
        
        this.usage.set(definition.name, 0);
        
        console.log(`[ToolRegistry] Tool '${definition.name}' registered dynamically`);
        
        // 🚀 关键：触发缓存失效通知
        this.notifyCacheInvalidation();
    }

    /**
     * 🔧 移除工具（触发缓存失效）
     */
    public unregisterTool(toolName: string): boolean {
        const removed = this.definitions.delete(toolName);
        this.implementations.delete(toolName);
        this.usage.delete(toolName);
        
        if (removed) {
            console.log(`[ToolRegistry] Tool '${toolName}' unregistered`);
            
            // 🚀 关键：触发缓存失效通知
            this.notifyCacheInvalidation();
        }
        
        return removed;
    }

    /**
     * 🔧 更新工具定义（触发缓存失效）
     */
    public updateToolDefinition(toolName: string, updates: Partial<ToolDefinition>): boolean {
        const existing = this.definitions.get(toolName);
        if (!existing) {
            return false;
        }
        
        const updated = { ...existing, ...updates };
        this.definitions.set(toolName, updated);
        
        console.log(`[ToolRegistry] Tool '${toolName}' definition updated`);
        
        // 🚀 关键：触发缓存失效通知
        this.notifyCacheInvalidation();
        
        return true;
    }
}

// 全局工具注册表实例
export const toolRegistry = new ToolRegistry();

// 便捷导出 - 修复 this 上下文绑定
export const getAllDefinitions = () => toolRegistry.getAllDefinitions();
export const getToolsByLayer = (layer: any) => toolRegistry.getToolsByLayer(layer);
export const getToolsByCategory = (categoryName: string) => toolRegistry.getToolsByCategory(categoryName);
export const getImplementation = (toolName: string) => toolRegistry.getImplementation(toolName);
export const executeTool = (toolName: string, params: any) => toolRegistry.executeTool(toolName, params);
export const hasTool = (toolName: string) => toolRegistry.hasTool(toolName);
export const getToolDefinition = (toolName: string) => toolRegistry.getToolDefinition(toolName);
export const getAllCategories = () => toolRegistry.getAllCategories();
export const getStats = () => toolRegistry.getStats();
export const getUsageStats = () => toolRegistry.getUsageStats();
export const generateToolInventoryText = () => toolRegistry.generateToolInventoryText();
export const generateCompactToolList = () => toolRegistry.generateCompactToolList();

// 向后兼容的导出
export {
    atomicToolDefinitions,
    atomicToolImplementations,
    // Specialist tools removed,
    requirementToolDefinitions,
    requirementToolImplementations,
    documentGeneratorToolDefinitions,
    documentGeneratorToolImplementations,
    // documentImporterToolDefinitions, // DEPRECATED
    // documentImporterToolImplementations, // DEPRECATED
    systemToolDefinitions,
    systemToolImplementations,
    createNewProjectFolderToolDefinitions,
    createNewProjectFolderToolImplementations
}; 