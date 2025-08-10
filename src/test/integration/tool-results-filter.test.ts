import { ContextManager } from '../../core/engine/ContextManager';
import { ExecutionStep } from '../../core/engine/AgentState';
import { Logger } from '../../utils/logger';

/**
 * 测试Tool Results Context过滤机制
 * 验证Turn级窗口过滤和数量限制是否正确工作
 */
describe('Tool Results Filter Integration Test', () => {
    let contextManager: ContextManager;
    let logger: Logger;

    beforeEach(() => {
        logger = Logger.getInstance();
        contextManager = new ContextManager();
    });

    describe('Turn-based Window Filtering', () => {
        it('should keep tool results from recent 4 turns only', () => {
            // Arrange: 构建包含6个Turn的执行历史
            const executionHistory: ExecutionStep[] = [
                // Turn 1 (较老，应该被过滤掉)
                { type: 'result', content: '--- 新任务开始: 任务1 ---', timestamp: Date.now() - 6000, success: true },
                { type: 'tool_call', content: 'Tool call 1', toolName: 'readFile1', result: { data: 'old data 1' }, timestamp: Date.now() - 5900, success: true },
                { type: 'tool_call', content: 'Tool call 2', toolName: 'writeFile1', result: { data: 'old data 2' }, timestamp: Date.now() - 5800, success: true },

                // Turn 2 (较老，应该被过滤掉)
                { type: 'result', content: '--- 新任务开始: 任务2 ---', timestamp: Date.now() - 5000, success: true },
                { type: 'tool_call', content: 'Tool call 3', toolName: 'readFile2', result: { data: 'old data 3' }, timestamp: Date.now() - 4900, success: true },

                // Turn 3 (应该保留)
                { type: 'result', content: '--- 新任务开始: 任务3 ---', timestamp: Date.now() - 4000, success: true },
                { type: 'tool_call', content: 'Tool call 4', toolName: 'readFile3', result: { data: 'recent data 1' }, timestamp: Date.now() - 3900, success: true },
                { type: 'tool_call', content: 'Tool call 5', toolName: 'writeFile3', result: { data: 'recent data 2' }, timestamp: Date.now() - 3800, success: true },

                // Turn 4 (应该保留)
                { type: 'result', content: '--- 新任务开始: 任务4 ---', timestamp: Date.now() - 3000, success: true },
                { type: 'tool_call', content: 'Tool call 6', toolName: 'editFile4', result: { data: 'recent data 3' }, timestamp: Date.now() - 2900, success: true },

                // Turn 5 (应该保留)
                { type: 'result', content: '--- 新任务开始: 任务5 ---', timestamp: Date.now() - 2000, success: true },
                { type: 'tool_call', content: 'Tool call 7', toolName: 'readFile5', result: { data: 'recent data 4' }, timestamp: Date.now() - 1900, success: true },
                { type: 'tool_call', content: 'Tool call 8', toolName: 'writeFile5', result: { data: 'recent data 5' }, timestamp: Date.now() - 1800, success: true },

                // Turn 6 (应该保留)
                { type: 'result', content: '--- 新任务开始: 任务6 ---', timestamp: Date.now() - 1000, success: true },
                { type: 'tool_call', content: 'Tool call 9', toolName: 'editFile6', result: { data: 'recent data 6' }, timestamp: Date.now() - 900, success: true },
                { type: 'tool_call', content: 'Tool call 10', toolName: 'askQuestion', result: { data: 'recent data 7' }, timestamp: Date.now() - 800, success: true }
            ];

            // Act: 构建上下文
            const { toolResultsContext } = (contextManager as any).buildContextForPrompt(executionHistory, '当前任务');

            // Assert: 验证只保留了最近4个Turn的工具结果
            expect(toolResultsContext).toContain('readFile3');  // Turn 3
            expect(toolResultsContext).toContain('writeFile3'); // Turn 3
            expect(toolResultsContext).toContain('editFile4');  // Turn 4
            expect(toolResultsContext).toContain('readFile5');  // Turn 5
            expect(toolResultsContext).toContain('writeFile5'); // Turn 5
            expect(toolResultsContext).toContain('editFile6');  // Turn 6
            expect(toolResultsContext).toContain('askQuestion'); // Turn 6

            // 验证老的Turn结果被过滤掉
            expect(toolResultsContext).not.toContain('readFile1');  // Turn 1 (应该被过滤)
            expect(toolResultsContext).not.toContain('writeFile1'); // Turn 1 (应该被过滤)
            expect(toolResultsContext).not.toContain('readFile2');  // Turn 2 (应该被过滤)

            // 验证最终结果包含7个工具结果 (Turn 3-6的所有工具)
            const resultCount = (toolResultsContext.match(/### Result of `/g) || []).length;
            expect(resultCount).toBe(7);
        });

        it('should apply count limit when turn window contains too many results', () => {
            // Arrange: 构建一个Turn内包含超过10个工具结果的历史
            const executionHistory: ExecutionStep[] = [
                { type: 'result', content: '--- 新任务开始: 大量工具任务 ---', timestamp: Date.now() - 1000, success: true }
            ];

            // 添加15个工具调用结果
            for (let i = 1; i <= 15; i++) {
                executionHistory.push({
                    type: 'tool_call',
                    content: `Tool call ${i}`,
                    toolName: `tool${i}`,
                    result: { data: `result ${i}` },
                    timestamp: Date.now() - (1000 - i * 10),
                    success: true
                });
            }

            // Act: 构建上下文
            const { toolResultsContext } = (contextManager as any).buildContextForPrompt(executionHistory, '当前任务');

            // Assert: 验证只保留了最近10个工具结果 (tool6到tool15)
            const resultCount = (toolResultsContext.match(/### Result of `/g) || []).length;
            expect(resultCount).toBe(10);

            // 验证保留的是最近的10个
            expect(toolResultsContext).toContain('### Result of `tool15`');
            expect(toolResultsContext).toContain('### Result of `tool14`');
            expect(toolResultsContext).toContain('### Result of `tool13`');
            expect(toolResultsContext).toContain('### Result of `tool6`');  // 第10个
            
            // 验证最老的5个被过滤掉
            expect(toolResultsContext).not.toContain('### Result of `tool1`');
            expect(toolResultsContext).not.toContain('### Result of `tool2`');
            expect(toolResultsContext).not.toContain('### Result of `tool3`');
            expect(toolResultsContext).not.toContain('### Result of `tool4`');
            expect(toolResultsContext).not.toContain('### Result of `tool5`');
        });

        it('should handle case with no turn boundaries gracefully', () => {
            // Arrange: 没有Turn边界标记的执行历史
            const executionHistory: ExecutionStep[] = [
                { type: 'tool_call', content: 'Tool call 1', toolName: 'standalone1', result: { data: 'data 1' }, timestamp: Date.now() - 500, success: true },
                { type: 'tool_call', content: 'Tool call 2', toolName: 'standalone2', result: { data: 'data 2' }, timestamp: Date.now() - 400, success: true },
                { type: 'tool_call', content: 'Tool call 3', toolName: 'standalone3', result: { data: 'data 3' }, timestamp: Date.now() - 300, success: true }
            ];

            // Act: 构建上下文
            const { toolResultsContext } = (contextManager as any).buildContextForPrompt(executionHistory, '当前任务');

            // Assert: 应该保留所有工具结果（因为都在数量限制内）
            const resultCount = (toolResultsContext.match(/### Result of `/g) || []).length;
            expect(resultCount).toBe(3);

            expect(toolResultsContext).toContain('standalone1');
            expect(toolResultsContext).toContain('standalone2');
            expect(toolResultsContext).toContain('standalone3');
        });

        it('should handle empty execution history', () => {
            // Arrange: 空的执行历史
            const executionHistory: ExecutionStep[] = [];

            // Act: 构建上下文
            const { toolResultsContext } = (contextManager as any).buildContextForPrompt(executionHistory, '当前任务');

            // Assert: 应该没有工具结果
            expect(toolResultsContext).toBe('');
        });
    });

    describe('Edge Cases', () => {
        it('should preserve tool results order within the filtered set', () => {
            // Arrange: 有序的工具调用
            const executionHistory: ExecutionStep[] = [
                { type: 'result', content: '--- 新任务开始: 顺序测试 ---', timestamp: Date.now() - 1000, success: true },
                { type: 'tool_call', content: 'First tool', toolName: 'first', result: { order: 1 }, timestamp: Date.now() - 900, success: true },
                { type: 'tool_call', content: 'Second tool', toolName: 'second', result: { order: 2 }, timestamp: Date.now() - 800, success: true },
                { type: 'tool_call', content: 'Third tool', toolName: 'third', result: { order: 3 }, timestamp: Date.now() - 700, success: true }
            ];

            // Act: 构建上下文
            const { toolResultsContext } = (contextManager as any).buildContextForPrompt(executionHistory, '当前任务');

            // Assert: 验证顺序保持不变
            const firstIndex = toolResultsContext.indexOf('first');
            const secondIndex = toolResultsContext.indexOf('second');
            const thirdIndex = toolResultsContext.indexOf('third');

            expect(firstIndex).toBeLessThan(secondIndex);
            expect(secondIndex).toBeLessThan(thirdIndex);
        });

        it('should handle malformed turn boundary markers', () => {
            // Arrange: 包含格式错误的Turn边界标记
            const executionHistory: ExecutionStep[] = [
                { type: 'result', content: '--- 新任务开始', timestamp: Date.now() - 1000, success: true }, // 缺少冒号和结尾
                { type: 'result', content: '新任务开始: 正常任务 ---', timestamp: Date.now() - 900, success: true }, // 缺少前缀
                { type: 'result', content: '--- 新任务开始: 正确任务 ---', timestamp: Date.now() - 800, success: true }, // 正确格式
                { type: 'tool_call', content: 'Tool call', toolName: 'correctTool', result: { data: 'data' }, timestamp: Date.now() - 700, success: true }
            ];

            // Act: 构建上下文
            const { toolResultsContext } = (contextManager as any).buildContextForPrompt(executionHistory, '当前任务');

            // Assert: 应该只识别正确格式的边界标记
            expect(toolResultsContext).toContain('correctTool');
        });
    });
});