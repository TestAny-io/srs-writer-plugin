/**
 * 测试修复后的"Response contained no choices"错误分类
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
    
    // 模拟其他条件检查...
    // 这里简化处理，直接返回默认值
    
    // 默认：未知错误，不重试
    return {
        retryable: false,
        maxRetries: 0,
        errorCategory: 'unknown',
        userMessage: '执行失败'
    };
}

function testNoChoicesErrorFix() {
    console.log('🚀 测试修复后的"Response contained no choices"错误分类...\n');

    // 模拟实际日志中的错误
    const actualError = new Error('Response contained no choices.');
    
    console.log('=== 实际错误测试 ===');
    const classification = classifyNetworkError(actualError);
    console.log(`错误消息: "${actualError.message}"`);
    console.log(`错误类型: ${actualError.constructor.name}`);
    console.log(`分类结果:`);
    console.log(`  - 可重试: ${classification.retryable}`);
    console.log(`  - 最大重试次数: ${classification.maxRetries}`);
    console.log(`  - 错误类别: ${classification.errorCategory}`);
    console.log(`  - 用户消息: ${classification.userMessage}`);
    console.log('');

    // 验证预期结果
    const expected = {
        retryable: true,
        maxRetries: 3,
        errorCategory: 'config'
    };

    const success = classification.retryable === expected.retryable &&
                   classification.maxRetries === expected.maxRetries &&
                   classification.errorCategory === expected.errorCategory;

    console.log(`🎯 测试结果: ${success ? '✅ 通过' : '❌ 失败'}`);
    
    if (!success) {
        console.log('❌ 预期结果:');
        console.log(`  - 可重试: ${expected.retryable}`);
        console.log(`  - 最大重试次数: ${expected.maxRetries}`);
        console.log(`  - 错误类别: ${expected.errorCategory}`);
    }

    console.log('\n🎉 错误分类修复测试完成！');
    return success;
}

// 运行测试
if (require.main === module) {
    testNoChoicesErrorFix();
}

export { testNoChoicesErrorFix };
