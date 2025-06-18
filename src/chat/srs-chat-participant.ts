import * as vscode from 'vscode';
import { ChatMessage, ChatSession } from '../types';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { CHAT_PARTICIPANT_ID } from '../constants';
import { AICommunicator } from '../core/ai-communicator';
import { SRSParser } from '../parser/srs-parser';
import { FileManager } from '../filesystem/file-manager';

/**
 * SRS聊天参与者
 */
export class SRSChatParticipant {
    private logger = Logger.getInstance();
    private sessions: Map<string, ChatSession> = new Map();
    private aiCommunicator: AICommunicator;
    private srsParser: SRSParser;
    private fileManager: FileManager;
    
    constructor() {
        this.aiCommunicator = new AICommunicator();
        this.srsParser = new SRSParser();
        this.fileManager = new FileManager();
    }

    /**
     * 注册聊天参与者
     */
    public static register(context: vscode.ExtensionContext): SRSChatParticipant {
        const participant = new SRSChatParticipant();
        
        // 注册聊天参与者
        const disposable = vscode.chat.createChatParticipant(
            CHAT_PARTICIPANT_ID, 
            participant.handleChatRequest.bind(participant)
        );
        
        // 设置参与者属性
        disposable.iconPath = vscode.Uri.file('assets/icon.png');
        disposable.followupProvider = {
            provideFollowups: participant.provideFollowups.bind(participant)
        };
        
        context.subscriptions.push(disposable);
        
        return participant;
    }

    /**
     * 处理聊天请求
     */
    private async handleChatRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            const sessionId = this.getSessionId(context);
            const session = this.getOrCreateSession(sessionId);

            // 记录用户消息
            const userMessage: ChatMessage = {
                role: 'user',
                content: request.prompt,
                timestamp: new Date()
            };
            session.messages.push(userMessage);

