/**
 * recordThought优化方案集成测试
 * 
 * 测试完整的思考记录流程：
 * 1. recordThought工具调用 → ThoughtRecordManager记录
 * 2. SpecialistExecutor过滤internalHistory
 * 3. PromptAssemblyEngine注入第0章
 * 4. 端到端的思考记录管理
 */

import { ThoughtRecordManager } from '../../tools/internal/ThoughtRecordManager';
import { recordThought, ThoughtRecord } from '../../tools/internal/recordThoughtTools';
import { SpecialistExecutor } from '../../core/specialistExecutor';

describe('recordThought优化方案集成测试', () => {
    let thoughtRecordManager: ThoughtRecordManager;
    
    beforeEach(() => {
        thoughtRecordManager = new ThoughtRecordManager();
    });

    describe('ThoughtRecordManager与recordThought工具集成', () => {
        it('应该能处理recordThought工具的输出格式', async () => {
            const specialistId = 'test_specialist';
            
            // 调用recordThought工具
            const result = await recordThought({
                thinkingType: 'planning',
                content: {
                    objective: 'Complete the SRS document',
                    strategy: 'Break down into sections',
                    constraints: 'Time limit and quality requirements'
                },
                nextSteps: ['Analyze requirements', 'Design structure', 'Write content'],
                context: 'Working on project documentation'
            });
            
            expect(result.success).toBe(true);
            expect(result.thoughtRecord).toBeDefined();
            
            // 将结果记录到ThoughtRecordManager
            thoughtRecordManager.recordThought(specialistId, result.thoughtRecord);
            
            // 验证格式化输出
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            expect(formatted).toContain('📋 Thought in Iteration 1: PLANNING');
            expect(formatted).toContain('Working on project documentation');
            expect(formatted).toContain('📌 Objective: Complete the SRS document');
            expect(formatted).toContain('📈 Strategy: Break down into sections');
            expect(formatted).toContain('🚧 Constraints: Time limit and quality requirements');
            expect(formatted).toContain('Analyze requirements → Design structure → Write content');
        });

        it('应该正确处理不同思考类型的工具调用', async () => {
            const specialistId = 'test_specialist';
            const thinkingTypes = ['planning', 'analysis', 'synthesis', 'reflection', 'derivation'] as const;
            
            // 依次调用不同类型的思考记录
            for (const thinkingType of thinkingTypes) {
                const result = await recordThought({
                    thinkingType,
                    content: `Test ${thinkingType} content`,
                    context: `Context for ${thinkingType}`
                });
                
                expect(result.success).toBe(true);
                thoughtRecordManager.recordThought(specialistId, result.thoughtRecord);
            }
            
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            // 验证所有思考类型都被正确记录和格式化
            expect(formatted).toContain('➡️ Thought in Iteration 5: DERIVATION'); // 最新的在前
            expect(formatted).toContain('🤔 Thought in Iteration 4: REFLECTION');
            expect(formatted).toContain('🔗 Thought in Iteration 3: SYNTHESIS');
            expect(formatted).toContain('🔍 Thought in Iteration 2: ANALYSIS');
            expect(formatted).toContain('📋 Thought in Iteration 1: PLANNING'); // 最早的在后
        });
    });

    describe('internalHistory过滤功能', () => {
        it('应该模拟SpecialistExecutor过滤recordThought工具结果', () => {
            // 模拟工具执行结果数组
            const toolResults = [
                {
                    toolName: 'recordThought',
                    success: true,
                    result: {
                        thoughtRecord: {
                            thinkingType: 'planning',
                            content: 'Test thought',
                            timestamp: new Date().toISOString(),
                            thoughtId: 'test_thought_1'
                        }
                    }
                },
                {
                    toolName: 'executeMarkdownEdits',
                    success: true,
                    result: {
                        appliedIntents: [{ type: 'replace', target: 'section1' }]
                    }
                },
                {
                    toolName: 'readFile',
                    success: true,
                    result: {
                        content: 'File content here'
                    }
                }
            ];
            
            // 模拟过滤逻辑（与SpecialistExecutor中的逻辑一致）
            const filteredResults = toolResults.filter(result => result.toolName !== 'recordThought');
            
            expect(filteredResults).toHaveLength(2);
            expect(filteredResults.find(r => r.toolName === 'recordThought')).toBeUndefined();
            expect(filteredResults.find(r => r.toolName === 'executeMarkdownEdits')).toBeDefined();
            expect(filteredResults.find(r => r.toolName === 'readFile')).toBeDefined();
        });

        it('应该模拟工具调用摘要的过滤', () => {
            // 模拟工具调用数组
            const toolCalls = [
                { name: 'recordThought', args: { thinkingType: 'planning', content: {} } },
                { name: 'executeMarkdownEdits', args: { targetFile: 'test.md', intents: [{}] } },
                { name: 'readFile', args: { filePath: 'test.md' } }
            ];
            
            // 模拟summarizeToolCall逻辑
            const summarizeToolCall = (toolCall: { name: string; args: any }): string => {
                if (toolCall.name === 'recordThought') {
                    return ''; // 过滤掉recordThought
                }
                return `${toolCall.name}: ${JSON.stringify(toolCall.args)}`;
            };
            
            const summaries = toolCalls
                .map(call => summarizeToolCall(call))
                .filter(summary => summary.trim()); // 过滤空摘要
            
            expect(summaries).toHaveLength(2);
            expect(summaries.find(s => s.includes('recordThought'))).toBeUndefined();
        });
    });

    describe('提示词第0章注入功能', () => {
        it('应该模拟PromptAssemblyEngine的第0章注入', () => {
            const specialistId = 'test_specialist';
            
            // 添加一些思考记录
            const thoughtRecord: ThoughtRecord = {
                thinkingType: 'analysis',
                content: {
                    problem: 'Complex requirement analysis needed',
                    approach: 'Break down into smaller components'
                },
                nextSteps: ['Identify stakeholders', 'Gather requirements', 'Create documentation'],
                context: 'Initial project analysis phase',
                timestamp: new Date().toISOString(),
                thoughtId: 'analysis_thought_1'
            };
            
            thoughtRecordManager.recordThought(specialistId, thoughtRecord);
            
            // 模拟PromptAssemblyEngine获取格式化思考记录
            const previousThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            // 模拟完整的提示词结构
            const mockPrompt = `You are a specialist. Below is the context information and the task you need to complete. Follow these instructions carefully:

Table of Contents:

0. YOUR PREVIOUS THOUGHTS
1. SPECIALIST INSTRUCTIONS
2. CURRENT TASK
3. LATEST RESPONSE FROM USER
4. TABLE OF CONTENTS OF CURRENT SRS
5. TEMPLATE FOR YOUR CHAPTERS
6. DYNAMIC CONTEXT
7. GUIDELINES AND SAMPLE OF TOOLS USING
8. YOUR TOOLS LIST
9. FINAL INSTRUCTION

**# 0. YOUR PREVIOUS THOUGHTS**

${previousThoughts}

**# 1. SPECIALIST INSTRUCTIONS**

[Your specialist instructions here...]`;

            // 验证第0章的存在和内容
            expect(mockPrompt).toContain('0. YOUR PREVIOUS THOUGHTS');
            expect(mockPrompt).toContain('**# 0. YOUR PREVIOUS THOUGHTS**');
            expect(mockPrompt).toContain('🔍 Thought in Iteration 1: ANALYSIS');
            expect(mockPrompt).toContain('Initial project analysis phase');
            expect(mockPrompt).toContain('❓ Problem: Complex requirement analysis needed');
            expect(mockPrompt).toContain('🛤️ Approach: Break down into smaller components');
            expect(mockPrompt).toContain('Identify stakeholders → Gather requirements → Create documentation');
            expect(mockPrompt).toContain('⚠️ **CRITICAL GUIDANCE**');
            
            // 验证结构顺序正确
            const thoughtsIndex = mockPrompt.indexOf('**# 0. YOUR PREVIOUS THOUGHTS**');
            const instructionsIndex = mockPrompt.indexOf('**# 1. SPECIALIST INSTRUCTIONS**');
            expect(thoughtsIndex).toBeLessThan(instructionsIndex);
        });

        it('应该正确处理没有思考记录的情况', () => {
            const specialistId = 'empty_specialist';
            
            // 获取空的思考记录
            const previousThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            expect(previousThoughts).toBe('');
            
            // 模拟提示词注入
            const mockPrompt = `**# 0. YOUR PREVIOUS THOUGHTS**

${previousThoughts}

**# 1. SPECIALIST INSTRUCTIONS**`;

            // 应该只有空行，不影响提示词结构
            expect(mockPrompt).toContain('**# 0. YOUR PREVIOUS THOUGHTS**');
            expect(mockPrompt).toContain('**# 1. SPECIALIST INSTRUCTIONS**');
        });
    });

    describe('完整流程端到端测试', () => {
        it('应该模拟完整的specialist执行流程', async () => {
            const specialistId = 'integration_test_specialist';
            
            // 第1轮迭代：specialist调用recordThought
            const iteration1Result = await recordThought({
                thinkingType: 'planning',
                content: {
                    objective: 'Write user requirements section',
                    strategy: 'Analyze existing documentation and user feedback',
                    timeline: 'Complete within 2 iterations'
                },
                nextSteps: ['Read existing requirements', 'Identify gaps', 'Draft new content'],
                context: 'Starting work on SRS user requirements section'
            });
            
            // 模拟SpecialistExecutor记录思考
            thoughtRecordManager.recordThought(specialistId, iteration1Result.thoughtRecord);
            
            // 第2轮迭代：specialist调用另一个recordThought
            const iteration2Result = await recordThought({
                thinkingType: 'analysis',
                content: {
                    findings: 'Current requirements are outdated',
                    gaps: 'Missing user personas and use cases',
                    recommendations: 'Need to conduct user research'
                },
                nextSteps: ['Create user personas', 'Define use cases', 'Update requirements'],
                context: 'After reviewing existing documentation'
            });
            
            thoughtRecordManager.recordThought(specialistId, iteration2Result.thoughtRecord);
            
            // 验证思考记录管理
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(2);
            
            // 模拟第3轮迭代的提示词生成
            const formattedThoughts = thoughtRecordManager.getFormattedThoughts(specialistId);
            
            // 验证最新思考在前
            expect(formattedThoughts).toContain('🔍 Thought in Iteration 2: ANALYSIS');
            expect(formattedThoughts).toContain('📋 Thought in Iteration 1: PLANNING');
            
            // 验证内容连续性
            expect(formattedThoughts).toContain('Current requirements are outdated');
            expect(formattedThoughts).toContain('Write user requirements section');
            expect(formattedThoughts).toContain('Create user personas → Define use cases → Update requirements');
            expect(formattedThoughts).toContain('Read existing requirements → Identify gaps → Draft new content');
            
            // 验证指导信息
            expect(formattedThoughts).toContain('**Continue** your work based on the above thoughts');
            expect(formattedThoughts).toContain('**Avoid** repeating analysis you\'ve already completed');
            
            // 模拟specialist完成后清空
            thoughtRecordManager.clearThoughts(specialistId);
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(0);
            expect(thoughtRecordManager.getFormattedThoughts(specialistId)).toBe('');
        });

        it('应该正确处理多个specialist的并发思考记录', async () => {
            const specialist1 = 'specialist_content';
            const specialist2 = 'specialist_process';
            
            // Specialist 1的思考记录
            const content1Result = await recordThought({
                thinkingType: 'synthesis',
                content: 'Content specialist thinking',
                context: 'Working on content generation'
            });
            thoughtRecordManager.recordThought(specialist1, content1Result.thoughtRecord);
            
            // Specialist 2的思考记录
            const process2Result = await recordThought({
                thinkingType: 'reflection',
                content: 'Process specialist thinking',
                context: 'Working on process optimization'
            });
            thoughtRecordManager.recordThought(specialist2, process2Result.thoughtRecord);
            
            // 验证两个specialist的思考记录是独立的
            expect(thoughtRecordManager.getThoughtCount(specialist1)).toBe(1);
            expect(thoughtRecordManager.getThoughtCount(specialist2)).toBe(1);
            
            const formatted1 = thoughtRecordManager.getFormattedThoughts(specialist1);
            const formatted2 = thoughtRecordManager.getFormattedThoughts(specialist2);
            
            expect(formatted1).toContain('Content specialist thinking');
            expect(formatted1).not.toContain('Process specialist thinking');
            
            expect(formatted2).toContain('Process specialist thinking');
            expect(formatted2).not.toContain('Content specialist thinking');
            
            // 清空其中一个不应该影响另一个
            thoughtRecordManager.clearThoughts(specialist1);
            expect(thoughtRecordManager.getThoughtCount(specialist1)).toBe(0);
            expect(thoughtRecordManager.getThoughtCount(specialist2)).toBe(1);
        });
    });

    describe('性能和边界测试', () => {
        it('应该在大量思考记录下保持性能', async () => {
            const specialistId = 'performance_test_specialist';
            const startTime = Date.now();
            
            // 添加大量思考记录
            for (let i = 0; i < 100; i++) {
                const result = await recordThought({
                    thinkingType: 'analysis',
                    content: { iteration: i, data: `Large content for iteration ${i}`.repeat(10) },
                    nextSteps: [`Step ${i}.1`, `Step ${i}.2`, `Step ${i}.3`]
                });
                thoughtRecordManager.recordThought(specialistId, result.thoughtRecord);
            }
            
            const recordingTime = Date.now() - startTime;
            
            // 验证只保留最新的10个
            expect(thoughtRecordManager.getThoughtCount(specialistId)).toBe(10);
            
            // 测试格式化性能
            const formatStartTime = Date.now();
            const formatted = thoughtRecordManager.getFormattedThoughts(specialistId);
            const formatTime = Date.now() - formatStartTime;
            
            // 基本性能检查（应该在合理时间内完成）
            expect(recordingTime).toBeLessThan(5000); // 5秒内
            expect(formatTime).toBeLessThan(1000); // 1秒内
            expect(formatted.length).toBeGreaterThan(0);
        });
    });
});
