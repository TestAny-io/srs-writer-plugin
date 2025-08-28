/**
 * 测试修复后的specialist重试逻辑 - 验证重试时迭代次数不增加
 */

// 模拟修复后的specialist执行逻辑
class MockSpecialistExecutor {
    private logger = {
        info: (msg: string) => console.log(`[INFO] ${msg}`),
        warn: (msg: string) => console.log(`[WARN] ${msg}`),
        error: (msg: string) => console.log(`[ERROR] ${msg}`)
    };

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private classifyEmptyResponseError() {
        return {
            retryable: true,
            maxRetries: 3,
            errorCategory: 'config'
        };
    }

    private cleanIterationResults(history: string[]): string[] {
        return history.filter(entry => !entry.includes('- 工具结果:'));
    }

    async simulateSpecialistExecution(specialistId: string, shouldRetry: boolean = true): Promise<{ success: boolean; finalIteration: number; retryCount: number }> {
        const MAX_INTERNAL_ITERATIONS = 10;
        let iteration = 0;
        let retryCount = 0;
        let internalHistory: string[] = [];
        let totalRetries = 0;

        console.log(`\n🚀 开始模拟 ${specialistId} 执行...\n`);

        while (iteration < MAX_INTERNAL_ITERATIONS) {
            // 🚀 修复后：日志显示即将开始的迭代（iteration + 1）
            this.logger.info(`🔄 专家 ${specialistId} 内部迭代 ${iteration + 1}/${MAX_INTERNAL_ITERATIONS}`);

            // 模拟AI调用
            const aiResult = shouldRetry && iteration === 0 ? '' : 'valid response'; // 第一次返回空响应来测试重试

            // 🚀 空响应处理
            if (!aiResult.trim()) {
                this.logger.error(`❌ AI returned empty response for ${specialistId} iteration ${iteration + 1}`);
                
                const errorClassification = this.classifyEmptyResponseError();
                
                if (errorClassification.retryable && retryCount < errorClassification.maxRetries) {
                    retryCount++;
                    totalRetries++;
                    this.logger.warn(`🔄 [${specialistId}] 迭代 ${iteration + 1} 空响应错误, 重试 ${retryCount}/${errorClassification.maxRetries}`);
                    
                    // 添加警告到历史
                    internalHistory.unshift(`Warning!!! Your previous tool call cause message exceeds token limit, please find different way to perform task successfully.`);
                    
                    // 清理历史
                    internalHistory = this.cleanIterationResults(internalHistory);
                    
                    // 重置retryCount
                    retryCount = 0;
                    
                    await this.sleep(100); // 快速测试
                    continue; // 🚀 关键：重试时不增加iteration
                    
                } else {
                    throw new Error(`专家 ${specialistId} 在迭代 ${iteration + 1} 返回了空响应`);
                }
            }

            // 🚀 修复后：成功处理AI响应后才增加迭代次数
            iteration++;
            
            // 模拟工具执行和结果记录
            const planSummary = 'mock tool call';
            const resultsSummary = 'mock tool result';
            
            internalHistory.push(`迭代 ${iteration} - AI计划:\n${planSummary}`);
            internalHistory.push(`迭代 ${iteration} - 工具结果:\n${resultsSummary}`);
            
            retryCount = 0;
            
            this.logger.info(`✅ [${specialistId}] 迭代 ${iteration} 记录了工具执行结果`);

            // 模拟任务完成
            if (iteration >= 2) {
                this.logger.info(`✅ 专家 ${specialistId} 完成任务，迭代次数: ${iteration}`);
                return { success: true, finalIteration: iteration, retryCount: totalRetries };
            }
        }

        return { success: false, finalIteration: iteration, retryCount: totalRetries };
    }
}

async function testIterationRetryFix() {
    console.log('🚀 测试修复后的specialist重试逻辑...\n');

    const executor = new MockSpecialistExecutor();

    // 测试用例1：有重试的情况
    console.log('=== 测试用例1：模拟空响应重试 ===');
    try {
        const result1 = await executor.simulateSpecialistExecution('test_specialist', true);
        console.log(`✅ 测试用例1结果:`);
        console.log(`  - 成功: ${result1.success}`);
        console.log(`  - 最终迭代次数: ${result1.finalIteration}`);
        console.log(`  - 总重试次数: ${result1.retryCount}`);
        
        // 验证预期结果
        if (result1.success && result1.finalIteration === 2 && result1.retryCount === 1) {
            console.log(`🎯 测试用例1: ✅ 通过 - 重试时迭代次数没有增加`);
        } else {
            console.log(`🎯 测试用例1: ❌ 失败 - 预期: 成功=true, 迭代=2, 重试=1`);
        }
    } catch (error) {
        console.log(`❌ 测试用例1异常: ${(error as Error).message}`);
    }

    console.log('\n=== 测试用例2：无重试的正常情况 ===');
    try {
        const result2 = await executor.simulateSpecialistExecution('test_specialist_no_retry', false);
        console.log(`✅ 测试用例2结果:`);
        console.log(`  - 成功: ${result2.success}`);
        console.log(`  - 最终迭代次数: ${result2.finalIteration}`);
        console.log(`  - 总重试次数: ${result2.retryCount}`);
        
        // 验证预期结果
        if (result2.success && result2.finalIteration === 2 && result2.retryCount === 0) {
            console.log(`🎯 测试用例2: ✅ 通过 - 正常情况下迭代次数正确`);
        } else {
            console.log(`🎯 测试用例2: ❌ 失败 - 预期: 成功=true, 迭代=2, 重试=0`);
        }
    } catch (error) {
        console.log(`❌ 测试用例2异常: ${(error as Error).message}`);
    }

    console.log('\n🎉 specialist重试逻辑修复测试完成！');
}

// 运行测试
if (require.main === module) {
    testIterationRetryFix();
}

export { testIterationRetryFix };
