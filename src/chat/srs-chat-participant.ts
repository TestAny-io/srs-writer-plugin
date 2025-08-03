import * as vscode from 'vscode';
import { SessionContext, ISessionObserver } from '../types/session';
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
 * - 🚀 新增：观察者模式自动清理孤儿engines
 */
export class SRSChatParticipant implements ISessionObserver {
    private logger = Logger.getInstance();
    
    // 核心依赖组件
    private orchestrator: Orchestrator;
    private sessionManager: SessionManager;
    
    // 🚀 新架构：全局单例引擎（v5.0重构）
    private static globalEngine: SRSAgentEngine | null = null;
    private static globalEngineLastActivity: number = 0;
    
    // 🔄 兼容层：保留现有引擎注册表作为fallback
    private _engineRegistry: Map<string, SRSAgentEngine> = new Map();
    
    // 🚀 新增：架构模式切换标志（用于渐进式迁移）
    private readonly useGlobalEngine: boolean = true; // 🎯 默认使用新架构
    
    // 🚀 简化的 engineRegistry getter（架构一致化修复）
    private get engineRegistry(): Map<string, SRSAgentEngine> {
        if (this.useGlobalEngine) {
            this.logger.debug(`[LEGACY REGISTRY] Accessing legacy registry in global engine mode`);
        }
        return this._engineRegistry;
    }
    
    private set engineRegistry(value: Map<string, SRSAgentEngine>) {
        const oldSize = this._engineRegistry.size;
        const newSize = value.size;
        
        this.logger.debug(`[REGISTRY SET] Engine Registry being replaced: ${oldSize} → ${newSize}`);
        this._engineRegistry = value;
    }
    
    // 🚀 新增：跟踪当前会话ID，用于检测会话变更
    private currentSessionId: string | null = null;
    
    private constructor() {
        // 🕵️ 添加构造函数调用追踪
        const timestamp = new Date().toISOString();
        const instanceId = Math.random().toString(36).substr(2, 9);
        const stack = new Error().stack;
        
        this.logger.warn(`🚨 [CONSTRUCTOR] SRSChatParticipant constructor called at ${timestamp}!`);
        this.logger.warn(`🚨 [CONSTRUCTOR] Instance ID: ${instanceId}`);
        this.logger.warn(`🚨 [CONSTRUCTOR] Call stack:`);
        this.logger.warn(stack || 'No stack trace available');
        
        this.orchestrator = new Orchestrator();
        this.sessionManager = SessionManager.getInstance();
        
        // 🚀 新增：订阅SessionManager的会话变更通知
        this.sessionManager.subscribe(this);
        
        // 🕵️ 记录registry初始化
        this.logger.debug(`[CONSTRUCTOR] engineRegistry initialized, size: ${this._engineRegistry.size}`);
        this.logger.warn(`🚨 [CONSTRUCTOR] This is a NEW SRSChatParticipant instance (${instanceId})`);
        
        // 🕵️ 记录autoInitialize调用
        this.logger.warn('🔍 [CONSTRUCTOR] About to call sessionManager.autoInitialize()...');
        this.sessionManager.autoInitialize().catch(error => {
            this.logger.error('Failed to auto-initialize session manager', error as Error);
            this.logger.warn('🔍 [CONSTRUCTOR] autoInitialize failed in constructor');
        });
        this.logger.warn('🔍 [CONSTRUCTOR] autoInitialize() call dispatched (async)');
    }

    /**
     * 注册聊天参与者
     */
    public static register(context: vscode.ExtensionContext): SRSChatParticipant {
        const participant = new SRSChatParticipant();
        
        // 注册聊天参与者
        const disposable = vscode.chat.createChatParticipant(
            CHAT_PARTICIPANT_ID, 
            participant.handleRequest.bind(participant)
        );
        
        // 设置参与者属性
        disposable.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media/logo.png');
        disposable.followupProvider = {
            provideFollowups: participant.provideFollowups.bind(participant)
        };
        
        context.subscriptions.push(disposable);
        
        return participant;
    }

    /**
     * 处理聊天请求 - 修复：恢复正确的调用链
     */
    private async handleRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        const startTime = Date.now();
        this.logger.info(`📥 处理聊天请求: ${request.prompt}`);

