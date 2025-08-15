/**
 * SID + lineRange 精确定位验证测试
 */

import * as vscode from 'vscode';
import { SidBasedSemanticLocator, TableOfContents } from '../../tools/atomic/sid-based-semantic-locator';

describe('SID + lineRange 精确定位验证', () => {
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

    let locator: SidBasedSemanticLocator;

    beforeEach(() => {
        locator = new SidBasedSemanticLocator(testMarkdownContent, testTocData);
    });

    test('应该正确定位到指定行号范围', () => {
        const result = locator.findTarget({
            sid: '/functional-requirements/user-management',
            lineRange: { startLine: 2, endLine: 4 }
        }, 'replace_lines_in_section');

        expect(result.found).toBe(true);
        expect(result.operationType).toBe('replace');
        expect(result.range).toBeDefined();
        
        if (result.range) {
            // 用户管理从第11行开始（0-based: 10），第2-4行对应全局的第11-13行
            expect(result.range.start.line).toBe(11); // 第2行在section内 = 全局第11行
            expect(result.range.end.line).toBe(13);   // 第4行在section内 = 全局第13行
        }
        
        expect(result.context?.sectionTitle).toBe('用户管理');
        expect(result.context?.lineRange).toEqual({ startLine: 2, endLine: 4 });
    });

    test('应该正确处理单行定位', () => {
        const result = locator.findTarget({
            sid: '/introduction',
            lineRange: { startLine: 2, endLine: 2 }
        }, 'replace_lines_in_section');

        expect(result.found).toBe(true);
        expect(result.range).toBeDefined();
        
        if (result.range) {
            // 引言从第3行开始（0-based: 2），第2行对应全局第3行
            expect(result.range.start.line).toBe(3);
            expect(result.range.end.line).toBe(3);  // 单行，start = end
        }
    });

    test('应该检测超出范围的行号', () => {
        const result = locator.findTarget({
            sid: '/introduction',
            lineRange: { startLine: 10, endLine: 10 }  // 超出章节范围
        }, 'replace_lines_in_section');

        expect(result.found).toBe(false);
        expect(result.error).toContain('out of range');
        expect(result.suggestions?.validRange).toBeDefined();
        expect(result.suggestions?.nearbyLines).toBeDefined();
    });

    test('应该正确处理整个章节替换', () => {
        const result = locator.findTarget({
            sid: '/functional-requirements/data-management'
        }, 'replace_entire_section');

        expect(result.found).toBe(true);
        expect(result.operationType).toBe('replace');
        expect(result.range).toBeDefined();
        
        if (result.range) {
            // 数据管理从第20行开始，到第22行结束（0-based: 19-21）
            expect(result.range.start.line).toBe(19);
            expect(result.range.end.line).toBe(21);
        }
    });

    test('应该正确处理插入操作', () => {
        const result = locator.findTarget({
            sid: '/functional-requirements',
            lineRange: { startLine: 5, endLine: 5 } // insert_lines_in_section 只需要 lineRange
        }, 'insert_lines_in_section');

        expect(result.found).toBe(true);
        expect(result.operationType).toBe('insert');
        expect(result.insertionPoint).toBeDefined();
        
        if (result.insertionPoint) {
            // 功能需求从第9行开始（0-based: 8），第5行对应全局第12行
            expect(result.insertionPoint.line).toBe(12);
        }
    });

    test('应该提供智能的SID建议', () => {
        const result = locator.findTarget({
            sid: '/non-existent-section'
        }, 'replace_entire_section');

        expect(result.found).toBe(false);
        expect(result.error).toContain('not found');
        expect(result.suggestions?.availableSids).toBeDefined();
        expect(result.suggestions?.similarSids).toBeDefined();
    });

    test('应该验证SID格式', () => {
        const result = locator.findTarget({
            sid: 'invalid-sid-without-slash'
        }, 'replace_entire_section');

        expect(result.found).toBe(false);
        expect(result.error).toContain('must start with');
        expect(result.suggestions?.correctedSid).toBe('/invalid-sid-without-slash');
    });

    test('应该处理无效的行号范围', () => {
        const result = locator.findTarget({
            sid: '/introduction',
            lineRange: { startLine: 5, endLine: 3 }  // endLine < startLine
        }, 'replace_lines_in_section');

        expect(result.found).toBe(false);
        expect(result.error).toContain('Invalid line range');
    });
});
