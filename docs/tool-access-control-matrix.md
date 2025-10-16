# 分布式工具访问控制设计文档

**文档版本**: 3.0  
**更新日期**: 2025-10-02  
**作者**: SRS Writer Plugin 架构团队  
**状态**: 🚧 计划中 - v3.0 重构设计

## 📖 概述

本文档定义了 SRS Writer Plugin 中基于**分布式访问控制**的工具权限管理系统。每个工具通过自身的 `accessibleBy` 属性声明访问权限，实现代码层面的强制访问控制，确保系统架构的清晰性、安全性和可维护性。

## 🏗️ 架构升级历史

**v1.0 → v2.0 重大变更**:
- ❌ **废弃**: 集中式权限矩阵
- ✅ **采用**: 分布式工具自治权限控制
- 🔒 **强化**: 代码层面权限强制执行
- 🚀 **新增**: 基于 CallerType 的细粒度控制

**v2.0 → v3.0 计划变更** (🚧 本次重构):
- 🚀 **新增**: 支持 Specialist 个体级别的访问控制
- 🔀 **混合**: 支持 CallerType（类型）和 CallerName（个体）混合声明
- 🤖 **动态**: 利用 SpecialistRegistry 实现动态 specialist 识别
- 💰 **优化**: 减少专用工具对其他 specialist 的 token 噪声

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

### **核心类型系统（v2.0）**

```typescript
// src/types/index.ts
export enum CallerType {
    // Orchestrator AI 的不同模式
    ORCHESTRATOR_TOOL_EXECUTION = 'orchestrator:TOOL_EXECUTION',
    ORCHESTRATOR_KNOWLEDGE_QA = 'orchestrator:KNOWLEDGE_QA',
    
    // Specialist AI（类型级别）
    SPECIALIST_CONTENT = 'specialist:content',
    SPECIALIST_PROCESS = 'specialist:process',
    
    // 代码层级
    DOCUMENT = 'document',
    ATOMIC = 'atomic', 
    INTERNAL = 'internal'
}
```

### **核心类型系统（v3.0 计划）**

```typescript
// src/types/index.ts

// CallerType 保持不变
export enum CallerType {
    ORCHESTRATOR_TOOL_EXECUTION = 'orchestrator:TOOL_EXECUTION',
    ORCHESTRATOR_KNOWLEDGE_QA = 'orchestrator:KNOWLEDGE_QA',
    SPECIALIST_CONTENT = 'specialist:content',
    SPECIALIST_PROCESS = 'specialist:process',
    DOCUMENT = 'document',
    INTERNAL = 'internal'
}

// 🚀 新增：CallerName - Specialist 个体标识
// 基于 SpecialistRegistry 动态获取，无需手动维护枚举
export type CallerName = string;  // Specialist ID (例如: "prototype_designer", "fr_writer")

// 🚀 新增：混合访问控制类型
export type AccessControl = CallerType | CallerName;
```

### **工具定义扩展（v2.0）**

```typescript
// src/tools/index.ts
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: any;
    layer?: 'atomic' | 'specialist' | 'document' | 'internal';
    category?: string;
    // v2.0: 分布式访问控制
    accessibleBy?: CallerType[];
}
```

### **工具定义扩展（v3.0 计划）**

```typescript
// src/tools/index.ts
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: any;
    layer?: 'atomic' | 'specialist' | 'document' | 'internal';
    category?: string;
    
    // 🚀 v3.0: 混合访问控制 - 支持 CallerType 和 CallerName
    accessibleBy?: Array<CallerType | CallerName>;
    
    // 其他属性保持不变
    interactionType?: 'autonomous' | 'confirmation' | 'interactive';
    riskLevel?: 'low' | 'medium' | 'high';
    requiresConfirmation?: boolean;
}
```

### **访问控制器（v2.0）**

