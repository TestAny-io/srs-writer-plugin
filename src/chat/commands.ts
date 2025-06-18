import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { COMMANDS } from '../constants';

/**
 * 聊天命令处理器
 */
export class ChatCommands {
    private logger = Logger.getInstance();

    /**
     * 注册所有聊天相关命令
     */
    public static register(context: vscode.ExtensionContext): ChatCommands {
        const commands = new ChatCommands();

        // 注册启动聊天命令
        const startChatDisposable = vscode.commands.registerCommand(
            COMMANDS.START_CHAT,
            commands.startChat.bind(commands)
        );

        // 注册生成SRS命令
        const generateSRSDisposable = vscode.commands.registerCommand(
            COMMANDS.GENERATE_SRS,
            commands.generateSRS.bind(commands)
        );

        context.subscriptions.push(startChatDisposable, generateSRSDisposable);
        return commands;
    }

    /**
     * 启动SRS聊天
     */
    public async startChat(): Promise<void> {
        try {
            this.logger.info('Starting SRS chat');

            // 打开聊天面板
            await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
            
            // 显示欢迎消息
            vscode.window.showInformationMessage(
                '🤖 SRS Writer 聊天助手已启动！您可以在聊天面板中与我对话。',
                '了解更多'
            ).then(action => {
                if (action === '了解更多') {
                    this.showChatHelp();
                }
            });

        } catch (error) {
            await ErrorHandler.handleError(error as Error);
        }
    }

    /**
     * 生成SRS文档
     */
    public async generateSRS(): Promise<void> {
        try {
            this.logger.info('Generating SRS document');

            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                vscode.window.showWarningMessage('请先打开一个文件');
                return;
            }

            // 检查文件类型
            if (!activeEditor.document.fileName.endsWith('.md')) {
                vscode.window.showWarningMessage('请在Markdown文件中使用此功能');
                return;
            }

            // 获取当前文档内容
            const document = activeEditor.document;
            const content = document.getText();

            if (!content.trim()) {
                vscode.window.showWarningMessage('文档内容为空，请先添加一些内容描述您的项目');
                return;
            }

            // 显示进度
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "正在生成SRS文档...",
                cancellable: true
            }, async (progress, token) => {
                progress.report({ increment: 0, message: "分析文档内容..." });

                // TODO: 这里将来会调用AI服务来生成SRS文档
                // 现在先显示一个示例
                await this.generateSRSFromContent(content, progress, token);
            });

        } catch (error) {
            await ErrorHandler.handleError(error as Error);
        }
    }

    /**
     * 从内容生成SRS文档
     */
    private async generateSRSFromContent(
        content: string,
        progress: vscode.Progress<{message?: string; increment?: number}>,
        token: vscode.CancellationToken
    ): Promise<void> {
        return new Promise(async resolve => {
            // 模拟生成过程
            const steps = [
                "解析项目需求...",
                "生成文档结构...",
                "填充功能需求...",
                "添加非功能需求...",
                "完成文档生成..."
            ];

            for (let i = 0; i < steps.length; i++) {
                if (token.isCancellationRequested) {
                    return;
                }

                progress.report({ 
                    increment: 20, 
                    message: steps[i] 
                });

                // 模拟处理时间
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 创建新的SRS文档
            await this.createSRSDocument(content);
            resolve();
        });
    }

    /**
     * 创建SRS文档
     */
    private async createSRSDocument(originalContent: string): Promise<void> {
        const srsTemplate = this.generateSRSTemplate(originalContent);
        
        // 创建新文档
        const doc = await vscode.workspace.openTextDocument({
            content: srsTemplate,
            language: 'yaml'
        });

        // 在新编辑器中显示
        await vscode.window.showTextDocument(doc);
        
        vscode.window.showInformationMessage(
            '✅ SRS文档已生成！您可以根据需要进一步编辑。'
        );
    }

    /**
     * 生成SRS模板
     */
    private generateSRSTemplate(originalContent: string): string {
        return `# 软件需求规格说明书 (SRS)

## 文档信息
version: "1.0"
created_at: "${new Date().toISOString()}"
author: "SRS Writer Plugin"

## 项目信息
project:
  name: "项目名称"
  description: "项目描述"
  version: "1.0.0"
  stakeholders:
    - "产品经理"
    - "开发团队"
    - "测试团队"
  scope: "项目范围和边界"

## 1. 引言
introduction:
  purpose: "本文档的目的"
  scope: "项目范围"
  definitions: "术语定义"
  references: "参考文档"

## 2. 总体描述
general_description:
  product_perspective: "产品概述"
  product_functions: "产品功能"
  user_characteristics: "用户特征"
  constraints: "约束条件"
  assumptions: "假设和依赖"

## 3. 功能需求
functional_requirements:
  - id: "FR-001"
    title: "功能需求1"
    description: "详细描述"
    priority: "high"
    acceptance_criteria:
      - "验收标准1"
      - "验收标准2"

## 4. 非功能需求
non_functional_requirements:
  performance:
    - "性能要求"
  security:
    - "安全要求"
  usability:
    - "可用性要求"
  reliability:
    - "可靠性要求"

## 5. 系统特性
system_features:
  - feature_id: "SF-001"
    description: "系统特性描述"
    functional_requirements:
      - "相关功能需求"

## 6. 外部接口需求
external_interfaces:
  user_interfaces:
    - "用户界面要求"
  hardware_interfaces:
    - "硬件接口要求"
  software_interfaces:
    - "软件接口要求"
  communication_interfaces:
    - "通信接口要求"

## 7. 其他需求
other_requirements:
  legal: "法律要求"
  standards: "标准要求"

# 原始内容参考
# ${originalContent.split('\n').map(line => `# ${line}`).join('\n')}
`;
    }

    /**
     * 显示聊天帮助信息
     */
    private showChatHelp(): void {
        const helpContent = `
# SRS Writer 聊天助手使用指南

## 功能介绍
SRS Writer 聊天助手可以帮助您：
- 编写软件需求规格说明书
- 分析和整理项目需求
- 生成标准的SRS文档模板
- 验证文档的完整性

## 使用方法
1. 在聊天面板中直接描述您的项目
2. 告诉我项目的功能和需求
3. 我会为您生成相应的SRS文档

## 示例对话
- "帮我写一个在线购物系统的SRS文档"
- "这个项目需要用户注册登录功能"
- "添加订单管理和支付功能"

开始与我对话吧！
        `;

        vscode.workspace.openTextDocument({
            content: helpContent,
            language: 'markdown'
        }).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    }
} 