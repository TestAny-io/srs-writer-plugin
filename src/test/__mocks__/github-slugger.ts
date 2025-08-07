/**
 * Mock for github-slugger module
 * 为github-slugger提供简化的mock实现
 */

class MockGithubSlugger {
    private used: Set<string> = new Set();

    slug(text: string): string {
        // 简化的slug生成：转小写，替换空格为连字符
        const baseSlug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        
        // 处理重复
        let slug = baseSlug;
        let counter = 1;
        while (this.used.has(slug)) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
        
        this.used.add(slug);
        return slug;
    }

    reset(): void {
        this.used.clear();
    }
}

export default MockGithubSlugger;