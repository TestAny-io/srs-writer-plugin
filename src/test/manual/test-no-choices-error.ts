/**
 * 测试"Response contained no choices"错误的分类
 */

// 模拟错误分类逻辑
function classifyNetworkError(error: Error): { retryable: boolean; maxRetries: number; errorCategory: string; userMessage: string } {
    const message = error.message.toLowerCase();
    
    // Token limit错误和空响应错误（可重试3次）
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
    
    // 默认：未知错误，不重试
    return {
        retryable: false,
        maxRetries: 0,
        errorCategory: 'unknown',
        userMessage: '执行失败'
    };
}

function testNoChoicesErrorClassification() {
    console.log('🚀 测试"Response contained no choices"错误分类...\n');

    // 测试用例
    const testCases = [
        new Error('Response contained no choices.'),
        new Error('response contained no choices'),
        new Error('No choices available'),
        new Error('Token limit exceeded'),
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

    console.log('🎉 错误分类测试完成！');
}

// 运行测试
if (require.main === module) {
    testNoChoicesErrorClassification();
}

export { testNoChoicesErrorClassification };
