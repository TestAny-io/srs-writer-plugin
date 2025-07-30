/**
 * 集成测试：YAML数据结构自动修复功能
 * 验证 traceability-completion-tool 能够自动修复AI生成的错误对象结构
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TraceabilityCompleter } from '../../tools/document/traceabilityCompletion/TraceabilityCompleter';

describe('Traceability Structure Fix Integration Tests', () => {
  let tempDir: string;
  let testYamlFile: string;

  beforeEach(async () => {
    // 创建临时目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'traceability-test-'));
    testYamlFile = path.join(tempDir, 'requirements.yaml');
  });

  afterEach(async () => {
    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('临时文件清理失败:', error);
    }
  });

  test('应该能够修复AI生成的对象结构为标准数组结构', async () => {
    // 🎯 准备：创建AI错误生成的对象结构YAML文件
    const malformedYaml = `
user_stories:
  "0":
    id: US-AD-001
    summary: 广告自动高可用展示
    description:
      - 广告商希望广告页面能自动定时扫描风险并在被标记为风险时自动切换域名，无需人工干预。
    as_a:
      - 微信广告商
    metadata:
      status: draft
      version: "1.0"
  "1":
    id: US-USER-001
    summary: 用户顺畅访问广告页面
    description:
      - 观看广告用户希望广告页面能自动规避风险域名，始终顺畅访问，无需技术操作。
    as_a:
      - 观看广告用户
    metadata:
      status: draft
      version: "1.0"

use_cases:
  "0":
    id: UC-AD-001
    summary: 自动拦截微信风险提示
    description:
      - 系统在广告商微信端访问广告页面时，自动识别并拦截微信官方弹出的风险提示。
    actor:
      - WeChatAdRiskBypass系统
    metadata:
      status: draft
      version: "1.0"

functional_requirements:
  - id: FR-AD-001
    summary: 定时页面状态扫描
    description:
      - 系统每1分钟自动检测广告页面状态，判断是否被标记为风险
    source_requirements:
      - US-AD-001
      - UC-AD-001
    metadata:
      status: draft
      version: "1.0"

constraints:
  "0":
    id: ADC-CONST-001
    summary: 系统全自动运行，无人工操作入口
    constraints:
      - 不得设计任何用户界面或人工配置入口
      - 所有流程需自动完成
    metadata:
      status: draft
      version: "1.0"

_metadata:
  generated_at: "2025-07-30T10:00:00.000Z"
  generator_version: 1.0.0
  schema_version: "1.0"
`;

    await fs.writeFile(testYamlFile, malformedYaml, 'utf-8');

    // 🚀 执行：运行追溯关系同步工具
    const completer = new TraceabilityCompleter();
    const result = await completer.syncFile({
      description: '测试数据结构修复功能',
      targetFile: testYamlFile
    });

    // ✅ 验证：工具执行成功
    expect(result.success).toBe(true);
    expect(result.stats.entitiesProcessed).toBe(5); // 2个US + 1个UC + 1个FR + 1个约束
    expect(result.error).toBeUndefined();

    // ✅ 验证：文件格式已修复
    const fixedContent = await fs.readFile(testYamlFile, 'utf-8');
    
    // 验证数组格式 (应该包含 "- id:" 而不是 '"0":')
    expect(fixedContent).toContain('user_stories:\n  - id: US-AD-001');
    expect(fixedContent).toContain('use_cases:\n  - id: UC-AD-001');
    expect(fixedContent).toContain('constraints:\n  - id: ADC-CONST-001');
    
    // 验证不再包含对象格式
    expect(fixedContent).not.toContain('"0":');
    expect(fixedContent).not.toContain('"1":');
    
    // 验证functional_requirements保持数组格式不变
    expect(fixedContent).toContain('functional_requirements:\n  - id: FR-AD-001');

    console.log('✅ 数据结构修复功能测试通过');
  });

  test('应该能够处理正确格式的YAML文件而不做修改', async () => {
    // 🎯 准备：创建标准格式的YAML文件
    const correctYaml = `
user_stories:
  - id: US-AD-001
    summary: 广告自动高可用展示
    description:
      - 广告商希望广告页面能自动定时扫描风险并在被标记为风险时自动切换域名，无需人工干预。
    metadata:
      status: draft
      version: "1.0"

functional_requirements:
  - id: FR-AD-001
    summary: 定时页面状态扫描
    source_requirements:
      - US-AD-001
    metadata:
      status: draft
      version: "1.0"

_metadata:
  generated_at: "2025-07-30T10:00:00.000Z"
`;

    await fs.writeFile(testYamlFile, correctYaml, 'utf-8');
    const originalContent = correctYaml;

    // 🚀 执行：运行追溯关系同步工具
    const completer = new TraceabilityCompleter();
    const result = await completer.syncFile({
      description: '测试标准格式文件处理',
      targetFile: testYamlFile
    });

    // ✅ 验证：工具执行成功
    expect(result.success).toBe(true);
    expect(result.stats.entitiesProcessed).toBe(2); // 1个US + 1个FR

    // ✅ 验证：文件结构基本保持不变 (除了追溯关系计算结果)
    const finalContent = await fs.readFile(testYamlFile, 'utf-8');
    
    // 验证依然是数组格式
    expect(finalContent).toContain('user_stories:\n  - id: US-AD-001');
    expect(finalContent).toContain('functional_requirements:\n  - id: FR-AD-001');
    
    // 验证没有引入对象格式
    expect(finalContent).not.toContain('"0":');

    console.log('✅ 标准格式文件处理测试通过');
  });

  test('应该能够处理混合格式的YAML文件', async () => {
    // 🎯 准备：创建部分正确、部分错误的混合格式YAML文件
    const mixedYaml = `
user_stories:
  - id: US-CORRECT-001
    summary: 正确的数组格式
    metadata:
      status: draft
      version: "1.0"

use_cases:
  "0":
    id: UC-WRONG-001
    summary: 错误的对象格式
    metadata:
      status: draft
      version: "1.0"
  "1":
    id: UC-WRONG-002
    summary: 另一个错误的对象格式
    metadata:
      status: draft
      version: "1.0"

functional_requirements:
  - id: FR-CORRECT-001
    summary: 正确的数组格式
    source_requirements:
      - US-CORRECT-001
    metadata:
      status: draft
      version: "1.0"

_metadata:
  generated_at: "2025-07-30T10:00:00.000Z"
`;

    await fs.writeFile(testYamlFile, mixedYaml, 'utf-8');

    // 🚀 执行：运行追溯关系同步工具
    const completer = new TraceabilityCompleter();
    const result = await completer.syncFile({
      description: '测试混合格式文件处理',
      targetFile: testYamlFile
    });

    // ✅ 验证：工具执行成功
    expect(result.success).toBe(true);
    expect(result.stats.entitiesProcessed).toBe(4); // 1个US + 2个UC + 1个FR

    // ✅ 验证：所有字段都变成了数组格式
    const finalContent = await fs.readFile(testYamlFile, 'utf-8');
    
    // 验证user_stories保持数组格式
    expect(finalContent).toContain('user_stories:\n  - id: US-CORRECT-001');
    
    // 验证use_cases从对象格式修复为数组格式
    expect(finalContent).toContain('use_cases:\n  - id: UC-WRONG-001');
    expect(finalContent).toContain('  - id: UC-WRONG-002');
    
    // 验证functional_requirements保持数组格式
    expect(finalContent).toContain('functional_requirements:\n  - id: FR-CORRECT-001');
    
    // 验证不再包含对象格式
    expect(finalContent).not.toContain('"0":');
    expect(finalContent).not.toContain('"1":');

    console.log('✅ 混合格式文件处理测试通过');
  });

  test('应该能够处理empty/null字段而不崩溃', async () => {
    // 🎯 准备：创建包含空字段的YAML文件
    const edgeCaseYaml = `
user_stories: null

use_cases: []

functional_requirements:
  "0":
    id: FR-ONLY-001
    summary: 唯一的功能需求
    metadata:
      status: draft
      version: "1.0"

non_functional_requirements: null
interface_requirements: []
constraints: {}

_metadata:
  generated_at: "2025-07-30T10:00:00.000Z"
`;

    await fs.writeFile(testYamlFile, edgeCaseYaml, 'utf-8');

    // 🚀 执行：运行追溯关系同步工具
    const completer = new TraceabilityCompleter();
    const result = await completer.syncFile({
      description: '测试边界情况处理',
      targetFile: testYamlFile
    });

    // ✅ 验证：工具执行成功且不崩溃
    expect(result.success).toBe(true);
    expect(result.stats.entitiesProcessed).toBe(1); // 只有1个FR

    // ✅ 验证：文件结构正确处理
    const finalContent = await fs.readFile(testYamlFile, 'utf-8');
    
    // 验证functional_requirements从对象格式修复为数组格式
    expect(finalContent).toContain('functional_requirements:\n  - id: FR-ONLY-001');
    
    // 验证空字段保持原样
    expect(finalContent).toContain('user_stories: null');
    expect(finalContent).toContain('use_cases: []');

    console.log('✅ 边界情况处理测试通过');
  });
});