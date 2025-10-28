/**
 * Integration Test: 对话流程集成测试
 * 
 * 测试目标：验证 direct_response 修复后的完整对话流程
 */

import { SRSAgentEngine } from '../../core/srsAgentEngine';
import { AIResponseMode } from '../../types';
import * as vscode from 'vscode';
import { SessionManager } from '../../core/session-manager';

// 🚀 Mock SessionManager
jest.mock('../../core/session-manager');

describe('对话流程集成测试', () => {
  let engine: SRSAgentEngine;
  let mockStream: any;
  let mockModel: any;
  let mockSessionManager: any;
  let planSequence: any[];
  let planIndex: number;

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

    engine = new SRSAgentEngine(mockStream, mockModel);
    planSequence = [];
    planIndex = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('多轮简单问答场景', () => {

    test('应该保持对话上下文并正确流转', async () => {
      // 定义对话序列
      planSequence = [
        // 第1轮：用户问候
        {
          thought: 'User greeting',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: '你好！有什么可以帮您的吗？',
          tool_calls: null,
          execution_plan: null
        },
        // 第2轮：用户询问能力
        {
          thought: 'Explain capabilities',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: '我可以帮您编写专业的需求文档，包括SRS、用户故事等。',
          tool_calls: null,
          execution_plan: null
        },
        // 第3轮：用户表示感谢并结束
        {
          thought: 'User wants to end',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          tool_calls: [
            {
              name: 'finalAnswer',
              args: {
                summary: '完成简单问答对话',
                result: '不客气！随时来找我。',
                achievements: ['回答了问候', '介绍了功能'],
                nextSteps: []
              }
            }
          ],
          execution_plan: null
        }
      ];

      // Mock generatePlan 按序列返回
      jest.spyOn(engine as any, 'generatePlan').mockImplementation(() => {
        return Promise.resolve(planSequence[planIndex++]);
      });

      // Mock finalAnswer 工具
      const mockExecuteTool = jest.fn().mockResolvedValue({
        success: true,
        result: {
          completed: true,
          summary: '完成简单问答对话',
          result: '不客气！随时来找我。',
          achievements: ['回答了问候', '介绍了功能']
        }
      });
      (engine as any).toolExecutor = { executeTool: mockExecuteTool };

      // 第1轮：用户问候
      await engine.executeTask('你好');
      expect(engine.getState().stage).toBe('awaiting_user');
      expect(engine.getState().pendingInteraction?.type).toBe('continue_conversation');

      // 第2轮：用户继续提问
      await engine.handleUserResponse('你能做什么？');
      expect(engine.getState().stage).toBe('awaiting_user');
      expect(engine.getState().currentTask).toBe('你能做什么？');

      // 第3轮：用户结束对话
      await engine.handleUserResponse('谢谢');
      expect(engine.getState().stage).toBe('completed');
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'finalAnswer',
        expect.objectContaining({ summary: '完成简单问答对话' }),
        undefined,  // sessionContext 参数
        expect.anything()  // model 参数
      );
    });

    test('执行历史应该在多轮对话中累积', async () => {
      planSequence = [
        {
          thought: 'First',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: '第一个回复',
          tool_calls: null,
          execution_plan: null
        },
        {
          thought: 'Second',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: '第二个回复',
          tool_calls: null,
          execution_plan: null
        },
        {
          thought: 'Third',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: '第三个回复',
          tool_calls: null,
          execution_plan: null
        }
      ];

      jest.spyOn(engine as any, 'generatePlan').mockImplementation(() => {
        return Promise.resolve(planSequence[planIndex++]);
      });

      // 第1轮
      await engine.executeTask('问题1');
      const history1 = engine.getState().executionHistory.length;

      // 第2轮
      await engine.handleUserResponse('问题2');
      const history2 = engine.getState().executionHistory.length;

      // 第3轮
      await engine.handleUserResponse('问题3');
      const history3 = engine.getState().executionHistory.length;

      // 验证：历史递增
      expect(history2).toBeGreaterThan(history1);
      expect(history3).toBeGreaterThan(history2);
    });
  });

  describe('混合场景：工具调用 + 简单回复', () => {

    test('工具调用后仍可继续对话', async () => {
      planSequence = [
        // 第1轮：调用工具
        {
          thought: 'Need to search',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: '正在搜索...',
          tool_calls: [
            { name: 'internetSearch', args: { query: '测试' } }
          ],
          execution_plan: null
        },
        // 第2轮：搜索后的回复
        {
          thought: 'After search',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: '根据搜索结果，答案是...',
          tool_calls: null,
          execution_plan: null
        },
        // 第3轮：用户追问
        {
          thought: 'Follow-up question',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: '更详细的解释...',
          tool_calls: null,
          execution_plan: null
        }
      ];

      jest.spyOn(engine as any, 'generatePlan').mockImplementation(() => {
        return Promise.resolve(planSequence[planIndex++]);
      });

      const mockExecuteTool = jest.fn().mockResolvedValue({
        success: true,
        result: { content: '搜索结果' }
      });
      (engine as any).toolExecutor = { executeTool: mockExecuteTool };

      // 第1轮：执行带工具的任务
      await engine.executeTask('什么是FNV？');
      
      // 验证：工具被执行
      expect(mockExecuteTool).toHaveBeenCalledWith(
        'internetSearch',
        expect.anything(),  // args
        undefined,  // sessionContext 参数
        expect.anything()  // model 参数
      );

      // 第2轮的对话应该能继续
      // （根据当前实现，工具执行后可能会进入 awaiting_user 或其他状态）
      // 这里验证对话没有被错误终止
      const state = engine.getState();
      expect(state.stage).not.toBe('error');
    });
  });

  describe('对话终止场景', () => {

    test('只有 finalAnswer 能真正终止对话', async () => {
      planSequence = [
        // 使用 direct_response（不应终止）
        {
          thought: 'Simple reply',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          direct_response: '这是回复',
          tool_calls: null,
          execution_plan: null
        },
        // 使用 finalAnswer（应该终止）
        {
          thought: 'End conversation',
          response_mode: AIResponseMode.KNOWLEDGE_QA,
          tool_calls: [
            {
              name: 'finalAnswer',
              args: {
                summary: '对话结束',
                result: '再见',
                achievements: [],
                nextSteps: []
              }
            }
          ],
          execution_plan: null
        }
      ];

      jest.spyOn(engine as any, 'generatePlan').mockImplementation(() => {
        return Promise.resolve(planSequence[planIndex++]);
      });

      const mockExecuteTool = jest.fn().mockResolvedValue({
        success: true,
        result: {
          completed: true,
          summary: '对话结束',
          result: '再见',
          achievements: []
        }
      });
      (engine as any).toolExecutor = { executeTool: mockExecuteTool };

      // 第1轮：direct_response
      await engine.executeTask('问题');
      expect(engine.getState().stage).toBe('awaiting_user');  // 不终止

      // 第2轮：finalAnswer
      await engine.handleUserResponse('好的谢谢');
      expect(engine.getState().stage).toBe('completed');  // 终止
    });
  });

  describe('错误处理场景', () => {

    test('错误响应也应该允许对话继续', async () => {
      const plan = {
        thought: 'Error occurred',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '❌ 抱歉，我遇到了一个问题...',
        tool_calls: null,
        execution_plan: null
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      await engine.executeTask('导致错误的输入');

      // 验证：即使是错误响应，也应该进入 awaiting_user 状态（允许用户重试）
      const state = engine.getState();
      expect(state.stage).toBe('awaiting_user');
    });
  });
});

