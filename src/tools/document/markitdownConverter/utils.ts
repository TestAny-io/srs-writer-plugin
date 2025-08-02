/**
 * MarkItDown 转换器工具函数
 * 提供通用的辅助功能
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { Logger } from '../../../utils/logger';
import { 
    DocumentInfo, 
    ConverterErrorType, 
    ConverterError, 
    SupportedFormats,
    ConverterConfig
} from './types';

const logger = Logger.getInstance();

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: ConverterConfig = {
    defaultOutputDir: './transformed_doc',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    supportedFormats: {
        implemented: ['.docx', '.pdf', '.xlsx', '.jpg', '.png', '.gif', '.html', '.csv', '.xml', '.txt', '.md'],
        planned: ['.pptx', '.mp3', '.wav', '.ipynb', '.zip'],
        requiresExtraDeps: {
            '.pptx': ['powerpoint-parser'],
            '.mp3': ['speech-recognition'],
            '.wav': ['speech-recognition']
        }
    },
    enableDebugLog: false,
    tempDirectory: './temp'
};

/**
 * 排除的目录列表
 */
export const EXCLUDED_DIRECTORIES = [
    'node_modules',
    'coverage', 
    'dist',
    'build',
    '.git',
    '.vscode',
    '.vs',
    'bin',
    'obj',
    'temp',
    'tmp',
    '.idea',
    '.next',
    '.nuxt'
];

/**
 * 检查文件格式是否受支持
 */
export function isSupportedFormat(filePath: string, config: ConverterConfig = DEFAULT_CONFIG): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return config.supportedFormats.implemented.includes(ext);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    if (i >= units.length) {
        return `${(bytes / Math.pow(k, units.length - 1)).toFixed(1)} ${units[units.length - 1]}`;
    }
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

/**
 * 格式化日期
 */
export function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 生成输出文件路径
 */
export function generateOutputPath(inputPath: string, outputDir: string = DEFAULT_CONFIG.defaultOutputDir): string {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputFileName = `${baseName}.md`;
    return path.join(outputDir, outputFileName);
}

/**
 * 验证文件路径
 */
export async function validateFilePath(filePath: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        throw new ConverterError(
            ConverterErrorType.CONFIG_ERROR,
            'No workspace folder is open'
        );
    }

    // 解析为绝对路径
    const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(workspaceFolder.uri.fsPath, filePath);

    // 检查文件是否在workspace内
    if (!absolutePath.startsWith(workspaceFolder.uri.fsPath)) {
        throw new ConverterError(
            ConverterErrorType.PERMISSION_DENIED,
            'File path outside workspace is not allowed',
            filePath
        );
    }

    // 检查文件是否存在
    try {
        const uri = vscode.Uri.file(absolutePath);
        await vscode.workspace.fs.stat(uri);
    } catch (error) {
        throw new ConverterError(
            ConverterErrorType.FILE_NOT_FOUND,
            `File not found: ${filePath}`,
            filePath,
            error as Error
        );
    }
}

/**
 * 验证文件大小
 */
export async function validateFileSize(filePath: string, maxSize: number = DEFAULT_CONFIG.maxFileSize): Promise<void> {
    try {
        const uri = vscode.Uri.file(filePath);
        const stats = await vscode.workspace.fs.stat(uri);
        
        if (stats.size > maxSize) {
            throw new ConverterError(
                ConverterErrorType.FILE_TOO_LARGE,
                `File too large: ${formatFileSize(stats.size)}. Maximum allowed: ${formatFileSize(maxSize)}`,
                filePath
            );
        }
    } catch (error) {
        if (error instanceof ConverterError) {
            throw error;
        }
        
        throw new ConverterError(
            ConverterErrorType.FILE_NOT_FOUND,
            `Failed to check file size: ${(error as Error).message}`,
            filePath,
            error as Error
        );
    }
}

