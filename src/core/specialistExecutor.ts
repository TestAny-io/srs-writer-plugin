import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { jsonrepair } from 'jsonrepair';
import { Logger } from '../utils/logger';
import { ToolAccessController } from './orchestrator/ToolAccessController';
import { ToolCacheManager } from './orchestrator/ToolCacheManager';
import { ToolExecutor } from './toolExecutor';
import { CallerType, SpecialistOutput, SpecialistProgressCallback } from '../types';
import { SpecialistInteractionResult } from './engine/AgentState';
import { PromptAssemblyEngine, SpecialistType, SpecialistContext } from './prompts/PromptAssemblyEngine';
import { SpecialistIterationManager } from './config/SpecialistIterationManager';

/**
 * 🚀 专家状态恢复接口
 * 用于在用户交互后恢复specialist执行状态
 */
interface SpecialistResumeState {
    iteration: number;
    internalHistory: string[];
    currentPlan?: any;
    toolResults?: any[];
    userResponse?: string;
    contextForThisStep?: any;
}

/**
 * 🚀 专家任务执行器 - 智能多轮对话专家
 * 
 * 核心特性：
 * 1. 支持内部迭代循环优化
 * 2. 智能工具调用与结果分析
 * 3. 结构化输出与元数据管理
 * 4. 支持状态恢复（用户交互后继续）
 */
export class SpecialistExecutor {
    private logger = Logger.getInstance();
    private toolAccessController = new ToolAccessController();
    private toolCacheManager = new ToolCacheManager();
    private toolExecutor = new ToolExecutor();  // 🚀 新增：工具执行器，提供智能成功检测
    private promptAssemblyEngine: PromptAssemblyEngine;
    
    constructor() {
        this.logger.info('🚀 SpecialistExecutor v2.0 initialized - simplified single-task architecture');
        
        // 🚀 修复：初始化PromptAssemblyEngine时使用插件安装目录的绝对路径
        const rulesPath = this.getPluginRulesPath();
        this.promptAssemblyEngine = new PromptAssemblyEngine(rulesPath);
        this.logger.info(`📁 PromptAssemblyEngine initialized with rules path: ${rulesPath}`);
    }

    /**
     * 🚀 修复：获取插件rules目录的绝对路径
     */
    private getPluginRulesPath(): string {
        try {
            // 尝试获取插件扩展路径
            const extension = vscode.extensions.getExtension('testany-co.srs-writer-plugin');
            if (extension) {
                const rulesPath = path.join(extension.extensionPath, 'rules');
                this.logger.info(`✅ 使用插件扩展路径: ${rulesPath}`);
                return rulesPath;
            }
        } catch (error) {
            this.logger.warn('无法获取插件扩展路径，使用备用路径');
        }
        
        // 备用路径策略
        const fallbackPaths = [
            path.join(__dirname, '../../rules'),      // 从 dist/core 到 rules
            path.join(__dirname, '../../../rules'),   // 从 dist/src/core 到 rules  
            path.join(__dirname, '../../../../rules'), // webpack打包后的深层结构
            path.resolve(process.cwd(), 'rules')      // 工作目录下的rules（最后备选）
        ];
        
        // 查找第一个存在的路径
        for (const fallbackPath of fallbackPaths) {
            if (fs.existsSync(fallbackPath)) {
                this.logger.info(`✅ 使用备用路径: ${fallbackPath}`);
                return fallbackPath;
            }
        }
        
        // 如果都不存在，返回第一个备用路径（让PromptAssemblyEngine自己处理错误）
        const defaultPath = fallbackPaths[0];
        this.logger.warn(`⚠️ 所有路径都不存在，使用默认路径: ${defaultPath}`);
        return defaultPath;
    }

