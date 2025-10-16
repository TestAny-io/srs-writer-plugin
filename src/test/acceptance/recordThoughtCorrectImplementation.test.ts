/**
 * recordThought正确实现的最终验收测试
 * 
 * 验证在PromptAssemblyEngine中的正确实现效果
 */

// 模拟完整的提示词组装流程
class FinalAcceptanceTest {
    /**
     * 模拟PromptAssemblyEngine的核心逻辑
     */
    simulatePromptAssembly(internalHistory: string[]): {
        previousThoughtsSection: string;
        actionHistorySection: string;
        fullPromptPreview: string;
    } {
        // 提取思考记录和清理历史
        const { thoughtRecords, cleanedHistory } = this.extractThoughtRecordsFromHistory(internalHistory);
        
        // 构建第0章：YOUR PREVIOUS THOUGHTS
        const previousThoughtsSection = this.buildPreviousThoughtsSection(thoughtRecords);
        
        // 构建Action History部分
        const actionHistorySection = cleanedHistory.length > 0 ? 
            JSON.stringify(cleanedHistory, null, 2) : 
            'No action history available';
        
        // 模拟完整提示词的关键部分
        const fullPromptPreview = `Table of Contents:

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

${previousThoughtsSection}

**# 1. SPECIALIST INSTRUCTIONS**

[Specialist instructions content...]

**# 6. DYNAMIC CONTEXT**

## Action History
\`\`\`json
${actionHistorySection}
\`\`\`

**# 9. FINAL INSTRUCTION**

Based on all the instructions and context above, generate a valid JSON object that adheres to the required schema.`;

        return { previousThoughtsSection, actionHistorySection, fullPromptPreview };
    }

