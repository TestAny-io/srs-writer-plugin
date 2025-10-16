/**
 * SmartIntentExecutor - 智能Intent执行器
 * 
 * 🆕 专为多intents处理策略设计的执行器
 * 核心功能：
 * - 智能排序：减少操作冲突，保持AI意图
 * - 渐进式执行：逐个执行 + 动态调整
 * - 最大努力执行：部分成功比全部失败好
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { 
    SemanticEditIntent, 
    SemanticEditResult, 
    AppliedIntent, 
    FailedIntent, 
    IntentWarning,
    SidBasedEditError
} from '../../types/semanticEditing';
import { SidBasedSemanticLocator, TableOfContents } from './sid-based-semantic-locator';

const logger = Logger.getInstance();

/**
 * 执行结果（内部使用）
 */
interface ExecutionResult {
    success: boolean;
    intent: SemanticEditIntent;
    originalIntent?: SemanticEditIntent;
    error?: string;
    suggestion?: string;
    canRetry?: boolean;
    adjustmentReason?: string;
}

/**
 * SmartIntentExecutor - 智能Intent执行器
 */
export class SmartIntentExecutor {
    private locator: SidBasedSemanticLocator;
    private workspaceEdit: vscode.WorkspaceEdit;
    private targetFileUri: vscode.Uri;
    private executionOrder: number = 0;

    constructor(
        markdownContent: string, 
        tocData: TableOfContents[], 
        targetFileUri: vscode.Uri
    ) {
        this.locator = new SidBasedSemanticLocator(markdownContent, tocData);
        this.workspaceEdit = new vscode.WorkspaceEdit();
        this.targetFileUri = targetFileUri;
        
        // 🆕 Phase 2: 详细的构造日志
        logger.debug(`🎯 SmartIntentExecutor created for ${targetFileUri.fsPath}`);
        logger.debug(`📊 Context: ${markdownContent.split('\n').length} lines, ${tocData.length} sections`);
    }

