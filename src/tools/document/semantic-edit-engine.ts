/**
 * SemanticEditEngine - 语义编辑引擎
 * 
 * 基于VSCode原生WorkspaceEdit和AST语义定位，
 * 实现精确、安全、原子性的语义编辑操作
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { SemanticLocator, SemanticTarget, InsertionPosition } from '../atomic/semantic-locator';
import { CallerType } from '../../types/index';

const logger = Logger.getInstance();

/**
 * 语义编辑意图接口
 */
export interface SemanticEditIntent {
    type: 'replace_entire_section_with_title' | 'replace_lines_in_section' | 'insert_entire_section' | 'insert_lines_in_section';
    target: SemanticTarget;
    content: string;
    reason: string;
    priority: number;
    
    // 🆕 Phase 2 增强：验证模式
    validateOnly?: boolean;                 // 仅验证，不实际执行编辑
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
        
        // 🆕 Phase 2 增强：检查是否有验证模式的意图
        const hasValidateOnly = sortedIntents.some(intent => intent.validateOnly);
        const hasRealEdits = sortedIntents.some(intent => !intent.validateOnly);
        
        // 创建WorkspaceEdit
        const workspaceEdit = new vscode.WorkspaceEdit();
        
        // 处理每个编辑意图
        for (const intent of sortedIntents) {
            try {
                logger.info(`🎯 Processing intent: ${intent.type} -> ${intent.target.path.join(' > ')}`);
                
                // 🆕 Phase 2 增强：构建语义定位目标（包含新字段）
                const semanticTarget: SemanticTarget = {
                    path: intent.target.path,
                    targetContent: intent.target.targetContent,
                    insertionPosition: intent.target.insertionPosition as InsertionPosition,
                    siblingIndex: intent.target.siblingIndex,
                    siblingOperation: intent.target.siblingOperation
                };
                
                // 根据操作类型执行定位
                const locationResult = locator.findTarget(semanticTarget, intent.type);
                
                if (!locationResult.found) {
                    logger.warn(`❌ Target not found: ${intent.target.path.join(' > ')}`);
                    failedIntents.push(intent);
                    semanticErrors.push(locationResult.error || 'Target location not found');
                    continue;
                }
                
                // 🆕 Phase 2 增强：验证模式处理
                if (intent.validateOnly) {
                    appliedIntents.push(intent);
                    logger.info(`✅ Intent validated successfully: ${intent.type} (validate-only mode)`);
                } else {
                    const applied = await applySemanticIntent(workspaceEdit, targetFileUri, intent, locator);
                    
                    if (applied) {
                        appliedIntents.push(intent);
                        logger.info(`✅ Intent applied successfully: ${intent.type}`);
                    } else {
                        failedIntents.push(intent);
                        semanticErrors.push(`Failed to apply intent: ${intent.type} -> ${intent.target.path.join(' > ')}`);
                        logger.warn(`❌ Intent failed: ${intent.type} -> ${intent.target.path.join(' > ')}`);
                    }
                }
                
            } catch (error) {
                failedIntents.push(intent);
                const errorMsg = `Error processing intent: ${(error as Error).message}`;
                semanticErrors.push(errorMsg);
                logger.error(errorMsg);
            }
        }
        
        // 原子性应用所有编辑
        // 🆕 Phase 2 增强：只应用非验证模式的编辑
        const realEditAppliedIntents = appliedIntents.filter(intent => !intent.validateOnly);
        if (realEditAppliedIntents.length > 0) {
            logger.info(`🚀 Applying ${realEditAppliedIntents.length} edits atomically...`);
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
                        failedIntents.map(intent => `${intent.type} -> ${intent.target.path.join(' > ')}`);
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
                failedIntents.map(intent => `${intent.type} -> ${intent.target.path.join(' > ')}`);
            errorMessage = `语义编辑失败: ${failureReasons.join('; ')}`;
        }
        
