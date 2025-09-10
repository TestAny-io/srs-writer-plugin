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
            // 🚀 更新：现在使用相对行号系统
            // 用户管理标题在第11行，内容从第12行开始（0-based: 11）
            // 相对行号第2-4行对应绝对行号第13-15行（0-based: 12-14）
            expect(result.range.start.line).toBe(12); // 相对第2行 = 绝对第13行（0-based: 12）
            expect(result.range.end.line).toBe(14);   // 相对第4行 = 绝对第15行（0-based: 14）
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
            // 🚀 更新：现在使用相对行号系统  
            // 引言标题在第3行，内容从第4行开始（0-based: 3）
            // 相对行号第2行对应绝对行号第5行（0-based: 4）
            expect(result.range.start.line).toBe(4); // 相对第2行 = 绝对第5行（0-based: 4）
            expect(result.range.end.line).toBe(4);   // 单行，start = end
        }
    });

    test('应该检测超出范围的行号', () => {
        const result = locator.findTarget({
            sid: '/introduction',
            lineRange: { startLine: 5, endLine: 5 }  // 超出章节范围（引言只有4行内容）
        }, 'replace_lines_in_section');

        expect(result.found).toBe(false);
        expect(result.error).toContain('Section-relative line 5 out of range');
        expect(result.suggestions?.validRange).toBeDefined();
        expect(result.suggestions?.sectionPreview).toBeDefined(); // 更新：现在使用sectionPreview而不是nearbyLines
    });

    test('应该正确处理整个章节替换', () => {
        const result = locator.findTarget({
            sid: '/functional-requirements/data-management'
        }, 'replace_entire_section');

        expect(result.found).toBe(true);
        expect(result.operationType).toBe('replace');
        expect(result.range).toBeDefined();
        
        if (result.range) {
            // 🚀 更新：现在替换整个章节（包括标题）
            // 从日志看：数据管理内容在第21-22行，标题在第20行
            // replaceEntireSection 应该从标题行开始（0-based: 19）到内容结束（0-based: 21）
            expect(result.range.start.line).toBe(19); // 标题行（第20行，0-based: 19）
            expect(result.range.end.line).toBe(21);   // 内容结束（第22行，0-based: 21）
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
            // 🚀 更新：功能需求章节内容从第10行开始（0-based: 9），相对第5行对应绝对第14行（0-based: 13）
            expect(result.insertionPoint.line).toBe(13); // 从日志看：相对第5行转换为绝对第14行（0-based: 13）
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
            lineRange: { startLine: 2, endLine: 1 }  // endLine < startLine（都在有效范围内）
        }, 'replace_lines_in_section');

        expect(result.found).toBe(false);
        expect(result.error).toContain('Invalid section-relative line range'); // 检查 endLine < startLine 的错误
    });
});
