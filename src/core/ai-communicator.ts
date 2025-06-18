import * as vscode from 'vscode';
import { IAICommunicator } from '../types';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { PromptManager } from './prompt-manager';

/**
 * AI通信管理器
 * 负责与VSCode Language Model API的交互
 */
export class AICommunicator implements IAICommunicator {
    private logger = Logger.getInstance();
    private promptManager = new PromptManager();

    /**
     * 基于用户输入生成母文档
     * @param userInput 用户的原始需求字符串
     * @returns Promise<string> AI生成的完整母文档内容
     */
    public async generateMotherDocument(userInput: string): Promise<string> {
        this.logger.info('Starting mother document generation');
        
        try {
            // 检查Language Model是否可用
            const models = await vscode.lm.selectChatModels();
            if (models.length === 0) {
                throw new Error('No language models available. Please configure GitHub Copilot or another supported AI provider.');
            }

            // 选择第一个可用的模型
            const model = models[0];
            this.logger.info(`Using language model: ${model.name} (${model.vendor})`);

            // 准备核心Prompt
            const systemPrompt = this.promptManager.getSystemPrompt();
            const userPrompt = this.promptManager.getUserPrompt(userInput);

            // 构建聊天消息
            const messages = [
                vscode.LanguageModelChatMessage.User(systemPrompt),
                vscode.LanguageModelChatMessage.User(userPrompt)
            ];

            // 配置请求选项
            const requestOptions: vscode.LanguageModelChatRequestOptions = {
                justification: 'Generate structured SRS document based on user requirements'
            };

            this.logger.info('Sending request to language model...');

            // 发送请求到语言模型
            const response = await model.sendRequest(messages, requestOptions);
            
            // 收集完整响应
            let motherDocument = '';
            for await (const fragment of response.text) {
                motherDocument += fragment;
            }

            if (!motherDocument.trim()) {
                throw new Error('Language model returned empty response');
            }

            this.logger.info(`Mother document generated successfully, length: ${motherDocument.length}`);
            
            // 验证母文档的基本结构
            this.validateMotherDocument(motherDocument);
            
            return motherDocument;

        } catch (error) {
            this.logger.error('Failed to generate mother document', error as Error);
            
            if (error instanceof Error) {
                // 处理特定类型的错误
                if (error.message.includes('No language models available')) {
                    throw new Error('请先配置AI模型（如GitHub Copilot）后再使用SRS Writer插件。');
                } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
                    throw new Error('AI服务调用频率超限，请稍后重试。');
                } else if (error.message.includes('network') || error.message.includes('timeout')) {
                    throw new Error('网络连接超时，请检查网络连接后重试。');
                }
            }
            
            throw error;
        }
    }

    /**
     * 验证母文档的基本格式
     */
    private validateMotherDocument(motherDocument: string): void {
        // 检查必要的章节标识符
        const requiredSections = [
            '--- SOFTWARE REQUIREMENTS SPECIFICATION ---',
            '--- FUNCTIONAL REQUIREMENTS ---',
            '--- NON-FUNCTIONAL REQUIREMENTS ---',
            '--- GLOSSARY ---'
        ];

        const missingPages = requiredSections.filter(section => 
            !motherDocument.includes(section)
        );

        if (missingPages.length > 0) {
            this.logger.warn(`Mother document missing sections: ${missingPages.join(', ')}`);
            // 不抛出错误，而是记录警告，因为优雅降级策略会处理缺失的部分
        }

        // 检查基本长度
        if (motherDocument.length < 500) {
            this.logger.warn('Mother document seems too short, might be incomplete');
        }

        this.logger.info('Mother document validation completed');
    }

    /**
     * 检查Language Model API的可用性
     */
    public async checkAvailability(): Promise<boolean> {
        try {
            const models = await vscode.lm.selectChatModels();
            return models.length > 0;
        } catch (error) {
            this.logger.error('Failed to check language model availability', error as Error);
            return false;
        }
    }

    /**
     * 获取可用的语言模型列表
     */
    public async getAvailableModels(): Promise<vscode.LanguageModelChat[]> {
        try {
            return await vscode.lm.selectChatModels();
        } catch (error) {
            this.logger.error('Failed to get available models', error as Error);
            return [];
        }
    }

    /**
     * 获取当前使用的模型信息
     */
    public async getCurrentModelInfo(): Promise<string> {
        try {
            const models = await vscode.lm.selectChatModels();
            if (models.length === 0) {
                return 'No models available';
            }
            
            const model = models[0];
            return `${model.name} (${model.vendor}) - Max Input: ${model.maxInputTokens}, Max Output: ${model.maxInputTokens}`;
        } catch (error) {
            this.logger.error('Failed to get model info', error as Error);
            return 'Unknown';
        }
    }
}
