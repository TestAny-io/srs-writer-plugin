/**
 * 手动验证脚本：验证 stage completion 逻辑修改
 *
 * 读取修改后的代码，确保：
 * 1. KQ-1: Line 661-663 已移除 completed 设置
 * 2. KQ-2: Line 665-696 添加了异常处理逻辑
 * 3. TE-2: Line 783-788 已移除 completed 设置
 * 4. Line 705-708: finalAnswer 逻辑保持不变
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/core/srsAgentEngine.ts');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log('🔍 验证 Stage Completion Logic 修改...\n');

let allTestsPassed = true;

// 测试1: KQ-1 - direct_response 不应设置 completed
console.log('测试1: KNOWLEDGE_QA 模式 - direct_response 不设置 completed');
const kq1Region = lines.slice(644, 664).join('\n');
if (kq1Region.includes('this.state.stage = \'completed\'')) {
  console.log('❌ FAILED: Line 644-664 区域仍然设置了 completed');
  allTestsPassed = false;
} else if (kq1Region.includes('继续循环，等待AI下一步决策')) {
  console.log('✅ PASSED: direct_response 不设置 completed，继续循环');
} else {
  console.log('⚠️  WARNING: 无法确认修改');
}

// 测试2: KQ-2 - 空响应添加了异常处理
console.log('\n测试2: KNOWLEDGE_QA 模式 - 空响应异常处理');
const kq2Region = lines.slice(665, 696).join('\n');
if (kq2Region.includes('AI 无法继续处理此任务') &&
    kq2Region.includes('emptyPlanCount') &&
    kq2Region.includes('this.state.stage = \'error\'')) {
  console.log('✅ PASSED: 空响应异常处理已添加');
} else {
  console.log('❌ FAILED: 空响应异常处理未正确实现');
  allTestsPassed = false;
}

// 测试3: TE-2 - 无 tool_calls 不设置 completed
console.log('\n测试3: TOOL_EXECUTION 模式 - 无 tool_calls 不设置 completed');
const te2Region = lines.slice(783, 789).join('\n');
if (te2Region.includes('this.state.stage = \'completed\'')) {
  console.log('❌ FAILED: Line 783-789 区域仍然设置了 completed');
  allTestsPassed = false;
} else if (te2Region.includes('继续循环等待AI决策')) {
  console.log('✅ PASSED: 无 tool_calls 不设置 completed，继续循环');
} else {
  console.log('⚠️  WARNING: 无法确认修改');
}

// 测试4: finalAnswer 逻辑保持不变
console.log('\n测试4: finalAnswer 工具逻辑保持不变');
const finalAnswerRegion = lines.slice(704, 709).join('\n');
if (finalAnswerRegion.includes('if (toolCall.name === \'finalAnswer\')') &&
    finalAnswerRegion.includes('this.state.stage = \'completed\'')) {
  console.log('✅ PASSED: finalAnswer 设置 completed 的逻辑保持不变');
} else {
  console.log('❌ FAILED: finalAnswer 逻辑被意外修改');
  allTestsPassed = false;
}

// 总结
console.log('\n' + '='.repeat(60));
if (allTestsPassed) {
  console.log('✅ 所有验证通过！修改正确实施。');
  process.exit(0);
} else {
  console.log('❌ 部分验证失败，请检查修改。');
  process.exit(1);
}
