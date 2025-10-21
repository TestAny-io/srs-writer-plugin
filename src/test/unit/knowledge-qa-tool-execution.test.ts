/**
 * 单元测试：KNOWLEDGE_QA 模式工具执行修复
 * 
 * 测试目标：验证 KNOWLEDGE_QA 模式下，同时包含 direct_response 和 tool_calls 时，
 * 工具调用能够正常执行，而不是被过早的 return 语句忽略。
 * 
 * 相关 Bug 修复：srsAgentEngine.ts 第 620-671 行
 */

import * as vscode from 'vscode';
import { SRSAgentEngine } from '../../core/srsAgentEngine';
import { SessionManager } from '../../core/session-manager';
import { Orchestrator } from '../../core/orchestrator';
import { toolExecutor } from '../../core/toolExecutor';
import { AIResponseMode } from '../../types';

describe('KNOWLEDGE_QA Mode - Tool Execution Fix', () => {
  let mockStream: vscode.ChatResponseStream;
  let mockModel: vscode.LanguageModelChat;
  let engine: SRSAgentEngine;
  let orchestrator: Orchestrator;
  let sessionManager: SessionManager;

  // 用于追踪方法调用
  const streamMarkdownCalls: string[] = [];
  const executedTools: string[] = [];

  beforeEach(() => {
    // 清空追踪数组
    streamMarkdownCalls.length = 0;
    executedTools.length = 0;

    // Mock stream
    mockStream = {
      markdown: jest.fn((text: string) => {
        streamMarkdownCalls.push(text);
      }),
      push: jest.fn(),
      reference: jest.fn(),
      button: jest.fn()
    } as any;

    // Mock model
    mockModel = {
      id: 'test-model',
      name: 'Test Model',
      family: 'test',
      vendor: 'test',
      version: '1.0',
      maxInputTokens: 128000,
      sendRequest: jest.fn()
    } as any;

    // 初始化依赖
    sessionManager = SessionManager.getInstance();
    orchestrator = new Orchestrator();

    // 创建引擎实例
    engine = new SRSAgentEngine(mockStream, mockModel);
    engine.setDependencies(orchestrator, toolExecutor);

    // Mock toolExecutor.executeTool 以追踪工具调用
    jest.spyOn(toolExecutor, 'executeTool').mockImplementation(async (toolName: string) => {
      executedTools.push(toolName);
      return {
        success: true,
        result: { message: `${toolName} executed successfully` }
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('场景 1: 只有 direct_response（无工具调用）', () => {
    it('应该显示回复并完成任务', async () => {
      const plan = {
        thought: 'User asked a simple question',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '这是一个简单的回答',
        tool_calls: []
      };

      // Mock generatePlan 返回只有 direct_response 的计划
      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      // 执行
      await engine.executeTask('测试问题');

      // 验证：应该显示回复
      expect(streamMarkdownCalls.some(call => call.includes('这是一个简单的回答'))).toBe(true);

      // 验证：不应该执行任何工具
      expect(executedTools.length).toBe(0);

      // 验证：任务应该完成
      expect((engine as any).state.stage).toBe('completed');
    });
  });

  describe('场景 2: 只有 tool_calls（无 direct_response）', () => {
    it('应该执行工具调用', async () => {
      const plan = {
        thought: 'Need to search for information',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: undefined,
        tool_calls: [
          { name: 'internetSearch', args: { query: '测试查询' } }
        ]
      };

      // Mock generatePlan
      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      // 执行
      await engine.executeTask('需要搜索的问题');

      // 验证：应该执行工具
      expect(executedTools).toContain('internetSearch');

      // 验证：不应该显示 "AI回复" 的 markdown（因为没有 direct_response）
      const hasDirectResponse = streamMarkdownCalls.some(call => 
        call.includes('💬 **AI回复**:')
      );
      expect(hasDirectResponse).toBe(false);
    });
  });

  describe('场景 3: 同时包含 direct_response 和 tool_calls（Bug 修复重点）', () => {
    it('应该先显示回复，然后执行工具调用', async () => {
      const plan = {
        thought: 'Need to provide initial response and then search for more info',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '基于我的知识，这是初步回答。让我搜索更多信息...',
        tool_calls: [
          { name: 'internetSearch', args: { query: '测试查询' } }
        ]
      };

      // Mock generatePlan
      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      // 执行
      await engine.executeTask('复杂问题需要搜索');

      // 验证 1：应该显示 direct_response
      const hasDirectResponse = streamMarkdownCalls.some(call => 
        call.includes('基于我的知识，这是初步回答')
      );
      expect(hasDirectResponse).toBe(true);

      // 验证 2：应该显示搜索进度提示
      const hasSearchIndicator = streamMarkdownCalls.some(call => 
        call.includes('🔍 正在搜索更多信息')
      );
      expect(hasSearchIndicator).toBe(true);

      // 验证 3：应该执行工具（这是 Bug 修复的核心验证）
      expect(executedTools).toContain('internetSearch');

      // 验证 4：验证调用顺序正确（先显示回复，再显示搜索提示，最后执行工具）
      const directResponseIndex = streamMarkdownCalls.findIndex(call => 
        call.includes('基于我的知识，这是初步回答')
      );
      const searchIndicatorIndex = streamMarkdownCalls.findIndex(call => 
        call.includes('🔍 正在搜索更多信息')
      );
      
      expect(directResponseIndex).toBeGreaterThanOrEqual(0);
      expect(searchIndicatorIndex).toBeGreaterThan(directResponseIndex);
    });

    it('应该支持多个工具调用', async () => {
      const plan = {
        thought: 'Need multiple information sources',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '这是一个复杂的问题，我需要搜索多个来源',
        tool_calls: [
          { name: 'internetSearch', args: { query: '查询1' } },
          { name: 'askQuestion', args: { question: '需要确认的问题' } }
        ]
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);

      await engine.executeTask('复杂问题');

      // 验证：应该显示回复
      expect(streamMarkdownCalls.some(call => 
        call.includes('这是一个复杂的问题')
      )).toBe(true);

      // 验证：应该执行所有工具
      expect(executedTools).toContain('internetSearch');
      expect(executedTools).toContain('askQuestion');
      expect(executedTools.length).toBe(2);
    });
  });

  describe('场景 4: 边界情况测试', () => {
    it('空 direct_response 但有 tool_calls 应该执行工具', async () => {
      const plan = {
        thought: 'No response, just execute tools',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: '', // 空字符串
        tool_calls: [
          { name: 'internetSearch', args: { query: '测试' } }
        ]
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);
      await engine.executeTask('测试');

      // 空字符串应该被视为 falsy，不显示 direct_response
      expect(executedTools).toContain('internetSearch');
    });

    it('既没有 direct_response 也没有 tool_calls 应该完成任务', async () => {
      const plan = {
        thought: 'Nothing to do',
        response_mode: AIResponseMode.KNOWLEDGE_QA,
        direct_response: undefined,
        tool_calls: []
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);
      await engine.executeTask('测试');

      // 验证：没有执行任何工具
      expect(executedTools.length).toBe(0);

      // 验证：任务应该完成
      expect((engine as any).state.stage).toBe('completed');
    });
  });

  describe('场景 5: 与其他响应模式的兼容性', () => {
    it('PLAN_EXECUTION 模式不受影响', async () => {
      const plan = {
        thought: 'This is a plan execution mode',
        response_mode: 'PLAN_EXECUTION',
        execution_plan: {
          planId: 'test-plan',
          description: '测试计划',
          steps: []
        },
        tool_calls: []
      };

      // Mock orchestrator.planAndExecute
      jest.spyOn(orchestrator, 'planAndExecute').mockResolvedValue({
        intent: 'plan_completed',
        result: { summary: '计划完成' }
      });

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);
      await engine.executeTask('执行计划');

      // 验证：应该调用 orchestrator.planAndExecute
      expect(orchestrator.planAndExecute).toHaveBeenCalled();
    });

    it('TOOL_EXECUTION 模式不受影响', async () => {
      const plan = {
        thought: 'Direct tool execution',
        response_mode: 'TOOL_EXECUTION',
        tool_calls: [
          { name: 'readFile', args: { path: '/test/path' } }
        ]
      };

      jest.spyOn(engine as any, 'generatePlan').mockResolvedValue(plan);
      await engine.executeTask('执行工具');

      // 验证：应该执行工具
      expect(executedTools).toContain('readFile');
    });
  });
});

