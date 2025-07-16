/**
 * SemanticEditEngine - 语义编辑引擎
 * 
 * 基于VSCode原生WorkspaceEdit和AST语义定位，
 * 实现精确、安全、原子性的语义编辑操作
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { SemanticLocator, SemanticTarget } from '../atomic/semantic-locator';
import { CallerType } from '../../types/index';

const logger = Logger.getInstance();

/**
 * 语义编辑意图接口
 */
export interface SemanticEditIntent {
    type: 'replace_entire_section' | 'replace_lines_in_section';
    target: SemanticTarget;
    content: string;
    reason: string;
    priority: number;
}

/**
 * 语义编辑结果接口
 */
export interface SemanticEditResult {
    success: boolean;
    appliedIntents: SemanticEditIntent[];
    failedIntents: SemanticEditIntent[];
    error?: string;
    semanticErrors?: string[];
    saveResult?: {                    // 🆕 新增保存结果
        success: boolean;
        executionTime: number;        // 保存操作耗时（毫秒）
        error?: string;
    };
    metadata?: {
        executionTime: number;
        timestamp: string;
        astNodeCount: number;
        documentLength: number;
    };
}

/**
 * 执行语义编辑操作
 * @param intents 语义编辑意图数组
 * @param targetFileUri 目标文件URI
 * @returns 语义编辑结果
 */
