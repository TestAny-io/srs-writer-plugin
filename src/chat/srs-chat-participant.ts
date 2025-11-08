import * as vscode from 'vscode';
import { SessionContext, ISessionObserver } from '../types/session';
import { Logger } from '../utils/logger';
import { CHAT_PARTICIPANT_ID } from '../constants';
import { Orchestrator } from '../core/orchestrator';
import { SessionManager } from '../core/session-manager';
import { SRSAgentEngine } from '../core/srsAgentEngine';
import { toolExecutor } from '../core/toolExecutor';

/**
 * SRS聊天参与者 v6.0 - 全局引擎架构
 * 
 * 🚀 架构特性：
 * - 全局单例引擎：一个插件实例一个引擎
 * - 动态会话适配：引擎自动适应会话变更
 * - 状态记忆保持：跨交互保持执行状态
 * - 透明代理模式：完全委托给SRSAgentEngine
 */
export class SRSChatParticipant implements ISessionObserver {
    private logger = Logger.getInstance();
    
    // 核心依赖组件
    private orchestrator: Orchestrator;
    private sessionManager: SessionManager;
    
    // 🚀 全局单例引擎
    private static globalEngine: SRSAgentEngine | null = null;
    private static globalEngineLastActivity: number = 0;
    
    // 🚀 跟踪当前会话ID，用于检测会话变更
    private currentSessionId: string | null = null;
    
