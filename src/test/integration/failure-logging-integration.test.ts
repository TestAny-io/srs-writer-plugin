/**
 * 失败日志记录集成测试
 * 验证 specialist 失败和 plan_failed 事件的完整记录流程
 */

import { PlanExecutor } from '../../core/orchestrator/PlanExecutor';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { SessionLogService } from '../../core/SessionLogService';
import { SpecialistOutput } from '../../core/engine/AgentState';
import { OperationType } from '../../types/session';

// Mock dependencies
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }]
    },
    extensions: {
        getExtension: jest.fn(() => ({
            extensionPath: '/test/extension/path'
        }))
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

// Mock other dependencies
jest.mock('../../core/orchestrator/ToolAccessController');
jest.mock('../../core/orchestrator/ToolCacheManager');
jest.mock('../../core/toolExecutor');
jest.mock('../../core/prompts/PromptAssemblyEngine');
jest.mock('../../core/history/TokenAwareHistoryManager');
jest.mock('../../core/session-manager');

describe('Failure Logging Integration', () => {
    let planExecutor: PlanExecutor;
    let mockSpecialistExecutor: any;
    let mockSessionLogService: any;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // 创建 mock SpecialistExecutor
        mockSpecialistExecutor = {
            execute: jest.fn(),
            getSpecialistName: jest.fn((id) => {
                const nameMap: { [key: string]: string } = {
                    'fr_writer': '功能需求专家',
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
    
    describe('specialist 失败记录集成测试', () => {
        it('应该记录完整的 specialist 失败信息', async () => {
            // 模拟 specialist 执行失败
            const failedSpecialistOutput: SpecialistOutput = {
                success: false,
                error: 'Token限制或空响应错误，正在优化提示词重试 (重试3次后仍失败: Response contained no choices.)',
                metadata: {
                    specialist: 'fr_writer',
                    iterations: 3,
                    loopIterations: 1,
                    executionTime: 931654
                }
            };
            
            mockSpecialistExecutor.execute.mockResolvedValue(failedSpecialistOutput);
            
            const plan = {
                planId: 'plan-integration-test',
                description: '创建Blackpink粉丝交流平台SRS',
                steps: [
                    {
                        step: 1,
                        specialist: 'overall_description_writer',
                        description: '撰写总体描述'
                    },
                    {
                        step: 2,
                        specialist: 'fr_writer',
                        description: '撰写功能需求'
                    }
                ]
            };
            
            const sessionContext = {
                projectName: 'TestProject',
                sessionContextId: 'test-session-id',
                baseDir: '/test/project',
                activeFiles: ['SRS.md'],
                metadata: {
                    srsVersion: 'v1.0',
                    created: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    version: '5.0'
                }
            };
            
            const mockModel = {} as any;
            const userInput = '创建SRS文档';
            
            // 执行计划（应该在第2步失败）
            const result = await planExecutor.execute(plan, sessionContext, mockModel, userInput);
            
            // 验证返回结果
            expect(result.intent).toBe('plan_failed');
            expect(result.result?.failedStep).toBe(1); // 第一个步骤失败
            expect(result.result?.error).toContain('overall_description_writer执行失败');
            
            // 验证 specialist 步骤失败被记录
            expect(mockSessionLogService.recordToolExecution).toHaveBeenCalledWith(
                expect.objectContaining({
                    executor: 'plan_executor',
                    toolName: 'specialist_step_execution',
                    operation: expect.stringContaining('overall_description_writer 执行失败'),
                    success: false,
                    error: expect.stringContaining('Token限制'),
                    metadata: expect.objectContaining({
                        planId: 'plan-integration-test',
                        stepNumber: 1,
                        specialistId: 'overall_description_writer',
                        specialistName: '总体描述专家'
                    })
                })
            );
            
            // 验证 plan_failed 事件被记录
            expect(mockSessionLogService.recordLifecycleEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'plan_failed',
                    description: expect.stringContaining('创建Blackpink粉丝交流平台SRS'),
                    entityId: 'plan-integration-test',
                    metadata: expect.objectContaining({
                        planId: 'plan-integration-test',
                        failedSpecialist: 'overall_description_writer',
                        failedSpecialistName: '总体描述专家'
                    })
                })
            );
        });
        
        it('应该处理 SessionLogService 记录失败的情况', async () => {
            // 模拟 SessionLogService 抛出错误
            mockSessionLogService.recordToolExecution.mockRejectedValue(new Error('Log error'));
            mockSessionLogService.recordLifecycleEvent.mockRejectedValue(new Error('Log error'));
            
            const failedSpecialistOutput: SpecialistOutput = {
                success: false,
                error: '测试失败'
            };
            
            mockSpecialistExecutor.execute.mockResolvedValue(failedSpecialistOutput);
            
            const plan = {
                planId: 'plan-error-test',
                description: '测试计划',
                steps: [{ step: 1, specialist: 'test_specialist', description: '测试步骤' }]
            };
            
            // 应该不抛出异常
            const result = await planExecutor.execute(plan, {} as any, {} as any, 'test');
            
            expect(result.intent).toBe('plan_failed');
            // 验证尝试了记录（虽然失败了）
            expect(mockSessionLogService.recordToolExecution).toHaveBeenCalled();
            expect(mockSessionLogService.recordLifecycleEvent).toHaveBeenCalled();
        });
    });
});
