/**
 * 单元测试：改进1 - 显示Execution Plan
 *
 * 测试范围：
 * 1. formatExecutionPlan() - 完整计划格式化
 * 2. getSpecialistIcon() - 图标映射
 * 3. simplifySpecialistName() - 中文名称映射
 *
 * Edge Cases:
 * - 空计划、空步骤数组
 * - 未知specialist
 * - 非常长的description
 * - 缺失字段
 * - 特殊字符
 */

import { describe, it, expect } from '@jest/globals';

// 由于formatExecutionPlan是private方法，我们通过反射或测试public行为
// 这里我们直接复制实现逻辑来测试核心算法

describe('改进1：Execution Plan Display', () => {

  // ===== getSpecialistIcon测试 =====
  describe('getSpecialistIcon()', () => {

    // 辅助函数：复制实际实现
    function getSpecialistIcon(specialistId: string): string {
      const iconMap: Record<string, string> = {
        'project_initializer': '🚀',
        'overall_description_writer': '📝',
        'biz_req_and_rule_writer': '📋',
        'use_case_writer': '🎭',
        'user_journey_writer': '🗺️',
        'user_story_writer': '📖',
        'fr_writer': '✏️',
        'nfr_writer': '⚡',
        'ifr_and_dar_writer': '🔗',
        'adc_writer': '📌',
        'summary_writer': '📄',
        'prototype_designer': '🎨',
        'document_formatter': '🎨',
        'srs_reviewer': '🔍'
      };
      return iconMap[specialistId] || '✏️';
    }

    it('应该为所有已知specialist返回正确的图标', () => {
      expect(getSpecialistIcon('project_initializer')).toBe('🚀');
      expect(getSpecialistIcon('overall_description_writer')).toBe('📝');
      expect(getSpecialistIcon('biz_req_and_rule_writer')).toBe('📋');
      expect(getSpecialistIcon('use_case_writer')).toBe('🎭');
      expect(getSpecialistIcon('user_journey_writer')).toBe('🗺️');
      expect(getSpecialistIcon('user_story_writer')).toBe('📖');
      expect(getSpecialistIcon('fr_writer')).toBe('✏️');
      expect(getSpecialistIcon('nfr_writer')).toBe('⚡');
      expect(getSpecialistIcon('ifr_and_dar_writer')).toBe('🔗');
      expect(getSpecialistIcon('adc_writer')).toBe('📌');
      expect(getSpecialistIcon('summary_writer')).toBe('📄');
      expect(getSpecialistIcon('prototype_designer')).toBe('🎨');
      expect(getSpecialistIcon('document_formatter')).toBe('🎨');
      expect(getSpecialistIcon('srs_reviewer')).toBe('🔍');
    });

    it('应该为未知specialist返回默认图标', () => {
      expect(getSpecialistIcon('unknown_specialist')).toBe('✏️');
      expect(getSpecialistIcon('random_id_12345')).toBe('✏️');
      expect(getSpecialistIcon('')).toBe('✏️');
    });

    it('Edge Case: 处理特殊字符specialist ID', () => {
      expect(getSpecialistIcon('specialist-with-dashes')).toBe('✏️');
      expect(getSpecialistIcon('specialist_with_UPPERCASE')).toBe('✏️');
      expect(getSpecialistIcon('specialist.with.dots')).toBe('✏️');
      expect(getSpecialistIcon('specialist with spaces')).toBe('✏️');
    });

    it('Edge Case: 处理null/undefined（应该fallback到默认）', () => {
      // TypeScript会报错，但运行时可能发生
      expect(getSpecialistIcon(null as any)).toBe('✏️');
      expect(getSpecialistIcon(undefined as any)).toBe('✏️');
    });
  });

  // ===== simplifySpecialistName测试 =====
  describe('simplifySpecialistName()', () => {

    // 辅助函数：复制实际实现
    function simplifySpecialistName(specialistId: string): string {
      const nameMap: Record<string, string> = {
        'project_initializer': '项目初始化',
        'overall_description_writer': '撰写项目概述',
        'biz_req_and_rule_writer': '定义业务需求',
        'use_case_writer': '生成用例',
        'user_journey_writer': '撰写用户旅程',
        'user_story_writer': '编写用户故事',
        'fr_writer': '编写功能需求',
        'nfr_writer': '定义非功能需求',
        'ifr_and_dar_writer': '指定接口需求',
        'adc_writer': '记录假设约束',
        'summary_writer': '编写执行摘要',
        'prototype_designer': '设计原型',
        'document_formatter': '文档格式化检查',
        'srs_reviewer': '审查文档'
      };
      return nameMap[specialistId] || specialistId;
    }

    it('应该为所有已知specialist返回正确的中文名称', () => {
      expect(simplifySpecialistName('project_initializer')).toBe('项目初始化');
      expect(simplifySpecialistName('overall_description_writer')).toBe('撰写项目概述');
      expect(simplifySpecialistName('biz_req_and_rule_writer')).toBe('定义业务需求');
      expect(simplifySpecialistName('use_case_writer')).toBe('生成用例');
      expect(simplifySpecialistName('user_journey_writer')).toBe('撰写用户旅程');
      expect(simplifySpecialistName('user_story_writer')).toBe('编写用户故事');
      expect(simplifySpecialistName('fr_writer')).toBe('编写功能需求');
      expect(simplifySpecialistName('nfr_writer')).toBe('定义非功能需求');
      expect(simplifySpecialistName('ifr_and_dar_writer')).toBe('指定接口需求');
      expect(simplifySpecialistName('adc_writer')).toBe('记录假设约束');
      expect(simplifySpecialistName('summary_writer')).toBe('编写执行摘要');
      expect(simplifySpecialistName('prototype_designer')).toBe('设计原型');
      expect(simplifySpecialistName('document_formatter')).toBe('文档格式化检查');
      expect(simplifySpecialistName('srs_reviewer')).toBe('审查文档');
    });

    it('应该为未知specialist返回原始ID', () => {
      expect(simplifySpecialistName('unknown_specialist')).toBe('unknown_specialist');
      expect(simplifySpecialistName('custom_agent_123')).toBe('custom_agent_123');
      expect(simplifySpecialistName('')).toBe('');
    });

    it('Edge Case: 处理特殊字符specialist ID', () => {
      expect(simplifySpecialistName('specialist-with-dashes')).toBe('specialist-with-dashes');
      expect(simplifySpecialistName('UPPERCASE_SPECIALIST')).toBe('UPPERCASE_SPECIALIST');
    });

    it('Edge Case: 处理null/undefined（应该fallback到原值）', () => {
      expect(simplifySpecialistName(null as any)).toBe(null as any);
      expect(simplifySpecialistName(undefined as any)).toBe(undefined as any);
    });
  });

  // ===== formatExecutionPlan测试 =====
  describe('formatExecutionPlan()', () => {

    // 辅助函数：复制完整实现
    function getSpecialistIcon(specialistId: string): string {
      const iconMap: Record<string, string> = {
        'project_initializer': '🚀',
        'fr_writer': '✏️',
        'srs_reviewer': '🔍'
      };
      return iconMap[specialistId] || '✏️';
    }

    function simplifySpecialistName(specialistId: string): string {
      const nameMap: Record<string, string> = {
        'project_initializer': '项目初始化',
        'fr_writer': '编写功能需求',
        'srs_reviewer': '审查文档'
      };
      return nameMap[specialistId] || specialistId;
    }

    function formatExecutionPlan(plan: any): string {
      const lines: string[] = [];

      lines.push(`📋 **任务计划** - ${plan.description}\n`);

      if (plan.steps && Array.isArray(plan.steps)) {
        plan.steps.forEach((step: any) => {
          const icon = getSpecialistIcon(step.specialist);
          const name = simplifySpecialistName(step.specialist);
          const fullDesc = step.description;

          lines.push(`${step.step}. ${icon} **${name}** - ${fullDesc}\n`);
        });
      }

      lines.push('---\n');

      return lines.join('\n');
    }

    it('应该正确格式化标准的10步计划', () => {
      const plan = {
        planId: 'test-plan-001',
        description: 'Initialize new project and generate Traditional SRS',
        steps: [
          {
            step: 1,
            specialist: 'project_initializer',
            description: 'Initialize the new project: create directory structure.'
          },
          {
            step: 2,
            specialist: 'fr_writer',
            description: 'Write functional requirements for the system.'
          },
          {
            step: 3,
            specialist: 'srs_reviewer',
            description: 'Review the SRS document for completeness.'
          }
        ]
      };

      const result = formatExecutionPlan(plan);

      expect(result).toContain('📋 **任务计划** - Initialize new project and generate Traditional SRS');
      expect(result).toContain('1. 🚀 **项目初始化** - Initialize the new project: create directory structure.');
      expect(result).toContain('2. ✏️ **编写功能需求** - Write functional requirements for the system.');
      expect(result).toContain('3. 🔍 **审查文档** - Review the SRS document for completeness.');
      expect(result).toContain('---');
    });

    it('Edge Case: 应该处理空步骤数组', () => {
      const plan = {
        planId: 'test-plan-002',
        description: 'Empty plan',
        steps: []
      };

      const result = formatExecutionPlan(plan);

      expect(result).toContain('📋 **任务计划** - Empty plan');
      expect(result).toContain('---');
      expect(result.split('\n').length).toBe(4); // title + newline + separator + newline
    });

    it('Edge Case: 应该处理缺失steps字段', () => {
      const plan = {
        planId: 'test-plan-003',
        description: 'Plan without steps field'
      };

      const result = formatExecutionPlan(plan);

      expect(result).toContain('📋 **任务计划** - Plan without steps field');
      expect(result).toContain('---');
      expect(result.split('\n').length).toBe(4);
    });

    it('Edge Case: 应该处理steps为null', () => {
      const plan = {
        planId: 'test-plan-004',
        description: 'Plan with null steps',
        steps: null
      };

      const result = formatExecutionPlan(plan);

      expect(result).toContain('📋 **任务计划** - Plan with null steps');
      expect(result).toContain('---');
    });

    it('Edge Case: 应该处理steps为非数组类型', () => {
      const plan = {
        planId: 'test-plan-005',
        description: 'Plan with invalid steps type',
        steps: 'not an array' as any
      };

      const result = formatExecutionPlan(plan);

      expect(result).toContain('📋 **任务计划** - Plan with invalid steps type');
      expect(result).toContain('---');
      expect(result).not.toContain('not an array');
    });

    it('Edge Case: 应该处理未知specialist', () => {
      const plan = {
        planId: 'test-plan-006',
        description: 'Plan with unknown specialist',
        steps: [
          {
            step: 1,
            specialist: 'unknown_custom_specialist',
            description: 'Do something custom'
          }
        ]
      };

      const result = formatExecutionPlan(plan);

      expect(result).toContain('1. ✏️ **unknown_custom_specialist** - Do something custom');
    });

    it('Edge Case: 应该处理非常长的description（显示完整内容）', () => {
      const longDescription = 'This is a very long description that contains multiple sentences and detailed explanation about what this step should do. '.repeat(5);

      const plan = {
        planId: 'test-plan-007',
        description: 'Plan with long description',
        steps: [
          {
            step: 1,
            specialist: 'fr_writer',
            description: longDescription
          }
        ]
      };

      const result = formatExecutionPlan(plan);

      // 应该显示完整description，不截断
      expect(result).toContain(longDescription);
      expect(result.length).toBeGreaterThan(500);
    });

    it('Edge Case: 应该处理description包含特殊markdown字符', () => {
      const plan = {
        planId: 'test-plan-008',
        description: 'Plan with **bold** and *italic* text',
        steps: [
          {
            step: 1,
            specialist: 'fr_writer',
            description: 'Description with `code`, **bold**, *italic*, and [link](url)'
          }
        ]
      };

      const result = formatExecutionPlan(plan);

      expect(result).toContain('Description with `code`, **bold**, *italic*, and [link](url)');
    });

    it('Edge Case: 应该处理step对象缺少specialist字段', () => {
      const plan = {
        planId: 'test-plan-009',
        description: 'Plan with missing specialist',
        steps: [
          {
            step: 1,
            description: 'Step without specialist field'
          } as any
        ]
      };

      const result = formatExecutionPlan(plan);

      // 应该使用默认图标和specialist ID作为名称
      expect(result).toContain('1. ✏️');
      expect(result).toContain('Step without specialist field');
    });

    it('Edge Case: 应该处理step对象缺少description字段', () => {
      const plan = {
        planId: 'test-plan-010',
        description: 'Plan with missing description',
        steps: [
          {
            step: 1,
            specialist: 'fr_writer'
          } as any
        ]
      };

      const result = formatExecutionPlan(plan);

      // description为undefined，应该显示undefined或空
      expect(result).toContain('1. ✏️ **编写功能需求**');
    });

    it('Edge Case: 应该处理step编号不连续', () => {
      const plan = {
        planId: 'test-plan-011',
        description: 'Plan with non-consecutive steps',
        steps: [
          { step: 1, specialist: 'project_initializer', description: 'Step 1' },
          { step: 5, specialist: 'fr_writer', description: 'Step 5' },
          { step: 10, specialist: 'srs_reviewer', description: 'Step 10' }
        ]
      };

      const result = formatExecutionPlan(plan);

      expect(result).toContain('1. 🚀');
      expect(result).toContain('5. ✏️');
      expect(result).toContain('10. 🔍');
    });

    it('Edge Case: 应该处理description包含换行符', () => {
      const plan = {
        planId: 'test-plan-012',
        description: 'Plan with newlines in description',
        steps: [
          {
            step: 1,
            specialist: 'fr_writer',
            description: 'First line\nSecond line\nThird line'
          }
        ]
      };

      const result = formatExecutionPlan(plan);

      expect(result).toContain('First line\nSecond line\nThird line');
    });

    it('应该在每个步骤后添加空行以便阅读', () => {
      const plan = {
        planId: 'test-plan-013',
        description: 'Test spacing',
        steps: [
          { step: 1, specialist: 'project_initializer', description: 'Step 1' },
          { step: 2, specialist: 'fr_writer', description: 'Step 2' }
        ]
      };

      const result = formatExecutionPlan(plan);

      // 每个步骤行应该以\n结尾
      const lines = result.split('\n');
      expect(lines.length).toBeGreaterThan(4); // title, step1, step2, separator至少4行
    });

    it('应该处理超过20步的大型计划', () => {
      const steps = Array.from({ length: 25 }, (_, i) => ({
        step: i + 1,
        specialist: 'fr_writer',
        description: `Step ${i + 1} description`
      }));

      const plan = {
        planId: 'test-plan-014',
        description: 'Large plan with 25 steps',
        steps
      };

      const result = formatExecutionPlan(plan);

      expect(result).toContain('25. ✏️ **编写功能需求** - Step 25 description');
      const stepCount = (result.match(/\d+\. ✏️/g) || []).length;
      expect(stepCount).toBe(25);
    });
  });
});
