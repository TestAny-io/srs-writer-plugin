import * as vscode from 'vscode';
import * as path from 'path';
import { SRSChatParticipant } from './chat/srs-chat-participant';
import { SessionManager } from './core/session-manager';
import { ProjectSessionInfo, OperationType } from './types/session';
import { Orchestrator } from './core/orchestrator';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';
import { FoldersViewEnhancer } from './core/FoldersViewEnhancer';
import { VSCodeToolsAdapter } from './tools/adapters/vscode-tools-adapter';
import { BaseDirValidator } from './utils/baseDir-validator';
import { disposeDiffManager } from './utils/diff-view';
// Language Model Tools已禁用 - 暂时移除工具类导入
// import {
//     InternetSearchTool,
//     CustomRAGRetrievalTool,
//     ReadLocalKnowledgeTool
// } from './tools/atomic/knowledge-tools-backup';


let chatParticipant: SRSChatParticipant;
let sessionManager: SessionManager;
let orchestrator: Orchestrator;
let foldersViewEnhancer: FoldersViewEnhancer;
let vsCodeToolsAdapter: VSCodeToolsAdapter | null = null;
const logger = Logger.getInstance();

/**
 * 扩展激活时调用 - v1.3最终版本
 * @param context 扩展上下文
 */
export async function activate(context: vscode.ExtensionContext) {
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

        // 注册状态栏项 - v1.2增强版
        const statusBarItem = createEnhancedStatusBar();
        context.subscriptions.push(statusBarItem);
        
        // 工作区变化监听
        const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
            sessionManager.refreshSessionPath();
            logger.info('Workspace changed, session path refreshed');
        });
        context.subscriptions.push(workspaceWatcher);
        
        // 🚀 新增：初始化Folders视图增强器
        logger.info('Step 6: Initializing Folders View Enhancer...');
        foldersViewEnhancer = new FoldersViewEnhancer();

        // 注册Folders视图增强命令
        registerFoldersViewCommands(context);

        // 启用Folders视图增强功能
        vscode.commands.executeCommand('setContext', 'srs-writer:foldersViewEnhanced', true);
        logger.info('✅ Folders View Enhancer initialized successfully');

        // 🚀 Phase 1.2: 注册项目管理命令
        registerProjectManagementCommands(context);

        // 🚀 Phase 1.2: 设置 Session File 保护
        setupSessionFileProtection(context);

        // 🚀 v3.0新增：注册 VSCode/MCP 工具（使用 VSCode API）
        logger.info('Step 7: Registering MCP Tools...');
        try {
            vsCodeToolsAdapter = new VSCodeToolsAdapter();
            await vsCodeToolsAdapter.registerVSCodeTools();

            const toolCount = vsCodeToolsAdapter.getRegisteredToolCount();
            console.log(`[MCP] Registered ${toolCount} MCP tool(s)`);

            if (toolCount > 0) {
                logger.info(`✅ MCP Tools registered: ${toolCount} tool(s)`);
            } else {
                logger.info('ℹ️ No MCP Tools found (no MCP servers configured)');
            }
        } catch (error) {
            logger.error(`❌ MCP Tools registration failed: ${(error as Error).message}`);
            // 不阻塞扩展激活
        }

        logger.info('SRS Writer Plugin v1.3 activation completed successfully');
        
        // 显示激活成功消息
        vscode.window.showInformationMessage(
            '🚀 SRS Writer is at your service',
            'Open Control Panel'
        ).then(selection => {
            if (selection === 'Open Control Panel') {
                vscode.commands.executeCommand('srs-writer.status');
            }
        });
        
    } catch (error) {
        ErrorHandler.handleError(error as Error, true);
        logger.error('Failed to activate SRS Writer Plugin v1.2', error as Error);
        
        vscode.window.showErrorMessage(
            'SRS Writer plugin activation failed, please check the configuration and restart VSCode.'
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



    // 🚀 v6.0清理：移除手动创建项目命令，项目创建由 project_initializer specialist 独家处理
    // 🚀 阶段4清理：移除归档历史命令注册



    // AI模式切换命令 - 新架构：不再需要手动切换模式，AI自动智能分诊
    const toggleAIModeCommand = vscode.commands.registerCommand('srs-writer.toggleAIMode', async () => {
        const currentStatus = await orchestrator.getSystemStatus();
        
        // 新架构：模式通过智能分诊自动确定，无需手动切换
        vscode.window.showInformationMessage(
            `🚀 ${currentStatus.architecture} AI mode is enabled\n\nPlugin version: ${currentStatus.version}\n\nModes will be automatically switched based on user intent:\n• 🚀 Plan Execution mode: Complex multi-step tasks\n• 🛠️ Tool Execution mode: Tasks that require file operations\n• 🧠 Knowledge Question mode: Consultation and dialogue`
        );
    });
    

    
    // 🚀 v3.0新增：强制同步命令
    const forceSyncCommand = vscode.commands.registerCommand('srs-writer.forceSyncContext', async () => {
        await performForcedSync();
    });

    // 注册所有命令
    context.subscriptions.push(
        statusCommand,
        // 🚀 v6.0清理：移除 startNewProjectCmd
        // 🚀 阶段4清理：移除 viewArchiveHistoryCmd
        toggleAIModeCommand,
        forceSyncCommand  // 🚀 新增强制同步命令
    );
    
    logger.info('Core commands registered successfully');
}

/**
 * 🚀 新增：注册Folders视图增强命令
 */
function registerFoldersViewCommands(context: vscode.ExtensionContext): void {
    // 为Folders视图选择分支命令
    const selectBranchForFoldersCmd = vscode.commands.registerCommand('srs-writer.selectBranchForFolders', async () => {
        await foldersViewEnhancer.selectBranchForFolders();
    });

    // 注册命令
    context.subscriptions.push(selectBranchForFoldersCmd);

    logger.info('Folders View Enhancer commands registered successfully');
}

/**
 * 🚀 Phase 1.2: 注册项目管理命令
 */
function registerProjectManagementCommands(context: vscode.ExtensionContext): void {
    const sessionManager = SessionManager.getInstance(context);

    // Command 1: Project Management Menu (Quick Pick)
    const projectManagementCmd = vscode.commands.registerCommand('srs-writer.projectManagement', async () => {
        const action = await vscode.window.showQuickPick([
            {
                label: '$(edit) Rename Project',
                description: 'Rename project (updates projectName, directory, and baseDir atomically)',
                action: 'rename'
            },
            {
                label: '$(trash) Delete Project',
                description: 'Delete project session and directory',
                action: 'delete'
            }
        ], {
            placeHolder: 'Select a project management action'
        });

        if (!action) return;

        switch (action.action) {
            case 'rename':
                await vscode.commands.executeCommand('srs-writer.renameProject');
                break;
            case 'delete':
                await vscode.commands.executeCommand('srs-writer.deleteProject');
                break;
        }
    });

    // Command 2: Rename Project
    const renameProjectCmd = vscode.commands.registerCommand('srs-writer.renameProject', async () => {
        const currentSession = await sessionManager.getCurrentSession();
        const currentProjectName = currentSession?.projectName;

        if (!currentProjectName) {
            vscode.window.showErrorMessage('No active project to rename.');
            return;
        }

        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new project name',
            value: currentProjectName,
            validateInput: (value) => {
                if (!value || value.trim() === '') {
                    return 'Project name cannot be empty';
                }
                if (value === currentProjectName) {
                    return 'New name is the same as current name';
                }
                return null;
            }
        });

        if (!newName) return; // User cancelled

        try {
            await sessionManager.renameProject(currentProjectName, newName);
            vscode.window.showInformationMessage(
                `✅ Project renamed: ${currentProjectName} → ${newName}\n` +
                `(directory and baseDir updated)`
            );
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to rename project: ${(error as Error).message}`
            );
        }
    });

    // Command 3: Delete Project
    const deleteProjectCmd = vscode.commands.registerCommand('srs-writer.deleteProject', async () => {
        const currentSession = await sessionManager.getCurrentSession();
        if (!currentSession || !currentSession.projectName) {
            vscode.window.showErrorMessage('No active project to delete.');
            return;
        }

        const projectName = currentSession.projectName;
        const baseDir = currentSession.baseDir;

        // Confirmation dialog
        const confirmChoice = await vscode.window.showWarningMessage(
            `Are you sure you want to delete project "${projectName}"?\n\n` +
            `This will delete:\n` +
            `  - Session file\n` +
            `  - Project directory: ${baseDir}\n` +
            `  - All files and folders in the directory\n\n` +
            `⚠️ Files will be moved to Trash/Recycle Bin (recoverable).`,
            { modal: true },
            'Yes, Delete Session and Directory',
            'No, Cancel'
        );

        if (confirmChoice !== 'Yes, Delete Session and Directory') return;

        try {
            await sessionManager.deleteProject(projectName);
            vscode.window.showInformationMessage(
                `✅ Project "${projectName}" deleted`
            );
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to delete project: ${(error as Error).message}`
            );
        }
    });

    // Register all commands
    context.subscriptions.push(
        projectManagementCmd,
        renameProjectCmd,
        deleteProjectCmd
    );

    logger.info('🚀 Phase 1.2: Project Management commands registered successfully');
}

