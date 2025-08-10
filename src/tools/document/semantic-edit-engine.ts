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
    description: "语义编辑工具 - 内部自动解析文档结构，基于SID精确定位和编辑Markdown文档，请先调用readMarkdownFile工具获取文档结构及相关定位参数",
    parameters: {
        type: "object",
        properties: {
            intents: {
                type: "array",
                description: "语义编辑意图数组",
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
                            description: "编辑操作类型"
                        },
                        target: {
                            type: "object",
                            properties: {
                                sid: {
                                    type: "string",
                                    description: "🎯 Section SID - Must be obtained by calling readMarkdownFile tool first."
                                },
                                lineRange: {
                                    type: "object",
                                    properties: {
                                        startLine: {
                                            type: "number",
                                            description: "Target start line number (absolute line number in document), use the actual line numbers visible in readMarkdownFile output"
                                        },
                                        endLine: {
                                            type: "number", 
                                            description: "Target end line number (absolute line number in document), use the actual line numbers visible in readMarkdownFile output. Required to avoid ambiguity."
                                        }
                                    },
                                    required: ["startLine", "endLine"],
                                    description: "🆕 Absolute line number targeting - use the exact line numbers from readMarkdownFile output. Both startLine and endLine are required to eliminate ambiguity. If you only want to replace a single line, set endLine to the same value as startLine."
                                },
                                insertionPosition: {
                                    type: "string",
                                    enum: ["before", "after", "inside"],
                                    description: "Insertion position: before(before the reference section), after(after the reference section), inside(inside the reference section)"
                                },
                                siblingIndex: {
                                    type: "number",
                                    description: "Sibling node index"
                                },
                                siblingOperation: {
                                    type: "string",
                                    enum: ["before", "after"],
                                    description: "Sibling node operation direction"
                                }
                            },
                            required: ["sid"],
                            description: "Target location information - precise targeting based on SID"
                        },
                        content: {
                            type: "string",
                            description: "Content to insert or replace"
                        },
                        reason: {
                            type: "string",
                            description: "Reason for executing this edit"
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
                    required: ["type", "target", "content", "reason"]
                }
            },
            targetFile: {
                type: "string",
                description: "Target Markdown file path"
            }
        },
        required: ["intents", "targetFile"]
    },
    allowedCallers: [
            CallerType.SPECIALIST_CONTENT,
            CallerType.SPECIALIST_PROCESS,
            CallerType.DOCUMENT
    ]
};

/**
 * 🚀 智能路径解析：优先使用SessionContext的baseDir，回退到VSCode工作区
 * 复用其他工具的成熟实现模式
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
 * 🆕 自包含语义编辑工具实现
 */
export const semanticEditEngineToolImplementations = {
    async executeMarkdownEdits(params: {
        intents: SemanticEditIntent[]; 
        targetFile: string;
    }): Promise<SemanticEditResult> {
        logger.info(`🚀 executeMarkdownEdits called with ${params.intents.length} intents for ${params.targetFile}`);
        
        try {
            // 🔧 修复：正确解析文件路径
            const resolvedPath = await resolveWorkspacePath(params.targetFile);
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