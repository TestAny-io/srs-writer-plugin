/**
 * 任务完成状态类型定义
 * 
 * 用于支持层级化任务完成信号和多专家协作
 */

/**
 * 任务完成类型枚举
 */
export enum TaskCompletionType {
  /** 部分完成，需要后续工作 */
  PARTIAL = "PARTIAL",
  /** 需要用户确认后继续 */
  REQUIRES_REVIEW = "REQUIRES_REVIEW", 
  /** 准备好进入下一阶段 */
  READY_FOR_NEXT = "READY_FOR_NEXT",
  /** 完全完成，可以结束 */
  FULLY_COMPLETED = "FULLY_COMPLETED"
}

/**
 * 下一步行动类型枚举
 */
export enum NextStepType {
  /** 同一专家继续 */
  CONTINUE_SAME_SPECIALIST = "CONTINUE_SAME_SPECIALIST",
  /** 转交给其他专家 */
  HANDOFF_TO_SPECIALIST = "HANDOFF_TO_SPECIALIST", 
  /** 需要用户交互 */
  USER_INTERACTION = "USER_INTERACTION",
  /** 任务完成 */
  TASK_FINISHED = "TASK_FINISHED"
}

/**
 * 任务上下文接口
 */
export interface TaskContext {
  /** 项目状态信息 */
  projectState?: {
    [key: string]: any;
  };
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
 * 下一步详情接口
 */
export interface NextStepDetails {
  /** 专家类型 (如 "300_prototype") */
  specialistType?: string;
  /** 任务描述 */
  taskDescription?: string;
  /** 用户交互问题 */
  userQuestion?: string;
  /** 继续任务的说明 */
  continueInstructions?: string;
}

/**
 * 任务完成结果接口
 */
export interface TaskCompletionResult {
  /** 完成类型 */
  completionType: TaskCompletionType;
  /** 下一步行动类型 */
  nextStepType: NextStepType;
  /** 任务完成总结 */
  summary: string;
  /** 下一步详情 */
  nextStepDetails?: NextStepDetails;
  /** 传递给下一步的上下文 */
  contextForNext?: TaskContext;
} 