/**
 * 🚀 Phase 1.2: Setup session file protection
 *
 * Detects manual edits to session files and warns users to use management commands
 */
function setupSessionFileProtection(context: vscode.ExtensionContext): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) return;

    // Create file system watcher for .session-log/*.json
    const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceRoot, '.session-log/**/*.json')
    );

    // 🔧 Bug fix: 使用计数器而不是布尔标志，支持连续多次写入（如 renameProject）
    let extensionWriteCount = 0;

    // Intercept SessionManager's write operations
    const sessionManager = SessionManager.getInstance(context);
    const originalSave = (sessionManager as any).saveUnifiedSessionFile;

    if (originalSave) {
        (sessionManager as any).saveUnifiedSessionFile = async function(...args: any[]) {
            extensionWriteCount++;
            try {
                return await originalSave.apply(this, args);
            } finally {
                // 🔧 延迟 1000ms 以确保文件系统 watcher 事件被处理
                // 文件系统事件的触发时间不确定，可能远超过 200ms
                // 这个延迟需要覆盖：
                // 1. renameProject 的两次连续保存
                // 2. 单次保存后文件系统事件的延迟触发
                setTimeout(() => {
                    extensionWriteCount = Math.max(0, extensionWriteCount - 1);
                }, 1000);
            }
        };
    }

    // Watch for file changes
    watcher.onDidChange(async (uri) => {
        // Ignore extension's own writes
        if (extensionWriteCount > 0) return;

        // User manually edited session file
        const choice = await vscode.window.showWarningMessage(
            '⚠️ Session File Edited Manually\n\n' +
            'Session files are managed by SRS Writer extension. ' +
            'Manual edits may cause data inconsistency or be overwritten.\n\n' +
            'Please use "Project Management" commands to make changes safely.',
            'Open Project Management',
            'Keep My Changes'
        );

        if (choice === 'Open Project Management') {
            vscode.commands.executeCommand('srs-writer.projectManagement');
        }
        // 'Keep My Changes' - do nothing, but user has been warned
    });

    // Watch for file creation (user may manually create new session file)
    watcher.onDidCreate(async (uri) => {
        if (extensionWriteCount > 0) return;

        vscode.window.showWarningMessage(
            '⚠️ New Session File Detected\n\n' +
            'A new session file was created manually. This may cause conflicts. ' +
            'Please use "Project Management" commands to create projects.',
            'Okay'
        );
    });

    context.subscriptions.push(watcher);

    logger.info('🚀 Phase 1.2: Session file protection enabled');
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
        vscode.window.showWarningMessage('Some tools registration failed, but the extension can still be used');
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
    
    // 🚀 v6.0简化版：移除tooltip功能，避免项目切换时的弹窗干扰
    const updateStatusBar = async () => {
        try {
            const session = await sessionManager?.getCurrentSession();
            
            if (session?.projectName) {
                statusBarItem.text = `$(edit) SRS: ${session.projectName}`;
            } else {
                statusBarItem.text = '$(edit) SRS Writer';
            }
        } catch (error) {
            // 静默处理错误，避免频繁的错误弹窗
            statusBarItem.text = '$(edit) SRS Writer';
        }
    };
    
    statusBarItem.command = 'srs-writer.status';
    updateStatusBar();
    statusBarItem.show();
    
    // 🚀 v6.0优化：只在项目切换时才更新，不再定时更新，减少资源消耗
    // 监听会话变化时才更新状态栏
    if (sessionManager) {
        sessionManager.subscribe({
            onSessionChanged: () => {
                updateStatusBar();
            }
        });
    }
    
    return statusBarItem;
}

/**
 * 🚀 v3.0新增：增强的状态查看功能
 */
async function showEnhancedStatus(): Promise<void> {
    try {
        const options = await vscode.window.showQuickPick([
            {
                label: '$(folder-library) Create Workspace & Initialize',
                description: 'Create a complete workspace environment for first-time use',
                detail: 'Select parent directory, create workspace, copy template files'
            },
            {
                label: '$(arrow-swap) Switch Project',
                description: 'Switch to existing project',
                detail: 'Switch to existing project in workspace'
            },
            {
                label: '$(folder-opened) Project Management',
                description: 'Manage current project',
                detail: 'Rename project or delete project'
            },
            {
                label: '$(sync) Sync Status Check',
                description: 'Check data consistency',
                detail: 'File vs memory sync status'
            },
            {
                label: '$(tools) MCP Tools Management',
                description: 'Manage MCP tools',
                detail: 'View registered MCP tools, add or remove keywords to exclude tools'
            },
            {
                label: '$(gear) Plugin Settings',
                description: 'Open SRS Writer plugin settings',
                detail: 'Configure knowledge paths, project exclusions, and other preferences'
            }
        ], {
            placeHolder: 'Select an action from the control panel',
            title: 'SRS Writer Control Panel'
        });

        if (!options) return;

        switch (options.label) {
            case '$(folder-library) Create Workspace & Initialize':
                await createWorkspaceAndInitialize();
                break;
            case '$(arrow-swap) Switch Project':
                await switchProject();
                break;
            case '$(folder-opened) Project Management':
                await vscode.commands.executeCommand('srs-writer.projectManagement');
                break;
            case '$(sync) Sync Status Check':
                await showSyncStatus();
                break;
            case '$(tools) MCP Tools Management':
                await showVSCodeToolsStatus();
                break;
            case '$(gear) Plugin Settings':
                await openPluginSettings();
                break;
        }
    } catch (error) {
        logger.error('Failed to show enhanced status', error as Error);
        vscode.window.showErrorMessage(`Failed to view status: ${(error as Error).message}`);
    }
}

/**
 * 🚀 v3.0新增：显示 VSCode/MCP 工具状态和管理
 */
async function showVSCodeToolsStatus(): Promise<void> {
    try {
        if (!vsCodeToolsAdapter) {
            vscode.window.showInformationMessage('VSCode Tools Adapter is not initialized');
            return;
        }

        // 第一级菜单：选择操作
        const action = await vscode.window.showQuickPick([
            {
                label: '$(eye) View Tools Status',
                description: 'View registered VSCode and MCP tools',
                detail: 'Shows all tools discovered from vscode.lm.tools API'
            },
            {
                label: '$(filter) Manage Excluded Keywords',
                description: 'Add or remove keywords to exclude MCP tools',
                detail: 'Exclude tools by adding keywords (e.g., java_app_mode, appmod)'
            },
            {
                label: '$(refresh) Reload Tools',
                description: 'Reload all MCP tools after configuration changes',
                detail: 'Unregister and re-register all tools with current settings'
            }
        ], {
            placeHolder: 'Select an action',
            title: 'MCP Tools Management'
        });

        if (!action) return;

        switch (action.label) {
            case '$(eye) View Tools Status':
                await viewToolsStatus();
                break;
            case '$(filter) Manage Excluded Keywords':
                await manageExcludedKeywords();
                break;
            case '$(refresh) Reload Tools':
                await reloadMCPTools();
                break;
        }

    } catch (error) {
        logger.error('Failed to show VSCode tools status', error as Error);
        vscode.window.showErrorMessage(`Failed to show tools status: ${(error as Error).message}`);
    }
}

