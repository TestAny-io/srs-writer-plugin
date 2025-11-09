import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { Logger } from './logger';

const logger = Logger.getInstance();

/**
 * 虚拟文档提供者
 * 用于提供临时diff内容，不会在编辑器中打开
 */
class DiffContentProvider implements vscode.TextDocumentContentProvider {
    private contentCache = new Map<string, string>();

    provideTextDocumentContent(uri: vscode.Uri): string {
        const content = this.contentCache.get(uri.toString());
        return content || '';
    }

    setContent(uri: vscode.Uri, content: string): void {
        this.contentCache.set(uri.toString(), content);
    }

    deleteContent(uri: vscode.Uri): void {
        this.contentCache.delete(uri.toString());
    }

    clear(): void {
        this.contentCache.clear();
    }
}

// 全局虚拟文档提供者
const diffContentProvider = new DiffContentProvider();
let diffProviderDisposable: vscode.Disposable | null = null;

/**
 * 注册虚拟文档提供者
 * 延迟初始化：只在实际使用时才注册，避免测试环境中的问题
 */
function registerDiffContentProvider(): void {
    if (!diffProviderDisposable) {
        try {
            diffProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
                'srs-diff',
                diffContentProvider
            );
            logger.info('📋 Diff content provider registered');
        } catch (error) {
            // 在测试环境中可能会失败，这是正常的
            logger.debug(`Diff content provider registration skipped: ${(error as Error).message}`);
        }
    }
}

/**
 * 累积diff会话管理器
 * 跟踪文件的初始状态，实现累积diff功能
 */
class CumulativeDiffManager {
    // 存储文件的初始内容：Map<filePath, initialContent>
    private fileInitialStates: Map<string, string> = new Map();

    // 存储打开的临时文档，用于清理：Map<filePath, Uri>
    private temporaryDocuments: Map<string, vscode.Uri> = new Map();

    // 文件关闭监听器
    private closeListener: vscode.Disposable | null = null;

    /**
     * 初始化文件关闭监听器（延迟初始化，避免测试环境问题）
     */
    private initializeCloseListener(): void {
        if (this.closeListener) {
            return; // 已经初始化
        }

        try {
            // 监听文件关闭事件，清除对应的初始状态
            this.closeListener = vscode.workspace.onDidCloseTextDocument(document => {
                logger.info(`🔍 [CumulativeDiffManager] onDidCloseTextDocument triggered:`);
                logger.info(`🔍 [CumulativeDiffManager]   - URI: ${document.uri.toString()}`);
                logger.info(`🔍 [CumulativeDiffManager]   - scheme: ${document.uri.scheme}`);
                logger.info(`🔍 [CumulativeDiffManager]   - fsPath: ${document.uri.fsPath}`);
                logger.info(`🔍 [CumulativeDiffManager]   - isDirty: ${document.isDirty}`);

                const filePath = document.uri.fsPath;

                // 只处理真实文件的关闭（不是untitled临时文档）
                if (document.uri.scheme === 'file') {
                    if (this.fileInitialStates.has(filePath)) {
                        logger.info(`📁 文件已关闭，清除累积diff状态: ${filePath}`);
                        this.fileInitialStates.delete(filePath);

                        // 清理对应的临时文档引用
                        this.temporaryDocuments.delete(filePath);
                    } else {
                        logger.debug(`🔍 [CumulativeDiffManager] File closed but no initial state stored: ${filePath}`);
                    }
                } else {
                    logger.debug(`🔍 [CumulativeDiffManager] Non-file document closed (scheme=${document.uri.scheme}), ignoring`);
                }
            });
        } catch (error) {
            // 在测试环境中可能会失败，这是正常的
            logger.debug(`CumulativeDiffManager listener initialization skipped: ${(error as Error).message}`);
        }
    }

    /**
     * 获取文件的初始状态（用于累积diff）
     * 如果是第一次编辑，存储并返回当前内容作为初始状态
     * 如果已经有初始状态，返回存储的初始状态
     *
     * @param filePath 文件路径
     * @param currentContent 当前内容（首次编辑时传入）
     * @returns 初始状态内容
     */
    public getOrSetInitialState(filePath: string, currentContent: string): string {
        // 确保监听器已初始化（延迟初始化）
        this.initializeCloseListener();

        if (this.fileInitialStates.has(filePath)) {
            const initialState = this.fileInitialStates.get(filePath)!;
            logger.info(`♻️ 使用已存储的初始状态进行累积diff: ${filePath}`);
            return initialState;
        } else {
            // 首次编辑，存储初始状态
            this.fileInitialStates.set(filePath, currentContent);
            logger.info(`💾 存储初始状态用于累积diff: ${filePath}`);
            return currentContent;
        }
    }

