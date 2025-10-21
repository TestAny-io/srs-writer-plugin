/**
 * SelfContainedSemanticEditEngine - 🆕 自包含语义编辑引擎
 * 
 * 🚀 自包含架构: 内部自动解析文档结构，无需外部tocData
 * - 真正复用 readMarkdownFile 的成熟解析组件
 * - 基于稳定的SID算法自动定位
 * - 大幅简化AI调用接口，消除token浪费
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { resolveWorkspacePath } from '../../utils/path-resolver';
import { SmartIntentExecutor } from '../atomic/smart-intent-executor';
import { 
    SemanticEditIntent, 
    SemanticEditResult 
} from '../../types/semanticEditing';
// 🚀 真正复用 readMarkdownFile 的组件
import { 
    TableOfContents,
    ParsingEngine,
    StructureAnalyzer 
} from './enhanced-readfile-tools';

// 重新导出类型以保持兼容性
export { 
    SemanticEditIntent, 
    SemanticEditResult 
} from '../../types/semanticEditing';
import { CallerType } from '../../types/index';

const logger = Logger.getInstance();

// ========== 自包含语义编辑器 ==========

/**
 * 🆕 自包含语义编辑器 - 内部自动解析文档
 * 真正复用 readMarkdownFile 的解析组件，避免代码重复
 */
class SelfContainedSemanticEditor {
    private parsingEngine = new ParsingEngine();
    private structureAnalyzer = new StructureAnalyzer();

    /**
     * 执行自包含的语义编辑操作
     * @param intents 语义编辑意图数组（使用 sid + lineRange）
     * @param targetFileUri 目标文件URI
     * @returns 语义编辑结果
     */
    async executeEdits(
        intents: SemanticEditIntent[],
        targetFileUri: vscode.Uri
    ): Promise<SemanticEditResult> {
        const startTime = Date.now();
        
        try {
            logger.info(`🚀 启动自包含语义编辑: ${intents.length} intents for ${targetFileUri.fsPath}`);
            
            // 1. 内部读取文档
            logger.debug(`📖 读取文档内容...`);
            const document = await vscode.workspace.openTextDocument(targetFileUri);
            const markdownContent = document.getText();
            
            // 2. 内部解析文档结构（真正复用readMarkdownFile逻辑）
            logger.debug(`🔍 解析文档结构...`);
            const ast = await this.parsingEngine.parseDocument(markdownContent);
            const tocData = this.structureAnalyzer.generateTableOfContents(ast, markdownContent);
            
            logger.info(`📊 文档解析完成: ${tocData.length} 个章节, ${markdownContent.split('\n').length} 行`);
            
            // 3. 验证所有intents使用sid定位
            const invalidIntents = intents.filter(intent => !intent.target.sid);
            if (invalidIntents.length > 0) {
                logger.error(`❌ Found ${invalidIntents.length} intents without sid. All intents must use sid-based targeting.`);
                return this.createErrorResult(
                    intents,
                    'All intents must use sid-based targeting. Ensure target.sid is provided for each intent.',
                    startTime
                );
            }

            // 3.5. 🆕 批次冲突检测
            logger.debug(`🔍 检测批次冲突...`);
            const conflict = this.detectBatchConflicts(intents);
            if (conflict.hasConflict) {
                logger.error(`❌ Batch conflict: ${conflict.error}`);
                return {
                    success: false,
                    totalIntents: intents.length,
                    successfulIntents: 0,
                    appliedIntents: [],
                    failedIntents: intents.map(intent => ({
                        originalIntent: intent,
                        error: conflict.error!,
                        suggestion: `Split into two tool calls: 1) Delete section ${conflict.conflictingSid}, 2) In next call, insert/replace content.`,
                        canRetry: false
                    })),
                    warnings: [],
                    metadata: {
                        executionTime: Date.now() - startTime,
                        timestamp: new Date().toISOString(),
                        documentLength: markdownContent.split('\n').length,
                        conflictingSid: conflict.conflictingSid,
                        operations: conflict.operations,
                        rule: conflict.rule  // 🆕 冲突规则标识
                    }
                };
            }

            // 4. 执行编辑操作
            logger.debug(`⚡ 开始执行语义编辑...`);
            const executor = new SmartIntentExecutor(markdownContent, tocData, targetFileUri);
            const result = await executor.execute(intents);
            
            const executionTime = Date.now() - startTime;
            logger.info(`🏁 自包含语义编辑完成: ${result.successfulIntents}/${result.totalIntents} successful (${executionTime}ms)`);
            
            return result;
            
        } catch (error) {
            logger.error(`自包含语义编辑失败: ${(error as Error).message}`, error as Error);
            return this.createErrorResult(intents, (error as Error).message, startTime);
        }
    }

