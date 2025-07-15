# 统一会话管理工具 (sessionManagementTools)

## 📋 概述

`sessionManagementTools` 是SRS Writer插件的**Internal层**核心工具，负责管理项目会话状态和操作日志记录。它解决了之前**会话概念混乱**的问题，通过明确分离两个概念：

1. **SessionContext (内存)** - 项目状态快照，按项目分组
2. **srs-writer-session.json (文件)** - 操作流水账，按时间分片

## 🔄 架构设计 - Atomic层工具复用

本工具采用**分层复用**设计，充分利用atomic层的文件操作工具：

### **复用的Atomic层工具**

- `readFile()` - 文件读取操作
- `writeFile()` - 文件写入操作  
- `createDirectory()` - 目录创建操作
- `renameFile()` - 文件移动/重命名操作
- `listFiles()` - 目录内容列表
- `listAllFiles()` - 所有文件列表

### **路径管理策略**

- **统一使用相对路径** - 所有文件路径都相对于workspace根目录
- **标准化路径格式** - `.vscode/srs-writer-session.json` 和 `.vscode/session-archives/`

## 🏗️ 架构设计

### 核心概念分离

```text
SessionContext (内存对象)              srs-writer-session.json (文件)
├─ sessionContextId: UUID              ├─ fileVersion: "1.0"  
├─ projectName: string                 ├─ timeRange: { start, end }
├─ baseDir: string                     ├─ operations: OperationLogEntry[]
├─ activeFiles: string[]               ├─ createdAt: timestamp
└─ metadata: { created, version... }   └─ lastUpdated: timestamp
     ↑                                      ↑
按【项目】分组，一个项目一个ID            按【时间】分片，每15天一个文件
生命周期：项目存在期间                    生命周期：15天后自动归档
```

### 文件管理策略

```text
.vscode/                             # 相对于workspace根目录
├─ srs-writer-session.json           # 当前15天的操作日志
└─ session-archives/                 # 归档目录
   ├─ srs-writer-session-20241201-20241215.json
   ├─ srs-writer-session-20241216-20241230.json
   └─ ...
```

### **实现特色**

- **🔗 原子操作复用** - 所有文件操作都通过atomic层工具进行，确保错误处理和权限控制一致
- **📁 相对路径设计** - 避免绝对路径依赖，提高可移植性
- **🛡️ 统一错误处理** - 利用atomic层的标准化错误格式 `{success, content?, error?}`
- **📊 操作审计** - 每次文件操作都有atomic层的自动日志记录

## 🔧 核心功能

### 1. 项目状态管理

```typescript
// 获取或创建项目会话上下文
const sessionContext = await getOrCreateSessionContext(projectName);

// 更新项目状态
await updateSessionContext(sessionContextId, {
    activeFiles: ['SRS.md', 'requirements.json'],
    metadata: { srsVersion: 'v1.1' }
});
```

### 2. 操作日志记录

```typescript
// 记录工具执行日志（所有specialist工具必须调用）
await updateWriterSession({
    sessionContextId: session.sessionContextId,
    toolName: 'createComprehensiveSRS',
    operation: 'Created SRS document for project: MyApp',
    targetFiles: ['SRS.md'],
    userInput: '用户想创建一个记录液体摄入量的webapp',
    success: true,
    executionTime: 2500
});
```

### 3. 自动归档机制

```typescript
// 检查并执行15天归档（自动调用）
await archiveSessionLogIfNeeded();

// 手动归档
await archiveCurrentLogFile();
```

### 4. 历史查询

```typescript
// 获取指定项目的操作历史
const history = await getOperationHistory(sessionContextId, {
    startDate: '2024-12-01',
    endDate: '2024-12-15'
});
```

## 📝 数据Schema

### SessionContext接口

```typescript
interface SessionContext {
  sessionContextId: string;        // 项目唯一标识符 (UUID)
  projectName: string | null;
  baseDir: string | null;
  activeFiles: string[];
  metadata: {
    srsVersion: string;            // SRS文档版本号
    created: string;               // ISO 8601时间戳
    lastModified: string;          // ISO 8601时间戳
    version: string;               // 会话格式版本号
  };
}
```

