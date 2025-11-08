/**
 * 用户友好配置功能简化测试
 * 验证配置加载的基本功能
 */

import * as vscode from 'vscode';
import { SyntaxCheckerConfigLoader } from '../../../tools/document/syntaxChecker/SyntaxCheckerConfigLoader';

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn()
  }
}));

describe('UserFriendlyConfig Simple', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should use preset configuration when not custom', () => {
    const mockConfig = {
      get: jest.fn()
        .mockReturnValueOnce(true)       // aEnabled
        .mockReturnValueOnce('standard') // bMode
    };

    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

    const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();

    expect(config.enabled).toBe(true);
    expect(config.preset).toBe('standard');
    expect(config.rules).toBeDefined();
    expect(config.rules.MD013).toBeDefined(); // Should have standard preset rules
  });
  
  it('should handle advanced custom rules', () => {
    const advancedRules = {
      MD013: { line_length: 80 },
      MD025: false
    };

    const mockMarkdownConfig = {
      get: jest.fn()
        .mockReturnValueOnce(true)         // aEnabled
        .mockReturnValueOnce('custom')     // bMode
        .mockReturnValueOnce(advancedRules) // zCustomRules
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
  
  it('should handle configuration errors gracefully', () => {
    (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => {
      throw new Error('Configuration system failure');
    });
    
    const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
    
    expect(config.enabled).toBe(true);  // 应该使用默认配置
    expect(config.preset).toBe('standard');
    expect(config.rules).toBeDefined();
  });
  
  it('should load YAML configuration correctly', () => {
    const mockConfig = {
      get: jest.fn()
        .mockReturnValueOnce(true)       // enabled
        .mockReturnValueOnce('strict')   // level
    };

    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

    const config = SyntaxCheckerConfigLoader.loadYAMLConfig();

    expect(config.enabled).toBe(true);
    expect(config.level).toBe('strict');
    expect(config.checkRequirementsYaml).toBe(true); // strict mode should check requirements.yaml
  });
});