    /**
     * 检查文件是否已经有累积的diff状态
     */
    public hasInitialState(filePath: string): boolean {
        return this.fileInitialStates.has(filePath);
    }

    /**
     * 记录临时文档的URI（用于后续清理）
     */
    public registerTemporaryDocument(filePath: string, uri: vscode.Uri): void {
        this.temporaryDocuments.set(filePath, uri);
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        if (this.closeListener) {
            this.closeListener.dispose();
            this.closeListener = null;
        }
        this.fileInitialStates.clear();
        this.temporaryDocuments.clear();
    }
}

// 全局单例管理器
const diffManager = new CumulativeDiffManager();

/**
 * 显示文件的diff视图（类似Claude Code的行为）
 * 支持累积diff：当文件保持打开状态时，所有编辑都会与初始状态对比
 * 当文件关闭后，累积状态会被清除
 *
 * @param filePath 文件的绝对路径
 * @param originalContent 原始文件内容（写入前的内容，如果是新文件则为undefined）
 * @param newContent 新的文件内容
 * @returns Promise<void>
 */
export async function showFileDiff(
    filePath: string,
    originalContent: string | undefined,
    newContent: string
): Promise<void> {
    // 确保虚拟文档提供者已注册（延迟初始化）
    registerDiffContentProvider();

    logger.info(`🔍 [showFileDiff] START - filePath: ${filePath}`);
    logger.info(`🔍 [showFileDiff] originalContent defined: ${originalContent !== undefined}, length: ${originalContent?.length || 0}`);
    logger.info(`🔍 [showFileDiff] newContent length: ${newContent.length}`);

    try {
        const fileUri = vscode.Uri.file(filePath);
        logger.info(`🔍 [showFileDiff] Created fileUri: scheme=${fileUri.scheme}, fsPath=${fileUri.fsPath}`);

        const fileExists = originalContent !== undefined;
        logger.info(`🔍 [showFileDiff] fileExists: ${fileExists}`);

        // 🚀 累积diff逻辑：
        // 如果这个文件已经有初始状态（之前编辑过且未关闭），使用存储的初始状态
        // 否则，使用当前的originalContent作为初始状态
        const baselineContent = fileExists
            ? diffManager.getOrSetInitialState(filePath, originalContent)
            : '';

        logger.info(`🔍 [showFileDiff] baselineContent length: ${baselineContent.length}`);
        logger.info(`🔍 [showFileDiff] Has initial state stored: ${diffManager.hasInitialState(filePath)}`);

        // 如果内容没有变化（与baseline对比），不显示diff
        if (baselineContent === newContent) {
            logger.info(`⏭️  内容未变化，跳过diff显示: ${filePath}`);
            return;
        }

        const fileName = filePath.split('/').pop() || 'untitled';
        const isInitialEdit = !diffManager.hasInitialState(filePath) || !fileExists;

        logger.info(`📊 显示文件diff: ${filePath} (${fileExists ? (isInitialEdit ? '首次修改' : '累积修改') : '新建'})`);

        // 推断文件语言（根据扩展名）
        const fileExtension = fileName.split('.').pop() || '';
        const languageId = getLanguageId(fileExtension);
        logger.info(`🔍 [showFileDiff] File extension: ${fileExtension}, languageId: ${languageId}`);

        // 🚀 使用虚拟文档提供者创建临时URI，避免创建dirty的untitled文档
        logger.info(`🔍 [showFileDiff] Creating virtual document URI for diff`);

        // 🎯 关键修复：为同一个文件使用固定的虚拟URI，避免每次都创建新文档
        // 使用文件路径的hash作为唯一标识，而不是timestamp
        const virtualUri = vscode.Uri.parse(`srs-diff:${encodeURIComponent(filePath)}.original`);

        // 将内容存储到虚拟文档提供者（会覆盖之前的内容）
        diffContentProvider.setContent(virtualUri, baselineContent);

        logger.info(`🔍 [showFileDiff] Virtual document created:`);
        logger.info(`🔍 [showFileDiff]   - URI: ${virtualUri.toString()}`);
        logger.info(`🔍 [showFileDiff]   - scheme: ${virtualUri.scheme}`);
        logger.info(`🔍 [showFileDiff]   - Content length: ${baselineContent.length}`);

        // 记录虚拟文档URI（用于后续清理）
        diffManager.registerTemporaryDocument(filePath, virtualUri);

        // 🎯 产品要求：diff视图的tab标题只显示文件名，不需要额外装饰
        const title = fileName;

        logger.info(`🔍 [showFileDiff] BEFORE vscode.diff command:`);
        logger.info(`🔍 [showFileDiff]   - leftUri: ${virtualUri.toString()}`);
        logger.info(`🔍 [showFileDiff]   - rightUri: ${fileUri.toString()}`);
        logger.info(`🔍 [showFileDiff]   - title: ${title} (${fileExists ? (isInitialEdit ? '首次修改' : '累积修改') : '新建'})`);

        // 🚨 关键追踪：在执行diff命令前后检查打开的文档
        const beforeDocs = vscode.workspace.textDocuments;
        logger.info(`🔍 [showFileDiff] Documents BEFORE diff command: ${beforeDocs.length} docs`);

        await vscode.commands.executeCommand(
            'vscode.diff',
            virtualUri,
            fileUri,
            title
        );

        // 🚨 关键追踪：检查diff命令执行后的文档
        const afterDocs = vscode.workspace.textDocuments;
        logger.info(`🔍 [showFileDiff] Documents AFTER diff command: ${afterDocs.length} docs`);

        // 🚨 对比前后差异
        const newDocs = afterDocs.filter(afterDoc =>
            !beforeDocs.some(beforeDoc => beforeDoc.uri.toString() === afterDoc.uri.toString())
        );
        if (newDocs.length > 0) {
            logger.warn(`⚠️ [showFileDiff] NEW documents appeared after vscode.diff command: ${newDocs.length} docs`);
            newDocs.forEach((doc, index) => {
                logger.warn(`⚠️ [showFileDiff]   [${index}] NEW DOC - URI=${doc.uri.toString()}, scheme=${doc.uri.scheme}, isDirty=${doc.isDirty}`);
            });
        } else {
            logger.info(`✅ [showFileDiff] No new documents appeared - Problem fixed!`);
        }

        logger.info(`✅ Diff视图已打开: ${fileName} (${fileExists ? (isInitialEdit ? '首次修改' : '累积修改') : '新建'})`);
        logger.info(`🔍 [showFileDiff] END - Success`);

    } catch (error) {
        logger.error(`❌ [showFileDiff] 显示diff视图失败: ${filePath}`, error as Error);
        logger.error(`❌ [showFileDiff] Error stack: ${(error as Error).stack}`);
        // 不抛出错误，避免影响文件写入流程
    }
}

