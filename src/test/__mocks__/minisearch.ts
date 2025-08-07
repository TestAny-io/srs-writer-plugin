/**
 * Mock for minisearch module
 * 为minisearch提供简化的mock实现
 */

class MockMiniSearch {
    private documents: any[] = [];
    private options: any;

    constructor(options: any = {}) {
        this.options = options;
    }

    addAll(documents: any[]): void {
        this.documents = [...documents];
    }

    search(query: string): any[] {
        // 简化的搜索实现：返回包含查询词的文档
        return this.documents
            .filter(doc => {
                const searchText = (doc.title + ' ' + doc.content).toLowerCase();
                return searchText.includes(query.toLowerCase());
            })
            .map((doc, index) => ({
                id: doc.id,
                title: doc.title,
                content: doc.content,
                level: doc.level,
                score: 1.0 - (index * 0.1) // 简单的评分
            }));
    }
}

export default MockMiniSearch;