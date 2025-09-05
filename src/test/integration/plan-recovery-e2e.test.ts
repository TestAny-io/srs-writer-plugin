/**
 * 计划恢复功能端到端集成测试
 * 验证完整的中断-恢复-执行流程
 */

import { SRSAgentEngine } from '../../core/srsAgentEngine';
import { UserInteractionHandler } from '../../core/engine/UserInteractionHandler';
import { OperationType } from '../../types/session';

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

describe('计划恢复功能端到端测试', () => {
    let srsAgentEngine: SRSAgentEngine;
    let userInteractionHandler: UserInteractionHandler;
    let mockStream: any;
    let mockSessionManager: any;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock stream
        mockStream = {
            markdown: jest.fn(),
            progress: jest.fn()
        };
        
        // Mock SessionManager
        mockSessionManager = {
            getInstance: jest.fn(),
            subscribe: jest.fn(),
            updateSessionWithLog: jest.fn().mockResolvedValue(undefined),
            getCurrentSession: jest.fn().mockResolvedValue({
                sessionContextId: 'test-session',
                projectName: 'TestProject',
                baseDir: '/test/project',
                activeFiles: [],
                metadata: {
                    srsVersion: 'v1.0',
                    created: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    version: '5.0'
                }
            })
        };
        
        const { SessionManager } = require('../../core/session-manager');
        SessionManager.getInstance.mockReturnValue(mockSessionManager);
        
        srsAgentEngine = new SRSAgentEngine(mockStream, {} as any);
        userInteractionHandler = new UserInteractionHandler();
    });
    
    describe('完整的中断恢复流程', () => {
        it('应该处理被动中断并提供恢复选项', async () => {
            // 1. 模拟计划执行失败（被动中断）
            const failureResult = {
                intent: 'plan_failed',
                result: {
                    error: 'Token限制或空响应错误，正在优化提示词重试 (重试3次后仍失败: Response contained no choices.)',
                    failedStep: 3,
                    planExecutionContext: {
                        originalExecutionPlan: {
                            planId: 'srs-test-plan-001',
                            description: '测试SRS文档生成计划',
                            steps: [
                                { step: 1, specialist: 'project_initializer', description: '初始化项目' },
                                { step: 2, specialist: 'overall_description_writer', description: '撰写总体描述' },
                                { step: 3, specialist: 'fr_writer', description: '撰写功能需求' }
                            ]
                        },
                        completedWork: [
                            { step: 1, specialist: 'project_initializer', status: 'completed', summary: '项目初始化完成' },
                            { step: 2, specialist: 'overall_description_writer', status: 'completed', summary: '总体描述完成' }
                        ]
                    }
                }
            };
            
            // 2. 处理计划失败
            await (srsAgentEngine as any).handlePlanFailedWithRecovery(failureResult);
            
            // 3. 验证中断状态保存
            const interruptionState = (srsAgentEngine as any).state.planInterruptionState;
            expect(interruptionState).toBeDefined();
            expect(interruptionState.planId).toBe('srs-test-plan-001');
            expect(interruptionState.failedStep).toBe(3);
            expect(interruptionState.canResume).toBe(true);
            expect(Object.keys(interruptionState.completedStepResults)).toHaveLength(2);
            
            // 4. 验证用户界面显示
            expect((srsAgentEngine as any).state.stage).toBe('awaiting_user');
            expect((srsAgentEngine as any).state.pendingInteraction.type).toBe('choice');
            expect((srsAgentEngine as any).state.pendingInteraction.options).toEqual([
                '继续执行写作计划',
                '结束写作计划'
            ]);
            
            // 5. 验证持久化记录
            expect(mockSessionManager.updateSessionWithLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    logEntry: expect.objectContaining({
                        type: OperationType.PLAN_INTERRUPTED,
                        operation: expect.stringContaining('被动中断，已保存恢复状态')
                    })
                })
            );
        });
        
        it('应该处理用户选择"继续执行"', async () => {
            // 1. 设置中断状态
            const interruptionState = {
                planId: 'test-plan-continue',
                planDescription: '测试继续执行',
                originalPlan: {
                    planId: 'test-plan-continue',
                    steps: [{ step: 1 }, { step: 2 }, { step: 3 }]
                },
                failedStep: 2,
                completedStepResults: { 1: { success: true, requires_file_editing: false, metadata: { specialist: 'test', iterations: 1, executionTime: 1000, timestamp: '' } } },
                sessionContext: {},
                userInput: 'test input',
                interruptionReason: 'Token限制',
                interruptionTimestamp: new Date().toISOString(),
                canResume: true
            };
            
            (srsAgentEngine as any).state = {
                stage: 'awaiting_user',
                planInterruptionState: interruptionState,
                pendingInteraction: {
                    type: 'choice',
                    options: ['继续执行写作计划', '结束写作计划'],
                    toolCall: {
                        name: 'internal_plan_recovery',
                        args: { action: 'user_choice_pending' }
                    }
                }
            };
            
            // 2. Mock PlanExecutor.resumeFromStep 成功
            const mockPlanExecutor = {
                resumeFromStep: jest.fn().mockResolvedValue({
                    intent: 'plan_completed',
                    result: { summary: '恢复执行成功' }
                })
            };
            (srsAgentEngine as any).planExecutor = mockPlanExecutor;
            
            // 3. 模拟用户选择处理
            const interaction = (srsAgentEngine as any).state.pendingInteraction;
            
            const handlerResult = await userInteractionHandler.handleChoiceResponse(
                '1',  // 用户选择第1个选项
                interaction,
                mockStream,
                jest.fn(),
                async (toolCall) => {
                    // 模拟 handleAutonomousTool 调用
                    if (toolCall.name === 'internal_resume_plan') {
                        await (srsAgentEngine as any).handleInternalPlanRecoveryTool(toolCall);
                    }
                }
            );
            
            // 4. 验证处理结果
            expect(handlerResult.shouldReturnToWaiting).toBe(false);
            
            // 5. 验证恢复执行被调用
            expect(mockPlanExecutor.resumeFromStep).toHaveBeenCalledWith(
                interruptionState.originalPlan,
                interruptionState.failedStep,
                interruptionState.completedStepResults,
                interruptionState.sessionContext,
                interruptionState.userInput,
                expect.any(Object),  // selectedModel
                expect.any(Object)   // progressCallback
            );
            
            // 6. 验证状态清理
            expect((srsAgentEngine as any).state.stage).toBe('completed');
            expect((srsAgentEngine as any).state.planInterruptionState).toBeUndefined();
        });
        
        it('应该处理用户选择"结束计划"', async () => {
            // 1. 设置中断状态
            (srsAgentEngine as any).state = {
                stage: 'awaiting_user',
                planInterruptionState: {
                    planId: 'test-plan-terminate',
                    planDescription: '测试终止计划',
                    failedStep: 2,
                    completedStepResults: { 1: { success: true, requires_file_editing: false, metadata: { specialist: 'test', iterations: 1, executionTime: 1000, timestamp: '' } } },
                    canResume: true
                },
                pendingInteraction: {
                    type: 'choice',
                    options: ['继续执行写作计划', '结束写作计划'],
                    toolCall: {
                        name: 'internal_plan_recovery',
                        args: { action: 'user_choice_pending' }
                    }
                }
            };
            
            // 2. 模拟用户选择处理
            const interaction = (srsAgentEngine as any).state.pendingInteraction;
            
            await userInteractionHandler.handleChoiceResponse(
                '2',  // 用户选择第2个选项（结束计划）
                interaction,
                mockStream,
                jest.fn(),
                async (toolCall) => {
                    if (toolCall.name === 'internal_resume_plan') {
                        await (srsAgentEngine as any).handleInternalPlanRecoveryTool(toolCall);
                    }
                }
            );
            
            // 3. 验证计划终止
            expect((srsAgentEngine as any).state.stage).toBe('completed');
            expect((srsAgentEngine as any).state.planInterruptionState).toBeUndefined();
            
            // 4. 验证终止记录
            expect(mockSessionManager.updateSessionWithLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    logEntry: expect.objectContaining({
                        type: OperationType.PLAN_TERMINATED,
                        operation: expect.stringContaining('用户选择终止')
                    })
                })
            );
        });
    });
    
    describe('被动中断检测准确性（二分法）', () => {
        it('应该正确识别主动失败（明确的业务逻辑错误）', () => {
            const activeFailureCases = [
                // 业务逻辑错误
                '业务逻辑验证失败：用户权限不足',
                '业务规则冲突：重复的ID',
                '数据完整性检查失败',
                
                // 参数和格式错误
                '参数验证错误：缺少必需字段',
                'JSON格式错误：语法不正确',
                '无效的参数值：ID格式不符合规范',
                
                // 权限和配置错误
                '权限不足：无法访问文件',
                '工具不存在：未找到指定工具',
                '配置错误：工具配置无效',
                
                // 用户输入错误
                '用户输入无效：不符合要求',
                '用户取消操作',
                
                // Specialist 输出错误
                'Specialist返回了无效的JSON格式',
                '输出格式不符合要求',
                
                // 文件系统错误
                '文件不存在且无法创建',
                '磁盘空间不足'
            ];
            
            activeFailureCases.forEach(error => {
                const result = (srsAgentEngine as any).detectPassiveInterruption({ result: { error } });
                expect(result).toBe(false);
            });
        });
        
        it('应该将所有非主动失败归类为被动中断（包括未知错误）', () => {
            const passiveInterruptionCases = [
                // 明确的技术性错误
                'Token限制或空响应错误，正在优化提示词重试 (重试3次后仍失败: Response contained no choices.)',
                '网络错误：连接超时',
                'Rate limit exceeded: API调用频率过高',
                'Stream terminated unexpectedly',
                'API错误：服务暂时不可用',
                
                // 未知或新类型的错误（应该归类为被动中断）
                '未知的系统错误',
                '意外的执行异常',
                'Internal server error',
                '模型响应异常',
                '连接被重置',
                
                // 空错误或未定义错误
                '',
                'undefined',
                '系统内部错误'
            ];
            
            passiveInterruptionCases.forEach(error => {
                const result = (srsAgentEngine as any).detectPassiveInterruption({ result: { error } });
                expect(result).toBe(true);
            });
        });
        
        it('应该处理边界情况', () => {
            const edgeCases = [
                // null/undefined 错误
                { result: { error: null } },
                { result: { error: undefined } },
                { result: {} },
                {},
                
                // 空字符串错误
                { result: { error: '' } },
                { result: { error: '   ' } }
            ];
            
            edgeCases.forEach(executionResult => {
                // 边界情况应该归类为被动中断（保守策略）
                const result = (srsAgentEngine as any).detectPassiveInterruption(executionResult);
                expect(result).toBe(true);
            });
        });
    });
});
