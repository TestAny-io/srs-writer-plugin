/**
 * Turn编号一致性测试
 *
 * 验证场景：
 * 1. 用户通过 executeTask 开始任务 -> Turn 1
 * 2. 用户通过 handleUserResponse 继续对话 -> Turn 2, 3, 4
 * 3. 在某个Turn执行工具调用
 * 4. 验证 Conversation History 和 Tool Results Context 的 Turn 编号一致
 */
import { ContextManager } from '../../core/engine/ContextManager';
import { ExecutionStep } from '../../core/engine/AgentState';

describe('Turn Number Consistency', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  it('应该在多Turn对话中正确追踪Turn编号（executeTask + handleUserResponse混合场景）', () => {
    // 模拟真实对话场景：
    // Turn 1: executeTask("你有工具能看到设备系统时间吗？")
    // Turn 2: handleUserResponse("哦，我查了，今天是2025年10月28号，那今天是星期几啊？")
    // Turn 3: handleUserResponse("好的，那离万圣节还有几天？")
    // Turn 4: handleUserResponse("你帮我上网查一下美国过万圣节都有哪些习俗") + internetSearch工具调用

    const executionHistory: ExecutionStep[] = [];

    // Turn 1: 通过 executeTask 开始任务
    executionHistory.push({
      type: 'result',
      content: '--- 新任务开始: 你有工具能看到设备系统时间吗？ ---',
      timestamp: Date.now() - 40000,
      success: true,
      iteration: 1  // 预期：Turn 1
    });

    executionHistory.push({
      type: 'thought',
      content: 'OBSERVE: User asked about system time tool...',
      timestamp: Date.now() - 39000,
      success: true,
      iteration: 1  // 预期：Turn 1
    });

    executionHistory.push({
      type: 'result',
      content: '目前我没有专门的工具可以直接读取设备的系统时间',
      timestamp: Date.now() - 38000,
      success: true,
      iteration: 1  // 预期：Turn 1
    });

    // Turn 2: 通过 handleUserResponse 继续对话
    executionHistory.push({
      type: 'user_interaction',
      content: '用户回复: 哦，我查了，今天是2025年10月28号，那今天是星期几啊？',
      timestamp: Date.now() - 30000,
      success: true,
      iteration: 2  // 预期：Turn 2
    });

    executionHistory.push({
      type: 'thought',
      content: 'OBSERVE: User asked about the weekday...',
      timestamp: Date.now() - 29000,
      success: true,
      iteration: 2  // 预期：Turn 2
    });

    executionHistory.push({
      type: 'result',
      content: '2025年10月28日是星期二。',
      timestamp: Date.now() - 28000,
      success: true,
      iteration: 2  // 预期：Turn 2
    });

    // Turn 3: 继续对话
    executionHistory.push({
      type: 'user_interaction',
      content: '用户回复: 好的，那离万圣节还有几天？',
      timestamp: Date.now() - 20000,
      success: true,
      iteration: 3  // 预期：Turn 3
    });

    executionHistory.push({
      type: 'thought',
      content: 'OBSERVE: User asked about days until Halloween...',
      timestamp: Date.now() - 19000,
      success: true,
      iteration: 3  // 预期：Turn 3
    });

    executionHistory.push({
      type: 'result',
      content: '距离万圣节（10月31日）还有3天。',
      timestamp: Date.now() - 18000,
      success: true,
      iteration: 3  // 预期：Turn 3
    });

    // Turn 4: 继续对话 + 执行工具调用
    executionHistory.push({
      type: 'user_interaction',
      content: '用户回复: 你帮我上网查一下美国过万圣节都有哪些习俗',
      timestamp: Date.now() - 10000,
      success: true,
      iteration: 4  // 预期：Turn 4
    });

    executionHistory.push({
      type: 'thought',
      content: 'OBSERVE: User asked me to search for Halloween customs...',
      timestamp: Date.now() - 9000,
      success: true,
      iteration: 4  // 预期：Turn 4
    });

    // 🎯 关键：Turn 4 的工具调用
    executionHistory.push({
      type: 'tool_call',
      content: 'internetSearch 执行成功',
      timestamp: Date.now() - 5000,
      toolName: 'internetSearch',
      success: true,
      iteration: 4,  // 🚀 预期：Turn 4（不是Turn 1！）
      duration: 3685,
      result: {
        success: true,
        searchData: '{"content": [{"type": "text", "text": "Halloween customs in the US..."}]}'
      }
    });

    // 构建上下文
    const { historyContext, toolResultsContext } = contextManager.buildContextForPrompt(executionHistory);

    // 🎯 验证1：Conversation History 应该有4个Turn
    expect(historyContext).toContain('Turn 1:');
    expect(historyContext).toContain('Turn 2:');
    expect(historyContext).toContain('Turn 3:');
    expect(historyContext).toContain('Turn 4:');

    // 🎯 验证2：Turn 1 应该包含第一个任务
    expect(historyContext).toMatch(/Turn 1:.*你有工具能看到设备系统时间吗/s);

    // 🎯 验证3：Turn 2-3 应该包含用户继续对话
    expect(historyContext).toMatch(/Turn 2:.*今天是星期几/s);
    expect(historyContext).toMatch(/Turn 3:.*离万圣节还有几天/s);

    // 🎯 验证4：Turn 4 应该包含internetSearch工具调用
    expect(historyContext).toMatch(/Turn 4:.*美国过万圣节都有哪些习俗/s);
    expect(historyContext).toMatch(/Turn 4:.*internetSearch.*Succeeded/s);

    // 🎯 验证5：Tool Results Context 应该显示 "Turn 4"（不是Turn 1！）
    expect(toolResultsContext).toContain('Turn 4 - Result of `internetSearch`');
    expect(toolResultsContext).not.toContain('Turn 1 - Result of `internetSearch`');

    // 🎯 验证6：验证完整的Turn编号一致性
    // Conversation History 的 Turn 4 和 Tool Results 的 Turn 4 应该对应同一个工具调用
    const turn4Match = historyContext.match(/Turn 4:[\s\S]*?internetSearch/);
    expect(turn4Match).toBeTruthy();

    const toolResultTurn4Match = toolResultsContext.match(/Turn 4 - Result of `internetSearch`/);
    expect(toolResultTurn4Match).toBeTruthy();

    console.log('\n🎉 Turn编号一致性验证通过！');
    console.log('='.repeat(60));
    console.log('Conversation History (摘要):');
    console.log(historyContext.substring(0, 500) + '...');
    console.log('\nTool Results Context:');
    console.log(toolResultsContext.substring(0, 300) + '...');
    console.log('='.repeat(60));
  });

  it('应该在纯executeTask场景中正确追踪Turn编号', () => {
    // 场景：多次调用 executeTask（每次都是新任务）
    const executionHistory: ExecutionStep[] = [];

    // Turn 1
    executionHistory.push({
      type: 'result',
      content: '--- 新任务开始: 第一个任务 ---',
      timestamp: Date.now() - 30000,
      success: true,
      iteration: 1
    });

    executionHistory.push({
      type: 'thought',
      content: 'Processing first task...',
      timestamp: Date.now() - 29500,
      success: true,
      iteration: 1
    });

    executionHistory.push({
      type: 'tool_call',
      content: 'readFile 执行成功',
      timestamp: Date.now() - 29000,
      toolName: 'readFile',
      success: true,
      iteration: 1,
      result: { content: 'file content 1' }
    });

    // Turn 2
    executionHistory.push({
      type: 'result',
      content: '--- 新任务开始: 第二个任务 ---',
      timestamp: Date.now() - 20000,
      success: true,
      iteration: 2
    });

    executionHistory.push({
      type: 'thought',
      content: 'Processing second task...',
      timestamp: Date.now() - 19500,
      success: true,
      iteration: 2
    });

    executionHistory.push({
      type: 'tool_call',
      content: 'writeFile 执行成功',
      timestamp: Date.now() - 19000,
      toolName: 'writeFile',
      success: true,
      iteration: 2,
      result: { success: true }
    });

    // Turn 3
    executionHistory.push({
      type: 'result',
      content: '--- 新任务开始: 第三个任务 ---',
      timestamp: Date.now() - 10000,
      success: true,
      iteration: 3
    });

    executionHistory.push({
      type: 'thought',
      content: 'Processing third task...',
      timestamp: Date.now() - 9500,
      success: true,
      iteration: 3
    });

    executionHistory.push({
      type: 'tool_call',
      content: 'executeMarkdownEdits 执行成功',
      timestamp: Date.now() - 9000,
      toolName: 'executeMarkdownEdits',
      success: true,
      iteration: 3,
      result: { success: true }
    });

    const { historyContext, toolResultsContext } = contextManager.buildContextForPrompt(executionHistory);

    // 验证Turn编号
    expect(historyContext).toContain('Turn 1:');
    expect(historyContext).toContain('Turn 2:');
    expect(historyContext).toContain('Turn 3:');

    // 验证工具调用的Turn编号
    expect(toolResultsContext).toContain('Turn 1 - Result of `readFile`');
    expect(toolResultsContext).toContain('Turn 2 - Result of `writeFile`');
    expect(toolResultsContext).toContain('Turn 3 - Result of `executeMarkdownEdits`');
  });

  it('应该在纯user_interaction场景中正确追踪Turn编号', () => {
    // 场景：多次用户交互（无 executeTask）
    const executionHistory: ExecutionStep[] = [];

    // Turn 1
    executionHistory.push({
      type: 'user_interaction',
      content: '用户回复: 问题1',
      timestamp: Date.now() - 30000,
      success: true,
      iteration: 1
    });

    executionHistory.push({
      type: 'thought',
      content: 'Answering question 1...',
      timestamp: Date.now() - 29500,
      success: true,
      iteration: 1
    });

    executionHistory.push({
      type: 'result',
      content: '回答1',
      timestamp: Date.now() - 29000,
      success: true,
      iteration: 1
    });

    // Turn 2
    executionHistory.push({
      type: 'user_interaction',
      content: '用户回复: 问题2',
      timestamp: Date.now() - 20000,
      success: true,
      iteration: 2
    });

    executionHistory.push({
      type: 'thought',
      content: 'Need to search project...',
      timestamp: Date.now() - 19500,
      success: true,
      iteration: 2
    });

    executionHistory.push({
      type: 'tool_call',
      content: 'searchProject 执行成功',
      timestamp: Date.now() - 19000,
      toolName: 'searchProject',
      success: true,
      iteration: 2,
      result: { results: [] }
    });

    // Turn 3
    executionHistory.push({
      type: 'user_interaction',
      content: '用户回复: 问题3',
      timestamp: Date.now() - 10000,
      success: true,
      iteration: 3
    });

    executionHistory.push({
      type: 'thought',
      content: 'Need to search internet...',
      timestamp: Date.now() - 9500,
      success: true,
      iteration: 3
    });

    executionHistory.push({
      type: 'tool_call',
      content: 'internetSearch 执行成功',
      timestamp: Date.now() - 9000,
      toolName: 'internetSearch',
      success: true,
      iteration: 3,
      result: { success: true }
    });

    const { historyContext, toolResultsContext } = contextManager.buildContextForPrompt(executionHistory);

    // 验证Turn编号
    expect(historyContext).toContain('Turn 1:');
    expect(historyContext).toContain('Turn 2:');
    expect(historyContext).toContain('Turn 3:');

    // 验证工具调用的Turn编号（Turn 2 和 Turn 3）
    expect(toolResultsContext).toContain('Turn 2 - Result of `searchProject`');
    expect(toolResultsContext).toContain('Turn 3 - Result of `internetSearch`');
  });

  it('应该处理单个Turn内的多个工具调用', () => {
    // 场景：一个Turn内执行多个工具
    const executionHistory: ExecutionStep[] = [];

    executionHistory.push({
      type: 'result',
      content: '--- 新任务开始: 复杂任务 ---',
      timestamp: Date.now() - 10000,
      success: true,
      iteration: 1
    });

    executionHistory.push({
      type: 'thought',
      content: 'Need to perform multiple operations...',
      timestamp: Date.now() - 9500,
      success: true,
      iteration: 1
    });

    // 同一Turn内的3个工具调用
    executionHistory.push({
      type: 'tool_call',
      content: 'readFile 执行成功',
      timestamp: Date.now() - 9000,
      toolName: 'readFile',
      success: true,
      iteration: 1,
      result: { content: 'content1' }
    });

    executionHistory.push({
      type: 'tool_call',
      content: 'writeFile 执行成功',
      timestamp: Date.now() - 8000,
      toolName: 'writeFile',
      success: true,
      iteration: 1,
      result: { success: true }
    });

    executionHistory.push({
      type: 'tool_call',
      content: 'executeMarkdownEdits 执行成功',
      timestamp: Date.now() - 7000,
      toolName: 'executeMarkdownEdits',
      success: true,
      iteration: 1,
      result: { success: true }
    });

    const { historyContext, toolResultsContext } = contextManager.buildContextForPrompt(executionHistory);

    // 验证只有1个Turn
    expect(historyContext).toContain('Turn 1:');
    expect(historyContext).not.toContain('Turn 2:');

    // 验证所有工具调用都属于Turn 1
    expect(toolResultsContext).toContain('Turn 1 - Result of `readFile`');
    expect(toolResultsContext).toContain('Turn 1 - Result of `writeFile`');
    expect(toolResultsContext).toContain('Turn 1 - Result of `executeMarkdownEdits`');

    // Turn 1应该包含所有3个工具调用
    expect(historyContext).toMatch(/Turn 1:.*readFile.*writeFile.*executeMarkdownEdits/s);
  });
});
