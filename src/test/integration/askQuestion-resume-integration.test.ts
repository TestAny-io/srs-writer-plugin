import * as vscode from 'vscode';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { PlanExecutor } from '../../core/orchestrator/PlanExecutor';
import { SRSAgentEngine } from '../../core/srsAgentEngine';
import { SessionContext } from '../../types/session';
import { Logger } from '../../utils/logger';
import { SpecialistOutput, SpecialistInteractionResult } from '../../core/engine/AgentState';

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
            currentSession: null,
            getCurrentSession: jest.fn(),
            createSession: jest.fn(),
            updateSession: jest.fn()
        }))
    }
}));

// 🚀 Mock file system for tests
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

describe('askQuestion Resume Integration Tests', () => {
    let mockStream: any;
    let mockModel: vscode.LanguageModelChat;
    let logger: Logger;

    beforeEach(() => {
        // Mock VSCode stream
        mockStream = {
            markdown: jest.fn(),
            progress: jest.fn(),
            button: jest.fn(),
            filetree: jest.fn(),
            anchor: jest.fn(),
            reference: jest.fn()
        };

        // Mock VSCode model
        mockModel = {
            sendRequest: jest.fn(),
            countTokens: jest.fn()
        } as any;

        logger = Logger.getInstance();
        
        // Clear any existing logs
        jest.clearAllMocks();
    });

    describe('SpecialistExecutor Resume State Tests', () => {
        let specialistExecutor: SpecialistExecutor;

        beforeEach(() => {
            specialistExecutor = new SpecialistExecutor();
        });

        test('should correctly pass resumeState parameters to specialist', async () => {
            // 模拟正常的AI响应，包含taskComplete
            const mockAIResponse = {
                text: [JSON.stringify({
                    tool_calls: [{
                        name: 'taskComplete',
                        args: {
                            summary: '用户回复已处理完成',
                            nextStepType: 'TASK_FINISHED'
                        }
                    }]
                })]
            };

            (mockModel.sendRequest as jest.Mock).mockResolvedValue(mockAIResponse);

            const contextForThisStep = {
                userInput: '原始用户请求',
                sessionData: { projectName: 'TestProject', baseDir: '/test' }
            };

            const resumeState = {
                iteration: 2,
                internalHistory: [
                    '迭代 1 - AI计划: {"tool_calls":[{"name":"askQuestion","args":{"question":"需要确认项目名称"}}]}',
                    '迭代 1 - 工具结果: 工具: askQuestion, 成功: true, 结果: {"needsChatInteraction":true}'
                ],
                currentPlan: {
                    tool_calls: [{
                        name: 'askQuestion',
                        args: { question: '需要确认项目名称' }
                    }]
                },
                toolResults: [{
                    toolName: 'askQuestion',
                    success: true,
                    result: {
                        needsChatInteraction: true,
                        chatQuestion: '需要确认项目名称'
                    }
                }],
                userResponse: '项目名称是TestProject',
                contextForThisStep: contextForThisStep
            };

            const result = await specialistExecutor.execute(
                'test_specialist',
                contextForThisStep,
                mockModel,
                resumeState
            );

            // 验证specialist从正确的迭代开始
            expect((vscode.LanguageModelChatMessage.User as jest.Mock)).toHaveBeenCalledWith(
                expect.stringContaining('项目名称是TestProject')
            );

            // 验证有基本结果
            expect(result).toBeDefined();
            expect('success' in result).toBe(true);
        });
    });

    describe('PlanExecutor State Restore Tests', () => {
        let planExecutor: PlanExecutor;
        let specialistExecutor: SpecialistExecutor;

        beforeEach(() => {
            specialistExecutor = new SpecialistExecutor();
            planExecutor = new PlanExecutor(specialistExecutor);
        });

        test('should restore loop state correctly', () => {
            const loopState = {
                specialistId: 'test_specialist',
                currentIteration: 3,
                maxIterations: 5,
                executionHistory: [
                    { iteration: 1, summary: '第一轮执行' },
                    { iteration: 2, summary: '第二轮执行' },
                    { iteration: 3, summary: '第三轮执行' }
                ],
                isLooping: true,
                startTime: Date.now() - 10000,
                lastContinueReason: 'user_interaction_required'
            };

            // 测试恢复状态不报错
            expect(() => {
                planExecutor.restoreLoopState('test_specialist', loopState);
            }).not.toThrow();
        });

        test('should continue execution from restored state', async () => {
            const plan = {
                planId: 'test_plan',
                description: '测试计划',
                steps: [
                    { step: 1, specialist: 'step1_specialist', description: '第一步' },
                    { step: 2, specialist: 'step2_specialist', description: '第二步' }
                ]
            };

            const currentStep = { step: 1, specialist: 'step1_specialist', description: '第一步' };
            const stepResults = {}; // 空的结果集

            const sessionContext: SessionContext = {
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
            };

            const latestSpecialistResult: SpecialistOutput = {
                success: true,
                content: '第一步已完成',
                requires_file_editing: false,
                structuredData: { nextStepType: 'CONTINUE_NEXT_STEP' },
                metadata: {
                    specialist: 'step1_specialist',
                    iterations: 1,
                    executionTime: 1000,
                    timestamp: new Date().toISOString()
                }
            };

            // Mock后续specialist执行返回完成
            jest.spyOn(specialistExecutor, 'execute').mockResolvedValue({
                success: true,
                content: '后续步骤完成',
                requires_file_editing: false,
                structuredData: { nextStepType: 'TASK_FINISHED' },
                metadata: {
                    specialist: 'step2_specialist',
                    iterations: 1,
                    executionTime: 1000,
                    timestamp: new Date().toISOString()
                }
            });

            const result = await planExecutor.continueExecution(
                plan,
                currentStep,
                stepResults,
                sessionContext,
                mockModel,
                '原始用户输入',
                latestSpecialistResult
            );

            expect(result.intent).toBe('plan_completed');
            expect(result.result).toBeDefined();
        });
    });

    describe('Context Extraction Tests', () => {
        test('should extract original specialist context correctly', () => {
            // 创建一个minimal的SRSAgentEngine实例
            const mockSessionManager = require('../../core/session-manager').SessionManager;
            mockSessionManager.getInstance.mockReturnValue({
                currentSession: null,
                getCurrentSession: jest.fn(),
                createSession: jest.fn(),
                updateSession: jest.fn()
            });

            const engine = new SRSAgentEngine(mockStream, mockModel);
            
            const resumeContext = {
                askQuestionContext: {
                    originalResult: {
                        resumeContext: {
                            specialist: 'test_specialist',
                            iteration: 2,
                            internalHistory: ['迭代 1 - 执行'],
                            contextForThisStep: { userInput: '原始请求' },
                            toolResults: [],
                            currentPlan: {},
                            startTime: Date.now()
                        }
                    }
                }
            };

            // 测试提取原始specialist上下文
            const extractedContext = (engine as any).extractOriginalSpecialistContext(resumeContext);
            
            expect(extractedContext).toBeDefined();
            expect(extractedContext.specialist).toBe('test_specialist');
            expect(extractedContext.iteration).toBe(2);
            expect(extractedContext.internalHistory).toEqual(['迭代 1 - 执行']);
        });

        test('should handle malformed resume context gracefully', () => {
            const mockSessionManager = require('../../core/session-manager').SessionManager;
            mockSessionManager.getInstance.mockReturnValue({
                currentSession: null,
                getCurrentSession: jest.fn(),
                createSession: jest.fn(),
                updateSession: jest.fn()
            });

            const engine = new SRSAgentEngine(mockStream, mockModel);
            
            const malformedResumeContext = {
                // 缺少必要字段
                someRandomField: 'invalid'
            };

            // 测试提取原始specialist上下文的容错性
            const extractedContext = (engine as any).extractOriginalSpecialistContext(malformedResumeContext);
            
            expect(extractedContext).toBeDefined();
            expect(extractedContext.iteration).toBe(0); // 默认值
        });
    });
}); 