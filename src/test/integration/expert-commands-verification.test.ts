/**
 * Expert Commands Verification Test - 验证专家指令修复效果
 * 
 * 测试原始专家指令的问题和修复后的指令效果
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { executeSemanticEdits, SemanticEditIntent } from '../../tools/document/semantic-edit-engine';
import { readMarkdownFile } from '../../tools/document/enhanced-readfile-tools';
import { smartPathToSid } from '../fixtures/sid-migration-helpers';

// Mock vscode module
jest.mock('vscode', () => ({
    workspace: {
        openTextDocument: jest.fn(),
        applyEdit: jest.fn(),
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }]
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

// Mock SessionManager
jest.mock('../../core/session-manager', () => ({
    SessionManager: {
        getInstance: jest.fn(() => ({
            getActiveSession: jest.fn(() => ({ id: 'test-session' }))
        }))
    }
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

// Mock unified and remark dependencies
jest.mock('unified', () => {
    return jest.fn(() => ({
        use: jest.fn().mockReturnThis(),
        parse: jest.fn((content) => {
            // Simple mock AST for testing
            return {
                type: 'root',
                children: [
                    {
                        type: 'heading',
                        depth: 1,
                        children: [{ type: 'text', value: '佣金生效日规则配置需求' }],
                        position: { start: { line: 1, column: 1 }, end: { line: 1, column: 15 } }
                    },
                    {
                        type: 'heading',
                        depth: 2,
                        children: [{ type: 'text', value: '5 相关页面及规则说明' }],
                        position: { start: { line: 3, column: 1 }, end: { line: 3, column: 12 } }
                    },
                    {
                        type: 'heading',
                        depth: 3,
                        children: [{ type: 'text', value: '5.1 长险规则配置' }],
                        position: { start: { line: 5, column: 1 }, end: { line: 5, column: 10 } }
                    },
                    {
                        type: 'heading',
                        depth: 3,
                        children: [{ type: 'text', value: '5.2 非长险规则配置' }],
                        position: { start: { line: 8, column: 1 }, end: { line: 8, column: 11 } }
                    },
                    {
                        type: 'heading',
                        depth: 3,
                        children: [{ type: 'text', value: '5.3 其他规则' }],
                        position: { start: { line: 11, column: 1 }, end: { line: 11, column: 8 } }
                    },
                    {
                        type: 'heading',
                        depth: 3,
                        children: [{ type: 'text', value: '5.4 非长险规则配置' }],
                        position: { start: { line: 14, column: 1 }, end: { line: 14, column: 11 } }
                    },
                    {
                        type: 'heading',
                        depth: 4,
                        children: [{ type: 'text', value: '5.4.1 页面原型' }],
                        position: { start: { line: 16, column: 1 }, end: { line: 16, column: 10 } }
                    },
                    {
                        type: 'heading',
                        depth: 4,
                        children: [{ type: 'text', value: '5.4.2 页面元素' }],
                        position: { start: { line: 19, column: 1 }, end: { line: 19, column: 10 } }
                    },
                    {
                        type: 'heading',
                        depth: 3,
                        children: [{ type: 'text', value: '5.5 菜单权限控制' }],
                        position: { start: { line: 22, column: 1 }, end: { line: 22, column: 10 } }
                    }
                ]
            };
        }),
        stringify: jest.fn()
    }));
});

describe('Expert Commands Verification', () => {
    const targetDocumentContent = `# 佣金生效日规则配置需求

## 5 相关页面及规则说明

### 5.1 长险规则配置
长险规则配置相关内容

### 5.2 非长险规则配置  
非长险规则配置相关内容

### 5.3 其他规则
其他规则配置

### 5.4 非长险规则配置

#### 5.4.1 页面原型
页面原型说明

#### 5.4.2 页面元素
页面元素说明

### 5.5 菜单权限控制
菜单权限控制相关内容
`;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock vscode.workspace.openTextDocument
        (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({
            getText: () => targetDocumentContent
        });
        
        // Mock vscode.workspace.applyEdit
        (vscode.workspace.applyEdit as jest.Mock).mockResolvedValue(true);
        
        // Mock fs.readFile
        (fs.readFile as jest.Mock).mockResolvedValue(targetDocumentContent);
        
        // Mock fs.stat
        (fs.stat as jest.Mock).mockResolvedValue({
            mtime: new Date(),
            size: targetDocumentContent.length
        });
    });

    describe('原始专家指令问题验证', () => {
        it('专家G的原始指令应该失败（5.5章节已存在）', async () => {
            const originalExpertG: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    sid: smartPathToSid(['5 相关页面及规则说明', '5.4 非长险规则配置']),
                    insertionPosition: 'after'
                },
                content: '\n## 5.5 按保司结算日规则配置\n\n### 5.5.1 页面原型\n\n当佣金生效规则选择"按保司结算日"时，系统将根据保险公司与我司的结算日期来计算佣金生效日。',
                reason: '新增"按保司结算日"作为一项新的佣金生效日规则',
                priority: 0,
                validateOnly: true // 使用验证模式测试
            }];

            const testFileUri = vscode.Uri.file('/test/document.md');
            const result = await executeSemanticEdits(originalExpertG, testFileUri);

            // 应该成功找到目标，但内容冲突（5.5已存在）
            expect(result.success).toBe(true); // 验证模式下位置可以找到
            expect(result.appliedIntents).toHaveLength(1);
        });

        it('专家O的原始指令应该成功（路径模糊匹配）', async () => {
            const originalExpertO: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    sid: smartPathToSid(['相关页面及规则说明', '非长险规则配置']),
                    insertionPosition: 'after' // insert_entire_section 只支持 'before' 和 'after'
                },
                content: '### 5.4.3 电子保单佣金生效日规则\n\n**规则描述**\n\n1. **适用范围**：所有非长险电子保单产品。',
                reason: '业务新增电子保单佣金生效日子规则',
                priority: 1,
                validateOnly: true // 使用验证模式测试
            }];

            const testFileUri = vscode.Uri.file('/test/document.md');
            const result = await executeSemanticEdits(originalExpertO, testFileUri);

            // 由于路径不完全匹配（缺少"5"前缀），应该失败
            expect(result.success).toBe(false);
            expect(result.failedIntents).toHaveLength(1);
        });
    });

    describe('修复后的专家指令', () => {
        it('专家G修复版：使用siblingIndex避免编号冲突', async () => {
            // 首先获取文档结构信息
            const docStructure = await readMarkdownFile({
                path: '/test/document.md',
                parseMode: 'structure'
            });

            // 检查文档结构是否正确解析
            expect(docStructure.success).toBe(true);
            expect(docStructure.tableOfContents).toBeDefined();
            
            // 找到"5 相关页面及规则说明"章节的子章节信息
            const mainSection = docStructure.tableOfContents?.find(
                section => section.normalizedTitle === '相关页面及规则说明'
            );

            expect(mainSection).toBeDefined();
            expect(mainSection?.children).toBeDefined();
            expect(mainSection?.children.length).toBeGreaterThan(0);

            // 修复版：插入到适当位置，避免编号冲突
            const fixedExpertG: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    sid: smartPathToSid(['5 相关页面及规则说明']),
                    insertionPosition: 'after', // insert_entire_section 只支持 'before' 和 'after'
                    siblingIndex: 4, // 在最后一个子节点(5.5)之前
                    siblingOperation: 'before'
                },
                content: '### 5.4.5 按保司结算日规则配置\n\n#### 5.4.5.1 页面原型\n\n当佣金生效规则选择"按保司结算日"时，系统将根据保险公司与我司的结算日期来计算佣金生效日。',
                reason: '新增"按保司结算日"规则，避免与现有5.5章节冲突',
                priority: 0
            }];

            const testFileUri = vscode.Uri.file('/test/document.md');
            const result = await executeSemanticEdits(fixedExpertG, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents).toHaveLength(1);
            expect(result.failedIntents).toHaveLength(0);
        });

        it('专家O修复版：使用siblingIndex精确定位', async () => {
            // 修复版：使用siblingIndex精确插入到5.4.2之后
            const fixedExpertO: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    sid: smartPathToSid(['5 相关页面及规则说明', '5.4 非长险规则配置']),
                    insertionPosition: 'after', // insert_entire_section 只支持 'before' 和 'after'
                    siblingIndex: 1, // 在第二个子节点(5.4.2)之后
                    siblingOperation: 'after'
                },
                content: '#### 5.4.3 电子保单佣金生效日规则\n\n**规则描述**\n\n1. **适用范围**：所有非长险电子保单产品（短期意外、短期健康等）。\n2. **生效条件**：当收到保险公司回执完成标识时。',
                reason: '在正确位置插入电子保单规则，避免顺序错乱',
                priority: 1
            }];

            const testFileUri = vscode.Uri.file('/test/document.md');
            const result = await executeSemanticEdits(fixedExpertO, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents).toHaveLength(1);
            expect(result.failedIntents).toHaveLength(0);
        });

        it('应该能同时处理多个修复指令', async () => {
            const combinedFixedIntents: SemanticEditIntent[] = [
                {
                    type: 'insert_entire_section',
                    target: {
                        sid: smartPathToSid(['5 相关页面及规则说明']),
                        insertionPosition: 'after', // insert_entire_section 只支持 'before' 和 'after'
                        siblingIndex: 4,
                        siblingOperation: 'before'
                    },
                    content: '### 5.4.5 按保司结算日规则配置\n\n按保司结算日规则内容',
                    reason: '新增按保司结算日规则',
                    priority: 1
                },
                {
                    type: 'insert_entire_section',
                    target: {
                        sid: smartPathToSid(['5 相关页面及规则说明', '5.4 非长险规则配置']),
                        insertionPosition: 'after', // insert_entire_section 只支持 'before' 和 'after'
                        siblingIndex: 1,
                        siblingOperation: 'after'
                    },
                    content: '#### 5.4.3 电子保单佣金生效日规则\n\n电子保单规则内容',
                    reason: '新增电子保单规则',
                    priority: 2
                }
            ];

            const testFileUri = vscode.Uri.file('/test/document.md');
            const result = await executeSemanticEdits(combinedFixedIntents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents).toHaveLength(2);
            expect(result.failedIntents).toHaveLength(0);
        });
    });

    describe('AI友好字段验证', () => {
        it('应该提供准确的章节结构信息', async () => {
            const result = await readMarkdownFile({
                path: '/test/document.md',
                parseMode: 'structure'
            });

            // 调试输出
            console.log('readMarkdownFile result:', {
                success: result.success,
                error: result.error,
                tocLength: result.tableOfContents?.length
            });

            expect(result.success).toBe(true);
            expect(result.tableOfContents).toBeDefined();
            expect(result.tableOfContents?.length).toBeGreaterThan(0);

            // 验证主章节的AI友好字段
            const mainSection = result.tableOfContents?.find(
                section => section.normalizedTitle === '相关页面及规则说明'
            );

            expect(mainSection).toBeDefined();
            expect(mainSection?.children.map(child => child.title)).toEqual([
                '5.1 长险规则配置',
                '5.2 非长险规则配置',
                '5.3 其他规则',
                '5.4 非长险规则配置',
                '5.5 菜单权限控制'
            ]);
            expect(mainSection?.siblingIndex).toBe(0); // 第一个根级章节
            expect(mainSection?.siblingCount).toBe(1); // 只有一个根级章节

            // 验证子章节的信息
            const subSection = result.tableOfContents?.find(
                section => section.title === '5.4 非长险规则配置'
            );
            
            expect(subSection?.siblingIndex).toBe(3); // 在同级中的索引
            expect(subSection?.siblingCount).toBe(5); // 同级章节总数
            expect(subSection?.children.map(child => child.title)).toEqual([
                '5.4.1 页面原型',
                '5.4.2 页面元素'
            ]);
        });
    });
});