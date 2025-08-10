import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { CallerType } from '../../types/index';

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
    },
    // 🚀 访问控制：用户消息显示，不暴露给specialist
    accessibleBy: [
        // CallerType.ORCHESTRATOR_TOOL_EXECUTION,  // orchestrator可以显示状态信息
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // 回答用户问题时可能需要显示信息
        CallerType.DOCUMENT                       // 文档层工具可能需要提示用户
        // 注意：移除了CallerType.SPECIALIST，specialist应通过taskComplete等方式传递消息
    ]
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
    },
    // 🚀 访问控制：警告消息显示，不暴露给specialist
    accessibleBy: [
        // CallerType.ORCHESTRATOR_TOOL_EXECUTION,  // orchestrator可以显示警告
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // 回答用户问题时可能需要显示警告
        CallerType.DOCUMENT                       // 文档层工具可能需要警告用户
        // 注意：移除了CallerType.SPECIALIST，specialist应通过taskComplete等方式传递警告
    ]
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
 * 询问用户输入 - 🚀 支持Chat环境智能交互
 */
export const askQuestionToolDefinition = {
    name: "askQuestion",
    description: "Ask the user for text input - automatically adapts to chat environment or traditional VSCode input box",
    parameters: {
        type: "object",
        properties: {
            question: {
                type: "string",
                description: "Question to ask the user"
            },
            placeholder: {
                type: "string",
                description: "Placeholder text for the input box (optional, only used in traditional VSCode mode)"
            }
        },
        required: ["question"]
    },
    // 🚀 访问控制：用户交互工具，specialist需要能够询问用户
    accessibleBy: [
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,     // orchestrator可以代表系统询问用户
        CallerType.SPECIALIST_CONTENT,              // 内容specialist需要询问用户具体需求
        CallerType.SPECIALIST_PROCESS               // 流程specialist需要确认流程参数
    ],
    // 🚀 智能分类属性
    interactionType: 'interactive',
    riskLevel: 'low',
    requiresConfirmation: false
};

export async function askQuestion(args: { question: string; placeholder?: string }): Promise<{ 
    success: boolean; 
    answer?: string; 
    cancelled?: boolean;
    needsChatInteraction?: boolean;
    chatQuestion?: string;
}> {
    try {
        // 🚀 新增：检测是否在Chat环境中
        const inChatEnvironment = isInChatEnvironment();
        
        if (inChatEnvironment) {
            // 🚀 Chat环境：返回特殊状态，让聊天系统处理用户交互
            logger.info(`💬 [CHAT MODE] Requesting user interaction in chat: ${args.question}`);
            return {
                success: true,
                needsChatInteraction: true,
                chatQuestion: args.question,
                answer: undefined // 将由聊天系统填充
            };
        } else {
            // 🔄 传统VSCode环境：使用原来的输入框方式
            logger.info(`🖥️ [VSCODE MODE] Using traditional input box: ${args.question}`);
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
        }
    } catch (error) {
        const errorMsg = `Failed to ask question: ${(error as Error).message}`;
        logger.error(errorMsg);
        return { success: false };
    }
}

/**
 * 🚀 新增：检测是否在Chat环境中
 */
function isInChatEnvironment(): boolean {
    try {
        // 方法1：检查调用栈中是否包含Chat相关的类
        const stack = new Error().stack || '';
        const chatIndicators = [
            'SRSChatParticipant',
            'ChatParticipant',
            'specialistExecutor',
            'ConversationalExecutor',
            'chat-participant'
        ];
        
        const hasCharIndicator = chatIndicators.some(indicator => 
            stack.includes(indicator)
        );
        
        if (hasCharIndicator) {
            return true;
        }
        
        // 方法2：检查是否有Chat相关的环境标识
        // 这可以通过specialistExecutor或其他Chat组件设置
        const chatContext = (global as any).__SRS_CHAT_CONTEXT__;
        if (chatContext) {
            return true;
        }
        
        // 方法3：默认假设在Chat环境中（因为大部分情况下都是通过Chat调用的）
        // 如果需要更精确的检测，可以通过参数传递或其他方式
        return true; // 🚀 暂时默认为Chat环境，可以根据需要调整
        
    } catch (error) {
        logger.warn(`Failed to detect chat environment: ${(error as Error).message}`);
        return false; // 检测失败时使用传统模式
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
    },
    // 🚀 访问控制：智能建议工具，specialist需要能够提供建议
    accessibleBy: [
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,     // orchestrator可以提供系统级建议
        CallerType.SPECIALIST_CONTENT,              // 内容specialist需要提供内容相关建议
        CallerType.SPECIALIST_PROCESS               // 流程specialist需要提供流程建议
    ],
    // 🚀 智能分类属性
    interactionType: 'autonomous',
    riskLevel: 'low',
    requiresConfirmation: false
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



// ============================================================================
// 导出定义和实现
// ============================================================================

export const interactionToolDefinitions = [
    showInformationMessageToolDefinition,
    showWarningMessageToolDefinition,
    askQuestionToolDefinition,
    suggestNextActionToolDefinition
];

export const interactionToolImplementations = {
    showInformationMessage,
    showWarningMessage,
    askQuestion,
    suggestNextAction
}; 