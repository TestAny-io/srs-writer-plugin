# SyntaxChecker 配置指南

## 🎛️ 配置界面访问

### 方法1: 通过设置搜索
1. 打开 VSCode 设置：`Ctrl+,` / `Cmd+,`
2. 搜索：`srs-writer syntax`
3. 找到 "SRS Writer › Syntax Checker" 配置组

### 方法2: 通过扩展管理
1. 打开扩展面板：`Ctrl+Shift+X` / `Cmd+Shift+X`
2. 搜索 "SRS Writer"
3. 点击扩展右下角的齿轮图标 → "扩展设置"

## 🔧 配置选项详解

### 基础配置

#### `SRS Writer › Syntax Checker: Enabled`
- **类型**: 复选框
- **默认**: ☑ 启用
- **说明**: 控制整个语法检查工具的启用/禁用

#### `SRS Writer › Syntax Checker › Markdown: Enabled`  
- **类型**: 复选框
- **默认**: ☑ 启用
- **说明**: 控制 Markdown 文件的语法检查

#### `SRS Writer › Syntax Checker › Markdown: Preset`
- **类型**: 下拉选择
- **选项**: Standard（推荐）, Strict, Relaxed, Custom
- **说明**: 选择预设的检查规则集

### 详细规则配置（仅在选择 Custom 预设时显示）

#### MD007: 无序列表缩进
- **`MD007: 无序列表缩进检查`**: ☑ 启用（复选框）
- **`MD007: 无序列表缩进空格数`**: `4` 空格（数字输入，范围 1-8）

#### MD013: 行长度限制  
- **`MD013: 行长度限制检查`**: ☑ 启用（复选框）
- **`MD013: 最大行长度`**: `120` 字符（数字输入，范围 80-200）

#### MD022: 标题空行
- **`MD022: 标题周围需要空行`**: ☑ 启用（复选框）

#### MD025: 多个一级标题
- **`MD025: 禁止多个一级标题`**: ☐ 禁用（复选框）
- **说明**: SRS 文档通常需要多个一级标题，建议禁用

#### MD033: HTML 元素
- **`MD033: HTML 元素检查`**: ☑ 启用（复选框）
- **`MD033: 允许的 HTML 元素列表`**: `["br", "details", "summary"]`（数组输入）

#### MD041: 文件开头标题
- **`MD041: 文件开头必须是标题`**: ☐ 禁用（复选框）
- **说明**: SRS 文档可能有元数据块，建议禁用

#### MD046: 代码块样式
- **`MD046: 代码块样式一致性`**: ☐ 禁用（复选框）
- **说明**: SRS 文档通常混用围栏式和缩进式代码块

### YAML 配置

#### `SRS Writer › Syntax Checker › YAML: Enabled`
- **类型**: 复选框  
- **默认**: ☑ 启用

#### `SRS Writer › Syntax Checker › YAML: Level`
- **类型**: 下拉选择
- **选项**: Standard（推荐）, Basic, Strict
- **说明**: 
  - **Basic**: 只检查基础语法错误
  - **Standard**: 检查语法 + 基本结构问题
  - **Strict**: 检查语法 + 结构 + requirements.yaml 特定规则

## 🎯 推荐配置

### 新手用户（使用预设）
```json
{
  "srs-writer.syntaxChecker.enabled": true,
  "srs-writer.syntaxChecker.markdown.enabled": true,
  "srs-writer.syntaxChecker.markdown.preset": "standard",
  "srs-writer.syntaxChecker.yaml.enabled": true,
  "srs-writer.syntaxChecker.yaml.level": "standard"
}
```

### 高级用户（自定义规则）
```json
{
  "srs-writer.syntaxChecker.markdown.preset": "custom",
  "srs-writer.syntaxChecker.markdown.rules.MD007.enabled": true,
  "srs-writer.syntaxChecker.markdown.rules.MD007.indent": 2,
  "srs-writer.syntaxChecker.markdown.rules.MD013.enabled": true,
  "srs-writer.syntaxChecker.markdown.rules.MD013.lineLength": 100,
  "srs-writer.syntaxChecker.markdown.rules.MD025.enabled": false,
  "srs-writer.syntaxChecker.markdown.rules.MD033.allowedElements": ["br", "details", "summary", "img"]
}
```

### 专家用户（完全自定义）
```json
{
  "srs-writer.syntaxChecker.markdown.preset": "custom",
  "srs-writer.syntaxChecker.markdown.customRules": {
    "MD013": { "line_length": 100, "code_blocks": false },
    "MD024": { "allow_different_nesting": true },
    "MD025": false,
    "MD026": false,
    "MD046": { "style": "fenced" }
  }
}
```

## 🔄 配置优先级

配置按以下优先级生效：

1. **最高优先级**: `customRules`（JSON 对象）
2. **中等优先级**: 单项规则配置（MD007.enabled 等）
3. **低优先级**: 预设配置（standard/strict/relaxed）
4. **默认优先级**: 系统默认配置

## 🧪 配置测试

### 测试配置是否生效
1. 修改配置后保存
2. 调用 syntax-checker 工具
3. 检查生成的质量报告
4. 验证规则是否按预期工作

### 常见配置示例

#### 宽松检查（适合草稿阶段）
- Preset: `relaxed`
- 或自定义禁用严格规则

#### 严格检查（适合发布前）
- Preset: `strict`
- 或自定义启用所有规则

#### SRS 专用配置（推荐）
- Preset: `custom`
- 禁用 MD025（允许多个一级标题）
- 禁用 MD041（允许元数据块）
- 行长度: 120字符
- 允许常用 HTML 元素

## 📱 移动端适配

配置同时适用于：
- **桌面版 VSCode**
- **VSCode Web 版**
- **工作区级配置**（.vscode/settings.json）
- **用户级配置**（全局设置）

---

**配置完成后，重新加载 VSCode 或重启扩展以使配置生效。**
