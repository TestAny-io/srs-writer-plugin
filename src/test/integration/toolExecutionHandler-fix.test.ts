/**
 * ToolExecutionHandler修复验证测试
 * 验证ToolExecutionHandler不再错误地将失败工具显示为成功
 */

import { ToolExecutionHandler } from '../../core/engine/ToolExecutionHandler';
import { AgentState } from '../../core/engine/AgentState';
import * as vscode from 'vscode';

// Mock VSCode
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: {
                fsPath: '/mock/workspace'
            }
        }]
    },
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            append: jest.fn(),
            clear: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn()
        }))
    }
}));

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

describe('ToolExecutionHandler执行状态修复测试', () => {
    let toolExecutionHandler: ToolExecutionHandler;
    let mockStream: any;
    let mockState: AgentState;
    let mockHasRecentToolExecution: jest.Mock;
    let mockRecordExecution: jest.Mock;
    let mockToolExecutor: any;

    beforeEach(() => {
        toolExecutionHandler = new ToolExecutionHandler();
        
        // Mock stream
        mockStream = {
            markdown: jest.fn()
        };

        // Mock state
        mockState = {
            stage: 'executing',
            currentTask: 'test',
            executionHistory: [],
            iterationCount: 1,
            maxIterations: 5
        } as AgentState;

        // Mock functions
        mockHasRecentToolExecution = jest.fn().mockReturnValue(null);
        mockRecordExecution = jest.fn();

        // Mock toolExecutor
        mockToolExecutor = {
            executeTool: jest.fn()
        };
    });

    it('应该正确处理工具执行失败（不再显示错误的成功信息）', async () => {
        // 模拟工具执行失败的情况
        const failedResult = {
            success: false,
            error: 'File not found: SRS.md',
            output: {
                success: false,
                content: '',
                error: '[_internalReadFile] Failed to read file SRS.md: Error: ENOENT'
            }
        };

        // Mock executeTool返回失败结果
        jest.spyOn(toolExecutionHandler as any, 'executeTool').mockResolvedValue(failedResult);

        const toolCall = {
            name: 'readMarkdownFile',
            args: { path: 'SRS.md' }
        };

        // 执行工具
        await toolExecutionHandler.handleAutonomousTool(
            toolCall,
            mockStream,
            mockState,
            mockHasRecentToolExecution,
            mockRecordExecution,
            mockToolExecutor
        );

        // 验证UI显示正确的失败状态
        expect(mockStream.markdown).toHaveBeenCalledWith(`🔧 **执行工具**: readMarkdownFile\n`);
        expect(mockStream.markdown).toHaveBeenCalledWith(
            expect.stringContaining('❌ **readMarkdownFile** 执行失败')
        );
        expect(mockStream.markdown).toHaveBeenCalledWith(
            expect.stringContaining('File not found: SRS.md')
        );

        // 验证不再显示错误的成功信息
        expect(mockStream.markdown).not.toHaveBeenCalledWith(
            expect.stringContaining('✅ **readMarkdownFile** 执行成功')
        );

        // 验证recordExecution记录了正确的失败状态
        expect(mockRecordExecution).toHaveBeenCalledWith(
            'tool_call',
            expect.stringContaining('readMarkdownFile 执行失败'),
            false, // success应该是false
            'readMarkdownFile',
            failedResult,
            toolCall.args,
            expect.any(Number) // duration
        );
    });

    it('应该正确处理工具执行成功', async () => {
        // 模拟工具执行成功的情况
        const successResult = {
            success: true,
            output: {
                success: true,
                content: '# Test Document\n\nThis is a test.',
                structure: { sectionCount: 1, headings: [] }
            }
        };

        // Mock executeTool返回成功结果
        jest.spyOn(toolExecutionHandler as any, 'executeTool').mockResolvedValue(successResult);

        const toolCall = {
            name: 'readMarkdownFile',
            args: { path: 'test.md' }
        };

        // 执行工具
        await toolExecutionHandler.handleAutonomousTool(
            toolCall,
            mockStream,
            mockState,
            mockHasRecentToolExecution,
            mockRecordExecution,
            mockToolExecutor
        );

        // 验证UI显示正确的成功状态
        expect(mockStream.markdown).toHaveBeenCalledWith(`🔧 **执行工具**: readMarkdownFile\n`);
        expect(mockStream.markdown).toHaveBeenCalledWith(
            expect.stringContaining('✅ **readMarkdownFile** 执行成功')
        );

        // 验证不显示失败信息
        expect(mockStream.markdown).not.toHaveBeenCalledWith(
            expect.stringContaining('❌ **readMarkdownFile** 执行失败')
        );

        // 验证recordExecution记录了正确的成功状态
        expect(mockRecordExecution).toHaveBeenCalledWith(
            'tool_call',
            expect.stringContaining('readMarkdownFile 执行成功'),
            true, // success应该是true
            'readMarkdownFile',
            successResult,
            toolCall.args,
            expect.any(Number) // duration
        );
    });

    it('应该不再重复记录工具执行（只记录最终结果）', async () => {
        const successResult = {
            success: true,
            output: { result: 'test' }
        };

        jest.spyOn(toolExecutionHandler as any, 'executeTool').mockResolvedValue(successResult);

        const toolCall = {
            name: 'testTool',
            args: { test: 'value' }
        };

        await toolExecutionHandler.handleAutonomousTool(
            toolCall,
            mockStream,
            mockState,
            mockHasRecentToolExecution,
            mockRecordExecution,
            mockToolExecutor
        );

        // 验证只记录了一次（最终结果），没有开始时的记录
        expect(mockRecordExecution).toHaveBeenCalledTimes(1);
        expect(mockRecordExecution).toHaveBeenCalledWith(
            'tool_call',
            expect.stringContaining('testTool 执行成功'),
            true,
            'testTool',
            successResult,
            toolCall.args,
            expect.any(Number)
        );

        // 验证没有"开始执行工具"的记录
        expect(mockRecordExecution).not.toHaveBeenCalledWith(
            'tool_call',
            expect.stringContaining('开始执行工具'),
            undefined,
            expect.any(String),
            undefined,
            expect.any(Object)
        );
    });

    it('应该正确处理异常情况', async () => {
        // Mock executeTool抛出异常
        jest.spyOn(toolExecutionHandler as any, 'executeTool').mockRejectedValue(
            new Error('Network connection failed')
        );

        const toolCall = {
            name: 'readMarkdownFile',
            args: { path: 'test.md' }
        };

        await toolExecutionHandler.handleAutonomousTool(
            toolCall,
            mockStream,
            mockState,
            mockHasRecentToolExecution,
            mockRecordExecution,
            mockToolExecutor
        );

        // 验证显示异常错误
        expect(mockStream.markdown).toHaveBeenCalledWith(
            expect.stringContaining('❌ **readMarkdownFile** 执行失败')
        );
        expect(mockStream.markdown).toHaveBeenCalledWith(
            expect.stringContaining('Network connection failed')
        );

        // 验证记录了异常状态
        expect(mockRecordExecution).toHaveBeenCalledWith(
            'tool_call',
            expect.stringContaining('readMarkdownFile 执行失败'),
            false,
            'readMarkdownFile',
            expect.objectContaining({
                error: 'Network connection failed'
            }),
            toolCall.args,
            expect.any(Number),
            'EXECUTION_FAILED'
        );
    });
});