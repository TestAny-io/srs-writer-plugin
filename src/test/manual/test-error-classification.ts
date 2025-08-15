/**
 * 手动测试：错误分类和重试逻辑验证
 * 
 * 用于验证我们的网络错误分类逻辑是否正确工作
 */

import * as vscode from 'vscode';

// 创建一个模拟的 LanguageModelError 类
class MockLanguageModelError extends Error {
    public code: string;
    
    constructor(message: string, code?: string) {
        super(message);
        this.name = 'LanguageModelError';
        this.code = code || 'unknown';
    }
}

// 模拟真实的 vscode.LanguageModelError
(global as any).vscode = {
    LanguageModelError: MockLanguageModelError
};

// 网络错误分类接口
interface NetworkErrorClassification {
    retryable: boolean;
    maxRetries: number;
    errorCategory: 'network' | 'server' | 'auth' | 'config' | 'unknown';
    userMessage: string;
}

/**
 * 复制自 SpecialistExecutor 的错误分类逻辑
 */
function classifyNetworkError(error: Error): NetworkErrorClassification {
    if (error instanceof MockLanguageModelError) {
        const message = error.message.toLowerCase();
        const code = error.code;
        
        console.log(`🔍 分析错误: message="${message}", code="${code}"`);
        
        // 可重试的网络错误（3次）
        if (message.includes('net::err_network_changed') ||
            message.includes('net::err_connection_refused') ||
            message.includes('net::err_internet_disconnected') ||
            message.includes('net::err_timed_out') ||
            message.includes('net::err_name_not_resolved') ||
            (message.includes('network') && message.includes('connection'))) {
            return {
                retryable: true,
                maxRetries: 3,
                errorCategory: 'network',
                userMessage: '网络连接问题，正在重试'
            };
        }
        
        // 服务器错误（1次）
        if (code === '500' || code === '502' || code === '503' || code === '504' ||
            message.includes('server error') || message.includes('internal error')) {
            return {
                retryable: true,
                maxRetries: 1,
                errorCategory: 'server',
                userMessage: '服务器临时错误，正在重试'
            };
        }
        
        // 不可重试的错误
        if (code === '401') {
            return {
                retryable: false,
                maxRetries: 0,
                errorCategory: 'auth',
                userMessage: 'AI模型认证失败，请检查GitHub Copilot配置'
            };
        }
        
        if (code === '429') {
            return {
                retryable: false,
                maxRetries: 0,
                errorCategory: 'config',
                userMessage: 'AI模型使用频率过高，请稍后再试'
            };
        }
        
        if (message.includes('cert') || message.includes('certificate')) {
            return {
                retryable: false,
                maxRetries: 0,
                errorCategory: 'config',
                userMessage: 'SSL证书错误，请检查网络配置'
            };
        }
        
        if (message.includes('proxy') || message.includes('firewall')) {
            return {
                retryable: false,
                maxRetries: 0,
                errorCategory: 'config',
                userMessage: '代理或防火墙配置问题，请检查网络设置'
            };
        }
    }
    
    // 未知错误，默认不重试
    return {
        retryable: false,
        maxRetries: 0,
        errorCategory: 'unknown',
        userMessage: '未知错误，无法重试'
    };
}

/**
 * 测试各种网络错误
 */
function testErrorClassification() {
    console.log('=== 测试网络错误分类逻辑 ===\n');
    
    const testCases = [
        {
            name: '真实的 net::ERR_NETWORK_CHANGED 错误',
            error: new MockLanguageModelError('Please check your firewall rules and network connection then try again. Error Code: net::ERR_NETWORK_CHANGED.'),
            expectedRetryable: true,
            expectedMaxRetries: 3
        },
        {
            name: 'net::ERR_CONNECTION_REFUSED',
            error: new MockLanguageModelError('net::ERR_CONNECTION_REFUSED'),
            expectedRetryable: true,
            expectedMaxRetries: 3
        },
        {
            name: '网络连接错误',
            error: new MockLanguageModelError('Network connection failed'),
            expectedRetryable: true,
            expectedMaxRetries: 3
        },
        {
            name: '服务器错误 500',
            error: new MockLanguageModelError('Internal server error', '500'),
            expectedRetryable: true,
            expectedMaxRetries: 1
        },
        {
            name: '认证错误',
            error: new MockLanguageModelError('Unauthorized', '401'),
            expectedRetryable: false,
            expectedMaxRetries: 0
        },
        {
            name: '速率限制',
            error: new MockLanguageModelError('Too many requests', '429'),
            expectedRetryable: false,
            expectedMaxRetries: 0
        }
    ];
    
    testCases.forEach((testCase, index) => {
        console.log(`测试 ${index + 1}: ${testCase.name}`);
        console.log(`错误消息: "${testCase.error.message}"`);
        console.log(`错误代码: "${testCase.error.code}"`);
        
        const classification = classifyNetworkError(testCase.error);
        
        console.log(`分类结果: retryable=${classification.retryable}, maxRetries=${classification.maxRetries}, category=${classification.errorCategory}`);
        console.log(`用户提示: ${classification.userMessage}`);
        
        const passed = classification.retryable === testCase.expectedRetryable && 
                      classification.maxRetries === testCase.expectedMaxRetries;
        
        console.log(`✅ 测试结果: ${passed ? '通过' : '失败'}`);
        
        if (!passed) {
            console.log(`❌ 期望: retryable=${testCase.expectedRetryable}, maxRetries=${testCase.expectedMaxRetries}`);
            console.log(`❌ 实际: retryable=${classification.retryable}, maxRetries=${classification.maxRetries}`);
        }
        
        console.log('---\n');
    });
}

// 运行测试
testErrorClassification();

