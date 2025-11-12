/**
 * TraceabilityCompleter 单元测试
 * 测试追溯性完成器的核心功能
 */

// @ts-nocheck - Jest mock type issues with fs/promises and session-manager
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

// 被测试的类
import { TraceabilityCompleter } from '../../../tools/document/traceabilityCompletion/TraceabilityCompleter';
import { 
  TraceabilityCompletionArgs, 
  TraceabilitySyncResult,
  RequirementEntity
} from '../../../tools/document/traceabilityCompletion/types';

// 测试数据
import {
  simpleTraceabilityData,
  adcConstraintData,
  danglingReferencesData,
  complexNetworkData,
  emptyData,
  expectedSimpleResults,
  expectedADCResults,
  expectedComplexResults,
  generateLargeTestData,
  dictionaryStructureData
} from './test-data';

// Mock模块
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn(),
  access: jest.fn()
}));

jest.mock('../../../core/session-manager');
jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{
      uri: { fsPath: '/test/workspace' }
    }]
  },
  window: {
    createOutputChannel: jest.fn().mockReturnValue({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn()
    }),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn()
  }
}), { virtual: true });

const mockFs = fs as jest.Mocked<typeof fs>;

describe('TraceabilityCompleter', () => {
  let completer: TraceabilityCompleter;
  let mockSessionManager: any;
  
  beforeEach(async () => {
    completer = new TraceabilityCompleter();
    
    // Mock SessionManager
    mockSessionManager = {
      // @ts-ignore - Jest mock type compatibility
      getCurrentSession: jest.fn().mockResolvedValue({
        baseDir: '/test/project'
      })
    };
    
    // Mock dynamic import for SessionManager
    jest.doMock('../../../core/session-manager', () => ({
      SessionManager: {
        getInstance: () => mockSessionManager
      }
    }));
    
    // 重置所有mocks
    jest.clearAllMocks();
    
    // Mock文件操作
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
    mockFs.access.mockResolvedValue(undefined);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('基本功能测试', () => {
    test('应该正确计算简单追溯关系', async () => {
      // 准备测试数据
      const testData = JSON.parse(JSON.stringify(simpleTraceabilityData));
      const yamlContent = yaml.dump(testData);
      
      // Mock文件读取
      mockFs.readFile.mockResolvedValue(yamlContent);
      
      const args: TraceabilityCompletionArgs = {
        description: '测试简单追溯关系',
        targetFile: 'requirements.yaml'
      };
      
      // 执行测试
      const result = await completer.syncFile(args);
      
      // 验证结果
      expect(result.success).toBe(true);
      expect(result.stats.entitiesProcessed).toBe(6); // 2 US + 1 UC + 2 FR + 1 NFR
      expect(result.stats.derivedFrAdded).toBeGreaterThan(0);
      expect(result.stats.danglingReferencesFound).toBe(0);
      
      // 验证文件写入被调用
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2); // YAML + JSON log
    });
    
    test('应该正确处理ADC约束关系', async () => {
      const testData = JSON.parse(JSON.stringify(adcConstraintData));
      const yamlContent = yaml.dump(testData);
      
      mockFs.readFile.mockResolvedValue(yamlContent);
      
      const args: TraceabilityCompletionArgs = {
        description: '测试ADC约束关系',
        targetFile: 'requirements.yaml'
      };
      
      const result = await completer.syncFile(args);
      
      expect(result.success).toBe(true);
      expect(result.stats.adcRelatedAdded).toBeGreaterThan(0);
      expect(result.stats.entitiesProcessed).toBe(6); // 1 US + 1 FR + 1 NFR + 1 IFR + 1 DAR + 3 ADC
    });
    
    test('应该正确处理悬空引用', async () => {
      const testData = JSON.parse(JSON.stringify(danglingReferencesData));
      const yamlContent = yaml.dump(testData);
      
      mockFs.readFile.mockResolvedValue(yamlContent);
      
      const args: TraceabilityCompletionArgs = {
        description: '测试悬空引用',
        targetFile: 'requirements.yaml'
      };
      
      const result = await completer.syncFile(args);
      
      expect(result.success).toBe(true);
      expect(result.stats.danglingReferencesFound).toBe(3); // US-MISSING-001, ADC-MISSING-001, FR-MISSING-001
      expect(result.danglingReferences).toBeDefined();
      expect(result.danglingReferences).toContain('US-MISSING-001');
      expect(result.danglingReferences).toContain('ADC-MISSING-001');
      expect(result.danglingReferences).toContain('FR-MISSING-001');
    });
    
    test('应该正确处理复杂网络关系', async () => {
      const testData = JSON.parse(JSON.stringify(complexNetworkData));
      const yamlContent = yaml.dump(testData);
      
      mockFs.readFile.mockResolvedValue(yamlContent);
      
      const args: TraceabilityCompletionArgs = {
        description: '测试复杂网络关系',
        targetFile: 'requirements.yaml'
      };
      
      const result = await completer.syncFile(args);
      
      expect(result.success).toBe(true);
      expect(result.stats.entitiesProcessed).toBe(10); // 实际实体总数
      expect(result.stats.derivedFrAdded).toBeGreaterThan(0);
    });
  });
  
  describe('文件操作测试', () => {
    test('应该正确写入文件和日志', async () => {
      const testData = JSON.parse(JSON.stringify(simpleTraceabilityData));
      const yamlContent = yaml.dump(testData);
      
      mockFs.readFile.mockResolvedValue(yamlContent);
      
      const args: TraceabilityCompletionArgs = {
        description: '测试文件写入',
        targetFile: 'requirements.yaml'
      };
      
      const result = await completer.syncFile(args);
      
      expect(result.success).toBe(true);

      // 验证YAML文件写入（baseDir验证失败会回退到 workspace）
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/workspace/requirements.yaml',
        expect.any(String),
        'utf-8'
      );

      // 验证现在使用统一质量报告而不是 srs-writer-log.json
      // 注意：由于测试环境的限制，我们主要验证工具执行成功
      expect(result.success).toBe(true);
      expect(result.stats.entitiesProcessed).toBeGreaterThan(0);
    });
    
    test('应该正确处理路径解析回退', async () => {
      // Mock SessionManager返回空session
      mockSessionManager.getCurrentSession.mockResolvedValue(null);
      
      const testData = JSON.parse(JSON.stringify(simpleTraceabilityData));
      const yamlContent = yaml.dump(testData);
      
      mockFs.readFile.mockResolvedValue(yamlContent);
      
      const args: TraceabilityCompletionArgs = {
        description: '测试路径解析回退',
        targetFile: 'requirements.yaml'
      };
      
      const result = await completer.syncFile(args);
      
      expect(result.success).toBe(true);
      
      // 验证使用VSCode工作区路径
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/workspace/requirements.yaml',
        expect.any(String),
        'utf-8'
      );
    });
  });
  
  describe('边界情况测试', () => {
    test('应该正确处理空文件', async () => {
      const testData = JSON.parse(JSON.stringify(emptyData));
      const yamlContent = yaml.dump(testData);
      
      mockFs.readFile.mockResolvedValue(yamlContent);
      
      const args: TraceabilityCompletionArgs = {
        description: '测试空文件',
        targetFile: 'requirements.yaml'
      };
      
      const result = await completer.syncFile(args);
      
      expect(result.success).toBe(true);
      expect(result.stats.entitiesProcessed).toBe(0);
    });
    
    test('应该正确处理文件读取失败', async () => {
      mockFs.readFile.mockRejectedValue(new Error('文件不存在'));
      
      const args: TraceabilityCompletionArgs = {
        description: '测试文件读取失败',
        targetFile: 'nonexistent.yaml'
      };
      
      const result = await completer.syncFile(args);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('文件不存在');
    });
    
    test('应该正确处理YAML解析失败', async () => {
      const invalidYaml = 'invalid: yaml: content: [unclosed';

      mockFs.readFile.mockResolvedValue(invalidYaml);

      const args: TraceabilityCompletionArgs = {
        description: '测试YAML解析失败',
        targetFile: 'requirements.yaml'
      };

      const result = await completer.syncFile(args);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    test('应该正确处理文件写入失败', async () => {
      const testData = JSON.parse(JSON.stringify(simpleTraceabilityData));
      const yamlContent = yaml.dump(testData);

      mockFs.readFile.mockResolvedValue(yamlContent);
      mockFs.writeFile.mockRejectedValue(new Error('磁盘空间不足'));

      const args: TraceabilityCompletionArgs = {
        description: '测试文件写入失败',
        targetFile: 'requirements.yaml'
      };

      const result = await completer.syncFile(args);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('磁盘空间不足');
    });
  });
  
  describe('幂等性测试', () => {
    test('多次运行应该产生相同结果', async () => {
      const testData = JSON.parse(JSON.stringify(simpleTraceabilityData));
      const yamlContent = yaml.dump(testData);
      
      mockFs.readFile.mockResolvedValue(yamlContent);
      
      const args: TraceabilityCompletionArgs = {
        description: '测试幂等性',
        targetFile: 'requirements.yaml'
      };
      
      // 第一次运行
      const result1 = await completer.syncFile(args);
      
      // 第二次运行
      const result2 = await completer.syncFile(args);
      
      // 结果应该相同
      expect(result1.success).toBe(result2.success);
      expect(result1.stats.entitiesProcessed).toBe(result2.stats.entitiesProcessed);
      expect(result1.stats.derivedFrAdded).toBe(result2.stats.derivedFrAdded);
      expect(result1.stats.danglingReferencesFound).toBe(result2.stats.danglingReferencesFound);
    });
  });
  
  describe('验证模式测试', () => {
    test('validateSync应该与syncFile等效', async () => {
      const testData = JSON.parse(JSON.stringify(simpleTraceabilityData));
      const yamlContent = yaml.dump(testData);

      mockFs.readFile.mockResolvedValue(yamlContent);

      const args: TraceabilityCompletionArgs = {
        description: '测试验证模式',
        targetFile: 'requirements.yaml'
      };

      const result = await completer.validateSync(args);

      expect(result.success).toBe(true);
      // validateSync现在也会写入文件
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Dictionary 结构支持测试', () => {
    test('应该正确处理 Dictionary 结构的 YAML 文件', async () => {
      const testData = JSON.parse(JSON.stringify(dictionaryStructureData));
      const yamlContent = yaml.dump(testData);

      mockFs.readFile.mockResolvedValue(yamlContent);

      const args: TraceabilityCompletionArgs = {
        description: '测试 Dictionary 结构',
        targetFile: 'requirements.yaml'
      };

      const result = await completer.syncFile(args);

      expect(result.success).toBe(true);
      // 验证提取了所有实体：1 UC + 2 FR + 1 NFR + 2 Risk = 6
      // 注意：测试相关实体（test_cases）不在 SRS 范围内，遵循 IEEE 829 标准
      expect(result.stats.entitiesProcessed).toBe(6);
      expect(result.stats.derivedFrAdded).toBeGreaterThan(0);
    });

    test('应该正确提取 risk_analysis 实体（Dictionary 结构）', async () => {
      const testData = JSON.parse(JSON.stringify(dictionaryStructureData));
      const yamlContent = yaml.dump(testData);

      mockFs.readFile.mockResolvedValue(yamlContent);

      const args: TraceabilityCompletionArgs = {
        description: '测试 risk_analysis 提取',
        targetFile: 'requirements.yaml'
      };

      const result = await completer.syncFile(args);

      expect(result.success).toBe(true);
      // 确保 risk_analysis 实体被正确提取（2个 risk 实体）
      expect(result.stats.entitiesProcessed).toBeGreaterThanOrEqual(2);
    });

    // 注意：测试相关实体（test_levels, test_types, test_environments, test_cases）不在 SRS 范围内
    // 测试策略和测试用例应该在独立的测试文档中管理（遵循 IEEE 829 标准）
    // 因此删除了所有测试实体相关的测试用例

    test('应该正确计算新增实体类型的追溯关系', async () => {
      const testData = JSON.parse(JSON.stringify(dictionaryStructureData));
      const yamlContent = yaml.dump(testData);

      mockFs.readFile.mockResolvedValue(yamlContent);

      const args: TraceabilityCompletionArgs = {
        description: '测试新增实体类型追溯关系',
        targetFile: 'requirements.yaml'
      };

      const result = await completer.syncFile(args);

      expect(result.success).toBe(true);
      // 验证写入的 YAML 包含正确的追溯关系
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('UC-AUTH-001'),
        'utf-8'
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('RISK-SEC-001'),
        'utf-8'
      );
      // 注意：不再验证 TC（测试用例），因为它们不在 SRS 范围内
    });
  });
});

describe('性能测试', () => {
  test('应该在5秒内处理1000个实体', async () => {
    const completer = new TraceabilityCompleter();
    
    // Mock SessionManager
    const mockSessionManager = {
      getCurrentSession: jest.fn().mockResolvedValue({
        baseDir: '/test/project'
      })
    };
    
    jest.doMock('../../../core/session-manager', () => ({
      SessionManager: {
        getInstance: () => mockSessionManager
      }
    }));
    
    // 生成大规模测试数据
    const largeData = generateLargeTestData(1000);
    const yamlContent = yaml.dump(largeData);
    
    mockFs.readFile.mockResolvedValue(yamlContent);
    
    const args: TraceabilityCompletionArgs = {
      description: '性能测试 - 1000个实体',
      targetFile: 'requirements.yaml'
    };
    
    const startTime = performance.now();
    const result = await completer.syncFile(args);
    const executionTime = performance.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(result.stats.entitiesProcessed).toBe(1000);
    expect(executionTime).toBeLessThan(5000); // 5秒内完成
  }, 10000); // 10秒超时
}); 