/**
 * 🚀 新增：计划中断状态接口
 */
export interface PlanInterruptionState {
  planId: string;
  planDescription: string;
  originalPlan: any;
  failedStep: number;
  completedStepResults: { [key: number]: SpecialistOutput };
  sessionContext: any;  // 序列化的 SessionContext
  userInput: string;
  interruptionReason: string;
  interruptionTimestamp: string;
  canResume: boolean;
}

/**
 * Agent状态接口 - Agent的自我意识系统
 */
export interface AgentState {
  stage: 'planning' | 'executing' | 'awaiting_user' | 'completed' | 'error';
  currentTask: string;
  executionHistory: ExecutionStep[];
  pendingInteraction?: InteractionRequest;
  iterationCount: number;
  maxIterations: number;
  resumeContext?: SpecialistResumeContext;
  planInterruptionState?: PlanInterruptionState;  // 🚀 新增：计划中断状态
  cancelled?: boolean; // v6.0: 用于Plan取消机制
}

/**
 * 专家恢复上下文接口 - 用于恢复specialist执行状态
 * 🚀 v4.0升级：支持完整的PlanExecutor和specialist循环状态恢复
 */
export interface SpecialistResumeContext {
  // 🚀 原有字段（保持兼容性）
  ruleId: string;
  context: any;
  currentIteration: number;
  conversationHistory: string[];
  toolExecutionResults: string[];
  pendingPlan: any;
  userResponse?: string; // 用户的回复内容
  
  // 🚀 新增：PlanExecutor完整状态
  planExecutorState: {
    plan: {
      planId: string;
      description: string;
      steps: any[];
    };
    currentStep: any;                // 当前正在执行的步骤
    stepResults: { [key: number]: SpecialistOutput }; // 已完成步骤的结果
    sessionContext: any;             // 会话上下文（可能包含敏感信息的序列化版本）
    userInput: string;               // 原始用户输入
    
    // specialist循环状态
    specialistLoopState: {
      specialistId: string;
      currentIteration: number;
      maxIterations: number;
      executionHistory: SpecialistExecutionHistory[];
      isLooping: boolean;
      startTime: number;
      lastContinueReason?: string;
    };
  };
  
  // 🚀 新增：askQuestion工具调用的上下文
  askQuestionContext: {
    toolCall: {
      name: string;
      args: any;
    };
    question: string;
    originalResult: any;             // askQuestion工具返回的原始结果
    timestamp: number;
  };
  
  // 🚀 新增：恢复指导信息
  resumeGuidance: {
    nextAction: 'continue_specialist_execution' | 'retry_tool_call' | 'escalate_to_user';
    resumePoint: 'before_tool_call' | 'after_tool_call' | 'next_iteration';
    expectedUserResponseType: 'answer' | 'confirmation' | 'choice';
    contextualHints: string[];       // 给LLM的上下文提示
  };
}

/**
 * 🚀 新增：Specialist循环状态接口
 */
export interface SpecialistLoopState {
  specialistId: string;
  currentIteration: number;
  maxIterations: number;
  executionHistory: SpecialistExecutionHistory[];
  isLooping: boolean;
  startTime: number;
  lastContinueReason?: string;
}

/**
 * 🚀 新增：Specialist交互结果接口
 * 当specialist需要用户交互时返回的特殊结果
 */
export interface SpecialistInteractionResult {
  success: false;
  needsChatInteraction: true;
  resumeContext: any;
  question: string;
}

/**
 * 🚀 新增：Specialist输出接口（从PlanExecutor引入）
 */
export interface SpecialistOutput {
  success: boolean;
  content?: string;
  error?: string;
  requires_file_editing?: boolean;
  target_file?: string;
  edit_instructions?: any[];
  structuredData?: any;
  metadata?: {
    iterations?: number;
    loopIterations?: number;
    totalLoopTime?: number;
    iterationHistory?: Array<{
      iteration: number;
      summary: string;
      executionTime: number;
    }>;
    // 🚀 新增：支持用户交互的属性
    needsChatInteraction?: boolean;
    chatQuestion?: string;
    toolCalls?: Array<{
      name: string;
      args: any;
    }>;
    toolResults?: Array<{
      toolName: string;
      success: boolean;
      result: any;
      error?: string;
    }>;
    // 🚀 修复：添加缺失的属性
    specialist?: string;
    executionTime?: number;
    timestamp?: string;
    toolsUsed?: string[];
  };
}

/**
 * 🚀 新增：Specialist执行历史记录接口（从PlanExecutor引入）
 */
export interface SpecialistExecutionHistory {
  iteration: number;
  toolCalls: Array<{
    name: string;
    args: any;
  }>;
  toolResults: Array<{
    toolName: string;
    success: boolean;
    result: any;
    error?: string;
  }>;
  aiResponse: string;
  timestamp: string;
  summary: string;
  executionTime: number;
}

/**
 * 执行步骤接口 - 完整的执行日志 🚀 Code Review优化版本
 */
export interface ExecutionStep {
  type: 'thought' | 'tool_call' | 'user_interaction' | 'result' | 'tool_call_skipped' | 'forced_response' | 'system' | 'plan_execution';
  content: string;
  timestamp: number;
  toolName?: string;
  success?: boolean;
  iteration?: number;
  args?: any; // 🚀 工具调用参数
  result?: any; // 🚀 工具调用结果
  // 🚀 Code Review新增：增强监控字段
  duration?: number; // 执行耗时（毫秒）
  errorCode?: string; // 错误代码
  retryCount?: number; // 重试次数
}

/**
 * 交互请求接口 - 用户交互管理
 */
export interface InteractionRequest {
  type: 'confirmation' | 'choice' | 'input' | 'continue_conversation';  // 🚀 新增：continue_conversation 类型
  message: string | null;  // 🚀 修改：允许 null（continue_conversation 不需要消息提示）
  options?: string[];
  timeout?: number;
  toolCall?: { name: string; args: any };
  originalResult?: any; // 🚀 新增：保存原始工具结果，用于聊天交互
}

/**
 * 工具调用结果接口
 */
export interface ToolCallResult {
  success: boolean;
  output?: string;
  error?: string;
  toolName: string;
  args: any;
} 