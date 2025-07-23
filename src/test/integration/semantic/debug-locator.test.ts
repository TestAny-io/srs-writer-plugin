/**
 * 调试SemanticLocator的AST解析
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { SemanticLocator } from '../../../tools/atomic/semantic-locator';

describe('Debug AST Parsing', () => {
    test('检查AST解析结果', () => {
        const simpleMarkdown = `# 标题1

## 标题2

- **项目1**
  描述

- **项目2**  
  描述`;

        console.log('Original markdown:');
        console.log(simpleMarkdown);
        
        // 直接使用unified解析
        const ast = unified().use(remarkParse).parse(simpleMarkdown);
        console.log('Raw AST:');
        console.log(JSON.stringify(ast, null, 2));
        
        // 使用SemanticLocator
        const locator = new SemanticLocator(simpleMarkdown);
        console.log('SemanticLocator section count:', locator.getNodeCount());
        
        // 手动检查AST children
        console.log('AST children types:');
        ast.children.forEach((child, index) => {
            console.log(`Child ${index}: type=${child.type}, position=${JSON.stringify(child.position)}`);
            if ('children' in child) {
                console.log(`  Has ${(child as any).children.length} children`);
            }
        });
    });
}); 