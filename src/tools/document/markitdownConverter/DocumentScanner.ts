/**
 * 文档扫描器
 * 负责扫描workspace中的可转换文档
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';
import { 
    DocumentInfo, 
    ScanOptions, 
    ScanResult, 
    ConverterError, 
    ConverterErrorType 
} from './types';
import { 
    DEFAULT_CONFIG, 
    EXCLUDED_DIRECTORIES, 
    isExcludedDirectory, 
    getRelativePath,
    getAbsolutePath
} from './utils';

const logger = Logger.getInstance();

/**
 * 文档扫描器类
 */
export class DocumentScanner {
    private config = DEFAULT_CONFIG;

    /**
     * 扫描workspace中的所有支持的文档文件
     */
    async scanWorkspaceDocuments(extensions: string[] = ['.docx']): Promise<ScanResult> {
        const startTime = Date.now();
        
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new ConverterError(
                    ConverterErrorType.CONFIG_ERROR,
                    'No workspace folder is open'
                );
            }

            logger.info(`🔍 Starting document scan for extensions: [${extensions.join(', ')}]`);

            const scanOptions: ScanOptions = {
                extensions,
                maxDepth: 5,
                excludeDirectories: EXCLUDED_DIRECTORIES,
                includeHidden: false
            };

            const documents: DocumentInfo[] = [];
            let directoriesScanned = 0;

            await this.scanDirectory(
                workspaceFolder.uri,
                documents,
                scanOptions,
                0,
                () => directoriesScanned++
            );

            const scanTime = Date.now() - startTime;

            logger.info(`✅ Document scan completed: found ${documents.length} documents in ${directoriesScanned} directories (${scanTime}ms)`);

