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
   * 🚀 构建结构化提示词（v4.0版本：基于orchestrator.md模板，分离系统指令和用户输入）
   * 
   * 重构说明：解决AI把系统指令当作用户输入的问题
   * - 系统指令：orchestrator.md模板内容
   * - 用户输入：用户的真实需求
   * - 上下文信息：历史记录、工具结果等
   */
  public async buildAdaptiveToolPlanningPrompt(
    userInput: string,
    sessionContext: SessionContext,
    historyContext: string,
    toolResultsContext: string,
    getTools: (caller?: any) => Promise<{ definitions: any[], jsonSchema: string }>
  ): Promise<string> {
    // 1. 读取 orchestrator.md 模板文件作为系统指令
    const templatePath = await this.resolveTemplatePath('orchestrator.md');
    let systemInstructions: string;
    try {
      systemInstructions = await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      this.logger.error('CRITICAL: Failed to load orchestrator.md prompt template!', error as Error);
      throw new Error('Could not load core prompt template.');
    }

    // 2. 准备上下文数据
    const callerType = this.detectIntentType(userInput);
    const { jsonSchema: toolsJsonSchema } = await getTools(callerType);

    // 🔍 [DEBUG-CONTEXT] === PromptManager Context Check ===
    this.logger.info(`🔍 [DEBUG-CONTEXT] PromptManager received:`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] - historyContext: ${historyContext ? `"${historyContext.substring(0, 100)}..."` : 'NULL/EMPTY'}`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] - toolResultsContext: ${toolResultsContext ? `"${toolResultsContext.substring(0, 100)}..."` : 'NULL/EMPTY'}`);
    
    const finalHistoryContext = historyContext || 'No actions have been taken yet.';
    const finalToolResultsContext = toolResultsContext || 'No tool results available.';
    
    this.logger.info(`🔍 [DEBUG-CONTEXT] Final contexts that will be used:`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] - finalHistoryContext: "${finalHistoryContext}"`);
    this.logger.info(`🔍 [DEBUG-CONTEXT] - finalToolResultsContext: "${finalToolResultsContext}"`);

    // 3. 构建结构化提示词 - 明确分离系统指令和用户输入
    const structuredPrompt = await this.buildStructuredPrompt(
      systemInstructions,
      userInput,
      finalHistoryContext,
      finalToolResultsContext,
      toolsJsonSchema,
      sessionContext
    );

    // 🐛 DEBUG: 记录结构化提示词的构建过程
    this.logger.info(`🔍 [DEBUG] Structured prompt built successfully:`);
    this.logger.info(`🔍 [DEBUG] - System instructions length: ${systemInstructions.length}`);
    this.logger.info(`🔍 [DEBUG] - User input: "${userInput}"`);
    this.logger.info(`🔍 [DEBUG] - History context length: ${historyContext?.length || 0}`);
    this.logger.info(`🔍 [DEBUG] - Tool results context length: ${toolResultsContext?.length || 0}`);
    this.logger.info(`🔍 [DEBUG] - Tools JSON schema length: ${toolsJsonSchema.length}`);
    
    // 🐛 DEBUG: 预览最终结构化提示词
    const promptPreview = structuredPrompt.substring(0, 500);
    // this.logger.info(`🔍 [DEBUG] Final structured prompt preview (first 500 chars): "${promptPreview}..."`);
    
    // 🔍 [DEBUG] 输出完整的最终提示词
    // this.logger.info(`🔍 [DEBUG] === COMPLETE FINAL PROMPT ===`);
    // this.logger.info(`🔍 [DEBUG] Complete structured prompt:\n${structuredPrompt}`);
    // this.logger.info(`🔍 [DEBUG] === END COMPLETE FINAL PROMPT ===`);

    return structuredPrompt;
  }

  /**
   * 🚀 构建结构化提示词 - 核心方法
   * 将系统指令和用户输入明确分离，符合VSCode最佳实践
   */
  private async buildStructuredPrompt(
    systemInstructions: string,
    userInput: string,
    historyContext: string,
    toolResultsContext: string,
    toolsJsonSchema: string,
    sessionContext: SessionContext
  ): Promise<string> {
    // 替换系统指令中的占位符
    let processedSystemInstructions = systemInstructions;
    processedSystemInstructions = processedSystemInstructions.replace(/\{\{TOOLS_JSON_SCHEMA\}\}/g, toolsJsonSchema);
    
    // 清理系统指令中的用户输入占位符（这些将在用户部分单独处理）
    processedSystemInstructions = processedSystemInstructions.replace(/\{\{USER_INPUT\}\}/g, '[USER_INPUT_PLACEHOLDER]');
    processedSystemInstructions = processedSystemInstructions.replace(/\{\{CONVERSATION_HISTORY\}\}/g, '[CONVERSATION_HISTORY_PLACEHOLDER]');
    processedSystemInstructions = processedSystemInstructions.replace(/\{\{TOOL_RESULTS_CONTEXT\}\}/g, '[TOOL_RESULTS_CONTEXT_PLACEHOLDER]');

    // 🚀 构建工作区上下文部分 - 简化版本
    const workspaceContextSection = await this.buildWorkspaceContext(sessionContext);

    // 构建结构化提示词
    const structuredPrompt = `# SYSTEM INSTRUCTIONS

