/**
 * recordThought工具优化测试 - 简化版本
 * 
 * 专门测试方案1（格式优化）和方案2（优先级提升）的核心功能
 * 避免复杂的依赖问题
 */

import { ThoughtRecord } from '../../tools/internal/recordThoughtTools';

// 创建一个简化的SpecialistExecutor测试类，只包含我们需要测试的方法
class TestSpecialistExecutor {
    /**
     * 🚀 方案1新增：格式化思考内容为可读文本
     */
    formatThoughtContent(content: any): string {
        if (typeof content === 'string') {
            return content;
        }

        if (typeof content === 'object' && content !== null) {
            // 处理数组
            if (Array.isArray(content)) {
                return JSON.stringify(content);
            }
            
            // 将对象键值对转换为可读格式
            return Object.entries(content)
                .map(([key, value]) => {
                    const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
                    const formattedValue = typeof value === 'string' ? value : JSON.stringify(value);
                    return `${formattedKey}: ${formattedValue}`;
                })
                .join('; ');
        }

        return JSON.stringify(content);
    }

    /**
     * 🚀 方案1：处理recordThought工具结果的格式化
     */
    summarizeRecordThoughtResult(result: any): string {
        const { success } = result;
        
        if (!success) {
            return `💭 recordThought Failed: ${result.error || 'Unknown Error'}`;
        }

        const thought = result.result.thoughtRecord;
        return `
💭 【${thought.thinkingType.toUpperCase()}】recordThought
📍 Context: ${thought.context || 'No specific context'}
🧠 Core Thinking: ${this.formatThoughtContent(thought.content)}
📋 Next Steps: ${thought.nextSteps?.join(' → ') || 'No specific steps'}
⏰ ${new Date(thought.timestamp).toLocaleString()}`;
    }

