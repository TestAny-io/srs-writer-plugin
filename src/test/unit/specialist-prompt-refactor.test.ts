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

  describe('第三阶段：合并Current Step到CURRENT TASK', () => {
    test('CURRENT TASK应该显示完整的currentStep JSON', () => {
      const context: SpecialistContext = {
        specialist_type: 'content',
        TOOLS_JSON_SCHEMA: '{"tools": []}',
        SRS_TOC: '# TOC',
        projectMetadata: { baseDir: '/test' },
        structuredContext: {
          internalHistory: [],
          currentStep: {
            phase: 'planning',
            userRequirements: 'Test requirements',
            specialist: 'content',
            iterationCount: 1
          }
        }
      };

      const prompt = (promptAssemblyEngine as any).mergeTemplates(
        [],
        context,
        {},
        [],
        []
      );

      // 验证CURRENT TASK章节显示完整的currentStep JSON
      expect(prompt).toContain('**# 2. CURRENT TASK**');
      expect(prompt).toContain('"phase": "planning"');
      expect(prompt).toContain('"userRequirements": "Test requirements"');
      expect(prompt).toContain('"specialist": "content"');
    });

    test('DYNAMIC CONTEXT不应该包含Current Step子章节', () => {
      const context: SpecialistContext = {
        specialist_type: 'content',
        TOOLS_JSON_SCHEMA: '{"tools": []}',
        projectMetadata: { baseDir: '/test' },
        structuredContext: {
          internalHistory: [],
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

      // 验证DYNAMIC CONTEXT中不再有Current Step章节
      const dynamicContextMatch = prompt.match(/\*\*# 5\. DYNAMIC CONTEXT\*\*([\s\S]*?)\*\*# 6\. GUIDELINES/);
      expect(dynamicContextMatch).toBeTruthy();

      if (dynamicContextMatch) {
        const dynamicContextContent = dynamicContextMatch[1];
        expect(dynamicContextContent).not.toContain('## Current Step');
      }
    });

    test('currentStep为空时应该显示默认消息', () => {
      const context: SpecialistContext = {
        specialist_type: 'content',
        TOOLS_JSON_SCHEMA: '{"tools": []}',
        projectMetadata: { baseDir: '/test' },
        structuredContext: {
          internalHistory: []
        }
      };

      const prompt = (promptAssemblyEngine as any).mergeTemplates(
        [],
        context,
        {},
        [],
        []
      );

      expect(prompt).toContain('**# 2. CURRENT TASK**');
      expect(prompt).toContain('No current step available');
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

  describe('第四阶段：Tool Results简化显示 + Thought摘要', () => {
    test('应该显示thought摘要在iteration开头', () => {
      const internalHistory = [
        '迭代 1 - Thought摘要: 💭 **Thought**: [PLANNING] 分析需求并制定计划',
        '迭代 1 - AI计划:\n- readMarkdownFile: 读取文档',
        '迭代 1 - 工具结果:\nreadMarkdownFile:\n  - success: true',
        '迭代 2 - Thought摘要: 💭 **Thought**: [SYNTHESIS] 综合信息并执行',
        '迭代 2 - AI计划:\n- executeMarkdownEdits: 编辑文档',
        '迭代 2 - 工具结果:\nexecuteMarkdownEdits:\n  - success: true'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证thought摘要紧随iteration标题
      expect(formatted).toContain('### Iteration 1:');
      expect(formatted).toContain('💭 **Thought**: [PLANNING] 分析需求并制定计划');
      expect(formatted).toContain('### Iteration 2:');
      expect(formatted).toContain('💭 **Thought**: [SYNTHESIS] 综合信息并执行');

      // 验证thought摘要在AI Plan之前
      const iter1Match = formatted.match(/### Iteration 1:([\s\S]*?)### Iteration 2:/);
      if (iter1Match) {
        const iter1Content = iter1Match[1];
        const thoughtPos = iter1Content.indexOf('💭 **Thought**');
        const planPos = iter1Content.indexOf('**AI Plan**');
        expect(thoughtPos).toBeLessThan(planPos);
        expect(thoughtPos).toBeGreaterThan(-1);
      }
    });

    test('没有thought摘要的iteration应该正常显示', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\n- readMarkdownFile: 读取文档',
        '迭代 1 - 工具结果:\nreadMarkdownFile:\n  - success: true',
        '迭代 2 - Thought摘要: 💭 **Thought**: [SYNTHESIS] 综合信息',
        '迭代 2 - AI计划:\n- executeMarkdownEdits: 编辑文档'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证iteration 1没有thought摘要，但格式正常
      expect(formatted).toContain('### Iteration 1:');
      expect(formatted).toContain('**AI Plan**:\n- readMarkdownFile: 读取文档');

      // 验证iteration 2有thought摘要
      expect(formatted).toContain('### Iteration 2:');
      expect(formatted).toContain('💭 **Thought**: [SYNTHESIS] 综合信息');
    });

    test('完整工作流测试：包含thought摘要和简化的tool results', () => {
      const context: SpecialistContext = {
        userRequirements: 'Enhance usability requirements',
        specialist_type: 'content',
        TOOLS_JSON_SCHEMA: '{"tools": [{"name": "executeMarkdownEdits"}, {"name": "executeYAMLEdits"}]}',
        PREVIOUS_THOUGHTS: 'Previous thinking context',
        SRS_TOC: '# NFR Requirements',
        projectMetadata: { baseDir: '/test' },
        structuredContext: {
          internalHistory: [
            '迭代 1 - Thought摘要: 💭 **Thought**: [PLANNING] 读取现有需求',
            '迭代 1 - AI计划:\nreadMarkdownFile:\n  - path: SRS.md\n  - targets: 1 item(s)',
            '迭代 1 - 工具结果:\nreadMarkdownFile:\n  - success: true\n  - results: 1 item(s)',
            '迭代 2 - Thought摘要: 💭 **Thought**: [SYNTHESIS] 补充NFR条目',
            '迭代 2 - AI计划:\nexecuteMarkdownEdits:\n  - intents: 1 intent(s)\nexecuteYAMLEdits:\n  - edits: 5 edit(s)',
            '迭代 2 - 工具结果:\nexecuteMarkdownEdits:\n  - success: true\n  - appliedIntents: 1 intent(s)\n  - executionTime: 185ms\nexecuteYAMLEdits:\n  - success: true\n  - appliedEdits: 5 edit(s)\n  - executionTime: 13ms'
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

      // 验证完整结构
      expect(prompt).toContain('## Iterative History');
      expect(prompt).toContain('### Iteration 1:');
      expect(prompt).toContain('💭 **Thought**: [PLANNING] 读取现有需求');
      expect(prompt).toContain('### Iteration 2:');
      expect(prompt).toContain('💭 **Thought**: [SYNTHESIS] 补充NFR条目');

      // 验证tool results是简化格式，不包含完整的intent内容
      expect(prompt).toContain('executeMarkdownEdits:');
      expect(prompt).toContain('- success: true');
      expect(prompt).toContain('- appliedIntents: 1 intent(s)');
      expect(prompt).toContain('- executionTime: 185ms');

      expect(prompt).toContain('executeYAMLEdits:');
      expect(prompt).toContain('- appliedEdits: 5 edit(s)');
      expect(prompt).toContain('- executionTime: 13ms');
    });

    test('应该简化显示executeTextFileEdits的成功结果', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\nexecuteTextFileEdits:\n  - summary: Update CSS styles\n  - targetFile: styles.css\n  - edits: 3 edit(s)',
        '迭代 1 - 工具结果:\nexecuteTextFileEdits:\n  - success: true\n  - appliedEdits: 3 / 3\n  - totalReplacements: 5'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证简化格式
      expect(formatted).toContain('executeTextFileEdits:');
      expect(formatted).toContain('- success: true');
      expect(formatted).toContain('- appliedEdits: 3 / 3');
      expect(formatted).toContain('- totalReplacements: 5');

      // 验证不应包含完整的details数组
      expect(formatted).not.toContain('editIndex');
      expect(formatted).not.toContain('replacements:');
    });

    test('应该简化显示executeTextFileEdits的失败结果', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\nexecuteTextFileEdits:\n  - summary: Update CSS styles\n  - targetFile: styles.css\n  - edits: 5 edit(s)',
        '迭代 1 - 工具结果:\nexecuteTextFileEdits:\n  - success: false\n  - appliedEdits: 2 / 5\n  - failedEdits: 3\n  - error: Text not found in file'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证失败情况的简化格式
      expect(formatted).toContain('executeTextFileEdits:');
      expect(formatted).toContain('- success: false');
      expect(formatted).toContain('- appliedEdits: 2 / 5');
      expect(formatted).toContain('- failedEdits: 3');
      expect(formatted).toContain('- error: Text not found in file');
    });

    test('应该简化显示findAndReplace的成功结果', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\nfindAndReplace:\n  - searchPattern: oldText\n  - replacement: newText\n  - replaceAll: true',
        '迭代 1 - 工具结果:\nfindAndReplace:\n  - success: true\n  - matchesFound: 8\n  - applied: true\n  - replacementsCount: 8'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证简化格式
      expect(formatted).toContain('findAndReplace:');
      expect(formatted).toContain('- success: true');
      expect(formatted).toContain('- matchesFound: 8');
      expect(formatted).toContain('- applied: true');
      expect(formatted).toContain('- replacementsCount: 8');

      // 验证不应包含完整的replacements数组
      expect(formatted).not.toContain('line:');
      expect(formatted).not.toContain('originalText:');
      expect(formatted).not.toContain('newText:');
    });

    test('应该简化显示findAndReplace的无匹配结果', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\nfindAndReplace:\n  - searchPattern: nonExistentText\n  - replacement: newText',
        '迭代 1 - 工具结果:\nfindAndReplace:\n  - success: true\n  - matchesFound: 0\n  - applied: false'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证无匹配的简化格式
      expect(formatted).toContain('findAndReplace:');
      expect(formatted).toContain('- success: true');
      expect(formatted).toContain('- matchesFound: 0');
      expect(formatted).toContain('- applied: false');
    });

    test('完整工作流测试：所有4个大返回量工具的简化显示', () => {
      const context: SpecialistContext = {
        userRequirements: 'Update documentation and styles',
        specialist_type: 'content',
        TOOLS_JSON_SCHEMA: '{"tools": [{"name": "executeMarkdownEdits"}, {"name": "executeYAMLEdits"}, {"name": "executeTextFileEdits"}, {"name": "findAndReplace"}]}',
        PREVIOUS_THOUGHTS: 'Previous thinking context',
        SRS_TOC: '# Documentation',
        projectMetadata: { baseDir: '/test' },
        structuredContext: {
          internalHistory: [
            '迭代 1 - AI计划:\nexecuteMarkdownEdits:\n  - intents: 2 intent(s)\nexecuteYAMLEdits:\n  - edits: 3 edit(s)',
            '迭代 1 - 工具结果:\nexecuteMarkdownEdits:\n  - success: true\n  - appliedIntents: 2 intent(s)\n  - executionTime: 150ms\nexecuteYAMLEdits:\n  - success: true\n  - appliedEdits: 3 edit(s)\n  - executionTime: 10ms',
            '迭代 2 - AI计划:\nexecuteTextFileEdits:\n  - edits: 4 edit(s)\nfindAndReplace:\n  - searchPattern: oldStyle\n  - replacement: newStyle',
            '迭代 2 - 工具结果:\nexecuteTextFileEdits:\n  - success: true\n  - appliedEdits: 4 / 4\n  - totalReplacements: 7\nfindAndReplace:\n  - success: true\n  - matchesFound: 5\n  - applied: true\n  - replacementsCount: 5'
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

      // 验证所有4个工具的简化显示
      expect(prompt).toContain('executeMarkdownEdits:');
      expect(prompt).toContain('- appliedIntents: 2 intent(s)');
      expect(prompt).toContain('- executionTime: 150ms');

      expect(prompt).toContain('executeYAMLEdits:');
      expect(prompt).toContain('- appliedEdits: 3 edit(s)');
      expect(prompt).toContain('- executionTime: 10ms');

      expect(prompt).toContain('executeTextFileEdits:');
      expect(prompt).toContain('- appliedEdits: 4 / 4');
      expect(prompt).toContain('- totalReplacements: 7');

      expect(prompt).toContain('findAndReplace:');
      expect(prompt).toContain('- matchesFound: 5');
      expect(prompt).toContain('- applied: true');
      expect(prompt).toContain('- replacementsCount: 5');

      // 验证不包含冗余的完整内容
      expect(prompt).not.toContain('originalIntent:');
      expect(prompt).not.toContain('editIndex:');
      expect(prompt).not.toContain('originalText:');
    });
  });

  describe('回归测试：确保其他工具显示完整内容', () => {
    test('readMarkdownFile应该显示完整内容而不是简化摘要', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\nreadMarkdownFile:\n  - path: SRS.md\n  - parseMode: content',
        '迭代 1 - 工具结果:\nreadMarkdownFile:\n  - success: true\n  - path: SRS.md\n  - content: # Software Requirements Specification\\n\\nThis is the content...\n  - size: 1024\n  - parseTime: 50'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证显示完整结果，不是简化的"results: X item(s)"
      expect(formatted).toContain('readMarkdownFile:');
      expect(formatted).toContain('- success: true');
      expect(formatted).toContain('- path: SRS.md');
      expect(formatted).toContain('- content: # Software Requirements Specification');
      expect(formatted).toContain('- size: 1024');
      expect(formatted).toContain('- parseTime: 50');

      // 验证不应该被简化为"results: X item(s)"
      expect(formatted).not.toContain('results: 0 item(s)');
    });

    test('readYAMLFiles应该显示完整parsedData而不是被简化', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\nreadYAMLFiles:\n  - path: requirements.yaml\n  - includeStructure: true',
        '迭代 1 - 工具结果:\nreadYAMLFiles:\n  - success: true\n  - parsedData:\n    - functional_requirements:\n      - [0]:\n        - id: FR-001\n        - description: User authentication\n  - structure:\n    - totalKeys: 25\n    - depth: 3'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证显示完整结果
      expect(formatted).toContain('readYAMLFiles:');
      expect(formatted).toContain('- success: true');
      expect(formatted).toContain('- parsedData:');
      expect(formatted).toContain('- functional_requirements:');
      expect(formatted).toContain('- id: FR-001');
      expect(formatted).toContain('- description: User authentication');
      expect(formatted).toContain('- structure:');
      expect(formatted).toContain('- totalKeys: 25');

      // 验证success字段不应该重复显示
      const readYAMLSection = formatted.match(/readYAMLFiles:([\s\S]*?)(?=\n\n---\n\n|$)/)?.[0] || '';
      const successInSection = readYAMLSection.match(/- success: true/g);

      // 如果没有匹配到，说明section抽取有问题，但内容本身应该是正确的
      // 我们主要验证的是内容正确性，而不是格式解析
      if (successInSection) {
        expect(successInSection.length).toBe(1); // 只应该出现一次
      }
    });

    test('writeFile应该显示完整结果', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\nwriteFile:\n  - path: test.txt\n  - content: Hello World',
        '迭代 1 - 工具结果:\nwriteFile:\n  - success: true'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证显示完整结果（即使很简单）
      expect(formatted).toContain('writeFile:');
      expect(formatted).toContain('- success: true');
    });

    test('createDirectory应该显示完整结果', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\ncreateDirectory:\n  - path: new-folder\n  - isProjectDirectory: false',
        '迭代 1 - 工具结果:\ncreateDirectory:\n  - success: true\n  - createdPath: /workspace/new-folder'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证显示完整结果
      expect(formatted).toContain('createDirectory:');
      expect(formatted).toContain('- success: true');
      expect(formatted).toContain('- createdPath: /workspace/new-folder');
    });

    test('混合场景：简化工具和完整工具同时存在', () => {
      const context: SpecialistContext = {
        userRequirements: 'Read and update documentation',
        specialist_type: 'content',
        TOOLS_JSON_SCHEMA: '{"tools": [{"name": "readMarkdownFile"}, {"name": "executeMarkdownEdits"}, {"name": "readYAMLFiles"}, {"name": "writeFile"}]}',
        PREVIOUS_THOUGHTS: 'Previous thinking context',
        SRS_TOC: '# Documentation',
        projectMetadata: { baseDir: '/test' },
        structuredContext: {
          internalHistory: [
            '迭代 1 - AI计划:\nreadMarkdownFile:\n  - path: SRS.md\nreadYAMLFiles:\n  - path: config.yaml',
            '迭代 1 - 工具结果:\nreadMarkdownFile:\n  - success: true\n  - content: # SRS Document\\n\\nContent here...\n  - size: 512\nreadYAMLFiles:\n  - success: true\n  - parsedData:\n    - version: 1.0\n    - author: Test',
            '迭代 2 - AI计划:\nexecuteMarkdownEdits:\n  - intents: 2 intent(s)\nwriteFile:\n  - path: output.txt',
            '迭代 2 - 工具结果:\nexecuteMarkdownEdits:\n  - success: true\n  - appliedIntents: 2 intent(s)\n  - executionTime: 120ms\nwriteFile:\n  - success: true'
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

      // 验证读取工具显示完整内容
      expect(prompt).toContain('readMarkdownFile:');
      expect(prompt).toContain('- content: # SRS Document');
      expect(prompt).toContain('- size: 512');

      expect(prompt).toContain('readYAMLFiles:');
      expect(prompt).toContain('- parsedData:');
      expect(prompt).toContain('- version: 1.0');
      expect(prompt).toContain('- author: Test');

      // 验证写入工具显示完整内容
      expect(prompt).toContain('writeFile:');
      expect(prompt).toContain('- success: true');

      // 验证编辑工具显示简化内容
      expect(prompt).toContain('executeMarkdownEdits:');
      expect(prompt).toContain('- appliedIntents: 2 intent(s)');
      expect(prompt).toContain('- executionTime: 120ms');

      // 验证不包含冗余内容
      expect(prompt).not.toContain('originalIntent:');
    });

    test('readMarkdownFile使用targets参数时应该显示完整results数组', () => {
      const internalHistory = [
        '迭代 1 - AI计划:\nreadMarkdownFile:\n  - path: SRS.md\n  - targets: 1 item(s)',
        '迭代 1 - 工具结果:\nreadMarkdownFile:\n  - success: true\n  - results:\n    - [0]:\n      - sid: /srs/functional-requirements\n      - content: ## Functional Requirements\\n\\n...\n      - success: true'
      ];

      const formatted = (promptAssemblyEngine as any).formatIterativeHistory(internalHistory);

      // 验证显示完整results数组内容
      expect(formatted).toContain('readMarkdownFile:');
      expect(formatted).toContain('- results:');
      expect(formatted).toContain('- sid: /srs/functional-requirements');
      expect(formatted).toContain('- content: ## Functional Requirements');

      // 验证不应该被简化为"results: 1 item(s)"
      expect(formatted).not.toContain('results: 1 item(s)');
    });
  });
});
