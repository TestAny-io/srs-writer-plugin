import * as vscode from 'vscode';
import { ChatMessage, ChatSession } from '../types';
import { SessionContext } from '../types/session';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { CHAT_PARTICIPANT_ID } from '../constants';
import { Orchestrator } from '../core/orchestrator';
import { SessionManager } from '../core/session-manager';
import { SRSParser } from '../parser/srs-parser';
import { FileManager } from '../filesystem/file-manager';
import { CreateSrsStrategy } from '../strategies/create-srs-strategy';
import { EditSrsStrategy } from '../strategies/edit-srs-strategy';
import { LintChecker, SRSDocument, LintReport } from '../quality/lint-checker';

/**
 * SRS聊天参与者 v1.2 - 混合智能架构版本
 */
export class SRSChatParticipant {
    private logger = Logger.getInstance();
    private sessions: Map<string, ChatSession> = new Map();
    
    // v1.2 核心组件
    private orchestrator: Orchestrator;
    private sessionManager: SessionManager;
    private srsParser: SRSParser;
    private fileManager: FileManager;
    
    // v1.2 策略层
    private createStrategy: CreateSrsStrategy;
    private editStrategy: EditSrsStrategy;
    
    // v1.3 质量检查
    private lintChecker: LintChecker;
    
