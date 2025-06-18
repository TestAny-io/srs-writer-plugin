import * as vscode from 'vscode';
import { Logger } from './logger';
import { ERROR_MESSAGES } from '../constants';

/**
 * 自定义错误类
 */
export class SRSError extends Error {
    public readonly code: string;
    public readonly details?: any;

    constructor(message: string, code: string, details?: any) {
        super(message);
        this.name = 'SRSError';
        this.code = code;
        this.details = details;
    }
}

/**
 * 错误处理器
 */
export class ErrorHandler {
    private static logger = Logger.getInstance();

    /**
     * 处理并显示错误
     */
    public static async handleError(error: Error | SRSError, showToUser: boolean = true): Promise<void> {
        this.logger.error('Error occurred', error);

        if (showToUser) {
            let message = error.message;
            
            // 如果是自定义错误，尝试获取更友好的错误消息
            if (error instanceof SRSError) {
                message = this.getFriendlyErrorMessage(error.code) || error.message;
            }

            // 显示错误消息给用户
            const action = await vscode.window.showErrorMessage(
                `SRS Writer Plugin: ${message}`,
                '查看日志',
                '忽略'
            );

            if (action === '查看日志') {
                this.logger.show();
            }
        }
    }

    /**
     * 处理API错误
     */
    public static async handleApiError(error: any): Promise<void> {
        let errorMessage: string = ERROR_MESSAGES.NETWORK_ERROR;
        let errorCode = 'NETWORK_ERROR';

        if (error.response) {
            // HTTP错误响应
            const status = error.response.status;
            switch (status) {
                case 401:
                    errorMessage = ERROR_MESSAGES.API_KEY_MISSING;
                    errorCode = 'UNAUTHORIZED';
                    break;
                case 403:
                    errorMessage = ERROR_MESSAGES.PERMISSION_DENIED;
                    errorCode = 'FORBIDDEN';
                    break;
                case 404:
                    errorMessage = ERROR_MESSAGES.FILE_NOT_FOUND;
                    errorCode = 'NOT_FOUND';
                    break;
                case 429:
                    errorMessage = 'API调用频率超限，请稍后重试';
                    errorCode = 'RATE_LIMITED';
                    break;
                default:
                    errorMessage = `API错误 (${status}): ${error.response.data?.message || error.message}`;
                    errorCode = `HTTP_${status}`;
            }
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
            errorCode = 'CONNECTION_ERROR';
        }

        const srsError = new SRSError(errorMessage, errorCode, error);
        await this.handleError(srsError);
    }

    /**
     * 处理文件操作错误
     */
    public static async handleFileError(error: any, filePath?: string): Promise<void> {
        let errorMessage = `文件操作失败${filePath ? `: ${filePath}` : ''}`;
        let errorCode = 'FILE_ERROR';

        if (error.code === 'ENOENT') {
            errorMessage = ERROR_MESSAGES.FILE_NOT_FOUND + (filePath ? `: ${filePath}` : '');
            errorCode = 'FILE_NOT_FOUND';
        } else if (error.code === 'EACCES' || error.code === 'EPERM') {
            errorMessage = ERROR_MESSAGES.PERMISSION_DENIED + (filePath ? `: ${filePath}` : '');
            errorCode = 'PERMISSION_DENIED';
        }

        const srsError = new SRSError(errorMessage, errorCode, { originalError: error, filePath });
        await this.handleError(srsError);
    }

    /**
     * 获取友好的错误消息
     */
    private static getFriendlyErrorMessage(errorCode: string): string | null {
        const messageMap: Record<string, string> = {
            'API_KEY_MISSING': ERROR_MESSAGES.API_KEY_MISSING,
            'INVALID_FILE_FORMAT': ERROR_MESSAGES.INVALID_FILE_FORMAT,
            'PARSE_ERROR': ERROR_MESSAGES.PARSE_ERROR,
            'NETWORK_ERROR': ERROR_MESSAGES.NETWORK_ERROR,
            'FILE_NOT_FOUND': ERROR_MESSAGES.FILE_NOT_FOUND,
            'PERMISSION_DENIED': ERROR_MESSAGES.PERMISSION_DENIED,
        };

        return messageMap[errorCode] || null;
    }

    /**
     * 包装异步函数以自动处理错误
     */
    public static wrapAsync<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        showErrorToUser: boolean = true
    ): (...args: T) => Promise<R | undefined> {
        return async (...args: T): Promise<R | undefined> => {
            try {
                return await fn(...args);
            } catch (error) {
                await this.handleError(error as Error, showErrorToUser);
                return undefined;
            }
        };
    }
} 