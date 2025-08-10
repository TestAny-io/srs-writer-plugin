/**
 * 手动测试 SID + lineRange 精确定位功能
 */

// Mock vscode for testing
const vscode = {
    Position: class Position {
        constructor(public line: number, public character: number) {}
    },
    Range: class Range {
        constructor(public start: any, public end: any) {}
    }
};

import { SidBasedSemanticLocator, TableOfContents } from '../../tools/atomic/sid-based-semantic-locator';

// 模拟测试数据
const testMarkdownContent = `# 系统需求规格说明书

## 1. 引言

这是引言章节的内容。
包含了系统的基本介绍。
这是第三行内容。

## 2. 功能需求

### 2.1 用户管理

用户管理功能包括：
- 用户注册
- 用户登录
- 用户信息修改

这是用户管理的详细说明。

### 2.2 数据管理

数据管理功能说明。
`;

const testTocData: TableOfContents[] = [
    {
        sid: '/introduction',
        title: '引言',
        normalizedTitle: '引言',
        level: 2,
        line: 3,
        endLine: 7,
        wordCount: 10,
        characterCount: 50
    },
    {
        sid: '/functional-requirements',
        title: '功能需求',
        normalizedTitle: '功能需求',
        level: 2,
        line: 9,
        endLine: 22,
        wordCount: 30,
        characterCount: 150
    },
    {
        sid: '/functional-requirements/user-management',
        title: '用户管理',
        normalizedTitle: '用户管理',
        level: 3,
        line: 11,
        endLine: 18,
        wordCount: 20,
        characterCount: 100
    },
    {
        sid: '/functional-requirements/data-management',
        title: '数据管理',
        normalizedTitle: '数据管理',
        level: 3,
        line: 20,
        endLine: 22,
        wordCount: 5,
        characterCount: 25
    }
];

/**
 * 测试 lineRange 精确定位
 */
function testLineRangeLocator() {
    console.log('🧪 Testing SID + lineRange precision...\n');

    const locator = new SidBasedSemanticLocator(testMarkdownContent, testTocData);

    // 测试1: 基本的行号定位
    console.log('Test 1: Basic line range targeting');
    const result1 = locator.findTarget({
        sid: '/functional-requirements/user-management',
        lineRange: { startLine: 2, endLine: 4 }
    }, 'replace_lines_in_section');

    console.log('Result1:', {
        found: result1.found,
        range: result1.range ? `${result1.range.start.line}:${result1.range.start.character}-${result1.range.end.line}:${result1.range.end.character}` : 'none',
        context: result1.context
    });

    // 测试2: 单行定位
    console.log('\nTest 2: Single line targeting');
    const result2 = locator.findTarget({
        sid: '/introduction',
        lineRange: { startLine: 2, endLine: 2 }
    }, 'replace_lines_in_section');

    console.log('Result2:', {
        found: result2.found,
        range: result2.range ? `${result2.range.start.line}:${result2.range.start.character}-${result2.range.end.line}:${result2.range.end.character}` : 'none',
        context: result2.context
    });

    // 测试3: 错误的行号范围
    console.log('\nTest 3: Invalid line range');
    const result3 = locator.findTarget({
        sid: '/introduction',
        lineRange: { startLine: 10, endLine: 10 }  // 超出范围
    }, 'replace_lines_in_section');

    console.log('Result3:', {
        found: result3.found,
        error: result3.error,
        suggestions: result3.suggestions
    });

    // 测试4: 整个章节替换
    console.log('\nTest 4: Entire section replacement');
    const result4 = locator.findTarget({
        sid: '/functional-requirements/data-management'
    }, 'replace_entire_section');

    console.log('Result4:', {
        found: result4.found,
        range: result4.range ? `${result4.range.start.line}:${result4.range.start.character}-${result4.range.end.line}:${result4.range.end.character}` : 'none'
    });

    // 测试5: 插入操作
    console.log('\nTest 5: Insertion operation');
    const result5 = locator.findTarget({
        sid: '/functional-requirements',
        insertionPosition: 'inside',
        lineRange: { startLine: 5, endLine: 5 }
    }, 'insert_lines_in_section');

    console.log('Result5:', {
        found: result5.found,
        insertionPoint: result5.insertionPoint ? `${result5.insertionPoint.line}:${result5.insertionPoint.character}` : 'none'
    });

    console.log('\n✅ lineRange precision tests completed!');
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    testLineRangeLocator();
}

export { testLineRangeLocator };
