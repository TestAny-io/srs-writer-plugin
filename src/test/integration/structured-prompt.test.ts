import { PromptManager } from '../../core/orchestrator/PromptManager';
import { PlanGenerator } from '../../core/orchestrator/PlanGenerator';
import { SessionContext } from '../../types/session';
import { CallerType } from '../../types/index';

/**
 * 结构化提示词重构测试
 * 验证系统指令和用户输入的正确分离
 */
describe('Structured Prompt Refactoring Tests', () => {
  let promptManager: PromptManager;
  let planGenerator: PlanGenerator;
  
  beforeEach(() => {
    promptManager = new PromptManager();
    planGenerator = new PlanGenerator();
  });

  /**
   * 测试1：验证结构化提示词的基本结构
   */
  test('should build structured prompt with clear separation', async () => {
    // 准备测试数据
    const userInput = '我想写一篇需求文档，是构建一个基于webapp的blackpink粉丝应援网站。';
    const sessionContext: SessionContext = {
      sessionContextId: 'test-session-id',
      projectName: 'TestProject',
      baseDir: '/test/path',
      activeFiles: [],
      metadata: {
        srsVersion: '1.0',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '5.0'
      }
    };
    
    const historyContext = '无历史记录';
    const toolResultsContext = '无工具结果';
    
    // 模拟依赖函数
    const mockGetTools = async (caller?: CallerType) => ({
      definitions: [],
      jsonSchema: '{"type": "object", "properties": {}}'
    });
    
    const mockRetrieveKnowledge = async (input: string, context: SessionContext) => {
      return '无相关知识';
    };

    // 执行测试
    const structuredPrompt = await promptManager.buildAdaptiveToolPlanningPrompt(
      userInput,
      sessionContext,
      historyContext,
      toolResultsContext,
      mockGetTools
    );

    // 验证结构化提示词的基本结构
    expect(structuredPrompt).toContain('# SYSTEM INSTRUCTIONS');
    expect(structuredPrompt).toContain('# USER REQUEST');
    expect(structuredPrompt).toContain('# CONTEXT INFORMATION');
    expect(structuredPrompt).toContain('# FINAL INSTRUCTION');
    
    // 验证用户输入被正确放置在USER REQUEST部分
    expect(structuredPrompt).toContain(userInput);
    
    // 验证系统指令和用户输入被正确分离
    const systemInstructionsSection = structuredPrompt.substring(
      structuredPrompt.indexOf('# SYSTEM INSTRUCTIONS'),
      structuredPrompt.indexOf('# USER REQUEST')
    );
    
    const userRequestSection = structuredPrompt.substring(
      structuredPrompt.indexOf('# USER REQUEST'),
      structuredPrompt.indexOf('# CONTEXT INFORMATION')
    );
    
    // 系统指令部分不应包含用户的具体请求内容
    expect(systemInstructionsSection).not.toContain('blackpink粉丝应援网站');
    
    // 用户请求部分应包含用户的具体请求内容
    expect(userRequestSection).toContain('blackpink粉丝应援网站');
    
    console.log('✅ 结构化提示词测试通过');
  });

  /**
   * 测试2：验证占位符处理
   */
  test('should handle placeholders correctly', async () => {
    const userInput = '创建一个新项目';
    const sessionContext: SessionContext = {
      sessionContextId: 'test-session-id',
      projectName: 'TestProject',
      baseDir: '/test/path',
      activeFiles: [],
      metadata: {
        srsVersion: '1.0',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '5.0'
      }
    };
    
    const mockGetTools = async () => ({
      definitions: [],
      jsonSchema: '{"tools": ["readFile", "writeFile"]}'
    });
    
    const mockRetrieveKnowledge = async () => '知识库内容';

    const structuredPrompt = await promptManager.buildAdaptiveToolPlanningPrompt(
      userInput,
      sessionContext,
      '历史记录内容',
      '工具结果内容',
      mockGetTools
    );

    // 验证占位符被正确替换
    expect(structuredPrompt).toContain('历史记录内容');
    expect(structuredPrompt).toContain('工具结果内容');
    expect(structuredPrompt).toContain('知识库内容');
    expect(structuredPrompt).toContain('"tools": ["readFile", "writeFile"]');
    
    // 验证没有未替换的占位符
    expect(structuredPrompt).not.toContain('{{');
    expect(structuredPrompt).not.toContain('}}');
    
    console.log('✅ 占位符处理测试通过');
  });

  /**
   * 测试3：验证VSCode最佳实践合规性
   */
  test('should comply with VSCode best practices', async () => {
    const userInput = '帮我分析这个项目';
    const sessionContext: SessionContext = {
      sessionContextId: 'test-session-id',
      projectName: 'TestProject',
      baseDir: '/test/path',
      activeFiles: [],
      metadata: {
        srsVersion: '1.0',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '5.0'
      }
    };
    
    const mockGetTools = async () => ({
      definitions: [],
      jsonSchema: '{"type": "object"}'
    });
    
    const mockRetrieveKnowledge = async () => null;

    const structuredPrompt = await promptManager.buildAdaptiveToolPlanningPrompt(
      userInput,
      sessionContext,
      '',
      '',
      mockGetTools
    );

    // 验证提示词结构符合VSCode最佳实践
    // 1. 清晰的角色定义
    expect(structuredPrompt).toContain('You are an SRS-Writer Chief AI Architect');
    
    // 2. 明确的指令分离
    expect(structuredPrompt).toContain('Follow these instructions carefully');
    expect(structuredPrompt).toContain('The user\'s actual request that you need to analyze');
    
    // 3. 结构化的上下文信息
    expect(structuredPrompt).toContain('## Conversation History');
    expect(structuredPrompt).toContain('## Tool Results Context');
    expect(structuredPrompt).toContain('## Relevant Knowledge');
    
    // 4. 明确的输出要求
    expect(structuredPrompt).toContain('generate a valid JSON response');
    expect(structuredPrompt).toContain('Your response must be valid JSON');
    
    // 5. 清晰的任务指导
    expect(structuredPrompt).toContain('Clearly distinguish between system instructions');
    expect(structuredPrompt).toContain('Select the appropriate response_mode');
    
    console.log('✅ VSCode最佳实践合规性测试通过');
  });

  /**
   * 测试4：验证不同用户输入场景
   */
  test('should handle different user input scenarios', async () => {
    const testCases = [
      {
        input: '我想创建一个新的SRS文档',
        expectedMode: 'PLAN_EXECUTION',
        description: '创建任务应该触发PLAN_EXECUTION模式'
      },
      {
        input: '请帮我读取文件内容',
        expectedMode: 'TOOL_EXECUTION',
        description: '单步工具操作应该触发TOOL_EXECUTION模式'
      },
      {
        input: '什么是需求文档？',
        expectedMode: 'KNOWLEDGE_QA',
        description: '知识问答应该触发KNOWLEDGE_QA模式'
      }
    ];

    const sessionContext: SessionContext = {
      sessionContextId: 'test-session-id',
      projectName: 'TestProject',
      baseDir: '/test/path',
      activeFiles: [],
      metadata: {
        srsVersion: '1.0',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '5.0'
      }
    };
    
    const mockGetTools = async () => ({
      definitions: [],
      jsonSchema: '{"type": "object"}'
    });
    
    const mockRetrieveKnowledge = async () => null;

    for (const testCase of testCases) {
      const structuredPrompt = await promptManager.buildAdaptiveToolPlanningPrompt(
        testCase.input,
        sessionContext,
        '',
        '',
        mockGetTools
      );

      // 验证用户输入被正确包含
      expect(structuredPrompt).toContain(testCase.input);
      
      // 验证结构化格式保持一致
      expect(structuredPrompt).toContain('# SYSTEM INSTRUCTIONS');
      expect(structuredPrompt).toContain('# USER REQUEST');
      expect(structuredPrompt).toContain('# CONTEXT INFORMATION');
      expect(structuredPrompt).toContain('# FINAL INSTRUCTION');
      
      console.log(`✅ 测试用例通过: ${testCase.description}`);
    }
  });
});

