/**
 * 执行状态一致性测试
 * 验证修复后的historyContext和toolResultsContext状态一致性问题
 */

import { ContextManager } from '../../core/engine/ContextManager';
import { ExecutionStep } from '../../core/engine/AgentState';

// Mock Logger
jest.mock('../../utils/logger', () => ({
    Logger: {
        getInstance: () => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        })
    }
}));

describe('执行状态一致性测试', () => {
    let contextManager: ContextManager;

    beforeEach(() => {
        contextManager = new ContextManager();
    });

    it('应该正确处理工具执行失败的状态（不再重复记录）', () => {
        // 模拟修复后的执行历史：只有最终结果记录，没有重复的开始记录
        const executionHistory: ExecutionStep[] = [
            {
                type: 'thought',
                content: 'The user suspects that the contents of requirements.yaml and SRS.md are inconsistent...',
                timestamp: Date.now(),
                iteration: 1
            },
            {
                type: 'tool_call',
                content: 'readMarkdownFile 执行失败: [_internalReadFile] Failed to read file SRS.md: Error: ENOENT: no such file or directory',
                timestamp: Date.now(),
                toolName: 'readMarkdownFile',
                success: false,  // 👈 修复后：失败状态正确记录
                result: {
                    success: false,
                    content: '',
                    error: '[_internalReadFile] Failed to read file SRS.md: Error: ENOENT: no such file or directory, open \'/Users/kailaichen/Downloads/Source Code/srs-vscode-test/SRS.md\''
                },
                args: { path: 'SRS.md' },
                duration: 8,
                iteration: 1
            },
            {
                type: 'tool_call',
                content: 'readYAMLFiles 执行成功',
                timestamp: Date.now(),
                toolName: 'readYAMLFiles',
                success: true,  
                result: {
                    success: true,
                    content: 'yaml content...',
                    parsedData: { some: 'data' }
                },
                args: { path: 'requirements.yaml' },
                duration: 10,
                iteration: 1
            }
        ];

        const { historyContext, toolResultsContext } = contextManager.buildContextForPrompt(executionHistory);

        // 验证historyContext正确反映工具状态
        expect(historyContext).toContain('readMarkdownFile - ❌ Failed');
        expect(historyContext).toContain('readYAMLFiles - ✅ Succeeded');
        
        // 验证toolResultsContext包含实际的失败信息
        // 注意：formatToolResultForContext会优先使用result.error字段
        expect(toolResultsContext).toContain('ENOENT: no such file or directory');
        
        // 验证不再有重复记录
        const failedToolMatches = historyContext.match(/readMarkdownFile/g);
        expect(failedToolMatches).toHaveLength(1); // 只出现一次，不再重复
    });

    it('应该正确处理成功工具的状态记录', () => {
        const executionHistory: ExecutionStep[] = [
            {
                type: 'tool_call',
                content: 'readMarkdownFile 执行成功',
                timestamp: Date.now(),
                toolName: 'readMarkdownFile',
                success: true,
                result: {
                    success: true,
                    content: '# Test Document\n\nThis is a test.',
                    structure: { sectionCount: 1, headings: [] }
                },
                args: { path: 'test.md' },
                duration: 15,
                iteration: 1
            }
        ];

        const { historyContext, toolResultsContext } = contextManager.buildContextForPrompt(executionHistory);

        // 验证成功状态的一致性
        expect(historyContext).toContain('readMarkdownFile - ✅ Succeeded');
        expect(toolResultsContext).toContain('"success": true');
        expect(toolResultsContext).toContain('This is a test');
    });

    it('应该正确处理混合成功/失败状态', () => {
        const executionHistory: ExecutionStep[] = [
            {
                type: 'tool_call',
                content: 'readMarkdownFile 执行失败: File not found',
                timestamp: Date.now(),
                toolName: 'readMarkdownFile',
                success: false,
                result: { success: false, error: 'File not found' },
                args: { path: 'missing.md' },
                duration: 5,
                iteration: 1
            },
            {
                type: 'tool_call',
                content: 'readYAMLFiles 执行成功',
                timestamp: Date.now(),
                toolName: 'readYAMLFiles',
                success: true,
                result: { success: true, content: 'yaml: data' },
                args: { path: 'config.yaml' },
                duration: 12,
                iteration: 1
            }
        ];

        const { historyContext, toolResultsContext } = contextManager.buildContextForPrompt(executionHistory);

        // 验证混合状态都正确反映
        expect(historyContext).toContain('readMarkdownFile - ❌ Failed');
        expect(historyContext).toContain('readYAMLFiles - ✅ Succeeded');
        
        // 验证工具结果上下文包含两个工具的正确状态
        expect(toolResultsContext).toContain('### Result of `readMarkdownFile`');
        expect(toolResultsContext).toContain('### Result of `readYAMLFiles`');
        expect(toolResultsContext).toContain('File not found'); // 失败工具的错误信息
        expect(toolResultsContext).toContain('"success": true'); // 成功工具的完整JSON
    });

    it('应该不再将undefined success视为成功', () => {
        // 测试边界情况：如果仍有undefined success的记录
        const executionHistory: ExecutionStep[] = [
            {
                type: 'tool_call',
                content: 'Some tool operation',
                timestamp: Date.now(),
                toolName: 'someTool',
                success: undefined,  // 未定义状态
                result: { some: 'result' },
                args: { param: 'value' },
                iteration: 1
            }
        ];

        const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

        // 验证undefined不再被错误地视为成功
        expect(historyContext).not.toContain('someTool - ✅ Succeeded');
        // 应该显示为Failed或者被过滤掉
        expect(historyContext).toContain('someTool - ❌ Failed');
    });

    it('应该正确显示工具执行时长', () => {
        const executionHistory: ExecutionStep[] = [
            {
                type: 'tool_call',
                content: 'readMarkdownFile 执行成功',
                timestamp: Date.now(),
                toolName: 'readMarkdownFile',
                success: true,
                result: { success: true, content: 'test' },
                args: { path: 'test.md' },
                duration: 123,  // 明确的执行时长
                iteration: 1
            }
        ];

        const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

        // 验证时长信息被正确包含
        expect(historyContext).toContain('readMarkdownFile - ✅ Succeeded (123ms)');
    });

    it('应该正确处理空的执行历史', () => {
        const executionHistory: ExecutionStep[] = [];

        const { historyContext, toolResultsContext } = contextManager.buildContextForPrompt(executionHistory);

        expect(historyContext).toBe('No previous interactions.');
        expect(toolResultsContext).toBe('');
    });
});