/**
 * 工作区上下文功能测试
 * 验证新的Workspace Context在真实场景中的表现
 */

import * as vscode from 'vscode';
import { PromptManager } from '../../core/orchestrator/PromptManager';
import { SessionContext } from '../../types/session';

// Mock vscode (简化版本，专注于功能验证)
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [
            {
                uri: {
                    fsPath: '/test/workspace'
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

jest.mock('fs', () => ({
    promises: {
        access: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue('mock orchestrator template')
    }
}));

describe('Workspace Context Functional Verification', () => {
    let promptManager: PromptManager;

    beforeEach(() => {
        jest.clearAllMocks();
        promptManager = new PromptManager();
    });

    describe('关键功能验证', () => {
        it('功能验证：新的Workspace Context格式应该在提示词中正确出现', async () => {
            // Arrange - 设置测试场景：有2个项目，其中一个是活跃的
            const sessionContext: SessionContext = {
                sessionContextId: 'func-test-123',
                projectName: 'my-active-project',
                baseDir: '/test/workspace/my-active-project',
                activeFiles: [],
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T00:00:00.000Z',
                    lastModified: '2024-01-01T00:00:00.000Z',
                    version: '5.0'
                }
            };

            const mockDirectories = [
                ['my-active-project', vscode.FileType.Directory],
                ['another-project', vscode.FileType.Directory],
                ['.git', vscode.FileType.Directory],  // 应该被排除
                ['node_modules', vscode.FileType.Directory] // 应该被排除
            ];

            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '{"tools": []}'
            });

            // Act - 生成提示词
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                '请帮我分析当前项目的状态',
                sessionContext,
                '',
                '',
                mockGetTools,
      0
            );

            // Assert - 验证新格式存在且正确
            console.log('\n=== 功能验证输出 ===');
            const contextSection = result.match(/## Workspace Context[\s\S]*?##/);
            if (contextSection) {
                console.log('新的Workspace Context格式：');
                console.log(contextSection[0]);
            }

            // 验证新格式
            expect(result).toMatch(/## Workspace Context/);
            expect(result).toMatch(/### Base Status/);
            expect(result).toMatch(/### Project Status/);
            expect(result).toContain('Exist projects: 2');
            expect(result).toContain('Current Project: my-active-project');
            expect(result).toContain('Base Directory: /test/workspace/my-active-project');
            expect(result).toContain('Session ID: func-test-123');

            // 验证旧格式不存在
            expect(result).not.toMatch(/## Current Project Context/);
            expect(result).not.toContain('Project Name:');
            expect(result).not.toContain('Active Files:');
            expect(result).not.toContain('SRS Version:');
            expect(result).not.toContain('Last Modified:');
        });

        it('功能验证：无活跃项目时应该显示正确的状态', async () => {
            // Arrange - 无活跃项目的场景
            const sessionContext: SessionContext = {
                sessionContextId: 'func-test-456',
                projectName: null,  // 无活跃项目
                baseDir: '/test/workspace',
                activeFiles: [],
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T00:00:00.000Z',
                    lastModified: '2024-01-01T00:00:00.000Z',
                    version: '5.0'
                }
            };

            const mockDirectories = [
                ['project-1', vscode.FileType.Directory],
                ['project-2', vscode.FileType.Directory],
                ['project-3', vscode.FileType.Directory]
            ];

            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '{"tools": []}'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                '工作区里有什么项目？',
                sessionContext,
                '',
                '',
                mockGetTools,
      0
            );

            // Assert
            console.log('\n=== 无活跃项目场景验证 ===');
            const contextSection = result.match(/## Workspace Context[\s\S]*?##/);
            if (contextSection) {
                console.log(contextSection[0]);
            }

            expect(result).toContain('Exist projects: 3');
            expect(result).toContain('Current Project: No active project');
            expect(result).toContain('Base Directory: /test/workspace');
        });

        it('功能验证：排除规则应该正确工作', async () => {
            // Arrange - 测试排除规则
            const sessionContext: SessionContext = {
                sessionContextId: 'func-test-789',
                projectName: null,
                baseDir: '/test/workspace',
                activeFiles: [],
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T00:00:00.000Z',
                    lastModified: '2024-01-01T00:00:00.000Z',
                    version: '5.0'
                }
            };

            // 混合目录：包含应该计算的和应该排除的
            const mockDirectories = [
                ['valid-project-1', vscode.FileType.Directory],    // ✅ 应该计算
                ['valid-project-2', vscode.FileType.Directory],    // ✅ 应该计算  
                ['.git', vscode.FileType.Directory],               // ❌ 隐藏目录，排除
                ['.vscode', vscode.FileType.Directory],            // ❌ 隐藏目录，排除
                ['node_modules', vscode.FileType.Directory],       // ❌ 构建目录，排除
                ['dist', vscode.FileType.Directory],               // ❌ 构建目录，排除
                ['transformed_doc', vscode.FileType.Directory],    // ❌ 特定目录，排除
                ['README.md', vscode.FileType.File],               // ❌ 文件，不计算
            ];

            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockDirectories);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '{"tools": []}'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                '分析工作区结构',
                sessionContext,
                '',
                '',
                mockGetTools,
      0
            );

            // Assert
            console.log('\n=== 排除规则验证 ===');
            const contextSection = result.match(/## Workspace Context[\s\S]*?##/);
            if (contextSection) {
                console.log(contextSection[0]);
            }

            // 只应该计算valid-project-1和valid-project-2
            expect(result).toContain('Exist projects: 2');
        });
    });

    describe('兼容性验证', () => {
        it('应该保持提示词的完整结构', async () => {
            // Arrange
            const sessionContext: SessionContext = {
                sessionContextId: 'compat-test',
                projectName: 'test-project',
                baseDir: '/test/workspace/test-project',
                activeFiles: [],
                metadata: {
                    srsVersion: 'v1.0',
                    created: '2024-01-01T00:00:00.000Z',
                    lastModified: '2024-01-01T00:00:00.000Z',
                    version: '5.0'
                }
            };

            (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue([
                ['test-project', vscode.FileType.Directory]
            ]);

            const mockGetTools = jest.fn().mockResolvedValue({
                definitions: [],
                jsonSchema: '{"readFile": {"description": "Read a file"}}'
            });

            // Act
            const result = await promptManager.buildAdaptiveToolPlanningPrompt(
                'Test user request',
                sessionContext,
                'Test conversation history',
                'Test tool results',
                mockGetTools,
      0
            );

            // Assert - 验证完整的提示词结构
            expect(result).toMatch(/# SYSTEM INSTRUCTIONS/);
            expect(result).toMatch(/# USER REQUEST/);
            expect(result).toMatch(/# CONTEXT INFORMATION/);
            expect(result).toMatch(/## Workspace Context/); // 新格式
            expect(result).toMatch(/## Conversation History/);
            expect(result).toMatch(/## Tool Results Context/);
            expect(result).toMatch(/# Your available tools/);
            expect(result).toMatch(/# FINAL INSTRUCTION/);

            // 验证内容完整性
            expect(result).toContain('Test user request');
            expect(result).toContain('Test conversation history');
            expect(result).toContain('Test tool results');
            expect(result).toContain('"readFile": {"description": "Read a file"}');
        });
    });
});