```typescript
// src/core/orchestrator/ToolAccessController.ts
export class ToolAccessController {
    getAvailableTools(caller: CallerType): ToolDefinition[]
    validateAccess(caller: CallerType, toolName: string): boolean
    generateAccessReport(caller: CallerType): string
}
```

### **访问控制器（v3.0 计划）**

```typescript
// src/core/orchestrator/ToolAccessController.ts
export class ToolAccessController {
    private specialistRegistry: SpecialistRegistry;  // 🚀 新增
    
    constructor() {
        this.specialistRegistry = getSpecialistRegistry();
    }
    
    /**
     * 获取指定调用者可访问的工具列表
     * 🚀 v3.0: 支持传入 specialist ID
     */
    getAvailableTools(
        caller: CallerType, 
        specialistId?: string  // 🚀 新增：具体的 specialist ID
    ): ToolDefinition[]
    
    /**
     * 验证调用者是否可以访问指定工具
     * 🚀 v3.0: 支持传入 specialist ID
     */
    validateAccess(
        caller: CallerType, 
        toolName: string,
        specialistId?: string  // 🚀 新增
    ): boolean
    
    /**
     * 生成访问控制报告
     * 🚀 v3.0: 支持 specialist 级别的报告
     */
    generateAccessReport(
        caller: CallerType,
        specialistId?: string  // 🚀 新增
    ): string
    
    /**
     * 🚀 v3.0 新增：检查访问控制值的类型
     */
    private isCallerType(value: AccessControl): value is CallerType
    
    /**
     * 🚀 v3.0 新增：检查工具是否对指定调用者可访问
     */
    private isToolAccessible(
        tool: ToolDefinition, 
        caller: CallerType,
        specialistId?: string
    ): boolean {
        if (!tool.accessibleBy || tool.accessibleBy.length === 0) {
            return this.getDefaultAccess(tool, caller);
        }
        
        for (const accessor of tool.accessibleBy) {
            // 1. 检查 CallerType（枚举值）
            if (this.isCallerType(accessor)) {
                if (accessor === caller) return true;
            }
            // 2. 检查 CallerName（specialist ID 字符串）
            else if (typeof accessor === 'string' && specialistId) {
                if (accessor === specialistId) {
                    // 验证 specialist 是否存在
                    if (this.specialistRegistry.isSpecialistAvailable(accessor)) {
                        return true;
                    } else {
                        this.logger.warn(`⚠️ 工具引用了不存在的 specialist: ${accessor}`);
                    }
                }
            }
        }
        
        return false;
    }
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

### **v2.0 权限声明示例**

```typescript
// ✅ 安全查询工具 - 多模式访问
export const readFileDefinition = {
    name: "readFile",
    description: "Read file content", 
    accessibleBy: [
        CallerType.ORCHESTRATOR_TOOL_EXECUTION,
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
        CallerType.SPECIALIST_CONTENT,
        CallerType.SPECIALIST_PROCESS,
        CallerType.DOCUMENT
    ]
};

// ✅ 危险操作工具 - 限制访问
export const writeFileDefinition = {
    name: "writeFile",
    description: "Write file content",
    accessibleBy: [
        CallerType.SPECIALIST_PROCESS,
        CallerType.DOCUMENT
    ]
};
```

### **v3.0 权限声明示例（计划）**

```typescript
// ✅ 示例1: 只给特定 specialist（个体级别控制）
export const writePrototypeThemeDefinition = {
    name: "writePrototypeTheme",
    description: `生成原型主题CSS文件。
    
    必须包含以下 CSS 变量：
    - --background, --foreground (基础颜色)
    - --primary, --primary-foreground (品牌颜色)
    - --secondary, --muted, --accent (语义颜色)
    - --destructive, --border, --input, --ring (UI元素)
    - --font-sans, --font-serif, --font-mono (字体系统)
    - --radius, --spacing (间距和形状)
    - --shadow-xs, --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl (阴影系统)
    `,
    parameters: {
        type: "object",
        properties: {
            themeName: { type: "string", description: "主题名称" },
            cssContent: { type: "string", description: "完整的CSS内容" }
        },
        required: ["themeName", "cssContent"]
    },
    // 🚀 v3.0: 只给两个特定 specialist
    accessibleBy: [
        "prototype_designer",      // CallerName
        "project_initializer"      // CallerName
    ],
    layer: "atomic"
};

