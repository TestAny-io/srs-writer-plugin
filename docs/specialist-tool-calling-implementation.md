# Specialist 工具调用能力实现文档

**文档版本**: 1.0  
**实现日期**: 2024-12-19  
**作者**: SRS Writer Plugin 架构团队  

## 📖 概述

本文档详细记录了 SRS Writer Plugin 中 **Specialist 层工具调用能力** 的完整实现过程。这是架构升级的最后一个关键组件，标志着双层AI架构的完全激活，系统从"纯文本生成工具"正式升级为"智能业务执行平台"。

## 🎯 实现目标

### **核心目标**
- 为 Specialist AI 提供真实的工具调用能力
- 集成分布式访问控制系统
- 实现 Document 层胖工具的智能编排
- 确保架构清晰且易于维护

### **技术目标**
- VSCode 原生工具调用 API 集成
- 多轮交互支持 (AI → 工具 → 结果 → AI)
- 调用指南自动注入机制
- 向后兼容性保障

## 🏗️ 架构设计

### **最终架构图**
```
用户输入 → Orchestrator AI → Specialist AI → Document 胖工具 → 原子操作 → 文件系统
              ↓                    ↓               ↓
        智能意图分诊        业务决策执行      内部工具编排
        工具路由选择        工具调用序列      原子操作聚合
```

### **工具调用流程**
```
1. SpecialistExecutor.executeSpecialist()
2. 加载 specialist 规则 + 获取可用工具列表
3. VSCode API 调用 (包含工具定义)
4. AI 返回 tool_calls 数组
5. 执行工具调用 + 访问权限验证
6. 将工具结果反馈给 AI
7. AI 生成最终响应
```

### **关键设计决策**

#### **胖工具 vs 细粒度工具**
**选择**: 胖工具模式  
**原因**: 
- AI 专注高级业务决策，不需要管理低级工具编排
- 业务逻辑封装在代码中，而非 AI 提示词中
- 符合分层架构原则，职责分离清晰

#### **Document 层不访问 LLM**
**选择**: Document 层纯编程逻辑  
**原因**:
- 避免三层AI架构的复杂性
- 确保性能和可靠性
- 将智能决策留给 Specialist AI

## 🚀 核心实现

### **1. SpecialistExecutor 升级**

#### **工具调用集成**
```typescript
// src/core/specialistExecutor.ts (关键新增)

// 获取 Specialist 可用的工具
const toolsInfo = await this.toolCacheManager.getTools(CallerType.SPECIALIST);
const toolsForVSCode = this.convertToolsToVSCodeFormat(toolsInfo.definitions);

// 如果有可用工具，提供给 AI
if (toolsForVSCode.length > 0) {
    requestOptions.toolMode = vscode.LanguageModelChatToolMode.Required;
    requestOptions.tools = toolsForVSCode;
}

// 处理工具调用
if (response.toolCalls && response.toolCalls.length > 0) {
    return await this.handleToolCallsWorkflow(response, messages, model, requestOptions);
}
```

#### **多轮交互处理**
```typescript
private async handleToolCallsWorkflow(
    response: vscode.LanguageModelChatResponse,
    messages: vscode.LanguageModelChatMessage[],
    model: vscode.LanguageModelChat,
    requestOptions: vscode.LanguageModelChatRequestOptions
): Promise<string> {
    // 执行所有工具调用
    const toolResults: vscode.LanguageModelChatMessage[] = [];
    
    for (const toolCall of response.toolCalls) {
        const result = await this.executeToolCall(toolCall);
        toolResults.push(vscode.LanguageModelChatMessage.Tool(result, toolCall.id));
    }

    // 第二轮交互：将工具结果反馈给 AI
    const updatedMessages = [...messages, ...toolResults];
    const secondResponse = await model.sendRequest(updatedMessages, requestOptions);
    
    return finalResult;
}
```

#### **访问控制验证**
```typescript
private async executeToolCall(toolCall: vscode.LanguageModelChatToolCall): Promise<string> {
    const { name: toolName, parameters } = toolCall;
    
    // 验证访问权限
    if (!this.toolAccessController.validateAccess(CallerType.SPECIALIST, toolName)) {
        throw new Error(`🚫 Access denied: Specialist cannot access tool: ${toolName}`);
    }

    // 获取工具实现并执行
    const toolImplementation = toolRegistry.getImplementation(toolName);
    const result = await toolImplementation(parameters);
    
    return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
}
```

