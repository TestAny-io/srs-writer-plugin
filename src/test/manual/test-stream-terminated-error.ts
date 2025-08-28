/**
 * 测试"Server error. Stream terminated"错误分类
 */

// 模拟修复后的错误分类逻辑
function classifyNetworkError(error: Error): { retryable: boolean; maxRetries: number; errorCategory: string; userMessage: string } {
    const message = error.message.toLowerCase();
    const code = (error as any).code;
    
    console.log(`🔍 [DEBUG] classifyNetworkError: error.constructor.name=${error.constructor.name}`);
    console.log(`🔍 [DEBUG] classifyNetworkError: message="${message}"`);
    console.log(`🔍 [DEBUG] classifyNetworkError: code="${code}"`);
    
    // 🚀 优先检查：Token limit错误和空响应错误（不依赖错误类型）
    if (message.includes('token limit') || 
        message.includes('exceeds') && message.includes('limit') ||
        message.includes('context length') ||
        message.includes('maximum context') ||
        message.includes('response contained no choices') ||
        message.includes('no choices')) {
        return {
            retryable: true,
            maxRetries: 3,
            errorCategory: 'config',
            userMessage: 'Token限制或空响应错误，正在优化提示词重试'
        };
    }
    
    // 不仅检查 instanceof，也检查错误名称和内容
    if (error.constructor.name === 'Error' ||
        message.includes('net::') ||
        message.includes('language model') ||
        message.includes('firewall') ||
        message.includes('network connection')) {
        
        // 可重试的网络错误（3次）
        if (message.includes('net::err_network_changed') ||
            message.includes('net::err_connection_refused') ||
            message.includes('net::err_internet_disconnected') ||
            message.includes('net::err_timed_out') ||
            message.includes('net::err_name_not_resolved') ||
            message.includes('network') && message.includes('connection') ||
            message.includes('server error') && message.includes('stream terminated')) {
            return {
                retryable: true,
                maxRetries: 3,
                errorCategory: 'network',
                userMessage: '网络连接或流式响应问题，正在重试'
            };
        }
    }
    
    // 默认：未知错误，不重试
    return {
        retryable: false,
        maxRetries: 0,
        errorCategory: 'unknown',
        userMessage: '执行失败'
    };
}

function testStreamTerminatedError() {
    console.log('🚀 测试"Server error. Stream terminated"错误分类...\n');

    // 测试用例
    const testCases = [
        new Error('Server error. Stream terminated'),
        new Error('server error. stream terminated'),
        new Error('SERVER ERROR. STREAM TERMINATED'),
        new Error('Response contained no choices.'),
        new Error('net::err_network_changed'),
        new Error('Some other error')
    ];

    testCases.forEach((error, index) => {
        const classification = classifyNetworkError(error);
        console.log(`测试用例 ${index + 1}: "${error.message}"`);
        console.log(`  - 可重试: ${classification.retryable}`);
        console.log(`  - 最大重试次数: ${classification.maxRetries}`);
        console.log(`  - 错误类别: ${classification.errorCategory}`);
        console.log(`  - 用户消息: ${classification.userMessage}`);
        console.log('');
    });

    // 验证关键测试用例
    const streamError = new Error('Server error. Stream terminated');
    const streamClassification = classifyNetworkError(streamError);
    
    const expectedForStream = {
        retryable: true,
        maxRetries: 3,
        errorCategory: 'network'
    };

    const streamSuccess = streamClassification.retryable === expectedForStream.retryable &&
                         streamClassification.maxRetries === expectedForStream.maxRetries &&
                         streamClassification.errorCategory === expectedForStream.errorCategory;

    console.log(`🎯 Stream terminated错误测试结果: ${streamSuccess ? '✅ 通过' : '❌ 失败'}`);
    
    if (!streamSuccess) {
        console.log('❌ 预期结果:');
        console.log(`  - 可重试: ${expectedForStream.retryable}`);
        console.log(`  - 最大重试次数: ${expectedForStream.maxRetries}`);
        console.log(`  - 错误类别: ${expectedForStream.errorCategory}`);
    }

    console.log('\n🎉 Stream terminated错误分类测试完成！');
    return streamSuccess;
}

// 运行测试
if (require.main === module) {
    testStreamTerminatedError();
}

export { testStreamTerminatedError };
