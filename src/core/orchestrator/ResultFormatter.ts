import { Logger } from '../../utils/logger';

/**
 * 结果格式化器 - 负责工具执行结果的格式化和汇总
 * 
 * 🚀 Phase 2新增：支持语义编辑结果格式化
 */
export class ResultFormatter {
  private logger = Logger.getInstance();

  /**
   * 🚀 工具结果格式化：生成结构化的执行报告
   */
  public formatToolResults(toolResults: any[]): string {
    const successfulTools = toolResults.filter(r => r.success);
    const failedTools = toolResults.filter(r => !r.success);
    
    let report = `🔧 **工具执行报告** (${successfulTools.length}/${toolResults.length}成功)\n\n`;
    
    if (successfulTools.length > 0) {
      report += `✅ **成功执行**:\n`;
      successfulTools.forEach(tool => {
        report += `  • ${tool.toolName}: 执行成功\n`;
      });
      report += '\n';
    }
    
    if (failedTools.length > 0) {
      report += `❌ **执行失败**:\n`;
      failedTools.forEach(tool => {
        report += `  • ${tool.toolName}: ${tool.error || '未知错误'}\n`;
      });
      report += '\n';
    }
    
    return report;
  }

  /**
   * 🚀 汇总工具执行结果
   */
  public summarizeToolResults(results: any[]): string {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (failed.length === 0) {
      return `✅ 成功执行了 ${successful.length} 个操作`;
    } else if (successful.length === 0) {
      return `❌ ${failed.length} 个操作执行失败`;
    } else {
      return `⚠️ ${successful.length} 个操作成功，${failed.length} 个操作失败`;
    }
  }

  // ============================================================================
  // 🚀 Phase 2新增：语义编辑结果格式化支持
  // ============================================================================

  /**
   * 格式化语义编辑结果
   */
  public formatSemanticEditResult(result: any): string {
    if (!result.metadata) {
      return this.formatBasicToolResult(result);
    }

    const { appliedIntents, failedIntents, metadata } = result;
    const totalIntents = (appliedIntents?.length || 0) + (failedIntents?.length || 0);
    const successRate = totalIntents > 0 ? ((appliedIntents?.length || 0) / totalIntents * 100).toFixed(1) : '0';

    let report = `🎯 **语义编辑执行报告**\n\n`;
    
    // 执行摘要
    report += `📊 **执行摘要**:\n`;
    report += `  • 总编辑意图: ${totalIntents}个\n`;
    report += `  • 成功应用: ${appliedIntents?.length || 0}个\n`;
    report += `  • 执行失败: ${failedIntents?.length || 0}个\n`;
    report += `  • 成功率: ${successRate}%\n`;
    report += `  • 执行时间: ${metadata.executionTime}ms\n`;
    
    if (metadata.documentStructure) {
      report += `  • 文档结构: ${metadata.documentStructure.headings?.length || 0}个标题, ${metadata.documentStructure.sections?.length || 0}个章节\n`;
    }
    report += '\n';

    // 成功的编辑操作
    if (appliedIntents && appliedIntents.length > 0) {
      report += `✅ **成功应用的编辑**:\n`;
      appliedIntents.forEach((intent: any, index: number) => {
        report += `  ${index + 1}. **${intent.type}** → "${intent.target.sectionName}"\n`;
        report += `     📝 ${intent.reason}\n`;
        report += `     🎯 优先级: ${intent.priority || 0}\n\n`;
      });
    }

    // 失败的编辑操作
    if (failedIntents && failedIntents.length > 0) {
      report += `❌ **执行失败的编辑**:\n`;
      failedIntents.forEach((intent: any, index: number) => {
        report += `  ${index + 1}. **${intent.type}** → "${intent.target.sectionName}"\n`;
        report += `     📝 ${intent.reason}\n`;
        report += `     ⚠️ 可能原因: 目标章节未找到或内容冲突\n\n`;
      });
    }

    // 语义错误信息
    if (result.semanticErrors && result.semanticErrors.length > 0) {
      report += `🔍 **语义分析问题**:\n`;
      result.semanticErrors.forEach((error: string, index: number) => {
        report += `  ${index + 1}. ${error}\n`;
      });
      report += '\n';
    }

    return report;
  }

  /**
   * 格式化文档结构分析结果
   */
  public formatDocumentStructureResult(result: any): string {
    if (!result.structure && !result.semanticMap) {
      return this.formatBasicToolResult(result);
    }

    let report = `📋 **文档结构分析结果**\n\n`;

    // 基础信息
    report += `📄 **文档信息**:\n`;
    report += `  • 内容长度: ${result.content?.length || 0}字符\n`;
    
    if (result.structure) {
      const { headings, sections, symbols } = result.structure;
      report += `  • 标题数量: ${headings?.length || 0}个\n`;
      report += `  • 章节数量: ${sections?.length || 0}个\n`;
      report += `  • 语言符号: ${symbols?.length || 0}个\n`;
    }
    report += '\n';

    // 标题结构
    if (result.structure?.headings && result.structure.headings.length > 0) {
      report += `🗂️ **文档结构**:\n`;
      result.structure.headings.forEach((heading: any, index: number) => {
        const indent = '  '.repeat(heading.level - 1);
        report += `${indent}${index + 1}. ${'#'.repeat(heading.level)} ${heading.text} (行${heading.line})\n`;
      });
      report += '\n';
    }

    // 语义映射表
    if (result.semanticMap?.editTargets && result.semanticMap.editTargets.length > 0) {
      report += `🎯 **可编辑目标**:\n`;
      result.semanticMap.editTargets.forEach((target: any, index: number) => {
        report += `  ${index + 1}. "${target.name}" → ${target.selector}\n`;
      });
      report += '\n';
    }

    return report;
  }

  /**
   * 智能结果检测和格式化
   */
  public formatToolResult(toolName: string, result: any): string {
    // 检测结果类型并使用对应的格式化器
    if (toolName === 'executeSemanticEdits' || (result.appliedIntents !== undefined)) {
      return this.formatSemanticEditResult(result);
    }
    
    if (toolName === 'readFileWithStructure' || (result.structure !== undefined || result.semanticMap !== undefined)) {
      return this.formatDocumentStructureResult(result);
    }

    // 默认格式化
    return this.formatBasicToolResult(result);
  }

  /**
   * 基础工具结果格式化（向后兼容）
   */
  private formatBasicToolResult(result: any): string {
    if (result.success === false && result.error) {
      return `❌ 执行失败: ${result.error}`;
    } else if (result.success === true) {
      return `✅ 执行成功`;
    } else {
      return `ℹ️ 执行完成`;
    }
  }
} 