    /**
     * 🚀 新架构：执行单个专家任务（支持状态恢复）
     * @param specialistId specialist标识符（如 '100_create_srs', 'summary_writer'）
     * @param contextForThisStep 为当前步骤准备的上下文
     * @param model 用户选择的模型
     * @param resumeState 可选的恢复状态，用于从用户交互后继续执行
     * @returns 结构化的specialist输出
     */
    public async execute(
        specialistId: string,
        contextForThisStep: any,
        model: vscode.LanguageModelChat,
        resumeState?: SpecialistResumeState,
        progressCallback?: SpecialistProgressCallback
    ): Promise<SpecialistOutput | SpecialistInteractionResult> {
        const startTime = Date.now();
        const isResuming = !!resumeState;
        this.logger.info(`🚀 执行专家任务: ${specialistId}${isResuming ? ` (从第${resumeState.iteration}轮恢复)` : ''}`);

        // 🚀 新增：通知specialist开始工作
        progressCallback?.onSpecialistStart?.(specialistId);

        try {
            // 🚀 关键修复：从恢复状态初始化，而不是从0开始
            let internalHistory: string[] = resumeState?.internalHistory || [];
            let iteration = resumeState?.iteration || 0;
            
            // 🚀 新增：动态获取specialist的最大迭代次数
            const iterationManager = SpecialistIterationManager.getInstance();
            const { maxIterations: MAX_INTERNAL_ITERATIONS, source: configSource } = iterationManager.getMaxIterations(specialistId);
            
            // 🚀 新增：记录配置来源，便于调试
            this.logger.info(`🎛️ 专家 ${specialistId} 迭代限制: ${MAX_INTERNAL_ITERATIONS} (配置来源: ${configSource})`);
            const category = iterationManager.getSpecialistCategory(specialistId);
            if (category) {
                this.logger.info(`📂 专家类别: ${category}`);
            }

            // 🚀 如果有用户回复，添加到上下文和历史中
            if (resumeState?.userResponse) {
                this.logger.info(`🔄 恢复specialist执行，包含用户回复: "${resumeState.userResponse}"`);
                
                // 将用户回复添加到上下文
                contextForThisStep = {
                    ...contextForThisStep,
                    userResponse: resumeState.userResponse,
                    // 🚀 添加恢复指导
                    resumeGuidance: {
                        isResuming: true,
                        resumeReason: 'user_response_received',
                        userQuestion: resumeState.toolResults?.find((r: any) => r.toolName === 'askQuestion')?.result?.chatQuestion,
                        userAnswer: resumeState.userResponse,
                        continueInstructions: [
                            "用户已经回复了您的问题",
                            `用户回复: "${resumeState.userResponse}"`,
                            "请基于用户的回复继续您的工作",
                            "如果任务完成，请使用taskComplete"
                        ]
                    }
                };
                
                // 添加到内部历史
                internalHistory.push(`迭代 ${iteration} - 用户回复: ${resumeState.userResponse}`);
                
                // 如果有之前的工具结果，也要添加到历史中
                if (resumeState.toolResults) {
                    const previousToolResultsText = resumeState.toolResults.map((result: any) => 
                        `工具: ${result.toolName}, 成功: ${result.success}, 结果: ${JSON.stringify(result.result)}`
                    ).join('\n');
                    internalHistory.push(`迭代 ${iteration} - 之前的工具结果:\n${previousToolResultsText}`);
                }
            }

            while (iteration < MAX_INTERNAL_ITERATIONS) {
                iteration++;
                this.logger.info(`🔄 专家 ${specialistId} 内部迭代 ${iteration}/${MAX_INTERNAL_ITERATIONS}${isResuming ? ' (恢复模式)' : ''}`);
                
                // 🚀 新增：通知迭代开始
                progressCallback?.onIterationStart?.(iteration, MAX_INTERNAL_ITERATIONS);

                // 1. 加载专家提示词 (🚀 新增：传递迭代信息)
                const prompt = await this.loadSpecialistPrompt(specialistId, contextForThisStep, internalHistory, iteration, MAX_INTERNAL_ITERATIONS);
                
                // 🔍 [DEBUG] 详细记录提示词内容
                // this.logger.info(`🔍 [PROMPT_DEBUG] === 完整提示词内容 for ${specialistId} ===`);
                // this.logger.info(`🔍 [PROMPT_DEBUG] 提示词长度: ${prompt.length} 字符`);
                // this.logger.info(`🔍 [PROMPT_DEBUG] 前500字符:\n${prompt.substring(0, 500)}`);
                // this.logger.info(`🔍 [PROMPT_DEBUG] 后500字符:\n${prompt.substring(Math.max(0, prompt.length - 500))}`);
                
                // 检查关键词是否存在
                const hasToolCallsInstruction = prompt.includes('tool_calls');
                const hasJsonFormat = prompt.includes('json') || prompt.includes('JSON');
                const hasWorkflowSteps = prompt.includes('createNewProjectFolder') || prompt.includes('writeFile');
                
                // this.logger.info(`🔍 [PROMPT_DEBUG] 关键词检查:`);
                // this.logger.info(`🔍 [PROMPT_DEBUG] - 包含 'tool_calls': ${hasToolCallsInstruction}`);
                // this.logger.info(`🔍 [PROMPT_DEBUG] - 包含 JSON 格式: ${hasJsonFormat}`);
                // this.logger.info(`🔍 [PROMPT_DEBUG] - 包含工作流程步骤: ${hasWorkflowSteps}`);
                // this.logger.info(`🔍 [PROMPT_DEBUG] ==========================================`);
                
                // 2. 获取可用工具
                const toolsInfo = await this.toolCacheManager.getTools(CallerType.SPECIALIST);
                const toolsForVSCode = this.convertToolsToVSCodeFormat(toolsInfo.definitions);
                
                // 🔍 [DEBUG] 详细记录可用工具信息
                this.logger.info(`🔍 [TOOLS_DEBUG] === 可用工具信息 for ${specialistId} ===`);
                this.logger.info(`🔍 [TOOLS_DEBUG] 总工具数量: ${toolsForVSCode.length}`);
                
                const toolNames = toolsForVSCode.map(tool => tool.name);
                this.logger.info(`🔍 [TOOLS_DEBUG] 工具列表: ${toolNames.join(', ')}`);
                
                // 检查关键工具是否可用
                const hasCreateNewProject = toolNames.includes('createNewProjectFolder');
                const hasWriteFile = toolNames.includes('writeFile');
                const hasCreateDirectory = toolNames.includes('createDirectory');
                const hasTaskComplete = toolNames.includes('taskComplete');
                
                // this.logger.info(`🔍 [TOOLS_DEBUG] 关键工具检查:`);
                // this.logger.info(`🔍 [TOOLS_DEBUG] - createNewProjectFolder: ${hasCreateNewProject}`);
                // this.logger.info(`🔍 [TOOLS_DEBUG] - writeFile: ${hasWriteFile}`);
                // this.logger.info(`🔍 [TOOLS_DEBUG] - createDirectory: ${hasCreateDirectory}`);
                // this.logger.info(`🔍 [TOOLS_DEBUG] - taskComplete: ${hasTaskComplete}`);
                // this.logger.info(`🔍 [TOOLS_DEBUG] ==========================================`);
                
                // 3. 调用AI
                const messages = [vscode.LanguageModelChatMessage.User(prompt)];
                const requestOptions: vscode.LanguageModelChatRequestOptions = {
                    justification: `执行专家任务: ${specialistId} (迭代 ${iteration})`
                };

                if (toolsForVSCode.length > 0) {
                    requestOptions.tools = toolsForVSCode;
                }

                // 🔍 [DEBUG] 记录AI请求配置
                this.logger.info(`🔍 [AI_REQUEST_DEBUG] === AI 请求配置 ===`);
                this.logger.info(`🔍 [AI_REQUEST_DEBUG] 消息数量: ${messages.length}`);
                this.logger.info(`🔍 [AI_REQUEST_DEBUG] 工具数量: ${requestOptions.tools?.length || 0}`);
                this.logger.info(`🔍 [AI_REQUEST_DEBUG] 工具模式: ${requestOptions.toolMode || '未设置'}`);
                this.logger.info(`🔍 [AI_REQUEST_DEBUG] ================================`);

                const response = await model.sendRequest(messages, requestOptions);
                
                // 4. 处理AI响应
                this.logger.info(`🔍 [DEBUG] Starting to process AI response for ${specialistId} iteration ${iteration}`);
                let result = '';
                let fragmentCount = 0;
                
                for await (const fragment of response.text) {
                    fragmentCount++;
                    result += fragment;
                    // this.logger.info(`🔍 [DEBUG] Received fragment ${fragmentCount}, length: ${fragment.length}, total length so far: ${result.length}`);
                }
                
                this.logger.info(`🔍 [DEBUG] Completed processing AI response. Total fragments: ${fragmentCount}, final length: ${result.length}`);
                this.logger.info(`🔍 [DEBUG] Raw AI Response for ${specialistId}:\n---\n${result}\n---`);

                if (!result.trim()) {
                    this.logger.error(`❌ AI returned empty response for ${specialistId} iteration ${iteration}`);
                    throw new Error(`专家 ${specialistId} 在迭代 ${iteration} 返回了空响应`);
                }

                // 5. 解析AI计划
                this.logger.info(`🔍 [DEBUG] Attempting to parse AI response for ${specialistId}`);
                const aiPlan = this.parseAIResponse(result);
                this.logger.info(`🔍 [DEBUG] AI plan parsing result for ${specialistId}: ${aiPlan ? 'SUCCESS' : 'FAILED'}`);
                if (aiPlan) {
                    this.logger.info(`🔍 [DEBUG] Parsed plan details: has_tool_calls=${!!aiPlan.tool_calls?.length}, has_direct_response=${!!aiPlan.direct_response}, tool_calls_count=${aiPlan.tool_calls?.length || 0}`);
                }
                
                // 6. 详细验证AI计划
                this.logger.info(`🔍 [DEBUG] Validating AI plan for ${specialistId} iteration ${iteration}:`);
                this.logger.info(`🔍 [DEBUG] - aiPlan is null/undefined: ${!aiPlan}`);
                if (aiPlan) {
                    this.logger.info(`🔍 [DEBUG] - aiPlan.tool_calls exists: ${!!aiPlan.tool_calls}`);
                    this.logger.info(`🔍 [DEBUG] - aiPlan.tool_calls.length: ${aiPlan.tool_calls?.length || 0}`);
                    this.logger.info(`🔍 [DEBUG] - aiPlan.direct_response exists: ${!!aiPlan.direct_response}`);
                    this.logger.info(`🔍 [DEBUG] - aiPlan.direct_response length: ${aiPlan.direct_response?.length || 0}`);
                    this.logger.info(`🔍 [DEBUG] - aiPlan keys: ${JSON.stringify(Object.keys(aiPlan))}`);
                    
                    if (aiPlan.tool_calls && Array.isArray(aiPlan.tool_calls) && aiPlan.tool_calls.length > 0) {
                        this.logger.info(`🔍 [DEBUG] - tool_calls details: ${JSON.stringify(aiPlan.tool_calls.map(tc => ({ name: tc.name, hasArgs: !!tc.args })))}`);
                    }
                }
                
                const hasValidToolCalls = aiPlan?.tool_calls && Array.isArray(aiPlan.tool_calls) && aiPlan.tool_calls.length > 0;
                const hasValidDirectResponse = aiPlan?.direct_response && aiPlan.direct_response.trim().length > 0;
                
                this.logger.info(`🔍 [DEBUG] Validation results: hasValidToolCalls=${hasValidToolCalls}, hasValidDirectResponse=${hasValidDirectResponse}`);
                
                if (!aiPlan || (!hasValidToolCalls && !hasValidDirectResponse)) {
                    this.logger.error(`❌ [DEBUG] AI plan validation failed for ${specialistId} iteration ${iteration}`);
                    this.logger.error(`❌ [DEBUG] Failure reason: aiPlan=${!!aiPlan}, hasValidToolCalls=${hasValidToolCalls}, hasValidDirectResponse=${hasValidDirectResponse}`);
                    throw new Error(`专家 ${specialistId} 在迭代 ${iteration} 未提供有效的工具调用或直接响应`);
                }

                // 🚀 移除direct_response路径：所有specialist都必须通过taskComplete工具完成任务
                if ((!aiPlan.tool_calls || aiPlan.tool_calls.length === 0)) {
                    // 没有工具调用意味着specialist没有按照要求的格式输出，应该重试
                    this.logger.warn(`⚠️ 专家 ${specialistId} 未提供工具调用，迭代 ${iteration} 格式错误`);
                    // 继续循环，让specialist重新尝试
                    continue;
                }

                // 7. 执行工具调用
                if (aiPlan.tool_calls && aiPlan.tool_calls.length > 0) {
                    // 🚀 新增：通知工具执行开始
                    progressCallback?.onToolsStart?.(aiPlan.tool_calls);
                    
                    const toolStartTime = Date.now();
                    const toolResults = await this.executeToolCalls(aiPlan.tool_calls);
                    const toolDuration = Date.now() - toolStartTime;
                    
                    // 🚀 新增：通知工具执行完成
                    progressCallback?.onToolsComplete?.(aiPlan.tool_calls, toolResults, toolDuration);
                    const toolsUsed = toolResults.map(result => result.toolName);

                    // 🔄 检查是否有工具需要用户交互
                    const needsInteractionResult = toolResults.find(result => 
                        result.result && typeof result.result === 'object' && 
                        'needsChatInteraction' in result.result && 
                        result.result.needsChatInteraction === true
                    );

                    if (needsInteractionResult) {
                        this.logger.info(`💬 专家 ${specialistId} 需要用户交互，暂停执行`);
                        
                        // 提取问题内容
                        const question = needsInteractionResult.result?.chatQuestion || '需要您的确认';
                        
                        // 返回SpecialistInteractionResult
                        return {
                            success: false,
                            needsChatInteraction: true,
                            question: question,
                            resumeContext: {
                                specialist: specialistId,
                                iteration: iteration,
                                internalHistory: [...internalHistory],
                                currentPlan: aiPlan,
                                contextForThisStep: contextForThisStep,
                                toolResults: toolResults,
                                startTime: startTime
                            }
                        } as SpecialistInteractionResult;
                    }

                    // 检查是否有taskComplete调用（任务完成信号）
                    const taskCompleteResult = toolResults.find(result => 
                        result.toolName === 'taskComplete' && result.success
                    );

                    if (taskCompleteResult) {
                        this.logger.info(`✅ 专家 ${specialistId} 通过taskComplete完成任务，迭代次数: ${iteration}`);
                        
                        // 获取任务结果
                        const taskResult = taskCompleteResult.result;
                        
                        // 🚀 简化：直接使用整个taskResult作为structuredData
                        let structuredData = taskResult;
                        
                        // 🚀 智能判断requires_file_editing：基于specialist类型和工作模式
                        const requiresFileEditing = this.shouldRequireFileEditing(specialistId, toolsUsed);
                        
                        if (requiresFileEditing) {
                            this.logger.info(`🔍 [DEBUG] 基于specialist类型判断requires_file_editing=true: ${specialistId}`);
                        } else {
                            this.logger.info(`🔍 [DEBUG] 基于specialist类型判断requires_file_editing=false: ${specialistId}`);
                        }
                        
                        // 🚀 新增：通知任务完成
                        progressCallback?.onTaskComplete?.(taskResult?.summary || '任务已完成', true);
                        
                        return {
                            success: true,
                            content: taskResult?.summary || '任务已完成',
                            requires_file_editing: requiresFileEditing,
                            edit_instructions: undefined, // specialist直接调用executeSemanticEdits，不再通过taskComplete传递
                            target_file: undefined, // specialist直接调用executeSemanticEdits，不再通过taskComplete传递
                            structuredData: structuredData,
                            metadata: {
                                specialist: specialistId,
                                iterations: iteration,
                                executionTime: Date.now() - startTime,
                                timestamp: new Date().toISOString(),
                                toolsUsed
                            }
                        };
                    }

                    // 🚀 将工具执行结果添加到历史记录，支持specialist的循环迭代 - 使用智能摘要
                    const planSummary = aiPlan?.tool_calls?.map((call: any) => this.summarizeToolCall(call)).join('\n') || '无工具调用';
                    const resultsSummary = toolResults.map(result => this.summarizeToolResult(result)).join('\n');
                    
                    internalHistory.push(`迭代 ${iteration} - AI计划:\n${planSummary}`);
                    internalHistory.push(`迭代 ${iteration} - 工具结果:\n${resultsSummary}`);
                    
                    this.logger.info(`✅ [${specialistId}] 迭代 ${iteration} 记录了 ${toolResults.length} 个工具执行结果`);
                    
                    // 🔍 [DEBUG] 记录完整工具结果到日志（用于调试）
                    this.logger.info(`🔧 [DEBUG] [${specialistId}] 迭代 ${iteration} 工具执行结果:\n${resultsSummary}`);
                }
            }

            // 达到最大迭代次数
            this.logger.warn(`⚠️ 专家 ${specialistId} 达到最大迭代次数 (${MAX_INTERNAL_ITERATIONS})`);
            return {
                success: false,
                requires_file_editing: false, // 🚀 失败情况下设为false
                error: `专家任务超过最大迭代次数 (${MAX_INTERNAL_ITERATIONS})，未能完成`,
                metadata: {
                    specialist: specialistId,
                    iterations: MAX_INTERNAL_ITERATIONS,
                    executionTime: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            this.logger.error(`❌ 专家 ${specialistId} 执行失败`, error as Error);
            return {
                success: false,
                requires_file_editing: false, // 🚀 异常情况下设为false
                error: (error as Error).message,
                metadata: {
                    specialist: specialistId,
                    iterations: 0,
                    executionTime: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * 🚀 新架构：使用PromptAssemblyEngine加载专家提示词
     */
    private async loadSpecialistPrompt(
        specialistId: string, 
        context: any, 
        internalHistory: string[],
        currentIteration?: number,
        maxIterations?: number
    ): Promise<string> {
        try {
            this.logger.info(`🔍 [DEBUG] loadSpecialistPrompt called for: ${specialistId}`);
            
            // 1. 将specialistId映射为SpecialistType
            const specialistType = this.mapSpecialistIdToType(specialistId);
            this.logger.info(`🔍 [DEBUG] Mapped to type: ${JSON.stringify(specialistType)}`);
            
            // 2. 获取可用工具定义 (方案一：为TOOLS_JSON_SCHEMA模板变量准备数据)
            const toolsInfo = await this.toolCacheManager.getTools(CallerType.SPECIALIST);
            this.logger.info(`🛠️ [DEBUG] Retrieved ${toolsInfo.definitions.length} tool definitions for specialist context`);
            this.logger.info(`🔍 [DEBUG] Tools JSON schema length for specialist: ${toolsInfo.jsonSchema.length}`);
            
            // 🚀 2.5. 加载Template文件内容
            const templateFiles = await this.loadTemplateFiles(specialistId);
            
            // 🚀 新增：计算迭代信息
            let iterationInfo = undefined;
            if (currentIteration !== undefined && maxIterations !== undefined) {
                const remainingIterations = maxIterations - currentIteration;
                let phase: 'early' | 'middle' | 'final';
                let strategyGuidance: string;
                
                if (currentIteration <= Math.floor(maxIterations * 0.3)) {
                    phase = 'early';
                    strategyGuidance = 'Early exploration phase. Feel free to gather comprehensive information and explore thoroughly.';
                } else if (currentIteration <= Math.floor(maxIterations * 0.7)) {
                    phase = 'middle';
                    strategyGuidance = 'Active development phase. Balance information gathering with progress toward completion.';
                } else {
                    phase = 'final';
                    strategyGuidance = 'Final phase - limited resources remaining. Prioritize task completion with available information. Consider calling taskComplete soon.';
                }
                
                iterationInfo = {
                    currentIteration,
                    maxIterations,
                    remainingIterations,
                    phase,
                    strategyGuidance
                };
            }

            // 3. 构建SpecialistContext
            const specialistContext: SpecialistContext = {
                userRequirements: context.userInput || context.currentStep?.description || '',
                language: context.currentStep?.language || 'en-US',  // 🚀 新增：language参数传递，默认为en-US
                structuredContext: {
                    currentStep: context.currentStep,
                    dependentResults: context.dependentResults || [],
                    internalHistory: internalHistory
                },
                projectMetadata: {
                    projectName: context.sessionData?.projectName || 'Unknown',
                    baseDir: context.sessionData?.baseDir || '',
                    timestamp: new Date().toISOString()
                },
                // 🚀 新增：迭代状态信息
                iterationInfo,
                // 🚀 方案一实现：直接将工具schema作为模板变量数据传入
                TOOLS_JSON_SCHEMA: toolsInfo.jsonSchema,
                // 🚀 新增：添加template文件内容
                ...templateFiles
            };
            
            // 4. 调用PromptAssemblyEngine组装提示词
            this.logger.info(`🔍 [DEBUG] Calling promptAssemblyEngine.assembleSpecialistPrompt...`);
            this.logger.info(`🔍 [DEBUG] SpecialistContext contains TOOLS_JSON_SCHEMA: ${!!specialistContext.TOOLS_JSON_SCHEMA}`);
            const assembledPrompt = await this.promptAssemblyEngine.assembleSpecialistPrompt(
                specialistType,
                specialistContext
            );
            
            this.logger.info(`🔍 [DEBUG] PromptAssemblyEngine assembled prompt successfully, length: ${assembledPrompt.length}`);
            this.logger.info(`✅ 使用PromptAssemblyEngine组装专家提示词: ${specialistId}`);
            
            return assembledPrompt;
            
        } catch (error) {
            this.logger.error(`❌ PromptAssemblyEngine组装失败，回退到传统方式: ${specialistId}`, error as Error);
            
            // 回退到原有的文件加载方式
            return await this.loadSpecialistPromptFallback(specialistId, context, internalHistory, currentIteration, maxIterations);
        }
    }

    /**
     * 根据specialistId获取对应的文件名
     */
    private getSpecialistFileName(specialistId: string): string {
        const fileMapping: { [key: string]: string } = {
            'help_response': 'help_response.md',
            'complexity_classification': 'ComplexityClassification.md',
            
            // 新的content类specialist
            'project_initializer': 'content/project_initializer.md',  // 🚀 新增
            'summary_writer': 'content/summary_writer.md',
            'overall_description_writer': 'content/overall_description_writer.md',
            'fr_writer': 'content/fr_writer.md',
            'nfr_writer': 'content/nfr_writer.md',
            'user_journey_writer': 'content/user_journey_writer.md',
            'journey_writer': 'content/user_journey_writer.md', // 别名
            'prototype_designer': 'content/prototype_designer.md',
            
            // 新的process类specialist
            'requirement_syncer': 'process/requirement_syncer.md',
            'document_formatter': 'process/document_formatter.md',
            'doc_formatter': 'process/document_formatter.md', // 别名
            'git_operator': 'process/git_operator.md'
        };
        
        return fileMapping[specialistId] || `${specialistId}.md`;
    }

    /**
     * 查找专家文件路径
     */
    private async findSpecialistFile(fileName: string): Promise<string | null> {
        // 构建可能的路径（包括扩展安装路径）
        let possiblePaths: string[] = [];
        
        try {
            const extension = vscode.extensions.getExtension('testany-co.srs-writer-plugin');
            if (extension) {
                // 优先使用扩展路径
                possiblePaths.push(path.join(extension.extensionPath, `rules/specialists/${fileName}`));
            }
        } catch (error) {
            this.logger.warn('无法获取扩展路径，使用备用路径');
        }
        
        // 添加其他可能的路径
        possiblePaths.push(
            path.join(__dirname, `../../rules/specialists/${fileName}`),
            path.join(__dirname, `../rules/specialists/${fileName}`),
            path.join(__dirname, `rules/specialists/${fileName}`),
            path.join(process.cwd(), `rules/specialists/${fileName}`)
        );
        
        // 查找第一个存在的文件
        for (const filePath of possiblePaths) {
            if (fs.existsSync(filePath)) {
                this.logger.info(`✅ 找到专家文件: ${filePath}`);
                return filePath;
            }
        }
        
        this.logger.warn(`❌ 未找到专家文件: ${fileName}，搜索路径: ${possiblePaths.join(', ')}`);
        return null;
    }

    /**
     * 替换提示词模板中的变量
     */
    private replaceTemplateVariables(
        promptTemplate: string, 
        context: any, 
        internalHistory: string[]
    ): string {
        let result = promptTemplate;
        
        // 基本变量替换
        result = result.replace(/\{\{INITIAL_USER_REQUEST\}\}/g, context.userInput || '');
        result = result.replace(/\{\{CURRENT_USER_RESPONSE\}\}/g, context.currentUserResponse || context.userResponse || '');
        result = result.replace(/\{\{PROJECT_NAME\}\}/g, context.sessionData?.projectName || 'Unknown');
        result = result.replace(/\{\{BASE_DIR\}\}/g, context.sessionData?.baseDir || '');
        result = result.replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString());
        result = result.replace(/\{\{DATE\}\}/g, new Date().toISOString().split('T')[0]);
        
        // 🚀 新增：用户回复相关变量
        if (context.userResponse) {
            result = result.replace(/\{\{USER_RESPONSE\}\}/g, context.userResponse);
        } else {
            result = result.replace(/\{\{USER_RESPONSE\}\}/g, '');
        }
        
        // 🚀 新增：恢复指导信息
        if (context.resumeGuidance) {
            const resumeGuidanceText = `
## 🔄 恢复执行指导

**恢复原因**: ${context.resumeGuidance.resumeReason || 'user_response_received'}
**用户问题**: ${context.resumeGuidance.userQuestion || '无'}
**用户回复**: ${context.resumeGuidance.userAnswer || '无'}

**继续执行指导**:
${context.resumeGuidance.continueInstructions?.map((instruction: string, index: number) => 
    `${index + 1}. ${instruction}`).join('\n') || '请基于用户回复继续您的工作'}
`;
            result = result.replace(/\{\{RESUME_GUIDANCE\}\}/g, resumeGuidanceText);
        } else {
            result = result.replace(/\{\{RESUME_GUIDANCE\}\}/g, '');
        }
        
        // 当前步骤信息
        if (context.currentStep) {
            result = result.replace(/\{\{CURRENT_STEP_DESCRIPTION\}\}/g, context.currentStep.description || '');
            result = result.replace(/\{\{EXPECTED_OUTPUT\}\}/g, context.currentStep.expectedOutput || '');
        }
        
        // 依赖结果
        const dependentResultsText = context.dependentResults && context.dependentResults.length > 0
            ? context.dependentResults.map((dep: any) => 
                `步骤${dep.step} (${dep.specialist}): ${dep.content || JSON.stringify(dep.structuredData)}`
              ).join('\n\n')
            : '无依赖的上步结果';
        
        result = result.replace(/\{\{DEPENDENT_RESULTS\}\}/g, dependentResultsText);
        
        // 内部历史
        const historyText = internalHistory.length > 0 
            ? internalHistory.join('\n\n') 
            : '无内部迭代历史';
        
        result = result.replace(/\{\{INTERNAL_HISTORY\}\}/g, historyText);
        
        return result;
    }

    /**
     * 构建默认提示词（当文件加载失败时）
     */
    private buildDefaultPrompt(specialistId: string, context: any, internalHistory: string[]): string {
        return `# 专家任务: ${specialistId}

## 用户请求
${context.userInput || '未提供用户输入'}

## 当前步骤
${context.currentStep?.description || '未指定步骤描述'}

## 依赖结果
${context.dependentResults?.length > 0 
    ? context.dependentResults.map((dep: any) => `步骤${dep.step}: ${dep.content}`).join('\n')
    : '无依赖结果'
}

## 任务要求
请根据用户请求和当前步骤描述，执行专家任务 "${specialistId}"。

## 输出要求
1. 如果需要使用工具，请调用相应的工具
2. 完成任务后，请调用 taskComplete 工具并提供完整的结果摘要
3. 确保输出内容符合步骤期望：${context.currentStep?.expectedOutput || '未指定'}

请开始执行任务。`;
    }

    /**
     * 将工具定义转换为VSCode格式
     */
    private convertToolsToVSCodeFormat(toolDefinitions: any[]): vscode.LanguageModelChatTool[] {
        return toolDefinitions.map(tool => ({
            name: tool.name,
            description: tool.description,
            parametersSchema: tool.parametersSchema || tool.parameters || {}
        }));
    }

    /**
     * 🚀 多策略AI响应解析 - 防御纵深设计
     * 策略1: Markdown代码块 → 策略2: 平衡JSON → 策略3: 贪婪提取 → 策略4: 直接响应降级
     */
    private parseAIResponse(aiResponse: string): { tool_calls?: Array<{ name: string; args: any }>; direct_response?: string; content?: string; structuredData?: any } | null {
        this.logger.info(`🔍 [DEBUG] Starting multi-strategy parsing for response (length: ${aiResponse.length})`);

        // 策略1: 优先尝试解析Markdown代码块中的JSON
        const markdownMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
        if (markdownMatch && markdownMatch[1]) {
            this.logger.info(`🔍 [DEBUG] Strategy 1: Found JSON in Markdown code block.`);
            const parsed = this.tryParseWithRepair(markdownMatch[1]);
            if (this.isValidPlan(parsed)) {
                this.logger.info(`✅ [DEBUG] Strategy 1 successful - using Markdown code block result`);
                return this.standardizeOutput(parsed, aiResponse);
            }
        }

        // 策略2: 尝试寻找一个括号平衡的JSON对象
        const balancedJson = this.findBalancedJson(aiResponse);
        if (balancedJson) {
            this.logger.info(`🔍 [DEBUG] Strategy 2: Found a balanced JSON object (length: ${balancedJson.length}).`);
            const parsed = this.tryParseWithRepair(balancedJson);
            if (this.isValidPlan(parsed)) {
                this.logger.info(`✅ [DEBUG] Strategy 2 successful - using balanced JSON result`);
                return this.standardizeOutput(parsed, aiResponse);
            }
        }

        // 策略3: 最后的贪婪提取（作为降级）
        const firstBrace = aiResponse.indexOf('{');
        const lastBrace = aiResponse.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            this.logger.info(`🔍 [DEBUG] Strategy 3: Using greedy extraction (${firstBrace} to ${lastBrace}).`);
            const greedyJson = aiResponse.substring(firstBrace, lastBrace + 1);
            const parsed = this.tryParseWithRepair(greedyJson);
            if (this.isValidPlan(parsed)) {
                this.logger.info(`✅ [DEBUG] Strategy 3 successful - using greedy extraction result`);
                return this.standardizeOutput(parsed, aiResponse);
            }
        }

        // 策略4: 所有策略失败，降级为直接响应
        this.logger.warn(`⚠️ All parsing strategies failed. Falling back to direct response.`);
        this.logger.info(`🔍 [DEBUG] Fallback: treating entire response as direct_response`);
        return { direct_response: aiResponse };
    }

    /**
     * 辅助方法：尝试用jsonrepair解析JSON文本
     */
    private tryParseWithRepair(jsonText: string): any | null {
        try {
            this.logger.info(`🔍 [DEBUG] Attempting to parse JSON text (length: ${jsonText.length})`);
            this.logger.info(`🔍 [DEBUG] JSON preview: ${jsonText.substring(0, 200)}...`);
            
            const repairedJsonText = jsonrepair(jsonText);
            this.logger.info(`🔍 [DEBUG] JSON repair completed. Repaired length: ${repairedJsonText.length}`);
            
            const parsed = JSON.parse(repairedJsonText);
            this.logger.info(`🔍 [DEBUG] JSON.parse successful. Object keys: ${JSON.stringify(Object.keys(parsed || {}))}`);
            
            return parsed;
        } catch (error) {
            this.logger.warn(`❌ [DEBUG] Parsing failed even after repair: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * 辅助方法：检查解析出的对象是否是有效的计划
     */
    private isValidPlan(parsed: any): boolean {
        if (!parsed || typeof parsed !== 'object') {
            this.logger.info(`🔍 [DEBUG] isValidPlan: Invalid object type`);
            return false;
        }
        
        // 一个有效的计划，要么有tool_calls，要么有我们期望的content/direct_response
        const hasTools = parsed.tool_calls && Array.isArray(parsed.tool_calls) && parsed.tool_calls.length > 0;
        const hasContent = (typeof parsed.content === 'string' && parsed.content.trim().length > 0) || 
                          (typeof parsed.direct_response === 'string' && parsed.direct_response.trim().length > 0);
        
        this.logger.info(`🔍 [DEBUG] isValidPlan: hasTools=${hasTools}, hasContent=${hasContent}`);
        return hasTools || hasContent;
    }

    /**
     * 辅助方法：将不同格式的解析结果标准化
     */
    private standardizeOutput(parsed: any, rawResponse: string): { tool_calls?: Array<{ name: string; args: any }>; direct_response?: string; content?: string; structuredData?: any } {
        this.logger.info(`🔍 [DEBUG] Standardizing output from parsed object`);
        
        // 如果解析出的对象本身就是我们期望的格式，进行标准化处理
        if (this.isValidPlan(parsed)) {
            const result = {
                content: parsed.content,
                structuredData: parsed.structuredData,
                direct_response: parsed.direct_response || parsed.content,
                tool_calls: parsed.tool_calls
            };
            
            this.logger.info(`✅ [DEBUG] Standardized output: content=${!!result.content}, structuredData=${!!result.structuredData}, direct_response=${!!result.direct_response}, tool_calls=${result.tool_calls?.length || 0}`);
            return result;
        }
        
        // 降级处理
        this.logger.warn(`⚠️ [DEBUG] Standardization failed, falling back to raw response`);
        return { direct_response: rawResponse };
    }

    /**
     * 辅助方法：查找括号平衡的JSON对象
     */
    private findBalancedJson(text: string): string | null {
        this.logger.info(`🔍 [DEBUG] Searching for balanced JSON in text...`);
        
        let braceCount = 0;
        let startIndex = -1;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            // 处理字符串内的字符（避免被字符串内的花括号干扰）
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            
            if (char === '"' && !escapeNext) {
                inString = !inString;
                continue;
            }
            
            // 只在字符串外处理花括号
            if (!inString) {
                if (char === '{') {
                    if (startIndex === -1) {
                        startIndex = i;
                        this.logger.info(`🔍 [DEBUG] Found potential JSON start at position ${i}`);
                    }
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                    if (braceCount === 0 && startIndex !== -1) {
                        // 找到平衡的JSON对象
                        const jsonCandidate = text.substring(startIndex, i + 1);
                        this.logger.info(`✅ [DEBUG] Found balanced JSON object: length=${jsonCandidate.length}, start=${startIndex}, end=${i}`);
                        return jsonCandidate;
                    }
                }
            }
        }
        
        this.logger.info(`❌ [DEBUG] No balanced JSON object found`);
        return null; // 未找到平衡的JSON
    }

    /**
     * 🚀 智能工具调用摘要 - 专门处理臃肿工具的简化显示
     */
    private summarizeToolCall(toolCall: { name: string; args: any }): string {
        const { name, args } = toolCall;
        
        // 对于需要简化的工具，使用 description
        switch (name) {
            case 'executeMarkdownEdits':
                const description = args.description || '未提供描述';
                const intentCount = args.intents?.length || 0;
                const targetFile = args.targetFile?.split('/').pop() || '未知文件';
                return `${name}: ${description} (${intentCount}个编辑操作 -> ${targetFile})`;
                
            case 'executeYAMLEdits':
                const yamlDesc = args.description || '未提供描述';
                const editCount = args.edits?.length || 0;
                const yamlFile = args.targetFile?.split('/').pop() || '未知文件';
                return `${name}: ${yamlDesc} (${editCount}个编辑操作 -> ${yamlFile})`;
                
            default:
                // 其他工具保持原有的完整格式
                return `${name}: ${JSON.stringify(args)}`;
        }
    }

    /**
     * 🚀 智能工具结果摘要 - 专门处理臃肿工具的简化显示
     */
    private summarizeToolResult(result: any): string {
        const { toolName, success } = result;
        
        // 只对这两个臃肿工具进行简化显示
        switch (toolName) {
            case 'executeMarkdownEdits':
                if (!success) {
                    return `${toolName}: ❌ 失败 - ${result.result?.error || '未知错误'}`;
                }
                const appliedCount = result.result?.appliedIntents?.length || 0;
                const metadata = result.result?.metadata;
                const execTime = metadata?.executionTime || 0;
                return `${toolName}: ✅ 成功 - 应用${appliedCount}个编辑操作 (${execTime}ms)`;
                
            case 'executeYAMLEdits':
                if (!success) {
                    return `${toolName}: ❌ 失败 - ${result.result?.error || '未知错误'}`;
                }
                const yamlAppliedCount = result.result?.appliedEdits?.length || 0;
                return `${toolName}: ✅ 成功 - 应用${yamlAppliedCount}个YAML编辑操作`;
                
            default:
                // 其他工具保持原有的完整格式（包括失败情况）
                return `工具: ${toolName}, 成功: ${success}, 结果: ${JSON.stringify(result.result)}`;
        }
    }

    /**
     * 执行工具调用
     * 🚀 重大修复：使用 toolExecutor 获得正确的业务成功状态检测
     */
    private async executeToolCalls(toolCalls: Array<{ name: string; args: any }>): Promise<Array<{
        toolName: string;
        success: boolean;
        result?: any;
        error?: string;
    }>> {
        const results: Array<{ toolName: string; success: boolean; result?: any; error?: string }> = [];

        for (const toolCall of toolCalls) {
            try {
                this.logger.info(`🔧 执行工具: ${toolCall.name}`);
                
                // 🚀 关键修复：使用 toolExecutor 而不是直接调用 toolRegistry
                // 这样能获得正确的业务成功状态检测，与其他组件保持一致
                const executionResult = await this.toolExecutor.executeTool(
                    toolCall.name, 
                    toolCall.args,
                    CallerType.SPECIALIST  // 保持访问控制一致性
                );
                
                results.push({
                    toolName: toolCall.name,
                    success: executionResult.success,    // 👈 现在是真正的业务成功状态！
                    result: executionResult.result,
                    error: executionResult.error
                });
                
                // 🚀 日志也变准确了：区分业务成功和失败
                if (executionResult.success) {
                    this.logger.info(`✅ 工具 ${toolCall.name} 业务操作成功`);
                } else {
                    this.logger.warn(`❌ 工具 ${toolCall.name} 业务操作失败: ${executionResult.error}`);
                }
                
            } catch (error) {
                // 这里只处理调用层面的异常（网络错误、工具不存在、权限错误等）
                const e = error as Error;
                const originalError = e.message;
                
                // 🚀 智能错误增强机制 - Phase 1 & 2
                // 将技术错误转换为AI可理解的行动指导
                let enhancedErrorMessage = this.enhanceErrorMessage(toolCall.name, originalError);
                
                this.logger.error(`❌ 工具 ${toolCall.name} 调用异常`, e);
                this.logger.info(`🔍 错误增强: "${originalError}" => "${enhancedErrorMessage}"`);
                
                results.push({
                    toolName: toolCall.name,
                    success: false,
                    error: enhancedErrorMessage
                });
            }
        }

        return results;
    }

    /**
     * 🚀 智能错误增强机制 - Phase 1 & 2
     * 将技术错误转换为AI可理解的行动指导
     */
    private enhanceErrorMessage(toolName: string, originalError: string): string {
        const errorLower = originalError.toLowerCase();
        
        // ====== Phase 1: 战略性错误（AI必须改变策略）======
        
        // 1. 工具不存在错误 - 最高优先级
        if (originalError.includes('Tool implementation not found')) {
            return `CRITICAL ERROR: Tool '${toolName}' does not exist in the system. This is NOT a temporary failure. You MUST:
1. Stop retrying this tool immediately
2. Review your available tool list carefully
3. Select a valid tool name to accomplish your task
4. Do NOT attempt to use '${toolName}' again
Original error: ${originalError}`;
        }
        
        // 2. 参数相关错误
        if (errorLower.includes('missing required parameter') || 
            errorLower.includes('parameter') && errorLower.includes('required')) {
            return `PARAMETER ERROR: Tool '${toolName}' is missing required parameters. This is a format issue, NOT a system failure. You MUST:
1. Check the tool's parameter schema carefully
2. Provide ALL required arguments with correct types
3. Retry with properly formatted parameters
Original error: ${originalError}`;
        }
        
        // 3. 工作区错误
        if (errorLower.includes('workspace') || errorLower.includes('工作区') || 
            originalError.includes('No workspace folder is open')) {
            return `WORKSPACE ERROR: No workspace is open or accessible. This requires USER ACTION, not retrying. You SHOULD:
1. Inform the user that a workspace folder must be opened
2. Ask the user to open a project folder in VS Code
3. Do NOT retry this operation until workspace is available
Original error: ${originalError}`;
        }
        
        // ====== Phase 2: 配置和操作错误 ======
        
        // 4. 文件操作错误
        if (errorLower.includes('file not found') || errorLower.includes('无法读取文件') ||
            errorLower.includes('enoent') || errorLower.includes('path') && errorLower.includes('not found')) {
            return `FILE ERROR: File or path does not exist. This is a path issue, NOT a temporary failure. You SHOULD:
1. Verify the file path is correct
2. Use a file listing tool to check available files
3. Create the file first if it needs to exist
4. Do NOT retry with the same invalid path
Original error: ${originalError}`;
        }
        
        // 5. 权限错误
        if (errorLower.includes('permission') || errorLower.includes('access denied') ||
            errorLower.includes('eacces') || errorLower.includes('unauthorized')) {
            return `PERMISSION ERROR: Access denied due to insufficient permissions. This is a system configuration issue that retrying won't fix. You SHOULD:
1. Inform the user about the permission issue
2. Suggest the user check file/folder permissions
3. Do NOT retry the same operation
Original error: ${originalError}`;
        }
        
        // 6. 行号范围错误（编辑相关）
        if (errorLower.includes('行号') && errorLower.includes('超出') ||
            errorLower.includes('line number') && errorLower.includes('out of range')) {
            return `EDIT ERROR: Line number is out of file range. This is a calculation error, NOT a system failure. You MUST:
1. Read the target file first to get correct line counts
2. Recalculate the line numbers based on actual file content
3. Retry with valid line numbers within file range
Original error: ${originalError}`;
        }
        
        // 7. JSON格式错误
        if (errorLower.includes('json') && (errorLower.includes('parse') || errorLower.includes('invalid') || errorLower.includes('syntax'))) {
            return `FORMAT ERROR: Invalid JSON format in tool parameters. This is a syntax error, NOT a system failure. You MUST:
1. Review and fix the JSON structure in your tool call
2. Ensure proper quotes, brackets, and commas
3. Retry with correctly formatted JSON
Original error: ${originalError}`;
        }
        
        // 8. 语义编辑特定错误
        if (errorLower.includes('semantic editing failed') || errorLower.includes('语义编辑失败')) {
            return `SEMANTIC EDIT ERROR: Semantic editing approach failed. You SHOULD try alternative approach:
1. Use traditional line-based editing instead
2. Read the file first to get specific line numbers
3. Create precise line-by-line edit instructions
4. Do NOT retry semantic editing for this content
Original error: ${originalError}`;
        }
        
        // 9. 编辑指令格式错误
        if (errorLower.includes('指令') && (errorLower.includes('格式') || errorLower.includes('无效')) ||
            errorLower.includes('instruction') && errorLower.includes('invalid')) {
            return `EDIT INSTRUCTION ERROR: Edit instruction format is invalid. This is a structure error, NOT a system failure. You MUST:
1. Review the required edit instruction format
2. Ensure all required fields are present (action, lines, content)
3. Use correct action types ('insert' or 'replace')
4. Retry with properly structured edit instructions
Original error: ${originalError}`;
        }
        
        // ====== 默认增强（未匹配的错误）======
        // 为未明确分类的错误提供基本指导
        return `EXECUTION ERROR: Tool '${toolName}' failed with: ${originalError}

SUGGESTED ACTIONS:
1. Check if the tool parameters are correctly formatted
2. Verify any file paths or references exist
3. Consider if the operation requires specific prerequisites
4. If error persists, try a different approach or inform the user`;
    }

    // ============================================================================
    // 🚀 Phase 4新增：语义编辑支持
    // ============================================================================

    /**
     * 处理编辑指令，智能检测并转换语义编辑格式
     */
    private processEditInstructions(editInstructions: any[]): any[] {
        if (!editInstructions || !Array.isArray(editInstructions)) {
            return editInstructions;
        }

        this.logger.info(`🔍 [Phase4] Processing ${editInstructions.length} edit instructions for semantic format detection`);

        const processedInstructions = editInstructions.map((instruction, index) => {
            // 检测语义编辑格式
            if (this.isSemanticEditInstruction(instruction)) {
                this.logger.info(`✅ [Phase4] Instruction ${index + 1} identified as semantic edit: ${instruction.type} -> ${instruction.target?.path?.join(' > ') || 'unknown path'}`);
                
                // 验证语义编辑指令的完整性
                const validationResult = this.validateSemanticEditInstruction(instruction);
                if (!validationResult.valid) {
                    this.logger.warn(`⚠️ [Phase4] Semantic edit instruction ${index + 1} validation failed: ${validationResult.errors.join(', ')}`);
                    // 返回原始指令，让后续处理决定如何处理
                    return instruction;
                }

                // 标记为语义编辑格式
                return {
                    ...instruction,
                    _semanticEdit: true,
                    _processed: true
                };
            } 
            // 传统行号编辑格式
            else if (this.isTraditionalEditInstruction(instruction)) {
                this.logger.info(`📝 [Phase4] Instruction ${index + 1} identified as traditional edit: ${instruction.action}`);
                return {
                    ...instruction,
                    _semanticEdit: false,
                    _processed: true
                };
            } 
            // 未识别的格式
            else {
                this.logger.warn(`❓ [Phase4] Instruction ${index + 1} format not recognized, keeping as-is`);
                return instruction;
            }
        });

        // 统计处理结果
        const semanticCount = processedInstructions.filter(i => i._semanticEdit === true).length;
        const traditionalCount = processedInstructions.filter(i => i._semanticEdit === false).length;
        const unknownCount = processedInstructions.filter(i => !i._processed).length;

        this.logger.info(`📊 [Phase4] Edit instructions processing summary: ${semanticCount} semantic, ${traditionalCount} traditional, ${unknownCount} unknown format`);

        return processedInstructions;
    }

    /**
     * 检测是否为语义编辑指令
     */
    private isSemanticEditInstruction(instruction: any): boolean {
        if (!instruction || typeof instruction !== 'object') {
            return false;
        }

        // 必须有type字段且值在支持的语义编辑类型中
        const semanticTypes = [
            'replace_entire_section_with_title',
            'replace_lines_in_section',
            'insert_entire_section',
            'insert_lines_in_section'
        ];

        // 基本字段验证
        const hasValidType = semanticTypes.includes(instruction.type);
        const hasValidTarget = instruction.target && 
                              Array.isArray(instruction.target.path) &&
                              instruction.target.path.length > 0;

        // 条件验证：replace_lines_in_section 需要 targetContent
        if (instruction.type === 'replace_lines_in_section') {
            return hasValidType && hasValidTarget && 
                   instruction.target.targetContent && 
                   typeof instruction.target.targetContent === 'string';
        }

        return hasValidType && hasValidTarget;
    }

    /**
     * 检测是否为传统行号编辑指令
     */
    private isTraditionalEditInstruction(instruction: any): boolean {
        if (!instruction || typeof instruction !== 'object') {
            return false;
        }

        return (instruction.action === 'insert' || instruction.action === 'replace') &&
               Array.isArray(instruction.lines) &&
               typeof instruction.content === 'string';
    }

    /**
     * 验证语义编辑指令的完整性
     */
    private validateSemanticEditInstruction(instruction: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 验证必需字段
        if (!instruction.type) {
            errors.push('Missing type field');
        }

        if (!instruction.target || !Array.isArray(instruction.target.path) || instruction.target.path.length === 0) {
            errors.push('Missing target.path field (required array with at least one element)');
        }

        if (typeof instruction.content !== 'string') {
            errors.push('Content must be a string');
        }

        if (!instruction.reason) {
            errors.push('Missing reason field');
        }

        // 验证type值
        const validTypes = ['replace_entire_section_with_title', 'replace_lines_in_section', 'insert_entire_section', 'insert_lines_in_section'];
        if (instruction.type && !validTypes.includes(instruction.type)) {
            errors.push(`Invalid type: ${instruction.type}. Valid types are: ${validTypes.join(', ')}`);
        }

        // 条件验证：replace_lines_in_section 必须有 targetContent
        if (instruction.type === 'replace_lines_in_section') {
            if (!instruction.target || !instruction.target.targetContent) {
                errors.push('replace_lines_in_section operation requires target.targetContent field');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 🚀 智能判断specialist是否需要文件编辑：基于类型和工作模式
     */
    private shouldRequireFileEditing(specialistId: string, toolsUsed: string[]): boolean {
        // 1. 直接执行工具的specialist（无论content还是process）
        const directExecutionSpecialists = [
            'project_initializer',  // 混合型content specialist
            'git_operator',         // process specialist
            'document_formatter',   // process specialist  
            'requirement_syncer'    // process specialist
        ];
        
        // 2. 纯决策型content specialist
        const decisionOnlySpecialists = [
            'summary_writer',
            'fr_writer', 
            'nfr_writer',
            'user_journey_writer',
            'overall_description_writer',
            'prototype_designer'
        ];
        
        // 3. 不涉及文件操作的specialist
        const nonFileSpecialists = [
            'help_response',
            'complexity_classification'
        ];
        
        const fileOperationTools = ['writeFile', 'createFile', 'appendTextToFile', 'createDirectory', 'createNewProjectFolder', 'renameFile'];
        const usedFileTools = toolsUsed.some(tool => fileOperationTools.includes(tool));
        
        if (directExecutionSpecialists.includes(specialistId)) {
            // 直接执行工具的specialist，即使使用文件工具也不需要edit_instructions
            this.logger.info(`🔧 [shouldRequireFileEditing] ${specialistId} 是直接执行型specialist，无需edit_instructions`);
            return false;
        } else if (decisionOnlySpecialists.includes(specialistId)) {
            // 纯决策型specialist，如果使用了文件工具则需要edit_instructions
            this.logger.info(`🔧 [shouldRequireFileEditing] ${specialistId} 是决策型specialist，文件工具使用: ${usedFileTools}`);
            return usedFileTools;
        } else if (nonFileSpecialists.includes(specialistId)) {
            // 不涉及文件的specialist
            this.logger.info(`🔧 [shouldRequireFileEditing] ${specialistId} 是非文件操作specialist`);
            return false;
        } else {
            // 未知specialist，保守判断
            this.logger.warn(`⚠️ [shouldRequireFileEditing] 未知specialist类型: ${specialistId}，基于工具使用保守判断`);
            return usedFileTools;
        }
    }

    /**
     * 将specialistId映射为SpecialistType
     */
    private mapSpecialistIdToType(specialistId: string): SpecialistType {
        // Content Specialists
        const contentSpecialists = [
            'project_initializer',  // 🚀 新增
            'summary_writer', 'overall_description_writer', 'fr_writer', 
            'nfr_writer', 'user_journey_writer', 'journey_writer', 'prototype_designer'
        ];
        
        // Process Specialists  
        const processSpecialists = [
            'requirement_syncer', 'document_formatter', 'doc_formatter', 'git_operator'
        ];
        
        if (contentSpecialists.includes(specialistId)) {
            return {
                name: specialistId,
                category: 'content'
            };
        } else if (processSpecialists.includes(specialistId)) {
            return {
                name: specialistId,
                category: 'process'
            };
        } else {
            // 默认为content类型
            this.logger.warn(`未知的specialistId: ${specialistId}，默认为content类型`);
            return {
                name: specialistId,
                category: 'content'
            };
        }
    }

    /**
     * 回退方法：原有的文件加载方式
     */
    private async loadSpecialistPromptFallback(
        specialistId: string, 
        context: any, 
        internalHistory: string[],
        currentIteration?: number,
        maxIterations?: number
    ): Promise<string> {
        try {
            const fileName = this.getSpecialistFileName(specialistId);
            const specialistPath = await this.findSpecialistFile(fileName);
            
            if (!specialistPath) {
                this.logger.warn(`专家提示词文件未找到: ${fileName}，使用默认模板`);
                return this.buildDefaultPrompt(specialistId, context, internalHistory);
            }
            
            let promptTemplate = fs.readFileSync(specialistPath, 'utf8');
            promptTemplate = this.replaceTemplateVariables(promptTemplate, context, internalHistory);
            
            this.logger.info(`从文件加载专家提示词: ${specialistPath}`);
            return promptTemplate;
            
        } catch (error) {
            this.logger.error(`回退加载专家提示词失败 ${specialistId}`, error as Error);
            return this.buildDefaultPrompt(specialistId, context, internalHistory);
        }
    }

    /**
     * 🚀 新增：加载templates目录中的模板文件
     */
    private async loadTemplateFiles(specialistId: string): Promise<Record<string, string>> {
        const templateFiles: Record<string, string> = {};
        
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                this.logger.warn('No workspace folder available for template loading');
                return templateFiles;
            }

            // 根据specialist类型确定需要加载的模板
            const templateMap = this.getTemplateFileMap(specialistId);
            
            for (const [variableName, relativePath] of Object.entries(templateMap)) {
                try {
                    const templateUri = vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
                    const fileData = await vscode.workspace.fs.readFile(templateUri);
                    const content = new TextDecoder().decode(fileData);
                    templateFiles[variableName] = content;
                    
                    this.logger.info(`✅ 加载模板文件: ${variableName} -> ${relativePath}`);
                } catch (error) {
                    this.logger.warn(`⚠️ 模板文件加载失败: ${relativePath}, 使用空内容`);
                    templateFiles[variableName] = '';
                }
            }
            
        } catch (error) {
            this.logger.error('Template files loading failed', error as Error);
        }
        
        return templateFiles;
    }

    /**
     * 🚀 获取specialist对应的模板文件映射（从VSCode配置读取）
     */
    private getTemplateFileMap(specialistId: string): Record<string, string> {
        try {
            const config = vscode.workspace.getConfiguration('srs-writer.templates');
            
            const configMap: Record<string, string> = {
                'fr_writer': 'frWriter',
                'nfr_writer': 'nfrWriter',
                'summary_writer': 'summaryWriter',
                'user_journey_writer': 'userJourneyWriter',
                'overall_description_writer': 'overallDescWriter'
            };
            
            const configKey = configMap[specialistId];
            if (configKey) {
                const templateConfig = config.get(configKey, {});
                this.logger.info(`📋 加载${specialistId}的模板配置: ${JSON.stringify(templateConfig)}`);
                return templateConfig as Record<string, string>;
            }
            
            this.logger.warn(`⚠️ 未找到${specialistId}的模板配置`);
            return {};
            
        } catch (error) {
            this.logger.error('Failed to read template configuration', error as Error);
            return {};
        }
    }
} 