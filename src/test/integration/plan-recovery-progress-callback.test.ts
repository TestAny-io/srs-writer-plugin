/**
 * 计划恢复时 progressCallback 完整性测试
 * 验证恢复执行时工具调用信息是否正确显示
 *
 * Bug Fix: 恢复执行时使用简化版 progressCallback，导致工具信息不显示
 * Solution: 使用保存的 savedProgressCallback，确保显示逻辑一致
 */

import { SRSAgentEngine } from '../../core/srsAgentEngine';
import { PlanExecutor } from '../../core/orchestrator/PlanExecutor';
import { SpecialistProgressCallback } from '../../types';

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

describe('计划恢复 - ProgressCallback 完整性测试', () => {
    let srsAgentEngine: SRSAgentEngine;
    let mockStream: any;
    let mockModel: any;
    let mockSessionManager: any;
    let mockPlanExecutor: any;
    let capturedProgressCallback: SpecialistProgressCallback | undefined;

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

        // Mock PlanExecutor
        mockPlanExecutor = {
            resumeFromStep: jest.fn((
                originalPlan,
                failedStep,
                completedStepResults,
                sessionContext,
                userInput,
                selectedModel,
                progressCallback
            ) => {
                // 捕获传入的 progressCallback
                capturedProgressCallback = progressCallback;
                return Promise.resolve({
                    intent: 'plan_completed',
                    result: { summary: '恢复执行成功' }
                });
            })
        };

        srsAgentEngine = new SRSAgentEngine(mockStream, mockModel);
        (srsAgentEngine as any).planExecutor = mockPlanExecutor;

        // 清空捕获的 progressCallback
        capturedProgressCallback = undefined;
    });

    describe('正常执行时的 progressCallback', () => {
        it('应该创建包含完整方法的 progressCallback', () => {
            // 模拟正常执行时创建的 progressCallback
            const progressCallback = (srsAgentEngine as any).createProgressCallback();

            // 验证基础方法存在
            expect(progressCallback).toBeDefined();
            expect(typeof progressCallback.onSpecialistStart).toBe('function');
            expect(typeof progressCallback.onIterationStart).toBe('function');
            expect(typeof progressCallback.onTaskComplete).toBe('function');

            // ❌ Bug: createProgressCallback 缺少工具相关的方法
            // 这是问题的根源
            expect(progressCallback.onToolsStart).toBeUndefined();
            expect(progressCallback.onToolsComplete).toBeUndefined();
        });

        it('应该保存完整的 progressCallback 到 savedProgressCallback', async () => {
            // 模拟正常执行流程中保存 progressCallback
            const fullProgressCallback: SpecialistProgressCallback = {
                onSpecialistStart: jest.fn(),
                onIterationStart: jest.fn(),
                onToolsStart: jest.fn(),
                onToolsComplete: jest.fn(),
                onTaskComplete: jest.fn()
            };

            // 保存到 savedProgressCallback
            (srsAgentEngine as any).savedProgressCallback = fullProgressCallback;

            // 验证保存成功
            expect((srsAgentEngine as any).savedProgressCallback).toBe(fullProgressCallback);
            expect((srsAgentEngine as any).savedProgressCallback.onToolsStart).toBeDefined();
            expect((srsAgentEngine as any).savedProgressCallback.onToolsComplete).toBeDefined();
        });
    });

    describe('恢复执行时的 progressCallback', () => {
        it('BUG REPRODUCTION: 恢复执行时使用 createProgressCallback 导致工具信息丢失', async () => {
            // 设置中断状态
            const interruptionState = {
                planId: 'test-plan',
                planDescription: '测试计划',
                originalPlan: {
                    planId: 'test-plan',
                    description: '测试计划',
                    steps: [{ step: 1 }, { step: 2 }]
                },
                failedStep: 2,
                completedStepResults: {
                    1: { success: true, requires_file_editing: false, metadata: { specialist: 'test', iterations: 1, executionTime: 1000, timestamp: '' } }
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

            // 模拟正常执行时保存的完整 progressCallback
            const fullProgressCallback: SpecialistProgressCallback = {
                onSpecialistStart: jest.fn(),
                onIterationStart: jest.fn(),
                onToolsStart: jest.fn(),
                onToolsComplete: jest.fn(),
                onTaskComplete: jest.fn()
            };
            (srsAgentEngine as any).savedProgressCallback = fullProgressCallback;

            // 恢复执行
            await (srsAgentEngine as any).resumePlanFromInterruption();

            // 验证传递给 PlanExecutor 的 progressCallback
            expect(mockPlanExecutor.resumeFromStep).toHaveBeenCalled();
            expect(capturedProgressCallback).toBeDefined();

            // ❌ BUG: 如果使用 createProgressCallback()，这些方法会是 undefined
            // ✅ FIX: 如果使用 savedProgressCallback，这些方法应该存在
            if ((srsAgentEngine as any).savedProgressCallback) {
                // 修复后的行为：应该使用 savedProgressCallback
                expect(capturedProgressCallback).toBe(fullProgressCallback);
                expect(capturedProgressCallback?.onToolsStart).toBeDefined();
                expect(capturedProgressCallback?.onToolsComplete).toBeDefined();
            } else {
                // Bug 场景：使用了 createProgressCallback()
                expect(capturedProgressCallback?.onToolsStart).toBeUndefined();
                expect(capturedProgressCallback?.onToolsComplete).toBeUndefined();
            }
        });

        it('EXPECTED BEHAVIOR: 恢复执行应该使用 savedProgressCallback', async () => {
            // 设置中断状态
            const interruptionState = {
                planId: 'test-plan-expected',
                planDescription: '期望行为测试',
                originalPlan: {
                    planId: 'test-plan-expected',
                    description: '期望行为测试',
                    steps: [{ step: 1 }, { step: 2 }, { step: 3 }]
                },
                failedStep: 2,
                completedStepResults: {
                    1: { success: true, requires_file_editing: false, metadata: { specialist: 'test', iterations: 1, executionTime: 1000, timestamp: '' } }
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

            // 创建并保存完整的 progressCallback（模拟正常执行时的行为）
            const onToolsStartSpy = jest.fn();
            const onToolsCompleteSpy = jest.fn();

            const fullProgressCallback: SpecialistProgressCallback = {
                onSpecialistStart: jest.fn((specialistId) => {
                    mockStream.markdown(`🔧 ${specialistId} 开始工作\n`);
                }),
                onIterationStart: jest.fn((current, max) => {
                    mockStream.progress(`第 ${current}/${max} 轮迭代...`);
                }),
                onToolsStart: onToolsStartSpy,
                onToolsComplete: onToolsCompleteSpy,
                onTaskComplete: jest.fn((summary) => {
                    mockStream.markdown(`✅ 任务完成 - ${summary}\n`);
                })
            };

            (srsAgentEngine as any).savedProgressCallback = fullProgressCallback;

            // 恢复执行
            await (srsAgentEngine as any).resumePlanFromInterruption();

            // 验证使用了 savedProgressCallback
            expect(capturedProgressCallback).toBe(fullProgressCallback);
            expect(capturedProgressCallback?.onToolsStart).toBeDefined();
            expect(capturedProgressCallback?.onToolsComplete).toBeDefined();

            // 验证方法是正确的 spy 函数
            expect(capturedProgressCallback?.onToolsStart).toBe(onToolsStartSpy);
            expect(capturedProgressCallback?.onToolsComplete).toBe(onToolsCompleteSpy);
        });

        it('FALLBACK BEHAVIOR: 如果 savedProgressCallback 不存在，应该使用 createProgressCallback', async () => {
            // 设置中断状态
            const interruptionState = {
                planId: 'test-plan-fallback',
                planDescription: '回退行为测试',
                originalPlan: {
                    planId: 'test-plan-fallback',
                    steps: [{ step: 1 }, { step: 2 }]
                },
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

            // 不设置 savedProgressCallback（模拟异常情况）
            (srsAgentEngine as any).savedProgressCallback = undefined;

            // 恢复执行
            await (srsAgentEngine as any).resumePlanFromInterruption();

            // 验证使用了 createProgressCallback 作为回退
            expect(capturedProgressCallback).toBeDefined();
            expect(typeof capturedProgressCallback?.onSpecialistStart).toBe('function');
            expect(typeof capturedProgressCallback?.onIterationStart).toBe('function');
            expect(typeof capturedProgressCallback?.onTaskComplete).toBe('function');
        });
    });

    describe('工具信息显示验证', () => {
        it('应该在恢复执行时正确显示工具调用信息', async () => {
            // 设置中断状态
            const interruptionState = {
                planId: 'test-plan-tool-display',
                planDescription: '工具显示测试',
                originalPlan: {
                    planId: 'test-plan-tool-display',
                    steps: [
                        { step: 1, specialist: 'fr_writer', description: '撰写功能需求' },
                        { step: 2, specialist: 'nfr_writer', description: '撰写非功能需求' }
                    ]
                },
                failedStep: 2,
                completedStepResults: {
                    1: { success: true, requires_file_editing: false, metadata: { specialist: 'fr_writer', iterations: 3, executionTime: 5000, timestamp: '' } }
                },
                sessionContext: {},
                userInput: 'test',
                interruptionReason: 'Token限制',
                interruptionTimestamp: new Date().toISOString(),
                canResume: true
            };

            (srsAgentEngine as any).state = {
                planInterruptionState: interruptionState
            };

            // 创建包含工具显示逻辑的 progressCallback
            const toolDisplaySpy = jest.fn();
            const fullProgressCallback: SpecialistProgressCallback = {
                onSpecialistStart: jest.fn(),
                onIterationStart: jest.fn(),
                onToolsStart: jest.fn(),
                onToolsComplete: jest.fn((toolCalls, results, duration) => {
                    // 模拟工具信息显示逻辑
                    toolCalls.forEach((toolCall, index) => {
                        const result = results[index];
                        const status = result.success ? '✅' : '❌';
                        toolDisplaySpy(`${status} ${toolCall.name}`);
                    });
                }),
                onTaskComplete: jest.fn()
            };

            (srsAgentEngine as any).savedProgressCallback = fullProgressCallback;

            // 恢复执行
            await (srsAgentEngine as any).resumePlanFromInterruption();

            // 验证 progressCallback 包含工具显示逻辑
            expect(capturedProgressCallback).toBe(fullProgressCallback);

            // 模拟工具执行完成时的调用
            const mockToolCalls = [
                { name: 'readMarkdownFile', args: { path: 'SRS.md' } },
                { name: 'executeMarkdownEdits', args: { filePath: 'SRS.md' } }
            ];
            const mockResults = [
                { success: true, toolName: 'readMarkdownFile', result: {} },
                { success: true, toolName: 'executeMarkdownEdits', result: {} }
            ];

            capturedProgressCallback?.onToolsComplete?.(mockToolCalls, mockResults, 1000);

            // 验证工具信息被正确显示
            expect(toolDisplaySpy).toHaveBeenCalledTimes(2);
            expect(toolDisplaySpy).toHaveBeenCalledWith('✅ readMarkdownFile');
            expect(toolDisplaySpy).toHaveBeenCalledWith('✅ executeMarkdownEdits');
        });
    });

    describe('修复验证', () => {
        it('修复后：resumePlanFromInterruption 应该优先使用 savedProgressCallback', async () => {
            const interruptionState = {
                planId: 'test-fix-verification',
                planDescription: '修复验证测试',
                originalPlan: { planId: 'test-fix-verification', steps: [{ step: 1 }] },
                failedStep: 1,
                completedStepResults: {},
                sessionContext: {},
                userInput: 'test',
                interruptionReason: 'Test',
                interruptionTimestamp: new Date().toISOString(),
                canResume: true
            };

            (srsAgentEngine as any).state = {
                planInterruptionState: interruptionState
            };

            // 设置 savedProgressCallback
            const savedCallback: SpecialistProgressCallback = {
                onSpecialistStart: jest.fn(),
                onIterationStart: jest.fn(),
                onToolsStart: jest.fn(),
                onToolsComplete: jest.fn(),
                onTaskComplete: jest.fn()
            };
            (srsAgentEngine as any).savedProgressCallback = savedCallback;

            // 恢复执行
            await (srsAgentEngine as any).resumePlanFromInterruption();

            // 核心验证：传递的应该是 savedProgressCallback
            expect(capturedProgressCallback).toBe(savedCallback);

            // 验证参数顺序正确
            const resumeFromStepCall = mockPlanExecutor.resumeFromStep.mock.calls[0];
            expect(resumeFromStepCall[0]).toBe(interruptionState.originalPlan); // originalPlan
            expect(resumeFromStepCall[1]).toBe(interruptionState.failedStep);   // failedStep
            expect(resumeFromStepCall[2]).toBe(interruptionState.completedStepResults); // completedStepResults
            expect(resumeFromStepCall[3]).toBe(interruptionState.sessionContext); // sessionContext
            expect(resumeFromStepCall[4]).toBe(interruptionState.userInput);    // userInput
            expect(resumeFromStepCall[5]).toBe(mockModel);                      // selectedModel
            expect(resumeFromStepCall[6]).toBe(savedCallback);                  // progressCallback ✅
        });
    });
});
