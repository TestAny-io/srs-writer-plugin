/**
 * PlanExecutor.resumeFromStep() 方法测试
 * 验证从指定步骤恢复计划执行的完整逻辑
 */

import { PlanExecutor } from '../../core/orchestrator/PlanExecutor';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { SpecialistOutput } from '../../core/engine/AgentState';

// Mock dependencies
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }]
    }
}));

jest.mock('../../utils/logger', () => ({
    Logger: {
        getInstance: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            error: jest.fn()
        }))
    }
}));

jest.mock('../../core/specialistExecutor');
jest.mock('../../core/SessionLogService');

describe('PlanExecutor - resumeFromStep', () => {
    let planExecutor: PlanExecutor;
    let mockSpecialistExecutor: any;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock SpecialistExecutor
        mockSpecialistExecutor = {
            getSpecialistName: jest.fn((id) => `${id}_name`)
        };
        
        planExecutor = new PlanExecutor(mockSpecialistExecutor);
        
        // Mock executeSpecialistWithLoopSupport 方法
        (planExecutor as any).executeSpecialistWithLoopSupport = jest.fn();
        (planExecutor as any).formatStepResults = jest.fn().mockReturnValue({});
        (planExecutor as any).extractFinalOutput = jest.fn().mockReturnValue({});
        (planExecutor as any).checkIfFileAffectsSession = jest.fn().mockReturnValue(false);
    });
    
    describe('成功恢复执行', () => {
        it('应该从失败步骤开始重新执行', async () => {
            const originalPlan = {
                planId: 'plan-resume-success',
                description: '恢复成功测试',
                steps: [
                    { step: 1, specialist: 'specialist1', description: '步骤1' },
                    { step: 2, specialist: 'specialist2', description: '步骤2' },
                    { step: 3, specialist: 'specialist3', description: '步骤3' }
                ]
            };
            
            const completedStepResults = {
                1: { success: true, content: 'step 1 completed' }
            };
            
            const sessionContext = {
                sessionContextId: 'test-session',
                projectName: 'TestProject'
            };
            
            // Mock specialist 执行成功
            (planExecutor as any).executeSpecialistWithLoopSupport
                .mockResolvedValueOnce({ success: true, content: 'step 2 completed' })  // 步骤2成功
                .mockResolvedValueOnce({ success: true, content: 'step 3 completed' }); // 步骤3成功
            
            // 调用 resumeFromStep
            const result = await planExecutor.resumeFromStep(
                originalPlan,
                2,  // 从步骤2开始恢复
                completedStepResults,
                sessionContext,
                'test input',
                {} as any,  // selectedModel
                undefined    // progressCallback
            );
            
            // 验证结果
            expect(result.intent).toBe('plan_completed');
            expect(result.result?.resumedFromStep).toBe(2);
            expect(result.result?.summary).toContain('恢复执行成功完成');
            
            // 验证 executeSpecialistWithLoopSupport 被正确调用
            expect((planExecutor as any).executeSpecialistWithLoopSupport).toHaveBeenCalledTimes(2);
            
            // 验证第一次调用（步骤2）
            expect((planExecutor as any).executeSpecialistWithLoopSupport).toHaveBeenNthCalledWith(
                1,
                { step: 2, specialist: 'specialist2', description: '步骤2' },
                expect.objectContaining({
                    1: { success: true, content: 'step 1 completed' }  // 包含已完成的步骤
                }),
                sessionContext,
                'test input',
                {},  // selectedModel
                originalPlan,  // 保持原始计划
                undefined
            );
        });
        
        it('应该处理恢复执行中的用户交互需求', async () => {
            const originalPlan = {
                planId: 'plan-interaction-test',
                steps: [
                    { step: 1, specialist: 'specialist1' },
                    { step: 2, specialist: 'specialist2' }
                ]
            };
            
            // Mock specialist 需要用户交互
            (planExecutor as any).executeSpecialistWithLoopSupport.mockResolvedValue({
                needsChatInteraction: true,
                question: '需要用户确认',
                resumeContext: {}
            });
            
            const result = await planExecutor.resumeFromStep(
                originalPlan,
                1,
                {},
                {},
                'test input',
                {} as any
            );
            
            // 验证返回用户交互需求
            expect(result.intent).toBe('user_interaction_required');
            expect(result.result?.question).toBe('需要用户确认');
        });
        
        it('应该处理恢复执行中的步骤失败', async () => {
            const originalPlan = {
                planId: 'plan-fail-during-resume',
                steps: [
                    { step: 1, specialist: 'specialist1' },
                    { step: 2, specialist: 'specialist2' }
                ]
            };
            
            // Mock specialist 执行失败
            (planExecutor as any).executeSpecialistWithLoopSupport.mockResolvedValue({
                success: false,
                error: 'Specialist execution failed',
                metadata: { iterations: 2 }
            });
            
            // Mock recordSpecialistStepFailure
            (planExecutor as any).recordSpecialistStepFailure = jest.fn().mockResolvedValue(undefined);
            
            const result = await planExecutor.resumeFromStep(
                originalPlan,
                1,
                {},
                {},
                'test input',
                {} as any
            );
            
            // 验证返回失败结果
            expect(result.intent).toBe('plan_failed');
            expect(result.result?.error).toContain('specialist1执行失败');
            expect(result.result?.failedStep).toBe(1);
            
            // 验证失败记录被调用
            expect((planExecutor as any).recordSpecialistStepFailure).toHaveBeenCalledWith(
                'plan-fail-during-resume',
                { step: 1, specialist: 'specialist1' },
                expect.objectContaining({ success: false }),
                expect.any(Number)
            );
        });
    });
    
    describe('错误处理', () => {
        it('应该处理 resumeFromStep 中的异常', async () => {
            const originalPlan = { planId: 'plan-exception-test' };
            
            // Mock executeSpecialistWithLoopSupport 抛出异常
            (planExecutor as any).executeSpecialistWithLoopSupport.mockRejectedValue(
                new Error('Execution exception')
            );
            
            const result = await planExecutor.resumeFromStep(
                originalPlan,
                1,
                {},
                {},
                'test input',
                {} as any
            );
            
            // 验证异常处理
            expect(result.intent).toBe('plan_failed');
            expect(result.result?.error).toContain('恢复执行异常');
        });
    });
});
