/**
 * Traceability Completion Tool 集成测试
 * 测试整个工具的端到端功能
 */

import { describe, test, expect } from '@jest/globals';
import { traceabilityCompletionTool } from '../../tools/document/traceabilityCompletionTools';
import { EntityTypeClassifier } from '../../tools/document/traceabilityCompletion/EntityTypeClassifier';
import { TraceabilityMapBuilder } from '../../tools/document/traceabilityCompletion/TraceabilityMapBuilder';
import { DerivedFRComputer } from '../../tools/document/traceabilityCompletion/DerivedFRComputer';
import { ADCRelatedComputer } from '../../tools/document/traceabilityCompletion/ADCRelatedComputer';
import { TechSpecRelatedComputer } from '../../tools/document/traceabilityCompletion/TechSpecRelatedComputer';

describe('Traceability Completion Tool 集成测试', () => {
  
  describe('EntityTypeClassifier 单元测试', () => {
    test('应该正确识别业务需求', () => {
      expect(EntityTypeClassifier.isBusinessRequirement('US-TEST-001')).toBe(true);
      expect(EntityTypeClassifier.isBusinessRequirement('UC-TEST-001')).toBe(true);
      expect(EntityTypeClassifier.isBusinessRequirement('FR-TEST-001')).toBe(false);
      expect(EntityTypeClassifier.isBusinessRequirement('')).toBe(false);
      expect(EntityTypeClassifier.isBusinessRequirement(null as any)).toBe(false);
    });
    
    test('应该正确识别技术需求', () => {
      expect(EntityTypeClassifier.isTechnicalRequirement('FR-TEST-001')).toBe(true);
      expect(EntityTypeClassifier.isTechnicalRequirement('NFR-TEST-001')).toBe(true);
      expect(EntityTypeClassifier.isTechnicalRequirement('IFR-TEST-001')).toBe(true);
      expect(EntityTypeClassifier.isTechnicalRequirement('DAR-TEST-001')).toBe(true);
      expect(EntityTypeClassifier.isTechnicalRequirement('US-TEST-001')).toBe(false);
    });
    
    test('应该正确识别ADC约束', () => {
      expect(EntityTypeClassifier.isADCConstraint('ADC-ASSU-001')).toBe(true);
      expect(EntityTypeClassifier.isADCConstraint('ADC-DEPEN-001')).toBe(true);
      expect(EntityTypeClassifier.isADCConstraint('ADC-CONST-001')).toBe(true);
      expect(EntityTypeClassifier.isADCConstraint('FR-TEST-001')).toBe(false);
    });
    
    test('应该正确验证ID格式', () => {
      const validResult = EntityTypeClassifier.validateIdFormat('US-TEST-001');
      expect(validResult.valid).toBe(true);
      
      const invalidResult = EntityTypeClassifier.validateIdFormat('INVALID-001');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('ID前缀不符合规范');
      
      const emptyResult = EntityTypeClassifier.validateIdFormat('');
      expect(emptyResult.valid).toBe(false);
      expect(emptyResult.error).toContain('ID不能为空');
    });
    
    test('应该正确获取实体类型描述', () => {
      expect(EntityTypeClassifier.getEntityTypeDescription('US-TEST-001')).toBe('用户故事');
      expect(EntityTypeClassifier.getEntityTypeDescription('FR-TEST-001')).toBe('功能需求');
      expect(EntityTypeClassifier.getEntityTypeDescription('ADC-ASSU-001')).toBe('ADC假设');
      expect(EntityTypeClassifier.getEntityTypeDescription('UNKNOWN-001')).toBe('未知类型');
    });
  });
  
  describe('TraceabilityMapBuilder 单元测试', () => {
    test('应该正确构建基本追溯映射', () => {
      const entities = [
        { id: 'US-001', source_requirements: [] },
        { id: 'FR-001', source_requirements: ['US-001'] },
        { id: 'NFR-001', source_requirements: ['US-001'] }
      ];
      
      const map = TraceabilityMapBuilder.buildMap(entities);
      
      expect(map.sourceToDependent.get('US-001')).toEqual(new Set(['FR-001', 'NFR-001']));
      expect(map.dependentToSource.get('FR-001')).toEqual(new Set(['US-001']));
      expect(map.dependentToSource.get('NFR-001')).toEqual(new Set(['US-001']));
    });
    
    test('应该正确检测悬空引用', () => {
      const entities = [
        { id: 'US-001', source_requirements: [] },
        { id: 'FR-001', source_requirements: ['US-001', 'US-MISSING'] }
      ];
      
      const map = TraceabilityMapBuilder.buildMap(entities);
      
      expect(map.danglingReferences.has('US-MISSING')).toBe(true);
      expect(map.danglingReferences.has('US-001')).toBe(false);
    });
    
    test('应该正确构建ADC映射', () => {
      const entities = [
        { id: 'ADC-ASSU-001', title: 'Test assumption', impacted_requirements: ['FR-001'] },
        { id: 'FR-001', source_requirements: ['US-001'] },
        { id: 'US-001', source_requirements: [] }
      ];
      
      const map = TraceabilityMapBuilder.buildMap(entities);
      
      expect(map.technicalToADC.get('FR-001')).toEqual(new Set(['ADC-ASSU-001']));
    });
    
    test('应该正确验证映射表一致性', () => {
      const entities = [
        { id: 'US-001', source_requirements: [] },
        { id: 'FR-001', source_requirements: ['US-001'] }
      ];
      
      const map = TraceabilityMapBuilder.buildMap(entities);
      const validation = TraceabilityMapBuilder.validateMapConsistency(map);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
  
  describe('DerivedFRComputer 单元测试', () => {
    test('应该正确计算derived_fr字段', () => {
      const entities = [
        { id: 'US-001' },
        { id: 'FR-001', source_requirements: ['US-001'] },
        { id: 'NFR-001', source_requirements: ['US-001'] }
      ];
      
      const map = TraceabilityMapBuilder.buildMap(entities);
      const stats = DerivedFRComputer.computeDerivedFR(entities, map);
      
      expect(stats.processed).toBe(1); // 只有US-001是业务需求
      expect(stats.updated).toBe(1);
      
             const usEntity = entities.find(e => e.id === 'US-001') as any;
       expect(usEntity?.derived_fr).toEqual(['FR-001', 'NFR-001']); // 字母排序
    });
    
    test('应该正确清空derived_fr字段', () => {
      const entities = [
        { id: 'US-001', derived_fr: ['FR-001'] },
        { id: 'FR-001', derived_fr: ['should not be cleared'] } // 技术需求不应该被清空
      ];
      
      const stats = DerivedFRComputer.clearDerivedFRFields(entities);
      
      expect(stats.cleared).toBe(1);
      expect(stats.total).toBe(1);
      expect(entities[0].derived_fr).toBeUndefined();
      expect(entities[1].derived_fr).toBeDefined(); // 技术需求的derived_fr不被清空
    });
  });
  
  describe('ADCRelatedComputer 单元测试', () => {
    test('应该正确计算ADC_related字段', () => {
      const entities = [
        { id: 'ADC-ASSU-001', impacted_requirements: ['FR-001'] },
        { id: 'ADC-DEPEN-001', impacted_requirements: ['FR-001'] },
        { id: 'FR-001', source_requirements: ['US-001'] },
        { id: 'US-001', source_requirements: [] }
      ];
      
      const map = TraceabilityMapBuilder.buildMap(entities);
      const stats = ADCRelatedComputer.computeADCRelated(entities, map);
      
      expect(stats.processed).toBe(1); // 只有FR-001是技术需求
      expect(stats.updated).toBe(1);
      
             const frEntity = entities.find(e => e.id === 'FR-001') as any;
       expect(frEntity?.ADC_related).toEqual(['ADC-ASSU-001', 'ADC-DEPEN-001']); // 字母排序
    });
    
    test('应该正确清空ADC_related字段', () => {
      const entities = [
        { id: 'FR-001', ADC_related: ['ADC-ASSU-001'] },
        { id: 'US-001', ADC_related: ['should not be cleared'] } // 业务需求不应该被清空
      ];
      
      const stats = ADCRelatedComputer.clearADCRelatedFields(entities);
      
      expect(stats.cleared).toBe(1);
      expect(stats.total).toBe(1);
      expect(entities[0].ADC_related).toBeUndefined();
      expect(entities[1].ADC_related).toBeDefined(); // 业务需求的ADC_related不被清空
    });
    
    test('应该正确处理ADC约束影响的技术需求', () => {
      // 测试ADC约束通过impacted_requirements影响技术需求的新逻辑
      const entities = [
        { id: 'US-001', source_requirements: [] },
        { id: 'FR-001', source_requirements: ['US-001'] },
        { id: 'NFR-001', source_requirements: ['US-001'] },
        { id: 'ADC-ASSU-001', impacted_requirements: ['FR-001', 'NFR-001'] },
        { id: 'ADC-CONST-001', impacted_requirements: ['FR-001'] }
      ];
      
      const map = TraceabilityMapBuilder.buildMap(entities);
      ADCRelatedComputer.clearADCRelatedFields(entities);
      const stats = ADCRelatedComputer.computeADCRelated(entities, map);
      
      expect(stats.processed).toBe(2); // FR-001, NFR-001
      expect(stats.updated).toBe(2);
      
      const frEntity = entities.find(e => e.id === 'FR-001') as any;
      expect(frEntity?.ADC_related).toEqual(['ADC-ASSU-001', 'ADC-CONST-001']); // 字母排序
      
      const nfrEntity = entities.find(e => e.id === 'NFR-001') as any;
      expect(nfrEntity?.ADC_related).toEqual(['ADC-ASSU-001']);
    });
  });
  
  describe('TechSpecRelatedComputer', () => {
    test('应该正确清空tech_spec_related字段', () => {
      const entities = [
        { id: 'FR-001', tech_spec_related: ['NFR-001'] },
        { id: 'FR-002', tech_spec_related: ['IFR-001', 'DAR-001'] },
        { id: 'NFR-001', source_requirements: ['FR-001'] } // 不应被清空
      ];
      
      const stats = TechSpecRelatedComputer.clearTechSpecRelatedFields(entities);
      
      expect(stats.cleared).toBe(2);
      expect(stats.total).toBe(2);
      expect((entities[0] as any).tech_spec_related).toBeUndefined();
      expect((entities[1] as any).tech_spec_related).toBeUndefined();
      expect((entities[2] as any).source_requirements).toBeDefined(); // 不应受影响
    });
    
    test('应该正确计算tech_spec_related字段', () => {
      const entities = [
        { id: 'FR-001', source_requirements: ['US-001'] },
        { id: 'FR-002', source_requirements: ['US-002'] },
        { id: 'NFR-001', source_requirements: ['FR-001'] },
        { id: 'IFR-001', source_requirements: ['FR-001', 'FR-002'] },
        { id: 'DAR-001', source_requirements: ['FR-002'] },
        { id: 'US-001', source_requirements: [] },
        { id: 'US-002', source_requirements: [] }
      ];
      
      const map = TraceabilityMapBuilder.buildMap(entities);
      const stats = TechSpecRelatedComputer.computeTechSpecRelated(entities, map);
      
      expect(stats.processed).toBe(2); // FR-001, FR-002
      expect(stats.updated).toBe(2);
      
      const fr001 = entities.find(e => e.id === 'FR-001') as any;
      expect(fr001?.tech_spec_related).toEqual(['IFR-001', 'NFR-001']); // 字母排序
      
      const fr002 = entities.find(e => e.id === 'FR-002') as any;
      expect(fr002?.tech_spec_related).toEqual(['DAR-001', 'IFR-001']); // 字母排序
    });
    
    test('应该正确识别技术规范需求类型', () => {
      const entities = [
        { id: 'FR-001', source_requirements: ['US-001'] },
        { id: 'NFR-SEC-001', source_requirements: ['FR-001'] },
        { id: 'IFR-API-001', source_requirements: ['FR-001'] },
        { id: 'DAR-USER-001', source_requirements: ['FR-001'] },
        { id: 'US-001', source_requirements: [] },
        { id: 'ADC-ASSU-001', impacted_requirements: ['FR-001'] } // 不应被处理
      ];
      
      const map = TraceabilityMapBuilder.buildMap(entities);
      const stats = TechSpecRelatedComputer.computeTechSpecRelated(entities, map);
      
      expect(stats.processed).toBe(1); // 只有 FR-001
      expect(stats.updated).toBe(1);
      
      const fr001 = entities.find(e => e.id === 'FR-001') as any;
      expect(fr001?.tech_spec_related).toEqual(['DAR-USER-001', 'IFR-API-001', 'NFR-SEC-001']); // 字母排序
    });
    
    test('应该处理无技术规范需求引用的功能需求', () => {
      const entities = [
        { id: 'FR-001', source_requirements: ['US-001'] },
        { id: 'FR-002', source_requirements: ['US-001'] },
        { id: 'US-001', source_requirements: [] }
      ];
      
      const map = TraceabilityMapBuilder.buildMap(entities);
      const stats = TechSpecRelatedComputer.computeTechSpecRelated(entities, map);
      
      expect(stats.processed).toBe(0); // 没有技术规范需求引用FR
      expect(stats.updated).toBe(0);
      
      const fr001 = entities.find(e => e.id === 'FR-001') as any;
      expect(fr001?.tech_spec_related).toBeUndefined();
    });
    
    test('应该生成正确的分析报告', () => {
      const entities = [
        { id: 'FR-001', tech_spec_related: ['NFR-001', 'IFR-001'] },
        { id: 'FR-002', tech_spec_related: ['DAR-001'] },
        { id: 'FR-003', source_requirements: ['US-001'] }, // 无 tech_spec_related
        { id: 'NFR-001', source_requirements: ['FR-001'] },
        { id: 'IFR-001', source_requirements: ['FR-001'] },
        { id: 'DAR-001', source_requirements: ['FR-002'] },
        { id: 'US-001', source_requirements: [] }
      ];
      
      const report = TechSpecRelatedComputer.getTechSpecRelatedReport(entities);
      
      expect(report.functionalRequirements).toBe(3); // 只有FR-001, FR-002, FR-003
      expect(report.withTechSpecRelated).toBe(2);
      expect(report.withoutTechSpecRelated).toBe(1);
      expect(report.averageTechSpecCount).toBe(1.5); // (2+1)/2
      expect(report.maxTechSpecCount).toBe(2);
      expect(report.techSpecTypesUsage).toEqual({
        'NFR': 1,
        'IFR': 1,
        'DAR': 1
      });
      expect(report.topFRReferenced).toHaveLength(2);
      expect(report.topFRReferenced[0]).toEqual({
        id: 'FR-001',
        count: 2,
        tech_spec_related: ['NFR-001', 'IFR-001']
      });
    });
  });
  
  describe('工具定义测试', () => {
    test('工具定义应该包含必要的属性', () => {
      const { traceabilityCompletionToolDefinitions } = require('../../tools/document/traceabilityCompletionTools');
      
      expect(traceabilityCompletionToolDefinitions).toHaveLength(1);
      
      const toolDef = traceabilityCompletionToolDefinitions[0];
      expect(toolDef.name).toBe('traceability-completion-tool');
      expect(toolDef.description).toContain('完成需求追溯关系计算');
      expect(toolDef.parameters.required).toContain('description');
      expect(toolDef.accessibleBy).toContain('specialist');
    });
  });
  
  describe('端到端场景测试', () => {
    test('完整的追溯关系计算流程', () => {
      // 模拟完整的数据处理流程
      const entities = [
        { id: 'US-AUTH-001', title: '用户认证' },
        { id: 'UC-LOGIN-001', title: '登录流程' },
        { id: 'ADC-ASSU-001', title: '网络假设', impacted_requirements: ['FR-AUTH-001'] },
        { id: 'ADC-DEPEN-001', title: '外部依赖', impacted_requirements: ['NFR-PERF-001'] },
        { id: 'FR-AUTH-001', source_requirements: ['US-AUTH-001', 'UC-LOGIN-001'] },
        { id: 'NFR-PERF-001', source_requirements: ['US-AUTH-001'] },
        { id: 'IFR-API-001', source_requirements: ['UC-LOGIN-001'] },
        { id: 'NFR-SEC-001', source_requirements: ['FR-AUTH-001'] }, // 技术规范需求引用FR
        { id: 'IFR-REST-001', source_requirements: ['FR-AUTH-001'] }, // 技术规范需求引用FR
        { id: 'DAR-USER-001', source_requirements: ['FR-AUTH-001'] }  // 技术规范需求引用FR
      ];
      
      // Step 1: 构建追溯映射表
      const map = TraceabilityMapBuilder.buildMap(entities);
      
      // Step 2: 清空computed字段
      DerivedFRComputer.clearDerivedFRFields(entities);
      ADCRelatedComputer.clearADCRelatedFields(entities);
      TechSpecRelatedComputer.clearTechSpecRelatedFields(entities);
      
      // Step 3: 计算derived_fr
      const derivedStats = DerivedFRComputer.computeDerivedFR(entities, map);
      
      // Step 4: 计算ADC_related
      const adcStats = ADCRelatedComputer.computeADCRelated(entities, map);

      // Step 5: 计算tech_spec_related
      const techSpecStats = TechSpecRelatedComputer.computeTechSpecRelated(entities, map);
      
      // 验证结果
      expect(derivedStats.processed).toBe(2); // US-AUTH-001, UC-LOGIN-001
      expect(adcStats.processed).toBe(6); // FR-AUTH-001, NFR-PERF-001, IFR-API-001, NFR-SEC-001, IFR-REST-001, DAR-USER-001
      expect(techSpecStats.processed).toBe(1); // 只有 FR-AUTH-001 被技术规范需求引用
      
      // 验证具体的计算结果
      const usAuth = entities.find(e => e.id === 'US-AUTH-001') as any;
      expect(usAuth?.derived_fr).toEqual(['FR-AUTH-001', 'NFR-PERF-001']);
      
      const ucLogin = entities.find(e => e.id === 'UC-LOGIN-001') as any;
      expect(ucLogin?.derived_fr).toEqual(['FR-AUTH-001', 'IFR-API-001']);
      
      const frAuth = entities.find(e => e.id === 'FR-AUTH-001') as any;
      expect(frAuth?.ADC_related).toEqual(['ADC-ASSU-001']);
      expect(frAuth?.tech_spec_related).toEqual(['DAR-USER-001', 'IFR-REST-001', 'NFR-SEC-001']); // 字母排序
      
      const nfrPerf = entities.find(e => e.id === 'NFR-PERF-001') as any;
      expect(nfrPerf?.ADC_related).toEqual(['ADC-DEPEN-001']);
    });
  });
});

describe('算法性能基准测试', () => {
  test('小规模数据处理应该很快', () => {
    const entities = [];
    
    // 生成100个实体的测试数据
    for (let i = 1; i <= 50; i++) {
      entities.push({ id: `US-${i.toString().padStart(3, '0')}` });
    }
    
    for (let i = 1; i <= 50; i++) {
      const sourceReqs = [];
      // 每个FR引用前3个US
      for (let j = 1; j <= Math.min(3, 50); j++) {
        sourceReqs.push(`US-${j.toString().padStart(3, '0')}`);
      }
      entities.push({ 
        id: `FR-${i.toString().padStart(3, '0')}`,
        source_requirements: sourceReqs
      });
    }
    
    const startTime = performance.now();
    
    // 执行计算
    const map = TraceabilityMapBuilder.buildMap(entities);
    DerivedFRComputer.computeDerivedFR(entities, map);
    ADCRelatedComputer.computeADCRelated(entities, map);
    TechSpecRelatedComputer.computeTechSpecRelated(entities, map);
    
    const executionTime = performance.now() - startTime;
    
    // 100个实体应该在100ms内完成
    expect(executionTime).toBeLessThan(100);
    expect(entities.length).toBe(100);
  });
}); 