### OperationLogEntry接口

```typescript
interface OperationLogEntry {
  timestamp: string;               // ISO 8601时间戳
  sessionContextId: string;        // 关联的项目ID
  toolName: string;                // specialist工具名称
  operation: string;               // 具体操作描述
  targetFiles: string[];           // 操作的文件列表
  success: boolean;                // 执行是否成功
  userInput?: string;              // 触发操作的用户输入
  executionTime?: number;          // 执行耗时(ms)
  error?: string;                  // 如果失败，记录错误信息
}
```

### SessionLogFile接口

```typescript
interface SessionLogFile {
  fileVersion: string;             // 文件格式版本
  timeRange: {
    startDate: string;             // 文件覆盖的开始日期
    endDate: string;               // 文件覆盖的结束日期
  };
  operations: OperationLogEntry[]; // 操作记录数组
  createdAt: string;               // 文件创建时间
  lastUpdated: string;             // 最后更新时间
}
```

## 🚀 在Specialist工具中的使用

### 标准封装模式

所有specialist层工具都应该按照以下模式封装sessionManagementTools：

```typescript
// DEPRECATED: createComprehensiveSRS has been removed
export async function createComprehensiveSRS_deprecated(args: any) {
    const startTime = Date.now();
    
    try {
        // 1. 获取或创建会话上下文
        const sessionContext = await getOrCreateSessionContext(args.projectName);
        
        // 2. 执行实际的SRS创建逻辑
        const result = await actualSRSCreation(args);
        
        // 3. 记录成功操作日志
        await updateWriterSession({
            sessionContextId: sessionContext.sessionContextId,
            toolName: 'createComprehensiveSRS',
            operation: `Created SRS document for project: ${args.projectName}`,
            targetFiles: ['SRS.md'],
            userInput: args.userInput,
            success: true,
            executionTime: Date.now() - startTime
        });
        
        return result;
        
    } catch (error) {
        // 4. 记录失败操作日志
        await updateWriterSession({
            sessionContextId: sessionContext?.sessionContextId || 'unknown',
            toolName: 'createComprehensiveSRS',
            operation: `Failed to create SRS: ${error.message}`,
            targetFiles: [],
            userInput: args.userInput,
            success: false,
            error: error.message,
            executionTime: Date.now() - startTime
        });
        
        throw error;
    }
}
```

## ⚡ 自动化特性

### 1. 兼容性处理

- 自动为现有会话生成`sessionContextId`
- 向后兼容旧的SessionContext格式

### 2. 错误恢复

- JSON解析失败时自动创建新的日志文件
- 空文件检测和清理

### 3. 15天自动归档

- 每次`updateWriterSession`调用时自动检查归档条件
- 超过15天自动移动到归档目录
- 保持文件命名一致性：`srs-writer-session-YYYYMMDD-YYYYMMDD.json`

## 🔒 数据一致性保证

### Schema一致性

- 无论从内存还是文件读取，数据结构完全一致
- 统一的验证和转换逻辑

### 操作原子性

- 日志记录失败不影响主要工具功能
- 归档过程中的错误处理和回滚

### 并发安全

- 文件操作的适当同步机制
- 观察者模式确保状态一致性

## 🐛 常见问题

### Q: 如果srs-writer-session.json损坏怎么办？

A: 工具会自动检测并创建新的日志文件，记录错误信息到日志。

### Q: 15天归档会丢失数据吗？

A: 不会，所有数据都移动到`session-archives`目录，可以通过`getOperationHistory`查询。

### Q: 多个项目的日志会混在一起吗？

A: 是的，这是设计特性。一个日志文件记录多个项目的操作，通过`sessionContextId`区分。

### Q: 如何查看某个项目的完整历史？

A: 使用`getOperationHistory(sessionContextId)`，它会自动搜索当前文件和归档文件。

## 📈 性能考虑

- 日志文件大小控制（15天一个文件）
- 懒加载归档文件（仅在需要时读取）
- 内存中SessionContext缓存
- 异步文件操作避免阻塞UI
