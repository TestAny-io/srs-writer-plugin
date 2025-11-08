/**
 * 工作区上下文构建器单元测试
 * 测试PromptManager中的新工作区上下文构建逻辑
 */

import * as vscode from 'vscode';
import { PromptManager } from '../../core/orchestrator/PromptManager';
import { SessionContext } from '../../types/session';

// Mock vscode
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [
            {
                uri: {
                    fsPath: '/mock/workspace'
                }
            }
        ],
        fs: {
            readDirectory: jest.fn()
        }
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    },
    FileType: {
        Directory: 2,
        File: 1
    },
    extensions: {
        getExtension: jest.fn().mockReturnValue({
            extensionPath: '/mock/extension/path'
        })
    }
}));

// Mock fs模块
jest.mock('fs', () => ({
    promises: {
        access: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue('mock orchestrator instructions')
    },
    statSync: jest.fn(),      // 🚀 Phase 1.1: Add for BaseDirValidator
    realpathSync: jest.fn()   // 🚀 Phase 1.1: Add for BaseDirValidator
}));

describe('Workspace Context Builder', () => {
    let promptManager: PromptManager;
    let mockSessionContext: SessionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        promptManager = new PromptManager();

        // Mock基础的SessionContext
        mockSessionContext = {
            sessionContextId: 'test-session-123',
            projectName: null,
            baseDir: '/mock/workspace',
            activeFiles: [],
            metadata: {
                srsVersion: 'v1.0',
                created: '2024-01-01T00:00:00.000Z',
                lastModified: '2024-01-01T00:00:00.000Z',
                version: '5.0'
            }
        };

        // Setup mock implementations for BaseDirValidator
        const fs = require('fs');
        (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });
        (fs.realpathSync as jest.Mock).mockImplementation((p: string) => p);
    });

    describe('buildWorkspaceContext', () => {
        it('应该构建正确的工作区上下文 - 无活跃项目', async () => {
            // Arrange - Mock目录读取返回一些项目目录
            const mockDirectories = [
                ['project1', vscode.FileType.Directory],
                ['project2', vscode.FileType.Directory],
                ['.git', vscode.FileType.Directory],      // 应该被排除
                ['node_modules', vscode.FileType.Directory], // 应该被排除
                ['transformed_doc', vscode.FileType.Directory], // 应该被排除
                ['file.txt', vscode.FileType.File],       // 文件不计入
                ['project3', vscode.FileType.Directory]
            ];
            
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            // Act
            const result = await (promptManager as any).buildWorkspaceContext(mockSessionContext);

            // Assert
            expect(result).toContain('Base Directory: /mock/workspace');
            expect(result).toContain('Session ID: test-session-123');
            expect(result).toContain('Exist projects: 3'); // project1, project2, project3
            expect(result).toContain('Current Project: No active project');
        });

        it('应该构建正确的工作区上下文 - 有活跃项目', async () => {
            // Arrange
            mockSessionContext.projectName = 'my-awesome-project';
            mockSessionContext.baseDir = '/mock/workspace/my-awesome-project';
            
            const mockDirectories = [
                ['my-awesome-project', vscode.FileType.Directory],
                ['another-project', vscode.FileType.Directory]
            ];
            
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            // Act
            const result = await (promptManager as any).buildWorkspaceContext(mockSessionContext);

            // Assert
            expect(result).toContain('Base Directory: /mock/workspace/my-awesome-project');
            expect(result).toContain('Session ID: test-session-123');
            expect(result).toContain('Exist projects: 2');
            expect(result).toContain('Current Project: my-awesome-project');
        });

        it('应该处理没有工作区的情况', async () => {
            // Arrange - Mock没有工作区
            const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
            (vscode.workspace as any).workspaceFolders = undefined;

            // Act
            const result = await (promptManager as any).buildWorkspaceContext(mockSessionContext);

            // Assert
            expect(result).toContain('Base Directory: No workspace');
            expect(result).toContain('Exist projects: 0');
            expect(result).toContain('Current Project: No workspace');

            // Restore
            (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
        });

        it('应该处理目录读取错误', async () => {
            // Arrange - Mock目录读取失败
            (vscode.workspace.fs.readDirectory as jest.Mock).mockRejectedValue(new Error('Permission denied'));

            // Act
            const result = await (promptManager as any).buildWorkspaceContext(mockSessionContext);

            // Assert
            expect(result).toContain('Base Directory: /mock/workspace'); // fallback仍然工作
            expect(result).toContain('Exist projects: 0'); // 错误时返回0
        });
    });

    describe('countWorkspaceProjects', () => {
        it('应该正确计算项目数量并排除特定目录', async () => {
            // Arrange
            const mockDirectories = [
                ['valid-project-1', vscode.FileType.Directory],
                ['valid-project-2', vscode.FileType.Directory],
                ['.git', vscode.FileType.Directory],          // 隐藏目录 - 排除
                ['.vscode', vscode.FileType.Directory],       // 隐藏目录 - 排除
                ['.session-log', vscode.FileType.Directory],  // 隐藏目录 - 排除
                ['node_modules', vscode.FileType.Directory],  // 构建目录 - 排除
                ['dist', vscode.FileType.Directory],          // 构建目录 - 排除
                ['build', vscode.FileType.Directory],         // 构建目录 - 排除
                ['coverage', vscode.FileType.Directory],      // 构建目录 - 排除
                ['transformed_doc', vscode.FileType.Directory], // 特定目录 - 排除
                ['some-file.txt', vscode.FileType.File],      // 文件 - 不计入
                ['valid-project-3', vscode.FileType.Directory]
            ];
            
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            // Act
            const count = await (promptManager as any).countWorkspaceProjects('/mock/workspace');

            // Assert
            expect(count).toBe(3); // 只有 valid-project-1, valid-project-2, valid-project-3
        });

        it('应该处理目录读取失败', async () => {
            // Arrange
            (vscode.workspace.fs.readDirectory as jest.Mock).mockRejectedValue(new Error('Access denied'));

            // Act
            const count = await (promptManager as any).countWorkspaceProjects('/mock/workspace');

            // Assert
            expect(count).toBe(0);
        });
    });

    describe('getCurrentProjectName', () => {
        it('应该返回项目名称当有有效项目时', () => {
            // Arrange
            mockSessionContext.projectName = 'my-project';

            // Act
            const result = (promptManager as any).getCurrentProjectName(mockSessionContext);

            // Assert
            expect(result).toBe('my-project');
        });

        it('应该返回"No active project"当项目名为null时', () => {
            // Arrange
            mockSessionContext.projectName = null;

            // Act
            const result = (promptManager as any).getCurrentProjectName(mockSessionContext);

            // Assert
            expect(result).toBe('No active project');
        });
    });

    describe('getBaseDirectory', () => {
        it('应该返回sessionContext的baseDir当有值时', () => {
            // Arrange
            mockSessionContext.baseDir = '/mock/workspace/project';

            // Act
            const result = (promptManager as any).getBaseDirectory(mockSessionContext, '/mock/workspace');

            // Assert
            expect(result).toBe('/mock/workspace/project');
        });

        it('应该回退到工作区根目录当baseDir为null时', () => {
            // Arrange
            mockSessionContext.baseDir = null;

            // Act
            const result = (promptManager as any).getBaseDirectory(mockSessionContext, '/mock/workspace');

            // Assert
            expect(result).toBe('/mock/workspace');
        });
    });

    describe('完整的buildAdaptiveToolPlanningPrompt集成测试', () => {
        it('应该在完整的提示词中包含新的工作区上下文', async () => {
            // Arrange
            mockSessionContext.projectName = 'test-project';
            const mockDirectories = [
                ['test-project', vscode.FileType.Directory],
                ['other-project', vscode.FileType.Directory]
            ];
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '[]'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                'test user input',
                mockSessionContext,
                'test history',
                'test tool results',
                mockGetTools,
      0
            );

            // Assert
            expect(result).toContain('## Workspace Context');
            expect(result).toContain('### Base Status');
            expect(result).toContain('### Project Status');
            expect(result).toContain('Exist projects: 2');
            expect(result).toContain('Current Project: test-project');
            expect(result).not.toContain('Current Project Context'); // 旧标题不应该出现
        });
    });
});