            return {
                success: true,
                documents: documents.sort(this.compareDocuments),
                totalCount: documents.length,
                directoriesScanned,
                scanTime
            };

        } catch (error) {
            const scanTime = Date.now() - startTime;
            const errorMessage = error instanceof ConverterError 
                ? error.message 
                : `Scan failed: ${(error as Error).message}`;

            logger.error('Document scan failed', error as Error);

            return {
                success: false,
                documents: [],
                totalCount: 0,
                directoriesScanned: 0,
                scanTime,
                error: errorMessage
            };
        }
    }

    /**
     * 扫描特定目录
     */
    private async scanDirectory(
        directoryUri: vscode.Uri,
        documents: DocumentInfo[],
        options: ScanOptions,
        currentDepth: number,
        onDirectoryScanned: () => void
    ): Promise<void> {
        // 检查深度限制
        if (currentDepth > options.maxDepth) {
            logger.debug(`Skipping directory due to depth limit: ${directoryUri.fsPath}`);
            return;
        }

        try {
            const items = await vscode.workspace.fs.readDirectory(directoryUri);
            onDirectoryScanned();

            for (const [itemName, fileType] of items) {
                // 跳过隐藏文件（除非配置允许）
                if (!options.includeHidden && itemName.startsWith('.')) {
                    continue;
                }

                const itemUri = vscode.Uri.joinPath(directoryUri, itemName);

                if (fileType === vscode.FileType.Directory) {
                    // 检查是否应排除此目录
                    if (this.shouldExcludeDirectory(itemName, options.excludeDirectories)) {
                        logger.debug(`Excluding directory: ${itemName}`);
                        continue;
                    }

                    // 递归扫描子目录
                    await this.scanDirectory(
                        itemUri,
                        documents,
                        options,
                        currentDepth + 1,
                        onDirectoryScanned
                    );

                } else if (fileType === vscode.FileType.File) {
                    // 检查文件扩展名
                    const extension = path.extname(itemName).toLowerCase();
                    if (options.extensions.includes(extension)) {
                        try {
                            const documentInfo = await this.createDocumentInfo(itemUri, itemName);
                            documents.push(documentInfo);
                            logger.debug(`Found document: ${documentInfo.path}`);
                        } catch (error) {
                            logger.warn(`Failed to process document ${itemName}: ${(error as Error).message}`);
                        }
                    }
                }
            }

        } catch (error) {
            // 记录错误但继续扫描其他目录
            logger.warn(`Failed to scan directory ${directoryUri.fsPath}: ${(error as Error).message}`);
        }
    }

    /**
     * 创建文档信息对象
     */
    private async createDocumentInfo(fileUri: vscode.Uri, fileName: string): Promise<DocumentInfo> {
        try {
            const stats = await vscode.workspace.fs.stat(fileUri);
            const relativePath = getRelativePath(fileUri.fsPath);
            const directory = path.dirname(relativePath);

            return {
                name: fileName,
                path: relativePath,
                absolutePath: fileUri.fsPath,
                extension: path.extname(fileName).toLowerCase(),
                size: stats.size,
                lastModified: stats.mtime,
                directory: directory === '.' ? '根目录' : directory
            };

        } catch (error) {
            throw new ConverterError(
                ConverterErrorType.FILE_NOT_FOUND,
                `Failed to get file stats for ${fileName}`,
                fileUri.fsPath,
                error as Error
            );
        }
    }

    /**
     * 检查目录是否应该被排除
     */
    private shouldExcludeDirectory(dirName: string, excludeList: string[]): boolean {
        const lowerName = dirName.toLowerCase();
        return excludeList.some(excluded => 
            lowerName === excluded.toLowerCase() || 
            lowerName.includes(excluded.toLowerCase())
        );
    }

    /**
     * 文档排序比较函数
     */
    private compareDocuments(a: DocumentInfo, b: DocumentInfo): number {
        // 首先按目录排序
        const dirCompare = a.directory.localeCompare(b.directory);
        if (dirCompare !== 0) {
            return dirCompare;
        }

        // 然后按文件名排序
        return a.name.localeCompare(b.name);
    }

    /**
     * 按类型过滤文档
     */
    filterDocumentsByType(documents: DocumentInfo[], extensions: string[]): DocumentInfo[] {
        return documents.filter(doc => 
            extensions.includes(doc.extension.toLowerCase())
        );
    }

    /**
     * 按大小过滤文档
     */
    filterDocumentsBySize(documents: DocumentInfo[], maxSize: number): DocumentInfo[] {
        return documents.filter(doc => doc.size <= maxSize);
    }

    /**
     * 按目录过滤文档
     */
    filterDocumentsByDirectory(documents: DocumentInfo[], directories: string[]): DocumentInfo[] {
        return documents.filter(doc => 
            directories.some(dir => 
                doc.directory.includes(dir) || 
                doc.path.startsWith(dir)
            )
        );
    }

    /**
     * 搜索文档（按名称）
     */
    searchDocuments(documents: DocumentInfo[], searchTerm: string): DocumentInfo[] {
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        return documents.filter(doc => 
            doc.name.toLowerCase().includes(lowerSearchTerm) ||
            doc.path.toLowerCase().includes(lowerSearchTerm) ||
            doc.directory.toLowerCase().includes(lowerSearchTerm)
        );
    }

    /**
     * 获取文档统计信息
     */
    getDocumentStats(documents: DocumentInfo[]): {
        totalCount: number;
        totalSize: number;
        byExtension: Record<string, number>;
        byDirectory: Record<string, number>;
        averageSize: number;
    } {
        const stats = {
            totalCount: documents.length,
            totalSize: 0,
            byExtension: {} as Record<string, number>,
            byDirectory: {} as Record<string, number>,
            averageSize: 0
        };

        documents.forEach(doc => {
            // 计算总大小
            stats.totalSize += doc.size;

            // 按扩展名统计
            const ext = doc.extension;
            stats.byExtension[ext] = (stats.byExtension[ext] || 0) + 1;

            // 按目录统计
            const dir = doc.directory;
            stats.byDirectory[dir] = (stats.byDirectory[dir] || 0) + 1;
        });

        // 计算平均大小
        stats.averageSize = documents.length > 0 
            ? Math.round(stats.totalSize / documents.length) 
            : 0;

        return stats;
    }

    /**
     * 检查特定文件是否存在
     */
    async checkFileExists(filePath: string): Promise<boolean> {
        try {
            const absolutePath = getAbsolutePath(filePath);
            const uri = vscode.Uri.file(absolutePath);
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 获取文件信息
     */
    async getFileInfo(filePath: string): Promise<DocumentInfo | null> {
        try {
            const absolutePath = getAbsolutePath(filePath);
            const uri = vscode.Uri.file(absolutePath);
            const fileName = path.basename(absolutePath);
            
            return await this.createDocumentInfo(uri, fileName);
        } catch (error) {
            logger.warn(`Failed to get file info for ${filePath}: ${(error as Error).message}`);
            return null;
        }
    }

    /**
     * 监视文件系统变化（简单实现）
     */
    watchFileChanges(
        extensions: string[],
        onFileAdded: (document: DocumentInfo) => void,
        onFileRemoved: (filePath: string) => void
    ): vscode.Disposable {
        const watcher = vscode.workspace.createFileSystemWatcher(
            `**/*{${extensions.join(',')}}`
        );

        watcher.onDidCreate(async (uri) => {
            try {
                const fileName = path.basename(uri.fsPath);
                const documentInfo = await this.createDocumentInfo(uri, fileName);
                onFileAdded(documentInfo);
            } catch (error) {
                logger.warn(`Failed to process new file ${uri.fsPath}: ${(error as Error).message}`);
            }
        });

        watcher.onDidDelete((uri) => {
            const relativePath = getRelativePath(uri.fsPath);
            onFileRemoved(relativePath);
        });

        return watcher;
    }
}