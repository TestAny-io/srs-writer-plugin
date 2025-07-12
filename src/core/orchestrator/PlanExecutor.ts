import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { SessionContext } from '../../types/session';
import { SpecialistOutput, SpecialistLoopState, SpecialistExecutionHistory } from '../../types/index';
import { SpecialistExecutor } from '../specialistExecutor';
// 🚀 Phase 1新增：编辑指令支持（传统）
import { executeEditInstructions } from '../../tools/atomic/edit-execution-tools';
// 🚀 Phase 4新增：统一编辑执行器（支持语义编辑）
import { executeUnifiedEdits } from '../../tools/atomic/unified-edit-executor';

/**
 * 🚀 新增：specialist输出验证结果
 */
interface ValidationResult {
    success: boolean;
    shouldRetry: boolean;
    reason?: string;
    errorType?: FailureType;
}

/**
 * 🚀 新增：失败类型分类
 */
enum FailureType {
    FORMAT_ERROR = "format_error",           // ✅ 值得重试：JSON格式问题
    MISSING_FIELD = "missing_field",         // ✅ 值得重试：缺少required字段
    INVALID_EDITING = "invalid_editing",     // ✅ 值得重试：说要编辑但没提供指令
    TOOL_FAILURE = "tool_failure",           // ❌ 不重试：工具调用失败
    TIMEOUT = "timeout",                     // ❌ 不重试：超时
    MODEL_ERROR = "model_error"              // ❌ 不重试：模型本身错误
}

/**
 * 🚀 计划执行器 - 新架构的核心
 * 
 * 职责：
 * - 接收来自Orchestrator的execution_plan
 * - 按步骤顺序执行多个specialist
 * - 管理步骤间的上下文依赖关系
 * - 处理执行失败和错误恢复
 * - 🚀 新增：管理specialist自循环迭代状态
 */
export class PlanExecutor {
    private logger = Logger.getInstance();
    
    /**
     * 🚀 新增：specialist循环状态管理
     * Key: specialistId (如 "summary_writer")
     * Value: 该specialist的循环状态
     */
    private specialistLoopStates: Map<string, SpecialistLoopState> = new Map();

    constructor(
        private specialistExecutor: SpecialistExecutor
    ) {
        // 初始化specialist循环状态管理器
        this.specialistLoopStates = new Map();
    }

    /**
     * 执行完整的计划
     * @param plan 来自AI的执行计划
     * @param sessionContext 初始会话上下文
     * @param selectedModel VSCode语言模型
     * @param userInput 用户的原始输入
     */
    public async execute(
        plan: { planId: string; description: string; steps: any[] },
        sessionContext: SessionContext,
        selectedModel: vscode.LanguageModelChat,
        userInput: string
    ): Promise<{ intent: string; result?: any }> {
        this.logger.info(`🚀 执行计划: ${plan.description} (${plan.steps.length}个步骤)`);
        this.logger.info(`🔍 [DEBUG] PlanExecutor.execute called with:`);
        this.logger.info(`🔍 [DEBUG] - planId: ${plan.planId}`);
        this.logger.info(`🔍 [DEBUG] - userInput: "${userInput}"`);
        this.logger.info(`🔍 [DEBUG] - sessionContext available: ${!!sessionContext}`);
        this.logger.info(`🔍 [DEBUG] - selectedModel available: ${!!selectedModel}`);
        this.logger.info(`🔍 [DEBUG] - steps count: ${plan.steps.length}`);
        
        const startTime = Date.now();
        const stepResults: { [key: number]: SpecialistOutput } = {};
        
        // 🚀 动态session上下文：在执行过程中可能会更新
        let currentSessionContext = sessionContext;

        try {
            for (const step of plan.steps) {
                this.logger.info(`▶️ 执行步骤 ${step.step}: ${step.description}`);
                this.logger.info(`🔍 [DEBUG] Step details:`);
                this.logger.info(`🔍 [DEBUG] - specialist: ${step.specialist}`);
                this.logger.info(`🔍 [DEBUG] - context_dependencies: ${JSON.stringify(step.context_dependencies || [])}`);
                
                // 🚀 新增：带循环支持的specialist执行
                let specialistOutput: SpecialistOutput;
                try {
                    specialistOutput = await this.executeSpecialistWithLoopSupport(
                        step, 
                        stepResults, 
                        currentSessionContext, 
                        userInput, 
                        selectedModel, 
                        plan
                    );
                } catch (error) {
                    this.logger.error(`❌ 步骤 ${step.step} specialist循环执行异常: ${(error as Error).message}`);
                    return {
                        intent: 'plan_failed',
                        result: {
                            summary: `计划 '${plan.description}' 在步骤 ${step.step} 执行异常`,
                            error: `specialist循环执行异常: ${(error as Error).message}`,
                            failedStep: step.step,
                            completedSteps: Object.keys(stepResults).length
                        }
                    };
                }

                // 检查specialist是否执行成功
                if (!specialistOutput.success) {
                    this.logger.error(`❌ 步骤 ${step.step} specialist执行失败: ${specialistOutput.error}`);
                    return {
                        intent: 'plan_failed',
                        result: {
                            summary: `计划 '${plan.description}' 在步骤 ${step.step} 失败: ${step.description}`,
                            error: `specialist执行失败: ${specialistOutput.error}`,
                            failedStep: step.step,
                            completedSteps: Object.keys(stepResults).length,
                            specialistDetails: {
                                specialist: step.specialist,
                                iterations: specialistOutput.metadata?.iterations || 0,
                                loopIterations: specialistOutput.metadata?.loopIterations || 0
                            }
                        }
                    };
                }

                // 注意：文件编辑现在在executeSpecialistWithLoopSupport内部处理
                // 不需要在这里再次处理文件编辑逻辑

                // 保存该步骤的结果
                stepResults[step.step] = specialistOutput;
                
                // 🚀 检查是否需要刷新session上下文（特别是项目初始化步骤）
                if (this.isSessionChangingStep(step)) {
                    this.logger.info(`🔄 步骤 ${step.step} 可能改变了session状态，正在刷新...`);
                    currentSessionContext = await this.refreshSessionContext();
                    this.logger.info(`✅ Session上下文已刷新，新项目: ${currentSessionContext?.projectName || 'unknown'}`);
                }
                
                const loopInfo = specialistOutput.metadata?.loopIterations 
                    ? ` (${specialistOutput.metadata.loopIterations}轮循环, ${specialistOutput.metadata.iterations}次内部迭代)`
                    : ` (${specialistOutput.metadata.iterations}次迭代)`;
                this.logger.info(`✅ 步骤 ${step.step} 完成${loopInfo}`);
            }

            const executionTime = Date.now() - startTime;
            this.logger.info(`✅ 计划执行完成，耗时: ${executionTime}ms`);

            return {
                intent: 'plan_completed',
                result: {
                    summary: `成功执行计划: ${plan.description}`,
                    executionTime,
                    totalSteps: plan.steps.length,
                    stepResults: this.formatStepResults(stepResults),
                    finalOutput: this.extractFinalOutput(stepResults)
                }
            };

        } catch (error) {
            this.logger.error(`❌ 计划执行异常: ${(error as Error).message}`);
            this.logger.error(`🔍 [DEBUG] Stack trace:`, error as Error);
            return {
                intent: 'plan_error',
                result: {
                    summary: `计划 '${plan.description}' 执行时发生异常`,
                    error: (error as Error).message,
                    completedSteps: Object.keys(stepResults).length
                }
            };
        }
    }

