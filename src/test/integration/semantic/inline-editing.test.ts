/**
 * 行内编辑功能集成测试
 * 
 * 测试新的行内编辑类型：
 * - update_content_in_section
 * - insert_line_in_section  
 * - remove_content_in_section
 * - append_to_section
 * - prepend_to_section
 */

import * as vscode from 'vscode';
import * as assert from 'assert';
import { executeSemanticEdits, SemanticEditIntent } from '../../../tools/document/semantic-edit-engine';
import { DocumentAnalyzer } from '../../../tools/atomic/document-analyzer';
import { SemanticLocator } from '../../../tools/atomic/semantic-locator';

describe('Inline Editing Integration Tests', () => {
    let testDocument: vscode.TextDocument;
    let testUri: vscode.Uri;
    
    const testContent = `# 测试文档

## 用户旅程1

用户首先需要选择合适的平角裤，然后添加到购物车中。
接着用户需要填写收货地址和支付信息。

## 功能列表

- 用户登录功能
- 商品浏览功能
- 购物车管理

## 系统架构

本系统采用微服务架构。

## 安全要求

所有数据传输必须加密。
用户密码必须进行散列存储。`;

    beforeEach(async () => {
        // 创建测试文件
        testUri = vscode.Uri.file('/tmp/test-inline-editing.md');
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.createFile(testUri, { ignoreIfExists: true });
        workspaceEdit.insert(testUri, new vscode.Position(0, 0), testContent);
        
        await vscode.workspace.applyEdit(workspaceEdit);
        testDocument = await vscode.workspace.openTextDocument(testUri);
    });

    afterEach(async () => {
        // 清理测试文件
        try {
            const workspaceEdit = new vscode.WorkspaceEdit();
            workspaceEdit.deleteFile(testUri);
            await vscode.workspace.applyEdit(workspaceEdit);
        } catch (error) {
            console.warn('清理测试文件失败:', error);
        }
    });

    describe('update_content_in_section', () => {
        it('应该成功更新章节内的特定内容', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'update_content_in_section',
                target: {
                    sectionName: '用户旅程1',
                    targetContent: '平角裤'
                },
                content: '三角裤',
                reason: '更正产品名称',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testUri);
            
            assert.strictEqual(result.success, true, '语义编辑应该成功');
            assert.strictEqual(result.appliedIntents.length, 1, '应该应用1个意图');
            assert.strictEqual(result.failedIntents.length, 0, '不应该有失败的意图');

            // 验证内容已更新
            const updatedDocument = await vscode.workspace.openTextDocument(testUri);
            const content = updatedDocument.getText();
            assert.ok(content.includes('三角裤'), '应该包含更新后的内容');
            assert.ok(!content.includes('平角裤'), '不应该包含原有内容');
        });

        it('应该处理目标内容不存在的情况', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'update_content_in_section',
                target: {
                    sectionName: '用户旅程1',
                    targetContent: '不存在的内容'
                },
                content: '新内容',
                reason: '测试不存在的内容',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testUri);
            
            assert.strictEqual(result.success, false, '应该失败，因为目标内容不存在');
            assert.strictEqual(result.failedIntents.length, 1, '应该有1个失败的意图');
        });
    });

    describe('insert_line_in_section', () => {
        it('应该在指定内容后插入新行', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_line_in_section',
                target: {
                    sectionName: '功能列表',
                    afterContent: '- 用户登录功能'
                },
                content: '- 密码重置功能',
                reason: '在用户登录功能后添加密码重置功能',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testUri);
            
            assert.strictEqual(result.success, true, '语义编辑应该成功');
            assert.strictEqual(result.appliedIntents.length, 1, '应该应用1个意图');

            // 验证内容已插入
            const updatedDocument = await vscode.workspace.openTextDocument(testUri);
            const content = updatedDocument.getText();
            assert.ok(content.includes('- 密码重置功能'), '应该包含插入的内容');
            
            // 验证插入位置正确
            const lines = content.split('\n');
            const loginIndex = lines.findIndex(line => line.includes('- 用户登录功能'));
            const resetIndex = lines.findIndex(line => line.includes('- 密码重置功能'));
            assert.ok(resetIndex > loginIndex, '密码重置功能应该在用户登录功能之后');
        });

        it('应该在指定内容前插入新行', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_line_in_section',
                target: {
                    sectionName: '功能列表',
                    beforeContent: '- 商品浏览功能'
                },
                content: '- 用户注册功能',
                reason: '在商品浏览功能前添加用户注册功能',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testUri);
            
            assert.strictEqual(result.success, true, '语义编辑应该成功');

            // 验证插入位置正确
            const updatedDocument = await vscode.workspace.openTextDocument(testUri);
            const content = updatedDocument.getText();
            const lines = content.split('\n');
            const browseIndex = lines.findIndex(line => line.includes('- 商品浏览功能'));
            const registerIndex = lines.findIndex(line => line.includes('- 用户注册功能'));
            assert.ok(registerIndex < browseIndex, '用户注册功能应该在商品浏览功能之前');
        });
    });

    describe('remove_content_in_section', () => {
        it('应该删除章节内的特定内容', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'remove_content_in_section',
                target: {
                    sectionName: '功能列表',
                    contentToRemove: '- 购物车管理'
                },
                content: '', // remove操作content可以为空
                reason: '删除购物车管理功能',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testUri);
            
            assert.strictEqual(result.success, true, '语义编辑应该成功');
            assert.strictEqual(result.appliedIntents.length, 1, '应该应用1个意图');

            // 验证内容已删除
            const updatedDocument = await vscode.workspace.openTextDocument(testUri);
            const content = updatedDocument.getText();
            assert.ok(!content.includes('- 购物车管理'), '不应该包含已删除的内容');
            assert.ok(content.includes('- 用户登录功能'), '应该保留其他内容');
        });
    });

    describe('append_to_section', () => {
        it('应该在章节末尾追加内容', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'append_to_section',
                target: {
                    sectionName: '系统架构'
                },
                content: '\n\n### 缓存策略\n\n系统采用Redis进行数据缓存。',
                reason: '在系统架构章节末尾添加缓存策略',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testUri);
            
            assert.strictEqual(result.success, true, '语义编辑应该成功');
            assert.strictEqual(result.appliedIntents.length, 1, '应该应用1个意图');

            // 验证内容已追加
            const updatedDocument = await vscode.workspace.openTextDocument(testUri);
            const content = updatedDocument.getText();
            assert.ok(content.includes('### 缓存策略'), '应该包含追加的内容');
            assert.ok(content.includes('系统采用Redis进行数据缓存'), '应该包含追加的详细内容');
        });
    });

    describe('prepend_to_section', () => {
        it('应该在章节开头插入内容', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'prepend_to_section',
                target: {
                    sectionName: '安全要求'
                },
                content: '**重要提醒**: 本节涉及系统安全核心要求，请仔细阅读。\n\n',
                reason: '在安全要求章节开头添加重要提醒',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testUri);
            
            assert.strictEqual(result.success, true, '语义编辑应该成功');
            assert.strictEqual(result.appliedIntents.length, 1, '应该应用1个意图');

            // 验证内容已插入到开头
            const updatedDocument = await vscode.workspace.openTextDocument(testUri);
            const content = updatedDocument.getText();
            assert.ok(content.includes('**重要提醒**'), '应该包含插入的内容');
            
            // 验证插入位置在章节开头
            const securitySectionIndex = content.indexOf('## 安全要求');
            const reminderIndex = content.indexOf('**重要提醒**');
            assert.ok(reminderIndex > securitySectionIndex, '提醒应该在章节标题之后');
        });
    });

    describe('复合行内编辑操作', () => {
        it('应该成功执行多个不同类型的行内编辑操作', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'update_content_in_section',
                    target: {
                        sectionName: '用户旅程1',
                        targetContent: '平角裤'
                    },
                    content: '三角裤',
                    reason: '更正产品名称',
                    priority: 3
                },
                {
                    type: 'insert_line_in_section',
                    target: {
                        sectionName: '功能列表',
                        afterContent: '- 用户登录功能'
                    },
                    content: '- 密码重置功能',
                    reason: '添加密码重置功能',
                    priority: 2
                },
                {
                    type: 'append_to_section',
                    target: {
                        sectionName: '系统架构'
                    },
                    content: '\n\n系统支持水平扩展。',
                    reason: '添加扩展性说明',
                    priority: 1
                }
            ];

            const result = await executeSemanticEdits(intents, testUri);
            
            assert.strictEqual(result.success, true, '所有语义编辑应该成功');
            assert.strictEqual(result.appliedIntents.length, 3, '应该应用3个意图');
            assert.strictEqual(result.failedIntents.length, 0, '不应该有失败的意图');

            // 验证所有修改都已应用
            const updatedDocument = await vscode.workspace.openTextDocument(testUri);
            const content = updatedDocument.getText();
            assert.ok(content.includes('三角裤'), '应该包含更新的产品名称');
            assert.ok(content.includes('- 密码重置功能'), '应该包含新插入的功能');
            assert.ok(content.includes('系统支持水平扩展'), '应该包含追加的内容');
        });
    });

    describe('错误处理和边界情况', () => {
        it('应该处理章节不存在的情况', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'update_content_in_section',
                target: {
                    sectionName: '不存在的章节',
                    targetContent: '任何内容'
                },
                content: '新内容',
                reason: '测试不存在的章节',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testUri);
            
            assert.strictEqual(result.success, false, '应该失败，因为章节不存在');
            assert.strictEqual(result.failedIntents.length, 1, '应该有1个失败的意图');
            assert.ok(result.semanticErrors && result.semanticErrors.length > 0, '应该有语义错误信息');
        });

        it('应该处理空目标内容的情况', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'update_content_in_section',
                target: {
                    sectionName: '用户旅程1',
                    targetContent: ''
                },
                content: '新内容',
                reason: '测试空目标内容',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testUri);
            
            assert.strictEqual(result.success, false, '应该失败，因为目标内容为空');
            assert.strictEqual(result.failedIntents.length, 1, '应该有1个失败的意图');
        });
    });
}); 