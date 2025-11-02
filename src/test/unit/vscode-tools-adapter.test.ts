/**
 * VSCode Tools Adapter Unit Tests
 *
 * 测试 VSCodeToolsAdapter 的核心功能（简化版 - 专注核心场景）
 */

// 🔑 Mock 必须在 import 之前定义
const mockLm = {
    tools: [] as any[],
    invokeTool: jest.fn()
};

class MockLanguageModelTextPart {
    value: string;
    constructor(value: string) {
        this.value = value;
    }
}

const mockCancellationTokenSource = {
    token: { isCancellationRequested: false, onCancellationRequested: jest.fn() },
    cancel: jest.fn(),
    dispose: jest.fn()
};

const mockWorkspaceConfig = {
    get: jest.fn((key: string, defaultValue?: any) => defaultValue)
};

jest.mock('vscode', () => ({
    CancellationTokenSource: jest.fn(() => mockCancellationTokenSource),
    LanguageModelTextPart: MockLanguageModelTextPart,
    get lm() {
        return mockLm;
    },
    window: {
        showWarningMessage: jest.fn().mockResolvedValue(undefined)
    },
    workspace: {
        getConfiguration: jest.fn(() => mockWorkspaceConfig)
    },
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3
    }
}));

jest.mock('../../utils/logger', () => ({
    Logger: {
        getInstance: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            show: jest.fn()
        }))
    }
}));

jest.mock('../../tools', () => ({
    toolRegistry: {
        registerTool: jest.fn(),
        unregisterTool: jest.fn()
    }
}));

// 现在可以安全地 import
import { VSCodeToolsAdapter } from '../../tools/adapters/vscode-tools-adapter';
import { toolRegistry } from '../../tools';

