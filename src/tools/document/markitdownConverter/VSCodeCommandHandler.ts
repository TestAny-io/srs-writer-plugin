/**
 * VS Code命令处理器
 * 负责处理用户界面交互和文档转换流程
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';
import { DocumentScanner } from './DocumentScanner';
import { MarkdownConverter } from './MarkdownConverter';
import { 
    DocumentInfo, 
    ConvertResult, 
    UIQuickPickItem,
    ConverterError,
    ConverterErrorType
} from './types';
import { 
    formatFileSize, 
    formatDate, 
    generateDocumentPreview, 
    DEFAULT_CONFIG,
    localizeErrorMessage
} from './utils';

const logger = Logger.getInstance();

/**
 * VS Code命令处理器类
 */
export class VSCodeCommandHandler {
    private documentScanner: DocumentScanner;
    private markdownConverter: MarkdownConverter;

    constructor() {
        this.documentScanner = new DocumentScanner();
        this.markdownConverter = new MarkdownConverter();
        logger.info('VSCodeCommandHandler initialized');
    }

    /**
     * 主命令处理函数 - 文档格式转换
     */
    async handleConvertDocumentCommand(): Promise<void> {
        try {
            logger.info('🚀 Starting document conversion command');

            // Step 1: 扫描文档
            const scanResult = await this.scanForDocuments();
            if (!scanResult.success || scanResult.documents.length === 0) {
                await this.handleNoDocumentsFound(scanResult.error);
                return;
            }

            // Step 2: 显示文档选择器
            const selectedDocument = await this.showDocumentPicker(scanResult.documents);
            if (!selectedDocument) {
                logger.info('User cancelled document selection');
                return;
            }

            // Step 3: 显示转换确认
            const confirmed = await this.showConversionConfirmation(selectedDocument);
            if (!confirmed) {
                logger.info('User cancelled conversion confirmation');
                return;
            }

            // Step 4: 执行转换
            await this.performConversionWithProgress(selectedDocument);

        } catch (error) {
            await this.handleCommandError(error);
        }
    }

