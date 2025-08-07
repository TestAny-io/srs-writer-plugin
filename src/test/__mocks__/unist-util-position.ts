/**
 * Mock for unist-util-position module
 * 为unist-util-position提供简化的mock实现
 */

// Mock position function
export function position(node: any) {
    // 简化的位置信息，适用于测试
    if (!node) return null;
    
    return {
        start: {
            line: 1,
            column: 1,
            offset: 0
        },
        end: {
            line: 1,
            column: 10,
            offset: 10
        }
    };
}