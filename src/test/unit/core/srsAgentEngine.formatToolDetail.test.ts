/**
 * 测试 srsAgentEngine.formatToolDetail() 方法
 *
 * 目的：确保工具调用在 UI 中正确显示参数详情，特别是验证：
 * 1. executeYAMLEdits 使用正确的参数名 (targetFile)
 * 2. executeTextFileEdits 使用正确的参数名 (targetFile)
 * 3. executeMarkdownEdits 使用 result 而非 args
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

describe('SRSAgentEngine.formatToolDetail', () => {
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

  describe('executeYAMLEdits - 参数名修复验证', () => {
    it('应该使用 args.targetFile 而不是 args.yamlFilePath', () => {
      const args = {
        targetFile: 'test-project/requirements.yaml',
        edits: [
          { type: 'set', keyPath: 'FR-001.priority', value: 'high', reason: 'Update priority' },
          { type: 'set', keyPath: 'FR-002.status', value: 'completed', reason: 'Update status' }
        ],
        summary: 'Update requirements'
      };
      const result = {
        success: true,
        appliedEdits: args.edits,
        failedEdits: []
      };

      const detail = (engine as any).formatToolDetail('executeYAMLEdits', args, result);

      // shortenPath 保留最后两段路径
      expect(detail).toBe(' - 修改了2个字段 (test-project/requirements.yaml)');
    });

    it('应该正确显示单个编辑操作', () => {
      const args = {
        targetFile: 'requirements.yaml',
        edits: [
          { type: 'set', keyPath: 'project_name', value: 'New Project', reason: 'Update name' }
        ]
      };
      const result = { success: true };

      const detail = (engine as any).formatToolDetail('executeYAMLEdits', args, result);

      expect(detail).toBe(' - 修改了1个字段 (requirements.yaml)');
    });

    it('应该处理只有 targetFile 没有 edits 的情况', () => {
      const args = {
        targetFile: 'test-project/config.yaml'
      };
      const result = { success: true };

      const detail = (engine as any).formatToolDetail('executeYAMLEdits', args, result);

      // shortenPath 保留最后两段路径
      expect(detail).toBe(' - test-project/config.yaml');
    });

    it('应该处理 edits 为空数组的情况', () => {
      const args = {
        targetFile: 'requirements.yaml',
        edits: []
      };
      const result = { success: true };

      const detail = (engine as any).formatToolDetail('executeYAMLEdits', args, result);

      expect(detail).toBe(' - 修改了0个字段 (requirements.yaml)');
    });

    it('应该处理缺少 targetFile 的情况（返回空字符串）', () => {
      const args = {
        edits: [
          { type: 'set', keyPath: 'test', value: 'value', reason: 'test' }
        ]
      };
      const result = { success: true };

      const detail = (engine as any).formatToolDetail('executeYAMLEdits', args, result);

      expect(detail).toBe('');
    });
  });

  describe('executeTextFileEdits - 参数名修复验证', () => {
    it('应该使用 args.targetFile 而不是 args.filePath', () => {
      const args = {
        targetFile: 'test-project/styles/main.css',
        edits: [
          { oldString: 'color: red;', newString: 'color: blue;', reason: 'Change color' },
          { oldString: 'font-size: 14px;', newString: 'font-size: 16px;', reason: 'Increase size' },
          { oldString: 'margin: 0;', newString: 'margin: 10px;', reason: 'Add margin' }
        ],
        summary: 'Update styles'
      };
      const result = {
        success: true,
        appliedEdits: 3,
        totalEdits: 3
      };

      const detail = (engine as any).formatToolDetail('executeTextFileEdits', args, result);

      // shortenPath 保留最后两段路径
      expect(detail).toBe(' - 修改了3个部分 (styles/main.css)');
    });

    it('应该正确显示单个编辑操作', () => {
      const args = {
        targetFile: 'index.html',
        edits: [
          { oldString: '<title>Old</title>', newString: '<title>New</title>', reason: 'Update title' }
        ]
      };
      const result = { success: true };

      const detail = (engine as any).formatToolDetail('executeTextFileEdits', args, result);

      expect(detail).toBe(' - 修改了1个部分 (index.html)');
    });

    it('应该处理只有 targetFile 没有 edits 的情况', () => {
      const args = {
        targetFile: 'test-project/script.js'
      };
      const result = { success: true };

      const detail = (engine as any).formatToolDetail('executeTextFileEdits', args, result);

      // shortenPath 保留最后两段路径
      expect(detail).toBe(' - test-project/script.js');
    });

    it('应该处理 edits 为空数组的情况', () => {
      const args = {
        targetFile: 'styles.css',
        edits: []
      };
      const result = { success: true };

      const detail = (engine as any).formatToolDetail('executeTextFileEdits', args, result);

      expect(detail).toBe(' - 修改了0个部分 (styles.css)');
    });

    it('应该处理缺少 targetFile 的情况（返回空字符串）', () => {
      const args = {
        edits: [
          { oldString: 'old', newString: 'new', reason: 'test' }
        ]
      };
      const result = { success: true };

      const detail = (engine as any).formatToolDetail('executeTextFileEdits', args, result);

      expect(detail).toBe('');
    });
  });

  describe('executeMarkdownEdits - 对比验证（使用 result）', () => {
    it('应该从 result 而非 args 中提取信息', () => {
      const args = {
        targetFile: 'SRS.md',
        intents: [
          { type: 'replace_section_content_only', target: { sid: '1' }, content: 'new content', summary: 'Update' }
        ]
      };
      // generateToolsSummary 期望的格式需要包含 toolName
      // formatToolDetail 调用 generateToolsSummary([result])
      // 为了让测试通过，result 需要模拟实际的结构
      const result = {
        toolName: 'executeMarkdownEdits',  // 添加 toolName 字段
        success: true,
        result: {  // 嵌套 result 字段
          appliedIntents: [
            { type: 'replace_section_content_only', target: { sid: '1' } }
          ],
          failedIntents: []
        }
      };

      const detail = (engine as any).formatToolDetail('executeMarkdownEdits', args, result);

      // executeMarkdownEdits 使用 generateToolsSummary，基于 result
      expect(detail).toBe(' - 应用1个编辑');
    });

    it('应该处理多个编辑操作', () => {
      const args = {
        targetFile: 'SRS.md',
        intents: []
      };
      const result = {
        toolName: 'executeMarkdownEdits',
        success: true,
        result: {
          appliedCount: 5
        }
      };

      const detail = (engine as any).formatToolDetail('executeMarkdownEdits', args, result);

      expect(detail).toBe(' - 应用5个编辑');
    });
  });

  describe('路径缩短功能测试', () => {
    it('应该正确缩短长路径（保留最后两段）', () => {
      const args = {
        targetFile: '/Users/username/projects/my-project/docs/requirements.yaml',
        edits: [{ type: 'set', keyPath: 'test', value: 'value', reason: 'test' }]
      };
      const result = { success: true };

      const detail = (engine as any).formatToolDetail('executeYAMLEdits', args, result);

      // shortenPath 保留最后两段路径
      expect(detail).toBe(' - 修改了1个字段 (docs/requirements.yaml)');
    });

    it('应该保持短路径不变', () => {
      const args = {
        targetFile: 'config.yaml',
        edits: [{ type: 'set', keyPath: 'test', value: 'value', reason: 'test' }]
      };
      const result = { success: true };

      const detail = (engine as any).formatToolDetail('executeYAMLEdits', args, result);

      expect(detail).toBe(' - 修改了1个字段 (config.yaml)');
    });
  });

  describe('一致性验证：三个编辑工具的参数名统一', () => {
    it('executeYAMLEdits, executeTextFileEdits 都应该使用 targetFile', () => {
      const yamlArgs = {
        targetFile: 'requirements.yaml',
        edits: [{ type: 'set', keyPath: 'test', value: 'v', reason: 'r' }]
      };
      const textArgs = {
        targetFile: 'styles.css',
        edits: [{ oldString: 'old', newString: 'new', reason: 'test' }]
      };
      const yamlResult = { success: true };
      const textResult = { success: true };

      const yamlDetail = (engine as any).formatToolDetail('executeYAMLEdits', yamlArgs, yamlResult);
      const textDetail = (engine as any).formatToolDetail('executeTextFileEdits', textArgs, textResult);

      // 两者都应该成功显示文件信息
      expect(yamlDetail).toContain('requirements.yaml');
      expect(textDetail).toContain('styles.css');
      expect(yamlDetail).not.toBe('');
      expect(textDetail).not.toBe('');
    });

    it('使用错误的参数名应该返回空字符串', () => {
      // 模拟旧的错误参数名
      const wrongYamlArgs = {
        yamlFilePath: 'requirements.yaml',  // 错误的参数名
        edits: [{ type: 'set', keyPath: 'test', value: 'v', reason: 'r' }]
      };
      const wrongTextArgs = {
        filePath: 'styles.css',  // 错误的参数名
        edits: [{ oldString: 'old', newString: 'new', reason: 'test' }]
      };
      const result = { success: true };

      const yamlDetail = (engine as any).formatToolDetail('executeYAMLEdits', wrongYamlArgs, result);
      const textDetail = (engine as any).formatToolDetail('executeTextFileEdits', wrongTextArgs, result);

      // 使用错误参数名应该返回空字符串（因为找不到 targetFile）
      expect(yamlDetail).toBe('');
      expect(textDetail).toBe('');
    });
  });

  describe('边界情况验证', () => {
    it('应该处理 args 为 null', () => {
      const detail = (engine as any).formatToolDetail('executeYAMLEdits', null, {});
      expect(detail).toBe('');
    });

    it('应该处理 args 为 undefined', () => {
      const detail = (engine as any).formatToolDetail('executeYAMLEdits', undefined, {});
      expect(detail).toBe('');
    });

    it('应该处理 args 为空对象', () => {
      const detail = (engine as any).formatToolDetail('executeYAMLEdits', {}, {});
      expect(detail).toBe('');
    });

    it('应该处理未知工具名称', () => {
      const args = { targetFile: 'test.txt', edits: [] };
      const detail = (engine as any).formatToolDetail('unknownTool', args, {});
      
      // 未知工具应该尝试显示第一个参数或返回空
      expect(detail).toBeDefined();
    });
  });
});

