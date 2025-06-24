import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { ToolAccessController } from './orchestrator/ToolAccessController';
import { ToolCacheManager } from './orchestrator/ToolCacheManager';
import { CallerType } from '../types';
import { toolRegistry } from '../tools';

/**
 * v1.3 简化版专家执行器 - 基于官方工具
 * 替代复杂的RuleRunner，直接使用@vscode/chat-extension-utils
 * 
 * 🏗️ 架构说明：
 * 主要路径：外部.md文件 → 模板替换 → VSCode API
 * 降级路径：硬编码提示词方法（仅在文件加载失败时使用）
 * 
 * ⚠️ 重要：此文件包含降级备用代码，请勿轻易删除相关方法和注释
 */
export class SpecialistExecutor {
    private logger = Logger.getInstance();
    private toolAccessController = new ToolAccessController();
    private toolCacheManager = new ToolCacheManager();
    
    constructor() {
        this.logger.info('SpecialistExecutor initialized with official VSCode APIs');
    }

    /**
     * 执行专家规则
     * @param ruleId 规则ID（如 '100_create_srs'）
     * @param context 上下文数据
     * @param model 用户选择的模型
     */
    public async executeSpecialist(
        ruleId: string,
        context: any,
        model: vscode.LanguageModelChat
    ): Promise<string> {
        this.logger.info(`Executing specialist: ${ruleId} with model: ${model.name}`);

        try {
            // 🚀 新增：专家执行循环状态管理
            let conversationHistory: string[] = [];
            let toolExecutionResults: string[] = [];
            let maxIterations = 10; // 防止无限循环
            let currentIteration = 0;
            let isCompleted = false;

            while (!isCompleted && currentIteration < maxIterations) {
                currentIteration++;
                this.logger.info(`🔄 Specialist iteration ${currentIteration}/${maxIterations} for rule: ${ruleId}`);

                // 从对应的专家文件加载提示词
                const prompt = await this.loadSpecialistPrompt(ruleId, context, conversationHistory, toolExecutionResults);
                
                // 🚀 获取 Specialist 可用的工具
                const toolsInfo = await this.toolCacheManager.getTools(CallerType.SPECIALIST);
                const toolsForVSCode = this.convertToolsToVSCodeFormat(toolsInfo.definitions);
                
                const messages = [
                    vscode.LanguageModelChatMessage.User(prompt)
                ];

                const requestOptions: vscode.LanguageModelChatRequestOptions = {
                    justification: `Execute SRS specialist rule: ${ruleId} (iteration ${currentIteration})`
                };

                // 🚀 如果有可用工具，提供给 AI
                if (toolsForVSCode.length > 0) {
                    requestOptions.tools = toolsForVSCode;
                }

                const response = await model.sendRequest(messages, requestOptions);
                
                // 处理流式文本响应
                let result = '';
                for await (const fragment of response.text) {
                    result += fragment;
                }

                if (!result.trim()) {
                    throw new Error(`Specialist ${ruleId} returned empty response in iteration ${currentIteration}`);
                }

                this.logger.info(`🧠 Specialist ${ruleId} iteration ${currentIteration} response length: ${result.length}`);

                // 🚀 新增：解析AI返回的工具调用计划
                const aiPlan = this.parseAIToolPlan(result);
                
                if (!aiPlan || !aiPlan.tool_calls || aiPlan.tool_calls.length === 0) {
                    this.logger.warn(`⚠️ No tool calls found in specialist response for iteration ${currentIteration}`);
                    // 将AI响应添加到历史，继续下一轮
                    conversationHistory.push(`AI Response (iteration ${currentIteration}): ${result}`);
                    continue;
                }

                // 🚀 新增：执行AI规划的工具调用
                const toolCallResults = await this.executeToolCallsFromPlan(aiPlan.tool_calls);
                
                // 🚀 新增：检查是否需要聊天交互（askQuestion工具的特殊处理）
                const chatInteractionNeeded = toolCallResults.find(result => 
                    result.toolName === 'askQuestion' && 
                    result.success && 
                    result.result?.needsChatInteraction
                );
                
                if (chatInteractionNeeded) {
                    this.logger.info(`💬 Specialist ${ruleId} needs chat interaction: ${chatInteractionNeeded.result.chatQuestion}`);
                    
                    // 🚀 返回特殊状态，让聊天系统处理用户交互
                    return JSON.stringify({
                        needsChatInteraction: true,
                        chatQuestion: chatInteractionNeeded.result.chatQuestion,
                        currentIteration: currentIteration,
                        conversationHistory: conversationHistory,
                        toolExecutionResults: toolExecutionResults,
                        pendingPlan: aiPlan,
                        resumeContext: {
                            ruleId: ruleId,
                            context: context,
                            // 保存当前状态以便后续恢复
                        }
                    });
                }
                
                // 🚀 新增：检查是否调用了 finalAnswer（任务完成信号）
                const finalAnswerCall = aiPlan.tool_calls.find(call => call.name === 'finalAnswer');
                if (finalAnswerCall) {
                    this.logger.info(`🎯 Specialist ${ruleId} completed task with finalAnswer in iteration ${currentIteration}`);
                    isCompleted = true;
                    
                    // 返回最终答案的摘要
                    const finalResult = toolCallResults.find(result => result.toolName === 'finalAnswer');
                    if (finalResult && finalResult.success) {
                        return JSON.stringify({
                            completed: true,
                            summary: finalResult.result?.summary || 'Task completed successfully',
                            iterations: currentIteration,
                            totalToolsExecuted: toolCallResults.length
                        });
                    }
                }

                // 🚀 新增：将工具执行结果添加到历史中
                const resultsText = toolCallResults.map(result => 
                    `Tool: ${result.toolName}, Success: ${result.success}, Result: ${JSON.stringify(result.result)}`
                ).join('\n');
                
                conversationHistory.push(`AI Plan (iteration ${currentIteration}): ${JSON.stringify(aiPlan)}`);
                toolExecutionResults.push(`Tool Results (iteration ${currentIteration}):\n${resultsText}`);
            }

            // 🚀 如果达到最大迭代次数但未完成，返回部分完成状态
            if (currentIteration >= maxIterations && !isCompleted) {
                this.logger.warn(`⚠️ Specialist ${ruleId} reached max iterations (${maxIterations}) without explicit completion`);
                return JSON.stringify({
                    completed: false,
                    summary: `Specialist completed ${currentIteration} iterations but did not explicitly signal completion`,
                    iterations: currentIteration,
                    partialCompletion: true
                });
            }

            // 🚀 正常完成情况的默认返回
            return JSON.stringify({
                completed: true,
                summary: `Specialist ${ruleId} completed successfully`,
                iterations: currentIteration
            });

        } catch (error) {
            this.logger.error(`Failed to execute specialist ${ruleId}`, error as Error);
            throw error;
        }
    }

