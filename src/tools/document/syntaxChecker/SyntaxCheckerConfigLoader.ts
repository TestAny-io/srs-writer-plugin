/**
 * 语法检查器配置加载器
 * 复用项目中的 VSCode 配置加载模式，提供预设选项
 */

import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';
import { MarkdownConfig, YAMLConfig, SyntaxCheckerConfig } from './types';

const logger = Logger.getInstance();

/**
 * 语法检查器配置加载器
 */
export class SyntaxCheckerConfigLoader {
  
  /**
   * 加载完整配置
   */
  static loadConfig(): SyntaxCheckerConfig {
    try {
      const globalConfig = vscode.workspace.getConfiguration('srs-writer.syntaxChecker');
      
      return {
        enabled: globalConfig.get('enabled', true),
        markdown: this.loadMarkdownConfig(),
        yaml: this.loadYAMLConfig()
      };
      
    } catch (error) {
      logger.warn(`Failed to load syntax checker configuration, using defaults: ${(error as Error).message}`);
      return this.getDefaultConfig();
    }
  }
  
  /**
   * 加载 Markdown 配置
   */
  static loadMarkdownConfig(): MarkdownConfig {
    try {
      const config = vscode.workspace.getConfiguration('srs-writer.syntaxChecker.markdown');
      
      if (!config.get('aEnabled', true)) {
        return { enabled: false, preset: 'standard' };
      }
      
      const mode = config.get('bMode', 'standard') as 'all' | 'standard' | 'no' | 'custom';
      
      return {
        enabled: true,
        preset: mode, // 兼容现有接口
        rules: this.getMarkdownRulesByMode(mode)
      };
      
    } catch (error) {
      logger.warn(`Failed to load markdown configuration, using defaults: ${(error as Error).message}`);
      return this.getDefaultMarkdownConfig();
    }
  }
  
  /**
   * 加载 YAML 配置
   */
  static loadYAMLConfig(): YAMLConfig {
    try {
      const config = vscode.workspace.getConfiguration('srs-writer.syntaxChecker.yaml');
      
      if (!config.get('enabled', true)) {
        return { 
          enabled: false, 
          level: 'standard',
          checkSyntax: false,
          checkStructure: false,
          checkRequirementsYaml: false
        };
      }
      
      const level = config.get('level', 'standard') as 'basic' | 'standard' | 'strict';
      
      return {
        enabled: true,
        level,
        checkSyntax: true,
        checkStructure: level !== 'basic',
        checkRequirementsYaml: level === 'strict'
      };
      
    } catch (error) {
      logger.warn(`Failed to load YAML configuration, using defaults: ${(error as Error).message}`);
      return this.getDefaultYAMLConfig();
    }
  }
  
  /**
   * 从用户友好配置构建自定义规则
   */
  private static buildCustomRulesFromUserConfig(): any {
    try {
      const mainConfig = vscode.workspace.getConfiguration('srs-writer.syntaxChecker.markdown');
      const customRules = mainConfig.get('zCustomRules', {});
      
      // 优先级1: 如果用户提供了高级自定义规则，直接使用
      if (Object.keys(customRules).length > 0) {
        logger.info('Using advanced custom rules configuration');
        return customRules;
      }
      
      // 优先级2: 使用标准配置作为自定义的基础
      logger.info('No custom rules found, using standard rules for custom mode');
      return this.getStandardRules();
      
    } catch (error) {
      logger.warn(`Failed to build custom rules from user config: ${(error as Error).message}`);
      return this.getStandardRules();
    }
  }
  
  
  /**
   * 根据模式获取 Markdown 规则
   */
  private static getMarkdownRulesByMode(mode: string): any {
    switch (mode) {
      case 'all':
        return { default: true }; // 启用所有 markdownlint 默认规则
      
      case 'standard':
        return this.getStandardRules();
      
      case 'no':
        return { default: false }; // 禁用所有规则
      
      case 'custom':
        return this.buildCustomRulesFromUserConfig();
      
      default:
        logger.warn(`Unknown markdown mode: ${mode}, using standard`);
        return this.getStandardRules();
    }
  }
  
  /**
   * 获取规则的默认启用状态
   * 针对 SRS 文档优化
   */
  private static getDefaultRuleState(rule: string): boolean {
    // SRS 文档不友好的规则，默认禁用
    const disabledForSRS = ['MD024', 'MD025', 'MD041', 'MD043', 'MD046'];
    return !disabledForSRS.includes(rule);
  }
  
  
  /**
   * 获取标准模式规则（必要的检查项）
   */
  private static getStandardRules(): any {
    return {
      default: true,
      // 启用必要的检查项
      MD001: true,  // 标题层级递增
      MD003: true,  // 标题样式一致性
      MD009: true,  // 行尾空格
      MD010: true,  // 硬制表符
      MD012: true,  // 多个连续空行
      MD013: {      // 行长度限制
        line_length: 120,
        code_blocks: false,
        tables: false
      },
      MD018: true,  // ATX 标题空格
      MD022: true,  // 标题周围空行
      MD030: true,  // 列表标记后空格
      MD031: true,  // 代码块周围空行
      MD032: true,  // 列表周围空行
      MD033: {      // HTML 元素
        allowed_elements: ["br", "details", "summary"]
      },
      MD037: true,  // 强调标记内空格
      MD038: true,  // 代码标记内空格
      MD040: true,  // 代码块语言标识
      MD047: true,  // 文件末尾空行
      
      // 禁用对 SRS 文档不友好的规则
      MD024: false, // 重复标题内容
      MD025: false, // 多个一级标题
      MD041: false, // 文件开头标题
      MD043: false, // 必需文档结构
      MD046: false  // 代码块样式一致性
    };
  }
  
  /**
   * 获取 Markdown 预设规则（保持兼容性）
   */
  private static getMarkdownPresetRules(preset: string): any {
    const presets: Record<string, any> = {
      strict: {
        default: true
        // 启用所有规则，使用 markdownlint 默认值
      },
      standard: {
        default: true,
        MD013: { 
          line_length: 120, 
          code_blocks: false, 
          tables: false 
        },
        MD025: false, // 允许多个一级标题
        MD033: { 
          allowed_elements: ["br", "details", "summary"] 
        },
        MD041: false  // 不要求文件开头必须是标题
      },
      relaxed: {
        default: true,
        MD013: false, // 不限制行长度
        MD025: false,
        MD033: false, // 允许所有HTML
        MD041: false,
        MD046: false, // 允许缩进代码块
        MD024: false  // 允许重复标题
      }
    };
    
    return presets[preset] || presets.standard;
  }
  
  /**
   * 获取默认配置
   */
  private static getDefaultConfig(): SyntaxCheckerConfig {
    return {
      enabled: true,
      markdown: this.getDefaultMarkdownConfig(),
      yaml: this.getDefaultYAMLConfig()
    };
  }
  
  /**
   * 获取默认 Markdown 配置
   */
  private static getDefaultMarkdownConfig(): MarkdownConfig {
    return {
      enabled: true,
      preset: 'standard',
      rules: this.getMarkdownPresetRules('standard')
    };
  }
  
  /**
   * 获取默认 YAML 配置
   */
  private static getDefaultYAMLConfig(): YAMLConfig {
    return {
      enabled: true,
      level: 'standard',
      checkSyntax: true,
      checkStructure: true,
      checkRequirementsYaml: false
    };
  }
}
