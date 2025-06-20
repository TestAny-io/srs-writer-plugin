/**
 * 🚫 DEPRECATED - 此测试文件已废弃
 * 
 * 原因：SRSParser已被重构为工具架构：
 * - documentGeneratorTools: 生成完整SRS报告
 * - documentImporterTools: 从Markdown导入解析
 * 
 * 新的测试应该针对具体的工具进行，而不是整个解析器类。
 */

// import { SRSParser } from '../../parser/srs-parser';  // 已删除
import { ParseOptions } from '../../types';

/**
 * SRS解析器性能测试套件
 * 测试解析器在各种负载下的性能表现
 */
describe('SRSParser Performance Tests (DEPRECATED)', () => {

    // let parser: SRSParser;  // 已删除

    beforeEach(() => {
        // parser = new SRSParser();  // 已删除
    });

    test.skip('DEPRECATED: 此测试已废弃 - 解析器已重构为工具架构', () => {
        // 此测试已废弃，因为SRSParser已被重构为工具架构
        expect(true).toBe(true);
    });

    // 原有的所有测试都被跳过，因为测试目标不再存在
});

/**
 * 生成大型YAML内容用于测试
 */
function generateLargeYamlContent(requirementCount: number): string {
    let content = `
version: "1.0"
title: "性能测试文档"
project:
  name: "测试项目"
  description: "用于性能测试的项目"
  version: "1.0.0"
  stakeholders: ["测试团队"]
  scope: "性能测试范围"
metadata:
  createdAt: "${new Date().toISOString()}"
  updatedAt: "${new Date().toISOString()}"
  author: "性能测试"
sections:
  - id: "SEC-001"
    title: "功能需求"
    content: "功能需求章节"
    requirements:
`;

    for (let i = 1; i <= requirementCount; i++) {
        content += `
      - id: "FR-${i.toString().padStart(3, '0')}"
        title: "功能需求${i}"
        description: "这是功能需求${i}的详细描述，包含了完整的需求说明和实现细节。"
        priority: "${i % 3 === 0 ? 'high' : i % 2 === 0 ? 'medium' : 'low'}"
        type: "functional"
        status: "draft"
        dependencies: []
        acceptanceCriteria:
          - "验收标准1"
          - "验收标准2"
          - "验收标准3"`;
    }

    return content;
}

/**
 * 生成中等大小的YAML内容
 */
function generateMediumYamlContent(requirementCount: number): string {
    return generateLargeYamlContent(requirementCount);
}

/**
 * 生成大型Markdown内容用于测试
 */
function generateLargeMarkdownContent(sectionCount: number): string {
    let content = '# 性能测试文档\n\n项目名称: 测试项目\n\n';
    
    for (let i = 1; i <= sectionCount; i++) {
        content += `## 章节${i}\n\n`;
        content += `这是章节${i}的内容描述，包含了详细的功能说明和需求描述。\n\n`;
        
        // 添加一些需求
        for (let j = 1; j <= 3; j++) {
            const reqId = `FR-${(i * 10 + j).toString().padStart(3, '0')}`;
            content += `- ${reqId}: 需求${i}-${j}\n`;
            content += `  这是${reqId}的详细描述，包含了完整的需求说明。\n\n`;
        }
    }
    
    return content;
} 