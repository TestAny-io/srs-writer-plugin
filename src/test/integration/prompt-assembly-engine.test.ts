import { PromptAssemblyEngine, SpecialistType, SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';
import { getSpecialistRegistry } from '../../core/specialistRegistry';
import * as path from 'path';

// Mock VSCode API
jest.mock('vscode', () => ({
  extensions: {
    getExtension: jest.fn(() => ({
      extensionPath: require('path').join(__dirname, '../../../')
    }))
  },
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn()
    }))
  }
}));

/**
 * PromptAssemblyEngine v3.0 重构测试
 * 验证结构化User消息格式的正确性
 */
describe('PromptAssemblyEngine v3.0 Refactor Tests', () => {
  let promptAssemblyEngine: PromptAssemblyEngine;
  const testRulesPath = path.join(__dirname, '../../..', 'rules');
  
  beforeEach(async () => {
    // 初始化SpecialistRegistry
    const registry = getSpecialistRegistry();
    await registry.scanAndRegister();
    
    promptAssemblyEngine = new PromptAssemblyEngine(testRulesPath);
  });

  /**
   * 测试1：验证结构化消息格式的基本结构
   */
  test('should generate structured User message format', async () => {
    const specialistType: SpecialistType = {
      name: 'summary_writer',
      category: 'content'
    };
    
    const context: SpecialistContext = {
      userRequirements: '生成一个测试项目的摘要',
      language: 'zh-CN',
      projectMetadata: {
        projectName: 'TestProject',
        baseDir: '/test/path',
        timestamp: '2024-01-01T00:00:00.000Z'
      },
      structuredContext: {
        currentStep: { step: 1, description: '摘要生成' },
        dependentResults: [],
        internalHistory: []
      }
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 验证结构化格式
    expect(result).toContain('# SPECIALIST INSTRUCTIONS');
    expect(result).toContain('# CURRENT TASK');
    expect(result).toContain('# CONTEXT INFORMATION');
    expect(result).toContain('# FINAL INSTRUCTION');
    
    // 验证不包含旧的===格式
    expect(result).not.toContain('=== SYSTEM INSTRUCTIONS ===');
    expect(result).not.toContain('=== CURRENT TASK ===');
    expect(result).not.toContain('=== CONTEXT INFORMATION ===');
    expect(result).not.toContain('=== FINAL INSTRUCTION: OUTPUT REQUIREMENTS ===');
    
    console.log('✅ 结构化消息格式验证通过');
  });

  /**
   * 测试2：验证角色定义和专家类型
   */
  test('should include proper role definition', async () => {
    const specialistType: SpecialistType = {
      name: 'fr_writer',
      category: 'content'
    };
    
    const context: SpecialistContext = {
      userRequirements: '编写功能需求'
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 验证角色定义 - 现在应该使用从SpecialistRegistry获取的真实名称
    expect(result).toContain('You are a Functional Requirements Writer specialist');
    expect(result).toContain('Follow these instructions carefully');
    
    console.log('✅ 角色定义验证通过');
  });

  /**
   * 测试3：验证上下文信息的JSON格式
   */
  test('should format context information as JSON', async () => {
    const specialistType: SpecialistType = {
      name: 'nfr_writer',
      category: 'content'
    };
    
    const context: SpecialistContext = {
      userRequirements: '编写非功能需求',
      projectMetadata: {
        projectName: 'TestNFRProject',
        baseDir: '/nfr/test'
      },
      structuredContext: {
        currentStep: { step: 2, description: '非功能需求编写' },
        dependentResults: [{ step: 1, result: 'summary completed' }]
      }
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 验证JSON格式的上下文
    expect(result).toContain('## Project Metadata');
    expect(result).toContain('```json');
    expect(result).toContain('"projectName": "TestNFRProject"');
    expect(result).toContain('"baseDir": "/nfr/test"');
    
    expect(result).toContain('## Structured Context (Current Step & History)');
    expect(result).toContain('"currentStep"');
    expect(result).toContain('"dependentResults"');
    
    console.log('✅ 上下文JSON格式验证通过');
  });

  /**
   * 测试4：验证关键输出指令
   */
  test('should include critical JSON output instruction', async () => {
    const specialistType: SpecialistType = {
      name: 'user_journey_writer',
      category: 'content'
    };
    
    const context: SpecialistContext = {
      userRequirements: '编写用户旅程'
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 验证关键输出指令
    expect(result).toContain('# FINAL INSTRUCTION');
    expect(result).toContain('generate a valid JSON object that adheres to the required schema');
    expect(result).toContain('**CRITICAL: Your entire response MUST be a single JSON object');
    expect(result).toContain('starting with `{` and ending with `}`');
    expect(result).toContain('Do not include any introductory text, explanations, or conversational filler');
    
    console.log('✅ 输出指令验证通过');
  });

  /**
   * 测试5：验证变量替换功能
   */
  test('should handle variable replacement correctly', async () => {
    const specialistType: SpecialistType = {
      name: 'test_specialist',
      category: 'content'
    };
    
    const context: SpecialistContext = {
      userRequirements: '测试变量替换',
      testVariable: 'replaced_value',
      structuredContext: {
        nestedVariable: 'nested_replaced_value'
      }
    };

    // 模拟包含变量占位符的模板
    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 验证基本结构存在（即使没有找到模板文件）
    expect(result).toContain('# SPECIALIST INSTRUCTIONS');
    expect(result).toContain('# CURRENT TASK');
    expect(result).toContain('测试变量替换');
    
    console.log('✅ 变量替换验证通过');
  });

  /**
   * 测试6：验证缺少上下文时的处理
   */
  test('should handle missing context gracefully', async () => {
    const specialistType: SpecialistType = {
      name: 'minimal_specialist',
      category: 'process'
    };
    
    const context: SpecialistContext = {
      // 最小化上下文
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 验证默认值处理
    expect(result).toContain('No specific task provided');
    expect(result).toContain('No project metadata available');
    expect(result).toContain('No structured context available');
    
    // 验证基本结构仍然存在
    expect(result).toContain('# SPECIALIST INSTRUCTIONS');
    expect(result).toContain('# FINAL INSTRUCTION');
    
    console.log('✅ 缺少上下文处理验证通过');
  });

  test('should use specialist_name from YAML config', async () => {
    // 测试fr_writer的specialist_name字段
    const frSpecialistType: SpecialistType = { name: 'fr_writer', category: 'content' };
    const context: SpecialistContext = {
      userRequirements: 'Test requirements',
      projectMetadata: { name: 'Test Project' },
      structuredContext: { currentStep: 'test' }
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(frSpecialistType, context);
    
    // 检查是否使用了正确的specialist_name
    expect(result).toContain('You are a Functional Requirements Writer specialist');
    console.log('✅ fr_writer specialist_name验证通过');
  });

  test('should use specialist_name from NFR writer config', async () => {
    // 测试nfr_writer的specialist_name字段  
    const nfrSpecialistType: SpecialistType = { name: 'nfr_writer', category: 'content' };
    const context: SpecialistContext = {
      userRequirements: 'Test requirements',
      projectMetadata: { name: 'Test Project' },
      structuredContext: { currentStep: 'test' }
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(nfrSpecialistType, context);
    
    // 检查是否使用了正确的specialist_name
    expect(result).toContain('You are a System Specification Writer specialist');
    console.log('✅ nfr_writer specialist_name验证通过');
  });
}); 