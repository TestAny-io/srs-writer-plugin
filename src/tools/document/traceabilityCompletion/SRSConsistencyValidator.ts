/**
 * SRS-YAML ID一致性验证器
 * 负责验证SRS.md和requirements.yaml之间的ID一致性
 */

import * as fs from 'fs/promises';
import { Logger } from '../../../utils/logger';
import { IDParser } from '../scaffoldGenerator/IDParser';
import { RequirementEntity, ConsistencyValidationResult } from './types';
import { ScaffoldError, ScaffoldErrorType } from './types';

const logger = Logger.getInstance();

/**
 * SRS一致性验证器
 * 专门处理SRS.md和requirements.yaml之间的ID一致性验证
 */
export class SRSConsistencyValidator {
  
  /**
   * 验证SRS.md和requirements.yaml之间的ID一致性
   * @param srsFilePath SRS.md文件路径
   * @param yamlEntities requirements.yaml中的实体
   * @returns 一致性验证结果
   */
  static async validateConsistency(
    srsFilePath: string, 
    yamlEntities: RequirementEntity[]
  ): Promise<ConsistencyValidationResult> {
    const startTime = performance.now();
    
    try {
      logger.info('🔍 开始SRS-YAML ID一致性验证...');
      logger.info(`📄 SRS文件: ${srsFilePath}`);
      logger.info(`📊 YAML实体数量: ${yamlEntities.length}`);
      
      // 1. 读取SRS文件内容
      const srsContent = await this.readSRSFile(srsFilePath);
      
      // 2. 使用IDParser从SRS.md提取ID
      const srsIds = await IDParser.extractAllIds(srsContent);
      logger.info(`📋 从SRS中提取到 ${srsIds.length} 个ID`);
      
      // 3. 从YAML实体提取ID
      const yamlIds = new Set(yamlEntities.map(e => e.id).filter(id => id)); // 过滤空ID
      logger.info(`📋 从YAML中提取到 ${yamlIds.size} 个ID`);
      
      // 4. 比较分析
      const srsIdSet = new Set(srsIds.map(id => id.id));
      const missingInYaml = Array.from(srsIdSet).filter(id => !yamlIds.has(id));
      const missingInSrs = Array.from(yamlIds).filter(id => !srsIdSet.has(id));
      
      // 5. 生成统计信息
      const statistics = this.generateConsistencyStats(srsIds, yamlEntities);
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      const result: ConsistencyValidationResult = {
        consistent: missingInYaml.length === 0 && missingInSrs.length === 0,
        srsIds: Array.from(srsIdSet).sort(),
        yamlIds: Array.from(yamlIds).sort(),
        missingInYaml: missingInYaml.sort(),
        missingInSrs: missingInSrs.sort(),
        statistics,
        executionTime
      };
      
      // 6. 记录验证结果
      this.logValidationResult(result);
      
      return result;
      
    } catch (error) {
      const errorMsg = `SRS-YAML ID一致性验证失败: ${(error as Error).message}`;
      logger.error(errorMsg, error as Error);
      
      throw new ScaffoldError(
        ScaffoldErrorType.ID_PARSING_FAILED,
        errorMsg
      );
    }
  }
  
  /**
   * 读取SRS文件内容
   * @param filePath SRS文件路径
   * @returns 文件内容
   */
  private static async readSRSFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      if (!content || content.trim().length === 0) {
        throw new ScaffoldError(
          ScaffoldErrorType.INVALID_SRS_FORMAT,
          'SRS文件内容为空'
        );
      }
      
