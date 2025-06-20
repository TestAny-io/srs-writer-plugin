import * as vscode from 'vscode';
import { Logger } from '../utils/logger';
import { ISyncChecker, SyncStatus } from '../types';
import { SessionContext } from '../types/session';

/**
 * v1.2 同步检查器 - 重构版
 * 异步、无状态、职责单一的同步状态检查服务
 * 只负责比较时间戳，不关心文件发现和路径构建
 */
export class SyncChecker implements ISyncChecker {
    private logger = Logger.getInstance();

    constructor() {
        this.logger.info('SyncChecker initialized (stateless & async)');
    }

    /**
     * 检查给定会话上下文的同步状态
     * @param sessionContext 当前激活的会话上下文
     * @returns Promise<SyncStatus>
     */
    public async checkSyncStatus(sessionContext: SessionContext): Promise<SyncStatus> {
        // 1. 从上下文中获取确切的母文档路径和文件列表，不再自己猜测
        if (!sessionContext.baseDir) {
            this.logger.info('No active project base directory, assuming synced.');
            return { status: 'synced' };
        }

        // 2. v1.2修复：从工作区根URI开始构建路径，确保跨平台兼容性
        const workspaceFolder = vscode.workspace.workspaceFolders?.find(f => 
            sessionContext.baseDir!.startsWith(f.uri.fsPath)
        );
        if (!workspaceFolder) {
            this.logger.error('Could not find workspace folder for the active session.');
            return { status: 'error', message: 'Workspace not found for session.' };
        }

        // 3. 从工作区根URI开始构建路径，避免跨平台路径问题
        const baseDirUri = vscode.Uri.file(sessionContext.baseDir);
        const motherDocUri = vscode.Uri.joinPath(baseDirUri, 'mother_document.md');
        const childFileUris = sessionContext.activeFiles
            .map(file => vscode.Uri.joinPath(baseDirUri, file));

        try {
            // 4. 使用异步API获取母文档时间戳
            const motherStat = await vscode.workspace.fs.stat(motherDocUri);
            const motherTime = motherStat.mtime;

            this.logger.info(`Mother document timestamp: ${new Date(motherTime).toISOString()}`);

            // 5. 使用异步API检查所有子文件
            for (const fileUri of childFileUris) {
                try {
                    const fileStat = await vscode.workspace.fs.stat(fileUri);
                    this.logger.info(`Checking file: ${fileUri.fsPath}, timestamp: ${new Date(fileStat.mtime).toISOString()}`);
                    
                    if (fileStat.mtime > motherTime) {
                        this.logger.warn(`Conflict: ${fileUri.fsPath} is newer than mother document.`);
                        return { status: 'conflict', dirtyFile: fileUri.fsPath };
                    }
                } catch (e) {
                    // 如果子文件不存在，忽略它
                    this.logger.debug(`Child file not found, skipping: ${fileUri.fsPath}`);
                }
            }

            this.logger.info('All files are in sync.');
            return { status: 'synced' };

        } catch (error) {
            if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                // 母文档不存在，视为同步
                this.logger.info('Mother document not found, assuming synced.');
                return { status: 'synced' };
            }
            this.logger.error('Failed to check sync status', error as Error);
            return { status: 'error', message: (error as Error).message };
        }
    }

}