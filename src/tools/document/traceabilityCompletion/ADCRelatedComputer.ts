/**
 * ADC_related字段计算器
 * 负责计算技术需求(FR/NFR/IFR/DAR)的ADC_related字段
 * 算法：从source_requirements中提取ADC-*前缀的约束引用
 */

import { Logger } from '../../../utils/logger';
import { TraceabilityMap, RequirementEntity } from './types';
import { EntityTypeClassifier } from './EntityTypeClassifier';

const logger = Logger.getInstance();

/**
 * ADC_related字段计算器
 * 专门处理技术需求实体的ADC_related字段计算
 */
export class ADCRelatedComputer {
  
  /**
   * 计算所有技术需求的ADC_related字段
   * @param entities 所有需求实体
   * @param map 追溯映射表
   * @returns 计算统计信息
   */
  static computeADCRelated(entities: RequirementEntity[], map: TraceabilityMap): {
    processed: number;
    updated: number;
    skipped: number;
  } {
    const startTime = performance.now();
    
    logger.info('🔄 开始计算ADC_related字段...');
    
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const entity of entities) {
      // 只为技术需求计算ADC_related
      if (!EntityTypeClassifier.isTechnicalRequirement(entity.id)) {
        continue;
      }
      
      processed++;
      
      // 获取此技术需求引用的所有ADC约束
      const adcConstraints = map.technicalToADC.get(entity.id) || new Set();
      
      // 转换为排序数组
      const sortedADC = Array.from(adcConstraints).sort(); // 字母升序排序
      
      // 检查是否有变化
      const currentADCRelated = entity.ADC_related || [];
      const hasChanged = !this.arraysEqual(currentADCRelated, sortedADC);
      
      if (hasChanged) {
        entity.ADC_related = sortedADC;
        updated++;
        
        logger.info(`✅ 更新${entity.id}的ADC_related: [${sortedADC.join(', ')}]`);
      } else {
        skipped++;
        logger.debug(`⏭️ ${entity.id}的ADC_related无需更新`);
      }
    }
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    logger.info(`✅ ADC_related字段计算完成:`);
    logger.info(`   - 处理实体数: ${processed}`);
    logger.info(`   - 更新实体数: ${updated}`);
    logger.info(`   - 跳过实体数: ${skipped}`);
    logger.info(`   - 执行时间: ${executionTime.toFixed(2)}ms`);
    
