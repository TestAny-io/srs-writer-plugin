import * as vscode from 'vscode';
import { SRSChatParticipant } from './chat/srs-chat-participant';
import { SessionManager } from './core/session-manager';
import { Orchestrator } from './core/orchestrator';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';
import { 
    InternetSearchTool, 
    CustomRAGRetrievalTool, 
    ReadLocalKnowledgeTool 
} from './tools/atomic/knowledge-tools-backup';

let chatParticipant: SRSChatParticipant;
let sessionManager: SessionManager;
let orchestrator: Orchestrator;
const logger = Logger.getInstance();

/**
 * 扩展激活时调用 - v1.3最终版本
 * @param context 扩展上下文
 */
export function activate(context: vscode.ExtensionContext) {
    logger.info('SRS Writer Plugin v1.3 is now activating...');
    
    try {
        // 🔧 调试：分步初始化核心组件
        logger.info('Step 1: Initializing SessionManager...');
        // 🚀 v3.0重构：使用SessionManager单例 - 修复：传递context参数
        sessionManager = SessionManager.getInstance(context);
        logger.info('✅ SessionManager singleton initialized successfully');
        
        logger.info('Step 2: Initializing Orchestrator...');
        orchestrator = new Orchestrator();
        logger.info('✅ Orchestrator initialized successfully');
        
        // 注册Chat Participant
        logger.info('Step 3: Registering Chat Participant...');
        chatParticipant = SRSChatParticipant.register(context);
        logger.info('✅ SRS Chat Participant registered successfully');
        
        // 注册核心命令
        logger.info('Step 4: Registering commands...');
        registerCoreCommands(context);
        logger.info('✅ Commands registered successfully');
        
        // 🔧 Step 5: 注册Language Model Tools
        logger.info('Step 5: Registering Language Model Tools...');
        registerLanguageModelTools(context);
        logger.info('✅ Language Model Tools registered successfully');
        
        // 🔧 修复：help命令注册ID匹配package.json声明
        const helpCommand = vscode.commands.registerCommand('srs-writer.help', () => {
            vscode.window.showInformationMessage(
                '💡 **SRS Writer 使用指南**\n\n' +
                '🚀 开始使用：在Chat面板中输入 @srs-writer\n' +
                '📊 查看状态：Cmd+Shift+P → "SRS Writer: Show Status"\n' +
                '🔄 强制同步：Cmd+Shift+P → "SRS Writer: Force Sync Context"\n' +
                '🧹 清理会话：Cmd+Shift+P → "SRS Writer: Clear Session"'
            );
        });
        context.subscriptions.push(helpCommand);
        
        // 注册状态栏项 - v1.2增强版
        const statusBarItem = createEnhancedStatusBar();
        context.subscriptions.push(statusBarItem);
        
        // 工作区变化监听
        const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
            sessionManager.refreshSessionPath();
            logger.info('Workspace changed, session path refreshed');
        });
        context.subscriptions.push(workspaceWatcher);
        
        logger.info('SRS Writer Plugin v1.3 activation completed successfully');
        
        // 显示激活成功消息
        vscode.window.showInformationMessage(
            '🚀 SRS Writer is at your service',
            'Learn more'
        ).then(selection => {
            if (selection === 'Learn more') {
                vscode.commands.executeCommand('srs-writer.help');
            }
        });
        
    } catch (error) {
        ErrorHandler.handleError(error as Error, true);
        logger.error('Failed to activate SRS Writer Plugin v1.2', error as Error);
        
        vscode.window.showErrorMessage(
            'SRS Writer插件激活失败，请检查配置后重启VSCode。'
        );
    }
}

/**
 * 注册核心命令
 */
