/**
 * 工作区上下文集成测试
 * 测试在真实环境中的工作区上下文构建完整流程
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PromptManager } from '../../core/orchestrator/PromptManager';
import { SessionManager } from '../../core/session-manager';
import { SessionContext } from '../../types/session';

// Mock基础模块
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [],
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
    window: {
        showErrorMessage: jest.fn()
    },
    extensions: {
        getExtension: jest.fn().mockReturnValue({
            extensionPath: '/mock/extension/path'
        })
    }
}));

jest.mock('crypto', () => ({
    randomUUID: () => 'test-session-uuid'
}));

jest.mock('../../tools/atomic/git-operations', () => ({
    getCurrentBranch: jest.fn().mockResolvedValue('main')
}));

jest.mock('fs', () => ({
    promises: {
        access: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue('mock orchestrator instructions'),
        writeFile: jest.fn().mockResolvedValue(undefined),
        mkdir: jest.fn().mockResolvedValue(undefined),
        mkdtemp: jest.fn().mockResolvedValue('/mock/temp/dir'),
        rm: jest.fn().mockResolvedValue(undefined)
    },
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn()
}));

describe('Workspace Context Integration Tests', () => {
    let tempDir: string;
    let testWorkspaceDir: string;
    let promptManager: PromptManager;
    let sessionContext: SessionContext;

    beforeAll(async () => {
        // 创建临时测试目录
        tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'workspace-context-test-'));
        testWorkspaceDir = path.join(tempDir, 'test-workspace');
        await fs.promises.mkdir(testWorkspaceDir, { recursive: true });
    });

    afterAll(async () => {
        try {
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.warn('清理测试目录失败:', error);
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        promptManager = new PromptManager();
        
        // Mock工作区
        (vscode.workspace as any).workspaceFolders = [
            {
                uri: {
                    fsPath: testWorkspaceDir
                }
            }
        ];

        sessionContext = {
            sessionContextId: 'integration-test-session',
            projectName: null,
            baseDir: testWorkspaceDir,
            activeFiles: [],
            metadata: {
                srsVersion: 'v1.0',
                created: '2024-01-01T00:00:00.000Z',
                lastModified: '2024-01-01T00:00:00.000Z',
                version: '5.0'
            }
        };
    });

    describe('真实场景模拟', () => {
        it('场景1：空工作区', async () => {
            // Arrange - 模拟空工作区
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue([]);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '[]'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                'Hello, I need help with my project',
                sessionContext,
                '',
                '',
                mockGetTools
            );

            // Assert
            expect(result).toContain('## Workspace Context');
            expect(result).toContain('Exist projects: 0');
            expect(result).toContain('Current Project: No active project');
            expect(result).toContain(`Base Directory: ${testWorkspaceDir}`);
        });

        it('场景2：有多个项目的工作区，无活跃项目', async () => {
            // Arrange - 模拟多项目工作区
            const mockDirectories = [
                ['frontend-app', vscode.FileType.Directory],
                ['backend-api', vscode.FileType.Directory],
                ['mobile-app', vscode.FileType.Directory],
                ['.git', vscode.FileType.Directory],          // 应该被排除
                ['node_modules', vscode.FileType.Directory],  // 应该被排除
                ['dist', vscode.FileType.Directory],          // 应该被排除
                ['README.md', vscode.FileType.File]           // 文件不计入
            ];
            
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '[]'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                'Show me all available projects',
                sessionContext,
                '',
                '',
                mockGetTools
            );

            // Assert
            expect(result).toContain('Exist projects: 3'); // frontend-app, backend-api, mobile-app
            expect(result).toContain('Current Project: No active project');
        });

        it('场景3：有活跃项目的工作区', async () => {
            // Arrange - 模拟有活跃项目
            sessionContext.projectName = 'frontend-app';
            sessionContext.baseDir = path.join(testWorkspaceDir, 'frontend-app');

            const mockDirectories = [
                ['frontend-app', vscode.FileType.Directory],
                ['backend-api', vscode.FileType.Directory],
                ['.git', vscode.FileType.Directory]
            ];
            
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '[]'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                'Help me with my frontend project',
                sessionContext,
                '',
                '',
                mockGetTools
            );

            // Assert
            expect(result).toContain('Exist projects: 2');
            expect(result).toContain('Current Project: frontend-app');
            expect(result).toContain(`Base Directory: ${path.join(testWorkspaceDir, 'frontend-app')}`);
        });

        it('场景4：工作区读取权限错误', async () => {
            // Arrange - 模拟权限错误
            (vscode.workspace.fs.readDirectory as jest.Mock).mockRejectedValue(new Error('EACCES: permission denied'));

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '[]'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                'I need help',
                sessionContext,
                '',
                '',
                mockGetTools
            );

            // Assert
            expect(result).toContain('## Workspace Context');
            expect(result).toContain('Exist projects: 0'); // 错误时返回0
            expect(result).toContain('Current Project: No active project');
        });

        it('场景5：复杂目录结构，多种排除规则', async () => {
            // Arrange - 模拟复杂的目录结构
            const mockDirectories = [
                // 有效项目
                ['main-project', vscode.FileType.Directory],
                ['utils-lib', vscode.FileType.Directory],
                ['docs-site', vscode.FileType.Directory],
                
                // 应该排除的隐藏目录
                ['.git', vscode.FileType.Directory],
                ['.vscode', vscode.FileType.Directory],
                ['.session-log', vscode.FileType.Directory],
                ['.env', vscode.FileType.File], // 文件会被忽略，即使是隐藏的
                
                // 应该排除的构建目录
                ['node_modules', vscode.FileType.Directory],
                ['dist', vscode.FileType.Directory],
                ['build', vscode.FileType.Directory],
                ['coverage', vscode.FileType.Directory],
                ['out', vscode.FileType.Directory],
                
                // 应该排除的特定目录
                ['transformed_doc', vscode.FileType.Directory],
                
                // 文件（不计入项目）
                ['package.json', vscode.FileType.File],
                ['README.md', vscode.FileType.File],
                ['LICENSE', vscode.FileType.File]
            ];
            
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '[]'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                'Analyze my workspace structure',
                sessionContext,
                '',
                '',
                mockGetTools
            );

            // Assert
            expect(result).toContain('Exist projects: 3'); // 只有 main-project, utils-lib, docs-site
        });
    });

    describe('与SessionManager集成', () => {
        it('应该与SessionManager的baseDir修复协同工作', async () => {
            // Arrange - 模拟没有项目名但有baseDir的情况
            sessionContext.projectName = null;
            sessionContext.baseDir = testWorkspaceDir; // 基于我们之前的修复，这应该总是有值

            const mockDirectories = [
                ['project1', vscode.FileType.Directory]
            ];
            
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '[]'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                'What projects do I have?',
                sessionContext,
                '',
                '',
                mockGetTools
            );

            // Assert
            expect(result).toContain('Current Project: No active project');
            expect(result).toContain(`Base Directory: ${testWorkspaceDir}`); // 不应该显示 "Not set"
            expect(result).toContain('Exist projects: 1');
        });
    });

    describe('提示词格式验证', () => {
        it('应该生成正确格式的markdown结构', async () => {
            // Arrange
            const mockDirectories = [
                ['test-project', vscode.FileType.Directory]
            ];
            
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '[]'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                'Test prompt',
                sessionContext,
                'Test history',
                'Test tool results',
                mockGetTools
            );

            // Assert - 验证markdown结构
            expect(result).toMatch(/# SYSTEM INSTRUCTIONS/);
            expect(result).toMatch(/# USER REQUEST/);
            expect(result).toMatch(/# CONTEXT INFORMATION/);
            expect(result).toMatch(/## Workspace Context/);
            expect(result).toMatch(/### Base Status/);
            expect(result).toMatch(/### Project Status/);
            expect(result).toMatch(/## Conversation History/);
            expect(result).toMatch(/## Tool Results Context/);
            expect(result).toMatch(/# Your available tools/);
            expect(result).toMatch(/# FINAL INSTRUCTION/);
        });

        it('应该保持与其他部分的集成', async () => {
            // Arrange
            const mockDirectories = [
                ['test-project', vscode.FileType.Directory]
            ];
            
            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [{ name: 'testTool' }],
                jsonSchema: '{"testTool": {"description": "A test tool"}}'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                'Help me with testing',
                sessionContext,
                'Previous conversation about testing',
                'Tool executed successfully',
                mockGetTools
            );

            // Assert - 验证所有部分都存在
            expect(result).toContain('Help me with testing'); // User request
            expect(result).toContain('Previous conversation about testing'); // History
            expect(result).toContain('Tool executed successfully'); // Tool results
            expect(result).toContain('{"testTool": {"description": "A test tool"}}'); // Tools schema
            expect(result).toContain('Workspace Context'); // 新的工作区上下文
        });
    });
});
