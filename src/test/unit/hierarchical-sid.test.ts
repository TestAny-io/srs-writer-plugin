/**
 * 层级SID功能验证测试
 * 
 * 测试新的层级SID生成算法是否正确工作
 */

import { SidBasedSemanticLocator, TableOfContents } from '../../tools/atomic/sid-based-semantic-locator';

describe('层级SID功能验证', () => {
    const testMarkdownContent = `# 系统需求规格说明书

## 功能需求

### 用户管理
用户管理功能包括：
- 用户注册
- 用户登录
- 用户信息修改

#### 用户认证
认证机制说明：
- 密码验证
- 双因子认证

#### 权限管理
权限分配规则：
- 角色权限
- 资源权限

### 数据管理
数据管理功能说明：
- 数据备份
- 数据恢复

## 非功能需求

### 性能需求
系统性能要求：
- 响应时间 < 2秒
- 并发用户 > 1000

#### 响应时间要求
详细的响应时间规格。

#### 吞吐量要求
详细的吞吐量规格。
`;

    const testTocData: TableOfContents[] = [
        {
            sid: '/functional-requirements',
            displayId: '2',
            title: '功能需求',
            normalizedTitle: '功能需求',
            level: 2,
            line: 3,
            endLine: 22,
            offset: { utf16: { startLine: 3, startColumn: 0, endLine: 3, endColumn: 4 } },
            wordCount: 100,
            characterCount: 500,
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
                    endLine: 19,
                    offset: { utf16: { startLine: 5, startColumn: 0, endLine: 5, endColumn: 4 } },
                    wordCount: 50,
                    characterCount: 250,
                    containsCode: false,
                    containsTables: false,
                    containsLists: true,
                    parent: '/functional-requirements',
                    children: [
                        {
                            sid: '/functional-requirements/user-management/user-authentication',
                            displayId: '2.1.1',
                            title: '用户认证',
                            normalizedTitle: '用户认证',
                            level: 4,
                            line: 11,
                            endLine: 15,
                            offset: { utf16: { startLine: 11, startColumn: 0, endLine: 11, endColumn: 4 } },
                            wordCount: 20,
                            characterCount: 100,
                            containsCode: false,
                            containsTables: false,
                            containsLists: true,
                            parent: '/functional-requirements/user-management',
                            children: [],
                            siblingIndex: 0,
                            siblingCount: 2
                        },
                        {
                            sid: '/functional-requirements/user-management/permission-management',
                            displayId: '2.1.2',
                            title: '权限管理',
                            normalizedTitle: '权限管理',
                            level: 4,
                            line: 17,
                            endLine: 21,
                            offset: { utf16: { startLine: 17, startColumn: 0, endLine: 17, endColumn: 4 } },
                            wordCount: 20,
                            characterCount: 100,
                            containsCode: false,
                            containsTables: false,
                            containsLists: true,
                            parent: '/functional-requirements/user-management',
                            children: [],
                            siblingIndex: 1,
                            siblingCount: 2
                        }
                    ],
                    siblingIndex: 0,
                    siblingCount: 2
                },
                {
                    sid: '/functional-requirements/data-management',
                    displayId: '2.2',
                    title: '数据管理',
                    normalizedTitle: '数据管理',
                    level: 3,
                    line: 23,
                    endLine: 26,
                    offset: { utf16: { startLine: 23, startColumn: 0, endLine: 23, endColumn: 4 } },
                    wordCount: 20,
                    characterCount: 100,
                    containsCode: false,
                    containsTables: false,
                    containsLists: true,
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
            line: 28,
            endLine: 40,
            offset: { utf16: { startLine: 28, startColumn: 0, endLine: 28, endColumn: 6 } },
            wordCount: 50,
            characterCount: 200,
            containsCode: false,
            containsTables: false,
            containsLists: true,
            parent: undefined,
            children: [
                {
                    sid: '/non-functional-requirements/performance-requirements',
                    displayId: '3.1',
                    title: '性能需求',
                    normalizedTitle: '性能需求',
                    level: 3,
                    line: 30,
                    endLine: 38,
                    offset: { utf16: { startLine: 30, startColumn: 0, endLine: 30, endColumn: 4 } },
                    wordCount: 30,
                    characterCount: 150,
                    containsCode: false,
                    containsTables: false,
                    containsLists: true,
                    parent: '/non-functional-requirements',
                    children: [
                        {
                            sid: '/non-functional-requirements/performance-requirements/response-time',
                            displayId: '3.1.1',
                            title: '响应时间要求',
                            normalizedTitle: '响应时间要求',
                            level: 4,
                            line: 35,
                            endLine: 36,
                            offset: { utf16: { startLine: 35, startColumn: 0, endLine: 35, endColumn: 4 } },
                            wordCount: 10,
                            characterCount: 50,
                            containsCode: false,
                            containsTables: false,
                            containsLists: false,
                            parent: '/non-functional-requirements/performance-requirements',
                            children: [],
                            siblingIndex: 0,
                            siblingCount: 2
                        },
                        {
                            sid: '/non-functional-requirements/performance-requirements/throughput',
                            displayId: '3.1.2',
                            title: '吞吐量要求',
                            normalizedTitle: '吞吐量要求',
                            level: 4,
                            line: 38,
                            endLine: 39,
                            offset: { utf16: { startLine: 38, startColumn: 0, endLine: 38, endColumn: 4 } },
                            wordCount: 10,
                            characterCount: 50,
                            containsCode: false,
                            containsTables: false,
                            containsLists: false,
                            parent: '/non-functional-requirements/performance-requirements',
                            children: [],
                            siblingIndex: 1,
                            siblingCount: 2
                        }
                    ],
                    siblingIndex: 0,
                    siblingCount: 1
                }
            ],
            siblingIndex: 1,
            siblingCount: 2
        }
    ];

    let locator: SidBasedSemanticLocator;

    beforeEach(() => {
        locator = new SidBasedSemanticLocator(testMarkdownContent, testTocData);
    });

    describe('层级SID结构验证', () => {
        it('应该正确识别所有层级的SID', () => {
            const availableSids = locator.getAvailableSids();
            
            // 验证根级SID
            expect(availableSids).toContain('/functional-requirements');
            expect(availableSids).toContain('/non-functional-requirements');
            
            // 验证二级SID
            expect(availableSids).toContain('/functional-requirements/user-management');
            expect(availableSids).toContain('/functional-requirements/data-management');
            expect(availableSids).toContain('/non-functional-requirements/performance-requirements');
            
            // 验证三级SID（最深层）
            expect(availableSids).toContain('/functional-requirements/user-management/user-authentication');
            expect(availableSids).toContain('/functional-requirements/user-management/permission-management');
            expect(availableSids).toContain('/non-functional-requirements/performance-requirements/response-time');
            expect(availableSids).toContain('/non-functional-requirements/performance-requirements/throughput');
        });
        
        it('应该正确映射层级SID到章节内容', () => {
            // 测试最深层SID的内容映射
            const deepSection = (locator as any).sidToNodeMap.get('/functional-requirements/user-management/user-authentication');
            expect(deepSection).toBeDefined();
            expect(deepSection.title).toBe('用户认证');
            expect(deepSection.content).toEqual([
                '认证机制说明：',
                '- 密码验证',
                '- 双因子认证',
                ''
            ]);
        });
    });

    describe('层级SID的相对行号操作', () => {
        it('应该支持最深层SID的行级操作', () => {
            // 测试在最深层SID中使用相对行号
            const target = {
                sid: '/functional-requirements/user-management/user-authentication',
                lineRange: {
                    startLine: 2,  // 认证机制说明后的第2行："- 密码验证"
                    endLine: 3     // 到第3行："- 双因子认证"
                }
            };
            
            const result = locator.findTarget(target, 'replace_lines_in_section');
            
            expect(result.found).toBe(true);
            expect(result.operationType).toBe('replace');
            expect(result.context?.relativeToAbsolute?.sectionRelativeStart).toBe(2);
            expect(result.context?.relativeToAbsolute?.sectionRelativeEnd).toBe(3);
        });

        it('应该支持中间层SID的行级操作', () => {
            // 测试在中间层SID中使用相对行号
            const target = {
                sid: '/functional-requirements/user-management',
                lineRange: {
                    startLine: 1,  // 用户管理章节的第1行："用户管理功能包括："
                    endLine: 1
                }
            };
            
            const result = locator.findTarget(target, 'replace_lines_in_section');
            
            expect(result.found).toBe(true);
            expect(result.operationType).toBe('replace');
            expect(result.context?.relativeToAbsolute?.sectionRelativeStart).toBe(1);
            expect(result.context?.relativeToAbsolute?.sectionRelativeEnd).toBe(1);
        });

        it('应该正确处理层级SID的插入操作', () => {
            // 测试在最深层SID中插入内容
            const target = {
                sid: '/non-functional-requirements/performance-requirements/response-time',
                lineRange: {
                    startLine: 2,  // 在响应时间要求章节第2行插入
                    endLine: 2
                }
            };
            
            const result = locator.findTarget(target, 'insert_lines_in_section');
            
            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
            expect(result.context?.sectionRelativeInsertLine).toBe(2);
        });
    });

    describe('层级SID的错误处理', () => {
        it('应该为层级SID提供有用的错误信息', () => {
            const target = {
                sid: '/functional-requirements/user-management/non-existent',
                lineRange: {
                    startLine: 1,
                    endLine: 1
                }
            };
            
            const result = locator.findTarget(target, 'replace_lines_in_section');
            
            expect(result.found).toBe(false);
            expect(result.error).toContain('not found');
            expect(result.suggestions?.availableSids).toBeDefined();
            
            // 验证建议的SID包含层级结构
            const suggestedSids = result.suggestions?.availableSids || [];
            const hierarchicalSids = suggestedSids.filter(sid => sid.includes('/'));
            expect(hierarchicalSids.length).toBeGreaterThan(0);
        });

        it('应该正确验证层级SID格式', () => {
            const target = {
                sid: 'functional-requirements/user-management', // 缺少前导斜杠
                lineRange: {
                    startLine: 1,
                    endLine: 1
                }
            };
            
            const result = locator.findTarget(target, 'replace_lines_in_section');
            
            expect(result.found).toBe(false);
            expect(result.error).toContain('must start with');
            expect(result.suggestions?.correctedSid).toBe('/functional-requirements/user-management');
        });
    });

    describe('层级SID的AI友好性验证', () => {
        it('层级SID应该让AI更容易选择最具体的目标', () => {
            const availableSids = locator.getAvailableSids();
            
            // 模拟AI的选择逻辑：选择最长的匹配SID
            const userManagementSids = availableSids.filter(sid => sid.includes('user-management'));
            
            // 验证有多个层级的选项
            expect(userManagementSids).toContain('/functional-requirements/user-management');
            expect(userManagementSids).toContain('/functional-requirements/user-management/user-authentication');
            expect(userManagementSids).toContain('/functional-requirements/user-management/permission-management');
            
            // AI应该自然选择最长（最具体）的SID
            const mostSpecific = userManagementSids.reduce((longest, current) => 
                current.length > longest.length ? current : longest
            );
            
            expect(mostSpecific).toMatch(/\/functional-requirements\/user-management\/.+/);
        });

        it('层级SID应该提供清晰的包含关系', () => {
            const availableSids = locator.getAvailableSids();
            
            // 验证层级包含关系
            const performanceSids = availableSids.filter(sid => sid.includes('performance'));
            
            // 应该有父级和子级SID
            const parentSid = performanceSids.find(sid => !sid.includes('response-time') && !sid.includes('throughput'));
            const childSids = performanceSids.filter(sid => sid.includes('response-time') || sid.includes('throughput'));
            
            expect(parentSid).toBe('/non-functional-requirements/performance-requirements');
            expect(childSids).toContain('/non-functional-requirements/performance-requirements/response-time');
            expect(childSids).toContain('/non-functional-requirements/performance-requirements/throughput');
            
            // 验证子SID都以父SID开头
            childSids.forEach(childSid => {
                expect(childSid.startsWith(parentSid!)).toBe(true);
            });
        });
    });

    describe('向后兼容性验证', () => {
        it('应该保持现有的语义编辑功能正常', () => {
            // 测试replace_entire_section_with_title（不涉及行号）
            const target = {
                sid: '/functional-requirements/data-management'
            };
            
            const result = locator.findTarget(target, 'replace_entire_section_with_title');
            
            expect(result.found).toBe(true);
            expect(result.operationType).toBe('replace');
            expect(result.context?.includesTitle).toBe(true);
        });

        it('应该保持insert_entire_section功能正常', () => {
            // 测试insert_entire_section（使用insertionPosition）
            const target = {
                sid: '/functional-requirements',
                insertionPosition: 'after' as const
            };
            
            const result = locator.findTarget(target, 'insert_entire_section');
            
            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
        });
    });
});
