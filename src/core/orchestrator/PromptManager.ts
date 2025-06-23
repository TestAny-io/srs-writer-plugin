import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { SessionContext } from '../../types/session';
import { CallerType } from '../../types/index';

/**
 * 提示词管理器 - 负责模板加载和提示词生成
 */
export class PromptManager {
  private logger = Logger.getInstance();

  /**
   * 🚀 构建自适应工具规划提示词（v3.0版本：基于orchestrator.md模板）
   * 
   * Code Review优化：支持分离的上下文参数 + 访问控制
   */
  public async buildAdaptiveToolPlanningPrompt(
    userInput: string,
    sessionContext: SessionContext,
    historyContext: string,
    toolResultsContext: string,
    getTools: (caller?: any) => Promise<{ definitions: any[], jsonSchema: string }>,
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
    // 🚀 智能检测：根据用户输入选择合适的工具集
    const callerType = this.detectIntentType(userInput);
    const { jsonSchema: toolsJsonSchema } = await getTools(callerType);
    const relevantKnowledge = await retrieveRelevantKnowledge(userInput, sessionContext);

    // 3. 执行"邮件合并"，替换所有占位符
    // 🐛 DEBUG: 记录所有占位符的值
    this.logger.info(`🔍 [DEBUG] Placeholder values for prompt building:`);
    this.logger.info(`🔍 [DEBUG] - USER_INPUT: "${userInput}"`);
    this.logger.info(`🔍 [DEBUG] - TOOLS_JSON_SCHEMA length: ${toolsJsonSchema.length}`);
    this.logger.info(`🔍 [DEBUG] - CONVERSATION_HISTORY: "${historyContext || 'No actions have been taken yet.'}"`);
    this.logger.info(`🔍 [DEBUG] - TOOL_RESULTS_CONTEXT: "${toolResultsContext || 'No tool results available.'}"`);
    this.logger.info(`🔍 [DEBUG] - RELEVANT_KNOWLEDGE: "${relevantKnowledge || 'No specific knowledge retrieved.'}"`);
    
    let finalPrompt = promptTemplate;
    // 🐛 修复：使用全局正则表达式替换来处理模板中的多个相同占位符
    finalPrompt = finalPrompt.replace(/\{\{USER_INPUT\}\}/g, userInput);
    finalPrompt = finalPrompt.replace(/\{\{TOOLS_JSON_SCHEMA\}\}/g, toolsJsonSchema);
    finalPrompt = finalPrompt.replace(/\{\{CONVERSATION_HISTORY\}\}/g, historyContext || 'No actions have been taken yet.');
    finalPrompt = finalPrompt.replace(/\{\{TOOL_RESULTS_CONTEXT\}\}/g, toolResultsContext || 'No tool results available.');
    finalPrompt = finalPrompt.replace(/\{\{RELEVANT_KNOWLEDGE\}\}/g, relevantKnowledge || 'No specific knowledge retrieved.');

    // 🐛 DEBUG: 检查是否还有未替换的占位符
    const remainingPlaceholders = finalPrompt.match(/\{\{[^}]+\}\}/g);
    if (remainingPlaceholders) {
      this.logger.warn(`🔍 [DEBUG] Remaining unreplaced placeholders: ${remainingPlaceholders.join(', ')}`);
    }
    
    // 🐛 DEBUG: 记录最终生成的prompt的开头部分
    const promptPreview = finalPrompt.substring(0, 500);
    this.logger.info(`🔍 [DEBUG] Final prompt preview (first 500 chars): "${promptPreview}..."`);

    return finalPrompt;
  }

  /**
   * 🚀 智能意图检测：根据用户输入选择合适的 CallerType (简化为两种模式)
   */
  private detectIntentType(userInput: string): CallerType {
    const input = userInput.toLowerCase();
    
    // 检测知识问答和一般对话类型的输入
    const knowledgeAndChatPatterns = [
      /^(how|what|why|when|where|which)/,
      /如何|怎么|什么是|为什么|怎样/,
      /best practices?|最佳实践/,
      /guidance|指导|建议/,
      /explanation|解释|说明/,
      /^(hi|hello|hey|thanks|thank you)/,
      /^(你好|谢谢|感谢)/,
      /weather|天气/,
      /how are you|你好吗/,
      /^(good morning|good afternoon|good evening)/
    ];
    
    // 检测知识问答和闲聊（合并为 KNOWLEDGE_QA 模式）
    if (knowledgeAndChatPatterns.some(pattern => pattern.test(input))) {
      this.logger.info(`🧠 Detected KNOWLEDGE_QA intent (including general conversation): ${userInput}`);
      return CallerType.ORCHESTRATOR_KNOWLEDGE_QA;
    }
    
    // 默认为工具执行模式
    this.logger.info(`🛠️ Detected TOOL_EXECUTION intent: ${userInput}`);
    return CallerType.ORCHESTRATOR_TOOL_EXECUTION;
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