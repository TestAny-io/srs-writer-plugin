/**
 * 追溯性完成器 - 主控制器
 * 整合所有追溯关系计算组件，复用现有的YAML处理基础设施
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Logger } from '../../../utils/logger';

// 🚀 复用：导入现有组件
import { YAMLReader } from '../yamlEditor/YAMLReader';
import { ScaffoldError, ScaffoldErrorType } from '../scaffoldGenerator/types';
import { QualityReportWriter } from '../syntaxChecker/QualityReportWriter';
import { Issue } from '../syntaxChecker/types';

// 导入追溯计算组件
import { 
  TraceabilityCompletionArgs, 
  TraceabilitySyncResult, 
  RequirementEntity,
  RequirementsYAMLStructure,
  TraceabilityMap,
  ConsistencyValidationResult
} from './types';
import { EntityTypeClassifier } from './EntityTypeClassifier';
import { TraceabilityMapBuilder } from './TraceabilityMapBuilder';
import { DerivedFRComputer } from './DerivedFRComputer';
import { ADCRelatedComputer } from './ADCRelatedComputer';
import { TechSpecRelatedComputer } from './TechSpecRelatedComputer';
import { SRSConsistencyValidator } from './SRSConsistencyValidator';

const logger = Logger.getInstance();

/**
 * 追溯性完成器
 * 负责完整的追溯关系计算流程
 */
export class TraceabilityCompleter {
  
