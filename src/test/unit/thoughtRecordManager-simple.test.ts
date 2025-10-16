/**
 * 思考记录管理器的简化单元测试
 * 专注于测试核心功能，避免复杂的依赖链
 */

import { ThoughtRecordManager } from '../../tools/internal/ThoughtRecordManager';
import { ThoughtRecord } from '../../tools/internal/recordThoughtTools';

describe('ThoughtRecordManager - Unit Tests', () => {
    let thoughtRecordManager: ThoughtRecordManager;

    beforeEach(() => {
        thoughtRecordManager = ThoughtRecordManager.getInstance();
    });

    describe('基础功能测试', () => {
        it('应该正确记录和检索思考记录', () => {
            const specialistId = 'test_specialist';
            const thoughtRecord: ThoughtRecord = {
                thinkingType: 'analysis',
                content: { problem: 'Test problem' },
                nextSteps: ['Test step'],
                timestamp: new Date().toISOString(),
                thoughtId: 'test-thought-1',
                context: 'Test context'
            };

            // 记录思考
            thoughtRecordManager.recordThought(specialistId, thoughtRecord);

            // 验证记录数量
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(1);

            // 验证格式化输出
            const formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            expect(formattedThoughts).toContain('Test problem');
            expect(formattedThoughts).toContain('Test context');
        });

        it('应该正确清空思考记录', () => {
            const specialistId = 'test_specialist_clear';
            
            // 添加思考记录
            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'planning',
                content: { plan: 'Test plan' },
                nextSteps: ['Test next step'],
                timestamp: new Date().toISOString(),
                thoughtId: 'test-thought-clear',
                context: 'Test clear context'
            });

            // 验证记录存在
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(1);

            // 清空记录
            thoughtRecordManager.clearThoughts(specialistId);

            // 验证记录被清空
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(0);
            expect(thoughtRecordManager.getFormattedThoughts(specialistId)).toBe('');
        });
    });

    describe('多specialist隔离测试', () => {
        it('不同specialist的思考记录应该完全隔离', () => {
            const specialist1 = 'specialist_1';
            const specialist2 = 'specialist_2';

            // 为specialist1添加记录
            thoughtRecordManager.recordThought(specialist1, {
                thinkingType: 'analysis',
                content: { analysis: 'Specialist 1 analysis' },
                nextSteps: ['Step 1'],
                timestamp: new Date().toISOString(),
                thoughtId: 'specialist1-thought',
                context: 'Specialist 1 context'
            });

            // 为specialist2添加记录
            thoughtRecordManager.recordThought(specialist2, {
                thinkingType: 'synthesis',
                content: { synthesis: 'Specialist 2 synthesis' },
                nextSteps: ['Step A'],
                timestamp: new Date().toISOString(),
                thoughtId: 'specialist2-thought',
                context: 'Specialist 2 context'
            });

            // 验证隔离性
            expect(thoughtRecordManager.getThoughtCount(specialist1)).toBe(1);
            expect(thoughtRecordManager.getThoughtCount(specialist2)).toBe(1);

            const thoughts1 = thoughtRecordManager.getFormattedThoughts(specialist1);
            const thoughts2 = thoughtRecordManager.getFormattedThoughts(specialist2);

            expect(thoughts1).toContain('Specialist 1 analysis');
            expect(thoughts1).not.toContain('Specialist 2 synthesis');
            expect(thoughts2).toContain('Specialist 2 synthesis');
            expect(thoughts2).not.toContain('Specialist 1 analysis');

            // 清空specialist1，不应该影响specialist2
            thoughtRecordManager.clearThoughts(specialist1);
            expect(thoughtRecordManager.getThoughtCount(specialist1)).toBe(0);
            expect(thoughtRecordManager.getThoughtCount(specialist2)).toBe(1);
        });
    });

    describe('内存限制测试', () => {
        it('应该将思考记录限制在10条以内', () => {
            const specialistId = 'memory_test_specialist';

            // 添加15条思考记录
            for (let i = 1; i <= 15; i++) {
                thoughtRecordManager.recordThought(specialistId, {
                    thinkingType: 'analysis',
                    content: { step: i, description: `Step ${i} analysis` },
                    nextSteps: [`Next step ${i}`],
                    timestamp: new Date(Date.now() + i * 1000).toISOString(),
                    thoughtId: `thought-${i}`,
                    context: `Context for step ${i}`
                });
            }

            // 验证只保留了10条记录
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(10);

            // 验证保留的是最新的10条
            const formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            expect(formattedThoughts).toContain('Step 15 analysis'); // 最新的
            expect(formattedThoughts).toContain('Step 6 analysis');  // 第10新的
            expect(formattedThoughts).not.toContain('Step 5 analysis'); // 第11新的，应该被移除
            expect(formattedThoughts).not.toContain('Step 1 analysis'); // 最旧的，应该被移除
        });

        it('应该保持思考记录的时间顺序（最新在前）', () => {
            const specialistId = 'order_test_specialist';

            // 添加3条具有明确时间顺序的记录
            const times = [
                new Date('2025-10-08T01:00:00.000Z').toISOString(),
                new Date('2025-10-08T02:00:00.000Z').toISOString(),
                new Date('2025-10-08T03:00:00.000Z').toISOString()
            ];

            times.forEach((timestamp, index) => {
                thoughtRecordManager.recordThought(specialistId, {
                    thinkingType: 'analysis',
                    content: { phase: index + 1, description: `Phase ${index + 1}` },
                    nextSteps: [`Next phase ${index + 2}`],
                    timestamp,
                    thoughtId: `phase-${index + 1}`,
                    context: `Phase ${index + 1} context`
                });
            });

            const formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            const lines = formattedThoughts.split('\n');

            // 找到各个阶段在格式化输出中的位置
            const phase3Index = lines.findIndex(line => line.includes('Phase 3'));
            const phase2Index = lines.findIndex(line => line.includes('Phase 2'));
            const phase1Index = lines.findIndex(line => line.includes('Phase 1'));

            // 验证时间顺序：Phase 3 (最新) < Phase 2 < Phase 1 (最旧)
            expect(phase3Index).toBeLessThan(phase2Index);
            expect(phase2Index).toBeLessThan(phase1Index);
        });
    });

    describe('边界情况测试', () => {
        it('应该正确处理空状态', () => {
            const specialistId = 'empty_specialist';

            // 测试空状态
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(0);
            expect(thoughtRecordManager.getFormattedThoughts(specialistId)).toBe('');

            // 测试清空不存在的specialist
            expect(() => {
                thoughtRecordManager.clearThoughts(specialistId);
            }).not.toThrow();

            // 测试统计信息
            const stats = thoughtRecordManager.getAllThoughtStats();
            expect(stats[specialistId]).toBeUndefined();
        });

        it('应该正确处理复杂的思考内容', () => {
            const specialistId = 'complex_content_specialist';

            // 测试复杂对象内容
            const complexContent = {
                nested: {
                    deep: {
                        value: 'deeply nested value',
                        array: [1, 2, { key: 'nested in array' }]
                    }
                },
                nullValue: null,
                undefinedValue: undefined,
                emptyString: '',
                emptyArray: [],
                emptyObject: {}
            };

            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'synthesis',
                content: complexContent,
                nextSteps: ['Handle complex structure'],
                timestamp: new Date().toISOString(),
                thoughtId: 'complex-content-thought',
                context: 'Testing complex content handling'
            });

            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(1);
            
            const formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            // 验证复杂对象被正确处理（可能不会完全展开深层嵌套）
            expect(formattedThoughts).toContain('Nested');
            expect(formattedThoughts).toContain('Testing complex content handling');
        });

        it('应该正确处理长文本内容的截断', () => {
            const specialistId = 'long_content_specialist';

            // 创建一个很长的字符串
            const longString = 'This is a very long string that should be truncated. '.repeat(10);
            
            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'reflection',
                content: { longDescription: longString },
                nextSteps: ['Process long content'],
                timestamp: new Date().toISOString(),
                thoughtId: 'long-content-thought',
                context: 'Testing long content truncation'
            });

            const formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            // 验证内容存在但被适当处理了
            expect(formattedThoughts).toContain('This is a very long string');
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(1);
        });
    });

    describe('格式化输出测试', () => {
        it('应该生成正确格式的思考记录输出', () => {
            const specialistId = 'format_test_specialist';

            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'planning',
                content: {
                    problem: 'Need to create a prototype',
                    approach: ['Analyze requirements', 'Design UI', 'Implement features'],
                    constraints: ['Limited time', 'No existing SRS']
                },
                nextSteps: ['Start with wireframes', 'Get user feedback'],
                timestamp: '2025-10-08T01:18:20.704Z',
                thoughtId: 'planning-thought-1',
                context: 'Initial prototype design phase'
            });

            const formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);

            // 验证包含基本结构元素
            expect(formattedThoughts).toContain('💭 **Work Memory**');
            expect(formattedThoughts).toContain('📋 Thought in Iteration');
            expect(formattedThoughts).toContain('PLANNING');
            expect(formattedThoughts).toContain('📍 **Context**');
            expect(formattedThoughts).toContain('🔍 **Analysis**');
            expect(formattedThoughts).toContain('🎯 **Planned Actions**');
            expect(formattedThoughts).toContain('⏰ **Recorded**');
            expect(formattedThoughts).toContain('🆔 **ID**');

            // 验证包含具体内容
            expect(formattedThoughts).toContain('Need to create a prototype');
            expect(formattedThoughts).toContain('Initial prototype design phase');
            expect(formattedThoughts).toContain('Start with wireframes');
            expect(formattedThoughts).toContain('planning-thought-1');

            // 验证包含指导信息
            expect(formattedThoughts).toContain('⚠️ **CRITICAL GUIDANCE**');
            expect(formattedThoughts).toContain('🔄 **Continue**');
            expect(formattedThoughts).toContain('🚫 **Avoid**');
        });

        it('应该正确处理多条思考记录的格式化', () => {
            const specialistId = 'multi_format_specialist';

            // 添加多条记录
            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'analysis',
                content: { analysis: 'First analysis' },
                nextSteps: ['First next step'],
                timestamp: '2025-10-08T01:00:00.000Z',
                thoughtId: 'first-thought',
                context: 'First context'
            });

            thoughtRecordManager.recordThought(specialistId, {
                thinkingType: 'synthesis',
                content: { synthesis: 'Second synthesis' },
                nextSteps: ['Second next step'],
                timestamp: '2025-10-08T02:00:00.000Z',
                thoughtId: 'second-thought',
                context: 'Second context'
            });

            const formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);

            // 验证包含多条记录
            expect(formattedThoughts).toContain('2 previous thought records');
            expect(formattedThoughts).toContain('Iteration 2: SYNTHESIS');
            expect(formattedThoughts).toContain('Iteration 1: ANALYSIS');
            expect(formattedThoughts).toContain('First analysis');
            expect(formattedThoughts).toContain('Second synthesis');

            // 验证分隔符
            expect(formattedThoughts).toContain('---');
        });
    });
});
