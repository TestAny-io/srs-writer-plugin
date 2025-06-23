# 分布式工具访问控制设计文档

**文档版本**: 2.0  
**更新日期**: 2024-12-19  
**作者**: SRS Writer Plugin 架构团队  

## 📖 概述

本文档定义了 SRS Writer Plugin 中基于**分布式访问控制**的工具权限管理系统。每个工具通过自身的 `accessibleBy` 属性声明访问权限，实现代码层面的强制访问控制，确保系统架构的清晰性、安全性和可维护性。

## 🏗️ 架构升级

**v1.0 → v2.0 重大变更**:
- ❌ **废弃**: 集中式权限矩阵
- ✅ **采用**: 分布式工具自治权限控制
- 🔒 **强化**: 代码层面权限强制执行
- 🚀 **新增**: 基于 CallerType 的细粒度控制

### **新架构层级**

SRS Writer Plugin 采用四层工具架构 + AI调用者类型：

#### **🤖 AI调用者层级**
- **🎯 orchestrator:TOOL_EXECUTION**: 智能分诊中心 - 执行模式
- **🧠 orchestrator:KNOWLEDGE_QA**: 智能分诊中心 - 知识问答和一般对话模式  
- **🔬 specialist**: 专家执行器，负责具体SRS业务逻辑

#### **🛠️ 工具实现层级**
- **📄 document**: 文档业务层，负责SRS文档的具体操作和业务规则
- **⚛️ atomic**: 原子操作层，负责基础的文件系统操作
- **🔧 internal**: 系统工具层，负责日志、用户交互、流程控制等系统功能

## 🚀 分布式访问控制实现

### **核心类型系统**

```typescript
// src/types/index.ts
export enum CallerType {
    // Orchestrator AI 的不同模式
    ORCHESTRATOR_TOOL_EXECUTION = 'orchestrator:TOOL_EXECUTION',
    ORCHESTRATOR_KNOWLEDGE_QA = 'orchestrator:KNOWLEDGE_QA',
    
    // Specialist AI
    SPECIALIST = 'specialist',
    
    // 代码层级 (无AI，理论上不需要，但保留完整性)
    DOCUMENT = 'document',
    ATOMIC = 'atomic', 
    INTERNAL = 'internal'
}
```

### **工具定义扩展**

```typescript
// src/tools/index.ts
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: any;
    layer?: 'atomic' | 'specialist' | 'document' | 'internal';
    category?: string;
    // 🚀 新增：分布式访问控制
    accessibleBy?: CallerType[];
}
```

### **访问控制器**

```typescript
// src/core/orchestrator/ToolAccessController.ts
export class ToolAccessController {
    /**
     * 获取指定调用者可访问的工具列表
     */
    getAvailableTools(caller: CallerType): ToolDefinition[]
    
    /**
     * 验证调用者是否可以访问指定工具
     */
    validateAccess(caller: CallerType, toolName: string): boolean
    
    /**
     * 生成访问控制报告
     */
    generateAccessReport(caller: CallerType): string
}
```

## 🔐 具体权限定义

### **🎯 orchestrator:TOOL_EXECUTION** 
**权限**: 最高权限，可以访问所有标记的工具

**可访问工具示例**:
```typescript
// 🧠 专家工具 - 智能路由职责
createComprehensiveSRS: {
    accessibleBy: [CallerType.ORCHESTRATOR_TOOL_EXECUTION]
}

// 📄 文档工具 - 简单操作也可直接处理
addNewRequirement: {
    accessibleBy: [CallerType.ORCHESTRATOR_TOOL_EXECUTION, CallerType.SPECIALIST]
}

// ⚛️ 原子工具 - 基础操作
readFile: {
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_GENERAL_CHAT,
        CallerType.SPECIALIST
    ]
}

// 🔧 内部工具 - 系统控制
finalAnswer: {
    accessibleBy: [CallerType.ORCHESTRATOR_TOOL_EXECUTION, CallerType.SPECIALIST]
}
```

### **🧠 orchestrator:KNOWLEDGE_QA**
**权限**: 知识检索 + 安全查询操作，包含一般对话功能

**可访问工具示例**:
```typescript
// 🔧 知识检索工具
customRAGRetrieval: {
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // ✅ 核心能力
        CallerType.SPECIALIST
    ]
}

// ⚛️ 安全查询工具（从原GENERAL_CHAT合并）
readFile: {
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // ✅ "帮我看看config.json"
        CallerType.SPECIALIST
    ]
}

listFiles: {
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // ✅ "项目里有什么文件？"
        CallerType.SPECIALIST
    ]
}

internetSearch: {
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA     // ✅ "最新技术趋势？"
    ]
}

// ❌ 危险操作均不可访问
// writeFile, createDirectory, deleteFile 等都看不到
```



