import * as vscode from 'vscode';
import * as path from 'path';
import { SRSChatParticipant } from './chat/srs-chat-participant';
import { SessionManager } from './core/session-manager';
import { Orchestrator } from './core/orchestrator';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';
// Language Model Tools已禁用 - 暂时移除工具类导入
// import { 
//     InternetSearchTool, 
//     CustomRAGRetrievalTool, 
//     ReadLocalKnowledgeTool 
// } from './tools/atomic/knowledge-tools-backup';
import { VSCodeCommandHandler } from './tools/document/markitdownConverter/VSCodeCommandHandler';

let chatParticipant: SRSChatParticipant;
let sessionManager: SessionManager;
let orchestrator: Orchestrator;
const logger = Logger.getInstance();

/**
 * 扩展激活时调用 - v1.3最终版本
 * @param context 扩展上下文
 */
export function activate(context: vscode.ExtensionContext) {
    // 🚨 新增：扩展激活追踪
    const activateTimestamp = new Date().toISOString();
    const activateStack = new Error().stack;
    
    logger.warn(`🚨 [EXTENSION ACTIVATE] Extension activating at ${activateTimestamp}`);
    logger.warn(`🚨 [EXTENSION ACTIVATE] Activation reason: ${context.extensionMode}`);
    logger.warn(`🚨 [EXTENSION ACTIVATE] Call stack:`);
    logger.warn(activateStack || 'No stack trace available');
    
    // 🚀 设置全局扩展上下文，供工作区初始化功能使用
    extensionContext = context;
    
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
        
        // 🔧 Step 5: Language Model Tools已禁用 - 为了发布到Marketplace
        // logger.info('Step 5: Registering Language Model Tools...');
        // registerLanguageModelTools(context);
        // logger.info('✅ Language Model Tools registered successfully');
        
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
 * 🔧 注册Language Model Tools - 已禁用以支持Marketplace发布
 * TODO: 当VS Code Language Model Tools API稳定化后重新启用
 */
/*
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
*/

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
                label: '$(folder-library) 创建工作区并初始化',
                description: '为首次使用创建完整的工作区环境',
                detail: '选择父目录，创建工作区，复制templates文件'
            },
            {
                label: '$(arrow-swap) 切换项目',
                description: '切换到workspace中的其他项目',
                detail: '扫描项目列表，archive当前session，创建新session'
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
            },
            {
                label: '$(file-text) 文档格式转换',
                description: '转换Word文档为Markdown',
                detail: '扫描workspace中的.docx文件并转换为.md格式'
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
            case '$(folder-library) 创建工作区并初始化':
                await createWorkspaceAndInitialize();
                break;
            case '$(arrow-swap) 切换项目':
                await switchProject();
                break;
            case '$(sync) 同步状态检查':
                await showSyncStatus();
                break;
            case '$(output) 导出状态报告':
                await exportStatusReport();
                break;
            case '$(file-text) 文档格式转换':
                await handleDocumentConversion();
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
 * 🚀 v3.0新增：文档格式转换处理函数
 */
async function handleDocumentConversion(): Promise<void> {
    try {
        logger.info('🔄 Starting document conversion command from status bar');
        
        // 创建VS Code命令处理器实例
        const commandHandler = new VSCodeCommandHandler();
        
        // 执行文档转换命令
        await commandHandler.handleConvertDocumentCommand();
        
    } catch (error) {
        logger.error('Failed to handle document conversion', error as Error);
        vscode.window.showErrorMessage(
            `❌ **文档转换失败**\n\n错误详情: ${(error as Error).message}\n\n💡 请检查是否安装了markitdown-ts依赖，或查看输出面板了解详细信息。`
        );
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
 * 🚀 v4.0新增：工作空间项目信息
 */
interface WorkspaceProject {
    name: string;
    baseDir: string;
    isCurrentProject: boolean;
}

/**
 * 🚀 v4.0新增：扫描workspace中的项目
 */
async function scanWorkspaceProjects(): Promise<WorkspaceProject[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return [];
    }

    const projects: WorkspaceProject[] = [];
    const currentSession = await sessionManager.getCurrentSession();
    const currentProjectName = currentSession?.projectName;

    // 扫描workspace根目录下的子文件夹
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    
    try {
        const items = await vscode.workspace.fs.readDirectory(workspaceFolders[0].uri);
        
        // 🚀 获取排除目录列表
        const excludeList = getProjectSwitchingExcludeList();
        const excludeSet = new Set(excludeList.map(dir => dir.toLowerCase()));
        logger.info(`🔍 Project scanning excludes: [${excludeList.join(', ')}]`);
        
        for (const [itemName, fileType] of items) {
            // 只处理文件夹，跳过文件和隐藏文件夹
            if (fileType === vscode.FileType.Directory && !itemName.startsWith('.')) {
                // 🚀 检查排除列表
                if (excludeSet.has(itemName.toLowerCase())) {
                    logger.debug(`⏭️ Skipping excluded directory: ${itemName}`);
                    continue; // 跳过被排除的目录
                }
                
                // 检查是否像项目文件夹
                if (isLikelyProjectDirectory(itemName)) {
                    projects.push({
                        name: itemName,
                        baseDir: `${workspaceRoot}/${itemName}`,
                        isCurrentProject: itemName === currentProjectName
                    });
                }
            }
        }
    } catch (error) {
        logger.error('Failed to scan workspace projects', error as Error);
    }

    // 如果当前有项目但不在扫描列表中，添加它
    if (currentProjectName && !projects.find(p => p.name === currentProjectName)) {
        projects.push({
            name: currentProjectName,
            baseDir: currentSession?.baseDir || `${workspaceRoot}/${currentProjectName}`,
            isCurrentProject: true
        });
    }

    return projects;
}

/**
 * 获取项目切换时要排除的目录列表
 */
function getProjectSwitchingExcludeList(): string[] {
    const config = vscode.workspace.getConfiguration('srs-writer');
    const excludeList = config.get<string[]>('projectSwitching.excludeDirectories');
    return excludeList || [
        'templates', 'knowledge', 'node_modules', 
        '.git', '.vscode', 'coverage', 'dist', 'build'
    ];
}

/**
 * 检测文件夹是否像项目目录
 */
function isLikelyProjectDirectory(dirName: string): boolean {
    const projectIndicators = [
        'project', 'srs-', '项目', 'webapp', 'app', 'system', '系统',
        'Project', 'SRS', 'System', 'App', 'Web'
    ];
    
    const lowerName = dirName.toLowerCase();
    return projectIndicators.some(indicator => 
        lowerName.includes(indicator.toLowerCase())
    ) || dirName.length > 3; // 或者名称足够长（可能是项目名）
}

/**
 * 🚀 v4.0新增：切换项目功能
 */
async function switchProject(): Promise<void> {
    try {
        const currentSession = await sessionManager.getCurrentSession();
        const currentProjectName = currentSession?.projectName || '无项目';

        const projects = await scanWorkspaceProjects();
        const projectItems = projects.map(project => ({
            label: `📁 ${project.name}${project.isCurrentProject ? ' (当前)' : ''}`,
            description: `基础目录: ${project.baseDir}`,
            detail: project.isCurrentProject ? '当前活跃项目' : '可切换到此项目',
            project
        }));

        const selectedProject = await vscode.window.showQuickPick(projectItems, {
            placeHolder: `选择要切换到的项目 (当前: ${currentProjectName})`,
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selectedProject) {
            return;
        }

        const targetProject = selectedProject.project;
        const targetProjectName = targetProject.name;

        // 如果选择的是当前项目，无需切换
        if (targetProject.isCurrentProject) {
            vscode.window.showInformationMessage(`✅ 已经是当前项目: ${targetProjectName}`);
            return;
        }

        const confirmMessage = `📁 当前项目 "${currentProjectName}" 将被归档保存，不会丢失任何文件。\n\n🚀 切换到项目 "${targetProjectName}" 吗？`;
        const confirmed = await vscode.window.showInformationMessage(
            confirmMessage,
            { modal: true },
            '切换项目',
            '取消'
        );

        if (confirmed !== '切换项目') {
            return;
        }

        const result = await sessionManager.archiveCurrentAndStartNew(targetProjectName);

        if (result.success) {
            const preservedCount = result.filesPreserved.length;
            const archiveInfo = result.archivedSession ? 
                `\n📦 原项目已归档: ${result.archivedSession.archiveFileName}` : '';
            
            vscode.window.showInformationMessage(
                `✅ 项目已切换到 "${targetProjectName}"！${archiveInfo}\n💾 已保护 ${preservedCount} 个用户文件`
            );
            logger.info(`Project switched to ${targetProjectName}. Preserved ${preservedCount} files.`);
        } else {
            throw new Error(result.error || '未知错误');
        }

    } catch (error) {
        logger.error('Failed to switch project', error as Error);
        vscode.window.showErrorMessage(`切换项目失败: ${(error as Error).message}`);
    }
}

/**
 * 🚀 v3.0新增：创建工作区并初始化功能
 */
async function createWorkspaceAndInitialize(): Promise<void> {
    try {
        logger.info('🚀 开始创建工作区并初始化流程...');

        // Step 1: 让用户选择父目录
        const parentDirResult = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择工作区父目录',
            title: '选择创建工作区的父目录位置'
        });

        if (!parentDirResult || parentDirResult.length === 0) {
            logger.info('用户取消了父目录选择');
            return;
        }

        const parentDir = parentDirResult[0].fsPath;
        logger.info(`用户选择的父目录: ${parentDir}`);

        // Step 2: 让用户输入工作区文件夹名称
        const workspaceName = await vscode.window.showInputBox({
            prompt: '请输入工作区文件夹名称',
            placeHolder: '例如：my-srs-workspace',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return '工作区名称不能为空';
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(value.trim())) {
                    return '工作区名称只能包含字母、数字、下划线和短横线';
                }
                return undefined;
            }
        });

        if (!workspaceName) {
            logger.info('用户取消了工作区名称输入');
            return;
        }

        const trimmedWorkspaceName = workspaceName.trim();
        logger.info(`用户输入的工作区名称: ${trimmedWorkspaceName}`);

        // Step 3: 创建工作区目录
        const workspacePath = path.join(parentDir, trimmedWorkspaceName);
        
        // 检查目录是否已存在
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(workspacePath));
            const overwrite = await vscode.window.showWarningMessage(
                `目录 "${trimmedWorkspaceName}" 已存在，是否继续？`,
                { modal: true },
                '继续',
                '取消'
            );
            
            if (overwrite !== '继续') {
                logger.info('用户取消了覆盖已存在的目录');
                return;
            }
        } catch {
            // 目录不存在，这是期望的情况
        }

        // 显示进度指示器
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在创建工作区...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: '创建工作区目录...' });
            
            // 创建工作区目录
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(workspacePath));
            logger.info(`✅ 工作区目录创建成功: ${workspacePath}`);

            progress.report({ increment: 30, message: '复制模板文件...' });

            // Step 4: 复制 .templates 目录
            const extensionContext = getExtensionContext();
            if (extensionContext) {
                const templatesSourcePath = path.join(extensionContext.extensionPath, '.templates');
                const templatesTargetPath = path.join(workspacePath, '.templates');
                
                await copyDirectoryRecursive(templatesSourcePath, templatesTargetPath);
                logger.info(`✅ Templates目录复制成功: ${templatesTargetPath}`);
            } else {
                logger.warn('⚠️ 无法获取扩展上下文，跳过templates复制');
            }

            progress.report({ increment: 60, message: '打开新工作区...' });

            // Step 5: 在VSCode中打开新的工作区
            const workspaceUri = vscode.Uri.file(workspacePath);
            await vscode.commands.executeCommand('vscode.openFolder', workspaceUri, false);
            
            progress.report({ increment: 100, message: '完成!' });
        });

        // 成功消息
        vscode.window.showInformationMessage(
            `🎉 工作区创建成功！\n\n` +
            `📁 位置: ${workspacePath}\n` +
            `📋 模板文件已复制到工作区的 .templates 目录\n` +
            `🚀 现在可以使用 @srs-writer 开始创建文档了！`
        );

        logger.info('✅ 工作区创建并初始化完成');
        
    } catch (error) {
        const errorMessage = `创建工作区失败: ${(error as Error).message}`;
        logger.error('Failed to create workspace and initialize', error as Error);
        vscode.window.showErrorMessage(errorMessage);
    }
}

