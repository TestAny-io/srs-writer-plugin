import * as vscode from 'vscode';
import { SessionContext } from '../types/session';
import { Logger } from '../utils/logger';
import { CHAT_PARTICIPANT_ID } from '../constants';
import { Orchestrator } from '../core/orchestrator';
import { SessionManager } from '../core/session-manager';

/**
 * SRS聊天参与者 v2.0 - AI智能工具代理架构
 * 
 * 架构原则：
 * - 专注职责：只负责UI交互和结果渲染
 * - 轻量化：移除所有业务逻辑，完全委托给Orchestrator
 * - 智能桥梁：VSCode Chat UI与Orchestrator之间的完美适配器
 */
export class SRSChatParticipant {
    private logger = Logger.getInstance();
    
    // 只有两个核心依赖：Orchestrator和SessionManager
    private orchestrator: Orchestrator;
    private sessionManager: SessionManager;
    
    constructor() {
        this.orchestrator = new Orchestrator();
        this.sessionManager = new SessionManager();
        
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
     * 核心请求处理逻辑 - v2.0提炼版本
     * 
     * 职责：
     * 1. 验证AI模型
     * 2. 获取会话上下文  
     * 3. 委托Orchestrator处理
     * 4. 渲染结构化结果
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
        
        stream.progress('🧠 AI 代理正在思考...');
        
        // 1. 获取会话上下文
        const sessionContext = await this.getOrCreateSessionContext();

        if (token.isCancellationRequested) { return; }

        // 2. 将所有工作委托给Orchestrator
        const orchestratorResponse = await this.orchestrator.processUserInput(
            prompt,
            sessionContext,
            model
        );

        if (token.isCancellationRequested) { return; }

        // 3. 渲染Orchestrator返回的结构化结果
        this.renderOrchestratorResult(orchestratorResponse.result, stream);
    }

    /**
     * 渲染Orchestrator结构化结果 - v2.0新功能
     * 
     * 将Orchestrator返回的丰富信息优雅地展示给用户
     */
    private renderOrchestratorResult(result: any, stream: vscode.ChatResponseStream): void {
        if (!result) {
            stream.markdown('未能生成有效响应。');
            return;
        }

        // 渲染总结
        if (result.summary) {
            stream.markdown(`### 🤖 AI 代理工作总结\n\n${result.summary}\n\n`);
        }

        // 如果有最终答案，优先展示
        if (result.finalAnswer) {
            stream.markdown(`### ✅ 任务完成\n\n${result.finalAnswer.summary}\n\n`);
            
            if (result.finalAnswer.achievements && result.finalAnswer.achievements.length > 0) {
                stream.markdown('**完成的工作：**\n');
                result.finalAnswer.achievements.forEach((achievement: string, index: number) => {
                    stream.markdown(`${index + 1}. ${achievement}\n`);
                });
                stream.markdown('\n');
            }
            
            if (result.finalAnswer.nextSteps && result.finalAnswer.nextSteps.length > 0) {
                stream.markdown('**建议的后续步骤：**\n');
                result.finalAnswer.nextSteps.forEach((step: string, index: number) => {
                    stream.markdown(`${index + 1}. ${step}\n`);
                });
                stream.markdown('\n');
            }
        }

        // 渲染元数据
        stream.markdown('---');
        const details = [
            `**模式**: ${result.mode || '未知'}`,
            `**迭代次数**: ${result.iterations || 'N/A'}`,
            `**执行工具总数**: ${result.totalToolsExecuted || 0}`,
            `**成功/失败**: ${result.successful || 0} / ${result.failed || 0}`
        ];
        stream.markdown(details.join(' | '));
        stream.markdown('\n\n');

        // 如果有详细的工具执行日志，选择性展示
        if (result.details && result.details.length > 0) {
            const hasFailures = result.details.some((toolResult: any) => !toolResult.success);
            
            if (hasFailures) {
                // 只有在有失败时才显示详细日志
                let log = '#### 详细执行日志\n\n';
                const failedTools = result.details.filter((toolResult: any) => !toolResult.success);
                
                failedTools.forEach((toolResult: any, index: number) => {
                    log += `❌ **${toolResult.toolName}** 执行失败\n`;
                    if (toolResult.error) {
                        log += `   - **错误**: ${toolResult.error}\n`;
                    }
                });
                stream.markdown(log);
            }
        }
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
            const orchestratorStatus = this.orchestrator.getStatus();
            
            return [
                '=== SRS Chat Participant v2.0 Status ===',
                `Current Project: ${sessionContext.projectName || 'None'}`,
                `Base Directory: ${sessionContext.baseDir || 'None'}`,
                `Active Files: ${sessionContext.activeFiles.length}`,
                `Orchestrator Status: ${orchestratorStatus.aiMode ? 'Active' : 'Inactive'}`,
                `Available Tools: ${orchestratorStatus.availableTools.length}`,
                `Session Version: ${sessionContext.metadata.version}`
            ].join('\n');
        } catch (error) {
            return `Status Error: ${error}`;
        }
    }
}
