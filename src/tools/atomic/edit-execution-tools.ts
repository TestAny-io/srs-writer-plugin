/**
 * 编辑执行工具 - Phase 1
 * 
 * 实现EditInstruction的执行逻辑，支持文件的insert和replace操作
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EditInstruction, EditExecutionResult } from '../../types/editInstructions';

/**
 * 验证编辑指令的有效性
 */
function validateInstructions(instructions: EditInstruction[], fileLines: string[]): { valid: boolean; error?: string } {
    for (const instruction of instructions) {
        // 检查行号范围
        if (instruction.lines.length === 0) {
            return { valid: false, error: `指令缺少行号: ${JSON.stringify(instruction)}` };
        }

        // 检查行号是否为正整数
        for (const lineNumber of instruction.lines) {
            if (!Number.isInteger(lineNumber) || lineNumber < 1) {
                return { valid: false, error: `无效行号 ${lineNumber}，行号必须从1开始` };
            }
        }

        // 对于replace操作，检查行号范围是否存在
        if (instruction.action === 'replace') {
            const minLine = Math.min(...instruction.lines);
            const maxLine = Math.max(...instruction.lines);
            
            if (maxLine > fileLines.length) {
                return { valid: false, error: `行号 ${maxLine} 超出文件范围，文件共 ${fileLines.length} 行` };
            }
        }

        // 对于insert操作，检查插入位置是否合理
        if (instruction.action === 'insert') {
            const insertLine = instruction.lines[0];
            if (insertLine > fileLines.length + 1) {
                return { valid: false, error: `插入位置 ${insertLine} 超出合理范围，文件共 ${fileLines.length} 行` };
            }
        }

        // 检查内容是否存在
        if (typeof instruction.content !== 'string') {
            return { valid: false, error: `指令内容必须是字符串: ${JSON.stringify(instruction)}` };
        }
    }

    return { valid: true };
}

/**
 * 应用单个编辑指令
 */
function applyInstruction(lines: string[], instruction: EditInstruction): string[] {
    const result = [...lines];

    if (instruction.action === 'insert') {
        // 插入操作：在指定行之前插入内容
        const insertLine = instruction.lines[0];
        const insertIndex = insertLine - 1; // 转换为0-based索引
        const contentLines = instruction.content.split('\n');
        
        // 在指定位置插入新行
        result.splice(insertIndex, 0, ...contentLines);
        
    } else if (instruction.action === 'replace') {
        // 替换操作：替换指定行范围
        const minLine = Math.min(...instruction.lines);
        const maxLine = Math.max(...instruction.lines);
        const startIndex = minLine - 1; // 转换为0-based索引
        const deleteCount = maxLine - minLine + 1;
        const contentLines = instruction.content.split('\n');
        
        // 替换指定范围的行
        result.splice(startIndex, deleteCount, ...contentLines);
    }

    return result;
}

/**
 * 执行编辑指令列表
 */
export async function executeEditInstructions(
    instructions: EditInstruction[],
    targetFile: string
): Promise<EditExecutionResult> {
    const startTime = Date.now();
    
    try {
        // 1. 读取当前文件内容
        let currentContent: string;
        try {
            currentContent = fs.readFileSync(targetFile, 'utf-8');
        } catch (error) {
            return {
                success: false,
                appliedInstructions: [],
                failedInstructions: instructions,
                error: `无法读取文件 ${targetFile}: ${(error as Error).message}`,
                metadata: {
                    executionTime: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                }
            };
        }

        const originalLines = currentContent.split('\n');
        
        // 2. 验证所有指令的有效性
        const validationResult = validateInstructions(instructions, originalLines);
        if (!validationResult.valid) {
            return {
                success: false,
                appliedInstructions: [],
                failedInstructions: instructions,
                error: validationResult.error,
                metadata: {
                    executionTime: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                    originalFileContent: currentContent
                }
            };
        }

        // 3. 按顺序执行编辑指令
        let modifiedLines = [...originalLines];
        const applied: EditInstruction[] = [];

        for (const instruction of instructions) {
            try {
                modifiedLines = applyInstruction(modifiedLines, instruction);
                applied.push(instruction);
            } catch (error) {
                return {
                    success: false,
                    appliedInstructions: applied,
                    failedInstructions: [instruction],
                    error: `执行指令失败: ${(error as Error).message}`,
                    metadata: {
                        executionTime: Date.now() - startTime,
                        timestamp: new Date().toISOString(),
                        originalFileContent: currentContent
                    }
                };
            }
        }

        // 4. 写入文件
        const finalContent = modifiedLines.join('\n');
        try {
            fs.writeFileSync(targetFile, finalContent, 'utf-8');
        } catch (error) {
            return {
                success: false,
                appliedInstructions: applied,
                failedInstructions: [],
                error: `写入文件失败: ${(error as Error).message}`,
                metadata: {
                    executionTime: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                    originalFileContent: currentContent
                }
            };
        }

        // 5. 触发VS Code保存文档（如果文档在编辑器中打开）
        try {
            const uri = vscode.Uri.file(targetFile);
            const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
            if (document && document.isDirty) {
                await document.save();
            }
        } catch (error) {
            // 保存失败不影响整体结果，只记录警告
            console.warn(`VS Code文档保存失败: ${(error as Error).message}`);
        }

        return {
            success: true,
            appliedInstructions: applied,
            failedInstructions: [],
            finalFileContent: finalContent,
            metadata: {
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString(),
                originalFileContent: currentContent
            }
        };

    } catch (error) {
        return {
            success: false,
            appliedInstructions: [],
            failedInstructions: instructions,
            error: `执行编辑指令时发生未知错误: ${(error as Error).message}`,
            metadata: {
                executionTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            }
        };
    }
} 