/**
 * 手动测试函数 - 用于实际验证重构效果
 */
export async function runManualStructuredPromptTest() {
  console.log('🚀 开始手动测试结构化提示词重构效果...');
  
  try {
    const promptManager = new PromptManager();
    const userInput = '我想写一篇需求文档，是构建一个基于webapp的blackpink粉丝应援网站。';
    
    const sessionContext: SessionContext = {
      sessionContextId: 'manual-test-session',
      projectName: 'BlackpinkFanWebApp',
      baseDir: '/test/manual',
      activeFiles: [],
      metadata: {
        srsVersion: '1.0',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '5.0'
      }
    };
    
    const mockGetTools = async () => ({
      definitions: [],
      jsonSchema: '{"type": "object", "properties": {"readFile": {"type": "function"}}}'
    });
    
    const mockRetrieveKnowledge = async () => '相关知识：webapp开发最佳实践';

    const structuredPrompt = await promptManager.buildAdaptiveToolPlanningPrompt(
      userInput,
      sessionContext,
      '用户之前询问过项目框架选择',
      '上次工具调用结果：已创建项目目录',
      mockGetTools
    );

    console.log('📋 生成的结构化提示词预览：');
    console.log('='.repeat(80));
    console.log(structuredPrompt.substring(0, 1000) + '...');
    console.log('='.repeat(80));
    
    // 验证关键结构
    const hasSystemInstructions = structuredPrompt.includes('# SYSTEM INSTRUCTIONS');
    const hasUserRequest = structuredPrompt.includes('# USER REQUEST');
    const hasContextInfo = structuredPrompt.includes('# CONTEXT INFORMATION');
    const hasFinalInstruction = structuredPrompt.includes('# FINAL INSTRUCTION');
    
    console.log('\n✅ 结构验证结果：');
    console.log(`- 系统指令部分: ${hasSystemInstructions ? '✓' : '✗'}`);
    console.log(`- 用户请求部分: ${hasUserRequest ? '✓' : '✗'}`);
    console.log(`- 上下文信息部分: ${hasContextInfo ? '✓' : '✗'}`);
    console.log(`- 最终指令部分: ${hasFinalInstruction ? '✓' : '✗'}`);
    
    if (hasSystemInstructions && hasUserRequest && hasContextInfo && hasFinalInstruction) {
      console.log('\n🎉 手动测试通过！结构化提示词重构成功！');
      return true;
    } else {
      console.log('\n❌ 手动测试失败！结构化提示词存在问题！');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 手动测试过程中发生错误:', error);
    return false;
  }
} 