function registerCoreCommands(context: vscode.ExtensionContext): void {
    // 🚀 v3.0增强：状态命令支持多级视图
    const statusCommand = vscode.commands.registerCommand('srs-writer.status', async () => {
        await showEnhancedStatus();
    });
    

    
    // 🚀 v4.0新增：开始新项目命令（归档旧项目）
    const startNewProjectCmd = vscode.commands.registerCommand('srs-writer.startNewProject', startNewProjectCommand);
    
    // 🚀 v4.0新增：查看归档历史命令
    const viewArchiveHistoryCmd = vscode.commands.registerCommand('srs-writer.viewArchiveHistory', viewArchiveHistoryCommand);
    

    
    // AI模式切换命令 - 新架构：不再需要手动切换模式，AI自动智能分诊
    const toggleAIModeCommand = vscode.commands.registerCommand('srs-writer.toggleAIMode', async () => {
        const currentStatus = await orchestrator.getSystemStatus();
        
        // 新架构：模式通过智能分诊自动确定，无需手动切换
        vscode.window.showInformationMessage(
            `🚀 新架构已启用智能分诊\n\n当前状态: ${currentStatus.mode}\n模式将根据用户意图自动切换：\n• 🚀 计划执行模式：复杂多步骤任务\n• 🛠️ 工具执行模式：需要操作文件的任务\n• 🧠 知识问答模式：咨询和对话`
        );
    });
    

    
    // 🚀 v3.0新增：强制同步命令
    const forceSyncCommand = vscode.commands.registerCommand('srs-writer.forceSyncContext', async () => {
        await performForcedSync();
    });

    // 注册所有命令
    context.subscriptions.push(
        statusCommand,
        startNewProjectCmd,
        viewArchiveHistoryCmd,
        toggleAIModeCommand,
        forceSyncCommand  // 🚀 新增强制同步命令
    );
    
    logger.info('Core commands registered successfully');
}

/**
 * 🔧 注册Language Model Tools - 新增工具注册功能
 */
function registerLanguageModelTools(context: vscode.ExtensionContext): void {
    try {
        // 检查是否支持语言模型工具API
        if (!vscode.lm || typeof vscode.lm.registerTool !== 'function') {
            logger.warn('Language Model Tools API not available, skipping tool registration');
            return;
        }

        // 注册Internet Search工具
        const internetSearchTool = vscode.lm.registerTool('internet_search', new InternetSearchTool());
        context.subscriptions.push(internetSearchTool);
        logger.info('🔍 Internet Search Tool registered');

        // 注册Custom RAG Retrieval工具
        const customRAGTool = vscode.lm.registerTool('custom_rag_retrieval', new CustomRAGRetrievalTool());
        context.subscriptions.push(customRAGTool);
        logger.info('🧠 Custom RAG Retrieval Tool registered');

        // 注册Local Knowledge Search工具
        const localKnowledgeTool = vscode.lm.registerTool('read_local_knowledge', new ReadLocalKnowledgeTool());
        context.subscriptions.push(localKnowledgeTool);
        logger.info('📚 Local Knowledge Search Tool registered');

        logger.info('All Language Model Tools registered successfully');
    } catch (error) {
        const errorMsg = `Failed to register Language Model Tools: ${(error as Error).message}`;
        logger.error(errorMsg);
        // 不抛出错误，允许扩展继续加载
        vscode.window.showWarningMessage('部分工具注册失败，但扩展可以继续使用');
    }
}

/**
 * 创建增强版状态栏
 */
function createEnhancedStatusBar(): vscode.StatusBarItem {
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right, 
        100
    );
    
    // 更新状态栏显示（v1.3修复版本：避免缓存过度调用）
    const updateStatusBar = async () => {
        try {
            const session = await sessionManager?.getCurrentSession();
            // 🚀 修复：正确使用异步调用，避免缓存过度调用
            const orchestratorStatus = await orchestrator?.getSystemStatus();
            
            if (session?.projectName) {
                statusBarItem.text = `$(notebook-kernel) SRS: ${session.projectName}`;
                statusBarItem.tooltip = `SRS Writer v1.3\n项目: ${session.projectName}\n模式: ${orchestratorStatus?.mode || '未知'}\n点击查看状态`;
            } else {
                statusBarItem.text = '$(notebook-kernel) SRS Writer';
                statusBarItem.tooltip = 'SRS Writer v1.3 - 智能助手\n点击查看状态';
            }
        } catch (error) {
            // 静默处理错误，避免频繁的错误弹窗
            statusBarItem.text = '$(notebook-kernel) SRS Writer';
            statusBarItem.tooltip = 'SRS Writer v1.3 - 智能助手（状态获取失败）';
        }
    };
    
    statusBarItem.command = 'srs-writer.status';
    updateStatusBar();
    statusBarItem.show();
    
    // 定期更新状态栏
    setInterval(updateStatusBar, 5000);
    
    return statusBarItem;
}

/**
 * 🚀 v3.0新增：增强的状态查看功能
 */