      return content;
      
    } catch (error) {
      if (error instanceof ScaffoldError) {
        throw error;
      }
      
      const errorMsg = `无法读取SRS文件 ${filePath}: ${(error as Error).message}`;
      throw new ScaffoldError(
        ScaffoldErrorType.SCHEMA_LOAD_FAILED,
        errorMsg
      );
    }
  }
  
  /**
   * 生成一致性统计信息
   * @param srsIds SRS中提取的ID
   * @param yamlEntities YAML中的实体
   * @returns 统计信息
   */
  private static generateConsistencyStats(
    srsIds: any[], 
    yamlEntities: RequirementEntity[]
  ) {
    const srsIdsByType = this.groupIdsByType(srsIds);
    const yamlIdsByType = this.groupEntitiesByType(yamlEntities);
    
    const allTypes = new Set([
      ...Object.keys(srsIdsByType),
      ...Object.keys(yamlIdsByType)
    ]);
    
    const byType: Record<string, {srs: number, yaml: number, missing: number}> = {};
    
    for (const type of allTypes) {
      const srsCount = srsIdsByType[type]?.length || 0;
      const yamlCount = yamlIdsByType[type]?.length || 0;
      const missing = Math.abs(srsCount - yamlCount);
      
      byType[type] = {
        srs: srsCount,
        yaml: yamlCount,
        missing
      };
    }
    
    return {
      srsTotal: srsIds.length,
      yamlTotal: yamlEntities.length,
      consistent: srsIds.length === yamlEntities.length,
      byType
    };
  }
  
  /**
   * 按类型分组SRS ID
   */
  private static groupIdsByType(srsIds: any[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {};
    
    for (const idObj of srsIds) {
      // 使用具体的实体类型而不是IDParser的type字段
      const type = this.getEntityType(idObj.id);
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(idObj.id);
    }
    
    return groups;
  }
  
  /**
   * 按类型分组YAML实体
   */
  private static groupEntitiesByType(entities: RequirementEntity[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {};
    
    for (const entity of entities) {
      if (!entity.id) continue;
      
      const type = this.getEntityType(entity.id);
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(entity.id);
    }
    
    return groups;
  }
  
  /**
   * 根据ID获取实体类型
   */
  private static getEntityType(id: string): string {
    if (id.startsWith('US-')) return 'US';
    if (id.startsWith('UC-')) return 'UC';
    if (id.startsWith('FR-')) return 'FR';
    if (id.startsWith('NFR-')) return 'NFR';
    if (id.startsWith('IFR-')) return 'IFR';
    if (id.startsWith('DAR-')) return 'DAR';
    if (id.startsWith('ADC-ASSU-')) return 'ADC-ASSU';
    if (id.startsWith('ADC-DEPEN-')) return 'ADC-DEPEN';
    if (id.startsWith('ADC-CONST-')) return 'ADC-CONST';
    return 'unknown';
  }
  
  /**
   * 记录验证结果
   */
  private static logValidationResult(result: ConsistencyValidationResult): void {
    if (result.consistent) {
      logger.info(`✅ ID一致性验证通过:`);
      logger.info(`   - SRS ID数量: ${result.srsIds.length}`);
      logger.info(`   - YAML ID数量: ${result.yamlIds.length}`);
      logger.info(`   - 执行时间: ${result.executionTime.toFixed(2)}ms`);
    } else {
      logger.warn(`⚠️ ID一致性验证发现不一致:`);
      logger.warn(`   - SRS ID数量: ${result.srsIds.length}`);
      logger.warn(`   - YAML ID数量: ${result.yamlIds.length}`);
      
      if (result.missingInYaml.length > 0) {
        logger.warn(`   - SRS中存在但YAML中缺失 (${result.missingInYaml.length}个):`);
        logger.warn(`     ${result.missingInYaml.join(', ')}`);
      }
      
      if (result.missingInSrs.length > 0) {
        logger.warn(`   - YAML中存在但SRS中缺失 (${result.missingInSrs.length}个):`);
        logger.warn(`     ${result.missingInSrs.join(', ')}`);
      }
      
      logger.warn(`   - 执行时间: ${result.executionTime.toFixed(2)}ms`);
    }
    
    // 按类型详细统计
    logger.info(`📊 按类型统计:`);
    for (const [type, stats] of Object.entries(result.statistics.byType)) {
      logger.info(`   - ${type}: SRS(${stats.srs}) YAML(${stats.yaml}) 差异(${stats.missing})`);
    }
  }
}
