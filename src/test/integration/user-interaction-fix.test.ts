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
            currentSession: null,
            getCurrentSession: jest.fn(),
            createSession: jest.fn(),
            updateSession: jest.fn(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn()
        }))
    }
}));

// 🚀 Mock toolExecutor
jest.mock('../../core/toolExecutor', () => ({
    toolExecutor: {
        executeTool: jest.fn()
    }
}));

// 🚀 Mock file system for tests
jest.mock('fs', () => ({
    existsSync: jest.fn(() => false),
    readFileSync: jest.fn(() => ''),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
}));

/**
 * 测试用户交互循环问题的修复
 * 
 * 此测试验证架构师提出的修复方案是否正确解决了以下问题：
 * 1. 用户确认循环问题
 * 2. UserInteractionHandler的正确使用
 * 3. 不同交互类型的正确处理
 */
describe('User Interaction Fix Integration Test', () => {
    let mockStream: vscode.ChatResponseStream;
    let mockModel: vscode.LanguageModelChat;
    let engine: SRSAgentEngine;
    let logger: Logger;

    beforeEach(() => {
        logger = Logger.getInstance();
        
        // Mock ChatResponseStream
        mockStream = {
            markdown: jest.fn(),
            progress: jest.fn(),
            anchor: jest.fn(),
            button: jest.fn(),
            filetree: jest.fn(),
            reference: jest.fn(),
            push: jest.fn()
        } as any;

        // Mock LanguageModelChat
        mockModel = {
            sendRequest: jest.fn(),
            name: 'test-model',
            family: 'test-family',
            vendor: 'test-vendor',
            version: 'test-version',
            maxInputTokens: 1000,
            countTokens: jest.fn()
        } as any;

        // Create engine
        engine = new SRSAgentEngine(mockStream, mockModel);
    });

    afterEach(() => {
        engine.dispose();
    });

    describe('Confirmation Interaction Type', () => {
        it('should handle confirmation response correctly without infinite loop', async () => {
            // Arrange: 模拟一个需要确认的交互状态
            const engineState = engine.getState();
            engineState.stage = 'awaiting_user';
            engineState.pendingInteraction = {
                type: 'confirmation' as const,
                message: '确认执行 executeMarkdownEdits？',
                options: ['yes', 'no'],
                toolCall: {
                    name: 'executeMarkdownEdits',
                    args: { description: 'test edit' }
                }
            };

            // Mock handleAutonomousTool method
            const handleAutonomousToolSpy = jest.spyOn(engine as any, 'handleAutonomousTool')
                .mockImplementation(async () => {
                    // 模拟工具执行完成，设置为executing状态
                    engineState.stage = 'executing';
                });

            const _runExecutionLoopSpy = jest.spyOn(engine as any, '_runExecutionLoop')
                .mockImplementation(async () => {
                    // 模拟执行循环完成
                    engineState.stage = 'completed';
                });

            const displayExecutionSummarySpy = jest.spyOn(engine as any, 'displayExecutionSummary')
                .mockImplementation(() => {});

            // Act: 处理用户确认响应
            await engine.handleUserResponse('yes');

            // Assert: 验证正确的调用序列
            expect(handleAutonomousToolSpy).toHaveBeenCalledWith({
                name: 'executeMarkdownEdits',
                args: { description: 'test edit' }
            });
            expect(_runExecutionLoopSpy).toHaveBeenCalledTimes(1);
            expect(displayExecutionSummarySpy).toHaveBeenCalledTimes(1);
            
            // 验证没有无限循环：pendingInteraction应该被清除
            expect(engine.getState().pendingInteraction).toBeUndefined();
            
            // 验证最终状态
            expect(engine.getState().stage).toBe('completed');

            // 验证用户看到正确的反馈
            expect(mockStream.markdown).toHaveBeenCalledWith('👤 **您的回复**: yes\n\n');
            expect(mockStream.markdown).toHaveBeenCalledWith('✅ **确认执行**\n\n');
        });

        it('should handle user cancellation correctly', async () => {
            // Arrange: 模拟一个需要确认的交互状态
            const engineState = engine.getState();
            engineState.stage = 'awaiting_user';
            engineState.pendingInteraction = {
                type: 'confirmation' as const,
                message: '确认执行 executeMarkdownEdits？',
                options: ['yes', 'no'],
                toolCall: {
                    name: 'executeMarkdownEdits',
                    args: { description: 'test edit' }
                }
            };

            const handleAutonomousToolSpy = jest.spyOn(engine as any, 'handleAutonomousTool')
                .mockImplementation(async () => {});

            const displayExecutionSummarySpy = jest.spyOn(engine as any, 'displayExecutionSummary')
                .mockImplementation(() => {});

            // Act: 处理用户取消响应
            await engine.handleUserResponse('no');

            // Assert: 验证工具没有被执行
            expect(handleAutonomousToolSpy).not.toHaveBeenCalled();
            
            // 验证用户看到取消反馈
            expect(mockStream.markdown).toHaveBeenCalledWith('❌ **操作已取消**\n\n');
            
            // 验证最终显示了执行总结
            expect(displayExecutionSummarySpy).toHaveBeenCalledTimes(1);
        });

        it('should handle ambiguous response correctly', async () => {
            // Arrange: 模拟一个需要确认的交互状态
            const engineState = engine.getState();
            engineState.stage = 'awaiting_user';
            const originalInteraction = {
                type: 'confirmation' as const,
                message: '确认执行 executeMarkdownEdits？',
                options: ['yes', 'no'],
                toolCall: {
                    name: 'executeMarkdownEdits',
                    args: { description: 'test edit' }
                }
            };
            engineState.pendingInteraction = originalInteraction;

            const handleAutonomousToolSpy = jest.spyOn(engine as any, 'handleAutonomousTool')
                .mockImplementation(async () => {});

            // Act: 处理模糊的用户响应
            await engine.handleUserResponse('maybe');

            // Assert: 验证状态保持awaiting_user
            expect(engine.getState().stage).toBe('awaiting_user');
            
            // 验证pendingInteraction被重新设置
            expect(engine.getState().pendingInteraction).toEqual(originalInteraction);
            
            // 验证工具没有被执行
            expect(handleAutonomousToolSpy).not.toHaveBeenCalled();
            
            // 验证用户看到要求明确回复的消息
            expect(mockStream.markdown).toHaveBeenCalledWith('❓ **请明确回复**: 请回复 "yes" 或 "no"\n\n');
        });
    });

    describe('Input Interaction Type', () => {
        it('should handle input response correctly (askQuestion tool)', async () => {
            // Arrange: 模拟askQuestion工具的交互状态
            const engineState = engine.getState();
            engineState.stage = 'awaiting_user';
            engineState.pendingInteraction = {
                type: 'input' as const,
                message: '请输入文档标题',
                toolCall: {
                    name: 'askQuestion',
                    args: { question: '请输入文档标题' }
                }
            };

            const handleAutonomousToolSpy = jest.spyOn(engine as any, 'handleAutonomousTool')
                .mockImplementation(async (toolCall: any) => {
                    // 验证用户输入被正确添加到工具参数中
                    expect(toolCall.args.userInput).toBe('我的SRS文档');
                    engineState.stage = 'executing';
                });

            const _runExecutionLoopSpy = jest.spyOn(engine as any, '_runExecutionLoop')
                .mockImplementation(async () => {
                    engineState.stage = 'completed';
                });

            const displayExecutionSummarySpy = jest.spyOn(engine as any, 'displayExecutionSummary')
                .mockImplementation(() => {});

            // Act: 处理用户输入响应
            await engine.handleUserResponse('我的SRS文档');

            // Assert: 验证工具被正确调用，用户输入被添加到参数中
            expect(handleAutonomousToolSpy).toHaveBeenCalledWith({
                name: 'askQuestion',
                args: { 
                    question: '请输入文档标题',
                    userInput: '我的SRS文档'
                }
            });

            // 验证用户看到输入确认反馈
            expect(mockStream.markdown).toHaveBeenCalledWith('✅ **输入已接收**: 我的SRS文档\n\n');
            
            // 验证正常的执行流程
            expect(_runExecutionLoopSpy).toHaveBeenCalledTimes(1);
            expect(displayExecutionSummarySpy).toHaveBeenCalledTimes(1);
        });

        it('should handle empty input correctly', async () => {
            // Arrange: 模拟askQuestion工具的交互状态
            const engineState = engine.getState();
            engineState.stage = 'awaiting_user';
            const originalInteraction = {
                type: 'input' as const,
                message: '请输入文档标题',
                toolCall: {
                    name: 'askQuestion',
                    args: { question: '请输入文档标题' }
                }
            };
            engineState.pendingInteraction = originalInteraction;

            const handleAutonomousToolSpy = jest.spyOn(engine as any, 'handleAutonomousTool')
                .mockImplementation(async () => {});

            // Act: 处理空输入
            await engine.handleUserResponse('');

            // Assert: 验证状态保持awaiting_user
            expect(engine.getState().stage).toBe('awaiting_user');
            
            // 验证pendingInteraction被重新设置
            expect(engine.getState().pendingInteraction).toEqual(originalInteraction);
            
            // 验证工具没有被执行
            expect(handleAutonomousToolSpy).not.toHaveBeenCalled();
            
            // 验证用户看到输入为空的提示
            expect(mockStream.markdown).toHaveBeenCalledWith('⚠️ **输入为空**: 请提供有效的输入\n\n');
        });
    });

    describe('Choice Interaction Type', () => {
        it('should handle choice response correctly', async () => {
            // Arrange: 模拟选择类型的交互状态
            const engineState = engine.getState();
            engineState.stage = 'awaiting_user';
            engineState.pendingInteraction = {
                type: 'choice' as const,
                message: '请选择文档类型',
                options: ['SRS', 'PRD', 'API文档'],
                toolCall: {
                    name: 'selectDocumentType',
                    args: { availableTypes: ['SRS', 'PRD', 'API文档'] }
                }
            };

            const handleAutonomousToolSpy = jest.spyOn(engine as any, 'handleAutonomousTool')
                .mockImplementation(async (toolCall: any) => {
                    // 验证用户选择被正确添加到工具参数中
                    expect(toolCall.args.userInput).toBe('SRS');
                    engineState.stage = 'executing';
                });

            const _runExecutionLoopSpy = jest.spyOn(engine as any, '_runExecutionLoop')
                .mockImplementation(async () => {
                    engineState.stage = 'completed';
                });

            const displayExecutionSummarySpy = jest.spyOn(engine as any, 'displayExecutionSummary')
                .mockImplementation(() => {});

            // Act: 处理用户选择响应
            await engine.handleUserResponse('SRS');

            // Assert: 验证工具被正确调用，用户选择被添加到参数中
            expect(handleAutonomousToolSpy).toHaveBeenCalledWith({
                name: 'selectDocumentType',
                args: { 
                    availableTypes: ['SRS', 'PRD', 'API文档'],
                    userInput: 'SRS'
                }
            });
            
            // 验证正常的执行流程
            expect(_runExecutionLoopSpy).toHaveBeenCalledTimes(1);
            expect(displayExecutionSummarySpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Anti-Pattern: No Infinite Loop', () => {
        it('should not fall into infinite loop when user confirms multiple times', async () => {
            // 这个测试特别验证修复后不会出现无限循环
            let executionCount = 0;
            const MAX_ITERATIONS = 5;

            const engineState = engine.getState();
            engineState.stage = 'awaiting_user';
            engineState.pendingInteraction = {
                type: 'confirmation' as const,
                message: '确认执行？',
                options: ['yes', 'no'],
                toolCall: {
                    name: 'testTool',
                    args: {}
                }
            };

            const handleAutonomousToolSpy = jest.spyOn(engine as any, 'handleAutonomousTool')
                .mockImplementation(async () => {
                    executionCount++;
                    if (executionCount >= MAX_ITERATIONS) {
                        throw new Error('Infinite loop detected! Tool executed too many times.');
                    }
                    engineState.stage = 'executing';
                });

            const _runExecutionLoopSpy = jest.spyOn(engine as any, '_runExecutionLoop')
                .mockImplementation(async () => {
                    engineState.stage = 'completed';
                });

            const displayExecutionSummarySpy = jest.spyOn(engine as any, 'displayExecutionSummary')
                .mockImplementation(() => {});

            // Act: 处理用户确认，应该只执行一次
            await engine.handleUserResponse('yes');

            // Assert: 验证工具只被执行一次
            expect(executionCount).toBe(1);
            expect(handleAutonomousToolSpy).toHaveBeenCalledTimes(1);
            expect(_runExecutionLoopSpy).toHaveBeenCalledTimes(1);
            expect(displayExecutionSummarySpy).toHaveBeenCalledTimes(1);
            
            // 验证引擎状态正确
            expect(engine.getState().stage).toBe('completed');
            expect(engine.getState().pendingInteraction).toBeUndefined();
        });
    });

    describe('Error Cases', () => {
        it('should handle calls when not awaiting user', async () => {
            // Arrange: 引擎不在awaiting_user状态
            const engineState = engine.getState();
            engineState.stage = 'executing';
            engineState.pendingInteraction = undefined;

            // Act: 尝试处理用户响应
            await engine.handleUserResponse('yes');

            // Assert: 应该显示错误消息
            expect(mockStream.markdown).toHaveBeenCalledWith('⚠️ 当前没有等待用户输入的操作。\n\n');
        });

        it('should handle missing pendingInteraction', async () => {
            // Arrange: 引擎在awaiting_user状态但没有pendingInteraction
            const engineState = engine.getState();
            engineState.stage = 'awaiting_user';
            engineState.pendingInteraction = undefined;

            // Act: 尝试处理用户响应
            await engine.handleUserResponse('yes');

            // Assert: 应该显示错误消息
            expect(mockStream.markdown).toHaveBeenCalledWith('⚠️ 当前没有等待用户输入的操作。\n\n');
        });
    });
});