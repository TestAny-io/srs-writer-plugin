import { RequirementEntity, TraceabilityMap } from './types';
import { EntityTypeClassifier } from './EntityTypeClassifier';
import { Logger } from '../../../utils/logger';

const logger = Logger.getInstance();

/**
 * 技术规范需求反向追溯计算器
 * 
 * 功能：当技术规范需求(NFR/IFR/DAR)在source_requirements中引用功能需求(FR)时，
 *      自动在功能需求的tech_spec_related字段中填入引用它的技术规范需求ID列表
 * 
 * 计算逻辑：
 * 1. 遍历所有技术规范需求(NFR/IFR/DAR)
 * 2. 检查它们的source_requirements字段
 * 3. 对于每个被引用的功能需求(FR)，将当前技术规范需求ID添加到其tech_spec_related字段
 */
export class TechSpecRelatedComputer {

  /**
   * 清空所有功能需求的tech_spec_related字段
   * @param entities 所有需求实体
   * @returns 清空统计
   */
  static clearTechSpecRelatedFields(entities: RequirementEntity[]): {
    cleared: number;
    total: number;
  } {
    logger.info('🧹 开始清空tech_spec_related字段...');
    
    let cleared = 0;
    let total = 0;
    
    for (const entity of entities) {
      if (this.isFunctionalRequirement(entity.id)) {
        total++;
        if ((entity as any).tech_spec_related) {
          delete (entity as any).tech_spec_related;
          cleared++;
        }
      }
    }
    
    logger.info(`🧹 tech_spec_related字段清空完成: ${cleared}/${total}`);
    
    return { cleared, total };
  }

  /**
   * 计算所有功能需求的tech_spec_related字段
   * @param entities 所有需求实体
   * @param map 追溯映射表（这里主要是为了保持接口一致性，实际不需要使用）
   * @returns 计算统计
   */
  static computeTechSpecRelated(entities: RequirementEntity[], map: TraceabilityMap): {
    processed: number;
    updated: number;
    skipped: number;
  } {
    logger.info('🔄 开始计算tech_spec_related字段...');
    
    // 构建功能需求索引
    const frEntitiesMap = new Map<string, RequirementEntity>();
    for (const entity of entities) {
      if (this.isFunctionalRequirement(entity.id)) {
        frEntitiesMap.set(entity.id, entity);
      }
    }
    
    // 构建反向映射：FR ID -> Set<技术规范需求ID>
    const frToTechSpecs = new Map<string, Set<string>>();
    
    // 遍历所有技术规范需求
    for (const entity of entities) {
      if (this.isTechSpecRequirement(entity.id)) {
        if (entity.source_requirements && Array.isArray(entity.source_requirements)) {
          for (const sourceId of entity.source_requirements) {
            if (typeof sourceId === 'string' && this.isFunctionalRequirement(sourceId)) {
              if (!frToTechSpecs.has(sourceId)) {
                frToTechSpecs.set(sourceId, new Set());
              }
              frToTechSpecs.get(sourceId)!.add(entity.id);
            }
          }
        }
      }
    }
    
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    
    // 更新功能需求的tech_spec_related字段
    for (const [frId, techSpecIds] of frToTechSpecs) {
      const frEntity = frEntitiesMap.get(frId);
      if (!frEntity) {
        continue;
      }
      
      processed++;
      
      if (techSpecIds.size > 0) {
        const sortedTechSpecs = Array.from(techSpecIds).sort();
        (frEntity as any).tech_spec_related = sortedTechSpecs;
        updated++;
        logger.info(`✅ 更新${frId}的tech_spec_related: [${sortedTechSpecs.join(', ')}]`);
      } else {
        skipped++;
        logger.info(`⏭️ ${frId}无技术规范需求引用，跳过更新`);
      }
    }
    
    logger.info(`✅ tech_spec_related字段计算完成:`);
    logger.info(`   - 处理实体数: ${processed}`);
    logger.info(`   - 更新实体数: ${updated}`);
    logger.info(`   - 跳过实体数: ${skipped}`);
    
    return { processed, updated, skipped };
  }

  /**
   * 判断是否为功能需求 (FR)
   * @param id 实体ID
   * @returns 是否为功能需求
   */
  private static isFunctionalRequirement(id: string): boolean {
    return id?.startsWith('FR-') || false;
  }

  /**
   * 判断是否为技术规范需求 (NFR/IFR/DAR)
   * @param id 实体ID
   * @returns 是否为技术规范需求
   */
  private static isTechSpecRequirement(id: string): boolean {
    return id?.startsWith('NFR-') || id?.startsWith('IFR-') || id?.startsWith('DAR-') || false;
  }

  /**
   * 获取tech_spec_related分析报告
   * @param entities 所有需求实体
   * @returns 分析报告
   */
  static getTechSpecRelatedReport(entities: RequirementEntity[]): {
    functionalRequirements: number;
    withTechSpecRelated: number;
    withoutTechSpecRelated: number;
    averageTechSpecCount: number;
    maxTechSpecCount: number;
    techSpecTypesUsage: Record<string, number>;
    topFRReferenced: Array<{ id: string; count: number; tech_spec_related: string[] }>;
  } {
    const frEntities = entities.filter(e => this.isFunctionalRequirement(e.id));
    
    let withTechSpecRelated = 0;
    let totalTechSpecCount = 0;
    let maxTechSpecCount = 0;
    const techSpecTypesUsage: Record<string, number> = {
      'NFR': 0,
      'IFR': 0,
      'DAR': 0
    };
    
    const frWithCounts: Array<{ id: string; count: number; tech_spec_related: string[] }> = [];
    
    for (const entity of frEntities) {
      const techSpecRelated = (entity as any).tech_spec_related as string[] | undefined;
      
      if (techSpecRelated && techSpecRelated.length > 0) {
        withTechSpecRelated++;
        totalTechSpecCount += techSpecRelated.length;
        maxTechSpecCount = Math.max(maxTechSpecCount, techSpecRelated.length);
        
        frWithCounts.push({
          id: entity.id,
          count: techSpecRelated.length,
          tech_spec_related: techSpecRelated
        });
        
        // 统计技术规范类型使用情况
        for (const techSpecId of techSpecRelated) {
          if (techSpecId.startsWith('NFR-')) techSpecTypesUsage['NFR']++;
          else if (techSpecId.startsWith('IFR-')) techSpecTypesUsage['IFR']++;
          else if (techSpecId.startsWith('DAR-')) techSpecTypesUsage['DAR']++;
        }
      }
    }
    
    const averageTechSpecCount = withTechSpecRelated > 0 ? totalTechSpecCount / withTechSpecRelated : 0;
    const withoutTechSpecRelated = frEntities.length - withTechSpecRelated;
    
    // 按引用数量排序，取前5
    const topFRReferenced = frWithCounts
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      functionalRequirements: frEntities.length,
      withTechSpecRelated,
      withoutTechSpecRelated,
      averageTechSpecCount: Math.round(averageTechSpecCount * 100) / 100,
      maxTechSpecCount,
      techSpecTypesUsage,
      topFRReferenced
    };
  }
} 