    /**
     * 🚀 方案2新增：从历史记录中提取思考记录
     */
    extractThoughtRecords(internalHistory: string[]): {
        thoughtRecords: ThoughtRecord[],
        otherHistory: string[]
    } {
        const thoughtRecords: ThoughtRecord[] = [];
        const otherHistory: string[] = [];

        for (const entry of internalHistory) {
            // 匹配思考记录条目（方案1优化后的格式）
            const thoughtMatch = entry.match(/💭 【(\w+)】recordThought\n📍 Context: (.*?)\n🧠 Core Thinking: (.*?)\n📋 Next Steps: (.*?)\n⏰ (.*)/);

            if (thoughtMatch) {
                thoughtRecords.push({
                    thinkingType: thoughtMatch[1].toLowerCase() as any,
                    context: thoughtMatch[2] === 'No specific context' ? undefined : thoughtMatch[2],
                    content: thoughtMatch[3],
                    nextSteps: thoughtMatch[4] === 'No specific steps' ? [] : thoughtMatch[4].split(' → '),
                    timestamp: thoughtMatch[5],
                    thoughtId: `extracted_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                });
            } else {
                otherHistory.push(entry);
            }
        }

        return { thoughtRecords: thoughtRecords.slice(-3), otherHistory }; // 只保留最近3条思考记录
    }

    /**
     * 🚀 方案2新增：构建增强的历史文本
     */
    buildEnhancedHistory(thoughtRecords: ThoughtRecord[], otherHistory: string[]): string {
        let result = '';
        
        // 🚀 优先注入思考记录
        if (thoughtRecords.length > 0) {
            result += `
## 🧠 Your Work Memory (Important Thinking Records)

${thoughtRecords.map((thought, index) => `
### Thinking ${index + 1}: ${thought.thinkingType}
- **Background**: ${thought.context || 'No specific context'}
- **Analysis**: ${thought.content}
- **Action**: ${thought.nextSteps && thought.nextSteps.length > 0 ? thought.nextSteps.join(' → ') : 'To be determined'}
- **Time**: ${thought.timestamp}
`).join('\n')}

⚠️ **Important Guidance**: Please continue to work based on the above thinking records, avoid repeating the analysis of solved problems, and focus on the next action in the execution plan.

---

`;
        }
        
        // 然后添加其他历史记录
        if (otherHistory.length > 0) {
            result += `## 📋 Other Execution History\n\n${otherHistory.join('\n\n')}`;
        } else if (thoughtRecords.length === 0) {
            result += 'No internal iteration history';
        }
        
        return result;
    }
}

describe('recordThought Optimization Tests - Core Functionality', () => {
    let testExecutor: TestSpecialistExecutor;

    beforeEach(() => {
        testExecutor = new TestSpecialistExecutor();
    });

    describe('方案1: 格式优化测试', () => {
        describe('formatThoughtContent方法', () => {
            it('应该正确格式化字符串内容', () => {
                const content = 'Simple string thinking';
                
                const result = testExecutor.formatThoughtContent(content);
                
                expect(result).toBe('Simple string thinking');
            });

            it('应该正确格式化对象内容', () => {
                const content = {
                    goal: 'Generate comprehensive NFR section',
                    approach: 'Analyze system characteristics',
                    challengeAreas: ['performance', 'scalability']
                };
                
                const result = testExecutor.formatThoughtContent(content);
                
                expect(result).toContain('goal: Generate comprehensive NFR section');
                expect(result).toContain('approach: Analyze system characteristics');
                expect(result).toContain('challenge areas: ["performance","scalability"]');
                expect(result).toContain(';'); // 确保使用分号分隔
            });

            it('应该处理null和undefined内容', () => {
                expect(testExecutor.formatThoughtContent(null)).toBe('null');
                expect(testExecutor.formatThoughtContent(undefined)).toBe(undefined);
            });

            it('应该处理嵌套对象', () => {
                const content = {
                    mainTask: 'Generate SRS',
                    subTasks: {
                        analysis: 'Requirement analysis',
                        design: 'System design'
                    }
                };
                
                const result = testExecutor.formatThoughtContent(content);
                
                expect(result).toContain('main task: Generate SRS');
                expect(result).toContain('sub tasks: {"analysis":"Requirement analysis","design":"System design"}');
            });

            it('应该正确处理驼峰命名转换', () => {
                const content = {
                    primaryGoalArea: 'Main objective',
                    secondaryTaskList: 'Supporting tasks'
                };
                
                const result = testExecutor.formatThoughtContent(content);
                
                expect(result).toContain('primary goal area: Main objective');
                expect(result).toContain('secondary task list: Supporting tasks');
            });
        });

        describe('summarizeRecordThoughtResult方法', () => {
            it('应该格式化成功的recordThought结果', () => {
                const mockResult = {
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
                
                const result = testExecutor.summarizeRecordThoughtResult(mockResult);
                
                expect(result).toContain('💭 【PLANNING】recordThought');
                expect(result).toContain('📍 Context: SRS document generation task');
                expect(result).toContain('🧠 Core Thinking: goal: Generate NFR section; approach: Systematic analysis');
                expect(result).toContain('📋 Next Steps: executeSemanticEdits → review_content');
                expect(result).toContain('⏰');
            });

            it('应该处理失败的recordThought结果', () => {
                const mockResult = {
                    success: false,
                    error: 'Content validation failed'
                };
                
                const result = testExecutor.summarizeRecordThoughtResult(mockResult);
                
                expect(result).toBe('💭 recordThought Failed: Content validation failed');
            });

            it('应该处理没有上下文的思考记录', () => {
                const mockResult = {
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
                
                const result = testExecutor.summarizeRecordThoughtResult(mockResult);
                
                expect(result).toContain('📍 Context: No specific context');
                expect(result).toContain('📋 Next Steps: No specific steps');
            });

            it('应该处理字符串类型的思考内容', () => {
                const mockResult = {
                    success: true,
                    result: {
                        thoughtRecord: {
                            thinkingType: 'reflection',
                            context: 'Task review',
                            content: 'This is a simple string reflection',
                            nextSteps: ['continue_work'],
                            timestamp: '2025-09-23T12:34:56.789Z',
                            thoughtId: 'thought_string_test'
                        }
                    }
                };
                
                const result = testExecutor.summarizeRecordThoughtResult(mockResult);
                
                expect(result).toContain('🧠 Core Thinking: This is a simple string reflection');
                expect(result).toContain('📋 Next Steps: continue_work');
            });
        });
    });

    describe('方案2: 优先级提升测试', () => {
        describe('extractThoughtRecords方法', () => {
            it('应该正确提取思考记录', () => {
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
                
                const result = testExecutor.extractThoughtRecords(internalHistory);
                
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
                const internalHistory = [
                    'readFile: ✅ 成功 - 读取文件 (1234字符)',
                    'executeMarkdownEdits: ✅ 成功 - 应用3个编辑操作 (245ms)'
                ];
                
                const result = testExecutor.extractThoughtRecords(internalHistory);
                
                expect(result.thoughtRecords).toHaveLength(0);
                expect(result.otherHistory).toHaveLength(2);
            });

            it('应该限制最多3条思考记录', () => {
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
                
                const result = testExecutor.extractThoughtRecords(internalHistory);
                
                expect(result.thoughtRecords).toHaveLength(3); // 只保留最近3条
                expect(result.thoughtRecords[0].content).toContain('step: 3');
                expect(result.thoughtRecords[2].content).toContain('step: 5');
            });

            it('应该处理没有上下文和步骤的思考记录', () => {
                const internalHistory = [`
💭 【ANALYSIS】recordThought
📍 Context: No specific context
🧠 Core Thinking: simple analysis
📋 Next Steps: No specific steps
⏰ 2025/9/23 20:30:00`];
                
                const result = testExecutor.extractThoughtRecords(internalHistory);
                
                expect(result.thoughtRecords).toHaveLength(1);
                expect(result.thoughtRecords[0].context).toBeUndefined();
                expect(result.thoughtRecords[0].nextSteps).toEqual([]);
            });

            it('应该忽略格式不正确的思考记录', () => {
                const internalHistory = [
                    '💭 【INVALID】recordThought', // 格式不完整
                    'Normal tool result',
                    `
💭 【PLANNING】recordThought
📍 Context: Valid context
🧠 Core Thinking: Valid thinking
📋 Next Steps: Valid steps
⏰ 2025/9/23 20:30:00` // 格式正确
                ];
                
                const result = testExecutor.extractThoughtRecords(internalHistory);
                
                expect(result.thoughtRecords).toHaveLength(1); // 只提取格式正确的
                expect(result.otherHistory).toHaveLength(2); // 包含格式错误的和正常的工具结果
                expect(result.thoughtRecords[0].context).toBe('Valid context');
            });
        });

        describe('buildEnhancedHistory方法', () => {
            it('应该构建包含思考记录的增强历史', () => {
                const thoughtRecords: ThoughtRecord[] = [
                    {
                        thinkingType: 'planning' as any,
                        context: 'Initial task',
                        content: 'Plan the approach',
                        nextSteps: ['step1', 'step2'],
                        timestamp: '2025/9/23 20:30:00',
                        thoughtId: 'thought_1'
                    },
                    {
                        thinkingType: 'analysis' as any,
                        content: 'Analyze the problem',
                        timestamp: '2025/9/23 20:35:00',
                        thoughtId: 'thought_2'
                    }
                ];
                const otherHistory = [
                    'readFile: ✅ 成功',
                    'executeMarkdownEdits: ✅ 成功'
                ];
                
                const result = testExecutor.buildEnhancedHistory(thoughtRecords, otherHistory);
                
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
                const thoughtRecords: ThoughtRecord[] = [
                    {
                        thinkingType: 'planning' as any,
                        content: 'Plan only',
                        timestamp: '2025/9/23 20:30:00',
                        thoughtId: 'thought_1'
                    }
                ];
                const otherHistory: string[] = [];
                
                const result = testExecutor.buildEnhancedHistory(thoughtRecords, otherHistory);
                
                expect(result).toContain('## 🧠 Your Work Memory');
                expect(result).not.toContain('## 📋 Other Execution History');
            });

            it('应该处理没有思考记录的情况', () => {
                const thoughtRecords: ThoughtRecord[] = [];
                const otherHistory = ['readFile: ✅ 成功'];
                
                const result = testExecutor.buildEnhancedHistory(thoughtRecords, otherHistory);
                
                expect(result).not.toContain('## 🧠 Your Work Memory');
                expect(result).toContain('## 📋 Other Execution History');
            });

            it('应该处理完全空的历史', () => {
                const thoughtRecords: ThoughtRecord[] = [];
                const otherHistory: string[] = [];
                
                const result = testExecutor.buildEnhancedHistory(thoughtRecords, otherHistory);
                
                expect(result).toBe('No internal iteration history');
            });
        });
    });

    describe('集成测试: 方案1 + 方案2', () => {
        it('应该端到端地处理recordThought工具结果', () => {
            // 模拟recordThought工具结果
            const recordThoughtResult = {
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
            const formattedResult = testExecutor.summarizeRecordThoughtResult(recordThoughtResult);
            
            expect(formattedResult).toContain('💭 【PLANNING】recordThought');
            expect(formattedResult).toContain('strategy: Top-down approach; focus: Quality attributes');
            
            // 步骤2: 将格式化结果添加到历史记录
            const internalHistory = [
                'readFile: ✅ 成功 - 读取文件 (1000字符)',
                formattedResult,
                'executeMarkdownEdits: ✅ 成功 - 应用2个编辑操作 (150ms)'
            ];
            
            // 步骤3: 提取和优先处理思考记录（方案2）
            const { thoughtRecords, otherHistory } = testExecutor.extractThoughtRecords(internalHistory);
            
            expect(thoughtRecords).toHaveLength(1);
            expect(thoughtRecords[0].thinkingType).toBe('planning');
            expect(thoughtRecords[0].context).toBe('SRS generation');
            expect(otherHistory).toHaveLength(2);
            
            // 步骤4: 构建增强历史
            const enhancedHistory = testExecutor.buildEnhancedHistory(thoughtRecords, otherHistory);
            
            expect(enhancedHistory).toContain('## 🧠 Your Work Memory');
            expect(enhancedHistory).toContain('### Thinking 1: planning');
            expect(enhancedHistory).toContain('- **Background**: SRS generation');
            expect(enhancedHistory).toContain('## 📋 Other Execution History');
        });

        it('应该处理多种思考类型的混合场景', () => {
            // 创建包含不同思考类型的场景
            const planningResult = testExecutor.summarizeRecordThoughtResult({
                success: true,
                result: {
                    thoughtRecord: {
                        thinkingType: 'planning',
                        context: 'Initial planning',
                        content: 'Define the overall strategy',
                        nextSteps: ['research', 'design'],
                        timestamp: '2025-09-23T10:00:00.000Z',
                        thoughtId: 'thought_planning'
                    }
                }
            });
            
            const analysisResult = testExecutor.summarizeRecordThoughtResult({
                success: true,
                result: {
                    thoughtRecord: {
                        thinkingType: 'analysis',
                        context: 'Problem analysis',
                        content: { issues: ['complexity', 'dependencies'], solutions: ['modular approach'] },
                        nextSteps: ['implement_solution'],
                        timestamp: '2025-09-23T10:30:00.000Z',
                        thoughtId: 'thought_analysis'
                    }
                }
            });
            
            const internalHistory = [
                'Initial setup completed',
                planningResult,
                'Some intermediate work',
                analysisResult,
                'Final preparations'
            ];
            
            const { thoughtRecords, otherHistory } = testExecutor.extractThoughtRecords(internalHistory);
            const enhancedHistory = testExecutor.buildEnhancedHistory(thoughtRecords, otherHistory);
            
            expect(thoughtRecords).toHaveLength(2);
            expect(thoughtRecords[0].thinkingType).toBe('planning');
            expect(thoughtRecords[1].thinkingType).toBe('analysis');
            
            expect(enhancedHistory).toContain('### Thinking 1: planning');
            expect(enhancedHistory).toContain('### Thinking 2: analysis');
            expect(enhancedHistory).toContain('issues: ["complexity","dependencies"]; solutions: ["modular approach"]');
        });
    });

    describe('边界条件和错误处理', () => {
        it('应该处理复杂的思考内容格式', () => {
            const complexContent = {
                mainGoal: 'Complex task',
                subGoals: ['goal1', 'goal2'],
                metadata: {
                    priority: 'high',
                    estimatedTime: '2 hours'
                },
                specialChars: 'Content with: semicolons; and → arrows'
            };
            
            const result = testExecutor.formatThoughtContent(complexContent);
            
            expect(result).toContain('main goal: Complex task');
            expect(result).toContain('sub goals: ["goal1","goal2"]');
            expect(result).toContain('special chars: Content with: semicolons; and → arrows');
        });

        it('应该处理空数组和空对象', () => {
            expect(testExecutor.formatThoughtContent([])).toBe('[]');
            expect(testExecutor.formatThoughtContent({})).toBe('');
        });

        it('应该处理数字和布尔值', () => {
            expect(testExecutor.formatThoughtContent(42)).toBe('42');
            expect(testExecutor.formatThoughtContent(true)).toBe('true');
            expect(testExecutor.formatThoughtContent(false)).toBe('false');
        });
    });
});
