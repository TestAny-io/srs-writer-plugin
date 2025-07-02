import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { SessionContext } from '../../types/session';
import { SpecialistOutput } from '../../types/index';
import { SpecialistExecutor } from '../specialistExecutor';
// 🚀 Phase 1新增：编辑指令支持
import { executeEditInstructions } from '../../tools/atomic/edit-execution-tools';

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
 */
export class PlanExecutor {
    private logger = Logger.getInstance();

    constructor(
        private specialistExecutor: SpecialistExecutor
    ) {}

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
                
                // 🚀 新增：带重试机制的specialist执行
                const specialistOutput = await this.executeStepWithRetry(
                    step, 
                    stepResults, 
                    currentSessionContext, 
                    userInput, 
                    selectedModel, 
                    plan
                );

                // 检查是否执行失败（已经在executeStepWithRetry中处理了重试）
                if (!specialistOutput.success || (specialistOutput as any).planFailed) {
                    // executeStepWithRetry已经返回了失败结果，直接返回
                    return specialistOutput as any;
                }

                // 🚀 新增：基于requires_file_editing字段处理文件操作
                if (specialistOutput.requires_file_editing === true) {
                    // specialist明确表示需要文件编辑，此时edit_instructions和target_file已经在验证阶段确保存在
                    this.logger.info(`🔧 执行编辑指令: ${specialistOutput.edit_instructions!.length}个操作`);
                    this.logger.info(`🔧 目标文件: ${specialistOutput.target_file}`);
                    
                    // 🚀 修复：使用baseDir拼接完整文件路径
                    const fullPath = currentSessionContext.baseDir 
                        ? path.join(currentSessionContext.baseDir, specialistOutput.target_file!)
                        : specialistOutput.target_file!;
                    
                    this.logger.info(`🔧 完整文件路径: ${fullPath}`);
                    
                    const editResult = await executeEditInstructions(
                        specialistOutput.edit_instructions!,
                        fullPath
                    );
                    
                    if (!editResult.success) {
                        this.logger.error(`❌ 编辑指令失败: ${editResult.error}`);
                        
                        // 🚧 Phase 2: 编辑修复专家逻辑 (当前版本直接失败)
                        return {
                            intent: 'plan_failed',
                            result: {
                                summary: `计划 '${plan.description}' 在步骤 ${step.step} 的文件编辑失败`,
                                error: `文件编辑失败: ${editResult.error}`,
                                failedStep: step.step,
                                completedSteps: Object.keys(stepResults).length,
                                editFailureDetails: {
                                    targetFile: specialistOutput.target_file,
                                    instructionsCount: specialistOutput.edit_instructions!.length,
                                    appliedCount: editResult.appliedInstructions?.length || 0,
                                    failedCount: editResult.failedInstructions?.length || 0
                                }
                            }
                        };
                    }
                    
                    // 编辑成功，更新specialist输出以包含编辑结果
                    (specialistOutput.metadata as any).editResult = editResult;
                    this.logger.info(`✅ 编辑指令执行成功，修改了${editResult.appliedInstructions.length}个位置`);
                } else if (specialistOutput.requires_file_editing === false) {
                    // specialist明确表示不需要文件编辑
                    this.logger.info(`ℹ️ 步骤 ${step.step} 无需文件编辑 (requires_file_editing=false)`);
                } else {
                    // 这种情况在验证阶段应该已经被拦截，如果到这里说明有逻辑错误
                    this.logger.error(`🚨 严重错误: 步骤 ${step.step} 的requires_file_editing字段无效: ${specialistOutput.requires_file_editing}`);
                    return {
                        intent: 'plan_error',
                        result: {
                            summary: `计划 '${plan.description}' 在步骤 ${step.step} 发生逻辑错误`,
                            error: `requires_file_editing字段无效: ${specialistOutput.requires_file_editing}`,
                            failedStep: step.step,
                            completedSteps: Object.keys(stepResults).length
                        }
                    };
                }

                // 4. 保存该步骤的结果
                stepResults[step.step] = specialistOutput;
                
                // 🚀 检查是否需要刷新session上下文（特别是项目初始化步骤）
                if (this.isSessionChangingStep(step)) {
                    this.logger.info(`🔄 步骤 ${step.step} 可能改变了session状态，正在刷新...`);
                    currentSessionContext = await this.refreshSessionContext();
                    this.logger.info(`✅ Session上下文已刷新，新项目: ${currentSessionContext?.projectName || 'unknown'}`);
                }
                
                this.logger.info(`✅ 步骤 ${step.step} 完成 (${specialistOutput.metadata.iterations}次迭代)`);
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
        userInput: string
    ): any {
        // 提取依赖步骤的结果
        const dependencies = step.context_dependencies || [];
        const dependentResults = dependencies.map((depStep: number): { step: number; content?: string; structuredData?: any; specialist?: string } => ({
            step: depStep,
            content: allPreviousResults[depStep]?.content,
            structuredData: allPreviousResults[depStep]?.structuredData,
            specialist: allPreviousResults[depStep]?.metadata.specialist
        })).filter((dep: { step: number; content?: string; structuredData?: any; specialist?: string }) => dep.content || dep.structuredData);

        // 构建当前步骤的完整上下文
        return {
            // 基础会话信息（永不变化）
            userInput: userInput,
            sessionData: initialSessionContext,
            
            // 当前步骤的信息
            currentStep: {
                number: step.step,
                description: step.description,
                specialist: step.specialist,
                expectedOutput: step.expectedOutput
            },
            
            // 依赖的上一步或多步的结果
            dependentResults,
            
            // 所有已完成步骤的摘要（用于全局上下文）
            completedStepsOverview: this.generateStepsOverview(allPreviousResults)
        };
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
                               previousFailure?: string): any {
        const baseContext = this.prepareContextForStep(step, allPreviousResults, initialSessionContext, userInput);
        
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
                lastFailureReason
            );

            if (lastFailureReason) {
                this.logger.info(`🔄 重试步骤 ${step.step}，失败原因: ${lastFailureReason}`);
            }

            // 2. 调用SpecialistExecutor
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