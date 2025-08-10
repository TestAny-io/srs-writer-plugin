import * as vscode from 'vscode';
import { LOG_LEVELS } from '../constants';

/**
 * Mock OutputChannel for testing environment
 */
class MockOutputChannel {
    appendLine(message: string): void {
        // 在测试环境中只输出到控制台
        console.log(`[MockOutput] ${message}`);
    }

    show(): void {
        // Mock implementation - do nothing
    }

    hide(): void {
        // Mock implementation - do nothing
    }

    clear(): void {
        // Mock implementation - do nothing  
    }

    dispose(): void {
        // Mock implementation - do nothing
    }
}

/**
 * 日志管理器 - 支持测试环境
 */
export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel | MockOutputChannel;

    private constructor() {
        // 在测试环境中使用mock实现
        if (this.isTestEnvironment()) {
            this.outputChannel = new MockOutputChannel();
        } else {
            this.outputChannel = vscode.window.createOutputChannel('SRS Writer Plugin');
        }
    }

    /**
     * 检查是否在测试环境中
     */
    private isTestEnvironment(): boolean {
        return process.env.NODE_ENV === 'test' || 
               process.env.JEST_WORKER_ID !== undefined ||
               typeof jest !== 'undefined';
    }

    /**
     * 获取Logger单例实例
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * 重置实例（仅用于测试）
     */
    public static resetInstance(): void {
        Logger.instance = undefined as any;
    }

    /**
     * 记录错误日志
     */
    public error(message: string, error?: Error): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [ERROR] ${message}`;
        
        if (error) {
            this.outputChannel.appendLine(`${logMessage}\n${error.stack || error.message}`);
        } else {
            this.outputChannel.appendLine(logMessage);
        }
        
        // 在控制台也输出错误信息
        console.error(logMessage, error);
    }

    /**
     * 记录警告日志
     */
    public warn(message: string): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [WARN] ${message}`;
        
        this.outputChannel.appendLine(logMessage);
        console.warn(logMessage);
    }

    /**
     * 记录信息日志
     */
    public info(message: string): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [INFO] ${message}`;
        
        this.outputChannel.appendLine(logMessage);
        console.info(logMessage);
    }

    /**
     * 记录调试日志
     */
    public debug(message: string): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [DEBUG] ${message}`;
        
        this.outputChannel.appendLine(logMessage);
        console.debug(logMessage);
    }

    /**
     * 显示输出通道
     */
    public show(): void {
        this.outputChannel.show();
    }

    /**
     * 清空日志
     */
    public clear(): void {
        this.outputChannel.clear();
    }

    /**
     * 释放资源
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
} 