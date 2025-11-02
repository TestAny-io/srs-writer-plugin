/**
 * Internet Search Tool Definition
 *
 * Tool definition for registration with the internal tool system.
 */

import { CallerType } from '../../../types/index';

export const internetSearchToolDefinition = {
  name: "internetSearch",
  description: "使用多种策略进行互联网搜索 (MCP服务器/直接API/设置指导)。支持优雅降级,即使未配置也会返回有用的设置指导。",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索查询内容"
      },
      maxResults: {
        type: "number",
        description: "最大结果数量 (默认: 5)"
      },
      searchType: {
        type: "string",
        enum: ["general", "technical", "documentation"],
        description: "搜索类型: general(通用)/technical(技术)/documentation(文档)"
      }
    },
    required: ["query"]
  },
  interactionType: 'autonomous',
  riskLevel: 'low',
  requiresConfirmation: false,
  accessibleBy: [
    CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // 知识问答模式
    CallerType.ORCHESTRATOR_TOOL_EXECUTION   // 工具执行模式
  ]
};
