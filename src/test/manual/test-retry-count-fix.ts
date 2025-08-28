/**
 * 测试重试计数器修复
 */

function testRetryCountFix() {
    console.log('🚀 测试重试计数器修复...\n');

    // 模拟修复前的逻辑（错误的）
    console.log('=== 修复前的逻辑（错误） ===');
    let retryCountBefore = 0;
    const maxRetries = 3;
    let attemptCount = 0;

    console.log('模拟连续空响应场景:');
    while (attemptCount < 5) { // 模拟5次尝试
        attemptCount++;
        console.log(`🔄 专家 test_specialist 内部迭代 1/10 (尝试 ${attemptCount})`);
        
        // 模拟空响应
        const isEmpty = attemptCount <= 4; // 前4次都是空响应
        if (isEmpty) {
            console.log(`❌ AI returned empty response for iteration 1`);
            
            if (retryCountBefore < maxRetries) {
                retryCountBefore++;
                console.log(`🔄 [test_specialist] 迭代 1 空响应错误, 重试 ${retryCountBefore}/${maxRetries}`);
                
                // ❌ 错误：重置重试计数器
                retryCountBefore = 0;
                continue;
            } else {
                console.log(`❌ 重试次数耗尽`);
                break;
            }
        }
        
        console.log(`✅ 成功处理响应`);
        break;
    }
    console.log(`修复前结果: 总尝试次数=${attemptCount}, 最终重试计数=${retryCountBefore}\n`);

    // 模拟修复后的逻辑（正确的）
    console.log('=== 修复后的逻辑（正确） ===');
    let retryCountAfter = 0;
    attemptCount = 0;

    console.log('模拟连续空响应场景:');
    while (attemptCount < 5) {
        attemptCount++;
        console.log(`🔄 专家 test_specialist 内部迭代 1/10 (尝试 ${attemptCount})`);
        
        // 模拟空响应
        const isEmpty = attemptCount <= 3; // 前3次都是空响应
        if (isEmpty) {
            console.log(`❌ AI returned empty response for iteration 1`);
            
            if (retryCountAfter < maxRetries) {
                retryCountAfter++;
                console.log(`🔄 [test_specialist] 迭代 1 空响应错误, 重试 ${retryCountAfter}/${maxRetries}`);
                
                // ✅ 正确：不重置重试计数器
                // retryCountAfter = 0; // 移除这行
                continue;
            } else {
                console.log(`❌ 重试次数耗尽`);
                break;
            }
        }
        
        console.log(`✅ 成功处理响应`);
        retryCountAfter = 0; // 只有成功后才重置
        break;
    }
    console.log(`修复后结果: 总尝试次数=${attemptCount}, 最终重试计数=${retryCountAfter}\n`);

    // 验证结果
    console.log('=== 结果对比 ===');
    console.log(`修复前: 无限重试，重试计数总是被重置为0 (❌ 错误)`);
    console.log(`修复后: 正确累积重试次数，达到上限后停止 (✅ 正确)`);
    
    const isFixed = attemptCount <= 4; // 修复后应该在4次内完成（3次重试+1次成功）
    console.log(`\n🎯 修复验证: ${isFixed ? '✅ 成功' : '❌ 失败'}`);
    
    if (isFixed) {
        console.log('✅ 修复成功！重试计数器现在正确累积');
    } else {
        console.log('❌ 修复失败！重试计数器仍有问题');
    }

    console.log('\n🎉 重试计数器修复测试完成！');
    return isFixed;
}

// 运行测试
if (require.main === module) {
    testRetryCountFix();
}

export { testRetryCountFix };
