import { SRSConsistencyValidator } from '../../../tools/document/traceabilityCompletion/SRSConsistencyValidator';
import { RequirementEntity, ConsistencyValidationResult } from '../../../tools/document/traceabilityCompletion/types';
import * as fs from 'fs/promises';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock IDParser
jest.mock('../../../tools/document/scaffoldGenerator/IDParser');
import { IDParser } from '../../../tools/document/scaffoldGenerator/IDParser';
const mockIDParser = IDParser as jest.Mocked<typeof IDParser>;

describe('SRSConsistencyValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateConsistency', () => {
    test('应该在ID完全一致时返回成功结果', async () => {
      // 准备测试数据
      const srsContent = `
# SRS文档测试

## 用户故事
US-LOGIN-001: 用户登录功能
US-ADMIN-001: 管理员功能

## 功能需求
FR-LOGIN-001: 登录验证
FR-AUTH-002: 用户认证
      `;
      
      const yamlEntities: RequirementEntity[] = [
        { id: 'US-LOGIN-001', source_requirements: [] },
        { id: 'US-ADMIN-001', source_requirements: [] },
        { id: 'FR-LOGIN-001', source_requirements: ['US-LOGIN-001'] },
        { id: 'FR-AUTH-002', source_requirements: ['US-LOGIN-001'] }
      ];
      
      const extractedIds = [
        { id: 'US-LOGIN-001', type: 'basic' as const, prefix: 'US', fullMatch: 'US-LOGIN-001' },
        { id: 'US-ADMIN-001', type: 'basic' as const, prefix: 'US', fullMatch: 'US-ADMIN-001' },
        { id: 'FR-LOGIN-001', type: 'basic' as const, prefix: 'FR', fullMatch: 'FR-LOGIN-001' },
        { id: 'FR-AUTH-002', type: 'basic' as const, prefix: 'FR', fullMatch: 'FR-AUTH-002' }
      ];

      // Mock 依赖
      mockFs.readFile.mockResolvedValue(srsContent);
      mockIDParser.extractAllIds.mockResolvedValue(extractedIds);

      // 执行测试
      const result = await SRSConsistencyValidator.validateConsistency(
        'SRS.md', 
        yamlEntities
      );

      // 验证结果
      expect(result.consistent).toBe(true);
      expect(result.srsIds).toEqual(['FR-AUTH-002', 'FR-LOGIN-001', 'US-ADMIN-001', 'US-LOGIN-001']);
      expect(result.yamlIds).toEqual(['FR-AUTH-002', 'FR-LOGIN-001', 'US-ADMIN-001', 'US-LOGIN-001']);
      expect(result.missingInYaml).toEqual([]);
      expect(result.missingInSrs).toEqual([]);
      expect(result.statistics.srsTotal).toBe(4);
      expect(result.statistics.yamlTotal).toBe(4);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('应该检测出SRS中存在但YAML中缺失的ID', async () => {
      const srsContent = `
# SRS文档测试
US-LOGIN-001: 用户登录功能
FR-LOGIN-001: 登录验证
NFR-PERF-001: 性能需求
      `;
      
      const yamlEntities: RequirementEntity[] = [
        { id: 'US-LOGIN-001', source_requirements: [] },
        { id: 'FR-LOGIN-001', source_requirements: ['US-LOGIN-001'] }
        // NFR-PERF-001 缺失
      ];
      
      const extractedIds = [
        { id: 'US-LOGIN-001', type: 'basic' as const, prefix: 'US', fullMatch: 'US-LOGIN-001' },
        { id: 'FR-LOGIN-001', type: 'basic' as const, prefix: 'FR', fullMatch: 'FR-LOGIN-001' },
        { id: 'NFR-PERF-001', type: 'basic' as const, prefix: 'NFR', fullMatch: 'NFR-PERF-001' }
      ];

      mockFs.readFile.mockResolvedValue(srsContent);
      mockIDParser.extractAllIds.mockResolvedValue(extractedIds);

      const result = await SRSConsistencyValidator.validateConsistency(
        'SRS.md', 
        yamlEntities
      );

      expect(result.consistent).toBe(false);
      expect(result.missingInYaml).toEqual(['NFR-PERF-001']);
      expect(result.missingInSrs).toEqual([]);
      expect(result.statistics.srsTotal).toBe(3);
      expect(result.statistics.yamlTotal).toBe(2);
    });

    test('应该检测出YAML中存在但SRS中缺失的ID', async () => {
      const srsContent = `
# SRS文档测试
US-LOGIN-001: 用户登录功能
FR-LOGIN-001: 登录验证
      `;
      
      const yamlEntities: RequirementEntity[] = [
        { id: 'US-LOGIN-001', source_requirements: [] },
        { id: 'FR-LOGIN-001', source_requirements: ['US-LOGIN-001'] },
        { id: 'NFR-PERF-001', source_requirements: ['FR-LOGIN-001'] } // SRS中不存在
      ];
      
      const extractedIds = [
        { id: 'US-LOGIN-001', type: 'basic' as const, prefix: 'US', fullMatch: 'US-LOGIN-001' },
        { id: 'FR-LOGIN-001', type: 'basic' as const, prefix: 'FR', fullMatch: 'FR-LOGIN-001' }
      ];

      mockFs.readFile.mockResolvedValue(srsContent);
      mockIDParser.extractAllIds.mockResolvedValue(extractedIds);

      const result = await SRSConsistencyValidator.validateConsistency(
        'SRS.md', 
        yamlEntities
      );

      expect(result.consistent).toBe(false);
      expect(result.missingInYaml).toEqual([]);
      expect(result.missingInSrs).toEqual(['NFR-PERF-001']);
      expect(result.statistics.srsTotal).toBe(2);
      expect(result.statistics.yamlTotal).toBe(3);
    });

    test('应该正确生成按类型分组的统计信息', async () => {
      const srsContent = `
US-LOGIN-001: 用户登录
UC-AUTH-001: 认证用例
FR-LOGIN-001: 登录功能
NFR-PERF-001: 性能需求
ADC-ASSU-001: 假设条件
      `;
      
      const yamlEntities: RequirementEntity[] = [
        { id: 'US-LOGIN-001', source_requirements: [] },
        { id: 'UC-AUTH-001', source_requirements: [] },
        { id: 'FR-LOGIN-001', source_requirements: ['US-LOGIN-001'] },
        { id: 'NFR-PERF-001', source_requirements: ['FR-LOGIN-001'] },
        { id: 'ADC-ASSU-001', source_requirements: [] }
      ];
      
      const extractedIds = [
        { id: 'US-LOGIN-001', type: 'basic' as const, prefix: 'US', fullMatch: 'US-LOGIN-001' },
        { id: 'UC-AUTH-001', type: 'basic' as const, prefix: 'UC', fullMatch: 'UC-AUTH-001' },
        { id: 'FR-LOGIN-001', type: 'basic' as const, prefix: 'FR', fullMatch: 'FR-LOGIN-001' },
        { id: 'NFR-PERF-001', type: 'basic' as const, prefix: 'NFR', fullMatch: 'NFR-PERF-001' },
        { id: 'ADC-ASSU-001', type: 'adc' as const, prefix: 'ADC', subType: 'ASSU', fullMatch: 'ADC-ASSU-001' }
      ];

      mockFs.readFile.mockResolvedValue(srsContent);
      mockIDParser.extractAllIds.mockResolvedValue(extractedIds);

      const result = await SRSConsistencyValidator.validateConsistency(
        'SRS.md', 
        yamlEntities
      );

      expect(result.consistent).toBe(true);
      expect(result.statistics.byType).toEqual({
        'US': { srs: 1, yaml: 1, missing: 0 },
        'UC': { srs: 1, yaml: 1, missing: 0 },
        'FR': { srs: 1, yaml: 1, missing: 0 },
        'NFR': { srs: 1, yaml: 1, missing: 0 },
        'ADC-ASSU': { srs: 1, yaml: 1, missing: 0 }
      });
    });

    test('应该处理空ID的情况', async () => {
      const srsContent = `
US-LOGIN-001: 用户登录
FR-LOGIN-001: 登录功能
      `;
      
      const yamlEntities: RequirementEntity[] = [
        { id: 'US-LOGIN-001', source_requirements: [] },
        { id: '', source_requirements: [] }, // 空ID，应该被过滤
        { id: 'FR-LOGIN-001', source_requirements: ['US-LOGIN-001'] }
      ];
      
      const extractedIds = [
        { id: 'US-LOGIN-001', type: 'basic' as const, prefix: 'US', fullMatch: 'US-LOGIN-001' },
        { id: 'FR-LOGIN-001', type: 'basic' as const, prefix: 'FR', fullMatch: 'FR-LOGIN-001' }
      ];

      mockFs.readFile.mockResolvedValue(srsContent);
      mockIDParser.extractAllIds.mockResolvedValue(extractedIds);

      const result = await SRSConsistencyValidator.validateConsistency(
        'SRS.md', 
        yamlEntities
      );

      expect(result.consistent).toBe(true);
      expect(result.yamlIds).toEqual(['FR-LOGIN-001', 'US-LOGIN-001']);
    });

    test('应该在SRS文件不存在时抛出错误', async () => {
      const yamlEntities: RequirementEntity[] = [
        { id: 'US-LOGIN-001', source_requirements: [] }
      ];

      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(
        SRSConsistencyValidator.validateConsistency('nonexistent.md', yamlEntities)
      ).rejects.toThrow('SRS-YAML ID一致性验证失败');
    });

    test('应该在SRS文件为空时抛出错误', async () => {
      const yamlEntities: RequirementEntity[] = [
        { id: 'US-LOGIN-001', source_requirements: [] }
      ];

      mockFs.readFile.mockResolvedValue('   \n  \t  '); // 空白内容

      await expect(
        SRSConsistencyValidator.validateConsistency('empty.md', yamlEntities)
      ).rejects.toThrow('SRS文件内容为空');
    });

    test('应该在IDParser失败时抛出错误', async () => {
      const yamlEntities: RequirementEntity[] = [
        { id: 'US-LOGIN-001', source_requirements: [] }
      ];

      mockFs.readFile.mockResolvedValue('SRS content');
      mockIDParser.extractAllIds.mockRejectedValue(new Error('Parser failed'));

      await expect(
        SRSConsistencyValidator.validateConsistency('SRS.md', yamlEntities)
      ).rejects.toThrow('SRS-YAML ID一致性验证失败');
    });
  });
});