    /**
     * 执行多个intents - 主入口方法
     */
    async execute(intents: SemanticEditIntent[]): Promise<SemanticEditResult> {
        const startTime = Date.now();
        
        logger.info(`🚀 SmartIntentExecutor starting with ${intents.length} intents`);
        logger.debug(`📝 Intent types: ${intents.map(i => i.type).join(', ')}`);
        logger.debug(`🎯 Target SIDs: ${intents.map(i => i.target.sid).join(', ')}`);
        
        try {
            // 1. 智能排序，减少冲突
            logger.debug(`📊 Optimizing execution order for ${intents.length} intents`);
            const optimizedIntents = this.optimizeExecutionOrder(intents);
            
            // 2. 逐个执行，动态调整
            logger.debug(`⚡ Starting sequential execution with dynamic adjustment`);
            const results = await this.executeWithAdjustment(optimizedIntents);
            
            // 3. 只有当有成功的编辑时才应用workspace edits
            logger.debug(`💾 Applying ${this.workspaceEdit.size} workspace changes`);
            if (this.workspaceEdit.size > 0) {
                const applySuccess = await vscode.workspace.applyEdit(this.workspaceEdit);
                if (!applySuccess) {
                    // 🚨 只有在有编辑但applyEdit失败时才抛出此异常
                    throw new Error('Failed to apply workspace edits');
                }
            } else {
                logger.debug(`💾 No workspace changes to apply (all intents failed or no content changes)`);
            }
            
            // 🔧 关键修复：自动保存文档（确保下次读取能看到最新内容）
            try {
                const targetUriString = this.targetFileUri.toString();
                const targetFsPath = this.targetFileUri.fsPath;
                
                logger.debug(`🎯 Looking for document with URI: ${targetUriString}`);
                logger.debug(`🎯 Looking for document with fsPath: ${targetFsPath}`);
                
                // 🔍 调试：列出所有打开的文档
                logger.debug(`📋 Open documents (${vscode.workspace.textDocuments.length}):`);
                vscode.workspace.textDocuments.forEach((doc, index) => {
                    logger.debug(`  ${index}: URI=${doc.uri.toString()}`);
                    logger.debug(`  ${index}: fsPath=${doc.uri.fsPath}`);
                    logger.debug(`  ${index}: isDirty=${doc.isDirty}`);
                });
                
                const document = vscode.workspace.textDocuments.find(doc => 
                    doc.uri.toString() === targetUriString
                );
                
                if (document && document.isDirty) {
                    await document.save();
                    logger.debug(`📄 Document saved: ${this.targetFileUri.fsPath}`);
                } else if (document) {
                    logger.debug(`📄 Document already saved: ${this.targetFileUri.fsPath}`);
                } else {
                    // 🚀 尝试更宽松的匹配：使用 fsPath
                    const fsPathMatch = vscode.workspace.textDocuments.find(doc => 
                        doc.uri.fsPath === targetFsPath
                    );
                    if (fsPathMatch) {
                        logger.debug(`📄 Found document by fsPath match!`);
                        logger.debug(`📄 fsPath URI: ${fsPathMatch.uri.toString()}`);
                        logger.debug(`📄 target URI: ${targetUriString}`);
                        if (fsPathMatch.isDirty) {
                            await fsPathMatch.save();
                            logger.debug(`📄 Document saved via fsPath: ${this.targetFileUri.fsPath}`);
                        } else {
                            logger.debug(`📄 Document already saved via fsPath: ${this.targetFileUri.fsPath}`);
                        }
                    } else {
                        logger.warn(`❌ Document not found in textDocuments: ${targetUriString}`);
                        logger.warn(`❌ Also not found by fsPath: ${targetFsPath}`);
                    }
                }
            } catch (error) {
                // 保存失败不影响整体结果，只记录警告（与旧实现保持一致）
                logger.warn(`⚠️ Document save failed: ${(error as Error).message}`);
            }
            
            // 4. 构建结果
            const result = this.buildResult(intents, results, startTime);
            
            const executionTime = Date.now() - startTime;
            logger.info(`🏁 SmartIntentExecutor completed: ${result.successfulIntents}/${intents.length} successful (${executionTime}ms)`);
            
            // 🆕 Phase 2: 详细的完成统计
            if (result.failedIntents.length > 0) {
                logger.warn(`⚠️ Failed intents: ${result.failedIntents.map(f => `${f.originalIntent.type}(${f.originalIntent.target.sid}): ${f.error}`).join('; ')}`);
            }
            if (result.warnings && result.warnings.length > 0) {
                logger.warn(`🔔 Warnings: ${result.warnings.map(w => w.message).join('; ')}`);
            }
            
            return result;
            
        } catch (error) {
            logger.error(`❌ SmartIntentExecutor failed: ${(error as Error).message}`);
            return this.buildErrorResult(intents, error as Error, startTime);
        }
    }

    /**
     * 智能排序：减少操作冲突，保持AI意图
     */
    private optimizeExecutionOrder(intents: SemanticEditIntent[]): SemanticEditIntent[] {
        logger.info(`📊 Optimizing execution order for ${intents.length} intents`);
        
        return intents.sort((a, b) => {
            // 1. 不同sid：按文档中的sid出现顺序（这里简化为字典序）
            if (a.target.sid !== b.target.sid) {
                return a.target.sid.localeCompare(b.target.sid);
            }
            
            // 2. 同sid：统一从后往前执行（按原始数组索引倒序）
            //    这样既避免行号冲突，又保持AI的原始意图顺序
            const indexA = intents.indexOf(a);
            const indexB = intents.indexOf(b);
            const result = indexB - indexA; // 倒序：后面的intent先执行
            
            if (result !== 0) {
                logger.debug(`🔄 Intent reordering: ${indexB} before ${indexA} (same sid: ${a.target.sid})`);
            }
            
            return result;
        });
    }

