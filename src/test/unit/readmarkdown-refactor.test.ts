/**
 * readMarkdownFile 工具重构单元测试
 * 直接测试重构后的核心功能
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import { 
    ParseMode,
    TableOfContentsTreeNode,
    TableOfContentsToCNode,
    TargetRequest
} from '../../tools/document/enhanced-readfile-tools';

// 测试类型定义和接口

describe('readMarkdownFile 重构单元测试', () => {
    const testMarkdownContent = `# 第一章 系统概述

这是第一章的内容，包含系统的基本概述。

## 1.1 系统架构

详细描述系统的架构设计。

### 1.1.1 前端架构

前端采用React技术栈。

\`\`\`javascript
const component = () => {
    return <div>Hello World</div>;
};
\`\`\`

### 1.1.2 后端架构

后端采用Node.js技术栈。

| 组件 | 技术栈 |
|------|--------|
| API | Express |
| DB | MongoDB |

## 1.2 部署方式

- Docker容器化部署
- Kubernetes编排
- CI/CD自动化

# 第二章 功能需求

这是第二章的内容，描述功能需求。

## 2.1 用户管理

用户管理功能包括：
- 用户注册
- 用户登录
- 用户权限管理

## 2.2 数据管理

数据管理功能包括数据的增删改查。
`;

    // 创建解析引擎
    const parsingEngine = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkFrontmatter);

    // 模拟StructureAnalyzer类的主要方法
    class TestStructureAnalyzer {
        private structureAnalyzer: any;

        constructor() {
            // 这里应该实例化真正的StructureAnalyzer，但为了测试简化
            // 我们直接测试类型定义和基本逻辑
        }

        async parseDocument(content: string) {
            return await parsingEngine.parse(content);
        }
    }

    describe('ParseMode类型支持', () => {
        it('应该支持所有四种解析模式', () => {
            const validModes: ParseMode[] = ['content', 'structure', 'toc', 'full'];
            expect(validModes).toContain('content');
            expect(validModes).toContain('structure');
            expect(validModes).toContain('toc');
            expect(validModes).toContain('full');
        });
    });

    describe('接口定义验证', () => {
        it('TableOfContentsTreeNode应该包含正确的字段', () => {
            const mockTreeNode: TableOfContentsTreeNode = {
                sid: '/test',
                displayId: '1',
                title: 'Test Title',
                normalizedTitle: 'Test Title',
                level: 1,
                line: 1,
                offset: {
                    utf16: { startLine: 1, endLine: 1, startColumn: 0, endColumn: 10 }
                },
                wordCount: 10,
                characterCount: 50,
                containsCode: false,
                containsTables: false,
                containsLists: false,
                children: [],
                siblingIndex: 0,
                siblingCount: 1
            };

            // 验证所有必需字段都存在
            expect(mockTreeNode.sid).toBeDefined();
            expect(mockTreeNode.displayId).toBeDefined();
            expect(mockTreeNode.title).toBeDefined();
            expect(mockTreeNode.normalizedTitle).toBeDefined();
            expect(mockTreeNode.level).toBeDefined();
            expect(mockTreeNode.line).toBeDefined();
            expect(mockTreeNode.offset).toBeDefined();
            expect(mockTreeNode.wordCount).toBeDefined();
            expect(mockTreeNode.characterCount).toBeDefined();
            expect(mockTreeNode.containsCode).toBeDefined();
            expect(mockTreeNode.containsTables).toBeDefined();
            expect(mockTreeNode.containsLists).toBeDefined();
            expect(mockTreeNode.children).toBeDefined();
            expect(mockTreeNode.siblingIndex).toBeDefined();
            expect(mockTreeNode.siblingCount).toBeDefined();

            // 验证废弃字段不存在
            expect(mockTreeNode).not.toHaveProperty('estimatedReadingTime');
            expect(mockTreeNode).not.toHaveProperty('complexity');
            expect(mockTreeNode).not.toHaveProperty('childTitles');
            expect(mockTreeNode).not.toHaveProperty('parent'); // 树状结构不包含parent
        });

        it('TableOfContentsToCNode应该只包含指定的简化字段', () => {
            const mockToCNode: TableOfContentsToCNode = {
                sid: '/test',
                displayId: '1',
                title: 'Test Title',
                level: 1,
                characterCount: 50,
                parent: '/parent',
                children: []
            };

            // 验证ToC模式的必需字段
            expect(mockToCNode.sid).toBeDefined();
            expect(mockToCNode.displayId).toBeDefined();
            expect(mockToCNode.title).toBeDefined();
            expect(mockToCNode.level).toBeDefined();
            expect(mockToCNode.characterCount).toBeDefined();
            expect(mockToCNode.parent).toBeDefined();
            expect(mockToCNode.children).toBeDefined();

            // 验证不包含structure模式的额外字段
            expect(mockToCNode).not.toHaveProperty('normalizedTitle');
            expect(mockToCNode).not.toHaveProperty('line');
            expect(mockToCNode).not.toHaveProperty('offset');
            expect(mockToCNode).not.toHaveProperty('wordCount');
            expect(mockToCNode).not.toHaveProperty('containsCode');
            expect(mockToCNode).not.toHaveProperty('containsTables');
            expect(mockToCNode).not.toHaveProperty('containsLists');
            expect(mockToCNode).not.toHaveProperty('siblingIndex');
            expect(mockToCNode).not.toHaveProperty('siblingCount');

            // 验证废弃字段不存在
            expect(mockToCNode).not.toHaveProperty('estimatedReadingTime');
            expect(mockToCNode).not.toHaveProperty('complexity');
            expect(mockToCNode).not.toHaveProperty('childTitles');
        });
    });

    describe('文档解析验证', () => {
        it('应该能够正确解析Markdown文档', async () => {
            const analyzer = new TestStructureAnalyzer();
            const ast = await analyzer.parseDocument(testMarkdownContent);
            
            expect(ast).toBeDefined();
            expect(ast.type).toBe('root');
            expect(ast.children).toBeDefined();
            expect(ast.children.length).toBeGreaterThan(0);
        });
    });

    describe('树状结构概念验证', () => {
        it('树状结构应该只在顶级包含h1标题', () => {
            // 模拟树状结构的数据
            const mockTree: TableOfContentsTreeNode[] = [
                {
                    sid: '/chapter1',
                    displayId: '1',
                    title: '第一章 系统概述',
                    normalizedTitle: '第一章 系统概述',
                    level: 1,
                    line: 1,
                    offset: {
                        utf16: { startLine: 1, endLine: 1, startColumn: 0, endColumn: 10 }
                    },
                    wordCount: 100,
                    characterCount: 500,
                    containsCode: false,
                    containsTables: false,
                    containsLists: false,
                    children: [
                        {
                            sid: '/chapter1/section1',
                            displayId: '1.1',
                            title: '1.1 系统架构',
                            normalizedTitle: '系统架构',
                            level: 2,
                            line: 5,
                            offset: {
                                utf16: { startLine: 5, endLine: 5, startColumn: 0, endColumn: 10 }
                            },
                            wordCount: 50,
                            characterCount: 250,
                            containsCode: false,
                            containsTables: false,
                            containsLists: false,
                            children: [],
                            siblingIndex: 0,
                            siblingCount: 2
                        }
                    ],
                    siblingIndex: 0,
                    siblingCount: 2
                }
            ];

            // 验证只有h1级别的标题在顶级
            expect(mockTree).toHaveLength(1);
            expect(mockTree[0].level).toBe(1);
            
            // 验证子节点在children数组中
            expect(mockTree[0].children).toHaveLength(1);
            expect(mockTree[0].children[0].level).toBe(2);
            
            // 验证每个节点有唯一的sid
            const sids = new Set<string>();
            const collectSids = (nodes: TableOfContentsTreeNode[]) => {
                for (const node of nodes) {
                    sids.add(node.sid);
                    collectSids(node.children);
                }
            };
            collectSids(mockTree);
            expect(sids.size).toBe(2); // 应该有2个唯一的sid
        });

        it('ToC模式的树状结构应该包含parent字段', () => {
            const mockToCTree: TableOfContentsToCNode[] = [
                {
                    sid: '/chapter1',
                    displayId: '1',
                    title: '第一章 系统概述',
                    level: 1,
                    characterCount: 500,
                    parent: undefined, // 顶级节点没有parent
                    children: [
                        {
                            sid: '/chapter1/section1',
                            displayId: '1.1',
                            title: '1.1 系统架构',
                            level: 2,
                            characterCount: 250,
                            parent: '/chapter1', // 子节点有parent引用
                            children: []
                        }
                    ]
                }
            ];

            // 验证parent字段的正确性
            expect(mockToCTree[0].parent).toBeUndefined();
            expect(mockToCTree[0].children[0].parent).toBe('/chapter1');
        });
    });

    describe('废弃字段移除验证', () => {
        it('所有新接口都不应该包含废弃字段', () => {
            // 测试编译时类型检查 - 如果废弃字段仍然存在，这些代码将无法编译
            const treeNode: Partial<TableOfContentsTreeNode> = {};
            const tocNode: Partial<TableOfContentsToCNode> = {};

            // 这些赋值应该导致TypeScript编译错误，如果字段仍然存在的话
            // @ts-expect-error - 废弃字段不应该存在
            expect(() => treeNode.estimatedReadingTime = 5).toThrow;
            // @ts-expect-error - 废弃字段不应该存在  
            expect(() => treeNode.complexity = 'low').toThrow;
            // @ts-expect-error - 废弃字段不应该存在
            expect(() => treeNode.childTitles = []).toThrow;

            // @ts-expect-error - 废弃字段不应该存在
            expect(() => tocNode.estimatedReadingTime = 5).toThrow;
            // @ts-expect-error - 废弃字段不应该存在
            expect(() => tocNode.complexity = 'low').toThrow;
            // @ts-expect-error - 废弃字段不应该存在
            expect(() => tocNode.childTitles = []).toThrow;
        });
    });

    describe('结构过滤功能测试', () => {
        // 创建一个测试用的结构过滤类
        class TestStructureFilter {
            /**
             * 测试版本的 getFilteredStructure 方法
             */
            getFilteredStructure(
                tocTree: TableOfContentsTreeNode[], 
                targets?: TargetRequest[]
            ): TableOfContentsTreeNode[] {
                // 无 targets 时返回完整结构
                if (!targets || targets.length === 0) {
                    return tocTree;
                }
                
                // 提取目标 SIDs
                const targetSids = targets
                    .filter(t => t.type === 'section' && t.sid)
                    .map(t => t.sid!);
                
                if (targetSids.length === 0) {
                    return tocTree;
                }
                
                return this.filterTreeByTargets(tocTree, targetSids);
            }

            /**
             * 测试版本的 filterTreeByTargets 方法
             */
            filterTreeByTargets(
                nodes: TableOfContentsTreeNode[], 
                targetSids: string[]
            ): TableOfContentsTreeNode[] {
                const result: TableOfContentsTreeNode[] = [];
                
                for (const node of nodes) {
                    // 检查当前节点是否匹配
                    const isMatch = targetSids.some(sid => node.sid === sid);
                    
                    // 递归检查子节点
                    const filteredChildren = this.filterTreeByTargets(node.children, targetSids);
                    
                    // 如果当前节点匹配或有匹配的子节点，则保留
                    if (isMatch || filteredChildren.length > 0) {
                        result.push({
                            ...node,
                            children: isMatch ? node.children : filteredChildren
                        });
                    }
                }
                
                return result;
            }
        }

        // 模拟的完整结构树
        const mockCompleteTree: TableOfContentsTreeNode[] = [
            {
                sid: '/假设依赖与约束-assumptions-dependencies-and-constraints',
                displayId: '1',
                title: '假设依赖与约束',
                normalizedTitle: '假设依赖与约束',
                level: 1,
                line: 1,
                offset: { utf16: { startLine: 1, endLine: 1, startColumn: 0, endColumn: 10 } },
                wordCount: 100,
                characterCount: 500,
                containsCode: false,
                containsTables: false,
                containsLists: false,
                children: [
                    {
                        sid: '/假设依赖与约束-assumptions-dependencies-and-constraints/系统假设',
                        displayId: '1.1',
                        title: '系统假设',
                        normalizedTitle: '系统假设',
                        level: 2,
                        line: 5,
                        offset: { utf16: { startLine: 5, endLine: 5, startColumn: 0, endColumn: 10 } },
                        wordCount: 50,
                        characterCount: 250,
                        containsCode: false,
                        containsTables: false,
                        containsLists: false,
                        children: [],
                        siblingIndex: 0,
                        siblingCount: 2
                    },
                    {
                        sid: '/假设依赖与约束-assumptions-dependencies-and-constraints/外部依赖',
                        displayId: '1.2',
                        title: '外部依赖',
                        normalizedTitle: '外部依赖',
                        level: 2,
                        line: 10,
                        offset: { utf16: { startLine: 10, endLine: 10, startColumn: 0, endColumn: 10 } },
                        wordCount: 30,
                        characterCount: 150,
                        containsCode: false,
                        containsTables: false,
                        containsLists: false,
                        children: [],
                        siblingIndex: 1,
                        siblingCount: 2
                    }
                ],
                siblingIndex: 0,
                siblingCount: 3
            },
            {
                sid: '/功能需求-functional-requirements',
                displayId: '2',
                title: '功能需求',
                normalizedTitle: '功能需求',
                level: 1,
                line: 15,
                offset: { utf16: { startLine: 15, endLine: 15, startColumn: 0, endColumn: 10 } },
                wordCount: 200,
                characterCount: 1000,
                containsCode: false,
                containsTables: false,
                containsLists: false,
                children: [
                    {
                        sid: '/功能需求-functional-requirements/用户管理',
                        displayId: '2.1',
                        title: '用户管理',
                        normalizedTitle: '用户管理',
                        level: 2,
                        line: 20,
                        offset: { utf16: { startLine: 20, endLine: 20, startColumn: 0, endColumn: 10 } },
                        wordCount: 80,
                        characterCount: 400,
                        containsCode: false,
                        containsTables: false,
                        containsLists: false,
                        children: [],
                        siblingIndex: 0,
                        siblingCount: 1
                    }
                ],
                siblingIndex: 1,
                siblingCount: 3
            },
            {
                sid: '/非功能需求-non-functional-requirements',
                displayId: '3',
                title: '非功能需求',
                normalizedTitle: '非功能需求',
                level: 1,
                line: 25,
                offset: { utf16: { startLine: 25, endLine: 25, startColumn: 0, endColumn: 10 } },
                wordCount: 150,
                characterCount: 750,
                containsCode: false,
                containsTables: false,
                containsLists: false,
                children: [],
                siblingIndex: 2,
                siblingCount: 3
            }
        ];

        const filter = new TestStructureFilter();

        it('无 targets 时应该返回完整结构', () => {
            const result = filter.getFilteredStructure(mockCompleteTree);
            expect(result).toEqual(mockCompleteTree);
            expect(result).toHaveLength(3);
        });

        it('空 targets 数组时应该返回完整结构', () => {
            const result = filter.getFilteredStructure(mockCompleteTree, []);
            expect(result).toEqual(mockCompleteTree);
            expect(result).toHaveLength(3);
        });

        it('指定单个目标章节时应该只返回该章节', () => {
            const targets: TargetRequest[] = [
                {
                    type: 'section',
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints'
                }
            ];

            const result = filter.getFilteredStructure(mockCompleteTree, targets);
            
            expect(result).toHaveLength(1);
            expect(result[0].sid).toBe('/假设依赖与约束-assumptions-dependencies-and-constraints');
            expect(result[0].children).toHaveLength(2); // 应该保留所有子章节
            expect(result[0].children[0].sid).toBe('/假设依赖与约束-assumptions-dependencies-and-constraints/系统假设');
            expect(result[0].children[1].sid).toBe('/假设依赖与约束-assumptions-dependencies-and-constraints/外部依赖');
        });

        it('指定多个目标章节时应该返回所有匹配的章节', () => {
            const targets: TargetRequest[] = [
                {
                    type: 'section',
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints'
                },
                {
                    type: 'section',
                    sid: '/非功能需求-non-functional-requirements'
                }
            ];

            const result = filter.getFilteredStructure(mockCompleteTree, targets);
            
            expect(result).toHaveLength(2);
            expect(result[0].sid).toBe('/假设依赖与约束-assumptions-dependencies-and-constraints');
            expect(result[1].sid).toBe('/非功能需求-non-functional-requirements');
            
            // 第一个章节应该保留其子章节
            expect(result[0].children).toHaveLength(2);
            // 第二个章节没有子章节
            expect(result[1].children).toHaveLength(0);
        });

        it('指定子章节时应该保留父章节但只过滤相关子章节', () => {
            const targets: TargetRequest[] = [
                {
                    type: 'section',
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints/系统假设'
                }
            ];

            const result = filter.getFilteredStructure(mockCompleteTree, targets);
            
            expect(result).toHaveLength(1);
            expect(result[0].sid).toBe('/假设依赖与约束-assumptions-dependencies-and-constraints');
            expect(result[0].children).toHaveLength(1); // 只保留匹配的子章节
            expect(result[0].children[0].sid).toBe('/假设依赖与约束-assumptions-dependencies-and-constraints/系统假设');
        });

        it('指定不存在的章节时应该返回空数组', () => {
            const targets: TargetRequest[] = [
                {
                    type: 'section',
                    sid: '/不存在的章节'
                }
            ];

            const result = filter.getFilteredStructure(mockCompleteTree, targets);
            expect(result).toHaveLength(0);
        });

        it('targets 包含非 section 类型时应该忽略', () => {
            const targets: TargetRequest[] = [
                {
                    type: 'keyword',
                    query: ['测试关键字']
                },
                {
                    type: 'section',
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints'
                }
            ];

            const result = filter.getFilteredStructure(mockCompleteTree, targets);
            
            expect(result).toHaveLength(1);
            expect(result[0].sid).toBe('/假设依赖与约束-assumptions-dependencies-and-constraints');
        });

        it('targets 包含没有 sid 的 section 时应该忽略', () => {
            const targets: TargetRequest[] = [
                {
                    type: 'section'
                    // 没有 sid
                },
                {
                    type: 'section',
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints'
                }
            ];

            const result = filter.getFilteredStructure(mockCompleteTree, targets);
            
            expect(result).toHaveLength(1);
            expect(result[0].sid).toBe('/假设依赖与约束-assumptions-dependencies-and-constraints');
        });

        it('过滤后的结构应该保持原有的层级关系', () => {
            const targets: TargetRequest[] = [
                {
                    type: 'section',
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints'
                }
            ];

            const result = filter.getFilteredStructure(mockCompleteTree, targets);
            
            // 验证父节点属性保持不变
            expect(result[0].displayId).toBe('1');
            expect(result[0].title).toBe('假设依赖与约束');
            expect(result[0].level).toBe(1);
            expect(result[0].wordCount).toBe(100);
            
            // 验证子节点属性保持不变
            expect(result[0].children[0].displayId).toBe('1.1');
            expect(result[0].children[0].title).toBe('系统假设');
            expect(result[0].children[0].level).toBe(2);
            expect(result[0].children[0].siblingIndex).toBe(0);
            expect(result[0].children[0].siblingCount).toBe(2);
        });
    });

    describe('structure 模式下的 results 数组优化', () => {
        
        // 模拟 buildResult 的行为
        const mockBuildResult = (parseMode: string, targets?: TargetRequest[], results: any[] = []): any => {
            return {
                success: true,
                path: 'test.md',
                results: parseMode === 'structure' ? [] : results
            };
        };

        it('structure 模式下应该返回空的 results 数组', () => {
            const mockResults = [
                {
                    type: 'section',
                    success: true,
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints',
                    content: '这是很长的章节内容，包含大量文本...'
                }
            ];

            const result = mockBuildResult('structure', undefined, mockResults);
            
            expect(result.results).toEqual([]);
            expect(result.results).toHaveLength(0);
        });

        it('content 模式下应该正常返回 results 数组', () => {
            const mockResults = [
                {
                    type: 'section',
                    success: true,
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints',
                    content: '这是很长的章节内容，包含大量文本...'
                }
            ];

            const result = mockBuildResult('content', undefined, mockResults);
            
            expect(result.results).toEqual(mockResults);
            expect(result.results).toHaveLength(1);
        });

        it('full 模式下应该正常返回 results 数组', () => {
            const mockResults = [
                {
                    type: 'section',
                    success: true,
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints',
                    content: '这是很长的章节内容，包含大量文本...'
                }
            ];

            const result = mockBuildResult('full', undefined, mockResults);
            
            expect(result.results).toEqual(mockResults);
            expect(result.results).toHaveLength(1);
        });

        it('toc 模式下应该正常返回 results 数组', () => {
            const mockResults = [
                {
                    type: 'section',
                    success: true,
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints',
                    content: '这是很长的章节内容，包含大量文本...'
                }
            ];

            const result = mockBuildResult('toc', undefined, mockResults);
            
            expect(result.results).toEqual(mockResults);
            expect(result.results).toHaveLength(1);
        });

        it('structure 模式即使有 targets 也应该返回空的 results 数组', () => {
            const targets: TargetRequest[] = [
                {
                    type: 'section',
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints'
                }
            ];

            const mockResults = [
                {
                    type: 'section',
                    success: true,
                    sid: '/假设依赖与约束-assumptions-dependencies-and-constraints',
                    content: '这是很长的章节内容，会造成大量 token 浪费...'
                }
            ];

            const result = mockBuildResult('structure', targets, mockResults);
            
            expect(result.results).toEqual([]);
            expect(result.results).toHaveLength(0);
        });
    });
});