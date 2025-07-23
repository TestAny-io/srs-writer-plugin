/**
 * 测试remark-parse的正确用法
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';

describe('Remark Parse Test', () => {
    test('测试基础markdown解析', () => {
        const markdown1 = `# 标题1

## 标题2

- 项目1
- 项目2`;

        const processor = unified().use(remarkParse);
        const ast = processor.parse(markdown1);
        
        console.log('Test 1 - AST:');
        console.log(JSON.stringify(ast, null, 2));
        
        // 测试不同的markdown格式
        const markdown2 = "# 标题1\n\n## 标题2\n\n- 项目1\n- 项目2";
        const ast2 = processor.parse(markdown2);
        
        console.log('Test 2 - AST:');
        console.log(JSON.stringify(ast2, null, 2));
        
        // 测试最简单的例子
        const markdown3 = "# Hello\n\nWorld";
        const ast3 = processor.parse(markdown3);
        
        console.log('Test 3 - Simple AST:');
        console.log(JSON.stringify(ast3, null, 2));
    });
}); 