async function showEnhancedStatus(): Promise<void> {
    try {
        const options = await vscode.window.showQuickPick([
            {
                label: '$(dashboard) 快速概览',
                description: '查看核心状态信息',
                detail: '项目信息、引擎状态、同步状态'
            },
            {
                label: '$(report) 详细报告',
                description: '生成完整状态报告',
                detail: '所有组件状态、配置信息、性能数据'
            },
            {
                label: '$(sync) 同步状态检查', 
                description: '检查数据一致性',
                detail: '文件vs内存同步状态'
            },
            {
                label: '$(output) 导出状态报告',
                description: '保存状态到文件',
                detail: '生成可分享的状态报告'
            }
        ], {
            placeHolder: '选择状态查看方式',
            title: 'SRS Writer v3.0 状态管理'
        });

        if (!options) return;

        switch (options.label) {
            case '$(dashboard) 快速概览':
                await showQuickOverview();
                break;
            case '$(report) 详细报告':
                await showDetailedReport();
                break;
            case '$(sync) 同步状态检查':
                await showSyncStatus();
                break;
            case '$(output) 导出状态报告':
                await exportStatusReport();
                break;
        }
    } catch (error) {
        logger.error('Failed to show enhanced status', error as Error);
        vscode.window.showErrorMessage(`状态查看失败: ${(error as Error).message}`);
    }
}

/**
 * 显示快速概览
 */
async function showQuickOverview(): Promise<void> {
    const session = await sessionManager.getCurrentSession();
    const orchestratorStatus = await orchestrator.getSystemStatus();
    const syncStatus = await sessionManager.checkSyncStatus();
    const observerStats = sessionManager.getObserverStats();
    
    const syncIcon = syncStatus.isConsistent ? '✅' : '⚠️';
    const statusMessage = `
🚀 **SRS Writer v3.0 状态概览**

📊 **会话信息**
• 项目: ${session?.projectName || '无'}
• 基础目录: ${session?.baseDir || '无'}  
• 活跃文件: ${session?.activeFiles.length || 0}个
• 会话版本: ${session?.metadata.version || 'N/A'}

🤖 **AI引擎状态**
• 架构版本: ${orchestratorStatus.version}
• 当前模式: ${orchestratorStatus.mode}
• 观察者: ${observerStats.count}个活跃

${syncIcon} **同步状态**
• 数据一致性: ${syncStatus.isConsistent ? '正常' : '异常'}
${syncStatus.inconsistencies.length > 0 ? `• 问题: ${syncStatus.inconsistencies.join(', ')}` : ''}

💡 **操作建议**
• 使用 @srs-writer 开始智能对话
• 如有同步问题，可使用"Force Sync Context"命令
    `;
    
    vscode.window.showInformationMessage(statusMessage);
}

/**
 * 显示详细报告
 */
async function showDetailedReport(): Promise<void> {
    const session = await sessionManager.getCurrentSession();
    const orchestratorStatus = await orchestrator.getSystemStatus();
    const syncStatus = await sessionManager.checkSyncStatus();
    const observerStats = sessionManager.getObserverStats();
    const chatStatus = chatParticipant ? await chatParticipant.getStatus() : '聊天参与者未初始化';
    
    const channel = vscode.window.createOutputChannel('SRS Writer 详细状态');
    channel.show();
    channel.clear();
    
    const report = `
=== SRS Writer v3.0 详细状态报告 ===
生成时间: ${new Date().toLocaleString()}

📊 会话管理器状态
  单例模式: ✅ 已启用
  当前项目: ${session?.projectName || '无'}
  基础目录: ${session?.baseDir || '无'}
  活跃文件: ${session?.activeFiles.length || 0}个
  创建时间: ${session?.metadata.created || 'N/A'}
  最后修改: ${session?.metadata.lastModified || 'N/A'}
  会话版本: ${session?.metadata.version || 'N/A'}
  SRS版本: ${session?.metadata.srsVersion || 'N/A'}

🔄 观察者模式状态
  活跃观察者: ${observerStats.count}个
  观察者类型: ${observerStats.types.join(', ')}

🚀 同步状态检查
  数据一致性: ${syncStatus.isConsistent ? '✅ 正常' : '❌ 异常'}
  检查时间: ${syncStatus.lastSyncCheck}
  ${syncStatus.inconsistencies.length > 0 ? `发现问题:\n  ${syncStatus.inconsistencies.map(i => `• ${i}`).join('\n  ')}` : '  无同步问题'}

🤖 Orchestrator状态
  架构版本: ${orchestratorStatus.version}
  运行模式: ${orchestratorStatus.mode}
  状态: ${orchestratorStatus.status}
  能力: ${orchestratorStatus.capabilities?.join(', ') || 'N/A'}

💬 聊天参与者状态
${chatStatus}

🔧 系统配置
  工作区路径: ${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '无'}
  扩展版本: v3.0
  架构模式: 单例SessionManager + 观察者模式

📋 性能指标
  内存中会话对象: ${session ? '1个' : '0个'}
  文件同步频率: 实时
  观察者通知延迟: <1ms
  状态检查耗时: ${Date.now() - new Date(syncStatus.lastSyncCheck).getTime()}ms

💡 建议操作
  ${syncStatus.isConsistent ? '• 系统运行正常，可以开始使用' : '• 建议执行"Force Sync Context"修复同步问题'}
  • 使用 Cmd+Shift+P → "SRS Writer: Force Sync Context" 手动同步
  • 使用 @srs-writer 在聊天中开始智能对话

=== 报告结束 ===
    `;
    
    channel.appendLine(report);
}