describe('VSCodeToolsAdapter', () => {
    let adapter: VSCodeToolsAdapter;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mockLm state
        mockLm.tools = [];
        mockLm.invokeTool = jest.fn();
        mockCancellationTokenSource.cancel.mockClear();
        mockCancellationTokenSource.dispose.mockClear();
        adapter = new VSCodeToolsAdapter();
    });

    describe('工具注册 - 基本功能', () => {
        it('应该成功注册 MCP 工具', async () => {
            // Arrange - MCP 工具名称必须以 mcp_ 开头
            const mockTool = {
                name: 'mcp_tavily_search',
                description: 'Tavily search tool',
                tags: ['search'],
                inputSchema: {
                    type: 'object',
                    properties: { query: { type: 'string' } },
                    required: ['query']
                }
            };
            mockLm.tools = [mockTool];

            // Act
            await adapter.registerVSCodeTools();

            // Assert
            expect(toolRegistry.registerTool).toHaveBeenCalledTimes(1);
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'vscode_mcp_tavily_search',
                    description: 'Tavily search tool',
                    layer: 'atomic',
                    category: 'vscode'
                }),
                expect.any(Function)
            );
            expect(adapter.getRegisteredToolCount()).toBe(1);
        });

        it('应该跳过非 MCP 工具', async () => {
            // Arrange - 非 MCP 工具（不以 mcp_ 开头）
            mockLm.tools = [
                { name: 'copilot_readFile', description: 'Copilot tool', tags: [], inputSchema: {} },
                { name: 'run_in_terminal', description: 'Terminal tool', tags: [], inputSchema: {} }
            ];

            // Act
            await adapter.registerVSCodeTools();

            // Assert - 应该都被跳过
            expect(toolRegistry.registerTool).not.toHaveBeenCalled();
            expect(adapter.getRegisteredToolCount()).toBe(0);
        });

        it('应该同时处理 MCP 和非 MCP 工具', async () => {
            // Arrange
            mockLm.tools = [
                { name: 'mcp_tavily_search', description: 'MCP tool', tags: [], inputSchema: {} },
                { name: 'copilot_readFile', description: 'Non-MCP tool', tags: [], inputSchema: {} },
                { name: 'mcp_deepwiki_ask', description: 'Another MCP tool', tags: [], inputSchema: {} }
            ];

            // Act
            await adapter.registerVSCodeTools();

            // Assert - 只注册 MCP 工具
            expect(toolRegistry.registerTool).toHaveBeenCalledTimes(2);
            expect(adapter.getRegisteredToolCount()).toBe(2);
        });

        it('应该处理工具名称包含特殊字符', async () => {
            // Arrange
            mockLm.tools = [{
                name: 'mcp_test@server#tool',
                description: 'Test',
                tags: [],
                inputSchema: {}
            }];

            // Act
            await adapter.registerVSCodeTools();

            // Assert
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'vscode_mcp_test_server_tool'
                }),
                expect.any(Function)
            );
        });

        it('应该避免重复注册', async () => {
            // Arrange
            const mockTool = {
                name: 'mcp_tavily_search',
                description: 'Test',
                tags: [],
                inputSchema: {}
            };
            mockLm.tools = [mockTool, mockTool];

            // Act
            await adapter.registerVSCodeTools();

            // Assert
            expect(toolRegistry.registerTool).toHaveBeenCalledTimes(1);
        });
    });

    describe('风险等级推断', () => {
        it('应该根据 tags 推断低风险等级', async () => {
            // Arrange - MCP 工具
            mockLm.tools = [{
                name: 'mcp_tavily_search',
                description: 'Search tool',
                tags: ['search'],
                inputSchema: {}
            }];

            // Act
            await adapter.registerVSCodeTools();

            // Assert
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(
                expect.objectContaining({
                    riskLevel: 'low'
                }),
                expect.any(Function)
            );
        });

        it('应该根据 tags 推断高风险等级', async () => {
            // Arrange - MCP 工具
            mockLm.tools = [{
                name: 'mcp_server_delete',
                description: 'Delete tool',
                tags: ['delete'],
                inputSchema: {}
            }];

            // Act
            await adapter.registerVSCodeTools();

            // Assert
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(
                expect.objectContaining({
                    riskLevel: 'high'
                }),
                expect.any(Function)
            );
        });
    });

    describe('关键字黑名单过滤', () => {
        beforeEach(() => {
            // Reset mockWorkspaceConfig
            mockWorkspaceConfig.get.mockClear();
            mockWorkspaceConfig.get.mockImplementation((key: string, defaultValue?: any) => defaultValue);
        });

        it('应该排除包含关键字的工具', async () => {
            // Arrange - 配置关键字 "java_app_mode"
            mockWorkspaceConfig.get.mockReturnValue(['java_app_mode']);
            mockLm.tools = [
                { name: 'mcp_tavily_search', description: 'Search tool', tags: [], inputSchema: {} },
                { name: 'mcp.java_app_mode.analyze', description: 'Java tool', tags: [], inputSchema: {} }
            ];

            // Act
            await adapter.registerVSCodeTools();

            // Assert - 只注册 tavily_search，排除 java_app_mode
            expect(toolRegistry.registerTool).toHaveBeenCalledTimes(1);
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'vscode_mcp_tavily_search'
                }),
                expect.any(Function)
            );
        });

        it('应该支持不区分大小写的关键字匹配', async () => {
            // Arrange - 配置关键字 "JAVA" (大写)
            mockWorkspaceConfig.get.mockReturnValue(['JAVA']);
            mockLm.tools = [
                { name: 'mcp_java_app_mode_tool', description: 'Java tool', tags: [], inputSchema: {} },
                { name: 'mcp_tavily_search', description: 'Search tool', tags: [], inputSchema: {} }
            ];

            // Act
            await adapter.registerVSCodeTools();

            // Assert - java工具被排除（不区分大小写）
            expect(toolRegistry.registerTool).toHaveBeenCalledTimes(1);
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'vscode_mcp_tavily_search'
                }),
                expect.any(Function)
            );
        });

        it('应该支持多个关键字', async () => {
            // Arrange - 配置多个关键字
            mockWorkspaceConfig.get.mockReturnValue(['java', 'appmod', 'github']);
            mockLm.tools = [
                { name: 'mcp_java_tool', description: 'Java', tags: [], inputSchema: {} },
                { name: 'mcp_appmod_analyze', description: 'AppMod', tags: [], inputSchema: {} },
                { name: 'mcp_github_copilot', description: 'GitHub', tags: [], inputSchema: {} },
                { name: 'mcp_tavily_search', description: 'Search', tags: [], inputSchema: {} }
            ];

            // Act
            await adapter.registerVSCodeTools();

            // Assert - 只注册 tavily_search
            expect(toolRegistry.registerTool).toHaveBeenCalledTimes(1);
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'vscode_mcp_tavily_search'
                }),
                expect.any(Function)
            );
        });

        it('应该忽略空字符串关键字', async () => {
            // Arrange - 包含空字符串和空白字符
            mockWorkspaceConfig.get.mockReturnValue(['', '  ', 'java']);
            mockLm.tools = [
                { name: 'mcp_java_tool', description: 'Java', tags: [], inputSchema: {} },
                { name: 'mcp_tavily_search', description: 'Search', tags: [], inputSchema: {} }
            ];

            // Act
            await adapter.registerVSCodeTools();

            // Assert - 只排除 java，空字符串被忽略
            expect(toolRegistry.registerTool).toHaveBeenCalledTimes(1);
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'vscode_mcp_tavily_search'
                }),
                expect.any(Function)
            );
        });

        it('应该在没有关键字配置时注册所有MCP工具', async () => {
            // Arrange - 空数组或undefined
            mockWorkspaceConfig.get.mockReturnValue([]);
            mockLm.tools = [
                { name: 'mcp_java_tool', description: 'Java', tags: [], inputSchema: {} },
                { name: 'mcp_tavily_search', description: 'Search', tags: [], inputSchema: {} }
            ];

            // Act
            await adapter.registerVSCodeTools();

            // Assert - 所有MCP工具都应该被注册
            expect(toolRegistry.registerTool).toHaveBeenCalledTimes(2);
        });

        it('应该处理关键字前后的空白字符', async () => {
            // Arrange - 关键字有前后空白
            mockWorkspaceConfig.get.mockReturnValue(['  java  ', 'appmod']);
            mockLm.tools = [
                { name: 'mcp_java_tool', description: 'Java', tags: [], inputSchema: {} },
                { name: 'mcp_tavily_search', description: 'Search', tags: [], inputSchema: {} }
            ];

            // Act
            await adapter.registerVSCodeTools();

            // Assert - java工具应该被正确排除（trim后匹配）
            expect(toolRegistry.registerTool).toHaveBeenCalledTimes(1);
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'vscode_mcp_tavily_search'
                }),
                expect.any(Function)
            );
        });

        it('应该支持部分匹配（子串匹配）', async () => {
            // Arrange - 使用部分关键字
            mockWorkspaceConfig.get.mockReturnValue(['app']);
            mockLm.tools = [
                { name: 'mcp_java_app_mode', description: 'Java app', tags: [], inputSchema: {} },
                { name: 'mcp_application_tool', description: 'Application', tags: [], inputSchema: {} },
                { name: 'mcp_tavily_search', description: 'Search', tags: [], inputSchema: {} }
            ];

            // Act
            await adapter.registerVSCodeTools();

            // Assert - 包含 "app" 的工具都被排除
            expect(toolRegistry.registerTool).toHaveBeenCalledTimes(1);
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'vscode_mcp_tavily_search'
                }),
                expect.any(Function)
            );
        });

        it('关键字过滤应该在MCP过滤之后执行', async () => {
            // Arrange - 配置关键字，但包含非MCP工具
            mockWorkspaceConfig.get.mockReturnValue(['read']);
            mockLm.tools = [
                { name: 'copilot_readFile', description: 'Non-MCP read tool', tags: [], inputSchema: {} },
                { name: 'mcp_read_tool', description: 'MCP read tool', tags: [], inputSchema: {} },
                { name: 'mcp_tavily_search', description: 'Search', tags: [], inputSchema: {} }
            ];

            // Act
            await adapter.registerVSCodeTools();

            // Assert - copilot_readFile因为非MCP被跳过，mcp_read_tool因为关键字被排除
            expect(toolRegistry.registerTool).toHaveBeenCalledTimes(1);
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'vscode_mcp_tavily_search'
                }),
                expect.any(Function)
            );
        });
    });

    describe('dispose', () => {
        it('应该注销所有已注册的工具', async () => {
            // Arrange - MCP 工具
            mockLm.tools = [
                { name: 'mcp_tavily_search', description: 'Tool 1', tags: [], inputSchema: {} },
                { name: 'mcp_deepwiki_ask', description: 'Tool 2', tags: [], inputSchema: {} }
            ];
            await adapter.registerVSCodeTools();

            // Act
            adapter.dispose();

            // Assert
            expect(toolRegistry.unregisterTool).toHaveBeenCalledTimes(2);
            expect(adapter.getRegisteredToolCount()).toBe(0);
        });
    });
});
