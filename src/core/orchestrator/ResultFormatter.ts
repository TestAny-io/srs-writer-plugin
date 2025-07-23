import { Logger } from '../../utils/logger';

/**
 * 结果格式化器 - 负责工具执行结果的格式化和汇总
 * 
 * 🚀 Phase 2新增：支持语义编辑结果格式化
 * 🚀 Phase 3新增：支持执行计划和章节标题格式化
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
  // 🚀 Phase 3新增：执行计划和章节标题格式化支持
  // ============================================================================

  /**
   * 格式化执行计划概览，包含章节标题信息
   */
  public formatExecutionPlan(plan: { 
    planId: string; 
    description: string; 
    steps: Array<{
      step: number;
      description: string;
      specialist: string;
      context_dependencies: number[];
      output_chapter_titles?: string[];
    }>
  }): string {
    let report = `📋 **执行计划概览**\n\n`;
    
    report += `🎯 **计划信息**:\n`;
    report += `  • 计划ID: ${plan.planId}\n`;
    report += `  • 目标: ${plan.description}\n`;
    report += `  • 总步骤: ${plan.steps.length}个\n\n`;

    report += `📝 **步骤规划**:\n`;
    plan.steps.forEach(step => {
      report += `  **步骤 ${step.step}**: ${step.description}\n`;
      report += `    🔧 专家: ${step.specialist}\n`;
      
      if (step.context_dependencies && step.context_dependencies.length > 0) {
        report += `    📎 依赖: 步骤 ${step.context_dependencies.join(', ')}\n`;
      }
      
      if (step.output_chapter_titles && step.output_chapter_titles.length > 0) {
        report += `    📄 预期章节:\n`;
        step.output_chapter_titles.forEach(title => {
          report += `      • ${title}\n`;
        });
      }
      report += `\n`;
    });

    // 生成章节标题总览
    const allChapterTitles = plan.steps
      .filter(step => step.output_chapter_titles && step.output_chapter_titles.length > 0)
      .flatMap(step => step.output_chapter_titles!);

    if (allChapterTitles.length > 0) {
      report += `📖 **预期文档结构**:\n`;
      allChapterTitles.forEach((title, index) => {
        report += `  ${index + 1}. ${title}\n`;
      });
      report += `\n`;
    }

    return report;
  }

  /**
   * 格式化计划执行结果，包含步骤完成情况和章节产出
   */
  public formatPlanExecutionResult(result: {
    summary: string;
    executionTime: number;
    totalSteps: number;
    stepResults: { [key: number]: any };
    finalOutput?: any;
  }): string {
    let report = `🎉 **计划执行完成**\n\n`;
    
    report += `📊 **执行摘要**:\n`;
    report += `  • ${result.summary}\n`;
    report += `  • 执行时间: ${result.executionTime}ms\n`;
    report += `  • 完成步骤: ${Object.keys(result.stepResults).length}/${result.totalSteps}\n\n`;

    // 步骤执行详情
    report += `📋 **步骤执行详情**:\n`;
    Object.entries(result.stepResults).forEach(([stepNum, stepResult]) => {
      const status = stepResult.success ? '✅' : '❌';
      report += `  ${status} **步骤 ${stepNum}**: ${stepResult.specialist}\n`;
      report += `    ⏱️ 执行时间: ${stepResult.executionTime}ms (${stepResult.iterations}次迭代)\n`;
      
      if (stepResult.contentLength > 0) {
        report += `    📝 内容长度: ${stepResult.contentLength}字符\n`;
      }
      
      if (stepResult.hasStructuredData) {
        report += `    📊 包含结构化数据\n`;
      }
      report += `\n`;
    });

    // 最终输出信息
    if (result.finalOutput) {
      report += `🎯 **最终产出**:\n`;
      if (result.finalOutput.content) {
        const contentPreview = result.finalOutput.content.substring(0, 200);
        report += `  📄 内容预览: ${contentPreview}${result.finalOutput.content.length > 200 ? '...' : ''}\n`;
      }
      if (result.finalOutput.structuredData) {
        report += `  📊 结构化数据: 已生成\n`;
      }
      report += `\n`;
    }

    return report;
  }

  /**
   * 格式化步骤结果，特别展示章节标题产出
   */
  public formatStepResultWithChapters(
    stepNumber: number,
    specialist: string,
    result: any,
    expectedChapterTitles?: string[]
  ): string {
    let report = `📋 **步骤 ${stepNumber} 执行结果** (${specialist})\n\n`;
    
    const status = result.success ? '✅ 成功' : '❌ 失败';
    report += `🔧 **执行状态**: ${status}\n`;
    
    if (result.success) {
      report += `⏱️ **执行时间**: ${result.metadata?.executionTime || 0}ms\n`;
      report += `🔄 **迭代次数**: ${result.metadata?.iterations || 1}次\n`;
      
      if (result.content) {
        report += `📝 **内容长度**: ${result.content.length}字符\n`;
      }
      
      // 显示预期的章节标题
      if (expectedChapterTitles && expectedChapterTitles.length > 0) {
        report += `\n📖 **预期章节标题**:\n`;
        expectedChapterTitles.forEach(title => {
          report += `  • ${title}\n`;
        });
      }
      
      // 如果有文件编辑结果，显示编辑信息
      if (result.metadata?.editResult) {
        const editResult = result.metadata.editResult;
        report += `\n🔧 **文件编辑结果**:\n`;
        report += `  • 成功操作: ${editResult.appliedCount}个\n`;
        report += `  • 失败操作: ${editResult.failedCount}个\n`;
        report += `  • 编辑类型: ${editResult.editType}\n`;
        
        if (editResult.semanticErrors && editResult.semanticErrors.length > 0) {
          report += `  ⚠️ 语义错误: ${editResult.semanticErrors.length}个\n`;
        }
      }
      
      // 如果有结构化数据，提供摘要
      if (result.structuredData) {
        report += `\n📊 **结构化数据**: 已生成\n`;
      }
      
    } else {
      report += `❌ **错误信息**: ${result.error || '未知错误'}\n`;
    }
    
    report += `\n`;
    return report;
  }

  /**
   * 提取并格式化章节标题映射
   */
  public formatChapterTitleMapping(stepResults: { [key: number]: any }, planSteps?: any[]): string {
    if (!planSteps) return '';
    
    let report = `📖 **章节标题产出映射**\n\n`;
    
    planSteps.forEach(step => {
      const stepResult = stepResults[step.step];
      if (step.output_chapter_titles && step.output_chapter_titles.length > 0) {
        const status = stepResult?.success ? '✅' : stepResult ? '❌' : '⏳';
        report += `${status} **步骤 ${step.step}** (${step.specialist}):\n`;
        
        step.output_chapter_titles.forEach((title: string) => {
          report += `  📄 ${title}\n`;
        });
        report += `\n`;
      }
    });
    
    return report;
  }

  // ============================================================================
  // 🚀 Phase 2: 语义编辑结果格式化支持 (保持不变)
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
    
    // 🚀 AST重构：更新元数据显示
    if (metadata.astNodeCount !== undefined) {
      report += `  • AST节点: ${metadata.astNodeCount}个章节\n`;
      report += `  • 文档长度: ${metadata.documentLength || 0}字符\n`;
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
    if (toolName === 'executeMarkdownEdits' || (result.appliedIntents !== undefined)) {
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