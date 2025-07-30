/**
 * derived_fr字段计算器
 * 负责计算业务需求(US/UC)的derived_fr字段
 * 算法：反向计算哪些技术需求引用了该业务需求
 */

import { Logger } from '../../../utils/logger';
import { TraceabilityMap, RequirementEntity } from './types';
import { EntityTypeClassifier } from './EntityTypeClassifier';

const logger = Logger.getInstance();

/**
 * derived_fr字段计算器
 * 专门处理US/UC实体的derived_fr字段计算
 */
export class DerivedFRComputer {
  
  /**
   * 计算所有业务需求的derived_fr字段
   * @param entities 所有需求实体
   * @param map 追溯映射表
   * @returns 计算统计信息
   */
  static computeDerivedFR(entities: RequirementEntity[], map: TraceabilityMap): {
    processed: number;
    updated: number;
    skipped: number;
  } {
    const startTime = performance.now();
    
    logger.info('🔄 开始计算derived_fr字段...');
    
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const entity of entities) {
      // 只为业务需求(US/UC)计算derived_fr
      if (!EntityTypeClassifier.isBusinessRequirement(entity.id)) {
        continue;
      }
      
      processed++;
      
      // 获取引用此业务需求的所有实体
      const dependents = map.sourceToDependent.get(entity.id) || new Set();
      
      // 筛选出技术需求 (排除业务需求相互引用的情况)
      const technicalDependents = Array.from(dependents)
        .filter(id => EntityTypeClassifier.isTechnicalRequirement(id))
        .sort(); // 字母升序排序
      
      // 检查是否有变化
      const currentDerivedFr = entity.derived_fr || [];
      const hasChanged = !this.arraysEqual(currentDerivedFr, technicalDependents);
      
      if (hasChanged) {
        entity.derived_fr = technicalDependents;
        updated++;
        
        logger.info(`✅ 更新${entity.id}的derived_fr: [${technicalDependents.join(', ')}]`);
      } else {
        skipped++;
        logger.debug(`⏭️ ${entity.id}的derived_fr无需更新`);
      }
    }
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    logger.info(`✅ derived_fr字段计算完成:`);
    logger.info(`   - 处理实体数: ${processed}`);
    logger.info(`   - 更新实体数: ${updated}`);
    logger.info(`   - 跳过实体数: ${skipped}`);
    logger.info(`   - 执行时间: ${executionTime.toFixed(2)}ms`);
    