/**
 * 查看工具状态
 */
async function viewToolsStatus(): Promise<void> {
    if (!vsCodeToolsAdapter) return;

    // 获取已注册的工具
    const registeredTools = vsCodeToolsAdapter.getRegisteredToolNames();
    const registeredCount = vsCodeToolsAdapter.getRegisteredToolCount();

    // 获取 vscode.lm.tools 中的原始工具信息
    let vscodeToolsInfo = 'Not available';
    let vscodeToolsCount = 0;
    if (vscode.lm && vscode.lm.tools) {
        vscodeToolsCount = vscode.lm.tools.length;
        vscodeToolsInfo = vscode.lm.tools.map(tool =>
            `  • ${tool.name}: ${tool.description || 'No description'}`
        ).join('\n');
    }

    // 获取排除关键字配置
    const config = vscode.workspace.getConfiguration('srs-writer.mcp');
    const excludeKeywords = config.get<string[]>('excludeKeywords', []);
    const excludeInfo = excludeKeywords.length > 0
        ? `\n  Keywords: ${excludeKeywords.map(k => `"${k}"`).join(', ')}`
        : '\n  (No keywords configured)';

    // 构建状态信息
    const statusMessage = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📊 MCP Tools Status',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        `✅ VSCode API Status: ${vscode.lm && vscode.lm.tools ? 'Available' : 'Not Available'}`,
        `📦 Tools in vscode.lm.tools: ${vscodeToolsCount}`,
        `🔧 Tools registered by SRS Writer: ${registeredCount}`,
        `🚫 Exclude keywords: ${excludeKeywords.length}${excludeInfo}`,
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '🔍 Raw VSCode Tools (from vscode.lm.tools):',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        vscodeToolsInfo,
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '✨ Registered Tools (available to AI):',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        registeredTools.length > 0
            ? registeredTools.map(name => `  • ${name}`).join('\n')
            : '  (No tools registered)',
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📝 Notes:',
        '  • MCP servers are configured in ~/Library/Application Support/Code/User/mcp.json',
        '  • Tools from MCP servers appear in vscode.lm.tools automatically',
        '  • SRS Writer wraps these tools with vscode_ prefix',
        '  • Use "Manage Excluded Keywords" to exclude unwanted tools',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    ].join('\n');

    // 显示在 Output Channel
    logger.info('\n' + statusMessage);
    logger.show();

    // 同时显示一个简洁的通知
    const action = await vscode.window.showInformationMessage(
        `MCP Tools: ${registeredCount} registered (${vscodeToolsCount} available, ${excludeKeywords.length} keywords)`,
        'View Details',
        'Open MCP Config'
    );

    if (action === 'Open MCP Config') {
        const mcpConfigPath = vscode.Uri.file(
            `${process.env.HOME}/Library/Application Support/Code/User/mcp.json`
        );
        await vscode.commands.executeCommand('vscode.open', mcpConfigPath);
    }
}

/**
 * 管理排除关键字
 */
async function manageExcludedKeywords(): Promise<void> {
    const config = vscode.workspace.getConfiguration('srs-writer.mcp');
    const excludeKeywords = config.get<string[]>('excludeKeywords', []);

    const action = await vscode.window.showQuickPick([
        {
            label: '$(add) Add Keyword',
            description: 'Add a new keyword to exclude tools',
            detail: 'Tools containing this keyword will not be registered'
        },
        {
            label: '$(remove) Remove Keyword',
            description: 'Remove an existing keyword',
            detail: `Current keywords: ${excludeKeywords.length > 0 ? excludeKeywords.join(', ') : '(none)'}`
        },
        {
            label: '$(list-unordered) View Current Keywords',
            description: 'View all configured exclude keywords',
            detail: `${excludeKeywords.length} keyword(s) configured`
        }
    ], {
        placeHolder: 'Select an action',
        title: 'Manage Excluded Keywords'
    });

    if (!action) return;

    switch (action.label) {
        case '$(add) Add Keyword':
            await addExcludeKeyword();
            break;
        case '$(remove) Remove Keyword':
            await removeExcludeKeyword();
            break;
        case '$(list-unordered) View Current Keywords':
            await viewCurrentKeywords();
            break;
    }
}

/**
 * 添加排除关键字
 */
async function addExcludeKeyword(): Promise<void> {
    const keyword = await vscode.window.showInputBox({
        prompt: 'Enter keyword to exclude MCP tools',
        placeHolder: 'e.g., java_app_mode, appmod',
        validateInput: (value) => {
            if (!value || value.trim() === '') {
                return 'Keyword cannot be empty';
            }
            return null;
        }
    });

    if (!keyword) return;

    const config = vscode.workspace.getConfiguration('srs-writer.mcp');
    const excludeKeywords = config.get<string[]>('excludeKeywords', []);

    // 检查是否已存在
    if (excludeKeywords.includes(keyword.trim())) {
        vscode.window.showWarningMessage(`Keyword "${keyword.trim()}" already exists`);
        return;
    }

    // 添加关键字
    excludeKeywords.push(keyword.trim());
    await config.update('excludeKeywords', excludeKeywords, vscode.ConfigurationTarget.Global);

    const shouldReload = await vscode.window.showInformationMessage(
        `Keyword "${keyword.trim()}" added. Reload tools to apply changes?`,
        'Reload Now',
        'Later'
    );

    if (shouldReload === 'Reload Now') {
        await reloadMCPTools();
    }
}

/**
 * 移除排除关键字
 */
async function removeExcludeKeyword(): Promise<void> {
    const config = vscode.workspace.getConfiguration('srs-writer.mcp');
    const excludeKeywords = config.get<string[]>('excludeKeywords', []);

    if (excludeKeywords.length === 0) {
        vscode.window.showInformationMessage('No keywords configured');
        return;
    }

    const keyword = await vscode.window.showQuickPick(excludeKeywords, {
        placeHolder: 'Select keyword to remove',
        title: 'Remove Exclude Keyword'
    });

    if (!keyword) return;

    // 移除关键字
    const updatedKeywords = excludeKeywords.filter(k => k !== keyword);
    await config.update('excludeKeywords', updatedKeywords, vscode.ConfigurationTarget.Global);

    const shouldReload = await vscode.window.showInformationMessage(
        `Keyword "${keyword}" removed. Reload tools to apply changes?`,
        'Reload Now',
        'Later'
    );

    if (shouldReload === 'Reload Now') {
        await reloadMCPTools();
    }
}

/**
 * 查看当前关键字
 */
async function viewCurrentKeywords(): Promise<void> {
    const config = vscode.workspace.getConfiguration('srs-writer.mcp');
    const excludeKeywords = config.get<string[]>('excludeKeywords', []);

    if (excludeKeywords.length === 0) {
        vscode.window.showInformationMessage('No exclude keywords configured');
        return;
    }

    const message = [
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '🚫 Excluded Keywords',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        ...excludeKeywords.map((k, i) => `  ${i + 1}. "${k}"`),
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '📝 Tools containing these keywords will not be registered',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    ].join('\n');

    logger.info('\n' + message);
    logger.show();

    vscode.window.showInformationMessage(`${excludeKeywords.length} keyword(s) configured. Check Output for details.`);
}

/**
 * 重新加载 MCP 工具
 */
async function reloadMCPTools(): Promise<void> {
    if (!vsCodeToolsAdapter) {
        vscode.window.showWarningMessage('VSCode Tools Adapter is not initialized');
        return;
    }

    try {
        logger.info('[MCP] Reloading MCP tools...');

        // 注销所有现有工具
        vsCodeToolsAdapter.dispose();
        logger.info('[MCP] All tools unregistered');

        // 重新注册工具
        await vsCodeToolsAdapter.registerVSCodeTools();

        const toolCount = vsCodeToolsAdapter.getRegisteredToolCount();
        logger.info(`[MCP] Reloaded: ${toolCount} tool(s) registered`);

        vscode.window.showInformationMessage(`✅ MCP tools reloaded: ${toolCount} tool(s) registered`);

    } catch (error) {
        logger.error('Failed to reload MCP tools', error as Error);
        vscode.window.showErrorMessage(`Failed to reload tools: ${(error as Error).message}`);
    }
}

