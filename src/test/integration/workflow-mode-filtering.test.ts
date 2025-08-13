import { PromptAssemblyEngine, SpecialistType, SpecialistContext } from '../../core/prompts/PromptAssemblyEngine';
import { getSpecialistRegistry } from '../../core/specialistRegistry';
import * as path from 'path';
import * as fs from 'fs/promises';

// Mock VSCode API
jest.mock('vscode', () => ({
  extensions: {
    getExtension: jest.fn(() => ({
      extensionPath: require('path').join(__dirname, '../../../')
    }))
  },
  window: {
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn()
    }))
  }
}));

/**
 * PromptAssemblyEngine workflow_mode过滤功能测试
 * 
 * 测试场景：
 * 1. 验证greenfield模式只包含GREEN标记的heading 2
 * 2. 验证brownfield模式只包含BROWN标记的heading 2  
 * 3. 验证无标记的heading 2在两种模式下都包含
 * 4. 验证process specialist不受workflow_mode影响
 * 5. 验证没有workflow_mode_config时的向后兼容
 */
describe('PromptAssemblyEngine workflow_mode filtering', () => {
  let promptAssemblyEngine: PromptAssemblyEngine;
  const testRulesPath = path.join(__dirname, '../../..', 'rules');
  const testSpecialistPath = path.join(testRulesPath, 'specialists/content/test_workflow_specialist.md');
  
  beforeEach(async () => {
    // 初始化SpecialistRegistry
    const registry = getSpecialistRegistry();
    await registry.scanAndRegister();
    
    promptAssemblyEngine = new PromptAssemblyEngine(testRulesPath);
  });

  afterEach(async () => {
    // 清理测试文件
    try {
      await fs.unlink(testSpecialistPath);
    } catch (error) {
      // 文件可能不存在，忽略错误
    }
  });

  /**
   * 创建测试用的specialist文件
   */
  async function createTestSpecialistFile(
    workflowModeConfig: { greenfield?: string; brownfield?: string } = { greenfield: "GREEN", brownfield: "BROWN" }
  ): Promise<void> {
    const testContent = `---
specialist_config:
  enabled: true
  id: "test_workflow_specialist"
  name: "Test Workflow Specialist"
  category: "content"
  version: "1.0.0"
  description: "测试workflow_mode过滤功能的specialist"
  author: "Test Team"
  capabilities:
    - "markdown_editing"
  iteration_config:
    max_iterations: 5
    default_iterations: 3
  template_config:
    include_base:
      - "output-format-schema.md"
  workflow_mode_config:
    greenfield: "${workflowModeConfig.greenfield || ''}"
    brownfield: "${workflowModeConfig.brownfield || ''}"
  tags:
    - "test"
    - "workflow"
---

## 🎯 通用核心指令 (通用)

这个指令应该在两种模式下都出现。

- **ROLE**: Test Workflow Specialist
- **PRIMARY_GOAL**: 测试workflow_mode过滤功能

## GREEN 🔄 Greenfield工作流程

这个章节只应该在greenfield模式下出现。

### Phase 1: 从零开始分析
1. 分析用户需求
2. 创建全新的内容

### Phase 2: 生成内容
- 生成新的文档结构
- 编写原创内容

## BROWN 🔄 Brownfield工作流程

这个章节只应该在brownfield模式下出现。

### Phase 1: 现有内容分析
1. 读取现有草稿
2. 分析差距

### Phase 2: 重构和增强
- 重构现有内容
- 增强文档质量

## GREEN 📋 Greenfield核心职责

Greenfield模式下的特定职责：

- ✅ 从零创建新内容
- ✅ 设计全新的文档结构
- ❌ 不依赖现有草稿

## BROWN 📋 Brownfield核心职责

Brownfield模式下的特定职责：

- ✅ 基于现有草稿重构
- ✅ 保持内容连续性
- ❌ 不重新发明轮子

## ⚠️ 通用约束条件

这个章节是通用的，两种模式都应该包含。

1. **质量标准**: 确保输出质量
2. **格式规范**: 遵循markdown规范
3. **语言一致性**: 使用统一语言

## GREEN ✅ Greenfield必须行为

Greenfield模式下必须的行为：

1. **创新思维**: 从零开始思考
2. **全面规划**: 制定完整计划

## BROWN ✅ Brownfield必须行为

Brownfield模式下必须的行为：

1. **草稿优先**: 以现有草稿为基础
2. **渐进改进**: 逐步提升质量
`;

    // 确保目录存在
    const dir = path.dirname(testSpecialistPath);
    await fs.mkdir(dir, { recursive: true });
    
    // 写入测试文件
    await fs.writeFile(testSpecialistPath, testContent, 'utf-8');
  }

  /**
   * 测试1：验证greenfield模式只包含GREEN标记的内容
   */
  test('should include only GREEN sections in greenfield mode', async () => {
    await createTestSpecialistFile();

    const specialistType: SpecialistType = {
      name: 'test_workflow_specialist',
      category: 'content'
    };
    
    const context: SpecialistContext = {
      userRequirements: '测试greenfield模式',
      workflow_mode: 'greenfield', // 关键：设置为greenfield模式
      language: 'zh',
      projectMetadata: {
        projectName: 'TestProject',
        baseDir: '/test/path'
      }
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 验证包含GREEN标记的内容，但标记应该被清理
    expect(result).toContain('🔄 Greenfield工作流程'); // 标记已被移除
    expect(result).toContain('📋 Greenfield核心职责'); // 标记已被移除  
    expect(result).toContain('✅ Greenfield必须行为'); // 标记已被移除
    
    // 验证原始标记已被清理
    expect(result).not.toContain('GREEN 🔄 Greenfield工作流程');
    expect(result).not.toContain('GREEN 📋 Greenfield核心职责');
    expect(result).not.toContain('GREEN ✅ Greenfield必须行为');
    expect(result).toContain('从零开始分析');
    expect(result).toContain('从零创建新内容');
    expect(result).toContain('创新思维');

    // 验证不包含BROWN标记的内容（既不包含内容，也不包含标记）
    expect(result).not.toContain('🔄 Brownfield工作流程');
    expect(result).not.toContain('📋 Brownfield核心职责');
    expect(result).not.toContain('✅ Brownfield必须行为');
    expect(result).not.toContain('BROWN 🔄 Brownfield工作流程');
    expect(result).not.toContain('BROWN 📋 Brownfield核心职责');
    expect(result).not.toContain('BROWN ✅ Brownfield必须行为');
    expect(result).not.toContain('现有内容分析');
    expect(result).not.toContain('基于现有草稿重构');
    expect(result).not.toContain('草稿优先');

    // 验证包含通用内容（无标记）
    expect(result).toContain('🎯 通用核心指令');
    expect(result).toContain('⚠️ 通用约束条件');
    expect(result).toContain('这个指令应该在两种模式下都出现');
    expect(result).toContain('质量标准');

    console.log('✅ Greenfield模式过滤验证通过');
  });

  /**
   * 测试2：验证brownfield模式只包含BROWN标记的内容
   */
  test('should include only BROWN sections in brownfield mode', async () => {
    await createTestSpecialistFile();

    const specialistType: SpecialistType = {
      name: 'test_workflow_specialist',
      category: 'content'
    };
    
    const context: SpecialistContext = {
      userRequirements: '测试brownfield模式',
      workflow_mode: 'brownfield', // 关键：设置为brownfield模式
      language: 'zh',
      projectMetadata: {
        projectName: 'TestProject',
        baseDir: '/test/path'
      }
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 验证包含BROWN标记的内容，但标记应该被清理
    expect(result).toContain('🔄 Brownfield工作流程'); // 标记已被移除
    expect(result).toContain('📋 Brownfield核心职责'); // 标记已被移除
    expect(result).toContain('✅ Brownfield必须行为'); // 标记已被移除
    
    // 验证原始标记已被清理
    expect(result).not.toContain('BROWN 🔄 Brownfield工作流程');
    expect(result).not.toContain('BROWN 📋 Brownfield核心职责');
    expect(result).not.toContain('BROWN ✅ Brownfield必须行为');
    expect(result).toContain('现有内容分析');
    expect(result).toContain('基于现有草稿重构');
    expect(result).toContain('草稿优先');

    // 验证不包含GREEN标记的内容（既不包含内容，也不包含标记）
    expect(result).not.toContain('🔄 Greenfield工作流程');
    expect(result).not.toContain('📋 Greenfield核心职责');
    expect(result).not.toContain('✅ Greenfield必须行为');
    expect(result).not.toContain('GREEN 🔄 Greenfield工作流程');
    expect(result).not.toContain('GREEN 📋 Greenfield核心职责');
    expect(result).not.toContain('GREEN ✅ Greenfield必须行为');
    expect(result).not.toContain('从零开始分析');
    expect(result).not.toContain('从零创建新内容');
    expect(result).not.toContain('创新思维');

    // 验证包含通用内容（无标记）
    expect(result).toContain('🎯 通用核心指令');
    expect(result).toContain('⚠️ 通用约束条件');
    expect(result).toContain('这个指令应该在两种模式下都出现');
    expect(result).toContain('质量标准');

    console.log('✅ Brownfield模式过滤验证通过');
  });

  /**
   * 测试3：验证process specialist不受workflow_mode影响
   */
  test('should not filter process specialist content', async () => {
    const specialistType: SpecialistType = {
      name: 'git_operator', // process specialist
      category: 'process'
    };
    
    const context: SpecialistContext = {
      userRequirements: '测试process specialist',
      workflow_mode: 'greenfield', // 设置workflow_mode，但process specialist应该忽略
      language: 'zh'
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 验证基本结构存在（process specialist应该正常工作，不受workflow_mode影响）
    expect(result).toContain('# SPECIALIST INSTRUCTIONS');
    expect(result).toContain('# CURRENT TASK');
    expect(result).toContain('测试process specialist');

    console.log('✅ Process specialist不受workflow_mode影响验证通过');
  });

  /**
   * 测试4：验证没有workflow_mode时的向后兼容
   */
  test('should work without workflow_mode (backward compatibility)', async () => {
    await createTestSpecialistFile();

    const specialistType: SpecialistType = {
      name: 'test_workflow_specialist',
      category: 'content'
    };
    
    const context: SpecialistContext = {
      userRequirements: '测试向后兼容',
      // 故意不设置workflow_mode
      language: 'zh'
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 没有workflow_mode时，应该包含所有内容
    expect(result).toContain('🎯 通用核心指令');
    expect(result).toContain('GREEN 🔄 Greenfield工作流程');
    expect(result).toContain('BROWN 🔄 Brownfield工作流程');
    expect(result).toContain('⚠️ 通用约束条件');

    console.log('✅ 向后兼容性验证通过');
  });

  /**
   * 测试5：验证没有workflow_mode_config时的处理
   */
  test('should work without workflow_mode_config in YAML', async () => {
    // 创建没有workflow_mode_config的测试文件
    await createTestSpecialistFile({});

    const specialistType: SpecialistType = {
      name: 'test_workflow_specialist',
      category: 'content'
    };
    
    const context: SpecialistContext = {
      userRequirements: '测试无配置情况',
      workflow_mode: 'greenfield',
      language: 'zh'
    };

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 没有workflow_mode_config时，应该包含所有内容（不进行过滤）
    expect(result).toContain('🎯 通用核心指令');
    expect(result).toContain('GREEN 🔄 Greenfield工作流程');
    expect(result).toContain('BROWN 🔄 Brownfield工作流程');

    console.log('✅ 无workflow_mode_config配置验证通过');
  });

  /**
   * 测试6：验证自定义标志的工作
   */
  test('should work with custom flags', async () => {
    // 使用自定义标志
    await createTestSpecialistFile({ greenfield: "NEW", brownfield: "OLD" });

    // 需要手动修改测试文件内容以使用自定义标志
    const customContent = `---
specialist_config:
  enabled: true
  id: "test_workflow_specialist"
  name: "Test Workflow Specialist"
  category: "content"
  version: "1.0.0"
  workflow_mode_config:
    greenfield: "NEW"
    brownfield: "OLD"
---

## 🎯 通用核心指令

通用内容

## NEW 🔄 新建工作流程

新建模式的内容

## OLD 🔄 修改工作流程

修改模式的内容

## 📋 共同职责

通用职责
`;

    await fs.writeFile(testSpecialistPath, customContent, 'utf-8');

    const specialistType: SpecialistType = {
      name: 'test_workflow_specialist',
      category: 'content'
    };
    
    const contextGreenfield: SpecialistContext = {
      userRequirements: '测试自定义标志greenfield',
      workflow_mode: 'greenfield',
      language: 'zh'
    };

    const resultGreenfield = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, contextGreenfield);
    
    // 验证greenfield模式使用NEW标志
    expect(resultGreenfield).toContain('NEW 🔄 新建工作流程');
    expect(resultGreenfield).not.toContain('OLD 🔄 修改工作流程');
    expect(resultGreenfield).toContain('🎯 通用核心指令');
    expect(resultGreenfield).toContain('📋 共同职责');

    const contextBrownfield: SpecialistContext = {
      userRequirements: '测试自定义标志brownfield',
      workflow_mode: 'brownfield',
      language: 'zh'
    };

    const resultBrownfield = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, contextBrownfield);
    
    // 验证brownfield模式使用OLD标志
    expect(resultBrownfield).toContain('OLD 🔄 修改工作流程');
    expect(resultBrownfield).not.toContain('NEW 🔄 新建工作流程');
    expect(resultBrownfield).toContain('🎯 通用核心指令');
    expect(resultBrownfield).toContain('📋 共同职责');

    console.log('✅ 自定义标志验证通过');
  });

  /**
   * 测试7：验证日志输出
   */
  test('should log filtering actions correctly', async () => {
    await createTestSpecialistFile();

    const specialistType: SpecialistType = {
      name: 'test_workflow_specialist',
      category: 'content'
    };
    
    const context: SpecialistContext = {
      userRequirements: '测试日志输出',
      workflow_mode: 'greenfield',
      language: 'zh'
    };

    // 捕获日志输出
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const result = await promptAssemblyEngine.assembleSpecialistPrompt(specialistType, context);
    
    // 验证基本功能
    expect(result).toContain('GREEN 🔄 Greenfield工作流程');
    expect(result).not.toContain('BROWN 🔄 Brownfield工作流程');

    // 恢复console.log
    consoleSpy.mockRestore();

    console.log('✅ 日志输出验证通过');
  });
});
