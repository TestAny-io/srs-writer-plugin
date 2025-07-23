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
            subscribe: jest.fn(), // 🚀 添加subscribe方法
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

describe('User Interaction Scenarios Integration Tests', () => {
    let mockStream: any;
    let mockModel: vscode.LanguageModelChat;
    let srsEngine: SRSAgentEngine;
    let logger: Logger;

    beforeEach(() => {
        // Mock VSCode stream
        mockStream = {
            markdown: jest.fn(),
            progress: jest.fn(),
            button: jest.fn(),
            filetree: jest.fn(),
            anchor: jest.fn(),
        };

        // Mock AI model
        mockModel = {
            sendRequest: jest.fn(),
        } as any;

        logger = Logger.getInstance();

        // 创建SRSAgentEngine实例
        srsEngine = new SRSAgentEngine(mockStream, mockModel);
    });

    describe('Specialist Resume Scenario', () => {
        test('should resume specialist execution without restarting execution loop', async () => {
            // 🚀 模拟specialist恢复场景
            
            // 1. 设置specialist恢复状态
            (srsEngine as any).state = {
                stage: 'awaiting_user',
                pendingInteraction: {
                    type: 'input',
                    message: '当前项目缺少SRS.md需求文档，无法进行需求内容同步。请补充完整的SRS.md文件后再继续。',
                    options: []
                },
                resumeContext: {
                    planExecutorState: {
                        specialistLoopState: {
                            specialistId: 'requirement_syncer',
                            currentIteration: 1,
                            maxIterations: 3
                        },
                        sessionContext: {
                            sessionContextId: 'test-session-id',
                            projectName: 'TestProject',
                            baseDir: '/test'
                        }
                    },
                    askQuestionContext: {
                        originalResult: {
                            resumeContext: {
                                specialist: 'requirement_syncer',
                                iteration: 1,
                                internalHistory: [],
                                contextForThisStep: {},
                                toolResults: [],
                                currentPlan: {}
                            }
                        }
                    }
                }
            };

            // 2. Mock specialist成功执行的响应
            const mockSpecialistResponse = {
                text: [JSON.stringify({
                    tool_calls: [{
                        name: 'taskComplete',
                        args: {
                            summary: '已找到并阅读了需求文档',
                            nextStepType: 'TASK_FINISHED'
                        }
                    }]
                })]
            };
            (mockModel.sendRequest as jest.Mock).mockResolvedValue(mockSpecialistResponse);

            // 3. 设置内部方法mocks
            const recordExecutionSpy = jest.spyOn(srsEngine as any, 'recordExecution').mockResolvedValue(undefined);
            const runExecutionLoopSpy = jest.spyOn(srsEngine as any, '_runExecutionLoop').mockResolvedValue(undefined);
            const displayExecutionSummarySpy = jest.spyOn(srsEngine as any, 'displayExecutionSummary').mockResolvedValue(undefined);

            // 设置stream和model
            (srsEngine as any).stream = mockStream;
            (srsEngine as any).selectedModel = mockModel;

            // 4. 执行用户回复
            await srsEngine.handleUserResponse('请你调用合适的工具找到当前的需求文档并阅读');

            // 5. 验证结果
            expect(recordExecutionSpy).toHaveBeenCalledWith('user_interaction', expect.stringContaining('用户回复:'), true);
            
            // 🚀 关键验证：specialist恢复成功后不应该调用_runExecutionLoop
            expect(runExecutionLoopSpy).not.toHaveBeenCalled();
            expect(displayExecutionSummarySpy).not.toHaveBeenCalled();
            
            // 验证状态正确更新
            expect((srsEngine as any).state.pendingInteraction).toBeUndefined();
            expect((srsEngine as any).state.stage).toBe('completed'); // specialist完成了任务

            expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('🔄 **正在恢复PlanExecutor执行状态...**'));
            expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('🎉 **任务完成**'));
        });

        test('should restart execution loop when specialist resume fails', async () => {
            // 🚀 模拟specialist恢复失败场景
            
            // 1. 设置specialist恢复状态
            (srsEngine as any).state = {
                stage: 'awaiting_user',
                pendingInteraction: {
                    type: 'input',
                    message: '专家遇到问题',
                    options: []
                },
                resumeContext: {
                    planExecutorState: {
                        specialistLoopState: {
                            specialistId: 'requirement_syncer',
                            currentIteration: 1,
                            maxIterations: 3
                        },
                        sessionContext: {
                            sessionContextId: 'test-session-id'
                        }
                    },
                    askQuestionContext: {
                        originalResult: {
                            resumeContext: {
                                specialist: 'requirement_syncer',
                                iteration: 1,
                                internalHistory: [],
                                contextForThisStep: {},
                                toolResults: [],
                                currentPlan: {}
                            }
                        }
                    }
                }
            };

            // 2. Mock specialist执行失败的响应
            const mockFailedResponse = {
                text: ['执行失败']
            };
            (mockModel.sendRequest as jest.Mock).mockResolvedValue(mockFailedResponse);

            // 3. 设置内部方法mocks
            const recordExecutionSpy = jest.spyOn(srsEngine as any, 'recordExecution').mockResolvedValue(undefined);
            const runExecutionLoopSpy = jest.spyOn(srsEngine as any, '_runExecutionLoop').mockResolvedValue(undefined);
            const displayExecutionSummarySpy = jest.spyOn(srsEngine as any, 'displayExecutionSummary').mockResolvedValue(undefined);

            // 设置stream和model
            (srsEngine as any).stream = mockStream;
            (srsEngine as any).selectedModel = mockModel;

            // 4. 执行用户回复
            await srsEngine.handleUserResponse('重试执行');

            // 5. 验证结果
            expect(recordExecutionSpy).toHaveBeenCalledWith('user_interaction', expect.stringContaining('用户回复:'), true);
            
            // 🚀 关键验证：specialist恢复失败后应该调用_runExecutionLoop重新规划
            expect(runExecutionLoopSpy).toHaveBeenCalled();
            expect(displayExecutionSummarySpy).toHaveBeenCalled();
            
            // 验证状态正确清除
            expect((srsEngine as any).state.pendingInteraction).toBeUndefined();
            expect((srsEngine as any).state.resumeContext).toBeUndefined();
            expect((srsEngine as any).state.stage).toBe('executing');

            expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('🔄 **重新规划并继续执行任务...**'));
        });
    });

    describe('Orchestrator Interaction Scenario', () => {
        test('should restart execution loop for orchestrator user interaction', async () => {
            // 🚀 模拟orchestrator交互场景（无resumeContext）
            
            // 1. 设置orchestrator交互状态
            (srsEngine as any).state = {
                stage: 'awaiting_user',
                pendingInteraction: {
                    type: 'input',
                    message: '需要您确认项目配置',
                    options: []
                },
                resumeContext: undefined // 🚀 关键：没有resumeContext
            };

            // 2. 设置内部方法mocks
            const recordExecutionSpy = jest.spyOn(srsEngine as any, 'recordExecution').mockResolvedValue(undefined);
            const handleStandardUserInteractionSpy = jest.spyOn(srsEngine as any, 'handleStandardUserInteraction').mockResolvedValue(undefined);
            const runExecutionLoopSpy = jest.spyOn(srsEngine as any, '_runExecutionLoop').mockResolvedValue(undefined);
            const displayExecutionSummarySpy = jest.spyOn(srsEngine as any, 'displayExecutionSummary').mockResolvedValue(undefined);

            // 设置stream
            (srsEngine as any).stream = mockStream;

            // 3. 执行用户回复
            await srsEngine.handleUserResponse('确认配置');

            // 4. 验证结果
            expect(recordExecutionSpy).toHaveBeenCalledWith('user_interaction', expect.stringContaining('用户回复:'), true);
            expect(handleStandardUserInteractionSpy).toHaveBeenCalledWith('确认配置', expect.any(Object));
            
            // 🚀 关键验证：orchestrator场景应该调用_runExecutionLoop重新规划
            expect(runExecutionLoopSpy).toHaveBeenCalled();
            expect(displayExecutionSummarySpy).toHaveBeenCalled();
            
            // 验证状态正确清除
            expect((srsEngine as any).state.pendingInteraction).toBeUndefined();
            expect((srsEngine as any).state.resumeContext).toBeUndefined();
            expect((srsEngine as any).state.stage).toBe('executing');

            expect(mockStream.markdown).toHaveBeenCalledWith(expect.stringContaining('🔄 **重新规划并继续执行任务...**'));
        });
    });
}); 