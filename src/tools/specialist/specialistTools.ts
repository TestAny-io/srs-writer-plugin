import * as vscode from 'vscode';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { Logger } from '../../utils/logger';

/**
 * 专家工具模块 - 负责调用专家规则模板
 * 
 * 设计理念：
 * 🧠 专家层：专门用于调用specialist模板的路由工具
 * 🔧 内部实现：基于SpecialistExecutor调用rules/specialists/*.md模板
 * 
 * 这一层的工具负责：
 * - 路由到合适的专家模板
 * - 准备上下文数据
 * - 调用AI执行专家规则
 */

const logger = Logger.getInstance();
const specialistExecutor = new SpecialistExecutor();

// ============================================================================
// 核心专家工具 - 每个对应一个specialist模板
// ============================================================================

/**
 * 🎯 创建完整SRS文档 - 调用100_create_srs.md
 */
export const createComprehensiveSRSToolDefinition = {
    name: "createComprehensiveSRS",
    description: "Create a comprehensive, professional SRS document from user requirements using 100_create_srs specialist template",
    parameters: {
        type: "object",
        properties: {
            userInput: {
                type: "string",
                description: "User's requirements description"
            },
            projectName: {
                type: "string", 
                description: "Project name (optional)"
            },
            sessionData: {
                type: "object",
                description: "Session context data"
            }
        },
        required: ["userInput"]
    }
};

export async function createComprehensiveSRS(args: {
    userInput: string;
    projectName?: string;
    sessionData?: any;
    model?: vscode.LanguageModelChat;
}): Promise<{ success: boolean; result?: string; error?: string; needsChatInteraction?: boolean; chatQuestion?: string; resumeContext?: any }> {
    try {
        logger.info(`🧠 [SPECIALIST] Creating comprehensive SRS for: ${args.userInput}`);
        
        if (!args.model) {
            return {
                success: false,
                error: "AI model is required but not provided"
            };
        }
        
        const context = {
            userInput: args.userInput,
            sessionData: args.sessionData || {},
            intent: 'create'
        };
        
        const result = await specialistExecutor.executeSpecialist('100_create_srs', context, args.model);
        
        // 🚀 新增：解析specialist返回的JSON结果
        try {
            const parsedResult = JSON.parse(result);
            
            // 🚀 新增：处理需要聊天交互的情况
            if (parsedResult.needsChatInteraction) {
                logger.info(`💬 [SPECIALIST] SRS creation needs chat interaction: ${parsedResult.chatQuestion}`);
                return {
                    success: true,
                    result: parsedResult.chatQuestion, // 将问题返回给聊天系统
                    needsChatInteraction: true,
                    chatQuestion: parsedResult.chatQuestion,
                    resumeContext: parsedResult.resumeContext
                };
            }
            
            // 🚀 处理正常完成的情况
            if (parsedResult.completed) {
                logger.info(`✅ [SPECIALIST] SRS creation completed successfully: ${parsedResult.summary}`);
                return {
                    success: true,
                    result: parsedResult.summary
                };
            } else {
                logger.warn(`⚠️ [SPECIALIST] SRS creation partially completed: ${parsedResult.summary}`);
                return {
                    success: parsedResult.partialCompletion || false,
                    result: parsedResult.summary
                };
            }
        } catch (parseError) {
            // 🔄 兼容性：如果不是JSON格式，按原来的方式处理
            logger.info(`✅ [SPECIALIST] SRS creation completed (legacy format), length: ${result.length}`);
            return {
                success: true,
                result: result
            };
        }
        
    } catch (error) {
        logger.error(`❌ [SPECIALIST] SRS creation failed`, error as Error);
        return {
            success: false,
            error: (error as Error).message
        };
    }
}

/**
 * ✏️ 编辑SRS文档 - 调用200_edit_srs.md
 */
export const editSRSDocumentToolDefinition = {
    name: "editSRSDocument", 
    description: "Edit existing SRS document based on user requirements using 200_edit_srs specialist template",
    parameters: {
        type: "object",
        properties: {
            userInput: {
                type: "string",
                description: "Edit instructions from user"
            },
            projectName: {
                type: "string",
                description: "Current project name"
            },
            sessionData: {
                type: "object",
                description: "Session context data"
            }
        },
        required: ["userInput"]
    }
};