    return { processed, updated, skipped };
  }
  
  /**
   * 清空所有业务需求的derived_fr字段
   * @param entities 所有需求实体
   * @returns 清空统计信息
   */
  static clearDerivedFRFields(entities: RequirementEntity[]): {
    cleared: number;
    total: number;
  } {
    logger.info('🧹 开始清空derived_fr字段...');
    
    let cleared = 0;
    let total = 0;
    
    for (const entity of entities) {
      if (EntityTypeClassifier.isBusinessRequirement(entity.id)) {
        total++;
        if (entity.derived_fr !== undefined) {
          delete entity.derived_fr;
          cleared++;
        }
      }
    }
    
    logger.info(`🧹 derived_fr字段清空完成: ${cleared}/${total}`);
    return { cleared, total };
  }
  
  /**
   * 验证derived_fr字段的正确性
   * @param entities 所有需求实体
   * @param map 追溯映射表
   * @returns 验证结果
   */
  static validateDerivedFRFields(entities: RequirementEntity[], map: TraceabilityMap): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    logger.info('🔍 开始验证derived_fr字段...');
    
    for (const entity of entities) {
      if (!EntityTypeClassifier.isBusinessRequirement(entity.id)) {
        continue;
      }
      
      const derivedFr = entity.derived_fr || [];
      
      // 验证数组格式
      if (!Array.isArray(derivedFr)) {
        errors.push(`${entity.id}: derived_fr字段类型错误，应为数组`);
        continue;
      }
      
      // 验证引用的合理性
      const expectedDependents = map.sourceToDependent.get(entity.id) || new Set();
      const expectedTechnical = Array.from(expectedDependents)
        .filter(id => EntityTypeClassifier.isTechnicalRequirement(id))
        .sort();
      
      // 检查是否包含不应该存在的引用
      for (const frId of derivedFr) {
        if (!EntityTypeClassifier.isTechnicalRequirement(frId)) {
          errors.push(`${entity.id}: derived_fr包含非技术需求 ${frId}`);
        }
        
        if (!expectedTechnical.includes(frId)) {
          errors.push(`${entity.id}: derived_fr包含未在source_requirements中引用的 ${frId}`);
        }
      }
      
      // 检查是否遗漏了应该包含的引用
      for (const frId of expectedTechnical) {
        if (!derivedFr.includes(frId)) {
          errors.push(`${entity.id}: derived_fr遗漏了技术需求 ${frId}`);
        }
      }
      
      // 检查排序
      if (!this.isSorted(derivedFr)) {
        warnings.push(`${entity.id}: derived_fr字段未按字母顺序排序`);
      }
      
      // 检查重复
      if (new Set(derivedFr).size !== derivedFr.length) {
        warnings.push(`${entity.id}: derived_fr字段包含重复项`);
      }
    }
    
    const valid = errors.length === 0;
    
    if (valid) {
      logger.info(`✅ derived_fr字段验证通过`);
    } else {
      logger.error(`❌ derived_fr字段验证失败: ${errors.length} 个错误`);
    }
    
    if (warnings.length > 0) {
      logger.warn(`⚠️ derived_fr字段验证警告: ${warnings.length} 个警告`);
    }
    
    return { valid, errors, warnings };
  }
  
  /**
   * 获取业务需求的detailed_fr分析报告
   * @param entities 所有需求实体
   * @param map 追溯映射表
   * @returns 分析报告
   */
  static getDerivedFRReport(entities: RequirementEntity[], map: TraceabilityMap): {
    businessRequirements: number;
    withDerivedFR: number;
    withoutDerivedFR: number;
    averageDerivedFRCount: number;
    maxDerivedFRCount: number;
    topReferenced: Array<{ id: string; count: number; derived_fr: string[] }>;
  } {
    const businessEntities = entities.filter(e => EntityTypeClassifier.isBusinessRequirement(e.id));
    
    let withDerivedFR = 0;
    let totalDerivedFRCount = 0;
    let maxDerivedFRCount = 0;
    const countMap: Array<{ id: string; count: number; derived_fr: string[] }> = [];
    
    for (const entity of businessEntities) {
      const derivedFr = entity.derived_fr || [];
      const count = derivedFr.length;
      
      if (count > 0) {
        withDerivedFR++;
        totalDerivedFRCount += count;
        maxDerivedFRCount = Math.max(maxDerivedFRCount, count);
        
        countMap.push({
          id: entity.id,
          count,
          derived_fr: [...derivedFr]
        });
      }
    }
    
    // 按引用数量排序，取前5个
    const topReferenced = countMap
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const averageDerivedFRCount = withDerivedFR > 0 ? totalDerivedFRCount / withDerivedFR : 0;
    
    return {
      businessRequirements: businessEntities.length,
      withDerivedFR,
      withoutDerivedFR: businessEntities.length - withDerivedFR,
      averageDerivedFRCount,
      maxDerivedFRCount,
      topReferenced
    };
  }
  
  /**
   * 比较两个数组是否相等
   * @param arr1 数组1
   * @param arr2 数组2
   * @returns 是否相等
   */
  private static arraysEqual(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) {
      return false;
    }
    
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 检查数组是否已排序
   * @param arr 数组
   * @returns 是否已排序
   */
  private static isSorted(arr: string[]): boolean {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < arr[i - 1]) {
        return false;
      }
    }
    return true;
  }
} 