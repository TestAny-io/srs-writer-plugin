/**
 * 测试 srsAgentEngine.generateSmartSummary() 方法
 *
 * 目的：确保不同工具的执行结果能够正确生成摘要信息
 */

import { SRSAgentEngine } from '../../../core/srsAgentEngine';
import * as vscode from 'vscode';

// Mock vscode module
jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn(),
      show: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn()
    })
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue('claude-3-5-sonnet-20241022')
    })
  },
  CancellationTokenSource: jest.fn().mockImplementation(() => ({
    token: {},
    cancel: jest.fn(),
    dispose: jest.fn()
  })),
  LanguageModelChatMessage: {
    User: jest.fn((content) => ({ role: 'user', content })),
    Assistant: jest.fn((content) => ({ role: 'assistant', content }))
  }
}));

// Mock SessionManager
jest.mock('../../../core/session-manager', () => ({
  SessionManager: {
    getInstance: jest.fn(() => ({
      getCurrentSession: jest.fn().mockResolvedValue({}),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    }))
  }
}));

describe('SRSAgentEngine.generateSmartSummary', () => {
  let engine: SRSAgentEngine;
  let mockStream: any;
  let mockModel: any;

  beforeEach(() => {
    // Mock ChatResponseStream
    mockStream = {
      markdown: jest.fn(),
      progress: jest.fn(),
      button: jest.fn()
    };

    // Mock LanguageModelChat
    mockModel = {
      sendRequest: jest.fn().mockResolvedValue({
        text: ['{"success": true}']
      })
    };

    engine = new SRSAgentEngine(mockStream, mockModel);
  });

  describe('executeYAMLEdits 工具结果', () => {
    it('应该正确显示应用的编辑数量', () => {
      const result = {
        success: true,
        appliedEdits: [
          { type: 'set', keyPath: 'functional_requirements.0.description', value: 'New desc', reason: 'Update' },
          { type: 'set', keyPath: 'functional_requirements.0.priority', value: 'high', reason: 'Update' },
          { type: 'delete', keyPath: 'functional_requirements.1', reason: 'Remove' }
        ],
        failedEdits: []
      };

      const summary = (engine as any).generateSmartSummary('executeYAMLEdits', result);

      expect(summary).toBe('应用3个编辑');
    });

    it('应该处理没有应用任何编辑的情况', () => {
      const result = {
        success: false,
        appliedEdits: [],
        failedEdits: [
          { type: 'set', keyPath: 'invalid.path', value: 'test', reason: 'Test' }
        ]
      };

      const summary = (engine as any).generateSmartSummary('executeYAMLEdits', result);

      expect(summary).toBe('应用0个编辑');
    });

    it('应该处理 appliedEdits 为 undefined 的情况', () => {
      const result = {
        success: false,
        appliedEdits: undefined,
        failedEdits: []
      };

      const summary = (engine as any).generateSmartSummary('executeYAMLEdits', result);

      expect(summary).toBe('应用0个编辑');
    });

    it('应该正确计算单个编辑操作', () => {
      const result = {
        success: true,
        appliedEdits: [
          { type: 'set', keyPath: 'project_name', value: 'New Name', reason: 'Update' }
        ],
        failedEdits: []
      };

      const summary = (engine as any).generateSmartSummary('executeYAMLEdits', result);

      expect(summary).toBe('应用1个编辑');
    });
  });

  describe('executeMarkdownEdits 工具结果（对比验证）', () => {
    it('应该正确显示应用的编辑数量（使用 appliedIntents）', () => {
      const result = {
        success: true,
        appliedIntents: [
          { intent: 'update', target: 'section1' },
          { intent: 'add', target: 'section2' }
        ],
        failedIntents: []
      };

      const summary = (engine as any).generateSmartSummary('executeMarkdownEdits', result);

      expect(summary).toBe('应用2个编辑');
    });

    it('应该处理使用 appliedCount 字段的情况', () => {
      const result = {
        success: true,
        appliedCount: 5,
        appliedIntents: [] // 即使这里为空，应该优先使用 appliedCount
      };

      const summary = (engine as any).generateSmartSummary('executeMarkdownEdits', result);

      expect(summary).toBe('应用5个编辑');
    });
  });

  describe('executeSemanticEdits 工具结果（对比验证）', () => {
    it('应该正确显示应用的编辑数量', () => {
      const result = {
        success: true,
        appliedIntents: [
          { intent: 'semantic_update', target: 'entity1' }
        ],
        failedIntents: []
      };

      const summary = (engine as any).generateSmartSummary('executeSemanticEdits', result);

      expect(summary).toBe('应用1个编辑');
    });
  });

  describe('其他工具结果（边界情况验证）', () => {
    it('应该处理 null 结果', () => {
      const summary = (engine as any).generateSmartSummary('executeYAMLEdits', null);

      expect(summary).toBe('');
    });

    it('应该处理 undefined 结果', () => {
      const summary = (engine as any).generateSmartSummary('executeYAMLEdits', undefined);

      expect(summary).toBe('');
    });

    it('应该处理未知工具名称', () => {
      const result = { success: true };
      const summary = (engine as any).generateSmartSummary('unknownTool', result);

      // 应该返回空字符串或默认值（根据实际实现）
      expect(summary).toBeDefined();
    });

    it('readFileWithStructure 应该显示文件大小', () => {
      const result = {
        success: true,
        content: 'x'.repeat(5120), // 5KB
        metadata: {
          documentLength: 5120
        }
      };

      const summary = (engine as any).generateSmartSummary('readFileWithStructure', result);

      expect(summary).toBe('读取文件 (5KB)');
    });

    it('taskComplete 应该显示摘要', () => {
      const result = {
        success: true,
        summary: '成功完成用户故事编写'
      };

      const summary = (engine as any).generateSmartSummary('taskComplete', result);

      expect(summary).toBe('成功完成用户故事编写');
    });

    it('askQuestion 应该显示问题内容', () => {
      const result = {
        question: '请确认项目名称'
      };

      const summary = (engine as any).generateSmartSummary('askQuestion', result);

      expect(summary).toBe('等待用户输入：请确认项目名称');
    });
  });

  describe('一致性验证：YAML vs Markdown 编辑', () => {
    it('executeYAMLEdits 和 executeMarkdownEdits 应该使用相同的格式', () => {
      const yamlResult = {
        success: true,
        appliedEdits: [{ type: 'set', keyPath: 'test', value: 'test', reason: 'test' }]
      };

      const markdownResult = {
        success: true,
        appliedIntents: [{ intent: 'test', target: 'test' }]
      };

      const yamlSummary = (engine as any).generateSmartSummary('executeYAMLEdits', yamlResult);
      const markdownSummary = (engine as any).generateSmartSummary('executeMarkdownEdits', markdownResult);

      // 两者应该使用相同的格式："应用X个编辑"
      expect(yamlSummary).toMatch(/^应用\d+个编辑$/);
      expect(markdownSummary).toMatch(/^应用\d+个编辑$/);
    });

    it('应用相同数量的编辑时，两者显示应该一致', () => {
      const yamlResult = {
        success: true,
        appliedEdits: [
          { type: 'set', keyPath: 'test1', value: 'v1', reason: 'r1' },
          { type: 'set', keyPath: 'test2', value: 'v2', reason: 'r2' },
          { type: 'set', keyPath: 'test3', value: 'v3', reason: 'r3' }
        ]
      };

      const markdownResult = {
        success: true,
        appliedIntents: [
          { intent: 'test1', target: 't1' },
          { intent: 'test2', target: 't2' },
          { intent: 'test3', target: 't3' }
        ]
      };

      const yamlSummary = (engine as any).generateSmartSummary('executeYAMLEdits', yamlResult);
      const markdownSummary = (engine as any).generateSmartSummary('executeMarkdownEdits', markdownResult);

      expect(yamlSummary).toBe('应用3个编辑');
      expect(markdownSummary).toBe('应用3个编辑');
    });
  });
});
