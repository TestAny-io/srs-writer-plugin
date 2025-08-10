/**
 * 🆕 基于SID的语义编辑测试
 * 
 * 验证新的重构系统是否正常工作
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { executeSemanticEdits, SemanticEditIntent, SemanticEditResult } from '../../tools/document/semantic-edit-engine';
import { SidBasedSemanticLocator, TableOfContents } from '../../tools/atomic/sid-based-semantic-locator';

// Mock VSCode
jest.mock('vscode', () => {
    const mockWorkspace = {
        workspaceFolders: [
            {
                uri: { fsPath: '/mock/workspace', scheme: 'file', path: '/mock/workspace' },
                name: 'test-workspace',
                index: 0
            }
        ],
        openTextDocument: jest.fn(),
        applyEdit: jest.fn()
    };

    return {
        Uri: {
            file: jest.fn((path: string) => ({ fsPath: path, scheme: 'file', path }))
        },
        workspace: mockWorkspace,
        Range: jest.fn((start, end) => ({ start, end })),
        Position: jest.fn((line, char) => ({ line, character: char })),
        WorkspaceEdit: jest.fn(() => ({
            replace: jest.fn(),
            insert: jest.fn()
        }))
    };
});

describe('🆕 基于SID的语义编辑系统', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Access the mock through vscode.workspace
        const vscode = require('vscode');
        vscode.workspace.applyEdit.mockResolvedValue(true);
    });

    describe('SidBasedSemanticLocator', () => {
        const mockMarkdown = `# 第一章 概述

## 1.1 项目背景
项目背景内容

### 1.1.1 需求分析
需求分析内容

## 1.2 技术架构
技术架构内容`;

        const mockTocData: TableOfContents[] = [
            {
                sid: '/first-chapter',
                title: '第一章 概述',
                normalizedTitle: 'first-chapter',
                level: 1,
                line: 1,
                endLine: 10,
                children: [
                    {
                        sid: '/first-chapter/project-background',
                        title: '1.1 项目背景',
                        normalizedTitle: 'project-background',
                        level: 2,
                        line: 3,
                        endLine: 7,
                        children: [
                            {
                                sid: '/first-chapter/project-background/requirement-analysis',
                                title: '1.1.1 需求分析',
                                normalizedTitle: 'requirement-analysis',
                                level: 3,
                                line: 6,
                                endLine: 7
                            }
                        ]
                    },
                    {
                        sid: '/first-chapter/tech-architecture',
                        title: '1.2 技术架构',
                        normalizedTitle: 'tech-architecture',
                        level: 2,
                        line: 9,
                        endLine: 10
                    }
                ]
            }
        ];

        test('应该正确构建sid映射', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdown, mockTocData);
            
            const availableSids = locator.getAvailableSids();
            expect(availableSids).toContain('/first-chapter');
            expect(availableSids).toContain('/first-chapter/project-background');
            expect(availableSids).toContain('/first-chapter/project-background/requirement-analysis');
            expect(availableSids).toContain('/first-chapter/tech-architecture');
        });

        test('应该能找到存在的section', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdown, mockTocData);
            
            const target = {
                sid: '/first-chapter/project-background'
            };
            
            const result = locator.findTarget(target, 'replace_entire_section_with_title');
            
            expect(result.found).toBe(true);
            expect(result.operationType).toBe('replace');
            expect(result.range).toBeDefined();
        });

        test('应该正确处理行号定位', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdown, mockTocData);
            
            const target = {
                sid: '/first-chapter/project-background',
                lineRange: {
                    startLine: 1,
                    endLine: 2
                }
            };
            
            const result = locator.findTarget(target, 'replace_lines_in_section');
            
            expect(result.found).toBe(true);
            expect(result.operationType).toBe('replace');
            expect(result.context?.lineRange).toEqual({ startLine: 1, endLine: 2 });
        });

        test('应该处理sid不存在的情况', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdown, mockTocData);
            
            const target = {
                sid: '/non-existent-section'
            };
            
            const result = locator.findTarget(target, 'replace_entire_section_with_title');
            
            expect(result.found).toBe(false);
            expect(result.error).toContain('not found');
            expect(result.suggestions?.availableSids).toBeDefined();
        });

        test('应该处理行号超出范围的情况', () => {
            const locator = new SidBasedSemanticLocator(mockMarkdown, mockTocData);
            
            const target = {
                sid: '/first-chapter/project-background',
                lineRange: {
                    startLine: 999,  // 超出范围
                    endLine: 999
                }
            };
            
            const result = locator.findTarget(target, 'replace_lines_in_section');
            
            expect(result.found).toBe(false);
            expect(result.error).toContain('out of range');
            expect(result.suggestions?.validRange).toBeDefined();
        });
    });

    describe('executeSemanticEdits 基础功能', () => {
        const mockDocument = {
            getText: jest.fn().mockReturnValue('# Test Document\n\nContent here'),
            isDirty: false,
            save: jest.fn().mockResolvedValue(true)
        };

        beforeEach(() => {
            const vscode = require('vscode');
            vscode.workspace.openTextDocument.mockResolvedValue(mockDocument);
        });

        test('应该自动解析文档并处理sid不存在的情况', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_entire_section_with_title',
                    target: { sid: '/test-section' },  // 这个SID在mock文档中不存在
                    content: 'New content',
                    reason: 'Test',
                    priority: 0
                }
            ];

            const result = await executeSemanticEdits(
                intents, 
                vscode.Uri.file('/test/file.md')
                // ✅ 自包含架构：无需传递tocData
            );

            expect(result.success).toBe(false);
            expect(result.failedIntents[0].error).toContain('not found');
        });

        test('应该验证所有intents都有sid', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_entire_section_with_title',
                    target: { sid: '' }, // 空的sid
                    content: 'New content',
                    reason: 'Test',
                    priority: 0
                } as any
            ];

            const mockTocData: TableOfContents[] = [
                {
                    sid: '/test-section',
                    title: 'Test Section',
                    normalizedTitle: 'test-section',
                    level: 1,
                    line: 1
                }
            ];

            const result = await executeSemanticEdits(
                intents,
                vscode.Uri.file('/test/file.md'),
                // ✅ 自包含架构：无需传递tocData
            );

            expect(result.success).toBe(false);
            expect(result.failedIntents[0].error).toContain('sid-based targeting');
        });
    });

    describe('集成测试场景', () => {
        test('应该成功执行简单的section替换', async () => {
            const vscode = require('vscode');
            const mockDocument = {
                getText: jest.fn().mockReturnValue(`# 测试文档

## 第一节
这是第一节的内容

## 第二节  
这是第二节的内容`),
                isDirty: false,
                save: jest.fn().mockResolvedValue(true)
            };

            vscode.workspace.openTextDocument.mockResolvedValue(mockDocument);

            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_entire_section_with_title',
                    target: { sid: '/-1' },  // 使用实际生成的SID
                    content: '## 更新的第一节\n新的内容',
                    reason: '更新内容',
                    priority: 0
                }
            ];

            // ✅ 自包含架构：无需mockTocData，工具内部自动解析

            const result = await executeSemanticEdits(
                intents,
                vscode.Uri.file('/test/file.md'),
                // ✅ 自包含架构：无需传递tocData
            );

            expect(result.success).toBe(true);
            expect(result.successfulIntents).toBe(1);
            expect(result.failedIntents).toHaveLength(0);
            expect(vscode.workspace.applyEdit).toHaveBeenCalled();
        });
    });
});