    /**
     * 从rules/specialists/目录加载专家提示词
     */
    private async loadSpecialistPrompt(ruleId: string, context: any, conversationHistory: string[], toolExecutionResults: string[]): Promise<string> {
        try {
            // 根据ruleId确定文件名
            const fileName = this.getSpecialistFileName(ruleId);
            
            // 查找专家文件路径
            const possiblePaths = [
                path.join(__dirname, `../../rules/specialists/${fileName}`),  // 开发环境
                path.join(__dirname, `../rules/specialists/${fileName}`),     // 打包环境备选1
                path.join(__dirname, `rules/specialists/${fileName}`),        // 打包环境备选2
                path.join(process.cwd(), `rules/specialists/${fileName}`),     // 工作目录
            ];
            
            // 如果是VSCode扩展环境，使用扩展上下文路径
            try {
                const extension = vscode.extensions.getExtension('testany-co.srs-writer-plugin');
                if (extension) {
                    possiblePaths.unshift(path.join(extension.extensionPath, `rules/specialists/${fileName}`));
                }
            } catch (error) {
                this.logger.warn('Failed to get extension path, using fallback paths');
            }
            
            // 查找第一个存在的路径
            const specialistPath = possiblePaths.find(filePath => fs.existsSync(filePath));
            
            if (!specialistPath) {
                this.logger.warn(`Specialist prompt file not found: ${fileName}. Tried paths: ${possiblePaths.join(', ')}`);
                return this.buildPromptForSpecialist(ruleId, context, conversationHistory, toolExecutionResults); // 降级到硬编码版本
            }
            
            // 读取文件内容
            let promptTemplate = fs.readFileSync(specialistPath, 'utf8');
            
            // 替换模板变量
            promptTemplate = this.replaceTemplateVariables(promptTemplate, context, conversationHistory, toolExecutionResults);
            
            this.logger.info(`Loaded specialist prompt from: ${specialistPath}`);
            return promptTemplate;
            
        } catch (error) {
            this.logger.error(`Failed to load specialist prompt file for ${ruleId}`, error as Error);
            // 降级到硬编码版本
            return this.buildPromptForSpecialist(ruleId, context, conversationHistory, toolExecutionResults);
        }
    }

    /**
     * 根据ruleId获取对应的文件名
     */
    private getSpecialistFileName(ruleId: string): string {
        const fileMapping: { [key: string]: string } = {
            '100_create_srs': '100_create_srs.md',
            '200_edit_srs': '200_edit_srs.md',
            '300_prototype': '300_prototype.md',
            '400_lint_check': '400_lint_check.md',
            '500_git_operations': '500_git_operations.md',
            'help_response': 'help_response.md',
            'complexity_classification': 'ComplexityClassification.md'
        };
        
        return fileMapping[ruleId] || `${ruleId}.md`;
    }

