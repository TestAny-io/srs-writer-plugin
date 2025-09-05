/**
 * 计划恢复增强功能测试
 * 验证被动中断检测、恢复选项显示和计划恢复执行
 */

import { SRSAgentEngine } from '../../core/srsAgentEngine';
import { PlanExecutor } from '../../core/orchestrator/PlanExecutor';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { SessionManager } from '../../core/session-manager';
import { OperationType } from '../../types/session';
import { PlanInterruptionState } from '../../core/engine/AgentState';

// Mock vscode
jest.mock('vscode', () => ({
    ChatResponseStream: jest.fn(),
    LanguageModelChatMessage: {
        User: jest.fn((content) => ({ content, role: 'user' }))
    },
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }]
    }
}));

// Mock dependencies
jest.mock('../../core/session-manager');
jest.mock('../../core/specialistExecutor');
jest.mock('../../core/orchestrator/PlanExecutor');
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

describe('计划恢复增强功能', () => {
    let srsAgentEngine: SRSAgentEngine;
    let mockStream: any;
    let mockModel: any;
    let mockSessionManager: any;
    let mockPlanExecutor: any;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock stream
        mockStream = {
            markdown: jest.fn(),
            progress: jest.fn()
        };
        
        // Mock model
        mockModel = {
            name: 'test-model'
        };
        
        // Mock SessionManager
        mockSessionManager = {
            getInstance: jest.fn(),
            subscribe: jest.fn(),
            updateSessionWithLog: jest.fn().mockResolvedValue(undefined),
            getCurrentSession: jest.fn().mockResolvedValue({
                sessionContextId: 'test-session',
                projectName: 'TestProject'
            })
        };
        (SessionManager as any).getInstance.mockReturnValue(mockSessionManager);
        
        // Mock PlanExecutor
        mockPlanExecutor = {
            resumeFromStep: jest.fn()
        };
        
        srsAgentEngine = new SRSAgentEngine(mockStream, mockModel);
        (srsAgentEngine as any).planExecutor = mockPlanExecutor;
    });
    
    describe('被动中断检测', () => {
        it('应该正确识别被动中断', () => {
            const testCases = [
                { error: 'Token限制或空响应错误', expected: true },
                { error: 'Response contained no choices', expected: true },
                { error: '网络错误', expected: true },
                { error: '重试3次后仍失败', expected: true },
                { error: 'Rate limit exceeded', expected: true },
                { error: '业务逻辑错误', expected: false },
                { error: '参数验证失败', expected: false },
                { error: 'Specialist返回了无效的JSON', expected: false }
            ];
            
            testCases.forEach(({ error, expected }) => {
                const executionResult = {
                    result: { error }
                };
                
                const result = (srsAgentEngine as any).detectPassiveInterruption(executionResult);
                expect(result).toBe(expected);
            });
        });
    });
    
    describe('中断状态保存', () => {
        it('应该正确保存计划中断状态', async () => {
            const executionResult = {
                result: {
                    error: 'Token限制错误',
                    failedStep: 5,
                    planExecutionContext: {
                        originalExecutionPlan: {
                            planId: 'plan-test-123',
                            description: '测试计划',
                            steps: [
                                { step: 1, specialist: 'specialist1' },
                                { step: 2, specialist: 'specialist2' },
                                { step: 3, specialist: 'specialist3' }
                            ]
                        },
                        completedWork: [
                            { step: 1, specialist: 'specialist1', status: 'completed' },
                            { step: 2, specialist: 'specialist2', status: 'completed' }
                        ]
                    }
                }
            };
            
            // 模拟被动中断检测
            (srsAgentEngine as any).detectPassiveInterruption = jest.fn().mockReturnValue(true);
            (srsAgentEngine as any).extractCompletedStepResults = jest.fn().mockReturnValue({
                1: { success: true, content: 'step 1 result' },
                2: { success: true, content: 'step 2 result' }
            });
            (srsAgentEngine as any).serializeSessionContext = jest.fn().mockReturnValue({
                sessionContextId: 'test-session'
            });
            (srsAgentEngine as any).showPlanRecoveryOptions = jest.fn().mockResolvedValue(undefined);
            
            // 设置初始状态
            (srsAgentEngine as any).state = {
                currentTask: '创建SRS文档',
                stage: 'executing'
            };
            
            // 调用处理方法
            await (srsAgentEngine as any).handlePlanFailedWithRecovery(executionResult);
            
            // 验证中断状态被正确保存
            const interruptionState = (srsAgentEngine as any).state.planInterruptionState;
            expect(interruptionState).toBeDefined();
            expect(interruptionState.planId).toBe('plan-test-123');
            expect(interruptionState.failedStep).toBe(5);
            expect(interruptionState.canResume).toBe(true);
            
            // 验证持久化被调用
            expect(mockSessionManager.updateSessionWithLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    logEntry: expect.objectContaining({
                        type: OperationType.PLAN_INTERRUPTED
                    })
                })
            );
        });
    });
    
    describe('恢复选项显示', () => {
        it('应该显示正确的恢复选项', async () => {
            const interruptionState: PlanInterruptionState = {
                planId: 'plan-test-456',
                planDescription: '测试计划描述',
                originalPlan: {
                    steps: [
                        { step: 1 }, { step: 2 }, { step: 3 }, { step: 4 }, { step: 5 }
                    ]
                },
                failedStep: 3,
                completedStepResults: {
                    1: { success: true },
                    2: { success: true }
                },
                sessionContext: {},
                userInput: 'test input',
                interruptionReason: 'Token限制错误',
                interruptionTimestamp: new Date().toISOString(),
                canResume: true
            };
            
            (srsAgentEngine as any).state = {
                planInterruptionState: interruptionState
            };
            
            // 调用显示恢复选项方法
            await (srsAgentEngine as any).showPlanRecoveryOptions();
            
            // 验证状态设置
            expect((srsAgentEngine as any).state.stage).toBe('awaiting_user');
            expect((srsAgentEngine as any).state.pendingInteraction).toBeDefined();
            expect((srsAgentEngine as any).state.pendingInteraction.type).toBe('choice');
            expect((srsAgentEngine as any).state.pendingInteraction.options).toEqual([
                '继续执行写作计划',
                '结束写作计划'
            ]);
            
            // 验证 UI 显示
            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('计划执行中断')
            );
            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('失败步骤: 3')
            );
            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('已完成: 2 步骤')
            );
        });
    });
    
    describe('计划恢复执行', () => {
        it('应该调用 PlanExecutor.resumeFromStep 恢复执行', async () => {
            const interruptionState: PlanInterruptionState = {
                planId: 'plan-resume-test',
                planDescription: '恢复测试计划',
                originalPlan: {
                    planId: 'plan-resume-test',
                    description: '恢复测试计划',
                    steps: [{ step: 1 }, { step: 2 }, { step: 3 }]
                },
                failedStep: 2,
                completedStepResults: {
                    1: { success: true, content: 'step 1 completed' }
                },
                sessionContext: { sessionContextId: 'test' },
                userInput: 'test input',
                interruptionReason: 'Token限制',
                interruptionTimestamp: new Date().toISOString(),
                canResume: true
            };
            
            (srsAgentEngine as any).state = {
                planInterruptionState: interruptionState
            };
            
            // Mock PlanExecutor.resumeFromStep 返回成功
            mockPlanExecutor.resumeFromStep.mockResolvedValue({
                intent: 'plan_completed',
                result: {
                    summary: '恢复执行成功',
                    resumedFromStep: 2
                }
            });
            
            // 调用恢复方法
            await (srsAgentEngine as any).resumePlanFromInterruption();
            
            // 验证 PlanExecutor.resumeFromStep 被正确调用
            expect(mockPlanExecutor.resumeFromStep).toHaveBeenCalledWith(
                interruptionState.originalPlan,
                interruptionState.failedStep,
                interruptionState.completedStepResults,
                interruptionState.sessionContext,
                interruptionState.userInput,
                mockModel,
                expect.any(Object) // progressCallback
            );
            
            // 验证恢复成功的处理
            expect((srsAgentEngine as any).state.stage).toBe('completed');
            expect((srsAgentEngine as any).state.planInterruptionState).toBeUndefined();
            
            // 验证恢复记录
            expect(mockSessionManager.updateSessionWithLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    logEntry: expect.objectContaining({
                        type: OperationType.PLAN_RESUMED
                    })
                })
            );
        });
        
        it('应该处理恢复执行再次失败的情况', async () => {
            const interruptionState: PlanInterruptionState = {
                planId: 'plan-fail-again',
                planDescription: '再次失败测试',
                originalPlan: { planId: 'plan-fail-again' },
                failedStep: 2,
                completedStepResults: {},
                sessionContext: {},
                userInput: 'test',
                interruptionReason: 'Token限制',
                interruptionTimestamp: new Date().toISOString(),
                canResume: true
            };
            
            (srsAgentEngine as any).state = {
                planInterruptionState: interruptionState
            };
            
            // Mock PlanExecutor.resumeFromStep 返回失败
            mockPlanExecutor.resumeFromStep.mockResolvedValue({
                intent: 'plan_failed',
                result: {
                    error: 'Token限制错误',
                    failedStep: 3
                }
            });
            
            // Mock 再次检测为被动中断
            (srsAgentEngine as any).detectPassiveInterruption = jest.fn().mockReturnValue(true);
            (srsAgentEngine as any).showPlanRecoveryOptions = jest.fn().mockResolvedValue(undefined);
            
            // 调用恢复方法
            await (srsAgentEngine as any).resumePlanFromInterruption();
            
            // 验证中断状态被更新
            expect((srsAgentEngine as any).state.planInterruptionState.failedStep).toBe(3);
            expect((srsAgentEngine as any).state.planInterruptionState.interruptionReason).toBe('Token限制错误');
            
            // 验证再次显示恢复选项
            expect((srsAgentEngine as any).showPlanRecoveryOptions).toHaveBeenCalled();
        });
    });
    
    describe('计划终止', () => {
        it('应该正确终止计划并记录', async () => {
            const interruptionState: PlanInterruptionState = {
                planId: 'plan-terminate-test',
                planDescription: '终止测试计划',
                originalPlan: { steps: [{ step: 1 }, { step: 2 }] },
                failedStep: 2,
                completedStepResults: { 1: { success: true } },
                sessionContext: {},
                userInput: 'test',
                interruptionReason: 'Token限制',
                interruptionTimestamp: new Date().toISOString(),
                canResume: true
            };
            
            (srsAgentEngine as any).state = {
                planInterruptionState: interruptionState
            };
            
            // 调用终止方法
            await (srsAgentEngine as any).terminatePlan();
            
            // 验证状态清理
            expect((srsAgentEngine as any).state.stage).toBe('completed');
            expect((srsAgentEngine as any).state.planInterruptionState).toBeUndefined();
            
            // 验证终止记录
            expect(mockSessionManager.updateSessionWithLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    logEntry: expect.objectContaining({
                        type: OperationType.PLAN_TERMINATED,
                        operation: expect.stringContaining('用户选择终止')
                    })
                })
            );
            
            // 验证 UI 显示
            expect(mockStream.markdown).toHaveBeenCalledWith(
                expect.stringContaining('计划执行已终止')
            );
        });
    });
});
