/**
 * 追溯映射表构建器
 * 负责分析source_requirements字段，构建完整的追溯关系映射
 */

import { Logger } from '../../../utils/logger';
import { TraceabilityMap, RequirementEntity } from './types';
import { EntityTypeClassifier } from './EntityTypeClassifier';

const logger = Logger.getInstance();

/**
 * 追溯映射表构建器
 * 提供高效的追溯关系分析和映射构建功能
 */
export class TraceabilityMapBuilder {
  
  /**
   * 构建完整的追溯映射表
   * @param entities 所有需求实体
   * @returns 追溯映射表
   */
  static buildMap(entities: RequirementEntity[]): TraceabilityMap {
    const startTime = performance.now();
    
    logger.info(`🔗 开始构建追溯映射表: ${entities.length} 个实体`);
    
    const map: TraceabilityMap = {
      sourceToDependent: new Map(),
      dependentToSource: new Map(), 
      technicalToADC: new Map(),
      danglingReferences: new Set()
    };

    // 构建实体ID索引 - O(n)时间复杂度
    const validIds = new Set(entities.map(e => e.id));
    logger.info(`📋 实体ID索引构建完成: ${validIds.size} 个有效ID`);
    
    let processedRelations = 0;
    let danglingFound = 0;
    
    // 🚀 Phase 1: 处理技术需求的 source_requirements（业务需求追溯）
    for (const entity of entities) {
      if (!entity.source_requirements || !Array.isArray(entity.source_requirements)) {
        continue;
      }
      
      for (const sourceId of entity.source_requirements) {
        processedRelations++;
        
        // 检查悬空引用
        if (!validIds.has(sourceId)) {
          map.danglingReferences.add(sourceId);
          danglingFound++;
          logger.warn(`⚠️ 发现悬空引用: ${sourceId} (在${entity.id}的source_requirements中)`);
          continue;
        }
        
        // 构建正向映射: source → dependents
        if (!map.sourceToDependent.has(sourceId)) {
          map.sourceToDependent.set(sourceId, new Set());
        }
        map.sourceToDependent.get(sourceId)!.add(entity.id);
        
        // 构建反向映射: dependent → sources
        if (!map.dependentToSource.has(entity.id)) {
          map.dependentToSource.set(entity.id, new Set());
        }
        map.dependentToSource.get(entity.id)!.add(sourceId);
      }
    }
    
    // 🚀 Phase 2: 处理 ADC 约束的 impacted_requirements（ADC追溯）
    for (const entity of entities) {
      // 只处理 ADC 约束实体
      if (!EntityTypeClassifier.isADCConstraint(entity.id)) {
        continue;
      }
      
      // ADC 约束使用 impacted_requirements 字段
      const impactedReqs = (entity as any).impacted_requirements;
      if (!impactedReqs || !Array.isArray(impactedReqs)) {
        continue;
      }
      
      for (const technicalId of impactedReqs) {
        processedRelations++;
        
        // 检查悬空引用
        if (!validIds.has(technicalId)) {
          map.danglingReferences.add(technicalId);
          danglingFound++;
          logger.warn(`⚠️ 发现悬空引用: ${technicalId} (在${entity.id}的impacted_requirements中)`);
          continue;
        }
        
        // 只有技术需求才能被 ADC 约束影响
        if (EntityTypeClassifier.isTechnicalRequirement(technicalId)) {
          if (!map.technicalToADC.has(technicalId)) {
            map.technicalToADC.set(technicalId, new Set());
          }
          map.technicalToADC.get(technicalId)!.add(entity.id);
        }
      }
    }
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    logger.info(`✅ 追溯映射表构建完成:`);
    logger.info(`   - 处理关系数: ${processedRelations}`);
    logger.info(`   - 正向映射数: ${map.sourceToDependent.size}`);
    logger.info(`   - 反向映射数: ${map.dependentToSource.size}`);
    logger.info(`   - ADC映射数: ${map.technicalToADC.size}`);
    logger.info(`   - 悬空引用数: ${danglingFound}`);
    logger.info(`   - 执行时间: ${executionTime.toFixed(2)}ms`);
    
    return map;
  }
  
  /**
   * 验证映射表的一致性
   * @param map 追溯映射表
   * @returns 验证结果
   */
  static validateMapConsistency(map: TraceabilityMap): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    logger.info('🔍 开始验证映射表一致性...');
    
