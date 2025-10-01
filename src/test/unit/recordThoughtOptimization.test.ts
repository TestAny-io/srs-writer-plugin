/**
 * recordThought工具优化测试
 * 
 * 测试方案1（格式优化）和方案2（优先级提升）的功能
 */

import { SpecialistExecutor } from '../../core/specialistExecutor';
import { ThoughtRecord } from '../../tools/internal/recordThoughtTools';

describe('recordThought Optimization Tests', () => {
    let specialistExecutor: SpecialistExecutor;

    beforeEach(() => {
        specialistExecutor = new SpecialistExecutor();
    });

    describe('方案1: 格式优化测试', () => {
        describe('formatThoughtContent方法', () => {
            it('应该正确格式化字符串内容', () => {
                const executor = specialistExecutor as any;
                const content = 'Simple string thinking';
                
                const result = executor.formatThoughtContent(content);
                
                expect(result).toBe('Simple string thinking');
            });

            it('应该正确格式化对象内容', () => {
                const executor = specialistExecutor as any;
                const content = {
                    goal: 'Generate comprehensive NFR section',
                    approach: 'Analyze system characteristics',
                    challengeAreas: ['performance', 'scalability']
                };
                
                const result = executor.formatThoughtContent(content);
                
                expect(result).toContain('goal: Generate comprehensive NFR section');
                expect(result).toContain('approach: Analyze system characteristics');
                expect(result).toContain('challenge areas: ["performance","scalability"]');
            });

            it('应该处理null和undefined内容', () => {
                const executor = specialistExecutor as any;
                
                expect(executor.formatThoughtContent(null)).toBe('null');
                expect(executor.formatThoughtContent(undefined)).toBe('undefined');
            });

            it('应该处理嵌套对象', () => {
                const executor = specialistExecutor as any;
                const content = {
                    mainTask: 'Generate SRS',
                    subTasks: {
                        analysis: 'Requirement analysis',
                        design: 'System design'
                    }
                };
                
                const result = executor.formatThoughtContent(content);
                
                expect(result).toContain('main task: Generate SRS');
                expect(result).toContain('sub tasks: {"analysis":"Requirement analysis","design":"System design"}');
            });
        });

        describe('summarizeToolResult方法 - recordThought处理', () => {
            it('应该格式化成功的recordThought结果', () => {
                const executor = specialistExecutor as any;
                const mockResult = {
                    toolName: 'recordThought',
                    success: true,
                    result: {
                        thoughtRecord: {
                            thinkingType: 'planning',
                            context: 'SRS document generation task',
                            content: {
                                goal: 'Generate NFR section',
                                approach: 'Systematic analysis'
                            },
                            nextSteps: ['executeSemanticEdits', 'review_content'],
                            timestamp: '2025-09-23T12:34:56.789Z',
                            thoughtId: 'thought_123_abc'
                        }
                    }
                };
                
                const result = executor.summarizeToolResult(mockResult);
                
                expect(result).toContain('💭 【PLANNING】recordThought');
                expect(result).toContain('📍 Context: SRS document generation task');
                expect(result).toContain('🧠 Core Thinking: goal: Generate NFR section; approach: Systematic analysis');
                expect(result).toContain('📋 Next Steps: executeSemanticEdits → review_content');
                expect(result).toContain('⏰');
            });

            it('应该处理失败的recordThought结果', () => {
                const executor = specialistExecutor as any;
                const mockResult = {
                    toolName: 'recordThought',
                    success: false,
                    error: 'Content validation failed'
                };
                
                const result = executor.summarizeToolResult(mockResult);
                
                expect(result).toBe('💭 recordThought Failed: Content validation failed');
            });

            it('应该处理没有上下文的思考记录', () => {
                const executor = specialistExecutor as any;
                const mockResult = {
                    toolName: 'recordThought',
                    success: true,
                    result: {
                        thoughtRecord: {
                            thinkingType: 'analysis',
                            content: 'Simple analysis',
                            timestamp: '2025-09-23T12:34:56.789Z',
                            thoughtId: 'thought_456_def'
                        }
                    }
                };
                
                const result = executor.summarizeToolResult(mockResult);
                
                expect(result).toContain('📍 Context: No specific context');
                expect(result).toContain('📋 Next Steps: No specific steps');
            });
        });
    });

    describe('方案2: 优先级提升测试', () => {
        describe('extractThoughtRecords方法', () => {
            it('应该正确提取思考记录', () => {
                const executor = specialistExecutor as any;
                const internalHistory = [
                    'readFile: ✅ 成功 - 读取文件 (1234字符)',
                    `
💭 【PLANNING】recordThought
📍 Context: Initial SRS generation
🧠 Core Thinking: goal: Generate NFR section; approach: Systematic analysis
📋 Next Steps: readFile → executeSemanticEdits
⏰ 2025/9/23 20:30:00`,
                    'executeMarkdownEdits: ✅ 成功 - 应用3个编辑操作 (245ms)',
                    `
💭 【REFLECTION】recordThought
📍 Context: Content review
🧠 Core Thinking: quality: Good structure; improvements: Add metrics
📋 Next Steps: refine_content → validate
⏰ 2025/9/23 20:35:00`
                ];
                
                const result = executor.extractThoughtRecords(internalHistory);
                
                expect(result.thoughtRecords).toHaveLength(2);
                expect(result.otherHistory).toHaveLength(2);
                
                expect(result.thoughtRecords[0].thinkingType).toBe('planning');
                expect(result.thoughtRecords[0].context).toBe('Initial SRS generation');
                expect(result.thoughtRecords[0].nextSteps).toEqual(['readFile', 'executeSemanticEdits']);
                
                expect(result.thoughtRecords[1].thinkingType).toBe('reflection');
                expect(result.thoughtRecords[1].context).toBe('Content review');
                expect(result.thoughtRecords[1].nextSteps).toEqual(['refine_content', 'validate']);
            });

            it('应该处理没有思考记录的历史', () => {
                const executor = specialistExecutor as any;
                const internalHistory = [
                    'readFile: ✅ 成功 - 读取文件 (1234字符)',
                    'executeMarkdownEdits: ✅ 成功 - 应用3个编辑操作 (245ms)'
                ];
                
                const result = executor.extractThoughtRecords(internalHistory);
                
                expect(result.thoughtRecords).toHaveLength(0);
                expect(result.otherHistory).toHaveLength(2);
            });

            it('应该限制最多3条思考记录', () => {
                const executor = specialistExecutor as any;
                const internalHistory = [];
                
                // 添加5条思考记录
                for (let i = 1; i <= 5; i++) {
                    internalHistory.push(`
💭 【PLANNING】recordThought
📍 Context: Task ${i}
🧠 Core Thinking: step: ${i}
📋 Next Steps: action_${i}
⏰ 2025/9/23 20:3${i}:00`);
                }
                
                const result = executor.extractThoughtRecords(internalHistory);
                
                expect(result.thoughtRecords).toHaveLength(3); // 只保留最近3条
                expect(result.thoughtRecords[0].content).toContain('step: 3');
                expect(result.thoughtRecords[2].content).toContain('step: 5');
            });

            it('应该处理没有上下文和步骤的思考记录', () => {
                const executor = specialistExecutor as any;
                const internalHistory = [`
💭 【ANALYSIS】recordThought
📍 Context: No specific context
🧠 Core Thinking: simple analysis
📋 Next Steps: No specific steps
⏰ 2025/9/23 20:30:00`];
                
                const result = executor.extractThoughtRecords(internalHistory);
                
                expect(result.thoughtRecords).toHaveLength(1);
                expect(result.thoughtRecords[0].context).toBeUndefined();
                expect(result.thoughtRecords[0].nextSteps).toEqual([]);
            });
        });

        describe('buildEnhancedHistory方法', () => {
            it('应该构建包含思考记录的增强历史', () => {
                const executor = specialistExecutor as any;
                const thoughtRecords: ThoughtRecord[] = [
                    {
                        thinkingType: 'planning',
                        context: 'Initial task',
                        content: 'Plan the approach',
                        nextSteps: ['step1', 'step2'],
                        timestamp: '2025/9/23 20:30:00',
                        thoughtId: 'thought_1'
                    },
                    {
                        thinkingType: 'analysis',
                        content: 'Analyze the problem',
                        timestamp: '2025/9/23 20:35:00',
                        thoughtId: 'thought_2'
                    }
                ];
                const otherHistory = [
                    'readFile: ✅ 成功',
                    'executeMarkdownEdits: ✅ 成功'
                ];
                
                const result = executor.buildEnhancedHistory(thoughtRecords, otherHistory);
                
                expect(result).toContain('## 🧠 Your Work Memory (Important Thinking Records)');
                expect(result).toContain('### Thinking 1: planning');
                expect(result).toContain('- **Background**: Initial task');
                expect(result).toContain('- **Analysis**: Plan the approach');
                expect(result).toContain('- **Action**: step1 → step2');
                
                expect(result).toContain('### Thinking 2: analysis');
                expect(result).toContain('- **Background**: No specific context');
                expect(result).toContain('- **Action**: To be determined');
                
                expect(result).toContain('⚠️ **Important Guidance**');
                expect(result).toContain('## 📋 Other Execution History');
                expect(result).toContain('readFile: ✅ 成功');
            });

            it('应该处理只有思考记录没有其他历史的情况', () => {
                const executor = specialistExecutor as any;
                const thoughtRecords: ThoughtRecord[] = [
                    {
                        thinkingType: 'planning',
                        content: 'Plan only',
                        timestamp: '2025/9/23 20:30:00',
                        thoughtId: 'thought_1'
                    }
                ];
                const otherHistory: string[] = [];
                
                const result = executor.buildEnhancedHistory(thoughtRecords, otherHistory);
                
                expect(result).toContain('## 🧠 Your Work Memory');
                expect(result).not.toContain('## 📋 Other Execution History');
            });

            it('应该处理没有思考记录的情况', () => {
                const executor = specialistExecutor as any;
                const thoughtRecords: ThoughtRecord[] = [];
                const otherHistory = ['readFile: ✅ 成功'];
                
                const result = executor.buildEnhancedHistory(thoughtRecords, otherHistory);
                
                expect(result).not.toContain('## 🧠 Your Work Memory');
                expect(result).toContain('## 📋 Other Execution History');
            });

            it('应该处理完全空的历史', () => {
                const executor = specialistExecutor as any;
                const thoughtRecords: ThoughtRecord[] = [];
                const otherHistory: string[] = [];
                
                const result = executor.buildEnhancedHistory(thoughtRecords, otherHistory);
                
                expect(result).toBe('No internal iteration history');
            });
        });
    });

    describe('集成测试: 方案1 + 方案2', () => {
        it('应该端到端地处理recordThought工具结果', () => {
            const executor = specialistExecutor as any;
            
            // 模拟recordThought工具结果
            const recordThoughtResult = {
                toolName: 'recordThought',
                success: true,
                result: {
                    thoughtRecord: {
                        thinkingType: 'planning',
                        context: 'SRS generation',
                        content: {
                            strategy: 'Top-down approach',
                            focus: 'Quality attributes'
                        },
                        nextSteps: ['analyze_requirements', 'draft_sections'],
                        timestamp: '2025-09-23T12:34:56.789Z',
                        thoughtId: 'thought_integration_test'
                    }
                }
            };
            
            // 步骤1: 格式化工具结果（方案1）
            const formattedResult = executor.summarizeToolResult(recordThoughtResult);
            
            expect(formattedResult).toContain('💭 【PLANNING】recordThought');
            expect(formattedResult).toContain('strategy: Top-down approach; focus: Quality attributes');
            
            // 步骤2: 将格式化结果添加到历史记录
            const internalHistory = [
                'readFile: ✅ 成功 - 读取文件 (1000字符)',
                formattedResult,
                'executeMarkdownEdits: ✅ 成功 - 应用2个编辑操作 (150ms)'
            ];
            
            // 步骤3: 提取和优先处理思考记录（方案2）
            const { thoughtRecords, otherHistory } = executor.extractThoughtRecords(internalHistory);
            
            expect(thoughtRecords).toHaveLength(1);
            expect(thoughtRecords[0].thinkingType).toBe('planning');
            expect(thoughtRecords[0].context).toBe('SRS generation');
            expect(otherHistory).toHaveLength(2);
            
            // 步骤4: 构建增强历史
            const enhancedHistory = executor.buildEnhancedHistory(thoughtRecords, otherHistory);
            
            expect(enhancedHistory).toContain('## 🧠 Your Work Memory');
            expect(enhancedHistory).toContain('### Thinking 1: planning');
            expect(enhancedHistory).toContain('- **Background**: SRS generation');
            expect(enhancedHistory).toContain('## 📋 Other Execution History');
        });
    });

    describe('边界条件和错误处理', () => {
        it('应该处理格式不正确的思考记录', () => {
            const executor = specialistExecutor as any;
            const internalHistory = [
                '💭 【INVALID】recordThought', // 格式不完整
                'Normal tool result',
                '💭 【PLANNING】recordThought\n📍 Context: Valid\n🧠 Core Thinking: Valid\n📋 Next Steps: Valid\n⏰ Valid' // 格式正确
            ];
            
            const result = executor.extractThoughtRecords(internalHistory);
            
            expect(result.thoughtRecords).toHaveLength(1); // 只提取格式正确的
            expect(result.otherHistory).toHaveLength(2); // 包含格式错误的和正常的工具结果
        });

        it('应该处理空的工具结果', () => {
            const executor = specialistExecutor as any;
            const mockResult = {
                toolName: 'recordThought',
                success: true,
                result: null
            };
            
            expect(() => {
                executor.summarizeToolResult(mockResult);
            }).toThrow();
        });

        it('应该处理复杂的思考内容格式', () => {
            const executor = specialistExecutor as any;
            const complexContent = {
                mainGoal: 'Complex task',
                subGoals: ['goal1', 'goal2'],
                metadata: {
                    priority: 'high',
                    estimated_time: '2 hours'
                },
                specialChars: 'Content with: semicolons; and → arrows'
            };
            
            const result = executor.formatThoughtContent(complexContent);
            
            expect(result).toContain('main goal: Complex task');
            expect(result).toContain('sub goals: ["goal1","goal2"]');
            expect(result).toContain('special chars: Content with: semicolons; and → arrows');
        });
    });
});
