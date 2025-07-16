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
  /** 结构化数据 */
  structuredData?: any;
  /** 工作成果列表 */
  deliverables?: string[];
  /** 关键决策记录 */
  decisions?: Array<{
    decision: string;
    reason: string;
    timestamp: string;
  }>;
  /** 用户偏好设置 */
  userPreferences?: {
    [key: string]: any;
  };
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