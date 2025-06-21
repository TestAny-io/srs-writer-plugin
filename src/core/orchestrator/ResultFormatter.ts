import { Logger } from '../../utils/logger';

/**
 * 结果格式化器 - 负责工具执行结果的格式化和汇总
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
} 