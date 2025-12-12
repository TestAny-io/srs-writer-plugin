# 使用控制面板

> **场景**：用可视化菜单访问插件的核心功能  
> **耗时**：每个操作 1-2 分钟

---

## 控制面板是什么

`SRS Writer: Control Panel` 是插件的指挥中心，可快速执行：
- 创建/初始化工作区
- 切换或管理项目
- 查看同步状态
- 管理 MCP 工具
- 打开插件设置

---

## 如何打开

1. `Cmd+Shift+P` / `Ctrl+Shift+P` 打开命令面板  
2. 输入并选择 **SRS Writer: Control Panel**
![srs命令行配置](../images/zh/image-20251210-132901_0001.png)
- 或者在VS Code界面的右下角，点击**SRS Writer**，弹出对话框
![srs面板](../images/zh/image-20251210-130301_0001.png)

> 小贴士：可在键盘快捷键中为该命令绑定自定义按键；状态栏的 **SRS: ...** 也可点击打开（如果显示）。

---

## 面板选项与作用

```
📁 创建工作区并初始化   → 复制模板、初始化 Git、创建 .session-log/
🔄 切换项目            → 载入其他项目的会话与上下文
📂 项目管理            → 重命名 / 删除当前项目
✓ 同步状态检查        → 检查文件、会话、Git 状态
🔧 MCP 工具管理        → 查看 / 过滤 / 重载 MCP 工具
⚙️ 插件设置            → 打开 SRS Writer 设置页
```

下面逐项说明。
![srs配置目录1](../images/zh/image-20251210-133501_0001.png)
---

### 📁 创建工作区并初始化

- 复制 `.templates/` 到新工作区  
- 生成 `.vscode/settings.json`（随扩展打包）  
- 初始化 Git：`main` 分支、`.gitignore`、初始提交、`wip` 工作分支  
- 创建 `.session-log/` 及主会话文件 `srs-writer-session_main.json`  
- 自动打开新工作区

使用时选择父目录并输入工作区名（字母/数字/`-`/`_`）。完成后即可在该工作区内开始创建项目。

---

### 🔄 切换项目

- 列出 `.session-log/` 中的项目会话并校验目录有效性  
- 若有执行中的计划，会提示停止后再切换  
- 切换时会保存当前会话、加载目标会话、清理聊天上下文，并确保工作分支为 `wip`

> 仅显示当前打开工作区内的项目；若目录缺失会给出修复提示。

---

### 📂 项目管理

**重命名项目**
- 原子更新：项目名、项目目录、会话文件路径、`baseDir`  
- 仅允许字母/数字/`-`/`_`，且不会覆盖已有目录/会话

**删除项目**
- 将当前项目的会话文件和项目目录移至回收站（VS Code `useTrash`）  
- 切换回主会话（workspace 根目录，Git 默认 `main`）  
- 需要在当前工作区且路径合法

---

### ✓ 同步状态检查

检查当前项目的：
- 会话状态（`baseDir`、会话文件存在性）
- 文件状态（如 `SRS.md`、`requirements.yaml` 是否可读）
- Git 分支信息（是否在 `wip` 等）

若发现不一致，会提示使用 **Force Sync Context**（命令面板）或切换项目以修复。

---

### 🔧 MCP 工具管理

- **查看工具状态**：显示已注册工具数量、来源（VS Code/MCP）、当前排除关键词；可打开用户级 `mcp.json`  
- **管理排除关键词**：添加/删除关键字以过滤不需要的 MCP 工具（大小写不敏感）  
- **重新加载工具**：注销后按当前排除规则重新注册所有工具

---

### ⚙️ 插件设置

打开已过滤到 SRS Writer 的 VS Code 设置，常用项：
- `srs-writer.projectSwitching.excludeDirectories`：项目选择时忽略的目录名
- `srs-writer.mcp.excludeKeywords`：排除 MCP 工具的关键词
- `srs-writer.syntaxChecker.*`：Markdown/YAML 语法检查开关与模式（basic/standard/strict）
- `srs-writer.rag.enterprise.*`：企业 RAG 连接配置（可选）

---

## 常见工作流

### 首次上手
1. 打开控制面板 → **创建工作区并初始化**
![srs配置目录1](../images/zh/image-20251210-133501_0001.png)
2. 选择父目录并输入工作区名
3. 工作区打开后在聊天中开始项目：`@srs-writer ...`

### 在项目间切换
1. 打开控制面板 → **切换项目（Switch Project）**  
2. 选择目标项目，确认停止当前执行（如有）
3. 等待提示“已切换到 wip 分支”

### 修复不同步
1. 控制面板 → **同步状态检查（Sync Status Check）**
2. 如有问题，选择 **Force Sync Context**（命令面板）或切换项目再切回

