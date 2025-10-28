/**
 * 第一轮对话记录测试
 *
 * 验证场景：
 * 1. executeTask 启动第一轮对话
 * 2. AI回复
 * 3. 验证第一轮的用户输入、Thought、Response都被正确记录在Conversation History中
 *
 * Bug背景：
 * 之前第一轮由于executionHistory为空，不记录"--- 新任务开始: xxx ---"，
 * 导致第一轮对话完全丢失，Conversation History从第二轮开始。
 */
import { ContextManager } from '../../core/engine/ContextManager';
import { ExecutionStep } from '../../core/engine/AgentState';

describe('First Turn Recording', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  it('应该正确记录第一轮对话（executeTask场景）', () => {
    // 模拟第一轮对话的executionHistory
    // 修复后，第一轮也会记录"--- 新任务开始: xxx ---"
    const executionHistory: ExecutionStep[] = [];

    // 第一轮：用户通过executeTask发起任务
    executionHistory.push({
      type: 'result',
      content: '--- 新任务开始: 我想跟你讨论一个问题 ---',
      timestamp: Date.now() - 10000,
      success: true,
      iteration: 1
    });

    // AI的思考
    executionHistory.push({
      type: 'thought',
      content: 'OBSERVE: The user has initiated a new conversation with \'我想跟你讨论一个问题\' (I want to discuss a question with you). ORIENT: There is no active project, and the user\'s input is abstract. CLARITY CHECK: The user\'s intent is ambiguous. DECIDE: I must ask for clarification. ACT: Generate a KNOWLEDGE_QA response asking the user to specify the topic.',
      timestamp: Date.now() - 9000,
      success: true,
      iteration: 1
    });

    // AI的回复
    executionHistory.push({
      type: 'result',
      content: '当然可以！请告诉我您想讨论的具体问题或主题，这样我才能为您提供更有针对性的建议或帮助。',
      timestamp: Date.now() - 8000,
      success: true,
      iteration: 1
    });

    // 构建上下文
    const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

    // 🎯 验证1：应该有Turn 1
    expect(historyContext).toContain('Turn 1:');

    // 🎯 验证2：Turn 1的User input应该是第一轮的真实输入
    expect(historyContext).toMatch(/Turn 1:.*User input:.*我想跟你讨论一个问题/s);

    // 🎯 验证3：Turn 1的Thought应该是第一轮的思考
    expect(historyContext).toMatch(/Turn 1:.*Thought:.*initiated a new conversation/s);

    // 🎯 验证4：Turn 1的Response应该是第一轮的回复
    expect(historyContext).toMatch(/Turn 1:.*Response:.*当然可以！请告诉我您想讨论的具体问题/s);

    // 🎯 验证5：不应该显示"No previous interactions"
    expect(historyContext).not.toContain('No previous interactions');

    console.log('\n✅ 第一轮对话记录测试通过！');
    console.log('='.repeat(60));
    console.log(historyContext);
    console.log('='.repeat(60));
  });

  it('应该正确记录包含第一轮的多轮对话', () => {
    // 模拟完整的多轮对话场景
    const executionHistory: ExecutionStep[] = [];

    // Turn 1: executeTask - "我想跟你讨论一个问题"
    executionHistory.push({
      type: 'result',
      content: '--- 新任务开始: 我想跟你讨论一个问题 ---',
      timestamp: Date.now() - 30000,
      success: true,
      iteration: 1
    });

    executionHistory.push({
      type: 'thought',
      content: 'User asks to discuss something...',
      timestamp: Date.now() - 29000,
      success: true,
      iteration: 1
    });

    executionHistory.push({
      type: 'result',
      content: '当然可以！请告诉我您想讨论的具体问题或主题。',
      timestamp: Date.now() - 28000,
      success: true,
      iteration: 1
    });

    // Turn 2: handleUserResponse - "如果我给出的指令里有些时候用词不准确..."
    executionHistory.push({
      type: 'user_interaction',
      content: '用户回复: 如果我给出的指令里有些时候用词不准确。比如我说"共享"，但实际上在文档里叫"推荐"，这种情况你是会执行对"共享"的编辑呢，还是会找我clarify说文档里没有"共享"，请说准确。',
      timestamp: Date.now() - 20000,
      success: true,
      iteration: 2
    });

    executionHistory.push({
      type: 'thought',
      content: 'User asks about my behavior when terminology does not match...',
      timestamp: Date.now() - 19000,
      success: true,
      iteration: 2
    });

    executionHistory.push({
      type: 'result',
      content: '非常感谢您的提问！如果您在指令中使用了与文档实际术语不一致的词，我不会直接执行。我会主动向您clarify。',
      timestamp: Date.now() - 18000,
      success: true,
      iteration: 2
    });

    // Turn 3: handleUserResponse - "那你帮我查一下..."
    executionHistory.push({
      type: 'user_interaction',
      content: '用户回复: 那你帮我查一下，/path/to/SRS.md 这篇需求文档里最hot的词 Top 3',
      timestamp: Date.now() - 10000,
      success: true,
      iteration: 3
    });

    executionHistory.push({
      type: 'thought',
      content: 'User asks for Top 3 hot words...',
      timestamp: Date.now() - 9000,
      success: true,
      iteration: 3
    });

    executionHistory.push({
      type: 'tool_call',
      content: 'readMarkdownFile 执行成功',
      timestamp: Date.now() - 8000,
      toolName: 'readMarkdownFile',
      success: true,
      iteration: 3,
      result: { success: true }
    });

    // 构建上下文
    const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

    // 🎯 验证：应该有完整的3个Turn
    expect(historyContext).toContain('Turn 1:');
    expect(historyContext).toContain('Turn 2:');
    expect(historyContext).toContain('Turn 3:');

    // 🎯 验证Turn 1的内容（第一轮对话）
    expect(historyContext).toMatch(/Turn 1:.*我想跟你讨论一个问题/s);
    expect(historyContext).toMatch(/Turn 1:.*当然可以！请告诉我您想讨论的具体问题/s);

    // 🎯 验证Turn 2的内容（第二轮对话）
    expect(historyContext).toMatch(/Turn 2:.*如果我给出的指令里有些时候用词不准确/s);
    expect(historyContext).toMatch(/Turn 2:.*我会主动向您clarify/s);

    // 🎯 验证Turn 3的内容（第三轮对话）
    expect(historyContext).toMatch(/Turn 3:.*那你帮我查一下/s);
    expect(historyContext).toMatch(/Turn 3:.*readMarkdownFile.*Succeeded/s);

    console.log('\n✅ 多轮对话记录测试通过！');
    console.log('='.repeat(60));
    console.log('Turn 1 (第一轮): 我想跟你讨论一个问题');
    console.log('Turn 2 (第二轮): 如果我给出的指令里...');
    console.log('Turn 3 (第三轮): 那你帮我查一下...');
    console.log('='.repeat(60));
  });

  it('应该处理第一轮没有currentTask的边界情况', () => {
    // 场景：executionHistory为空，但没有传currentTask
    // 这种情况下应该返回"No previous interactions"
    const executionHistory: ExecutionStep[] = [];

    const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

    // 验证：空历史应该返回"No previous interactions"
    expect(historyContext).toBe('No previous interactions.');
  });

  it('应该处理第一轮有currentTask但executionHistory为空的边界情况', () => {
    // 场景：executionHistory为空，但传入了currentTask
    // 修复后，这种情况不应该发生（因为第一轮会记录用户输入）
    // 但如果发生了，ContextManager应该能优雅处理
    const executionHistory: ExecutionStep[] = [];
    const currentTask = '测试任务';

    const { historyContext } = contextManager.buildContextForPrompt(executionHistory, currentTask);

    // 验证：由于executionHistory为空，early return会触发
    expect(historyContext).toBe('No previous interactions.');
  });

  it('应该在第一轮有pending数据时正确应用到Turn', () => {
    // 场景：第一轮记录了用户输入，但AI还没回复就遍历历史
    // 这测试pending机制能否正确工作
    const executionHistory: ExecutionStep[] = [];

    // 第一轮：只有用户输入和thought，还没有response
    executionHistory.push({
      type: 'result',
      content: '--- 新任务开始: 第一个任务 ---',
      timestamp: Date.now() - 5000,
      success: true,
      iteration: 1
    });

    executionHistory.push({
      type: 'thought',
      content: 'Processing first task...',
      timestamp: Date.now() - 4000,
      success: true,
      iteration: 1
    });

    // 构建上下文
    const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

    // 验证：应该有Turn 1，包含用户输入和thought
    expect(historyContext).toContain('Turn 1:');
    expect(historyContext).toMatch(/Turn 1:.*第一个任务/s);
    expect(historyContext).toMatch(/Turn 1:.*Processing first task/s);

    // response应该是N/A或不显示
    expect(historyContext).toMatch(/Turn 1:.*Response:.*N\/A/s);
  });
});
