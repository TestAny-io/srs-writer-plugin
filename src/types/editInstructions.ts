/**
 * 编辑指令类型定义 - Phase 1
 * 
 * 用于Content Specialist返回精确编辑指令，由PlanExecutor执行文件编辑操作
 */

/**
 * 单个编辑指令接口
 */
export interface EditInstruction {
    /** 编辑操作类型 */
    action: 'insert' | 'replace';
    
    /** 目标行号（从1开始计数）
     * - insert: [10] 表示在第10行之前插入内容，新内容成为第10行
     * - replace: [10] 表示替换第10行
     * - replace: [10, 15] 表示替换第10-15行（包含第10行和第15行）
     */
    lines: number[];
    
    /** 要插入或替换的内容 */
    content: string;
    
    /** 编辑原因说明（可选） */
    reason?: string;
}

/**
 * 编辑指令集合接口
 */
export interface EditInstructionSet {
    /** 编辑指令列表 */
    edit_instructions: EditInstruction[];
    
    /** 目标文件路径 */
    target_file: string;
    
    /** 元数据信息 */
    metadata: {
        specialist: string;
        confidence: number;
        requires_review: boolean;
    };
}

/**
 * 编辑执行结果接口
 */
export interface EditExecutionResult {
    /** 执行是否成功 */
    success: boolean;
    
    /** 成功应用的指令列表 */
    appliedInstructions: EditInstruction[];
    
    /** 失败的指令列表 */
    failedInstructions: EditInstruction[];
    
    /** 错误信息（失败时） */
    error?: string;
    
    /** 最终文件内容（成功时） */
    finalFileContent?: string;
    
    /** 执行元数据 */
    metadata?: {
        executionTime: number;
        timestamp: string;
        originalFileContent?: string;
    };
} 