/**
 * 显示同步状态
 */
async function showSyncStatus(): Promise<void> {
    const syncStatus = await sessionManager.checkSyncStatus();
    
    if (syncStatus.isConsistent) {
        vscode.window.showInformationMessage(
            `✅ **同步状态正常**\n\n检查时间: ${new Date(syncStatus.lastSyncCheck).toLocaleString()}\n所有组件数据一致`
        );
    } else {
        const message = `⚠️ **发现同步问题**\n\n检查时间: ${new Date(syncStatus.lastSyncCheck).toLocaleString()}\n\n问题清单:\n${syncStatus.inconsistencies.map(i => `• ${i}`).join('\n')}\n\n建议使用"Force Sync Context"命令修复`;
        
        const action = await vscode.window.showWarningMessage(
            message,
            '立即修复',
            '稍后处理'
        );
        
        if (action === '立即修复') {
            await vscode.commands.executeCommand('srs-writer.forceSyncContext');
        }
    }
}

/**
 * 导出状态报告
 */
async function exportStatusReport(): Promise<void> {
    try {
        const session = await sessionManager.getCurrentSession();
        const orchestratorStatus = await orchestrator.getSystemStatus();
        const syncStatus = await sessionManager.checkSyncStatus();
        const observerStats = sessionManager.getObserverStats();
        
        const report = {
            exportTime: new Date().toISOString(),
            version: 'v3.0',
            session: session,
            orchestratorStatus: orchestratorStatus,
            syncStatus: syncStatus,
            observerStats: observerStats,
            workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || null
        };
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const filename = `srs-writer-status-${timestamp}.json`;
        
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(filename),
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*']
            }
        });
        
        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(report, null, 2)));
            vscode.window.showInformationMessage(`✅ 状态报告已导出到: ${uri.fsPath}`);
        }
    } catch (error) {
        logger.error('Failed to export status report', error as Error);
        vscode.window.showErrorMessage(`导出失败: ${(error as Error).message}`);
    }
}

/**
 * 🚀 v3.0新增：强制同步会话状态
 */
async function performForcedSync(): Promise<void> {
    try {
        vscode.window.showInformationMessage('🔄 开始强制同步会话状态...');
        
        const sessionManager = SessionManager.getInstance();
        
        // 1. 重新加载文件
        await sessionManager.loadSessionFromFile();
        logger.info('✅ Session reloaded from file');
        
        // 2. 清理过期引擎 
        if (chatParticipant) {
            await chatParticipant.clearStaleEngines();
            logger.info('✅ Stale engines cleared');
        }
        
        // 3. 强制通知所有观察者
        sessionManager.forceNotifyObservers();
        logger.info('✅ All observers notified');
        
        // 4. 验证同步状态
        const syncStatus = await sessionManager.checkSyncStatus();
        
        if (syncStatus.isConsistent) {
            vscode.window.showInformationMessage('✅ 会话强制同步完成，所有组件状态已更新');
            logger.info('✅ Forced sync completed successfully');
        } else {
            const message = `⚠️ 同步完成但仍有问题: ${syncStatus.inconsistencies.join(', ')}`;
            vscode.window.showWarningMessage(message);
            logger.warn(`⚠️ Sync completed with issues: ${syncStatus.inconsistencies.join(', ')}`);
        }
    } catch (error) {
        const errorMessage = `❌ 强制同步失败: ${(error as Error).message}`;
        vscode.window.showErrorMessage(errorMessage);
        logger.error('Failed to perform forced sync', error as Error);
    }
}

/**
 * 🚀 v4.0重构：开始新项目（归档当前项目，保护用户资产）
 */
