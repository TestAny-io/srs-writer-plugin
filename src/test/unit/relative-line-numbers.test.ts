/**
 * 相对行号功能验证测试
 * 
 * 测试 executeMarkdownEdits 工具使用章节内相对行号的功能
 */

import { SidBasedSemanticLocator, TableOfContents } from '../../tools/atomic/sid-based-semantic-locator';

describe('相对行号功能验证', () => {
    const testMarkdownContent = `# 测试文档

## 功能需求

### 用户管理
用户管理功能包括：
- 用户注册
- 用户登录  
- 用户信息修改
- 密码重置

这是用户管理的详细说明。

### 数据管理
数据管理功能说明。
这是第二行内容。
包含数据备份和恢复。

## 非功能需求

系统性能要求。
`;

    const testTocData: TableOfContents[] = [
        {
            sid: '/functional-requirements',
            displayId: '2',
            title: '功能需求',
            normalizedTitle: '功能需求',
            level: 2,
            line: 3,
            endLine: 16,
            offset: { utf16: { startLine: 3, startColumn: 0, endLine: 3, endColumn: 4 } },
            wordCount: 50,
            characterCount: 200,
            containsCode: false,
            containsTables: false,
            containsLists: true,
            parent: undefined,
            children: [
                {
                    sid: '/functional-requirements/user-management',
                    displayId: '2.1',
                    title: '用户管理',
                    normalizedTitle: '用户管理',
                    level: 3,
                    line: 5,
                    endLine: 11,
                    offset: { utf16: { startLine: 5, startColumn: 0, endLine: 5, endColumn: 4 } },
                    wordCount: 30,
                    characterCount: 120,
                    containsCode: false,
                    containsTables: false,
                    containsLists: true,
                    parent: '/functional-requirements',
                    children: [],
                    siblingIndex: 0,
                    siblingCount: 2
                },
                {
                    sid: '/functional-requirements/data-management',
                    displayId: '2.2',
                    title: '数据管理',
                    normalizedTitle: '数据管理',
                    level: 3,
                    line: 13,
                    endLine: 16,
                    offset: { utf16: { startLine: 13, startColumn: 0, endLine: 13, endColumn: 4 } },
                    wordCount: 20,
                    characterCount: 80,
                    containsCode: false,
                    containsTables: false,
                    containsLists: false,
                    parent: '/functional-requirements',
                    children: [],
                    siblingIndex: 1,
                    siblingCount: 2
                }
            ],
            siblingIndex: 0,
            siblingCount: 2
        },
        {
            sid: '/non-functional-requirements',
            displayId: '3',
            title: '非功能需求',
            normalizedTitle: '非功能需求',
            level: 2,
            line: 18,
            endLine: 20,
            offset: { utf16: { startLine: 18, startColumn: 0, endLine: 18, endColumn: 6 } },
            wordCount: 10,
            characterCount: 40,
            containsCode: false,
            containsTables: false,
            containsLists: false,
            parent: undefined,
            children: [],
            siblingIndex: 1,
            siblingCount: 2
        }
    ];

    let locator: SidBasedSemanticLocator;

    beforeEach(() => {
        locator = new SidBasedSemanticLocator(testMarkdownContent, testTocData);
    });

    describe('章节内容映射验证', () => {
        it('应该正确提取章节内容行（不包括标题）', () => {
            const availableSids = locator.getAvailableSids();
            expect(availableSids).toContain('/functional-requirements/user-management');
            
            // 验证章节内容正确提取
            const section = (locator as any).sidToNodeMap.get('/functional-requirements/user-management');
            expect(section).toBeDefined();
            expect(section.content).toEqual([
                '用户管理功能包括：',
                '- 用户注册',
                '- 用户登录  ',
                '- 用户信息修改',
                '- 密码重置',
                ''
            ]);
        });
    });

    describe('replace_lines_in_section 相对行号测试', () => {
        it('应该支持相对行号替换单行', () => {
            const target = {
                sid: '/functional-requirements/user-management',
                lineRange: {
                    startLine: 1,  // 章节内第1行："用户管理功能包括："
                    endLine: 1
                }
            };
            
            const result = locator.findTarget(target, 'replace_section_content_only');
            
            expect(result.found).toBe(true);
            expect(result.operationType).toBe('replace');
            expect(result.context?.relativeToAbsolute?.sectionRelativeStart).toBe(1);
            expect(result.context?.relativeToAbsolute?.sectionRelativeEnd).toBe(1);
            // 绝对行号应该是 6（标题在第5行，内容从第6行开始）
            expect(result.context?.relativeToAbsolute?.documentAbsoluteStart).toBe(6);
            expect(result.context?.relativeToAbsolute?.documentAbsoluteEnd).toBe(6);
        });

        it('应该支持相对行号替换多行', () => {
            const target = {
                sid: '/functional-requirements/user-management',
                lineRange: {
                    startLine: 2,  // 章节内第2-4行：列表项
                    endLine: 4
                }
            };
            
            const result = locator.findTarget(target, 'replace_section_content_only');
            
            expect(result.found).toBe(true);
            expect(result.context?.relativeToAbsolute?.sectionRelativeStart).toBe(2);
            expect(result.context?.relativeToAbsolute?.sectionRelativeEnd).toBe(4);
            // 绝对行号应该是 7-9
            expect(result.context?.relativeToAbsolute?.documentAbsoluteStart).toBe(7);
            expect(result.context?.relativeToAbsolute?.documentAbsoluteEnd).toBe(9);
        });

        it('应该拒绝超出章节范围的相对行号', () => {
            const target = {
                sid: '/functional-requirements/user-management',
                lineRange: {
                    startLine: 10,  // 超出章节内容范围
                    endLine: 10
                }
            };
            
            const result = locator.findTarget(target, 'replace_section_content_only');
            
            expect(result.found).toBe(false);
            expect(result.error).toContain('Section-relative line 10 out of range');
            expect(result.suggestions?.validRange).toBe('1-6'); // 用户管理章节有6行内容
            expect(result.suggestions?.sectionPreview).toContain('1: 用户管理功能包括：');
        });

        it('应该拒绝无效的行号范围', () => {
            const target = {
                sid: '/functional-requirements/user-management',
                lineRange: {
                    startLine: 5,
                    endLine: 3  // endLine < startLine
                }
            };
            
            const result = locator.findTarget(target, 'replace_section_content_only');
            
            expect(result.found).toBe(false);
            expect(result.error).toContain('Invalid section-relative line range: 5-3');
        });
    });

    describe('insert_lines_in_section 相对行号测试', () => {
        it('应该支持在章节开头插入', () => {
            const target = {
                sid: '/functional-requirements/data-management',
                lineRange: {
                    startLine: 1,  // 在第1行前插入
                    endLine: 1
                }
            };
            
            const result = locator.findTarget(target, 'insert_section_content_only');
            
            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
            expect(result.context?.sectionRelativeInsertLine).toBe(1);
            // 数据管理章节标题在第13行，内容从第14行开始
            expect(result.context?.documentAbsoluteInsertLine).toBe(14);
        });

        it('应该支持在章节末尾插入', () => {
            const target = {
                sid: '/functional-requirements/data-management',
                lineRange: {
                    startLine: 4,  // 数据管理章节有3行内容，在第4行插入（末尾）
                    endLine: 4
                }
            };
            
            const result = locator.findTarget(target, 'insert_section_content_only');
            
            expect(result.found).toBe(true);
            expect(result.context?.sectionRelativeInsertLine).toBe(4);
            // 应该插入到绝对行号17（14+3）
            expect(result.context?.documentAbsoluteInsertLine).toBe(17);
        });

        it('应该拒绝超出插入范围的行号', () => {
            const target = {
                sid: '/functional-requirements/data-management',
                lineRange: {
                    startLine: 6,  // 数据管理章节只有3行内容，最大插入位置是4
                    endLine: 6
                }
            };
            
            const result = locator.findTarget(target, 'insert_section_content_only');
            
            expect(result.found).toBe(false);
            expect(result.error).toContain('Section-relative insert line 6 out of range');
            expect(result.suggestions?.validRange).toBe('1-4'); // 可插入位置1-4
        });
    });

    describe('章节预览功能测试', () => {
        it('应该生成有用的章节预览', () => {
            const target = {
                sid: '/functional-requirements/user-management',
                lineRange: {
                    startLine: 10,  // 故意使用无效行号触发预览
                    endLine: 10
                }
            };
            
            const result = locator.findTarget(target, 'replace_section_content_only');
            
            expect(result.found).toBe(false);
            expect(result.suggestions?.sectionPreview).toContain('1: 用户管理功能包括：');
            expect(result.suggestions?.sectionPreview).toContain('2: - 用户注册');
            expect(result.suggestions?.sectionPreview).toContain('6: ');
        });
    });

    describe('错误处理和建议', () => {
        it('应该为无效SID提供有用建议', () => {
            const target = {
                sid: '/non-existent-section',
                lineRange: {
                    startLine: 1,
                    endLine: 1
                }
            };
            
            const result = locator.findTarget(target, 'replace_section_content_only');
            
            expect(result.found).toBe(false);
            expect(result.error).toContain('Section with sid \'/non-existent-section\' not found');
            expect(result.suggestions?.availableSids).toBeDefined();
        });

        it('应该要求提供endLine避免歧义', () => {
            const target = {
                sid: '/functional-requirements/user-management',
                lineRange: {
                    startLine: 1
                    // 故意不提供endLine - 需要类型断言绕过TypeScript检查
                }
            } as any;
            
            const result = locator.findTarget(target, 'replace_section_content_only');
            
            expect(result.found).toBe(false);
            expect(result.error).toContain('endLine is required');
            expect(result.suggestions?.correctedLineRange).toEqual({ startLine: 1, endLine: 1 });
        });
    });
});
