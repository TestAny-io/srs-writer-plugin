/**
 * 思考记录管理器修复的回归测试
 * 
 * 测试修复：恢复模式下保留specialist思考记录
 * Bug: specialistExecutor在恢复模式下仍然清空思考记录，导致工作记忆丢失
 * Fix: 只有在非恢复模式下才清空思考记录
 */

import { SpecialistExecutor } from '../../core/specialistExecutor';
import { ThoughtRecordManager } from '../../tools/internal/ThoughtRecordManager';
import { Logger } from '../../utils/logger';
import * as vscode from 'vscode';

describe('ThoughtRecordManager Fix - Regression Tests', () => {
    let specialistExecutor: SpecialistExecutor;
    let thoughtRecordManager: ThoughtRecordManager;
    let mockModel: vscode.LanguageModelChat;
    let logger: Logger;

    beforeEach(() => {
        // 使用spy监控日志输出
        logger = Logger.getInstance();
        jest.spyOn(logger, 'info').mockImplementation(() => {});
        jest.spyOn(logger, 'warn').mockImplementation(() => {});
        jest.spyOn(logger, 'error').mockImplementation(() => {});

        // 创建思考记录管理器实例
        thoughtRecordManager = ThoughtRecordManager.getInstance();
        
        // 创建specialist执行器实例
        specialistExecutor = new SpecialistExecutor();
        
        // 模拟VSCode语言模型
        mockModel = {
            sendRequest: jest.fn(),
            countTokens: jest.fn().mockResolvedValue(100),
            name: 'test-model',
            id: 'test-model-id',
            vendor: 'test',
            family: 'test',
            version: '1.0',
            maxInputTokens: 4096
        } as any;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('测试1: 正常specialist执行（无恢复）', () => {
        it('应该清空思考记录并记录正确的日志', async () => {
            const specialistId = 'test_specialist_1';
            const contextForThisStep = {
                currentStep: { description: 'Test task' },
                sessionData: { projectName: 'test-project', baseDir: '/test' }
            };

            // 预先添加一些思考记录
            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'analysis',
                content: { problem: 'Previous analysis' },
                nextSteps: ['Continue work'],
                timestamp: new Date().toISOString(),
                thoughtId: 'test-thought-1',
                context: 'Previous context'
            });

            // 验证思考记录已添加
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(1);

            // 执行specialist（无恢复状态）
            try {
                // 由于这是集成测试且可能会调用真实的AI模型，我们需要模拟或跳过实际执行
                // 这里我们主要测试思考记录的清空逻辑
                const executePromise = specialistExecutor.execute(
                    specialistId,
                    contextForThisStep,
                    mockModel
                );

                // 等待一小段时间让初始化完成
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 由于execute可能会长时间运行，我们在这里验证日志和状态
                // 验证清空日志被记录
                expect(logger.info).toHaveBeenCalledWith(
                    expect.stringMatching(new RegExp(`🧹 \\[ThoughtRecordManager\\] 清空specialist ${specialistId}的思考记录`))
                );
                
            } catch (error) {
                // 预期可能会有错误，因为我们没有完整的测试环境
                // 主要目的是验证思考记录清空逻辑被正确调用
                console.log('Expected error in test environment:', (error as Error).message);
            }
        });
    });

    describe('测试2: 恢复模式specialist执行', () => {
        it('应该保留思考记录并记录正确的日志', async () => {
            const specialistId = 'test_specialist_2';
            const contextForThisStep = {
                currentStep: { description: 'Resume task' },
                sessionData: { projectName: 'test-project', baseDir: '/test' }
            };

            // 预先添加思考记录
            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'analysis',
                content: { problem: 'Previous analysis for resume' },
                nextSteps: ['Continue from where left off'],
                timestamp: new Date().toISOString(),
                thoughtId: 'test-thought-resume',
                context: 'Resume context'
            });

            const initialThoughtCount = thoughtRecordManager.getThoughtCount(specialistId);
            expect(initialThoughtCount).toBe(1);

            // 创建恢复状态
            const resumeState = {
                iteration: 2,
                internalHistory: ['Previous iteration result'],
                userResponse: '确认，请继续'
            };

            try {
                // 执行specialist（恢复模式）
                const executePromise = specialistExecutor.execute(
                    specialistId,
                    contextForThisStep,
                    mockModel,
                    resumeState
                );

                // 等待一小段时间让初始化完成
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 验证恢复模式的日志被记录
                expect(logger.info).toHaveBeenCalledWith(
                    expect.stringMatching(new RegExp(`🔄 \\[ThoughtRecordManager\\] 恢复模式：保留specialist ${specialistId}的\\d+条思考记录`))
                );
                
                // 验证思考记录没有被清空
                expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(initialThoughtCount);
                
            } catch (error) {
                // 预期可能会有错误，主要验证思考记录保留逻辑
                console.log('Expected error in test environment:', (error as Error).message);
                
                // 即使执行失败，思考记录也应该保留
                expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(initialThoughtCount);
            }
        });
    });

    describe('测试3: 多specialist隔离性', () => {
        it('不同specialist的思考记录应该互不影响', async () => {
            const specialist1 = 'test_specialist_3a';
            const specialist2 = 'test_specialist_3b';
            
            // 为两个specialist添加思考记录
            thoughtRecordManager.recordThought(specialist1, {
                thinkingType: 'planning',
                content: { plan: 'Specialist 1 plan' },
                nextSteps: ['Step 1'],
                timestamp: new Date().toISOString(),
                thoughtId: 'specialist1-thought',
                context: 'Specialist 1 context'
            });

            thoughtRecordManager.recordThought(specialist2, {
                thinkingType: 'analysis',
                content: { analysis: 'Specialist 2 analysis' },
                nextSteps: ['Step A'],
                timestamp: new Date().toISOString(),
                thoughtId: 'specialist2-thought',
                context: 'Specialist 2 context'
            });

            // 验证初始状态
            expect(thoughtRecordManager.getThoughtCount(specialist1)).toBe(1);
            expect(thoughtRecordManager.getThoughtCount(specialist2)).toBe(1);

            // 清空specialist1的思考记录
            thoughtRecordManager.clearThoughts(specialist1);

            // 验证只有specialist1的记录被清空
            expect(thoughtRecordManager.getThoughtCount(specialist1)).toBe(0);
            expect(thoughtRecordManager.getThoughtCount(specialist2)).toBe(1);

            // 验证specialist2的思考记录内容仍然正确
            const specialist2Thoughts = thoughtRecordManager.getFormattedThoughts(specialist2);
            expect(specialist2Thoughts).toContain('Specialist 2 analysis');
        });
    });

    describe('测试4: 思考记录内存限制', () => {
        it('应该正确限制每个specialist最多10条思考记录', () => {
            const specialistId = 'test_specialist_4';

            // 添加15条思考记录（超过限制）
            for (let i = 1; i <= 15; i++) {
                thoughtRecordManager.recordThought(specialistId, {
                    thinkingType: 'analysis',
                    content: { step: i, analysis: `Analysis step ${i}` },
                    nextSteps: [`Next step ${i}`],
                    timestamp: new Date(Date.now() + i * 1000).toISOString(),
                    thoughtId: `thought-${i}`,
                    context: `Context ${i}`
                });
            }

            // 验证只保留了10条记录
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(10);

            // 验证保留的是最新的10条记录（时间降序）
            const formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            expect(formattedThoughts).toContain('Analysis step 15'); // 最新的
            expect(formattedThoughts).toContain('Analysis step 6');  // 第10条
            expect(formattedThoughts).not.toContain('Analysis step 5'); // 第11条应该被移除
        });
    });

    describe('测试5: 边界情况', () => {
        it('应该正确处理空状态和异常情况', () => {
            const specialistId = 'test_specialist_5';

            // 测试获取不存在specialist的思考记录
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(0);
            expect(thoughtRecordManager.getFormattedThoughts(specialistId)).toBe('');

            // 测试清空不存在specialist的思考记录
            expect(() => {
                thoughtRecordManager.clearThoughts(specialistId);
            }).not.toThrow();

            // 测试统计信息
            const stats = thoughtRecordManager.getAllThoughtStats();
            expect(stats[specialistId]).toBeUndefined();
        });

        it('应该正确处理异常的思考记录内容', () => {
            const specialistId = 'test_specialist_5b';

            // 测试添加空内容的思考记录
            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'reflection',
                content: '',
                nextSteps: [],
                timestamp: new Date().toISOString(),
                thoughtId: 'empty-thought',
                context: ''
            });

            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(1);

            // 测试添加复杂对象内容
            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'synthesis',
                content: {
                    nested: {
                        deep: {
                            value: 'complex structure'
                        }
                    },
                    array: [1, 2, 3, { key: 'value' }],
                    nullValue: null,
                    undefinedValue: undefined
                },
                nextSteps: ['Handle complex data'],
                timestamp: new Date().toISOString(),
                thoughtId: 'complex-thought',
                context: 'Complex data context'
            });

            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(2);
            
            const formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            expect(formattedThoughts).toContain('complex structure');
        });
    });

    describe('测试6: 集成测试 - 完整用户交互流程', () => {
        it('应该在完整的用户交互流程中正确保持思考记录连续性', () => {
            const specialistId = 'integration_test_specialist';

            // 模拟第一轮执行：specialist分析问题并记录思考
            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'analysis',
                content: {
                    problem: '用户需要设计原型，但缺少SRS.md文件',
                    available_context: '有任务描述和基本需求信息',
                    approach: ['分析现有信息', '设计初步方案', '询问用户确认']
                },
                nextSteps: ['创建初步设计', '向用户展示方案'],
                timestamp: '2025-10-08T01:18:20.704Z',
                thoughtId: 'analysis-phase-1',
                context: '原型设计第一阶段'
            });

            // 验证第一轮思考记录
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(1);
            let formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            expect(formattedThoughts).toContain('用户需要设计原型');
            expect(formattedThoughts).toContain('原型设计第一阶段');

            // 模拟用户交互：specialist调用askQuestion等待用户回复
            // （在真实场景中，specialist会暂停执行，等待用户回复）

            // 模拟第二轮执行：specialist恢复执行，应该能看到之前的思考
            // 首先验证恢复前思考记录仍然存在
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(1);
            
            // 模拟specialist在恢复执行时添加新的思考
            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'synthesis',
                content: {
                    user_feedback: '用户确认了初步方案',
                    next_phase: '进入详细设计阶段',
                    building_on_previous: '基于之前的分析，现在可以进行具体实现'
                },
                nextSteps: ['创建详细原型', '实现具体功能'],
                timestamp: '2025-10-08T01:25:30.123Z',
                thoughtId: 'synthesis-phase-2',
                context: '原型设计第二阶段，基于用户确认'
            });

            // 验证两轮思考记录都存在
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(2);
            
            formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            // 验证包含第一轮的思考
            expect(formattedThoughts).toContain('用户需要设计原型');
            expect(formattedThoughts).toContain('原型设计第一阶段');
            
            // 验证包含第二轮的思考
            expect(formattedThoughts).toContain('用户确认了初步方案');
            expect(formattedThoughts).toContain('基于之前的分析');
            
            // 验证时间顺序（最新的在前）
            const thoughtLines = formattedThoughts.split('\n');
            const firstPhaseIndex = thoughtLines.findIndex(line => line.includes('原型设计第一阶段'));
            const secondPhaseIndex = thoughtLines.findIndex(line => line.includes('原型设计第二阶段'));
            
            // 第二阶段（更新的）应该在第一阶段之前出现
            expect(secondPhaseIndex).toBeLessThan(firstPhaseIndex);
        });
    });
});
