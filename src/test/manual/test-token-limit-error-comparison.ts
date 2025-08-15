/**
 * Token Limit 错误处理对比测试
 * 
 * 目标：验证 orchestrator 和 specialist 对 "Message exceeds token limit" 错误的不同处理方式
 * 假设：specialist 可能将 token limit 错误误判为 "AI返回空响应"
 */

import * as vscode from 'vscode';
import { PlanGenerator } from '../../core/orchestrator/PlanGenerator';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { Logger } from '../../utils/logger';

// 模拟 LanguageModelError 类，专门用于测试
class MockLanguageModelError extends Error {
    public code?: string;
    
    constructor(message: string, code?: string) {
        super(message);
        this.name = 'LanguageModelError';
        this.code = code;
        // 确保 instanceof 检查能正确工作
        Object.setPrototypeOf(this, MockLanguageModelError.prototype);
    }
}

// 创建一个模拟的 LanguageModelChat，专门抛出 token limit 错误
class MockLanguageModelChatTokenLimit {
    public name = 'gpt-4-test';
    
    async sendRequest(
        messages: vscode.LanguageModelChatMessage[], 
        options?: vscode.LanguageModelChatRequestOptions
    ): Promise<vscode.LanguageModelChatResponse> {
        // 直接抛出 token limit 错误
        throw new MockLanguageModelError('Message exceeds token limit.', 'context_length_exceeded');
    }
}

// 创建一个模拟的 LanguageModelChat，返回空响应
class MockLanguageModelChatEmpty {
    public name = 'gpt-4-test';
    
    async sendRequest(
        messages: vscode.LanguageModelChatMessage[], 
        options?: vscode.LanguageModelChatRequestOptions
    ): Promise<vscode.LanguageModelChatResponse> {
        // 返回空的响应流
        return {
            text: this.createEmptyTextStream()
        } as vscode.LanguageModelChatResponse;
    }
    
    private async* createEmptyTextStream(): AsyncIterable<string> {
        // 空的异步生成器，模拟空响应
        return;
    }
}

/**
 * 测试 Orchestrator 对 token limit 错误的处理
 */
async function testOrchestratorTokenLimitHandling(): Promise<{
    success: boolean;
    errorType: string;
    errorMessage: string;
    caughtAsLanguageModelError: boolean;
    actualResponse?: any;
}> {
    console.log('\n🔍 === 测试 Orchestrator 对 Token Limit 错误的处理 ===');
    
    const logger = Logger.getInstance();
    const planGenerator = new PlanGenerator();
    const mockModel = new MockLanguageModelChatTokenLimit() as unknown as vscode.LanguageModelChat;
    
    // 模拟 vscode.LanguageModelError 类型检查
    (global as any).vscode = {
        LanguageModelError: MockLanguageModelError
    };
    
    try {
        const result = await planGenerator.generateUnifiedPlan(
            'test user input',
            { projectPath: '/test', projectInfo: {} } as any,
            mockModel,
            async () => 'test prompt'
        );
        
        console.log('📋 Orchestrator 结果:');
        console.log(`- 模式: ${result.response_mode}`);
        console.log(`- 思考: ${result.thought}`);
        console.log(`- 直接响应: ${result.direct_response}`);
        
        return {
            success: true,
            errorType: 'handled_gracefully',
            errorMessage: result.direct_response || result.thought || '',
            caughtAsLanguageModelError: result.thought?.includes('Language Model API Error') || false,
            actualResponse: result
        };
        
    } catch (error) {
        console.log('❌ Orchestrator 抛出异常:');
        console.log(`- 错误类型: ${error?.constructor?.name}`);
        console.log(`- 错误消息: ${(error as Error).message}`);
        console.log(`- 是否为 LanguageModelError: ${error instanceof MockLanguageModelError}`);
        
        return {
            success: false,
            errorType: 'unhandled_exception',
            errorMessage: (error as Error).message,
            caughtAsLanguageModelError: error instanceof MockLanguageModelError
        };
    }
}

/**
 * 测试 Specialist 对 token limit 错误的处理
 */
