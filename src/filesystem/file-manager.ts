import * as vscode from 'vscode';
import { IFileSystemManager, ParsedArtifacts } from '../types';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';

/**
 * 文件系统管理器
 * 负责所有文件系统操作，如创建目录、写入文件
 */
export class FileManager implements IFileSystemManager {
    private logger = Logger.getInstance();

    /**
     * 将解析后的产物写入本地文件系统
     * @param artifacts 解析器返回的文件对象集
     * @param baseDir 要写入的基础目录名
     */
    public async writeArtifacts(artifacts: ParsedArtifacts, baseDir: string): Promise<void> {
        this.logger.info(`Writing ${Object.keys(artifacts).length} artifacts to directory: ${baseDir}`);

        try {
            // 获取当前工作区
            const workspaceFolder = this.getCurrentWorkspaceFolder();
            if (!workspaceFolder) {
                throw new Error('No workspace folder is open. Please open a folder in VSCode first.');
            }

            // 创建项目目录
            const projectDirUri = vscode.Uri.joinPath(workspaceFolder.uri, baseDir);
            await this.ensureDirectoryExists(projectDirUri);

            // 写入所有文件
            const writePromises = Object.entries(artifacts).map(([fileName, content]) =>
                this.writeFile(projectDirUri, fileName, content)
            );

            await Promise.all(writePromises);

            this.logger.info(`Successfully wrote ${Object.keys(artifacts).length} files to ${baseDir}`);

            // 显示成功消息并提供打开选项
            await this.showSuccessMessage(projectDirUri, baseDir);

        } catch (error) {
            this.logger.error('Failed to write artifacts', error as Error);
            throw error;
        }
    }

    /**
     * 确保目录存在，如果不存在则创建
     */
    private async ensureDirectoryExists(dirUri: vscode.Uri): Promise<void> {
        try {
            await vscode.workspace.fs.stat(dirUri);
            this.logger.info(`Directory already exists: ${dirUri.fsPath}`);
        } catch (error) {
            // 目录不存在，创建它
            await vscode.workspace.fs.createDirectory(dirUri);
            this.logger.info(`Created directory: ${dirUri.fsPath}`);
        }
    }

    /**
     * 写入单个文件
     */
    private async writeFile(baseDirUri: vscode.Uri, fileName: string, content: string): Promise<void> {
        try {
            const fileUri = vscode.Uri.joinPath(baseDirUri, fileName);
            const encoder = new TextEncoder();
            const contentBytes = encoder.encode(content);

            await vscode.workspace.fs.writeFile(fileUri, contentBytes);
            this.logger.info(`Successfully wrote file: ${fileName}`);

        } catch (error) {
            this.logger.error(`Failed to write file: ${fileName}`, error as Error);
            throw new Error(`Failed to write file ${fileName}: ${(error as Error).message}`);
        }
    }