    /**
     * 为当前步骤准备上下文
     * 合并初始会话上下文和依赖步骤的结果
     */
    private prepareContextForStep(
        step: any, 
        allPreviousResults: { [key: number]: SpecialistOutput }, 
        initialSessionContext: SessionContext,
        userInput: string,
        executionPlan: { planId: string; description: string; steps: any[] }  // 🚀 新增：传入整个执行计划
    ): any {
        this.logger.info(`🔍 [DEBUG] prepareContextForStep: executionPlan received - planId=${executionPlan?.planId}, steps=${executionPlan?.steps?.length}`);
        
        // 提取依赖步骤的结果
        const dependencies = step.context_dependencies || [];
        const dependentResults = dependencies.map((depStep: number): { step: number; content?: string; structuredData?: any; specialist?: string } => ({
            step: depStep,
            content: allPreviousResults[depStep]?.content,
            structuredData: allPreviousResults[depStep]?.structuredData,
            specialist: allPreviousResults[depStep]?.metadata.specialist
        })).filter((dep: { step: number; content?: string; structuredData?: any; specialist?: string }) => dep.content || dep.structuredData);

        // 构建当前步骤的完整上下文
        const context = {
            // 基础会话信息（永不变化）
            userInput: userInput,
            sessionData: initialSessionContext,
            
            // 当前步骤的信息
            currentStep: {
                number: step.step,
                description: step.description,
                specialist: step.specialist,
                expectedOutput: step.expectedOutput,
                output_chapter_titles: step.output_chapter_titles,  // 🚀 新增：当前步骤的章节标题
                language: step.language  // 🚀 新增：language参数传递
            },
            
            // 依赖的上一步或多步的结果
            dependentResults,
            
            // 所有已完成步骤的摘要（用于全局上下文）
            completedStepsOverview: this.generateStepsOverview(allPreviousResults),
            
            // 🚀 新增：完整的执行计划上下文
            executionPlan: {
                planId: executionPlan.planId,
                description: executionPlan.description,
                totalSteps: executionPlan.steps.length,
                currentStepIndex: step.step - 1,  // 当前步骤在计划中的索引（从0开始）
                allSteps: executionPlan.steps.map((planStep: any) => ({
                    step: planStep.step,
                    description: planStep.description,
                    specialist: planStep.specialist,
                    context_dependencies: planStep.context_dependencies || [],
                    output_chapter_titles: planStep.output_chapter_titles || [],
                    language: planStep.language,  // 🚀 新增：language参数传递
                    isCurrentStep: planStep.step === step.step,
                    isCompleted: !!allPreviousResults[planStep.step],
                    isPending: planStep.step > step.step
                })),
                // 为specialist提供的便利信息
                previousSteps: executionPlan.steps.filter((s: any) => s.step < step.step),
                currentStepInfo: step,
                upcomingSteps: executionPlan.steps.filter((s: any) => s.step > step.step),
                // 章节标题汇总
                allPlannedChapters: executionPlan.steps
                    .filter((s: any) => s.output_chapter_titles && s.output_chapter_titles.length > 0)
                    .flatMap((s: any) => s.output_chapter_titles.map((title: string) => ({
                        title,
                        step: s.step,
                        specialist: s.specialist,
                        isCompleted: !!allPreviousResults[s.step],
                        isCurrent: s.step === step.step,
                        isPending: s.step > step.step
                    })))
            }
        };
        
        this.logger.info(`🔍 [DEBUG] prepareContextForStep: context prepared with executionPlan.allSteps=${context.executionPlan?.allSteps?.length}`);
        return context;
    }

