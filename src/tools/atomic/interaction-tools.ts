import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';

/**
 * 用户交互工具 - 基于 vscode.window API
 * 
 * 包含功能：
 * - 消息显示（信息、警告）
 * - 用户输入询问
 * - 智能建议和解释
 * - 进度指示器
 */

const logger = Logger.getInstance();

// ============================================================================
// 消息显示工具
// ============================================================================

/**
 * 显示信息消息
 */
export const showInformationMessageToolDefinition = {
    name: "showInformationMessage",
    description: "Show an information message to the user",
    parameters: {
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "Information message to display"
            }
        },
        required: ["message"]
    }
};

export async function showInformationMessage(args: { message: string }): Promise<{ success: boolean }> {
    vscode.window.showInformationMessage(args.message);
    logger.info(`✅ Showed info message: ${args.message}`);
    return { success: true };
}

/**
 * 显示警告消息
 */
export const showWarningMessageToolDefinition = {
    name: "showWarningMessage",
    description: "Show a warning message to the user",
    parameters: {
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "Warning message to display"
            }
        },
        required: ["message"]
    }
};

export async function showWarningMessage(args: { message: string }): Promise<{ success: boolean }> {
    vscode.window.showWarningMessage(args.message);
    logger.info(`✅ Showed warning message: ${args.message}`);
    return { success: true };
}

// ============================================================================
// 用户输入工具
// ============================================================================

/**
 * 询问用户输入
 */
export const askQuestionToolDefinition = {
    name: "askQuestion",
    description: "Ask the user for text input via an input box",
    parameters: {
        type: "object",
        properties: {
            question: {
                type: "string",
                description: "Question to ask the user"
            },
            placeholder: {
                type: "string",
                description: "Placeholder text for the input box (optional)"
            }
        },
        required: ["question"]
    },
    // 🚀 智能分类属性
    interactionType: 'interactive',
    riskLevel: 'low',
    requiresConfirmation: false
};

export async function askQuestion(args: { question: string; placeholder?: string }): Promise<{ 
    success: boolean; 
    answer?: string; 
    cancelled?: boolean 
}> {
    try {
        const answer = await vscode.window.showInputBox({
            prompt: args.question,
            placeHolder: args.placeholder
        });
        
        if (answer === undefined) {
            logger.info(`❌ User cancelled question: ${args.question}`);
            return { success: true, cancelled: true };
        }
        
        logger.info(`✅ User answered question: ${args.question} → ${answer}`);
        return { success: true, answer };
    } catch (error) {
        const errorMsg = `Failed to ask question: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false };
    }
}

// ============================================================================
// 智能建议工具
// ============================================================================

/**
 * 🚀 智能响应工具：在聊天中直接提供建议和解释（替代弹出选择框）
 * 核心价值：保持聊天连续性，让AI做出智能决策而不是打断用户
 * 使用场景：当AI需要向用户说明情况并建议下一步行动时
 */
export const suggestNextActionToolDefinition = {
    name: "suggestNextAction",
    description: "Provide intelligent suggestions and explanations directly in chat (replaces intrusive choice dialogs)",
    parameters: {
        type: "object",
        properties: {
            situation: {
                type: "string",
                description: "Current situation or context that needs to be explained to the user"
            },
            recommendation: {
                type: "string",
                description: "AI's intelligent recommendation for the next action"
            },
            reasoning: {
                type: "string",
                description: "Brief explanation of why this recommendation makes sense"
            },
            alternatives: {
                type: "array",
                items: { type: "string" },
                description: "Optional: other possible actions the user could consider"
            }
        },
        required: ["situation", "recommendation", "reasoning"]
    }
};

export async function suggestNextAction(args: { 
    situation: string;
    recommendation: string;
    reasoning: string;
    alternatives?: string[];
}): Promise<{ 
    success: boolean; 
    suggestion: string;
}> {
    try {
        // 构建智能建议响应
        let suggestion = `**当前情况：** ${args.situation}\n\n`;
        suggestion += `**我的建议：** ${args.recommendation}\n\n`;
        suggestion += `**原因：** ${args.reasoning}`;
        
        if (args.alternatives && args.alternatives.length > 0) {
            suggestion += '\n\n**其他选项：**\n';
            args.alternatives.forEach((alt, index) => {
                suggestion += `${index + 1}. ${alt}\n`;
            });
            suggestion += '\n如果你希望尝试其他方案，请告诉我你的想法。';
        }
        
        logger.info(`✅ AI provided intelligent suggestion: ${args.recommendation}`);
        return { success: true, suggestion };
    } catch (error) {
        const errorMsg = `Failed to provide suggestion: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, suggestion: '抱歉，无法提供建议。' };
    }
}

// ============================================================================
// 进度指示器工具
// ============================================================================

/**
 * 🚀 用户体验增强工具：显示进度指示器
 * 高价值场景：长时间操作时提供进度反馈，避免界面卡住
 * SRS场景：调用远程RAG生成完整SRS文档时显示"正在生成，请稍候..."
 */
export const showProgressIndicatorToolDefinition = {
    name: "showProgressIndicator",
    description: "Show a progress indicator while performing a long-running operation",
    parameters: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "Title of the progress indicator"
            },
            message: {
                type: "string",
                description: "Message to display during the operation"
            },
            cancellable: {
                type: "boolean",
                description: "Whether the operation can be cancelled (default: false)"
            }
        },
        required: ["title", "message"]
    }
};

// 注意：这个工具比较特殊，它需要配合具体的异步任务使用
// 在实际的specialist层中，会与其他工具组合使用
export async function showProgressIndicator(args: { 
    title: string; 
    message: string; 
    cancellable?: boolean 
}): Promise<{ success: boolean; error?: string }> {
    try {
        // 这是一个模拟的进度指示器，实际的specialist层会传入具体的任务
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: args.title,
            cancellable: args.cancellable || false
        }, async (progress, token) => {
            progress.report({ message: args.message });
            
            // 模拟一个短暂的操作
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (token.isCancellationRequested) {
                throw new Error('Operation was cancelled');
            }
        });
        
        logger.info(`✅ Progress indicator completed: ${args.title}`);
        return { success: true };
    } catch (error) {
        const errorMsg = `Progress indicator failed: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
    }
}

// ============================================================================
// 导出定义和实现
// ============================================================================

export const interactionToolDefinitions = [
    showInformationMessageToolDefinition,
    showWarningMessageToolDefinition,
    askQuestionToolDefinition,
    suggestNextActionToolDefinition,
    showProgressIndicatorToolDefinition
];

export const interactionToolImplementations = {
    showInformationMessage,
    showWarningMessage,
    askQuestion,
    suggestNextAction,
    showProgressIndicator
}; 