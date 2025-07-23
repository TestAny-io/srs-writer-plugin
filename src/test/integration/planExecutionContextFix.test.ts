/**
 * 🚀 PLAN_EXECUTION上下文修复验证测试
 * 
 * 验证PlanExecutor失败时是否正确传递完整的计划执行上下文给orchestrator
 */

import { ContextManager } from '../../core/engine/ContextManager';
import { ExecutionStep } from '../../core/engine/AgentState';

describe('PLAN_EXECUTION Context Fix', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  describe('ContextManager.buildContextForPrompt', () => {
    it('应该正确识别和格式化PLAN_EXECUTION失败结果', () => {
      // 🚀 模拟PLAN_EXECUTION失败的ExecutionStep
      const executionHistory: ExecutionStep[] = [
        {
          type: 'tool_call',
          content: 'executeMarkdownEdits 执行成功',
          timestamp: Date.now() - 60000,
          toolName: 'executeMarkdownEdits',
          success: true,
          iteration: 1,
          duration: 442
        },
        {
          type: 'result',
          content: '计划执行失败: specialist执行失败: Response contained no choices.',
          timestamp: Date.now(),
          toolName: 'planExecutor',
          success: false,
          iteration: 2,
          result: {
            // 🚀 模拟完整的planExecutionContext
            originalExecutionPlan: {
              planId: 'srs-blackpink-fansite-001',
              description: 'Plan to initialize a new project and generate a complete SRS for the Blackpink fan support webapp.',
              steps: [
                {
                  step: 1,
                  description: 'Initialize the new project',
                  specialist: 'project_initializer',
                  context_dependencies: [],
                  language: 'zh'
                },
                {
                  step: 2,
                  description: 'Create comprehensive Overall Description',
                  specialist: 'overall_description_writer',
                  context_dependencies: [1],
                  language: 'zh'
                },
                {
                  step: 3,
                  description: 'Design the user journeys',
                  specialist: 'user_journey_writer',
                  context_dependencies: [1, 2],
                  language: 'zh'
                },
                {
                  step: 4,
                  description: 'Detail the core functional requirements',
                  specialist: 'fr_writer',
                  context_dependencies: [1, 2, 3],
                  language: 'zh'
                },
                {
                  step: 5,
                  description: 'Analyze use cases and define comprehensive system specifications',
                  specialist: 'nfr_writer',
                  context_dependencies: [1, 2, 3, 4],
                  language: 'zh'
                },
                {
                  step: 6,
                  description: 'Summarize ADC and write the Executive Summary',
                  specialist: 'summary_writer',
                  context_dependencies: [1, 2, 3, 4, 5],
                  language: 'zh'
                }
              ]
            },
            totalSteps: 6,
            completedSteps: 4,
            failedStep: 5,
            failedSpecialist: 'nfr_writer',
            completedWork: [
              { step: 1, specialist: 'project_initializer', description: 'Initialize the new project', status: 'completed' },
              { step: 2, specialist: 'overall_description_writer', description: 'Create comprehensive Overall Description', status: 'completed' },
              { step: 3, specialist: 'user_journey_writer', description: 'Design the user journeys', status: 'completed' },
              { step: 4, specialist: 'fr_writer', description: 'Detail the core functional requirements', status: 'completed' }
            ],
            error: 'specialist执行失败: Response contained no choices.'
          }
        }
      ];

      // 构建上下文
      const { historyContext, toolResultsContext } = contextManager.buildContextForPrompt(executionHistory);

      // 🎯 验证关键改进：PLAN_EXECUTION结果应该被正确格式化
      expect(historyContext).toContain('Plan Execution:');
      expect(historyContext).toContain('Plan to initialize a new project and generate a complete SRS for the Blackpink fan support webapp');
      expect(historyContext).toContain('Status: Failed at step 5 (nfr_writer)');
      expect(historyContext).toContain('Progress: 4/6 steps');
      expect(historyContext).toContain('Error: specialist执行失败: Response contained no choices.');

      // 🎯 验证不再是简单的"System Note"
      expect(historyContext).not.toContain('- System Note: 计划执行失败: specialist执行失败: Response contained no choices.');

      console.log('🎉 修复后的historyContext:');
      console.log(historyContext);
    });

    it('应该正确格式化PLAN_EXECUTION成功结果', () => {
      const executionHistory: ExecutionStep[] = [
        {
          type: 'result',
          content: '计划执行完成: 成功执行计划: Plan to create complete SRS document',
          timestamp: Date.now(),
          toolName: 'planExecutor',
          success: true,
          iteration: 1,
          result: {
            originalExecutionPlan: {
              planId: 'srs-test-001',
              description: 'Plan to create complete SRS document',
              steps: [
                { step: 1, description: 'Step 1', specialist: 'specialist1' },
                { step: 2, description: 'Step 2', specialist: 'specialist2' }
              ]
            },
            totalSteps: 2,
            completedSteps: 2,
            failedStep: null,
            failedSpecialist: null,
            completedWork: [
              { step: 1, specialist: 'specialist1', status: 'completed' },
              { step: 2, specialist: 'specialist2', status: 'completed' }
            ],
            error: null
          }
        }
      ];

      const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

      expect(historyContext).toContain('Plan Execution: "Plan to create complete SRS document"');
      expect(historyContext).toContain('Status: Completed');
      expect(historyContext).toContain('Progress: 2/2 steps completed');
    });

    it('应该为非PLAN_EXECUTION结果保持原有格式', () => {
      const executionHistory: ExecutionStep[] = [
        {
          type: 'result',
          content: '--- 新任务开始: 请帮我分析代码 ---',
          timestamp: Date.now(),
          toolName: undefined,
          success: true,
          iteration: 1
        }
      ];

      const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

      expect(historyContext).toContain('- System Note: --- 新任务开始: 请帮我分析代码 ---');
    });
  });

  describe('模拟完整的用户交互场景', () => {
    it('应该让AI能够理解之前的计划执行情况', () => {
      // 🎯 模拟真实场景：
      // 1. 用户: "帮我创建一个SRS文档"
      // 2. AI: 执行PLAN_EXECUTION，在第5步失败
      // 3. 用户: "上次任务没执行完，请继续"
      // 4. AI: 应该能看到完整的计划上下文

      const executionHistory: ExecutionStep[] = [
        {
          type: 'result',
          content: '--- 新任务开始: 帮我创建一个SRS文档 ---',
          timestamp: Date.now() - 120000,
          success: true,
          iteration: 1
        },
        {
          type: 'tool_call',
          content: 'executeMarkdownEdits 执行成功',
          timestamp: Date.now() - 60000,
          toolName: 'executeMarkdownEdits',
          success: true,
          iteration: 2,
          duration: 442
        },
        {
          type: 'result',
          content: '计划执行失败: specialist执行失败: Response contained no choices.',
          timestamp: Date.now() - 30000,
          toolName: 'planExecutor',
          success: false,
          iteration: 3,
          result: {
            originalExecutionPlan: {
              planId: 'srs-blackpink-fansite-001',
              description: 'Plan to initialize a new project and generate a complete SRS for the Blackpink fan support webapp.',
              steps: [
                { step: 1, description: 'Initialize project', specialist: 'project_initializer' },
                { step: 2, description: 'Overall description', specialist: 'overall_description_writer' },
                { step: 3, description: 'User journeys', specialist: 'user_journey_writer' },
                { step: 4, description: 'Functional requirements', specialist: 'fr_writer' },
                { step: 5, description: 'Non-functional requirements', specialist: 'nfr_writer' },
                { step: 6, description: 'Summary', specialist: 'summary_writer' }
              ]
            },
            totalSteps: 6,
            completedSteps: 4,
            failedStep: 5,
            failedSpecialist: 'nfr_writer',
            error: 'specialist执行失败: Response contained no choices.'
          }
        },
        {
          type: 'result',
          content: '--- 新任务开始: 上次任务没执行完，请继续 ---',
          timestamp: Date.now(),
          success: true,
          iteration: 4
        }
      ];

      const { historyContext } = contextManager.buildContextForPrompt(executionHistory);

      // 🎯 验证AI能看到完整的上下文信息
      expect(historyContext).toContain('Plan Execution:');
      expect(historyContext).toContain('Blackpink fan support webapp');
      expect(historyContext).toContain('Failed at step 5 (nfr_writer)');
      expect(historyContext).toContain('Progress: 4/6 steps');
      expect(historyContext).toContain('新任务开始: 上次任务没执行完，请继续');

      console.log('\n🎯 用户继续任务时AI看到的完整上下文:');
      console.log('='.repeat(60));
      console.log(historyContext);
      console.log('='.repeat(60));

      // 🎯 验证AI能够进行智能决策的关键信息都存在
      expect(historyContext).toMatch(/Plan.*Blackpink.*Failed.*step 5.*nfr_writer.*4\/6/);
    });
  });
});

