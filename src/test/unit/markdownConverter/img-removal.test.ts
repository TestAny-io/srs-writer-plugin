/**
 * 测试img标签删除功能
 */

import { cleanMarkdownContent } from '../../../tools/document/markitdownConverter/utils';

describe('图片标签删除测试', () => {
    test('应该删除包含base64数据的img标签', () => {
        const markdown = `# 测试文档

这是一段文字。

<img src="data:image/tiff;base64,iVBORw0KGgoAAAANSUhEUgAAAjEAAAE3CAYAAABb3hB0" alt="测试图片">

这是另一段文字。`;

        const result = cleanMarkdownContent(markdown);
        
        expect(result).not.toContain('<img');
        expect(result).toContain('这是一段文字。');
        expect(result).toContain('这是另一段文字。');
    });

    test('应该删除各种格式的img标签', () => {
        const markdown = `# 测试文档

<img alt="图片1" src="image1.jpg">
<img src="image2.png" alt="图片2" width="100">
<IMG SRC="IMAGE3.GIF" ALT="图片3">
<img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//gA7Q1JFQVRPUjogZ2QtanBlZyB2MS4w" alt="base64图片" title="标题">

正常文字内容。`;

        const result = cleanMarkdownContent(markdown);
        
        expect(result).not.toContain('<img');
        expect(result).not.toContain('<IMG');
        expect(result).toContain('正常文字内容。');
    });

    test('应该保留其他HTML标签和markdown语法', () => {
        const markdown = `# 标题

**粗体文字**

<img src="test.jpg" alt="应该被删除">

*斜体文字*

<div>这个div应该保留</div>

<img alt="另一个图片" src="another.png">

- 列表项1
- 列表项2`;

        const result = cleanMarkdownContent(markdown);
        
        expect(result).not.toContain('<img');
        expect(result).toContain('**粗体文字**');
        expect(result).toContain('*斜体文字*');
        expect(result).toContain('<div>这个div应该保留</div>');
        expect(result).toContain('- 列表项1');
    });

    test('应该处理空内容', () => {
        expect(cleanMarkdownContent('')).toBe('');
        expect(cleanMarkdownContent(null as any)).toBe('');
        expect(cleanMarkdownContent(undefined as any)).toBe('');
    });

    test('应该处理只有img标签的内容', () => {
        const markdown = '<img src="test.jpg" alt="只有图片">';
        const result = cleanMarkdownContent(markdown);
        
        expect(result.trim()).toBe('');
    });
});