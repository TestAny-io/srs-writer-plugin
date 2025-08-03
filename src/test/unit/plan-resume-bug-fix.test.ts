import { SRSAgentEngine } from '../../core/srsAgentEngine';

// 🎯 简化版Bug修复验证测试 - 专注于核心逻辑验证

describe('Plan Resume Bug Fix Verification', () => {
    let mockStream: any;
    let mockModel: any;
    let srsEngine: SRSAgentEngine;

    beforeEach(() => {
        // 简化的Mock设置
        mockStream = {
            markdown: jest.fn(),
            progress: jest.fn(),
        };

        mockModel = {
            sendRequest: jest.fn().mockResolvedValue({
                text: ['{"tool_calls":[{"name":"taskComplete","args":{"nextStepType":"TASK_FINISHED","summary":"Test completed"}}]}']
            }),
        };

        srsEngine = new SRSAgentEngine(mockStream, mockModel);
    });

    test('CRITICAL BUG FIX: resumePlanExecutorWithUserResponse should NOT directly set stage to completed when specialist returns TASK_FINISHED', async () => {
        // 🎯 这个测试验证我们删除了错误的特殊处理逻辑
        
        // 模拟用户交互恢复场景的关键状态
        const mockPlanExecutorState = {
            plan: { planId: 'test', steps: [
                { step: 1, specialist: 'test1' },
                { step: 2, specialist: 'test2' }, // 当前步骤
                { step: 3, specialist: 'test3' }, // 剩余步骤 - 应该继续执行
            ]},
            currentStep: { step: 2, specialist: 'test2' },
            stepResults: { 1: { success: true } },
            specialistLoopState: { 
                specialistId: 'test2',
                currentIteration: 1 
            },
            sessionContext: {},
            userInput: 'test input'
        };

        // 模拟specialist在用户交互恢复后返回TASK_FINISHED
        const mockSpecialistResult = {
            success: true,
            structuredData: {
                nextStepType: 'TASK_FINISHED', // 🎯 关键：这在修复前会错误地终止整个plan
                summary: 'Step 2 completed after user interaction'
            }
        };

        // 设置初始状态
        (srsEngine as any).state = {
            stage: 'awaiting_user',
            resumeContext: {
                planExecutorState: mockPlanExecutorState
            }
        };

        // Mock resumePlanExecutorLoop 来验证它被调用（修复后的行为）
        const resumePlanExecutorLoopSpy = jest.spyOn(srsEngine as any, 'resumePlanExecutorLoop')
            .mockResolvedValue(undefined);

        // Mock extractOriginalSpecialistContext
        jest.spyOn(srsEngine as any, 'extractOriginalSpecialistContext')
            .mockReturnValue({
                iteration: 1,
                internalHistory: [],
                currentPlan: {},
                toolResults: [],
                contextForThisStep: {}
            });

        // Mock restoreSessionContext  
        jest.spyOn(srsEngine as any, 'restoreSessionContext')
            .mockResolvedValue({});

        // Mock SpecialistExecutor.execute 返回TASK_FINISHED
        const mockSpecialistExecutor = {
            execute: jest.fn().mockResolvedValue(mockSpecialistResult)
        };

        // Mock dynamic import
        jest.doMock('../../core/specialistExecutor', () => ({
            SpecialistExecutor: jest.fn(() => mockSpecialistExecutor)
        }));

        // 🚀 执行被修复的方法
        const result = await (srsEngine as any).resumePlanExecutorWithUserResponse('用户回复');

        // 🔍 关键验证：修复后的行为
        expect(result).toBe(true); // 应该成功
        
        // ❌ 修复前的错误行为（这些应该不再发生）：
        // expect((srsEngine as any).state.stage).toBe('completed'); // 不应该直接设置为completed
        
        // ✅ 修复后的正确行为：
        expect(resumePlanExecutorLoopSpy).toHaveBeenCalledWith(
            mockPlanExecutorState,
            mockSpecialistResult,
            '用户回复'
        ); // 应该调用resumePlanExecutorLoop让PlanExecutor来决定是否继续

        // 验证specialist执行被调用
        expect(mockSpecialistExecutor.execute).toHaveBeenCalled();

        console.log('✅ CRITICAL BUG FIXED: resumePlanExecutorWithUserResponse now correctly delegates to resumePlanExecutorLoop instead of prematurely terminating plan');
    });

    test('VERIFICATION: check that the problematic code has been removed', () => {
        // 🎯 直接验证代码修复
        const sourceCode = require('fs').readFileSync('./src/core/srsAgentEngine.ts', 'utf8');
        
        // 验证错误的特殊处理代码已被删除
        expect(sourceCode).not.toContain('if (continuedResult.structuredData?.nextStepType === \'TASK_FINISHED\') {');
        expect(sourceCode).not.toContain('this.state.stage = \'completed\';');
        
        // 验证正确的修复注释存在
        expect(sourceCode).toContain('CRITICAL FIX: 移除对TASK_FINISHED的错误特殊处理');
        expect(sourceCode).toContain('await this.resumePlanExecutorLoop(planExecutorState, continuedResult, userResponse);');
        
        console.log('✅ CODE VERIFICATION: Problematic code has been successfully removed and replaced with correct logic');
    });

    test('EDGE CASE: verify fix does not break other nextStepType values', async () => {
        // 验证修复不会影响其他nextStepType值的处理
        const testCases = [
            'CONTINUE_SAME_SPECIALIST',
            'HANDOFF_TO_SPECIALIST',
            undefined,
            null
        ];

        for (const nextStepType of testCases) {
            const mockSpecialistResult = {
                success: true,
                structuredData: { nextStepType, summary: 'Test' }
            };

            // 验证所有情况都会调用resumePlanExecutorLoop
            const resumeSpy = jest.spyOn(srsEngine as any, 'resumePlanExecutorLoop')
                .mockResolvedValue(undefined);

            // Mock其他依赖
            jest.spyOn(srsEngine as any, 'extractOriginalSpecialistContext')
                .mockReturnValue({ iteration: 1, internalHistory: [], currentPlan: {}, toolResults: [], contextForThisStep: {} });
            jest.spyOn(srsEngine as any, 'restoreSessionContext').mockResolvedValue({});

            const mockExecutor = { execute: jest.fn().mockResolvedValue(mockSpecialistResult) };
            jest.doMock('../../core/specialistExecutor', () => ({
                SpecialistExecutor: jest.fn(() => mockExecutor)
            }));

            (srsEngine as any).state = {
                resumeContext: {
                    planExecutorState: { specialistLoopState: { specialistId: 'test' } }
                }
            };

            await (srsEngine as any).resumePlanExecutorWithUserResponse('test');

            expect(resumeSpy).toHaveBeenCalled();
            resumeSpy.mockRestore();
        }

        console.log('✅ EDGE CASE VERIFICATION: Fix correctly handles all nextStepType values uniformly');
    });
});