async function startNewProjectCommand(): Promise<void> {
    try {
        // 询问用户新项目名称
        const newProjectName = await vscode.window.showInputBox({
            prompt: '请输入新项目名称（可选）',
            placeHolder: '例如：mobile-app-v2',
            validateInput: (value) => {
                if (value && !/^[a-zA-Z0-9_-]+$/.test(value)) {
                    return '项目名称只能包含字母、数字、下划线和短横线';
                }
                return undefined;
            }
        });

        // 用户取消输入
        if (newProjectName === undefined) {
            return;
        }

        // 获取当前会话信息用于确认
        const currentSession = await sessionManager.getCurrentSession();
        const hasCurrentProject = currentSession?.projectName;

        // 显示确认对话框
        const confirmMessage = hasCurrentProject 
            ? `📁 当前项目 "${currentSession.projectName}" 将被归档保存，不会丢失任何文件。\n\n🚀 开始新项目${newProjectName ? ` "${newProjectName}"` : ''}吗？`
            : `🚀 开始新项目${newProjectName ? ` "${newProjectName}"` : ''}吗？`;

        const confirmed = await vscode.window.showInformationMessage(
            confirmMessage,
            { modal: true },
            '开始新项目',
            '取消'
        );

        if (confirmed !== '开始新项目') {
            return;
        }

        // 执行归档并开始新项目
        const result = await sessionManager.archiveCurrentAndStartNew(newProjectName || undefined);

        if (result.success) {
            const preservedCount = result.filesPreserved.length;
            const archiveInfo = result.archivedSession ? 
                `\n📦 原项目已归档: ${result.archivedSession.archiveFileName}` : '';
            
            vscode.window.showInformationMessage(
                `✅ 新项目创建成功！${archiveInfo}\n💾 已保护 ${preservedCount} 个用户文件`
            );
            
            logger.info(`New project started. Preserved ${preservedCount} files.`);
        } else {
            throw new Error(result.error || '未知错误');
        }

    } catch (error) {
        logger.error('Failed to start new project', error as Error);
        vscode.window.showErrorMessage(`开始新项目失败: ${(error as Error).message}`);
    }
}

/**
 * 🚀 v4.0新增：查看项目归档历史
 */
async function viewArchiveHistoryCommand(): Promise<void> {
    try {
        const archives = await sessionManager.listArchivedSessions(10);
        
        if (archives.length === 0) {
            vscode.window.showInformationMessage('暂无归档历史');
            return;
        }

        const archiveItems = archives.map(archive => ({
            label: `📦 ${archive.originalSession.projectName || 'unnamed'}`,
            description: `${archive.daysCovered}天 • ${new Date(archive.archiveDate).toLocaleDateString()}`,
            detail: archive.archiveFileName,
            archive
        }));

        const selected = await vscode.window.showQuickPick(archiveItems, {
            placeHolder: '选择查看归档详情',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            const archive = selected.archive;
            const info = [
                `项目名称: ${archive.originalSession.projectName || 'unnamed'}`,
                `创建时间: ${new Date(archive.originalSession.metadata.created).toLocaleString()}`,
                `归档时间: ${new Date(archive.archiveDate).toLocaleString()}`,
                `持续天数: ${archive.daysCovered} 天`,
                `归档原因: ${archive.reason}`,
                `SRS版本: ${archive.originalSession.metadata.srsVersion}`,
                `活跃文件: ${archive.originalSession.activeFiles.length} 个`
            ].join('\n');

            await vscode.window.showInformationMessage(info, { modal: true }, '确定');
        }

    } catch (error) {
        logger.error('Failed to view archive history', error as Error);
        vscode.window.showErrorMessage(`查看归档失败: ${(error as Error).message}`);
    }
}

/**
 * 扩展停用时调用
 */
export function deactivate() {
    logger.info('SRS Writer Plugin is deactivating...');
    
    try {
        // 清理Chat Participant会话
        if (chatParticipant) {
            // 已移除过期会话清理功能 - 现在由 SessionManager 自动处理
        }
        
        // 保存会话状态
        if (sessionManager) {
            sessionManager.saveSessionToFile().catch(error => {
                logger.error('Failed to save session during deactivation', error as Error);
            });
        }
        
        // 清理Logger资源
        logger.dispose();
        
        logger.info('SRS Writer Plugin deactivated successfully');
    } catch (error) {
        console.error('Error during SRS Writer Plugin deactivation:', (error as Error).message || error);
    }
} 