        try {
            // 🚀 修复：处理 /new 命令的特殊逻辑
            if (request.command === 'new') {
                stream.markdown('🆕 **正在创建新的会话...**\n\n');
                
                // 检查模型可用性
                if (!request.model) {
                    stream.markdown('⚠️ **未找到AI模型**\n\n请在Chat界面的下拉菜单中选择AI模型。');
                    return;
                }
                
                // 🚀 修复：使用正确的引擎创建流程
                await this.processRequestCore('/new', request.model, stream, token);
                return;
            }

            // 🚀 修复：检查是否是斜杠命令
            if (request.prompt.startsWith('/')) {
                await this.handleSlashCommand(request, context, stream, token);
                return;
            }

            // 🚀 修复：使用正确的核心处理逻辑
            await this.processRequestCore(request.prompt, request.model, stream, token);

        } catch (error) {
            this.logger.error('聊天请求处理失败', error as Error);
            
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            
            stream.markdown(`❌ **处理请求时发生错误**\n\n`);
            stream.markdown(`错误信息: ${errorMessage}\n\n`);
            
            if (errorMessage.includes('模型不可用') || errorMessage.includes('model not available')) {
                stream.markdown(`💡 **建议**: 请检查您的 AI 模型配置，确保模型可用且有足够的配额。\n\n`);
            }
        } finally {
            const duration = Date.now() - startTime;
            this.logger.info(`⏱️ 聊天请求处理完成，耗时: ${duration}ms`);
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
        const agentEngine = this.getOrCreateEngine(sessionId, stream, model);

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
     * 🚀 v5.0新架构：全局引擎管理方法
     * 
     * 关键改进：
     * - 单一全局引擎实例，生命周期绑定到插件
     * - 动态获取会话上下文，不绑定特定会话
     * - 避免会话切换导致的执行中断
     */
    private getOrCreateGlobalEngine(
        stream: vscode.ChatResponseStream,
        model: vscode.LanguageModelChat
    ): SRSAgentEngine {
        this.logger.warn(`🌐 [GLOBAL ENGINE] getOrCreateGlobalEngine called`);
        
        // 更新最后活动时间
        SRSChatParticipant.globalEngineLastActivity = Date.now();
        
        if (!SRSChatParticipant.globalEngine) {
            this.logger.warn(`🚨 [GLOBAL ENGINE] Creating NEW global engine instance`);
            
            // 创建全局引擎实例
            SRSChatParticipant.globalEngine = new SRSAgentEngine(stream, model);
            SRSChatParticipant.globalEngine.setDependencies(this.orchestrator, toolExecutor);
            
            this.logger.info(`🌐 Created global persistent engine`);
        } else {
            this.logger.warn(`🔄 [GLOBAL ENGINE] Reusing existing global engine`);
            // 更新当前交互的参数
            SRSChatParticipant.globalEngine.updateStreamAndModel(stream, model);
            this.logger.info(`♻️  Reusing global engine with updated stream/model`);
        }
        
        this.logger.warn(`🌐 [GLOBAL ENGINE] Global engine ready for use`);
        return SRSChatParticipant.globalEngine;
    }
    
    /**
     * 🚀 v5.0新架构：检查全局引擎状态
     */
    private getGlobalEngineStatus(): { exists: boolean; state?: string; lastActivity?: number } {
        if (!SRSChatParticipant.globalEngine) {
            return { exists: false };
        }
        
        const engineState = SRSChatParticipant.globalEngine.getState();
        return {
            exists: true,
            state: engineState.stage,
            lastActivity: SRSChatParticipant.globalEngineLastActivity
        };
    }

    /**
     * 🚀 核心方法：获取或创建持久化的引擎实例 - v5.0兼容版
     * 
     * 支持新旧架构的渐进式迁移
     */
    private getOrCreateEngine(
        sessionId: string, 
        stream: vscode.ChatResponseStream,
        model: vscode.LanguageModelChat
    ): SRSAgentEngine {
        // 🚀 v5.0新架构：优先使用全局引擎
        if (this.useGlobalEngine) {
            this.logger.warn(`🌐 [ARCHITECTURE] Using global engine architecture (v5.0)`);
            this.logger.warn(`🌐 [ARCHITECTURE] SessionId ${sessionId} will be handled by global engine`);
            
            return this.getOrCreateGlobalEngine(stream, model);
        }
        
        // 🔄 兼容层：fallback到旧的会话基础架构
        this.logger.warn(`📡 [LEGACY] Using legacy session-based engine architecture`);
        
        // 🕵️ 添加engine registry详细追踪
        this.logger.debug(`[ENGINE REGISTRY] getOrCreateEngine called for sessionId: ${sessionId}`);
        this.logger.debug(`[ENGINE REGISTRY] Current registry size: ${this._engineRegistry.size}`);
        this.logger.debug(`[ENGINE REGISTRY] Registry keys: [${Array.from(this._engineRegistry.keys()).join(', ')}]`);
        
        let engine = this._engineRegistry.get(sessionId);
        this.logger.debug(`[ENGINE REGISTRY] Registry.get(${sessionId}) returned: ${engine ? 'ENGINE_FOUND' : 'NULL'}`);
        
        if (!engine) {
            this.logger.debug(`[ENGINE REGISTRY] Creating NEW engine for sessionId: ${sessionId}`);
            // 🚀 v3.0重构：创建新引擎，移除sessionContext参数
            engine = new SRSAgentEngine(stream, model);
            engine.setDependencies(this.orchestrator, toolExecutor);
            
            // 🚨 新增：Registry SET操作追踪
            this.logger.debug(`[ENGINE REGISTRY] About to SET engine for sessionId: ${sessionId}`);
            this._engineRegistry.set(sessionId, engine);
            this.logger.debug(`[ENGINE REGISTRY] After SET - registry size: ${this._engineRegistry.size}`);
            
            this.logger.info(`🧠 Created new persistent engine for session: ${sessionId}`);
        } else {
            this.logger.debug(`[ENGINE REGISTRY] Reusing existing engine for sessionId: ${sessionId}`);
            // 🚀 复用现有引擎，只更新当前交互的参数
            engine.updateStreamAndModel(stream, model);
            this.logger.info(`♻️  Reusing existing engine for session: ${sessionId}`);
        }
        
        this.logger.debug(`[ENGINE REGISTRY] Final registry size: ${this._engineRegistry.size}`);
        return engine;
    }
    
    /**
     * 🚀 生成稳定的会话ID
     * 
     * 基于sessionContextId生成稳定的会话标识符
     */
    private getSessionId(sessionContext: SessionContext): string {
        // 🚀 修复：使用稳定的sessionContextId而不是动态的projectName
        return sessionContext.sessionContextId;
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
                
            case '/new':
                // 🚀 修复：让 /new 命令具有和 "Start New Project" 相同的行为
                await this.handleNewProjectCommand(stream, token);
                return; // 直接返回，不需要进一步处理
                
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
                stream.markdown('- `/new` - 归档当前项目并创建新项目\n');
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
     * 🚀 新增：处理 /new 命令 - 实现完整的项目归档和重置
     * 与 "Start New Project" 命令相同的行为
     */
    private async handleNewProjectCommand(
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            // 检查当前会话
            const currentSession = await this.sessionManager.getCurrentSession();
            const hasCurrentProject = currentSession?.projectName;

            // 显示状态信息
            if (hasCurrentProject) {
                stream.markdown(`📁 **当前项目**: ${currentSession.projectName}\n\n`);
                stream.markdown('🔄 **正在归档当前项目并创建新项目...**\n\n');
                
                // 显示进度
                stream.progress('归档当前项目中...');
            } else {
                stream.markdown('🆕 **正在创建新项目...**\n\n');
                stream.progress('创建新项目中...');
            }

            if (token.isCancellationRequested) { return; }

            // 执行归档并开始新项目 - 和 "Start New Project" 相同的逻辑
            const result = await this.sessionManager.archiveCurrentAndStartNew(undefined, 'new_project');

            if (token.isCancellationRequested) { return; }

            if (result.success) {
                // 清理当前聊天参与者的引擎状态，确保使用新的会话
                await this.clearStaleEngines();
                
                const preservedCount = result.filesPreserved.length;
                const archiveInfo = result.archivedSession ? 
                    `\n📦 **原项目已归档**: ${result.archivedSession.archiveFileName}` : '';
                
                stream.markdown(`✅ **新项目创建成功！**${archiveInfo}\n\n`);
                if (preservedCount > 0) {
                    stream.markdown(`💾 **已保护用户文件**: ${preservedCount} 个\n\n`);
                }
                
                // 显示新项目信息
                if (result.newSession) {
                    stream.markdown(`🎯 **新项目**: ${result.newSession.projectName || 'unnamed'}\n`);
                    stream.markdown(`📂 **项目目录**: ${result.newSession.baseDir || 'none'}\n\n`);
                }
                
                stream.markdown('💡 **提示**: 您现在可以开始描述新项目的需求，我将帮助您创建SRS文档！\n\n');
                
                this.logger.info(`/new command completed successfully. Preserved ${preservedCount} files.`);
            } else {
                stream.markdown(`❌ **创建新项目失败**: ${result.error || '未知错误'}\n\n`);
                stream.markdown('💡 请稍后重试或联系技术支持。\n\n');
                
                this.logger.error(`/new command failed: ${result.error}`);
            }

        } catch (error) {
            this.logger.error('Failed to handle /new command', error as Error);
            
            stream.markdown(`❌ **处理 /new 命令时发生错误**\n\n`);
            stream.markdown(`错误信息: ${(error as Error).message}\n\n`);
            stream.markdown('💡 请稍后重试或使用 `Cmd+Shift+P` → "SRS Writer: Start New Project" 作为替代。\n\n');
        }
    }

    /**
     * 获取或创建会话上下文
     */
    private async getOrCreateSessionContext(): Promise<SessionContext> {
        // 🕵️ 添加会话获取追踪
        this.logger.warn('🔍 [GET OR CREATE] getOrCreateSessionContext() called');
        
        try {
            this.logger.warn('🔍 [GET OR CREATE] Calling sessionManager.getCurrentSession()...');
            const session = await this.sessionManager.getCurrentSession();
            
            if (session) {
                this.logger.warn(`🔍 [GET OR CREATE] Found existing session: ${session.projectName} (${session.sessionContextId})`);
                return session;
            }
            
            // 🚨 这里会创建新的SessionContext！
            this.logger.warn('🚨 [GET OR CREATE] No existing session found, creating NEW SESSION!');
            return await this.sessionManager.createNewSession();
        } catch (error) {
            this.logger.error('Failed to get current session, creating new one', error as Error);
            this.logger.warn('🚨 [GET OR CREATE] Error occurred, creating NEW SESSION as fallback!');
            // 🚨 这里也会创建新的SessionContext！
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
                    { label: '🆕 归档并创建新项目', prompt: '/new' },
                    { label: '💡 获取帮助', prompt: '/help' }
                );
            } else {
                // 无项目时的建议
                followups.push(
                    { label: '🆕 创建新项目', prompt: '/new' },
                    { label: '💡 获取帮助', prompt: '/help' },
                    { label: '📊 查看项目状态', prompt: '/status' }
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
     * 🚀 v5.0重构：智能引擎清理 - 架构感知版本
     * 
     * 新架构：保护全局引擎，只清理会话状态
     * 旧架构：保持原有的完整清理逻辑
     */
    public async clearStaleEngines(): Promise<void> {
        // 🕵️ 添加clearStaleEngines详细追踪
        const stack = new Error().stack;
        this.logger.warn('🚨 [CLEAR ENGINES] clearStaleEngines() called! Call stack:');
        this.logger.warn(stack || 'No stack trace available');
        this.logger.warn(`🚨 [CLEAR ENGINES] Architecture mode: ${this.useGlobalEngine ? 'GLOBAL' : 'LEGACY'}`);
        
        if (this.useGlobalEngine) {
            // 🌐 新架构：保护全局引擎，只重置其会话感知状态
            this.logger.warn('🌐 [GLOBAL ENGINE] Protecting global engine from cleanup');
            
            const globalStatus = this.getGlobalEngineStatus();
            if (globalStatus.exists) {
                this.logger.warn(`🌐 [GLOBAL ENGINE] Global engine exists in state: ${globalStatus.state}`);
                this.logger.warn(`🌐 [GLOBAL ENGINE] Preserving engine but allowing session context refresh`);
                
                // 🚀 关键：不清理引擎，但允许其自然刷新会话上下文
                // SRSAgentEngine已经通过getCurrentSessionContext()动态获取最新会话
                this.logger.info(`✅ [GLOBAL ENGINE] Global engine preserved, will adapt to current session context`);
            } else {
                this.logger.warn(`⚠️ [GLOBAL ENGINE] No global engine to protect`);
            }
            
            // 🧹 清理遗留的注册表条目（如果有的话）
            const legacyEngineCount = this._engineRegistry.size;
            if (legacyEngineCount > 0) {
                this.logger.warn(`🧹 [CLEANUP] Cleaning up ${legacyEngineCount} legacy registry entries`);
                
                this._engineRegistry.forEach((engine, sessionId) => {
                    this.logger.warn(`🧹 [CLEANUP] Disposing legacy engine for sessionId: ${sessionId}`);
                    try {
                        engine.dispose(); // 取消观察者订阅
                    } catch (error) {
                        this.logger.error(`❌ [CLEANUP] Failed to dispose legacy engine: ${(error as Error).message}`);
                    }
                });
                
                this._engineRegistry.clear();
                this.logger.info(`🧹 [CLEANUP] Cleared ${legacyEngineCount} legacy engines`);
            }
            
        } else {
            // 📡 兼容层：在旧架构下保持原有的完整清理逻辑
            this.logger.warn('📡 [LEGACY] Using legacy engine cleanup logic');
            
            const engineCount = this._engineRegistry.size;
            this.logger.debug(`[CLEAR ENGINES] Registry size before clear: ${engineCount}`);
            this.logger.debug(`[CLEAR ENGINES] Registry keys before clear: [${Array.from(this._engineRegistry.keys()).join(', ')}]`);
            
            // 清理所有引擎，它们会重新获取最新的SessionContext
            this._engineRegistry.forEach((engine, sessionId) => {
                this.logger.debug(`[CLEAR ENGINES] Disposing engine for sessionId: ${sessionId}`);
                try {
                    engine.dispose(); // 取消观察者订阅
                } catch (error) {
                    this.logger.error(`❌ [CLEAR ENGINES] Engine disposal failed for ${sessionId}: ${(error as Error).message}`, error as Error);
                }
            });
            
            // 清空registry
            this._engineRegistry.clear();
            this.logger.debug(`[CLEAR ENGINES] Registry CLEARED - new size: ${this._engineRegistry.size}`);
            
            this.logger.info(`🧹 Cleared ${engineCount} stale engines from registry`);
        }
    }

    /**
     * 🚀 v5.0重构：会话观察者 - 智能引擎管理
     * 
     * 关键改进：
     * - 新架构：会话切换不影响全局引擎
     * - 旧架构：保持原有清理逻辑作为兼容
     * - 智能检测：避免执行中断
     */
    public onSessionChanged(newContext: SessionContext | null): void {
        const newSessionId = newContext?.sessionContextId || null;
        const oldSessionId = this.currentSessionId;
        
        // 🚨 新增：Session变更详细追踪
        const changeTimestamp = new Date().toISOString();
        const changeStack = new Error().stack;
        
        this.logger.warn(`🚨 [SESSION OBSERVER] Session changed at ${changeTimestamp}`);
        this.logger.warn(`🚨 [SESSION OBSERVER] Change: ${oldSessionId} → ${newSessionId}`);
        this.logger.warn(`🚨 [SESSION OBSERVER] New project: ${newContext?.projectName || 'null'}`);
        this.logger.warn(`🚨 [SESSION OBSERVER] Architecture mode: ${this.useGlobalEngine ? 'GLOBAL' : 'LEGACY'}`);
        this.logger.warn(`🚨 [SESSION OBSERVER] Call stack:`);
        this.logger.warn(changeStack || 'No stack trace available');
        
        this.logger.info(`🔄 [SESSION OBSERVER] Session changed: ${oldSessionId} → ${newSessionId}`);
        
        // 🚀 v5.0新架构：会话切换不影响全局引擎
        if (this.useGlobalEngine) {
            this.logger.info(`🌐 [GLOBAL ENGINE] Session changed, but global engine persists`);
            this.logger.info(`🌐 [GLOBAL ENGINE] Global engine will dynamically adapt to new session context`);
            
            // 检查全局引擎状态
            const globalStatus = this.getGlobalEngineStatus();
            if (globalStatus.exists) {
                this.logger.info(`🌐 [GLOBAL ENGINE] Current state: ${globalStatus.state}, last activity: ${new Date(globalStatus.lastActivity || 0).toISOString()}`);
                
                // 🚀 关键：在新架构下，不清理引擎，让其自然适应新会话
                this.logger.info(`✅ [GLOBAL ENGINE] Preserving engine state across session change`);
            } else {
                this.logger.warn(`⚠️ [GLOBAL ENGINE] No global engine exists yet`);
            }
        } else {
            // 🔄 兼容层：仅在明确使用旧架构时执行
            this.logger.warn(`📡 [LEGACY] Using legacy engine cleanup logic`);
            this.logger.warn(`🚨 [SESSION OBSERVER] Current engine registry size: ${this._engineRegistry.size}`);
            this.logger.warn(`🚨 [SESSION OBSERVER] Registry keys: [${Array.from(this._engineRegistry.keys()).join(', ')}]`);
            
            // 检测到会话ID变更，需要清理旧engines
            if (oldSessionId && newSessionId && oldSessionId !== newSessionId) {
                this.logger.warn(`🧹 [SESSION OBSERVER] Detected session change, cleaning up old engines...`);
                this.logger.warn(`🧹 [SESSION OBSERVER] Old session: ${oldSessionId}`);
                this.logger.warn(`🧹 [SESSION OBSERVER] New session: ${newSessionId}`);
                
                // 异步清理旧engines，避免阻塞session变更流程
                this.cleanupSpecificEngine(oldSessionId).catch((error: Error) => {
                    this.logger.error(`❌ [SESSION OBSERVER] Engine cleanup failed: ${error.message}`, error);
                });
            }
        }
        
        // 更新当前会话ID跟踪
        this.currentSessionId = newSessionId;
        
        this.logger.info(`🔄 [SESSION OBSERVER] Current session ID updated to: ${newSessionId}`);
    }

    /**
     * 🚀 精确清理特定会话的engine，避免误清理当前使用的engine
     */
    private async cleanupSpecificEngine(sessionId: string): Promise<void> {
        this.logger.debug(`[CLEANUP] Starting cleanup for specific session: ${sessionId}`);
        this.logger.debug(`[CLEANUP] Registry size before cleanup: ${this._engineRegistry.size}`);
        
        const engine = this._engineRegistry.get(sessionId);
        if (engine) {
            this.logger.debug(`[CLEANUP] Found engine for session ${sessionId}, disposing...`);
            
            try {
                // 取消观察者订阅，释放资源
                engine.dispose();
                
                // 从registry中移除
                this._engineRegistry.delete(sessionId);
                
                this.logger.info(`✅ [CLEANUP] Successfully cleaned up engine for session: ${sessionId}`);
                this.logger.debug(`[CLEANUP] Registry size after cleanup: ${this._engineRegistry.size}`);
            } catch (error) {
                this.logger.error(`❌ [CLEANUP] Failed to dispose engine for session ${sessionId}: ${(error as Error).message}`, error as Error);
            }
        } else {
            this.logger.info(`ℹ️ [CLEANUP] No engine found for session ${sessionId}, no cleanup needed`);
        }
    }

    /**
     * 🚀 v5.0重构：获取参与者状态 - 架构感知版本
     */
    public async getStatus(): Promise<string> {
        try {
            const sessionContext = await this.getOrCreateSessionContext();
            const orchestratorStatus = await this.orchestrator.getSystemStatus();
            
            // 基础信息
            const baseInfo = [
                '=== SRS Chat Participant v5.0 Status ===',
                `Architecture Mode: ${this.useGlobalEngine ? 'Global Engine (v5.0)' : 'Legacy Session-based (v3.0)'}`,
                `Current Project: ${sessionContext.projectName || 'None'}`,
                `Base Directory: ${sessionContext.baseDir || 'None'}`,
                `Active Files: ${sessionContext.activeFiles.length}`,
                `Session ID: ${sessionContext.sessionContextId}`,
                `Session Version: ${sessionContext.metadata.version}`,
                `Orchestrator Status: ${orchestratorStatus.aiMode ? 'Active' : 'Inactive'}`,
                `Available Tools: ${orchestratorStatus.availableTools.length}`
            ];
            
            // 架构特定信息
            if (this.useGlobalEngine) {
                // 🌐 新架构状态
                const globalStatus = this.getGlobalEngineStatus();
                const engineInfo = [
                    '--- Global Engine Status ---',
                    `Global Engine: ${globalStatus.exists ? 'Active' : 'Inactive'}`,
                    `Engine State: ${globalStatus.state || 'None'}`,
                    `Last Activity: ${globalStatus.lastActivity ? new Date(globalStatus.lastActivity).toISOString() : 'Never'}`,
                    `Awaiting User: ${globalStatus.exists && SRSChatParticipant.globalEngine ? SRSChatParticipant.globalEngine.isAwaitingUser() : false}`,
                    `Legacy Registry Size: ${this._engineRegistry.size} (should be 0)`
                ];
                
                return [...baseInfo, ...engineInfo].join('\n');
            } else {
                // 📡 旧架构状态
                const sessionId = sessionContext.sessionContextId;
                const legacyInfo = [
                    '--- Legacy Session-based Engine Status ---',
                                    `Session Engine: ${this._engineRegistry.has(sessionId) ? 'Active' : 'Inactive'}`,
                `Engine State: ${this._engineRegistry.has(sessionId) ? this._engineRegistry.get(sessionId)?.getState().stage : 'None'}`,
                `Awaiting User: ${this._engineRegistry.has(sessionId) ? this._engineRegistry.get(sessionId)?.isAwaitingUser() : false}`,
                `Active Sessions: ${this._engineRegistry.size}`
                ];
                
                return [...baseInfo, ...legacyInfo].join('\n');
            }
        } catch (error) {
            return `Status Error: ${error}`;
        }
    }
    
    /**
     * 🚀 v5.0新增：全局引擎销毁方法
     * 
     * 用于插件关闭或需要完全重置时清理全局引擎
     */
    public static disposeGlobalEngine(): void {
        const logger = Logger.getInstance();
        
        if (SRSChatParticipant.globalEngine) {
            logger.warn(`🌐 [GLOBAL ENGINE] Disposing global engine at plugin shutdown`);
            
            try {
                const engineState = SRSChatParticipant.globalEngine.getState();
                logger.warn(`🌐 [GLOBAL ENGINE] Final state: stage=${engineState.stage}, task="${engineState.currentTask}"`);
                
                // 销毁引擎
                SRSChatParticipant.globalEngine.dispose();
                SRSChatParticipant.globalEngine = null;
                SRSChatParticipant.globalEngineLastActivity = 0;
                
                logger.info(`✅ [GLOBAL ENGINE] Global engine disposed successfully`);
            } catch (error) {
                logger.error(`❌ [GLOBAL ENGINE] Failed to dispose global engine: ${(error as Error).message}`);
            }
        } else {
            logger.warn(`⚠️ [GLOBAL ENGINE] No global engine to dispose`);
        }
    }
    
    /**
     * 🚀 v5.0新增：架构模式切换方法（用于测试和调试）
     */
    public toggleArchitectureMode(): boolean {
        // 注意：这个方法设计为只读，因为useGlobalEngine是readonly
        // 在实际使用中，架构模式在构造时确定
        this.logger.warn(`🔧 [ARCHITECTURE] Current mode: ${this.useGlobalEngine ? 'GLOBAL' : 'LEGACY'}`);
        this.logger.warn(`🔧 [ARCHITECTURE] Mode is readonly, cannot be changed at runtime`);
        
        return this.useGlobalEngine;
    }
}
