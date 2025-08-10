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
  description: `完成需求追溯关系计算，自动填充derived_fr、ADC_related和tech_spec_related字段。

功能说明：
- 读取requirements.yaml文件
- 根据source_requirements字段计算反向追溯关系
- 自动填充US/UC的derived_fr字段 (被哪些技术需求引用)
- 自动填充技术需求的ADC_related字段 (引用了哪些ADC约束)
- 自动填充FR的tech_spec_related字段 (被哪些技术规范需求引用)
- 处理悬空引用并输出警告
- 保证幂等性：多次运行结果一致

适用场景：
- SRS生成流程的最后步骤，统一计算所有追溯关系
- 需求文档更新后重新同步追溯关系
- 验证追溯关系完整性

计算规则：
- derived_fr: US/UC被哪些FR/NFR/IFR/DAR引用 (反向追溯)
- ADC_related: FR/NFR/IFR/DAR引用了哪些ADC-ASSU/DEPEN/CONST约束
- tech_spec_related: FR被哪些NFR/IFR/DAR技术规范需求引用 (反向追溯)
- 字母升序排序: 所有computed字段按字母顺序排列
- 悬空引用: 继续处理其他ID，最终从计算结果中排除`,

  parameters: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "简要描述本次追溯同步的目的 (如：'初始化SRS追溯关系', '更新需求变更后的追溯关系')"
      },
      targetFile: {
        type: "string", 
        description: "目标requirements.yaml文件名 (相对于项目根目录，工具自动获取baseDir，如：'requirements.yaml')",
        default: "requirements.yaml"
      }
    },
    required: ["description", "targetFile"],
    additionalProperties: false
  },
  
  // 🚀 复用：访问控制 (参考yamlEditorTools)
      accessibleBy: [
        // CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
        // CallerType.SPECIALIST_CONTENT, 
        CallerType.SPECIALIST_PROCESS
      ],
  
  // 🚀 复用：智能分类属性
  interactionType: 'autonomous',
  riskLevel: 'medium',  // 涉及文件修改
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
  description: string;
  targetFile?: string;
  options?: {
    checkOnly?: boolean;
    verbose?: boolean;
  };
}): Promise<TraceabilitySyncResult> {
  try {
    logger.info(`🔧 追溯性同步请求: ${args.description}`);
    logger.info(`📁 目标文件: ${args.targetFile || 'requirements.yaml'}`);
    
    // 构建完整参数
    const fullArgs: TraceabilityCompletionArgs = {
      description: args.description,
      targetFile: args.targetFile || 'requirements.yaml'
    };
    
    // 🚀 记录操作意图（用于调试和追踪）
    logger.info(`🎯 追溯同步意图: ${fullArgs.description}`);
    
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