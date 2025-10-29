/**
 * Specialist提示词重构单元测试
 * 测试第一阶段和第二阶段的重构功能
 */

import { PromptAssemblyEngine, SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';

describe('Specialist提示词重构测试', () => {
  let promptAssemblyEngine: PromptAssemblyEngine;

  beforeEach(() => {
    promptAssemblyEngine = new PromptAssemblyEngine('/test/rules');
  });

  describe('第一阶段：提示词顺序调整', () => {
    test('应该按照新顺序1,2,3,4,5,6,7,8,9,10组织提示词部分', async () => {
      const context: SpecialistContext = {
        userRequirements: 'Test task',
        specialist_type: 'content',
        TOOLS_JSON_SCHEMA: '{"tools": []}',
        PREVIOUS_THOUGHTS: 'Previous thoughts content',
        SRS_TOC: '# Table of Contents',
        projectMetadata: { baseDir: '/test' },
        structuredContext: {
          internalHistory: [],
          currentStep: { phase: 'planning' }
        }
      };

      // 使用私有方法mergeTemplates（通过类型断言访问）
      const prompt = (promptAssemblyEngine as any).mergeTemplates(
        [],
        context,
        {},
        [],
        []
      );

      // 验证Table of Contents顺序
      expect(prompt).toContain('Table of Contents:');

      // 提取Table of Contents部分
      const tocMatch = prompt.match(/Table of Contents:\s+([\s\S]+?)\n\n\*\*/);
      expect(tocMatch).toBeTruthy();

      if (tocMatch) {
        const toc = tocMatch[1];
        const lines = toc.split('\n').filter((line: string) => line.trim());

        // 验证新顺序
        expect(lines[0]).toContain('1. SPECIALIST INSTRUCTIONS');
        expect(lines[1]).toContain('2. CURRENT TASK');
        expect(lines[2]).toContain('3. LATEST RESPONSE FROM USER');
        expect(lines[3]).toContain('4. YOUR PREVIOUS THOUGHTS');
        expect(lines[4]).toContain('5. DYNAMIC CONTEXT');
        expect(lines[5]).toContain('6. GUIDELINES AND SAMPLE OF TOOLS USING');
        expect(lines[6]).toContain('7. YOUR TOOLS LIST');
        expect(lines[7]).toContain('8. TEMPLATE FOR YOUR CHAPTERS');
        expect(lines[8]).toContain('9. TABLE OF CONTENTS OF CURRENT SRS');
        expect(lines[9]).toContain('10. FINAL INSTRUCTION');
      }
    });

    test('实际内容部分应该与目录顺序一致', async () => {
      const context: SpecialistContext = {
        userRequirements: 'Test task',
        specialist_type: 'content',
        TOOLS_JSON_SCHEMA: '{"tools": []}',
        PREVIOUS_THOUGHTS: 'Previous thoughts',
        SRS_TOC: '# TOC',
        projectMetadata: { baseDir: '/test' },
        structuredContext: {
          internalHistory: [],
          currentStep: { phase: 'planning' }
        }
      };

      const prompt = (promptAssemblyEngine as any).mergeTemplates(
        [],
        context,
        {},
        ['Base template content'],
        ['Content template']
      );

      // 验证各部分出现的顺序
      const section1Pos = prompt.indexOf('**# 1. SPECIALIST INSTRUCTIONS**');
      const section2Pos = prompt.indexOf('**# 2. CURRENT TASK**');
      const section3Pos = prompt.indexOf('**# 3. LATEST RESPONSE FROM USER**');
      const section4Pos = prompt.indexOf('**# 4. YOUR PREVIOUS THOUGHTS**');
      const section5Pos = prompt.indexOf('**# 5. DYNAMIC CONTEXT**');
      const section6Pos = prompt.indexOf('**# 6. GUIDELINES AND SAMPLE OF TOOLS USING**');
      const section7Pos = prompt.indexOf('**# 7. YOUR TOOLS LIST**');
      const section8Pos = prompt.indexOf('**# 8. TEMPLATE FOR YOUR CHAPTERS**');
      const section9Pos = prompt.indexOf('**# 9. TABLE OF CONTENTS OF CURRENT SRS');
      const section10Pos = prompt.indexOf('**# 10. FINAL INSTRUCTION**');

      // 验证顺序正确
      expect(section1Pos).toBeLessThan(section2Pos);
      expect(section2Pos).toBeLessThan(section3Pos);
      expect(section3Pos).toBeLessThan(section4Pos);
      expect(section4Pos).toBeLessThan(section5Pos);
      expect(section5Pos).toBeLessThan(section6Pos);
      expect(section6Pos).toBeLessThan(section7Pos);
      expect(section7Pos).toBeLessThan(section8Pos);
      expect(section8Pos).toBeLessThan(section9Pos);
      expect(section9Pos).toBeLessThan(section10Pos);
    });
  });

  describe('第二阶段：迭代历史格式化', () => {
    test('应该将迭代历史按迭代分组并添加分隔符', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\n- executeMarkdownEdits: 编辑文档',
        '迭代 1 - 工具结果:\nexecuteMarkdownEdits:\n  - success: true',
        '迭代 2 - 用户回复: 请继续',
        '迭代 2 - AI计划:\n- readMarkdownFile: 读取文件',
        '迭代 2 - 工具结果:\nreadMarkdownFile:\n  - success: true'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证格式化输出包含预期的结构
      expect(formatted).toContain('### Iteration 1:');
      expect(formatted).toContain('### Iteration 2:');
      expect(formatted).toContain('**AI Plan**:');
      expect(formatted).toContain('**Tool Results**:');
      expect(formatted).toContain('**User Reply**:');
      expect(formatted).toContain('---'); // 分隔符
    });

    test('应该正确处理包含Resume State的历史记录', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\n- askQuestion: 询问用户',
        '迭代 1 - 工具结果:\naskQuestion:\n  - success: true',
        '迭代 2 - 用户回复: 用户的答案',
        '迭代 2 - 之前的工具结果:\n工具: askQuestion\naskQuestion:\n  - success: true',
        '迭代 2 - AI计划:\n- taskComplete: 完成任务',
        '迭代 2 - 工具结果:\ntaskComplete:\n  - success: true'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证包含所有必要的部分
      expect(formatted).toContain('### Iteration 1:');
      expect(formatted).toContain('### Iteration 2:');
      expect(formatted).toContain('**User Reply**: 用户的答案');
      expect(formatted).toContain('**Previous Tool Results**:');
      expect(formatted).toContain('askQuestion');
    });

    test('空历史记录应该返回默认消息', () => {
      const formatted = (promptAssemblyEngine as any).formatIterativeHistory([]);
      expect(formatted).toBe('No iterative history available');
    });

    test('应该按迭代编号排序', () => {
      const internalHistory = [
        '迭代 3 - AI计划:\n- tool3',
        '迭代 1 - AI计划:\n- tool1',
        '迭代 2 - AI计划:\n- tool2'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证顺序
      const iter1Pos = formatted.indexOf('### Iteration 1:');
      const iter2Pos = formatted.indexOf('### Iteration 2:');
      const iter3Pos = formatted.indexOf('### Iteration 3:');

      expect(iter1Pos).toBeLessThan(iter2Pos);
      expect(iter2Pos).toBeLessThan(iter3Pos);
    });

    test('应该在迭代之间添加分隔符', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\n- tool1',
        '迭代 2 - AI计划:\n- tool2'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证分隔符存在于迭代之间
      const sections = formatted.split('---');
      expect(sections.length).toBeGreaterThan(1);
    });
  });

  describe('集成测试：完整提示词生成', () => {
    test('使用迭代历史的完整提示词应该格式正确', async () => {
      const context: SpecialistContext = {
        userRequirements: 'Complete the SRS document',
        specialist_type: 'content',
        TOOLS_JSON_SCHEMA: '{"tools": [{"name": "executeMarkdownEdits"}]}',
        PREVIOUS_THOUGHTS: 'I need to update the document',
        SRS_TOC: '# 1. Introduction\n# 2. Requirements',
        projectMetadata: { baseDir: '/test' },
        structuredContext: {
          internalHistory: [
            '迭代 1 - AI计划:\n- executeMarkdownEdits: 更新介绍',
            '迭代 1 - 工具结果:\nexecuteMarkdownEdits:\n  - success: true'
          ],
          currentStep: { phase: 'execution' }
        }
      };

      const prompt = (promptAssemblyEngine as any).mergeTemplates(
        [],
        context,
        {},
        [],
        []
      );

      // 验证提示词结构完整
      expect(prompt).toContain('Table of Contents:');
      expect(prompt).toContain('**# 1. SPECIALIST INSTRUCTIONS**');
      expect(prompt).toContain('**# 2. CURRENT TASK**');
      expect(prompt).toContain('**# 4. YOUR PREVIOUS THOUGHTS**');
      expect(prompt).toContain('**# 5. DYNAMIC CONTEXT**');
      expect(prompt).toContain('## Iterative History');
      expect(prompt).toContain('### Iteration 1:');
      expect(prompt).toContain('**# 10. FINAL INSTRUCTION**');
    });
  });
});
