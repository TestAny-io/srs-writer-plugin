# AI 响应格式标准 (SRS Writer Plugin)

## 概述

本文档定义了 SRS Writer Plugin 中所有 AI 组件（Orchestrator 和 Specialist）必须遵循的统一响应格式标准。

## 核心接口定义

### AIPlan 接口 (TypeScript)

```typescript
export interface AIPlan {
    thought: string;                           // 详细的思考过程和推理逻辑
    response_mode: AIResponseMode;             // 响应模式
    direct_response: string | null;            // 直接回复内容（仅特定模式使用）
    tool_calls: Array<{ name: string; args: any }>; // 工具调用列表
}

export enum AIResponseMode {
    TOOL_EXECUTION = 'TOOL_EXECUTION',        // 执行工具操作
    KNOWLEDGE_QA = 'KNOWLEDGE_QA',            // 知识问答
    GENERAL_CHAT = 'GENERAL_CHAT'             // 一般对话
}
```

## 标准响应格式

### 基础结构

所有 AI 组件必须返回以下格式的 JSON 对象，并用 markdown 代码块包装：

```json
{
  "thought": "<详细的思考过程>",
  "response_mode": "<TOOL_EXECUTION | KNOWLEDGE_QA | GENERAL_CHAT>",
  "direct_response": "<字符串内容或null>",
  "tool_calls": [
    {
      "name": "<工具名称>",
      "args": {
        "<参数名>": "<参数值>"
      }
    }
  ]
}
```

### 字段详细说明

#### `thought` (必填)
- **类型**: `string`
- **用途**: 记录 AI 的思考过程、分析逻辑和决策依据
- **要求**: 
  - 详细说明为什么选择某个模式
  - 解释专家路由逻辑（如适用）
  - 描述对用户请求的理解
  - 说明下一步计划

#### `response_mode` (必填)
- **类型**: `AIResponseMode`
- **可选值**:
  - `TOOL_EXECUTION`: 需要执行工具操作
  - `KNOWLEDGE_QA`: 提供知识问答
  - `GENERAL_CHAT`: 一般对话交流

#### `direct_response` (条件必填)
- **类型**: `string | null`
- **使用规则**:
  - `TOOL_EXECUTION` 模式: 必须为 `null`
  - `KNOWLEDGE_QA` 模式: 必须为完整的回答字符串
  - `GENERAL_CHAT` 模式: 必须为完整的对话字符串

#### `tool_calls` (条件必填)
- **类型**: `Array<{name: string, args: any}>`
- **使用规则**:
  - `TOOL_EXECUTION` 模式: 必须包含至少一个工具调用
  - `KNOWLEDGE_QA` 模式: 必须为空数组 `[]`
  - `GENERAL_CHAT` 模式: 必须为空数组 `[]`

## 响应模式详细指南

### TOOL_EXECUTION 模式

**何时使用**: 用户请求需要实际操作（创建、修改、删除、分析文件等）

**格式要求**:
```json
{
  "thought": "用户要求创建SRS文档，这是一个明确的创建任务...",
  "response_mode": "TOOL_EXECUTION", 
  "direct_response": null,
  "tool_calls": [
    {
      "name": "createComprehensiveSRS",
      "args": {
        "userInput": "创建电商平台SRS",
        "projectName": "E-commerce Platform"
      }
    }
  ]
}
```

### KNOWLEDGE_QA 模式

**何时使用**: 用户询问知识、方法、最佳实践等，但不需要执行具体操作

**格式要求**:
```json
{
  "thought": "用户询问如何编写非功能需求，这是知识咨询...",
  "response_mode": "KNOWLEDGE_QA",
  "direct_response": "非功能需求应该遵循SMART原则...",
  "tool_calls": []
}
```

### GENERAL_CHAT 模式

**何时使用**: 问候、感谢、闲聊等非SRS相关的一般交流

**格式要求**:
```json
{
  "thought": "用户在打招呼，这是一般性对话...",
  "response_mode": "GENERAL_CHAT",
  "direct_response": "您好！我是SRS Writer，很高兴为您服务...",
  "tool_calls": []
}
```

## 专家工具调用规范

### 可用的专家工具

1. **`createComprehensiveSRS`** - 创建完整的SRS文档
2. **`editSRSDocument`** - 编辑现有SRS文档
3. **`classifyProjectComplexity`** - 分析项目复杂度
4. **`lintSRSDocument`** - 执行SRS质量检查

### 工具调用参数规范

所有专家工具都接受以下标准参数：

```json
{
  "name": "<专家工具名称>",
  "args": {
    "userInput": "<用户的原始请求>",
    "projectName": "<项目名称>",
    "sessionData": {
      "domain": "<业务领域>",
      "features": ["<功能列表>"],
      "timestamp": "<时间戳>"
    }
  }
}
```

## 错误处理标准

### 解析失败时的降级格式

当无法解析为标准格式时，返回安全降级：

```json
{
  "thought": "解析响应格式时出现错误，使用安全降级模式",
  "response_mode": "GENERAL_CHAT",
  "direct_response": "抱歉，我的响应格式有问题，请重新尝试您的请求。",
  "tool_calls": []
}
```

## 验证规则

### 必填字段验证
- 所有4个字段都必须存在
- `thought` 不能为空字符串
- `response_mode` 必须是有效的枚举值

### 逻辑一致性验证
- `TOOL_EXECUTION` 模式：`direct_response` 为 null，`tool_calls` 非空
- `KNOWLEDGE_QA/GENERAL_CHAT` 模式：`direct_response` 有内容，`tool_calls` 为空数组

### 工具调用验证
- 工具名称必须在已注册工具列表中
- 工具参数必须符合对应工具的schema

## 实施指南

### 对于 Orchestrator
- 在 `rules/orchestrator.md` 中引用此标准
- 所有示例必须符合此格式

### 对于 Specialist 规则
- 在每个 `rules/specialists/*.md` 文件开头引用此标准
- 替换现有的 skill 调用格式
- 确保所有示例符合标准格式

### 代码实现
- `PlanGenerator.parseAIPlanFromResponse()` 方法基于此标准
- 添加格式验证逻辑
- 统一错误处理机制

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | 2024-01 | 初始版本，统一响应格式标准 |

## 相关文档

- [Tool Access Control Matrix](./tool-access-control-matrix.md) - 工具调用权限矩阵
- [Orchestrator Rules](../rules/orchestrator.md) - 编排器规则
- [Specialist Rules](../rules/specialists/) - 专家规则集合 