/**
 * Stage Completion Logic 测试
 *
 * 测试目标：确保在 KNOWLEDGE_QA 和 TOOL_EXECUTION 模式下，
 * 只有 finalAnswer 工具会设置 stage = 'completed'
 */

import { SRSAgentEngine } from '../../core/srsAgentEngine';
import { AIResponseMode } from '../../types';
import * as vscode from 'vscode';

// Mock VSCode
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }]
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

describe('Stage Completion Logic - KNOWLEDGE_QA & TOOL_EXECUTION 模式', () => {
  let engine: SRSAgentEngine;
  let mockStream: any;
  let mockModel: any;
  let mockOrchestrator: any;
  let mockToolExecutor: any;

  beforeEach(() => {
    // Mock stream
    mockStream = {
      markdown: jest.fn(),
      progress: jest.fn()
    };

    // Mock model
    mockModel = {
      sendRequest: jest.fn()
    };

    // 创建 engine 实例
    engine = new SRSAgentEngine(mockStream, mockModel);

    // Mock orchestrator
    mockOrchestrator = {
      plan: jest.fn(),
      planAndExecute: jest.fn()
    };

    // Mock toolExecutor
    mockToolExecutor = {
      executeTool: jest.fn()
    };

    engine.setDependencies(mockOrchestrator, mockToolExecutor);
  });

  // =========================================================================
  // KNOWLEDGE_QA 模式测试
  // =========================================================================

  describe('KNOWLEDGE_QA 模式', () => {
    it('KQ-1: 只有 direct_response，应该继续循环而不是 completed', async () => {
      // Mock orchestrator 返回两次 plan
      mockOrchestrator.plan
        .mockResolvedValueOnce({
          // 第一次：只有 direct_response
          thought: 'AI thinking...',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: '这是一个知识问答的回复',
          tool_calls: []
        })
        .mockResolvedValueOnce({
          // 第二次：调用 finalAnswer
          thought: 'Task complete',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: null,
          tool_calls: [{ name: 'finalAnswer', args: { summary: '完成' } }]
        });

      mockToolExecutor.executeTool.mockResolvedValue({
        success: true,
        result: { summary: '任务完成' }
      });

      await engine.executeTask('测试 KQ-1');

      const state = engine.getState();

      // 验证：应该是 completed（因为最终调用了 finalAnswer）
      expect(state.stage).toBe('completed');

      // 验证：orchestrator.plan 被调用了两次
      expect(mockOrchestrator.plan).toHaveBeenCalledTimes(2);

      // 验证：第一次的 direct_response 被显示了
      expect(mockStream.markdown).toHaveBeenCalledWith(
        expect.stringContaining('这是一个知识问答的回复')
      );
    });

    it('KQ-2: 空响应（既没有 direct_response 也没有 tool_calls），应该进入 error 状态', async () => {
      // Mock orchestrator 连续返回空 plan
      mockOrchestrator.plan.mockResolvedValue({
        thought: 'Empty response',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: null,
        tool_calls: []
      });

      await engine.executeTask('测试 KQ-2');

      const state = engine.getState();

      // 验证：第三次空响应后应该进入 error 状态（修改后的行为）
      expect(state.stage).toBe('error');

      // 验证：显示了错误信息
      expect(mockStream.markdown).toHaveBeenCalledWith(
        expect.stringContaining('AI 无法继续处理此任务')
      );
    });

    it('KQ-3: 调用 non-finalAnswer 工具后继续循环，最终调用 finalAnswer', async () => {
      let callCount = 0;

      mockOrchestrator.plan.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // 第一次：调用 internetSearch
          return {
            thought: 'Need to search',
            response_mode: AIResponseMode.KNOWLEDGE_QA,
            direct_response: null,
            tool_calls: [{ name: 'internetSearch', args: { query: 'test' } }]
          };
        } else if (callCount === 2) {
          // 第二次：调用 finalAnswer
          return {
            thought: 'Task complete',
            response_mode: AIResponseMode.KNOWLEDGE_QA,
            direct_response: null,
            tool_calls: [{ name: 'finalAnswer', args: { summary: '完成' } }]
          };
        }
      });

      mockToolExecutor.executeTool.mockResolvedValue({
        success: true,
        result: { data: 'search result' }
      });

      await engine.executeTask('测试 KQ-3');

      const state = engine.getState();

      // 验证：最终是 completed
      expect(state.stage).toBe('completed');

      // 验证：两个工具都被执行了
      expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
        'internetSearch',
        expect.any(Object),
        expect.any(String),
        expect.any(Object)
      );
      expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
        'finalAnswer',
        expect.any(Object),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('KQ-4: direct_response + tool_calls，应该显示回复后继续执行工具', async () => {
      mockOrchestrator.plan
        .mockResolvedValueOnce({
          thought: 'AI thinking...',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: '我先给你一个初步回答',
          tool_calls: [{ name: 'internetSearch', args: { query: 'test' } }]
        })
        .mockResolvedValueOnce({
          thought: 'Task complete',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: null,
          tool_calls: [{ name: 'finalAnswer', args: { summary: '完成' } }]
        });

      mockToolExecutor.executeTool.mockResolvedValue({
        success: true,
        result: { data: 'result' }
      });

      await engine.executeTask('测试 KQ-4');

      const state = engine.getState();

      // 验证：最终是 completed
      expect(state.stage).toBe('completed');

      // 验证：显示了初步回复
      expect(mockStream.markdown).toHaveBeenCalledWith(
        expect.stringContaining('我先给你一个初步回答')
      );

      // 验证：执行了搜索工具
      expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
        'internetSearch',
        expect.any(Object),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // TOOL_EXECUTION 模式测试
  // =========================================================================

  describe('TOOL_EXECUTION 模式', () => {
    it('TE-1: 调用 finalAnswer 工具，应该设置 completed', async () => {
      mockOrchestrator.plan.mockResolvedValue({
        thought: 'Task complete',
        response_mode: AIResponseMode.TOOL_EXECUTION,
        direct_response: null,
        tool_calls: [{ name: 'finalAnswer', args: { summary: '完成' } }]
      });

      mockToolExecutor.executeTool.mockResolvedValue({
        success: true,
        result: { summary: '任务完成' }
      });

      await engine.executeTask('测试 TE-1');

      const state = engine.getState();

      // 验证：应该是 completed
      expect(state.stage).toBe('completed');
    });

    it('TE-2: 没有 tool_calls，应该继续循环而不是 completed', async () => {
      let callCount = 0;

      mockOrchestrator.plan.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // 第一次：没有 tool_calls
          return {
            thought: 'Still thinking...',
            response_mode: AIResponseMode.TOOL_EXECUTION,
            direct_response: null,
            tool_calls: []
          };
        } else if (callCount === 2) {
          // 第二次：调用 finalAnswer
          return {
            thought: 'Task complete',
            response_mode: AIResponseMode.TOOL_EXECUTION,
            direct_response: null,
            tool_calls: [{ name: 'finalAnswer', args: { summary: '完成' } }]
          };
        }
      });

      mockToolExecutor.executeTool.mockResolvedValue({
        success: true,
        result: { summary: '任务完成' }
      });

      await engine.executeTask('测试 TE-2');

      const state = engine.getState();

      // 验证：最终是 completed
      expect(state.stage).toBe('completed');

      // 验证：plan 被调用了两次
      expect(mockOrchestrator.plan).toHaveBeenCalledTimes(2);
    });

    it('TE-3: 调用 non-finalAnswer 工具，应该继续循环', async () => {
      let callCount = 0;

      mockOrchestrator.plan.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // 第一次：调用 readMarkdownFile
          return {
            thought: 'Reading file',
            response_mode: AIResponseMode.TOOL_EXECUTION,
            direct_response: null,
            tool_calls: [{ name: 'readMarkdownFile', args: { path: 'test.md' } }]
          };
        } else if (callCount === 2) {
          // 第二次：调用 finalAnswer
          return {
            thought: 'Task complete',
            response_mode: AIResponseMode.TOOL_EXECUTION,
            direct_response: null,
            tool_calls: [{ name: 'finalAnswer', args: { summary: '完成' } }]
          };
        }
      });

      mockToolExecutor.executeTool.mockResolvedValue({
        success: true,
        result: { content: 'file content' }
      });

      await engine.executeTask('测试 TE-3');

      const state = engine.getState();

      // 验证：最终是 completed
      expect(state.stage).toBe('completed');

      // 验证：两个工具都被执行了
      expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
        'readMarkdownFile',
        expect.any(Object),
        expect.any(String),
        expect.any(Object)
      );
      expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
        'finalAnswer',
        expect.any(Object),
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // 边界情况测试
  // =========================================================================

  describe('边界情况', () => {
    it('达到最大迭代次数后应该停止', async () => {
      // Mock orchestrator 一直返回空响应
      mockOrchestrator.plan.mockResolvedValue({
        thought: 'Still thinking...',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: null,
        tool_calls: []
      });

      await engine.executeTask('测试最大迭代');

      const state = engine.getState();

      // 验证：达到最大迭代后停止（应该是 error 状态）
      expect(state.iterationCount).toBeGreaterThanOrEqual(3);
      expect(['completed', 'error']).toContain(state.stage);
    });

    it('工具执行失败后应该继续循环，直到调用 finalAnswer', async () => {
      let callCount = 0;

      mockOrchestrator.plan.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            thought: 'Try to read file',
            response_mode: AIResponseMode.TOOL_EXECUTION,
            direct_response: null,
            tool_calls: [{ name: 'readMarkdownFile', args: { path: 'nonexistent.md' } }]
          };
        } else {
          return {
            thought: 'Task complete',
            response_mode: AIResponseMode.TOOL_EXECUTION,
            direct_response: null,
            tool_calls: [{ name: 'finalAnswer', args: { summary: '完成' } }]
          };
        }
      });

      mockToolExecutor.executeTool
        .mockResolvedValueOnce({
          // 第一次失败
          success: false,
          error: 'File not found'
        })
        .mockResolvedValueOnce({
          // 第二次成功
          success: true,
          result: { summary: '任务完成' }
        });

      await engine.executeTask('测试工具失败');

      const state = engine.getState();

      // 验证：最终是 completed
      expect(state.stage).toBe('completed');
    });
  });
});
