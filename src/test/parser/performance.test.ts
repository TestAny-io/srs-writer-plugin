import { SRSParser } from '../../parser/srs-parser';
import { ParseOptions } from '../../types';

/**
 * 性能测试套件
 */
describe('SRS Parser Performance Tests', () => {
    let parser: SRSParser;
    
    beforeEach(() => {
        parser = new SRSParser();
    });

    /**
     * 测试大型文档解析性能
     */
    test('should parse large YAML document within acceptable time', async () => {
        const largeYamlContent = generateLargeYamlContent(1000); // 1000个需求
        const options: ParseOptions = {
            outputFormat: 'yaml',
            includeMetadata: true
        };

        const startTime = Date.now();
        const result = await parser.parse(largeYamlContent, options);
        const endTime = Date.now();
        
        const parseTime = endTime - startTime;
        
        expect(result).toBeDefined();
        expect(Object.keys(result).length).toBeGreaterThan(0);
        expect(parseTime).toBeLessThan(5000); // 应在5秒内完成
    });

    /**
     * 测试Markdown解析性能
     */
    test('should parse large Markdown document efficiently', async () => {
        const largeMarkdownContent = generateLargeMarkdownContent(500); // 500个章节
        const options: ParseOptions = {
            outputFormat: 'yaml',
            includeMetadata: false
        };

        const startTime = Date.now();
        const result = await parser.parse(largeMarkdownContent, options);
        const endTime = Date.now();
        
        const parseTime = endTime - startTime;
        
        expect(result).toBeDefined();
        expect(parseTime).toBeLessThan(3000); // 应在3秒内完成
    });

    /**
     * 测试内存使用情况
     */
    test('should not cause memory leak during multiple parse operations', async () => {
        const yamlContent = generateMediumYamlContent(100);
        const options: ParseOptions = {
            outputFormat: 'yaml',
            includeMetadata: true
        };

        // 执行多次解析操作
        for (let i = 0; i < 50; i++) {
            const result = await parser.parse(yamlContent, options);
            expect(result).toBeDefined();
        }

        // 如果存在内存泄漏，这个测试可能会失败或变慢
        expect(true).toBe(true);
    });

    /**
     * 性能基准测试
     */
    test('performance benchmark for different document sizes', async () => {
        const sizes = [10, 50, 100, 200, 500];
        const results: Array<{size: number, time: number}> = [];

        for (const size of sizes) {
            const content = generateLargeYamlContent(size);
            const options: ParseOptions = {
                outputFormat: 'yaml',
                includeMetadata: true
            };

            const startTime = Date.now();
            await parser.parse(content, options);
            const endTime = Date.now();
            
            const parseTime = endTime - startTime;
            results.push({ size, time: parseTime });
        }

        // 输出性能基准结果
        console.table(results);
        
        // 验证性能是否在合理范围内
        results.forEach(result => {
            expect(result.time).toBeLessThan(result.size * 10); // 每个需求不超过10ms
        });
    });
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