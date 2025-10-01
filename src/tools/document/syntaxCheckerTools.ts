/**
 * 语法检查工具定义
 * 提供 Markdown 和 YAML 文件的语法检查功能
 */

import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';
import { SyntaxChecker } from './syntaxChecker/SyntaxChecker';
import { SyntaxCheckArgs, SyntaxCheckResult } from './syntaxChecker/types';

const logger = Logger.getInstance();

// ============================================================================
// 工具定义
// ============================================================================

/**
 * syntax-checker 工具定义
 */
export const syntaxCheckerToolDefinition = {
  name: "syntax-checker",
  description: "Check syntax and format issues in Markdown and YAML files, generate quality report. Automatically detects file types and skips unsupported formats with warnings.",
  
  parameters: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Brief summary of the syntax checking purpose (e.g., 'Check project documentation syntax', 'Validate file formats before release')"
      },
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File path to check (relative to project root)"
            }
          },
          required: ["path"],
          additionalProperties: false
        },
        description: "Array of file objects to check. Tool automatically detects if file is Markdown (.md) or YAML (.yaml/.yml) and skips other formats with warnings."
      }
    },
    required: ["summary", "files"],
    additionalProperties: false
  },
  
  // 访问控制（复用现有模式）
  accessibleBy: [
    // CallerType.ORCHESTRATOR_TOOL_EXECUTION,
    CallerType.SPECIALIST_PROCESS,
    // CallerType.SPECIALIST_CONTENT
  ],
  
  // 工具分类
  interactionType: 'autonomous',
  riskLevel: 'low',
  requiresConfirmation: false
};

// ============================================================================
// 工具实现
// ============================================================================

/**
 * 执行语法检查
 * @param args 检查参数
 * @returns 检查结果
 */
export async function syntaxCheckerTool(args: {
  summary: string;
  files: Array<{ path: string }>;
}): Promise<SyntaxCheckResult> {
  try {
    logger.info(`🔧 Syntax check request: ${args.summary}`);
    logger.info(`📁 Files to check: ${args.files.length} files`);
    
    // 记录文件列表
    args.files.forEach((file, index) => {
      logger.debug(`   ${index + 1}. ${file.path}`);
    });
    
    // 创建语法检查器实例并执行
    const checker = new SyntaxChecker();
    const result = await checker.checkFiles({
      summary: args.summary,
      files: args.files
    });
    
    if (result.success) {
      logger.info(`✅ Syntax check completed successfully:`);
      logger.info(`   - Total files: ${result.totalFiles}`);
      logger.info(`   - Processed files: ${result.processedFiles}`);
      logger.info(`   - Skipped files: ${result.skippedFiles.length}`);
      logger.info(`   - Total issues: ${result.issues.length}`);
      logger.info(`   - Errors: ${result.issues.filter(i => i.severity === 'error').length}`);
      logger.info(`   - Warnings: ${result.issues.filter(i => i.severity === 'warning').length}`);
      if (result.executionTime) {
        logger.info(`   - Execution time: ${result.executionTime}ms`);
      }
      
      if (result.skippedFiles.length > 0) {
        logger.info(`   - Skipped files: ${result.skippedFiles.join(', ')}`);
      }
    } else {
      logger.warn(`❌ Syntax check failed: ${result.error}`);
    }
    
    return result;
    
  } catch (error) {
    const errorMsg = `Syntax check failed: ${(error as Error).message}`;
    logger.error(errorMsg, error as Error);
    
    return {
      success: false,
      totalFiles: args.files.length,
      processedFiles: 0,
      skippedFiles: [],
      issues: [],
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
export const syntaxCheckerToolImplementations = {
  "syntax-checker": syntaxCheckerTool
};

/**
 * 工具定义数组
 */
export const syntaxCheckerToolDefinitions = [
  syntaxCheckerToolDefinition
];

/**
 * 语法检查工具分类信息
 */
export const syntaxCheckerToolsCategory = {
  name: 'Syntax Checker Tools',
  description: 'Document syntax and format checking tools for Markdown and YAML files',
  tools: syntaxCheckerToolDefinitions.map(tool => tool.name),
  layer: 'document'
};
