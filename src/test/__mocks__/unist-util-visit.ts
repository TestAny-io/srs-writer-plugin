/**
 * Mock for unist-util-visit module
 * 为unist-util-visit提供简化的mock实现
 */

// Mock visit function
export function visit(tree: any, type: string | undefined, callback: Function) {
    // 简化的visit实现，只处理heading节点
    if (!tree) return;
    
    function traverse(node: any) {
        if (!node) return;
        
        // 如果类型匹配或者没有指定类型，调用回调
        if (!type || node.type === type) {
            callback(node);
        }
        
        // 递归遍历子节点
        if (node.children && Array.isArray(node.children)) {
            node.children.forEach(traverse);
        }
    }
    
    traverse(tree);
}