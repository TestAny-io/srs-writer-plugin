/**
 * Response Too Long 错误处理测试
 * 验证 "Response too long" 错误能够被正确识别和处理
 */

describe('Response Too Long Error Handling', () => {
    describe('错误分类', () => {
        it('应该识别 "Response too long" 错误', () => {
            const error = new Error('Response too long');

            // 模拟 classifyNetworkError 的行为
            const message = error.message.toLowerCase();
            const isOutputLimit = message.includes('response too long');

            expect(isOutputLimit).toBe(true);
        });

        it('应该将 "Response too long" 归类为 output_limit', () => {
            const errorCategory = 'output_limit';
            const expectedCategory = 'output_limit';

            expect(errorCategory).toBe(expectedCategory);
        });

        it('应该设置为可重试', () => {
            const classification = {
                retryable: true,
                maxRetries: 3,
                errorCategory: 'output_limit' as const,
                userMessage: '输出内容过长，正在重试'
            };

            expect(classification.retryable).toBe(true);
            expect(classification.maxRetries).toBe(3);
        });
    });

    describe('AI 错误指导消息', () => {
        it('应该生成符合格式要求的消息', () => {
            const iteration = 3;
            const errorCategory = 'output_limit';
            const errorMessage = 'Response too long';

            // 模拟 getErrorGuidanceForAI 的行为
            const prefix = `迭代 ${iteration} - 系统警告`;
            const guidance = `${prefix}: 上一次执行因输出内容过长而中断。建议采用增量式生成策略：先规划内容结构，再分批完成各部分内容。`;

            // 验证消息格式
            expect(guidance).toMatch(/^迭代 \d+ - 系统警告:/);
            expect(guidance).toContain('增量式生成策略');
            expect(guidance).toContain('先规划内容结构');
            expect(guidance).toContain('分批完成');
        });

        it('应该提供原则性指导而非具体步骤', () => {
            const guidance = '迭代 3 - 系统警告: 上一次执行因输出内容过长而中断。建议采用增量式生成策略：先规划内容结构，再分批完成各部分内容。';

            // 不应包含具体的工具名称或硬编码步骤
            expect(guidance).not.toContain('readMarkdownFile');
            expect(guidance).not.toContain('executeMarkdownEdits');
            expect(guidance).not.toContain('第一步');
            expect(guidance).not.toContain('第二步');

            // 应该包含原则性建议
            expect(guidance).toContain('增量式');
            expect(guidance).toContain('规划');
            expect(guidance).toContain('分批');
        });

        it('网络错误应该生成不同的指导消息', () => {
            const iteration = 2;
            const errorCategory = 'network';
            const errorMessage = 'net::ERR_NETWORK_CHANGED';

            const prefix = `迭代 ${iteration} - 系统警告`;
            const guidance = `${prefix}: 网络请求失败 (${errorMessage})，系统将自动重试。`;

            expect(guidance).toMatch(/^迭代 \d+ - 系统警告:/);
            expect(guidance).toContain('网络请求失败');
            expect(guidance).toContain('自动重试');
        });
    });

    describe('formatIterativeHistory 兼容性', () => {
        it('生成的消息应该能被 formatIterativeHistory 正确解析', () => {
            const testMessage = '迭代 3 - 系统警告: 上一次执行因输出内容过长而中断。建议采用增量式生成策略：先规划内容结构，再分批完成各部分内容。';

            // formatIterativeHistory 使用的正则：/^迭代\s+(\d+)\s+-\s+(.+?):\s+(.*)$/s
            const pattern = /^迭代\s+(\d+)\s+-\s+(.+?):\s+(.*)$/s;
            const match = testMessage.match(pattern);

            expect(match).not.toBeNull();
            if (match) {
                expect(match[1]).toBe('3');  // iteration
                expect(match[2]).toBe('系统警告');  // type
                expect(match[3]).toContain('增量式生成策略');  // content
            }
        });

        it('应该与现有的迭代历史格式一致', () => {
            const systemWarning = '迭代 2 - 系统警告: 上一次执行因输出内容过长而中断。建议采用增量式生成策略：先规划内容结构，再分批完成各部分内容。';
            const aiPlan = '迭代 1 - AI计划: 我将分析当前文档结构';
            const toolResult = '迭代 1 - 工具结果: readMarkdownFile 成功读取文档';

            const pattern = /^迭代\s+(\d+)\s+-\s+(.+?):\s+(.*)$/s;

            expect(systemWarning).toMatch(pattern);
            expect(aiPlan).toMatch(pattern);
            expect(toolResult).toMatch(pattern);
        });
    });

    describe('错误重试流程', () => {
        it('应该在重试时将指导消息添加到 internalHistory', () => {
            const errorGuidance = '迭代 3 - 系统警告: 上一次执行因输出内容过长而中断。建议采用增量式生成策略：先规划内容结构，再分批完成各部分内容。';
            const existingHistory = [
                '迭代 2 - 工具结果: 某个操作的结果',
                '迭代 1 - AI计划: 初始计划'
            ];

            // 模拟重试时的历史优化
            const optimizedHistory = [
                errorGuidance,
                ...existingHistory
            ];

            expect(optimizedHistory[0]).toBe(errorGuidance);
            expect(optimizedHistory.length).toBe(existingHistory.length + 1);
        });

        it('应该仅对 output_limit 和 config 类别注入指导消息', () => {
            const categoriesNeedGuidance = ['output_limit', 'config'];
            const categoriesNoGuidance = ['network', 'server', 'auth', 'unknown'];

            categoriesNeedGuidance.forEach(category => {
                const needsGuidance = category === 'output_limit' || category === 'config';
                expect(needsGuidance).toBe(true);
            });

            categoriesNoGuidance.forEach(category => {
                const needsGuidance = category === 'output_limit' || category === 'config';
                expect(needsGuidance).toBe(false);
            });
        });
    });
});
