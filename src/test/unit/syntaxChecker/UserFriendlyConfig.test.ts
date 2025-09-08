/**
 * 用户友好配置功能测试
 * 测试详细的单项规则配置和优先级处理
 */

import * as vscode from 'vscode';
import { SyntaxCheckerConfigLoader } from '../../../tools/document/syntaxChecker/SyntaxCheckerConfigLoader';

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn()
  }
}));

describe('SyntaxChecker User-Friendly Configuration', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Custom rules from user-friendly config', () => {
    it('should build rules from individual rule settings', () => {
      // Mock markdown config
      const mockMarkdownConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)     // enabled
          .mockReturnValueOnce('custom') // preset
          .mockReturnValueOnce({})       // customRules (empty, so use individual settings)
      };
      
      // Mock rules config with user-friendly settings
      const mockRulesConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)  // MD007.enabled
          .mockReturnValueOnce(2)     // MD007.indent = 2
          .mockReturnValueOnce(true)  // MD013.enabled
          .mockReturnValueOnce(100)   // MD013.lineLength = 100
          .mockReturnValueOnce(false) // MD022.enabled = false
          .mockReturnValueOnce(true)  // MD025.enabled = true
          .mockReturnValueOnce(false) // MD033.enabled = false
          .mockReturnValueOnce(['br', 'img']) // MD033.allowedElements
          .mockReturnValueOnce(true)  // MD041.enabled = true
          .mockReturnValueOnce(true)  // MD046.enabled = true
      };
      
      (vscode.workspace.getConfiguration as jest.Mock)
        .mockImplementation((section) => {
          if (section === 'srs-writer.syntaxChecker.markdown') {
            return mockMarkdownConfig;
          }
          if (section === 'srs-writer.syntaxChecker.markdown.rules') {
            return mockRulesConfig;
          }
          return { get: jest.fn() };
        });
      
      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.preset).toBe('custom');
      expect(config.rules).toBeDefined();
      
      // 验证用户友好配置被正确转换
      expect(config.rules.MD007).toEqual({ indent: 2 });
      expect(config.rules.MD013).toEqual({
        line_length: 100,
        code_blocks: false,
        tables: false
      });
      expect(config.rules.MD022).toBe(false);
      expect(config.rules.MD025).toBe(true);
      expect(config.rules.MD033).toBe(false);
      expect(config.rules.MD041).toBe(true);
      expect(config.rules.MD046).toBe(true);
    });
    
    it('should prioritize advanced custom rules over individual settings', () => {
      const advancedRules = {
        MD013: { line_length: 80 },
        MD025: false,
        MD046: { style: 'fenced' }
      };
      
      const mockMarkdownConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)         // enabled
          .mockReturnValueOnce('custom')     // preset
          .mockReturnValueOnce(advancedRules) // customRules (not empty)
      };
      
      (vscode.workspace.getConfiguration as jest.Mock)
        .mockImplementation((section) => {
          if (section === 'srs-writer.syntaxChecker.markdown') {
            return mockMarkdownConfig;
          }
          return { get: jest.fn() };
        });
      
      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
      
      expect(config.rules).toEqual(advancedRules);
      // 高级规则应该完全覆盖单项设置
    });
    
    it('should handle missing rule configurations gracefully', () => {
      const mockMarkdownConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)     // enabled
          .mockReturnValueOnce('custom') // preset
          .mockReturnValueOnce({})       // customRules (empty)
      };
      
      // Mock rules config that throws errors
      const mockRulesConfig = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('Config access failed');
        })
      };
      
      (vscode.workspace.getConfiguration as jest.Mock)
        .mockReturnValueOnce(mockMarkdownConfig)
        .mockReturnValueOnce(mockRulesConfig);
      
      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
      
      // 应该降级到标准预设
      expect(config.enabled).toBe(true);
      expect(config.rules).toBeDefined();
      expect(config.rules.default).toBe(true);
    });
    
    it('should validate number range configurations', () => {
      const mockMarkdownConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)     // enabled
          .mockReturnValueOnce('custom') // preset
          .mockReturnValueOnce({})       // customRules
      };
      
      const mockRulesConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)  // MD007.enabled
          .mockReturnValueOnce(10)    // MD007.indent = 10 (超出范围，但代码中会处理)
          .mockReturnValueOnce(true)  // MD013.enabled
          .mockReturnValueOnce(50)    // MD013.lineLength = 50 (低于推荐值)
          .mockReturnValueOnce(true)  // MD022.enabled
          .mockReturnValueOnce(false) // MD025.enabled
          .mockReturnValueOnce(true)  // MD033.enabled
          .mockReturnValueOnce(['br']) // MD033.allowedElements
          .mockReturnValueOnce(false) // MD041.enabled
          .mockReturnValueOnce(false) // MD046.enabled
      };
      
      (vscode.workspace.getConfiguration as jest.Mock)
        .mockReturnValueOnce(mockMarkdownConfig)
        .mockReturnValueOnce(mockRulesConfig);
      
      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
      
      expect(config.rules.MD007.indent).toBe(10); // 保持用户设置
      expect(config.rules.MD013.line_length).toBe(50); // 保持用户设置
    });
  });
  
  describe('Configuration fallback behavior', () => {
    it('should fallback to standard preset when custom config fails', () => {
      const mockMarkdownConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)     // enabled
          .mockReturnValueOnce('custom') // preset
          .mockReturnValueOnce({})       // customRules
      };
      
      (vscode.workspace.getConfiguration as jest.Mock)
        .mockReturnValueOnce(mockMarkdownConfig)
        .mockImplementationOnce(() => {
          throw new Error('Rules config failed');
        });
      
      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.rules).toBeDefined();
      expect(config.rules.MD013).toBeDefined(); // 应该有标准预设的规则
    });
  });
});
