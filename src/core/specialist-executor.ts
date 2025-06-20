import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';

/**
 * v1.3 简化版专家执行器 - 基于官方工具
 * 替代复杂的RuleRunner，直接使用@vscode/chat-extension-utils
 * 
 * 🏗️ 架构说明：
 * 主要路径：外部.md文件 → 模板替换 → VSCode API
 * 降级路径：硬编码提示词方法（仅在文件加载失败时使用）
 * 
 * ⚠️ 重要：此文件包含降级备用代码，请勿轻易删除相关方法和注释
 */
export class SpecialistExecutor {
    private logger = Logger.getInstance();
    
    constructor() {
        this.logger.info('SpecialistExecutor initialized with official VSCode APIs');
    }

    /**
     * 执行专家规则
     * @param ruleId 规则ID（如 '100_create_srs'）
     * @param context 上下文数据
     * @param model 用户选择的模型
     */
    public async executeSpecialist(
        ruleId: string,
        context: any,
        model: vscode.LanguageModelChat
    ): Promise<string> {
        this.logger.info(`Executing specialist: ${ruleId} with model: ${model.name}`);

        try {
            // 从对应的专家文件加载提示词
            const prompt = await this.loadSpecialistPrompt(ruleId, context);
            
            const messages = [
                vscode.LanguageModelChatMessage.User(prompt)
            ];

            const requestOptions: vscode.LanguageModelChatRequestOptions = {
                justification: `Execute SRS specialist rule: ${ruleId}`
            };

            const response = await model.sendRequest(messages, requestOptions);
            
            let result = '';
            for await (const fragment of response.text) {
                result += fragment;
            }

            if (!result.trim()) {
                throw new Error(`Specialist ${ruleId} returned empty response`);
            }

            this.logger.info(`Specialist ${ruleId} executed successfully, response length: ${result.length}`);
            return result;

        } catch (error) {
            this.logger.error(`Failed to execute specialist ${ruleId}`, error as Error);
            throw error;
        }
    }

    /**
     * 从rules/specialists/目录加载专家提示词
     */
    private async loadSpecialistPrompt(ruleId: string, context: any): Promise<string> {
        try {
            // 根据ruleId确定文件名
            const fileName = this.getSpecialistFileName(ruleId);
            
            // 查找专家文件路径
            const possiblePaths = [
                path.join(__dirname, `../../rules/specialists/${fileName}`),  // 开发环境
                path.join(__dirname, `../rules/specialists/${fileName}`),     // 打包环境备选1
                path.join(__dirname, `rules/specialists/${fileName}`),        // 打包环境备选2
                path.join(process.cwd(), `rules/specialists/${fileName}`),     // 工作目录
            ];
            
            // 如果是VSCode扩展环境，使用扩展上下文路径
            try {
                const extension = vscode.extensions.getExtension('testany-co.srs-writer-plugin');
                if (extension) {
                    possiblePaths.unshift(path.join(extension.extensionPath, `rules/specialists/${fileName}`));
                }
            } catch (error) {
                this.logger.warn('Failed to get extension path, using fallback paths');
            }
            
            // 查找第一个存在的路径
            const specialistPath = possiblePaths.find(filePath => fs.existsSync(filePath));
            
            if (!specialistPath) {
                this.logger.warn(`Specialist prompt file not found: ${fileName}. Tried paths: ${possiblePaths.join(', ')}`);
                return this.buildPromptForSpecialist(ruleId, context); // 降级到硬编码版本
            }
            
            // 读取文件内容
            let promptTemplate = fs.readFileSync(specialistPath, 'utf8');
            
            // 替换模板变量
            promptTemplate = this.replaceTemplateVariables(promptTemplate, context);
            
            this.logger.info(`Loaded specialist prompt from: ${specialistPath}`);
            return promptTemplate;
            
        } catch (error) {
            this.logger.error(`Failed to load specialist prompt file for ${ruleId}`, error as Error);
            // 降级到硬编码版本
            return this.buildPromptForSpecialist(ruleId, context);
        }
    }

    /**
     * 根据ruleId获取对应的文件名
     */
    private getSpecialistFileName(ruleId: string): string {
        const fileMapping: { [key: string]: string } = {
            '100_create_srs': '100_create_srs.md',
            '200_edit_srs': '200_edit_srs.md',
            '300_prototype': '300_prototype.md',
            '400_lint_check': '400_lint_check.md',
            '500_git_operations': '500_git_operations.md',
            'help_response': 'help_response.md'
        };
        
        return fileMapping[ruleId] || `${ruleId}.md`;
    }

