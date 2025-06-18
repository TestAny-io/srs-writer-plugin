import * as vscode from 'vscode';
import { LOG_LEVELS } from '../constants';

/**
 * 日志管理器
 */
export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('SRS Writer Plugin');
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