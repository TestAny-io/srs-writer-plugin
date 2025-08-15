/**
 * 响应流处理深度分析测试
 * 
 * 目标：深入研究specialist的响应流处理机制，验证token limit错误与空响应的关系
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

// 模拟 VSCode 的响应流接口
interface MockChatResponse {
    text: AsyncIterable<string>;
}

/**
 * 场景1: Token limit错误导致完全无法获取响应流
 */
class TokenLimitErrorBeforeStreamModel {
    public name = 'gpt-4-test';
    
    async sendRequest(): Promise<MockChatResponse> {
        // 模拟：token limit错误在获取响应流之前就抛出
        throw new MockLanguageModelError('Message exceeds token limit.', 'context_length_exceeded');
    }
}

/**
 * 场景2: 开始响应流但立即因token limit中断
 */
class TokenLimitErrorDuringStreamModel {
    public name = 'gpt-4-test';
    
    async sendRequest(): Promise<MockChatResponse> {
        return {
            text: this.createInterruptedStream()
        };
    }
    
    private async* createInterruptedStream(): AsyncIterable<string> {
        // 模拟：响应流开始但立即因token limit中断
        yield 'Starting response...';
        throw new MockLanguageModelError('Message exceeds token limit during processing.', 'context_length_exceeded');
    }
}

/**
 * 场景3: 响应流正常启动但提供空内容
 */
class EmptyStreamModel {
    public name = 'gpt-4-test';
    
    async sendRequest(): Promise<MockChatResponse> {
        return {
            text: this.createEmptyStream()
        };
    }
    
    private async* createEmptyStream(): AsyncIterable<string> {
        // 完全空的响应流，没有任何内容
        return;
    }
}

/**
 * 场景4: 响应流提供空白字符
 */
class WhitespaceOnlyStreamModel {
    public name = 'gpt-4-test';
    
    async sendRequest(): Promise<MockChatResponse> {
        return {
            text: this.createWhitespaceStream()
        };
    }
    
    private async* createWhitespaceStream(): AsyncIterable<string> {
        yield '   ';  // 只有空白字符
        yield '\n\n';
        yield '  \t  ';
    }
}

/**
 * 模拟specialist的响应流处理逻辑
 * 基于specialistExecutor.ts第1550-1610行
 */
async function simulateSpecialistResponseProcessing(
    model: any,
    messages: any[],
    requestOptions: any,
    specialistId: string,
    iteration: number
): Promise<{
    success: boolean;
    result?: string;
    errorType: 'no_error' | 'token_limit_before_stream' | 'token_limit_during_stream' | 'empty_response' | 'other_error';
    errorMessage?: string;
    streamFragments?: string[];
}> {
    let retryCount = 0;
    const maxRetries = 3;
    const streamFragments: string[] = [];
    
    console.log(`\n🔍 === 模拟Specialist响应流处理 ===`);
    console.log(`specialist: ${specialistId}, iteration: ${iteration}`);
    
    while (retryCount <= maxRetries) {
        try {
            // 1. 发送请求获取响应
            console.log(`📡 尝试发送请求到AI模型...`);
            const response = await model.sendRequest(messages, requestOptions);
            
            // 2. 处理AI响应流
            console.log(`🔄 开始处理AI响应流...`);
            let result = '';
            let fragmentCount = 0;
            
            try {
                for await (const fragment of response.text) {
                    fragmentCount++;
                    result += fragment;
                    streamFragments.push(fragment);
                    console.log(`  📦 收到fragment ${fragmentCount}: "${fragment}" (length: ${fragment.length})`);
                }
                
                console.log(`✅ 响应流处理完成。总fragments: ${fragmentCount}, 最终长度: ${result.length}`);
                console.log(`📄 完整响应: "${result}"`);
                
                // 3. 关键检查：空响应判断
                if (!result.trim()) {
                    console.log(`❌ 检测到空响应 (result.trim() === false)`);
                    return {
                        success: false,
                        result: result,
                        errorType: 'empty_response',
                        errorMessage: `专家 ${specialistId} 在迭代 ${iteration} 返回了空响应`,
                        streamFragments
                    };
                }
                
                return {
                    success: true,
                    result: result,
                    errorType: 'no_error',
                    streamFragments
                };
                
            } catch (streamError) {
                const errorMessage = (streamError as Error).message;
                console.log(`❌ 响应流处理中发生错误: ${errorMessage}`);
                
                // 如果在处理响应流时发生token limit错误
                if (streamError instanceof MockLanguageModelError) {
                    return {
                        success: false,
                        errorType: 'token_limit_during_stream',
                        errorMessage: streamError.message,
                        streamFragments
                    };
                }
                
                throw streamError;  // 重新抛出非token limit错误
            }
            
        } catch (error) {
            const errorMessage = (error as Error).message;
            console.log(`❌ 发送请求时发生错误: ${errorMessage}`);
            
            // 如果是在发送请求阶段的token limit错误
            if (error instanceof MockLanguageModelError) {
                console.log(`🔍 检测到LanguageModelError: ${error.message}`);
                
                // 这里应该会进入重试逻辑，但由于token limit通常不可重试...
                // 让我们模拟错误分类
                const classification = classifyNetworkErrorForTest(error);
                
                if (classification.retryable && retryCount < classification.maxRetries) {
                    retryCount++;
                    console.log(`🔄 错误可重试，重试 ${retryCount}/${classification.maxRetries}`);
                    continue;
                } else {
                    console.log(`❌ 错误不可重试或重试次数耗尽`);
                    return {
                        success: false,
                        errorType: 'token_limit_before_stream',
                        errorMessage: error.message,
                        streamFragments
                    };
                }
            }
            
            return {
                success: false,
                errorType: 'other_error',
                errorMessage: errorMessage,
                streamFragments
            };
        }
    }
    
    return {
        success: false,
        errorType: 'other_error',
        errorMessage: '达到最大重试次数',
        streamFragments
    };
}