    /**
     * 扫描文档
     */
    private async scanForDocuments() {
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "扫描文档中...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "扫描workspace中的文档..." });
            
            const result = await this.documentScanner.scanWorkspaceDocuments(['.docx']);
            
            progress.report({ increment: 100, message: `找到 ${result.documents.length} 个文档` });
            
            logger.info(`Document scan completed: found ${result.documents.length} documents`);
            return result;
        });
    }

    /**
     * 处理未找到文档的情况
     */
    private async handleNoDocumentsFound(error?: string): Promise<void> {
        const message = error 
            ? `扫描文档时出错: ${error}`
            : '在当前工作区中未找到 .docx 文件';

        const detailMessage = `📄 **未找到可转换的文档**\n\n` +
                             `${message}\n\n` +
                             `💡 **建议:**\n` +
                             `• 确保workspace中有Word文档(.docx)文件\n` +
                             `• 检查文件是否在排除的目录中(如node_modules)\n` +
                             `• 刷新文件资源管理器并重试`;

        const action = await vscode.window.showWarningMessage(
            detailMessage,
            '🔄 重新扫描',
            '📁 打开文件夹',
            '✅ 了解'
        );

        switch (action) {
            case '🔄 重新扫描':
                await this.handleConvertDocumentCommand();
                break;
            case '📁 打开文件夹':
                await vscode.commands.executeCommand('workbench.action.files.openFolder');
                break;
        }
    }

    /**
     * 显示文档选择器
     */
    private async showDocumentPicker(documents: DocumentInfo[]): Promise<DocumentInfo | undefined> {
        // 按目录分组统计
        const groupStats = this.groupDocumentsByDirectory(documents);
        
        const quickPickItems: UIQuickPickItem[] = documents.map(doc => ({
            label: `📄 ${doc.name}`,
            description: `📁 ${doc.directory}`,
            detail: `📊 ${formatFileSize(doc.size)} • 🕒 ${formatDate(doc.lastModified)}`,
            document: doc
        }));

        // 添加统计信息到标题
        const statsInfo = Object.entries(groupStats)
            .map(([dir, count]) => `${dir}: ${count}个`)
            .join(', ');

        const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: `选择要转换的Word文档 (共 ${documents.length} 个文件)`,
            matchOnDescription: true,
            matchOnDetail: true,
            title: `📝 文档格式转换器 - 分布: ${statsInfo}`
        });

        return selectedItem?.document;
    }

    /**
     * 按目录分组文档
     */
    private groupDocumentsByDirectory(documents: DocumentInfo[]): Record<string, number> {
        const groups: Record<string, number> = {};
        
        documents.forEach(doc => {
            const dir = doc.directory || '根目录';
            groups[dir] = (groups[dir] || 0) + 1;
        });
        
        return groups;
    }

    /**
     * 显示转换确认对话框
     */
    private async showConversionConfirmation(document: DocumentInfo): Promise<boolean> {
        const outputFileName = `${path.basename(document.name, document.extension)}.md`;
        const outputPath = `${DEFAULT_CONFIG.defaultOutputDir}/${outputFileName}`;

        // 检查格式支持状态
        const formatSupport = this.markdownConverter.checkFormatSupport(document.absolutePath);

        if (!formatSupport.isSupported) {
            await vscode.window.showErrorMessage(
                `❌ **不支持的文件格式**\n\n` +
                `文件: ${document.name}\n` +
                `格式: ${formatSupport.format}\n` +
                `原因: ${formatSupport.reason}\n\n` +
                `💡 当前支持的格式: ${this.markdownConverter.getSupportedFormats().join(', ')}`
            );
            return false;
        }

        const message = `📄 **文档转换确认**\n\n` +
                       `🔸 **输入文件:** ${document.name}\n` +
                       `🔸 **文件路径:** ${document.path}\n` +
                       `🔸 **文件大小:** ${formatFileSize(document.size)}\n` +
                       `🔸 **最后修改:** ${formatDate(document.lastModified)}\n\n` +
                       `🔸 **输出文件:** ${outputPath}\n` +
                       `🔸 **转换格式:** ${document.extension} → .md\n\n` +
                       `确认转换此Word文档为Markdown格式吗？`;

        const result = await vscode.window.showInformationMessage(
            message,
            { modal: true },
            '📝 开始转换',
            '👁️ 预览转换',
            '❌ 取消'
        );

        if (result === '👁️ 预览转换') {
            const shouldConvert = await this.showConversionPreview(document);
            return shouldConvert;
        }

        return result === '📝 开始转换';
    }

    /**
     * 显示转换预览
     */
    private async showConversionPreview(document: DocumentInfo): Promise<boolean> {
        try {
            const previewResult = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "生成预览中...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "正在转换文档预览..." });
                const result = await this.markdownConverter.previewConversion(document.absolutePath);
                progress.report({ increment: 100, message: "预览生成完成" });
                return result;
            });

            if (!previewResult.success) {
                await vscode.window.showErrorMessage(
                    `预览生成失败: ${previewResult.error}`
                );
                return false;
            }

            // 显示预览内容
            const previewDoc = await vscode.workspace.openTextDocument({
                content: previewResult.preview,
                language: 'markdown'
            });

            await vscode.window.showTextDocument(previewDoc, {
                preview: true,
                viewColumn: vscode.ViewColumn.Beside
            });

            // 询问是否继续转换
            const continueConversion = await vscode.window.showInformationMessage(
                `📖 **转换预览**\n\n` +
                `预览文档已在右侧显示。\n` +
                `内容长度: ${previewResult.metadata?.contentLength} 字符\n\n` +
                `是否继续完整转换并保存？`,
                { modal: true },
                '📝 继续转换',
                '❌ 取消'
            );

            return continueConversion === '📝 继续转换';

        } catch (error) {
            await vscode.window.showErrorMessage(
                `预览生成失败: ${(error as Error).message}`
            );
            return false;
        }
    }

    /**
     * 执行转换（带进度显示）
     */
    private async performConversionWithProgress(document: DocumentInfo): Promise<void> {
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "文档转换中",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "准备转换..." });

            try {
                // 生成输出路径
                const outputFileName = `${path.basename(document.name, document.extension)}.md`;
                const outputPath = `${DEFAULT_CONFIG.defaultOutputDir}/${outputFileName}`;

                progress.report({ increment: 25, message: "正在转换文档..." });

                // 执行转换
                const convertResult = await this.markdownConverter.convertFile(
                    document.absolutePath, 
                    { 
                        outputPath,
                        postProcess: true,
                        preserveOriginal: true
                    }
                );

                progress.report({ increment: 100, message: "转换完成!" });

                return convertResult;

            } catch (error) {
                throw error;
            }
        });

        // 显示转换结果
        await this.showConversionResult(result);
    }

    /**
     * 显示转换结果
     */
    private async showConversionResult(result: ConvertResult): Promise<void> {
        if (result.success) {
            await this.showConversionSuccess(result);
        } else {
            await this.showConversionFailure(result);
        }
    }

    /**
     * 显示转换成功消息
     */
    private async showConversionSuccess(result: ConvertResult): Promise<void> {
        const message = `✅ **转换成功完成!**\n\n` +
                       `📁 **输出文件:** ${result.outputPath}\n` +
                       `📝 **标题:** ${result.title || '未检测到标题'}\n` +
                       `📊 **内容长度:** ${result.metadata.contentLength} 字符\n` +
                       `⏱️ **转换时间:** ${result.metadata.conversionTime}ms\n` +
                       `📅 **转换时间:** ${formatDate(new Date(result.metadata.timestamp).getTime())}`;

        const action = await vscode.window.showInformationMessage(
            message,
            '📖 打开文件',
            '📁 显示文件夹',
            '📋 复制路径',
            '✅ 完成'
        );

        await this.handleSuccessAction(action, result);
    }

    /**
     * 处理成功后的用户操作
     */
    private async handleSuccessAction(action: string | undefined, result: ConvertResult): Promise<void> {
        if (!action || !result.outputPath) return;

        try {
            switch (action) {
                case '📖 打开文件':
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (workspaceFolder) {
                        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, result.outputPath);
                        await vscode.window.showTextDocument(fileUri);
                    }
                    break;

                case '📁 显示文件夹':
                    const folderPath = path.dirname(result.outputPath);
                    await vscode.commands.executeCommand('revealFileInOS', folderPath);
                    break;

                case '📋 复制路径':
                    await vscode.env.clipboard.writeText(result.outputPath);
                    vscode.window.showInformationMessage('📋 文件路径已复制到剪贴板');
                    break;
            }
        } catch (error) {
            logger.warn(`Failed to handle success action ${action}: ${(error as Error).message}`);
            vscode.window.showWarningMessage(`执行操作失败: ${(error as Error).message}`);
        }
    }

    /**
     * 显示转换失败消息
     */
    private async showConversionFailure(result: ConvertResult): Promise<void> {
        const errorMessage = result.error || '未知错误';
        
        const message = `❌ **转换失败**\n\n` +
                       `📄 **文件:** ${path.basename(result.originalPath)}\n` +
                       `🔸 **格式:** ${result.metadata.detectedFormat}\n` +
                       `❗ **错误:** ${errorMessage}\n\n` +
                       `💡 **建议:**\n` +
                       `• 检查文件是否损坏\n` +
                       `• 确认文件格式是否受支持\n` +
                       `• 检查文件权限\n` +
                       `• 查看输出面板了解详细信息`;

        const action = await vscode.window.showErrorMessage(
            message,
            '🔄 重试',
            '📋 复制错误信息',
            '📖 查看日志',
            '✅ 了解'
        );

        await this.handleFailureAction(action, result, errorMessage);
    }

    /**
     * 处理失败后的用户操作
     */
    private async handleFailureAction(
        action: string | undefined, 
        result: ConvertResult, 
        errorMessage: string
    ): Promise<void> {
        if (!action) return;

        try {
            switch (action) {
                case '🔄 重试':
                    // 重新开始转换流程
                    await this.handleConvertDocumentCommand();
                    break;

                case '📋 复制错误信息':
                    const errorInfo = `转换失败详情:\n` +
                                     `文件: ${result.originalPath}\n` +
                                     `错误: ${errorMessage}\n` +
                                     `时间: ${result.metadata.timestamp}`;
                    
                    await vscode.env.clipboard.writeText(errorInfo);
                    vscode.window.showInformationMessage('📋 错误信息已复制到剪贴板');
                    break;

                case '📖 查看日志':
                    await vscode.commands.executeCommand('workbench.action.toggleDevTools');
                    break;
            }
        } catch (error) {
            logger.warn(`Failed to handle failure action ${action}: ${(error as Error).message}`);
        }
    }

    /**
     * 处理命令执行错误
     */
    private async handleCommandError(error: any): Promise<void> {
        logger.error('Document conversion command failed', error);

        let errorMessage = '未知错误';
        let errorType = 'Unknown';

        if (error instanceof ConverterError) {
            errorMessage = localizeErrorMessage(error);
            errorType = error.type;
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }

        const message = `❌ **命令执行失败**\n\n` +
                       `🔸 **错误类型:** ${errorType}\n` +
                       `🔸 **错误详情:** ${errorMessage}\n\n` +
                       `💡 请检查VS Code输出面板查看详细日志信息。`;

        await vscode.window.showErrorMessage(
            message,
            '📖 查看日志',
            '🔄 重试',
            '✅ 了解'
        );
    }

    /**
     * 获取状态信息（用于状态栏菜单）
     */
    async getStatusInfo(): Promise<{
        scanCount: number;
        supportedFormats: string[];
        lastScanTime?: string;
    }> {
        try {
            const scanResult = await this.documentScanner.scanWorkspaceDocuments(['.docx']);
            return {
                scanCount: scanResult.documents.length,
                supportedFormats: this.markdownConverter.getSupportedFormats(),
                lastScanTime: new Date().toISOString()
            };
        } catch (error) {
            logger.warn(`Failed to get status info: ${(error as Error).message}`);
            return {
                scanCount: 0,
                supportedFormats: this.markdownConverter.getSupportedFormats()
            };
        }
    }
}