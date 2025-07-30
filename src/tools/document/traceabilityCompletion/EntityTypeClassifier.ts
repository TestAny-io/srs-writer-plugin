/**
 * 实体类型分类器
 * 根据ID前缀识别实体类型，支持追溯关系计算
 */

import { Logger } from '../../../utils/logger';

const logger = Logger.getInstance();

/**
 * 实体类型分类器
 * 提供基于ID前缀的实体类型识别功能
 */
export class EntityTypeClassifier {
  
  // 业务需求前缀 (可以有derived_fr字段)
  private static readonly BUSINESS_PREFIXES = ['US-', 'UC-'];
  
  // 技术需求前缀 (可以有ADC_related字段)  
  private static readonly TECHNICAL_PREFIXES = ['FR-', 'NFR-', 'IFR-', 'DAR-'];
  
  // ADC约束前缀 (在ADC_related中被引用)
  private static readonly ADC_PREFIXES = ['ADC-ASSU-', 'ADC-DEPEN-', 'ADC-CONST-'];
  
  /**
   * 判断是否为业务需求 (US/UC)
   * @param id 需求ID
   * @returns 是否为业务需求
   */
  static isBusinessRequirement(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    return this.BUSINESS_PREFIXES.some(prefix => id.startsWith(prefix));
  }
  
  /**
   * 判断是否为技术需求 (FR/NFR/IFR/DAR)
   * @param id 需求ID
   * @returns 是否为技术需求
   */
  static isTechnicalRequirement(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    return this.TECHNICAL_PREFIXES.some(prefix => id.startsWith(prefix));
  }
  
  /**
   * 判断是否为ADC约束 (ADC-ASSU/ADC-DEPEN/ADC-CONST)
   * @param id 需求ID
   * @returns 是否为ADC约束
   */
  static isADCConstraint(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    return this.ADC_PREFIXES.some(prefix => id.startsWith(prefix));
  }
  
  /**
   * 获取实体类型描述
   * @param id 需求ID
   * @returns 实体类型描述
   */
  static getEntityTypeDescription(id: string): string {
    if (this.isBusinessRequirement(id)) {
      if (id.startsWith('US-')) return '用户故事';
      if (id.startsWith('UC-')) return '用例';
    }
    
    if (this.isTechnicalRequirement(id)) {
      if (id.startsWith('FR-')) return '功能需求';
      if (id.startsWith('NFR-')) return '非功能需求';
      if (id.startsWith('IFR-')) return '接口需求';
      if (id.startsWith('DAR-')) return '数据需求';
    }
    
    if (this.isADCConstraint(id)) {
      if (id.startsWith('ADC-ASSU-')) return 'ADC假设';
      if (id.startsWith('ADC-DEPEN-')) return 'ADC依赖';
      if (id.startsWith('ADC-CONST-')) return 'ADC约束';
    }
    
    return '未知类型';
  }
  
  /**
   * 验证ID格式是否符合项目规范
   * @param id 需求ID
   * @returns 验证结果
   */
  static validateIdFormat(id: string): { valid: boolean; error?: string } {
    if (!id || typeof id !== 'string') {
      return { valid: false, error: 'ID不能为空或非字符串' };
    }
    
    if (id.trim() !== id) {
      return { valid: false, error: 'ID不能包含前导或尾随空格' };
    }
    
    if (id.length < 3) {
      return { valid: false, error: 'ID长度过短' };
    }
    
    // 检查是否符合已知的前缀模式
    const allPrefixes = [
      ...this.BUSINESS_PREFIXES,
      ...this.TECHNICAL_PREFIXES,
      ...this.ADC_PREFIXES
    ];
    
    const hasValidPrefix = allPrefixes.some(prefix => id.startsWith(prefix));
    if (!hasValidPrefix) {
      return { 
        valid: false, 
        error: `ID前缀不符合规范。支持的前缀: ${allPrefixes.join(', ')}` 
      };
    }
    
    return { valid: true };
  }
  
  /**
   * 从实体数组中提取指定类型的实体
   * @param entities 所有实体
   * @param filter 过滤器函数
   * @returns 筛选后的实体数组
   */
  static filterEntitiesByType(
    entities: any[], 
    filter: (id: string) => boolean
  ): any[] {
    return entities.filter(entity => {
      if (!entity?.id) {
        logger.warn(`实体缺少ID字段: ${JSON.stringify(entity)}`);
        return false;
      }
      return filter(entity.id);
    });
  }
  
  /**
   * 统计各类型实体数量
   * @param entities 所有实体
   * @returns 统计结果
   */
  static getEntityStatistics(entities: any[]): {
    total: number;
    business: number;
    technical: number;
    adc: number;
    unknown: number;
  } {
    const stats = {
      total: entities.length,
      business: 0,
      technical: 0,
      adc: 0,
      unknown: 0
    };
    
    for (const entity of entities) {
      if (!entity?.id) {
        stats.unknown++;
        continue;
      }
      
      if (this.isBusinessRequirement(entity.id)) {
        stats.business++;
      } else if (this.isTechnicalRequirement(entity.id)) {
        stats.technical++;
      } else if (this.isADCConstraint(entity.id)) {
        stats.adc++;
      } else {
        stats.unknown++;
      }
    }
    
    return stats;
  }
  
  /**
   * 获取所有支持的前缀
   * @returns 前缀数组
   */
  static getAllSupportedPrefixes(): string[] {
    return [
      ...this.BUSINESS_PREFIXES,
      ...this.TECHNICAL_PREFIXES,
      ...this.ADC_PREFIXES
    ];
  }
} 