    /**
     * 创建错误结果
     */
    private createErrorResult(
        intents: SemanticEditIntent[],
        errorMessage: string,
        startTime: number
    ): SemanticEditResult {
            return {
            success: false,
            totalIntents: intents.length,
            successfulIntents: 0,
            appliedIntents: [],
            failedIntents: intents.map(intent => ({
                originalIntent: intent,
                error: errorMessage,
                suggestion: '请检查文件路径和SID是否正确',
                canRetry: true
            })),
            warnings: [],
            metadata: {
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                documentLength: 0
            }
        };
    }

    /**
     * 🆕 检测同批次中对同一 SID 的删除+修改冲突（类内方法）
     */
    private detectBatchConflicts(intents: SemanticEditIntent[]): {
        hasConflict: boolean;
        error?: string;
        conflictingSid?: string;
        operations?: string[];
        rule?: string;  // 🆕 冲突规则标识（便于统计和可观测性）
    } {
        // 1. 按 SID 分组
        const sidGroups = new Map<string, SemanticEditIntent[]>();
        for (const intent of intents) {
            const sid = intent.target.sid;
            if (!sidGroups.has(sid)) {
                sidGroups.set(sid, []);
            }
            sidGroups.get(sid)!.push(intent);
        }

        // 2. 检查每个 SID 组
        for (const [sid, sameIdIntents] of sidGroups) {
            const hasDelete = sameIdIntents.some(i => i.type.startsWith('delete_'));
            const hasModify = sameIdIntents.some(i =>
                i.type.startsWith('insert_') || i.type.startsWith('replace_')
            );

            if (hasDelete && hasModify) {
                return {
                    hasConflict: true,
                    error: `Batch conflict detected: Cannot delete and modify the same section (sid="${sid}") in a single batch.`,
                    conflictingSid: sid,
                    operations: sameIdIntents.map(i => i.type),
                    rule: 'DELETE_THEN_MODIFY_SAME_SID'  // 🆕 冲突规则标识
                };
            }
        }

        return { hasConflict: false };
    }
}

// ========== 对外接口实现 ==========

/**
 * 🆕 自包含的语义编辑主函数
 * 
 * ✅ 自包含架构: 内部自动解析文档结构，无需外部tocData
 * ✅ 大幅简化AI调用: 只需提供intents和targetFile
 * ✅ 完全复用成熟组件: 基于readMarkdownFile的稳定解析逻辑
 * 
 * @param intents 语义编辑意图数组（使用 sid + lineRange）
 * @param targetFileUri 目标文件URI
 * @returns 语义编辑结果
 */
export async function executeSemanticEdits(
    intents: SemanticEditIntent[],
    targetFileUri: vscode.Uri
    // ❌ 移除tocData参数！工具内部自动解析
): Promise<SemanticEditResult> {
    const editor = new SelfContainedSemanticEditor();
    return await editor.executeEdits(intents, targetFileUri);
}

// ========== 工具定义更新 ==========

/**
 * 🆕 自包含的executeMarkdownEdits工具定义
 * 
 * 🚀 重大简化: 移除tocData参数，工具内部自动解析文档结构
 */