// ✅ 示例2: 混合类型和个体控制
export const writeFileDefinition = {
    name: "writeFile",
    description: "Write file content",
    parameters: { /* ... */ },
    // 🚀 v3.0: 混合 CallerType 和 CallerName
    accessibleBy: [
        CallerType.SPECIALIST_PROCESS,    // 所有 process specialist
        "prototype_designer",             // 特定的 content specialist
        CallerType.DOCUMENT               // 文档层
    ],
    layer: "atomic"
};

// ✅ 示例3: 通用工具（保持 v2.0 方式）
export const readFileDefinition = {
    name: "readFile",
    description: "Read file content",
    parameters: { /* ... */ },
    // 使用 CallerType，所有同类型 specialist 都能访问
    accessibleBy: [
        CallerType.ORCHESTRATOR_KNOWLEDGE_QA,
        CallerType.SPECIALIST_CONTENT,
        CallerType.SPECIALIST_PROCESS,
        CallerType.DOCUMENT
    ],
    layer: "atomic"
};

// ✅ 示例4: 预览工具（新增）
export const previewPrototypeDefinition = {
    name: "previewPrototype",
    description: "在 VSCode 或浏览器中预览 HTML 原型文件",
    parameters: {
        type: "object",
        properties: {
            fileName: { type: "string", description: "原型文件名" },
            mode: { 
                type: "string", 
                enum: ["vscode", "browser", "both"],
                default: "vscode"
            }
        },
        required: ["fileName"]
    },
    // 🚀 v3.0: 只给 prototype_designer
    accessibleBy: ["prototype_designer"],
    layer: "atomic",
    interactionType: 'autonomous',
    riskLevel: 'low'
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

## 🚧 v3.0 重构实施计划

### 重构动机

**问题**: 当前的 CallerType 只支持类型级别控制（如 SPECIALIST_CONTENT），无法针对特定 specialist 进行访问控制。

**场景**: 为 `prototype_designer` 创建专用的语义化工具时：
- 工具定义较长（包含详细的 CSS 变量要求）
- 只有 `prototype_designer` 会使用
- 如果对所有 content specialist 可见，会产生 token 噪声

**解决方案**: 支持混合访问控制，既可以指定类型（CallerType），也可以指定个体（specialist ID）

### 实施步骤

#### 阶段一：类型系统扩展

**文件**: `src/types/index.ts`

```typescript
// 新增类型定义
export type CallerName = string;  // Specialist ID
export type AccessControl = CallerType | CallerName;
```

**工作量**: ~10 行代码，30 分钟

#### 阶段二：工具定义接口更新

**文件**: `src/tools/index.ts`

```typescript
export interface ToolDefinition {
    // 更新 accessibleBy 类型
    accessibleBy?: Array<CallerType | CallerName>;  // ← 支持混合
}
```

**工作量**: ~5 行代码，15 分钟

#### 阶段三：访问控制器重构

**文件**: `src/core/orchestrator/ToolAccessController.ts`

**修改内容**:
1. 新增 `specialistRegistry` 成员
2. 更新 `getAvailableTools` 方法签名（添加 specialistId 参数）
3. 更新 `validateAccess` 方法签名（添加 specialistId 参数）
4. 重构 `isToolAccessible` 方法（支持混合检查）
5. 新增 `isCallerType` 辅助方法

**工作量**: ~40 行代码，2 小时

#### 阶段四：工具缓存管理器更新

**文件**: `src/core/orchestrator/ToolCacheManager.ts`

**修改内容**:
1. 更新缓存键设计（`${callerType}:${specialistId || 'any'}`）
2. 更新 `getTools` 方法签名
3. 新增 `buildCacheKey` 辅助方法

**工作量**: ~30 行代码，1.5 小时

#### 阶段五：调用点更新

**文件**: 
- `src/core/specialistExecutor.ts`
- `src/core/toolExecutor.ts`

**修改内容**: 在调用 `getAvailableTools` 和 `validateAccess` 时传递 `specialistId`

**工作量**: ~10 行代码，30 分钟

#### 阶段六：测试和验证

- 单元测试：访问控制逻辑
- 集成测试：specialist 工具可见性
- 端到端测试：实际使用场景

**工作量**: 3-4 小时

### 总体评估

| 指标 | 评估 |
|------|------|
| **代码改动量** | ~95 行 |
| **文件数量** | 5 个核心文件 |
| **复杂度** | 🟡 中等 |
| **风险** | 🟢 低（向后兼容） |
| **开发时间** | 4-5 小时 |
| **测试时间** | 3-4 小时 |
| **总时间** | 1 天 |
| **收益** | 🟢 高（支持专用工具，减少 token 噪声） |

### 关键设计决策

1. **利用 SpecialistRegistry**: 无需手动维护 specialist 列表，动态获取
2. **向后兼容**: 现有工具无需修改，继续使用 CallerType
3. **混合支持**: 新工具可以同时使用 CallerType 和 CallerName
4. **运行时验证**: 通过 SpecialistRegistry 验证 specialist ID 的有效性

### 使用场景

**场景1**: 为 prototype_designer 创建专用工具
```typescript
accessibleBy: ["prototype_designer"]  // 只有这个 specialist 能看到
```

**场景2**: 多个 specialist 共享工具
```typescript
accessibleBy: ["prototype_designer", "project_initializer"]
```

**场景3**: 混合控制
```typescript
accessibleBy: [
    CallerType.SPECIALIST_PROCESS,  // 所有 process specialist
    "prototype_designer"             // 加上这一个 content specialist
]
```

## 📊 当前所有工具权限分配表

**更新日期**: 2025-10-02  
**基于**: v3.0 重构后的实际配置

### Atomic Layer 工具（文件系统）

| 工具名称 | 层级 | 分类 | 访问权限 | 说明 |
|---------|------|------|---------|------|
| **readTextFile** | atomic | File Ops | `ORCHESTRATOR_TOOL_EXECUTION`<br/>`ORCHESTRATOR_KNOWLEDGE_QA`<br/>`SPECIALIST_CONTENT`<br/>`SPECIALIST_PROCESS`<br/>`DOCUMENT` | 安全读取操作，广泛访问 |
| **writeFile** | atomic | File Ops | `SPECIALIST_PROCESS`<br/>`DOCUMENT` | 危险写操作，限制访问 |
| **appendTextToFile** | atomic | File Ops | `DOCUMENT` | 追加操作，仅文档层 |
| **createDirectory** | atomic | File Ops | `project_initializer`<br/>`INTERNAL` | 目录创建，仅项目初始化者使用 |
| **listFiles** | atomic | File Ops | `ORCHESTRATOR_KNOWLEDGE_QA`<br/>`SPECIALIST_PROCESS`<br/>`SPECIALIST_CONTENT`<br/>`DOCUMENT` | 🚀 统一目录列表工具（支持单层/递归），返回完整相对路径 |
| **deleteFile** | atomic | File Ops | `INTERNAL` | 高危操作，仅内部工具 |
| **moveAndRenameFile** | atomic | File Ops | `INTERNAL` | 文件重构，限制访问 |
| **copyAndRenameFile** | atomic | File Ops | `project_initializer`<br/>`INTERNAL` | 文件复制，仅项目初始化者使用 |

### Atomic Layer 工具（编辑器）

| 工具名称 | 层级 | 分类 | 访问权限 | 说明 |
|---------|------|------|---------|------|
| **getActiveDocumentContent** | atomic | Editor | `ORCHESTRATOR_KNOWLEDGE_QA`<br/>`DOCUMENT` | 获取当前文档内容 |
| **openAndShowFile** | atomic | Editor | `DOCUMENT` | 打开文件显示 |

### Atomic Layer 工具（交互）

| 工具名称 | 层级 | 分类 | 访问权限 | 说明 |
|---------|------|------|---------|------|
| **showInformationMessage** | atomic | User Interaction | `ORCHESTRATOR_KNOWLEDGE_QA`<br/>`DOCUMENT` | 显示信息 |
| **showWarningMessage** | atomic | User Interaction | `ORCHESTRATOR_KNOWLEDGE_QA`<br/>`DOCUMENT` | 显示警告 |
| **askQuestion** | atomic | User Interaction | `ORCHESTRATOR_KNOWLEDGE_QA`<br/>`SPECIALIST_PROCESS` | 询问用户输入 |
| **suggestNextAction** | atomic | User Interaction | `ORCHESTRATOR_KNOWLEDGE_QA`<br/>`SPECIALIST_PROCESS` | 提供行动建议 |

### Atomic Layer 工具（知识检索）

| 工具名称 | 层级 | 分类 | 访问权限 | 说明 |
|---------|------|------|---------|------|
| **readLocalKnowledge** | atomic | RAG | `ORCHESTRATOR_KNOWLEDGE_QA` | 本地知识检索 |
| **internetSearch** | atomic | RAG | | 互联网搜索 |
| **enterpriseRAGCall** | atomic | RAG | `ORCHESTRATOR_KNOWLEDGE_QA`<br/>`ORCHESTRATOR_TOOL_EXECUTION` | 企业知识库 |
| **customRAGRetrieval** | atomic | RAG | `SPECIALIST_CONTENT`<br/>`SPECIALIST_PROCESS`<br/>`ORCHESTRATOR_TOOL_EXECUTION` | 自定义RAG检索 |

### Atomic Layer 工具（智能编辑）

| 工具名称 | 层级 | 分类 | 访问权限 | 说明 |
|---------|------|------|---------|------|
| **findAndReplace** | atomic | Smart Edit | `DOCUMENT` | 查找替换 |
| **findInFiles** | atomic | Smart Edit | `ORCHESTRATOR_TOOL_EXECUTION, ORCHESTRATOR_KNOWLEDGE_QA, SPECIALIST_CONTENT` | 🚀 多文件搜索(Cursor风格，替换原findInFile) |
| **replaceInSelection** | atomic | Smart Edit | `DOCUMENT` | 选区替换 |

### Document Layer 工具

| 工具名称 | 层级 | 分类 | 访问权限 | 说明 |
|---------|------|------|---------|------|
| **readMarkdownFile** | document | Markdown | `ORCHESTRATOR_TOOL_EXECUTION`<br/>`ORCHESTRATOR_KNOWLEDGE_QA`<br/>`SPECIALIST_CONTENT`<br/>`SPECIALIST_PROCESS`<br/>`DOCUMENT` | 增强的Markdown读取 |
| **executeMarkdownEdits** | document | Markdown | `SPECIALIST_CONTENT`<br/>`SPECIALIST_PROCESS`<br/>`DOCUMENT` | Markdown语义编辑 |
| **readYAMLFiles** | document | YAML | `ORCHESTRATOR_TOOL_EXECUTION`<br/>`ORCHESTRATOR_KNOWLEDGE_QA`<br/>`SPECIALIST_CONTENT`<br/>`SPECIALIST_PROCESS`<br/>`DOCUMENT` | YAML文件读取 |
| **executeYAMLEdits** | document | YAML | `SPECIALIST_CONTENT`<br/>`SPECIALIST_PROCESS`<br/>`DOCUMENT` | YAML语义编辑 |
| **executeTextFileEdits** | document | Text Editing | `"prototype_designer"` | Text file editing (CSS/HTML/JS)<br/>**v3.0 new tool** |
| **syntax-checker** | document | Quality | `document_formatter` | 语法检查工具 |
| **traceability-completion-tool** | document | Quality | `document_formatter` | 追溯性同步工具 |

### Internal Layer 工具

| 工具名称 | 层级 | 分类 | 访问权限 | 说明 |
|---------|------|------|---------|------|
| **finalAnswer** | internal | System | `ORCHESTRATOR_TOOL_EXECUTION`<br/>`ORCHESTRATOR_KNOWLEDGE_QA` | 最终答案（仅orchestrator） |
| **getSystemStatus** | internal | System | `ORCHESTRATOR_TOOL_EXECUTION`<br/>`ORCHESTRATOR_KNOWLEDGE_QA` | 系统状态查询 |
| **createNewProjectFolder** | internal | Project | `project_initializer` | 创建新项目 |
| **recordThought** | internal | Thinking | `SPECIALIST_CONTENT`<br/>`SPECIALIST_PROCESS` | 思考记录 |
| **taskComplete** | internal | Task | `SPECIALIST_CONTENT`<br/>`SPECIALIST_PROCESS` | 任务完成 |

### 权限分配统计

| Caller Type | 可访问工具数 | 占比 |
|-------------|------------|------|
| **ORCHESTRATOR_TOOL_EXECUTION** | 9 | 26% |
| **ORCHESTRATOR_KNOWLEDGE_QA** | 14 | 41% |
| **SPECIALIST_CONTENT** | 11 | 32% |
| **SPECIALIST_PROCESS** | 14 | 41% |
| **DOCUMENT** | 16 | 47% |
| **INTERNAL** | 3 | 9% |

### 按风险等级分类

| 风险等级 | 工具数量 | 典型工具 |
|---------|---------|---------|
| **低风险（读操作）** | 11 | readFile, listFiles (重构), readMarkdownFile |
| **中等风险（写操作）** | 8 | writeFile, executeMarkdownEdits |
| **高风险（删除/移动）** | 3 | deleteFile, moveAndRenameFile |
| **系统关键** | 8 | finalAnswer, createNewProjectFolder |

### v3.0 个体级别控制示例

| 工具名称 | 访问权限（v3.0格式） | 说明 |
|---------|-------------------|------|
| **askQuestion** | `ORCHESTRATOR_KNOWLEDGE_QA`<br/>`SPECIALIST_PROCESS`<br/>`"overall_description_writer"` | 混合控制示例：<br/>类型+个体 |

**注**: 更多个体级别控制工具将在 prototype_designer 专用工具创建时添加。

## 📚 相关文档

- [工具注册表实现 (src/tools/index.ts)](../src/tools/index.ts)
- [访问控制器实现 (src/core/orchestrator/ToolAccessController.ts)](../src/core/orchestrator/ToolAccessController.ts)
- [Specialist 注册表 (src/core/specialistRegistry.ts)](../src/core/specialistRegistry.ts)
- [Orchestrator 规则 (rules/orchestrator.md)](../rules/orchestrator.md)  
- [Specialist 规则目录 (rules/specialists/)](../rules/specialists/)
- [v3.0 测试报告 (docs/TOOL_ACCESS_CONTROL_V3_TEST_REPORT.md)](./TOOL_ACCESS_CONTROL_V3_TEST_REPORT.md)

---

**文档状态**: 
- ✅ v2.0 已完成 - 分布式访问控制实现
- ✅ v3.0 已完成 - 混合访问控制（CallerType + CallerName）
- 📊 权限分配表 - 已更新（2025-10-02）
**下次审查**: 2025-Q1  
**维护者**: SRS Writer Plugin 架构团队 