/**
 * 🚀 手动测试函数 - 可以直接调用查看效果
 */
export function demoContextFix() {
  const contextManager = new ContextManager();
  
  console.log('\n🚀 PLAN_EXECUTION上下文修复效果演示');
  console.log('='.repeat(80));
  
  // 修复前的效果
  console.log('\n❌ 修复前AI看到的上下文:');
  console.log('- Tool Call: executeMarkdownEdits - ✅ Succeeded (442ms)');
  console.log('- System Note: 计划执行失败: specialist执行失败: Response contained no choices.');
  
  // 修复后的效果
  const executionHistory: ExecutionStep[] = [
    {
      type: 'tool_call',
      content: 'executeMarkdownEdits 执行成功',
      timestamp: Date.now() - 60000,
      toolName: 'executeMarkdownEdits',
      success: true,
      iteration: 1,
      duration: 442
    },
    {
      type: 'result',
      content: '计划执行失败: specialist执行失败: Response contained no choices.',
      timestamp: Date.now(),
      toolName: 'planExecutor',
      success: false,
      iteration: 2,
      result: {
        originalExecutionPlan: {
          planId: 'srs-blackpink-fansite-001',
          description: 'Plan to initialize a new project and generate a complete SRS for the Blackpink fan support webapp.',
          steps: [
            { step: 1, description: 'Initialize project', specialist: 'project_initializer' },
            { step: 2, description: 'Overall description', specialist: 'overall_description_writer' },
            { step: 3, description: 'User journeys', specialist: 'user_journey_writer' },
            { step: 4, description: 'Functional requirements', specialist: 'fr_writer' },
            { step: 5, description: 'Non-functional requirements', specialist: 'nfr_writer' },
            { step: 6, description: 'Summary', specialist: 'summary_writer' }
          ]
        },
        totalSteps: 6,
        completedSteps: 4,
        failedStep: 5,
        failedSpecialist: 'nfr_writer',
        error: 'specialist执行失败: Response contained no choices.'
      }
    }
  ];

  const { historyContext } = contextManager.buildContextForPrompt(executionHistory);
  
  console.log('\n✅ 修复后AI看到的上下文:');
  console.log(historyContext);
  
  console.log('\n🎯 关键改进:');
  console.log('1. AI现在知道之前执行了一个6步的SRS文档创建计划');
  console.log('2. AI知道前4步成功完成，第5步nfr_writer失败'); 
  console.log('3. AI知道失败原因是API问题（Response contained no choices）');
  console.log('4. AI可以基于这些信息做出智能的继续执行决策');
  
  console.log('='.repeat(80));
} 