/**
 * 基于路径数组的语义编辑测试
 * 
 * 测试新的path-based schema和executeMarkdownEdits工具的功能
 */

import * as vscode from 'vscode';
import { executeSemanticEdits, SemanticEditIntent } from '../../../tools/document/semantic-edit-engine';

describe('Path-Based Semantic Editing Tests', () => {
    
    let mockDocument: vscode.TextDocument;
    let mockWorkspaceEdit: vscode.WorkspaceEdit;
    let testFileUri: vscode.Uri;

    const sampleMarkdown = `# 极端天气预警应用SRS

## 4. 用户故事和用例视图 (User Stories & Use-Case View)

### 用户故事

- **US-ALERT-001**
    - **name**: 接收极端天气预警
    - **作为**: 城市居民
    - **我希望**: 能及时收到极端天气预警通知
    - **以便**: 迅速采取应对措施，保障安全

- **US-INFO-001**
    - **name**: 查看预警详情
    - **作为**: 城市居民
    - **我希望**: 能详细了解预警信息内容
    - **以便**: 做出合理判断和安排

### 用例规格说明

- **UC-ALERT-001**
    - **用例名称**: 接收极端天气预警
    - **参与者**: 城市居民
    - **简述**: 系统自动推送极端天气预警信息至用户

- **UC-INFO-001**
    - **用例名称**: 查看预警详情
    - **参与者**: 城市居民
    - **简述**: 用户点击通知后进入详情页面，查看详细预警信息

## 5. 功能需求 (Functional Requirements)

### 5.1 基于用例UC-ALERT-001的功能需求

- **FR-ALERT-001**: 预警信息推送
    - **描述**: 系统应能够根据气象数据自动生成并推送预警信息

### UC-INFO-001 查看预警详情
- **用例名称**: 查看预警详情
- **参与者**: 城市居民  
- **简述**: 功能需求描述，与第4章的用例有重复内容`;

    beforeEach(() => {
        testFileUri = vscode.Uri.file('/test/SRS.md');
        
        // Mock VSCode API
        mockDocument = {
            getText: jest.fn(() => sampleMarkdown),
            uri: testFileUri
        } as any;

        mockWorkspaceEdit = {
            replace: jest.fn(),
            insert: jest.fn(),
            delete: jest.fn()
        } as any;

        // Mock workspace.openTextDocument
        jest.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(mockDocument);
        jest.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('新的路径数组schema测试', () => {
        test('应该支持替换整个section使用路径数组', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_entire_section',
                target: {
                    path: ['**US-INFO-001**']
                },
                content: `- **US-INFO-001**
    - **name**: 查看预警详情（增强版）
    - **作为**: 城市居民
    - **我希望**: 能详细了解预警信息内容，包括历史数据
    - **以便**: 做出更准确的判断和安排
    - **验收标准**:
        - 详情页面展示天气类型、时间、影响范围、官方建议
        - 支持历史预警记录查询
        - 加载时间不超过2秒`,
                reason: '增强用户故事，添加历史数据查询功能',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents.length).toBe(1);
            expect(result.failedIntents.length).toBe(0);
        });

        test('应该支持替换section内特定内容', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_lines_in_section',
                target: {
                    path: ['**UC-INFO-001**'],
                    targetContent: '城市居民'
                },
                content: '企业管理者和城市居民',
                reason: '扩展用例的参与者范围',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents.length).toBe(1);
        });

        test('应该支持插入操作使用路径数组', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    path: ['用户故事'],
                    insertionPosition: 'after'
                },
                content: `
### 用户旅程图

- **UJ-ALERT-001**: 预警接收旅程
    - 用户日常使用 → 预警触发 → 推送通知 → 查看详情 → 采取行动

- **UJ-INFO-001**: 详情查看旅程  
    - 收到通知 → 点击查看 → 浏览详情 → 理解信息 → 决策行动`,
                reason: '在用户故事后插入用户旅程图章节',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents.length).toBe(1);
        });

        test('应该精确区分重复名称的元素', async () => {
            // 测试能够区分第4章用例视图中的UC-INFO-001和第5章功能需求中的UC-INFO-001
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_lines_in_section',
                    target: {
                        path: ['**UC-INFO-001**'], // 第4章中的list item
                        targetContent: '用户点击通知后进入详情页面，查看详细预警信息'
                    },
                    content: '用户点击通知后进入详情页面，查看详细预警信息，支持历史记录查询',
                    reason: '在第4章用例视图中增加历史记录功能',
                    priority: 2
                },
                {
                    type: 'replace_lines_in_section',
                    target: {
                        path: ['UC-INFO-001 查看预警详情'], // 第5章中的heading
                        targetContent: '功能需求描述，与第4章的用例有重复内容'
                    },
                    content: '功能需求描述：系统应提供预警详情查看功能，包括天气类型、影响区域、时间、官方建议等信息',
                    reason: '在第5章功能需求中完善描述',
                    priority: 1
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents.length).toBe(2);
            expect(result.failedIntents.length).toBe(0);
        });
    });

    describe('路径验证和错误处理', () => {
        test('应该拒绝空路径数组', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_entire_section',
                target: {
                    path: [] // 空路径数组
                },
                content: '替换内容',
                reason: '测试空路径',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents.length).toBe(1);
            expect(result.error).toContain('Empty path');
        });

        test('应该处理不存在的路径', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_entire_section',
                target: {
                    path: ['不存在的章节', '子章节']
                },
                content: '替换内容',
                reason: '测试不存在的路径',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents.length).toBe(1);
            expect(result.error).toContain('not found');
        });

        test('应该验证必需字段', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'replace_lines_in_section',
                target: {
                    path: ['**US-INFO-001**']
                    // 缺少 targetContent 字段
                },
                content: '替换内容',
                reason: '测试缺少必需字段',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents.length).toBe(1);
        });

        test('应该处理插入操作缺少位置参数', async () => {
            const intents: SemanticEditIntent[] = [{
                type: 'insert_entire_section',
                target: {
                    path: ['用户故事']
                    // 缺少 insertionPosition 字段
                },
                content: '插入内容',
                reason: '测试缺少插入位置',
                priority: 1
            }];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents.length).toBe(1);
        });
    });

    describe('性能和复杂度测试', () => {
        test('应该处理大量编辑操作', async () => {
            const intents: SemanticEditIntent[] = [];
            
            // 创建多个编辑操作
            for (let i = 1; i <= 10; i++) {
                intents.push({
                    type: 'replace_lines_in_section',
                    target: {
                        path: ['**US-ALERT-001**'],
                        targetContent: '城市居民'
                    },
                    content: `城市居民${i}`,
                    reason: `批量测试 ${i}`,
                    priority: i
                });
            }

            const startTime = Date.now();
            const result = await executeSemanticEdits(intents, testFileUri);
            const executionTime = Date.now() - startTime;

            expect(result.success).toBe(true);
            expect(executionTime).toBeLessThan(5000); // 5秒内完成
        });

        test('应该正确处理优先级排序', async () => {
            const intents: SemanticEditIntent[] = [
                {
                    type: 'replace_lines_in_section',
                    target: { path: ['**US-ALERT-001**'], targetContent: '城市居民' },
                    content: '高优先级',
                    reason: '高优先级操作',
                    priority: 10
                },
                {
                    type: 'replace_lines_in_section',
                    target: { path: ['**US-INFO-001**'], targetContent: '城市居民' },
                    content: '低优先级',
                    reason: '低优先级操作',
                    priority: 1
                },
                {
                    type: 'replace_lines_in_section',
                    target: { path: ['**UC-ALERT-001**'], targetContent: '城市居民' },
                    content: '中优先级',
                    reason: '中优先级操作',
                    priority: 5
                }
            ];

            const result = await executeSemanticEdits(intents, testFileUri);

            expect(result.success).toBe(true);
            expect(result.appliedIntents.length).toBe(3);
            
            // 验证执行顺序（高优先级先执行）
            expect(result.appliedIntents[0].priority).toBe(10);
            expect(result.appliedIntents[1].priority).toBe(5);
            expect(result.appliedIntents[2].priority).toBe(1);
        });
    });

    describe('向后兼容性测试', () => {
        test('应该拒绝旧的sectionName格式', async () => {
            const badIntent = {
                type: 'replace_entire_section',
                target: {
                    sectionName: '**US-INFO-001**', // 旧格式
                    startFromAnchor: '**US-INFO-001**' // 旧格式
                },
                content: '替换内容',
                reason: '测试旧格式',
                priority: 1
            } as any;

            const result = await executeSemanticEdits([badIntent], testFileUri);

            expect(result.success).toBe(false);
            expect(result.failedIntents.length).toBe(1);
        });
    });
}); 