/**
 * 确保目录存在
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        throw new ConverterError(
            ConverterErrorType.CONFIG_ERROR,
            'No workspace folder is open'
        );
    }

    const absoluteDirPath = path.isAbsolute(dirPath)
        ? dirPath
        : path.join(workspaceFolder.uri.fsPath, dirPath);

    try {
        const uri = vscode.Uri.file(absoluteDirPath);
        await vscode.workspace.fs.stat(uri);
    } catch {
        // 目录不存在，创建它
        try {
            const uri = vscode.Uri.file(absoluteDirPath);
            await vscode.workspace.fs.createDirectory(uri);
            logger.info(`Created directory: ${dirPath}`);
        } catch (error) {
            throw new ConverterError(
                ConverterErrorType.PERMISSION_DENIED,
                `Failed to create directory: ${dirPath}`,
                dirPath,
                error as Error
            );
        }
    }
}

/**
 * 清理Markdown内容
 */
export function cleanMarkdownContent(content: string): string {
    if (!content) return '';
    
    return content
        // 合并连续的加粗标记
        .replace(/\*\*([^*]+)\*\* \*\*([^*]+)\*\*/g, '**$1$2**')
        // 修复分离的加粗文本
        .replace(/\*\* \*\*([^*]+)\*\* \*\*/g, '**$1**')
        // 减少多余的空行
        .replace(/\n{3,}/g, '\n\n')
        // 清理行尾空格
        .replace(/[ \t]+$/gm, '')
        // 确保文档以换行结束
        .trim() + '\n';
}

/**
 * 从文件路径提取标题
 */
export function extractTitleFromPath(filePath: string): string {
    const baseName = path.basename(filePath, path.extname(filePath));
    
    // 替换常见的分隔符为空格
    return baseName
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase转换
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 生成文档的快速预览信息
 */
export function generateDocumentPreview(document: DocumentInfo): string {
    return `📄 ${document.name}\n` +
           `📁 ${document.directory}\n` +
           `📊 ${formatFileSize(document.size)}\n` +
           `🕒 ${formatDate(document.lastModified)}`;
}

/**
 * 检查目录是否应该被排除
 */
export function isExcludedDirectory(dirName: string): boolean {
    const lowerName = dirName.toLowerCase();
    return EXCLUDED_DIRECTORIES.some(excluded => lowerName.includes(excluded));
}

/**
 * 获取相对路径（相对于workspace root）
 */
export function getRelativePath(absolutePath: string): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return absolutePath;
    }
    
    const relativePath = path.relative(workspaceFolder.uri.fsPath, absolutePath);
    // 在Windows上规范化路径分隔符
    return relativePath.replace(/\\/g, '/');
}

/**
 * 获取绝对路径
 */
export function getAbsolutePath(relativePath: string): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        throw new ConverterError(
            ConverterErrorType.CONFIG_ERROR,
            'No workspace folder is open'
        );
    }
    
    if (path.isAbsolute(relativePath)) {
        return relativePath;
    }
    
    return path.join(workspaceFolder.uri.fsPath, relativePath);
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建进度报告器
 */
export function createProgressReporter(
    total: number, 
    onProgress: (current: number, percentage: number, message: string) => void
) {
    let current = 0;
    
    return {
        increment: (message: string = '') => {
            current++;
            const percentage = Math.round((current / total) * 100);
            onProgress(current, percentage, message);
        },
        
        update: (currentCount: number, message: string = '') => {
            current = currentCount;
            const percentage = Math.round((current / total) * 100);
            onProgress(current, percentage, message);
        },
        
        complete: (message: string = 'Complete') => {
            current = total;
            onProgress(current, 100, message);
        }
    };
}

/**
 * 错误信息本地化
 */
export function localizeErrorMessage(error: ConverterError): string {
    const baseMessage = error.message;
    
    switch (error.type) {
        case ConverterErrorType.FILE_NOT_FOUND:
            return `文件未找到: ${baseMessage}`;
        case ConverterErrorType.UNSUPPORTED_FORMAT:
            return `不支持的文件格式: ${baseMessage}`;
        case ConverterErrorType.FILE_TOO_LARGE:
            return `文件过大: ${baseMessage}`;
        case ConverterErrorType.CONVERSION_FAILED:
            return `转换失败: ${baseMessage}`;
        case ConverterErrorType.PERMISSION_DENIED:
            return `权限不足: ${baseMessage}`;
        case ConverterErrorType.NETWORK_ERROR:
            return `网络错误: ${baseMessage}`;
        case ConverterErrorType.CONFIG_ERROR:
            return `配置错误: ${baseMessage}`;
        default:
            return baseMessage;
    }
}