### **🔬 specialist**
**权限**: 业务工具 + 系统控制，不能递归调用专家

**可访问工具示例**:
```typescript
// 📄 文档层工具 - 核心业务能力
addNewRequirement: {
    accessibleBy: [CallerType.ORCHESTRATOR_TOOL_EXECUTION, CallerType.SPECIALIST]
}

updateRequirement: {
    accessibleBy: [CallerType.ORCHESTRATOR_TOOL_EXECUTION, CallerType.SPECIALIST]
}

// 🔧 内部工具 - 流程控制
customRAGRetrieval: {
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
        CallerType.SPECIALIST                     // ✅ 专家内容生成需要
    ]
}

finalAnswer: {
    accessibleBy: [CallerType.ORCHESTRATOR_TOOL_EXECUTION, CallerType.SPECIALIST]
}

// ⚛️ 部分原子工具 - 通过文档层间接访问
readFile: {
    accessibleBy: [/* ..., */ CallerType.SPECIALIST]
}

// ❌ 专家工具不能递归调用
// createComprehensiveSRS, editSRSDocument 等看不到

// ❌ 不需要外部信息
// internetSearch 看不到
```

## 🏗️ 实施架构

### **工具注册与过滤**

```typescript
// src/core/orchestrator/ToolCacheManager.ts
export class ToolCacheManager {
    private accessController = new ToolAccessController();
    private toolsCache: Map<CallerType, { definitions: any[], jsonSchema: string }> = new Map();
    
    /**
     * 获取指定调用者可访问的工具（带缓存）
     */
    public async getTools(caller: CallerType): Promise<{ definitions: any[], jsonSchema: string }> {
        if (this.toolsCache.has(caller)) {
            return this.toolsCache.get(caller)!;
        }
        
        const filteredDefinitions = this.accessController.getAvailableTools(caller);
        const jsonSchema = JSON.stringify(filteredDefinitions, null, 2);
        
        const result = { definitions: filteredDefinitions, jsonSchema };
        this.toolsCache.set(caller, result);
        
        return result;
    }
}
```

### **智能意图检测**

```typescript
// src/core/orchestrator/PromptManager.ts  
private detectIntentType(userInput: string): CallerType {
    const input = userInput.toLowerCase();
    
    // 检测知识问答
    const knowledgePatterns = [
        /^(how|what|why|when|where|which)/,
        /如何|怎么|什么是|为什么|怎样/,
        /best practices?|最佳实践/
    ];
    
    // 检测闲聊
    const chatPatterns = [
        /^(hi|hello|hey|thanks)/,
        /^(你好|谢谢|感谢)/,
        /weather|天气/
    ];
    
    if (chatPatterns.some(pattern => pattern.test(input))) {
        return CallerType.ORCHESTRATOR_GENERAL_CHAT;
    }
    
    if (knowledgePatterns.some(pattern => pattern.test(input))) {
        return CallerType.ORCHESTRATOR_KNOWLEDGE_QA;
    }
    
    return CallerType.ORCHESTRATOR_TOOL_EXECUTION;
}
```

### **访问控制验证**

```typescript
// 在工具执行时进行验证
public async executeTool(toolName: string, params: any, caller: CallerType): Promise<any> {
    // 🔒 关键：访问控制验证
    if (!this.accessController.validateAccess(caller, toolName)) {
        throw new Error(`🚫 Access denied: ${caller} cannot access tool: ${toolName}`);
    }
    
    // 执行工具
    const implementation = toolRegistry.getImplementation(toolName);
    return await implementation(params);
}
```

## 📋 工具权限快速参考

### **按调用者分类**

| 调用者 | 可访问工具类型 | 典型用例 |
|--------|---------------|----------|
| **TOOL_EXECUTION** | 全部标记的工具 | "创建SRS", "添加需求", "检查文件" |
| **KNOWLEDGE_QA** | 知识检索 + 安全查询工具 | "如何写需求？", "项目有什么文件？", "天气如何？" |
| **SPECIALIST** | 业务 + 系统工具 | 专家规则执行时的工具调用 |

### **按工具风险分类**

| 风险等级 | 工具示例 | 访问权限 |
|----------|----------|----------|
| **🟢 低风险** | readFile, listFiles | 多数调用者可访问 |
| **🟡 中风险** | internetSearch, customRAGRetrieval | 特定场景可访问 |
| **🔴 高风险** | writeFile, deleteFile | 仅执行模式可访问 |
| **⚫ 系统关键** | finalAnswer, 专家工具 | 严格限制访问 |