### **2. 调用指南注入系统**

#### **模板变量扩展**
```typescript
// 支持的调用指南占位符
{{TOOL_CALLING_GUIDE.toolName}}    // 单个工具指南
{{ALL_TOOL_GUIDES}}                // 所有工具指南
```

#### **指南格式化**
```typescript
private formatCallingGuide(tool: any): string {
    const guide = tool.callingGuide;
    
    let formatted = `**何时使用**: ${guide.whenToUse || '未指定'}\n\n`;
    
    if (guide.prerequisites) {
        formatted += `**前置条件**: ${guide.prerequisites}\n\n`;
    }
    
    if (guide.inputRequirements) {
        formatted += `**输入要求**:\n`;
        for (const [key, desc] of Object.entries(guide.inputRequirements)) {
            formatted += `- ${key}: ${desc}\n`;
        }
    }
    
    return formatted.trim();
}
```

### **3. Document 层工具完善**

#### **工具定义扩展**
```typescript
export const addNewRequirementToolDefinition = {
    name: "addNewRequirement",
    description: "Add a new functional requirement to the project",
    parameters: { /* JSON Schema */ },
    
    // 🚀 新增：分布式访问控制
    accessibleBy: [CallerType.SPECIALIST, CallerType.DOCUMENT],
    
    // 🚀 新增：调用指南
    callingGuide: {
        whenToUse: "当需要向现有项目添加新的功能需求时",
        prerequisites: "项目必须已存在 SRS.md 文件",
        inputRequirements: {
            projectPath: "必需：项目目录路径",
            requirement: "必需：包含完整字段的需求对象"
        },
        internalWorkflow: [
            "1. 验证项目状态和 SRS.md 文件存在性",
            "2. 创建备份文件以确保事务安全",
            "3. 读取现有功能需求列表",
            "4. 生成新的需求ID (FR-XXX格式)",
            "5. 同时更新 fr.yaml 和 SRS.md 中的功能需求表格",
            "6. 原子性提交或自动回滚"
        ],
        commonPitfalls: [
            "不要在项目不存在时调用此工具",
            "确保 requirement 对象包含所有必需字段",
            "priority 必须是 '高'、'中'、'低' 之一"
        ]
    }
};
```

## 🔐 访问控制矩阵

### **Specialist 可访问的工具**
| 工具名称 | 层级 | 用途 | 调用场景 |
|---------|------|------|----------|
| `addNewRequirement` | document | 添加功能需求 | 需求管理 |
| `listRequirements` | document | 列出现有需求 | 状态检查 |
| `generateFullSrsReport` | document | 生成完整报告 | 文档生成 |
| `customRAGRetrieval` | atomic | 企业知识检索 | 内容增强 |
| `readFile` | atomic | 读取文件 | 文档检查 |
| `writeFile` | atomic | 写入文件 | 文档创建 |
| `finalAnswer` | internal | 任务完成 | 流程结束 |

### **访问控制验证**
测试结果确认各调用者的工具访问权限：
- **SPECIALIST**: 6个工具 ✅
- **ORCHESTRATOR_TOOL_EXECUTION**: 4个工具 ✅  
- **ORCHESTRATOR_KNOWLEDGE_QA**: 3个工具 (customRAGRetrieval, readLocalKnowledge, internetSearch) ✅
- **ORCHESTRATOR_GENERAL_CHAT**: 1个工具 (仅 readFile) ✅

## 📋 使用指南

### **Specialist 规则编写**

#### **基本模板**
```markdown
# rules/specialists/your_specialist.md

## 工作流程
1. **知识检索阶段**
   - 调用 customRAGRetrieval 或 readLocalKnowledge 获取相关知识和模板
   
2. **内容生成阶段**
   - 基于检索到的知识生成完整内容
   
3. **工具执行阶段**
   - 调用适当的 Document 层胖工具
   
## 可用工具调用指南
{{ALL_TOOL_GUIDES}}

## 示例调用序列
```json
{
  "tool_calls": [
    {
      "name": "customRAGRetrieval",
      "args": {
        "query": "{{USER_INPUT}} 相关最佳实践",
        "contextType": "content_generation"
      }
    }
  ]
}
```

基于检索结果后：
```json
{
  "tool_calls": [
    {
      "name": "addNewRequirement",
      "args": {
        "projectPath": "extracted-project-path",
        "requirement": {
          "name": "需求名称",
          "priority": "高",
          "description": "详细描述",
          "acceptance_criteria": "验收标准"
        }
      }
    }
  ]
}
```
```