/**
 * 🚀 v6.0新增：打开插件设置页面（简化版，无冗余弹窗）
 */
async function openPluginSettings(): Promise<void> {
    try {
        // 使用VSCode标准API打开扩展设置页面
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:Testany.srs-writer-plugin');
        logger.info('Plugin settings page opened successfully');
    } catch (error) {
        logger.error('Failed to open plugin settings', error as Error);
        
        // 如果特定方式失败，尝试通用设置打开方式
        try {
            await vscode.commands.executeCommand('workbench.action.openSettings', 'srs-writer');
            logger.info('Plugin settings opened via search fallback');
        } catch (fallbackError) {
            // 只在完全失败时才显示错误，并提供手动解决方案
            vscode.window.showErrorMessage(
                `Failed to open settings page: ${(error as Error).message}`,
                'Open settings manually'
            ).then(selection => {
                if (selection === 'Open settings manually') {
                    vscode.commands.executeCommand('workbench.action.openSettings');
                }
            });
        }
    }
}





/**
 * 🚀 v5.0重构：显示增强的同步状态和项目信息
 */
async function showSyncStatus(): Promise<void> {
    try {
        // 执行同步状态检查
        const syncStatus = await sessionManager.checkSyncStatus();
        
        // 获取当前状态信息
        const statusInfo = await sessionManager.getCurrentStatusInfo();
        
        // 构建状态信息消息
        const statusIcon = syncStatus.isConsistent ? '✅' : '⚠️';
        const checkTime = new Date(syncStatus.lastSyncCheck).toLocaleString();
        
        const statusMessage = `${statusIcon} **Sync Status Check Results**

📋 **Current Project Information:**
• Project Name: ${statusInfo.projectName}
• Base Directory: ${statusInfo.baseDirectory}
• Active Files: ${statusInfo.activeFiles}
• Git Branch: ${statusInfo.gitBranch}
• Session ID: ${statusInfo.sessionId.substring(0, 8)}...
• File Format: ${statusInfo.fileFormat}

🕐 Check Time: ${checkTime}

${syncStatus.isConsistent 
    ? '✅ All components are synchronized' 
    : `❌ Found ${syncStatus.inconsistencies.length} sync issue(s):\n${syncStatus.inconsistencies.map(i => `  • ${i}`).join('\n')}`
}`;

        if (syncStatus.isConsistent) {
            // 状态正常时显示信息消息
            await vscode.window.showInformationMessage(
                statusMessage,
                { modal: true },
                'OK'
            );
        } else {
            // 有问题时显示警告消息并提供修复选项
            const action = await vscode.window.showWarningMessage(
                statusMessage + '\n\n💡 Suggestion: Use "Force Sync Context" to fix these issues.',
                { modal: true },
                'Fix Now',
                'View Details',
                'Later'
            );
            
            switch (action) {
                case 'Fix Now':
                    await vscode.commands.executeCommand('srs-writer.forceSyncContext');
                    break;
                case 'View Details':
                    await showSyncStatusDetails(syncStatus, statusInfo);
                    break;
            }
        }
    } catch (error) {
        logger.error('Failed to show sync status', error as Error);
        vscode.window.showErrorMessage(`Failed to check sync status: ${(error as Error).message}`);
    }
}

/**
 * 🚀 v5.0新增：显示同步状态详细信息
 */
async function showSyncStatusDetails(syncStatus: any, statusInfo: any): Promise<void> {
    const detailsMessage = `🔍 **Detailed Sync Status Report**

📊 **System Information:**
• Plugin Version: ${require('../package.json').version}
• Session Format: v5.0 (UnifiedSessionFile)
• PathManager Status: ${statusInfo.pathManager || 'Active'}

📁 **Project Details:**
• Project: ${statusInfo.projectName}
• Directory: ${statusInfo.baseDirectory}
• Git Branch: ${statusInfo.gitBranch}
• Session ID: ${statusInfo.sessionId}

📋 **Inconsistency Analysis:**
${syncStatus.inconsistencies.length === 0 
    ? '✅ No issues detected'
    : syncStatus.inconsistencies.map((issue: string, index: number) => 
        `${index + 1}. ${issue}`
    ).join('\n')
}

🕐 Last Check: ${new Date(syncStatus.lastSyncCheck).toLocaleString()}

💡 **Recommendations:**
${syncStatus.isConsistent 
    ? '• System is healthy, no action needed'
    : '• Run "Force Sync Context" to resolve issues\n• Consider restarting VS Code if problems persist\n• Check Git repository status if branch-related issues exist'
}`;

    await vscode.window.showInformationMessage(
        detailsMessage,
        { modal: true },
        'Close'
    );
}





/**
 * 🚀 v5.0重构：增强的强制同步会话状态
 * 集成智能恢复逻辑和新的UnifiedSessionFile格式支持
 */
async function performForcedSync(): Promise<void> {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Force syncing session status...",
            cancellable: false
        }, async (progress) => {
            
            progress.report({ increment: 0, message: "🔄 Starting forced sync..." });
            
            const sessionManager = SessionManager.getInstance();
            
            // 1. 使用智能恢复逻辑重新同步状态
            progress.report({ increment: 25, message: "🔍 Running smart recovery..." });
            await sessionManager.autoInitialize();
            logger.info('✅ Smart recovery completed');
            
            // 2. 强制通知所有观察者
            progress.report({ increment: 50, message: "📢 Notifying observers..." });
            sessionManager.forceNotifyObservers();
            logger.info('✅ All observers notified');
            
            // 3. 验证同步状态
            progress.report({ increment: 75, message: "✅ Verifying sync status..." });
            const syncStatus = await sessionManager.checkSyncStatus();
            
            // 4. 获取状态信息用于显示
            progress.report({ increment: 90, message: "📋 Gathering status info..." });
            const statusInfo = await sessionManager.getCurrentStatusInfo();
            
            progress.report({ increment: 100, message: "✅ Sync completed!" });
            
            // 显示同步结果
            const resultIcon = syncStatus.isConsistent ? '✅' : '⚠️';
            const resultMessage = `${resultIcon} **Force Sync Results**

📋 **Updated Project Information:**
• Project Name: ${statusInfo.projectName}
• Base Directory: ${statusInfo.baseDirectory}
• Active Files: ${statusInfo.activeFiles}
• Git Branch: ${statusInfo.gitBranch}
• Session ID: ${statusInfo.sessionId.substring(0, 8)}...

${syncStatus.isConsistent 
    ? '✅ All components successfully synchronized!'
    : `⚠️ Sync completed with ${syncStatus.inconsistencies.length} remaining issue(s):\n${syncStatus.inconsistencies.map(i => `  • ${i}`).join('\n')}`
}

🕐 Completed: ${new Date().toLocaleString()}`;

            if (syncStatus.isConsistent) {
                vscode.window.showInformationMessage(
                    resultMessage,
                    { modal: true },
                    'OK'
                );
                logger.info('✅ Forced sync completed successfully');
            } else {
                const action = await vscode.window.showWarningMessage(
                    resultMessage + '\n\n💡 Some issues may require manual intervention or VS Code restart.',
                    { modal: true },
                    'View Details',
                    'OK'
                );
                
                if (action === 'View Details') {
                    await showSyncStatusDetails(syncStatus, statusInfo);
                }
                
                logger.warn(`⚠️ Sync completed with issues: ${syncStatus.inconsistencies.join(', ')}`);
            }
        });
        
    } catch (error) {
        const errorMessage = `❌ Forced sync failed: ${(error as Error).message}`;
        vscode.window.showErrorMessage(errorMessage);
        logger.error('Failed to perform forced sync', error as Error);
    }
}

/**
 * 🚀 v4.0重构：开始新项目（归档当前项目，保护用户资产）
 */
// 🚀 v6.0清理：移除 startNewProjectCommand 函数
// 项目创建由 project_initializer specialist 独家处理

