/**
 * SessionLogService 单元测试
 */

import { SessionLogService, SpecialistTaskContext, ToolExecutionContext, LifecycleEventContext } from '../../core/SessionLogService';
import { SessionManager } from '../../core/session-manager';
import { OperationType } from '../../types/session';
import { NextStepType } from '../../types/taskCompletion';

// Mock SessionManager
jest.mock('../../core/session-manager');
const mockSessionManager = SessionManager as jest.Mocked<typeof SessionManager>;

// Mock Logger
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

describe('SessionLogService', () => {
    let sessionLogService: SessionLogService;
    let mockSessionManagerInstance: any;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock SessionManager instance
        mockSessionManagerInstance = {
            updateSessionWithLog: jest.fn().mockResolvedValue(undefined)
        };
        mockSessionManager.getInstance.mockReturnValue(mockSessionManagerInstance);
        
        sessionLogService = new SessionLogService();
    });
    
    describe('recordSpecialistTaskCompletion', () => {
        it('应该正确记录 specialist taskComplete 事件', async () => {
            const context: SpecialistTaskContext = {
                specialistId: 'project_initializer',
                specialistName: '项目初始化专家',
                planId: 'plan-12345',                        // 🚀 新增
                taskCompleteArgs: {
                    nextStepType: NextStepType.TASK_FINISHED,
                    summary: '项目初始化完成，已创建基础文件结构',
                    contextForNext: {
                        deliverables: ['SRS.md', 'requirements.yaml', 'prototype/']
                    }
                },
                executionTime: 2500,
                iterationCount: 3
            };
            
            await sessionLogService.recordSpecialistTaskCompletion(context);
            
            expect(mockSessionManagerInstance.updateSessionWithLog).toHaveBeenCalledWith({
                logEntry: {
                    type: OperationType.SPECIALIST_INVOKED,
                    operation: 'Specialist project_initializer 完成任务: 项目初始化完成，已创建基础文件结构',
                    success: true,
                    toolName: 'taskComplete',
                    executionTime: 2500,
                    userInput: expect.objectContaining({
                        specialistId: 'project_initializer',
                        specialistName: '项目初始化专家',
                        planId: 'plan-12345'
                    })  // 🚀 修复E：验证对象格式
                }
            });
        });
        
        it('应该处理没有 contextForNext 的情况', async () => {
            const context: SpecialistTaskContext = {
                specialistId: 'content_writer',
                specialistName: '内容编写专家',
                planId: 'plan-67890',                        // 🚀 新增
                taskCompleteArgs: {
                    nextStepType: NextStepType.TASK_FINISHED,
                    summary: '内容编写完成'
                },
                executionTime: 1500
            };
            
            await sessionLogService.recordSpecialistTaskCompletion(context);
            
            expect(mockSessionManagerInstance.updateSessionWithLog).toHaveBeenCalledWith({
                logEntry: {
                    type: OperationType.SPECIALIST_INVOKED,
                    operation: 'Specialist content_writer 完成任务: 内容编写完成',
                    success: true,
                    toolName: 'taskComplete',
                    executionTime: 1500,
                    userInput: expect.objectContaining({
                        specialistId: 'content_writer',
                        specialistName: '内容编写专家',
                        planId: 'plan-67890'
                    })  // 🚀 修复E：验证对象格式
                }
            });
        });
        
        it('应该处理 SessionManager 错误而不抛出异常', async () => {
            const context: SpecialistTaskContext = {
                specialistId: 'test_specialist',
                specialistName: '测试专家',
                planId: 'plan-error-test',                   // 🚀 新增
                taskCompleteArgs: {
                    nextStepType: NextStepType.TASK_FINISHED,
                    summary: '测试任务'
                }
            };
            
            mockSessionManagerInstance.updateSessionWithLog.mockRejectedValue(new Error('SessionManager error'));
            
            // 应该不抛出异常
            await expect(sessionLogService.recordSpecialistTaskCompletion(context)).resolves.toBeUndefined();
        });
    });
    
    describe('recordToolExecution', () => {
        it('应该记录重要工具的执行', async () => {
            const context: ToolExecutionContext = {
                executor: 'traceability_tool',
                toolName: 'traceability-completion-tool',
                operation: '追溯关系同步: 初始化SRS追溯关系',
                success: true,
                targetFiles: ['requirements.yaml'],
                executionTime: 1500,
                args: { targetFile: 'requirements.yaml', description: '初始化SRS追溯关系' },
                metadata: {
                    entitiesProcessed: 25,
                    derivedFrAdded: 8,
                    adcRelatedAdded: 12
                }
            };
            
            await sessionLogService.recordToolExecution(context);
            
            expect(mockSessionManagerInstance.updateSessionWithLog).toHaveBeenCalledWith({
                logEntry: {
                    type: OperationType.TOOL_EXECUTION_END,
                    operation: '追溯关系同步: 初始化SRS追溯关系',
                    success: true,
                    toolName: 'traceability-completion-tool',
                    targetFiles: ['requirements.yaml'],
                    executionTime: 1500,
                    error: undefined,
                    userInput: expect.objectContaining({
                        executor: 'traceability_tool',
                        toolName: 'traceability-completion-tool'
                    })  // 🚀 修复E：验证对象格式
                }
            });
        });
        
        it('应该跳过不重要的工具', async () => {
            const context: ToolExecutionContext = {
                executor: 'specialist',
                toolName: 'readFile',
                operation: '读取文件',
                success: true
            };
            
            await sessionLogService.recordToolExecution(context);
            
            // 不应该调用 updateSessionWithLog
            expect(mockSessionManagerInstance.updateSessionWithLog).not.toHaveBeenCalled();
        });
        
        it('应该正确映射文件编辑工具的操作类型', async () => {
            const context: ToolExecutionContext = {
                executor: 'specialist',
                toolName: 'executeSemanticEdits',
                operation: '语义编辑文档',
                success: true,
                targetFiles: ['SRS.md']
            };
            
            await sessionLogService.recordToolExecution(context);
            
            expect(mockSessionManagerInstance.updateSessionWithLog).toHaveBeenCalledWith({
                logEntry: {
                    type: OperationType.FILE_UPDATED,
                    operation: '语义编辑文档',
                    success: true,
                    toolName: 'executeSemanticEdits',
                    targetFiles: ['SRS.md'],
                    executionTime: undefined,
                    error: undefined,
                    userInput: expect.objectContaining({
                        executor: 'specialist',
                        toolName: 'executeSemanticEdits'
                    })  // 🚀 修复E：验证对象格式
                }
            });
        });
        
        it('应该正确处理失败的工具执行', async () => {
            const context: ToolExecutionContext = {
                executor: 'specialist',
                toolName: 'executeSemanticEdits',
                operation: '语义编辑失败',
                success: false,
                error: '文件不存在'
            };
            
            await sessionLogService.recordToolExecution(context);
            
            expect(mockSessionManagerInstance.updateSessionWithLog).toHaveBeenCalledWith({
                logEntry: {
                    type: OperationType.TOOL_EXECUTION_FAILED,
                    operation: '语义编辑失败',
                    success: false,
                    toolName: 'executeSemanticEdits',
                    targetFiles: [],
                    executionTime: undefined,
                    error: '文件不存在',
                    userInput: expect.objectContaining({
                        executor: 'specialist',
                        toolName: 'executeSemanticEdits'
                    })  // 🚀 修复E：验证对象格式
                }
            });
        });
    });
    
    describe('recordLifecycleEvent', () => {
        it('应该记录项目创建事件', async () => {
            const context: LifecycleEventContext = {
                eventType: 'project_created',
                description: '创建新项目: TestProject',
                entityId: 'TestProject',
                metadata: { gitBranch: 'SRS/TestProject' }
            };
            
            await sessionLogService.recordLifecycleEvent(context);
            
            expect(mockSessionManagerInstance.updateSessionWithLog).toHaveBeenCalledWith({
                logEntry: {
                    type: OperationType.SESSION_CREATED,
                    operation: '创建新项目: TestProject',
                    success: true,
                    userInput: expect.objectContaining({
                        eventType: 'project_created',
                        entityId: 'TestProject'
                    })  // 🚀 修复E：验证对象格式
                }
            });
        });
        
        it('应该记录 specialist 开始事件', async () => {
            const context: LifecycleEventContext = {
                eventType: 'specialist_started',
                description: 'Specialist project_initializer 开始执行',
                entityId: 'project_initializer'
            };
            
            await sessionLogService.recordLifecycleEvent(context);
            
            expect(mockSessionManagerInstance.updateSessionWithLog).toHaveBeenCalledWith({
                logEntry: {
                    type: OperationType.SPECIALIST_INVOKED,
                    operation: 'Specialist project_initializer 开始执行',
                    success: true,
                    userInput: expect.objectContaining({
                        eventType: 'specialist_started',
                        entityId: 'project_initializer'
                    })  // 🚀 修复E：验证对象格式
                }
            });
        });

        it('应该记录 plan_failed 事件', async () => {
            const context: LifecycleEventContext = {
                eventType: 'plan_failed',
                description: '计划 "创建SRS文档" 执行失败: Token限制错误',
                entityId: 'plan-12345',
                metadata: {
                    planId: 'plan-12345',
                    failedStep: 5,
                    failedSpecialist: 'fr_writer',
                    error: 'Token限制错误'
                }
            };
            
            await sessionLogService.recordLifecycleEvent(context);
            
            expect(mockSessionManagerInstance.updateSessionWithLog).toHaveBeenCalledWith({
                logEntry: {
                    type: OperationType.ERROR_OCCURRED,
                    operation: '计划 "创建SRS文档" 执行失败: Token限制错误',
                    success: true,
                    userInput: expect.objectContaining({
                        eventType: 'plan_failed',
                        entityId: 'plan-12345'
                    })  // 🚀 修复E：验证对象格式
                }
            });
        });
    });
    
    describe('私有方法测试', () => {
        describe('extractTargetFiles', () => {
            it('应该从参数中提取文件路径', async () => {
                // 通过公共方法间接测试私有方法
                const context: ToolExecutionContext = {
                    executor: 'test',
                    toolName: 'executeSemanticEdits',
                    operation: 'test',
                    success: true,
                    args: {
                        targetFile: 'SRS.md',
                        path: 'requirements.yaml',
                        files: ['file1.txt', 'file2.txt']
                    }
                };
                
                await sessionLogService.recordToolExecution(context);
                
                expect(mockSessionManagerInstance.updateSessionWithLog).toHaveBeenCalledWith(
                    expect.objectContaining({
                        logEntry: expect.objectContaining({
                            targetFiles: ['SRS.md', 'requirements.yaml', 'file1.txt', 'file2.txt']
                        })
                    })
                );
            });
            
            it('应该处理空参数', async () => {
                const context: ToolExecutionContext = {
                    executor: 'test',
                    toolName: 'executeSemanticEdits',
                    operation: 'test',
                    success: true,
                    args: null
                };
                
                await sessionLogService.recordToolExecution(context);
                
                expect(mockSessionManagerInstance.updateSessionWithLog).toHaveBeenCalledWith(
                    expect.objectContaining({
                        logEntry: expect.objectContaining({
                            targetFiles: []
                        })
                    })
                );
            });
        });
        
        describe('mapToOperationType', () => {
            const testCases = [
                { toolName: 'taskComplete', success: true, expected: OperationType.SPECIALIST_INVOKED },
                { toolName: 'traceability-completion-tool', success: true, expected: OperationType.TOOL_EXECUTION_END },
                { toolName: 'traceability-completion-tool', success: false, expected: OperationType.TOOL_EXECUTION_FAILED },
                { toolName: 'executeSemanticEdits', success: true, expected: OperationType.FILE_UPDATED },
                { toolName: 'executeMarkdownEdits', success: true, expected: OperationType.FILE_UPDATED },
                { toolName: 'executeYAMLEdits', success: true, expected: OperationType.FILE_UPDATED },
                { toolName: 'executeSemanticEdits', success: false, expected: OperationType.TOOL_EXECUTION_FAILED },
                { toolName: 'createNewProjectFolder', success: true, expected: OperationType.SESSION_CREATED },
                { toolName: 'createNewProjectFolder', success: false, expected: OperationType.TOOL_EXECUTION_FAILED },
                { toolName: 'unknownTool', success: true, expected: OperationType.TOOL_EXECUTION_END },
                { toolName: 'unknownTool', success: false, expected: OperationType.TOOL_EXECUTION_FAILED }
            ];
            
            testCases.forEach(({ toolName, success, expected }) => {
                it(`应该将 ${toolName} (${success ? 'success' : 'failed'}) 映射到 ${expected}`, async () => {
                    // 清除之前的调用记录
                    mockSessionManagerInstance.updateSessionWithLog.mockClear();
                    
                    const context: ToolExecutionContext = {
                        executor: 'test',
                        toolName,
                        operation: 'test',
                        success
                    };
                    
                    await sessionLogService.recordToolExecution(context);
                    
                    // unknownTool 不在重要工具列表中，不会被记录
                    if (toolName === 'unknownTool') {
                        expect(mockSessionManagerInstance.updateSessionWithLog).not.toHaveBeenCalled();
                    } else {
                        expect(mockSessionManagerInstance.updateSessionWithLog).toHaveBeenCalledWith(
                            expect.objectContaining({
                                logEntry: expect.objectContaining({
                                    type: expected
                                })
                            })
                        );
                    }
                });
            });
        });
    });
    
    describe('错误处理', () => {
        it('应该在所有记录方法中隔离错误', async () => {
            mockSessionManagerInstance.updateSessionWithLog.mockRejectedValue(new Error('Test error'));
            
            const specialistContext: SpecialistTaskContext = {
                specialistId: 'test',
                taskCompleteArgs: {
                    nextStepType: NextStepType.TASK_FINISHED,
                    summary: 'test'
                }
            };
            
            const toolContext: ToolExecutionContext = {
                executor: 'test',
                toolName: 'executeSemanticEdits',
                operation: 'test',
                success: true
            };
            
            const lifecycleContext: LifecycleEventContext = {
                eventType: 'project_created',
                description: 'test'
            };
            
            // 所有方法都应该不抛出异常
            await expect(sessionLogService.recordSpecialistTaskCompletion(specialistContext)).resolves.toBeUndefined();
            await expect(sessionLogService.recordToolExecution(toolContext)).resolves.toBeUndefined();
            await expect(sessionLogService.recordLifecycleEvent(lifecycleContext)).resolves.toBeUndefined();
        });
    });
});