async function testSpecialistTokenLimitHandling(): Promise<{
    success: boolean;
    errorType: string;
    errorMessage: string;
    reportedAsEmptyResponse: boolean;
    caughtAsLanguageModelError: boolean;
    actualResponse?: any;
}> {
    console.log('\n🔍 === 测试 Specialist 对 Token Limit 错误的处理 ===');
    
    const specialistExecutor = new SpecialistExecutor();
    const mockModel = new MockLanguageModelChatTokenLimit() as unknown as vscode.LanguageModelChat;
    
    try {
        const result = await specialistExecutor.execute(
            'test_specialist',
            { userInput: 'test input' },
            mockModel
        );
        
        console.log('📋 Specialist 结果:');
        console.log(`- 成功: ${result.success}`);
        console.log(`- 错误: ${(result as any).error || 'none'}`);
        console.log(`- 需要文件编辑: ${(result as any).requires_file_editing || false}`);
        
        return {
            success: result.success || false,
            errorType: result.success ? 'handled_gracefully' : 'handled_as_failure',
            errorMessage: (result as any).error || '',
            reportedAsEmptyResponse: ((result as any).error || '').includes('空响应'),
            caughtAsLanguageModelError: false, // Specialist 成功返回就说明没有抛出异常
            actualResponse: result
        };
        
    } catch (error) {
        console.log('❌ Specialist 抛出异常:');
        console.log(`- 错误类型: ${error?.constructor?.name}`);
        console.log(`- 错误消息: ${(error as Error).message}`);
        console.log(`- 是否为 LanguageModelError: ${error instanceof MockLanguageModelError}`);
        console.log(`- 是否报告为空响应: ${(error as Error).message.includes('空响应')}`);
        
        return {
            success: false,
            errorType: 'unhandled_exception',
            errorMessage: (error as Error).message,
            reportedAsEmptyResponse: (error as Error).message.includes('空响应'),
            caughtAsLanguageModelError: error instanceof MockLanguageModelError
        };
    }
}

/**
 * 测试 Specialist 对真正空响应的处理（对照实验）
 */
async function testSpecialistEmptyResponseHandling(): Promise<{
    success: boolean;
    errorType: string;
    errorMessage: string;
    reportedAsEmptyResponse: boolean;
}> {
    console.log('\n🔍 === 测试 Specialist 对真正空响应的处理（对照实验）===');
    
    const specialistExecutor = new SpecialistExecutor();
    const mockModel = new MockLanguageModelChatEmpty() as unknown as vscode.LanguageModelChat;
    
    try {
        const result = await specialistExecutor.execute(
            'test_specialist',
            { userInput: 'test input' },
            mockModel
        );
        
        console.log('📋 Specialist 处理空响应的结果:');
        console.log(`- 成功: ${result.success}`);
        console.log(`- 错误: ${(result as any).error || 'none'}`);
        
        return {
            success: result.success || false,
            errorType: result.success ? 'handled_gracefully' : 'handled_as_failure',
            errorMessage: (result as any).error || '',
            reportedAsEmptyResponse: ((result as any).error || '').includes('空响应')
        };
        
    } catch (error) {
        console.log('❌ Specialist 处理空响应时抛出异常:');
        console.log(`- 错误消息: ${(error as Error).message}`);
        console.log(`- 是否报告为空响应: ${(error as Error).message.includes('空响应')}`);
        
        return {
            success: false,
            errorType: 'unhandled_exception',
            errorMessage: (error as Error).message,
            reportedAsEmptyResponse: (error as Error).message.includes('空响应')
        };
    }
}

/**
 * 比较和分析结果
 */
