/**
 * SemanticEditEngine - 语义编辑引擎
 * 
 * 基于VSCode原生WorkspaceEdit和AST语义定位，
 * 实现精确、安全、原子性的语义编辑操作
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { SemanticLocator, SemanticTarget } from '../atomic/semantic-locator';

const logger = Logger.getInstance();

/**
 * 语义编辑意图接口
 */
export interface SemanticEditIntent {
    type: 'replace_section' | 'insert_after_section' | 'append_to_list' | 'update_subsection' | 'insert_before_section'
        // 🚀 新增：行内编辑类型
        | 'update_content_in_section' | 'insert_line_in_section' | 'remove_content_in_section' 
        | 'append_to_section' | 'prepend_to_section';
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
        // 🚀 自动设置position以支持所有section操作类型
        let adjustedTarget = { ...intent.target };
        
        if (intent.type === 'append_to_section') {
            adjustedTarget.position = 'append';
            logger.info(`🔧 Auto-setting position to 'append' for append_to_section operation`);
        } else if (intent.type === 'prepend_to_section') {
            adjustedTarget.position = 'prepend';
            logger.info(`🔧 Auto-setting position to 'prepend' for prepend_to_section operation`);
        } else if (intent.type === 'insert_after_section') {
            adjustedTarget.position = 'after';
            logger.info(`🔧 Auto-setting position to 'after' for insert_after_section operation`);
        } else if (intent.type === 'insert_before_section') {
            adjustedTarget.position = 'before';
            logger.info(`🔧 Auto-setting position to 'before' for insert_before_section operation`);
        }
        
        // 使用语义定位器找到目标位置
        const location = locator.findTarget(adjustedTarget);
        
        if (!location.found) {
            logger.warn(`⚠️ Target not found for intent: ${intent.target.sectionName}`);
            return false;
        }
        
        // 根据意图类型执行不同的编辑操作
        switch (intent.type) {
            case 'replace_section':
                if (!location.range) {
                    logger.error(`Replace operation requires range, but none found`);
                    return false;
                }
                workspaceEdit.replace(targetFileUri, location.range, intent.content);
                break;
                
            case 'insert_after_section':
                if (!location.insertionPoint) {
                    logger.error(`Insert operation requires insertion point, but none found`);
                    return false;
                }
                workspaceEdit.insert(targetFileUri, location.insertionPoint, intent.content + '\n');
                break;
                
            case 'insert_before_section':
                if (!location.insertionPoint) {
                    logger.error(`Insert operation requires insertion point, but none found`);
                    return false;
                }
                workspaceEdit.insert(targetFileUri, location.insertionPoint, intent.content + '\n');
                break;
                
            case 'append_to_list':
                if (!location.insertionPoint) {
                    logger.error(`Append operation requires insertion point, but none found`);
                    return false;
                }
                workspaceEdit.insert(targetFileUri, location.insertionPoint, '\n' + intent.content);
                break;
                
            case 'update_subsection':
                if (!location.range) {
                    logger.error(`Update operation requires range, but none found`);
                    return false;
                }
                workspaceEdit.replace(targetFileUri, location.range, intent.content);
                break;
                
            // 🚀 新增：行内编辑操作
            case 'update_content_in_section':
                if (!location.range) {
                    logger.error(`Update content operation requires range, but none found`);
                    return false;
                }
                workspaceEdit.replace(targetFileUri, location.range, intent.content);
                break;
                
            case 'insert_line_in_section':
                if (!location.insertionPoint) {
                    logger.error(`Insert line operation requires insertion point, but none found`);
                    return false;
                }
                workspaceEdit.insert(targetFileUri, location.insertionPoint, intent.content + '\n');
                break;
                
            case 'remove_content_in_section':
                if (!location.range) {
                    logger.error(`Remove content operation requires range, but none found`);
                    return false;
                }
                workspaceEdit.delete(targetFileUri, location.range);
                break;
                
            case 'append_to_section':
                if (!location.insertionPoint) {
                    logger.error(`Append to section operation requires insertion point, but none found`);
                    return false;
                }
                // 🚀 在章节末尾追加内容，前面加换行符确保格式正确
                const appendContent = '\n' + intent.content;
                workspaceEdit.insert(targetFileUri, location.insertionPoint, appendContent);
                logger.info(`📝 Appending content to section with proper formatting`);
                break;
                
            case 'prepend_to_section':
                if (!location.insertionPoint) {
                    logger.error(`Prepend to section operation requires insertion point, but none found`);
                    return false;
                }
                // 🚀 在章节开头插入内容，后面加换行符确保格式正确
                const prependContent = intent.content + '\n';
                workspaceEdit.insert(targetFileUri, location.insertionPoint, prependContent);
                logger.info(`📝 Prepending content to section with proper formatting`);
                break;
                
            default:
                logger.error(`Unknown intent type: ${intent.type}`);
                return false;
        }
        
        logger.info(`📝 Added ${intent.type} operation to workspace edit`);
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
        
        if (typeof intent.content !== 'string') {
            errors.push('Intent content must be a string');
        }
        
        if (!intent.reason) {
            errors.push('Intent missing reason field');
        }
        
        // 验证intent类型
        const validTypes = [
            'replace_section', 'insert_after_section', 'append_to_list', 'update_subsection', 'insert_before_section',
            // 🚀 新增：行内编辑类型
            'update_content_in_section', 'insert_line_in_section', 'remove_content_in_section', 
            'append_to_section', 'prepend_to_section'
        ];
        if (!validTypes.includes(intent.type)) {
            errors.push(`Invalid intent type: ${intent.type}`);
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
    description: "Execute semantic editing operations on documents using VSCode native APIs",
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
                                "replace_section", "insert_after_section", "append_to_list", "update_subsection", "insert_before_section",
                                // 🚀 新增：行内编辑类型
                                "update_content_in_section", "insert_line_in_section", "remove_content_in_section", 
                                "append_to_section", "prepend_to_section"
                            ],
                            description: "Type of semantic edit operation"
                        },
                        target: {
                            type: "object",
                            properties: {
                                sectionName: {
                                    type: "string",
                                    description: "Name of the target section"
                                },
                                subsection: {
                                    type: "string",
                                    description: "Name of the target subsection (optional)"
                                },
                                position: {
                                    type: "string",
                                    enum: ["before", "after", "replace", "append", "prepend"],
                                    description: "Position type for the edit"
                                },
                                anchor: {
                                    type: "string",
                                    description: "Anchor text for precise positioning (optional)"
                                },
                                // 🚀 新增：行内编辑定位字段
                                targetContent: {
                                    type: "string",
                                    description: "Target content to modify/replace within the section (for inline editing)"
                                },
                                afterContent: {
                                    type: "string",
                                    description: "Content after which to insert new line (for insert_line_in_section)"
                                },
                                beforeContent: {
                                    type: "string",
                                    description: "Content before which to insert new content"
                                },
                                contentToRemove: {
                                    type: "string",
                                    description: "Specific content to remove (for remove_content_in_section)"
                                },
                                // ✨ 新增：上下文锚点字段
                                contextAnchor: {
                                    type: "string",
                                    description: "Context anchor to precisely locate targetContent when multiple identical content exists (e.g., 'req-id: FR-PDF-005'). The system will first find this anchor, then search for targetContent within 10 lines of the anchor."
                                }
                            },
                            required: ["sectionName"]
                        },
                        content: {
                            type: "string",
                            description: "Content for the edit operation"
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
        'ORCHESTRATOR_TOOL_EXECUTION',
        'SPECIALIST',
        'DOCUMENT'
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