    /**
     * 执行策略：逐个执行 + 动态调整
     */
    private async executeWithAdjustment(intents: SemanticEditIntent[]): Promise<ExecutionResult[]> {
        const results: ExecutionResult[] = [];
        const lineOffsets = new Map<string, number>(); // 跟踪每个sid的行号偏移
        
        for (const intent of intents) {
            this.executionOrder++;
            
            try {
                logger.info(`📝 Executing intent ${this.executionOrder}: ${intent.type} on sid=${intent.target.sid}`);
                
                // 动态调整行号（基于之前操作的影响）
                const adjustedIntent = this.adjustLineNumbers(intent, lineOffsets);
                
                // 应用intent到workspace edit
                const applied = await this.applyIntent(adjustedIntent);
                
                if (applied) {
                    // 更新偏移量，影响后续操作
                    this.updateLineOffsets(adjustedIntent, lineOffsets);
                    
                    results.push({ 
                        success: true, 
                        intent: adjustedIntent,
                        originalIntent: intent,
                        adjustmentReason: adjustedIntent !== intent ? 'Line offset adjustment' : undefined
                    });
                    
                    logger.info(`✅ Intent ${this.executionOrder} applied successfully`);
                } else {
                    results.push({
                        success: false,
                        intent,
                        error: 'Failed to apply intent',
                        canRetry: true
                    });
                }
                
            } catch (error) {
                // 单个操作失败，继续执行其他操作
                const errorMessage = (error as Error).message;
                logger.warn(`❌ Intent ${this.executionOrder} failed: ${errorMessage}`);
                
                results.push({ 
                    success: false, 
                    intent, 
                    error: errorMessage,
                    suggestion: this.generateSuggestion(intent, error as Error),
                    canRetry: this.canRetry(intent, error as Error)
                });
            }
        }
        
        return results;
    }

    /**
     * 动态调整行号（基于之前操作的影响）
     */
    private adjustLineNumbers(intent: SemanticEditIntent, lineOffsets: Map<string, number>): SemanticEditIntent {
        if (!intent.target.lineRange) {
            return intent; // 没有行号，无需调整
        }

        const offset = lineOffsets.get(intent.target.sid) || 0;
        if (offset === 0) {
            return intent; // 没有偏移，无需调整
        }

        logger.debug(`🔧 Adjusting line numbers for sid=${intent.target.sid}, offset=${offset}`);

        return {
            ...intent,
            target: {
                ...intent.target,
                lineRange: {
                    startLine: intent.target.lineRange.startLine + offset,
                    endLine: intent.target.lineRange.endLine + offset
                }
            }
        };
    }

    /**
     * 更新行号偏移量
     */
    private updateLineOffsets(intent: SemanticEditIntent, lineOffsets: Map<string, number>): void {
        const currentOffset = lineOffsets.get(intent.target.sid) || 0;
        
        if (intent.type === 'insert_section_content_only' || intent.type === 'insert_section_and_title') {
            // 插入操作增加行数
            const insertedLines = intent.content.split('\n').length;
            lineOffsets.set(intent.target.sid, currentOffset + insertedLines);
            
            logger.debug(`📈 Updated line offset for sid=${intent.target.sid}: +${insertedLines} (total: ${currentOffset + insertedLines})`);
        } else if (intent.type === 'replace_section_content_only') {
            // 替换操作可能改变行数
            const newLines = intent.content.split('\n').length;
            const oldLines = intent.target.lineRange ? 
                (intent.target.lineRange.endLine || intent.target.lineRange.startLine) - intent.target.lineRange.startLine + 1 : 1;
            const lineChange = newLines - oldLines;
            
            if (lineChange !== 0) {
                lineOffsets.set(intent.target.sid, currentOffset + lineChange);
                logger.debug(`📊 Updated line offset for sid=${intent.target.sid}: ${lineChange > 0 ? '+' : ''}${lineChange} (total: ${currentOffset + lineChange})`);
            }
        }
    }

    /**
     * 应用单个intent
     */
    private async applyIntent(intent: SemanticEditIntent): Promise<boolean> {
        // 验证模式：只验证，不实际执行
        if (intent.validateOnly) {
            const location = this.locator.findTarget(intent.target, intent.type);
            return location.found;
        }

        // 使用定位器找到目标位置
        const location = this.locator.findTarget(intent.target, intent.type);
        
        if (!location.found) {
            throw new Error(location.error || 'Target not found');
        }
        
        // 🔧 关键修复：处理内容换行符
        let contentToApply = intent.content;
        
        // 确保内容末尾有换行符（除非内容为空）
        // 这个逻辑对所有编辑类型都适用，确保不会丢失换行符
        if (contentToApply.length > 0 && !contentToApply.endsWith('\n')) {
            logger.debug(`🔄 Adding newline to content (${intent.type}): "${contentToApply.substring(0, 50)}..."`);
            contentToApply += '\n';
        }
        
        // 根据意图类型执行不同的编辑操作
        switch (intent.type) {
            case 'replace_section_and_title':
            case 'replace_section_content_only':
                if (!location.range) {
                    throw new Error('Replace operation requires range, but none found');
                }
                logger.debug(`📝 Replacing with ${contentToApply.split('\n').length - 1} lines (including newline)`);
                this.workspaceEdit.replace(this.targetFileUri, location.range, contentToApply);
                break;
                
            case 'insert_section_and_title':
            case 'insert_section_content_only':
                if (!location.insertionPoint) {
                    throw new Error('Insert operation requires insertion point, but none found');
                }
                logger.debug(`📝 Inserting ${contentToApply.split('\n').length - 1} lines (including newline)`);
                this.workspaceEdit.insert(this.targetFileUri, location.insertionPoint, contentToApply);
                break;
                
            default:
                throw new Error(`Unknown intent type: ${intent.type}`);
        }
        
        return true;
    }