/**
 * 递归复制目录及其所有内容
 * 导出供测试使用
 */
export async function copyDirectoryRecursive(sourcePath: string, targetPath: string): Promise<void> {
    const logger = Logger.getInstance();
    
    try {
        // 检查源目录是否存在
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(sourcePath));
        } catch {
            logger.warn(`源目录不存在，跳过复制: ${sourcePath}`);
            return;
        }

        // 创建目标目录
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetPath));

        // 读取源目录内容
        const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(sourcePath));

        for (const [name, type] of entries) {
            const sourceItemPath = path.join(sourcePath, name);
            const targetItemPath = path.join(targetPath, name);

            if (type === vscode.FileType.Directory) {
                // 递归复制子目录
                await copyDirectoryRecursive(sourceItemPath, targetItemPath);
            } else if (type === vscode.FileType.File) {
                // 复制文件
                await vscode.workspace.fs.copy(
                    vscode.Uri.file(sourceItemPath),
                    vscode.Uri.file(targetItemPath),
                    { overwrite: true }
                );
                logger.debug(`📄 复制文件: ${name}`);
            }
        }

        logger.info(`📁 目录复制完成: ${sourcePath} → ${targetPath}`);
    } catch (error) {
        logger.error(`目录复制失败: ${sourcePath} → ${targetPath}`, error as Error);
        throw error;
    }
}

