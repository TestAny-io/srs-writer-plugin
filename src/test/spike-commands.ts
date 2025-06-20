/**
 * v1.2架构验证命令处理器
 */
import * as vscode from 'vscode';
import { ArchitectureSpike } from './spike/architecture-spike';
import { Logger } from '../utils/logger';

export class SpikeCommands {
    private static logger = Logger.getInstance();

    /**
     * 注册Spike测试命令
     */
    public static register(context: vscode.ExtensionContext): void {
        // 架构验证命令
        const runSpikeCommand = vscode.commands.registerCommand(
            'srs-writer.runArchitectureSpike',
            this.runArchitectureValidation
        );

        context.subscriptions.push(runSpikeCommand);
        this.logger.info('Spike commands registered');
    }

    /**
     * 运行架构验证
     */
    private static async runArchitectureValidation(): Promise<void> {
        const outputChannel = vscode.window.createOutputChannel('SRS Writer Architecture Validation');
        outputChannel.show();

        try {
            outputChannel.appendLine('🚀 Starting SRS Writer v1.2 Architecture Validation...\n');

            const spike = new ArchitectureSpike();
            const results = await spike.runFullValidation();

            // 输出详细结果到输出面板
            outputChannel.appendLine('📋 VALIDATION RESULTS:');
            outputChannel.appendLine(`   AI Routing Accuracy: ${results.aiRoutingAccuracy}%`);
            outputChannel.appendLine(`   Architecture Chain Complete: ${results.architectureChainComplete}`);
            outputChannel.appendLine(`   Error Handling Robust: ${results.errorHandlingRobust}`);
            outputChannel.appendLine(`   Performance Baseline: ${results.performanceBaseline.averageMs}ms avg, ${results.performanceBaseline.maxMs}ms max`);
            outputChannel.appendLine(`   Overall Success: ${results.overallSuccess ? 'PASS ✅' : 'FAIL ❌'}\n`);

            if (results.overallSuccess) {
                outputChannel.appendLine('🎉 Architecture validation PASSED! The hybrid intelligence architecture is working correctly.');
                
                vscode.window.showInformationMessage(
                    '🎉 架构验证通过！混合智能架构工作正常。',
                    '查看详情'
                ).then(selection => {
                    if (selection === '查看详情') {
                        outputChannel.show();
                    }
                });
            } else {
                outputChannel.appendLine('💥 Architecture validation FAILED! Please check the issues above.');
                
                vscode.window.showWarningMessage(
                    '⚠️ 架构验证失败，请检查输出面板了解详情。',
                    '查看详情'
                ).then(selection => {
                    if (selection === '查看详情') {
                        outputChannel.show();
                    }
                });
            }

        } catch (error) {
            const errorMessage = `Architecture validation failed with error: ${error}`;
            outputChannel.appendLine(`💥 ${errorMessage}`);
            this.logger.error('Architecture validation failed', error as Error);
            
            vscode.window.showErrorMessage('架构验证过程中发生错误，请查看输出面板。');
        }
    }
}
