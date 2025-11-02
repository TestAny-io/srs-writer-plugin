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

jest.mock('vscode', () => ({
    CancellationTokenSource: jest.fn(() => mockCancellationTokenSource),
    LanguageModelTextPart: MockLanguageModelTextPart,
    get lm() {
        return mockLm;
    },
    window: {
        showWarningMessage: jest.fn().mockResolvedValue(undefined)
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