export async function editSRSDocument(args: {
    userInput: string;
    projectName?: string;
    sessionData?: any;
    model?: vscode.LanguageModelChat;
}): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
        logger.info(`🧠 [SPECIALIST] Editing SRS document: ${args.userInput}`);
        
        if (!args.model) {
            return {
                success: false,
                error: "AI model is required but not provided"
            };
        }
        
        const context = {
            userInput: args.userInput,
            sessionData: args.sessionData || {},
            intent: 'edit'
        };
        
        const result = await specialistExecutor.executeSpecialist('200_edit_srs', context, args.model);
        
        logger.info(`✅ [SPECIALIST] SRS editing completed`);
        return {
            success: true,
            result: result
        };
    } catch (error) {
        logger.error(`❌ [SPECIALIST] SRS editing failed`, error as Error);
        return {
            success: false,
            error: (error as Error).message
        };
    }
}

/**
 * 🔍 项目复杂度分类 - 调用ComplexityClassification.md
 */
export const classifyProjectComplexityToolDefinition = {
    name: "classifyProjectComplexity",
    description: "Classify project complexity and recommend appropriate SRS template using ComplexityClassification specialist template",
    parameters: {
        type: "object",
        properties: {
            userInput: {
                type: "string",
                description: "Project description for complexity analysis"
            },
            projectDetails: {
                type: "object",
                description: "Additional project details for analysis"
            }
        },
        required: ["userInput"]
    }
};

export async function classifyProjectComplexity(args: {
    userInput: string;
    projectDetails?: any;
    model?: vscode.LanguageModelChat;
}): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
        logger.info(`🧠 [SPECIALIST] Classifying project complexity: ${args.userInput}`);
        
        if (!args.model) {
            return {
                success: false,
                error: "AI model is required but not provided"
            };
        }
        
        const context = {
            userInput: args.userInput,
            projectDetails: args.projectDetails || {},
            intent: 'complexity_classification'
        };
        
        const result = await specialistExecutor.executeSpecialist('complexity_classification', context, args.model);
        
        logger.info(`✅ [SPECIALIST] Complexity classification completed`);
        return {
            success: true,
            result: result
        };
    } catch (error) {
        logger.error(`❌ [SPECIALIST] Complexity classification failed`, error as Error);
        return {
            success: false,
            error: (error as Error).message
        };
    }
}

/**
 * 🔧 SRS质量检查 - 调用400_lint_check.md
 */
export const lintSRSDocumentToolDefinition = {
    name: "lintSRSDocument",
    description: "Perform quality check on SRS document using 400_lint_check specialist template",
    parameters: {
        type: "object",
        properties: {
            projectPath: {
                type: "string",
                description: "Project directory path to check"
            },
            sessionData: {
                type: "object",
                description: "Session context data"
            }
        },
        required: ["projectPath"]
    }
};

export async function lintSRSDocument(args: {
    projectPath: string;
    sessionData?: any;
    model?: vscode.LanguageModelChat;
}): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
        logger.info(`🧠 [SPECIALIST] Linting SRS document in: ${args.projectPath}`);
        
        if (!args.model) {
            return {
                success: false,
                error: "AI model is required but not provided"
            };
        }
        
        const context = {
            userInput: `Perform quality check on project: ${args.projectPath}`,
            sessionData: args.sessionData || {},
            intent: 'lint'
        };
        
        const result = await specialistExecutor.executeSpecialist('400_lint_check', context, args.model);
        
        logger.info(`✅ [SPECIALIST] SRS linting completed`);
        return {
            success: true,
            result: result
        };
    } catch (error) {
        logger.error(`❌ [SPECIALIST] SRS linting failed`, error as Error);
        return {
            success: false,
            error: (error as Error).message
        };
    }
}



// ============================================================================
// 导出聚合 - 适配工具注册表格式
// ============================================================================

/**
 * 所有专家工具的定义数组
 */
export const specialistToolDefinitions = [
    createComprehensiveSRSToolDefinition,
    editSRSDocumentToolDefinition,
    classifyProjectComplexityToolDefinition,
    lintSRSDocumentToolDefinition
];

/**
 * 所有专家工具的实现映射
 */
export const specialistToolImplementations = {
    createComprehensiveSRS,
    editSRSDocument,
    classifyProjectComplexity,
    lintSRSDocument
};

/**
 * 专家工具分类信息
 */
export const specialistToolsCategory = {
    name: 'Specialist Tools',
    description: 'Expert tools that execute specialist rules from rules/specialists/ directory for SRS creation, editing, analysis, and quality checking',
    tools: specialistToolDefinitions.map(tool => tool.name),
    layer: 'specialist'
}; 