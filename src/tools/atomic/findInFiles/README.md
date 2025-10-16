# FindInFiles工具

强大的多文件搜索工具，灵感来源于Cursor的grep功能，提供简洁高效的跨文件内容搜索能力。

## 🎯 核心功能

- **多文件搜索** - 在整个项目baseDir中搜索内容
- **正则表达式支持** - 完整的JavaScript RegExp语法支持
- **灵活的文件过滤** - 支持glob模式和文件类型过滤
- **多种输出格式** - content/files/count三种输出模式
- **智能范围检测** - 自动检测搜索范围，无需复杂参数

## 📖 使用方法

### 基础搜索

```typescript
// 在整个项目中搜索
await findInFiles({pattern: "TODO"});

// 搜索特定目录
await findInFiles({pattern: "function", path: "src/"});

// 正则表达式搜索
await findInFiles({pattern: "function\\s+\\w+", regex: true});
```

### 文件过滤

```typescript
// 按文件类型过滤
await findInFiles({pattern: "class", type: "ts"});

// 按glob模式过滤
await findInFiles({pattern: "import", glob: "**/*.{js,ts}"});

// 搜索YAML配置文件
await findInFiles({pattern: "version", type: "yaml"});
```

### 输出模式

```typescript
// content模式：显示详细匹配内容（默认）
await findInFiles({
  pattern: "function", 
  outputMode: "content",
  context: 3  // 显示3行上下文
});

// files模式：只显示匹配的文件路径
await findInFiles({
  pattern: "TODO",
  outputMode: "files"
});

// count模式：显示每个文件的匹配数量
await findInFiles({
  pattern: "class.*extends",
  regex: true,
  outputMode: "count"
});
```

## 📊 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `pattern` | string | *必填* | 搜索模式（文本或正则） |
| `regex` | boolean | false | 是否使用正则表达式 |
| `caseSensitive` | boolean | false | 大小写敏感 |
| `path` | string | - | 文件或目录路径（相对于baseDir） |
| `glob` | string | - | 文件匹配模式 |
| `type` | string | - | 文件类型（js/ts/md/yaml/json/html/css） |
| `outputMode` | string | "content" | 输出格式（content/files/count） |
| `context` | number | 5 | 上下文行数（0-20） |
| `limit` | number | 100 | 最大结果数（1-1000） |

## 📤 输出格式

### Content模式
```json
{
  "success": true,
  "totalMatches": 3,
  "matches": [
    {
      "file": "src/main.ts",
      "line": 15,
      "text": "export function createApp() {",
      "context": [
        "import { Logger } from './logger';",
        "// App factory",
        "export function createApp() {",
        "  return new App();",
        "}"
      ]
    }
  ]
}
```

### Files模式
```json
{
  "success": true,
  "totalMatches": 5,
  "matches": [
    {"file": "src/main.ts"},
    {"file": "src/utils.ts"},
    {"file": "README.md"}
  ]
}
```

### Count模式
```json
{
  "success": true,
  "totalMatches": 8,
  "matches": [
    {"file": "src/main.ts", "count": 3},
    {"file": "src/utils.ts", "count": 2},
    {"file": "README.md", "count": 1}
  ]
}
```

## 🚨 错误处理

工具提供清晰的错误信息和解决建议：

```json
{
  "success": false,
  "error": "Invalid regex pattern: [unclosed",
  "errorType": "INVALID_REGEX",
  "suggestions": [
    "Try text search without regex",
    "Check regex syntax"
  ]
}
```

### 常见错误类型

- `INVALID_REGEX` - 正则表达式语法错误
- `PATH_NOT_FOUND` - 指定路径不存在
- `PERMISSION_DENIED` - 文件权限不足
- `WORKSPACE_ERROR` - 工作空间不可用
- `SEARCH_ERROR` - 一般搜索错误

## 🎯 使用场景

### 1. Content Specialist 分析项目
```typescript
// 查找所有需求ID引用
await findInFiles({
  pattern: "(FR|UC|US|NFR)-\\d+",
  regex: true,
  outputMode: "files"
});

// 查找待办事项
await findInFiles({
  pattern: "TODO|FIXME",
  regex: true,
  type: "md"
});
```

### 2. Process Specialist 质量检查
```typescript
// 查找代码质量标记
await findInFiles({
  pattern: "HACK|FIXME|XXX|BUG",
  regex: true
});

// 检查配置一致性
await findInFiles({
  pattern: "version",
  type: "json"
});
```

### 3. 代码结构分析
```typescript
// 查找所有导出的函数
await findInFiles({
  pattern: "export\\s+function\\s+\\w+",
  regex: true,
  type: "ts",
  outputMode: "count"
});

// 查找类继承关系
await findInFiles({
  pattern: "class\\s+(\\w+)\\s+extends\\s+(\\w+)",
  regex: true,
  context: 5
});
```

## ⚡ 性能特性

- **适中性能** - 针对中小型项目优化（10-1000文件）
- **批处理** - 50文件批次的并行处理
- **大文件跳过** - 自动跳过超过10MB的文件
- **智能忽略** - 自动遵守.gitignore和.cursorignore规则

## 🔗 工具集成

findInFiles与其他工具完美配合：

```typescript
// 与enhanced-readfile-tools结合
const searchResult = await findInFiles({pattern: "FR-001", outputMode: "files"});
for (const file of searchResult.matches) {
  const docStructure = await readMarkdownFile({path: file.file, parseMode: "toc"});
  // 分析文档结构...
}

// 与listAllFiles结合
const allFiles = await listAllFiles({searchKeywords: ["requirements"]});
const searchResults = await findInFiles({
  pattern: "priority.*high",
  regex: true,
  path: allFiles.structure.paths[0]
});
```

## 🛠️ 技术架构

```
FindInFiles工具架构：
├── FindInFilesEngine          # 主协调引擎
├── StandardMultiFileSearchEngine  # 多文件搜索执行器
├── PatternMatcher            # 正则和文本匹配器
├── FileScanner              # 文件发现和过滤器
├── ResultFormatter          # 结果格式化器
└── SimpleErrorHandler       # 错误处理器
```

## 🎯 与Cursor对比

| 特性 | Cursor grep | FindInFiles |
|------|-------------|-------------|
| **搜索范围** | 整个工作空间 | 项目baseDir（更精确） |
| **参数风格** | 简洁命令行风格 | JSON对象风格（易于程序使用） |
| **输出格式** | 文本格式 | 结构化JSON |
| **错误处理** | 命令行错误 | 结构化错误+建议 |
| **集成性** | 独立工具 | 深度集成现有工具生态 |

## 📋 最佳实践

1. **选择合适的输出模式**
   - 需要详细内容时使用 `content` 模式
   - 只关心哪些文件匹配时使用 `files` 模式
   - 进行统计分析时使用 `count` 模式

2. **优化搜索性能**
   - 使用 `path` 参数缩小搜索范围
   - 使用 `type` 或 `glob` 过滤无关文件
   - 设置合理的 `limit` 避免结果过多

3. **正则表达式使用**
   - 简单文本搜索时不启用 `regex`
   - 复杂模式匹配时使用 `regex: true`
   - 注意JavaScript RegExp的语法规则

4. **错误处理**
   - 检查 `success` 字段判断执行状态
   - 利用 `suggestions` 字段获取解决建议
   - 根据 `errorType` 进行分类处理
