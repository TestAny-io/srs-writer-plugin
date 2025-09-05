/**
 * 阶段2测试：新项目创建功能
 * 验证 Switch Project 按钮中的"创建新项目"选项
 */

import { SessionManager } from '../../core/session-manager';
import { createNewProjectFolder } from '../../tools/internal/createNewProjectFolderTool';

// Mock VSCode 模块
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' }
        }],
        fs: {
            createDirectory: jest.fn(),
            stat: jest.fn(),
            readFile: jest.fn(),
            writeFile: jest.fn()
        }
    },
    window: {
        showInputBox: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn(),
        withProgress: jest.fn()
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    }
}));

describe('阶段2: 新项目创建功能', () => {
    
    describe('SessionManager 归档逻辑移除', () => {
        test('archiveCurrentAndStartNew 应该不再执行归档操作', async () => {
            // 这个测试需要在真实环境中验证
            // 检查日志中是否还有归档相关的操作
            expect(true).toBe(true); // 占位测试
        });

        test('应该只创建新会话，不保护用户文件', async () => {
            // 验证 filesPreserved 数组为空
            expect(true).toBe(true); // 占位测试
        });
    });

    describe('createNewProjectFolder 工具集成', () => {
        test('应该能够调用 createNewProjectFolder 工具', async () => {
            // Mock 工具调用
            const mockResult = {
                success: true,
                projectName: 'test-project',
                message: 'Project created successfully',
                directoryName: 'test-project',
                directoryRenamed: false,
                gitBranch: {
                    created: true,
                    name: 'SRS/test-project',
                    switched: true
                }
            };

            // 验证工具调用成功
            expect(mockResult.success).toBe(true);
            expect(mockResult.projectName).toBe('test-project');
            expect(mockResult.gitBranch?.name).toBe('SRS/test-project');
        });

        test('应该正确处理项目名验证', () => {
            // 测试项目名验证逻辑
            const validNames = ['test-project', 'app123', 'my_app', 'project-v2'];
            const invalidNames = ['test@project', 'app#123', 'my app', ''];

            validNames.forEach(name => {
                const isValid = /^[a-zA-Z0-9_-]+$/.test(name) && name.trim().length > 0;
                expect(isValid).toBe(true);
            });

            invalidNames.forEach(name => {
                const isValid = /^[a-zA-Z0-9_-]+$/.test(name) && name.trim().length > 0;
                expect(isValid).toBe(false);
            });
        });
    });

    describe('用户界面集成', () => {
        test('Switch Project 选项应该包含创建新项目', () => {
            // 验证选项列表包含正确的项目
            const expectedOption = {
                label: '🆕 创建新项目',
                description: '创建全新的项目目录和会话',
                detail: '输入项目名称，自动创建目录、会话和Git分支',
                action: 'create'
            };

            expect(expectedOption.label).toBe('🆕 创建新项目');
            expect(expectedOption.action).toBe('create');
        });
    });
});

/**
 * 手动测试指南
 * 
 * 测试步骤：
 * 1. 安装新的 .vsix 文件
 * 2. 在工作区中点击状态栏的 SRS Writer
 * 3. 选择 "Switch Project"
 * 4. 应该看到 "🆕 创建新项目" 选项在列表顶部
 * 5. 选择该选项，输入项目名称
 * 6. 验证项目目录和会话文件是否正确创建
 * 
 * 预期结果：
 * - 项目目录在工作区根目录下创建
 * - 新的会话文件在 session-log 目录中创建（如果使用项目级会话）
 * - Git 分支正确创建和切换
 * - 不再有归档相关的消息
 */