    return { processed, updated, skipped };
  }
  
  /**
   * 清空所有技术需求的ADC_related字段
   * @param entities 所有需求实体
   * @returns 清空统计信息
   */
  static clearADCRelatedFields(entities: RequirementEntity[]): {
    cleared: number;
    total: number;
  } {
    logger.info('🧹 开始清空ADC_related字段...');
    
    let cleared = 0;
    let total = 0;
    
    for (const entity of entities) {
      if (EntityTypeClassifier.isTechnicalRequirement(entity.id)) {
        total++;
        if (entity.ADC_related !== undefined) {
          delete entity.ADC_related;
          cleared++;
        }
      }
    }
    
    logger.info(`🧹 ADC_related字段清空完成: ${cleared}/${total}`);
    return { cleared, total };
  }
  
  /**
   * 验证ADC_related字段的正确性
   * @param entities 所有需求实体
   * @param map 追溯映射表
   * @returns 验证结果
   */
  static validateADCRelatedFields(entities: RequirementEntity[], map: TraceabilityMap): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    logger.info('🔍 开始验证ADC_related字段...');
    
    for (const entity of entities) {
      if (!EntityTypeClassifier.isTechnicalRequirement(entity.id)) {
        continue;
      }
      
      const adcRelated = entity.ADC_related || [];
      
      // 验证数组格式
      if (!Array.isArray(adcRelated)) {
        errors.push(`${entity.id}: ADC_related字段类型错误，应为数组`);
        continue;
      }
      
      // 验证引用的合理性
      const expectedADC = map.technicalToADC.get(entity.id) || new Set();
      const expectedADCArray = Array.from(expectedADC).sort();
      
      // 检查是否包含不应该存在的引用
      for (const adcId of adcRelated) {
        if (!EntityTypeClassifier.isADCConstraint(adcId)) {
          errors.push(`${entity.id}: ADC_related包含非ADC约束 ${adcId}`);
        }
        
        if (!expectedADCArray.includes(adcId)) {
          errors.push(`${entity.id}: ADC_related包含未在source_requirements中引用的 ${adcId}`);
        }
      }
      
      // 检查是否遗漏了应该包含的引用
      for (const adcId of expectedADCArray) {
        if (!adcRelated.includes(adcId)) {
          errors.push(`${entity.id}: ADC_related遗漏了ADC约束 ${adcId}`);
        }
      }
      
      // 检查排序
      if (!this.isSorted(adcRelated)) {
        warnings.push(`${entity.id}: ADC_related字段未按字母顺序排序`);
      }
      
      // 检查重复
      if (new Set(adcRelated).size !== adcRelated.length) {
        warnings.push(`${entity.id}: ADC_related字段包含重复项`);
      }
    }
    
    const valid = errors.length === 0;
    
    if (valid) {
      logger.info(`✅ ADC_related字段验证通过`);
    } else {
      logger.error(`❌ ADC_related字段验证失败: ${errors.length} 个错误`);
    }
    
    if (warnings.length > 0) {
      logger.warn(`⚠️ ADC_related字段验证警告: ${warnings.length} 个警告`);
    }
    
    return { valid, errors, warnings };
  }
  
  /**
   * 获取ADC_related分析报告
   * @param entities 所有需求实体
   * @param map 追溯映射表
   * @returns 分析报告
   */
  static getADCRelatedReport(entities: RequirementEntity[], map: TraceabilityMap): {
    technicalRequirements: number;
    withADCRelated: number;
    withoutADCRelated: number;
    averageADCCount: number;
    maxADCCount: number;
    adcTypesUsage: Record<string, number>;
    topADCReferenced: Array<{ id: string; count: number; ADC_related: string[] }>;
  } {
    const technicalEntities = entities.filter(e => EntityTypeClassifier.isTechnicalRequirement(e.id));
    
    let withADCRelated = 0;
    let totalADCCount = 0;
    let maxADCCount = 0;
    const adcTypesUsage: Record<string, number> = {
      'ADC-ASSU': 0,
      'ADC-DEPEN': 0,
      'ADC-CONST': 0
    };
    const countMap: Array<{ id: string; count: number; ADC_related: string[] }> = [];
    
    for (const entity of technicalEntities) {
      const adcRelated = entity.ADC_related || [];
      const count = adcRelated.length;
      
      if (count > 0) {
        withADCRelated++;
        totalADCCount += count;
        maxADCCount = Math.max(maxADCCount, count);
        
        countMap.push({
          id: entity.id,
          count,
          ADC_related: [...adcRelated]
        });
        
        // 统计ADC类型使用情况
        for (const adcId of adcRelated) {
          if (adcId.startsWith('ADC-ASSU-')) {
            adcTypesUsage['ADC-ASSU']++;
          } else if (adcId.startsWith('ADC-DEPEN-')) {
            adcTypesUsage['ADC-DEPEN']++;
          } else if (adcId.startsWith('ADC-CONST-')) {
            adcTypesUsage['ADC-CONST']++;
          }
        }
      }
    }
    
    // 按ADC引用数量排序，取前5个
    const topADCReferenced = countMap
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const averageADCCount = withADCRelated > 0 ? totalADCCount / withADCRelated : 0;
    
    return {
      technicalRequirements: technicalEntities.length,
      withADCRelated,
      withoutADCRelated: technicalEntities.length - withADCRelated,
      averageADCCount: Number(averageADCCount.toFixed(2)),
      maxADCCount,
      adcTypesUsage,
      topADCReferenced
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