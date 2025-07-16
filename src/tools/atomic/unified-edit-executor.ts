/**
 * 统一编辑执行器 - Phase 4
 * 
 * 智能检测并执行语义编辑和传统行号编辑两种格式，
 * 提供统一的接口供PlanExecutor使用
 */

import * as vscode from 'vscode';
import { Logger } from '../../utils/logger';
import { executeEditInstructions } from './edit-execution-tools';
import { executeSemanticEdits, SemanticEditIntent } from '../document/semantic-edit-engine';
import { EditInstruction } from '../../types/editInstructions';

const logger = Logger.getInstance();

/**
 * 统一编辑结果接口
 */
export interface UnifiedEditResult {
    success: boolean;
    appliedCount: number;
    failedCount: number;
    editType: 'semantic' | 'traditional' | 'mixed' | 'unknown';
    error?: string;
    semanticErrors?: string[];
    metadata?: {
        executionTime: number;
        timestamp: string;
        totalInstructions: number;
        semanticInstructions: number;
        traditionalInstructions: number;
        unknownInstructions: number;
    };
}

/**
 * 编辑指令分类结果
 */
interface ClassificationResult {
    semanticInstructions: SemanticEditIntent[];
    traditionalInstructions: EditInstruction[];
    unknownInstructions: any[];
}

/**
 * 统一编辑执行器
 * 
 * 智能检测编辑指令格式并选择合适的执行器
 */
export async function executeUnifiedEdits(
    instructions: any[],
    targetFile: string
): Promise<UnifiedEditResult> {
    const startTime = Date.now();
    
    try {
        logger.info(`🚀 [UnifiedEdit] Starting unified edit execution with ${instructions.length} instructions`);
        
        // 1. 分类编辑指令
        const classification = classifyEditInstructions(instructions);
        
        const totalInstructions = instructions.length;
        const semanticCount = classification.semanticInstructions.length;
        const traditionalCount = classification.traditionalInstructions.length;
        const unknownCount = classification.unknownInstructions.length;
        
        logger.info(`📊 [UnifiedEdit] Instruction classification: ${semanticCount} semantic, ${traditionalCount} traditional, ${unknownCount} unknown`);
        
        // 2. 根据分类情况选择执行策略
        let editType: 'semantic' | 'traditional' | 'mixed' | 'unknown';
        let totalApplied = 0;
        let totalFailed = 0;
        let errors: string[] = [];
        let semanticErrors: string[] = [];
        
        if (semanticCount > 0 && traditionalCount === 0 && unknownCount === 0) {
            // 纯语义编辑
            editType = 'semantic';
            const result = await executeSemanticEditStrategy(classification.semanticInstructions, targetFile);
            totalApplied = result.appliedCount;
            totalFailed = result.failedCount;
            if (result.error) errors.push(result.error);
            if (result.semanticErrors) semanticErrors.push(...result.semanticErrors);
            
        } else if (traditionalCount > 0 && semanticCount === 0 && unknownCount === 0) {
            // 纯传统编辑
            editType = 'traditional';
            const result = await executeTraditionalEditStrategy(classification.traditionalInstructions, targetFile);
            totalApplied = result.appliedCount;
            totalFailed = result.failedCount;
            if (result.error) errors.push(result.error);
            
        } else if (semanticCount > 0 && traditionalCount > 0) {
            // 混合编辑（先执行语义编辑，再执行传统编辑）
            editType = 'mixed';
            const mixedResult = await executeMixedEditStrategy(classification, targetFile);
            totalApplied = mixedResult.appliedCount;
            totalFailed = mixedResult.failedCount;
            if (mixedResult.error) errors.push(mixedResult.error);
            if (mixedResult.semanticErrors) semanticErrors.push(...mixedResult.semanticErrors);
            
        } else {
            // 未知格式或全部无效
            editType = 'unknown';
            totalFailed = totalInstructions;
            errors.push(`无法识别的编辑指令格式，语义:${semanticCount}, 传统:${traditionalCount}, 未知:${unknownCount}`);
        }
        
        const executionTime = Date.now() - startTime;
        const overallSuccess = totalApplied > 0 && totalFailed === 0;
        
        logger.info(`✅ [UnifiedEdit] Execution complete: ${totalApplied} applied, ${totalFailed} failed, type: ${editType}, time: ${executionTime}ms`);
        
        return {
            success: overallSuccess,
            appliedCount: totalApplied,
            failedCount: totalFailed,
            editType,
            error: errors.length > 0 ? errors.join('; ') : undefined,
            semanticErrors: semanticErrors.length > 0 ? semanticErrors : undefined,
            metadata: {
                executionTime,
                timestamp: new Date().toISOString(),
                totalInstructions,
                semanticInstructions: semanticCount,
                traditionalInstructions: traditionalCount,
                unknownInstructions: unknownCount
            }
        };
        
    } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error(`❌ [UnifiedEdit] Execution failed: ${(error as Error).message}`);
        
        return {
            success: false,
            appliedCount: 0,
            failedCount: instructions.length,
            editType: 'unknown',
            error: `统一编辑执行失败: ${(error as Error).message}`,
            metadata: {
                executionTime,
                timestamp: new Date().toISOString(),
                totalInstructions: instructions.length,
                semanticInstructions: 0,
                traditionalInstructions: 0,
                unknownInstructions: instructions.length
            }
        };
    }
}

/**
 * 分类编辑指令
 */
