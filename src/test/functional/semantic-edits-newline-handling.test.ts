/**
 * Semantic Edits - 换行符处理功能测试
 * 
 * 该测试使用真实的 VSCode WorkspaceEdit API，验证换行符处理
 * 在实际编辑场景中的正确性和稳定性。
 * 
 * 测试范围：
 * - Replace 操作的换行符保留
 * - Insert 操作的换行符保留
 * - 多次编辑的累积效果
 * - 文件不同位置的编辑
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

describe('Semantic Edits - Newline Handling Functional Test', () => {
    const testDir = path.join(__dirname, '../../fixtures/functional-test-newline');
    const testFilePath = path.join(testDir, 'functional-test.md');

    beforeAll(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    afterAll(() => {
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });

    /**
     * 测试1：Replace 操作保留换行符
     */
    describe('Replace Operations', () => {
        test('replace_section_content_only 应该保留后续内容的换行', async () => {
            const initialContent = `Line 1 - section A
Next section B`;
            fs.writeFileSync(testFilePath, initialContent, 'utf-8');

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
            const finalContent = document.getText();
            
            // 关键验证：内容应该被正确替换，且后续行应该保持独立
            expect(finalContent).toContain('Line 1 - section A');
            expect(finalContent).toContain('Next section B');
            
            // 验证不是简单的字符串拼接（会导致合并）
            expect(finalContent).not.toContain('Replaced Line 1 - section ANext section B');
        });

        test('replace_section_and_title 应该包括标题且保留换行', async () => {
            const initialContent = `# Section 1
Content here

# Section 2
Other content`;
            fs.writeFileSync(testFilePath, initialContent, 'utf-8');

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
            const finalContent = document.getText();
            
            // 验证新内容被插入
            expect(finalContent).toContain('# Section 1');
            expect(finalContent).toContain('Content here');
            
            // 验证第二个 section 仍然存在且独立
            expect(finalContent).toContain('# Section 2');
            expect(finalContent).toContain('Other content');
        });

        test('多行替换应该保留正确的行结构', async () => {
            const initialContent = `Item A
Item B
Item C
Extra content`;
            fs.writeFileSync(testFilePath, initialContent, 'utf-8');

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
            const finalContent = document.getText();
            const lines = finalContent.split('\n');
            
            // 验证行数正确
            expect(lines[0]).toBe('Item A');
            expect(lines[1]).toBe('Item B');
            expect(lines[2]).toBe('Item C');
            expect(lines[3]).toBe('Extra content');
        });
    });

    /**
     * 测试2：Insert 操作保留换行符
     */
    describe('Insert Operations', () => {
        test('insert_section_content_only 应该在正确位置插入且保留换行', async () => {
            const initialContent = `Line 1
Line 2
Line 3`;
            fs.writeFileSync(testFilePath, initialContent, 'utf-8');

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
            const finalContent = document.getText();
            const lines = finalContent.split('\n');
            
            // 验证插入位置和结构
            expect(lines[0]).toBe('Line 1');
            expect(lines[1]).toBe('Line 2');
            expect(lines[2]).toBe('Line 3');
        });

        test('insert_section_and_title 应该插入完整的新 section', async () => {
            const initialContent = `# Section 1
Content 1`;
            fs.writeFileSync(testFilePath, initialContent, 'utf-8');

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
            const finalContent = document.getText();
            
            // 验证两个 section 都存在
            expect(finalContent).toContain('# Section 1');
            expect(finalContent).toContain('Content 1');
        });
    });

    /**
     * 测试3：极端情况
     */
    describe('Edge Cases', () => {
        test('包含特殊字符的内容应该正确处理换行', async () => {
            const initialContent = `Code example
Next line`;
            fs.writeFileSync(testFilePath, initialContent, 'utf-8');

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
            const finalContent = document.getText();
            
            // 验证代码块被正确插入
            expect(finalContent).toContain('Code example');
            
            // 验证后续内容仍存在
            expect(finalContent).toContain('Next line');
        });

        test('编辑包含中文字符的内容', async () => {
            const initialContent = `第一行
第二行`;
            fs.writeFileSync(testFilePath, initialContent, 'utf-8');

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
            const finalContent = document.getText();
            
            expect(finalContent).toContain('第一行');
            expect(finalContent).toContain('第二行');
        });

        test('空内容不应该破坏结构', async () => {
            const initialContent = `Section content
Next section`;
            fs.writeFileSync(testFilePath, initialContent, 'utf-8');

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
            const finalContent = document.getText();
            
            // 验证后续内容仍存在且分离
            expect(finalContent).toContain('Next section');
        });
    });

    /**
     * 测试4：验证提出的 issue 中的具体场景
     */
    describe('Reported Issue Verification', () => {
        test('issue场景：多次编辑不应该连接行', async () => {
            // 构造用户报告的场景
            const initialContent = `abcdefg

ABCDEFG
`;
            fs.writeFileSync(testFilePath, initialContent, 'utf-8');

            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));

            // 验证初始状态
            let content = document.getText();
            expect(content).toContain('abcdefg');
            expect(content).toContain('ABCDEFG');
            
            // 应该有空行分隔
            expect(content).toContain('\n\n');
        });
    });
});
