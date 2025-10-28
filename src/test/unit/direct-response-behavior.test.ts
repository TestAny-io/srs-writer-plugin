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
import { SessionManager } from '../../core/session-manager';

// 🚀 Mock SessionManager
jest.mock('../../core/session-manager');

describe('direct_response 行为测试', () => {
  let engine: SRSAgentEngine;
  let mockStream: any;
  let mockModel: any;
  let mockSessionManager: any;

  beforeEach(() => {
    // Mock SessionManager
    mockSessionManager = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      getSessionContext: jest.fn().mockReturnValue({
        sessionContextId: 'test-session',
        projectName: 'test-project',
        baseDir: '/test/base'
      })
    };

    (SessionManager.getInstance as jest.Mock).mockReturnValue(mockSessionManager);

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
        undefined,  // sessionContext 参数
        expect.anything()  // model 参数
      );
    });

    test('执行工具后不应该立即终止对话', async () => {
      // 第一轮：有工具调用
      const plan1 = {
        thought: 'Search first',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '搜索中...',
        tool_calls: [
          { name: 'internetSearch', args: { query: 'test' } }
        ],
        execution_plan: null
      };

      // 第二轮：根据结果回复
      const plan2 = {
        thought: 'Provide answer based on search',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '根据搜索结果...',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan')
        .mockResolvedValueOnce(plan1)
        .mockResolvedValueOnce(plan2);

      const mockExecuteTool = jest.fn().mockResolvedValue({
        success: true,
        result: { content: '结果' }
      });
      (engine as any).toolExecutor = { executeTool: mockExecuteTool };

      await engine.executeTask('搜索测试');

      // 验证：应该执行了工具
      expect(mockExecuteTool).toHaveBeenCalled();

      // 验证：最终进入 awaiting_user（等待用户继续对话）
      const state = engine.getState();
      expect(state.stage).toBe('awaiting_user');
      expect(state.pendingInteraction?.type).toBe('continue_conversation');
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

    test('首次空响应应该继续循环（重试机制）', async () => {
      const plan = {
        thought: 'Nothing to do',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: null,
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      await engine.executeTask('空任务');

      // 验证：首次空响应应该记录并继续循环
      const state = engine.getState();

      // 检查 executionHistory 中应该有空响应的记录
      const emptyPlanSteps = state.executionHistory.filter(step =>
        step.content && step.content.includes('Orchestrator返回空plan')
      );
      expect(emptyPlanSteps.length).toBeGreaterThanOrEqual(1);
    });

    test('连续2次空响应应该进入error状态', async () => {
      const plan = {
        thought: 'Empty',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: null,
        tool_calls: null,
        execution_plan: null
      };

      // Mock 返回空响应多次
      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      await engine.executeTask('测试连续空响应');

      // 验证：连续空响应应该进入error状态
      const state = engine.getState();
      expect(state.stage).toBe('error');
    });

    test('空字符串 direct_response 应该被视为空响应', async () => {
      const plan = {
        thought: 'Empty response',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '',  // 空字符串
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      await engine.executeTask('测试');

      // 验证：空字符串应该被视为空响应，记录并继续循环
      const state = engine.getState();
      const emptyPlanSteps = state.executionHistory.filter(step =>
        step.content && step.content.includes('Orchestrator返回空plan')
      );
      expect(emptyPlanSteps.length).toBeGreaterThanOrEqual(1);
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
        thought: 'Testing that pendingInteraction.message being nil does not show the string representation',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '测试响应',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      await engine.executeTask('测试');

      // 验证：pendingInteraction 应该被设置
      const state = engine.getState();
      expect(state.pendingInteraction).toBeDefined();
      expect(state.pendingInteraction?.message).toBeNull();

      // 验证：markdown 调用中不应包含 JavaScript null 值的字符串表示
      // 只检查非思考内容的markdown输出
      const markdownCalls = mockStream.markdown.mock.calls.map((call: any) => call[0]);
      const nonThoughtCalls = markdownCalls.filter((call: string) =>
        !call.includes('🤖 **AI思考**')
      );

      // 检查是否有 "message: null" 或类似的模式（表示未正确处理null值）
      const hasLiteralNull = nonThoughtCalls.some((call: string) =>
        /message[:\s]+null|:\s+null\b/.test(call)
      );

      expect(hasLiteralNull).toBe(false);
    });
  });
});

