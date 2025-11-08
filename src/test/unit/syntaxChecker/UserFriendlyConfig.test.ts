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
    it('should use standard rules when custom mode has empty customRules', () => {
      // Mock markdown config
      const mockMarkdownConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)     // aEnabled
          .mockReturnValueOnce('custom') // bMode
          .mockReturnValueOnce({})       // zCustomRules (empty, so fallback to standard)
      };

      (vscode.workspace.getConfiguration as jest.Mock)
        .mockImplementation((section) => {
          if (section === 'srs-writer.syntaxChecker.markdown') {
            return mockMarkdownConfig;
          }
          return { get: jest.fn() };
        });

      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();

      expect(config.enabled).toBe(true);
      expect(config.preset).toBe('custom');
      expect(config.rules).toBeDefined();

      // When custom mode has empty customRules, should fallback to standard rules
      expect(config.rules.default).toBe(true);
      expect(config.rules.MD013).toBeDefined();
      expect(config.rules.MD013.line_length).toBe(120); // Standard preset value
      expect(config.rules.MD025).toBe(false); // Standard preset disables this
    });
    
    it('should use advanced custom rules when provided', () => {
      const advancedRules = {
        MD013: { line_length: 80 },
        MD025: false,
        MD046: { style: 'fenced' }
      };

      const mockMarkdownConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)         // aEnabled
          .mockReturnValueOnce('custom')     // bMode
          .mockReturnValueOnce(advancedRules) // zCustomRules (not empty)
      };

      (vscode.workspace.getConfiguration as jest.Mock)
        .mockImplementation((section) => {
          if (section === 'srs-writer.syntaxChecker.markdown') {
            return mockMarkdownConfig;
          }
          return { get: jest.fn() };
        });

      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();

      expect(config.enabled).toBe(true);
      expect(config.preset).toBe('custom');
      expect(config.rules).toEqual(advancedRules);
    });
    
    it('should handle errors when reading customRules', () => {
      const mockMarkdownConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)     // aEnabled
          .mockReturnValueOnce('custom') // bMode
          .mockImplementation(() => {
            throw new Error('Config access failed');
          })
      };

      (vscode.workspace.getConfiguration as jest.Mock)
        .mockImplementation((section) => {
          if (section === 'srs-writer.syntaxChecker.markdown') {
            return mockMarkdownConfig;
          }
          return { get: jest.fn() };
        });

      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();

      // Should fallback to standard preset on error
      expect(config.enabled).toBe(true);
      expect(config.rules).toBeDefined();
      expect(config.rules.default).toBe(true);
    });
    
    it('should accept custom rules with various configurations', () => {
      const customRules = {
        MD007: { indent: 10 },
        MD013: { line_length: 50, code_blocks: true },
        MD022: true,
        MD025: false,
        MD033: { allowed_elements: ['br'] },
        MD041: false,
        MD046: false
      };

      const mockMarkdownConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)        // aEnabled
          .mockReturnValueOnce('custom')    // bMode
          .mockReturnValueOnce(customRules) // zCustomRules
      };

      (vscode.workspace.getConfiguration as jest.Mock)
        .mockImplementation((section) => {
          if (section === 'srs-writer.syntaxChecker.markdown') {
            return mockMarkdownConfig;
          }
          return { get: jest.fn() };
        });

      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();

      expect(config.enabled).toBe(true);
      expect(config.preset).toBe('custom');
      expect(config.rules).toEqual(customRules);
      // Custom rules are used as-is, validation is done by markdownlint itself
    });
  });
  
  describe('Configuration fallback behavior', () => {
    it('should fallback to default config when getConfiguration fails', () => {
      (vscode.workspace.getConfiguration as jest.Mock)
        .mockImplementation(() => {
          throw new Error('Configuration system failure');
        });

      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();

      expect(config.enabled).toBe(true);
      expect(config.preset).toBe('standard');
      expect(config.rules).toBeDefined();
      expect(config.rules.MD013).toBeDefined();
    });
  });
});
