/**
 * 统一错误处理机制测试
 * 验证文件编辑失败时不终止循环，而是记录错误并传递给下轮循环
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PlanExecutor } from '../../core/orchestrator/PlanExecutor';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { SessionContext } from '../../types/session';
import { executeUnifiedEdits } from '../../tools/atomic/unified-edit-executor';

// 模拟vscode
jest.mock('vscode', () => ({
    workspace: {
        openTextDocument: jest.fn(),
        applyEdit: jest.fn(),
        textDocuments: []
    },
    WorkspaceEdit: jest.fn(),
    Uri: {
        file: jest.fn((path: string) => ({ fsPath: path, toString: () => path }))
    },
    Range: jest.fn(),
    Position: jest.fn(),
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            append: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        }))
    }
}));

// 模拟统一编辑执行器
jest.mock('../../tools/atomic/unified-edit-executor', () => ({
    executeUnifiedEdits: jest.fn()
}));

// 🚨 已删除：过时的semantic-locator mock
// 该文件已被删除，现在使用 SidBasedSemanticLocator

// 模拟其他深层依赖
jest.mock('../../core/orchestrator/ToolAccessController', () => ({
    ToolAccessController: jest.fn()
}));

jest.mock('../../core/orchestrator/ToolCacheManager', () => ({
    ToolCacheManager: jest.fn()
}));

describe('统一错误处理机制测试', () => {
    let planExecutor: PlanExecutor;
    let specialistExecutor: SpecialistExecutor;
    let mockSessionContext: SessionContext;
    let mockSelectedModel: any;
    let testDir: string;

    beforeEach(() => {
        // 创建测试目录
        testDir = path.join(__dirname, 'test-unified-error');
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        // 初始化组件
        specialistExecutor = new SpecialistExecutor();
        planExecutor = new PlanExecutor(specialistExecutor);

        // 模拟session context
        mockSessionContext = {
            sessionContextId: 'test-session',
            projectName: 'test-project',
            baseDir: testDir,
            activeFiles: [],
            metadata: {
                srsVersion: '1.0',
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                version: '5.0'
            }
        };

        // 模拟选择的模型
        mockSelectedModel = {
            name: 'claude-3-5-sonnet',
            sendRequest: jest.fn()
        };

        // 重置所有mock
        jest.clearAllMocks();
    });

    afterEach(() => {
        // 清理测试目录
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('executeFileEditsInLoop错误处理', () => {
        test('文件编辑成功应该返回成功结果', async () => {
            // 准备测试数据
            const specialistOutput = {
                success: true,
                requires_file_editing: true,
                target_file: 'test.md',
                edit_instructions: [
                    {
                        type: 'replace_section',
                        target: { sectionName: 'Test Section' },
                        content: 'New content',
                        reason: 'Test edit'
                    }
                ]
            };

            // 模拟成功的编辑结果
            (executeUnifiedEdits as jest.Mock).mockResolvedValue({
                success: true,
                appliedCount: 1,
                failedCount: 0
            });

            // 使用反射访问私有方法
            const result = await (planExecutor as any).executeFileEditsInLoop(
                specialistOutput, 
                mockSessionContext
            );

            // 验证结果
            expect(result.success).toBe(true);
            expect(result.appliedCount).toBe(1);
            expect(result.error).toBeUndefined();
        });

        test('文件编辑失败应该返回失败结果而不抛出异常', async () => {
            // 准备测试数据
            const specialistOutput = {
                success: true,
                requires_file_editing: true,
                target_file: 'test.md',
                edit_instructions: [
                    {
                        type: 'replace_section',
                        target: { sectionName: 'Nonexistent Section' },
                        content: 'New content',
                        reason: 'Test edit'
                    }
                ]
            };

            // 模拟失败的编辑结果
            const expectedError = 'Section not found: Nonexistent Section';
            (executeUnifiedEdits as jest.Mock).mockResolvedValue({
                success: false,
                appliedCount: 0,
                failedCount: 1,
                error: expectedError
            });

            // 使用反射访问私有方法
            const result = await (planExecutor as any).executeFileEditsInLoop(
                specialistOutput, 
                mockSessionContext
            );

            // 验证结果 - 应该返回失败结果而不抛出异常
            expect(result.success).toBe(false);
            expect(result.error).toBe(expectedError);
            expect(result.appliedCount).toBe(0);
        });

        test('编辑过程中发生异常应该捕获并返回错误结果', async () => {
            // 准备测试数据
            const specialistOutput = {
                success: true,
                requires_file_editing: true,
                target_file: 'test.md',
                edit_instructions: [{ type: 'invalid_type' }]
            };

            // 模拟异常
            const thrownError = new Error('Unexpected editing error');
            (executeUnifiedEdits as jest.Mock).mockRejectedValue(thrownError);

            // 使用反射访问私有方法
            const result = await (planExecutor as any).executeFileEditsInLoop(
                specialistOutput, 
                mockSessionContext
            );

            // 验证结果
            expect(result.success).toBe(false);
            expect(result.error).toBe('文件编辑异常: Unexpected editing error');
            expect(result.appliedCount).toBe(0);
        });

        test('没有编辑指令时应该返回成功', async () => {
            // 准备测试数据 - 没有编辑指令
            const specialistOutput = {
                success: true,
                requires_file_editing: false
            };

            // 使用反射访问私有方法
            const result = await (planExecutor as any).executeFileEditsInLoop(
                specialistOutput, 
                mockSessionContext
            );

            // 验证结果
            expect(result.success).toBe(true);
            expect(result.appliedCount).toBe(0);
            expect(executeUnifiedEdits).not.toHaveBeenCalled();
        });
    });

    describe('循环中的错误传递机制', () => {
        test('应该验证文件编辑失败的信息被正确记录到执行历史中', async () => {
            // 创建测试文件
            const testFile = path.join(testDir, 'test.md');
            fs.writeFileSync(testFile, '# Test Document\n\nSome content');

            // 模拟specialist执行器返回需要文件编辑的结果
            const mockSpecialistOutput = {
                success: true,
                requires_file_editing: true,
                target_file: 'test.md',
                edit_instructions: [
                    {
                        type: 'replace_section',
                        target: { sectionName: 'Nonexistent Section' },
                        content: 'New content',
                        reason: 'Test edit'
                    }
                ] as any[],
                content: 'Task completed with file editing',
                metadata: {
                    specialist: 'test_specialist',
                    iterations: 1,
                    executionTime: 1000,
                    timestamp: new Date().toISOString(),
                    toolsUsed: ['readFile']
                }
            };

            // 模拟specialist执行结果
            jest.spyOn(specialistExecutor, 'execute').mockResolvedValue(mockSpecialistOutput);

            // 模拟失败的文件编辑
            const expectedError = 'Section not found: Nonexistent Section';
            (executeUnifiedEdits as jest.Mock).mockResolvedValue({
                success: false,
                appliedCount: 0,
                failedCount: 1,
                error: expectedError
            });

            // 准备执行计划
            const testPlan = {
                planId: 'test-plan-001',
                description: 'Test error handling plan',
                steps: [
                    {
                        step: 1,
                        specialist: 'test_specialist',
                        description: 'Test specialist with file editing'
                    }
                ]
            };

            // 执行计划
            let planResult;
            try {
                planResult = await planExecutor.execute(
                    testPlan,
                    mockSessionContext,
                    mockSelectedModel,
                    'Test error handling'
                );

                // 验证计划没有因为文件编辑失败而失败
                expect(planResult.intent).not.toBe('plan_failed');
                
                // 验证specialist被调用了
                expect(specialistExecutor.execute).toHaveBeenCalled();
                
                // 验证文件编辑被尝试了
                expect(executeUnifiedEdits).toHaveBeenCalledWith(
                    mockSpecialistOutput.edit_instructions,
                    expect.stringContaining('test.md')
                );

            } catch (error) {
                // 如果仍然抛出异常，说明修复没有生效
                fail(`Plan execution should not throw exception, but got: ${(error as Error).message}`);
            }
        });
    });

    describe('循环上下文中的错误信息传递', () => {
        test('验证错误信息会传递给下轮循环的context', () => {
            // 创建模拟的执行历史，包含文件编辑失败
            const mockExecutionHistory = [
                {
                    iteration: 1,
                    toolCalls: [
                        { name: 'readFile', args: { path: 'test.md' } }
                    ],
                    toolResults: [
                        {
                            toolName: 'readFile',
                            success: true,
                            result: { content: 'file content' }
                        },
                        {
                            toolName: 'fileEdit',
                            success: false,
                            result: { 
                                error: 'Section not found: Nonexistent Section',
                                targetFile: 'test.md',
                                instructionCount: 1
                            },
                            error: 'Section not found: Nonexistent Section'
                        }
                    ],
                    aiResponse: 'Attempted file editing',
                    timestamp: new Date().toISOString(),
                    summary: 'File editing failed',
                    executionTime: 1000
                }
            ];

            // 使用反射访问私有方法构建循环上下文
            const loopContext = (planExecutor as any).buildSpecialistLoopContext(
                { step: 1, specialist: 'test_specialist' },
                {},
                mockSessionContext,
                'test input',
                { planId: 'test', description: 'test', steps: [] },
                mockExecutionHistory
            );

            // 验证错误信息被包含在上下文中
            expect(loopContext.specialistLoopContext).toBeDefined();
            expect(loopContext.specialistLoopContext.toolResultsHistory).toBeDefined();
            
            const toolResults = loopContext.specialistLoopContext.toolResultsHistory;
            const fileEditResult = toolResults.find((result: any) => result.toolName === 'fileEdit');
            
            expect(fileEditResult).toBeDefined();
            expect(fileEditResult.success).toBe(false);
            expect(fileEditResult.result.error).toBe('Section not found: Nonexistent Section');

            // 验证循环指导信息
            expect(loopContext.specialistLoopContext.loopGuidance).toBeDefined();
            expect(loopContext.specialistLoopContext.loopGuidance.workflow).toContain(
                '1. 查看上一轮的工具调用结果和文件状态'
            );
        });
    });
}); 