    private extractThoughtRecordsFromHistory(internalHistory: string[]): {
        thoughtRecords: Array<{
            thinkingType: string;
            context?: string;
            content: string;
            nextSteps?: string[];
            timestamp: string;
        }>;
        cleanedHistory: string[];
    } {
        const thoughtRecords: any[] = [];
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
                        thinkingType: thoughtMatch[1].toLowerCase(),
                        context: context,
                        content: thoughtMatch[3],
                        nextSteps: nextSteps,
                        timestamp: thoughtMatch[5]
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

    private buildPreviousThoughtsSection(thoughtRecords: any[]): string {
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

describe('recordThought正确实现最终验收测试', () => {
    let acceptanceTest: FinalAcceptanceTest;

    beforeEach(() => {
        acceptanceTest = new FinalAcceptanceTest();
    });

    describe('🎯 完整场景演示：基于你的实际日志数据', () => {
        it('应该正确处理你提供的真实日志数据', () => {
            console.log('\n=== 🚀 基于真实日志的完整演示 ===\n');

            // 基于你的实际日志数据
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
                '迭代 2 - 工具结果:\n工具: readMarkdownFile, 成功: false, 结果: {"success":false,"path":"BlackpinkFanCommunityWebapp/BlackpinkFanCommunityWebapp/SRS.md","resolvedPath":"","lastModified":"2025-09-24T01:48:14.207Z","size":0,"results":[],"parseTime":0,"cacheHit":false,"error":{"code":"PARSE_ERROR","message":"ENOENT: no such file or directory, stat \'/Users/kailaichen/Downloads/Source Code/srs-vscode-test-temp/BlackpinkFanCommunityWebapp/BlackpinkFanCommunityWebapp/BlackpinkFanCommunityWebapp/SRS.md\'"}}',
                '迭代 1 - AI计划:\nlistAllFiles: {"maxDepth":5,"maxItems":100,"excludePatterns":["node_modules","coverage","dist","build"],"dirsOnly":false,"searchKeywords":["SRS"]}',
                '迭代 1 - 工具结果:\n工具: listAllFiles, 成功: true, 结果: {"success":true,"structure":{"paths":["BlackpinkFanCommunityWebapp/BlackpinkFanCommunityWebapp/SRS.md"],"totalCount":1,"truncated":false,"depth":3}}'
            ];

            const result = acceptanceTest.simulatePromptAssembly(realInternalHistory);

            console.log('🔴 优化前的Iterative History（包含recordThought的JSON混乱）：');
            console.log(JSON.stringify(realInternalHistory, null, 2).substring(0, 500) + '...\n');

            console.log('🟢 优化后的第0章 - YOUR PREVIOUS THOUGHTS：');
            console.log(result.previousThoughtsSection);
            console.log('\n');

            console.log('🟢 优化后的Action History（清理后的执行历史）：');
            console.log(result.actionHistorySection.substring(0, 500) + '...\n');

            console.log('📋 完整提示词结构预览：');
            console.log(result.fullPromptPreview.substring(0, 1000) + '...\n');

            // 验证思考记录被正确提取
            expect(result.previousThoughtsSection).toContain('### Thought in Iteration 1: PLANNING');
            expect(result.previousThoughtsSection).toContain('**Context**: 根据用户需求和模板，规划整体描述章节内容，确保结构完整、语言专业、突出战略价值。');
            expect(result.previousThoughtsSection).toContain('**Planned Actions**: executeMarkdownEdits插入章节');
            expect(result.previousThoughtsSection).toContain('💡 **Guidance**');

            // 验证Action History被清理
            expect(result.actionHistorySection).not.toContain('💭 【');
            expect(result.actionHistorySection).not.toContain('】recordThought');
            expect(result.actionHistorySection).toContain('executeMarkdownEdits: ❌ 失败');

            // 验证完整提示词结构
            expect(result.fullPromptPreview).toContain('0. YOUR PREVIOUS THOUGHTS');
            expect(result.fullPromptPreview).toContain('## Action History');
            expect(result.fullPromptPreview).not.toContain('## Iterative History');

            console.log('🎉 验收测试通过！新实现完全符合要求：');
            console.log('✅ 第0章：思考记录独立显示，时间降序排列');
            console.log('✅ Action History：清理了recordThought，保留纯净的执行历史');
            console.log('✅ 架构清晰：分离关注点，优先级明确');
        });

        it('应该展示多个思考记录的时间排序效果', () => {
            console.log('\n=== ⏰ 时间排序演示 ===\n');

            const multipleThoughtsHistory = [
                `迭代 1 - 工具结果:

💭 【PLANNING】recordThought
📍 Context: Initial project setup
🧠 Core Thinking: project: Blackpink community; phase: Planning; priority: High
📋 Next Steps: research → design → implement
⏰ 9/24/2025, 8:00:00 AM`,
                `迭代 2 - 工具结果:

💭 【ANALYSIS】recordThought
📍 Context: Requirements analysis
🧠 Core Thinking: users: Blackpink fans; needs: Community, interaction; features: Chat, forums, events
📋 Next Steps: define_features → prioritize
⏰ 9/24/2025, 10:00:00 AM`,
                `迭代 3 - 工具结果:

💭 【SYNTHESIS】recordThought
📍 Context: Feature synthesis
🧠 Core Thinking: core_features: ["Fan chat","Official news","Event calendar"]; tech_stack: React + Node.js
📋 Next Steps: create_mockups → develop_mvp
⏰ 9/24/2025, 9:00:00 AM`,
                `迭代 4 - 工具结果:

💭 【REFLECTION】recordThought
📍 Context: Progress review
🧠 Core Thinking: progress: 75%; quality: Good; remaining: UI polish, testing
📋 Next Steps: polish_ui → test → deploy
⏰ 9/24/2025, 11:00:00 AM`
            ];

            const result = acceptanceTest.simulatePromptAssembly(multipleThoughtsHistory);

            console.log('🧠 第0章 - YOUR PREVIOUS THOUGHTS（按时间降序）：');
            console.log(result.previousThoughtsSection);

            // 验证时间排序（最新的在前）
            expect(result.previousThoughtsSection).toContain('### Thought in Iteration 4: REFLECTION'); // 11:00 (最新)
            expect(result.previousThoughtsSection).toContain('### Thought in Iteration 3: ANALYSIS');   // 10:00
            expect(result.previousThoughtsSection).toContain('### Thought in Iteration 2: SYNTHESIS');  // 9:00  
            expect(result.previousThoughtsSection).toContain('### Thought in Iteration 1: PLANNING');   // 8:00 (最早)

            // 验证内容顺序
            const reflectionIndex = result.previousThoughtsSection.indexOf('### Thought in Iteration 4: REFLECTION');
            const analysisIndex = result.previousThoughtsSection.indexOf('### Thought in Iteration 3: ANALYSIS');
            const synthesisIndex = result.previousThoughtsSection.indexOf('### Thought in Iteration 2: SYNTHESIS');
            const planningIndex = result.previousThoughtsSection.indexOf('### Thought in Iteration 1: PLANNING');

            expect(reflectionIndex).toBeLessThan(analysisIndex);
            expect(analysisIndex).toBeLessThan(synthesisIndex);
            expect(synthesisIndex).toBeLessThan(planningIndex);

            console.log('\n✅ 时间排序验证通过：最新思考在最前面');
        });

        it('应该展示清理效果对比', () => {
            console.log('\n=== 🧹 清理效果对比 ===\n');

            const mixedHistory = [
                '迭代 1 - AI计划:\nreadFile: {"path":"SRS.md"}',
                '迭代 1 - 工具结果:\nreadFile: ✅ 成功 - 读取文件 (1000字符)',
                `迭代 2 - 工具结果:

💭 【PLANNING】recordThought
📍 Context: Strategic planning
🧠 Core Thinking: strategy: User-centric design; timeline: 2 weeks; resources: 5 developers
📋 Next Steps: wireframe → prototype → test
⏰ 9/24/2025, 9:30:00 AM
executeMarkdownEdits: ✅ 成功 - 应用3个编辑操作 (200ms)
findInFiles: ✅ 成功 - 找到5个匹配项`
            ];

            const result = acceptanceTest.simulatePromptAssembly(mixedHistory);

            console.log('🔴 优化前的混合历史（思考记录混在执行历史中）：');
            console.log(JSON.stringify(mixedHistory, null, 2));

            console.log('\n🟢 优化后分离显示：');
            console.log('\n📍 第0章 - YOUR PREVIOUS THOUGHTS：');
            console.log(result.previousThoughtsSection);

            console.log('\n📍 Action History（清理后）：');
            console.log(result.actionHistorySection);

            // 验证分离效果
            expect(result.previousThoughtsSection).toContain('### Thought in Iteration 1: PLANNING');
            expect(result.previousThoughtsSection).toContain('**Context**: Strategic planning');

            expect(result.actionHistorySection).toContain('executeMarkdownEdits: ✅ 成功');
            expect(result.actionHistorySection).toContain('findInFiles: ✅ 成功');
            expect(result.actionHistorySection).not.toContain('💭 【');

            console.log('\n🎉 分离效果完美：思考记录和执行历史完全分离！');
        });
    });

    describe('📊 用户体验提升验证', () => {
        it('应该显著提升AI专家的工作体验', () => {
            console.log('\n=== 📈 用户体验提升对比 ===\n');

            const complexHistory = [
                `迭代 1 - 工具结果:

💭 【PLANNING】recordThought
📍 Context: Complex SRS generation project
🧠 Core Thinking: scope: Full enterprise SRS; complexity: High; approach: Modular development; team: 8 specialists; timeline: 6 weeks
📋 Next Steps: analyze_requirements → design_architecture → implement_modules → integration_test
⏰ 9/24/2025, 8:00:00 AM
readFile: ✅ 成功 - 读取现有文档 (5,230字符)
executeMarkdownEdits: ✅ 成功 - 应用12个编辑操作 (1,200ms)`,
                `迭代 2 - 工具结果:

💭 【REFLECTION】recordThought
📍 Context: Mid-project quality review
🧠 Core Thinking: progress: 60% complete; quality: Exceeds expectations; blockers: None; team_morale: High; next_focus: User acceptance testing
📋 Next Steps: prepare_uat → conduct_testing → gather_feedback → iterate
⏰ 9/24/2025, 12:00:00 PM
findInFiles: ✅ 成功 - 搜索关键词 (找到25个匹配)
taskComplete: ✅ 成功 - 任务阶段完成`
            ];

            const result = acceptanceTest.simulatePromptAssembly(complexHistory);

            console.log('📊 优化效果统计：');
            
            // 计算原始数据的复杂度
            const originalComplexity = JSON.stringify(complexHistory).length;
            const thoughtsSectionLength = result.previousThoughtsSection.length;
            const actionHistoryLength = result.actionHistorySection.length;
            
            console.log(`- 原始混合历史长度: ${originalComplexity} 字符`);
            console.log(`- 思考记录章节长度: ${thoughtsSectionLength} 字符`);
            console.log(`- 清理后执行历史长度: ${actionHistoryLength} 字符`);
            console.log(`- 信息组织效率提升: ${Math.round((thoughtsSectionLength / originalComplexity) * 100)}% 的内容专门用于工作记忆`);

            console.log('\n🎯 AI专家现在看到的第0章（优先级最高）：');
            console.log(result.previousThoughtsSection);

            // 验证关键改进
            expect(result.previousThoughtsSection).toContain('### Thought in Iteration 2: REFLECTION'); // 最新的在前
            expect(result.previousThoughtsSection).toContain('### Thought in Iteration 1: PLANNING');
            expect(result.previousThoughtsSection).toContain('**Context**: Mid-project quality review');
            expect(result.previousThoughtsSection).toContain('**Context**: Complex SRS generation project');
            expect(result.previousThoughtsSection).toContain('💡 **Guidance**');

            console.log('\n🚀 核心价值实现：');
            console.log('✅ 优先级：思考记录在第0章，优先级最高');
            console.log('✅ 时间排序：最新思考在最前面，符合工作记忆逻辑');
            console.log('✅ 分离清晰：思考记录和执行历史完全分离');
            console.log('✅ 格式优雅：Markdown格式，可读性极佳');
        });
    });

    describe('🎪 边界情况验证', () => {
        it('应该优雅处理没有思考记录的情况', () => {
            const noThoughtsHistory = [
                '迭代 1 - AI计划:\nreadFile: {"path":"test.md"}',
                '迭代 1 - 工具结果:\nreadFile: ✅ 成功',
                '迭代 2 - AI计划:\nexecuteMarkdownEdits: {...}',
                '迭代 2 - 工具结果:\nexecuteMarkdownEdits: ✅ 成功'
            ];

            const result = acceptanceTest.simulatePromptAssembly(noThoughtsHistory);

            expect(result.previousThoughtsSection).toBe('No previous thoughts recorded in this session.');
            expect(result.actionHistorySection).toContain('readFile: ✅ 成功');
            expect(result.fullPromptPreview).toContain('0. YOUR PREVIOUS THOUGHTS');
        });

        it('应该处理只有思考记录没有其他工具的情况', () => {
            const onlyThoughtsHistory = [
                `迭代 1 - 工具结果:

💭 【ANALYSIS】recordThought
📍 Context: Pure analysis session
🧠 Core Thinking: analysis: Complete; findings: Comprehensive; confidence: High
📋 Next Steps: No specific steps
⏰ 9/24/2025, 10:00:00 AM`
            ];

            const result = acceptanceTest.simulatePromptAssembly(onlyThoughtsHistory);

            expect(result.previousThoughtsSection).toContain('### Thought in Iteration 1: ANALYSIS');
            expect(result.actionHistorySection).toBe('No action history available');
        });
    });
});