    /**
     * 生成已完成步骤的概览
     */
    private generateStepsOverview(results: { [key: number]: SpecialistOutput }): string {
        const completed = Object.entries(results).map(([stepNum, result]) => 
            `步骤${stepNum}: ${result.metadata.specialist} - ${result.success ? '✅完成' : '❌失败'}`
        );
        return completed.join('\n');
    }

    /**
     * 格式化步骤结果，供最终输出使用
     */
    private formatStepResults(stepResults: { [key: number]: SpecialistOutput }): any {
        const formatted: any = {};
        
        for (const [stepNum, result] of Object.entries(stepResults)) {
            formatted[stepNum] = {
                specialist: result.metadata.specialist,
                success: result.success,
                iterations: result.metadata.iterations,
                executionTime: result.metadata.executionTime,
                contentLength: result.content?.length || 0,
                hasStructuredData: !!result.structuredData
            };
        }
        
        return formatted;
    }

    /**
     * 提取最终输出（通常是最后一个步骤的内容）
     */
    private extractFinalOutput(stepResults: { [key: number]: SpecialistOutput }): any {
        const stepNumbers = Object.keys(stepResults).map(Number).sort((a, b) => b - a);
        const lastStep = stepNumbers[0];
        
        if (lastStep && stepResults[lastStep]) {
            return {
                content: stepResults[lastStep].content,
                structuredData: stepResults[lastStep].structuredData,
                metadata: stepResults[lastStep].metadata
            };
        }
        
        return null;
    }

    /**
     * 🚀 检查步骤是否可能改变session状态
     * 主要针对project_initializer等会修改项目上下文的specialist
     */
    private isSessionChangingStep(step: any): boolean {
        const sessionChangingSpecialists = [
            'project_initializer',
            'git_operator'  // 可能会切换分支或项目
        ];
        
        return sessionChangingSpecialists.includes(step.specialist);
    }