function compareResults(
    orchestratorResult: any,
    specialistResult: any,
    emptyResponseResult: any
) {
    console.log('\n📊 === 结果对比分析 ===');
    
    console.log('\n1️⃣ Orchestrator vs Specialist (Token Limit 错误):');
    console.log(`Orchestrator 错误处理: ${orchestratorResult.errorType}`);
    console.log(`Specialist 错误处理: ${specialistResult.errorType}`);
    console.log(`Orchestrator 识别为 LanguageModelError: ${orchestratorResult.caughtAsLanguageModelError}`);
    console.log(`Specialist 识别为 LanguageModelError: ${specialistResult.caughtAsLanguageModelError}`);
    
    console.log('\n2️⃣ Token Limit vs 真正空响应 (Specialist):');
    console.log(`Token Limit 报告为空响应: ${specialistResult.reportedAsEmptyResponse}`);
    console.log(`真正空响应报告为空响应: ${emptyResponseResult.reportedAsEmptyResponse}`);
    
    console.log('\n3️⃣ 关键发现:');
    
    // 验证假设 1: Orchestrator 能正确处理 LanguageModelError
    if (orchestratorResult.caughtAsLanguageModelError && orchestratorResult.success) {
        console.log('✅ 假设1验证: Orchestrator 确实能正确识别和处理 LanguageModelError');
    } else {
        console.log('❌ 假设1不成立: Orchestrator 未能正确处理 LanguageModelError');
    }
    
    // 验证假设 2: Specialist 将 token limit 错误误判为空响应
    if (specialistResult.reportedAsEmptyResponse && !specialistResult.caughtAsLanguageModelError) {
        console.log('⚠️  假设2疑似成立: Specialist 可能将 token limit 错误误判为空响应');
        console.log('   - Token limit 错误被报告为空响应');
        console.log('   - 未被识别为 LanguageModelError');
    } else if (specialistResult.caughtAsLanguageModelError) {
        console.log('❌ 假设2不成立: Specialist 正确识别了 LanguageModelError');
    } else {
        console.log('❓ 假设2结果不明确: 需要更多信息判断');
    }
    
    // 对比错误消息的具体内容
    console.log('\n4️⃣ 错误消息对比:');
    console.log(`Orchestrator: "${orchestratorResult.errorMessage.substring(0, 100)}..."`);
    console.log(`Specialist: "${specialistResult.errorMessage.substring(0, 100)}..."`);
    
    return {
        orchestratorHandlesCorrectly: orchestratorResult.caughtAsLanguageModelError && orchestratorResult.success,
        specialistMisidentifiesAsEmpty: specialistResult.reportedAsEmptyResponse && !specialistResult.caughtAsLanguageModelError,
        hypothesisConfirmed: orchestratorResult.caughtAsLanguageModelError && specialistResult.reportedAsEmptyResponse
    };
}

/**
 * 主测试函数
 */
export async function runTokenLimitComparisonTest(): Promise<void> {
    console.log('🧪 === Token Limit 错误处理对比测试开始 ===');
    console.log('目标: 验证 orchestrator 和 specialist 对 "Message exceeds token limit" 错误的不同处理方式');
    
    try {
        // 测试 orchestrator
        const orchestratorResult = await testOrchestratorTokenLimitHandling();
        
        // 测试 specialist
        const specialistResult = await testSpecialistTokenLimitHandling();
        
        // 对照实验：测试真正的空响应
        const emptyResponseResult = await testSpecialistEmptyResponseHandling();
        
        // 对比分析结果
        const analysis = compareResults(orchestratorResult, specialistResult, emptyResponseResult);
        
        console.log('\n🎯 === 最终结论 ===');
        if (analysis.hypothesisConfirmed) {
            console.log('✅ 假设得到验证: Orchestrator 正确处理 LanguageModelError，而 Specialist 将其误判为空响应');
        } else if (analysis.orchestratorHandlesCorrectly && !analysis.specialistMisidentifiesAsEmpty) {
            console.log('❌ 假设未得到验证: Specialist 也能正确处理 LanguageModelError');
        } else {
            console.log('❓ 测试结果不明确，需要进一步调查');
        }
        
    } catch (error) {
        console.error('❌ 测试执行失败:', error);
        throw error;
    }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    runTokenLimitComparisonTest()
        .then(() => {
            console.log('\n✅ 测试完成');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ 测试失败:', error);
            process.exit(1);
        });
}