    /**
     * 生成修复建议
     */
    private generateSuggestion(intent: SemanticEditIntent, error: Error): string {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('not found')) {
            return `Check available sids using readMarkdownFile with parseMode: 'toc'`;
        }
        
        if (errorMessage.includes('out of range')) {
            return `Use readMarkdownFile with keyword search to get valid line numbers`;
        }
        
        if (errorMessage.includes('missing')) {
            return `Ensure all required fields are provided for ${intent.type} operation`;
        }
        
        return 'Review the intent structure and target parameters';
    }

    /**
     * 判断是否可以重试
     */
    private canRetry(intent: SemanticEditIntent, error: Error): boolean {
        const errorMessage = error.message.toLowerCase();
        
        // 这些错误通常可以通过修正参数重试
        return errorMessage.includes('not found') || 
               errorMessage.includes('out of range') || 
               errorMessage.includes('missing');
    }

    /**
     * 构建成功结果
     */
    private buildResult(
        originalIntents: SemanticEditIntent[], 
        results: ExecutionResult[], 
        startTime: number
    ): SemanticEditResult {
        const appliedIntents: AppliedIntent[] = [];
        const failedIntents: FailedIntent[] = [];
        const warnings: IntentWarning[] = [];
        
        results.forEach((result, index) => {
            if (result.success) {
                appliedIntents.push({
                    originalIntent: result.originalIntent || result.intent,
                    adjustedIntent: result.originalIntent ? result.intent : undefined,
                    adjustmentReason: result.adjustmentReason,
                    executionOrder: index + 1
                });
                
                // 如果有调整，添加警告
                if (result.adjustmentReason) {
                    warnings.push({
                        intent: result.intent,
                        warningType: 'AUTO_ADJUSTED',
                        message: result.adjustmentReason,
                        details: { originalIntent: result.originalIntent }
                    });
                }
            } else {
                failedIntents.push({
                    originalIntent: result.intent,
                    error: result.error || 'Unknown error',
                    suggestion: result.suggestion,
                    canRetry: result.canRetry || false
                });
            }
        });
        
        const executionTime = Date.now() - startTime;
        
        logger.info(`🏁 SmartIntentExecutor completed: ${appliedIntents.length}/${originalIntents.length} successful (${executionTime}ms)`);
        
        return {
            success: appliedIntents.length > 0,
            totalIntents: originalIntents.length,
            successfulIntents: appliedIntents.length,
            appliedIntents,
            failedIntents,
            warnings: warnings.length > 0 ? warnings : undefined,
            metadata: {
                executionTime,
                timestamp: new Date().toISOString(),
                documentLength: 0 // 可以从markdownContent获取
            }
        };
    }

    /**
     * 构建错误结果
     */
    private buildErrorResult(
        intents: SemanticEditIntent[], 
        error: Error, 
        startTime: number
    ): SemanticEditResult {
        const executionTime = Date.now() - startTime;
        
        return {
            success: false,
            totalIntents: intents.length,
            successfulIntents: 0,
            appliedIntents: [],
            failedIntents: intents.map(intent => ({
                originalIntent: intent,
                error: error.message,
                suggestion: 'System error occurred during execution',
                canRetry: true
            })),
            metadata: {
                executionTime,
                timestamp: new Date().toISOString(),
                documentLength: 0
            }
        };
    }
}