/**
 * 简化的错误分类函数（用于测试）
 */
function classifyNetworkErrorForTest(error: Error) {
    const message = error.message.toLowerCase();
    
    // Token limit错误通常不可重试
    if (message.includes('token limit') || 
        message.includes('exceeds') && message.includes('limit') ||
        message.includes('context length')) {
        return {
            retryable: false,
            maxRetries: 0,
            errorCategory: 'config',
            userMessage: 'Token limit exceeded'
        };
    }
    
    // 其他错误可能可重试
    return {
        retryable: true,
        maxRetries: 2,
        errorCategory: 'unknown',
        userMessage: 'Unknown error'
    };
}

/**
 * 执行所有测试场景
 */
async function runResponseStreamAnalysis() {
    console.log('🧪 === 响应流处理深度分析测试 ===\n');
    
    const testCases = [
        {
            name: '场景1: Token limit错误在获取响应流前抛出',
            model: new TokenLimitErrorBeforeStreamModel(),
            description: '模拟token limit错误在model.sendRequest()阶段就抛出'
        },
        {
            name: '场景2: Token limit错误在响应流处理中抛出', 
            model: new TokenLimitErrorDuringStreamModel(),
            description: '模拟响应流开始但在处理过程中因token limit中断'
        },
        {
            name: '场景3: 响应流正常但完全无内容',
            model: new EmptyStreamModel(),
            description: '模拟响应流正常启动但没有产生任何内容'
        },
        {
            name: '场景4: 响应流只产生空白字符',
            model: new WhitespaceOnlyStreamModel(),
            description: '模拟响应流产生内容但只有空白字符'
        }
    ];
    
    const results = [];
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`\n📋 ${testCase.name}`);
        console.log(`🔍 ${testCase.description}`);
        
        const result = await simulateSpecialistResponseProcessing(
            testCase.model,
            [{ role: 'user', content: 'test message' }],
            { justification: 'test' },
            'test_specialist',
            1
        );
        
        results.push({
            testCase: testCase.name,
            ...result
        });
        
        console.log(`\n📊 结果:`)
        console.log(`  - 成功: ${result.success}`);
        console.log(`  - 错误类型: ${result.errorType}`);
        console.log(`  - 错误消息: ${result.errorMessage || 'none'}`);
        console.log(`  - 流片段数: ${result.streamFragments?.length || 0}`);
        if (result.streamFragments && result.streamFragments.length > 0) {
            console.log(`  - 流片段: ${JSON.stringify(result.streamFragments)}`);
        }
    }
    
    // 分析结果
    console.log('\n🎯 === 关键发现分析 ===');
    
    const tokenLimitBeforeStream = results.find(r => r.errorType === 'token_limit_before_stream');
    const tokenLimitDuringStream = results.find(r => r.errorType === 'token_limit_during_stream');
    const emptyResponse = results.find(r => r.errorType === 'empty_response');
    
    console.log('\n1️⃣ Token Limit错误的不同阶段影响:');
    if (tokenLimitBeforeStream) {
        console.log(`  ✅ 发现: Token limit在sendRequest阶段抛出 → ${tokenLimitBeforeStream.errorType}`);
        console.log(`  📝 这种情况下specialist会捕获LanguageModelError，不会误判为空响应`);
    }
    
    if (tokenLimitDuringStream) {
        console.log(`  ✅ 发现: Token limit在响应流处理中抛出 → ${tokenLimitDuringStream.errorType}`);
        console.log(`  📝 这种情况可能更复杂，因为已经开始处理响应流`);
        console.log(`  📝 已接收的片段: ${tokenLimitDuringStream.streamFragments?.length || 0}个`);
    }
    
    console.log('\n2️⃣ 空响应vs真正的Token Limit错误:');
    if (emptyResponse) {
        console.log(`  ✅ 发现: 真正的空响应流 → ${emptyResponse.errorType}`);
        console.log(`  📝 这种情况会被295-298行的检查捕获，报告为"空响应"`);
    }
    
    console.log('\n3️⃣ 关键问题验证:');
    console.log('❓ Token limit错误是否可能被误判为空响应？');
    
    const couldBeMisidentified = results.some(r => 
        (r.errorType === 'token_limit_before_stream' || r.errorType === 'token_limit_during_stream') &&
        r.errorMessage?.includes('空响应')
    );
    
    if (couldBeMisidentified) {
        console.log('  ⚠️  确认: 存在token limit错误被误判为空响应的情况');
    } else {
        console.log('  ✅ 结果: 在当前测试中，token limit错误没有被误判为空响应');
        console.log('  💡 可能的情况:');
        console.log('    - Token limit错误会被正确识别为LanguageModelError');
        console.log('    - 只有真正的空响应流才会触发"空响应"检查');
        console.log('    - 用户观察到的现象可能来自其他更复杂的场景');
    }
    
    console.log('\n4️⃣ 需要进一步验证的情况:');
    console.log('  1. 网络中断导致的部分响应流');
    console.log('  2. AI服务的特殊错误响应格式');
    console.log('  3. VSCode Language Model API的特定行为');
    console.log('  4. 超长输入导致的truncation行为');
    
    return results;
}

// 运行测试
if (require.main === module) {
    runResponseStreamAnalysis()
        .then((results) => {
            console.log('\n✅ 响应流分析测试完成');
            console.log(`📊 总共测试 ${results.length} 个场景`);
        })
        .catch((error) => {
            console.error('❌ 测试执行失败:', error);
            process.exit(1);
        });
}

export { runResponseStreamAnalysis };
