import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { SessionContext } from '../../types/session';

/**
 * 提示词管理器 - 负责模板加载和提示词生成
 */
export class PromptManager {
  private logger = Logger.getInstance();

  /**
   * 🚀 构建自适应工具规划提示词（v3.0版本：基于orchestrator.md模板）
   * 
   * Code Review优化：支持分离的上下文参数
   */
  public async buildAdaptiveToolPlanningPrompt(
    userInput: string,
    sessionContext: SessionContext,
    historyContext: string,
    toolResultsContext: string,
    getTools: () => Promise<{ definitions: any[], jsonSchema: string }>,
    retrieveRelevantKnowledge: (userInput: string, sessionContext: SessionContext) => Promise<string | null>
  ): Promise<string> {
    // 1. 读取 orchestrator.md 模板文件
    // 🚀 健壮的多环境路径解析
    const templatePath = await this.resolveTemplatePath('orchestrator.md');
    let promptTemplate: string;
    try {
      promptTemplate = await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      this.logger.error('CRITICAL: Failed to load orchestrator.md prompt template!', error as Error);
      throw new Error('Could not load core prompt template.');
    }

    // 2. 准备所有需要动态注入的数据
    // 🚀 关键修改：调用新的缓存方法
    const { jsonSchema: toolsJsonSchema } = await getTools();
    const relevantKnowledge = await retrieveRelevantKnowledge(userInput, sessionContext);

    // 3. 执行"邮件合并"，替换所有占位符
    let finalPrompt = promptTemplate;
    finalPrompt = finalPrompt.replace('{{USER_INPUT}}', userInput);
    finalPrompt = finalPrompt.replace('{{TOOLS_JSON_SCHEMA}}', toolsJsonSchema);
    finalPrompt = finalPrompt.replace('{{CONVERSATION_HISTORY}}', historyContext || 'No actions have been taken yet.');
    
    // 🚀 Code Review新增：支持工具结果上下文占位符
    if (finalPrompt.includes('{{TOOL_RESULTS_CONTEXT}}')) {
      finalPrompt = finalPrompt.replace('{{TOOL_RESULTS_CONTEXT}}', toolResultsContext || 'No tool results available.');
    }
    
    finalPrompt = finalPrompt.replace('{{RELEVANT_KNOWLEDGE}}', relevantKnowledge || 'No specific knowledge retrieved.');

    return finalPrompt;
  }

  /**
   * 🚀 健壮的模板路径解析 - 多环境支持
   */
  public async resolveTemplatePath(templateFileName: string): Promise<string> {
    const possiblePaths = [
      // 开发环境路径 (TypeScript编译后)
      path.join(__dirname, '..', '..', '..', 'rules', templateFileName),
      // 打包环境路径 (webpack复制后)
      path.join(__dirname, '..', '..', 'rules', templateFileName),
      path.join(__dirname, '..', 'rules', templateFileName),
      path.join(__dirname, 'rules', templateFileName)
    ];

    // 尝试获取扩展路径作为备选
    const extensionId = 'testany-co.srs-writer-plugin';
    const extension = vscode.extensions.getExtension(extensionId);
    if (extension?.extensionPath) {
      possiblePaths.push(path.join(extension.extensionPath, 'rules', templateFileName));
    }

    // 工作目录路径 (最后备选)
    possiblePaths.push(path.join(process.cwd(), 'rules', templateFileName));

    for (const templatePath of possiblePaths) {
      try {
        await fs.access(templatePath);
        this.logger.info(`✅ Found template at: ${templatePath}`);
        return templatePath;
      } catch (error) {
        // 继续尝试下一个路径
        this.logger.debug(`❌ Template not found at: ${templatePath}`);
        continue;
      }
    }

    this.logger.error(`❌ Template file not found: ${templateFileName}`);
    this.logger.error(`Searched paths:`);
    possiblePaths.forEach((p, index) => {
      this.logger.error(`  ${index + 1}. ${p}`);
    });
    throw new Error(`Template file not found: ${templateFileName}. Please ensure the 'rules' directory is correctly packaged.`);
  }
} 