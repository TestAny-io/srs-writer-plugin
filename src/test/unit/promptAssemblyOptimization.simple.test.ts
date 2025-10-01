/**
 * PromptAssemblyEngine recordThought优化测试 - 简化版
 * 
 * 测试核心逻辑而不依赖复杂的类继承
 */

import { ThoughtRecord } from '../../tools/internal/recordThoughtTools';

// 复制核心逻辑进行独立测试
class TestThoughtProcessor {
    /**
     * 从历史记录中提取思考记录
     */
    extractThoughtRecordsFromHistory(internalHistory: string[]): {
        thoughtRecords: ThoughtRecord[];
        cleanedHistory: string[];
    } {
        const thoughtRecords: ThoughtRecord[] = [];
        const cleanedHistory: string[] = [];

        for (const entry of internalHistory) {
            // 检查条目是否包含recordThought的格式化结果
            const hasRecordThought = entry.includes('💭 【') && entry.includes('】recordThought');
            
            if (hasRecordThought) {
                // 提取思考记录信息
                const thoughtMatch = entry.match(/💭 【(\w+)】recordThought\n📍 Context: (.*?)\n🧠 Core Thinking: (.*?)\n📋 Next Steps: (.*?)\n⏰ (.*?)(?=\n|$)/s);
                
                if (thoughtMatch) {
                    const context = thoughtMatch[2] === 'No specific context' ? undefined : thoughtMatch[2];
                    const nextStepsText = thoughtMatch[4];
                    const nextSteps = nextStepsText === 'No specific steps' ? [] : 
                                     nextStepsText.includes(' → ') ? nextStepsText.split(' → ') : 
                                     [nextStepsText];

                    thoughtRecords.push({
                        thinkingType: thoughtMatch[1].toLowerCase() as any,
                        context: context,
                        content: thoughtMatch[3],
                        nextSteps: nextSteps,
                        timestamp: thoughtMatch[5],
                        thoughtId: `extracted_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                    });
                }
                
                // 从条目中移除recordThought部分，保留其他工具结果
                const cleanedEntry = entry.replace(/💭 【\w+】recordThought\n📍 Context: .*?\n🧠 Core Thinking: .*?\n📋 Next Steps: .*?\n⏰ .*?(?=\n|$)/gs, '').trim();
                
                // 如果清理后还有实质内容，则保留；如果只剩标题或空白，则跳过
                if (cleanedEntry && cleanedEntry.length > 0 && !cleanedEntry.match(/^迭代 \d+ - 工具结果:\s*$/)) {
                    cleanedHistory.push(cleanedEntry);
                }
            } else {
                cleanedHistory.push(entry);
            }
        }

        // 按时间降序排序思考记录（最新的在前）
        thoughtRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return { thoughtRecords, cleanedHistory };
    }

    /**
     * 构建思考记录章节
     */
    buildPreviousThoughtsSection(thoughtRecords: ThoughtRecord[]): string {
        if (thoughtRecords.length === 0) {
            return 'No previous thoughts recorded in this session.';
        }

        let section = '';
        
        thoughtRecords.forEach((thought, index) => {
            section += `### Thought ${index + 1}: ${thought.thinkingType.toUpperCase()}\n`;
            section += `**Context**: ${thought.context || 'No specific context'}\n`;
            section += `**Analysis**: ${thought.content}\n`;
            section += `**Planned Actions**: ${thought.nextSteps && thought.nextSteps.length > 0 ? thought.nextSteps.join(' → ') : 'No specific actions'}\n`;
            section += `**Timestamp**: ${thought.timestamp}\n\n`;
        });
        
        section += `💡 **Guidance**: Use these previous thoughts to maintain continuity and avoid repeating analysis. Focus on executing the planned actions or building upon previous insights.\n`;
        
        return section;
    }
}

describe('PromptAssemblyEngine recordThought Optimization - Core Logic Tests', () => {
    let processor: TestThoughtProcessor;

    beforeEach(() => {
        processor = new TestThoughtProcessor();
    });

    describe('思考记录提取和历史清理', () => {
        it('应该正确提取思考记录并清理历史', () => {
            const internalHistory = [
                '迭代 1 - AI计划:\nreadFile: {"path":"test.md"}',
                '迭代 1 - 工具结果:\nreadFile: ✅ 成功 - 读取文件 (1000字符)',
                '迭代 2 - AI计划:\nrecordThought: {...}\nexecuteMarkdownEdits: {...}',
                `迭代 2 - 工具结果:

💭 【PLANNING】recordThought
📍 Context: Initial planning for SRS generation
🧠 Core Thinking: goal: Generate comprehensive document; strategy: Top-down approach
📋 Next Steps: readFile → analyze → draft
⏰ 9/24/2025, 9:30:00 AM
executeMarkdownEdits: ✅ 成功 - 应用3个编辑操作 (200ms)`,
                '迭代 3 - AI计划:\nrecordThought: {...}',
                `迭代 3 - 工具结果:

💭 【ANALYSIS】recordThought
📍 Context: Content analysis phase
🧠 Core Thinking: current_state: Good foundation; improvements: Add more detail
📋 Next Steps: enhance_content → review
⏰ 9/24/2025, 9:35:00 AM`
            ];

            const result = processor.extractThoughtRecordsFromHistory(internalHistory);

            // 验证提取了2个思考记录
            expect(result.thoughtRecords).toHaveLength(2);
            
            // 验证按时间降序排序（最新的在前）
            expect(result.thoughtRecords[0].thinkingType).toBe('analysis'); // 9:35的在前
            expect(result.thoughtRecords[1].thinkingType).toBe('planning'); // 9:30的在后
            
            // 验证思考记录内容正确
            expect(result.thoughtRecords[0].context).toBe('Content analysis phase');
            expect(result.thoughtRecords[0].content).toBe('current_state: Good foundation; improvements: Add more detail');
            expect(result.thoughtRecords[0].nextSteps).toEqual(['enhance_content', 'review']);
            
            expect(result.thoughtRecords[1].context).toBe('Initial planning for SRS generation');
            expect(result.thoughtRecords[1].nextSteps).toEqual(['readFile', 'analyze', 'draft']);

            // 验证清理后的历史不包含recordThought（空白条目被过滤）
            expect(result.cleanedHistory.length).toBeGreaterThanOrEqual(4);
            expect(result.cleanedHistory[0]).toBe('迭代 1 - AI计划:\nreadFile: {"path":"test.md"}');
            expect(result.cleanedHistory[1]).toBe('迭代 1 - 工具结果:\nreadFile: ✅ 成功 - 读取文件 (1000字符)');
            
            // 查找executeMarkdownEdits结果（可能在不同位置）
            const executeEditsEntry = result.cleanedHistory.find((entry: string) => entry.includes('executeMarkdownEdits: ✅ 成功'));
            expect(executeEditsEntry).toBeDefined();
            
            // 确认清理后的历史不包含格式化的思考记录内容（但可能包含AI计划中的recordThought调用）
            result.cleanedHistory.forEach((entry: string) => {
                expect(entry).not.toContain('💭 【');
                // AI计划中的recordThought调用是允许的，只是不允许格式化的结果
                if (entry.includes('recordThought')) {
                    expect(entry).toContain('AI计划'); // 确保是AI计划中的调用，不是格式化结果
                }
            });
        });

        it('应该按时间降序排序多个思考记录', () => {
            const internalHistory = [
                `迭代 1 - 工具结果:

💭 【PLANNING】recordThought
📍 Context: Early planning
🧠 Core Thinking: initial thoughts
📋 Next Steps: step1
⏰ 9/24/2025, 9:00:00 AM`,
                `迭代 2 - 工具结果:

💭 【ANALYSIS】recordThought
📍 Context: Later analysis
🧠 Core Thinking: detailed analysis
📋 Next Steps: step2
⏰ 9/24/2025, 10:00:00 AM`,
                `迭代 3 - 工具结果:

💭 【SYNTHESIS】recordThought
📍 Context: Middle synthesis
🧠 Core Thinking: synthesis thoughts
📋 Next Steps: step3
⏰ 9/24/2025, 9:30:00 AM`
            ];

            const result = processor.extractThoughtRecordsFromHistory(internalHistory);

            expect(result.thoughtRecords).toHaveLength(3);
            
            // 验证按时间降序排序（最新的在前）
            expect(result.thoughtRecords[0].thinkingType).toBe('analysis');  // 10:00 (最新)
            expect(result.thoughtRecords[1].thinkingType).toBe('synthesis'); // 9:30 (中间)
            expect(result.thoughtRecords[2].thinkingType).toBe('planning');  // 9:00 (最早)
        });
    });

    describe('思考记录章节构建', () => {
        it('应该构建正确的思考记录章节', () => {
            const thoughtRecords: ThoughtRecord[] = [
                {
                    thinkingType: 'analysis' as any,
                    context: 'Current task analysis',
                    content: 'system: Complex; approach: Modular design',
                    nextSteps: ['design', 'implement'],
                    timestamp: '9/24/2025, 10:00:00 AM',
                    thoughtId: 'thought_1'
                },
                {
                    thinkingType: 'planning' as any,
                    context: 'Initial planning',
                    content: 'goal: Build system; timeline: 2 weeks',
                    nextSteps: ['research', 'design'],
                    timestamp: '9/24/2025, 9:00:00 AM',
                    thoughtId: 'thought_2'
                }
            ];

            const result = processor.buildPreviousThoughtsSection(thoughtRecords);

            expect(result).toContain('### Thought in Iteration 1: ANALYSIS');
            expect(result).toContain('**Context**: Current task analysis');
            expect(result).toContain('**Analysis**: system: Complex; approach: Modular design');
            expect(result).toContain('**Planned Actions**: design → implement');
            expect(result).toContain('**Timestamp**: 9/24/2025, 10:00:00 AM');

            expect(result).toContain('### Thought in Iteration 2: PLANNING');
            expect(result).toContain('**Context**: Initial planning');
            expect(result).toContain('**Analysis**: goal: Build system; timeline: 2 weeks');
            expect(result).toContain('**Planned Actions**: research → design');

            expect(result).toContain('💡 **Guidance**: Use these previous thoughts');
        });

        it('应该处理没有思考记录的情况', () => {
            const result = processor.buildPreviousThoughtsSection([]);
            
            expect(result).toBe('No previous thoughts recorded in this session.');
        });
    });

    describe('真实场景模拟', () => {
        it('应该处理你日志中的实际数据格式', () => {
            // 基于你提供的实际日志数据
            const realInternalHistory = [
                '迭代 3 - AI计划:\nrecordThought: {"thinkingType":"planning","content":{"goal":"为Blackpink粉丝社区Webapp撰写整体描述章节，突出高情绪价值、互动性和社区支持，严格遵循模板结构和专业标准。",...}}\nexecuteMarkdownEdits: 未提供描述 (1个编辑操作 -> SRS.md)',
                `迭代 3 - 工具结果:

💭 【PLANNING】recordThought
📍 Context: 根据用户需求和模板，规划整体描述章节内容，确保结构完整、语言专业、突出战略价值。
🧠 Core Thinking: goal: 为Blackpink粉丝社区Webapp撰写整体描述章节，突出高情绪价值、互动性和社区支持，严格遵循模板结构和专业标准。; structure: ["项目背景与目标：阐述Blackpink粉丝的情感需求、市场机会和平台目标。","功能定位：用差异化定位句，突出社区互动和支持优势。","范围与指标：明确系统核心功能、边界、主要接口和成功标准。","操作环境：描述用户特征、使用场景和系统环境。"]; 关键点: ["强调社区归属感和情感支持，满足粉丝深层交流需求。","目标：一个月内注册用户超过10000人，平台仅限Webapp。","与其他粉丝平台相比，突出高互动性和情感连接。"]; next steps: ["调用executeMarkdownEdits，插入完整的整体描述章节内容。"]
📋 Next Steps: executeMarkdownEdits插入章节
⏰ 9/24/2025, 9:48:29 AM
executeMarkdownEdits: ❌ 失败 - cannot open file:///Users/kailaichen/Downloads/Source%20Code/srs-vscode-test-temp/BlackpinkFanCommunityWebapp/BlackpinkFanCommunityWebapp/BlackpinkFanCommunityWebapp/SRS.md. Detail: Unable to read file '/Users/kailaichen/Downloads/Source Code/srs-vscode-test-temp/BlackpinkFanCommunityWebapp/BlackpinkFanCommunityWebapp/BlackpinkFanCommunityWebapp/SRS.md' (Error: Unable to resolve nonexistent file '/Users/kailaichen/Downloads/Source Code/srs-vscode-test-temp/BlackpinkFanCommunityWebapp/BlackpinkFanCommunityWebapp/BlackpinkFanCommunityWebapp/SRS.md')`,
                '迭代 2 - AI计划:\nreadMarkdownFile: {"path":"BlackpinkFanCommunityWebapp/BlackpinkFanCommunityWebapp/SRS.md","parseMode":"toc"}',
                '迭代 2 - 工具结果:\n工具: readMarkdownFile, 成功: false, 结果: {"success":false,...}'
            ];

            const processor = new TestThoughtProcessor();
            const result = processor.extractThoughtRecordsFromHistory(realInternalHistory);

            // 验证提取了1个思考记录
            expect(result.thoughtRecords).toHaveLength(1);
            expect(result.thoughtRecords[0].thinkingType).toBe('planning');
            expect(result.thoughtRecords[0].context).toBe('根据用户需求和模板，规划整体描述章节内容，确保结构完整、语言专业、突出战略价值。');
            expect(result.thoughtRecords[0].nextSteps).toEqual(['executeMarkdownEdits插入章节']);

            // 验证清理后的历史
            expect(result.cleanedHistory.length).toBeGreaterThanOrEqual(3);
            
            // 验证包含AI计划
            const aiPlanEntry = result.cleanedHistory.find((entry: string) => entry.includes('迭代 3 - AI计划'));
            expect(aiPlanEntry).toBeDefined();
            
            // 验证包含executeMarkdownEdits失败信息
            const executeEditsEntry = result.cleanedHistory.find((entry: string) => entry.includes('executeMarkdownEdits: ❌ 失败'));
            expect(executeEditsEntry).toBeDefined();

            // 确认清理后的历史不包含格式化的思考记录
            result.cleanedHistory.forEach((entry: string) => {
                expect(entry).not.toContain('💭 【');
                expect(entry).not.toContain('】recordThought');
            });

            // 构建思考记录章节
            const thoughtsSection = processor.buildPreviousThoughtsSection(result.thoughtRecords);
            
            expect(thoughtsSection).toContain('### Thought in Iteration 1: PLANNING');
            expect(thoughtsSection).toContain('**Context**: 根据用户需求和模板，规划整体描述章节内容，确保结构完整、语言专业、突出战略价值。');
            expect(thoughtsSection).toContain('**Planned Actions**: executeMarkdownEdits插入章节');
            expect(thoughtsSection).toContain('💡 **Guidance**');

            console.log('\n🎯 提取的思考记录章节：');
            console.log(thoughtsSection);
            
            console.log('\n📋 清理后的Action History：');
            result.cleanedHistory.forEach((entry: string, index: number) => {
                console.log(`${index + 1}. ${entry.substring(0, 100)}...`);
            });
        });

        it('应该处理时间排序', () => {
            const internalHistory = [
                `迭代 1 - 工具结果:

💭 【PLANNING】recordThought
📍 Context: Early planning
🧠 Core Thinking: initial thoughts
📋 Next Steps: step1
⏰ 9/24/2025, 9:00:00 AM`,
                `迭代 2 - 工具结果:

💭 【ANALYSIS】recordThought
📍 Context: Later analysis
🧠 Core Thinking: detailed analysis
📋 Next Steps: step2
⏰ 9/24/2025, 10:00:00 AM`,
                `迭代 3 - 工具结果:

💭 【SYNTHESIS】recordThought
📍 Context: Middle synthesis
🧠 Core Thinking: synthesis thoughts
📋 Next Steps: step3
⏰ 9/24/2025, 9:30:00 AM`
            ];

            const result = processor.extractThoughtRecordsFromHistory(internalHistory);

            expect(result.thoughtRecords).toHaveLength(3);
            
            // 验证按时间降序排序（最新的在前）
            expect(result.thoughtRecords[0].thinkingType).toBe('analysis');  // 10:00 (最新)
            expect(result.thoughtRecords[1].thinkingType).toBe('synthesis'); // 9:30 (中间)
            expect(result.thoughtRecords[2].thinkingType).toBe('planning');  // 9:00 (最早)
        });

        it('应该处理没有思考记录的历史', () => {
            const internalHistory = [
                '迭代 1 - AI计划:\nreadFile: {"path":"test.md"}',
                '迭代 1 - 工具结果:\nreadFile: ✅ 成功',
                '迭代 2 - AI计划:\nexecuteMarkdownEdits: {...}',
                '迭代 2 - 工具结果:\nexecuteMarkdownEdits: ✅ 成功'
            ];

            const result = processor.extractThoughtRecordsFromHistory(internalHistory);

            expect(result.thoughtRecords).toHaveLength(0);
            expect(result.cleanedHistory).toHaveLength(4);
            expect(result.cleanedHistory).toEqual(internalHistory);

            const thoughtsSection = processor.buildPreviousThoughtsSection(result.thoughtRecords);
            expect(thoughtsSection).toBe('No previous thoughts recorded in this session.');
        });
    });

    describe('章节构建质量验证', () => {
        it('应该生成符合要求的第0章格式', () => {
            const thoughtRecords: ThoughtRecord[] = [
                {
                    thinkingType: 'reflection' as any,
                    context: 'Task completion review',
                    content: 'status: Complete; quality: High; confidence: 95%',
                    nextSteps: ['finalize', 'handoff'],
                    timestamp: '9/24/2025, 11:00:00 AM',
                    thoughtId: 'thought_latest'
                },
                {
                    thinkingType: 'analysis' as any,
                    context: 'Mid-task analysis',
                    content: 'progress: 80%; blockers: None; next_focus: Quality improvement',
                    nextSteps: ['improve_quality', 'test'],
                    timestamp: '9/24/2025, 10:30:00 AM',
                    thoughtId: 'thought_middle'
                },
                {
                    thinkingType: 'planning' as any,
                    context: 'Initial task planning',
                    content: 'scope: Full SRS; approach: Iterative; timeline: 1 week',
                    nextSteps: ['analyze', 'design', 'implement'],
                    timestamp: '9/24/2025, 9:00:00 AM',
                    thoughtId: 'thought_earliest'
                }
            ];

            const section = processor.buildPreviousThoughtsSection(thoughtRecords);

            // 验证章节结构
            expect(section).toContain('### Thought in Iteration 3: REFLECTION');
            expect(section).toContain('### Thought in Iteration 2: ANALYSIS');
            expect(section).toContain('### Thought in Iteration 1: PLANNING');

            // 验证时间顺序（最新的在前）
            const reflectionIndex = section.indexOf('### Thought in Iteration 3: REFLECTION');
            const analysisIndex = section.indexOf('### Thought in Iteration 2: ANALYSIS');
            const planningIndex = section.indexOf('### Thought in Iteration 1: PLANNING');

            expect(reflectionIndex).toBeLessThan(analysisIndex);
            expect(analysisIndex).toBeLessThan(planningIndex);

            // 验证内容完整性
            expect(section).toContain('**Context**: Task completion review');
            expect(section).toContain('**Analysis**: status: Complete; quality: High; confidence: 95%');
            expect(section).toContain('**Planned Actions**: finalize → handoff');

            // 验证指导信息
            expect(section).toContain('💡 **Guidance**: Use these previous thoughts to maintain continuity and avoid repeating analysis');

            console.log('\n🎯 生成的第0章内容预览：');
            console.log(section);
        });
    });
});
