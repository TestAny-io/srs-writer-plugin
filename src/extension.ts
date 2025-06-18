import * as vscode from 'vscode';
import { SRSChatParticipant } from './chat/srs-chat-participant';
import { Logger } from './utils/logger';
import { ErrorHandler } from './utils/error-handler';
import { TestCommands } from './test/test-commands';
import { COMMANDS } from './constants';

let chatParticipant: SRSChatParticipant;
const logger = Logger.getInstance();

/**
 * 扩展激活时调用
 * @param context 扩展上下文
 */
export function activate(context: vscode.ExtensionContext) {
    logger.info('SRS Writer Plugin is now active!');
    
    try {
        // 注册Chat Participant
        chatParticipant = SRSChatParticipant.register(context);
        logger.info('SRS Chat Participant registered successfully');
        
        // 注册测试命令
        TestCommands.register(context);
        logger.info('Test commands registered successfully');
        
        // 注册帮助命令
        const helpCommand = vscode.commands.registerCommand(COMMANDS.GENERATE_SRS, () => {
            vscode.window.showInformationMessage(
                'SRS Writer Plugin: 请在Chat面板中使用 @srs-writer 开始对话。'
            );
        });
        context.subscriptions.push(helpCommand);
        
        // 注册状态栏项
        const statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        statusBarItem.text = '$(notebook-kernel) SRS Writer';
        statusBarItem.tooltip = 'SRS Writer Plugin - Ready';
        statusBarItem.command = COMMANDS.GENERATE_SRS;
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);
        
        logger.info('SRS Writer Plugin activation completed successfully');
        
    } catch (error) {
        ErrorHandler.handleError(error as Error, true);
        logger.error('Failed to activate SRS Writer Plugin', error as Error);
    }
}

/**
 * 扩展停用时调用
 */
export function deactivate() {
    logger.info('SRS Writer Plugin is deactivating...');
    
    try {
        // 清理Chat Participant会话
        if (chatParticipant) {
            chatParticipant.cleanupExpiredSessions();
        }
        
        // 清理Logger资源
        logger.dispose();
        
        logger.info('SRS Writer Plugin deactivated successfully');
    } catch (error) {
        console.error('Error during SRS Writer Plugin deactivation:', error);
    }
} 