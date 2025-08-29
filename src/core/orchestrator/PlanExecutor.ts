import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { SessionContext } from '../../types/session';
import { SpecialistExecutor } from '../specialistExecutor';
import { SpecialistProgressCallback } from '../../types';
import { SpecialistOutput, SpecialistExecutionHistory, SpecialistInteractionResult, SpecialistLoopState } from '../engine/AgentState';
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
    
    /**
     * 🚀 v6.0新增：取消检查回调
     * 用于检查执行是否应该被取消（例如项目切换时）
     */
    private cancelledCheckCallback?: () => boolean;

    constructor(
        private specialistExecutor: SpecialistExecutor
    ) {
        // 初始化specialist循环状态管理器
        this.specialistLoopStates = new Map();
    }
    
    /**
     * 🚀 v6.0：设置取消检查回调
     * @param callback 返回true表示执行应该被取消
     */
    public setCancelledCheckCallback(callback: () => boolean): void {
        this.cancelledCheckCallback = callback;
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
        userInput: string,
        progressCallback?: SpecialistProgressCallback
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
                // 🚀 v6.0：检查是否被取消
                if (this.cancelledCheckCallback && this.cancelledCheckCallback()) {
                    this.logger.info('🛑 Plan execution cancelled - stopping step execution');
                    return {
                        intent: 'plan_cancelled',
                        result: {
                            summary: '计划执行已取消 - 项目切换',
                            completed_steps: Object.keys(stepResults).length,
                            total_steps: plan.steps.length
                        }
                    };
                }
                
                this.logger.info(`▶️ 执行步骤 ${step.step}: ${step.description}`);
                this.logger.info(`🔍 [DEBUG] Step details:`);
                this.logger.info(`🔍 [DEBUG] - specialist: ${step.specialist}`);
                this.logger.info(`🔍 [DEBUG] - context_dependencies: ${JSON.stringify(step.context_dependencies || [])}`);
                
                // 🚀 新增：带循环支持的specialist执行
                let specialistResult: SpecialistOutput | SpecialistInteractionResult;
                try {
                                    specialistResult = await this.executeSpecialistWithLoopSupport(
                    step, 
                    stepResults, 
                    currentSessionContext, 
                    userInput, 
                    selectedModel, 
                    plan,
                    progressCallback
                );
                } catch (error) {
                    this.logger.error(`❌ 步骤 ${step.step} ${step.specialist}循环执行异常: ${(error as Error).message}`);
                    return {
                        intent: 'plan_failed',
                        result: {
                            summary: `计划 '${plan.description}' 在步骤 ${step.step} 执行异常`,
                            error: `${step.specialist}循环执行异常: ${(error as Error).message}`,
                            failedStep: step.step,
                            completedSteps: Object.keys(stepResults).length,
                            // 🚀 新增：完整的计划执行上下文
                            planExecutionContext: {
                                originalExecutionPlan: plan,
                                totalSteps: plan.steps.length,
                                completedSteps: Object.keys(stepResults).length,
                                failedStep: step.step,
                                failedSpecialist: step.specialist,
                                completedWork: Object.keys(stepResults).map(stepNum => ({
                                    step: parseInt(stepNum),
                                    specialist: stepResults[parseInt(stepNum)].metadata?.specialist || 'unknown',
                                    description: plan.steps.find((s: any) => s.step === parseInt(stepNum))?.description || 'unknown',
                                    status: 'completed'
                                })),
                                error: `specialist循环执行异常: ${(error as Error).message}`
                            }
                        }
                    };
                }

                // 🚀 修复核心bug：首先检查是否需要用户交互
                this.logger.info(`🔍 [DEBUG] 步骤 ${step.step} specialist返回结果类型检查:`);
                this.logger.info(`🔍 [DEBUG] - 结果包含needsChatInteraction: ${'needsChatInteraction' in specialistResult}`);
                this.logger.info(`🔍 [DEBUG] - needsChatInteraction值: ${(specialistResult as any).needsChatInteraction}`);
                this.logger.info(`🔍 [DEBUG] - 结果包含success: ${'success' in specialistResult}`);
                this.logger.info(`🔍 [DEBUG] - success值: ${(specialistResult as any).success}`);
                this.logger.info(`🔍 [DEBUG] - 结果包含error: ${'error' in specialistResult}`);
                this.logger.info(`🔍 [DEBUG] - 结果包含question: ${'question' in specialistResult}`);
                
                if ('needsChatInteraction' in specialistResult && specialistResult.needsChatInteraction === true) {
                    this.logger.info(`💬 步骤 ${step.step} specialist需要用户交互: "${specialistResult.question}"`);
                    this.logger.info(`🔍 [DEBUG] 返回intent: 'user_interaction_required'，而非'plan_failed'`);
                    
                    // 返回用户交互需求，而不是错误
                    return {
                        intent: 'user_interaction_required',
                        result: {
                            mode: 'specialist_interaction',
                            question: specialistResult.question,
                            summary: `计划执行至步骤 ${step.step} (${step.description}) 时需要用户确认`,
                            stepInfo: {
                                step: step.step,
                                specialist: step.specialist,
                                description: step.description
                            },
                            resumeContext: specialistResult.resumeContext,
                            completedSteps: Object.keys(stepResults).length
                        }
                    };
                }

                // 现在可以安全地将结果当作SpecialistOutput处理
                const specialistOutput = specialistResult as SpecialistOutput;
                
                // 检查specialist是否执行成功
                if (!specialistOutput.success) {
                    this.logger.error(`❌ 步骤 ${step.step} ${step.specialist}执行失败: ${specialistOutput.error}`);
                    return {
                        intent: 'plan_failed',
                        result: {
                            summary: `计划 '${plan.description}' 在步骤 ${step.step} 失败: ${step.description}`,
                            error: `${step.specialist}执行失败: ${specialistOutput.error}`,
                            failedStep: step.step,
                            completedSteps: Object.keys(stepResults).length,
                            specialistDetails: {
                                specialist: step.specialist,
                                iterations: specialistOutput.metadata?.iterations || 0,
                                loopIterations: specialistOutput.metadata?.loopIterations || 0
                            },
                            // 🚀 新增：完整的计划执行上下文
                            planExecutionContext: {
                                originalExecutionPlan: plan,
                                totalSteps: plan.steps.length,
                                completedSteps: Object.keys(stepResults).length,
                                failedStep: step.step,
                                failedSpecialist: step.specialist,
                                completedWork: Object.keys(stepResults).map(stepNum => ({
                                    step: parseInt(stepNum),
                                    specialist: stepResults[parseInt(stepNum)].metadata?.specialist || 'unknown',
                                    description: plan.steps.find((s: any) => s.step === parseInt(stepNum))?.description || 'unknown',
                                    status: 'completed'
                                })),
                                error: `specialist执行失败: ${specialistOutput.error}`
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
                    : ` (${specialistOutput.metadata?.iterations || 1}次迭代)`;
                this.logger.info(`✅ 步骤 ${step.step} 完成${loopInfo}`);
            }

            const executionTime = Date.now() - startTime;
            this.logger.info(`✅ 计划执行完成，耗时: ${executionTime}ms`);

            // 🔍 [DEBUG-SESSION-SYNC] 计划执行完成时的session状态检查
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] === PLAN EXECUTION COMPLETED (Path 1) ===`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] SessionContext at completion:`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] - sessionId: ${sessionContext.sessionContextId}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] - lastModified: ${sessionContext.metadata.lastModified}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] - projectName: ${sessionContext.projectName}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] ⚠️ This sessionContext may NOT be synced back to SessionManager!`);

            return {
                intent: 'plan_completed',
                result: {
                    summary: `成功执行计划: ${plan.description}`,
                    executionTime,
                    totalSteps: plan.steps.length,
                    stepResults: this.formatStepResults(stepResults),
                    finalOutput: this.extractFinalOutput(stepResults),
                    // 🚀 新增：完整的计划执行上下文
                    planExecutionContext: {
                        originalExecutionPlan: plan,
                        totalSteps: plan.steps.length,
                        completedSteps: Object.keys(stepResults).length,
                        failedStep: null,
                        failedSpecialist: null,
                        completedWork: Object.keys(stepResults).map(stepNum => ({
                            step: parseInt(stepNum),
                            specialist: stepResults[parseInt(stepNum)].metadata?.specialist || 'unknown',
                            description: plan.steps.find((s: any) => s.step === parseInt(stepNum))?.description || 'unknown',
                            status: 'completed'
                        })),
                        error: null
                    }
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
                    completedSteps: Object.keys(stepResults).length,
                    // 🚀 新增：完整的计划执行上下文
                    planExecutionContext: {
                        originalExecutionPlan: plan,
                        totalSteps: plan.steps.length,
                        completedSteps: Object.keys(stepResults).length,
                        failedStep: null,
                        failedSpecialist: null,
                        completedWork: Object.keys(stepResults).map(stepNum => ({
                            step: parseInt(stepNum),
                            specialist: stepResults[parseInt(stepNum)].metadata?.specialist || 'unknown',
                            description: plan.steps.find((s: any) => s.step === parseInt(stepNum))?.description || 'unknown',
                            status: 'completed'
                        })),
                        error: (error as Error).message
                    }
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
            specialist: allPreviousResults[depStep]?.metadata?.specialist || 'unknown'
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
                language: step.language,  // 🚀 新增：language参数传递
                workflow_mode: step.workflow_mode,  // 🚀 新增：workflow_mode参数传递
                relevant_context: step.relevant_context  // 🚀 新增：步骤相关上下文传递
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
                    workflow_mode: planStep.workflow_mode,  // 🚀 新增：workflow_mode参数传递
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
            `步骤${stepNum}: ${result.metadata?.specialist || 'unknown'} - ${result.success ? '✅完成' : '❌失败'}`
        );
        return completed.join('\n');
    }

    /**
     * 格式化步骤结果，供最终输出使用
     * 🔧 重构：移除冗余的content和有毒的执行细节，只保留AI系统需要的核心信息
     */
    private formatStepResults(stepResults: { [key: number]: SpecialistOutput }): any {
        const formatted: any = {};
        
        for (const [stepNum, result] of Object.entries(stepResults)) {
            formatted[stepNum] = {
                // ✅ 保留：AI系统需要的核心信息
                structuredData: result.structuredData,              // 完整的语义信息
                success: result.success,                            // 任务执行状态
                specialist: result.metadata?.specialist || 'unknown', // 执行的specialist
                
                // ❌ 移除：冗余信息 (content已保存在workspace，用户可随时查看)
                // content: result.content,                         
                // contentLength: result.content?.length || 0,      
                // hasStructuredData: !!result.structuredData,      
                
                // ❌ 移除：有毒的执行细节 (会干扰orchestrator判断)
                // iterations: result.metadata?.iterations || 0,
                // executionTime: result.metadata?.executionTime || 0,
                // timestamp: result.metadata?.timestamp,
                // iterationHistory: result.metadata?.iterationHistory,
                // toolsUsed: result.metadata?.toolsUsed
            };
        }
        
        return formatted;
    }

    /**
     * 提取最终输出（通常是最后一个步骤的内容）
     * 🔧 重构：移除冗余的content和有毒的执行细节，只保留AI系统需要的核心信息
     */
    private extractFinalOutput(stepResults: { [key: number]: SpecialistOutput }): any {
        const stepNumbers = Object.keys(stepResults).map(Number).sort((a, b) => b - a);
        const lastStep = stepNumbers[0];
        
        if (lastStep && stepResults[lastStep]) {
            return {
                // ✅ 保留：AI系统需要的核心信息
                structuredData: stepResults[lastStep].structuredData,    // 完整的语义信息
                specialist: stepResults[lastStep].metadata?.specialist,  // 执行的specialist
                
                // ❌ 移除：冗余信息 (content已保存在workspace，用户可随时查看)
                // content: stepResults[lastStep].content,
                
                // ❌ 移除：有毒的执行细节 (完整的metadata包含大量执行细节)
                // metadata: stepResults[lastStep].metadata
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
     * @returns Promise<SpecialistOutput | SpecialistInteractionResult> specialist最终输出或用户交互需求
     */
    private async executeSpecialistWithLoopSupport(
        step: any,
        stepResults: { [key: number]: SpecialistOutput },
        currentSessionContext: SessionContext,
        userInput: string,
        selectedModel: vscode.LanguageModelChat,
        plan: { planId: string; description: string; steps: any[] },
        progressCallback?: SpecialistProgressCallback
    ): Promise<SpecialistOutput | SpecialistInteractionResult> {
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
                // 🚀 v6.0：在specialist循环中检查是否被取消
                if (this.cancelledCheckCallback && this.cancelledCheckCallback()) {
                    this.logger.info(`🛑 ${specialistId} execution cancelled during loop - stopping specialist execution`);
                    loopState.isLooping = false;
                    return {
                        success: false,
                        error: 'Specialist execution cancelled - project switch',
                        metadata: {
                            specialist: specialistId,
                            iterations: loopState.currentIteration,
                            cancelled: true
                        }
                    } as SpecialistOutput;
                }
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
                const specialistResult = await this.specialistExecutor.execute(
                    specialistId,
                    enhancedContext,
                    selectedModel,
                    undefined, // resumeState
                    progressCallback,
                    this.cancelledCheckCallback // 🚀 v6.0：传递取消检查回调
                );
                
                const iterationTime = Date.now() - iterationStart;
                
                // 🚀 修复：首先检查是否直接返回了用户交互需求（SpecialistInteractionResult）
                this.logger.info(`🔍 [DEBUG] ${specialistId} 第 ${loopState.currentIteration} 轮结果类型检查:`);
                this.logger.info(`🔍 [DEBUG] - 是否为SpecialistInteractionResult: ${'needsChatInteraction' in specialistResult && specialistResult.needsChatInteraction === true}`);
                this.logger.info(`🔍 [DEBUG] - 结果keys: ${Object.keys(specialistResult).join(', ')}`);
                
                if ('needsChatInteraction' in specialistResult && specialistResult.needsChatInteraction === true) {
                    this.logger.info(`💬 ${specialistId} 在第 ${loopState.currentIteration} 轮直接返回用户交互需求: "${specialistResult.question}"`);
                    
                    // 🚀 修复：为直接返回的SpecialistInteractionResult构建完整resumeContext
                    const completeResumeContext = this.buildCompleteResumeContext(
                        specialistId,
                        step,
                        stepResults,
                        currentSessionContext,
                        userInput,
                        plan,
                        loopState,
                        specialistResult as any, // 将SpecialistInteractionResult当作SpecialistOutput处理
                        enhancedContext
                    );
                    
                    // 🚀 合并specialist原始resumeContext和完整planExecutorState
                    const enhancedResumeContext = {
                        ...specialistResult.resumeContext, // 保留specialist的原始状态
                        ...completeResumeContext,          // 添加完整的planExecutorState
                        
                        // 🚀 确保specialist原始信息优先级更高
                        ruleId: specialistResult.resumeContext?.specialist || specialistId,
                        specialist: specialistResult.resumeContext?.specialist || specialistId,
                        iteration: specialistResult.resumeContext?.iteration || loopState.currentIteration,
                        internalHistory: specialistResult.resumeContext?.internalHistory || [],
                        contextForThisStep: specialistResult.resumeContext?.contextForThisStep || enhancedContext,
                    };
                    
                    this.logger.info(`🔍 [DEBUG] 构建完整resumeContext完成，包含planExecutorState: ${!!enhancedResumeContext.planExecutorState}`);
                    
                    // 返回增强的SpecialistInteractionResult
                    return {
                        success: false,
                        needsChatInteraction: true,
                        resumeContext: enhancedResumeContext, // ✅ 现在包含完整的planExecutorState
                        question: specialistResult.question
                    } as SpecialistInteractionResult;
                }
                
                // 现在可以安全地将结果当作SpecialistOutput处理
                const specialistOutput = specialistResult as SpecialistOutput;
                
                // 🚀 检查SpecialistOutput是否包含隐含的用户交互需求（通过工具调用结果）
                if (this.checkSpecialistNeedsChatInteraction(specialistOutput)) {
                    this.logger.info(`💬 ${specialistId} 在第 ${loopState.currentIteration} 轮通过工具调用需要用户交互`);
                    
                    // 构建完整的resumeContext
                    const resumeContext = this.buildCompleteResumeContext(
                        specialistId,
                        step,
                        stepResults,
                        currentSessionContext,
                        userInput,
                        plan,
                        loopState,
                        specialistOutput,
                        enhancedContext
                    );
                    
                    // 提取用户问题
                    const question = this.extractQuestionFromSpecialistOutput(specialistOutput);
                    
                    this.logger.info(`💬 构建完整resumeContext并暂停执行，等待用户回复: "${question}"`);
                    
                    // 返回需要用户交互的特殊结果
                    return {
                        success: false,
                        needsChatInteraction: true,
                        resumeContext,
                        question
                    } as SpecialistInteractionResult;
                }
                
                // 🚀 统一错误处理：执行文件编辑
                let fileEditResult: { success: boolean; error?: string; appliedCount?: number } = { success: true };
                if ('requires_file_editing' in specialistOutput && specialistOutput.requires_file_editing === true) {
                    this.logger.info(`🔧 执行specialist的文件编辑指令 (第${loopState.currentIteration}轮)`);
                    
                    fileEditResult = await this.executeFileEditsInLoop(specialistOutput, currentSessionContext);
                    
                    if (fileEditResult.success) {
                        // 更新session context以反映文件变化
                        const oldSessionContext = currentSessionContext;
                        currentSessionContext = await this.refreshOrUpdateSessionContext(
                            currentSessionContext,
                            (specialistOutput as SpecialistOutput).target_file!
                        );
                        
                        // 🔍 [DEBUG-SESSION-SYNC] 验证本地更新
                        if (oldSessionContext.metadata.lastModified !== currentSessionContext.metadata.lastModified) {
                            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] ✅ Local session context updated successfully`);
                            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] Old: ${oldSessionContext.metadata.lastModified}`);
                            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] New: ${currentSessionContext.metadata.lastModified}`);
                        } else {
                            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] ⚠️ Local session context NOT changed!`);
                        }
                        
                        this.logger.info(`✅ 第${loopState.currentIteration}轮文件编辑完成: ${fileEditResult.appliedCount}个操作`);
                    } else {
                        this.logger.warn(`⚠️ 第${loopState.currentIteration}轮文件编辑失败: ${fileEditResult.error}`);
                        this.logger.info(`🔄 错误将记录到历史中，AI可在下轮循环中查看并修正`);
                    }
                }

                // 🚀 记录本轮执行历史（包含文件编辑结果）
                const executionRecord: SpecialistExecutionHistory = {
                    iteration: loopState.currentIteration,
                    toolCalls: enhancedContext.lastToolCalls || [],
                    toolResults: [
                        ...(enhancedContext.lastToolResults || []),
                        // 🚀 新增：将文件编辑结果也作为工具结果记录
                        ...('requires_file_editing' in specialistOutput && specialistOutput.requires_file_editing === true ? [{
                            toolName: 'fileEdit',
                            success: fileEditResult.success,
                            result: fileEditResult.success 
                                ? { 
                                    appliedCount: fileEditResult.appliedCount, 
                                    message: `成功应用 ${fileEditResult.appliedCount} 个编辑操作`,
                                    targetFile: specialistOutput.target_file
                                }
                                : { 
                                    error: fileEditResult.error,
                                    targetFile: specialistOutput.target_file,
                                    instructionCount: specialistOutput.edit_instructions?.length || 0
                                },
                            error: fileEditResult.success ? undefined : fileEditResult.error
                        }] : [])
                    ],
                    aiResponse: ('content' in specialistOutput) ? specialistOutput.content || '' : '',
                    timestamp: new Date().toISOString(),
                    summary: this.extractIterationSummary(specialistOutput),
                    executionTime: iterationTime
                };
                
                this.recordSpecialistExecution(loopState, executionRecord);
                
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
     * 🚀 辅助方法：在循环内部执行文件编辑 - 统一错误处理版本
     */
    private async executeFileEditsInLoop(
        specialistOutput: SpecialistOutput, 
        currentSessionContext: SessionContext
    ): Promise<{ success: boolean; error?: string; appliedCount?: number }> {
        if (!specialistOutput.edit_instructions || !specialistOutput.target_file) {
            return { success: true, appliedCount: 0 }; // 没有编辑任务算成功
        }

        // 🚀 使用智能路径解析替代简单拼接
        const fullPath = this.smartPathResolution(
            specialistOutput.target_file,
            currentSessionContext.baseDir,
            currentSessionContext.projectName
        );

        this.logger.info(`🔍 [PATH] 智能路径解析: ${specialistOutput.target_file} -> ${fullPath}`);

        try {
            // 使用现有的统一编辑执行器
            const editResult = await executeUnifiedEdits(specialistOutput.edit_instructions, fullPath);
            
            if (!editResult.success) {
                this.logger.error(`❌ 循环内文件编辑失败: ${editResult.error}`);
                return { 
                    success: false, 
                    error: editResult.error || '文件编辑失败，原因未知',
                    appliedCount: editResult.appliedCount || 0
                };
            }
            
            this.logger.info(`✅ 循环内文件编辑成功: ${editResult.appliedCount}个操作应用`);
            return { 
                success: true, 
                appliedCount: editResult.appliedCount || 0 
            };
        } catch (error) {
            const errorMessage = `文件编辑异常: ${(error as Error).message}`;
            this.logger.error(`❌ ${errorMessage}`);
            return { 
                success: false, 
                error: errorMessage,
                appliedCount: 0
            };
        }
    }

    /**
     * 🚀 智能路径解析：处理各种路径格式和corner case
     * 
     * 主要解决问题：
     * - 双重项目名拼接问题（BlackpinkFanWebapp/BlackpinkFanWebapp/SRS.md）
     * - 父子目录同名问题（/aaaa/bbbb/bbbb/ccc.md）
     * - 绝对路径vs相对路径
     * - 路径遍历安全性
     */
    private smartPathResolution(targetFile: string, baseDir: string | null, projectName: string | null): string {
        // 输入验证
        this.validateTargetFile(targetFile);

        // Case 1: target_file是绝对路径
        if (path.isAbsolute(targetFile)) {
            this.logger.info(`🔍 [PATH] Case 1: 绝对路径 -> ${targetFile}`);
            return targetFile;
        }
        
        // Case 2: 没有baseDir，使用target_file作为相对路径
        if (!baseDir) {
            this.logger.info(`🔍 [PATH] Case 2: 无baseDir -> ${targetFile}`);
            return targetFile;
        }
        
        // Case 3: 没有projectName，直接拼接
        if (!projectName) {
            const result = path.join(baseDir, targetFile);
            this.logger.info(`🔍 [PATH] Case 3: 无projectName -> ${result}`);
            return result;
        }
        
        // Case 4: 核心逻辑 - 检查重复项目名问题
        return this.resolveProjectNameDuplication(targetFile, baseDir, projectName);
    }

    /**
     * 🚀 解决项目名重复问题的核心逻辑
     */
    private resolveProjectNameDuplication(targetFile: string, baseDir: string, projectName: string): string {
        // 标准化项目名（处理特殊字符）
        const normalizedProjectName = this.normalizeProjectName(projectName);
        
        // 检查baseDir是否以项目名结尾
        const baseDirEndsWithProject = this.pathEndsWithProjectName(baseDir, normalizedProjectName);
        
        // 检查target_file是否以项目名开头
        const targetFileStartsWithProject = this.pathStartsWithProjectName(targetFile, normalizedProjectName);
        
        let result: string;
        
        if (baseDirEndsWithProject && targetFileStartsWithProject) {
            // Case 4a: 双重项目名 - 需要精确处理，避免父子目录同名问题
            result = this.handleDuplicateProjectName(targetFile, baseDir, normalizedProjectName);
            this.logger.info(`🔍 [PATH] Case 4a: 双重项目名 -> ${result}`);
            
        } else if (baseDirEndsWithProject && !targetFileStartsWithProject) {
            // Case 4b: baseDir包含项目名，target_file不包含 - 正常拼接
            result = path.join(baseDir, targetFile);
            this.logger.info(`🔍 [PATH] Case 4b: baseDir含项目名 -> ${result}`);
            
        } else if (!baseDirEndsWithProject && targetFileStartsWithProject) {
            // Case 4c: baseDir不包含项目名，target_file包含 - 正常拼接
            result = path.join(baseDir, targetFile);
            this.logger.info(`🔍 [PATH] Case 4c: target_file含项目名 -> ${result}`);
            
        } else {
            // Case 4d: 都不包含项目名 - 可能需要插入项目名
            result = this.handleMissingProjectName(targetFile, baseDir, normalizedProjectName);
            this.logger.info(`🔍 [PATH] Case 4d: 都不含项目名 -> ${result}`);
        }
        
        return result;
    }

    /**
     * 🚀 处理双重项目名问题 - 精确版本，避免父子目录同名陷阱
     */
    private handleDuplicateProjectName(targetFile: string, baseDir: string, projectName: string): string {
        // 标准化路径分隔符
        const normalizedTargetFile = targetFile.replace(/[\\\/]/g, path.sep);
        const normalizedBaseDir = baseDir.replace(/[\\\/]/g, path.sep);
        const normalizedProjectName = projectName.replace(/[\\\/]/g, path.sep);
        
        // 分析baseDir和targetFile的结构
        const baseDirParts = normalizedBaseDir.split(path.sep);
        const targetFileParts = normalizedTargetFile.split(path.sep);
        
        // 检查是否真的是双重项目名，而不是父子目录同名
        if (targetFileParts.length > 1 && targetFileParts[0] === normalizedProjectName) {
            // 获取baseDir中最后一个目录名
            const lastBaseDirPart = baseDirParts[baseDirParts.length - 1];
            
            if (lastBaseDirPart === normalizedProjectName) {
                // 确实是双重项目名，移除target_file中的项目名前缀
                const relativePath = targetFileParts.slice(1).join(path.sep);
                
                // 额外验证：确保这不是有意的子目录结构
                if (this.isIntentionalSubdirectory(normalizedTargetFile, normalizedProjectName)) {
                    this.logger.info(`🔍 [PATH] 检测到有意的子目录结构，保持原样`);
                    return path.join(normalizedBaseDir, normalizedTargetFile);
                }
                
                this.logger.info(`🔍 [PATH] 移除重复项目名前缀: ${normalizedTargetFile} -> ${relativePath}`);
                return path.join(normalizedBaseDir, relativePath);
            }
        }
        
        // 如果不是双重项目名，正常拼接
        return path.join(normalizedBaseDir, normalizedTargetFile);
    }

    /**
     * 🚀 检查是否是有意的子目录结构
     * 例如：MyProject/MyProject/config.json 可能是有意的设计
     */
    private isIntentionalSubdirectory(targetFile: string, projectName: string): boolean {
        const parts = targetFile.split(path.sep);
        
        // 如果路径中有多个相同的项目名，可能是有意的
        const projectNameCount = parts.filter(part => part === projectName).length;
        
        // 如果有深层次的目录结构，更可能是有意的
        if (parts.length > 3 && projectNameCount > 1) {
            return true;
        }
        
        // 检查是否是常见的有意子目录模式
        const intentionalPatterns = [
            `${projectName}/src/${projectName}`,
            `${projectName}/lib/${projectName}`,
            `${projectName}/packages/${projectName}`,
            `${projectName}/modules/${projectName}`
        ];
        
        return intentionalPatterns.some(pattern => targetFile.startsWith(pattern));
    }

    /**
     * 🚀 处理缺失项目名的情况
     */
    private handleMissingProjectName(targetFile: string, baseDir: string, projectName: string): string {
        // 检查是否应该插入项目名
        const shouldInsertProject = this.shouldInsertProjectName(targetFile, baseDir, projectName);
        
        if (shouldInsertProject) {
            const result = path.join(baseDir, projectName, targetFile);
            this.logger.info(`🔍 [PATH] 插入项目名: ${targetFile} -> ${result}`);
            return result;
        }
        
        // 否则直接拼接
        return path.join(baseDir, targetFile);
    }

    /**
     * 🚀 判断是否应该插入项目名
     */
    private shouldInsertProjectName(targetFile: string, baseDir: string, projectName: string): boolean {
        // 如果targetFile是常见的项目根文件，不插入项目名
        const rootFiles = [
            'package.json', 'README.md', 'SRS.md', 'LICENSE', 
            '.gitignore', 'tsconfig.json', 'webpack.config.js'
        ];
        
        if (rootFiles.includes(targetFile)) {
            return false;
        }
        
        // 如果targetFile包含目录分隔符，可能需要插入项目名
        if (targetFile.includes(path.sep)) {
            return true;
        }
        
        // 默认不插入
        return false;
    }

    /**
     * 🚀 标准化项目名
     */
    private normalizeProjectName(projectName: string): string {
        // 处理项目名中的特殊字符，但保持原有格式
        const normalized = projectName.trim();
        
        // 检查项目名是否包含路径分隔符（这通常是错误的）
        if (normalized.includes(path.sep)) {
            this.logger.warn(`⚠️ 项目名包含路径分隔符，可能存在问题: ${normalized}`);
        }
        
        return normalized;
    }

    /**
     * 🚀 检查路径是否以项目名结尾
     */
    private pathEndsWithProjectName(pathStr: string, projectName: string): boolean {
        // 处理项目名包含路径分隔符的情况
        if (projectName.includes(path.sep) || projectName.includes('/') || projectName.includes('\\')) {
            // 如果项目名包含路径分隔符，检查路径是否以整个项目名结尾
            const normalizedPath = pathStr.replace(/[\\\/]/g, path.sep);
            const normalizedProjectName = projectName.replace(/[\\\/]/g, path.sep);
            return normalizedPath.endsWith(normalizedProjectName);
        }
        
        // 标准化路径分隔符，确保正确分割
        const normalizedPath = pathStr.replace(/[\\\/]/g, path.sep);
        const pathParts = normalizedPath.split(path.sep);
        const lastPart = pathParts[pathParts.length - 1];
        return lastPart === projectName;
    }

    /**
     * 🚀 检查路径是否以项目名开头
     */
    private pathStartsWithProjectName(pathStr: string, projectName: string): boolean {
        // 处理Windows和Unix路径分隔符的差异
        const normalizedPath = pathStr.replace(/[\\\/]/g, path.sep);
        const normalizedProjectName = projectName.replace(/[\\\/]/g, path.sep);
        
        // 处理项目名包含路径分隔符的情况
        if (normalizedProjectName.includes(path.sep)) {
            return normalizedPath.startsWith(normalizedProjectName + path.sep) || 
                   normalizedPath === normalizedProjectName;
        }
        
        const pathParts = normalizedPath.split(path.sep);
        return pathParts.length > 0 && pathParts[0] === normalizedProjectName;
    }

    /**
     * 🚀 验证目标文件路径的安全性
     */
    private validateTargetFile(targetFile: string): void {
        // 禁止路径遍历
        if (targetFile.includes('..')) {
            throw new Error(`不安全的路径遍历: ${targetFile}`);
        }
        
        // 禁止绝对路径到系统敏感目录
        if (path.isAbsolute(targetFile)) {
            const sensitiveDirectories = ['/etc', '/usr/bin', '/bin', '/sbin', '/root'];
            const normalizedPath = path.normalize(targetFile);
            
            for (const sensitiveDir of sensitiveDirectories) {
                if (normalizedPath.startsWith(sensitiveDir)) {
                    throw new Error(`不允许访问系统敏感目录: ${targetFile}`);
                }
            }
        }
        
        // 禁止空路径
        if (!targetFile || targetFile.trim() === '') {
            throw new Error(`目标文件路径不能为空`);
        }
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
            
            // 🔍 [DEBUG-SESSION-SYNC] 记录更新前的状态
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] === BEFORE SESSION UPDATE ===`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] Current sessionId: ${currentSessionContext.sessionContextId}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] Current lastModified: ${currentSessionContext.metadata.lastModified}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] Target file: ${targetFile}`);
            
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
            
            // 🔍 [DEBUG-SESSION-SYNC] 记录更新后的状态
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] === AFTER SESSION UPDATE ===`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] Updated sessionId: ${updatedContext.sessionContextId}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] Updated lastModified: ${updatedContext.metadata.lastModified}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] ⚠️ This is LOCAL update only - NOT synced to SessionManager yet!`);
            
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
     * 🚀 新增：检查specialist是否需要用户交互
     */
    private checkSpecialistNeedsChatInteraction(specialistOutput: SpecialistOutput): boolean {
        // 检查多种可能的标识方式
        
        // 1. 检查结构化数据中的标识
        if (specialistOutput.structuredData?.needsChatInteraction === true) {
            return true;
        }
        
        // 2. 检查content中的标识（如果specialist通过content返回了特殊标识）
        if (specialistOutput.content && typeof specialistOutput.content === 'string') {
            try {
                const contentObj = JSON.parse(specialistOutput.content);
                if (contentObj.needsChatInteraction === true) {
                    return true;
                }
            } catch (e) {
                // 如果content不是JSON，继续检查其他方式
            }
        }
        
        // 3. 检查metadata中的标识
        if (specialistOutput.metadata?.needsChatInteraction === true) {
            return true;
        }
        
        // 4. 检查是否包含askQuestion工具调用的结果
        if (specialistOutput.metadata?.toolResults) {
            const askQuestionResult = specialistOutput.metadata.toolResults.find(
                (result: any) => result.toolName === 'askQuestion' && result.result?.needsChatInteraction === true
            );
            if (askQuestionResult) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * 🚀 新增：构建完整的resumeContext
     */
    private buildCompleteResumeContext(
        specialistId: string,
        step: any,
        stepResults: { [key: number]: SpecialistOutput },
        currentSessionContext: SessionContext,
        userInput: string,
        plan: { planId: string; description: string; steps: any[] },
        loopState: any,
        specialistOutput: SpecialistOutput,
        enhancedContext: any
    ): any {
        // 提取askQuestion工具的调用信息
        const askQuestionToolCall = this.extractAskQuestionToolCall(specialistOutput);
        const question = this.extractQuestionFromSpecialistOutput(specialistOutput);
        
        // 构建完整的resumeContext
        const resumeContext = {
            // 🚀 原有字段（保持兼容性）
            ruleId: specialistId,
            context: enhancedContext,
            currentIteration: loopState.currentIteration,
            conversationHistory: loopState.executionHistory.map((h: any) => h.summary),
            toolExecutionResults: loopState.executionHistory.flatMap((h: any) => 
                h.toolResults.map((r: any) => `${r.toolName}: ${r.success ? '成功' : '失败'} - ${r.summary || ''}`)
            ),
            pendingPlan: plan,
            
            // 🚀 新增：PlanExecutor完整状态
            planExecutorState: {
                plan: {
                    planId: plan.planId,
                    description: plan.description,
                    steps: plan.steps
                },
                currentStep: step,
                stepResults: stepResults,
                sessionContext: this.serializeSessionContext(currentSessionContext), // 序列化敏感信息
                userInput: userInput,
                
                // specialist循环状态
                specialistLoopState: {
                    specialistId: loopState.specialistId,
                    currentIteration: loopState.currentIteration,
                    maxIterations: loopState.maxIterations,
                    executionHistory: loopState.executionHistory,
                    isLooping: loopState.isLooping,
                    startTime: loopState.startTime,
                    lastContinueReason: loopState.lastContinueReason
                }
            },
            
            // 🚀 新增：askQuestion工具调用的上下文
            askQuestionContext: {
                toolCall: askQuestionToolCall || {
                    name: 'askQuestion',
                    args: { question: question }
                },
                question: question,
                originalResult: specialistOutput,
                timestamp: Date.now()
            },
            
            // 🚀 新增：恢复指导信息
            resumeGuidance: {
                nextAction: 'continue_specialist_execution',
                resumePoint: 'next_iteration',
                expectedUserResponseType: 'answer',
                contextualHints: [
                    `specialist ${specialistId} 在第 ${loopState.currentIteration} 轮迭代中需要用户确认`,
                    `请基于当前的工作进展回答specialist的问题`,
                    `您的回答将帮助specialist继续完成任务`
                ]
            }
        };
        
        this.logger.info(`🔍 构建完整resumeContext: specialistId=${specialistId}, iteration=${loopState.currentIteration}, question="${question}"`);
        
        return resumeContext;
    }

    /**
     * 🚀 新增：提取askQuestion工具调用信息
     */
    private extractAskQuestionToolCall(specialistOutput: SpecialistOutput): any {
        // 尝试从多个位置提取askQuestion工具调用信息
        
        // 1. 从metadata中提取
        if (specialistOutput.metadata?.toolCalls) {
            const askQuestionCall = specialistOutput.metadata.toolCalls.find(
                (call: any) => call.name === 'askQuestion'
            );
            if (askQuestionCall) {
                return askQuestionCall;
            }
        }
        
        // 2. 从结构化数据中提取
        if (specialistOutput.structuredData?.lastToolCall?.name === 'askQuestion') {
            return specialistOutput.structuredData.lastToolCall;
        }
        
        // 3. 如果没有找到，返回null
        return null;
    }

    /**
     * 🚀 新增：从specialist输出中提取用户问题
     */
    private extractQuestionFromSpecialistOutput(specialistOutput: SpecialistOutput): string {
        // 尝试从多个位置提取问题文本
        
        // 1. 从结构化数据中提取
        if (specialistOutput.structuredData?.chatQuestion) {
            return specialistOutput.structuredData.chatQuestion;
        }
        
        // 2. 从metadata中提取
        if (specialistOutput.metadata?.chatQuestion) {
            return specialistOutput.metadata.chatQuestion;
        }
        
        // 3. 从工具结果中提取
        if (specialistOutput.metadata?.toolResults) {
            const askQuestionResult = specialistOutput.metadata.toolResults.find(
                (result: any) => result.toolName === 'askQuestion' && result.result?.chatQuestion
            );
            if (askQuestionResult) {
                return askQuestionResult.result.chatQuestion;
            }
        }
        
        // 4. 从content中尝试提取
        if (specialistOutput.content && typeof specialistOutput.content === 'string') {
            try {
                const contentObj = JSON.parse(specialistOutput.content);
                if (contentObj.chatQuestion) {
                    return contentObj.chatQuestion;
                }
            } catch (e) {
                // 如果content不是JSON，忽略
            }
        }
        
        // 5. 默认问题
        return 'specialist需要您的确认来继续任务';
    }

    /**
     * 🚀 新增：序列化SessionContext以避免敏感信息泄露
     */
    private serializeSessionContext(sessionContext: SessionContext): any {
        // 创建安全的sessionContext副本，移除敏感信息
        return {
            projectName: sessionContext.projectName,
            baseDir: sessionContext.baseDir,
            metadata: {
                ...sessionContext.metadata,
                // 移除可能包含敏感信息的字段
                fileContent: undefined,
                fullText: undefined
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
        plan: { planId: string; description: string; steps: any[] },
        progressCallback?: SpecialistProgressCallback
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
                    selectedModel,
                    undefined, // resumeState
                    progressCallback
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
                        error: `${step.specialist}执行异常: ${(error as Error).message}`,
                        failedStep: step.step,
                        completedSteps: Object.keys(stepResults).length,
                        attempt: attempt,
                        // 🚀 新增：完整的计划执行上下文
                        planExecutionContext: {
                            originalExecutionPlan: plan,
                            totalSteps: plan.steps.length,
                            completedSteps: Object.keys(stepResults).length,
                            failedStep: step.step,
                            failedSpecialist: step.specialist,
                            completedWork: Object.keys(stepResults).map(stepNum => ({
                                step: parseInt(stepNum),
                                specialist: stepResults[parseInt(stepNum)].metadata?.specialist || 'unknown',
                                description: plan.steps.find((s: any) => s.step === parseInt(stepNum))?.description || 'unknown',
                                status: 'completed'
                            })),
                            error: `专家执行异常: ${(error as Error).message}`
                        }
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
                        errorType: validation.errorType,
                        // 🚀 新增：完整的计划执行上下文
                        planExecutionContext: {
                            originalExecutionPlan: plan,
                            totalSteps: plan.steps.length,
                            completedSteps: Object.keys(stepResults).length,
                            failedStep: step.step,
                            failedSpecialist: step.specialist,
                            completedWork: Object.keys(stepResults).map(stepNum => ({
                                step: parseInt(stepNum),
                                specialist: stepResults[parseInt(stepNum)].metadata?.specialist || 'unknown',
                                description: plan.steps.find((s: any) => s.step === parseInt(stepNum))?.description || 'unknown',
                                status: 'completed'
                            })),
                            error: errorMessage
                        }
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

    // ============================================================================
    // 🚀 状态恢复和继续执行方法
    // ============================================================================

    /**
     * 恢复specialist循环状态
     * @param specialistId specialist标识符
     * @param loopState 循环状态数据
     */
    public restoreLoopState(specialistId: string, loopState: any): void {
        this.specialistLoopStates.set(specialistId, {
            specialistId: loopState.specialistId,
            currentIteration: loopState.currentIteration,
            maxIterations: loopState.maxIterations,
            executionHistory: loopState.executionHistory,
            isLooping: loopState.isLooping,
            startTime: loopState.startTime,
            lastContinueReason: loopState.lastContinueReason
        });
        
        this.logger.info(`🔄 恢复specialist循环状态: ${specialistId}, iteration=${loopState.currentIteration}`);
    }

    /**
     * 从指定状态继续执行计划
     * @param plan 执行计划
     * @param currentStep 当前步骤
     * @param stepResults 已完成的步骤结果
     * @param sessionContext 会话上下文
     * @param selectedModel VSCode语言模型
     * @param userInput 原始用户输入
     * @param latestSpecialistResult 最新的specialist结果
     */
    public async continueExecution(
        plan: any,
        currentStep: any,
        stepResults: any,
        sessionContext: SessionContext,
        selectedModel: vscode.LanguageModelChat,
        userInput: string,
        latestSpecialistResult: SpecialistOutput
    ): Promise<{ intent: string; result?: any }> {
        this.logger.info(`🔄 从步骤 ${currentStep.step} 继续执行计划`);
        
        // 将最新的specialist结果添加到stepResults
        stepResults[currentStep.step] = latestSpecialistResult;
        
        // 继续执行计划的下一步（如果有的话）
        const remainingSteps = plan.steps.filter((step: any) => step.step > currentStep.step);
        
        if (remainingSteps.length > 0) {
            this.logger.info(`🔄 继续执行剩余 ${remainingSteps.length} 个步骤`);
            
            // 继续执行剩余步骤
            const continuationPlan = {
                ...plan,
                steps: remainingSteps
            };
            
            return await this.execute(continuationPlan, sessionContext, selectedModel, userInput);
        } else {
            // 所有步骤完成
            this.logger.info(`✅ 所有计划步骤已完成`);
            
            // 🔍 [DEBUG-SESSION-SYNC] 计划执行完成时的session状态检查
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] === PLAN EXECUTION COMPLETED (Path 2) ===`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] SessionContext at completion:`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] - sessionId: ${sessionContext.sessionContextId}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] - lastModified: ${sessionContext.metadata.lastModified}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] - projectName: ${sessionContext.projectName}`);
            this.logger.warn(`🔍 [DEBUG-SESSION-SYNC] ⚠️ This sessionContext may NOT be synced back to SessionManager!`);
            
            return {
                intent: 'plan_completed',
                result: {
                    summary: '计划执行完成',
                    completedSteps: Object.keys(stepResults).length,
                    finalResult: latestSpecialistResult,
                    // 🚀 新增：完整的计划执行上下文
                    planExecutionContext: {
                        originalExecutionPlan: plan,
                        totalSteps: plan.steps.length,
                        completedSteps: Object.keys(stepResults).length,
                        failedStep: null,
                        failedSpecialist: null,
                        completedWork: Object.keys(stepResults).map(stepNum => ({
                            step: parseInt(stepNum),
                            specialist: stepResults[parseInt(stepNum)].metadata?.specialist || 'unknown',
                            description: plan.steps.find((s: any) => s.step === parseInt(stepNum))?.description || 'unknown',
                            status: 'completed'
                        })),
                        error: null
                    }
                }
            };
        }
    }
} 