function classifyEditInstructions(instructions: any[]): ClassificationResult {
    const semanticInstructions: SemanticEditIntent[] = [];
    const traditionalInstructions: EditInstruction[] = [];
    const unknownInstructions: any[] = [];
    
    for (const instruction of instructions) {
        if (isSemanticEditInstruction(instruction)) {
            semanticInstructions.push(instruction as SemanticEditIntent);
        } else if (isTraditionalEditInstruction(instruction)) {
            traditionalInstructions.push(instruction as EditInstruction);
        } else {
            unknownInstructions.push(instruction);
        }
    }
    
    return {
        semanticInstructions,
        traditionalInstructions,
        unknownInstructions
    };
}

/**
 * 检测语义编辑指令
 */
function isSemanticEditInstruction(instruction: any): boolean {
    if (!instruction || typeof instruction !== 'object') {
        return false;
    }
    
    const semanticTypes = [
        'replace_entire_section',
        'replace_lines_in_section'
    ];
    
    // 基本字段验证
    const hasValidType = semanticTypes.includes(instruction.type);
    const hasValidTarget = instruction.target && 
                          typeof instruction.target.sectionName === 'string' &&
                          typeof instruction.target.startFromAnchor === 'string';
    const hasValidContent = typeof instruction.content === 'string';
    
    // 条件验证：replace_lines_in_section 需要 targetContent
    if (instruction.type === 'replace_lines_in_section') {
        return hasValidType && hasValidTarget && hasValidContent && 
               instruction.target.targetContent && 
               typeof instruction.target.targetContent === 'string';
    }
    
    return hasValidType && hasValidTarget && hasValidContent;
}

/**
 * 检测传统编辑指令
 */
function isTraditionalEditInstruction(instruction: any): boolean {
    if (!instruction || typeof instruction !== 'object') {
        return false;
    }
    
    return (instruction.action === 'insert' || instruction.action === 'replace') &&
           Array.isArray(instruction.lines) &&
           instruction.lines.length > 0 &&
           typeof instruction.content === 'string';
}

/**
 * 执行纯语义编辑策略
 */
async function executeSemanticEditStrategy(
    instructions: SemanticEditIntent[],
    targetFile: string
): Promise<{ appliedCount: number; failedCount: number; error?: string; semanticErrors?: string[] }> {
    try {
        logger.info(`🎯 [SemanticStrategy] Executing ${instructions.length} semantic edits`);
        
        const targetUri = vscode.Uri.file(targetFile);
        const result = await executeSemanticEdits(instructions, targetUri);
        
        return {
            appliedCount: result.appliedIntents?.length || 0,
            failedCount: result.failedIntents?.length || 0,
            error: result.error,
            semanticErrors: result.semanticErrors
        };
        
    } catch (error) {
        logger.error(`❌ [SemanticStrategy] Failed: ${(error as Error).message}`);
        return {
            appliedCount: 0,
            failedCount: instructions.length,
            error: `语义编辑策略失败: ${(error as Error).message}`
        };
    }
}

/**
 * 执行传统编辑策略  
 */
async function executeTraditionalEditStrategy(
    instructions: EditInstruction[],
    targetFile: string
): Promise<{ appliedCount: number; failedCount: number; error?: string }> {
    try {
        logger.info(`📝 [TraditionalStrategy] Executing ${instructions.length} traditional edits`);
        
        const result = await executeEditInstructions(instructions, targetFile);
        
        return {
            appliedCount: result.appliedInstructions?.length || 0,
            failedCount: result.failedInstructions?.length || 0,
            error: result.error
        };
        
    } catch (error) {
        logger.error(`❌ [TraditionalStrategy] Failed: ${(error as Error).message}`);
        return {
            appliedCount: 0,
            failedCount: instructions.length,
            error: `传统编辑策略失败: ${(error as Error).message}`
        };
    }
}

/**
 * 执行混合编辑策略
 */
async function executeMixedEditStrategy(
    classification: ClassificationResult,
    targetFile: string
): Promise<{ appliedCount: number; failedCount: number; error?: string; semanticErrors?: string[] }> {
    try {
        logger.info(`🔀 [MixedStrategy] Executing mixed edit strategy`);
        
        let totalApplied = 0;
        let totalFailed = 0;
        const errors: string[] = [];
        const semanticErrors: string[] = [];
        
        // 优先执行语义编辑（更安全）
        if (classification.semanticInstructions.length > 0) {
            const semanticResult = await executeSemanticEditStrategy(
                classification.semanticInstructions,
                targetFile
            );
            totalApplied += semanticResult.appliedCount;
            totalFailed += semanticResult.failedCount;
            if (semanticResult.error) errors.push(semanticResult.error);
            if (semanticResult.semanticErrors) semanticErrors.push(...semanticResult.semanticErrors);
        }
        
        // 再执行传统编辑
        if (classification.traditionalInstructions.length > 0) {
            const traditionalResult = await executeTraditionalEditStrategy(
                classification.traditionalInstructions,
                targetFile
            );
            totalApplied += traditionalResult.appliedCount;
            totalFailed += traditionalResult.failedCount;
            if (traditionalResult.error) errors.push(traditionalResult.error);
        }
        
        return {
            appliedCount: totalApplied,
            failedCount: totalFailed,
            error: errors.length > 0 ? errors.join('; ') : undefined,
            semanticErrors: semanticErrors.length > 0 ? semanticErrors : undefined
        };
        
    } catch (error) {
        logger.error(`❌ [MixedStrategy] Failed: ${(error as Error).message}`);
        return {
            appliedCount: 0,
            failedCount: classification.semanticInstructions.length + classification.traditionalInstructions.length,
            error: `混合编辑策略失败: ${(error as Error).message}`
        };
    }
} 