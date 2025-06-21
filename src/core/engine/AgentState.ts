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
}

/**
 * 执行步骤接口 - 完整的执行日志 🚀 Code Review优化版本
 */
export interface ExecutionStep {
  type: 'thought' | 'tool_call' | 'user_interaction' | 'result' | 'tool_call_skipped' | 'forced_response';
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
  type: 'confirmation' | 'choice' | 'input';
  message: string;
  options?: string[];
  timeout?: number;
  toolCall?: { name: string; args: any };
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