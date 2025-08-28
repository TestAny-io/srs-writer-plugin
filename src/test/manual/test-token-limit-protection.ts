/**
 * Token限制双层防护机制的手动测试
 * 
 * 这个测试验证：
 * 1. specialistExecutor.summarizeToolResult的第一层防护
 * 2. TokenAwareHistoryManager.truncateToTokenBudget的第二层防护
 */

import { SpecialistExecutor } from '../../core/specialistExecutor';
import { TokenAwareHistoryManager } from '../../core/history/TokenAwareHistoryManager';

async function testTokenLimitProtection() {
    console.log('🚀 开始测试Token限制双层防护机制...\n');

    // 测试第一层防护：specialistExecutor.summarizeToolResult
    console.log('=== 第一层防护测试 ===');
    
    try {
        // 创建一个模拟的specialistExecutor实例来测试summarizeToolResult
        const executor = new SpecialistExecutor();
        
        // 使用反射访问私有方法进行测试
        const summarizeToolResult = (executor as any).summarizeToolResult.bind(executor);
        
        // 测试正常大小的结果
        const normalResult = {
            toolName: 'readFile',
            success: true,
            result: { content: 'This is a normal file content' }
        };
        
        const normalSummary = summarizeToolResult(normalResult);
        console.log('✅ 正常结果:', normalSummary);
        
        // 测试超大结果（创建一个超过36000 tokens的内容）
        const largeContent = 'A'.repeat(50000); // 大约50000个字符
        const largeResult = {
            toolName: 'readMarkdownFile',
            success: true,
            result: { content: largeContent }
        };
        
        const largeSummary = summarizeToolResult(largeResult);
        console.log('✅ 超大结果处理:', largeSummary);
        
        // 验证是否包含Warning
        if (largeSummary.includes('Warning!!!')) {
            console.log('✅ 第一层防护生效：超大结果被正确替换为Warning');
        } else {
            console.log('❌ 第一层防护失效：超大结果没有被替换');
        }
        
    } catch (error) {
        console.log('❌ 第一层防护测试失败:', (error as Error).message);
    }

    console.log('\n=== 第二层防护测试 ===');
    
    try {
        // 测试TokenAwareHistoryManager的truncateToTokenBudget
        const historyManager = new TokenAwareHistoryManager();
        
        // 使用反射访问私有方法
        const truncateToTokenBudget = (historyManager as any).truncateToTokenBudget.bind(historyManager);
        
        // 创建一个包含超大工具结果的历史条目
        const largeContent = 'B'.repeat(20000);
        const largeEntries = [
            '迭代 1 - AI计划:\n- 调用readFile工具',
            `迭代 1 - 工具结果:\n工具: readFile, 成功: true, 结果: {"content":"${largeContent}"}`
        ];
        
        // 使用较小的预算来触发第二层防护
        const result = truncateToTokenBudget(largeEntries, 5000);
        
        console.log('✅ 截断结果条目数:', result.length);
        console.log('✅ 第一个条目:', result[0]);
        if (result[1]) {
            console.log('✅ 第二个条目:', result[1]);
            
            // 验证是否包含Warning
            if (result[1].includes('Warning!!!')) {
                console.log('✅ 第二层防护生效：工具结果条目被正确替换为Warning');
            } else {
                console.log('❌ 第二层防护失效：工具结果条目没有被替换');
            }
        }
        
    } catch (error) {
        console.log('❌ 第二层防护测试失败:', (error as Error).message);
    }

    console.log('\n🎉 Token限制双层防护机制测试完成！');
}

// 运行测试
if (require.main === module) {
    testTokenLimitProtection().catch(console.error);
}

export { testTokenLimitProtection };
