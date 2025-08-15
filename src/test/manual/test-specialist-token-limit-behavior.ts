/**
 * Specialist遇到Token Limit错误的完整行为分析
 * 
 * 目标：详细分析specialist在真实token limit场景下的完整行为流程
 */

// 模拟 LanguageModelError
class MockLanguageModelError extends Error {
    public code?: string;
    
    constructor(message: string, code?: string) {
        super(message);
        this.name = 'LanguageModelError';
        this.code = code;
        Object.setPrototypeOf(this, MockLanguageModelError.prototype);
    }
}

/**
 * 模拟specialist的完整错误处理流程
 * 基于specialistExecutor.ts的实际代码逻辑
 */
function simulateSpecialistTokenLimitBehavior(): {
    stage: string;
    outcome: string;
    errorMessage: string;
    thrownError: boolean;
    returnedResult: any;
} {
    console.log('\n🎯 === Specialist Token Limit 错误行为完整模拟 ===\n');
    
    try {
        console.log('📍 第1步: 进入specialist执行循环 (while iteration < MAX_INTERNAL_ITERATIONS)');
        
        console.log('📍 第2步: 准备AI请求');
        console.log('  - 构建messages: [LanguageModelChatMessage.User(prompt)]');
        console.log('  - 设置requestOptions: { justification: "执行专家任务..." }');
        console.log('  - 添加tools到requestOptions (如果有)');
        
        console.log('📍 第3步: 调用sendRequestAndProcessResponseWithRetry');
        
        // 模拟进入网络重试方法
        const networkRetryResult = simulateNetworkRetryWithTokenLimit();
        
        if (networkRetryResult.threwError) {
            console.log('📍 第4步: sendRequestAndProcessResponseWithRetry抛出异常');
            console.log(`  - 异常消息: "${networkRetryResult.errorMessage}"`);
            
            // 这会被最外层的try-catch捕获
            throw new Error(networkRetryResult.errorMessage);
        }
        
        // 如果没有抛出异常，继续正常流程
        console.log('📍 第4步: 检查响应是否为空');
        if (!networkRetryResult.result.trim()) {
            console.log('❌ 检测到空响应，抛出异常');
            throw new Error(`专家 test_specialist 在迭代 1 返回了空响应`);
        }
        
        console.log('📍 第5步: 解析AI响应 (parseAIResponse)');
        console.log('📍 第6步: 验证AI计划');
        console.log('📍 第7步: 执行工具调用');
        console.log('✅ 正常完成specialist执行');
        
        return {
            stage: 'completed_successfully',
            outcome: 'success',
            errorMessage: '',
            thrownError: false,
            returnedResult: {
                success: true,
                content: '任务完成',
                requires_file_editing: false
            }
        };
        
    } catch (error) {
        console.log('📍 第X步: 最外层catch块捕获异常');
        console.log(`  - 错误消息: "${(error as Error).message}"`);
        console.log('  - 记录错误日志: "❌ 专家 test_specialist 执行失败"');
        console.log('  - 返回失败结果 (success: false)');
        
        return {
            stage: 'caught_in_outer_catch',
            outcome: 'failure',
            errorMessage: (error as Error).message,
            thrownError: false, // 异常被捕获，不再抛出
            returnedResult: {
                success: false,
                requires_file_editing: false,
                error: (error as Error).message,
                metadata: {
                    specialist: 'test_specialist',
                    iterations: 0,
                    executionTime: 1000,
                    timestamp: new Date().toISOString()
                }
            }
        };
    }
}

/**
 * 模拟sendRequestAndProcessResponseWithRetry方法的行为
 * 基于specialistExecutor.ts第1540-1610行
 */
function simulateNetworkRetryWithTokenLimit(): {
    result: string;
    threwError: boolean;
    errorMessage: string;
    retryAttempts: number;
} {
    console.log('  🔄 进入sendRequestAndProcessResponseWithRetry方法');
    
    let retryCount = 0;
    const maxRetries = 3;
    
    while (true) {
        try {
            console.log(`    📡 尝试发送请求 (重试次数: ${retryCount})`);
            
            // 模拟token limit错误在model.sendRequest阶段抛出
            throw new MockLanguageModelError('Message exceeds token limit.', 'context_length_exceeded');
            
        } catch (error) {
            console.log(`    ❌ 捕获到错误: ${(error as Error).message}`);
            console.log(`    🔍 错误类型: ${error?.constructor?.name}`);
            console.log(`    🔍 是否为LanguageModelError: ${error instanceof MockLanguageModelError}`);
            
            // 模拟错误分类
            const classification = simulateTokenLimitErrorClassification(error as Error);
            console.log(`    📋 错误分类结果: retryable=${classification.retryable}, category=${classification.errorCategory}`);
            
            if (classification.retryable && retryCount < classification.maxRetries) {
                retryCount++;
                console.log(`    🔄 错误可重试，准备第${retryCount}次重试`);
                console.log(`    ⏳ 等待指数退避延迟: ${Math.pow(2, retryCount - 1)}秒`);
                continue;
            } else {
                console.log(`    ❌ 错误不可重试或重试次数耗尽`);
                console.log(`    🚀 抛出增强的错误信息`);
                
                const enhancedMessage = retryCount > 0 
                    ? `${classification.userMessage} (重试${classification.maxRetries}次后仍失败: ${(error as Error).message})`
                    : `${classification.userMessage}: ${(error as Error).message}`;
                
                return {
                    result: '',
                    threwError: true,
                    errorMessage: enhancedMessage,
                    retryAttempts: retryCount
                };
            }
        }
    }
}