    /**
     * 替换提示词模板中的变量
     */
    private replaceTemplateVariables(promptTemplate: string, context: any, conversationHistory?: string[], toolExecutionResults?: string[]): string {
        // ✅ 保持原有逻辑（完全兼容）
        const userInput = context.userInput || '';
        const projectName = context.sessionData?.projectName || null;
        const hasActiveProject = !!projectName;
        
        // 🚀 新增：语义明确的持久化信息
        const initialUserRequest = context.userInput || '';
        const currentUserResponse = context.currentUserResponse || '';
        
        // 基本变量替换
        let result = promptTemplate;
        
        // ✅ 原有占位符保持不变（兼容性）
        result = result.replace(/\{\{USER_INPUT\}\}/g, userInput);
        result = result.replace(/\{\{PROJECT_NAME\}\}/g, projectName || 'Unknown');
        result = result.replace(/\{\{HAS_ACTIVE_PROJECT\}\}/g, hasActiveProject.toString());
        result = result.replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString());
        result = result.replace(/\{\{DATE\}\}/g, new Date().toISOString().split('T')[0]);
        result = result.replace(/\{\{INTENT\}\}/g, context.intent || '');
        
        // 🚀 新增：语义明确的占位符
        result = result.replace(/\{\{INITIAL_USER_REQUEST\}\}/g, initialUserRequest);
        result = result.replace(/\{\{CURRENT_USER_RESPONSE\}\}/g, currentUserResponse);
        
        // 上下文数据替换
        if (context.sessionData) {
            result = result.replace(/\{\{LAST_INTENT\}\}/g, context.sessionData.lastIntent || 'null');
            result = result.replace(/\{\{ACTIVE_FILES\}\}/g, JSON.stringify(context.sessionData.activeFiles || []));
        }
        
        // 🚀 新增：对话历史和工具执行结果
        const conversationHistoryText = conversationHistory && conversationHistory.length > 0 
            ? conversationHistory.join('\n\n') 
            : 'No previous conversation history.';
        
        const toolResultsText = toolExecutionResults && toolExecutionResults.length > 0 
            ? toolExecutionResults.join('\n\n') 
            : 'No previous tool execution results.';
        
        result = result.replace(/\{\{CONVERSATION_HISTORY\}\}/g, conversationHistoryText);
        result = result.replace(/\{\{TOOL_RESULTS_CONTEXT\}\}/g, toolResultsText);
        
        // 🚀 注入可用工具列表（JSON Schema格式）
        result = this.injectAvailableTools(result);
        
        // 🚀 注入工具调用指南
        result = this.injectToolCallingGuides(result);
        