export const executeMarkdownEditsToolDefinition = {
    name: "executeMarkdownEdits",
    description: "🔄 Semantic Edit Tool - lineRange uses section-relative line numbers (1-based). Field usage rules: replace_section_and_title requires sid; replace_section_content_only and insert_section_content_only require sid+lineRange; insert_section_and_title requires sid+insertionPosition. 🎯 Naming convention: *_and_title operations MUST include title in content; *_content_only operations must NOT include title",
    parameters: {
        type: "object",
        properties: {
            intents: {
                type: "array",
                description: "Semantic Edit Intents Array",
                items: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            enum: [
                                "replace_section_and_title",
                                "replace_section_content_only",
                                "insert_section_and_title",
                                "insert_section_content_only",
                                "delete_section_and_title",
                                "delete_section_content_only"
                            ],
                            description: "Edit Operation Type: replace_section_and_title(Replace entire section INCLUDING title - content MUST contain title), replace_section_content_only(Replace specific lines in section EXCLUDING title - content must NOT contain title), insert_section_and_title(Insert entire section including title), insert_section_content_only(Insert content in section excluding title), delete_section_and_title(Delete entire section including title and all subsections - content is ignored), delete_section_content_only(Delete section content but preserve title - content is ignored)"
                        },
                        target: {
                            type: "object",
                            properties: {
                                sid: {
                                    type: "string",
                                    description: "🎯 Section SID - Must be obtained by calling readMarkdownFile tool first. 🚨 CRITICAL: For replace_section_content_only and insert_section_content_only, use the LOWEST LEVEL SID (most specific/deepest SID that directly contains your target content)."
                                },
                                lineRange: {
                                    type: "object",
                                    properties: {
                                        startLine: {
                                            type: "number",
                                            description: "Target start line number (section-relative line number, 1-based). Line 1 is the first line of content within the section (excluding the section title). NEVER count the title line itself."
                                        },
                                        endLine: {
                                            type: "number", 
                                            description: "Target end line number (section-relative line number, 1-based). Must be >= startLine. Required to avoid ambiguity. NEVER count the title line itself."
                                        }
                                    },
                                    required: ["startLine", "endLine"],
                                    description: "🔄 Required for: replace_section_content_only, insert_section_content_only. Use section-relative line numbers (1-based). Line 1 = first content line after section title."
                                },
                                insertionPosition: {
                                    type: "string",
                                    enum: ["before", "after"],
                                    description: "🔄 Required for: insert_section_and_title. Only 'before' and 'after' are supported"
                                },
                                siblingIndex: {
                                    type: "number",
                                    description: "Sibling node index (advanced positioning)"
                                },
                                siblingOperation: {
                                    type: "string",
                                    enum: ["before", "after"],
                                    description: "Sibling node operation direction (advanced positioning)"
                                }
                            },
                            required: ["sid"],
                            description: "🔄 Target location information. Field requirements by operation type: replace_section_and_title(sid only), replace_section_content_only(sid+lineRange), insert_section_and_title(sid+insertionPosition), insert_section_content_only(sid+lineRange), delete_section_and_title(sid only), delete_section_content_only(sid only)"
                        },
                        content: {
                            type: "string",
                            description: "Content to insert or replace. 🚨 CRITICAL CONTENT RULES: (1) For *_and_title operations (replace_section_and_title, insert_section_and_title), you MUST include the complete section title (e.g., '#### Title\\n- content'). (2) For *_content_only operations (replace_section_content_only, insert_section_content_only), you must NOT include the section title - only provide actual content lines (e.g., '- content'). (3) For delete_* operations (delete_section_and_title, delete_section_content_only), this field is IGNORED - you can provide an empty string. The operation name tells you: *_and_title = include title; *_content_only = exclude title."
                        },
                        summary: {
                            type: "string",
                            description: "Summary for executing this edit"
                        },
                        priority: {
                            type: "number",
                            description: "Priority (can affect execution order)"
                        },
                        validateOnly: {
                            type: "boolean",
                            description: "Only validate, do not execute"
                        }
                    },
                    required: ["type", "target", "content", "summary"]
                }
            },
            targetFile: {
                type: "string",
                description: "Target Markdown file path relative to project baseDir (or workspace root if no project is active). Do not include project name in path. Example: 'SRS.md' not 'projectName/SRS.md'"
            }
        },
        required: ["intents", "targetFile"]
    },
    accessibleBy: [
            CallerType.SPECIALIST_CONTENT,
            CallerType.SPECIALIST_PROCESS,
            CallerType.DOCUMENT
    ]
};

