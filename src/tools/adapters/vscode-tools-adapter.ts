/**
 * VSCode Tools Adapter
 *
 * 将 VSCode 的 vscode.lm.tools（包括 MCP 工具）集成到我们的 ToolRegistry 中
 *
 * 核心功能：
 * - 从 vscode.lm.tools 发现所有可用工具
 * - 提取工具的 inputSchema 作为参数定义
 * - 包装 vscode.lm.invokeTool() 为工具实现
 * - 统一注册到 ToolRegistry
 *
 * 工具区分：
 * - 通过 `vscode_` 前缀区分来源
 * - 内部工具: 无前缀（readTextFile, writeFile 等）
 * - VSCode/MCP 工具: vscode_ 前缀（vscode_deepwiki_search 等）
 */

import * as vscode from 'vscode';
import { toolRegistry, ToolDefinition } from '../../tools';
import { CallerType } from '../../types';
import { Logger } from '../../utils/logger';

export class VSCodeToolsAdapter {
    private logger = Logger.getInstance();
    private registeredTools: Set<string> = new Set();

    /**
     * 从 VSCode 发现并注册所有可用工具
     * （包括 VSCode 内置工具、扩展工具、MCP 工具）
     */
    async registerVSCodeTools(): Promise<void> {
        try {
            // 检查 API 可用性
            if (!vscode.lm || !vscode.lm.tools) {
                this.logger.warn('[VSCodeTools] vscode.lm.tools API not available (VSCode < v1.99)');
                this.logger.warn('[VSCodeTools] MCP tools will not be available');
                return;
            }

            this.logger.info('[VSCodeTools] Discovering tools from vscode.lm.tools...');

            // 获取所有可用工具（VSCode 自动管理）
            const vscodeTools = vscode.lm.tools;

            if (!vscodeTools || vscodeTools.length === 0) {
                this.logger.info('[VSCodeTools] No VSCode/MCP tools found');
                return;
            }

            this.logger.info(`[VSCodeTools] Found ${vscodeTools.length} tool(s) from vscode.lm.tools`);

            let successCount = 0;
            let failCount = 0;
            let skippedCount = 0;
            let excludedCount = 0;

            for (const toolInfo of vscodeTools) {
                try {
                    // registerSingleTool 会过滤掉非 MCP 工具和黑名单工具
                    const beforeCount = this.registeredTools.size;

                    // 检查是否是 MCP 工具
                    const safeName = toolInfo.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                    const isMCPTool = safeName.includes('_mcp_') || safeName.startsWith('mcp_');
                    const toolName = safeName.startsWith('vscode_') ? safeName : `vscode_${safeName}`;
                    const isExcluded = isMCPTool && !this.shouldRegisterTool(toolName);

                    await this.registerSingleTool(toolInfo);
                    const afterCount = this.registeredTools.size;

                    if (afterCount > beforeCount) {
                        successCount++;
                    } else if (isExcluded) {
                        excludedCount++;
                    } else {
                        skippedCount++;
                    }
                } catch (error) {
                    failCount++;
                    this.logger.warn(
                        `[VSCodeTools] Failed to register tool "${toolInfo.name}": ${(error as Error).message}`
                    );
                    // 继续注册其他工具，不中断
                }
            }

            const summaryParts = [
                `${successCount} MCP tools registered`,
                `${skippedCount} non-MCP tools skipped`
            ];
            if (excludedCount > 0) {
                summaryParts.push(`${excludedCount} MCP tools excluded by keywords`);
            }
            if (failCount > 0) {
                summaryParts.push(`${failCount} failed`);
            }

            this.logger.info(
                `[VSCodeTools] Registration complete: ${summaryParts.join(', ')}`
            );

            // 如果全部失败，显示警告
            if (successCount === 0 && failCount > 0) {
                vscode.window.showWarningMessage(
                    'Failed to register VSCode/MCP tools. Check Output for details.',
                    'View Logs'
                ).then(selection => {
                    if (selection === 'View Logs') {
                        this.logger.show();
                    }
                });
            }

        } catch (error) {
            this.logger.error(
                `[VSCodeTools] Critical error during registration: ${(error as Error).message}`
            );
            // 不抛出异常，允许扩展继续运行
        }
    }