${processedSystemInstructions}

# USER REQUEST

The user's actual request that you need to analyze and process:

${userInput}

# CONTEXT INFORMATION

## Workspace Context
${workspaceContextSection}

## Conversation History
${historyContext}

## Tool Results Context
${toolResultsContext}

# Your available tools (in KNOWLEDGE_QA mode)
${toolsJsonSchema}

# FINAL INSTRUCTION

Based on the SYSTEM INSTRUCTIONS above, analyze the USER REQUEST and generate a valid JSON response following the AIPlan interface. Remember to:
1. Clearly distinguish between system instructions (which you must follow) and user request (which you must process)
2. Select the appropriate response_mode based on the user's request
3. Generate well-structured JSON output

Your response must be valid JSON starting with '{' and ending with '}'.`;

    // 🔍 [DEBUG] buildStructuredPrompt 生成的最终提示词
    this.logger.info(`🔍 [DEBUG] === buildStructuredPrompt GENERATED FINAL PROMPT ===`);
    this.logger.info(`🔍 [DEBUG] buildStructuredPrompt final result (length: ${structuredPrompt.length}):\n${structuredPrompt}`);
    this.logger.info(`🔍 [DEBUG] === END buildStructuredPrompt FINAL PROMPT ===`);

    return structuredPrompt;
  }

  /**
   * 🚀 构建工作区上下文信息 - 简化版本
   */
  private async buildWorkspaceContext(sessionContext: SessionContext): Promise<string> {
    try {
      // 1. 获取工作区基础信息
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return `
### Base Status
- Workspace Absolute Path: No workspace
- Session ID: ${sessionContext.sessionContextId}

### Project Status
- Exist projects: 0
- Current Project: No workspace`;
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;
      
      // 2. 计算项目数量（排除特定目录）
      const existProjects = await this.countWorkspaceProjects(workspaceRoot);
      
      // 3. 确定当前项目状态
      const currentProject = this.getCurrentProjectName(sessionContext);
      
      // 4. 确定Base Directory
      const baseDirectory = this.getBaseDirectory(sessionContext, workspaceRoot);
      
      // 5. 获取项目文件列表
      const projectFilesSection = await this.getProjectFilesSection(baseDirectory);
      
      return `
### Base Status
- Workspace Absolute Path: ${workspaceRoot}
- Session ID: ${sessionContext.sessionContextId}

### Project Status
- Exist projects: ${existProjects}
- Current Project: ${currentProject}
- Project Directory (Absolute Path): ${baseDirectory}
${projectFilesSection}`;
      
    } catch (error) {
      this.logger.error('Failed to build workspace context', error as Error);
      return `
### Base Status
- Workspace Absolute Path: Error getting workspace info
- Session ID: ${sessionContext.sessionContextId}

