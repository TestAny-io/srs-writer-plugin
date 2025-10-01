/**
 * ThoughtRecordManager单元测试
 * 
 * 测试思考记录管理器的核心功能：
 * 1. 思考记录的存储和检索
 * 2. 格式化输出功能
 * 3. 生命周期管理（清空功能）
 * 4. 边界条件处理
 */

import { ThoughtRecordManager } from '../../tools/internal/ThoughtRecordManager';
import { ThoughtRecord, ThinkingType } from '../../tools/internal/recordThoughtTools';

describe('ThoughtRecordManager', () => {
    let thoughtRecordManager: ThoughtRecordManager;
    
    beforeEach(() => {
        thoughtRecordManager = new ThoughtRecordManager();
    });

    describe('基础功能测试', () => {
        it('应该能记录思考内容', () => {
            const specialistId = 'test_specialist';
            const thoughtRecord: ThoughtRecord = {
                thinkingType: 'planning',
                content: { strategy: 'Test strategy', approach: 'Test approach' },
                nextSteps: ['Step 1', 'Step 2'],
                context: 'Test context',
                timestamp: new Date().toISOString(),
                thoughtId: 'test_thought_1'
            };

            thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(1);
        });

        it('应该按时间降序存储思考记录', () => {
            const specialistId = 'test_specialist';
            
            // 创建两个时间不同的思考记录
            const thought1: ThoughtRecord = {
                thinkingType: 'analysis',
                content: 'First thought',
                timestamp: '2025-01-01T10:00:00.000Z',
                thoughtId: 'thought_1'
            };
            
            const thought2: ThoughtRecord = {
                thinkingType: 'synthesis',
                content: 'Second thought',
                timestamp: '2025-01-01T11:00:00.000Z',
                thoughtId: 'thought_2'
            };

            // 按顺序添加
            thoughtRecordManager.recordThought(specialistId, thought1);
            thoughtRecordManager.recordThought(specialistId, thought2);
            
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            // 最新的思考应该在前面
            expect(formatted).toContain('Thought in Iteration 2: SYNTHESIS');
            expect(formatted).toContain('Thought in Iteration 1: ANALYSIS');
            expect(formatted.indexOf('SYNTHESIS')).toBeLessThan(formatted.indexOf('ANALYSIS'));
        });

        it('应该限制思考记录数量避免内存膨胀', () => {
            const specialistId = 'test_specialist';
            
            // 添加超过10个思考记录
            for (let i = 0; i < 15; i++) {
                const thoughtRecord: ThoughtRecord = {
                    thinkingType: 'planning',
                    content: `Thought ${i}`,
                    timestamp: new Date().toISOString(),
                    thoughtId: `thought_${i}`
                };
                thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            }
            
            // 应该只保留最新的10个
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(10);
        });
    });

    describe('格式化功能测试', () => {
        it('应该为不同思考类型返回正确的emoji', () => {
            const specialistId = 'test_specialist';
            const thinkingTypes: ThinkingType[] = ['planning', 'analysis', 'synthesis', 'reflection', 'derivation'];
            const expectedEmojis = ['📋', '🔍', '🔗', '🤔', '➡️'];
            
            thinkingTypes.forEach((type, index) => {
                const thoughtRecord: ThoughtRecord = {
                    thinkingType: type,
                    content: `Test ${type}`,
                    timestamp: new Date().toISOString(),
                    thoughtId: `thought_${type}`
                };
                thoughtRecordManager.recordThought(`${specialistId}_${type}`, thoughtRecord);
                
                const formatted = thoughtRecordManager.getFormattedThoughts(`${specialistId}_${type}`);
                expect(formatted).toContain(expectedEmojis[index]);
            });
        });

        it('应该正确格式化字符串类型的思考内容', () => {
            const specialistId = 'test_specialist';
            const thoughtRecord: ThoughtRecord = {
                thinkingType: 'analysis',
                content: 'This is a simple string content',
                timestamp: new Date().toISOString(),
                thoughtId: 'test_thought'
            };

            thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            expect(formatted).toContain('This is a simple string content');
        });

        it('应该正确格式化对象类型的思考内容', () => {
            const specialistId = 'test_specialist';
            const thoughtRecord: ThoughtRecord = {
                thinkingType: 'planning',
                content: {
                    problem: 'Test problem',
                    solution: 'Test solution',
                    approach: 'Test approach'
                },
                timestamp: new Date().toISOString(),
                thoughtId: 'test_thought'
            };

            thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            // 应该包含emoji和格式化的键值对
            expect(formatted).toContain('❓ Problem: Test problem');
            expect(formatted).toContain('💡 Solution: Test solution');
            expect(formatted).toContain('🛤️ Approach: Test approach');
        });

        it('应该正确处理nextSteps数组', () => {
            const specialistId = 'test_specialist';
            const thoughtRecord: ThoughtRecord = {
                thinkingType: 'derivation',
                content: 'Test content',
                nextSteps: ['First step', 'Second step', 'Third step'],
                timestamp: new Date().toISOString(),
                thoughtId: 'test_thought'
            };

            thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            expect(formatted).toContain('First step → Second step → Third step');
        });

        it('应该正确处理空的nextSteps', () => {
            const specialistId = 'test_specialist';
            const thoughtRecord: ThoughtRecord = {
                thinkingType: 'reflection',
                content: 'Test content',
                nextSteps: [],
                timestamp: new Date().toISOString(),
                thoughtId: 'test_thought'
            };

            thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            expect(formatted).toContain('No specific next steps defined');
        });

        it('应该包含重要的指导信息', () => {
            const specialistId = 'test_specialist';
            const thoughtRecord: ThoughtRecord = {
                thinkingType: 'synthesis',
                content: 'Test content',
                timestamp: new Date().toISOString(),
                thoughtId: 'test_thought'
            };

            thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            expect(formatted).toContain('⚠️ **CRITICAL GUIDANCE**');
            expect(formatted).toContain('🔄 **Continue** your work based on the above thoughts');
            expect(formatted).toContain('🚫 **Avoid** repeating analysis');
            expect(formatted).toContain('🎯 **Focus** on the next actions');
            expect(formatted).toContain('💡 **Build upon** your previous insights');
        });
    });

    describe('生命周期管理测试', () => {
        it('应该能清空特定specialist的思考记录', () => {
            const specialist1 = 'specialist_1';
            const specialist2 = 'specialist_2';
            
            // 为两个specialist添加思考记录
            const thought1: ThoughtRecord = {
                thinkingType: 'planning',
                content: 'Specialist 1 thought',
                timestamp: new Date().toISOString(),
                thoughtId: 'thought_1'
            };
            
            const thought2: ThoughtRecord = {
                thinkingType: 'analysis',
                content: 'Specialist 2 thought',
                timestamp: new Date().toISOString(),
                thoughtId: 'thought_2'
            };

            thoughtRecordManager.recordThought(specialist1, thought1);
            thoughtRecordManager.recordThought(specialist2, thought2);
            
            // 清空specialist1的记录
            thoughtRecordManager.clearThoughts(specialist1);
            
            // specialist1应该没有记录，specialist2应该还有
            expect(thoughtRecordManager.getThoughtCount(specialist1)).toBe(0);
            expect(thoughtRecordManager.getThoughtCount(specialist2)).toBe(1);
        });

        it('应该返回正确的统计信息', () => {
            const specialist1 = 'specialist_1';
            const specialist2 = 'specialist_2';
            
            // 添加不同数量的思考记录
            for (let i = 0; i < 3; i++) {
                const thought: ThoughtRecord = {
                    thinkingType: 'planning',
                    content: `Thought ${i}`,
                    timestamp: new Date().toISOString(),
                    thoughtId: `thought_${i}`
                };
                thoughtRecordManager.recordThought(specialist1, thought);
            }
            
            for (let i = 0; i < 5; i++) {
                const thought: ThoughtRecord = {
                    thinkingType: 'analysis',
                    content: `Thought ${i}`,
                    timestamp: new Date().toISOString(),
                    thoughtId: `thought_${i}`
                };
                thoughtRecordManager.recordThought(specialist2, thought);
            }
            
            const stats = thoughtRecordManager.getAllThoughtStats();
            expect(stats[specialist1]).toBe(3);
            expect(stats[specialist2]).toBe(5);
        });
    });

    describe('边界条件测试', () => {
        it('应该正确处理没有思考记录的specialist', () => {
            const specialistId = 'empty_specialist';
            
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(0);
            expect(thoughtRecordManager.getFormattedThoughts(specialistId)).toBe('');
        });

        it('应该正确处理没有context的思考记录', () => {
            const specialistId = 'test_specialist';
            const thoughtRecord: ThoughtRecord = {
                thinkingType: 'planning',
                content: 'Test content',
                // context: undefined
                timestamp: new Date().toISOString(),
                thoughtId: 'test_thought'
            };

            thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            expect(formatted).toContain('No specific context provided');
        });

        it('应该正确处理复杂的内容对象（超过3个字段）', () => {
            const specialistId = 'test_specialist';
            
            // 添加多条记录，确保第1条记录（最早，index=3）会被视为非最新记录
            for (let i = 0; i < 4; i++) {
                const thoughtRecord: ThoughtRecord = {
                    thinkingType: 'analysis',
                    content: i === 0 ? {
                        field1: 'Value 1',
                        field2: 'Value 2',
                        field3: 'Value 3',
                        field4: 'Value 4',
                        field5: 'Value 5'
                    } : { simpleField: `Simple content ${i}` },
                    timestamp: new Date(Date.now() - (3-i) * 1000).toISOString(), // 确保时间顺序：第1条最早
                    thoughtId: `test_thought_${i}`
                };
                thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            }
            
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            // 第4条记录（index=3，非最新）应该显示字段截断
            expect(formatted).toContain('... (2 more items)');
        });

        it('应该正确处理长文本内容（自动截断）', () => {
            const specialistId = 'test_specialist';
            const longText = 'A'.repeat(150); // 超过100字符的长文本
            
            // 添加多条记录，确保第1条记录（最早，index=3）会被视为非最新记录
            for (let i = 0; i < 4; i++) {
                const thoughtRecord: ThoughtRecord = {
                    thinkingType: 'synthesis',
                    content: i === 0 ? { description: longText } : { description: 'Short text' },
                    timestamp: new Date(Date.now() - (3-i) * 1000).toISOString(), // 确保时间顺序：第1条最早
                    thoughtId: `test_thought_${i}`
                };
                thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            }
            
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            // 第4条记录（index=3，非最新）的长文本应该被截断
            expect(formatted).toContain('...');
            expect(formatted).not.toContain('A'.repeat(150));
        });
    });

    describe('时间处理测试', () => {
        it('应该正确显示相对时间', () => {
            const specialistId = 'test_specialist';
            
            // 创建一个刚刚的时间戳
            const now = new Date();
            const justNow = new Date(now.getTime() - 30 * 1000); // 30秒前
            
            const thoughtRecord: ThoughtRecord = {
                thinkingType: 'planning',
                content: 'Test content',
                timestamp: justNow.toISOString(),
                thoughtId: 'test_thought'
            };

            thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            expect(formatted).toContain('Just now');
        });
    });
});
