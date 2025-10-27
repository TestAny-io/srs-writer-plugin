/**
 * Unit Test: direct_response 行为测试
 * 
 * 测试目标：验证 direct_response 的三种场景是否按预期工作：
 * - 场景A: 只有 direct_response（无工具）→ 对话继续
 * - 场景B: direct_response + tool_calls → 正常工作
 * - finalAnswer: 任务完成 → 对话终止
 */

import { SRSAgentEngine } from '../../core/srsAgentEngine';
import { AgentState } from '../../core/engine/AgentState';
import { AIResponseMode } from '../../types';
import * as vscode from 'vscode';

describe('direct_response 行为测试', () => {
  let engine: SRSAgentEngine;
  let mockStream: any;
  let mockModel: any;

  beforeEach(() => {
    // Mock ChatResponseStream
    mockStream = {
      markdown: jest.fn(),
      progress: jest.fn(),
      reference: jest.fn(),
      push: jest.fn(),
      button: jest.fn()
    };

    // Mock LanguageModelChat
    mockModel = {
      sendRequest: jest.fn()
    };

    // 创建引擎实例
    engine = new SRSAgentEngine(mockStream, mockModel);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('场景A: 只有 direct_response（无工具调用）', () => {

    test('应该设置 awaiting_user 状态', async () => {
      // Mock generatePlan 返回只有 direct_response 的计划
      const plan = {
        thought: 'User is greeting, respond politely',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '你好！有什么可以帮您的吗？',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      // 执行任务
      await engine.executeTask('你好');

      // 验证：state.stage 应该是 awaiting_user
      const state = engine.getState();
      expect(state.stage).toBe('awaiting_user');
    });

    test('应该设置 continue_conversation 类型的 pendingInteraction', async () => {
      const plan = {
        thought: 'Simple greeting',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '你好！',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      await engine.executeTask('你好');

      // 验证：pendingInteraction 类型和内容
      const state = engine.getState();
      expect(state.pendingInteraction).toBeDefined();
      expect(state.pendingInteraction?.type).toBe('continue_conversation');
      expect(state.pendingInteraction?.message).toBeNull();
    });

    test('应该显示 AI 回复', async () => {
      const plan = {
        thought: 'Answering question',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '项目的核心功能包括用户登录、数据管理和报表生成。',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      await engine.executeTask('项目的核心功能有哪些？');

      // 验证：应该调用 stream.markdown 显示回复
      expect(mockStream.markdown).toHaveBeenCalledWith(
        expect.stringContaining('项目的核心功能包括用户登录')
      );
    });

    test('用户继续对话应该恢复执行', async () => {
      // 第一轮：AI 返回 direct_response
      const plan1 = {
        thought: 'Greeting',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '你好！',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValueOnce(plan1);
      await engine.executeTask('你好');

      // 验证进入等待状态
      expect(engine.getState().stage).toBe('awaiting_user');

      // 第二轮：用户继续提问
      const plan2 = {
        thought: 'Answering capability question',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '我可以帮您编写需求文档...',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValueOnce(plan2);
      
      await engine.handleUserResponse('你能做什么？');

      // 验证：currentTask 被更新
      const state = engine.getState();
      expect(state.currentTask).toBe('你能做什么？');
      
      // 验证：应该再次进入 awaiting_user 状态（因为 plan2 也只有 direct_response）
      expect(state.stage).toBe('awaiting_user');
    });

    test('执行历史应该累积保留', async () => {
      // 第一轮对话
      const plan1 = {
        thought: 'First response',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '第一个回复',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValueOnce(plan1);
      await engine.executeTask('问题1');
      
      const history1Length = engine.getState().executionHistory.length;

      // 第二轮对话
      const plan2 = {
        thought: 'Second response',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '第二个回复',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValueOnce(plan2);
      await engine.handleUserResponse('问题2');

      const history2Length = engine.getState().executionHistory.length;

      // 验证：历史应该累积
      expect(history2Length).toBeGreaterThan(history1Length);
    });

    test('迭代计数器应该重置', async () => {
      // 第一轮
      const plan1 = {
        thought: 'First',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '回复1',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValueOnce(plan1);
      await engine.executeTask('问题1');

      // 第二轮
      const plan2 = {
        thought: 'Second',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '回复2',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValueOnce(plan2);
      await engine.handleUserResponse('问题2');

      // 验证：iterationCount 应该被重置
      const state = engine.getState();
      expect(state.iterationCount).toBeLessThan(5); // 不会累积到很大的数字
    });
  });

  describe('场景B: direct_response + tool_calls（回归测试）', () => {

    test('应该先显示进度提示，然后执行工具', async () => {
      const plan = {
        thought: 'Need to search',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '正在搜索相关信息...',
        tool_calls: [
          { name: 'internetSearch', args: { query: '测试查询' } }
        ],
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      // Mock toolExecutor
      const mockExecuteTool = jest.fn().mockResolvedValue({
        success: true,
        result: { content: '搜索结果' }
      });
      (engine as any).toolExecutor = { executeTool: mockExecuteTool };

      await engine.executeTask('什么是FNV？');

      // 验证1：应该显示进度提示
      expect(mockStream.markdown).toHaveBeenCalledWith(
        expect.stringContaining('正在搜索相关信息')
      );

      // 验证2：应该显示"正在搜索更多信息"
      expect(mockStream.markdown).toHaveBeenCalledWith(
        expect.stringContaining('🔍 正在搜索更多信息')
      );

      // 验证3：应该执行工具
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'internetSearch',
        expect.objectContaining({ query: '测试查询' }),
        expect.anything(),
        expect.anything()
      );
    });

    test('执行工具后不应该立即终止对话', async () => {
      const plan = {
        thought: 'Search first',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '搜索中...',
        tool_calls: [
          { name: 'internetSearch', args: { query: 'test' } }
        ],
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      const mockExecuteTool = jest.fn().mockResolvedValue({
        success: true,
        result: { content: '结果' }
      });
      (engine as any).toolExecutor = { executeTool: mockExecuteTool };

      await engine.executeTask('搜索测试');

      // 验证：不应该设置为 completed（场景B应该继续执行）
      const state = engine.getState();
      expect(state.stage).not.toBe('completed');
    });
  });

  describe('finalAnswer 工具（回归测试）', () => {

    test('应该终止对话并设置 completed 状态', async () => {
      const plan = {
        thought: 'Task complete',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        tool_calls: [
          {
            name: 'finalAnswer',
            args: {
              summary: '已完成任务',
              result: '再见！',
              achievements: ['回答了问题'],
              nextSteps: []
            }
          }
        ],
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      // Mock finalAnswer 工具
      const mockExecuteTool = jest.fn().mockResolvedValue({
        success: true,
        result: {
          completed: true,
          summary: '已完成任务',
          result: '再见！',
          achievements: ['回答了问题']
        }
      });
      (engine as any).toolExecutor = { executeTool: mockExecuteTool };

      await engine.executeTask('谢谢');

      // 验证：状态应该是 completed
      const state = engine.getState();
      expect(state.stage).toBe('completed');
    });

    test('应该清除 pendingInteraction', async () => {
      const plan = {
        thought: 'Done',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        tool_calls: [
          {
            name: 'finalAnswer',
            args: {
              summary: '完成',
              result: 'Bye',
              achievements: [],
              nextSteps: []
            }
          }
        ],
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      const mockExecuteTool = jest.fn().mockResolvedValue({
        success: true,
        result: { completed: true, summary: '完成', result: 'Bye', achievements: [] }
      });
      (engine as any).toolExecutor = { executeTool: mockExecuteTool };

      await engine.executeTask('结束');

      // 验证：pendingInteraction 应该为 undefined
      const state = engine.getState();
      expect(state.pendingInteraction).toBeUndefined();
    });
  });

  describe('边界情况测试', () => {

    test('既没有 direct_response 也没有 tool_calls 应该完成', async () => {
      const plan = {
        thought: 'Nothing to do',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: null,
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      await engine.executeTask('空任务');

      // 验证：应该设置为 completed
      const state = engine.getState();
      expect(state.stage).toBe('completed');
    });

    test('空 direct_response 应该视为无效', async () => {
      const plan = {
        thought: 'Empty response',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '',  // 空字符串
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      await engine.executeTask('测试');

      // 验证：空字符串应该被忽略，进入"既没有 direct_response 也没有 tool_calls"的分支
      const state = engine.getState();
      expect(state.stage).toBe('completed');
    });
  });

  describe('InteractionRequest 类型扩展验证', () => {

    test('continue_conversation 类型应该被正确处理', async () => {
      // 第一轮：设置 continue_conversation
      const plan1 = {
        thought: 'Reply',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '测试回复',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValueOnce(plan1);
      await engine.executeTask('测试');

      // 验证 pendingInteraction 结构
      const state1 = engine.getState();
      expect(state1.pendingInteraction).toMatchObject({
        type: 'continue_conversation',
        message: null
      });

      // 第二轮：用户回复应该触发 continue_conversation 处理
      const plan2 = {
        thought: 'Second reply',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '第二个回复',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValueOnce(plan2);
      
      await engine.handleUserResponse('继续提问');

      // 验证：currentTask 被更新
      const state2 = engine.getState();
      expect(state2.currentTask).toBe('继续提问');
      
      // 验证：stage 变为 planning 然后再次变为 awaiting_user
      expect(state2.stage).toBe('awaiting_user');
    });

    test('message 为 null 不应该导致显示 "null"', async () => {
      const plan = {
        thought: 'Test null message',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '测试',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      await engine.executeTask('测试');

      // 验证：markdown 调用中不应包含字符串 "null"
      const markdownCalls = mockStream.markdown.mock.calls.map((call: any) => call[0]);
      const hasNullString = markdownCalls.some((call: string) => 
        call.includes('null') && !call.includes('null 安全') // 排除注释中的 "null"
      );
      
      expect(hasNullString).toBe(false);
    });
  });
});

