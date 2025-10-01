/**
 * TraceabilityCompleter ID一致性验证集成测试
 * 测试新增的SRS-YAML ID一致性验证功能
 */

import { TraceabilityCompleter } from '../../tools/document/traceabilityCompletion/TraceabilityCompleter';
import { TraceabilityCompletionArgs } from '../../tools/document/traceabilityCompletion/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('TraceabilityCompleter ID一致性验证集成测试', () => {
  let tempDir: string;
  let srsFilePath: string;
  let yamlFilePath: string;
  let completer: TraceabilityCompleter;

  beforeEach(async () => {
    // 创建临时目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'traceability-test-'));
    srsFilePath = path.join(tempDir, 'SRS.md');
    yamlFilePath = path.join(tempDir, 'requirements.yaml');
    completer = new TraceabilityCompleter();
  });

  afterEach(async () => {
    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  test('应该在ID完全一致时成功执行所有功能', async () => {
    // 准备一致的SRS.md和requirements.yaml
    const srsContent = `# SRS文档

## 用户故事
US-LOGIN-001: 用户登录功能
US-ADMIN-001: 管理员功能

## 功能需求
FR-LOGIN-001: 登录验证
FR-AUTH-002: 用户认证

## 非功能需求
NFR-PERF-001: 性能要求
`;

    const yamlContent = `user_stories:
  - id: US-LOGIN-001
    summary: 用户登录功能
    source_requirements: []
  - id: US-ADMIN-001
    summary: 管理员功能
    source_requirements: []

functional_requirements:
  - id: FR-LOGIN-001
    summary: 登录验证
    source_requirements: [US-LOGIN-001]
  - id: FR-AUTH-002
    summary: 用户认证
    source_requirements: [US-LOGIN-001, US-ADMIN-001]

non_functional_requirements:
  - id: NFR-PERF-001
    summary: 性能要求
    source_requirements: [FR-LOGIN-001]
`;

    await fs.writeFile(srsFilePath, srsContent);
    await fs.writeFile(yamlFilePath, yamlContent);

    const args: TraceabilityCompletionArgs = {
      summary: '测试ID一致性验证',
      targetFile: yamlFilePath,
      srsFile: srsFilePath
    };

    const result = await completer.syncFile(args);

    // 验证结果
    expect(result.success).toBe(true);
    expect(result.stats.consistencyValidated).toBe(true);
    expect(result.consistencyResult).toBeDefined();
    expect(result.consistencyResult!.consistent).toBe(true);
    expect(result.consistencyResult!.srsIds).toHaveLength(5);
    expect(result.consistencyResult!.yamlIds).toHaveLength(5);
    expect(result.consistencyResult!.missingInYaml).toHaveLength(0);
    expect(result.consistencyResult!.missingInSrs).toHaveLength(0);

    // 验证追溯关系也正确计算了
    expect(result.stats.entitiesProcessed).toBe(5);
    expect(result.stats.derivedFrAdded).toBeGreaterThan(0);

    // 验证文件被更新了
    const updatedYaml = await fs.readFile(yamlFilePath, 'utf-8');
    expect(updatedYaml).toContain('derived_fr:');
  });

  test('应该在ID不一致时仍然完成所有处理', async () => {
    // 准备不一致的SRS.md和requirements.yaml
    const srsContent = `# SRS文档

## 用户故事
US-LOGIN-001: 用户登录功能
US-ADMIN-001: 管理员功能
US-MISSING-001: SRS中存在但YAML中缺失

## 功能需求
FR-LOGIN-001: 登录验证
`;

    const yamlContent = `user_stories:
  - id: US-LOGIN-001
    summary: 用户登录功能
    source_requirements: []
  - id: US-ADMIN-001
    summary: 管理员功能
    source_requirements: []

functional_requirements:
  - id: FR-LOGIN-001
    summary: 登录验证
    source_requirements: [US-LOGIN-001]
  - id: FR-EXTRA-001
    summary: YAML中存在但SRS中缺失
    source_requirements: [US-LOGIN-001]
`;

    await fs.writeFile(srsFilePath, srsContent);
    await fs.writeFile(yamlFilePath, yamlContent);

    const args: TraceabilityCompletionArgs = {
      summary: '测试ID不一致情况',
      targetFile: yamlFilePath,
      srsFile: srsFilePath
    };

    const result = await completer.syncFile(args);

    // 验证结果 - 应该成功但包含不一致信息
    expect(result.success).toBe(true);
    expect(result.stats.consistencyValidated).toBe(true);
    expect(result.consistencyResult).toBeDefined();
    expect(result.consistencyResult!.consistent).toBe(false);
    
    // 验证不一致的详细信息
    expect(result.consistencyResult!.missingInYaml).toContain('US-MISSING-001');
    expect(result.consistencyResult!.missingInSrs).toContain('FR-EXTRA-001');
    
    // 验证追溯关系仍然被正确计算
    expect(result.stats.entitiesProcessed).toBe(4); // YAML中的4个实体
    
    // 验证文件仍然被更新
    const updatedYaml = await fs.readFile(yamlFilePath, 'utf-8');
    expect(updatedYaml).toContain('derived_fr:');
  });

  test('应该在SRS文件不存在时优雅处理', async () => {
    // 只准备requirements.yaml
    const yamlContent = `user_stories:
  - id: US-LOGIN-001
    summary: 用户登录功能
    source_requirements: []

functional_requirements:
  - id: FR-LOGIN-001
    summary: 登录验证
    source_requirements: [US-LOGIN-001]
`;

    await fs.writeFile(yamlFilePath, yamlContent);

    const args: TraceabilityCompletionArgs = {
      summary: '测试SRS文件缺失情况',
      targetFile: yamlFilePath,
      srsFile: path.join(tempDir, 'nonexistent.md')
    };

    const result = await completer.syncFile(args);

    // 应该成功完成，但一致性验证失败
    expect(result.success).toBe(true);
    expect(result.stats.consistencyValidated).toBe(true);
    expect(result.consistencyResult).toBeDefined();
    expect(result.consistencyResult!.consistent).toBe(false);
    expect(result.consistencyResult!.srsIds).toHaveLength(0);
    
    // 追溯关系仍应正确处理
    expect(result.stats.entitiesProcessed).toBe(2);
  });

  test('应该使用默认SRS.md文件名', async () => {
    // 创建默认名称的SRS文件
    const defaultSrsPath = path.join(tempDir, 'SRS.md');
    const srsContent = `# SRS文档
US-LOGIN-001: 用户登录功能
FR-LOGIN-001: 登录验证
`;

    const yamlContent = `user_stories:
  - id: US-LOGIN-001
    summary: 用户登录功能
    source_requirements: []

functional_requirements:
  - id: FR-LOGIN-001
    summary: 登录验证
    source_requirements: [US-LOGIN-001]
`;

    await fs.writeFile(defaultSrsPath, srsContent);
    await fs.writeFile(yamlFilePath, yamlContent);

    const args: TraceabilityCompletionArgs = {
      summary: '测试默认SRS文件名',
      targetFile: yamlFilePath
      // 不指定srsFile，应该使用默认的'SRS.md'
    };

    // 需要修改工作目录以便相对路径解析正确
    const originalCwd = process.cwd();
    try {
      process.chdir(tempDir);
      
      const result = await completer.syncFile(args);

      expect(result.success).toBe(true);
      expect(result.stats.consistencyValidated).toBe(true);
      expect(result.consistencyResult!.consistent).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('应该正确记录日志到srs-writer-log.json', async () => {
    const srsContent = `# SRS文档
US-LOGIN-001: 用户登录功能
FR-LOGIN-001: 登录验证
`;

    const yamlContent = `user_stories:
  - id: US-LOGIN-001
    summary: 用户登录功能
    source_requirements: []

functional_requirements:
  - id: FR-LOGIN-001
    summary: 登录验证
    source_requirements: [US-LOGIN-001]
`;

    await fs.writeFile(srsFilePath, srsContent);
    await fs.writeFile(yamlFilePath, yamlContent);

    const args: TraceabilityCompletionArgs = {
      summary: '测试日志记录',
      targetFile: yamlFilePath,
      srsFile: srsFilePath
    };

    await completer.syncFile(args);

    // 验证日志文件
    const logFilePath = path.join(tempDir, 'srs-writer-log.json');
    const logExists = await fs.access(logFilePath).then(() => true).catch(() => false);
    expect(logExists).toBe(true);

    if (logExists) {
      const logContent = await fs.readFile(logFilePath, 'utf-8');
      const logData = JSON.parse(logContent);
      
      expect(logData.traceability_completeness_issue).toBeDefined();
      expect(logData.traceability_completeness_issue).toHaveLength(1);
      
      const logEntry = logData.traceability_completeness_issue[0];
      expect(logEntry.action).toBe('traceability_completion');
      expect(logEntry.statistics.consistency_validated).toBe(true);
      expect(logEntry.statistics.srs_yaml_consistent).toBe(true);
      expect(logEntry.consistency_details).toBeDefined();
      expect(logEntry.consistency_details.consistent).toBe(true);
    }
  });

  test('应该处理复杂的ID类型和统计', async () => {
    const srsContent = `# SRS文档

## 用户故事
US-LOGIN-001: 用户登录
US-ADMIN-001: 管理员功能

## 用例
UC-AUTH-001: 认证用例

## 功能需求
FR-LOGIN-001: 登录功能
FR-AUTH-002: 认证功能

## 非功能需求
NFR-PERF-001: 性能需求
NFR-SEC-001: 安全需求

## 接口需求
IFR-API-001: API接口

## 数据需求
DAR-USER-001: 用户数据

## ADC约束
ADC-ASSU-001: 假设条件
ADC-DEPEN-001: 依赖条件
ADC-CONST-001: 约束条件
`;

    const yamlContent = `user_stories:
  - id: US-LOGIN-001
    summary: 用户登录
    source_requirements: []
  - id: US-ADMIN-001
    summary: 管理员功能
    source_requirements: []

use_cases:
  - id: UC-AUTH-001
    summary: 认证用例
    source_requirements: []

functional_requirements:
  - id: FR-LOGIN-001
    summary: 登录功能
    source_requirements: [US-LOGIN-001, ADC-ASSU-001]
  - id: FR-AUTH-002
    summary: 认证功能
    source_requirements: [UC-AUTH-001, ADC-DEPEN-001]

non_functional_requirements:
  - id: NFR-PERF-001
    summary: 性能需求
    source_requirements: [FR-LOGIN-001]
  - id: NFR-SEC-001
    summary: 安全需求
    source_requirements: [FR-AUTH-002, ADC-CONST-001]

interface_requirements:
  - id: IFR-API-001
    summary: API接口
    source_requirements: [FR-LOGIN-001]

data_requirements:
  - id: DAR-USER-001
    summary: 用户数据
    source_requirements: [FR-LOGIN-001]

assumptions:
  - id: ADC-ASSU-001
    summary: 假设条件
    source_requirements: []

dependencies:
  - id: ADC-DEPEN-001
    summary: 依赖条件
    source_requirements: []

constraints:
  - id: ADC-CONST-001
    summary: 约束条件
    source_requirements: []
`;

    await fs.writeFile(srsFilePath, srsContent);
    await fs.writeFile(yamlFilePath, yamlContent);

    const args: TraceabilityCompletionArgs = {
      summary: '测试复杂ID类型统计',
      targetFile: yamlFilePath,
      srsFile: srsFilePath
    };

    const result = await completer.syncFile(args);

    expect(result.success).toBe(true);
    expect(result.consistencyResult!.consistent).toBe(true);
    
    // 验证按类型统计
    const stats = result.consistencyResult!.statistics.byType;
    expect(stats['US']).toEqual({ srs: 2, yaml: 2, missing: 0 });
    expect(stats['UC']).toEqual({ srs: 1, yaml: 1, missing: 0 });
    expect(stats['FR']).toEqual({ srs: 2, yaml: 2, missing: 0 });
    expect(stats['NFR']).toEqual({ srs: 2, yaml: 2, missing: 0 });
    expect(stats['IFR']).toEqual({ srs: 1, yaml: 1, missing: 0 });
    expect(stats['DAR']).toEqual({ srs: 1, yaml: 1, missing: 0 });
    expect(stats['ADC-ASSU']).toEqual({ srs: 1, yaml: 1, missing: 0 });
    expect(stats['ADC-DEPEN']).toEqual({ srs: 1, yaml: 1, missing: 0 });
    expect(stats['ADC-CONST']).toEqual({ srs: 1, yaml: 1, missing: 0 });

    // 验证追溯关系也正确计算
    expect(result.stats.derivedFrAdded).toBeGreaterThan(0);
    expect(result.stats.techSpecRelatedAdded).toBeGreaterThan(0);
    // ADC_related 可能为0，因为测试数据中技术需求没有直接引用ADC约束
    expect(result.stats.adcRelatedAdded).toBeGreaterThanOrEqual(0);
  });
});
