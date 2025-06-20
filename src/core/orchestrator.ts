import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { SessionContext } from '../types/session';
import { toolExecutor, getAvailableTools } from './toolExecutor';
import { generateToolInventoryText } from '../tools/index';
import { InputAnalyzer, InputAnalysisResult } from '../utils/inputAnalyzer';

/**
 * Orchestrator v2.0 - AI智能工具代理模式
 * 
 * 核心设计理念：
 * 🤖 AI助手模式：AI不再是数据同步的辅助工具，而是用户的智能助手
 * 🛠️ 工具代理模式：AI通过工具代理实现各种复杂操作
 * 🎯 意图理解：AI理解用户意图，自动规划和执行工具调用
 * 🔄 动态适应：根据执行结果动态调整后续步骤
 */

export class Orchestrator {
    private logger = Logger.getInstance();
    private useAIOrchestrator: boolean = true;
    
    constructor() {
        this.loadConfiguration();
        this.logger.info('🎯 Orchestrator v2.0 initialized - AI智能工具代理模式');
    }

    /**
     * 处理用户输入 - v2.1版本（支持对话式规划循环的智能工具代理模式）
     */
    public async processUserInput(
        userInput: string, 
        sessionContext: SessionContext,
        selectedModel: vscode.LanguageModelChat
    ): Promise<{ intent: string; result?: any }> {
        try {
            this.logger.info(`🚀 Processing with Chain-of-Thought Tool Agent Mode: ${selectedModel.name}`);
            
            // 检查安全权限
            if (!await this.checkModelPermissions(selectedModel)) {
                throw new Error('No permission to use selected language model');
            }

            // 🚀 对话式规划循环：支持自我修正和动态调整
            return await this.executeConversationalPlanning(userInput, sessionContext, selectedModel);

        } catch (error) {
            this.logger.error('Chain-of-Thought tool agent processing failed', error as Error);
            
            // 降级到简单响应
            return { 
                intent: 'error', 
                result: `处理失败: ${(error as Error).message}` 
            };
        }
    }

    /**
     * 🚀 对话式规划循环执行器：实现思维链、自我修正和智能上下文管理
     */
    private async executeConversationalPlanning(
        userInput: string,
        sessionContext: SessionContext,
        selectedModel: vscode.LanguageModelChat
    ): Promise<{ intent: string; result?: any }> {
        const conversationHistory: Array<{
            role: 'user' | 'ai' | 'system';
            content: string;
            toolResults?: any[];
            tokens?: number;
        }> = [];
        
        const allExecutionResults: any[] = [];
        let totalToolsExecuted = 0;
        const maxIterations = 8; // 增加到8轮，支持更复杂的任务
        let currentIteration = 0;
        
        // 🚀 动态上下文管理配置
        const contextConfig = await this.getContextWindowConfig(selectedModel);
        
        // 初始用户输入
        conversationHistory.push({
            role: 'user',
            content: userInput,
            tokens: this.estimateTokens(userInput)
        });
        
        while (currentIteration < maxIterations) {
            currentIteration++;
            this.logger.info(`🔄 Chain-of-Thought Iteration ${currentIteration}/${maxIterations}`);
            
            // 🚀 智能上下文管理：检查是否需要压缩对话历史
            await this.manageConversationContext(conversationHistory, contextConfig, selectedModel);
            
            // 生成当前阶段的工具调用计划
            const toolPlan = await this.generateAdaptiveToolPlan(
                userInput, 
                sessionContext, 
                selectedModel, 
                conversationHistory
            );
            
            if (!toolPlan || toolPlan.length === 0) {
                this.logger.info('🎯 AI indicates task completion or no further tools needed');
                break;
            }
            
            // 🚀 检查是否有 finalAnswer 工具调用
            const finalAnswerCall = toolPlan.find(tool => tool.name === 'finalAnswer');
            if (finalAnswerCall) {
                this.logger.info('🎯 AI called finalAnswer tool - task completion detected');
                const finalResult = await toolExecutor.executeTool('finalAnswer', finalAnswerCall.args);
                
                return {
                    intent: 'task_completed',
                    result: {
                        mode: 'chain_of_thought_agent_completed',
                        summary: finalResult.result?.summary || '任务已完成',
                        finalResult: finalResult.result?.result || '',
                        achievements: finalResult.result?.achievements || [],
                        nextSteps: finalResult.result?.nextSteps,
                        iterations: currentIteration,
                        totalToolsExecuted,
                        conversationHistory: conversationHistory.length,
                        allResults: allExecutionResults
                    }
                };
            }
            
            // 执行当前阶段的工具调用
            this.logger.info(`🔧 Executing ${toolPlan.length} tools in iteration ${currentIteration}`);
            const iterationResults = await this.executeToolCalls(toolPlan);
            
            allExecutionResults.push(...iterationResults);
            totalToolsExecuted += toolPlan.length;
            
            // 将执行结果添加到对话历史中
            const resultsContent = this.formatToolResults(iterationResults);
            conversationHistory.push({
                role: 'system',
                content: resultsContent,
                toolResults: iterationResults,
                tokens: this.estimateTokens(resultsContent)
            });
            
            // 检查是否有失败的工具调用需要自我修正
            const failedTools = iterationResults.filter(r => !r.success);
            if (failedTools.length > 0) {
                this.logger.warn(`⚠️ ${failedTools.length} tools failed, will attempt self-correction in next iteration`);
            }
            
            // 检查是否达到了用户的完整意图（基于成功率和复杂度）
            const successRate = iterationResults.filter(r => r.success).length / iterationResults.length;
            if (successRate === 1.0 && this.isSimpleTask(userInput)) {
                this.logger.info('✅ Simple task completed successfully, ending conversation');
                break;
            }
        }
        
        // 如果达到最大迭代次数，生成最终总结
        const successfulResults = allExecutionResults.filter(r => r.success);
        const failedResults = allExecutionResults.filter(r => !r.success);
        
        const resultSummary = this.summarizeConversationalResults(
            allExecutionResults, 
            currentIteration,
            conversationHistory
        );
        
        return {
            intent: 'conversational_tool_execution',
            result: {
                mode: 'chain_of_thought_agent',
                summary: resultSummary,
                iterations: currentIteration,
                totalToolsExecuted,
                successful: successfulResults.length,
                failed: failedResults.length,
                conversationHistory: conversationHistory.length,
                details: allExecutionResults,
                reachedMaxIterations: currentIteration >= maxIterations
            }
        };
    }

