/**
 * 🎯 会话日志管理工具 v5.0 - 纯日志记录功能
 * 
 * 职责：
 * - 记录操作日志到operations数组
 * - 15天自动归档机制
 * - 确保日志文件Schema一致性
 * 
 * ⚠️ 重要变更：
 * - 不再管理SessionContext状态（SessionManager负责）
 * - 不再创建或更新会话（SessionManager负责）
 * - 只提供recordOperation()接口供SessionManager调用
 */

import { OperationLogEntry, UnifiedSessionFile } from '../../types/session';
import { Logger } from '../../utils/logger';
import { 
    _internalReadFile, 
    writeFile, 
    createDirectory, 
    moveAndRenameFile, 
    listFiles 
} from '../atomic/filesystem-tools';

const logger = Logger.getInstance();

/**
 * 🎯 核心功能：记录操作到日志文件
 * 这是唯一的对外接口，SessionManager调用此方法
 */
export async function recordOperation(logEntry: OperationLogEntry): Promise<void> {
    try {
        // 检查是否需要归档
        await archiveLogFileIfNeeded();
        
        // 获取或创建当前日志文件
        const logFile = await getCurrentOrCreateLogFile();
        
        // 添加新的操作记录
        logFile.operations.push(logEntry);
        logFile.lastUpdated = new Date().toISOString();
        
        // 保存到文件
        await saveLogFile(logFile);
        
        logger.info(`Operation recorded: ${logEntry.type} for session ${logEntry.sessionContextId}`);
        
    } catch (error) {
        logger.error(`Failed to record operation: ${(error as Error).message}`);
        throw error;
    }
}

/**
 * 🎯 检查并执行15天归档
 */
export async function archiveLogFileIfNeeded(): Promise<void> {
    try {
        const logFilePath = getCurrentLogFilePath();
        
        // 🚀 使用atomic层工具检查文件是否存在
        const fileReadResult = await _internalReadFile({ path: logFilePath });
        if (!fileReadResult.success) {
            return; // 文件不存在，无需归档
        }
        
        const logFile = await loadLogFile(logFilePath);
        const fileAge = Date.now() - new Date(logFile.createdAt).getTime();
        const maxAge = 15 * 24 * 60 * 60 * 1000; // 15天（毫秒）
        
        if (fileAge > maxAge) {
            await archiveLogFile(logFile);
            logger.info('Session log file archived due to 15-day limit');
        }
        
    } catch (error) {
        logger.error(`Failed to check archive status: ${(error as Error).message}`);
    }
}

/**
 * 🎯 手动归档当前日志文件
 */
export async function archiveCurrentLogFile(): Promise<void> {
    try {
        const logFilePath = getCurrentLogFilePath();
        
        // 🚀 使用atomic层工具检查文件是否存在
        const fileReadResult = await _internalReadFile({ path: logFilePath });
        if (!fileReadResult.success) {
            logger.info('No current log file to archive');
            return;
        }
        
        const logFile = await loadLogFile(logFilePath);
        await archiveLogFile(logFile);
        logger.info('Session log file manually archived');
        
    } catch (error) {
        logger.error(`Failed to manually archive log file: ${(error as Error).message}`);
        throw error;
    }
}

/**
 * 🎯 获取指定项目的操作历史
 */
export async function getOperationHistory(
    sessionContextId: string, 
    timeRange?: { startDate: string; endDate: string }
): Promise<OperationLogEntry[]> {
    try {
        const operations: OperationLogEntry[] = [];
        
        // 🚀 使用atomic层工具从当前日志文件读取
        const currentLogPath = getCurrentLogFilePath();
        const currentFileResult = await _internalReadFile({ path: currentLogPath });
        if (currentFileResult.success) {
            const currentLog = await loadLogFile(currentLogPath);
            const filtered = currentLog.operations.filter(op => op.sessionContextId === sessionContextId);
            operations.push(...filtered);
        }
        
        // 从归档文件读取（如果指定了时间范围）
        if (timeRange) {
            const archiveDir = getArchiveDirectoryPath();
            
            // 🚀 使用atomic层工具列出归档目录
            const archiveDirResult = await listFiles({ path: archiveDir });
            if (archiveDirResult.success && archiveDirResult.files) {
                const archiveFiles = archiveDirResult.files
                    .filter(file => file.type === 'file' && file.name.endsWith('.json'))
                    .map(file => `${archiveDir}/${file.name}`);
                
                for (const archiveFile of archiveFiles) {
                    try {
                        const archiveLog = await loadLogFile(archiveFile);
                        const filtered = archiveLog.operations.filter((op: OperationLogEntry) => 
                            op.sessionContextId === sessionContextId &&
                            op.timestamp >= timeRange.startDate &&
                            op.timestamp <= timeRange.endDate
                        );
                        operations.push(...filtered);
                    } catch (error) {
                        logger.warn(`Failed to read archive file ${archiveFile}: ${(error as Error).message}`);
                    }
                }
            }
        }
        
        // 按时间戳排序
        return operations.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
    } catch (error) {
        logger.error(`Failed to get operation history: ${(error as Error).message}`);
        return [];
    }
}

