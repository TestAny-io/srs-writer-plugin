import * as vscode from 'vscode';
import { SRSChatParticipant } from './chat/srs-chat-participant';
import { SessionManager } from './core/session-manager';
import { Orchestrator } from './core/orchestrator';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';
import { COMMANDS } from './constants';

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
        // 初始化核心组件
        sessionManager = new SessionManager();
        orchestrator = new Orchestrator();
        
        // 注册Chat Participant
        chatParticipant = SRSChatParticipant.register(context);
        logger.info('SRS Chat Participant registered successfully');
        
        // 注册v1.2新增命令
        registerV13Commands(context);
        
        // 注册测试命令 (包含在v1.2命令中，无需单独注册)
        // TestCommands.register(context);
        logger.info('Commands registered successfully');
        
        // 注册传统帮助命令
        const helpCommand = vscode.commands.registerCommand(COMMANDS.GENERATE_SRS, () => {
            vscode.window.showInformationMessage(
                'SRS Writer Plugin v1.2: 请在Chat面板中使用 @srs-writer 开始智能对话。'
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
            '🚀 SRS Writer v1.3 已激活！现在支持智能质量检查。',
            '了解更多'
        ).then(selection => {
            if (selection === '了解更多') {
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
 * 注册v1.3新增的命令
 */
function registerV13Commands(context: vscode.ExtensionContext): void {
    // 状态命令
    const statusCommand = vscode.commands.registerCommand('srs-writer.status', async () => {
        const session = await sessionManager.getCurrentSession();
        const orchestratorStatus = await orchestrator.getStatus();
        
        const statusMessage = `
🤖 SRS Writer v1.3 状态\n
📊 当前项目: ${session?.projectName || '无'}\n⚡ AI模式: ${orchestratorStatus.aiMode ? '启用' : '禁用'}\n📁 活跃文件: ${session?.activeFiles.length || 0}个\n🔍 质量检查: 可用\n🕐 会话创建: ${session?.metadata.created || '无'}\n
💡 使用 @srs-writer 开始智能对话！`;
        
        vscode.window.showInformationMessage(statusMessage);
    });
    
    // 编辑模式命令
    const editModeCommand = vscode.commands.registerCommand('srs-writer.editMode', async () => {
        const session = await sessionManager.getCurrentSession();
        
        if (!session?.projectName) {
            vscode.window.showWarningMessage(
                '⚠️ 无活跃项目。请先创建一个项目后再使用编辑模式。'
            );
            return;
        }
        
        const edit = await vscode.window.showInputBox({
            prompt: `编辑项目: ${session.projectName}`,
            placeHolder: '输入您想要进行的修改，例如：添加用户认证功能'
        });
        
        if (edit) {
            // 触发聊天参与者处理编辑请求
            vscode.window.showInformationMessage(
                `编辑请求已记录: ${edit}。请在Chat面板中使用 @srs-writer 继续对话。`
            );
        }
    });
    
    // 清理会话命令
    const clearSessionCommand = vscode.commands.registerCommand('srs-writer.clearSession', async () => {
        const confirmation = await vscode.window.showWarningMessage(
            '确定要清理当前会话吗？这将丢失项目状态和历史记录。',
            '确定',
            '取消'
        );
        
        if (confirmation === '确定') {
            await sessionManager.clearSession();
            vscode.window.showInformationMessage('✅ 会话已清理');
        }
    });
    
    // 架构验证命令 (v2.0: 已迁移到新工具架构)
    const architectureValidationCommand = vscode.commands.registerCommand(
        'srs-writer.runArchitectureSpike', 
        async () => {
            vscode.window.showInformationMessage(
                '🚀 架构已升级到v2.0工具代理模式！\n\n' +
                '新架构特点：\n' +
                '• 🤖 智能工具代理\n' +
                '• 🔧 分层工具架构\n' +
                '• 📚 文档生成与导入工具\n' +
                '• 🎯 对话式规划循环\n\n' +
                '请使用 @srs-writer 在聊天中体验新架构！',
                '了解更多'
            ).then(selection => {
                if (selection === '了解更多') {
                    vscode.commands.executeCommand('srs-writer.help');
                }
            });
        }
    );
    
    // AI模式切换命令
    const toggleAIModeCommand = vscode.commands.registerCommand('srs-writer.toggleAIMode', async () => {
        const currentStatus = await orchestrator.getStatus();
        const newMode = !currentStatus.aiMode;
        
        orchestrator.setAIMode(newMode);
        
        const modeText = newMode ? 'AI智能模式' : '代码降级模式';
        const icon = newMode ? '🤖' : '⚙️';
        
        vscode.window.showInformationMessage(
            `${icon} 已切换到${modeText}`
        );
    });
    
    // 测试命令 (集成到v1.2命令中)
    const runFullTestSuiteCommand = vscode.commands.registerCommand(
        'srs-writer.runFullTestSuite',
        async () => {
            vscode.window.showInformationMessage('🧪 运行完整测试套件功能正在完善中...');
            // TODO: 集成TestCommands的实现
        }
    );
    
    const runPerformanceTestsCommand = vscode.commands.registerCommand(
        'srs-writer.runPerformanceTests', 
        async () => {
            vscode.window.showInformationMessage('⚡ 运行性能测试功能正在完善中...');
        }
    );
    
    const runEndToEndTestsCommand = vscode.commands.registerCommand(
        'srs-writer.runEndToEndTests',
        async () => {
            vscode.window.showInformationMessage('🔗 运行端到端测试功能正在完善中...');
        }
    );
    
    const showTestHelpCommand = vscode.commands.registerCommand(
        'srs-writer.showTestHelp',
        async () => {
            vscode.window.showInformationMessage('📚 测试帮助功能正在完善中...');
        }
    );
    
    // 注册所有命令
    context.subscriptions.push(
        statusCommand,
        editModeCommand,
        clearSessionCommand,
        architectureValidationCommand,
        toggleAIModeCommand,
        runFullTestSuiteCommand,
        runPerformanceTestsCommand,
        runEndToEndTestsCommand,
        showTestHelpCommand
    );
    
    logger.info('v1.2 commands registered successfully');
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
            const orchestratorStatus = await orchestrator?.getStatus();
            
            if (session?.projectName) {
                statusBarItem.text = `$(notebook-kernel) SRS: ${session.projectName}`;
                statusBarItem.tooltip = `SRS Writer v1.3\n项目: ${session.projectName}\nAI模式: ${orchestratorStatus?.aiMode ? '启用' : '禁用'}\n点击查看状态`;
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
 * 扩展停用时调用
 */
export function deactivate() {
    logger.info('SRS Writer Plugin v1.2 is deactivating...');
    
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
        
        logger.info('SRS Writer Plugin v1.2 deactivated successfully');
    } catch (error) {
        console.error('Error during SRS Writer Plugin v1.2 deactivation:', (error as Error).message || error);
    }
} 