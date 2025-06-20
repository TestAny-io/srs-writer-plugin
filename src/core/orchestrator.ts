import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { SessionContext } from '../types/session';
import { SpecialistExecutor } from './specialist-executor';
import { SyncChecker } from './sync-checker';
import { ReverseParser } from './reverse-parser';
import { SyncStatus } from '../types';

/**
 * v1.3 简化版Orchestrator - 基于官方工具
 * 使用@vscode/chat-extension-utils简化实现
 * 
 * 🏗️ 架构说明：
 * 主要路径：rules/orchestrator.md → 意图分类 → 专家执行
 * 降级路径：硬编码分类提示词（仅在文件加载失败时使用）
 * 
 * ⚠️ 重要：此文件包含降级备用代码，请勿轻易删除相关方法和注释
 */
export class Orchestrator {
    private logger = Logger.getInstance();
    private specialistExecutor: SpecialistExecutor;
    private syncChecker: SyncChecker;
    private reverseParser: ReverseParser;
    private useAIOrchestrator: boolean = true;
    private statusBarItem: vscode.StatusBarItem | null = null;
    
    constructor() {
        this.specialistExecutor = new SpecialistExecutor();
        this.syncChecker = new SyncChecker();
        this.reverseParser = new ReverseParser();
        this.loadConfiguration();
        this.initializeStatusBar();
    }

    /**
     * 处理用户输入 - v1.2增强版（集成同步检查）
     */
    public async processUserInput(
        userInput: string, 
        sessionContext: SessionContext,
        selectedModel: vscode.LanguageModelChat
    ): Promise<{ intent: string; result?: any }> {
        try {
            this.logger.info(`Processing user input with model: ${selectedModel.name}`);
            
            // 检查安全权限
            if (!await this.checkModelPermissions(selectedModel)) {
                throw new Error('No permission to use selected language model');
            }

            // Phase 1: 智能意图识别
            const intent = await this.classifyIntent(userInput, sessionContext, selectedModel);
            this.logger.info(`Classified intent: ${intent}`);

            // v1.2新增：Phase 2: 同步检查（仅在edit、lint、git时触发）
            if (['edit', 'lint', 'git'].includes(intent)) {
                this.logger.info(`Performing sync check for intent: ${intent}`);
                
                // v1.2重构：直接传入会话上下文进行同步检查
                const syncStatus = await this.syncChecker.checkSyncStatus(sessionContext);
                
                if (syncStatus.status === 'conflict') {
                    this.logger.warn(`Sync conflict detected: ${syncStatus.dirtyFile}`);
                    
                    // 更新状态栏显示冲突
                    await this.updateStatusBar(sessionContext);
                    
                    // 处理同步冲突
                    const shouldContinue = await this.handleSyncConflict(syncStatus.dirtyFile, sessionContext);
                    
                    if (!shouldContinue) {
                        return { 
                            intent, 
                            result: `操作被中止：存在未同步的文件修改 (${path.basename(syncStatus.dirtyFile)})` 
                        };
                    }
                    
                    // 同步完成后，刷新状态
                    await this.updateStatusBar(sessionContext);
                } else if (syncStatus.status === 'error') {
                    this.logger.error(`Sync check failed: ${syncStatus.message}`);
                    // 继续执行，但记录错误
                }
            }

            // Phase 3: 执行相应的专家
            const result = await this.executeIntent(intent, userInput, sessionContext, selectedModel);
            
            // v1.2新增：执行完成后更新状态栏
            if (['create', 'edit'].includes(intent)) {
                await this.updateStatusBar();
            }
            
            return { intent, result };
            
        } catch (error) {
            this.logger.error('Orchestrator processing failed', error as Error);
            
            // 降级到简单的关键词匹配
            const fallbackIntent = this.fallbackIntentDetection(userInput, sessionContext);
            return { intent: fallbackIntent, result: null };
        }
    }