  /**
   * 执行追溯关系同步
   * @param args 同步参数
   * @returns 同步结果
   */
  async syncFile(args: TraceabilityCompletionArgs): Promise<TraceabilitySyncResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`🚀 开始追溯关系同步和ID一致性验证: ${args.description}`);
      logger.info(`📁 目标文件: ${args.targetFile}`);
      logger.info(`📄 SRS文件: ${args.srsFile || 'SRS.md'}`);
      
      // 🚀 Phase 1: 数据读取和验证 (100%复用YAMLReader)
      const { data, entities } = await this.loadAndParseYAML(args.targetFile);
      
      // 🆕 Phase 0: SRS-YAML ID一致性验证 (必执行)
      const consistencyResult = await this.validateSRSConsistency(
        args.srsFile || 'SRS.md', 
        entities
      );
      
      // 无论一致性结果如何，继续执行所有后续阶段
      logger.info('📋 继续执行追溯关系计算...');
      
      // Phase 2: 字段清理 (保证幂等性)
      this.clearComputedFields(entities);
      
      // Phase 3: 追溯关系计算
      const traceMap = this.buildTraceabilityMap(entities);
      const danglingRefs = Array.from(traceMap.danglingReferences);
      
      // Phase 4: 字段填充
      const derivedStats = this.computeDerivedFR(entities, traceMap);
      const adcStats = this.computeADCRelated(entities, traceMap);
      const techSpecStats = this.computeTechSpecRelated(entities, traceMap);
      
      // Phase 5: 文件输出 (复用YAMLEditor的写入配置)
      await this.saveYamlFile(args.targetFile, data);
      
      // Phase 6: 写入统一质量报告 (替换 writeSummaryLog)
      await this.writeToQualityReport(
        args, entities, danglingRefs,
        derivedStats, adcStats, techSpecStats,
        Date.now() - startTime, consistencyResult
      );
      
      // 生成结果
      const executionTime = Date.now() - startTime;
      return this.generateResult(entities, danglingRefs, derivedStats, adcStats, techSpecStats, executionTime, consistencyResult);
      
    } catch (error) {
      return this.handleError(error as Error, Date.now() - startTime);
    }
  }
  
  /**
   * 验证追溯关系（注意：现在总是会写入文件，此方法与syncFile等效）
   * @param args 验证参数
   * @returns 验证结果
   */
  async validateSync(args: TraceabilityCompletionArgs): Promise<TraceabilitySyncResult> {
    return await this.syncFile(args);
  }
  
  /**
   * 🆕 Phase 0: SRS-YAML ID一致性验证
   * @param srsFile SRS.md文件路径
   * @param entities YAML中的实体
   * @returns 一致性验证结果
   */
  private async validateSRSConsistency(
    srsFile: string, 
    entities: RequirementEntity[]
  ): Promise<ConsistencyValidationResult> {
    logger.info('🔍 Phase 0: 开始SRS-YAML ID一致性验证...');
    const startTime = performance.now();
    
    try {
      // 🚀 先解析SRS文件路径，与targetFile使用相同的路径解析逻辑
      const resolvedSrsFile = await this.resolveWorkspacePath(srsFile);
      const result = await SRSConsistencyValidator.validateConsistency(resolvedSrsFile, entities);
      
      if (result.consistent) {
        logger.info(`✅ ID一致性验证通过: SRS(${result.srsIds.length}) ↔ YAML(${result.yamlIds.length})`);
      } else {
        logger.warn(`⚠️ ID一致性验证发现问题，但将继续执行后续处理`);
        if (result.missingInYaml.length > 0) {
          logger.warn(`   - SRS中存在但YAML中缺失 (${result.missingInYaml.length}个): ${result.missingInYaml.slice(0, 5).join(', ')}${result.missingInYaml.length > 5 ? '...' : ''}`);
        }
        if (result.missingInSrs.length > 0) {
          logger.warn(`   - YAML中存在但SRS中缺失 (${result.missingInSrs.length}个): ${result.missingInSrs.slice(0, 5).join(', ')}${result.missingInSrs.length > 5 ? '...' : ''}`);
        }
      }
      
      return result;
      
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      logger.error(`SRS一致性验证失败: ${(error as Error).message}`);
      logger.warn('将跳过一致性验证，继续执行追溯关系计算');
      
      // 返回一个表示验证失败的结果，但包含正确的执行时间
      return {
        consistent: false,
        srsIds: [],
        yamlIds: entities.map(e => e.id).filter(id => id),
        missingInYaml: [],
        missingInSrs: [],
        statistics: {
          srsTotal: 0,
          yamlTotal: entities.length,
          consistent: false,
          byType: {}
        },
        executionTime
      };
    }
  }
  
  /**
   * 🚀 Phase 1: 加载和解析YAML文件 (复用YAMLReader)
   * @param targetFile 目标文件名
   * @returns 解析后的数据和实体
   */
  private async loadAndParseYAML(targetFile: string): Promise<{
    data: any;
    entities: RequirementEntity[];
  }> {
    logger.info('📖 Phase 1: 开始读取YAML文件...');
    
    // 🚀 100%复用YAMLReader的功能
    const readResult = await YAMLReader.readAndParse({
      path: targetFile,        // 工具自动获得baseDir
      includeStructure: false  // 追溯工具不需要结构分析
    });
    
    if (!readResult.success || !readResult.parsedData) {
      throw new ScaffoldError(
        ScaffoldErrorType.SCHEMA_LOAD_FAILED,
        readResult.error || '文件读取失败'
      );
    }
    
    const data = readResult.parsedData as RequirementsYAMLStructure;
    
    // 🆕 Phase 1.5: 数据结构标准化 (修复AI生成的对象结构为数组结构)
    const normalizedData = this.normalizeYAMLStructure(data);
    const entities = this.extractAllEntities(normalizedData);
    
    logger.info(`✅ 文件读取成功: ${entities.length} 个实体`);
    
    // 实体类型统计
    const stats = EntityTypeClassifier.getEntityStatistics(entities);
    logger.info(`📊 实体分布: 业务需求 ${stats.business}, 技术需求 ${stats.technical}, ADC约束 ${stats.adc}, 未知 ${stats.unknown}`);
    
    return { data: normalizedData, entities };
  }
  
  /**
   * Phase 2: 清空computed字段 (保证幂等性)
   * @param entities 所有实体
   */
  private clearComputedFields(entities: RequirementEntity[]): void {
    logger.info('🧹 Phase 2: 开始清空computed字段...');
    
    const derivedStats = DerivedFRComputer.clearDerivedFRFields(entities);
    const adcStats = ADCRelatedComputer.clearADCRelatedFields(entities);
    const techSpecStats = TechSpecRelatedComputer.clearTechSpecRelatedFields(entities);
    
    logger.info(`🧹 字段清空完成: derived_fr ${derivedStats.cleared}/${derivedStats.total}, ADC_related ${adcStats.cleared}/${adcStats.total}, tech_spec_related ${techSpecStats.cleared}/${techSpecStats.total}`);
  }
  
  /**
   * Phase 3: 构建追溯映射表
   * @param entities 所有实体
   * @returns 追溯映射表
   */
  private buildTraceabilityMap(entities: RequirementEntity[]): TraceabilityMap {
    logger.info('🔗 Phase 3: 开始构建追溯映射表...');
    
    const traceMap = TraceabilityMapBuilder.buildMap(entities);
    
    // 验证映射表一致性
    const validation = TraceabilityMapBuilder.validateMapConsistency(traceMap);
    if (!validation.valid) {
      logger.warn(`⚠️ 映射表一致性验证发现问题: ${validation.errors.length} 个错误`);
    }
    
    // 检查循环依赖
    const cycles = TraceabilityMapBuilder.detectCircularDependencies(traceMap);
    if (cycles.length > 0) {
      logger.warn(`⚠️ 检测到 ${cycles.length} 个循环依赖`);
    }
    
    return traceMap;
  }
  
  /**
   * Phase 4: 计算derived_fr字段
   * @param entities 所有实体
   * @param map 追溯映射表
   * @returns 计算统计
   */
  private computeDerivedFR(entities: RequirementEntity[], map: TraceabilityMap): {
    processed: number;
    updated: number;
    skipped: number;
  } {
    logger.info('🔄 Phase 4a: 开始计算derived_fr字段...');
    
    const stats = DerivedFRComputer.computeDerivedFR(entities, map);
    
    // 验证计算结果
    const validation = DerivedFRComputer.validateDerivedFRFields(entities, map);
    if (!validation.valid) {
      logger.warn(`⚠️ derived_fr字段验证发现问题: ${validation.errors.length} 个错误`);
    }
    
    return stats;
  }
  
  /**
   * Phase 4: 计算ADC_related字段
   * @param entities 所有实体
   * @param map 追溯映射表
   * @returns 计算统计
   */
  private computeADCRelated(entities: RequirementEntity[], map: TraceabilityMap): {
    processed: number;
    updated: number;
    skipped: number;
  } {
    logger.info('🔄 Phase 4b: 开始计算ADC_related字段...');
    
    const stats = ADCRelatedComputer.computeADCRelated(entities, map);
    
    // 验证计算结果
    const validation = ADCRelatedComputer.validateADCRelatedFields(entities, map);
    if (!validation.valid) {
      logger.warn(`⚠️ ADC_related字段验证发现问题: ${validation.errors.length} 个错误`);
    }
    
    return stats;
  }
  
  /**
   * Phase 4c: 计算tech_spec_related字段
   * @param entities 所有实体
   * @param map 追溯映射表
   * @returns 计算统计
   */
  private computeTechSpecRelated(entities: RequirementEntity[], map: TraceabilityMap): {
    processed: number;
    updated: number;
    skipped: number;
  } {
    logger.info('🔄 Phase 4c: 开始计算tech_spec_related字段...');
    
    const stats = TechSpecRelatedComputer.computeTechSpecRelated(entities, map);
    
    return stats;
  }
  
  /**
   * 🚀 Phase 5: 保存YAML文件 (复用YAMLEditor的配置)
   * @param filePath 文件路径
   * @param data YAML数据
   */
  private async saveYamlFile(filePath: string, data: any): Promise<void> {
    logger.info('💾 Phase 5: 开始写入YAML文件...');
    
    // 🚀 复用完全相同的YAML格式化配置 (与YAMLGenerator/YAMLEditor一致)
    const yamlContent = yaml.dump(data, {
      indent: 2,              // 2空格缩进
      noRefs: true,           // 避免YAML引用
      sortKeys: false,        // 保持字段顺序
      lineWidth: -1,          // 不限制行宽
      noCompatMode: true,     // 使用新版YAML格式
      quotingType: '"',       // 使用双引号
      forceQuotes: false      // 不强制引号
    });
    
    // 🚀 复用YAMLReader的路径解析逻辑
    const resolvedPath = await this.resolveWorkspacePath(filePath);
    
    // 确保目录存在
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });
    
    // 写入文件
    await fs.writeFile(resolvedPath, yamlContent, 'utf-8');
    
    logger.info(`✅ YAML文件写入成功: ${resolvedPath}`);
  }
  
  /**
   * 🚀 复用YAMLReader的路径解析方法
   * @param relativePath 相对路径
   * @returns 绝对路径
   */
  private async resolveWorkspacePath(relativePath: string): Promise<string> {
    // 如果已经是绝对路径，直接返回
    if (path.isAbsolute(relativePath)) {
      return relativePath;
    }

    try {
      // 🚀 优先获取SessionContext的baseDir (与YAMLReader完全相同的逻辑)
      const { SessionManager } = await import('../../../core/session-manager');
      const sessionManager = SessionManager.getInstance();
      const currentSession = await sessionManager.getCurrentSession();
      
      if (currentSession?.baseDir) {
        const absolutePath = path.resolve(currentSession.baseDir, relativePath);
        logger.info(`🔗 路径解析（使用项目baseDir）: ${relativePath} -> ${absolutePath}`);
        return absolutePath;
      } else {
        logger.warn(`⚠️ SessionContext中没有baseDir，回退到工作区根目录`);
      }
    } catch (error) {
      logger.warn(`⚠️ 获取SessionContext失败，回退到工作区根目录: ${(error as Error).message}`);
    }

    // 🚀 回退策略：使用VSCode工作区根目录 (与YAMLReader相同)
    const vscode = require('vscode');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new ScaffoldError(
        ScaffoldErrorType.SCHEMA_LOAD_FAILED,
        '未找到VSCode工作区，无法解析文件路径'
      );
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const absolutePath = path.resolve(workspaceRoot, relativePath);
    
    logger.info(`🔗 路径解析（回退到工作区根目录）: ${relativePath} -> ${absolutePath}`);
    return absolutePath;
  }

  // writeSummaryLog 方法已被删除，现在使用统一的 writeToQualityReport 方法
  
  /**
   * 🆕 Phase 1.5: 标准化YAML数据结构
   * 自动修复AI生成的对象结构为标准数组结构
   * @param data 原始YAML数据
   * @returns 标准化后的YAML数据
   */
  private normalizeYAMLStructure(data: any): RequirementsYAMLStructure {
    logger.info('🔧 Phase 1.5: 开始数据结构标准化...');
    
    // 需要检查的字段列表（requirements.yaml的标准字段）
    const fieldNames = [
      'user_stories', 'use_cases', 'functional_requirements',
      'non_functional_requirements', 'interface_requirements', 
      'data_requirements', 'assumptions', 'dependencies', 'constraints'
    ];
    
    let fixedCount = 0;
    let totalEntitiesFixed = 0;
    
    for (const fieldName of fieldNames) {
      if (data[fieldName]) {
        if (!Array.isArray(data[fieldName])) {
          // 检测是否为AI错误生成的对象结构 (数字索引键)
          if (this.isIndexedObjectStructure(data[fieldName])) {
            const originalEntities = Object.keys(data[fieldName]).length;
            data[fieldName] = Object.values(data[fieldName]);
            fixedCount++;
            totalEntitiesFixed += originalEntities;
            logger.info(`🔧 修复 ${fieldName}: 对象结构 → 数组结构 (${originalEntities}个实体)`);
          } else if (typeof data[fieldName] === 'object' && data[fieldName] !== null) {
            // 处理空对象或其他不规范对象结构：转换为空数组以避免spread语法错误
            const keys = Object.keys(data[fieldName]);
            if (keys.length === 0) {
              data[fieldName] = [];
              logger.info(`🔧 修复 ${fieldName}: 空对象 → 空数组`);
            } else {
              // 其他对象结构：尝试转换为数组，避免spread错误
              data[fieldName] = Object.values(data[fieldName]);
              fixedCount++;
              totalEntitiesFixed += keys.length;
              logger.info(`🔧 修复 ${fieldName}: 非标准对象结构 → 数组结构 (${keys.length}个实体)`);
            }
          } else {
            logger.warn(`⚠️ ${fieldName} 不是数组且不是对象结构，跳过: ${typeof data[fieldName]}`);
          }
        } else {
          logger.debug(`✅ ${fieldName} 已为标准数组格式，跳过`);
        }
      }
    }
    
    if (fixedCount > 0) {
      logger.info(`✅ 数据结构标准化完成: 修复 ${fixedCount} 个字段，共 ${totalEntitiesFixed} 个实体`);
    } else {
      logger.info(`✅ 数据结构标准化完成: 所有字段均为标准格式，无需修复`);
    }
    
    return data as RequirementsYAMLStructure;
  }

  /**
   * 检测是否为AI错误生成的索引对象结构
   * 判断标准：对象的所有键都是连续的数字字符串 ("0", "1", "2", ...)
   * @param obj 待检测对象
   * @returns 是否为索引对象结构
   */
  private isIndexedObjectStructure(obj: any): boolean {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return false;
    }
    
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return false;
    }
    
    // 检查所有键是否为数字字符串且连续
    const numericKeys = keys.map(k => parseInt(k, 10)).filter(n => !isNaN(n));
    
    // 如果不是所有键都是数字，则不是索引对象
    if (numericKeys.length !== keys.length) {
      return false;
    }
    
    // 检查是否为连续的从0开始的序列
    numericKeys.sort((a, b) => a - b);
    for (let i = 0; i < numericKeys.length; i++) {
      if (numericKeys[i] !== i) {
        return false;
      }
    }
    
    logger.debug(`🔍 检测到索引对象结构: 键[${keys.join(', ')}] → 数组格式`);
    return true;
  }

  /**
   * 从YAML数据中提取所有实体
   * @param data YAML数据
   * @returns 实体数组
   */
  private extractAllEntities(data: RequirementsYAMLStructure): RequirementEntity[] {
    const entities: RequirementEntity[] = [];
    
    // 提取业务需求
    if (data.user_stories) entities.push(...data.user_stories);
    if (data.use_cases) entities.push(...data.use_cases);
    
    // 提取技术需求
    if (data.functional_requirements) entities.push(...data.functional_requirements);
    if (data.non_functional_requirements) entities.push(...data.non_functional_requirements);
    if (data.interface_requirements) entities.push(...data.interface_requirements);
    if (data.data_requirements) entities.push(...data.data_requirements);
    
    // 提取ADC约束（扁平化结构）
    if (data.assumptions) entities.push(...data.assumptions);
    if (data.dependencies) entities.push(...data.dependencies);
    if (data.constraints) entities.push(...data.constraints);
    
    // 验证实体ID的唯一性
    const ids = new Set<string>();
    const duplicates: string[] = [];
    
    for (const entity of entities) {
      if (!entity.id) {
        logger.warn(`发现无ID的实体: ${JSON.stringify(entity)}`);
        continue;
      }
      
      if (ids.has(entity.id)) {
        duplicates.push(entity.id);
      } else {
        ids.add(entity.id);
      }
    }
    
    if (duplicates.length > 0) {
      logger.warn(`⚠️ 发现重复ID: ${duplicates.join(', ')}`);
    }
    
    return entities.filter(e => e.id); // 过滤掉无ID的实体
  }
  
  /**
   * 生成同步结果
   * @param entities 所有实体
   * @param danglingReferences 悬空引用
   * @param derivedStats derived_fr统计
   * @param adcStats ADC_related统计
   * @param techSpecStats tech_spec_related统计
   * @param executionTime 执行时间
   * @param consistencyResult 一致性验证结果
   * @returns 同步结果
   */
  private generateResult(
    entities: RequirementEntity[],
    danglingReferences: string[],
    derivedStats: { processed: number; updated: number; skipped: number },
    adcStats: { processed: number; updated: number; skipped: number },
    techSpecStats: { processed: number; updated: number; skipped: number },
    executionTime: number,
    consistencyResult?: ConsistencyValidationResult
  ): TraceabilitySyncResult {
    
    const warnings: string[] = [];
    
    // 生成悬空引用警告
    if (danglingReferences.length > 0) {
      warnings.push(`发现 ${danglingReferences.length} 个悬空引用: ${danglingReferences.join(', ')}`);
    }
    
    logger.info('🎉 追溯关系同步和ID一致性验证完成!');
    logger.info(`📊 统计信息:`);
    logger.info(`   - 实体总数: ${entities.length}`);
    logger.info(`   - derived_fr处理: ${derivedStats.processed} (更新: ${derivedStats.updated})`);
    logger.info(`   - ADC_related处理: ${adcStats.processed} (更新: ${adcStats.updated})`);
    logger.info(`   - tech_spec_related处理: ${techSpecStats.processed} (更新: ${techSpecStats.updated})`);
    logger.info(`   - 悬空引用: ${danglingReferences.length}`);
    if (consistencyResult) {
      logger.info(`   - ID一致性: ${consistencyResult.consistent ? '通过' : '不通过'} (SRS: ${consistencyResult.srsIds.length}, YAML: ${consistencyResult.yamlIds.length})`);
    }
    logger.info(`   - 执行时间: ${executionTime}ms`);
    
    return {
      success: true,
      stats: {
        entitiesProcessed: entities.length,
        derivedFrAdded: derivedStats.updated,
        adcRelatedAdded: adcStats.updated,
        techSpecRelatedAdded: techSpecStats.updated,
        danglingReferencesFound: danglingReferences.length,
        executionTime,
        consistencyValidated: !!consistencyResult
      },
      consistencyResult,
      danglingReferences: danglingReferences.length > 0 ? danglingReferences : undefined
    };
  }
  
  /**
   * 处理错误
   * @param error 错误对象
   * @param executionTime 执行时间
   * @returns 错误结果
   */
  private handleError(error: Error, executionTime: number): TraceabilitySyncResult {
    logger.error(`❌ 追溯关系同步失败: ${error.message}`);
    logger.error(`📊 执行时间: ${executionTime}ms`);
    
    return {
      success: false,
      stats: {
        entitiesProcessed: 0,
        derivedFrAdded: 0,
        adcRelatedAdded: 0,
        techSpecRelatedAdded: 0,
        danglingReferencesFound: 0,
        executionTime
      },
      error: error.message
    };
  }
  
  /**
   * 写入统一的质量报告（替换 writeSummaryLog）
   */
  private async writeToQualityReport(
    args: TraceabilityCompletionArgs,
    entities: RequirementEntity[],
    danglingRefs: string[],
    derivedStats: { processed: number; updated: number; skipped: number },
    adcStats: { processed: number; updated: number; skipped: number },
    techSpecStats: { processed: number; updated: number; skipped: number },
    executionTime: number,
    consistencyResult?: ConsistencyValidationResult
  ): Promise<void> {
    try {
      logger.info('📝 写入统一质量报告...');
      
      const reportWriter = new QualityReportWriter();
      const projectName = await this.getProjectName();
      
      // 第一个检查项: ID 一致性验证
      if (consistencyResult) {
        const consistencyIssues = this.buildConsistencyIssues(consistencyResult);
        
        await reportWriter.appendCheckToReport(
          projectName,
          'id-consistency',
          'traceability-completion-tool',
          consistencyIssues,
          {
            srsIdsCount: consistencyResult.srsIds.length,
            yamlIdsCount: consistencyResult.yamlIds.length,
            missingInYaml: consistencyResult.missingInYaml.length,
            missingInSrs: consistencyResult.missingInSrs.length,
            consistent: consistencyResult.consistent,
            executionTime: `${consistencyResult.executionTime}ms`
          }
        );
        
        logger.info(`✅ ID一致性检查报告已写入: ${consistencyResult.consistent ? '一致' : '发现问题'}`);
      }
      
      // 第二个检查项: 追溯关系完整性
      const traceabilityIssues = this.buildTraceabilityIssues(danglingRefs);
      
      await reportWriter.appendCheckToReport(
        projectName,
        'traceability-completeness',
        'traceability-completion-tool',
        traceabilityIssues,
        {
          entitiesProcessed: entities.length,
          derivedFrAdded: derivedStats.updated,
          adcRelatedAdded: adcStats.updated,
          techSpecRelatedAdded: techSpecStats.updated,
          danglingReferencesFound: danglingRefs.length,
          executionTime: `${executionTime}ms`
        }
      );
      
      logger.info(`✅ 追溯关系完整性检查报告已写入: 处理${entities.length}个实体，发现${danglingRefs.length}个悬空引用`);
      logger.info('📊 统一质量报告写入成功');
      
    } catch (error) {
      logger.warn(`⚠️ 写入质量报告失败: ${(error as Error).message}`);
      // 不抛出错误，避免影响主流程
    }
  }
  
  /**
   * 构建 ID 一致性问题列表
   */
  private buildConsistencyIssues(consistencyResult: ConsistencyValidationResult): Issue[] {
    const issues: Issue[] = [];
    
    // SRS中缺失的ID
    for (const id of consistencyResult.missingInSrs) {
      issues.push({
        file: 'SRS.md',
        severity: 'error',
        message: `ID ${id} exists in requirements.yaml but missing in SRS.md`
      });
    }
    
    // YAML中缺失的ID
    for (const id of consistencyResult.missingInYaml) {
      issues.push({
        file: 'requirements.yaml',
        severity: 'error',
        message: `ID ${id} exists in SRS.md but missing in requirements.yaml`
      });
    }
    
    return issues;
  }
  
  /**
   * 构建追溯关系问题列表
   */
  private buildTraceabilityIssues(danglingRefs: string[]): Issue[] {
    const issues: Issue[] = [];
    
    // 悬空引用问题
    for (const ref of danglingRefs) {
      issues.push({
        file: 'requirements.yaml',
        severity: 'warning',
        message: `Dangling reference found: ${ref} (referenced but not defined)`
      });
    }
    
    return issues;
  }
  
  /**
   * 获取项目名称
   */
  private async getProjectName(): Promise<string> {
    try {
      const { SessionManager } = await import('../../../core/session-manager');
      const sessionManager = SessionManager.getInstance();
      const currentSession = await sessionManager.getCurrentSession();
      
      return currentSession?.projectName || 'unnamed';
    } catch (error) {
      logger.warn(`Failed to get project name: ${(error as Error).message}`);
      return 'unnamed';
    }
  }
} 