    /**
     * 🚀 刷新session上下文
     * 从SessionManager获取最新的session状态
     */
    private async refreshSessionContext(): Promise<SessionContext> {
        try {
            // 动态导入SessionManager以避免循环依赖
            const { SessionManager } = await import('../session-manager');
            const sessionManager = SessionManager.getInstance();
            const currentSession = await sessionManager.getCurrentSession();
            
            if (currentSession) {
                this.logger.info(`🔄 Session上下文刷新成功: ${currentSession.projectName}`);
                return currentSession;
            } else {
                this.logger.warn(`⚠️ 无法获取当前session，保持原有上下文`);
                throw new Error('Unable to get current session');
            }
        } catch (error) {
            this.logger.error(`❌ 刷新session上下文失败: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * 🚀 新增：验证specialist输出
     */
    private validateSpecialistOutput(output: SpecialistOutput, step: any): ValidationResult {
        // 1. 基本成功检查
        if (!output.success) {
            return { 
                success: false, 
                shouldRetry: false, 
                reason: output.error || "Specialist执行失败",
                errorType: FailureType.TOOL_FAILURE 
            };
        }

        // 2. requires_file_editing字段检查
        if (output.requires_file_editing === undefined || output.requires_file_editing === null) {
            return { 
                success: false, 
                shouldRetry: true, 
                reason: "Specialist未明确说明是否需要文件操作（缺少requires_file_editing字段）",
                errorType: FailureType.MISSING_FIELD
            };
        }

        // 3. 文件编辑一致性检查
        if (output.requires_file_editing === true) {
            if (!output.edit_instructions || !Array.isArray(output.edit_instructions) || output.edit_instructions.length === 0) {
                return {
                    success: false,
                    shouldRetry: true,
                    reason: "Specialist声称需要文件编辑但未提供edit_instructions",
                    errorType: FailureType.INVALID_EDITING
                };
            }
            
            if (!output.target_file || typeof output.target_file !== 'string' || output.target_file.trim() === '') {
                return {
                    success: false,
                    shouldRetry: true,
                    reason: "Specialist声称需要文件编辑但未提供target_file",
                    errorType: FailureType.INVALID_EDITING
                };
            }
        }

        return { success: true, shouldRetry: false };
    }

    /**
     * 🚀 新增：为重试准备上下文
     */
    private prepareRetryContext(step: any, allPreviousResults: { [key: number]: SpecialistOutput }, 
                               initialSessionContext: SessionContext, userInput: string, 
                               executionPlan: { planId: string; description: string; steps: any[] },  // 🚀 新增：执行计划参数
                               previousFailure?: string): any {
        const baseContext = this.prepareContextForStep(step, allPreviousResults, initialSessionContext, userInput, executionPlan);
        
        if (previousFailure) {
            baseContext.retryContext = {
                isRetry: true,
                previousFailureReason: previousFailure,
                guidance: this.generateRetryGuidance(previousFailure),
                expectedFormat: this.getExpectedFormat(step.specialist)
            };
        }
        
        return baseContext;
    }

    /**
     * 🚀 新增：生成重试指导
     */
    private generateRetryGuidance(failureReason: string): string {
        if (failureReason.includes("requires_file_editing")) {
            return "请在返回的JSON中明确包含'requires_file_editing'字段，值为true或false";
        }
        if (failureReason.includes("edit_instructions")) {
            return "由于requires_file_editing=true，必须提供edit_instructions数组和target_file路径";
        }
        if (failureReason.includes("target_file")) {
            return "由于requires_file_editing=true，必须提供有效的target_file路径";
        }
        return "请确保返回正确的JSON格式，包含所有必需字段";
    }

    /**
     * 🚀 新增：获取specialist预期格式
     */
    private getExpectedFormat(specialistType: string): string {
        return `{
  "requires_file_editing": true/false,
  ${specialistType.includes('initializer') || specialistType.includes('writer') ? '"edit_instructions": [...], "target_file": "path/to/file",' : ''}
  "success": true,
  "metadata": {...}
}`;
    }

    /**
     * 🚀 核心方法：带循环支持的specialist执行器
     * 支持specialist自循环迭代，直到specialist主动完成任务
     * 
     * @param step 执行步骤信息
     * @param stepResults 已完成步骤的结果
     * @param currentSessionContext 当前session上下文
     * @param userInput 用户原始输入
     * @param selectedModel VSCode语言模型
     * @param plan 执行计划
     * @returns Promise<SpecialistOutput> specialist最终输出
     */
    private async executeSpecialistWithLoopSupport(
        step: any,
        stepResults: { [key: number]: SpecialistOutput },
        currentSessionContext: SessionContext,
        userInput: string,
        selectedModel: vscode.LanguageModelChat,
        plan: { planId: string; description: string; steps: any[] }
    ): Promise<SpecialistOutput> {
        const specialistId = step.specialist;
        const maxIterations = 5; // 最大循环次数限制
        
        this.logger.info(`🔄 开始带循环支持的specialist执行: ${specialistId}`);
        
        // 初始化或获取该specialist的循环状态
        let loopState = this.specialistLoopStates.get(specialistId);
        if (!loopState) {
            loopState = {
                specialistId,
                currentIteration: 0,
                maxIterations,
                executionHistory: [],
                isLooping: false,
                startTime: Date.now()
            };
            this.specialistLoopStates.set(specialistId, loopState);
        }
        
        // 重置循环状态（新的步骤开始）
        loopState.currentIteration = 0;
        loopState.executionHistory = [];
        loopState.isLooping = true;
        loopState.startTime = Date.now();
        
        let finalSpecialistOutput: SpecialistOutput | null = null;
        
        try {
            while (loopState.currentIteration < maxIterations) {
                loopState.currentIteration++;
                const iterationStart = Date.now();
                
                this.logger.info(`🔄 ${specialistId} 第 ${loopState.currentIteration}/${maxIterations} 轮循环开始`);
                
                // 构建包含历史的增强context
                const enhancedContext = this.buildSpecialistLoopContext(
                    step,
                    stepResults,
                    currentSessionContext,
                    userInput,
                    plan,
                    loopState.executionHistory
                );
                
                // 执行specialist
                const specialistOutput = await this.specialistExecutor.execute(
                    specialistId,
                    enhancedContext,
                    selectedModel
                );
                
                const iterationTime = Date.now() - iterationStart;
                
                // 记录本轮执行历史
                const executionRecord: SpecialistExecutionHistory = {
                    iteration: loopState.currentIteration,
                    toolCalls: enhancedContext.lastToolCalls || [], // 从SpecialistExecutor获取
                    toolResults: enhancedContext.lastToolResults || [], // 从SpecialistExecutor获取
                    aiResponse: specialistOutput.content || '',
                    timestamp: new Date().toISOString(),
                    summary: this.extractIterationSummary(specialistOutput),
                    executionTime: iterationTime
                };
                
                this.recordSpecialistExecution(loopState, executionRecord);
                
                // 🚀 关键修复：无论是否继续循环，都先执行文件编辑
                if (specialistOutput.requires_file_editing === true) {
                    this.logger.info(`🔧 执行specialist的文件编辑指令 (第${loopState.currentIteration}轮)`);
                    
                    await this.executeFileEditsInLoop(specialistOutput, currentSessionContext);
                    
                    // 更新session context以反映文件变化
                    currentSessionContext = await this.refreshOrUpdateSessionContext(
                        currentSessionContext,
                        specialistOutput.target_file!
                    );
                    
                    this.logger.info(`✅ 第${loopState.currentIteration}轮文件编辑完成`);
                }
                
                // 检查是否需要继续循环
                const shouldContinue = this.shouldContinueLoop(specialistOutput, loopState);
                
                if (!shouldContinue.continue) {
                    this.logger.info(`✅ ${specialistId} 循环结束: ${shouldContinue.reason}`);
                    finalSpecialistOutput = specialistOutput;
                    break;
                }
                
                // 如果要继续循环，记录继续原因
                this.logger.info(`🔄 ${specialistId} 第 ${loopState.currentIteration} 轮完成，继续原因: ${shouldContinue.reason}`);
                loopState.lastContinueReason = shouldContinue.reason;
            }
            
            // 如果达到最大循环次数还没有结束
            if (!finalSpecialistOutput) {
                this.logger.warn(`⚠️ ${specialistId} 达到最大循环次数 (${maxIterations})，强制结束`);
                // 使用最后一次的输出作为最终结果
                finalSpecialistOutput = loopState.executionHistory[loopState.executionHistory.length - 1]
                    ? this.constructFinalOutputFromHistory(loopState.executionHistory)
                    : this.createTimeoutOutput(specialistId);
            }
            
        } finally {
            // 清理循环状态
            loopState.isLooping = false;
            const totalTime = Date.now() - loopState.startTime;
            
            this.logger.info(`🏁 ${specialistId} 循环完成，总耗时: ${totalTime}ms，共 ${loopState.currentIteration} 轮`);
            
            // 更新最终输出的metadata以包含循环信息
            if (finalSpecialistOutput) {
                finalSpecialistOutput.metadata = {
                    ...finalSpecialistOutput.metadata,
                    loopIterations: loopState.currentIteration,
                    totalLoopTime: totalTime,
                    iterationHistory: loopState.executionHistory.map(h => ({
                        iteration: h.iteration,
                        summary: h.summary,
                        executionTime: h.executionTime
                    }))
                };
            }
        }
        
        return finalSpecialistOutput!;
    }

    /**
     * 🚀 辅助方法：构建包含历史的specialist循环context
     * 在基础context上增加specialist的执行历史，让specialist能看到之前循环的结果
     */
    private buildSpecialistLoopContext(
        step: any,
        stepResults: { [key: number]: SpecialistOutput },
        currentSessionContext: SessionContext,
        userInput: string,
        plan: { planId: string; description: string; steps: any[] },
        executionHistory: SpecialistExecutionHistory[]
    ): any {
        // 先获取基础context
        const baseContext = this.prepareContextForStep(step, stepResults, currentSessionContext, userInput, plan);
        
        // 如果没有历史记录，直接返回基础context
        if (!executionHistory || executionHistory.length === 0) {
            this.logger.info(`🔍 ${step.specialist} 第一轮循环，使用基础context`);
            return baseContext;
        }
        
        this.logger.info(`🔍 ${step.specialist} 第${executionHistory.length + 1}轮循环，包含${executionHistory.length}轮历史`);
        
        // 构建执行历史摘要
        const historyOverview = this.buildExecutionHistoryOverview(executionHistory);
        
        // 提取工具调用结果历史
        const toolResultsHistory = this.extractToolResultsHistory(executionHistory);
        
        // 构建文件状态追踪
        const fileStateTracking = this.buildFileStateTracking(executionHistory, currentSessionContext);
        
        // 构建增强的context
        const enhancedContext = {
            ...baseContext,
            
            // 🚀 新增：specialist循环历史信息
            specialistLoopContext: {
                isLooping: true,
                currentIteration: executionHistory.length + 1,
                totalIterations: executionHistory.length,
                
                // 历史执行概览
                executionHistoryOverview: historyOverview,
                
                // 详细的工具调用结果历史
                toolResultsHistory: toolResultsHistory,
                
                // 文件状态追踪
                fileStateTracking: fileStateTracking,
                
                // 上一轮的关键信息
                lastIterationSummary: executionHistory.length > 0 
                    ? this.buildLastIterationSummary(executionHistory[executionHistory.length - 1])
                    : null,
                
                // 循环模式指导
                loopGuidance: {
                    purpose: "您正在进行多轮迭代优化工作",
                    workflow: [
                        "1. 查看上一轮的工具调用结果和文件状态",
                        "2. 分析当前工作成果是否满足要求",
                        "3. 如果满足要求，使用taskComplete with nextStepType: 'TASK_FINISHED'",
                        "4. 如果需要继续改进，使用工具进行操作，然后taskComplete with nextStepType: 'CONTINUE_SAME_SPECIALIST'"
                    ],
                    availableActions: [
                        "readFile - 查看当前文件内容",
                        "findInFile - 搜索文件中的特定内容",
                        "taskComplete - 完成本轮工作并决定是否继续"
                    ]
                }
            }
        };
        
        this.logger.info(`✅ 为${step.specialist}构建增强context：包含${toolResultsHistory.length}个工具结果`);
        return enhancedContext;
    }

    /**
     * 🚀 辅助方法：构建执行历史概览
     */
    private buildExecutionHistoryOverview(executionHistory: SpecialistExecutionHistory[]): string {
        const overview = executionHistory.map((record, index) => {
            const toolCallsDesc = record.toolCalls.length > 0 
                ? record.toolCalls.map(tc => tc.name).join(', ')
                : '无工具调用';
            
            return `第${record.iteration}轮: ${toolCallsDesc} | ${record.summary}`;
        }).join('\n');
        
        return `执行历史概览 (共${executionHistory.length}轮):\n${overview}`;
    }

    /**
     * 🚀 辅助方法：提取工具调用结果历史
     */
    private extractToolResultsHistory(executionHistory: SpecialistExecutionHistory[]): Array<{
        iteration: number;
        toolName: string;
        success: boolean;
        result: any;
        summary?: string;
    }> {
        const allResults: Array<{
            iteration: number;
            toolName: string;
            success: boolean;
            result: any;
            summary?: string;
        }> = [];
        
        for (const record of executionHistory) {
            for (const toolResult of record.toolResults) {
                allResults.push({
                    iteration: record.iteration,
                    toolName: toolResult.toolName,
                    success: toolResult.success,
                    result: toolResult.result,
                    summary: this.summarizeToolResult(toolResult)
                });
            }
        }
        
        return allResults;
    }

    /**
     * 🚀 辅助方法：构建文件状态追踪
     */
    private buildFileStateTracking(executionHistory: SpecialistExecutionHistory[], currentSessionContext: SessionContext): {
        modifiedFiles: string[];
        lastModificationIteration: { [file: string]: number };
        fileOperations: Array<{ iteration: number; operation: string; file?: string }>;
    } {
        const modifiedFiles: Set<string> = new Set();
        const lastModificationIteration: { [file: string]: number } = {};
        const fileOperations: Array<{ iteration: number; operation: string; file?: string }> = [];
        
        for (const record of executionHistory) {
            for (const toolCall of record.toolCalls) {
                if (toolCall.name === 'readFile' && toolCall.args?.path) {
                    fileOperations.push({
                        iteration: record.iteration,
                        operation: `读取: ${toolCall.args.path}`,
                        file: toolCall.args.path
                    });
                }
                
                if (toolCall.name === 'taskComplete' && toolCall.args?.edit_instructions) {
                    const targetFile = toolCall.args.target_file;
                    if (targetFile) {
                        modifiedFiles.add(targetFile);
                        lastModificationIteration[targetFile] = record.iteration;
                        fileOperations.push({
                            iteration: record.iteration,
                            operation: `编辑: ${targetFile} (${toolCall.args.edit_instructions.length}个指令)`,
                            file: targetFile
                        });
                    }
                }
            }
        }
        
        return {
            modifiedFiles: Array.from(modifiedFiles),
            lastModificationIteration,
            fileOperations
        };
    }

    /**
     * 🚀 辅助方法：构建上一轮迭代摘要
     */
    private buildLastIterationSummary(lastRecord: SpecialistExecutionHistory): {
        iteration: number;
        toolsUsed: string[];
        keyResults: string[];
        summary: string;
        executionTime: number;
    } {
        const toolsUsed = lastRecord.toolCalls.map(tc => tc.name);
        const keyResults = lastRecord.toolResults
            .filter(tr => tr.success)
            .map(tr => this.summarizeToolResult(tr));
        
        return {
            iteration: lastRecord.iteration,
            toolsUsed,
            keyResults,
            summary: lastRecord.summary,
            executionTime: lastRecord.executionTime
        };
    }

    /**
     * 🚀 辅助方法：总结工具调用结果
     */
    private summarizeToolResult(toolResult: { toolName: string; success: boolean; result: any; error?: string }): string {
        if (!toolResult.success) {
            return `${toolResult.toolName}失败: ${toolResult.error || '未知错误'}`;
        }
        
        switch (toolResult.toolName) {
            case 'readFile':
                const content = toolResult.result?.content || toolResult.result;
                const contentLength = typeof content === 'string' ? content.length : 0;
                return `读取文件成功 (${contentLength}字符)`;
                
            case 'findInFile':
                const matches = toolResult.result?.matches || [];
                return `文件搜索成功 (找到${matches.length}个匹配)`;
                
            case 'taskComplete':
                const editCount = toolResult.result?.edit_instructions?.length || 0;
                return `任务完成 (${editCount}个编辑指令)`;
                
            default:
                return `${toolResult.toolName}执行成功`;
        }
    }

    /**
     * 🚀 辅助方法：提取迭代摘要
     */
    private extractIterationSummary(specialistOutput: SpecialistOutput): string {
        // 简单实现：从content中提取前100字符作为摘要
        return specialistOutput.content?.substring(0, 100) || 
               `specialist执行${specialistOutput.success ? '成功' : '失败'}`;
    }

    /**
     * 🚀 辅助方法：记录specialist执行历史（待实现）
     */
    private recordSpecialistExecution(loopState: SpecialistLoopState, executionRecord: SpecialistExecutionHistory): void {
        // TODO: 在recordSpecialistExecution任务中实现
        loopState.executionHistory.push(executionRecord);
    }

    /**
     * 🚀 辅助方法：判断是否需要继续循环
     */
    private shouldContinueLoop(specialistOutput: SpecialistOutput, loopState: SpecialistLoopState): { continue: boolean; reason: string } {
        // 检查specialist是否明确表示完成
        if (specialistOutput.structuredData?.nextStepType === 'TASK_FINISHED') {
            return { continue: false, reason: 'specialist标记任务完成' };
        }
        
        // 检查是否要求继续同一specialist
        if (specialistOutput.structuredData?.nextStepType === 'CONTINUE_SAME_SPECIALIST') {
            return { continue: true, reason: 'specialist要求继续迭代' };
        }
        
        // 默认：第一轮后就结束（保持现有行为）
        return { continue: false, reason: '默认单轮执行完成' };
    }

    /**
     * 🚀 辅助方法：在循环内部执行文件编辑
     */
    private async executeFileEditsInLoop(specialistOutput: SpecialistOutput, currentSessionContext: SessionContext): Promise<void> {
        if (!specialistOutput.edit_instructions || !specialistOutput.target_file) {
            return;
        }

        const fullPath = currentSessionContext.baseDir 
            ? path.join(currentSessionContext.baseDir, specialistOutput.target_file)
            : specialistOutput.target_file;

        // 使用现有的统一编辑执行器
        const editResult = await executeUnifiedEdits(specialistOutput.edit_instructions, fullPath);
        
        if (!editResult.success) {
            this.logger.error(`❌ 循环内文件编辑失败: ${editResult.error}`);
            throw new Error(`文件编辑失败: ${editResult.error}`);
        }
        
        this.logger.info(`✅ 循环内文件编辑成功: ${editResult.appliedCount}个操作应用`);
    }

    /**
     * 🚀 辅助方法：刷新或更新session context以反映文件编辑
     * 当specialist在循环中编辑了文件，需要更新context以便下轮循环看到最新状态
     * 
     * @param currentSessionContext 当前session上下文
     * @param targetFile 被编辑的目标文件路径（相对路径）
     * @returns Promise<SessionContext> 更新后的session上下文
     */
    private async refreshOrUpdateSessionContext(
        currentSessionContext: SessionContext, 
        targetFile: string
    ): Promise<SessionContext> {
        try {
            this.logger.info(`🔄 刷新session context: 文件 ${targetFile} 已被修改`);
            
            // 对于大多数情况，session context的核心信息（projectName, baseDir等）不会改变
            // 但某些specialist的文件编辑可能会影响项目状态，需要特殊处理
            
            // 1. 检查是否是可能影响session状态的关键文件
            const affectsSession = this.checkIfFileAffectsSession(targetFile);
            
            if (!affectsSession) {
                // 一般文件编辑，session context无需更新
                this.logger.info(`ℹ️ 文件 ${targetFile} 不影响session状态，保持原有context`);
                return currentSessionContext;
            }
            
            // 2. 对于影响session的文件，尝试部分更新
            const updatedContext = await this.performPartialSessionUpdate(currentSessionContext, targetFile);
            
            this.logger.info(`✅ Session context部分更新完成: ${targetFile}`);
            return updatedContext;
            
        } catch (error) {
            this.logger.error(`❌ 更新session context失败: ${(error as Error).message}`);
            this.logger.warn(`⚠️ 保持原有session context，继续执行`);
            
            // 更新失败时，返回原有context，不中断流程
            return currentSessionContext;
        }
    }

    /**
     * 🚀 辅助方法：检查文件是否影响session状态
     */
    private checkIfFileAffectsSession(targetFile: string): boolean {
        // 定义可能影响session状态的文件模式
        const sessionAffectingPatterns = [
            /package\.json$/,          // 包配置变化
            /\.git\/config$/,          // Git配置变化
            /vscode\/settings\.json$/, // VSCode配置变化
            /^\.env/,                  // 环境变量文件
            /^README\.md$/,            // 项目描述文档
            /^PROJECT\./,              // 项目配置文件
            /^SRS\./                   // SRS主文档
        ];
        
        return sessionAffectingPatterns.some(pattern => pattern.test(targetFile));
    }

    /**
     * 🚀 辅助方法：执行部分session更新
     */
    private async performPartialSessionUpdate(
        currentSessionContext: SessionContext, 
        targetFile: string
    ): Promise<SessionContext> {
        // 创建更新后的context副本
        const updatedContext = { ...currentSessionContext };
        
        try {
            // 根据不同文件类型执行不同的更新策略
            if (targetFile.endsWith('package.json')) {
                // package.json变化，可能影响项目名称或版本
                updatedContext.metadata.lastModified = new Date().toISOString();
                this.logger.info(`📦 检测到package.json变化，更新时间戳`);
                
            } else if (targetFile.match(/^SRS\./)) {
                // SRS主文档变化，可能影响项目描述
                updatedContext.metadata.lastModified = new Date().toISOString();
                this.logger.info(`📄 检测到SRS文档变化，更新时间戳`);
                
            } else if (targetFile.match(/^README\.md$/)) {
                // README变化，可能影响项目描述
                updatedContext.metadata.lastModified = new Date().toISOString();
                this.logger.info(`📝 检测到README变化，更新时间戳`);
                
            } else {
                // 其他影响session的文件，通用处理
                updatedContext.metadata.lastModified = new Date().toISOString();
                this.logger.info(`🔄 检测到session相关文件变化: ${targetFile}`);
            }
            
            // 对于特别重要的变化，可以考虑重新扫描项目结构
            // 但这里采用轻量级更新策略，避免性能影响
            
            return updatedContext;
            
        } catch (error) {
            this.logger.error(`❌ 部分session更新失败: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * 🚀 辅助方法：获取文件内容摘要（用于调试）
     */
    private async getFileContentSummary(filePath: string): Promise<string> {
        try {
            const { FileManager } = await import('../../filesystem/file-manager');
            const fileManager = new FileManager();
            
            const content = await fileManager.readFile(filePath);
            
            // 返回前200字符作为摘要
            if (content.length <= 200) {
                return content;
            }
            
            return content.substring(0, 200) + '...';
            
        } catch (error) {
            return `无法读取文件: ${(error as Error).message}`;
        }
    }

    /**
     * 🚀 辅助方法：从历史记录构建最终输出
     */
    private constructFinalOutputFromHistory(executionHistory: SpecialistExecutionHistory[]): SpecialistOutput {
        const lastExecution = executionHistory[executionHistory.length - 1];
        
        return {
            success: true,
            content: lastExecution.aiResponse,
            requires_file_editing: false,
            metadata: {
                specialist: 'unknown',
                iterations: executionHistory.length,
                executionTime: executionHistory.reduce((sum, h) => sum + h.executionTime, 0),
                timestamp: new Date().toISOString(),
                toolsUsed: []
            }
        };
    }

    /**
     * 🚀 辅助方法：创建超时输出
     */
    private createTimeoutOutput(specialistId: string): SpecialistOutput {
        return {
            success: false,
            error: `specialist ${specialistId} 超过最大循环次数限制`,
            requires_file_editing: false,
            metadata: {
                specialist: specialistId,
                iterations: 0,
                executionTime: 0,
                timestamp: new Date().toISOString(),
                toolsUsed: []
            }
        };
    }

    /**
     * 🚀 新增：带重试机制的步骤执行
     */
    private async executeStepWithRetry(
        step: any,
        stepResults: { [key: number]: SpecialistOutput },
        currentSessionContext: SessionContext,
        userInput: string,
        selectedModel: vscode.LanguageModelChat,
        plan: { planId: string; description: string; steps: any[] }
    ): Promise<SpecialistOutput | { success: false; planFailed: true; intent: string; result: any }> {
        const maxRetries = 1; // 最多重试1次（总共2次尝试）
        let attempt = 0;
        let lastFailureReason: string | undefined;

        while (attempt <= maxRetries) {
            attempt++;
            
            this.logger.info(`🔍 [DEBUG] 步骤 ${step.step} 第 ${attempt} 次尝试 (最多 ${maxRetries + 1} 次)`);

            // 1. 准备上下文（重试时包含失败信息）
            const contextForThisStep = this.prepareRetryContext(
                step, 
                stepResults, 
                currentSessionContext, 
                userInput, 
                plan,  // 🚀 执行计划参数
                lastFailureReason
            );

            if (lastFailureReason) {
                this.logger.info(`🔄 重试步骤 ${step.step}，失败原因: ${lastFailureReason}`);
            }

            // 2. 调用SpecialistExecutor
            this.logger.info(`🔍 [DEBUG] Calling specialist with context.executionPlan.allSteps=${contextForThisStep.executionPlan?.allSteps?.length}`);
            let specialistOutput: SpecialistOutput;
            try {
                specialistOutput = await this.specialistExecutor.execute(
                    step.specialist,
                    contextForThisStep,
                    selectedModel
                );

                this.logger.info(`🔍 [DEBUG] SpecialistExecutor returned for step ${step.step} attempt ${attempt}:`);
                this.logger.info(`🔍 [DEBUG] - success: ${specialistOutput.success}`);
                this.logger.info(`🔍 [DEBUG] - iterations: ${specialistOutput.metadata?.iterations || 'unknown'}`);
                this.logger.info(`🔍 [DEBUG] - content length: ${specialistOutput.content?.length || 0}`);
                this.logger.info(`🔍 [DEBUG] - requires_file_editing: ${specialistOutput.requires_file_editing}`);

            } catch (error) {
                this.logger.error(`❌ 步骤 ${step.step} 第 ${attempt} 次尝试异常: ${(error as Error).message}`);
                
                // 对于异常，不重试，直接失败
                return {
                    success: false,
                    planFailed: true,
                    intent: 'plan_failed',
                    result: {
                        summary: `计划 '${plan.description}' 在步骤 ${step.step} 执行异常`,
                        error: `专家执行异常: ${(error as Error).message}`,
                        failedStep: step.step,
                        completedSteps: Object.keys(stepResults).length,
                        attempt: attempt
                    }
                };
            }

            // 3. 验证specialist输出
            const validation = this.validateSpecialistOutput(specialistOutput, step);

            if (validation.success) {
                // ✅ 验证成功
                if (attempt > 1) {
                    this.logger.info(`✅ 步骤 ${step.step} 第 ${attempt} 次尝试成功 (重试成功)`);
                } else {
                    this.logger.info(`✅ 步骤 ${step.step} 第一次尝试即成功`);
                }
                return specialistOutput;
            }

            // ❌ 验证失败
            this.logger.warn(`❌ 步骤 ${step.step} 第 ${attempt} 次尝试验证失败: ${validation.reason}`);

            if (!validation.shouldRetry || attempt > maxRetries) {
                // 不应该重试，或已达到最大重试次数
                const errorMessage = attempt > maxRetries 
                    ? `步骤 ${step.step} 重试 ${maxRetries} 次后仍然失败: ${validation.reason}`
                    : `步骤 ${step.step} 失败且不应重试: ${validation.reason}`;

                this.logger.error(`❌ ${errorMessage}`);
                
                return {
                    success: false,
                    planFailed: true,
                    intent: 'plan_failed',
                    result: {
                        summary: `计划 '${plan.description}' 在步骤 ${step.step} 失败: ${step.description}`,
                        error: errorMessage,
                        failedStep: step.step,
                        completedSteps: Object.keys(stepResults).length,
                        totalAttempts: attempt,
                        validationFailure: validation.reason,
                        shouldRetry: validation.shouldRetry,
                        errorType: validation.errorType
                    }
                };
            }

            // 准备重试
            lastFailureReason = validation.reason;
            this.logger.info(`🔄 步骤 ${step.step} 第 ${attempt} 次尝试失败，准备重试...`);
        }

        // 这个分支理论上不会到达，但为了类型安全
        throw new Error(`步骤 ${step.step} 执行逻辑错误：超出了预期的重试次数`);
    }

    // ============================================================================
    // 🗑️ 已废弃：编辑修复专家逻辑
    // 
    // 原因：新的验证和重试机制已经替代了编辑修复专家的功能
    // 删除时间：实施requires_file_editing字段验证方案时
    // ============================================================================
} 