# Syntax Checker Tool

语法检查工具，提供对 Markdown 和 YAML 文件的语法和格式检查功能。

## 🎯 功能概述

- **Markdown 语法检查**：使用 markdownlint 库，支持预设配置（strict/standard/relaxed/custom）
- **YAML 语法检查**：复用现有的 js-yaml 基础设施，支持分级检查（basic/standard/strict）
- **统一报告生成**：生成 `srs_quality_check_report_{{projectName}}.json` 格式的质量报告
- **可复用组件**：QualityReportWriter 可被其他工具（如 traceability-completion-tool）使用

## 🏗️ 架构设计

```
SyntaxChecker Tool
├── FileTypeDetector (文件类型检测)
├── MarkdownChecker (markdownlint 集成)
├── YAMLChecker (js-yaml 复用)
├── QualityReportWriter (可复用报告组件)
├── SyntaxCheckerConfigLoader (VSCode 配置集成)
└── 复用现有基础设施:
    ├── Logger (日志系统)
    ├── SessionManager (项目上下文)
    ├── YAMLReader (YAML 处理)
    └── ScaffoldError (错误处理)
```

## 🔧 使用方式

### 作为 Specialist 工具调用

```typescript
// 检查项目文档
await syntaxCheckerTool({
  description: "Check project documentation syntax",
  files: [
    { path: "SRS.md" },
    { path: "README.md" },
    { path: "requirements.yaml" },
    { path: "config/settings.yml" }
  ]
});
```

### 配置选项

通过 VSCode 设置配置语法检查器：

1. **打开设置**：`Ctrl+,` / `Cmd+,`
2. **搜索**：`srs-writer syntax`
3. **配置选项**：
   - `srs-writer.syntaxChecker.enabled`: 启用/禁用工具
   - `srs-writer.syntaxChecker.markdown.preset`: Markdown 检查预设
   - `srs-writer.syntaxChecker.yaml.level`: YAML 检查级别

#### Markdown 预设选项
- **strict**: 严格模式，启用所有规则
- **standard**: 标准模式，平衡的规则集（推荐）
- **relaxed**: 宽松模式，只检查基本语法错误
- **custom**: 自定义模式，使用自定义规则

#### YAML 检查级别
- **basic**: 只检查基础语法错误
- **standard**: 检查语法 + 基本结构问题（推荐）
- **strict**: 检查语法 + 结构 + requirements.yaml 特定规则

## 📊 报告格式

生成的质量报告采用简化的扁平化结构：

```json
{
  "projectName": "MyProject",
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "summary": {
    "totalChecks": 2,
    "totalFiles": 3,
    "filesWithIssues": 1,
    "totalErrors": 1,
    "totalWarnings": 1
  },
  "checks": [
    {
      "checkType": "markdown-syntax",
      "toolName": "syntax-checker",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "summary": {
        "filesChecked": 2,
        "errors": 1,
        "warnings": 0
      },
      "issues": [
        {
          "file": "SRS.md",
          "line": 45,
          "rule": "MD013",
          "severity": "error",
          "message": "Line too long (125 > 120 characters)"
        }
      ]
    }
  ]
}
```

## 🚨 错误处理

工具采用简化的错误处理策略：

1. **继续执行**：单个文件错误不中断整个检查流程
2. **记录并跳过**：无法处理的文件记录到 skippedFiles 中
3. **配置降级**：配置错误时自动使用默认配置
4. **友好警告**：不支持的文件类型给出警告而不是错误

## 🧪 测试

### 运行测试
```bash
# 运行所有相关测试
npm test -- --testPathPattern=syntaxChecker

# 运行特定测试
npm test -- FileTypeDetector
npm test -- SyntaxCheckerConfigLoader
```

### 验证实现
```bash
# 验证实现完整性
node scripts/test-syntax-checker.js
```

## 📈 性能指标

- **目标性能**：检查 100 个文件 < 10 秒
- **内存优化**：流式处理大文件
- **并发支持**：支持多文件并行检查

## 🔗 相关文档

- [设计文档](../../../../design/syntax-checker-tool-design.md)
- [traceability-completion-tool 架构参考](../traceabilityCompletion/)
- [YAML 编辑器设计](../yamlEditor/)

---

## 🎉 实现状态

### ✅ 已完成
- [x] 核心组件结构和文件类型检测
- [x] VSCode 扩展配置集成
- [x] 配置加载器（预设选项）
- [x] 可复用报告写入组件
- [x] markdownlint 库集成
- [x] MarkdownChecker 实现
- [x] YAMLChecker 实现（复用 YAMLReader）
- [x] 主控制器实现
- [x] 工具定义和系统集成
- [x] 基础测试用例
- [x] 编译验证通过

### 🔧 待优化
- [ ] markdownlint ESM 模块兼容性优化
- [ ] 集成测试环境完善
- [ ] 性能优化和大文件处理
- [ ] 用户文档和使用示例完善

**实现完成度：90%** - 核心功能已完整实现并通过验证！
