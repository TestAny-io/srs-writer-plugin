import * as vscode from 'vscode';
import { SessionContext } from '../types/session';
import { Logger } from '../utils/logger';
import { CHAT_PARTICIPANT_ID } from '../constants';
import { Orchestrator } from '../core/orchestrator';
import { SessionManager } from '../core/session-manager';
import { SRSAgentEngine } from '../core/srsAgentEngine';
import { toolExecutor } from '../core/toolExecutor';

/**
 * SRS聊天参与者 v4.0 - 持久化智能引擎架构
 * 
 * 🚀 核心修复：解决"金鱼智能代理"问题
 * - 实现会话级引擎持久化
 * - 引擎注册表管理多会话
 * - 状态记忆跨交互保持
 * 
 * 架构原则：
 * - 引擎持久化：每个会话一个长生命周期引擎
 * - 状态保持：智能判断新任务vs用户响应
 * - 透明代理：完全委托给持久化的SRSAgentEngine
 */
export class SRSChatParticipant {
    private logger = Logger.getInstance();
    
    // 核心依赖组件
    private orchestrator: Orchestrator;
    private sessionManager: SessionManager;
    
    // 🚀 新架构：引擎注册表 - 支持多会话并发
    private engineRegistry: Map<string, SRSAgentEngine> = new Map();
    
