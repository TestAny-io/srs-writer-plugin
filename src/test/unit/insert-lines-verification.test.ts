/**
 * 验证 insert_lines_in_section 修复的单元测试
 */

import { SidBasedSemanticLocator, TableOfContents } from '../../tools/atomic/sid-based-semantic-locator';

describe('insert_lines_in_section 字段依赖修复验证', () => {
    const mockMarkdownContent = `# 测试文档

## 用户旅程 (User Journeys)

### 3.1 第一个旅程
第一个旅程内容

### 3.2 第二个旅程
第二个旅程内容

### 3.3 第三个旅程
第三个旅程内容
`;

    const mockTocData: TableOfContents[] = [
        {
            sid: '/用户旅程-user-journeys',
            title: '用户旅程 (User Journeys)',
            normalizedTitle: '用户旅程',
            level: 2,
            line: 3,
            children: []
        }
    ];

    let locator: SidBasedSemanticLocator;

    beforeEach(() => {
        locator = new SidBasedSemanticLocator(mockMarkdownContent, mockTocData);
    });

    describe('修复前的问题：insert_lines_in_section 需要 insertionPosition', () => {
        it('应该成功 - 以前的实现错误地要求 insertionPosition，现在修复了', () => {
            // 这模拟了原始问题：AI提供了lineRange但没有insertionPosition
            const result = locator.findTarget({
                sid: '/用户旅程-user-journeys',
                lineRange: { startLine: 10, endLine: 10 } // 使用文档范围内的行号
                // 注意：没有 insertionPosition 字段
            }, 'insert_section_content_only');

            // 修复后应该成功，因为insert_lines_in_section只需要lineRange
            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
            expect(result.insertionPoint).toBeDefined();
        });
    });

    describe('修复后的行为：insert_lines_in_section 只需要 lineRange', () => {
        it('应该成功 - 只提供 lineRange', () => {
            const result = locator.findTarget({
                sid: '/用户旅程-user-journeys',
                lineRange: { startLine: 10, endLine: 10 }
            }, 'insert_section_content_only');

            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
            expect(result.insertionPoint).toBeDefined();
        });

        it('应该失败 - 不提供 lineRange', () => {
            const result = locator.findTarget({
                sid: '/用户旅程-user-journeys'
                // 注意：没有提供任何定位信息
            }, 'insert_section_content_only');

            expect(result.found).toBe(false);
            expect(result.error).toContain('lineRange is required for insert_lines_in_section operations');
        });

        it('应该忽略 insertionPosition（如果意外提供）', () => {
            const result = locator.findTarget({
                sid: '/用户旅程-user-journeys',
                lineRange: { startLine: 10, endLine: 10 },
                insertionPosition: 'after' as any // 这个会被忽略
            }, 'insert_section_content_only');

            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
            // 应该使用lineRange而不是insertionPosition的逻辑
        });
    });

    describe('insert_entire_section 的行为不变', () => {
        it('应该成功 - 只提供 insertionPosition', () => {
            const result = locator.findTarget({
                sid: '/用户旅程-user-journeys',
                insertionPosition: 'after'
            }, 'insert_section_and_title');

            expect(result.found).toBe(true);
            expect(result.operationType).toBe('insert');
            expect(result.insertionPoint).toBeDefined();
        });

        it('应该失败 - 不提供 insertionPosition', () => {
            const result = locator.findTarget({
                sid: '/用户旅程-user-journeys'
            }, 'insert_section_and_title');

            expect(result.found).toBe(false);
            expect(result.error).toContain('insertionPosition');
        });

        it('应该拒绝 inside 值', () => {
            const result = locator.findTarget({
                sid: '/用户旅程-user-journeys',
                insertionPosition: 'inside' as any // 已经不再支持
            }, 'insert_section_and_title');

            expect(result.found).toBe(false);
            expect(result.error).toContain('Only \'before\' and \'after\' are supported');
        });
    });

    describe('错误消息质量', () => {
        it('insert_lines_in_section 的错误消息应该有用', () => {
            const result = locator.findTarget({
                sid: '/用户旅程-user-journeys'
            }, 'insert_section_content_only');

            expect(result.found).toBe(false);
            expect(result.error).toBe('lineRange is required for insert_lines_in_section operations');
            expect(result.suggestions?.hint).toContain('lineRange');
        });

        it('insert_entire_section 的错误消息应该有用', () => {
            const result = locator.findTarget({
                sid: '/用户旅程-user-journeys'
            }, 'insert_section_and_title');

            expect(result.found).toBe(false);
            expect(result.error).toBe('insertionPosition (\'before\' or \'after\') is required for insert_entire_section operations');
            expect(result.suggestions?.availablePositions).toEqual(['before', 'after']);
        });
    });
});