    /**
     * 注册单个 VSCode 工具
     */
    private async registerSingleTool(toolInfo: vscode.LanguageModelToolInformation): Promise<void> {
        // 验证工具名称有效性
        if (!toolInfo.name || typeof toolInfo.name !== 'string') {
            throw new Error('Invalid tool: name is required and must be a string');
        }

        // 首先 sanitize 工具名（处理特殊字符）
        const safeName = toolInfo.name.replace(/[^a-zA-Z0-9_-]/g, '_');

        // 🔑 关键过滤：只注册 MCP 工具（支持多种命名格式）
        // 原因：VSCode/Copilot 工具已通过原生机制可用，不需要重复注册
        // 这样可以避免注册 98 个工具，只注册真正的 MCP 工具（~7个）
        //
        // 支持的 MCP 工具命名格式：
        // - mcp_<server>_<tool> (例如: mcp_tavily_search)
        // - vscode.mcp.<server>.<tool> (sanitized后变成: vscode_mcp_<server>_<tool>)
        // - <namespace>.mcp.<tool> (sanitized后包含: _mcp_)
        const isMCPTool = safeName.includes('_mcp_') || safeName.startsWith('mcp_');
        if (!isMCPTool) {
            this.logger.debug(`[VSCodeTools] Skipping non-MCP tool: ${toolInfo.name} (sanitized: ${safeName})`);
            return;
        }

        // 生成工具名（添加 vscode_ 前缀，避免重复前缀）
        const toolName = safeName.startsWith('vscode_') ? safeName : `vscode_${safeName}`;

        // 🔑 关键字黑名单过滤
        if (!this.shouldRegisterTool(toolName)) {
            this.logger.debug(`[VSCodeTools] Tool excluded by blacklist: ${toolName}`);
            return;
        }

        // 避免重复注册
        if (this.registeredTools.has(toolName)) {
            this.logger.debug(`[VSCodeTools] Tool already registered, skipping: ${toolName}`);
            return;
        }

        // 构建工具定义（保留我们的高级特性）
        const toolDefinition: ToolDefinition = {
            name: toolName,
            description: (toolInfo.description && toolInfo.description.trim())
                ? toolInfo.description
                : `VSCode/MCP tool: ${toolInfo.name}`,

            // 🔑 关键：使用 VSCode 提供的 inputSchema
            parameters: toolInfo.inputSchema || {
                type: 'object',
                properties: {},
                required: []
            },

            // 保留我们的分层架构
            layer: 'atomic',
            category: 'vscode',

            // 保留权限控制（根据 tags 推断）
            accessibleBy: this.inferAccessControl(toolInfo.tags),
            riskLevel: this.inferRiskLevel(toolInfo.tags),
            requiresConfirmation: false,
            interactionType: 'autonomous',

            // 保留 AI 调用指南
            callingGuide: {
                whenToUse: (toolInfo.description && toolInfo.description.trim())
                    ? `Use this VSCode/MCP tool: ${toolInfo.description}`
                    : `Use this VSCode/MCP tool: ${toolInfo.name}`,
                prerequisites: 'VSCode must have the corresponding extension/MCP server installed and configured',
                performanceNotes: [
                    'Tool execution depends on VSCode and external services availability'
                ]
            }
        };

        // 构建工具实现（包装 vscode.lm.invokeTool）
        const toolImplementation = async (args: Record<string, any>): Promise<any> => {
            const tokenSource = new vscode.CancellationTokenSource();

            try {
                this.logger.debug(`[VSCodeTools] Invoking VSCode tool: ${toolInfo.name}`);

                // 调用 VSCode API
                // 注意：对于 MCP 工具，我们不设置超时，信任 VSCode 自己的超时机制
                // 原因：MCP 工具需要用户确认，可能需要较长时间
                const result = await vscode.lm.invokeTool(
                    toolInfo.name,  // 原始名称（不带前缀）
                    {
                        input: args,
                        toolInvocationToken: undefined  // toolInvocationToken is optional
                    },
                    tokenSource.token
                );

                // 读取工具结果 - LanguageModelToolResult.content 是数组
                let output = '';
                for (const part of result.content) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        output += part.value;
                    }
                }

                // 检查是否有内容（边界情况处理）
                if (!output && result.content.length === 0) {
                    this.logger.warn(`[VSCodeTools] Tool "${toolInfo.name}" returned empty result`);
                }

                this.logger.debug(`[VSCodeTools] Tool executed successfully: ${toolInfo.name}`);

                return {
                    success: true,
                    content: output
                };
            } catch (error) {
                const errorMessage = (error as Error).message;
                this.logger.error(
                    `[VSCodeTools] Tool invocation failed: ${toolInfo.name}: ${errorMessage}`
                );

                // 🔑 关键：返回结构化错误，不抛异常
                // 区分错误类型并提供友好消息

                // MCP 服务器连接问题
                if (errorMessage.includes('not running') ||
                    errorMessage.includes('Connection refused') ||
                    errorMessage.includes('ECONNREFUSED')) {
                    return {
                        success: false,
                        error: `MCP server not available: ${toolInfo.name}`,
                        userMessage: `The MCP server for "${toolInfo.name}" is not running. Please check your MCP configuration in VSCode settings.`,
                        recoverable: true,
                        suggestion: `To fix this:\n1. Open VSCode Settings (Cmd+,)\n2. Search for "MCP"\n3. Check if the server is configured correctly\n4. Restart VSCode if needed`
                    };
                }

                // 参数验证失败
                if (errorMessage.includes('Invalid input') ||
                    errorMessage.includes('validation failed')) {
                    // 安全地序列化 schema（防止 JSON.stringify 错误）
                    let schemaString: string;
                    try {
                        schemaString = JSON.stringify(toolInfo.inputSchema, null, 2);
                    } catch {
                        schemaString = '[Unable to serialize schema]';
                    }

                    return {
                        success: false,
                        error: `Invalid parameters for tool: ${toolInfo.name}`,
                        userMessage: `The tool "${toolInfo.name}" received invalid parameters.`,
                        recoverable: true,
                        suggestion: `Please check the tool's input schema:\n${schemaString}`
                    };
                }

                // 其他错误
                return {
                    success: false,
                    error: errorMessage,
                    userMessage: `Tool execution failed: ${errorMessage}`,
                    recoverable: false
                };
            } finally {
                // 🔑 确保资源始终被清理（防止内存泄漏）
                tokenSource.dispose();
            }
        };

        // 🔑 关键：注册到 ToolRegistry（触发缓存失效）
        toolRegistry.registerTool(toolDefinition, toolImplementation);

        this.registeredTools.add(toolName);

        this.logger.debug(`[VSCodeTools] Registered: ${toolName}`);
    }

    /**
     * 根据 tags 推断访问控制权限
     */
    private inferAccessControl(tags: readonly string[]): CallerType[] {
        // 默认允许所有 AI 访问
        // 未来可以根据 tags 做更细粒度的控制
        return [
            CallerType.ORCHESTRATOR_TOOL_EXECUTION,
            CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
            CallerType.SPECIALIST_CONTENT,
            CallerType.SPECIALIST_PROCESS
        ];
    }

    /**
     * 根据 tags 推断风险等级
     */
    private inferRiskLevel(tags: readonly string[]): 'low' | 'medium' | 'high' {
        const lowRiskKeywords = ['search', 'query', 'read', 'list', 'get'];
        const highRiskKeywords = ['delete', 'remove', 'destroy', 'write', 'create', 'update'];

        for (const tag of tags) {
            const tagLower = tag.toLowerCase();
            if (highRiskKeywords.some(keyword => tagLower.includes(keyword))) {
                return 'high';
            }
        }

        for (const tag of tags) {
            const tagLower = tag.toLowerCase();
            if (lowRiskKeywords.some(keyword => tagLower.includes(keyword))) {
                return 'low';
            }
        }

        return 'medium';
    }

    /**
     * 检查工具是否应该被注册（基于关键字黑名单）
     */
    private shouldRegisterTool(toolName: string): boolean {
        const config = vscode.workspace.getConfiguration('srs-writer.mcp');
        const excludeKeywords = config.get<string[]>('excludeKeywords', []);

        // 如果没有配置关键字，默认注册所有工具
        if (!excludeKeywords || excludeKeywords.length === 0) {
            return true;
        }

        // 检查工具名是否包含任何黑名单关键字（不区分大小写）
        const toolNameLower = toolName.toLowerCase();
        for (const keyword of excludeKeywords) {
            if (!keyword || keyword.trim() === '') {
                continue;
            }

            const keywordLower = keyword.trim().toLowerCase();
            if (toolNameLower.includes(keywordLower)) {
                this.logger.info(`[VSCodeTools] Tool excluded by keyword "${keyword}": ${toolName}`);
                return false;
            }
        }

        return true;
    }

    /**
     * 清理已注册的工具
     */
    dispose(): void {
        this.logger.info(`[VSCodeTools] Disposing ${this.registeredTools.size} registered tools...`);

        for (const toolName of this.registeredTools) {
            toolRegistry.unregisterTool(toolName);
        }

        this.registeredTools.clear();

        this.logger.info('[VSCodeTools] All VSCode tools unregistered');
    }

    /**
     * 获取已注册的工具数量
     */
    getRegisteredToolCount(): number {
        return this.registeredTools.size;
    }

    /**
     * 获取已注册的工具列表
     */
    getRegisteredToolNames(): string[] {
        return Array.from(this.registeredTools);
    }
}