    /**
     * 替换提示词模板中的变量
     */
    private replaceTemplateVariables(promptTemplate: string, context: any): string {
        const userInput = context.userInput || '';
        const projectName = context.sessionData?.projectName || null;
        const hasActiveProject = !!projectName;
        
        // 基本变量替换
        let result = promptTemplate;
        result = result.replace(/\{\{USER_INPUT\}\}/g, userInput);
        result = result.replace(/\{\{PROJECT_NAME\}\}/g, projectName || 'Unknown');
        result = result.replace(/\{\{HAS_ACTIVE_PROJECT\}\}/g, hasActiveProject.toString());
        result = result.replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString());
        result = result.replace(/\{\{DATE\}\}/g, new Date().toISOString().split('T')[0]);
        result = result.replace(/\{\{INTENT\}\}/g, context.intent || '');
        
        // 上下文数据替换
        if (context.sessionData) {
            result = result.replace(/\{\{LAST_INTENT\}\}/g, context.sessionData.lastIntent || 'null');
            result = result.replace(/\{\{ACTIVE_FILES\}\}/g, JSON.stringify(context.sessionData.activeFiles || []));
        }
        
        return result;
    }

    /**
     * 为不同的专家构建相应的提示词（降级备用版本）
     * 
     * ⚠️ 重要：此方法仅作为降级备用，当外部.md文件加载失败时使用
     * 🚫 请勿删除此注释和方法 - 这是系统稳定性的重要保障
     * 📋 主要路径应使用 rules/specialists/*.md 文件
     * 🔄 未来版本可能会移除此降级机制
     */
    private buildPromptForSpecialist(ruleId: string, context: any): string {
        const userInput = context.userInput || '';
        const projectName = context.sessionData?.projectName || null;

        switch (ruleId) {
            case '100_create_srs':
                return this.buildCreateSRSPrompt(userInput, context);
            
            case '200_edit_srs':
                return this.buildEditSRSPrompt(userInput, context, projectName);
            
            case 'help_response':
                return this.buildHelpPrompt(userInput);
            
            default:
                return this.buildGenericPrompt(ruleId, userInput, context);
        }
    }

    /**
     * 构建创建SRS的提示词（降级备用版本）
     * 
     * ⚠️ 重要：此方法仅作为降级备用，当 rules/specialists/100_create_srs.md 加载失败时使用
     * 🚫 请勿删除此注释和方法 - 这是系统稳定性的重要保障
     * 📋 主要路径应使用 rules/specialists/100_create_srs.md 文件
     * 🔄 未来版本可能会移除此降级机制
     */
    private buildCreateSRSPrompt(userInput: string, context: any): string {
        return `# Role
You are a professional SRS (Software Requirements Specification) writer with expertise in creating comprehensive technical documentation.

# Task
Create a complete, structured SRS document based on the user's requirements.

# User Request
"${userInput}"

# Output Requirements
Generate a complete SRS document in markdown format that includes:

1. **Document Header**
   - Title with project name extracted from user input
   - Version: 1.0
   - Date: ${new Date().toISOString().split('T')[0]}

2. **Required Sections**
   - ## 1. 引言 (Introduction)
   - ## 2. 整体说明 (Overall Description) 
   - ## 3. 功能需求 (Functional Requirements)
   - ## 4. 非功能性需求 (Non-Functional Requirements)
   - ## 5. 验收标准 (Acceptance Criteria)

3. **Functional Requirements Table**
   Include a table with columns: FR-ID | 需求名称 | 优先级 | 详细描述 | 验收标准
   Use ID format: FR-MODULE-001, FR-MODULE-002, etc.

4. **Non-Functional Requirements Table**
   Include a table with columns: NFR-ID | 需求名称 | 优先级 | 详细描述 | 衡量标准
   Use ID format: NFR-PERF-001, NFR-SEC-001, etc.

5. **Project Classification**
   At the end, add a section with:
   \`\`\`
   ### --- AI CLASSIFICATION ---
   Project Type: [Web App/Mobile App/Desktop App/Platform]
   Complexity: [Simple/Medium/Complex]
   \`\`\`

# Quality Standards
- Use clear, professional language
- Ensure all requirements follow SMART principles (Specific, Measurable, Achievable, Relevant, Time-bound)
- Include realistic acceptance criteria
- Maintain consistency in terminology

Generate the complete SRS document now:`;
    }

    /**
     * 构建编辑SRS的提示词（降级备用版本）
     * 
     * ⚠️ 重要：此方法仅作为降级备用，当 rules/specialists/200_edit_srs.md 加载失败时使用
     * 🚫 请勿删除此注释和方法 - 这是系统稳定性的重要保障
     * 📋 主要路径应使用 rules/specialists/200_edit_srs.md 文件
     * 🔄 未来版本可能会移除此降级机制
     */
    private buildEditSRSPrompt(userInput: string, context: any, projectName: string | null): string {
        return `# Role
You are a professional SRS editor specializing in modifying existing Software Requirements Specification documents.

# Context
- Current project: ${projectName || 'Unknown'}
- Edit request: "${userInput}"

# Task
Modify the existing SRS document based on the user's edit request. Focus on:

1. **Understanding the Request**: Analyze what specific changes are needed
2. **Maintaining Consistency**: Ensure changes align with existing document structure
3. **Quality Assurance**: Verify all modifications follow SMART principles

# Edit Guidelines
- Preserve existing document structure and formatting
- Update version numbers and dates appropriately
- Maintain requirement ID consistency
- Add detailed acceptance criteria for new requirements
- Update related sections when making changes

# Output Format
Provide the specific changes or additions requested, maintaining the original SRS markdown format.

Process this edit request now:`;
    }

    /**
     * 构建帮助提示词（降级备用版本）
     * 
     * ⚠️ 重要：此方法仅作为降级备用，当 rules/specialists/help_response.md 加载失败时使用
     * 🚫 请勿删除此注释和方法 - 这是系统稳定性的重要保障
     * 📋 主要路径应使用 rules/specialists/help_response.md 文件
     * 🔄 未来版本可能会移除此降级机制
     */
    private buildHelpPrompt(userInput: string): string {
        return `# SRS Writer Assistant Help

You are helping a user with the SRS Writer VSCode extension. Here are the available commands and features:

## Available Commands
- **/create** - Create a new SRS document from requirements description
- **/edit** - Edit existing SRS document (requires active project)
- **/lint** - Check document quality and compliance
- **/help** - Show this help information

## How to Use
1. **Creating a new SRS**: Use "/create" followed by your project description
   Example: "/create I want to build a library management system"

2. **Editing existing SRS**: Use "/edit" with specific changes
   Example: "/edit add user authentication feature"

3. **Quality checking**: Use "/lint" to validate your SRS document

## User Query
"${userInput}"

Provide specific help based on their question above.`;
    }

    /**
     * 构建通用提示词（降级备用版本）
     * 
     * ⚠️ 重要：此方法仅作为降级备用，当对应的 rules/specialists/*.md 文件加载失败时使用
     * 🚫 请勿删除此注释和方法 - 这是系统稳定性的重要保障
     * 📋 主要路径应使用 rules/specialists/ 目录下的对应.md文件
     * 🔄 未来版本可能会移除此降级机制
     */
    private buildGenericPrompt(ruleId: string, userInput: string, context: any): string {
        return `# SRS Writing Assistant

You are a helpful assistant for Software Requirements Specification writing.

Rule ID: ${ruleId}
User Input: "${userInput}"
Context: ${JSON.stringify(context, null, 2)}

Please provide appropriate assistance based on the user's request.`;
    }

    /**
     * 检查是否可以处理特定专家
     */
    public canHandle(specialistId: string): boolean {
        const supportedSpecialists = [
            '100_create_srs', 
            '200_edit_srs', 
            '300_prototype', 
            '400_lint_check', 
            '500_git_operations', 
            'help_response'
        ];
        return supportedSpecialists.includes(specialistId);
    }

    /**
     * 获取支持的专家列表
     */
    public getSupportedSpecialists(): string[] {
        return [
            '100_create_srs', 
            '200_edit_srs', 
            '300_prototype', 
            '400_lint_check', 
            '500_git_operations', 
            'help_response'
        ];
    }

    /**
     * 重新加载专家规则（简化版本中为空实现）
     */
    public async reloadSpecialists(): Promise<void> {
        this.logger.info('Specialists reloaded (simplified version - no external rules)');
    }
}