        return result;
    }

    /**
     * 🚀 新增：注入可用工具列表（JSON Schema格式）
     */
    private injectAvailableTools(promptTemplate: string): string {
        try {
            // 获取 Specialist 可用的工具定义
            const availableTools = this.toolAccessController.getAvailableTools(CallerType.SPECIALIST);
            
            // 转换为 JSON Schema 格式
            const toolsJsonSchema = JSON.stringify(availableTools, null, 2);
            
            // 替换 {{AVAILABLE_TOOLS}} 占位符
            const result = promptTemplate.replace(/\{\{AVAILABLE_TOOLS\}\}/g, toolsJsonSchema);
            
            return result;
            
        } catch (error) {
            this.logger.warn(`Failed to inject available tools: ${(error as Error).message}`);
            return promptTemplate; // 失败时返回原模板
        }
    }

    /**
     * 🚀 新增：注入工具调用指南
     */
    private injectToolCallingGuides(promptTemplate: string): string {
        try {
            // 获取 Specialist 可用的工具定义（同步版本，用于模板替换）
            const availableTools = this.toolAccessController.getAvailableTools(CallerType.SPECIALIST);
            
            // 为每个工具生成调用指南
            const toolGuides: { [key: string]: string } = {};
            
            for (const tool of availableTools) {
                if (tool.callingGuide) {
                    toolGuides[tool.name] = this.formatCallingGuide(tool);
                }
            }
            
            // 替换模板中的工具调用指南占位符
            let result = promptTemplate;
            
            // 支持 {{TOOL_CALLING_GUIDE.toolName}} 格式
            const guidePattern = /\{\{TOOL_CALLING_GUIDE\.(\w+)\}\}/g;
            result = result.replace(guidePattern, (match, toolName) => {
                return toolGuides[toolName] || `工具 ${toolName} 的调用指南不可用`;
            });
            
            // 支持 {{ALL_TOOL_GUIDES}} 格式
            const allGuidesText = Object.entries(toolGuides)
                .map(([name, guide]) => `## ${name} 工具调用指南\n${guide}`)
                .join('\n\n');
            
            result = result.replace(/\{\{ALL_TOOL_GUIDES\}\}/g, allGuidesText);
            
            return result;
            
        } catch (error) {
            this.logger.warn(`Failed to inject tool calling guides: ${(error as Error).message}`);
            return promptTemplate; // 失败时返回原模板
        }
    }

    /**
     * 🚀 新增：格式化单个工具的调用指南
     */
    private formatCallingGuide(tool: any): string {
        const guide = tool.callingGuide;
        
        let formatted = `**何时使用**: ${guide.whenToUse || '未指定'}\n\n`;
        
        if (guide.prerequisites) {
            formatted += `**前置条件**: ${guide.prerequisites}\n\n`;
        }
        
        if (guide.inputRequirements) {
            formatted += `**输入要求**:\n`;
            for (const [key, desc] of Object.entries(guide.inputRequirements)) {
                formatted += `- ${key}: ${desc}\n`;
            }
            formatted += '\n';
        }
        
        if (guide.internalWorkflow && Array.isArray(guide.internalWorkflow)) {
            formatted += `**内部工作流程**:\n`;
            guide.internalWorkflow.forEach((step: string) => {
                formatted += `${step}\n`;
            });
            formatted += '\n';
        }
        
        if (guide.commonPitfalls && Array.isArray(guide.commonPitfalls)) {
            formatted += `**常见陷阱**:\n`;
            guide.commonPitfalls.forEach((pitfall: string) => {
                formatted += `⚠️ ${pitfall}\n`;
            });
        }
        
        return formatted.trim();
    }

    /**
     * 为不同的专家构建相应的提示词（降级备用版本）
     * 
     * ⚠️ 重要：此方法仅作为降级备用，当外部.md文件加载失败时使用
     * 🚫 请勿删除此注释和方法 - 这是系统稳定性的重要保障
     * 📋 主要路径应使用 rules/specialists/*.md 文件
     * 🔄 未来版本可能会移除此降级机制
     */
    private buildPromptForSpecialist(ruleId: string, context: any, conversationHistory: string[], toolExecutionResults: string[]): string {
        const userInput = context.userInput || '';
        const projectName = context.sessionData?.projectName || null;

        switch (ruleId) {
            case '100_create_srs':
                return this.buildCreateSRSPrompt(userInput, context, conversationHistory, toolExecutionResults);
            
            case '200_edit_srs':
                return this.buildEditSRSPrompt(userInput, context, projectName, conversationHistory, toolExecutionResults);
            
            case 'help_response':
                return this.buildHelpPrompt(userInput, conversationHistory, toolExecutionResults);
            
            default:
                return this.buildGenericPrompt(ruleId, userInput, context, conversationHistory, toolExecutionResults);
        }
    }

    /**
     * 构建创建SRS的提示词（降级备用版本）
     * 
     * ⚠️ 重要：此方法仅作为降级备用，当 rules/specialists/100_create_srs.md 加载失败时使用
     * 🚫 请勿删除此注释和方法 - 这是系统稳定性的重要保障
     * 📋 主要路径应使用 rules/specialists/100_create_srs.md 文件
     * 🔄 未来版本可能会移除此降级机制
     */
    private buildCreateSRSPrompt(userInput: string, context: any, conversationHistory: string[], toolExecutionResults: string[]): string {
        return `# Role
You are a professional SRS (Software Requirements Specification) writer with expertise in creating comprehensive technical documentation.

# Task
Create a complete, structured SRS document based on the user's requirements.

# Initial User Request
"${userInput}"

# ⚠️ CRITICAL: Extract and Remember Key Constraints
Before proceeding, you MUST identify and remember these critical constraints from the user request:
- Language Requirements: Does the user specify language preferences (e.g., "中文界面", "English UI")?
- Platform Requirements: What platform is mentioned (mobile, web, desktop)?
- Technical Preferences: Any specific technologies, frameworks, or approaches mentioned?
- User Experience Requirements: Any specific UX/UI preferences or constraints?

💡 These constraints MUST be reflected in every section you generate.

# Output Requirements
Generate a complete SRS document in markdown format that includes:

1. **Document Header**
   - Title with project name extracted from user input
   - Version: 1.0
   - Date: ${new Date().toISOString().split('T')[0]}

2. **Required Sections**
   - ## 1. 引言 (Introduction)
   - ## 2. 整体说明 (Overall Description) 
   - ## 3. 功能需求 (Functional Requirements)
   - ## 4. 非功能性需求 (Non-Functional Requirements)
   - ## 5. 验收标准 (Acceptance Criteria)

3. **Functional Requirements Table**
   Include a table with columns: FR-ID | 需求名称 | 优先级 | 详细描述 | 验收标准
   Use ID format: FR-MODULE-001, FR-MODULE-002, etc.

4. **Non-Functional Requirements Table**
   Include a table with columns: NFR-ID | 需求名称 | 优先级 | 详细描述 | 衡量标准
   Use ID format: NFR-PERF-001, NFR-SEC-001, etc.

5. **Project Classification**
   At the end, add a section with:
   \`\`\`
   ### --- AI CLASSIFICATION ---
   Project Type: [Web App/Mobile App/Desktop App/Platform]
   Complexity: [Simple/Medium/Complex]
   \`\`\`

# Quality Standards
- Use clear, professional language
- Ensure all requirements follow SMART principles (Specific, Measurable, Achievable, Relevant, Time-bound)
- Include realistic acceptance criteria
- Maintain consistency in terminology
- CRITICAL: Respect ALL identified constraints (language, platform, technical preferences)

🚨 FINAL CONSTRAINT CHECK: Before generating, verify that your content respects ALL identified constraints from the initial user request.

Generate the complete SRS document now:`;
    }

    /**
     * 构建编辑SRS的提示词（降级备用版本）
     * 
     * ⚠️ 重要：此方法仅作为降级备用，当 rules/specialists/200_edit_srs.md 加载失败时使用
     * 🚫 请勿删除此注释和方法 - 这是系统稳定性的重要保障
     * 📋 主要路径应使用 rules/specialists/200_edit_srs.md 文件
     * 🔄 未来版本可能会移除此降级机制
     */
    private buildEditSRSPrompt(userInput: string, context: any, projectName: string | null, conversationHistory: string[], toolExecutionResults: string[]): string {
        return `# Role
You are a professional SRS editor specializing in modifying existing Software Requirements Specification documents.

# Context
- Current project: ${projectName || 'Unknown'}
- Edit request: "${userInput}"

# Task
Modify the existing SRS document based on the user's edit request. Focus on:

1. **Understanding the Request**: Analyze what specific changes are needed
2. **Maintaining Consistency**: Ensure changes align with existing document structure
3. **Quality Assurance**: Verify all modifications follow SMART principles

# Edit Guidelines
- Preserve existing document structure and formatting
- Update version numbers and dates appropriately
- Maintain requirement ID consistency
- Add detailed acceptance criteria for new requirements
- Update related sections when making changes

# Output Format
Provide the specific changes or additions requested, maintaining the original SRS markdown format.

Process this edit request now:`;
    }

    /**
     * 构建帮助提示词（降级备用版本）
     * 
     * ⚠️ 重要：此方法仅作为降级备用，当 rules/specialists/help_response.md 加载失败时使用
     * 🚫 请勿删除此注释和方法 - 这是系统稳定性的重要保障
     * 📋 主要路径应使用 rules/specialists/help_response.md 文件
     * 🔄 未来版本可能会移除此降级机制
     */
    private buildHelpPrompt(userInput: string, conversationHistory: string[], toolExecutionResults: string[]): string {
        return `# SRS Writer Assistant Help

You are helping a user with the SRS Writer VSCode extension. Here are the available commands and features:

## Available Commands
- **/create** - Create a new SRS document from requirements description
- **/edit** - Edit existing SRS document (requires active project)
- **/lint** - Check document quality and compliance
- **/help** - Show this help information

## How to Use
1. **Creating a new SRS**: Use "/create" followed by your project description
   Example: "/create I want to build a library management system"

2. **Editing existing SRS**: Use "/edit" with specific changes
   Example: "/edit add user authentication feature"

3. **Quality checking**: Use "/lint" to validate your SRS document

## User Query
"${userInput}"

Provide specific help based on their question above.`;
    }

    /**
     * 构建通用提示词（降级备用版本）
     * 
     * ⚠️ 重要：此方法仅作为降级备用，当对应的 rules/specialists/*.md 文件加载失败时使用
     * 🚫 请勿删除此注释和方法 - 这是系统稳定性的重要保障
     * 📋 主要路径应使用 rules/specialists/ 目录下的对应.md文件
     * 🔄 未来版本可能会移除此降级机制
     */
    private buildGenericPrompt(ruleId: string, userInput: string, context: any, conversationHistory: string[], toolExecutionResults: string[]): string {
        return `# SRS Writing Assistant

You are a helpful assistant for Software Requirements Specification writing.

Rule ID: ${ruleId}
User Input: "${userInput}"
Context: ${JSON.stringify(context, null, 2)}

Please provide appropriate assistance based on the user's request.`;
    }

    /**
     * 检查是否可以处理特定专家
     */
    public canHandle(specialistId: string): boolean {
        const supportedSpecialists = [
            '100_create_srs', 
            '200_edit_srs', 
            '300_prototype', 
            '400_lint_check', 
            '500_git_operations', 
            'help_response',
            'complexity_classification'
        ];
        return supportedSpecialists.includes(specialistId);
    }

    /**
     * 获取支持的专家列表
     */
    public getSupportedSpecialists(): string[] {
        return [
            '100_create_srs', 
            '200_edit_srs', 
            '300_prototype', 
            '400_lint_check', 
            '500_git_operations', 
            'help_response',
            'complexity_classification'
        ];
    }

    /**
     * 重新加载专家规则（简化版本中为空实现）
     */
    public async reloadSpecialists(): Promise<void> {
        this.logger.info('Specialists reloaded (simplified version - no external rules)');
    }

    /**
     * 🚀 新增：将工具定义转换为 VSCode 格式
     */
    private convertToolsToVSCodeFormat(toolDefinitions: any[]): vscode.LanguageModelChatTool[] {
        return toolDefinitions.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }));
    }

    /**
     * 🚀 更新：解析AI返回的工具调用计划 - 健壮版本
     * 
     * 这个方法能够处理各种可能的AI输出格式污染：
     * - 前后缀文本噪音
     * - Markdown代码块包装
     * - 多个JSON对象（取第一个有效的）
     * - 格式错误的换行和空格
     */
    private parseAIToolPlan(aiResponse: string): { tool_calls: Array<{ name: string; args: any }> } | null {
        this.logger.info(`🔍 [DEBUG] Parsing AI response, length: ${aiResponse.length}`);
        
        try {
            // 🚀 方法1：直接解析（最快路径）
            const directParsed = JSON.parse(aiResponse.trim());
            if (directParsed && directParsed.tool_calls && Array.isArray(directParsed.tool_calls)) {
                this.logger.info(`✅ Direct JSON parse successful, found ${directParsed.tool_calls.length} tool calls`);
                return directParsed;
            }
        } catch (error) {
            // 直接解析失败，继续尝试其他方法
            this.logger.debug('Direct JSON parse failed, trying extraction methods');
        }

        try {
            // 🚀 方法2：使用健壮的JSON提取函数
            const extracted = this.extractAndParseJson(aiResponse);
            if (extracted && extracted.tool_calls && Array.isArray(extracted.tool_calls)) {
                this.logger.info(`✅ Robust JSON extraction successful, found ${extracted.tool_calls.length} tool calls`);
                return extracted;
            }
        } catch (error) {
            this.logger.debug(`Robust extraction failed: ${(error as Error).message}`);
        }

        try {
            // 🚀 方法3：Markdown代码块提取（兼容性）
            const jsonMatch = aiResponse.match(/```json\s*(.*?)\s*```/s);
            if (jsonMatch) {
                const extracted = this.extractAndParseJson(jsonMatch[1]);
                if (extracted && extracted.tool_calls && Array.isArray(extracted.tool_calls)) {
                    this.logger.info(`✅ Markdown block extraction successful, found ${extracted.tool_calls.length} tool calls`);
                    return extracted;
                }
            }
        } catch (error) {
            this.logger.debug(`Markdown block extraction failed: ${(error as Error).message}`);
        }

        try {
            // 🚀 方法4：多JSON对象检测和提取
            const multipleJsons = this.extractMultipleJsonObjects(aiResponse);
            for (const jsonObj of multipleJsons) {
                if (jsonObj && jsonObj.tool_calls && Array.isArray(jsonObj.tool_calls)) {
                    this.logger.info(`✅ Multiple JSON extraction successful, found ${jsonObj.tool_calls.length} tool calls`);
                    return jsonObj;
                }
            }
        } catch (error) {
            this.logger.debug(`Multiple JSON extraction failed: ${(error as Error).message}`);
        }

        // 🚀 所有方法都失败时的详细错误日志
        this.logger.error('=== AI RESPONSE PARSING FAILED ===');
        this.logger.error(`Response length: ${aiResponse.length}`);
        this.logger.error(`Response preview (first 500 chars): ${aiResponse.substring(0, 500)}`);
        this.logger.error(`Response preview (last 500 chars): ${aiResponse.substring(Math.max(0, aiResponse.length - 500))}`);
        this.logger.error('AI response does not contain valid tool_calls format');
        
        return null;
    }

    /**
     * 🚀 新增：健壮的JSON提取和解析函数
     * 
     * 基于用户提供的算法，能够处理更多边缘情况
     */
    private extractAndParseJson(rawText: string): any {
        // 1. 寻找 JSON 的开始和结束位置
        //    我们假设 JSON 对象总是以 '{' 开始，以 '}' 结束
        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
            // 如果找不到有效的 JSON 结构，就抛出错误
            throw new Error("No valid JSON object found in the response.");
        }

        // 2. 提取出可能是 JSON 的部分
        const jsonString = rawText.substring(firstBrace, lastBrace + 1);

        // 3. 尝试解析
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            this.logger.error("--- JSON PARSE FAILED ---");
            this.logger.error("Original Text: " + rawText);
            this.logger.error("Extracted Substring: " + jsonString);
            this.logger.error("Parse Error: " + String(error));
            throw new Error("Failed to parse the extracted JSON string.");
        }
    }

    /**
     * 🚀 新增：多JSON对象检测和提取
     * 
     * 处理AI返回多个JSON对象的情况，找到第一个有效的
     */
    private extractMultipleJsonObjects(rawText: string): any[] {
        const results: any[] = [];
        let searchIndex = 0;

        while (searchIndex < rawText.length) {
            const nextBrace = rawText.indexOf('{', searchIndex);
            if (nextBrace === -1) break;

            // 找到匹配的右括号
            let braceCount = 0;
            let endIndex = nextBrace;
            
            for (let i = nextBrace; i < rawText.length; i++) {
                if (rawText[i] === '{') {
                    braceCount++;
                } else if (rawText[i] === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        endIndex = i;
                        break;
                    }
                }
            }

            if (braceCount === 0) {
                // 找到了完整的JSON对象
                const jsonCandidate = rawText.substring(nextBrace, endIndex + 1);
                try {
                    const parsed = JSON.parse(jsonCandidate);
                    results.push(parsed);
                } catch (error) {
                    // 这个候选对象不是有效JSON，继续寻找
                    this.logger.debug(`Invalid JSON candidate: ${jsonCandidate.substring(0, 100)}...`);
                }
                searchIndex = endIndex + 1;
            } else {
                // 没有找到匹配的右括号
                break;
            }
        }

        return results;
    }

    /**
     * 🚀 新增：执行工具调用计划中的工具
     */
    private async executeToolCallsFromPlan(toolCalls: Array<{ name: string; args: any }>): Promise<Array<{
        toolName: string;
        success: boolean;
        result?: any;
        error?: string;
    }>> {
        const results = [];

        for (const toolCall of toolCalls) {
            try {
                this.logger.info(`🔧 Executing planned tool: ${toolCall.name} with args: ${JSON.stringify(toolCall.args)}`);
                
                // 🚀 使用工具注册表执行工具
                const { toolRegistry } = await import('../tools/index');
                const result = await toolRegistry.executeTool(toolCall.name, toolCall.args);
                
                results.push({
                    toolName: toolCall.name,
                    success: true,
                    result: result
                });
                
                this.logger.info(`✅ Tool ${toolCall.name} executed successfully`);
                
            } catch (error) {
                this.logger.error(`❌ Tool ${toolCall.name} execution failed: ${(error as Error).message}`);
                results.push({
                    toolName: toolCall.name,
                    success: false,
                    error: (error as Error).message
                });
            }
        }

        return results;
    }

    /**
     * 🚀 新增：从用户交互中恢复specialist执行
     * 
     * 这个方法用于处理specialist在等待用户输入后的状态恢复
     */
    public async resumeSpecialistExecution(
        resumeContext: {
            ruleId: string;
            context: any;
            currentIteration: number;
            conversationHistory: string[];
            toolExecutionResults: string[];
            pendingPlan: any;
            userResponse: string;
        },
        model: vscode.LanguageModelChat
    ): Promise<string> {
        this.logger.info(`🔄 Resuming specialist ${resumeContext.ruleId} from iteration ${resumeContext.currentIteration}`);
        
        try {
            // 恢复执行状态
            const { ruleId, context, currentIteration, conversationHistory, toolExecutionResults, pendingPlan, userResponse } = resumeContext;
            
            // 将用户回复添加到对话历史中
            const updatedConversationHistory = [...conversationHistory];
            updatedConversationHistory.push(`User Response: ${userResponse}`);
            
            // 🚀 关键：更新askQuestion工具的参数，包含用户回复
            const updatedPlan = { ...pendingPlan };
            if (updatedPlan.tool_calls) {
                updatedPlan.tool_calls = updatedPlan.tool_calls.map((toolCall: any) => {
                    if (toolCall.name === 'askQuestion') {
                        // askQuestion工具已经执行完成，现在继续执行其他工具
                        return null; // 标记为跳过
                    }
                    return toolCall;
                }).filter((toolCall: any) => toolCall !== null);
            }
            
            // 🚀 执行剩余的工具调用（如果有的话）
            let toolCallResults: Array<{
                toolName: string;
                success: boolean;
                result?: any;
                error?: string;
            }> = [];
            
            if (updatedPlan.tool_calls && updatedPlan.tool_calls.length > 0) {
                toolCallResults = await this.executeToolCallsFromPlan(updatedPlan.tool_calls);
            }
            
            // 🚀 将用户回复和工具执行结果添加到上下文中
            const updatedToolExecutionResults = [...toolExecutionResults];
            updatedToolExecutionResults.push(`User Response Processing:\nUser said: ${userResponse}`);
            
            if (toolCallResults.length > 0) {
                const resultsText = toolCallResults.map(result => 
                    `Tool: ${result.toolName}, Success: ${result.success}, Result: ${JSON.stringify(result.result)}`
                ).join('\n');
                updatedToolExecutionResults.push(`Resumed Tool Results:\n${resultsText}`);
            }
            
            // 🚀 继续specialist的执行循环
            let maxIterations = 10;
            let isCompleted = false;
            let newIteration = currentIteration;
            
            while (!isCompleted && newIteration < maxIterations) {
                newIteration++;
                this.logger.info(`🔄 Specialist ${ruleId} resumed iteration ${newIteration}/${maxIterations}`);
                
                // 🚀 关键修改：增强context以包含用户回复
                const enhancedContext = {
                    ...context,
                    currentUserResponse: userResponse  // 🚀 新增：当前用户回复
                };
                
                // 生成下一轮的提示词，包含用户回复
                const prompt = await this.loadSpecialistPrompt(ruleId, enhancedContext, updatedConversationHistory, updatedToolExecutionResults);
                
                // 🚀 获取 Specialist 可用的工具
                const toolsInfo = await this.toolCacheManager.getTools(CallerType.SPECIALIST);
                const toolsForVSCode = this.convertToolsToVSCodeFormat(toolsInfo.definitions);
                
                const messages = [
                    vscode.LanguageModelChatMessage.User(prompt)
                ];

                const requestOptions: vscode.LanguageModelChatRequestOptions = {
                    justification: `Resume SRS specialist rule: ${ruleId} (iteration ${newIteration})`
                };

                if (toolsForVSCode.length > 0) {
                    requestOptions.tools = toolsForVSCode;
                }

                const response = await model.sendRequest(messages, requestOptions);
                
                let result = '';
                for await (const fragment of response.text) {
                    result += fragment;
                }

                if (!result.trim()) {
                    throw new Error(`Specialist ${ruleId} returned empty response in resumed iteration ${newIteration}`);
                }

                this.logger.info(`🧠 Specialist ${ruleId} resumed iteration ${newIteration} response length: ${result.length}`);

                // 解析AI返回的工具调用计划
                const aiPlan = this.parseAIToolPlan(result);
                
                if (!aiPlan || !aiPlan.tool_calls || aiPlan.tool_calls.length === 0) {
                    this.logger.info(`✅ No more tool calls in resumed iteration ${newIteration} - task may be completed`);
                    break;
                }

                // 执行AI规划的工具调用
                const iterationResults = await this.executeToolCallsFromPlan(aiPlan.tool_calls);
                
                // 检查是否调用了 finalAnswer（任务完成信号）
                const finalAnswerCall = aiPlan.tool_calls.find(call => call.name === 'finalAnswer');
                if (finalAnswerCall) {
                    this.logger.info(`🎯 Specialist ${ruleId} completed task with finalAnswer in resumed iteration ${newIteration}`);
                    isCompleted = true;
                    
                    const finalResult = iterationResults.find(result => result.toolName === 'finalAnswer');
                    if (finalResult && finalResult.success) {
                        return JSON.stringify({
                            completed: true,
                            summary: finalResult.result?.summary || `Task completed successfully after user interaction`,
                            iterations: newIteration,
                            totalToolsExecuted: iterationResults.length,
                            resumedFromUserInteraction: true
                        });
                    }
                }
                
                // 🚀 重要：检查是否又需要用户交互
                const newChatInteractionNeeded = iterationResults.find(result => 
                    result.toolName === 'askQuestion' && 
                    result.success && 
                    result.result?.needsChatInteraction
                );
                
                if (newChatInteractionNeeded) {
                    this.logger.info(`💬 Specialist ${ruleId} needs another chat interaction: ${newChatInteractionNeeded.result.chatQuestion}`);
                    
                    return JSON.stringify({
                        needsChatInteraction: true,
                        chatQuestion: newChatInteractionNeeded.result.chatQuestion,
                        currentIteration: newIteration,
                        conversationHistory: updatedConversationHistory,
                        toolExecutionResults: updatedToolExecutionResults,
                        pendingPlan: aiPlan,
                        resumeContext: {
                            ruleId: ruleId,
                            context: context,
                        }
                    });
                }
                
                // 将执行结果添加到历史中
                const iterationResultsText = iterationResults.map(result => 
                    `Tool: ${result.toolName}, Success: ${result.success}, Result: ${JSON.stringify(result.result)}`
                ).join('\n');
                
                updatedConversationHistory.push(`AI Plan (resumed iteration ${newIteration}): ${JSON.stringify(aiPlan)}`);
                updatedToolExecutionResults.push(`Tool Results (resumed iteration ${newIteration}):\n${iterationResultsText}`);
            }
            
            // 如果达到最大迭代次数但未完成
            if (newIteration >= maxIterations && !isCompleted) {
                this.logger.warn(`⚠️ Specialist ${ruleId} reached max iterations (${maxIterations}) in resumed execution`);
                return JSON.stringify({
                    completed: false,
                    summary: `Specialist completed ${newIteration} iterations (including resume) but did not explicitly signal completion`,
                    iterations: newIteration,
                    partialCompletion: true,
                    resumedFromUserInteraction: true
                });
            }
            
            // 正常完成
            return JSON.stringify({
                completed: true,
                summary: `Specialist ${ruleId} completed successfully after user interaction`,
                iterations: newIteration,
                resumedFromUserInteraction: true
            });
            
        } catch (error) {
            this.logger.error(`Failed to resume specialist ${resumeContext.ruleId}`, error as Error);
            throw error;
        }
    }

    // 🚀 VSCode工具调用实现说明：
    // 
    // VSCode的工具调用机制与传统的OpenAI API不同：
    // 1. 工具通过vscode.lm.registerTool()在extension.ts中注册
    // 2. LLM通过requestOptions.tools接收工具定义
    // 3. VSCode自动处理工具调用，无需手动处理response.toolCalls
    // 4. 我们的callingGuide系统通过提示词注入指导LLM智能选择工具
    // 
    // 因此，这里不需要handleToolCallsWorkflow和executeToolCall方法
}