    private constructor() {
        this.logger.info('🚀 SRSChatParticipant v6.0 initialized - Global Engine Architecture');
        
        this.orchestrator = new Orchestrator();
        this.sessionManager = SessionManager.getInstance();
        
        // 🚀 订阅SessionManager的会话变更通知
        this.sessionManager.subscribe(this);
        
        // 🚀 异步初始化会话管理器
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
     * 处理聊天请求
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
            // 🚀 使用核心处理逻辑
            await this.processRequestCore(request.prompt, request.model, stream, token);

        } catch (error) {
            this.logger.error('聊天请求处理失败', error as Error);
            
            // 🎯 透传 VSCode LanguageModelError 的原始错误信息
            if (error instanceof vscode.LanguageModelError) {
                this.logger.error(`Language Model API Error - Code: ${error.code}, Message: ${error.message}`);
                
                stream.markdown(`❌ **AI模型服务错误**\n\n`);
                stream.markdown(`**错误代码**: \`${error.code || 'unknown'}\`\n\n`);
                stream.markdown(`**错误信息**: ${error.message}\n\n`);
                stream.markdown(`这是来自VSCode Language Model API的错误。请检查您的GitHub Copilot配置和订阅状态。\n\n`);
                stream.markdown(`💡 **建议**: 使用错误代码 \`${error.code}\` 搜索相关解决方案。\n\n`);
            } else {
                // 其他错误的通用处理
                const errorMessage = error instanceof Error ? error.message : '未知错误';
                
                stream.markdown(`❌ **处理请求时发生错误**\n\n`);
                stream.markdown(`**错误信息**: ${errorMessage}\n\n`);
                stream.markdown(`请稍后重试，或者换一种方式提问。\n\n`);
            }
        } finally {
            const duration = Date.now() - startTime;
            this.logger.info(`⏱️ 聊天请求处理完成，耗时: ${duration}ms`);
        }
    }

    /**
     * 核心请求处理逻辑 - v6.0全局引擎版本
     * 
     * 🚀 架构特性：
     * 1. 验证AI模型
     * 2. 获取会话上下文  
     * 3. 获取全局引擎实例
     * 4. 智能判断是新任务还是用户响应
     */
    private async processRequestCore(
        prompt: string,
        model: vscode.LanguageModelChat | undefined,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        // 检查用户选择的模型
        if (!model) {
            stream.markdown('⚠️ **未找到AI模型**\n\n请在Chat界面的下拉菜单中选择AI模型。');
            return;
        }
        
        stream.progress('🧠 AI 智能引擎启动中...');

        // 1. 获取会话上下文
        const sessionContext = await this.getOrCreateSessionContext();

        if (token.isCancellationRequested) { return; }

        // 2. 获取全局引擎实例
        const agentEngine = this.getOrCreateGlobalEngine(stream, model);

        if (token.isCancellationRequested) { return; }

        // 3. 🚀 智能判断是新任务还是用户响应
        const isAwaitingUser = agentEngine.isAwaitingUser();
        
        if (isAwaitingUser) {
            // 这是用户对等待中交互的响应
            this.logger.info(`📥 Processing user response`);
            await agentEngine.handleUserResponse(prompt);
        } else {
            // 这是新任务，开始执行
            this.logger.info(`🚀 Starting new task`);
            await agentEngine.executeTask(prompt);
        }
    }

    /**
     * 🚀 全局引擎管理方法
     * 
     * 关键特性：
     * - 单一全局引擎实例，生命周期绑定到插件
     * - 动态获取会话上下文，不绑定特定会话
     * - 避免会话切换导致的执行中断
     */
    private getOrCreateGlobalEngine(
        stream: vscode.ChatResponseStream,
        model: vscode.LanguageModelChat
    ): SRSAgentEngine {
        // 更新最后活动时间
        SRSChatParticipant.globalEngineLastActivity = Date.now();
        
        if (!SRSChatParticipant.globalEngine) {
            this.logger.info(`🌐 Creating new global engine instance`);
            
            // 创建全局引擎实例
            SRSChatParticipant.globalEngine = new SRSAgentEngine(stream, model);
            SRSChatParticipant.globalEngine.setDependencies(this.orchestrator, toolExecutor);
            
            this.logger.info(`🌐 Global engine created successfully`);
        } else {
            // 更新当前交互的参数
            SRSChatParticipant.globalEngine.updateStreamAndModel(stream, model);
            this.logger.info(`♻️ Reusing global engine with updated stream/model`);
        }
        
        return SRSChatParticipant.globalEngine;
    }
    
    /**
     * 🚀 检查全局引擎状态
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
     * 🚀 生成稳定的会话ID
     * 
     * 基于sessionContextId生成稳定的会话标识符
     */
    private getSessionId(sessionContext: SessionContext): string {
        return sessionContext.sessionContextId;
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
            
            // 创建新的SessionContext
            return await this.sessionManager.createNewSession();
        } catch (error) {
            this.logger.error('Failed to get current session, creating new one', error as Error);
            // 创建新的SessionContext作为fallback
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
     * 🚀 刷新全局引擎的会话上下文
     * 
     * 在项目切换或会话变更时调用，让全局引擎适应新的会话上下文
     */
    private async refreshGlobalEngineSession(): Promise<void> {
        if (SRSChatParticipant.globalEngine) {
            this.logger.info('🔄 Refreshing global engine session context');
            // 全局引擎会在下次任务执行时自动获取最新的会话上下文
            // 这里不需要显式传递，因为引擎使用动态会话获取
        }
    }

    /**
     * 🚀 v6.0：会话观察者 - 全局引擎适配
     * 
     * 关键改进：
     * - 全局引擎在会话切换时自动适应新上下文
     * - 不中断正在执行的任务
     * - 智能检测会话变更
     */
    public onSessionChanged(newContext: SessionContext | null): void {
        const newSessionId = newContext?.sessionContextId || null;
        const oldSessionId = this.currentSessionId;
        
        this.logger.info(`🔄 Session changed: ${oldSessionId} → ${newSessionId}`);
        this.logger.info(`🌐 Global engine will dynamically adapt to new session context`);
        
        // 🚀 通知全局引擎会话已变更
        if (SRSChatParticipant.globalEngine && oldSessionId !== newSessionId) {
            SRSChatParticipant.globalEngine.onSessionContextChanged(newContext);
        }
        
        // 更新当前会话ID跟踪
        this.currentSessionId = newSessionId;
    }

    /**
     * 🚀 v6.0：检查是否有Plan正在执行
     * 
     * 用于项目切换前的状态检查，防止中断正在执行的计划
     */
    public isPlanExecuting(): boolean {
        if (!SRSChatParticipant.globalEngine) {
            return false;
        }
        
        const state = SRSChatParticipant.globalEngine.getState();
        // 检查是否处于执行状态：planning, executing, 或 awaiting_user（用户交互中）
        return state.stage === 'planning' || 
               state.stage === 'executing' || 
               state.stage === 'awaiting_user';
    }

    /**
     * 🚀 v6.0：获取当前执行计划的描述信息
     * 
     * 用于在切换确认弹窗中显示给用户
     */
    public getCurrentPlanDescription(): string | null {
        if (!SRSChatParticipant.globalEngine || !this.isPlanExecuting()) {
            return null;
        }
        
        const state = SRSChatParticipant.globalEngine.getState();
        if (state.currentTask) {
            return `正在执行任务: "${state.currentTask}" (阶段: ${state.stage})`;
        }
        
        return `引擎正在执行 (阶段: ${state.stage})`;
    }

    /**
     * 🚀 v6.0：取消当前正在执行的Plan
     * 
     * 用于项目切换时中止正在执行的计划
     * 等待specialist真正停止执行，而不仅仅是发送取消信号
     */
    public async cancelCurrentPlan(): Promise<void> {
        if (!SRSChatParticipant.globalEngine) {
            this.logger.info('ℹ️ No global engine to cancel');
            return;
        }
        
        if (!this.isPlanExecuting()) {
            this.logger.info('ℹ️ No plan currently executing');
            return;
        }
        
        this.logger.info('🛑 Sending cancellation signal to current plan...');
        await SRSChatParticipant.globalEngine.cancelCurrentExecution();
        
        // 🚀 新增：等待specialist真正停止执行
        this.logger.info('⏳ Waiting for specialist to actually stop...');
        let waitCount = 0;
        const maxWaitTime = 30000; // 最多等待30秒
        const pollInterval = 100; // 每100ms检查一次（更频繁）
        const maxPolls = maxWaitTime / pollInterval;
        
        while (waitCount < maxPolls) {
            const isStillExecuting = this.isPlanExecuting();
            const engineState = SRSChatParticipant.globalEngine?.getState();
            
            // 详细的状态日志
            if (waitCount % 10 === 0) { // 每秒记录一次
                this.logger.info(`⏳ Waiting... (${(waitCount * pollInterval / 1000).toFixed(1)}s) - ` +
                    `isPlanExecuting: ${isStillExecuting}, ` +
                    `engineStage: ${engineState?.stage}, ` +
                    `cancelled: ${engineState?.cancelled}`);
            }
            
            // 如果真的停止了，break
            if (!isStillExecuting) {
                this.logger.info('✅ Plan execution confirmed stopped');
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            waitCount++;
        }
        
        if (this.isPlanExecuting()) {
            this.logger.warn('⚠️ Plan did not stop within timeout period, proceeding anyway');
            this.logger.warn(`⚠️ Final state: stage=${SRSChatParticipant.globalEngine?.getState()?.stage}, cancelled=${SRSChatParticipant.globalEngine?.getState()?.cancelled}`);
        } else {
            this.logger.info('✅ Plan execution fully stopped');
        }
        
        this.logger.info('✅ Plan cancellation process completed');
    }

    /**
     * 🚀 v6.0：清理项目上下文
     * 
     * 在项目切换后清理Orchestrator的缓存状态，防止上下文污染
     * 必须在archive完成后调用
     */
    public clearProjectContext(): void {
        this.logger.info('🧹 Clearing project context for clean project switch...');
        
        // 清理Orchestrator的上下文缓存
        this.orchestrator.clearProjectContext();
        
        this.logger.info('✅ Project context cleared successfully');
    }

    /**
     * 🚀 获取参与者状态 - v6.0全局引擎版本
     */
    public async getStatus(): Promise<string> {
        try {
            const sessionContext = await this.getOrCreateSessionContext();
            const orchestratorStatus = await this.orchestrator.getSystemStatus();
            
            // 基础信息
            const baseInfo = [
                '=== SRS Chat Participant v6.0 Status ===',
                'Architecture Mode: Global Engine (v6.0)',
                `Current Project: ${sessionContext.projectName || 'None'}`,
                `Base Directory: ${sessionContext.baseDir || 'None'}`,
                `Active Files: ${sessionContext.activeFiles?.length || 0}`,
                `Session ID: ${sessionContext.sessionContextId}`,
                `Session Version: ${sessionContext.metadata.version}`,
                `Orchestrator Status: ${orchestratorStatus.aiMode ? 'Active' : 'Inactive'}`,
                `Available Tools: ${orchestratorStatus.availableTools?.length || 0}`
            ];
            
            // 全局引擎状态
                const globalStatus = this.getGlobalEngineStatus();
                const engineInfo = [
                    '--- Global Engine Status ---',
                    `Global Engine: ${globalStatus.exists ? 'Active' : 'Inactive'}`,
                    `Engine State: ${globalStatus.state || 'None'}`,
                    `Last Activity: ${globalStatus.lastActivity ? new Date(globalStatus.lastActivity).toISOString() : 'Never'}`,
                    `Awaiting User: ${globalStatus.exists && SRSChatParticipant.globalEngine ? SRSChatParticipant.globalEngine.isAwaitingUser() : false}`,
                `Plan Executing: ${this.isPlanExecuting() ? 'Yes' : 'No'}`
                ];
                
                return [...baseInfo, ...engineInfo].join('\n');
        } catch (error) {
            return `Status Error: ${error}`;
        }
    }
    
    /**
     * 🚀 全局引擎销毁方法
     * 
     * 用于插件关闭或需要完全重置时清理全局引擎
     */
    public static disposeGlobalEngine(): void {
        const logger = Logger.getInstance();
        
        if (SRSChatParticipant.globalEngine) {
            logger.info(`🌐 Disposing global engine at plugin shutdown`);
            
            try {
                const engineState = SRSChatParticipant.globalEngine.getState();
                logger.info(`🌐 Final engine state: stage=${engineState.stage}, task="${engineState.currentTask}"`);
                
                // 销毁引擎
                SRSChatParticipant.globalEngine.dispose();
                SRSChatParticipant.globalEngine = null;
                SRSChatParticipant.globalEngineLastActivity = 0;
                
                logger.info(`✅ Global engine disposed successfully`);
            } catch (error) {
                logger.error(`❌ Failed to dispose global engine: ${(error as Error).message}`);
            }
        } else {
            logger.info(`ℹ️ No global engine to dispose`);
        }
    }
}