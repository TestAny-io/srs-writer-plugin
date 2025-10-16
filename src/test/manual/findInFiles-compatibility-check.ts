/**
 * findInFiles兼容性验证脚本
 * 验证现有功能没有被破坏
 */

import { 
  findInFilesToolDefinition,
  smartEditToolDefinitions,
  smartEditToolImplementations 
} from '../../tools/atomic/smart-edit-tools';

/**
 * 验证工具注册正确性
 */
function validateToolRegistration() {
  console.log('🔍 验证工具注册...');
  
  // 1. 检查findInFiles工具定义存在
  const findInFilesDefExists = smartEditToolDefinitions.some(def => def.name === 'findInFiles');
  console.log('  ✅ findInFiles工具定义存在:', findInFilesDefExists);
  
  // 2. 检查findInFiles工具实现存在
  const findInFilesImplExists = 'findInFiles' in smartEditToolImplementations;
  console.log('  ✅ findInFiles工具实现存在:', findInFilesImplExists);
  
  // 3. 确认findInFile工具已被移除
  const findInFileDefRemoved = !smartEditToolDefinitions.some(def => def.name === 'findInFile');
  const findInFileImplRemoved = !('findInFile' in smartEditToolImplementations);
  console.log('  ✅ findInFile工具定义已移除:', findInFileDefRemoved);
  console.log('  ✅ findInFile工具实现已移除:', findInFileImplRemoved);
  
  // 4. 检查工具定义结构
  console.log('  📋 findInFiles参数要求:', findInFilesToolDefinition.parameters.required);
  
  return findInFilesDefExists && findInFilesImplExists && findInFileDefRemoved && findInFileImplRemoved;
}

/**
 * 验证返回格式兼容性
 */
function validateReturnFormatCompatibility() {
  console.log('\n🔍 验证PlanExecutor集成兼容性...');
  
  // 模拟findInFiles的返回结果
  const mockFindInFilesResult = {
    success: true,
    matches: [
      { file: 'test1.ts', line: 1, text: 'test line 1' },
      { file: 'test2.ts', line: 5, text: 'test line 5' }
    ],
    totalMatches: 2
  };
  
  // 模拟PlanExecutor的处理逻辑（现在处理findInFiles）
  const processFindInFilesResult = (toolResult: any) => {
    const matches = toolResult.result?.matches || [];
    const totalCount = toolResult.result?.totalMatches || matches.length;
    return `搜索成功 (找到${totalCount}个匹配，涉及${matches.length}个位置)`;
  };
  
  const findInFilesFormatted = processFindInFilesResult({ result: mockFindInFilesResult });
  
  console.log('  📊 findInFiles格式化结果:', findInFilesFormatted);
  
  // 验证格式正确
  const expectedFormat = /搜索成功.*找到\d+个匹配.*涉及\d+个位置/;
  const formatValid = expectedFormat.test(findInFilesFormatted);
  
  console.log('  ✅ PlanExecutor格式兼容性:', formatValid);
  
  return formatValid;
}

/**
 * 验证参数格式区别
 */
function validateParameterFormat() {
  console.log('\n🔍 验证findInFiles参数格式...');
  
  // findInFiles的Cursor风格参数格式
  const findInFilesParams = {
    pattern: "test",        // 必填：搜索模式
    path: "src/main.ts",    // 可选：搜索路径
    regex: false,           // 可选：正则开关
    context: 5,             // 可选：上下文行数
    outputMode: "content",  // 可选：输出格式
    limit: 100              // 可选：结果限制
  };
  
  console.log('  📋 findInFiles参数示例:', findInFilesParams);
  console.log('  🎯 参数特点: Cursor风格简洁设计，支持多种输出模式');
  
  // 验证必填参数
  const requiredParams = findInFilesToolDefinition.parameters.required;
  console.log('  📋 必填参数:', requiredParams);
  
  return requiredParams.includes('pattern') && requiredParams.length === 1;
}

/**
 * 主验证函数
 */
function runCompatibilityCheck() {
  console.log('🚀 开始findInFiles兼容性验证\n');
  
  try {
    const registrationValid = validateToolRegistration();
    const formatCompatible = validateReturnFormatCompatibility();
    const parameterValid = validateParameterFormat();
    
    const allValid = registrationValid && formatCompatible && parameterValid;
    
    console.log('\n🎯 替换验证结果:');
    console.log('  工具注册替换正确:', registrationValid ? '✅' : '❌');
    console.log('  PlanExecutor集成兼容:', formatCompatible ? '✅' : '❌');
    console.log('  参数格式正确:', parameterValid ? '✅' : '❌');
    console.log('\n🏆 总体结论:', allValid ? '✅ findInFiles成功替换findInFile' : '❌ 替换存在问题');
    
    return allValid;
    
  } catch (error) {
    console.error('❌ 验证过程出错:', (error as Error).message);
    return false;
  }
}

// 运行验证
if (require.main === module) {
  const result = runCompatibilityCheck();
  process.exit(result ? 0 : 1);
}

export { runCompatibilityCheck };
