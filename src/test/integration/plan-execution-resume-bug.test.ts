import * as vscode from 'vscode';
import { SRSAgentEngine } from '../../core/srsAgentEngine';
import { Logger } from '../../utils/logger';

// 🚀 Mock VSCode API
jest.mock('vscode', () => ({
    LanguageModelChatMessage: {
        User: jest.fn((content: string) => ({ content }))
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }]
    },
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        }))
    },
    ExtensionMode: {
        Test: 'test'
    }
}));

// 🚀 Mock SessionManager
jest.mock('../../core/session-manager', () => ({
    SessionManager: {
        getInstance: jest.fn(() => ({
            generateSessionId: jest.fn(() => 'test-session-id'),
            createSession: jest.fn(),
            getSession: jest.fn(() => ({
                sessionContextId: 'test-session-id',
                projectName: 'TestProject',
                baseDir: '/test',
                activeFiles: [],
                metadata: {
                    srsVersion: 'v1.0',
                    created: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    version: '5.0'
                }
            })),
            subscribe: jest.fn(),
            updateSession: jest.fn(),
            clearSession: jest.fn(),
            getCurrentSession: jest.fn(() => ({
                sessionContextId: 'test-session-id',
                projectName: 'TestProject',
                baseDir: '/test',
                activeFiles: [],
                metadata: {
                    srsVersion: 'v1.0',
                    created: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    version: '5.0'
                }
            }))
        }))
    }
}));

// 🚀 Mock file system
jest.mock('fs', () => ({
    existsSync: jest.fn(() => false),
    readFileSync: jest.fn(() => ''),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
}));

// 🚀 Mock path resolution  
jest.mock('path', () => ({
    join: jest.fn((...paths) => paths.join('/')),
    resolve: jest.fn((...paths) => '/mock/extension/path/rules'),
    dirname: jest.fn(() => '/mock/extension/path'),
    extname: jest.fn(() => '.ts')
}));

