/**
 * Enhanced Semantic Edits Test - Phase 2 增强功能测试
 * 
 * 测试 siblingIndex, siblingOperation, validateOnly 功能
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { executeSemanticEdits, SemanticEditIntent } from '../../tools/document/semantic-edit-engine';
import { smartPathToSid } from '../fixtures/sid-migration-helpers';

// Mock vscode module
jest.mock('vscode', () => ({
    workspace: {
        openTextDocument: jest.fn(),
        applyEdit: jest.fn()
    },
    WorkspaceEdit: jest.fn(() => ({
        replace: jest.fn(),
        insert: jest.fn()
    })),
    Position: jest.fn((line: number, char: number) => ({ line, character: char })),
    Range: jest.fn((start: any, end: any) => ({ start, end })),
    Uri: {
        file: jest.fn((path: string) => ({ fsPath: path }))
    }
}));

// Mock fs
jest.mock('fs/promises', () => ({
    readFile: jest.fn(),
    stat: jest.fn()
}));

// Mock Logger
jest.mock('../../utils/logger', () => ({
    Logger: {
        getInstance: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        }))
    }
}));

describe('Enhanced Semantic Edits - Phase 2', () => {
    const testMarkdownContent = `# 系统设计文档

## 1 概述
系统概述内容

## 2 功能需求

### 2.1 用户管理
用户管理功能

### 2.2 权限控制
权限控制功能

### 2.3 数据管理
数据管理功能

## 3 技术规范
技术规范内容
`;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock vscode.workspace.openTextDocument
        (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({
            getText: () => testMarkdownContent
        });
        
        // Mock vscode.workspace.applyEdit
        (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);
        
        // Mock fs.readFile
        (fs.readFile as jest.Mock).mockResolvedValue(testMarkdownContent);
    });

    describe('siblingIndex 定位功能', () => {
        it('应该支持在指定兄弟节点之前插入', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    sid: smartPathToSid(['功能需求']),
                    insertionPosition: 'after', // insert_entire_section 需要 insertionPosition
                    siblingIndex: 1, // 在第二个子节点（权限控制）之前
                    siblingOperation: 'before'
                },
                content: '### 2.1.5 新功能模块\n新功能内容',
                reason: '在权限控制之前插入新功能',
                priority: 1
            }];

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents).toHaveLength(1);
            expect(result.failedIntents).toHaveLength(0);
        });

        it('应该支持在指定兄弟节点之后插入', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    sid: smartPathToSid(['功能需求']),
                    insertionPosition: 'after', // insert_entire_section 需要 insertionPosition
                    siblingIndex: 0, // 在第一个子节点（用户管理）之后
                    siblingOperation: 'after'
                },
                content: '### 2.2 安全模块\n安全相关功能',
                reason: '在用户管理之后插入安全模块',
                priority: 1
            }];

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents).toHaveLength(1);
        });

        it('应该正确处理 siblingIndex 超出范围的情况', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    sid: smartPathToSid(['功能需求']),
                    insertionPosition: 'after', // insert_entire_section 需要 insertionPosition
                    siblingIndex: 10, // 超出范围
                    siblingOperation: 'before'
                },
                content: '### 2.X 超范围模块\n内容',
                reason: '测试超范围情况',
                priority: 1
            }];

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents).toHaveLength(1);
            expect(result.failedIntents?.[0]?.error).toMatch(/out of range/i);
        });
    });

    describe('validateOnly 模式', () => {
        it('应该验证成功的编辑而不实际执行', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    sid: smartPathToSid(['功能需求']),
                    insertionPosition: 'after'
                },
                content: '## 4 新章节\n新章节内容',
                reason: '验证插入操作',
                priority: 1,
                validateOnly: true
            }];

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents).toHaveLength(1);
            expect(result.failedIntents).toHaveLength(0);
            
            // 验证没有调用实际的编辑操作
            expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
        });

        it('应该验证失败的编辑', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    sid: smartPathToSid(['不存在的章节']),
                    insertionPosition: 'after'
                },
                content: '## 4 新章节\n新章节内容',
                reason: '验证失败的插入操作',
                priority: 1,
                validateOnly: true
            }];

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.appliedIntents).toHaveLength(0);
            expect(result.failedIntents).toHaveLength(1);
            expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
        });

        it('应该同时处理验证和实际编辑意图', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'insert_entire_section',
                    target: {
                        sid: smartPathToSid(['概述']),
                        insertionPosition: 'after'
                    },
                    content: '## 1.5 验证章节\n验证内容',
                    reason: '验证操作',
                    priority: 2,
                    validateOnly: true
                },
                {
                    type: 'insert_entire_section',
                    target: {
                        sid: smartPathToSid(['技术规范']),
                        insertionPosition: 'after'
                    },
                    content: '## 4 实际章节\n实际内容',
                    reason: '实际操作',
                    priority: 1,
                    validateOnly: false
                }
            ];

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents).toHaveLength(2);
            
            // 验证只有非验证模式的编辑被实际应用
            expect(vscode.workspace.applyEdit).toHaveBeenCalledTimes(1);
        });
    });

    describe('复合功能测试', () => {
        it('应该支持带 siblingIndex 的验证模式', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    sid: smartPathToSid(['功能需求']),
                    insertionPosition: 'after', // insert_entire_section 需要 insertionPosition
                    siblingIndex: 1,
                    siblingOperation: 'before'
                },
                content: '### 2.1.5 验证功能\n验证内容',
                reason: '验证 siblingIndex 功能',
                priority: 1,
                validateOnly: true
            }];

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents).toHaveLength(1);
            expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
        });
    });

    describe('向后兼容性', () => {
        it('应该保持现有功能不变', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_lines_in_section',
                target: {
                    sid: smartPathToSid(['概述']),
                    lineRange: { startLine: 1, endLine: 1 }
                },
                content: '更新的系统概述内容',
                reason: '更新概述',
                priority: 1
            }];

            const testFileUri = vscode.Uri.file('test.md');
            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents).toHaveLength(1);
            expect(vscode.workspace.applyEdit).toHaveBeenCalled();
        });
    });
});