    /**
     * 检查模型使用权限 - v1.3安全增强
     */
    private async checkModelPermissions(model: vscode.LanguageModelChat): Promise<boolean> {
        try {
            // v1.3修复：VSCode API中没有requestChatAccess方法
            // 直接检查模型是否可用，权限问题会在实际调用时处理
            return model && typeof model.sendRequest === 'function';
        } catch (error) {
            this.logger.warn('Failed to check model permissions');
            return false;
        }
    }

    /**
     * 智能意图分类 - 使用用户选择的模型
     */
    private async classifyIntent(
        userInput: string,
        sessionContext: SessionContext,
        selectedModel: vscode.LanguageModelChat
    ): Promise<string> {
        if (!this.useAIOrchestrator) {
            return this.fallbackIntentDetection(userInput, sessionContext);
        }

        try {
            const classificationPrompt = await this.loadOrchestratorPrompt(userInput, sessionContext);
            
            const messages = [
                vscode.LanguageModelChatMessage.User(classificationPrompt)
            ];

            const requestOptions: vscode.LanguageModelChatRequestOptions = {
                justification: 'Classify user intent for SRS operations'
            };

            const response = await selectedModel.sendRequest(messages, requestOptions);
            
            let result = '';
            for await (const fragment of response.text) {
                result += fragment;
            }

            // 解析AI返回的意图
            const intent = this.parseIntentFromResponse(result);
            return this.validateIntent(intent);
            
        } catch (error) {
            this.logger.error('AI intent classification failed', error as Error);
            return this.fallbackIntentDetection(userInput, sessionContext);
        }
    }