describe('Critical Plan Execution Resume Bug Tests', () => {
    let mockStream: any;
    let mockModel: vscode.LanguageModelChat;
    let srsEngine: SRSAgentEngine;
    let logger: Logger;
    let executionLogs: string[] = [];

    beforeEach(() => {
        // Clear execution logs
        executionLogs = [];
        
        // Mock VSCode stream
        mockStream = {
            markdown: jest.fn((text: string) => {
                executionLogs.push(`STREAM: ${text}`);
            }),
            progress: jest.fn((text: string) => {
                executionLogs.push(`PROGRESS: ${text}`);
            }),
            button: jest.fn(),
            filetree: jest.fn(),
            anchor: jest.fn(),
        };

        // Mock AI model
        mockModel = {
            sendRequest: jest.fn(),
        } as any;

        logger = Logger.getInstance();
        
        // Create SRSAgentEngine instance
        srsEngine = new SRSAgentEngine(mockStream, mockModel);
        
        // Clear all mocks
        jest.clearAllMocks();
    });

    // 辅助函数：创建specialist响应
    function createSpecialistResponse(step: number, nextStepType: string, summary?: string) {
        return {
            text: [JSON.stringify({
                tool_calls: [{
                    name: 'taskComplete',
                    args: {
                        nextStepType,
                        summary: summary || `Step ${step} completed`,
                        contextForNext: { 
                            deliverables: [`Step ${step} result`] 
                        }
                    }
                }]
            })]
        };
    }

    // 辅助函数：创建用户交互响应
    function createUserInteractionResponse(question: string = '需要用户确认继续吗？') {
        return {
            text: [JSON.stringify({
                tool_calls: [{
                    name: 'askQuestion',
                    args: {
                        question,
                        context: 'user-interaction-context'
                    }
                }]
            })]
        };
    }

    // 辅助函数：创建计划执行模式的AI响应
    function createPlanExecutionResponse(planSteps: any[]) {
        return {
            text: [JSON.stringify({
                response_mode: 'PLAN_EXECUTION',
                thought: 'Planning multi-step execution',
                execution_plan: {
                    planId: 'test-plan-' + Date.now(),
                    description: '测试多步骤计划',
                    steps: planSteps
                }
            })]
        };
    }

    test('CRITICAL BUG VERIFICATION: specialist TASK_FINISHED should NOT terminate plan prematurely in resume scenario', async () => {
        // 🎯 这个测试专门验证关键bug：当用户交互恢复后，specialist返回TASK_FINISHED不应该终止整个计划
        
        let step3Executed = false;
        let step4Executed = false;
        let userInteractionOccurred = false;
        
        // 模拟4步计划，第2步需要用户交互，第3、4步应该继续执行
        const planSteps = [
            { step: 1, specialist: 'project_initializer', description: '初始化项目' },
            { step: 2, specialist: 'requirement_syncer', description: '同步需求 - 需要用户交互' },
            { step: 3, specialist: 'user_journey_writer', description: '编写用户旅程 - 应该被执行' },
            { step: 4, specialist: 'document_formatter', description: '格式化文档 - 也应该被执行' }
        ];

        // Mock AI responses sequence
        mockModel.sendRequest = jest.fn()
            // 1. 初始规划响应
            .mockImplementationOnce(() => createPlanExecutionResponse(planSteps))
            // 2. Step 1完成
            .mockImplementationOnce(() => createSpecialistResponse(1, 'TASK_FINISHED'))
            // 3. Step 2需要用户交互
            .mockImplementationOnce(() => {
                userInteractionOccurred = true;
                return createUserInteractionResponse('当前项目缺少SRS.md需求文档，是否继续？');
            })
            // 4. 用户交互恢复后，Step 2返回TASK_FINISHED（这是触发bug的关键点）
            .mockImplementationOnce(() => createSpecialistResponse(2, 'TASK_FINISHED', '需求同步已完成'))
            // 5. Step 3应该被执行 
            .mockImplementationOnce(() => {
                step3Executed = true;
                return createSpecialistResponse(3, 'TASK_FINISHED');
            })
            // 6. Step 4也应该被执行
            .mockImplementationOnce(() => {
                step4Executed = true;
                return createSpecialistResponse(4, 'TASK_FINISHED');
            });

        // 🚀 执行阶段1：启动任务，应该进入用户交互等待
        await srsEngine.executeTask('测试关键bug修复');
        
        // 验证用户交互被触发
        expect(userInteractionOccurred).toBe(true);
        expect(srsEngine.isAwaitingUser()).toBe(true);

        // 🚀 执行阶段2：模拟用户回复，触发恢复执行
        await srsEngine.handleUserResponse('是的，请继续');

        // 🔍 关键验证：检查bug是否已修复
        // 在修复前：step3和step4不会被执行，因为step2的TASK_FINISHED错误地终止了整个计划
        // 在修复后：step3和step4应该正常执行
        expect(step3Executed).toBe(true); // 🎯 这是关键断言
        expect(step4Executed).toBe(true); // 🎯 这也是关键断言
        
        // 验证最终状态
        expect((srsEngine as any).state.stage).toBe('completed');
        
        // 验证执行日志包含所有步骤的完成信息
        const streamOutput = executionLogs.join(' ');
        expect(streamOutput).toContain('Specialist执行成功');
        expect(streamOutput).toContain('计划执行完成');
        
        console.log('✅ Critical bug has been FIXED! All plan steps executed correctly after user interaction resume.');
    });

    test('EDGE CASE: should correctly handle TASK_FINISHED when it IS the last step after resume', async () => {
        // 验证最后一步返回TASK_FINISHED时的正常行为
        let lastStepExecuted = false;
        
        const planSteps = [
            { step: 1, specialist: 'step1', description: 'Step 1' },
            { step: 2, specialist: 'step2', description: 'Last step with user interaction' }
        ];

        mockModel.sendRequest = jest.fn()
            .mockImplementationOnce(() => createPlanExecutionResponse(planSteps))
            .mockImplementationOnce(() => createSpecialistResponse(1, 'TASK_FINISHED'))
            .mockImplementationOnce(() => createUserInteractionResponse())
            .mockImplementationOnce(() => {
                lastStepExecuted = true;
                return createSpecialistResponse(2, 'TASK_FINISHED', 'Final step completed');
            });

        await srsEngine.executeTask('测试最后一步场景');
        expect(srsEngine.isAwaitingUser()).toBe(true);
        
        await srsEngine.handleUserResponse('确认完成');
        
        expect(lastStepExecuted).toBe(true);
        expect((srsEngine as any).state.stage).toBe('completed');
    });

    test('REGRESSION TEST: should not break normal plan execution without user interaction', async () => {
        // 验证正常的多步骤计划执行不受修复影响
        let allStepsExecuted = 0;
        
        const planSteps = [
            { step: 1, specialist: 'step1', description: 'Normal step 1' },
            { step: 2, specialist: 'step2', description: 'Normal step 2' },
            { step: 3, specialist: 'step3', description: 'Normal step 3' }
        ];

        mockModel.sendRequest = jest.fn()
            .mockImplementationOnce(() => createPlanExecutionResponse(planSteps))
            .mockImplementation(() => {
                allStepsExecuted++;
                return createSpecialistResponse(allStepsExecuted, 'TASK_FINISHED');
            });

        await srsEngine.executeTask('正常计划执行测试');

        expect(allStepsExecuted).toBe(3); // 所有3个步骤都应该执行
        expect((srsEngine as any).state.stage).toBe('completed');
        expect(srsEngine.isAwaitingUser()).toBe(false); // 不应该有用户交互
    });

    test('COMPLEX SCENARIO: multiple user interactions in same plan', async () => {
        // 测试同一个计划中多次用户交互的复杂场景
        let interactionCount = 0;
        let finalStepExecuted = false;
        
        const planSteps = [
            { step: 1, specialist: 'step1', description: 'Step 1 - needs interaction' },
            { step: 2, specialist: 'step2', description: 'Step 2 - normal' },
            { step: 3, specialist: 'step3', description: 'Step 3 - needs interaction' },
            { step: 4, specialist: 'step4', description: 'Step 4 - final step' }
        ];

        mockModel.sendRequest = jest.fn()
            .mockImplementationOnce(() => createPlanExecutionResponse(planSteps))
            // Step 1 - 需要交互
            .mockImplementationOnce(() => {
                interactionCount++;
                return createUserInteractionResponse('第一次用户确认？');
            })
            // Step 1 恢复后完成
            .mockImplementationOnce(() => createSpecialistResponse(1, 'TASK_FINISHED'))
            // Step 2 - 正常完成
            .mockImplementationOnce(() => createSpecialistResponse(2, 'TASK_FINISHED'))
            // Step 3 - 又需要交互
            .mockImplementationOnce(() => {
                interactionCount++;
                return createUserInteractionResponse('第二次用户确认？');
            })
            // Step 3 恢复后完成  
            .mockImplementationOnce(() => createSpecialistResponse(3, 'TASK_FINISHED'))
            // Step 4 - 最终完成
            .mockImplementationOnce(() => {
                finalStepExecuted = true;
                return createSpecialistResponse(4, 'TASK_FINISHED');
            });

        // 执行过程
        await srsEngine.executeTask('复杂多交互场景');
        expect(srsEngine.isAwaitingUser()).toBe(true);
        
        await srsEngine.handleUserResponse('第一次确认');
        expect(srsEngine.isAwaitingUser()).toBe(true); // 应该再次等待用户输入
        
        await srsEngine.handleUserResponse('第二次确认');
        
        // 验证最终结果
        expect(interactionCount).toBe(2);
        expect(finalStepExecuted).toBe(true);
        expect((srsEngine as any).state.stage).toBe('completed');
    });
});