    /**
     * 🚀 生成自适应工具调用计划（支持对话历史 + 错误学习）
     */
    private async generateAdaptiveToolPlan(
        userInput: string,
        sessionContext: SessionContext,
        selectedModel: vscode.LanguageModelChat,
        conversationHistory: Array<{ role: string; content: string; toolResults?: any[] }>
    ): Promise<Array<{ name: string; args: any }>> {
        try {
            const adaptivePrompt = await this.buildAdaptiveToolPlanningPrompt(
                userInput, 
                sessionContext, 
                conversationHistory
            );
            
            // 估算提示词的token数量用于错误学习
            const estimatedTokens = this.estimateTokens(adaptivePrompt);
            
            const messages = [
                vscode.LanguageModelChatMessage.User(adaptivePrompt)
            ];

            const requestOptions: vscode.LanguageModelChatRequestOptions = {
                justification: 'Generate adaptive tool execution plan with conversation history'
            };

            const response = await selectedModel.sendRequest(messages, requestOptions);
            
            let result = '';
            for await (const fragment of response.text) {
                result += fragment;
            }

            return this.parseToolPlanFromResponse(result);
            
        } catch (error) {
            const errorObj = error as Error;
            this.logger.error('Failed to generate adaptive tool plan', errorObj);
            
            // 🚀 错误反馈学习：如果是上下文错误，更新模型配置
            const adaptivePrompt = await this.buildAdaptiveToolPlanningPrompt(
                userInput, 
                sessionContext, 
                conversationHistory
            );
            const estimatedTokens = this.estimateTokens(adaptivePrompt);
            await this.handleContextError(errorObj, selectedModel, estimatedTokens);
            
            return [];
        }
    }