/**
 * 模拟specialist的token limit错误分类逻辑
 * 基于specialistExecutor.ts第1615-1707行
 */
function simulateTokenLimitErrorClassification(error: Error): {
    retryable: boolean;
    maxRetries: number;
    errorCategory: 'network' | 'server' | 'auth' | 'config' | 'unknown';
    userMessage: string;
} {
    const message = error.message.toLowerCase();
    const code = (error as any).code;
    
    console.log(`      🔍 分析错误消息: "${message}"`);
    console.log(`      🔍 分析错误代码: "${code}"`);
    
    // 检查是否为LanguageModelError系列
    if (error instanceof MockLanguageModelError || 
        error.constructor.name === 'LanguageModelError' ||
        message.includes('net::') ||
        message.includes('language model') ||
        message.includes('firewall') ||
        message.includes('network connection')) {
        
        console.log(`      ✅ 识别为LanguageModelError系列错误`);
        
        // 检查token limit相关模式
        if (message.includes('token limit') || 
            message.includes('exceeds') && message.includes('limit') ||
            message.includes('context length') ||
            message.includes('maximum context')) {
            
            console.log(`      🎯 检测到token limit相关错误，但代码中没有专门处理`);
            console.log(`      ⚠️  将被归类为unknown错误`);
        }
        
        // 当前代码中对token limit错误的处理（无专门分支）
        console.log(`      ❌ 未匹配到任何已知错误模式，归类为unknown`);
        
        // 会落到最后的unknown分类
    } else {
        console.log(`      ❌ 未识别为LanguageModelError系列错误`);
    }
    
    // 默认分类：unknown错误，不重试
    return {
        retryable: false,
        maxRetries: 0,
        errorCategory: 'unknown',
        userMessage: '执行失败'
    };
}

/**
 * 分析specialist的错误处理链
 */
function analyzeSpecialistErrorChain() {
    console.log('\n📊 === Specialist Token Limit 错误处理链分析 ===\n');
    
    console.log('🔗 完整的错误处理链:');
    console.log('1️⃣ model.sendRequest() 抛出 LanguageModelError("Message exceeds token limit.")');
    console.log('2️⃣ sendRequestAndProcessResponseWithRetry() catch块捕获');
    console.log('3️⃣ classifyNetworkError() 分析错误类型');
    console.log('4️⃣ 由于没有专门的token limit处理，归类为unknown错误');
    console.log('5️⃣ unknown错误标记为不可重试 (retryable: false)');
    console.log('6️⃣ 重新抛出增强的错误信息: "执行失败: Message exceeds token limit."');
    console.log('7️⃣ 最外层catch块捕获增强错误');
    console.log('8️⃣ 记录错误日志: "❌ 专家 test_specialist 执行失败"');
    console.log('9️⃣ 返回SpecialistOutput { success: false, error: "执行失败: Message exceeds token limit." }');
    
    console.log('\n🎯 关键特征:');
    console.log('✅ 错误被正确识别为LanguageModelError');
    console.log('✅ 不会被误判为空响应');
    console.log('⚠️  错误消息会被增强，但保留原始token limit信息');
    console.log('❌ 错误被归类为unknown，无专门的token limit处理');
    console.log('📝 最终用户看到的错误：包含"Message exceeds token limit"的完整信息');
    
    console.log('\n💡 与Orchestrator的差异:');
    console.log('Orchestrator: 直接在catch中检查instanceof LanguageModelError → 优雅降级');
    console.log('Specialist: 通过网络重试机制处理 → 错误增强 → 最终失败');
    console.log('结果: 两者都能识别token limit错误，但处理方式不同');
}

/**
 * 主要测试函数
 */
function testSpecialistTokenLimitBehavior() {
    console.log('🧪 === Specialist Token Limit 行为完整测试 ===');
    
    // 1. 模拟完整的specialist执行流程
    const result = simulateSpecialistTokenLimitBehavior();
    
    console.log('\n📋 === 执行结果总结 ===');
    console.log(`执行阶段: ${result.stage}`);
    console.log(`最终结果: ${result.outcome}`);
    console.log(`错误消息: ${result.errorMessage}`);
    console.log(`是否抛出异常: ${result.thrownError}`);
    console.log(`返回的结果对象:`, JSON.stringify(result.returnedResult, null, 2));
    
    // 2. 分析错误处理链
    analyzeSpecialistErrorChain();
    
    return result;
}

// 运行测试
if (require.main === module) {
    try {
        const result = testSpecialistTokenLimitBehavior();
        console.log('\n✅ Specialist Token Limit 行为测试完成');
        
        console.log('\n🎯 === 最终结论 ===');
        console.log('当specialist遇到token limit错误时:');
        console.log('1. 错误会被正确识别为LanguageModelError');
        console.log('2. 通过网络重试机制处理，但归类为unknown错误');
        console.log('3. 错误信息会被增强但保留原始信息');
        console.log('4. 最终返回失败结果，包含完整的错误描述');
        console.log('5. 不会被误判为"空响应"');
        
    } catch (error) {
        console.error('❌ 测试执行失败:', error);
        process.exit(1);
    }
}

export { testSpecialistTokenLimitBehavior };
