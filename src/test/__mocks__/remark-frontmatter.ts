/**
 * Mock for remark-frontmatter module
 * 为remark-frontmatter提供简化的mock实现
 */

// Mock remark-frontmatter plugin
function remarkFrontmatter() {
    return function transformer(tree: any) {
        // 简化的frontmatter transformer，不做实际转换
        return tree;
    };
}

export default remarkFrontmatter;