// 🚀 阶段4清理：移除 viewArchiveHistoryCommand 函数

/**
 * 🚀 v4.0新增：工作空间项目信息
 */
// 🚀 Phase 2.1: Removed WorkspaceProject and EnhancedProject interfaces
// Now using only ProjectSessionInfo from session-based scanning

// 🚀 Phase 2.1: 移除废弃的目录扫描相关函数
// - scanWorkspaceProjects(): 不再需要目录扫描
// - getProjectSwitchingExcludeList(): 与目录扫描配套的排除列表
// - isLikelyProjectDirectory(): 目录启发式检测
// 现在统一从 .session-log/ 目录中的会话文件获取所有项目信息

// 🚀 Phase 2.1: 移除 mergeProjectLists() 函数
// 不再需要合并目录扫描和会话扫描的结果，现在单一数据源

/**
 * 🚀 阶段3新增：格式化相对时间
 */
function formatRelativeTime(isoString?: string): string {
    if (!isoString) return 'Unknown';
    
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

/**
 * 🚀 v4.0新增：切换项目功能
 */
async function switchProject(): Promise<void> {
    try {
        const currentSession = await sessionManager.getCurrentSession();
        const currentProjectName = currentSession?.projectName || 'No Project';

        // 🚀 Phase 2.1: 单一数据源 - 只从 session 文件扫描
        const sessionProjects = await sessionManager.listProjectSessions();

        // 构建项目选择列表
        const projectItems = sessionProjects.map(project => {
            const isCurrentProject = project.isActive;
            const { isValid, error } = project.baseDirValidation;

            // 状态图标和描述
            const statusIcon = isValid ? '📁' : '⚠️';
            const statusText = isValid ? 'Directory' : 'Directory Error';

            // 项目信息行
            const infoLine = [
                `${statusIcon} ${statusText}`,
                formatRelativeTime(project.lastModified)
            ].join(' • ');

            return {
                label: `${project.projectName}${isCurrentProject ? ' (Current)' : ''}`,
                description: infoLine,
                detail: isCurrentProject
                    ? 'Currently active project'
                    : isValid
                        ? 'Ready to switch'
                        : `⚠️ ${error}`,
                project,
                action: 'switch' as const
            };
        });

        // 🚀 UAT反馈：简化选项，移除"退出当前项目"
        // 🚀 v6.0更新：移除手动创建项目选项，项目创建由 project_initializer specialist 独家处理
        const allOptions = [
            ...projectItems
        ];

        const selectedOption = await vscode.window.showQuickPick(allOptions, {
            placeHolder: `Switch to existing project (Current: ${currentProjectName})`,
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selectedOption) {
            return;
        }

        // 🚀 v6.0清理：移除创建新项目选项的处理逻辑

        // 确保这是一个项目切换操作
        if (!('project' in selectedOption) || !selectedOption.project) {
            logger.warn('No project selected for switching');
            return;
        }

        const targetProject = selectedOption.project;
        const targetProjectName = targetProject.projectName;

        // 如果选择的是当前项目，无需切换
        if (targetProject.isActive) {
            vscode.window.showInformationMessage(`✅ Already on current project: ${targetProjectName}`);
            return;
        }

        // 🚀 Phase 2.1: 切换前验证 baseDir
        if (!targetProject.baseDirValidation.isValid) {
            const errorMessage = targetProject.baseDirValidation.error || 'Unknown error';

            // 显示错误并提供修复指导
            const choice = await vscode.window.showErrorMessage(
                `❌ Project Folder Path Error\n\n` +
                `Project: ${targetProjectName}\n` +
                `Error: ${errorMessage}\n\n` +
                `Please use "Project Management → Rename Project" to fix the path before switching.`,
                'Open Project Management',
                'Cancel'
            );

            if (choice === 'Open Project Management') {
                await vscode.commands.executeCommand('srs-writer.projectManagement');
            }

            return; // 阻止切换
        }

        // BaseDir 有效，显示确认信息
        const confirmMessage = `🔄 Switch to project "${targetProjectName}"?\n\nCurrent session will be saved, then load that project's session.`;

        const confirmed = await vscode.window.showInformationMessage(
            confirmMessage,
            { modal: true },
            'Continue'
        );

        if (confirmed !== 'Continue') {
            return;
        }


        // 🚀 v6.0新增：检查是否有Plan正在执行
        let hasPlanExecution = false;
        let planDescription = '';
        
        if (chatParticipant && chatParticipant.isPlanExecuting()) {
            hasPlanExecution = true;
            planDescription = chatParticipant.getCurrentPlanDescription() || 'Current task is being executed';
            
            const planConfirmMessage = `⚠️ Detected executing plan:\n\n${planDescription}\n\nIf you switch project now, the current plan will be safely stopped. Do you want to continue switching?`;
            const planConfirmed = await vscode.window.showWarningMessage(
                planConfirmMessage,
                { modal: true },
                'Confirm switch (stop plan)'
            );

            if (planConfirmed !== 'Confirm switch (stop plan)') {
                vscode.window.showInformationMessage('Project switch cancelled, plan continues execution');
                return;
            }
        }

        
        // 🚀 阶段3新增：使用会话切换而不是归档
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Switching to project "${targetProjectName}"...`,
            cancellable: false
        }, async (progress, token) => {
            try {
                let currentProgress = 0;
                
                // 阶段1：中止当前计划（如果需要）
                if (hasPlanExecution) {
                    progress.report({ 
                        increment: 0, 
                        message: '🛑 Stopping current plan...' 
                    });
                    
                    progress.report({ 
                        increment: 10, 
                        message: '⏳ Waiting for specialist to stop safely...' 
                    });
                    
                    logger.info('🛑 User confirmed to cancel plan for project switch');
                    await chatParticipant.cancelCurrentPlan();
                    currentProgress = 40;
                    
                    progress.report({ 
                        increment: 30, 
                        message: '✅ Plan stopped completely' 
                    });
                } else {
                    currentProgress = 40;
                    progress.report({ 
                        increment: 40, 
                        message: '✅ No plan to stop, continuing...' 
                    });
                }

                // 🚀 Phase 2.1: 加载项目会话（所有项目都有会话文件）
                progress.report({
                    increment: 0,
                    message: '💾 Loading project session...'
                });

                await sessionManager.switchToProjectSession(targetProjectName);
                
                // 🚀 确保会话中记录正确的Git分支信息
                await sessionManager.updateSession({
                    gitBranch: 'wip'
                });
                
                progress.report({ 
                    increment: 35, 
                    message: '✅ Session switch completed' 
                });

                // 🚀 重构：简化的wip分支检查
                progress.report({ 
                    increment: 0, 
                    message: '🌿 Ensuring on wip branch...' 
                });
                
                try {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (workspaceFolder) {
                        const gitRepoDir = workspaceFolder.uri.fsPath;
                        
                        // 🚀 简化：只检查是否需要切换到wip分支
                        const wipSwitchResult = await ensureOnWipBranchForProjectSwitch(gitRepoDir, targetProjectName);
                        
                        if (wipSwitchResult.success) {
                            if (wipSwitchResult.branchSwitched) {
                                logger.info(`🌿 [switchProject] ${wipSwitchResult.message}`);
                                progress.report({ 
                                    increment: 15, 
                                    message: `✅ Switched to wip branch` 
                                });
                                
                                // 记录分支切换到会话日志
                                await sessionManager.updateSessionWithLog({
                                    logEntry: {
                                        type: OperationType.GIT_BRANCH_SWITCHED,
                                        operation: `Switched from ${wipSwitchResult.fromBranch} to wip for project switch: ${targetProjectName}`,
                                        success: true,
                                        toolName: 'switchProject',
                                        gitOperation: {
                                            fromBranch: wipSwitchResult.fromBranch!,
                                            toBranch: 'wip',
                                            autoCommitCreated: wipSwitchResult.autoCommitCreated,
                                            autoCommitHash: wipSwitchResult.autoCommitHash,
                                            reason: 'project_switch',
                                            branchCreated: wipSwitchResult.branchCreated
                                        }
                                    }
                                });
                            } else {
                                logger.info(`✅ [switchProject] Already on wip branch`);
                                progress.report({ 
                                    increment: 15, 
                                    message: '✅ Already on wip branch' 
                                });
                            }
                        } else {
                            logger.warn(`⚠️ [switchProject] WIP branch check failed: ${wipSwitchResult.error}`);
                            progress.report({ 
                                increment: 15, 
                                message: `⚠️ WIP branch check failed: ${wipSwitchResult.error}` 
                            });
                        }
                    } else {
                        progress.report({ 
                            increment: 15, 
                            message: '⚠️ No workspace folder, skipping Git check' 
                        });
                    }
                } catch (gitError) {
                    logger.warn(`⚠️ [switchProject] Exception during WIP branch check: ${(gitError as Error).message}`);
                    progress.report({ 
                        increment: 15, 
                        message: `⚠️ Git check error: ${(gitError as Error).message}` 
                    });
                }

                // 清理项目上下文
                progress.report({ 
                    increment: 0, 
                    message: '🧹 Cleaning project context...' 
                });

                if (chatParticipant) {
                    chatParticipant.clearProjectContext();
                }
                
                progress.report({ 
                    increment: 20, 
                    message: '✅ Context cleaned' 
                });

                // 最终完成
                progress.report({ 
                    increment: 5, 
                    message: '🚀 Project switch completed!' 
                });

                // 返回成功结果
                return {
                    success: true,
                    projectName: targetProjectName,
                    sessionCreated: false  // 🚀 Phase 2.1: 所有项目都有会话文件
                };

            } catch (error) {
                logger.error(`❌ Project switch failed: ${(error as Error).message}`);
                throw error;
            }
        });

        if (result.success) {
            // 🚀 重构：简化的成功消息，专注于项目和会话状态
            const sessionInfo = result.sessionCreated ? ' (New session created)' : ' (Existing session loaded)';
            
            const successMessage = `✅ Project switch completed!\n\n📁 Current project: ${targetProjectName}${sessionInfo}\n🌿 Working on wip branch\n\n🚀 Ready to start working!`;
            await vscode.window.showInformationMessage(
                successMessage,
                { modal: false },
                'OK'
            );
            
            logger.info(`✅ Project switched successfully to ${targetProjectName}.`);
        } else {
            throw new Error('Project switch failed');
        }

    } catch (error) {
        logger.error('Failed to switch project', error as Error);
        
        // 🚀 阶段3更新：英文错误处理
        const errorMessage = `❌ Project switch failed\n\nError details: ${(error as Error).message}\n\nPlease check logs for more information.`;
        const action = await vscode.window.showErrorMessage(
            errorMessage,
            'View Logs',
            'Retry',
            'Cancel'
        );
        
        if (action === 'View Logs') {
            vscode.commands.executeCommand('workbench.action.toggleDevTools');
        } else if (action === 'Retry') {
            // 重新执行切换项目命令
            setTimeout(() => {
                vscode.commands.executeCommand('srs-writer.switchProject');
            }, 100);
        }
    }
}

/**
 * 🚀 阶段2新增：处理创建新项目的操作
 */
// 🚀 v6.0清理：移除 handleCreateNewProject 函数
// 项目创建由 project_initializer specialist 独家处理

/**
 * 🚀 v3.0新增：创建工作区并初始化功能
 */
async function createWorkspaceAndInitialize(): Promise<void> {
    try {
        logger.info('🚀 Starting workspace creation and initialization process...');

        // Step 1: 让用户选择父目录
        const parentDirResult = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select workspace parent directory',
            title: 'Select the location of the parent directory for creating the workspace'
        });

        if (!parentDirResult || parentDirResult.length === 0) {
            logger.info('User cancelled parent directory selection');
            return;
        }

        const parentDir = parentDirResult[0].fsPath;
        logger.info(`User selected parent directory: ${parentDir}`);

        // Step 2: 让用户输入工作区文件夹名称
        const workspaceName = await vscode.window.showInputBox({
            prompt: 'Enter the workspace folder name',
            placeHolder: 'e.g. my-srs-workspace',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Workspace name cannot be empty';
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(value.trim())) {
                    return 'Workspace name can only contain letters, numbers, underscores, and hyphens';
                }
                return undefined;
            }
        });

        if (!workspaceName) {
            logger.info('User cancelled workspace name input');
            return;
        }

        const trimmedWorkspaceName = workspaceName.trim();
        logger.info(`User entered workspace name: ${trimmedWorkspaceName}`);

        // Step 3: 创建工作区目录
        const workspacePath = path.join(parentDir, trimmedWorkspaceName);
        
        // 检查目录是否已存在
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(workspacePath));
            const overwrite = await vscode.window.showWarningMessage(
                `Directory "${trimmedWorkspaceName}" already exists, do you want to continue?`,
                { modal: true },
                'Continue'
            );
            
            if (overwrite !== 'Continue') {
                logger.info('User cancelled overwriting existing directory');
                return;
            }
        } catch {
            // Directory does not exist, this is expected
        }

        // 🌿 Git 操作结果变量（在外部作用域定义）
        let gitInitResult: any = null;
        let gitIgnoreResult: any = null;
        let initialCommitResult: any = null;
        
        // 显示进度指示器
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating workspace...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Creating workspace directory...' });
            
            // 创建工作区目录
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(workspacePath));
            logger.info(`✅ Workspace directory created successfully: ${workspacePath}`);

            progress.report({ increment: 30, message: 'Copying template files...' });

            // Step 4: 复制 .templates 目录
            const extensionContext = getExtensionContext();
            if (extensionContext) {
                const templatesSourcePath = path.join(extensionContext.extensionPath, '.templates');
                const templatesTargetPath = path.join(workspacePath, '.templates');

                await copyDirectoryRecursive(templatesSourcePath, templatesTargetPath);
                logger.info(`✅ Templates directory copied successfully: ${templatesTargetPath}`);

                // 🚀 Step 4.1: 创建 .vscode/settings.json 以确保一致的用户体验
                progress.report({ increment: 35, message: 'Creating workspace settings...' });

                try {
                    const vscodeDir = path.join(workspacePath, '.vscode');
                    const vscodeSettingsPath = path.join(vscodeDir, 'settings.json');

                    // 创建 .vscode 目录
                    await vscode.workspace.fs.createDirectory(vscode.Uri.file(vscodeDir));

                    // 读取模板 settings.json
                    const settingsTemplateSource = path.join(extensionContext.extensionPath, '.vscode-template', 'settings.json');
                    const settingsTemplateUri = vscode.Uri.file(settingsTemplateSource);
                    const settingsContent = await vscode.workspace.fs.readFile(settingsTemplateUri);

                    // 写入到工作区
                    await vscode.workspace.fs.writeFile(
                        vscode.Uri.file(vscodeSettingsPath),
                        settingsContent
                    );

                    logger.info(`✅ Workspace settings created: ${vscodeSettingsPath}`);
                } catch (settingsError) {
                    logger.warn(`⚠️ Failed to create workspace settings: ${(settingsError as Error).message}`);
                    // 不阻止工作区创建流程
                }
            } else {
                logger.warn('⚠️ Unable to get extension context, skipping templates copy');
            }

            // Step 4.5: 🌿 Git 仓库初始化
            progress.report({ increment: 60, message: '🌿 Initializing Git repository...' });
            
            try {
                const { initializeGitRepository, createGitIgnoreFile, createInitialCommit } = 
                    await import('./tools/atomic/git-operations');
                
                // 初始化 Git 仓库
                gitInitResult = await initializeGitRepository(workspacePath);
                if (gitInitResult.success) {
                    logger.info(`🌿 [Workspace Init] ${gitInitResult.message}`);
                    
                    // Step 4.6: 创建 .gitignore 文件
                    progress.report({ increment: 70, message: '🌿 Creating .gitignore file...' });
                    gitIgnoreResult = await createGitIgnoreFile(workspacePath);
                    
                    if (gitIgnoreResult.success) {
                        logger.info(`🌿 [Workspace Init] ${gitIgnoreResult.message}`);
                        
                        // Step 4.7: 创建初始提交
                        progress.report({ increment: 80, message: '🌿 Creating initial commit...' });
                        initialCommitResult = await createInitialCommit(workspacePath, 'init commit');
                        
                        if (initialCommitResult.success) {
                            logger.info(`🌿 [Workspace Init] ${initialCommitResult.message}`);
                        } else {
                            logger.warn(`🌿 [Workspace Init] Initial commit failed: ${initialCommitResult.error}`);
                        }

                        // 🚀 阶段1新增：Step 4.8: 创建 .session-log 目录
                        progress.report({ increment: 3, message: '📁 Creating session management directory...' });
                        
                        try {
                            const sessionLogDir = path.join(workspacePath, '.session-log');
                            await vscode.workspace.fs.createDirectory(vscode.Uri.file(sessionLogDir));
                            logger.info(`✅ Session log directory created: ${sessionLogDir}`);
                            
                            // Step 4.9: 创建主会话文件（如果不存在）
                            progress.report({ increment: 5, message: '📝 Initializing session file...' });
                            
                            const mainSessionPath = path.join(sessionLogDir, 'srs-writer-session_main.json');
                            const mainSessionUri = vscode.Uri.file(mainSessionPath);
                            
                            // 1. 检查是否需要创建新会话
                            let needCreateSession = true;
                            try {
                                const existingContent = await vscode.workspace.fs.readFile(mainSessionUri);
                                const existingSession = JSON.parse(existingContent.toString());
                                
                                // 2. 检查是否有有效的 sessionContextId
                                if (existingSession.sessionContextId && existingSession.sessionContextId !== null) {
                                    logger.info(`Valid session already exists: ${existingSession.sessionContextId}`);
                                    needCreateSession = false;
                                }
                            } catch {
                                // 文件不存在或格式错误，需要创建
                                needCreateSession = true;
                            }
                            
                            // 3. 只在需要时才创建新会话
                            if (needCreateSession) {
                                logger.info('Creating new main session...');
                                
                                // 🚀 使用 SessionManager 创建真实会话
                                const newSession = await sessionManager.createNewSession(); // 不传项目名，创建工作区级别的会话
                                
                                // 4. 验证并强制切换到主分支（如果 Git 初始化成功）
                                let actualBranch = undefined;
                                if (gitInitResult?.success) {
                                    try {
                                        const { getCurrentBranch } = await import('./tools/atomic/git-operations');
                                        const currentBranch = await getCurrentBranch(workspacePath);
                                        logger.info(`🌿 [Session Init] Current Git branch: ${currentBranch}`);
                                        
                                        if (currentBranch !== 'main') {
                                            logger.info(`🌿 [Session Init] Branch is ${currentBranch}, forcing switch to main...`);
                                            const { execSync } = await import('child_process');
                                            execSync('git checkout -f main', { cwd: workspacePath });
                                            logger.info(`🌿 [Session Init] Force switched to main branch`);
                                            actualBranch = 'main';
                                        } else {
                                            logger.info(`🌿 [Session Init] Already on main branch`);
                                            actualBranch = 'main';
                                        }
                                    } catch (branchError) {
                                        logger.warn(`🌿 [Session Init] Failed to verify/switch branch: ${(branchError as Error).message}`);
                                        actualBranch = 'main'; // 假设为 main，因为 Git 初始化成功了
                                    }
                                }
                                
                                // 5. 更新 baseDir 为工作区根目录，并添加验证后的 Git 分支信息
                                await sessionManager.updateSession({
                                    baseDir: workspacePath,
                                    gitBranch: actualBranch
                                });
                                
                                logger.info(`✅ Main session created with ID: ${newSession.sessionContextId}`);
                                logger.info(`✅ Session baseDir set to: ${workspacePath}`);
                                logger.info(`✅ Session gitBranch set to: ${actualBranch || 'undefined'}`);
                            } else {
                                logger.info(`✅ Using existing main session file: ${mainSessionPath}`);
                            }
                        } catch (sessionError) {
                            logger.warn(`⚠️ Failed to create session management directory: ${(sessionError as Error).message}`);
                            // 不阻止工作区创建流程
                        }
                    } else {
                        logger.warn(`🌿 [Workspace Init] .gitignore creation failed: ${gitIgnoreResult.error}`);
                    }
                    
                    // 🚀 新增：Step 4.8: 创建wip工作分支（在Git初始化成功后）
                    if (gitInitResult?.success && initialCommitResult?.success) {
                        progress.report({ increment: 2, message: '🌿 Creating wip working branch...' });
                        
                        try {
                            const { execSync } = await import('child_process');
                            
                            // 创建wip分支并切换到它
                            execSync('git checkout -b wip', { cwd: workspacePath });
                            logger.info(`🌿 [Workspace Init] Created and switched to wip branch for daily work`);
                            
                        } catch (wipError) {
                            logger.warn(`🌿 [Workspace Init] Failed to create wip branch: ${(wipError as Error).message}`);
                            // 保持在main分支，不阻止初始化流程
                            logger.info(`🌿 [Workspace Init] Continuing with main branch as working branch`);
                        }
                    }
                    
                } else {
                    logger.warn(`🌿 [Workspace Init] Git initialization failed: ${gitInitResult.error}`);
                }
            } catch (gitError) {
                logger.warn(`🌿 [Workspace Init] Git operations failed: ${(gitError as Error).message}`);
                gitInitResult = {
                    success: false,
                    error: (gitError as Error).message
                };
            }

            progress.report({ increment: 8, message: 'Opening new workspace...' });

            // Step 5: 在VSCode中打开新的工作区
            const workspaceUri = vscode.Uri.file(workspacePath);
            await vscode.commands.executeCommand('vscode.openFolder', workspaceUri, false);
            
            progress.report({ increment: 100, message: 'Done!' });
        });

        // 🌿 成功消息和 Git 状态反馈
        const gitInfo = gitInitResult?.success 
            ? `\n🌿 Git repository initialized (main branch)`
            : '';
        
        const successMessage = `🎉 Workspace created successfully!\n\n` +
            `📁 Location: ${workspacePath}\n` +
            `📋 Template files copied to .templates directory in the workspace${gitInfo}\n` +
            `🚀 Now you can start creating documents using @srs-writer!`;
        
        vscode.window.showInformationMessage(successMessage);
        
        // 🌿 Git 初始化失败时的友好提示
        if (gitInitResult && !gitInitResult.success) {
            setTimeout(() => {
                vscode.window.showWarningMessage(
                    `⚠️ Git initialization failed\n\n` +
                    `Please manually initialize the Git repository:\n` +
                    `1. Click the Source Control icon on the left side of VS Code\n` +
                    `2. Click the "Initialize Repository" button\n\n` +
                    `Error message: ${gitInitResult.error}`,
                    'Open Source Control'
                ).then(selection => {
                    if (selection === 'Open Source Control') {
                        vscode.commands.executeCommand('workbench.view.scm');
                    }
                });
            }, 2000); // 2 seconds later, give the user time to see the success message
        }

        logger.info('✅ Workspace created and initialized successfully');
        
    } catch (error) {
        const errorMessage = `Failed to create workspace and initialize: ${(error as Error).message}`;
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
            logger.warn(`Source directory does not exist, skipping copy: ${sourcePath}`);
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
                logger.debug(`📄 Copying file: ${name}`);
            }
        }

        logger.info(`📁 Directory copied successfully: ${sourcePath} → ${targetPath}`);
    } catch (error) {
        logger.error(`Directory copy failed: ${sourcePath} → ${targetPath}`, error as Error);
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
 * 🚀 新增：软重启插件功能
 * 退出当前项目，清空所有状态，回到插件初始状态
 */
async function restartPlugin(): Promise<void> {
    try {
        const currentSession = await sessionManager.getCurrentSession();
        const hasCurrentProject = currentSession?.projectName;

        // 显示确认对话框
        const confirmMessage = hasCurrentProject 
            ? `🔄 Exiting current project will clear all status and start over\n\n📦 Current project "${currentSession.projectName}" will be automatically archived and saved\n⚠️ All open files will be reloaded\n\nAre you sure you want to exit the current project?`
            : `🔄 Restarting plugin will clear all status and start over\n\n⚠️ All open files will be reloaded\n\nAre you sure you want to restart the plugin?`;

        const confirmed = await vscode.window.showWarningMessage(
            confirmMessage,
            { modal: true },
            'Exit project'
        );

        if (confirmed !== 'Exit project') {
            return;
        }

        // 使用进度提示执行重启操作
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Exiting current project...",
            cancellable: false
        }, async (progress) => {
            
            // 0. 🚩 设置退出意图标记
            progress.report({ increment: 10, message: "Setting exit intention flag..." });
            try {
                await extensionContext?.globalState.update('srs-writer.intentional-exit-flag', {
                    timestamp: Date.now(),
                    reason: 'user_exit_current_project'
                });
                logger.info('🚩 Set intentional exit flag for user-initiated project exit');
            } catch (error) {
                logger.warn(`Failed to set exit flag: ${(error as Error).message}`);
                // 不阻止退出流程
            }
            
            // 1. 归档当前状态
            progress.report({ increment: 20, message: "Archiving current project..." });
            if (hasCurrentProject) {
                await sessionManager.startNewSession();
                logger.info('✅ Current project session cleared successfully');
            }
            
            // 2. 全局引擎会自动清理状态
            progress.report({ increment: 25, message: "Cleaning cache..." });
            try {
                // v6.0: 全局引擎会自动适应新的会话上下文
                logger.info('✅ Global engine will adapt to new session context');
            } catch (error) {
                logger.warn(`Warning during cache cleanup: ${(error as Error).message}`);
            }
            
            // 3. 清理会话状态
            progress.report({ increment: 15, message: "Cleaning session state..." });
            try {
                await sessionManager.clearSession();
                logger.info('✅ Session cleared successfully');
            } catch (error) {
                logger.warn(`Warning during session cleanup: ${(error as Error).message}`);
            }
            
            // 3.5. 🌿 强制切换到主分支
            progress.report({ increment: 0, message: "🌿 Switching to main branch..." });
            try {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    const gitRepoDir = workspaceFolder.uri.fsPath;
                    const { checkGitRepository } = await import('./tools/atomic/git-operations');
                    
                    if (await checkGitRepository(gitRepoDir)) {
                        const { execSync } = await import('child_process');
                        
                        // 尝试切换到主分支（按优先级：main -> master -> develop）
                        const mainBranches = ['main', 'master', 'develop'];
                        let switchedSuccessfully = false;
                        
                        for (const branchName of mainBranches) {
                            try {
                                execSync(`git checkout -f ${branchName}`, { cwd: gitRepoDir });
                                logger.info(`🌿 [restartPlugin] Force switched to ${branchName} branch`);
                                switchedSuccessfully = true;
                                break;
                            } catch (error) {
                                logger.debug(`🌿 [restartPlugin] Branch ${branchName} not found or switch failed`);
                                continue;
                            }
                        }
                        
                        if (!switchedSuccessfully) {
                            logger.warn('🌿 [restartPlugin] Could not switch to any main branch (main/master/develop)');
                        }
                    } else {
                        logger.info('🌿 [restartPlugin] Not a Git repository, skipping branch switch');
                    }
                } else {
                    logger.info('🌿 [restartPlugin] No workspace folder, skipping branch switch');
                }
            } catch (error) {
                logger.warn(`🌿 [restartPlugin] Git branch switch failed: ${(error as Error).message}`);
                // 不阻止重启流程
            }
            
            // 4. 重新加载窗口
            progress.report({ increment: 30, message: "Reloading window..." });
            logger.info('🔄 Initiating window reload for soft restart');
            
            // 短暂延迟确保日志写入
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 执行软重启 - 重新加载整个VSCode窗口
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        });
        
    } catch (error) {
        logger.error('Failed to restart plugin', error as Error);
        vscode.window.showErrorMessage(`Failed to exit project: ${(error as Error).message}`);
    }
}

/**
 * 🚀 项目切换时的简化wip分支检查
 * 确保项目切换在wip分支上进行，自动处理从main分支的切换
 */
async function ensureOnWipBranchForProjectSwitch(workspaceRoot: string, targetProjectName: string): Promise<{
    success: boolean;
    message: string;
    error?: string;
    branchSwitched?: boolean;
    autoCommitCreated?: boolean;
    autoCommitHash?: string;
    fromBranch?: string;
    branchCreated?: boolean;
}> {
    try {
        logger.info(`🔍 [ensureOnWipBranchForProjectSwitch] Checking current branch for project switch: ${targetProjectName}`);
        
        const { getCurrentBranch } = await import('./tools/atomic/git-operations');
        const currentBranch = await getCurrentBranch(workspaceRoot);
        
        if (currentBranch === 'wip') {
            logger.info(`✅ [ensureOnWipBranchForProjectSwitch] Already on wip branch`);
            return {
                success: true,
                message: 'Already on wip branch',
                branchSwitched: false,
                fromBranch: currentBranch || 'unknown'
            };
        }
        
        logger.info(`🔄 [ensureOnWipBranchForProjectSwitch] Current branch: ${currentBranch}, switching to wip for project work`);
        
        // 1. 检查并自动提交当前更改
        const { checkWorkspaceGitStatus, commitAllChanges } = await import('./tools/atomic/git-operations');
        const gitStatus = await checkWorkspaceGitStatus();
        
        let autoCommitHash: string | undefined;
        
        if (gitStatus.hasChanges) {
            logger.info(`💾 [ensureOnWipBranchForProjectSwitch] Auto-committing changes in ${currentBranch} before switching to wip`);
            
            const commitResult = await commitAllChanges(workspaceRoot);
            if (!commitResult.success) {
                return {
                    success: false,
                    message: `Failed to commit changes in ${currentBranch}`,
                    error: commitResult.error
                };
            }
            
            autoCommitHash = commitResult.commitHash;
            logger.info(`✅ [ensureOnWipBranchForProjectSwitch] Auto-committed changes: ${autoCommitHash || 'no hash'}`);
        }
        
        // 2. 切换到wip分支（如果不存在则创建）
        const { checkBranchExists } = await import('./tools/atomic/git-operations');
        const wipExists = await checkBranchExists(workspaceRoot, 'wip');
        
        const { execSync } = await import('child_process');
        
        let branchCreated = false;
        if (wipExists) {
            execSync('git checkout wip', { cwd: workspaceRoot });
            logger.info(`🔄 [ensureOnWipBranchForProjectSwitch] Switched to existing wip branch`);
        } else {
            execSync('git checkout -b wip', { cwd: workspaceRoot });
            logger.info(`🆕 [ensureOnWipBranchForProjectSwitch] Created and switched to new wip branch`);
            branchCreated = true;
        }
        
        return {
            success: true,
            message: `Successfully switched to wip branch from ${currentBranch} for project work`,
            branchSwitched: true,
            autoCommitCreated: !!autoCommitHash,
            autoCommitHash,
            fromBranch: currentBranch || 'unknown',
            branchCreated
        };
        
    } catch (error) {
        const errorMessage = `Failed to ensure wip branch for project switch: ${(error as Error).message}`;
        logger.error(`❌ [ensureOnWipBranchForProjectSwitch] ${errorMessage}`);
        return {
            success: false,
            message: errorMessage,
            error: (error as Error).message
        };
    }
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

        // 🚀 v3.0新增：清理 VSCode tools adapter
        if (vsCodeToolsAdapter) {
            logger.info('Step 4: Disposing VSCode tools adapter...');
            vsCodeToolsAdapter.dispose();
            logger.info('✅ VSCode tools adapter disposed');
        }

        // 🚀 清理 Diff Manager 资源
        logger.info('Step 5: Disposing diff manager...');
        disposeDiffManager();
        logger.info('✅ Diff manager disposed');

        // 清理Logger资源
        logger.info('Step 6: Disposing logger...');
        logger.dispose();

        logger.info('SRS Writer Plugin deactivated successfully');
    } catch (error) {
        console.error('Error during SRS Writer Plugin deactivation:', (error as Error).message || error);
    }
} 