export async function executeSemanticEdits(
    intents: SemanticEditIntent[],
    targetFileUri: vscode.Uri
): Promise<SemanticEditResult> {
    const startTime = Date.now();
    const appliedIntents: SemanticEditIntent[] = [];
    const failedIntents: SemanticEditIntent[] = [];
    const semanticErrors: string[] = [];
    
    try {
        logger.info(`🔧 Starting semantic editing: ${intents.length} intents for ${targetFileUri.fsPath}`);
        
        // 打开文档并获取内容
        const document = await vscode.workspace.openTextDocument(targetFileUri);
        const markdownContent = document.getText();
        
        // 🚀 AST重构：直接使用文档内容创建语义定位器
        const locator = new SemanticLocator(markdownContent);
        
        if (locator.getNodeCount() === 0) {
            logger.warn(`⚠️ Document has no identifiable structure, falling back to simple editing`);
        }
        
        // 按优先级排序意图
        const sortedIntents = [...intents].sort((a, b) => (b.priority || 0) - (a.priority || 0));
        
        // 创建WorkspaceEdit
        const workspaceEdit = new vscode.WorkspaceEdit();
        
        // 处理每个编辑意图
        for (const intent of sortedIntents) {
            try {
                logger.info(`🎯 Processing intent: ${intent.type} -> ${intent.target.sectionName}`);
                
                const applied = await applySemanticIntent(workspaceEdit, targetFileUri, intent, locator);
                
                if (applied) {
                    appliedIntents.push(intent);
                    logger.info(`✅ Intent applied successfully: ${intent.type}`);
                } else {
                    failedIntents.push(intent);
                    semanticErrors.push(`Failed to apply intent: ${intent.type} -> ${intent.target.sectionName}`);
                    logger.warn(`❌ Intent failed: ${intent.type} -> ${intent.target.sectionName}`);
                }
                
            } catch (error) {
                failedIntents.push(intent);
                const errorMsg = `Error processing intent: ${(error as Error).message}`;
                semanticErrors.push(errorMsg);
                logger.error(errorMsg);
            }
        }
        
        // 原子性应用所有编辑
        if (appliedIntents.length > 0) {
            logger.info(`🚀 Applying ${appliedIntents.length} edits atomically...`);
            const success = await vscode.workspace.applyEdit(workspaceEdit);
            
            if (!success) {
                // 如果应用失败，所有意图都标记为失败
                failedIntents.push(...appliedIntents);
                appliedIntents.length = 0;
                semanticErrors.push('WorkspaceEdit application failed');
                
                return {
                    success: false,
                    appliedIntents: [],
                    failedIntents,
                    error: 'Failed to apply workspace edit',
                    semanticErrors,
                    metadata: {
                        executionTime: Date.now() - startTime,
                        timestamp: new Date().toISOString(),
                        astNodeCount: locator.getNodeCount(),
                        documentLength: markdownContent.length
                    }
                };
            } else {
                // 🚀 新增：强制保存文档
                const saveStartTime = Date.now();
                let saveResult = {
                    success: false,
                    executionTime: 0,
                    error: undefined as string | undefined
                };

                try {
                    // 重新获取最新的文档对象（因为applyEdit后可能已更新）
                    const updatedDocument = await vscode.workspace.openTextDocument(targetFileUri);
                    
                    if (updatedDocument.isDirty) {
                        logger.info(`💾 Saving changes to disk: ${targetFileUri.fsPath}`);
                        saveResult.success = await updatedDocument.save();
                        
                        if (saveResult.success) {
                            logger.info(`✅ Document saved successfully`);
                        } else {
                            saveResult.error = 'Save operation returned false';
                            logger.warn(`⚠️ Failed to save document: ${saveResult.error}`);
                        }
                    } else {
                        // 文档不脏，认为保存成功
                        saveResult.success = true;
                        logger.info(`ℹ️ Document is clean, no save needed`);
                    }
                } catch (error) {
                    saveResult.error = (error as Error).message;
                    logger.error(`❌ Error while saving document: ${saveResult.error}`);
                } finally {
                    saveResult.executionTime = Date.now() - saveStartTime;
                }

                // 更新返回结果，包含保存信息
                const totalSuccess = appliedIntents.length;
                const totalFailed = failedIntents.length;
                
                logger.info(`🎉 Semantic editing complete: ${totalSuccess} success, ${totalFailed} failed`);
                
                // 🔧 修复：为失败情况生成清晰的错误信息
                let errorMessage: string | undefined = undefined;
                if (totalFailed > 0) {
                    const failureReasons = semanticErrors.length > 0 ? semanticErrors : 
                        failedIntents.map(intent => `${intent.type} -> ${intent.target.sectionName}`);
                    errorMessage = `语义编辑失败: ${failureReasons.join('; ')}`;
                }
                
                return {
                    success: totalSuccess > 0 && totalFailed === 0,
                    appliedIntents,
                    failedIntents,
                    error: errorMessage,  // 🔧 修复：添加清晰的错误信息
                    saveResult,  // 🆕 包含保存结果
                    semanticErrors: semanticErrors.length > 0 ? semanticErrors : undefined,
                    metadata: {
                        executionTime: Date.now() - startTime,
                        timestamp: new Date().toISOString(),
                        astNodeCount: locator.getNodeCount(),
                        documentLength: markdownContent.length
                    }
                };
            }
        }
        
        // 如果没有编辑需要应用，直接返回成功
        const totalSuccess = appliedIntents.length;
        const totalFailed = failedIntents.length;
        
        logger.info(`🎉 Semantic editing complete: ${totalSuccess} success, ${totalFailed} failed (no edits applied)`);
        
        // 🔧 修复：为失败情况生成清晰的错误信息（保持一致性）
        let errorMessage: string | undefined = undefined;
        if (totalFailed > 0) {
            const failureReasons = semanticErrors.length > 0 ? semanticErrors : 
                failedIntents.map(intent => `${intent.type} -> ${intent.target.sectionName}`);
            errorMessage = `语义编辑失败: ${failureReasons.join('; ')}`;
        }
        
        return {
            success: totalSuccess === 0 && totalFailed === 0, // 没有编辑时也算成功
            appliedIntents,
            failedIntents,
            error: errorMessage,  // 🔧 修复：添加清晰的错误信息
            semanticErrors: semanticErrors.length > 0 ? semanticErrors : undefined,
            metadata: {
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                astNodeCount: locator.getNodeCount(),
                documentLength: markdownContent.length
            }
        };
        
    } catch (error) {
        const errorMsg = `Semantic editing failed: ${(error as Error).message}`;
        logger.error(errorMsg);
        
        return {
            success: false,
            appliedIntents,
            failedIntents: intents,
            error: errorMsg,
            semanticErrors,
            metadata: {
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                astNodeCount: 0,
                documentLength: 0
            }
        };
    }
}

/**
 * 应用单个语义编辑意图
 */
async function applySemanticIntent(
    workspaceEdit: vscode.WorkspaceEdit,
    targetFileUri: vscode.Uri,
    intent: SemanticEditIntent,
    locator: SemanticLocator
): Promise<boolean> {
    try {
        // 使用语义定位器找到目标位置
        const location = locator.findTarget(intent.target);
        
        if (!location.found) {
            logger.warn(`⚠️ Target not found for intent: ${intent.target.sectionName}`);
            return false;
        }
        
        // 根据意图类型执行不同的编辑操作
        switch (intent.type) {
            case 'replace_entire_section':
                if (!location.range) {
                    logger.error(`Replace entire section operation requires range, but none found`);
                    return false;
                }
                workspaceEdit.replace(targetFileUri, location.range, intent.content);
                logger.info(`📝 Replacing entire section with new content`);
                break;
                
            case 'replace_lines_in_section':
                if (!location.range) {
                    logger.error(`Replace lines in section operation requires range, but none found`);
                    return false;
                }
                workspaceEdit.replace(targetFileUri, location.range, intent.content);
                logger.info(`📝 Replacing specific lines in section with new content`);
                break;
                
            default:
                logger.error(`Unknown intent type: ${intent.type}`);
                return false;
        }
        
        return true;
        
    } catch (error) {
        logger.error(`Failed to apply semantic intent: ${(error as Error).message}`);
        return false;
    }
}