    // 检查正向映射和反向映射的一致性
    map.sourceToDependent.forEach((dependents, sourceId) => {
      dependents.forEach(dependentId => {
        const reverseSources = map.dependentToSource.get(dependentId);
        if (!reverseSources || !reverseSources.has(sourceId)) {
          errors.push(`映射不一致: ${sourceId} → ${dependentId} 在正向映射中存在，但反向映射中缺失`);
        }
      });
    });
    
    // 检查反向映射和正向映射的一致性
    map.dependentToSource.forEach((sources, dependentId) => {
      sources.forEach(sourceId => {
        const forwardDependents = map.sourceToDependent.get(sourceId);
        if (!forwardDependents || !forwardDependents.has(dependentId)) {
          errors.push(`映射不一致: ${dependentId} → ${sourceId} 在反向映射中存在，但正向映射中缺失`);
        }
      });
    });
    
    // 检查ADC映射的合理性
    map.technicalToADC.forEach((adcConstraints, technicalId) => {
      if (!EntityTypeClassifier.isTechnicalRequirement(technicalId)) {
        warnings.push(`ADC映射警告: ${technicalId} 不是技术需求，但包含ADC映射`);
      }
      
      adcConstraints.forEach(adcId => {
        if (!EntityTypeClassifier.isADCConstraint(adcId)) {
          warnings.push(`ADC映射警告: ${adcId} 不是ADC约束，但被技术需求${technicalId}引用`);
        }
      });
    });
    
    const valid = errors.length === 0;
    
    if (valid) {
      logger.info(`✅ 映射表一致性验证通过`);
    } else {
      logger.error(`❌ 映射表一致性验证失败: ${errors.length} 个错误`);
    }
    
    if (warnings.length > 0) {
      logger.warn(`⚠️ 发现 ${warnings.length} 个警告`);
    }
    
    return { valid, errors, warnings };
  }
  
  /**
   * 获取映射表统计信息
   * @param map 追溯映射表
   * @returns 统计信息
   */
  static getMapStatistics(map: TraceabilityMap): {
    totalSourceIds: number;
    totalDependentIds: number;
    totalADCMappings: number;
    totalDanglingReferences: number;
    averageDependentsPerSource: number;
    averageSourcesPerDependent: number;
  } {
    const totalSourceIds = map.sourceToDependent.size;
    const totalDependentIds = map.dependentToSource.size;
    const totalADCMappings = map.technicalToADC.size;
    const totalDanglingReferences = map.danglingReferences.size;
    
    // 计算平均依赖数
    let totalDependents = 0;
    map.sourceToDependent.forEach(dependents => {
      totalDependents += dependents.size;
    });
    
    let totalSources = 0;
    map.dependentToSource.forEach(sources => {
      totalSources += sources.size;
    });
    
    const averageDependentsPerSource = totalSourceIds > 0 ? totalDependents / totalSourceIds : 0;
    const averageSourcesPerDependent = totalDependentIds > 0 ? totalSources / totalDependentIds : 0;
    
    return {
      totalSourceIds,
      totalDependentIds,
      totalADCMappings,
      totalDanglingReferences,
      averageDependentsPerSource,
      averageSourcesPerDependent
    };
  }
  
  /**
   * 检测循环依赖
   * @param map 追溯映射表
   * @returns 循环依赖列表
   */
  static detectCircularDependencies(map: TraceabilityMap): string[][] {
    const cycles: string[][] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    
    const dfs = (nodeId: string, path: string[]): void => {
      if (visiting.has(nodeId)) {
        // 发现循环
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart >= 0) {
          const cycle = path.slice(cycleStart);
          cycle.push(nodeId); // 闭合循环
          cycles.push(cycle);
        }
        return;
      }
      
      if (visited.has(nodeId)) {
        return;
      }
      
      visiting.add(nodeId);
      path.push(nodeId);
      
      const dependents = map.sourceToDependent.get(nodeId) || new Set();
      dependents.forEach(dependent => {
        dfs(dependent, [...path]);
      });
      
      visiting.delete(nodeId);
      visited.add(nodeId);
    };
    
    // 从所有源节点开始DFS
    map.sourceToDependent.forEach((_, sourceId) => {
      if (!visited.has(sourceId)) {
        dfs(sourceId, []);
      }
    });
    
    if (cycles.length > 0) {
      logger.warn(`⚠️ 检测到 ${cycles.length} 个循环依赖:`);
      cycles.forEach((cycle, index) => {
        logger.warn(`   循环 ${index + 1}: ${cycle.join(' → ')}`);
      });
    }
    
    return cycles;
  }
} 