    constructor() {
        // 初始化混合智能架构组件
        this.orchestrator = new Orchestrator();
        this.sessionManager = new SessionManager();
        this.srsParser = new SRSParser();
        this.fileManager = new FileManager();
        
        // 初始化策略层
        this.createStrategy = new CreateSrsStrategy();
        this.editStrategy = new EditSrsStrategy();
        
        // 初始化质量检查器
        this.lintChecker = new LintChecker();
        
        // 自动初始化会话管理
        this.sessionManager.autoInitialize().catch(error => {
            this.logger.error('Failed to auto-initialize session manager', error);
        });
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
     * 处理聊天请求 - v1.3最终版本（采用用户选择模型）
     */
    private async handleChatRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            // 获取或创建会话状态
            const sessionContext = await this.getOrCreateSessionContext();
            
            // 记录用户消息到传统会话
            const sessionId = this.getSessionId(context);
            const chatSession = this.getOrCreateChatSession(sessionId);
            const userMessage: ChatMessage = {
                role: 'user',
                content: request.prompt,
                timestamp: new Date()
            };
            chatSession.messages.push(userMessage);

            // 处理Slash命令
            if (request.prompt.startsWith('/')) {
                await this.handleSlashCommand(request, stream, sessionContext, token);
                return;
            }

            // 🔑 v1.3最终正确方案：直接使用request中的用户选择模型
            const selectedModel = request.model;
            
            if (!selectedModel) {
                stream.markdown('⚠️ **未找到AI模型**\n\n');
                stream.markdown('请确保您已在Chat界面的下拉菜单中选择了AI模型。\n\n');
                return;
            }
            
            this.logger.info(`Using user-selected model from request: ${selectedModel.name}`);
            stream.markdown(`🤖 **使用模型**: ${selectedModel.name}\n\n`);

            // 使用选择的模型处理请求
            await this.processWithSelectedModel(request, stream, sessionContext, chatSession, selectedModel, token);

        } catch (error) {
            this.logger.error('Error handling chat request', error as Error);
            stream.markdown('❌ 处理请求时发生错误，请稍后重试。\n\n');
            stream.markdown('💡 您可以尝试：\n');
            stream.markdown('- 重新描述您的需求\n');
            stream.markdown('- 使用 `/help` 获取帮助\n');
            stream.markdown('- 确保选择了可用的AI模型\n');
        }
    }

    /**
     * 使用用户选择的模型处理请求 - v1.3版本
     */
    private async processWithSelectedModel(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        sessionContext: SessionContext,
        chatSession: ChatSession,
        selectedModel: vscode.LanguageModelChat,
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            // 显示智能分析状态
            stream.progress('🧠 AI正在理解您的意图...');
            stream.markdown('## 🤖 SRS Writer v1.2 - 智能助手\n\n');
            
            // Phase 1: AI驱动的意图识别和路由（使用用户选择的模型）
            const orchestratorResult = await this.orchestrator.processUserInput(
                request.prompt, 
                sessionContext,
                selectedModel
            );
            
            if (token.isCancellationRequested) {
                stream.markdown('❌ 操作已取消');
                return;
            }

            const { intent, result } = orchestratorResult;
            
            // 显示AI的理解结果
            stream.markdown(`💭 **AI理解**: ${this.getIntentDescription(intent)}\n\n`);
            
            // Phase 2: 根据意图执行相应的处理
            switch (intent) {
                case 'create':
                    await this.handleCreateIntent(request, stream, sessionContext, result, token);
                    break;
                    
                case 'edit':
                    await this.handleEditIntent(request, stream, sessionContext, result, token);
                    break;
                    
                case 'help':
                    await this.handleHelpIntent(stream, result);
                    break;
                    
                case 'git':
                    await this.handleGitIntent(stream, sessionContext, result);
                    break;
                    
                default:
                    // 降级处理
                    await this.handleFallbackIntent(request, stream, sessionContext, token);
            }
            
            // 🔧 v1.2修复：延迟更新lastIntent，避免与后续的项目信息更新冲突
            // 这个更新将在processMotherDocument中合并执行
            
            // 记录助手回复
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: `Processed ${intent} intent successfully`,
                timestamp: new Date()
            };
            chatSession.messages.push(assistantMessage);

        } catch (error) {
            this.logger.error('Hybrid architecture processing failed', error as Error);
            stream.markdown('❌ **智能处理失败**\n\n');
            stream.markdown('正在使用备用方案处理您的请求...\n\n');
            
            // 降级到简单处理
            await this.handleFallbackIntent(request, stream, sessionContext, token);
        }
    }

    /**
     * 处理创建意图
     */
    private async handleCreateIntent(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        sessionContext: SessionContext,
        aiResult: any,
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            stream.progress('🚀 创建新的SRS项目...');
            
            // 如果AI已经生成了母文档，直接使用
            if (aiResult && typeof aiResult === 'string' && aiResult.length > 1000) {
                await this.processMotherDocument(aiResult, stream, sessionContext, token);
            } else {
                // 否则，使用传统的生成方式
                stream.progress('📝 AI正在生成项目结构...');
                await this.handleTraditionalSRSGeneration(request, stream, sessionContext, token);
            }
            
        } catch (error) {
            this.logger.error('Create intent handling failed', error as Error);
            throw error;
        }
    }

    /**
     * 处理编辑意图
     */
    private async handleEditIntent(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        sessionContext: SessionContext,
        aiResult: any,
        token: vscode.CancellationToken
    ): Promise<void> {
        if (!sessionContext.projectName) {
            stream.markdown('⚠️ **无活跃项目**\n\n');
            stream.markdown('请先创建一个项目，然后再进行编辑操作。\n\n');
            stream.markdown('💡 您可以说："创建一个[项目类型]系统"');
            return;
        }

        try {
            stream.progress(`✏️ 编辑项目: ${sessionContext.projectName}...`);
            stream.markdown(`### 📝 编辑项目: \`${sessionContext.projectName}\`\n\n`);
            
            // 如果AI已经生成了更新的母文档，处理它
            if (aiResult && typeof aiResult === 'string' && aiResult.length > 1000) {
                await this.processMotherDocument(aiResult, stream, sessionContext, token, true);
            } else {
                // 否则，使用策略层准备编辑上下文
                const strategyOutput = await this.editStrategy.execute(request.prompt, sessionContext);
                stream.markdown('🔄 正在应用您的修改...\n\n');
                
                // 这里可以进一步处理编辑逻辑
                stream.markdown('✅ 编辑操作已记录，正在更新文档...\n\n');
                stream.markdown('💡 编辑功能正在完善中，即将在后续版本中提供完整支持。');
                
                // 🔧 v1.2修复：确保编辑意图被记录
                await this.sessionManager.updateSession({
                    lastIntent: 'edit'
                });
            }
            
        } catch (error) {
            this.logger.error('Edit intent handling failed', error as Error);
            stream.markdown('❌ 编辑操作失败，请重试。');
        }
    }

    /**
     * 处理帮助意图
     */
    private async handleHelpIntent(stream: vscode.ChatResponseStream, aiResult?: any): Promise<void> {
        if (aiResult && typeof aiResult === 'string') {
            // 使用AI生成的帮助内容
            stream.markdown(aiResult);
        } else {
            // 使用默认帮助内容
            stream.markdown('# 🤖 SRS Writer v1.2 - 智能助手帮助\n\n');
            stream.markdown('## 我可以理解自然语言！\n\n');
            stream.markdown('### 🚀 创建新项目\n');
            stream.markdown('- "我想做一个图书管理系统"\n');
            stream.markdown('- "创建一个电商平台的SRS文档"\n');
            stream.markdown('- "开发一个任务管理APP"\n\n');
            stream.markdown('### ✏️ 编辑现有项目\n');
            stream.markdown('- "给当前项目添加用户认证功能"\n');
            stream.markdown('- "修改订单管理的需求"\n');
            stream.markdown('- "删除某个功能模块"\n\n');
            stream.markdown('### 🔧 可用命令\n');
            stream.markdown('- `/edit` - 精确编辑当前项目\n');
            stream.markdown('- `/help` - 显示此帮助\n');
            stream.markdown('- `/status` - 查看当前状态\n\n');
            stream.markdown('### 💡 智能特性\n');
            stream.markdown('- 自然语言理解\n');
            stream.markdown('- 上下文感知\n');
            stream.markdown('- 会话状态管理\n');
            stream.markdown('- 优雅错误处理\n\n');
            stream.markdown('我是您的智能助手，随时准备帮助您创建专业的SRS文档！');
        }
        
        // 🔧 v1.2修复：确保帮助意图被记录
        await this.sessionManager.updateSession({
            lastIntent: 'help'
        });
    }

    /**
     * 处理Git意图
     */
    private async handleGitIntent(
        stream: vscode.ChatResponseStream, 
        sessionContext: SessionContext, 
        aiResult?: any
    ): Promise<void> {
        stream.markdown('### 🔧 Git操作\n\n');
        stream.markdown('Git集成功能正在开发中，即将在后续版本中提供。\n\n');
        stream.markdown('目前您可以手动使用Git命令管理生成的SRS文档。');
        
        // 🔧 v1.2修复：确保Git意图被记录
        await this.sessionManager.updateSession({
            lastIntent: 'git'
        });
    }

    /**
     * 处理降级意图
     */
    private async handleFallbackIntent(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        sessionContext: SessionContext,
        token: vscode.CancellationToken
    ): Promise<void> {
        stream.markdown('🤔 让我为您创建SRS文档...\n\n');
        await this.handleTraditionalSRSGeneration(request, stream, sessionContext, token);
    }

    /**
     * 处理Slash命令
     */
    private async handleSlashCommand(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        sessionContext: SessionContext,
        token: vscode.CancellationToken
    ): Promise<void> {
        const command = request.prompt.toLowerCase();
        
        switch (command) {
            case '/help':
                await this.handleHelpIntent(stream);
                break;
                
            case '/status':
                this.handleStatusCommand(stream, sessionContext);
                break;
                
            case '/edit':
                await this.handleEditCommand(stream, sessionContext);
                break;
                
            case '/lint':
                await this.handleLintCommand(stream, sessionContext, token);
                break;
                
            case '/create':
                stream.markdown('💡 请直接描述您想要创建的项目，例如：\n\n');
                stream.markdown('"我想做一个图书管理系统"\n');
                stream.markdown('"创建一个电商平台的需求文档"\n');
                break;
                
            default:
                stream.markdown(`❓ 未知命令: \`${request.prompt}\`\n\n`);
                stream.markdown('可用命令:\n');
                stream.markdown('- `/help` - 显示帮助\n');
                stream.markdown('- `/status` - 查看状态\n');
                stream.markdown('- `/edit` - 编辑当前项目\n');
                stream.markdown('- `/lint` - 质量检查\n');
                stream.markdown('- `/create` - 创建项目提示\n');
        }
    }

    /**
     * 处理状态命令
     */
    private handleStatusCommand(stream: vscode.ChatResponseStream, sessionContext: SessionContext): void {
        stream.markdown('### 📊 SRS Writer 状态\n\n');
        
        if (sessionContext.projectName) {
            stream.markdown(`**当前项目**: \`${sessionContext.projectName}\`\n`);
            stream.markdown(`**项目目录**: \`${sessionContext.baseDir}\`\n`);
            stream.markdown(`**活跃文件**: ${sessionContext.activeFiles.length}个\n`);
            stream.markdown(`**最后操作**: ${sessionContext.lastIntent || '无'}\n`);
        } else {
            stream.markdown('**当前项目**: 无\n');
            stream.markdown('💡 您可以说"创建一个xxx系统"来开始新项目\n');
        }
        
        stream.markdown(`**会话创建**: ${sessionContext.metadata.created}\n`);
        stream.markdown(`**最后更新**: ${sessionContext.metadata.lastModified}\n`);
        stream.markdown(`**版本**: ${sessionContext.metadata.version}\n\n`);
        
        // 显示AI状态
        const orchestratorStatus = this.orchestrator.getStatus();
        stream.markdown(`**AI模式**: ${orchestratorStatus.aiMode ? '✅ 启用' : '❌ 禁用'}\n`);
        stream.markdown(`**规则引擎**: ${orchestratorStatus.specialistsAvailable ? '✅ 就绪' : '❌ 未就绪'}\n`);
    }

    /**
     * 处理编辑命令
     */
    private async handleEditCommand(stream: vscode.ChatResponseStream, sessionContext: SessionContext): Promise<void> {
        if (!sessionContext.projectName) {
            stream.markdown('⚠️ **无活跃项目**\n\n');
            stream.markdown('请先创建一个项目才能使用编辑功能。\n\n');
            return;
        }
        
        stream.markdown(`### ✏️ 编辑模式 - ${sessionContext.projectName}\n\n`);
        stream.markdown('请描述您想要进行的修改:\n\n');
        stream.markdown('**示例**:\n');
        stream.markdown('- "添加用户认证功能"\n');
        stream.markdown('- "修改数据库设计"\n');
        stream.markdown('- "删除某个需求"\n');
        stream.markdown('- "优化性能要求"\n\n');
        stream.markdown('💡 直接告诉我您的修改需求即可！');
    }

    /**
     * 传统的SRS生成处理
     */
    private async handleTraditionalSRSGeneration(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        sessionContext: SessionContext,
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            // 使用创建策略准备上下文
            const strategyOutput = await this.createStrategy.execute(request.prompt, sessionContext);
            
            // 生成母文档（这里需要调用RuleRunner执行create规则）
            stream.progress('🤖 AI正在生成结构化母文档...');
            
            // 暂时使用简化版本，后续会完善
            const motherDocument = await this.generateSimpleMotherDocument(request.prompt, strategyOutput);
            
            if (token.isCancellationRequested) {
                stream.markdown('❌ 操作已取消');
                return;
            }
            
            await this.processMotherDocument(motherDocument, stream, sessionContext, token);
            
        } catch (error) {
            this.logger.error('Traditional SRS generation failed', error as Error);
            stream.markdown('❌ 生成失败，请检查AI模型配置后重试。');
        }
    }

    /**
     * 处理母文档
     */
    private async processMotherDocument(
        motherDocument: string,
        stream: vscode.ChatResponseStream,
        sessionContext: SessionContext,
        token: vscode.CancellationToken,
        isEdit: boolean = false
    ): Promise<void> {
        try {
            stream.markdown('✅ 母文档生成完成\n\n');
            
            // 解析并生成文件
            stream.progress('⚙️ 正在解析并生成文档文件...');
            const parseResult = await this.srsParser.parse(motherDocument);
            
            if (token.isCancellationRequested) {
                stream.markdown('❌ 操作已取消');
                return;
            }
            
            // 提取项目名称
            const projectName = this.extractProjectNameFromDocument(motherDocument) || 
                              this.extractProjectNameFromInput(sessionContext.projectName || '新项目');
            
            // 写入文件系统
            stream.progress('💾 正在保存文件到工作区...');
            await this.fileManager.writeArtifacts(parseResult, projectName);
            
            // 🔧 v1.2修复：原子更新会话状态，包含lastIntent
            await this.sessionManager.updateSession({
                projectName: projectName,
                baseDir: projectName,
                activeFiles: Object.keys(parseResult),
                lastIntent: isEdit ? 'edit' : 'create'
            });
            
            // 显示成功结果
            stream.markdown(`## 🎉 SRS文档${isEdit ? '更新' : '生成'}完成！\n\n`);
            stream.markdown(`✨ 项目: \`${projectName}\`\n\n`);
            stream.markdown('生成的文件包括：\n');
            
            for (const fileName of Object.keys(parseResult)) {
                stream.markdown(`- 📄 \`${fileName}\`\n`);
            }
            
            stream.markdown('\n💡 您可以直接在VSCode中打开这些文件进行查看和编辑。\n\n');
            stream.markdown('🚀 现在您可以说"给项目添加xxx功能"来继续编辑！');
            
        } catch (error) {
            this.logger.error('Mother document processing failed', error as Error);
            stream.markdown('❌ 文档处理失败，请重试。');
        }
    }

    /**
     * 生成简单的母文档（临时实现）
     */
    private async generateSimpleMotherDocument(userInput: string, strategyOutput: any): Promise<string> {
        // 这是一个临时实现，实际应该调用RuleRunner执行100_create_srs.mdc
        const projectName = strategyOutput.specialistContext.suggestedProjectName || 'srs-project';
        
        return `# AI-Generated Project Analysis & SRS for "${projectName}"

### --- AI CLASSIFICATION DECISION ---
**Project Type**: Web App
**Complexity**: Medium (12/24)
**Is MVP**: Yes
**Reasoning**: Based on user input "${userInput}", this appears to be a medium complexity web application.

### --- SOFTWARE REQUIREMENTS SPECIFICATION ---

# ${projectName} - Software Requirements Specification - v1.0

## Document Control Information
**Document ID**: SRS-${projectName.toUpperCase()}-001
**Version**: 1.0
**Status**: Draft
**Release Date**: ${new Date().toISOString().split('T')[0]}

## 1. Introduction
This document defines the software requirements for ${projectName}.

## 3. Functional Requirements

| FR-ID | Requirement Name | Priority | Description |
|-------|------------------|----------|-------------|
| FR-001 | User Management | High | System shall provide user registration and authentication |
| FR-002 | Core Functionality | High | System shall provide core business features |

### --- FUNCTIONAL REQUIREMENTS ---
functional_requirements:
  - id: FR-001
    title: "User Management"
    description: "User registration and authentication"
    priority: "High"
    category: "User Management"

### --- NON-FUNCTIONAL REQUIREMENTS ---
non_functional_requirements:
  performance:
    - id: NFR-PERF-001
      title: "Response Time"
      description: "System response time should be under 2 seconds"

### --- GLOSSARY ---
glossary:
  - term: "User"
    definition: "Person who uses the system"
    category: "business"

### --- QUESTIONS FOR CLARIFICATION ---
## Questions for Stakeholders:
1. What specific features are most important?
2. Who are the target users?

### --- PARSING METADATA ---
**version**: 1.0
**fr_count**: 2
**nfr_count**: 1`;
    }

    /**
     * 从文档中提取项目名称
     */
    private extractProjectNameFromDocument(document: string): string | null {
        const match = document.match(/# AI-Generated Project Analysis & SRS for "([^"]+)"/);
        return match ? match[1] : null;
    }

    /**
     * 从输入提取项目名称
     */
    private extractProjectNameFromInput(input: string): string {
        const match = input.match(/(?:做|开发|创建|建立).*?([\u4e00-\u9fa5a-zA-Z0-9]+(?:系统|平台|应用|工具|管理|app|system|platform))/i);
        if (match && match[1]) {
            return `srs-${match[1].toLowerCase().replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '-')}`;
        }
        return `srs-project-${Date.now()}`;
    }

    /**
     * 获取意图描述
     */
    private getIntentDescription(intent: string): string {
        const descriptions: { [key: string]: string } = {
            'create': '创建新的SRS项目',
            'edit': '编辑现有项目',
            'help': '获取帮助信息',
            'git': 'Git版本控制操作',
            'error': '处理遇到错误'
        };
        return descriptions[intent] || '处理您的请求';
    }

    /**
     * 获取或创建会话上下文
     */
    private async getOrCreateSessionContext(): Promise<SessionContext> {
        let sessionContext = await this.sessionManager.getCurrentSession();
        if (!sessionContext) {
            sessionContext = await this.sessionManager.createNewSession();
        }
        return sessionContext;
    }

    /**
     * 获取或创建聊天会话
     */
    private getOrCreateChatSession(sessionId: string): ChatSession {
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
     * 获取会话ID
     */
    private getSessionId(context: vscode.ChatContext): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 提供后续建议 - v1.2增强版
     */
    private async provideFollowups(
        result: vscode.ChatResult,
        context: vscode.ChatContext,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatFollowup[]> {
        const sessionContext = await this.sessionManager.getCurrentSession();
        
        if (sessionContext?.projectName) {
            // 有活跃项目时的建议
            return [
                {
                    prompt: '添加更多功能需求',
                    label: '➕ 添加功能'
                },
                {
                    prompt: '修改现有需求',
                    label: '✏️ 编辑需求'
                },
                {
                    prompt: '优化性能要求',
                    label: '⚡ 优化性能'
                },
                {
                    prompt: '/status',
                    label: '📊 查看状态'
                }
            ];
        } else {
            // 无活跃项目时的建议
            return [
                {
                    prompt: '创建一个电商系统',
                    label: '🛒 电商系统'
                },
                {
                    prompt: '创建一个管理系统',
                    label: '📋 管理系统'
                },
                {
                    prompt: '创建一个移动应用',
                    label: '📱 移动应用'
                },
                {
                    prompt: '/help',
                    label: '❓ 帮助'
                }
            ];
        }
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
    public async getStatus(): Promise<string> {
        const sessionContext = await this.sessionManager.getCurrentSession();
        return `v1.3 - Sessions: ${this.sessions.size}, Current Project: ${sessionContext?.projectName || 'None'}`;
    }

    /**
     * 处理质量检查命令 - v1.3新增
     */
    private async handleLintCommand(
        stream: vscode.ChatResponseStream, 
        sessionContext: SessionContext,
        token: vscode.CancellationToken
    ): Promise<void> {
        if (!sessionContext.projectName) {
            stream.markdown('⚠️ **无活跃项目**\n\n');
            stream.markdown('请先创建一个项目才能进行质量检查。\n\n');
            return;
        }

        try {
            stream.progress('🔍 正在检查文档质量...');
            stream.markdown(`## 🔍 质量检查 - ${sessionContext.projectName}\n\n`);
            
            // 读取项目文件
            const documents = await this.loadProjectDocuments(sessionContext);
            
            if (documents.length === 0) {
                stream.markdown('⚠️ 未找到可检查的文档文件。\n');
                return;
            }

            if (token.isCancellationRequested) {
                stream.markdown('❌ 操作已取消');
                return;
            }

            // 执行质量检查
            const reports = await this.lintChecker.checkDocumentSet(documents);
            
            // 显示结果
            await this.displayLintResults(stream, reports, sessionContext.projectName);
            
        } catch (error) {
            this.logger.error('Lint command failed', error as Error);
            stream.markdown('❌ 质量检查失败，请稍后重试。\n');
        }
    }

    /**
     * 加载项目文档文件
     */
    private async loadProjectDocuments(sessionContext: SessionContext): Promise<SRSDocument[]> {
        const documents: SRSDocument[] = [];
        
        try {
            // 获取工作区根目录
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                this.logger.warn('No workspace folder found');
                return documents;
            }

            const projectPath = vscode.Uri.joinPath(workspaceFolder.uri, sessionContext.projectName!);
            
            // 读取SRS.md文件
            try {
                const srsPath = vscode.Uri.joinPath(projectPath, 'SRS.md');
                const srsContent = await vscode.workspace.fs.readFile(srsPath);
                documents.push({
                    fileName: 'SRS.md',
                    content: Buffer.from(srsContent).toString('utf8'),
                    type: 'srs'
                });
            } catch (error) {
                this.logger.warn('Failed to read SRS.md');
            }

            // 读取其他相关文件
            const fileTypes = [
                { name: 'fr.yaml', type: 'fr' as const },
                { name: 'nfr.yaml', type: 'nfr' as const },
                { name: 'glossary.yaml', type: 'glossary' as const }
            ];

            for (const fileType of fileTypes) {
                try {
                    const filePath = vscode.Uri.joinPath(projectPath, fileType.name);
                    const fileContent = await vscode.workspace.fs.readFile(filePath);
                    documents.push({
                        fileName: fileType.name,
                        content: Buffer.from(fileContent).toString('utf8'),
                        type: fileType.type
                    });
                } catch (error) {
                    this.logger.warn(`Failed to read ${fileType.name}`);
                }
            }
            
        } catch (error) {
            this.logger.error('Failed to load project documents', error as Error);
        }
        
        return documents;
    }

    /**
     * 显示质量检查结果
     */
    private async displayLintResults(
        stream: vscode.ChatResponseStream, 
        reports: LintReport[], 
        projectName: string
    ): Promise<void> {
        // 生成汇总
        const summary = this.lintChecker.generateSummary(reports);
        stream.markdown(summary);
        stream.markdown('\n---\n\n');
        
        // 显示详细结果
        for (const report of reports) {
            stream.markdown(`### 📄 ${report.fileName}\n\n`);
            
            if (report.passed) {
                stream.markdown(`✅ **质量评分**: ${report.score}/100 - 通过\n\n`);
            } else {
                stream.markdown(`❌ **质量评分**: ${report.score}/100 - 需要改进\n\n`);
            }
            
            if (report.results.length === 0) {
                stream.markdown('🎉 未发现问题！\n\n');
                continue;
            }
            
            // 按严重性分组显示问题
            const errorResults = report.results.filter(r => r.severity === 'error');
            const warningResults = report.results.filter(r => r.severity === 'warning');
            const infoResults = report.results.filter(r => r.severity === 'info');
            
            if (errorResults.length > 0) {
                stream.markdown('**🔴 错误 (必须修复):**\n');
                for (const result of errorResults) {
                    stream.markdown(`- ${result.message}`);
                    if (result.suggestion) {
                        stream.markdown(` 💡 *${result.suggestion}*`);
                    }
                    if (result.line) {
                        stream.markdown(` (第${result.line}行)`);
                    }
                    stream.markdown('\n');
                }
                stream.markdown('\n');
            }
            
            if (warningResults.length > 0) {
                stream.markdown('**🟡 警告 (建议修复):**\n');
                for (const result of warningResults) {
                    stream.markdown(`- ${result.message}`);
                    if (result.suggestion) {
                        stream.markdown(` 💡 *${result.suggestion}*`);
                    }
                    if (result.line) {
                        stream.markdown(` (第${result.line}行)`);
                    }
                    stream.markdown('\n');
                }
                stream.markdown('\n');
            }
            
            if (infoResults.length > 0) {
                stream.markdown('**🔵 建议 (可选优化):**\n');
                for (const result of infoResults) {
                    stream.markdown(`- ${result.message}`);
                    if (result.suggestion) {
                        stream.markdown(` 💡 *${result.suggestion}*`);
                    }
                    if (result.line) {
                        stream.markdown(` (第${result.line}行)`);
                    }
                    stream.markdown('\n');
                }
                stream.markdown('\n');
            }
        }
        
        // 显示改进建议
        const passedCount = reports.filter(r => r.passed).length;
        const totalCount = reports.length;
        
        if (passedCount === totalCount) {
            stream.markdown('## 🎉 恭喜！\n\n');
            stream.markdown('您的文档质量很好，已通过所有基础检查！\n\n');
            stream.markdown('💡 您可以继续完善项目或使用 `/help` 了解更多功能。');
        } else {
            stream.markdown('## 📝 改进建议\n\n');
            stream.markdown('1. **优先修复错误项** - 这些问题可能影响文档的基本可用性\n');
            stream.markdown('2. **处理警告项** - 这些改进将提升文档的专业性\n');
            stream.markdown('3. **考虑建议项** - 这些优化将进一步提升文档质量\n\n');
            stream.markdown('修复问题后，可以再次使用 `/lint` 命令检查效果。');
        }
    }
}
