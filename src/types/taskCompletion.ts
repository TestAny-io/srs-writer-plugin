/**
 * 任务完成状态类型定义
 * 
 * 用于支持层级化任务完成信号和多专家协作
 */

/**
 * 下一步行动类型枚举
 */
export enum NextStepType {
  /** 同一专家继续 */
  CONTINUE_SAME_SPECIALIST = "CONTINUE_SAME_SPECIALIST",
  /** 转交给其他专家 */
  HANDOFF_TO_SPECIALIST = "HANDOFF_TO_SPECIALIST", 
  /** 任务完成 */
  TASK_FINISHED = "TASK_FINISHED"
}

/**
 * 任务上下文接口
 */
export interface TaskContext {
  /** 工作成果列表 */
  deliverables?: string[];
}

/**
 * 任务完成结果接口
 */
export interface TaskCompletionResult {
  /** 下一步行动类型 */
  nextStepType: NextStepType;
  /** 任务完成总结 */
  summary: string;
  /** 传递给下一步的上下文 */
  contextForNext?: TaskContext;
} 