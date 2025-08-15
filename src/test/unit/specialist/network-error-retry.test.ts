import * as vscode from 'vscode';
import { SpecialistExecutor } from '../../../core/specialistExecutor';
import { Logger } from '../../../utils/logger';

// Mock vscode module
jest.mock('vscode', () => ({
    LanguageModelError: class MockLanguageModelError extends Error {
        public code: string;
        
        constructor(message: string, code?: string) {
            super(message);
            this.name = 'LanguageModelError';
            this.code = code || 'unknown';
        }
    },
    LanguageModelChatMessage: {
        User: jest.fn((content: string) => ({ content, role: 'user' }))
    },
    extensions: {
        getExtension: jest.fn()
    },
    workspace: {
        workspaceFolders: [],
        getConfiguration: jest.fn(() => ({
            get: jest.fn(() => ({}))
        })),
        fs: {
            readFile: jest.fn()
        }
    },
    Uri: {
        joinPath: jest.fn()
    }
}));

// Mock other dependencies
jest.mock('../../../utils/logger', () => ({
    Logger: {
        getInstance: jest.fn(() => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        }))
    }
}));

jest.mock('../../../core/specialistRegistry', () => ({
    getSpecialistRegistry: jest.fn(() => ({
        getSpecialist: jest.fn(),
        scanAndRegister: jest.fn()
    }))
}));

jest.mock('../../../core/prompts/PromptAssemblyEngine', () => ({
    PromptAssemblyEngine: jest.fn(() => ({
        assembleSpecialistPrompt: jest.fn()
    }))
}));

jest.mock('../../../core/orchestrator/ToolAccessController');
jest.mock('../../../core/orchestrator/ToolCacheManager', () => ({
    ToolCacheManager: jest.fn(() => ({
        getTools: jest.fn(),
        getToolsForPrompt: jest.fn()
    }))
}));

jest.mock('../../../core/toolExecutor');
jest.mock('../../../core/config/SpecialistIterationManager');
jest.mock('../../../core/history/TokenAwareHistoryManager');
jest.mock('../../../core/generated/specialist-template-mappings');