### Project Status
- Exist projects: Unknown
- Current Project: Error
- Project Directory (Absolute Path): Error`;
    }
  }

  /**
   * 🚀 获取项目文件列表部分
   * 复用 PromptAssemblyEngine 的 listDirectoryFiles 逻辑
   */
  private async getProjectFilesSection(baseDirectory: string): Promise<string> {
    try {
      const projectFiles = await this.listProjectFiles(baseDirectory);
      
      if (projectFiles.length === 0) {
        return '\n- Project Files (Relative to baseDir): No files found';
      }
      
      const filesList = projectFiles
        .map(file => `- ${file.relativePath}${file.isDirectory ? ' (directory)' : ''}`)
        .join('\n');
      
      return `
- Project Files (Relative to baseDir):
${filesList}`;
    } catch (error) {
      this.logger.warn(`Failed to list project files: ${(error as Error).message}`);
      return '\n- Project Files (Relative to baseDir): Unable to list files';
    }
  }

  /**
   * 🚀 列出项目目录下的所有文件和子目录
   * 返回相对于baseDir的路径，格式参考 PromptAssemblyEngine 的实现
   */
  private async listProjectFiles(baseDirectory: string): Promise<Array<{ name: string; relativePath: string; isDirectory: boolean }>> {
    try {
      const entries = await fs.readdir(baseDirectory, { withFileTypes: true });
      const fileInfos: Array<{ name: string; relativePath: string; isDirectory: boolean }> = [];
      
      for (const entry of entries) {
        // 跳过隐藏文件和特殊目录
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        
        const fullPath = path.join(baseDirectory, entry.name);
        const relativePath = path.relative(baseDirectory, fullPath);
        
        fileInfos.push({
          name: entry.name,
          isDirectory: entry.isDirectory(),
          relativePath: './' + relativePath.replace(/\\/g, '/') // 统一使用正斜杠
        });
      }
      
      // 按名称排序，目录在前
      fileInfos.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      return fileInfos;
    } catch (error) {
      this.logger.warn(`🌍 [PromptManager] Unable to read directory: ${baseDirectory}, error: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 🚀 计算工作区中的项目数量（排除特定目录）
   */
  private async countWorkspaceProjects(workspaceRoot: string): Promise<number> {
    try {
      const excludeDirs = [
        /^\./,              // 所有隐藏目录 (.vscode, .git, .session-log等)
        'transformed_doc',  // 特定目录
        'node_modules',     // 常见构建目录
        'dist',
        'build',
        'coverage',
        'out'
      ];

      const workspaceUri = vscode.Uri.file(workspaceRoot);
      const entries = await vscode.workspace.fs.readDirectory(workspaceUri);
      
      let projectCount = 0;
      for (const [name, type] of entries) {
        // 只计算目录
        if (type === vscode.FileType.Directory) {
          // 检查是否应该排除
          const shouldExclude = excludeDirs.some(pattern => {
            if (pattern instanceof RegExp) {
              return pattern.test(name);
            }
            return name === pattern;
          });
          
          if (!shouldExclude) {
            projectCount++;
          }
        }
      }
      
      return projectCount;
    } catch (error) {
      this.logger.warn(`Failed to count workspace projects: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * 🚀 获取当前项目名称
   */
  private getCurrentProjectName(sessionContext: SessionContext): string {
    // sessionContext.projectName 可能的值：null 或 具体的项目名
    if (!sessionContext.projectName || sessionContext.projectName === null) {
      return 'No active project';
    }
    return sessionContext.projectName;
  }

  /**
   * 🚀 获取Base Directory
   */
  private getBaseDirectory(sessionContext: SessionContext, workspaceRoot: string): string {
    // 根据我们之前的修复，baseDir应该总是有值
    if (sessionContext.baseDir) {
      return sessionContext.baseDir;
    }
    
    // Fallback到工作区根目录
    return workspaceRoot;
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
    const extensionId = 'Testany.srs-writer-plugin';
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