/**
 * 验证Truncate移除修改是否正常工作
 */
import { ContextManager } from '../../core/engine/ContextManager';
import { ExecutionStep } from '../../core/engine/AgentState';

describe('Truncate Removal Verification', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  it('should preserve full thought content without truncation', () => {
    // 创建一个超过300字符的thought
    const longThought = 'OBSERVE: '.repeat(50) + 'This is a very long thought that should not be truncated.';

    const executionHistory: ExecutionStep[] = [
      {
        type: 'result',
        content: '--- 新任务开始: 测试任务 ---',
        timestamp: Date.now(),
        success: true
      },
      {
        type: 'thought',
        content: longThought,
        timestamp: Date.now(),
        success: true
      }
    ];

    const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

    // 验证完整的thought被保留（不应该被truncate到300字符）
    expect(historyContext).toContain(longThought);
    expect(historyContext).not.toContain('...');  // 不应该有truncate标记
  });

  it('should preserve full response content without truncation', () => {
    // 创建一个超过200字符的response
    const longResponse = '根据需求评审报告，'.repeat(20) + '这是一个很长的回复内容，不应该被截断。';

    const executionHistory: ExecutionStep[] = [
      {
        type: 'result',
        content: '--- 新任务开始: 测试任务 ---',
        timestamp: Date.now(),
        success: true
      },
      {
        type: 'result',
        content: longResponse,
        timestamp: Date.now(),
        success: true
      }
    ];

    const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

    // 验证完整的response被保留（不应该被truncate到200字符）
    expect(historyContext).toContain(longResponse);
  });

  it('should preserve OODA loop structure in thought', () => {
    const oodaThought = `OBSERVE: The user clarified that their focus is on the '需求评审报告' (requirements review report), not the quality report. In the previous turn, I summarized both reports but emphasized the quality report.

ORIENT: The requirements review report (srs_review_report_EuropeTop5LeaguesWebApp_2025-10-27T01:54:26.265Z.md) contains:
1. Comprehensive rating: 7.12/10
2. P0-level critical defects with specific recommendations
3. Structural analysis and improvement suggestions

DECIDE: I should provide the complete summary of the requirements review report, focusing on all P0-level defects and recommendations, so the user can make an informed decision about the revision plan.

ACT: Provide detailed summary of requirements review report with all critical defects and recommendations.`;

    const executionHistory: ExecutionStep[] = [
      {
        type: 'result',
        content: '--- 新任务开始: 评审报告查询 ---',
        timestamp: Date.now(),
        success: true
      },
      {
        type: 'thought',
        content: oodaThought,
        timestamp: Date.now(),
        success: true
      }
    ];

    const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

    // 验证完整的OODA循环被保留
    expect(historyContext).toContain('OBSERVE:');
    expect(historyContext).toContain('ORIENT:');
    expect(historyContext).toContain('DECIDE:');
    expect(historyContext).toContain('ACT:');
    // 验证具体内容也被保留
    expect(historyContext).toContain('requirements review report');
    expect(historyContext).toContain('Provide detailed summary');
  });

  it('should preserve detailed response content for follow-up questions', () => {
    const detailedResponse = `根据最新的需求评审报告，'EuropeTop5LeaguesWebApp'需求文档的主要结论如下：

---

**综合评分**：7.12/10（评级：合格）

**P0级关键缺陷**：
1. 性能指标缺乏测试环境说明（NFR-PERF-001）
   - 建议：补充具体测试环境和条件说明
2. 安全需求缺乏攻击场景分析（NFR-SEC-001）
   - 建议：补充针对恶意用户和攻击者的安全防护措施
3. 数据一致性需求描述不完整（NFR-DATA-001）
   - 建议：明确跨表数据同步和事务处理机制

**结构性问题**：
- 非功能需求章节组织需要优化
- 部分用例缺少前置条件和后置条件描述
- 术语表需要补充关键业务术语定义`;

    const executionHistory: ExecutionStep[] = [
      {
        type: 'result',
        content: '--- 新任务开始: 查看评审报告 ---',
        timestamp: Date.now(),
        success: true
      },
      {
        type: 'thought',
        content: 'User wants to see the review report summary',
        timestamp: Date.now(),
        success: true
      },
      {
        type: 'result',
        content: detailedResponse,
        timestamp: Date.now(),
        success: true
      }
    ];

    const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

    // 验证所有关键信息都被保留
    expect(historyContext).toContain('综合评分');
    expect(historyContext).toContain('P0级关键缺陷');
    expect(historyContext).toContain('NFR-PERF-001');
    expect(historyContext).toContain('NFR-SEC-001');
    expect(historyContext).toContain('NFR-DATA-001');
    expect(historyContext).toContain('结构性问题');
  });
});