    /**
     * 🚀 构建自适应工具规划提示词（包含对话历史）
     */
    private async buildAdaptiveToolPlanningPrompt(
        userInput: string,
        sessionContext: SessionContext,
        conversationHistory: Array<{ role: string; content: string; toolResults?: any[] }>
    ): Promise<string> {
        const availableTools = getAvailableTools();
        const toolsJson = JSON.stringify(availableTools, null, 2);
        
        const hasActiveProject = !!sessionContext.projectName;
        const projectName = sessionContext.projectName || 'none';
        
        // RAG知识检索
        const relevantKnowledge = await this.retrieveRelevantKnowledge(userInput, sessionContext);
        
        // 构建对话历史摘要
        const historyContext = this.buildHistoryContext(conversationHistory);
        
        return `# Role
You are an AI Assistant specialized in Software Requirements Specification (SRS) management.
You have access to a set of tools and can engage in multi-turn conversations to accomplish complex tasks.

# Original User Request
"${userInput}"

# Current Context
- Has active project: ${hasActiveProject}
- Project name: ${projectName}
- Available artifacts: ${JSON.stringify(sessionContext.activeFiles || [])}
${relevantKnowledge ? `\n# Relevant Knowledge & Best Practices\n${relevantKnowledge}\n` : ''}
${historyContext ? `\n# Previous Actions & Results\n${historyContext}\n` : ''}
# Available Tools
${toolsJson}

# Task
Based on the original user request and the conversation history above, determine what tools to execute next.

**Chain-of-Thought Analysis:**
1. What has been accomplished so far?
2. What still needs to be done to fulfill the original user request?
3. Do any previous tool failures need correction?
4. What is the next logical step?

# Output Format
Respond with a JSON object:
{
    "thought": "Your reasoning about what to do next based on the conversation history",
    "tool_calls": [
        {
            "name": "toolName",
            "args": { /* arguments */ }
        }
    ]
}

**Important Instructions:**
- When you have COMPLETELY finished the user's task, call the finalAnswer tool with a comprehensive summary
- If you need to retry a failed tool with different parameters, explain your correction strategy  
- Focus on making progress toward the original user goal
- Consider dependencies between tools and execute them in logical sequence
- The finalAnswer tool is the ONLY way to properly signal task completion

**Task Completion Example:**
{
    "thought": "I have successfully completed all aspects of the user's request...",
    "tool_calls": [
        {
            "name": "finalAnswer",
            "args": {
                "summary": "Complete summary of what was accomplished",
                "result": "Final outcome and status",
                "achievements": ["Specific achievement 1", "Specific achievement 2"],
                "nextSteps": "Optional suggestions for what to do next"
            }
        }
    ]
}

Generate your response now:`;
    }

    /**
     * 构建对话历史上下文摘要
     */
    private buildHistoryContext(conversationHistory: Array<{ role: string; content: string; toolResults?: any[] }>): string {
        const historyItems: string[] = [];
        
        conversationHistory.forEach((item, index) => {
            if (item.role === 'system' && item.toolResults) {
                const successCount = item.toolResults.filter(r => r.success).length;
                const totalCount = item.toolResults.length;
                const toolNames = item.toolResults.map(r => r.toolName).join(', ');
                
                historyItems.push(`**Step ${Math.floor(index/2) + 1}**: Executed tools [${toolNames}] - ${successCount}/${totalCount} successful`);
                
                // 添加失败工具的详细信息
                const failures = item.toolResults.filter(r => !r.success);
                if (failures.length > 0) {
                    failures.forEach(failure => {
                        historyItems.push(`  ❌ ${failure.toolName} failed: ${failure.error || 'Unknown error'}`);
                    });
                }
            }
        });
        
        return historyItems.join('\n');
    }

    /**
     * 判断是否为简单任务
     */
    private isSimpleTask(userInput: string): boolean {
        const simpleKeywords = ['列出', '显示', '查看', '获取', '状态'];
        return simpleKeywords.some(keyword => userInput.includes(keyword));
    }

    /**
     * 汇总对话式执行结果
     */
    private summarizeConversationalResults(
        results: any[], 
        iterations: number, 
        conversationHistory: any[]
    ): string {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        let summary = `✅ 通过 ${iterations} 轮对话完成任务：`;
        summary += `\n  - 成功执行：${successful.length} 个工具`;
        
        if (failed.length > 0) {
            summary += `\n  - 执行失败：${failed.length} 个工具`;
        }
        
        summary += `\n  - 对话轮次：${iterations}`;
        
        return summary;
    }

    /**
     * 🚀 生成工具调用计划（向后兼容方法）
     */
    private async generateToolPlan(
        userInput: string,
        sessionContext: SessionContext,
        selectedModel: vscode.LanguageModelChat
    ): Promise<Array<{ name: string; args: any }>> {
        // 使用新的自适应工具规划方法，但不包含对话历史
        return await this.generateAdaptiveToolPlan(userInput, sessionContext, selectedModel, []);
    }

    /**
     * 🚀 构建工具规划提示词（增强版：支持RAG知识检索和思维链）
     */
    private async buildToolPlanningPrompt(userInput: string, sessionContext: SessionContext): Promise<string> {
        const availableTools = getAvailableTools();
        const toolsJson = JSON.stringify(availableTools, null, 2);
        
        const hasActiveProject = !!sessionContext.projectName;
        const projectName = sessionContext.projectName || 'none';
        
        // 🚀 RAG增强：基于用户输入进行知识检索
        const relevantKnowledge = await this.retrieveRelevantKnowledge(userInput, sessionContext);

        return `# Role
You are an AI Assistant specialized in Software Requirements Specification (SRS) management.
You have access to a set of tools to help users manage their SRS projects.

# Context
- User input: "${userInput}"
- Has active project: ${hasActiveProject}
- Project name: ${projectName}
- Available artifacts: ${JSON.stringify(sessionContext.activeFiles || [])}
${relevantKnowledge ? `\n# Relevant Knowledge & Best Practices\n${relevantKnowledge}\n` : ''}
# Available Tools
${toolsJson}

# Task
Analyze the user's request and create a detailed execution plan using the available tools.

**Think step by step (Chain-of-Thought reasoning):**
1. What is the user trying to accomplish?
2. What information do I need to gather first?
3. What are the dependencies between different actions?
4. What is the optimal sequence of tool calls?

# Output Format
Respond with a JSON object that includes your reasoning and the tool execution plan:
{
    "thought": "Step-by-step explanation of your reasoning process and strategy",
    "tool_calls": [
        {
            "name": "toolName",
            "args": {
                // tool-specific arguments based on the tool's parameter schema
            }
        }
    ]
}

**Important**: If you need information from one tool to make decisions about subsequent tools, include only the first tool(s) in the plan. The system will execute them and provide results for further planning.

Generate the tool execution plan now:`;
    }

    /**
     * 🚀 解析AI返回的工具规划（增强版：支持思维链格式）
     */
    private parseToolPlanFromResponse(response: string): Array<{ name: string; args: any }> {
        try {
            // 尝试提取JSON对象（新格式，包含thought和tool_calls）
            const jsonMatch = response.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                
                // 新格式：包含thought和tool_calls
                if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
                    this.logger.info(`AI思维链: ${parsed.thought || 'No reasoning provided'}`);
                    this.logger.info(`Parsed ${parsed.tool_calls.length} tool calls from AI response`);
                    return parsed.tool_calls;
                }
                
                // 兼容性：如果是直接的数组格式
                if (Array.isArray(parsed)) {
                    this.logger.info(`Parsed ${parsed.length} tool calls from AI response (legacy format)`);
                    return parsed;
                }
            }
            
            // 回退：尝试提取JSON数组（旧格式兼容）
            const arrayMatch = response.match(/\[[\s\S]*?\]/);
            if (arrayMatch) {
                const parsed = JSON.parse(arrayMatch[0]);
                if (Array.isArray(parsed)) {
                    this.logger.info(`Parsed ${parsed.length} tool calls from AI response (array format)`);
                    return parsed;
                }
            }
        } catch (error) {
            this.logger.warn(`Failed to parse tool plan JSON from AI response: ${(error as Error).message}`);
        }

        this.logger.warn('No valid tool plan found in AI response');
        return [];
    }

    /**
     * 🚀 RAG知识检索：基于用户输入和上下文检索相关知识（增强版：集成预处理分析）
     */
    private async retrieveRelevantKnowledge(userInput: string, sessionContext: SessionContext): Promise<string | null> {
        try {
            // 🚀 零成本预处理：在调用昂贵的LLM之前进行本地分析
            const preAnalysis = InputAnalyzer.analyzeInput(userInput);
            
            // 识别用户输入的关键词和意图
            const keywords = this.extractKeywords(userInput);
            const intent = this.identifyIntent(userInput);
            
            // 构建知识检索结果（增强版：使用预处理分析）
            const knowledgeFragments: string[] = [];
            
            // 🚀 预处理分析摘要
            const analysisSummary = InputAnalyzer.generateAnalysisSummary(preAnalysis);
            knowledgeFragments.push(analysisSummary);
            
            // 1. 基于领域的最佳实践（来自预处理分析）
            if (preAnalysis.domain.domain !== 'general') {
                knowledgeFragments.push(`
📋 **${preAnalysis.domain.domain}领域最佳实践**：
- 项目类型：${preAnalysis.projectType.type}
- 匹配关键词：${preAnalysis.domain.matchedKeywords.join(', ')}
- 建议参考行业标准的${preAnalysis.domain.domain}系统设计模式`);
            }
            
            // 2. 基于意图的最佳实践
            if (intent === 'create_requirement') {
                knowledgeFragments.push(`
📝 **需求创建最佳实践**：
- 每个需求应具有唯一标识符和清晰描述
- 需求应包含验收标准和优先级
- 建议先检查现有需求，避免重复创建
- 功能需求应关联到具体的用户故事`);
            } else if (intent === 'edit_requirement') {
                knowledgeFragments.push(`
✏️ **需求编辑最佳实践**：
- 编辑前应先获取当前需求详情
- 重大修改应记录变更历史
- 确保修改后的需求与其他需求保持一致性
- 修改后应验证需求的完整性`);
            } else if (intent === 'manage_project') {
                knowledgeFragments.push(`
🏗️ **项目管理最佳实践**：
- 项目初始化应包含基本的目录结构
- 重要文件应使用模板确保一致性
- 定期备份重要的项目文件
- 保持项目文档的更新和同步`);
            }
            
            // 2. 基于关键词的技术知识
            if (keywords.some(k => ['用户', '登录', '认证', '授权'].includes(k))) {
                knowledgeFragments.push(`
🔐 **用户认证相关知识**：
- 用户认证通常包括用户名/密码、多因素认证
- 需要考虑密码安全策略和会话管理
- 应定义用户权限和角色管理机制`);
            }
            
            // 3. 当前项目上下文相关知识
            if (sessionContext.projectName) {
                knowledgeFragments.push(`
📊 **当前项目上下文**：
- 项目：${sessionContext.projectName}
- 活跃文件：${sessionContext.activeFiles?.length || 0}个
- 建议在操作前先了解项目当前状态`);
            }
            
            return knowledgeFragments.length > 0 ? knowledgeFragments.join('\n\n') : null;
            
        } catch (error) {
            this.logger.warn(`Failed to retrieve relevant knowledge: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * 从用户输入中提取关键词
     */
    private extractKeywords(userInput: string): string[] {
        const keywords = userInput.toLowerCase()
            .split(/[\s,，。！？;；：]+/)
            .filter(word => word.length > 1);
        return keywords;
    }

    /**
     * 识别用户意图
     */
    private identifyIntent(userInput: string): string {
        const input = userInput.toLowerCase();
        
        if (input.includes('创建') || input.includes('新增') || input.includes('添加')) {
            return 'create_requirement';
        } else if (input.includes('编辑') || input.includes('修改') || input.includes('更新')) {
            return 'edit_requirement';
        } else if (input.includes('项目') || input.includes('初始化') || input.includes('创建项目')) {
            return 'manage_project';
        } else if (input.includes('查看') || input.includes('显示') || input.includes('列出')) {
            return 'view_information';
        } else if (input.includes('删除') || input.includes('移除')) {
            return 'delete_item';
        }
        
        return 'general_query';
    }

    /**
     * 执行工具调用 - 使用新的工具执行器
     */
    private async executeToolCalls(toolCalls: Array<{ name: string; args: any }>): Promise<any[]> {
        const results = [];

        for (const toolCall of toolCalls) {
            try {
                this.logger.info(`🔧 Executing tool: ${toolCall.name}`);
                
                const result = await toolExecutor.executeTool(
                    toolCall.name,
                    toolCall.args
                );
                
                results.push({
                    success: result.success,
                    result: result.result,
                    toolName: toolCall.name
                });
                
            } catch (error) {
                this.logger.error(`❌ Tool execution failed: ${toolCall.name}`);
                results.push({
                    success: false,
                    error: (error as Error).message,
                    toolName: toolCall.name
                });
            }
        }

        return results;
    }

    /**
     * 🚀 汇总工具执行结果
     */
    private summarizeToolResults(results: any[]): string {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        if (failed.length === 0) {
            return `✅ 成功执行了 ${successful.length} 个操作`;
        } else if (successful.length === 0) {
            return `❌ ${failed.length} 个操作执行失败`;
        } else {
            return `⚠️ ${successful.length} 个操作成功，${failed.length} 个操作失败`;
        }
    }

    /**
     * 生成指导性响应（当无法生成工具计划时）
     */
    private generateGuidanceResponse(userInput: string, sessionContext: SessionContext): string {
        const availableTools = getAvailableTools().map(t => t.name);
        const hasProject = !!sessionContext.projectName;
        
        if (!hasProject) {
            return `目前没有活跃的项目。可用的操作包括：${availableTools.join(', ')}。请先创建一个项目或打开现有项目。`;
        }
        
        return `我理解您的请求是："${userInput}"。当前可用的工具有：${availableTools.join(', ')}。请尝试更具体地描述您想要执行的操作。`;
    }

    /**
     * 检查模型使用权限
     */
    private async checkModelPermissions(model: vscode.LanguageModelChat): Promise<boolean> {
        try {
            return model && typeof model.sendRequest === 'function';
        } catch (error) {
            this.logger.warn('Failed to check model permissions');
            return false;
        }
    }

    /**
     * 加载配置
     */
    private loadConfiguration(): void {
        try {
            const config = vscode.workspace.getConfiguration('srs-writer');
            this.useAIOrchestrator = config.get('useAIOrchestrator', true);
            
            this.logger.info(`Orchestrator configuration loaded: AI=${this.useAIOrchestrator}`);
        } catch (error) {
            this.logger.warn(`Failed to load configuration: ${(error as Error).message}`);
        }
    }

    /**
     * 动态切换AI模式
     */
    public setAIMode(enabled: boolean): void {
        this.useAIOrchestrator = enabled;
        this.logger.info(`Orchestrator AI mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * 获取当前状态
     */
    public getStatus(): { 
        aiMode: boolean; 
        toolMode: boolean;
        availableTools: string[];
    } {
        return {
            aiMode: this.useAIOrchestrator,
            toolMode: true, // v2.0 always in tool mode
            availableTools: getAvailableTools().map(t => t.name)
        };
    }



    /**
     * 获取系统状态
     */
    async getSystemStatus(): Promise<any> {
        const toolStats = toolExecutor.getExecutionStats();

        return {
            mode: 'Chain-of-Thought AI Tool Agent',
            version: '2.1',
            status: 'Active',
            toolSystem: toolStats,
            capabilities: [
                '🧠 思维链推理 (Chain-of-Thought)',
                '🔄 对话式规划循环',
                '🚀 自我修正与适应',
                '📚 RAG知识检索增强',
                '🛠️ 智能工具协调执行',
                '📝 智能需求管理',
                '📄 文档自动化操作',
                '🔧 编辑器深度集成'
            ],
            features: {
                chainOfThought: true,
                conversationalPlanning: true,
                selfCorrection: true,
                ragKnowledgeRetrieval: true,
                adaptiveToolExecution: true
            }
        };
    }

    /**
     * 重置系统状态
     */
    async resetSystem(): Promise<void> {
        toolExecutor.resetStats();
        this.logger.info('🔄 System reset completed');
    }

    // 动态模型配置缓存
    private static modelConfigCache = new Map<string, {
        maxTokens: number;
        warningThreshold: number;
        compressionThreshold: number;
        lastUpdated: number;
        confidence: 'low' | 'medium' | 'high';
    }>();

    /**
     * 🚀 动态上下文窗口配置：多层次自适应策略
     */
    private async getContextWindowConfig(selectedModel: vscode.LanguageModelChat): Promise<{
        maxTokens: number;
        warningThreshold: number;
        compressionThreshold: number;
    }> {
        const modelKey = selectedModel.name;
        
        // 1. 优先级1：用户配置覆盖
        const userConfig = await this.loadUserModelConfig(modelKey);
        if (userConfig) {
            const config = {
                maxTokens: userConfig.maxTokens || 8000,
                warningThreshold: userConfig.warningThreshold || Math.floor((userConfig.maxTokens || 8000) * 0.75),
                compressionThreshold: userConfig.compressionThreshold || Math.floor((userConfig.maxTokens || 8000) * 0.6)
            };
            this.logger.info(`👤 Using user config for ${modelKey}: ${config.maxTokens} tokens`);
            return config;
        }
        
        // 2. 优先级2：错误学习缓存（高置信度）
        const cached = Orchestrator.modelConfigCache.get(modelKey);
        if (cached && cached.confidence === 'high') {
            this.logger.info(`🎯 Using learned config for ${modelKey}: ${cached.maxTokens} tokens (high confidence)`);
            return {
                maxTokens: cached.maxTokens,
                warningThreshold: cached.warningThreshold,
                compressionThreshold: cached.compressionThreshold
            };
        }
        
        // 3. 优先级3：普通缓存（24小时有效）
        if (cached && (Date.now() - cached.lastUpdated) < 24 * 60 * 60 * 1000) {
            this.logger.info(`📋 Using cached config for ${modelKey} (confidence: ${cached.confidence})`);
            return {
                maxTokens: cached.maxTokens,
                warningThreshold: cached.warningThreshold,
                compressionThreshold: cached.compressionThreshold
            };
        }
        
        // 4. 优先级4：启发式推断（基于通用规则）
        const inferredConfig = this.inferModelCapabilities(selectedModel);
        
        // 5. 缓存推断结果
        Orchestrator.modelConfigCache.set(modelKey, {
            ...inferredConfig,
            lastUpdated: Date.now(),
            confidence: 'medium'
        });
        
        this.logger.info(`🔍 Inferred config for ${modelKey}: ${inferredConfig.maxTokens} tokens (medium confidence)`);
        return {
            maxTokens: inferredConfig.maxTokens,
            warningThreshold: inferredConfig.warningThreshold,
            compressionThreshold: inferredConfig.compressionThreshold
        };
    }

    /**
     * 🚀 启发式模型能力推断：基于名称模式和通用规则
     */
    private inferModelCapabilities(model: vscode.LanguageModelChat) {
        const modelName = model.name.toLowerCase();
        
        // 基于年份和版本的启发式推断
        const currentYear = new Date().getFullYear();
        
        // 检查是否是新一代大上下文模型
        if (this.isLargeContextModel(modelName)) {
            return { maxTokens: 128000, warningThreshold: 100000, compressionThreshold: 80000 };
        }
        
        // 检查是否是中等上下文模型  
        if (this.isMediumContextModel(modelName)) {
            return { maxTokens: 32000, warningThreshold: 25000, compressionThreshold: 20000 };
        }
        
        // 检查是否是老模型或小模型
        if (this.isSmallContextModel(modelName)) {
            return { maxTokens: 4000, warningThreshold: 3000, compressionThreshold: 2000 };
        }
        
        // 默认保守估计
        return { maxTokens: 8000, warningThreshold: 6000, compressionThreshold: 4000 };
    }

    /**
     * 检查是否是大上下文模型
     */
    private isLargeContextModel(modelName: string): boolean {
        const largeContextIndicators = [
            'turbo', '128k', '200k', 'long', 'extended',
            'claude-3', 'claude-2.1', 'gemini-pro',
            '2024', '2023'  // 较新的模型通常有更大的上下文
        ];
        return largeContextIndicators.some(indicator => modelName.includes(indicator));
    }

    /**
     * 检查是否是中等上下文模型
     */
    private isMediumContextModel(modelName: string): boolean {
        const mediumContextIndicators = [
            'gpt-4', 'claude-2', 'gemini',
            '16k', '32k'
        ];
        return mediumContextIndicators.some(indicator => modelName.includes(indicator));
    }

    /**
     * 检查是否是小上下文模型
     */
    private isSmallContextModel(modelName: string): boolean {
        const smallContextIndicators = [
            'gpt-3.5', '4k', '2k', 
            '2022', '2021'  // 较老的模型
        ];
        return smallContextIndicators.some(indicator => modelName.includes(indicator));
    }

    /**
     * 🚀 Token数量估算：简单但有效的估算方法
     */
    private estimateTokens(text: string): number {
        // 简单估算：1 token ≈ 0.75 英文单词 ≈ 4 字符
        // 对于中文，1个字符大约等于1个token
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length;
        
        return Math.ceil(chineseChars + englishWords * 1.3);
    }

    /**
     * 🚀 对话上下文管理：智能压缩历史记录 + 错误反馈学习
     */
    private async manageConversationContext(
        conversationHistory: Array<{ role: string; content: string; tokens?: number; toolResults?: any[] }>,
        contextConfig: { maxTokens: number; warningThreshold: number; compressionThreshold: number },
        selectedModel: vscode.LanguageModelChat
    ): Promise<void> {
        const totalTokens = conversationHistory.reduce((sum, item) => sum + (item.tokens || 0), 0);
        
        if (totalTokens <= contextConfig.compressionThreshold) {
            return; // 无需压缩
        }
        
        this.logger.warn(`💭 Context approaching limit (${totalTokens}/${contextConfig.maxTokens} tokens), compressing history`);
        
        // 保留最新的2轮对话和初始用户输入
        const originalUserInput = conversationHistory[0];
        const recentHistory = conversationHistory.slice(-4); // 最近2轮对话
        
        // 压缩中间历史为摘要
        const middleHistory = conversationHistory.slice(1, -4);
        if (middleHistory.length > 0) {
            const compressionSummary = await this.compressHistoryToSummary(middleHistory, selectedModel);
            
            // 重构对话历史
            conversationHistory.length = 0; // 清空数组
            conversationHistory.push(originalUserInput);
            
            if (compressionSummary) {
                conversationHistory.push({
                    role: 'system',
                    content: `📋 **历史摘要**: ${compressionSummary}`,
                    tokens: this.estimateTokens(compressionSummary)
                });
            }
            
            conversationHistory.push(...recentHistory);
            
            const newTotalTokens = conversationHistory.reduce((sum, item) => sum + (item.tokens || 0), 0);
            this.logger.info(`✅ Context compressed: ${totalTokens} → ${newTotalTokens} tokens`);
        }
    }

    /**
     * 🚀 错误反馈学习：从实际API错误中学习模型限制
     */
    private async handleContextError(
        error: Error,
        selectedModel: vscode.LanguageModelChat,
        estimatedTokens: number
    ): Promise<void> {
        const errorMessage = error.message.toLowerCase();
        
        // 检查是否是上下文超限错误
        if (this.isContextLimitError(errorMessage)) {
            const modelKey = selectedModel.name;
            const cached = Orchestrator.modelConfigCache.get(modelKey);
            
            if (cached) {
                // 根据错误调整配置（保守降低）
                const newMaxTokens = Math.floor(estimatedTokens * 0.8); // 降低20%
                const updatedConfig = {
                    maxTokens: newMaxTokens,
                    warningThreshold: Math.floor(newMaxTokens * 0.8),
                    compressionThreshold: Math.floor(newMaxTokens * 0.6),
                    lastUpdated: Date.now(),
                    confidence: 'high' as const // 从实际错误学习，置信度最高
                };
                
                Orchestrator.modelConfigCache.set(modelKey, updatedConfig);
                
                this.logger.warn(`🔧 Learned from context error for ${modelKey}: ${cached.maxTokens} → ${newMaxTokens} tokens`);
            }
        }
    }

    /**
     * 检查错误是否为上下文限制错误
     */
    private isContextLimitError(errorMessage: string): boolean {
        const contextErrorIndicators = [
            'context length',
            'token limit',
            'maximum context',
            'too long',
            'context size',
            '4096', '8192', '16384', '32768'
        ];
        return contextErrorIndicators.some(indicator => errorMessage.includes(indicator));
    }

    /**
     * 🚀 用户配置覆盖：允许用户手动指定模型配置
     */
    private async loadUserModelConfig(modelName: string): Promise<{
        maxTokens?: number;
        warningThreshold?: number;
        compressionThreshold?: number;
    } | null> {
        try {
            const config = vscode.workspace.getConfiguration('srs-writer');
            const userModelConfigs = config.get<Record<string, any>>('modelConfigs', {});
            
            const userConfig = userModelConfigs[modelName];
            if (userConfig && typeof userConfig === 'object') {
                this.logger.info(`👤 Using user-defined config for ${modelName}`);
                return userConfig;
            }
        } catch (error) {
            this.logger.warn(`Failed to load user model config: ${(error as Error).message}`);
        }
        return null;
    }

    /**
     * 🚀 历史压缩：将多轮对话压缩为简洁摘要
     */
    private async compressHistoryToSummary(
        historyToCompress: Array<{ role: string; content: string; toolResults?: any[] }>,
        selectedModel: vscode.LanguageModelChat
    ): Promise<string | null> {
        try {
            // 构建压缩提示词
            const historyText = historyToCompress.map((item, index) => {
                if (item.toolResults) {
                    const successCount = item.toolResults.filter(r => r.success).length;
                    const toolNames = item.toolResults.map(r => r.toolName).join(', ');
                    return `第${index + 1}步: 执行工具[${toolNames}] - ${successCount}/${item.toolResults.length}成功`;
                }
                return `${item.role}: ${item.content.substring(0, 100)}...`;
            }).join('\n');

            const compressionPrompt = `请将以下对话历史压缩为1-2句话的简洁摘要，重点关注：
1. 完成了哪些关键操作
2. 是否有失败需要修正
3. 当前进展状态

历史记录：
${historyText}

摘要（1-2句话）：`;

            const messages = [vscode.LanguageModelChatMessage.User(compressionPrompt)];
            const response = await selectedModel.sendRequest(messages, {
                justification: 'Compress conversation history for context management'
            });

            let summary = '';
            for await (const fragment of response.text) {
                summary += fragment;
            }

            return summary.trim();
        } catch (error) {
            this.logger.warn(`Failed to compress history: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * 🚀 工具结果格式化：生成结构化的执行报告
     */
    private formatToolResults(toolResults: any[]): string {
        const successfulTools = toolResults.filter(r => r.success);
        const failedTools = toolResults.filter(r => !r.success);
        
        let report = `🔧 **工具执行报告** (${successfulTools.length}/${toolResults.length}成功)\n\n`;
        
        if (successfulTools.length > 0) {
            report += `✅ **成功执行**:\n`;
            successfulTools.forEach(tool => {
                report += `  • ${tool.toolName}: 执行成功\n`;
            });
            report += '\n';
        }
        
        if (failedTools.length > 0) {
            report += `❌ **执行失败**:\n`;
            failedTools.forEach(tool => {
                report += `  • ${tool.toolName}: ${tool.error || '未知错误'}\n`;
            });
            report += '\n';
        }
        
        return report;
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        this.logger.info('Orchestrator disposed');
    }
}
