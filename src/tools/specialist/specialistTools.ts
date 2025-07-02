import * as vscode from 'vscode';
import { SpecialistExecutor } from '../../core/specialistExecutor';
import { SessionManager } from '../../core/session-manager';
import { OperationType } from '../../types/session';
import { Logger } from '../../utils/logger';

/**
 * 🚀 专家工具模块 v5.0 - 汇报模式架构
 * 
 * 设计理念：
 * 🧠 专家层：专门用于调用specialist模板的路由工具
 * 🔧 内部实现：基于SpecialistExecutor调用rules/specialists/*.md模板
 * 🔄 汇报模式：执行完成后向SessionManager汇报结果
 * 
 * 🚀 v5.0重大重构：
 * - 删除对sessionManagementTools的直接调用，消除循环依赖
 * - 改为通过SessionManager汇报执行结果（状态+日志）
 * - 实现单向数据流：specialistTools → SessionManager → sessionManagementTools
 * - 支持类型化操作日志（OperationType枚举）
 * 
 * 新的工作流程：
 * 1. 从SessionManager获取当前项目状态
 * 2. 向SessionManager汇报工具开始执行
 * 3. 执行specialist业务逻辑（调用100_create_srs.md等）
 * 4. 向SessionManager汇报执行结果（状态更新+日志记录）
 * 5. SessionManager负责统一协调状态管理和文件持久化
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
    const startTime = Date.now();
    const sessionManager = SessionManager.getInstance();
    
    try {
        logger.info(`🧠 [SPECIALIST] Creating comprehensive SRS for: ${args.userInput}`);
        
        if (!args.model) {
            return {
                success: false,
                error: "AI model is required but not provided"
            };
        }
        
        // 🚀 1. 从SessionManager获取当前状态
        let currentSession = await sessionManager.getCurrentSession();
        
        // 🚀 修复：只有在没有会话时才创建新会话，如果有会话但项目名不同则更新项目名
        if (!currentSession) {
            currentSession = await sessionManager.initializeProject(args.projectName);
        } else if (args.projectName && currentSession.projectName !== args.projectName) {
            // 更新现有会话的项目名，而不是创建新会话
            await sessionManager.updateSession({ projectName: args.projectName });
            currentSession = await sessionManager.getCurrentSession();
            if (!currentSession) {
                throw new Error('Failed to get updated session after project name update');
            }
        }
        
        // 确保currentSession不为null（已经在上面的逻辑中保证了）
        if (!currentSession) {
            throw new Error('Failed to get or create session');
        }
        
        logger.info(`📋 Using SessionContext ID: ${currentSession.sessionContextId} for project: ${currentSession.projectName || 'unnamed'}`);
        
        // 🚀 2. 记录工具开始执行
        await sessionManager.updateSessionWithLog({
            logEntry: {
                type: OperationType.TOOL_EXECUTION_START,
                operation: `Starting SRS creation`,
                toolName: 'createComprehensiveSRS',
                userInput: args.userInput,
                success: true
            }
        });
        
        // 🚀 3. 执行specialist逻辑
        const context = {
            userInput: args.userInput,
            sessionData: {
                ...args.sessionData,
                projectName: currentSession.projectName,
                baseDir: currentSession.baseDir,
                sessionContextId: currentSession.sessionContextId,
                activeFiles: currentSession.activeFiles
            },
            intent: 'create'
        };
        
        const result = await specialistExecutor.execute('100_create_srs', context, args.model);
        
        // 🚀 4. 解析specialist返回的结构化结果并汇报
        try {
            // 新架构：result已经是SpecialistOutput对象，不需要JSON.parse
            if (!result.success) {
                throw new Error(result.error || 'Specialist execution failed');
            }
            
            const content = result.content || 'SRS创建完成';
            const parsedResult = result.structuredData || {};
            
            // 🚀 处理需要聊天交互的情况
            if (parsedResult.needsChatInteraction) {
                logger.info(`💬 [SPECIALIST] SRS creation needs chat interaction: ${parsedResult.chatQuestion}`);
                
                // 汇报需要用户交互
                await sessionManager.updateSessionWithLog({
                    logEntry: {
                        type: OperationType.USER_QUESTION_ASKED,
                        operation: `Requesting user interaction: ${parsedResult.chatQuestion}`,
                        toolName: 'createComprehensiveSRS',
                        success: true,
                        executionTime: Date.now() - startTime
                    }
                });
                
                return {
                    success: true,
                    result: parsedResult.chatQuestion,
                    needsChatInteraction: true,
                    chatQuestion: parsedResult.chatQuestion,
                    resumeContext: parsedResult.resumeContext
                };
            }
            
            // 🚀 处理正常完成的情况
            if (parsedResult.completed) {
                logger.info(`✅ [SPECIALIST] SRS creation completed successfully: ${parsedResult.summary}`);
                
                // 汇报成功完成
                await sessionManager.updateSessionWithLog({
                    stateUpdates: {
                        activeFiles: ['SRS.md']  // 假设创建了SRS.md
                    },
                    logEntry: {
                        type: OperationType.TOOL_EXECUTION_END,
                        operation: `Successfully completed SRS creation: ${parsedResult.summary}`,
                        toolName: 'createComprehensiveSRS',
                        targetFiles: ['SRS.md'],
                        success: true,
                        executionTime: Date.now() - startTime
                    }
                });
                
                return { success: true, result: parsedResult.summary };
            } else {
                logger.warn(`⚠️ [SPECIALIST] SRS creation partially completed: ${parsedResult.summary}`);
                
                // 汇报部分完成
                await sessionManager.updateSessionWithLog({
                    stateUpdates: parsedResult.partialCompletion ? { activeFiles: ['SRS.md'] } : undefined,
                    logEntry: {
                        type: OperationType.TOOL_EXECUTION_END,
                        operation: `Partially completed SRS creation: ${parsedResult.summary}`,
                        toolName: 'createComprehensiveSRS',
                        targetFiles: parsedResult.partialCompletion ? ['SRS.md'] : [],
                        success: parsedResult.partialCompletion || false,
                        executionTime: Date.now() - startTime
                    }
                });
                
                return { success: parsedResult.partialCompletion || false, result: parsedResult.summary };
            }
        } catch (parseError) {
            // 兼容模式：旧格式的字符串结果，但现在result是SpecialistOutput对象
            const legacyContent = result.content || result.error || 'SRS创建完成';
            logger.info(`✅ [SPECIALIST] SRS creation completed (legacy mode), content length: ${legacyContent.length}`);
            
            await sessionManager.updateSessionWithLog({
                stateUpdates: { activeFiles: ['SRS.md'] },
                logEntry: {
                    type: OperationType.TOOL_EXECUTION_END,
                    operation: `SRS creation completed (legacy mode, ${legacyContent.length} chars)`,
                    toolName: 'createComprehensiveSRS',
                    targetFiles: ['SRS.md'],
                    success: result.success,
                    executionTime: Date.now() - startTime
                }
            });
            
            return { success: result.success, result: legacyContent };
        }
        
    } catch (error) {
        logger.error(`❌ [SPECIALIST] SRS creation failed`, error as Error);
        
        // 汇报执行失败
        try {
            await sessionManager.updateSessionWithLog({
                logEntry: {
                    type: OperationType.TOOL_EXECUTION_FAILED,
                    operation: `SRS creation failed: ${(error as Error).message}`,
                    toolName: 'createComprehensiveSRS',
                    success: false,
                    error: (error as Error).message,
                    executionTime: Date.now() - startTime
                }
            });
        } catch (logError) {
            logger.error('Failed to log error', logError as Error);
        }
        
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
    const startTime = Date.now();
    const sessionManager = SessionManager.getInstance();
    
    try {
        logger.info(`🧠 [SPECIALIST] Editing SRS document: ${args.userInput}`);
        
        if (!args.model) {
            return {
                success: false,
                error: "AI model is required but not provided"
            };
        }
        
        // 汇报开始执行
        await sessionManager.updateSessionWithLog({
            logEntry: {
                type: OperationType.TOOL_EXECUTION_START,
                operation: 'Starting SRS document editing',
                toolName: 'editSRSDocument',
                userInput: args.userInput,
                success: true
            }
        });
        
        // 获取当前会话信息
        const currentSession = await sessionManager.getCurrentSession();
        
        const context = {
            userInput: args.userInput,
            sessionData: {
                ...args.sessionData,
                projectName: currentSession?.projectName || args.projectName,
                baseDir: currentSession?.baseDir,
                sessionContextId: currentSession?.sessionContextId,
                activeFiles: currentSession?.activeFiles || []
            },
            intent: 'edit'
        };
        
        const result = await specialistExecutor.execute('200_edit_srs', context, args.model);
        
        // 汇报成功完成
        await sessionManager.updateSessionWithLog({
            logEntry: {
                type: OperationType.TOOL_EXECUTION_END,
                operation: 'SRS document editing completed',
                toolName: 'editSRSDocument',
                targetFiles: ['SRS.md'],
                success: true,
                executionTime: Date.now() - startTime
            }
        });
        
        logger.info(`✅ [SPECIALIST] SRS editing completed`);
        return { success: result.success, result: result.content || result.error || 'SRS编辑完成' };
        
    } catch (error) {
        logger.error(`❌ [SPECIALIST] SRS editing failed`, error as Error);
        
        // 汇报失败
        try {
            await sessionManager.updateSessionWithLog({
                logEntry: {
                    type: OperationType.TOOL_EXECUTION_FAILED,
                    operation: `SRS editing failed: ${(error as Error).message}`,
                    toolName: 'editSRSDocument',
                    success: false,
                    error: (error as Error).message,
                    executionTime: Date.now() - startTime
                }
            });
        } catch (logError) {
            logger.error('Failed to log error', logError as Error);
        }
        
        return { success: false, error: (error as Error).message };
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
    const startTime = Date.now();
    const sessionManager = SessionManager.getInstance();
    
    try {
        logger.info(`🧠 [SPECIALIST] Classifying project complexity: ${args.userInput}`);
        
        if (!args.model) {
            return {
                success: false,
                error: "AI model is required but not provided"
            };
        }
        
        // 汇报开始执行
        await sessionManager.updateSessionWithLog({
            logEntry: {
                type: OperationType.TOOL_EXECUTION_START,
                operation: 'Starting project complexity classification',
                toolName: 'classifyProjectComplexity',
                userInput: args.userInput,
                success: true
            }
        });
        
        const context = {
            userInput: args.userInput,
            projectDetails: args.projectDetails || {},
            intent: 'complexity_classification'
        };
        
        const result = await specialistExecutor.execute('complexity_classification', context, args.model);
        
        // 汇报成功完成
        await sessionManager.updateSessionWithLog({
            logEntry: {
                type: OperationType.TOOL_EXECUTION_END,
                operation: 'Project complexity classification completed',
                toolName: 'classifyProjectComplexity',
                success: true,
                executionTime: Date.now() - startTime
            }
        });
        
        logger.info(`✅ [SPECIALIST] Complexity classification completed`);
        return { success: result.success, result: result.content || result.error || '复杂度分类完成' };
        
    } catch (error) {
        logger.error(`❌ [SPECIALIST] Complexity classification failed`, error as Error);
        
        // 汇报失败
        try {
            await sessionManager.updateSessionWithLog({
                logEntry: {
                    type: OperationType.TOOL_EXECUTION_FAILED,
                    operation: `Complexity classification failed: ${(error as Error).message}`,
                    toolName: 'classifyProjectComplexity',
                    success: false,
                    error: (error as Error).message,
                    executionTime: Date.now() - startTime
                }
            });
        } catch (logError) {
            logger.error('Failed to log error', logError as Error);
        }
        
        return { success: false, error: (error as Error).message };
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
    const startTime = Date.now();
    const sessionManager = SessionManager.getInstance();
    
    try {
        logger.info(`🧠 [SPECIALIST] Linting SRS document in: ${args.projectPath}`);
        
        if (!args.model) {
            return {
                success: false,
                error: "AI model is required but not provided"
            };
        }
        
        // 汇报开始执行
        await sessionManager.updateSessionWithLog({
            logEntry: {
                type: OperationType.TOOL_EXECUTION_START,
                operation: `Starting SRS quality check for: ${args.projectPath}`,
                toolName: 'lintSRSDocument',
                success: true
            }
        });
        
        const context = {
            userInput: `Perform quality check on project: ${args.projectPath}`,
            sessionData: args.sessionData || {},
            intent: 'lint'
        };
        
        const result = await specialistExecutor.execute('400_lint_check', context, args.model);
        
        // 汇报成功完成
        await sessionManager.updateSessionWithLog({
            logEntry: {
                type: OperationType.TOOL_EXECUTION_END,
                operation: 'SRS quality check completed',
                toolName: 'lintSRSDocument',
                success: true,
                executionTime: Date.now() - startTime
            }
        });
        
        logger.info(`✅ [SPECIALIST] SRS linting completed`);
        return { success: result.success, result: result.content || result.error || 'SRS质量检查完成' };
        
    } catch (error) {
        logger.error(`❌ [SPECIALIST] SRS linting failed`, error as Error);
        
        // 汇报失败
        try {
            await sessionManager.updateSessionWithLog({
                logEntry: {
                    type: OperationType.TOOL_EXECUTION_FAILED,
                    operation: `SRS linting failed: ${(error as Error).message}`,
                    toolName: 'lintSRSDocument',
                    success: false,
                    error: (error as Error).message,
                    executionTime: Date.now() - startTime
                }
            });
        } catch (logError) {
            logger.error('Failed to log error', logError as Error);
        }
        
        return { success: false, error: (error as Error).message };
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