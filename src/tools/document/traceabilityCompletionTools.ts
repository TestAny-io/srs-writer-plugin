/**
 * 追溯性同步工具定义
 * 提供完整的追溯关系计算功能，解决SRS生成的时序依赖问题
 */

import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';
import { TraceabilityCompleter } from './traceabilityCompletion/TraceabilityCompleter';
import { 
  TraceabilityCompletionArgs, 
  TraceabilitySyncResult 
} from './traceabilityCompletion/types';

const logger = Logger.getInstance();

// ============================================================================
// 工具定义
// ============================================================================

/**
 * traceability-completion-tool 工具定义
 */
export const traceabilityCompletionToolDefinition = {
  name: "traceability-completion-tool",
  description: `Complete the calculation of requirement traceability relationships and ID consistency verification, automatically fill the derived_fr, ADC_related and tech_spec_related fields.`,

  parameters: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Brief summary of the purpose of this traceability synchronization and consistency verification (e.g., 'Initialize SRS traceability relationships and verify consistency', 'Update traceability relationships after requirement changes')"
      },
      targetFile: {
        type: "string", 
        description: "Target requirements.yaml file name (relative to the project root directory, the tool automatically gets baseDir, e.g., 'requirements.yaml')",
        default: "requirements.yaml"
      },
      srsFile: {
        type: "string",
        description: "SRS.md file path (used for ID consistency verification, relative to the project root directory, e.g., 'SRS.md')",
        default: "SRS.md"
      }
    },
    required: ["summary"],
    additionalProperties: false
  },
  
  // 🚀 Reuse: Access control (reference yamlEditorTools)
      accessibleBy: [
        // CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
        // CallerType.SPECIALIST_CONTENT, 
        CallerType.SPECIALIST_PROCESS
      ],
  
  // 🚀 Reuse: Intelligent classification attributes
  interactionType: 'autonomous',
  riskLevel: 'medium',  // Involves file modification
  requiresConfirmation: false
};

// ============================================================================
// 工具实现
// ============================================================================

/**
 * 执行追溯性同步
 * @param args 同步参数
 * @returns 同步结果
 */
export async function traceabilityCompletionTool(args: {
  summary: string;
  targetFile?: string;
  srsFile?: string;
}): Promise<TraceabilitySyncResult> {
  try {
    logger.info(`🔧 追溯性同步请求: ${args.summary}`);
    logger.info(`📁 目标文件: ${args.targetFile || 'requirements.yaml'}`);
    
    // 构建完整参数
    const fullArgs: TraceabilityCompletionArgs = {
      summary: args.summary,
      targetFile: args.targetFile || 'requirements.yaml',
      srsFile: args.srsFile || 'SRS.md'
    };
    
    // 🚀 记录操作意图（用于调试和追踪）
    logger.info(`🎯 追溯同步意图: ${fullArgs.summary}`);
    
    // 创建追溯完成器实例并执行
    const completer = new TraceabilityCompleter();
    const result = await completer.syncFile(fullArgs);
    
    if (result.success) {
      logger.info(`✅ 追溯性同步成功: 处理 ${result.stats.entitiesProcessed} 个实体`);
      if (result.stats.derivedFrAdded > 0) {
        logger.info(`   - derived_fr字段: 添加 ${result.stats.derivedFrAdded} 个`);
      }
      if (result.stats.adcRelatedAdded > 0) {
        logger.info(`   - ADC_related字段: 添加 ${result.stats.adcRelatedAdded} 个`);
      }
      if (result.stats.techSpecRelatedAdded > 0) {
        logger.info(`   - tech_spec_related字段: 添加 ${result.stats.techSpecRelatedAdded} 个`);
      }
      if (result.stats.danglingReferencesFound > 0) {
        logger.warn(`   - 悬空引用: ${result.stats.danglingReferencesFound} 个 (已从结果中排除)`);
      }
      logger.info(`   - 执行时间: ${result.stats.executionTime}ms`);
    } else {
      logger.warn(`❌ 追溯性同步失败: ${result.error}`);
    }
    
    return result;
    
  } catch (error) {
    const errorMsg = `追溯性同步失败: ${(error as Error).message}`;
    logger.error(errorMsg, error as Error);
    
    return {
      success: false,
      stats: {
        entitiesProcessed: 0,
        derivedFrAdded: 0,
        adcRelatedAdded: 0,
        techSpecRelatedAdded: 0,
        danglingReferencesFound: 0,
        executionTime: 0
      },
      error: errorMsg
    };
  }
}

// ============================================================================
// 导出定义
// ============================================================================

/**
 * 工具实现映射
 */
export const traceabilityCompletionToolImplementations = {
  "traceability-completion-tool": traceabilityCompletionTool
};

/**
 * 工具定义数组
 */
export const traceabilityCompletionToolDefinitions = [
  traceabilityCompletionToolDefinition
];

/**
 * 追溯性同步工具分类信息
 */
export const traceabilityCompletionToolsCategory = {
  name: 'Traceability Completion Tools',
  description: 'Complete traceability relationship computation tools, solving SRS generation temporal dependency issues',
  tools: traceabilityCompletionToolDefinitions.map(tool => tool.name),
  layer: 'document'
}; 