// ============================================================================
// 内部辅助函数 - 支持recordOperation的文件操作
// ============================================================================

/**
 * 🔧 获取当前日志文件路径（相对于workspace）
 */
function getCurrentLogFilePath(): string {
    return '.vscode/srs-writer-session.json';
}

/**
 * 🔧 获取归档目录路径（相对于workspace）
 */
function getArchiveDirectoryPath(): string {
    return '.vscode/session-archives';
}

/**
 * 🔧 获取或创建当前日志文件
 */
async function getCurrentOrCreateLogFile(): Promise<UnifiedSessionFile> {
    const logFilePath = getCurrentLogFilePath();
    
    // 🚀 使用atomic层工具检查文件是否存在
    const fileReadResult = await _internalReadFile({ path: logFilePath });
    if (fileReadResult.success) {
        return await loadLogFile(logFilePath);
    } else {
        // 创建新的日志文件
        const now = new Date().toISOString();
        const newLogFile: UnifiedSessionFile = {
            fileVersion: '5.0',
            currentSession: null, // 不由此工具管理
            operations: [],
            timeRange: {
                startDate: now.split('T')[0],
                endDate: getEndDate(now).split('T')[0]
            },
            createdAt: now,
            lastUpdated: now
        };
        
        // 🚀 使用atomic层工具确保.vscode目录存在
        const vscodeDirPath = '.vscode';
        await createDirectory({ path: vscodeDirPath });
        
        await saveLogFile(newLogFile);
        return newLogFile;
    }
}

/**
 * 🔧 加载日志文件
 */
async function loadLogFile(filePath: string): Promise<UnifiedSessionFile> {
    try {
        // 🚀 使用atomic层工具读取文件
        const fileReadResult = await _internalReadFile({ path: filePath });
        if (!fileReadResult.success) {
            throw new Error(fileReadResult.error || 'Failed to read file');
        }
        
        const fileContent = fileReadResult.content!;
        if (!fileContent || fileContent.trim().length === 0) {
            throw new Error('Log file is empty');
        }
        
        const parsed = JSON.parse(fileContent);
        
        // 验证UnifiedSessionFile格式
        if (!parsed.fileVersion || !Array.isArray(parsed.operations)) {
            throw new Error('Invalid unified session file format');
        }
        
        return parsed as UnifiedSessionFile;
        
    } catch (error) {
        logger.error(`Failed to load log file ${filePath}: ${(error as Error).message}`);
        throw error;
    }
}

/**
 * 🔧 保存日志文件
 */
async function saveLogFile(logFile: UnifiedSessionFile): Promise<void> {
    const logFilePath = getCurrentLogFilePath();
    
    try {
        // 🚀 使用atomic层工具确保.vscode目录存在
        const vscodeDirPath = '.vscode';
        await createDirectory({ path: vscodeDirPath });
        
        const fileContent = JSON.stringify(logFile, null, 2);
        
        // 🚀 使用atomic层工具写入文件
        const writeResult = await writeFile({ path: logFilePath, content: fileContent });
        if (!writeResult.success) {
            throw new Error(writeResult.error || 'Failed to write file');
        }
        
    } catch (error) {
        logger.error(`Failed to save log file: ${(error as Error).message}`);
        throw error;
    }
}

/**
 * 🔧 归档日志文件
 */
async function archiveLogFile(logFile: UnifiedSessionFile): Promise<void> {
    try {
        const archiveDir = getArchiveDirectoryPath();
        
        // 🚀 使用atomic层工具确保归档目录存在
        await createDirectory({ path: archiveDir });
        
        // 生成归档文件名
        const archiveFileName = generateArchiveFileName(logFile);
        const archivePath = `${archiveDir}/${archiveFileName}`;
        
        // 🚀 使用atomic层工具移动文件到归档目录
        const currentPath = getCurrentLogFilePath();
        const renameResult = await moveAndRenameFile({ sourcePath: currentPath, targetPath: archivePath });
        if (!renameResult.success) {
            throw new Error(renameResult.error || 'Failed to archive file');
        }
        
        logger.info(`Log file archived to: ${archivePath}`);
        
    } catch (error) {
        logger.error(`Failed to archive log file: ${(error as Error).message}`);
        throw error;
    }
}

/**
 * 🔧 生成归档文件名
 */
function generateArchiveFileName(logFile: UnifiedSessionFile): string {
    const startDate = logFile.timeRange.startDate.replace(/-/g, '');
    const endDate = logFile.timeRange.endDate.replace(/-/g, '');
    return `srs-writer-session-${startDate}-${endDate}.json`;
}

/**
 * 🔧 计算结束日期（开始日期+15天）
 */
function getEndDate(startDate: string): string {
    const start = new Date(startDate);
    const end = new Date(start.getTime() + 15 * 24 * 60 * 60 * 1000);
    return end.toISOString();
} 