/**
 * 验证语义编辑意图
 */
export function validateSemanticIntents(intents: SemanticEditIntent[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const intent of intents) {
        // 验证必需字段
        if (!intent.type) {
            errors.push('Intent missing type field');
        }
        
        if (!intent.target || !intent.target.sectionName) {
            errors.push('Intent missing target.sectionName field');
        }
        
        if (!intent.target || !intent.target.startFromAnchor) {
            errors.push('Intent missing target.startFromAnchor field (required)');
        }
        
        if (typeof intent.content !== 'string') {
            errors.push('Intent content must be a string');
        }
        
        if (!intent.reason) {
            errors.push('Intent missing reason field');
        }
        
        // 验证intent类型
        const validTypes = ['replace_entire_section', 'replace_lines_in_section'];
        if (intent.type && !validTypes.includes(intent.type)) {
            errors.push(`Invalid intent type: ${intent.type}. Valid types are: ${validTypes.join(', ')}`);
        }
        
        // 条件验证：replace_lines_in_section 必须有 targetContent
        if (intent.type === 'replace_lines_in_section') {
            if (!intent.target || !intent.target.targetContent) {
                errors.push('replace_lines_in_section operation requires target.targetContent field');
            }
        }
        
        // 验证优先级
        if (intent.priority !== undefined && (!Number.isInteger(intent.priority) || intent.priority < 0)) {
            errors.push('Intent priority must be a non-negative integer');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

// ============================================================================
// 工具定义导出
// ============================================================================

/**
 * 语义编辑工具定义
 */
export const executeSemanticEditsToolDefinition = {
    name: "executeSemanticEdits",
    description: "Execute semantic editing operations on markdown documents.",
    parameters: {
        type: "object",
        properties: {
            intents: {
                type: "array",
                description: "Array of semantic edit intents to execute",
                items: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            enum: [
                                "replace_entire_section",
                                "replace_lines_in_section"
                            ],
                            description: "Type of semantic edit operation. 'replace_entire_section': replaces entire section content. 'replace_lines_in_section': replaces specific targetContent within section, requires both targetContent and startFromAnchor."
                        },
                        target: {
                            type: "object",
                            properties: {
                                sectionName: {
                                    type: "string",
                                    description: "Name of the target section (required)"
                                },
                                targetContent: {
                                    type: "string",
                                    description: "Exact content to replace within the section. REQUIRED for 'replace_lines_in_section' operation. Must be precise match including whitespace."
                                },
                                startFromAnchor: {
                                    type: "string",
                                    description: "Anchor text to start searching from. REQUIRED. System finds this anchor first, then searches for targetContent within next 5 lines. Must appear before targetContent in the section."
                                }
                            },
                            required: ["sectionName", "startFromAnchor"]
                        },
                        content: {
                            type: "string",
                            description: "Replacement content for the edit operation"
                        },
                        reason: {
                            type: "string",
                            description: "Reason for this edit operation"
                        },
                        priority: {
                            type: "number",
                            description: "Priority of this edit (higher numbers = higher priority)",
                            default: 0
                        }
                    },
                    required: ["type", "target", "content", "reason"]
                }
            },
            targetFileUri: {
                type: "string",
                description: "VSCode URI of the target file"
            }
        },
        required: ["intents", "targetFileUri"]
    },
    // 访问控制
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.SPECIALIST,
        CallerType.DOCUMENT
    ],
    // 智能分类属性
    interactionType: 'confirmation',
    riskLevel: 'medium',
    requiresConfirmation: true
};

/**
 * 工具实现映射
 */
export const semanticEditEngineToolImplementations = {
    executeSemanticEdits: async (args: { intents: SemanticEditIntent[], targetFileUri: string }) => {
        const uri = vscode.Uri.parse(args.targetFileUri);
        return await executeSemanticEdits(args.intents, uri);
    }
};

/**
 * 工具定义数组
 */
export const semanticEditEngineToolDefinitions = [
    executeSemanticEditsToolDefinition
];

/**
 * Semantic Edit Engine 工具分类信息
 */
export const semanticEditEngineToolsCategory = {
    name: 'Semantic Edit Engine',
    description: 'Advanced semantic editing tools using VSCode native WorkspaceEdit API',
    tools: semanticEditEngineToolDefinitions.map(tool => tool.name),
    layer: 'document'
}; 