            // 处理用户请求
            await this.processUserRequest(request, stream, session, token);

        } catch (error) {
            this.logger.error('Error handling chat request', error as Error);
            stream.markdown('❌ 处理请求时发生错误，请稍后重试。');
        }
    }

    /**
     * 处理用户请求
     */
    private async processUserRequest(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        session: ChatSession,
        token: vscode.CancellationToken
    ): Promise<void> {
        const prompt = request.prompt.toLowerCase();

        // 检查取消状态
        if (token.isCancellationRequested) {
            return;
        }

        // 显示正在处理的消息
        stream.progress('正在分析您的需求...');

        if (this.isHelpRequest(prompt)) {
            await this.handleHelpRequest(stream);
        } else if (this.isSRSGenerationRequest(prompt)) {
            await this.handleSRSGenerationRequest(request, stream, session, token);
        } else {
            await this.handleGeneralRequest(request, stream, session, token);
        }
    }

    /**
     * 处理SRS生成请求
     */
    private async handleSRSGenerationRequest(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        session: ChatSession,
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            // 显示开始生成的消息
            stream.progress('🚀 开始分析您的需求...');
            stream.markdown('## SRS文档生成\n\n');
            stream.markdown('正在为您生成专业的软件需求规格说明书...\n\n');
            
            // 第一阶段：AI生成母文档
            stream.progress('🤖 AI正在生成结构化母文档...');
            const motherDocument = await this.aiCommunicator.generateMotherDocument(request.prompt);
            
            if (token.isCancellationRequested) {
                stream.markdown('❌ 操作已取消');
                return;
            }
            
            stream.markdown('✅ 母文档生成完成\n\n');
            
            // 第二阶段：解析并生成文件
            stream.progress('⚙️ 正在解析并生成文档文件...');
            const parseResult = await this.srsParser.parse(motherDocument);
            
            if (token.isCancellationRequested) {
                stream.markdown('❌ 操作已取消');
                return;
            }
            
            // 第三阶段：写入文件系统
            stream.progress('💾 正在保存文件到工作区...');
            const projectName = this.extractProjectName(request.prompt);
            await this.fileManager.writeArtifacts(parseResult, projectName);
            
            // 显示成功结果
            stream.markdown('## 🎉 SRS文档生成完成！\n\n');
            stream.markdown(`✨ 已在工作区创建项目目录：\`${projectName}\`\n\n`);
            stream.markdown('生成的文件包括：\n');
            
            for (const fileName of Object.keys(parseResult)) {
                stream.markdown(`- 📄 \`${fileName}\`\n`);
            }
            
            stream.markdown('\n💡 您可以直接在VSCode中打开这些文件进行查看和编辑。');
            
            // 记录成功的助手回复
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: `SRS文档生成成功：${projectName}`,
                timestamp: new Date()
            };
            session.messages.push(assistantMessage);
            
        } catch (error) {
            this.logger.error('SRS generation failed', error as Error);
            stream.markdown('❌ **生成失败**\n\n');
            stream.markdown('抱歉，在生成SRS文档时遇到了问题。请检查：\n\n');
            stream.markdown('1. 确保已正确配置AI模型（如GitHub Copilot）\n');
            stream.markdown('2. 检查网络连接状态\n');
            stream.markdown('3. 尝试重新描述您的项目需求\n\n');
            stream.markdown('您可以查看输出面板获取详细错误信息。');
            
            ErrorHandler.handleError(error as Error, false);
        }
    }

    /**
     * 处理帮助请求
     */
    private async handleHelpRequest(stream: vscode.ChatResponseStream): Promise<void> {
        stream.markdown('# SRS Writer Plugin 帮助\n\n');
        stream.markdown('## 我能帮您做什么？\n\n');
        stream.markdown('- 📝 **编写SRS文档**：根据您的描述生成结构化的软件需求规格说明书\n');
        stream.markdown('- 🔍 **分析需求**：帮助您分析和整理项目需求\n');
        stream.markdown('- 📋 **生成模板**：提供标准的SRS文档模板\n');
        stream.markdown('- ✅ **验证文档**：检查SRS文档的完整性和规范性\n\n');
        stream.markdown('## 使用示例\n\n');
        stream.markdown('- "帮我写一个电商系统的SRS文档"\n');
        stream.markdown('- "分析这个项目的功能需求"\n');
        stream.markdown('- "生成一个标准的SRS模板"\n\n');
        stream.markdown('## 开始使用\n\n');
        stream.markdown('您可以直接描述您的项目，我会根据描述为您生成相应的SRS文档！');
    }

    /**
     * 处理一般请求
     */
    private async handleGeneralRequest(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        session: ChatSession,
        token: vscode.CancellationToken
    ): Promise<void> {
        stream.markdown('我是SRS Writer助手，专门帮助您编写软件需求规格说明书。\n\n');
        stream.markdown('请告诉我您的项目相关信息，我会为您生成相应的SRS文档。\n\n');
        stream.markdown('您也可以输入"帮助"了解更多功能。');

        // 记录助手回复
        const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: '一般性回复',
            timestamp: new Date()
        };
        session.messages.push(assistantMessage);
    }
    
    /**
     * 判断是否为帮助请求
     */
    private isHelpRequest(prompt: string): boolean {
        const helpKeywords = ['帮助', 'help', '如何使用', '使用方法', '指南'];
        return helpKeywords.some(keyword => prompt.includes(keyword));
    }
    
    /**
     * 判断是否为SRS生成请求
     */
    private isSRSGenerationRequest(prompt: string): boolean {
        const srsKeywords = ['srs', '需求', '规格说明', '文档', '系统', '项目', '应用', 'app'];
        return srsKeywords.some(keyword => prompt.includes(keyword)) || prompt.length > 10;
    }
    
    /**
     * 从用户输入中提取项目名称
     */
    private extractProjectName(prompt: string): string {
        // 简单的项目名称提取逻辑
        const match = prompt.match(/(?:做|开发|创建|建立).*?([\u4e00-\u9fa5a-zA-Z0-9]+(?:系统|平台|应用|工具|管理|app|system|platform))/i);
        if (match && match[1]) {
            return `srs-${match[1].toLowerCase().replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '-')}`;
        }
        
        // 默认名称
        return `srs-project-${Date.now()}`;
    }
    
    /**
     * 提供后续建议
     */
    private async provideFollowups(
        result: vscode.ChatResult,
        context: vscode.ChatContext,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatFollowup[]> {
        return [
            {
                prompt: '优化生成的需求文档',
                label: '🔧 优化文档'
            },
            {
                prompt: '添加更多功能需求',
                label: '➕ 添加需求'
            },
            {
                prompt: '生成API文档',
                label: '📚 API文档'
            },
            {
                prompt: '帮助',
                label: '❓ 帮助'
            }
        ];
    }

    /**
     * 获取会话ID
     */
    private getSessionId(context: vscode.ChatContext): string {
        // 使用上下文信息生成会话ID
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 获取或创建会话
     */
    private getOrCreateSession(sessionId: string): ChatSession {
        let session = this.sessions.get(sessionId);
        if (!session) {
            session = {
                id: sessionId,
                messages: [],
                createdAt: new Date()
            };
            this.sessions.set(sessionId, session);
        }
        return session;
    }

    /**
     * 清理过期会话
     */
    public cleanupExpiredSessions(): void {
        const now = new Date();
        const maxAge = 24 * 60 * 60 * 1000; // 24小时

        for (const [sessionId, session] of this.sessions) {
            if (now.getTime() - session.createdAt.getTime() > maxAge) {
                this.sessions.delete(sessionId);
            }
        }
    }
    
    /**
     * 获取插件状态
     */
    public getStatus(): string {
        return `Active sessions: ${this.sessions.size}`;
    }
} 