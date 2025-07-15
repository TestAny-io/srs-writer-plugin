/**
 * 错误增强机制集成测试
 * 验证错误增强在实际使用场景中的效果
 */

// Mock vscode module first
jest.mock('vscode', () => ({
    extensions: {
        getExtension: jest.fn().mockReturnValue({
            extensionPath: '/mock/extension/path'
        })
    },
    Uri: {
        file: jest.fn()
    },
    workspace: {
        textDocuments: []
    }
}));

// Mock file system
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue('# Mock Rules Content'),
    writeFileSync: jest.fn(),
    readdirSync: jest.fn().mockReturnValue(['test.md'])
}));

// Mock path
jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/'))
}));

// Mock logger
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};
jest.mock('../../utils/logger', () => ({
    Logger: {
        getInstance: () => mockLogger
    }
}));

describe('Error Enhancement Integration Test', () => {
    test('应该在实际工具调用失败时应用错误增强', async () => {
        // 动态导入以避免依赖问题
        const { SpecialistExecutor } = await import('../../core/specialistExecutor');
        
        // Mock工具注册表
        const mockToolRegistry = {
            executeTool: jest.fn().mockRejectedValue(
                new Error('Tool implementation not found: invalidTool')
            )
        };

        // 替换工具注册表
        const toolsModule = await import('../../tools/index');
        (toolsModule as any).toolRegistry = mockToolRegistry;

        const executor = new SpecialistExecutor();
        
        // 通过反射访问私有方法
        const executeToolCalls = (executor as any).executeToolCalls;
        
        const results = await executeToolCalls([
            { name: 'invalidTool', args: { test: 'value' } }
        ]);

        // 验证结果
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(false);
        expect(results[0].toolName).toBe('invalidTool');
        
        // 验证错误增强效果
        expect(results[0].error).toContain('CRITICAL ERROR');
        expect(results[0].error).toContain('does not exist in the system');
        expect(results[0].error).toContain('Stop retrying this tool immediately');
        expect(results[0].error).toContain('Review your available tool list');
        
        // 验证日志记录了错误增强
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringMatching(/错误增强.*Tool implementation not found.*CRITICAL ERROR/)
        );
    });

    test('应该在文件错误时提供正确的指导', async () => {
        const { SpecialistExecutor } = await import('../../core/specialistExecutor');
        
        const mockToolRegistry = {
            executeTool: jest.fn().mockRejectedValue(
                new Error('无法读取文件 /invalid/path.txt: ENOENT: no such file or directory')
            )
        };

        const toolsModule = await import('../../tools/index');
        (toolsModule as any).toolRegistry = mockToolRegistry;

        const executor = new SpecialistExecutor();
        const executeToolCalls = (executor as any).executeToolCalls;
        
        const results = await executeToolCalls([
            { name: 'readFile', args: { path: '/invalid/path.txt' } }
        ]);

        expect(results[0].success).toBe(false);
        expect(results[0].error).toContain('FILE ERROR');
        expect(results[0].error).toContain('path does not exist');
        expect(results[0].error).toContain('Verify the file path is correct');
        expect(results[0].error).toContain('Do NOT retry with the same invalid path');
    });

    test('应该在权限错误时提供正确的指导', async () => {
        const { SpecialistExecutor } = await import('../../core/specialistExecutor');
        
        const mockToolRegistry = {
            executeTool: jest.fn().mockRejectedValue(
                new Error('Permission denied: access to /protected/file.txt restricted')
            )
        };

        const toolsModule = await import('../../tools/index');
        (toolsModule as any).toolRegistry = mockToolRegistry;

        const executor = new SpecialistExecutor();
        const executeToolCalls = (executor as any).executeToolCalls;
        
        const results = await executeToolCalls([
            { name: 'writeFile', args: { path: '/protected/file.txt', content: 'test' } }
        ]);

        expect(results[0].success).toBe(false);
        expect(results[0].error).toContain('PERMISSION ERROR');
        expect(results[0].error).toContain('system configuration issue');
        expect(results[0].error).toContain('retrying won\'t fix');
        expect(results[0].error).toContain('Inform the user about the permission issue');
    });

    test('应该正确处理成功的工具调用（不触发错误增强）', async () => {
        const { SpecialistExecutor } = await import('../../core/specialistExecutor');
        
        const mockToolRegistry = {
            executeTool: jest.fn().mockResolvedValue({ result: 'success', data: 'test data' })
        };

        const toolsModule = await import('../../tools/index');
        (toolsModule as any).toolRegistry = mockToolRegistry;

        const executor = new SpecialistExecutor();
        const executeToolCalls = (executor as any).executeToolCalls;
        
        const results = await executeToolCalls([
            { name: 'validTool', args: { param: 'value' } }
        ]);

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
        expect(results[0].toolName).toBe('validTool');
        expect(results[0].result).toEqual({ result: 'success', data: 'test data' });
        expect(results[0].error).toBeUndefined();
        
        // 验证没有错误增强相关的日志
        expect(mockLogger.info).not.toHaveBeenCalledWith(
            expect.stringMatching(/错误增强/)
        );
    });

    test('应该在参数错误时允许重试', async () => {
        const { SpecialistExecutor } = await import('../../core/specialistExecutor');
        
        const mockToolRegistry = {
            executeTool: jest.fn().mockRejectedValue(
                new Error('Missing required parameter: fileName')
            )
        };

        const toolsModule = await import('../../tools/index');
        (toolsModule as any).toolRegistry = mockToolRegistry;

        const executor = new SpecialistExecutor();
        const executeToolCalls = (executor as any).executeToolCalls;
        
        const results = await executeToolCalls([
            { name: 'testTool', args: { incomplete: 'params' } }
        ]);

        expect(results[0].success).toBe(false);
        expect(results[0].error).toContain('PARAMETER ERROR');
        expect(results[0].error).toContain('format issue, NOT a system failure');
        expect(results[0].error).toContain('Retry with properly formatted parameters');
        
        // 参数错误应该允许重试，所以不应该有"Do NOT retry"字样
        expect(results[0].error).not.toMatch(/Do NOT retry/i);
    });

    test('应该处理多个工具调用的混合情况', async () => {
        const { SpecialistExecutor } = await import('../../core/specialistExecutor');
        
        const mockToolRegistry = {
            executeTool: jest.fn()
                .mockResolvedValueOnce({ result: 'first success' })
                .mockRejectedValueOnce(new Error('Tool implementation not found: badTool'))
                .mockResolvedValueOnce({ result: 'third success' })
        };

        const toolsModule = await import('../../tools/index');
        (toolsModule as any).toolRegistry = mockToolRegistry;

        const executor = new SpecialistExecutor();
        const executeToolCalls = (executor as any).executeToolCalls;
        
        const results = await executeToolCalls([
            { name: 'goodTool1', args: { test: 'value1' } },
            { name: 'badTool', args: { test: 'value2' } },
            { name: 'goodTool2', args: { test: 'value3' } }
        ]);

        expect(results).toHaveLength(3);
        
        // 第一个工具调用成功
        expect(results[0].success).toBe(true);
        expect(results[0].result).toEqual({ result: 'first success' });
        
        // 第二个工具调用失败，应用错误增强
        expect(results[1].success).toBe(false);
        expect(results[1].error).toContain('CRITICAL ERROR');
        expect(results[1].error).toContain('Stop retrying this tool immediately');
        
        // 第三个工具调用成功
        expect(results[2].success).toBe(true);
        expect(results[2].result).toEqual({ result: 'third success' });
    });
}); 