### **工具开发指南**

#### **新 Document 工具模板**
```typescript
export const newToolDefinition = {
    name: "newTool",
    description: "工具描述",
    parameters: { /* JSON Schema */ },
    
    // 🚀 必须：访问控制
    accessibleBy: [
        CallerType.SPECIALIST,
        CallerType.DOCUMENT  // 如果需要同层调用
    ],
    
    // 🚀 必须：调用指南
    callingGuide: {
        whenToUse: "何时使用此工具",
        prerequisites: "前置条件",
        inputRequirements: {
            param1: "参数1说明",
            param2: "参数2说明"
        },
        internalWorkflow: [
            "1. 工作流程步骤1",
            "2. 工作流程步骤2"
        ],
        commonPitfalls: [
            "常见错误1",
            "常见错误2"
        ]
    }
};

export async function newTool(args: NewToolArgs): Promise<ToolResult> {
    // 实现胖工具逻辑：
    // 1. 参数验证
    // 2. 调用其他同层工具（如需要）
    // 3. 调用原子工具执行操作
    // 4. 返回结构化结果
}
```

## 🔧 维护指南

### **添加新的 Specialist 规则**
1. 在 `rules/specialists/` 创建新的 `.md` 文件
2. 使用调用指南占位符：`{{TOOL_CALLING_GUIDE.toolName}}`
3. 在 `SpecialistExecutor.getSpecialistFileName()` 中添加映射
4. 测试工具调用权限

### **扩展 Document 层工具**
1. 为新工具添加 `accessibleBy` 和 `callingGuide` 属性
2. 确保工具返回统一的结果格式
3. 在 `toolRegistry` 中注册工具实现
4. 运行访问控制测试

### **调试工具调用问题**
```typescript
// 生成访问控制报告
const report = toolAccessController.generateAccessReport(CallerType.SPECIALIST);
console.log(report);

// 验证特定工具访问
const hasAccess = toolAccessController.validateAccess(CallerType.SPECIALIST, 'toolName');
console.log(`Access: ${hasAccess}`);
```

## 🚨 注意事项

### **重要约束**
1. **Document 层不能访问 LLM**: 保持纯编程逻辑
2. **同层工具调用**: Document 工具可以调用同层其他工具
3. **访问权限**: 必须为所有新工具明确定义 `accessibleBy`
4. **向后兼容**: 保留所有降级备用逻辑

### **性能考虑**
1. **工具缓存**: `ToolCacheManager` 按调用者类型缓存工具列表
2. **多轮交互**: 每次工具调用都是新的 VSCode API 请求
3. **调用指南**: 在模板替换时生成，不缓存

### **错误处理**
1. **访问拒绝**: 返回明确的权限错误信息
2. **工具失败**: 继续执行其他工具，收集所有错误
3. **降级机制**: 工具调用失败时回退到纯文本模式

## 📈 性能数据

### **构建验证**
- ✅ TypeScript 编译: 无错误
- ✅ Webpack 构建: 无警告  
- ✅ 访问控制测试: 100% 通过
- ✅ 向后兼容性: 完全保持

### **访问控制统计**
- 总工具数: ~25个
- SPECIALIST 可访问: 6个核心业务工具
- ORCHESTRATOR 各模式: 1-4个工具
- 权限验证: 代码层强制执行

## 🎯 未来扩展

### **短期计划**
1. 添加更多 Document 层胖工具
2. 完善 Specialist 规则库
3. 增强错误处理和日志

### **长期规划**
1. 工具调用性能优化
2. 高级工具编排能力
3. 可视化工具调用链

## 📚 相关文档

- [分布式工具访问控制设计](./tool-access-control-matrix.md)
- [Orchestrator 决策引擎规则](../rules/orchestrator.md)
- [工具注册表实现](../src/tools/index.ts)
- [Specialist 规则目录](../rules/specialists/)

---

**文档状态**: ✅ 实现完成  
**下次审查**: 2024-Q1  
**维护者**: SRS Writer Plugin 架构团队

**🎉 重要里程碑**: 此实现标志着 SRS Writer Plugin 双层AI架构完全激活，从文本生成工具升级为智能业务执行平台！ 