    constructor() {
        this.orchestrator = new Orchestrator();
        this.sessionManager = new SessionManager();
        
        // 自动初始化会话管理
        this.sessionManager.autoInitialize().catch(error => {
            this.logger.error('Failed to auto-initialize session manager', error as Error);
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
     * 处理聊天请求 - v2.0精简版本
     * 
     * 职责：
     * 1. 路由到Slash命令处理器或核心逻辑
     * 2. 统一错误处理
     */
    private async handleChatRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            if (request.prompt.startsWith('/')) {
                // Slash命令自己处理，或者转换prompt后调用核心逻辑
                await this.handleSlashCommand(request, context, stream, token);
            } else {
                // 普通请求直接调用核心逻辑
                await this.processRequestCore(request.prompt, request.model, stream, token);
            }
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
     * 核心请求处理逻辑 - v4.0持久化引擎版本
     * 
     * 🚀 架构修复：解决"金鱼智能代理"问题
     * 职责：
     * 1. 验证AI模型
     * 2. 获取会话上下文  
     * 3. 获取或创建持久化的SRSAgentEngine
     * 4. 智能判断是新任务还是用户响应
     */
    private async processRequestCore(
        prompt: string,
        model: vscode.LanguageModelChat | undefined,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        // 🐛 DEBUG: 记录接收到的prompt参数
        this.logger.info(`🔍 [DEBUG] processRequestCore received prompt: "${prompt}"`);
        
        // 检查用户选择的模型
        if (!model) {
            stream.markdown('⚠️ **未找到AI模型**\n\n请在Chat界面的下拉菜单中选择AI模型。');
            return;
        }
        
        stream.progress('🧠 AI 智能引擎启动中...');
        
        // 1. 获取会话上下文
        const sessionContext = await this.getOrCreateSessionContext();

        if (token.isCancellationRequested) { return; }

        // 2. 生成稳定的会话ID
        const sessionId = this.getSessionId(sessionContext);

        // 3. 获取或创建持久化的SRSAgentEngine实例
        const agentEngine = this.getOrCreateEngine(sessionId, stream, sessionContext, model);

        if (token.isCancellationRequested) { return; }

        // 4. 🚀 关键修复：正确的状态判断和分发
        const isAwaitingUser = agentEngine.isAwaitingUser();
        const engineState = agentEngine.getState();
        
        // 🐛 DEBUG: 记录状态判断的详细信息
        this.logger.info(`🔍 [DEBUG] Engine state before task dispatch:`);
        this.logger.info(`🔍 [DEBUG] - isAwaitingUser: ${isAwaitingUser}`);
        this.logger.info(`🔍 [DEBUG] - engine.stage: ${engineState.stage}`);
        this.logger.info(`🔍 [DEBUG] - engine.currentTask: "${engineState.currentTask}"`);
        this.logger.info(`🔍 [DEBUG] - prompt to process: "${prompt}"`);
        
        if (isAwaitingUser) {
            // 这是用户对等待中交互的响应
            this.logger.info(`📥 Processing user response for session: ${sessionId}`);
            await agentEngine.handleUserResponse(prompt);
        } else {
            // 这是新任务，开始执行（不创建新引擎！）
            this.logger.info(`🚀 Starting new task for session: ${sessionId}`);
            await agentEngine.executeTask(prompt);
        }
    }

    /**
     * 🚀 核心方法：获取或创建持久化的引擎实例
     * 
     * 这是解决"金鱼智能代理"问题的关键方法
     */
    private getOrCreateEngine(
        sessionId: string, 
        stream: vscode.ChatResponseStream,
        sessionContext: SessionContext,
        model: vscode.LanguageModelChat
    ): SRSAgentEngine {
        let engine = this.engineRegistry.get(sessionId);
        
        if (!engine) {
            // 🚀 只在真正需要时创建新引擎
            engine = new SRSAgentEngine(stream, sessionContext, model);
            engine.setDependencies(this.orchestrator, toolExecutor);
            this.engineRegistry.set(sessionId, engine);
            this.logger.info(`🧠 Created new persistent engine for session: ${sessionId}`);
        } else {
            // 🚀 复用现有引擎，只更新当前交互的参数
            engine.updateStreamAndModel(stream, model);
            this.logger.info(`♻️  Reusing existing engine for session: ${sessionId}`);
        }
        
        return engine;
    }
    
    /**
     * 🚀 生成稳定的会话ID
     * 
     * 基于工作区路径和项目名生成会话标识符
     */
    private getSessionId(sessionContext: SessionContext): string {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'default';
        const projectName = sessionContext.projectName || 'default';
        
        // 创建稳定且简洁的会话ID
        const baseId = `${workspacePath}-${projectName}`;
        
        // 如果路径过长，创建哈希以避免问题
        if (baseId.length > 100) {
            const crypto = require('crypto');
            return crypto.createHash('md5').update(baseId).digest('hex').slice(0, 16);
        }
        
        return baseId.replace(/[^a-zA-Z0-9-_]/g, '_'); // 清理特殊字符
    }

    /**
     * 处理Slash命令 - v2.0简化版本
     * 
     * 将所有Slash命令转换为自然语言提示，交给Orchestrator处理
     */
    private async handleSlashCommand(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        const command = request.prompt.toLowerCase();
        let newPrompt: string | null = null;

        switch (command) {
            case '/help':
                newPrompt = "请提供帮助信息，详细介绍你的所有功能和使用方法。";
                break;
            
            case '/status':
                newPrompt = "请提供当前项目的详细状态报告，包括项目信息、文件状态、工具可用性等。";
                break;
                
            case '/lint':
                const sessionContext = await this.getOrCreateSessionContext();
                if (!sessionContext.projectName) {
                    stream.markdown('⚠️ **无活跃项目**，无法执行质量检查。\n\n');
                    stream.markdown('💡 请先创建一个项目，然后再进行质量检查。');
                    return;
                }
                newPrompt = `请对当前项目 "${sessionContext.projectName}" 进行一次完整的质量检查和代码分析。`;
                break;
                
            case '/create':
                newPrompt = "请提供创建新项目的指导，说明如何开始一个新的SRS项目。";
                break;
                
            case '/edit':
                const currentSession = await this.getOrCreateSessionContext();
                if (!currentSession.projectName) {
                    stream.markdown('⚠️ **无活跃项目**，无法使用编辑功能。\n\n');
                    stream.markdown('💡 请先创建一个项目，然后再进行编辑操作。');
                    return;
                }
                newPrompt = `请提供编辑当前项目 "${currentSession.projectName}" 的指导和可用选项。`;
                break;
                
            default:
                stream.markdown(`❓ 未知命令: \`${request.prompt}\`\n\n`);
                stream.markdown('**可用命令**:\n');
                stream.markdown('- `/help` - 显示帮助信息\n');
                stream.markdown('- `/status` - 查看项目状态\n');
                stream.markdown('- `/lint` - 执行质量检查\n');
                stream.markdown('- `/create` - 创建项目指导\n');
                stream.markdown('- `/edit` - 编辑项目指导\n\n');
                stream.markdown('💡 您也可以直接用自然语言描述您的需求！');
                return;
        }

        if (newPrompt) {
            // 🐛 DEBUG: 记录转换后的提示词
            this.logger.info(`🔍 [DEBUG] Slash command '${command}' converted to prompt: "${newPrompt}"`);
            // 直接调用核心逻辑，而不是递归调用handleChatRequest
            await this.processRequestCore(newPrompt, request.model, stream, token);
        }
    }

    /**
     * 获取或创建会话上下文
     */
    private async getOrCreateSessionContext(): Promise<SessionContext> {
        try {
            const session = await this.sessionManager.getCurrentSession();
            if (session) {
                return session;
            }
            // 如果没有当前会话，创建新会话
            return await this.sessionManager.createNewSession();
        } catch (error) {
            this.logger.error('Failed to get session context', error as Error);
            // 返回默认会话上下文
            return await this.sessionManager.createNewSession();
        }
    }

    /**
     * 提供跟进建议
     */
    private async provideFollowups(
        result: vscode.ChatResult,
        context: vscode.ChatContext,
        token: vscode.CancellationToken
    ): Promise<vscode.ChatFollowup[]> {
        try {
            const sessionContext = await this.getOrCreateSessionContext();
            const followups: vscode.ChatFollowup[] = [];

            // 根据当前状态提供智能建议
            if (sessionContext.projectName) {
                // 有项目时的建议
                followups.push(
                    { label: '📊 查看项目状态', prompt: '/status' },
                    { label: '✏️ 编辑项目', prompt: '/edit' },
                    { label: '🔍 质量检查', prompt: '/lint' },
                    { label: '💡 获取帮助', prompt: '/help' }
                );
            } else {
                // 无项目时的建议
                followups.push(
                    { label: '🚀 创建新项目', prompt: '我想创建一个新的项目' },
                    { label: '💡 获取帮助', prompt: '/help' },
                    { label: '📊 查看状态', prompt: '/status' }
                );
            }

            return followups;
        } catch (error) {
            this.logger.error('Error providing followups', error as Error);
            return [
                { label: '💡 获取帮助', prompt: '/help' }
            ];
        }
    }

    /**
     * 获取参与者状态（用于调试和监控）
     */
    public async getStatus(): Promise<string> {
        try {
            const sessionContext = await this.getOrCreateSessionContext();
            const sessionId = this.getSessionId(sessionContext);
            const orchestratorStatus = await this.orchestrator.getStatus();
            
            return [
                '=== SRS Chat Participant v4.0 Status ===',
                `Architecture: 智能状态机 + 分层工具执行`,
                `Current Project: ${sessionContext.projectName || 'None'}`,
                `Base Directory: ${sessionContext.baseDir || 'None'}`,
                `Active Files: ${sessionContext.activeFiles.length}`,
                `Agent Engine: ${this.engineRegistry.has(sessionId) ? 'Active' : 'Inactive'}`,
                `Engine State: ${this.engineRegistry.has(sessionId) ? this.engineRegistry.get(sessionId)?.getState().stage : 'None'}`,
                `Awaiting User: ${this.engineRegistry.has(sessionId) ? this.engineRegistry.get(sessionId)?.isAwaitingUser() : false}`,
                `Orchestrator Status: ${orchestratorStatus.aiMode ? 'Active' : 'Inactive'}`,
                `Available Tools: ${orchestratorStatus.availableTools.length}`,
                `Session Version: ${sessionContext.metadata.version}`,
                `Session ID: ${sessionId}`,
                `Active Sessions: ${this.engineRegistry.size}`
            ].join('\n');
        } catch (error) {
            return `Status Error: ${error}`;
        }
    }
}