describe('SpecialistExecutor Network Error Retry', () => {
    let specialistExecutor: SpecialistExecutor;
    let mockModel: any;
    let loggerSpy: jest.SpyInstance;
    
    beforeEach(() => {
        jest.clearAllMocks();
        specialistExecutor = new SpecialistExecutor();
        
        // Mock model
        mockModel = {
            sendRequest: jest.fn()
        };
        
        // Spy on logger
        loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        jest.spyOn(Logger.prototype, 'error').mockImplementation();
        jest.spyOn(Logger.prototype, 'info').mockImplementation();
    });

    describe('网络错误重试机制', () => {
        it('应该对 net::ERR_NETWORK_CHANGED 错误重试 3 次', async () => {
            const networkError = new (vscode as any).LanguageModelError(
                'Please check your firewall rules and network connection then try again. Error Code: net::ERR_NETWORK_CHANGED.'
            );
            
            // Mock response with async iterator
            const mockResponse = { 
                text: {
                    [Symbol.asyncIterator]: async function* () {
                        yield '{"tool_calls": []}';
                    }
                }
            };
            
            // 前3次调用失败，第4次成功
            mockModel.sendRequest
                .mockRejectedValueOnce(networkError)
                .mockRejectedValueOnce(networkError)
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce(mockResponse);

            // 使用反射访问私有方法进行测试
            const sendRequestAndProcessResponseWithRetry = (specialistExecutor as any).sendRequestAndProcessResponseWithRetry.bind(specialistExecutor);
            
            const messages = [{ content: 'test', role: 'user' }];
            const requestOptions = { justification: 'test' };
            
            const result = await sendRequestAndProcessResponseWithRetry(mockModel, messages, requestOptions, 'test_specialist', 1);
            
            // 验证重试了3次后成功
            expect(mockModel.sendRequest).toHaveBeenCalledTimes(4);
            expect(result).toBe('{"tool_calls": []}');
            
            // 验证日志记录了重试
            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('网络错误 (network), 重试 1/3')
            );
            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('网络错误 (network), 重试 2/3')
            );
            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('网络错误 (network), 重试 3/3')
            );
        });

        it('应该对服务器错误重试 1 次', async () => {
            const serverError = new (vscode as any).LanguageModelError(
                'Internal server error',
                '500'
            );
            
            // 第1次失败，第2次成功
            mockModel.sendRequest
                .mockRejectedValueOnce(serverError)
                .mockResolvedValueOnce({ text: ['{"tool_calls": []}'] });

            const sendRequestWithRetry = (specialistExecutor as any).sendRequestWithRetry.bind(specialistExecutor);
            
            const messages = [{ content: 'test', role: 'user' }];
            const requestOptions = { justification: 'test' };
            
            const result = await sendRequestWithRetry(mockModel, messages, requestOptions, 'test_specialist', 1);
            
            // 验证重试了1次后成功
            expect(mockModel.sendRequest).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ text: ['{"tool_calls": []}'] });
            
            // 验证日志记录了重试
            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringContaining('网络错误 (server), 重试 1/1')
            );
        });

        it('应该对认证错误不重试', async () => {
            const authError = new (vscode as any).LanguageModelError(
                'Unauthorized',
                '401'
            );
            
            mockModel.sendRequest.mockRejectedValue(authError);

            const sendRequestWithRetry = (specialistExecutor as any).sendRequestWithRetry.bind(specialistExecutor);
            
            const messages = [{ content: 'test', role: 'user' }];
            const requestOptions = { justification: 'test' };
            
            await expect(
                sendRequestWithRetry(mockModel, messages, requestOptions, 'test_specialist', 1)
            ).rejects.toThrow('AI模型认证失败，请检查GitHub Copilot配置');
            
            // 验证只调用了1次，没有重试
            expect(mockModel.sendRequest).toHaveBeenCalledTimes(1);
            
            // 验证没有重试日志
            expect(loggerSpy).not.toHaveBeenCalledWith(
                expect.stringContaining('重试')
            );
        });

        it('应该对速率限制错误不重试', async () => {
            const rateLimitError = new (vscode as any).LanguageModelError(
                'Too many requests',
                '429'
            );
            
            mockModel.sendRequest.mockRejectedValue(rateLimitError);

            const sendRequestWithRetry = (specialistExecutor as any).sendRequestWithRetry.bind(specialistExecutor);
            
            const messages = [{ content: 'test', role: 'user' }];
            const requestOptions = { justification: 'test' };
            
            await expect(
                sendRequestWithRetry(mockModel, messages, requestOptions, 'test_specialist', 1)
            ).rejects.toThrow('请求频率过高，请稍后重试');
            
            // 验证只调用了1次，没有重试
            expect(mockModel.sendRequest).toHaveBeenCalledTimes(1);
        });

        it('应该在重试次数耗尽后抛出增强的错误信息', async () => {
            const networkError = new (vscode as any).LanguageModelError(
                'net::ERR_NETWORK_CHANGED'
            );
            
            // 所有4次调用都失败（3次重试 + 1次初始调用）
            mockModel.sendRequest.mockRejectedValue(networkError);

            const sendRequestWithRetry = (specialistExecutor as any).sendRequestWithRetry.bind(specialistExecutor);
            
            const messages = [{ content: 'test', role: 'user' }];
            const requestOptions = { justification: 'test' };
            
            await expect(
                sendRequestWithRetry(mockModel, messages, requestOptions, 'test_specialist', 1)
            ).rejects.toThrow('网络连接问题，正在重试 (重试3次后仍失败: net::ERR_NETWORK_CHANGED)');
            
            // 验证调用了4次（1次初始 + 3次重试）
            expect(mockModel.sendRequest).toHaveBeenCalledTimes(4);
        });
    });

    describe('错误分类', () => {
        it('应该正确分类网络错误', () => {
            const classifyNetworkError = (specialistExecutor as any).classifyNetworkError.bind(specialistExecutor);
            
            // 测试网络连接变化错误
            const networkChangedError = new (vscode as any).LanguageModelError(
                'net::ERR_NETWORK_CHANGED'
            );
            const classification = classifyNetworkError(networkChangedError);
            
            expect(classification).toEqual({
                retryable: true,
                maxRetries: 3,
                errorCategory: 'network',
                userMessage: '网络连接问题，正在重试'
            });
        });

        it('应该正确分类服务器错误', () => {
            const classifyNetworkError = (specialistExecutor as any).classifyNetworkError.bind(specialistExecutor);
            
            const serverError = new (vscode as any).LanguageModelError(
                'Internal server error',
                '500'
            );
            const classification = classifyNetworkError(serverError);
            
            expect(classification).toEqual({
                retryable: true,
                maxRetries: 1,
                errorCategory: 'server',
                userMessage: '服务器临时错误，正在重试'
            });
        });

        it('应该正确分类不可重试的错误', () => {
            const classifyNetworkError = (specialistExecutor as any).classifyNetworkError.bind(specialistExecutor);
            
            const authError = new (vscode as any).LanguageModelError(
                'Unauthorized',
                '401'
            );
            const classification = classifyNetworkError(authError);
            
            expect(classification).toEqual({
                retryable: false,
                maxRetries: 0,
                errorCategory: 'auth',
                userMessage: 'AI模型认证失败，请检查GitHub Copilot配置'
            });
        });
    });

    describe('退避延迟计算', () => {
        it('应该计算正确的指数退避延迟', () => {
            const calculateBackoffDelay = (specialistExecutor as any).calculateBackoffDelay.bind(specialistExecutor);
            
            expect(calculateBackoffDelay(1)).toBe(1000);  // 1s
            expect(calculateBackoffDelay(2)).toBe(2000);  // 2s
            expect(calculateBackoffDelay(3)).toBe(4000);  // 4s
        });
    });
});