// 🚀 路径解析现在使用公共工具 resolveWorkspacePath

/**
 * 🆕 自包含语义编辑工具实现
 */
export const semanticEditEngineToolImplementations = {
    async executeMarkdownEdits(params: {
        intents: SemanticEditIntent[]; 
        targetFile: string;
    }): Promise<SemanticEditResult> {
        logger.info(`🚀 executeMarkdownEdits called with ${params.intents.length} intents for ${params.targetFile}`);
        
        try {
            // 🔧 修复：正确解析文件路径（使用公共路径解析工具）
            const resolvedPath = await resolveWorkspacePath(params.targetFile, {
                contextName: 'Markdown文件'
            });
            const targetUri = vscode.Uri.file(resolvedPath);
            
            logger.debug(`📁 文件路径解析完成: ${params.targetFile} -> ${resolvedPath}`);
            
            return await executeSemanticEdits(params.intents, targetUri);
        } catch (error) {
            logger.error(`executeMarkdownEdits failed: ${(error as Error).message}`, error as Error);
            // 🔧 关键修复：返回失败的SemanticEditResult而不是抛出异常
            // 这样ToolExecutor的智能成功检测就能正确识别失败原因
            const errorMessage = (error as Error).message;
            return {
                success: false,
                totalIntents: params.intents.length,
                successfulIntents: 0,
                appliedIntents: [],
                failedIntents: params.intents.map(intent => ({
                    originalIntent: intent,
                    error: errorMessage,  // 🎯 确保错误信息在failedIntents中
                    suggestion: '请检查文件路径和SID是否正确',
                    canRetry: true
                })),
                warnings: [],
                metadata: {
                    executionTime: 0,
                    timestamp: new Date().toISOString(),
                    documentLength: 0
                }
            };
        }
    }
};

/**
 * 工具定义和实现的导出
 */
export const selfContainedSemanticEditEngineToolDefinitions = [executeMarkdownEditsToolDefinition];

/**
 * 🚨 废弃的验证函数 - 仅为向后兼容性保留
 * @deprecated 新的基于sid的系统不需要此验证，但保留以避免测试失败
 */
export function validateSemanticIntents(intents: SemanticEditIntent[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const intent of intents) {
        // 简化验证：只检查必需的sid字段
        if (!intent.target || !intent.target.sid) {
            errors.push('Intent missing target.sid field (required for new sid-based system)');
        }
        
        if (!intent.type) {
            errors.push('Intent missing type field');
        }
        
        if (typeof intent.content !== 'string') {
            errors.push('Intent content must be a string');
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

// ============================================================================
// 🎉 自包含架构完成！真正复用 readMarkdownFile 的组件，避免代码重复
// ============================================================================

/**
 * 最终工具定义数组
 */
export const semanticEditEngineToolDefinitions = selfContainedSemanticEditEngineToolDefinitions;

/**
 * Markdown Semantic Edit Engine 工具分类信息
 */
export const semanticEditEngineToolsCategory = {
    name: 'Markdown Semantic Edit Engine',
    description: '🆕 Sid-based semantic editing tools for Markdown documents using precise section ID targeting',
    tools: semanticEditEngineToolDefinitions.map(tool => tool.name),
    layer: 'document'
};