/**
 * 调试有序列表解析问题
 */

import { SemanticLocator } from '../../../tools/atomic/semantic-locator';

describe('Debug Ordered List', () => {
    test('简单有序列表测试', () => {
        const markdownContent = `# 测试

## 有序列表

1. **步骤1**
   描述1
2. **步骤2**
   描述2`;

        console.log('🔍 Original markdown:');
        console.log(markdownContent);
        
        const locator = new SemanticLocator(markdownContent);
        
        console.log('\n🔍 All sections:');
        for (let i = 0; i < locator.getNodeCount(); i++) {
            // sections会被打印在日志中
        }
        
        // 尝试找步骤1
        const step1 = locator.findSectionByPath(['测试', '有序列表', '步骤1']);
        console.log('🔍 Found step1:', step1 ? 'YES' : 'NO');
    });
}); 