    /**
     * 获取当前工作区文件夹
     */
    private getCurrentWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }

        // 如果有多个工作区文件夹，返回第一个
        return workspaceFolders[0];
    }

    /**
     * 显示成功消息并提供后续操作选项
     */
    private async showSuccessMessage(projectDirUri: vscode.Uri, baseDir: string): Promise<void> {
        const actions = ['打开文件夹', '查看SRS.md', '忽略'];
        
        const selectedAction = await vscode.window.showInformationMessage(
            `🎉 SRS文档已成功生成到 "${baseDir}" 目录！`,
            ...actions
        );

        switch (selectedAction) {
            case '打开文件夹':
                await this.openDirectory(projectDirUri);
                break;
                
            case '查看SRS.md':
                await this.openMainSRSFile(projectDirUri);
                break;
                
            default:
                // 用户选择忽略或关闭了对话框
                break;
        }
    }

    /**
     * 在文件浏览器中打开目录
     */
    private async openDirectory(dirUri: vscode.Uri): Promise<void> {
        try {
            await vscode.commands.executeCommand('revealFileInOS', dirUri);
        } catch (error) {
            this.logger.warn('Failed to open directory in OS: ' + (error as Error).message);
            // 备选方案：在VSCode中显示文件夹
            try {
                await vscode.commands.executeCommand('workbench.files.action.focusFilesExplorer');
                await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
            } catch (fallbackError) {
                this.logger.error('Failed to focus on files explorer', fallbackError as Error);
            }
        }
    }

    /**
     * 打开主SRS文档
     */
    private async openMainSRSFile(projectDirUri: vscode.Uri): Promise<void> {
        try {
            const srsFileUri = vscode.Uri.joinPath(projectDirUri, 'SRS.md');
            
            // 检查文件是否存在
            await vscode.workspace.fs.stat(srsFileUri);
            
            // 在编辑器中打开文件
            const document = await vscode.workspace.openTextDocument(srsFileUri);
            await vscode.window.showTextDocument(document, {
                preview: false,
                viewColumn: vscode.ViewColumn.One
            });
            
            this.logger.info('Opened SRS.md in editor');
            
        } catch (error) {
            this.logger.error('Failed to open SRS.md', error as Error);
            vscode.window.showWarningMessage('无法打开SRS.md文件，请手动查看生成的文件。');
        }
    }

    /**
     * 检查文件是否存在
     */
    public async fileExists(workspaceRelativePath: string): Promise<boolean> {
        try {
            const workspaceFolder = this.getCurrentWorkspaceFolder();
            if (!workspaceFolder) {
                return false;
            }

            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, workspaceRelativePath);
            await vscode.workspace.fs.stat(fileUri);
            return true;
            
        } catch (error) {
            return false;
        }
    }

    /**
     * 读取文件内容
     */
    public async readFile(workspaceRelativePath: string): Promise<string> {
        try {
            const workspaceFolder = this.getCurrentWorkspaceFolder();
            if (!workspaceFolder) {
                throw new Error('No workspace folder is open');
            }

            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, workspaceRelativePath);
            const fileData = await vscode.workspace.fs.readFile(fileUri);
            const decoder = new TextDecoder();
            
            return decoder.decode(fileData);
            
        } catch (error) {
            this.logger.error(`Failed to read file: ${workspaceRelativePath}`, error as Error);
            throw error;
        }
    }

    /**
     * 删除文件或目录
     */
    public async deleteFileOrDirectory(workspaceRelativePath: string): Promise<void> {
        try {
            const workspaceFolder = this.getCurrentWorkspaceFolder();
            if (!workspaceFolder) {
                throw new Error('No workspace folder is open');
            }

            const targetUri = vscode.Uri.joinPath(workspaceFolder.uri, workspaceRelativePath);
            await vscode.workspace.fs.delete(targetUri, { recursive: true, useTrash: true });
            
            this.logger.info(`Deleted: ${workspaceRelativePath}`);
            
        } catch (error) {
            this.logger.error(`Failed to delete: ${workspaceRelativePath}`, error as Error);
            throw error;
        }
    }

    /**
     * 列出目录中的文件
     */
    public async listDirectory(workspaceRelativePath: string): Promise<string[]> {
        try {
            const workspaceFolder = this.getCurrentWorkspaceFolder();
            if (!workspaceFolder) {
                throw new Error('No workspace folder is open');
            }

            const dirUri = vscode.Uri.joinPath(workspaceFolder.uri, workspaceRelativePath);
            const entries = await vscode.workspace.fs.readDirectory(dirUri);
            
            return entries.map(([name, type]) => name);
            
        } catch (error) {
            this.logger.error(`Failed to list directory: ${workspaceRelativePath}`, error as Error);
            throw error;
        }
    }

    /**
     * 获取工作区相对路径
     */
    public getWorkspaceRelativePath(absolutePath: string): string | undefined {
        const workspaceFolder = this.getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return undefined;
        }

        const workspacePath = workspaceFolder.uri.fsPath;
        if (absolutePath.startsWith(workspacePath)) {
            return absolutePath.substring(workspacePath.length + 1);
        }

        return undefined;
    }

    /**
     * 创建备份文件
     */
    public async createBackup(workspaceRelativePath: string): Promise<string> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${workspaceRelativePath}.backup.${timestamp}`;
            
            const originalContent = await this.readFile(workspaceRelativePath);
            
            const workspaceFolder = this.getCurrentWorkspaceFolder();
            if (!workspaceFolder) {
                throw new Error('No workspace folder is open');
            }

            const backupUri = vscode.Uri.joinPath(workspaceFolder.uri, backupPath);
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(backupUri, encoder.encode(originalContent));
            
            this.logger.info(`Created backup: ${backupPath}`);
            return backupPath;
            
        } catch (error) {
            this.logger.error(`Failed to create backup for: ${workspaceRelativePath}`, error as Error);
            throw error;
        }
    }

    /**
     * 获取文件管理器状态信息
     */
    public getStatus(): object {
        const workspaceFolder = this.getCurrentWorkspaceFolder();
        
        return {
            hasWorkspace: !!workspaceFolder,
            workspacePath: workspaceFolder?.uri.fsPath,
            workspaceName: workspaceFolder?.name
        };
    }
}
