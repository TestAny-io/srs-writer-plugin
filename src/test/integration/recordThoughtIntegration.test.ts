/**
 * recordThought工具优化集成测试
 * 
 * 测试真实的recordThought工具调用和SpecialistExecutor处理
 */

import { recordThought } from '../../tools/internal/recordThoughtTools';

describe('recordThought Integration Tests', () => {
    describe('recordThought工具调用', () => {
        it('应该成功记录planning类型的思考', async () => {
            const params = {
                thinkingType: 'planning' as const,
                content: {
                    goal: 'Generate comprehensive SRS document',
                    approach: 'Systematic analysis of requirements',
                    challenges: ['complexity', 'time constraints']
                },
                context: 'Initial SRS generation task',
                nextSteps: ['readFile', 'executeSemanticEdits', 'review_content']
            };
            
            const result = await recordThought(params);
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord).toBeDefined();
            expect(result.thoughtRecord.thinkingType).toBe('planning');
            expect(result.thoughtRecord.context).toBe('Initial SRS generation task');
            expect(result.thoughtRecord.nextSteps).toEqual(['readFile', 'executeSemanticEdits', 'review_content']);
            expect(result.thoughtRecord.timestamp).toBeDefined();
            expect(result.thoughtRecord.thoughtId).toMatch(/^thought_\d+_\w+$/);
        });

        it('应该成功记录analysis类型的思考', async () => {
            const params = {
                thinkingType: 'analysis' as const,
                content: 'Analyzed the current system architecture and identified key improvement areas',
                context: 'System architecture review',
                nextSteps: ['document_findings', 'propose_solutions']
            };
            
            const result = await recordThought(params);
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord.thinkingType).toBe('analysis');
            expect(result.thoughtRecord.content).toBe('Analyzed the current system architecture and identified key improvement areas');
        });

        it('应该成功记录reflection类型的思考', async () => {
            const params = {
                thinkingType: 'reflection' as const,
                content: {
                    completed_tasks: ['requirement_analysis', 'initial_draft'],
                    quality_assessment: 'Good structure but needs more detail',
                    improvement_areas: ['add_metrics', 'clarify_constraints']
                },
                nextSteps: ['refine_content', 'add_examples']
            };
            
            const result = await recordThought(params);
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord.thinkingType).toBe('reflection');
            expect(result.thoughtRecord.content).toEqual({
                completed_tasks: ['requirement_analysis', 'initial_draft'],
                quality_assessment: 'Good structure but needs more detail',
                improvement_areas: ['add_metrics', 'clarify_constraints']
            });
        });

        it('应该处理最小参数集合', async () => {
            const params = {
                thinkingType: 'synthesis' as const,
                content: 'Simple synthesis thinking'
            };
            
            const result = await recordThought(params);
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord.thinkingType).toBe('synthesis');
            expect(result.thoughtRecord.content).toBe('Simple synthesis thinking');
            expect(result.thoughtRecord.context).toBeUndefined();
            expect(result.thoughtRecord.nextSteps).toBeUndefined();
        });

        it('应该处理derivation类型的复杂思考', async () => {
            const params = {
                thinkingType: 'derivation' as const,
                content: {
                    source_requirements: ['REQ-001', 'REQ-002'],
                    derived_constraints: ['PERF-001', 'SEC-001'],
                    reasoning: 'Based on performance and security requirements',
                    impact_analysis: {
                        performance: 'medium',
                        security: 'high',
                        maintainability: 'low'
                    }
                },
                context: 'Non-functional requirements derivation',
                nextSteps: ['validate_constraints', 'update_specifications', 'review_with_stakeholders']
            };
            
            const result = await recordThought(params);
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord.thinkingType).toBe('derivation');
            expect(result.thoughtRecord.content.source_requirements).toEqual(['REQ-001', 'REQ-002']);
            expect(result.thoughtRecord.content.impact_analysis.security).toBe('high');
            expect(result.thoughtRecord.nextSteps).toHaveLength(3);
        });
    });

    describe('错误处理', () => {
        it('应该接受任何思考类型（当前实现）', async () => {
            const params = {
                thinkingType: 'invalid_type' as any,
                content: 'Some content'
            };
            
            // 当前实现不验证思考类型，只是记录
            const result = await recordThought(params);
            expect(result.success).toBe(true);
            expect(result.thoughtRecord.thinkingType).toBe('invalid_type');
        });

        it('应该拒绝空的content', async () => {
            const params = {
                thinkingType: 'planning' as const,
                content: null as any
            };
            
            await expect(recordThought(params)).rejects.toThrow('content is required');
        });

        it('应该拒绝无效的content类型', async () => {
            const params = {
                thinkingType: 'planning' as const,
                content: 123 as any // 数字不是有效的content类型
            };
            
            await expect(recordThought(params)).rejects.toThrow('content is required and must be an object or string');
        });
    });

    describe('时间戳和ID生成', () => {
        it('应该生成唯一的思考ID', async () => {
            const params = {
                thinkingType: 'planning' as const,
                content: 'Test content'
            };
            
            const result1 = await recordThought(params);
            const result2 = await recordThought(params);
            
            expect(result1.thoughtRecord.thoughtId).not.toBe(result2.thoughtRecord.thoughtId);
        });

        it('应该生成有效的ISO时间戳', async () => {
            const params = {
                thinkingType: 'planning' as const,
                content: 'Test content'
            };
            
            const beforeCall = new Date().toISOString();
            const result = await recordThought(params);
            const afterCall = new Date().toISOString();
            
            expect(result.thoughtRecord.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
            expect(result.thoughtRecord.timestamp >= beforeCall).toBe(true);
            expect(result.thoughtRecord.timestamp <= afterCall).toBe(true);
        });
    });

    describe('复杂场景测试', () => {
        it('应该处理包含特殊字符的内容', async () => {
            const params = {
                thinkingType: 'analysis' as const,
                content: {
                    description: 'Analysis with special chars: @#$%^&*()[]{}|\\:";\'<>?,./~`',
                    symbols: '→ ← ↑ ↓ ⚠️ ✅ ❌ 💭 📍 🧠 📋 ⏰',
                    unicode: '中文测试 日本語テスト العربية тест'
                },
                context: 'Special character handling test',
                nextSteps: ['validate → process → complete']
            };
            
            const result = await recordThought(params);
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord.content.symbols).toContain('→');
            expect(result.thoughtRecord.content.unicode).toContain('中文测试');
            expect(result.thoughtRecord.nextSteps![0]).toContain('→');
        });

        it('应该处理深度嵌套的对象结构', async () => {
            const params = {
                thinkingType: 'synthesis' as const,
                content: {
                    level1: {
                        level2: {
                            level3: {
                                level4: {
                                    deepValue: 'Found at level 4',
                                    array: [1, 2, { nested: 'value' }]
                                }
                            }
                        }
                    },
                    metadata: {
                        complexity: 'high',
                        processing_time: '2.5s',
                        memory_usage: '45MB'
                    }
                },
                context: 'Deep nesting test',
                nextSteps: ['extract_key_info', 'simplify_structure']
            };
            
            const result = await recordThought(params);
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord.content.level1.level2.level3.level4.deepValue).toBe('Found at level 4');
            expect(result.thoughtRecord.content.metadata.complexity).toBe('high');
        });

        it('应该处理大量的nextSteps', async () => {
            const manySteps = Array.from({ length: 20 }, (_, i) => `step_${i + 1}`);
            
            const params = {
                thinkingType: 'planning' as const,
                content: 'Complex multi-step plan',
                context: 'Large workflow planning',
                nextSteps: manySteps
            };
            
            const result = await recordThought(params);
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord.nextSteps).toHaveLength(20);
            expect(result.thoughtRecord.nextSteps![0]).toBe('step_1');
            expect(result.thoughtRecord.nextSteps![19]).toBe('step_20');
        });
    });

    describe('性能测试', () => {
        it('应该在合理时间内完成记录', async () => {
            const params = {
                thinkingType: 'planning' as const,
                content: 'Performance test content'
            };
            
            const startTime = Date.now();
            const result = await recordThought(params);
            const endTime = Date.now();
            
            expect(result.success).toBe(true);
            expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
        });

        it('应该能处理大量并发调用', async () => {
            const promises = Array.from({ length: 10 }, (_, i) => 
                recordThought({
                    thinkingType: 'analysis' as const,
                    content: `Concurrent test ${i}`,
                    context: `Context ${i}`
                })
            );
            
            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(10);
            results.forEach((result, index) => {
                expect(result.success).toBe(true);
                expect(result.thoughtRecord.content).toBe(`Concurrent test ${index}`);
                expect(result.thoughtRecord.context).toBe(`Context ${index}`);
            });
            
            // 确保所有ID都是唯一的
            const ids = results.map(r => r.thoughtRecord.thoughtId);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(10);
        });
    });
});
