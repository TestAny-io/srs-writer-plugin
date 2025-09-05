/**
 * PlanExecutor 会话日志记录测试
 * 验证 specialist 失败和 plan_failed 事件的记录
 */

import { PlanExecutor } from '../../core/orchestrator/PlanExecutor';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { SessionLogService } from '../../core/SessionLogService';
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

describe('PlanExecutor - Session Logging', () => {
    let planExecutor: PlanExecutor;
    let mockSpecialistExecutor: any;
    let mockSessionLogService: any;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // 创建 mock SpecialistExecutor
        mockSpecialistExecutor = {
            getSpecialistName: jest.fn((id) => {
                const nameMap: { [key: string]: string } = {
                    'fr_writer': '功能需求专家',
                    'project_initializer': '项目初始化专家',
                    'overall_description_writer': '总体描述专家'
                };
                return nameMap[id] || id;
            })
        };
        
        // 创建 mock SessionLogService
        mockSessionLogService = {
            recordToolExecution: jest.fn().mockResolvedValue(undefined),
            recordLifecycleEvent: jest.fn().mockResolvedValue(undefined)
        };
        
        planExecutor = new PlanExecutor(mockSpecialistExecutor);
        (planExecutor as any).sessionLogService = mockSessionLogService;
    });
    
    describe('recordSpecialistStepFailure 方法测试', () => {
        it('应该记录 specialist 步骤失败', async () => {
            const planId = 'plan-test-123';
            const step = {
                step: 5,
                specialist: 'fr_writer',
                description: '撰写功能需求'
            };
            const specialistOutput: SpecialistOutput = {
                success: false,
                error: 'Token限制或空响应错误，正在优化提示词重试 (重试3次后仍失败: Response contained no choices.)',
                metadata: {
                    iterations: 3,
                    loopIterations: 1,
                    executionTime: 931654
                }
            };
            const stepExecutionTime = 931654;
            
            // 调用私有方法
            await (planExecutor as any).recordSpecialistStepFailure(
                planId,
                step,
                specialistOutput,
                stepExecutionTime
            );
            
            // 验证 SessionLogService 被正确调用
            expect(mockSessionLogService.recordToolExecution).toHaveBeenCalledWith({
                executor: 'plan_executor',
                toolName: 'specialist_step_execution',
                operation: '步骤 5 fr_writer 执行失败: Token限制或空响应错误，正在优化提示词重试 (重试3次后仍失败: Response contained no choices.)',
                success: false,
                error: 'Token限制或空响应错误，正在优化提示词重试 (重试3次后仍失败: Response contained no choices.)',
                executionTime: 931654,
                metadata: {
                    planId: 'plan-test-123',
                    stepNumber: 5,
                    specialistId: 'fr_writer',
                    specialistName: '功能需求专家',
                    iterations: 3,
                    loopIterations: 1,
                    failureReason: 'Token限制或空响应错误，正在优化提示词重试 (重试3次后仍失败: Response contained no choices.)'
                }
            });
        });
    });
    
    describe('recordPlanFailure 方法测试', () => {
        it('应该记录 plan_failed 事件', async () => {
            const plan = {
                planId: 'plan-test-456',
                description: '创建Blackpink粉丝交流平台SRS',
                steps: [
                    { step: 1, specialist: 'project_initializer' },
                    { step: 2, specialist: 'overall_description_writer' },
                    { step: 3, specialist: 'fr_writer' }
                ]
            };
            const failedStep = {
                step: 3,
                specialist: 'fr_writer',
                description: '撰写功能需求'
            };
            const specialistOutput: SpecialistOutput = {
                success: false,
                error: 'Token限制错误',
                metadata: {
                    iterations: 2,
                    executionTime: 500000
                }
            };
            const completedSteps = 2;
            const stepExecutionTime = 500000;
            
            // 调用私有方法
            await (planExecutor as any).recordPlanFailure(
                plan,
                failedStep,
                specialistOutput,
                completedSteps,
                stepExecutionTime
            );
            
            // 验证 SessionLogService 被正确调用
            expect(mockSessionLogService.recordLifecycleEvent).toHaveBeenCalledWith({
                eventType: 'plan_failed',
                description: '计划 "创建Blackpink粉丝交流平台SRS" 执行失败: Token限制错误',
                entityId: 'plan-test-456',
                metadata: {
                    planId: 'plan-test-456',
                    planDescription: '创建Blackpink粉丝交流平台SRS',
                    failedStep: 3,
                    failedStepDescription: '撰写功能需求',
                    failedSpecialist: 'fr_writer',
                    failedSpecialistName: '功能需求专家',
                    totalSteps: 3,
                    completedSteps: 2,
                    error: 'Token限制错误',
                    stepExecutionTime: 500000,
                    specialistIterations: 2
                }
            });
        });
    });
    
    describe('getSpecialistName 方法测试', () => {
        it('应该正确获取 specialist 显示名称', () => {
            const result = (planExecutor as any).getSpecialistName('fr_writer');
            expect(result).toBe('功能需求专家');
            expect(mockSpecialistExecutor.getSpecialistName).toHaveBeenCalledWith('fr_writer');
        });
        
        it('应该处理获取失败的情况', () => {
            mockSpecialistExecutor.getSpecialistName.mockImplementation(() => {
                throw new Error('Registry error');
            });
            
            const result = (planExecutor as any).getSpecialistName('unknown_specialist');
            expect(result).toBe('unknown_specialist');
        });
    });
});