        return {
            success: hasValidateOnly ? (totalFailed === 0) : (totalSuccess === 0 && totalFailed === 0), // 🆕 验证模式特殊处理
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
        // 使用语义定位器找到目标位置，传递操作类型
        const location = locator.findTarget(intent.target, intent.type);
        
        if (!location.found) {
            logger.warn(`⚠️ Target not found for intent: ${intent.target.path.join(' > ')}`);
            if (location.error) {
                logger.warn(`⚠️ Error details: ${location.error}`);
            }
            return false;
        }
        
        // 根据意图类型执行不同的编辑操作
        switch (intent.type) {
            case 'replace_entire_section_with_title':
            case 'replace_lines_in_section':
                if (!location.range) {
                    logger.error(`Replace operation requires range, but none found`);
                    return false;
                }
                workspaceEdit.replace(targetFileUri, location.range, intent.content);
                logger.info(`📝 Replacing ${intent.type === 'replace_entire_section_with_title' ? 'entire section' : 'lines in section'}`);
                break;
                
            case 'insert_entire_section':
            case 'insert_lines_in_section':
                if (!location.insertionPoint) {
                    logger.error(`Insert operation requires insertion point, but none found`);
                    return false;
                }
                workspaceEdit.insert(targetFileUri, location.insertionPoint, intent.content);
                logger.info(`📝 Inserting ${intent.type === 'insert_entire_section' ? 'entire section' : 'lines in section'}`);
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
        
        if (!intent.target || !intent.target.path || intent.target.path.length === 0) {
            errors.push('Intent missing target.path field (required)');
        }
        
        if (!intent.target || !intent.target.insertionPosition) {
            errors.push('Intent missing target.insertionPosition field (required)');
        }
        
        if (typeof intent.content !== 'string') {
            errors.push('Intent content must be a string');
        }
        
        if (!intent.reason) {
            errors.push('Intent missing reason field');
        }
        
        // 验证intent类型
        const validTypes = ['replace_entire_section_with_title', 'replace_lines_in_section', 'insert_entire_section', 'insert_lines_in_section'];
        if (intent.type && !validTypes.includes(intent.type)) {
            errors.push(`Invalid intent type: ${intent.type}. Valid types are: ${validTypes.join(', ')}`);
        }
        
        // 条件验证：replace_lines_in_section 必须有 targetContent
        if (intent.type === 'replace_lines_in_section') {
            if (!intent.target || !intent.target.targetContent) {
                errors.push('replace_lines_in_section operation requires target.targetContent field');
            }
        }
        
        // 条件验证：插入操作必须有 insertionPosition
        if (intent.type?.startsWith('insert_')) {
            if (!intent.target || !intent.target.insertionPosition) {
                errors.push(`${intent.type} operation requires target.insertionPosition field`);
            }
            
            const validPositions = ['before', 'after', 'inside'];
            if (intent.target?.insertionPosition && !validPositions.includes(intent.target.insertionPosition)) {
                errors.push(`Invalid insertion position: ${intent.target.insertionPosition}. Valid positions: ${validPositions.join(', ')}`);
            }
            
            // insert_lines_in_section with 'inside' 的基本验证
            if (intent.type === 'insert_lines_in_section' && 
                intent.target?.insertionPosition === 'inside') {
                // 路径验证在上面已经完成，这里不需要额外验证
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
 * Markdown语义编辑工具定义 (🆕 Phase 2 Enhanced)
 */
export const executeMarkdownEditsToolDefinition = {
    name: "executeMarkdownEdits",
    description: "🆕 Enhanced semantic editing tool for Markdown documents with precise sibling-based positioning and validation mode. Features: path-based targeting, AST analysis, siblingIndex positioning, and dry-run validation.",
    parameters: {
        type: "object",
        properties: {
            description: {
                type: "string",
                description: "Brief description of what this editing operation will accomplish (e.g., 'Add security requirements section to SRS document', 'Fix formatting in user stories'). Used for history tracking."
            },
            intents: {
                type: "array",
                description: "Array of semantic edit intents to execute",
                items: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            enum: [
                                "replace_entire_section_with_title",
                                "replace_lines_in_section",
                                "insert_entire_section",
                                "insert_lines_in_section"
                            ],
                            description: "Type of semantic edit operation:\n- 'replace_entire_section_with_title': replaces entire section INCLUDING the section heading/title. The target section (from heading line to section end) will be completely replaced with new content.\n- 'replace_lines_in_section': replaces specific targetContent within section content (requires 'targetContent' field). Only the matching text is replaced, section heading is preserved.\n- 'insert_entire_section': inserts new complete section at specified position relative to reference section (requires 'insertionPosition': before/after/inside).\n- 'insert_lines_in_section': inserts content lines at specified position relative to reference section (requires 'insertionPosition': before/after/inside)."
                        },
                        target: {
                            type: "object",
                            properties: {
                                path: {
                                    type: "array",
                                    description: "Array of section names to navigate to the target section. Each element represents a level in the document hierarchy (e.g., ['4. User Stories', 'User Story Details', 'US-AUTH-001']). REQUIRED for all operations. Provides precise targeting without ambiguity. ⚠️ CRITICAL: MUST include ALL hierarchical levels in order - NO LEVEL SKIPPING allowed. If document has structure 'Level2 > Level3 > Level4', you CANNOT use path ['Level2', 'Level4'] - you MUST use complete path ['Level2', 'Level3', 'Level4']. Incomplete paths will fail matching. 🚀 NEW: Simplified Path Matching - In single-root documents, you can use simplified 2-element paths like ['Heading2', 'TargetElement'] which will automatically match the first occurrence of Heading2 followed by any nested TargetElement. If multiple matches are found, an error will be thrown with all possible complete paths for disambiguation. Use this feature to simplify path specification while maintaining precision.",
                                    items: {
                                        type: "string"
                                    }
                                },
                                targetContent: {
                                    type: "string",
                                    description: "Exact content to replace within section. REQUIRED for 'replace_lines_in_section' operation. Must be precise match including whitespace."
                                },
                                insertionPosition: {
                                    type: "string",
                                    enum: ["before", "after", "inside"],
                                    description: "⚠️ MANDATORY for insert_entire_section and insert_lines_in_section operations. Position relative to reference section: 'before'=insert before section start, 'after'=insert after section end, 'inside'=insert within section content. IGNORED for replace operations."
                                },
                                siblingIndex: {
                                    type: "number",
                                    description: "🆕 Phase 2 Enhancement: Sibling node index (0-based) for precise positioning when insertionPosition='inside'. Used to specify which child section to insert before/after. Must be used together with siblingOperation."
                                },
                                siblingOperation: {
                                    type: "string",
                                    enum: ["before", "after"],
                                    description: "🆕 Phase 2 Enhancement: Operation relative to the sibling specified by siblingIndex. 'before'=insert before the sibling, 'after'=insert after the sibling. Must be used together with siblingIndex."
                                }
                            },
                            required: ["path"]
                            // Note: insertionPosition is conditionally required based on operation type:
                            // - REQUIRED for: insert_entire_section, insert_lines_in_section  
                            // - NOT USED for: replace_entire_section_with_title, replace_lines_in_section
                            // Validation enforced at runtime in handleInsertionOperation()
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
                            description: "Priority level for operation execution (higher numbers execute first)",
                            default: 0
                        },
                        validateOnly: {
                            type: "boolean",
                            description: "🆕 Phase 2 Enhancement: When true, only validates the intent without actually executing the edit. Useful for dry-run validation before actual execution.",
                            default: false
                        }
                    },
                    required: ["type", "target", "content", "reason"]
                }
            },
            targetFile: {
                type: "string",
                description: "Path to the target Markdown file. If relative path, will be resolved relative to current project's {baseDir} (from SessionContext) or workspace root as fallback. Absolute paths are used directly."
            }
        },
        required: ["description", "intents", "targetFile"]
    },
    // 访问控制
            accessibleBy: [
            CallerType.ORCHESTRATOR_TOOL_EXECUTION,
            CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
            CallerType.SPECIALIST,
            CallerType.DOCUMENT
        ],
    // 智能分类属性
    interactionType: 'confirmation',
    riskLevel: 'medium',
    requiresConfirmation: true
};

/**
 * 🚀 智能路径解析：支持相对路径和绝对路径
 * 优先使用SessionContext的baseDir，回退到VSCode工作区
 */
async function resolveWorkspacePath(relativePath: string): Promise<string> {
    // 如果已经是绝对路径，直接返回
    if (path.isAbsolute(relativePath)) {
        logger.info(`🔗 路径解析（绝对路径）: ${relativePath}`);
        return relativePath;
    }

    try {
        // 🚀 优先获取SessionContext的baseDir
        const { SessionManager } = await import('../../core/session-manager');
        const sessionManager = SessionManager.getInstance();
        const currentSession = await sessionManager.getCurrentSession();
        
        if (currentSession?.baseDir) {
            const absolutePath = path.resolve(currentSession.baseDir, relativePath);
            logger.info(`🔗 路径解析（使用项目baseDir）: ${relativePath} -> ${absolutePath}`);
            logger.info(`📂 项目baseDir: ${currentSession.baseDir}`);
            return absolutePath;
        } else {
            logger.warn(`⚠️ SessionContext中没有baseDir，回退到工作区根目录`);
        }
    } catch (error) {
        logger.warn(`⚠️ 获取SessionContext失败，回退到工作区根目录: ${(error as Error).message}`);
    }

    // 🚀 回退策略：使用VSCode工作区根目录
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('未找到VSCode工作区，无法解析文件路径');
    }

    // 使用第一个工作区文件夹作为根目录
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const absolutePath = path.resolve(workspaceRoot, relativePath);

    logger.info(`🔗 路径解析（回退到工作区根目录）: ${relativePath} -> ${absolutePath}`);
    return absolutePath;
}

/**
 * 工具实现映射
 */
export const semanticEditEngineToolImplementations = {
    executeMarkdownEdits: async (args: { 
        description: string;
        intents: SemanticEditIntent[]; 
        targetFile: string;
    }) => {
        // 🚀 记录操作意图（用于调试和追踪）
        logger.info(`🎯 Markdown编辑意图: ${args.description}`);
        
        // 🚀 智能路径解析：支持相对路径和绝对路径
        const resolvedPath = await resolveWorkspacePath(args.targetFile);
        const uri = vscode.Uri.file(resolvedPath);
        return await executeSemanticEdits(args.intents, uri);
    }
};

/**
 * 工具定义数组
 */
export const semanticEditEngineToolDefinitions = [
    executeMarkdownEditsToolDefinition
];

/**
 * Markdown Semantic Edit Engine 工具分类信息
 */
export const semanticEditEngineToolsCategory = {
    name: 'Markdown Semantic Edit Engine',
    description: 'Advanced semantic editing tools for Markdown documents using VSCode native WorkspaceEdit API',
    tools: semanticEditEngineToolDefinitions.map(tool => tool.name),
    layer: 'document'
}; 