## 🎯 使用示例

### **正确的权限声明**

```typescript
// ✅ 安全查询工具 - 多模式访问
export const readFileDefinition = {
    name: "readFile",
    description: "Read file content", 
    // ...
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_GENERAL_CHAT,    // 用户询问文件内容
        CallerType.SPECIALIST,                    // 专家读取文档
        CallerType.DOCUMENT                       // 文档层操作
    ]
};

// ✅ 危险操作工具 - 限制访问
export const writeFileDefinition = {
    name: "writeFile",
    description: "Write file content",
    // ...
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,  // 明确的创建任务
        CallerType.SPECIALIST,                    // 专家生成文档
        CallerType.DOCUMENT                       // 文档层核心功能
        // ❌ GENERAL_CHAT 和 KNOWLEDGE_QA 不能写文件
    ]
};

// ✅ 知识工具 - 广泛但安全
export const customRAGRetrievalDefinition = {
    name: "customRAGRetrieval",
    description: "Knowledge retrieval",
    // ...
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,  // 任务执行中的知识增强
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,    // 知识问答核心
        CallerType.SPECIALIST                     // 专家内容生成
        // ❌ GENERAL_CHAT 应该用 internetSearch
    ]
};
```

### **错误的权限声明示例**

```typescript
// ❌ 过于宽松 - 安全风险
export const deleteFileDefinition = {
    name: "deleteFile",
    // ...
    accessibleBy: [
        CallerType.ORCHESTRATOR_GENERAL_CHAT     // 危险！聊天模式不应该删除文件
    ]
};

// ❌ 过于严格 - 功能受限
export const listFilesDefinition = {
    name: "listFiles", 
    // ...
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION   // 太严格！用户询问"项目有什么文件？"无法响应
    ]
};

// ❌ 递归调用 - 架构违反
export const createComprehensiveSRSDefinition = {
    name: "createComprehensiveSRS",
    // ...
    accessibleBy: [
        CallerType.SPECIALIST                     // 错误！专家不能调用其他专家
    ]
};
```

## 🔍 调试与监控

### **访问控制报告**

```typescript
// 生成访问控制报告
const report = toolAccessController.generateAccessReport(CallerType.ORCHESTRATOR_GENERAL_CHAT);

/*
输出示例:
# Access Control Report for orchestrator:GENERAL_CHAT

**Summary**: 4/25 tools accessible

**By Layer**:
- atomic: 3 tools
- internal: 1 tools

**Accessible Tools**:
- readFile (atomic/File Operations)
- listFiles (atomic/File Operations) 
- internetSearch (atomic/Internet Access)
- customRAGRetrieval (atomic/RAG Tools)
*/
```

### **访问统计**

```typescript
const stats = toolAccessController.getAccessStats(CallerType.ORCHESTRATOR_KNOWLEDGE_QA);
/*
{
    totalTools: 25,
    accessibleTools: 1,
    deniedTools: 24,
    byLayer: { internal: 1 }
}
*/
```

## 🔄 维护指南

### **添加新工具**

1. **定义工具**: 在对应层级添加工具定义
2. **声明权限**: 明确设置 `accessibleBy` 属性
3. **验证权限**: 运行访问控制测试
4. **更新文档**: 同步更新本文档

```typescript
// 新工具模板
export const newToolDefinition = {
    name: "newTool",
    description: "Tool description",
    parameters: { /* ... */ },
    layer: "atomic",  // 或其他层级
    // 🚀 必须：声明访问权限
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        // 根据工具性质添加其他调用者
    ]
};
```

### **权限变更流程**

1. **评估影响**: 分析权限变更对现有功能的影响
2. **更新定义**: 修改工具的 `accessibleBy` 属性
3. **测试验证**: 运行完整的权限测试套件
4. **文档更新**: 更新相关文档和示例

### **权限审计**

定期运行权限审计脚本：

```bash
# 生成所有工具的访问权限报告
node scripts/audit-tool-permissions.js

# 验证权限配置的一致性
npm run test:permissions
```

## 📚 相关文档

- [工具注册表实现 (src/tools/index.ts)](../src/tools/index.ts)
- [访问控制器实现 (src/core/orchestrator/ToolAccessController.ts)](../src/core/orchestrator/ToolAccessController.ts)
- [Orchestrator 规则 (rules/orchestrator.md)](../rules/orchestrator.md)  
- [Specialist 规则目录 (rules/specialists/)](../rules/specialists/)

---

**文档状态**: ✅ v2.0 已完成 - 分布式访问控制实现    
**下次审查**: 2024-Q1  
**维护者**: SRS Writer Plugin 架构团队 