    /**
     * 从rules/orchestrator.md加载意图分类提示词
     */
    private async loadOrchestratorPrompt(userInput: string, sessionContext: SessionContext): Promise<string> {
        try {
            // 查找orchestrator.md文件路径
            const possiblePaths = [
                path.join(__dirname, '../../rules/orchestrator.md'),  // 开发环境
                path.join(__dirname, '../rules/orchestrator.md'),     // 打包环境备选1
                path.join(__dirname, 'rules/orchestrator.md'),        // 打包环境备选2
                path.join(process.cwd(), 'rules/orchestrator.md'),     // 工作目录
            ];
            
            // 如果是VSCode扩展环境，使用扩展上下文路径
            try {
                const extension = vscode.extensions.getExtension('testany-co.srs-writer-plugin');
                if (extension) {
                    possiblePaths.unshift(path.join(extension.extensionPath, 'rules/orchestrator.md'));
                }
            } catch (error) {
                this.logger.warn('Failed to get extension path, using fallback paths');
            }
            
            // 查找第一个存在的路径
            const orchestratorPath = possiblePaths.find(filePath => fs.existsSync(filePath));
            
            if (!orchestratorPath) {
                this.logger.warn(`Orchestrator prompt file not found. Tried paths: ${possiblePaths.join(', ')}`);
                return this.buildClassificationPrompt(userInput, sessionContext); // 降级到硬编码版本
            }
            
            // 读取文件内容
            let promptTemplate = fs.readFileSync(orchestratorPath, 'utf8');
            
            // 替换模板变量
            const hasActiveProject = !!sessionContext.projectName;
            const projectName = sessionContext.projectName || 'none';
            
            promptTemplate = promptTemplate.replace(/\{\{USER_INPUT\}\}/g, userInput);
            promptTemplate = promptTemplate.replace(/\{\{HAS_ACTIVE_PROJECT\}\}/g, hasActiveProject.toString());
            promptTemplate = promptTemplate.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
            promptTemplate = promptTemplate.replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString());
            
            this.logger.info(`Loaded orchestrator prompt from: ${orchestratorPath}`);
            return promptTemplate;
            
        } catch (error) {
            this.logger.error('Failed to load orchestrator prompt file', error as Error);
            // 降级到硬编码版本
            return this.buildClassificationPrompt(userInput, sessionContext);
        }
    }

    /**
     * 构建意图分类提示词（降级备用版本）
     * 
     * ⚠️ 重要：此方法仅作为降级备用，当 rules/orchestrator.md 加载失败时使用
     * 🚫 请勿删除此注释和方法 - 这是系统稳定性的重要保障
     * 📋 主要路径应使用 rules/orchestrator.md 文件
     * 🔄 未来版本可能会移除此降级机制
     */
    private buildClassificationPrompt(userInput: string, sessionContext: SessionContext): string {
        const hasActiveProject = !!sessionContext.projectName;
        const projectName = sessionContext.projectName || 'none';

        return `# Role
You are an intent classifier for an SRS (Software Requirements Specification) writing assistant.

# Context
- User has active project: ${hasActiveProject}
- Current project name: ${projectName}
- User input: "${userInput}"

# Task
Classify the user's intent and respond with ONLY a JSON object in this exact format:

{
  "intent": "create|edit|lint|help|git",
  "confidence": 0.95,
  "reasoning": "brief explanation"
}

# Classification Rules

**create** - User wants to create a new SRS document:
- Keywords: "创建", "新建", "做一个", "开发", "create", "new", "build"
- Examples: "我想做一个图书管理系统", "创建电商平台需求"

**edit** - User wants to modify existing project (only if has active project):
- Keywords: "修改", "编辑", "添加", "删除", "更新", "edit", "add", "modify"
- Condition: Must have active project
- Examples: "添加用户认证", "修改性能需求"

**lint** - User wants quality check:
- Keywords: "检查", "质量", "验证", "lint", "check", "review"
- Examples: "检查文档质量", "验证需求格式"

**help** - User needs assistance:
- Keywords: "帮助", "help", "如何", "怎么", "什么"
- Examples: "help", "如何使用", "怎么编辑"

**git** - User wants version control operations:
- Keywords: "git", "commit", "提交", "push", "版本"
- Examples: "提交代码", "创建PR"

# Special Cases
- If user wants to edit but has no active project → classify as "create"
- If input is ambiguous → classify as "help"
- Default fallback → "create"

Classify this input now:`;
    }

    /**
     * 从AI响应中解析意图
     */
    private parseIntentFromResponse(response: string): string {
        try {
            // 尝试解析JSON响应
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.intent) {
                    return parsed.intent.toLowerCase();
                }
            }
        } catch (error) {
            this.logger.warn('Failed to parse JSON intent response');
        }

        // 降级到关键词匹配
        const input = response.toLowerCase();
        if (input.includes('create')) return 'create';
        if (input.includes('edit')) return 'edit';
        if (input.includes('lint')) return 'lint';
        if (input.includes('help')) return 'help';
        if (input.includes('git')) return 'git';

        return 'create'; // 默认为创建
    }

    /**
     * 验证意图的有效性
     */
    private validateIntent(intent: string): string {
        const validIntents = ['create', 'edit', 'lint', 'help', 'git'];
        if (validIntents.includes(intent)) {
            return intent;
        }
        
        this.logger.warn(`Invalid intent: ${intent}, defaulting to 'create'`);
        return 'create';
    }

    /**
     * 执行相应的意图
     */
    private async executeIntent(
        intent: string,
        userInput: string,
        sessionContext: SessionContext,
        selectedModel: vscode.LanguageModelChat
    ): Promise<any> {
        const context = {
            userInput,
            sessionData: sessionContext,
            intent,
            timestamp: new Date().toISOString()
        };

        switch (intent) {
            case 'create':
                return await this.specialistExecutor.executeSpecialist(
                    '100_create_srs', 
                    context, 
                    selectedModel
                );
                
            case 'edit':
                if (!sessionContext.projectName) {
                    return 'No active project found for editing. Please create a project first.';
                }
                return await this.specialistExecutor.executeSpecialist(
                    '200_edit_srs', 
                    context, 
                    selectedModel
                );
                
            case 'prototype':
                return await this.specialistExecutor.executeSpecialist(
                    '300_prototype', 
                    context, 
                    selectedModel
                );
                
            case 'lint':
                return await this.specialistExecutor.executeSpecialist(
                    '400_lint_check', 
                    context, 
                    selectedModel
                );
                
            case 'git':
                return await this.specialistExecutor.executeSpecialist(
                    '500_git_operations', 
                    context, 
                    selectedModel
                );
                
            case 'help':
                return await this.specialistExecutor.executeSpecialist(
                    'help_response', 
                    context, 
                    selectedModel
                );
                
            default:
                throw new Error(`Unknown intent: ${intent}`);
        }
    }



    /**
     * 降级的关键词匹配意图识别
     */
    private fallbackIntentDetection(userInput: string, sessionContext: SessionContext): string {
        const input = userInput.toLowerCase();
        
        // 帮助关键词
        if (input.includes('help') || input.includes('帮助') || input.includes('如何')) {
            return 'help';
        }
        
        // 质量检查关键词
        if (input.includes('lint') || input.includes('检查') || input.includes('质量')) {
            return 'lint';
        }
        
        // 编辑关键词 - 只有在有活跃项目时才能编辑
        if (sessionContext.projectName && 
            (input.includes('edit') || input.includes('modify') || 
             input.includes('change') || input.includes('update') ||
             input.includes('编辑') || input.includes('修改') || 
             input.includes('更新') || input.includes('添加'))) {
            return 'edit';
        }
        
        // Git操作关键词
        if (input.includes('git') || input.includes('commit') || input.includes('push')) {
            return 'git';
        }
        
        // 默认为创建
        return 'create';
    }

    /**
     * 加载配置
     */
    private loadConfiguration(): void {
        try {
            // 从工作区配置读取设置
            const config = vscode.workspace.getConfiguration('srs-writer');
            this.useAIOrchestrator = config.get('useAIOrchestrator', true);
            this.logger.info(`Orchestrator configuration loaded: AI=${this.useAIOrchestrator}`);
        } catch (error) {
            this.logger.warn(`Failed to load configuration: ${(error as Error).message}`);
        }
    }

    /**
     * 动态切换AI/代码模式
     */
    public setAIMode(enabled: boolean): void {
        this.useAIOrchestrator = enabled;
        this.logger.info(`Orchestrator AI mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * 获取当前状态
     */
    public getStatus(): { aiMode: boolean; specialistsAvailable: boolean } {
        return {
            aiMode: this.useAIOrchestrator,
            specialistsAvailable: this.specialistExecutor.getSupportedSpecialists().length > 0
        };
    }

    /**
     * 检查特定专家是否可用
     */
    public canHandleIntent(intent: string): boolean {
        const specialistMapping: { [key: string]: string } = {
            'create': '100_create_srs',
            'edit': '200_edit_srs',
            'prototype': '300_prototype',
            'lint': '400_lint_check',
            'git': '500_git_operations',
            'help': 'help_response'
        };

        const specialistId = specialistMapping[intent];
        return specialistId ? this.specialistExecutor.canHandle(specialistId) : false;
    }

    /**
     * v1.2新增：初始化状态栏显示
     */
    private initializeStatusBar(): void {
        try {
            this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
            this.statusBarItem.text = '$(sync) SRS同步检查中...';
            this.statusBarItem.command = 'srs-writer.showSyncStatus';
            this.statusBarItem.show();
            
            // v1.2重构：初始化时显示基本状态，无需sessionContext
            // 真正的状态会在processUserInput时更新
            
            this.logger.info('Status bar initialized');
        } catch (error) {
            this.logger.error('Failed to initialize status bar', error as Error);
        }
    }

    /**
     * v1.2新增：更新状态栏显示（重构版：需要sessionContext参数）
     */
    private async updateStatusBar(sessionContext?: SessionContext): Promise<void> {
        if (!this.statusBarItem || !sessionContext) return;

        try {
            const status = await this.syncChecker.checkSyncStatus(sessionContext);
            
            if (status.status === 'synced') {
                this.statusBarItem.text = '$(check) SRS已同步';
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = '所有文件已与母文档同步';
            } else if (status.status === 'conflict') {
                const fileName = path.basename(status.dirtyFile);
                this.statusBarItem.text = `$(warning) 同步冲突: ${fileName}`;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                this.statusBarItem.tooltip = `检测到文件 ${fileName} 有未同步的修改`;
            } else if (status.status === 'error') {
                this.statusBarItem.text = '$(error) SRS同步错误';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                this.statusBarItem.tooltip = `同步检查失败: ${status.message}`;
            }
        } catch (error) {
            this.statusBarItem.text = '$(error) SRS同步错误';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            this.statusBarItem.tooltip = '同步检查失败';
            this.logger.error('Failed to update status bar', error as Error);
        }
    }

    /**
     * v1.2新增：更新会话上下文并刷新同步状态（重构版：SyncChecker现在是无状态的）
     */
    public updateSessionContext(sessionContext: SessionContext): void {
        // v1.2重构：SyncChecker现在是无状态的，不需要更新上下文
        // 直接更新状态栏
        this.updateStatusBar(sessionContext);
    }

    /**
     * v1.2新增：处理同步冲突（重构版：需要sessionContext参数）
     */
    private async handleSyncConflict(conflictFile: string, sessionContext: SessionContext): Promise<boolean> {
        this.logger.info(`Handling sync conflict for file: ${conflictFile}`);

        // 显示diff视图让用户查看具体变更
        try {
            await this.showDiffView(conflictFile, sessionContext);
            
            // 询问用户是否要同步修改
            const choice = await vscode.window.showWarningMessage(
                `检测到 ${path.basename(conflictFile)} 有未同步的修改。`,
                { modal: false },
                '同步到母文档',
                '忽略修改',
                '查看详情'
            );

            switch (choice) {
                case '同步到母文档':
                    // v1.2修复：传入母文档路径，遵循依赖注入原则
                    if (!sessionContext.baseDir) {
                        throw new Error('无法获取项目目录信息');
                    }
                    const motherDocPath = path.join(sessionContext.baseDir, 'mother_document.md');
                    await this.reverseParser.syncToMotherDocument(conflictFile, motherDocPath);
                    await this.updateStatusBar(sessionContext);
                    vscode.window.showInformationMessage('文件已同步到母文档');
                    return true;
                    
                case '查看详情':
                    await this.showDiffView(conflictFile, sessionContext);
                    return false;
                    
                default:
                    return false;
            }
        } catch (error) {
            this.logger.error('Failed to handle sync conflict', error as Error);
            vscode.window.showErrorMessage(`处理同步冲突失败: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * v1.2新增：显示diff视图（重构版：需要sessionContext来构建路径）
     */
    private async showDiffView(filePath: string, sessionContext?: SessionContext): Promise<void> {
        try {
            if (!sessionContext?.baseDir) {
                throw new Error('无法获取项目目录信息');
            }

            const motherDocPath = path.join(sessionContext.baseDir, 'mother_document.md');
            
            // 检查母文档是否存在
            const motherUri = vscode.Uri.file(motherDocPath);
            try {
                await vscode.workspace.fs.stat(motherUri);
            } catch {
                throw new Error('母文档不存在');
            }

            const fileUri = vscode.Uri.file(filePath);
            
            await vscode.commands.executeCommand(
                'vscode.diff',
                motherUri,
                fileUri,
                `母文档 ↔ ${path.basename(filePath)}`
            );
        } catch (error) {
            this.logger.error('Failed to show diff view', error as Error);
            vscode.window.showErrorMessage(`无法显示差异视图: ${(error as Error).message}`);
        }
    }

    /**
     * v1.2新增：清理资源
     */
    public dispose(): void {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            this.statusBarItem = null;
        }
    }
}
