/**
 * SyntaxCheckerConfigLoader 单元测试
 * 测试 VSCode 配置加载和预设规则功能
 */

import * as vscode from 'vscode';
import { SyntaxCheckerConfigLoader } from '../../../tools/document/syntaxChecker/SyntaxCheckerConfigLoader';

// Mock vscode module
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn()
  }
}));

describe('SyntaxCheckerConfigLoader', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('loadMarkdownConfig', () => {
    it('should load default standard preset', () => {
      const mockConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)  // enabled
          .mockReturnValueOnce('standard')  // preset
          .mockReturnValueOnce({})    // customRules
      };
      
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      
      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.preset).toBe('standard');
      expect(config.rules).toBeDefined();
      expect(config.rules.MD013).toBeDefined(); // 标准预设应包含行长度限制
    });
    
    it('should handle disabled markdown checking', () => {
      const mockConfig = {
        get: jest.fn().mockReturnValueOnce(false) // enabled = false
      };
      
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      
      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.preset).toBe('standard');
    });
    
    it('should handle custom preset with custom rules', () => {
      const customRules = {
        MD013: { line_length: 100 },
        MD025: true
      };
      
      const mockConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)      // enabled
          .mockReturnValueOnce('custom')  // preset
          .mockReturnValueOnce(customRules) // customRules
      };
      
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      
      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.preset).toBe('custom');
      expect(config.rules).toEqual(customRules);
    });
    
    it('should handle relaxed preset', () => {
      const mockConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)       // enabled
          .mockReturnValueOnce('relaxed')  // preset
          .mockReturnValueOnce({})         // customRules
      };
      
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      
      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.preset).toBe('relaxed');
      expect(config.rules.MD013).toBe(false); // 宽松模式不限制行长度
    });
    
    it('should handle config loading failures gracefully', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => {
        throw new Error('Config access failed');
      });
      
      const config = SyntaxCheckerConfigLoader.loadMarkdownConfig();
      
      expect(config.enabled).toBe(true);  // 应该降级到默认配置
      expect(config.preset).toBe('standard');
      expect(config.rules).toBeDefined();
    });
  });
  
  describe('loadYAMLConfig', () => {
    it('should load default standard level', () => {
      const mockConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)       // enabled
          .mockReturnValueOnce('standard') // level
      };
      
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      
      const config = SyntaxCheckerConfigLoader.loadYAMLConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.level).toBe('standard');
      expect(config.checkSyntax).toBe(true);
      expect(config.checkStructure).toBe(true);
      expect(config.checkRequirementsYaml).toBe(false);
    });
    
    it('should handle basic level', () => {
      const mockConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)    // enabled
          .mockReturnValueOnce('basic') // level
      };
      
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      
      const config = SyntaxCheckerConfigLoader.loadYAMLConfig();
      
      expect(config.level).toBe('basic');
      expect(config.checkStructure).toBe(false); // basic 级别不检查结构
    });
    
    it('should handle strict level', () => {
      const mockConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)     // enabled
          .mockReturnValueOnce('strict') // level
      };
      
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      
      const config = SyntaxCheckerConfigLoader.loadYAMLConfig();
      
      expect(config.level).toBe('strict');
      expect(config.checkRequirementsYaml).toBe(true); // strict 级别检查 requirements.yaml
    });
    
    it('should handle disabled YAML checking', () => {
      const mockConfig = {
        get: jest.fn().mockReturnValueOnce(false) // enabled = false
      };
      
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
      
      const config = SyntaxCheckerConfigLoader.loadYAMLConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.checkSyntax).toBe(false);
      expect(config.checkStructure).toBe(false);
    });
  });
  
  describe('loadConfig', () => {
    it('should load complete configuration', () => {
      const mockGlobalConfig = {
        get: jest.fn().mockReturnValue(true) // enabled = true
      };
      
      const mockMarkdownConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)       // enabled
          .mockReturnValueOnce('standard') // preset
          .mockReturnValueOnce({})         // customRules
      };
      
      const mockYamlConfig = {
        get: jest.fn()
          .mockReturnValueOnce(true)       // enabled
          .mockReturnValueOnce('standard') // level
      };
      
      (vscode.workspace.getConfiguration as jest.Mock)
        .mockReturnValueOnce(mockGlobalConfig)
        .mockReturnValueOnce(mockMarkdownConfig)
        .mockReturnValueOnce(mockYamlConfig);
      
      const config = SyntaxCheckerConfigLoader.loadConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.markdown.enabled).toBe(true);
      expect(config.yaml.enabled).toBe(true);
    });
    
    it('should handle global config failures gracefully', () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockImplementation(() => {
        throw new Error('Configuration system failure');
      });
      
      const config = SyntaxCheckerConfigLoader.loadConfig();
      
      expect(config.enabled).toBe(true);  // 应该使用默认配置
      expect(config.markdown.enabled).toBe(true);
      expect(config.yaml.enabled).toBe(true);
    });
  });
});