/**
 * 清理diff管理器资源（在扩展deactivate时调用）
 */
export function disposeDiffManager(): void {
    diffManager.dispose();
    diffContentProvider.clear();
    if (diffProviderDisposable) {
        diffProviderDisposable.dispose();
        diffProviderDisposable = null;
        logger.info('📋 Diff content provider disposed');
    }
}

/**
 * 根据文件扩展名推断语言ID
 */
function getLanguageId(extension: string): string {
    const languageMap: Record<string, string> = {
        'md': 'markdown',
        'js': 'javascript',
        'ts': 'typescript',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml',
        'html': 'html',
        'css': 'css',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'sh': 'shellscript',
        'txt': 'plaintext'
    };
    return languageMap[extension.toLowerCase()] || 'plaintext';
}

/**
 * 显示两个文件URI之间的diff视图
 *
 * @param originalUri 原始文件URI
 * @param modifiedUri 修改后文件URI
 * @param title Diff视图标题
 */
export async function showUriDiff(
    originalUri: vscode.Uri,
    modifiedUri: vscode.Uri,
    title?: string
): Promise<void> {
    try {
        const displayTitle = title || `${modifiedUri.path.split('/').pop()} (对比)`;

        await vscode.commands.executeCommand(
            'vscode.diff',
            originalUri,
            modifiedUri,
            displayTitle
        );

        logger.info(`✅ Diff视图已打开: ${displayTitle}`);
    } catch (error) {
        logger.error('显示diff视图失败', error as Error);
    }
}
