/**
 * Mock for remark-gfm module
 * 为remark-gfm提供简化的mock实现
 */

// Mock remark-gfm plugin
function remarkGfm() {
    return function transformer(tree: any) {
        // 简化的GFM transformer，不做实际转换
        return tree;
    };
}

export default remarkGfm;