/**
 * 获取扩展上下文（需要在activate函数中设置）
 */
let extensionContext: vscode.ExtensionContext | undefined;

function getExtensionContext(): vscode.ExtensionContext | undefined {
    return extensionContext;
}

/**
 * 扩展停用时调用
 */
export function deactivate() {
    // 🚨 新增：扩展停用追踪
    const deactivateTimestamp = new Date().toISOString();
    const deactivateStack = new Error().stack;
    
    logger.warn(`🚨 [EXTENSION DEACTIVATE] Extension deactivating at ${deactivateTimestamp}`);
    logger.warn(`🚨 [EXTENSION DEACTIVATE] Call stack:`);
    logger.warn(deactivateStack || 'No stack trace available');
    
    logger.info('SRS Writer Plugin is deactivating...');
    
    try {
        // 🚀 v5.0新增：清理全局引擎
        logger.info('Step 1: Disposing global engine...');
        SRSChatParticipant.disposeGlobalEngine();
        logger.info('✅ Global engine disposed successfully');
        
        // 清理Chat Participant会话
        if (chatParticipant) {
            logger.info('Step 2: Cleaning up chat participant...');
            // 已移除过期会话清理功能 - 现在由 SessionManager 自动处理
            logger.info('✅ Chat participant cleanup completed');
        }
        
        // 保存会话状态
        if (sessionManager) {
            logger.info('Step 3: Saving session state...');
            sessionManager.saveSessionToFile().catch(error => {
                logger.error('Failed to save session during deactivation', error as Error);
            });
            logger.info('✅ Session state save initiated');
        }
        
        // 清理Logger资源
        logger.info('Step 4: Disposing logger...');
        logger.dispose();
        
        logger.info('SRS Writer Plugin deactivated successfully');
    } catch (error) {
        console.error('Error during SRS Writer Plugin deactivation:', (error as Error).message || error);
    }
} 