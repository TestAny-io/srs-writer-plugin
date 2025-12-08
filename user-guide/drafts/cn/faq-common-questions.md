# 常见问题（FAQ）

> SRS Writer 的常见疑问与快速解答

---

## 安装与费用

### 我需要为 SRS Writer 付费吗？
- 插件本身是开源的（Apache-2.0）且目前是免费的。如有收费计划，会提前通知用户。
- 需要 **GitHub Copilot 订阅** 才能使用 AI（VS Code 的 Language Model API 仅对 Copilot 用户开放）。

### 为什么必须使用 GitHub Copilot？
- SRS Writer 通过 VS Code 内置的 LM API 调用模型，该接口绑定 Copilot 订阅。  
- 好处：无需自行管理 OpenAI/Anthropic 等密钥或额外计费。

### 可以离线使用吗？
- 生成/编辑需求依赖云端模型，**需联网**。  
- 离线时可阅读或手动修改文件，但 SRS Writer 的对话与工具不会工作。

### 支持哪些 VS Code 版本和依赖？
- VS Code **1.102.0+**。  
- Git 已安装（用于初始化仓库与分支）。  
- 建议保持 GitHub Copilot 登录状态。

---

## 使用与项目管理

### 如何查看当前项目？
- 查看状态栏：`SRS: <项目名>`。  
- 或打开 **SRS Writer: Control Panel** → 当前项目会显示在选项中。

### 手动编辑可以吗？
- 可以，文件是普通 Markdown/YAML。  
- 手改后建议在控制面板运行 **同步状态检查**，必要时执行 **Force Sync Context**，确保内存/会话与文件一致。

### 可以用于非软件项目吗？
- 可以，但需自行调整 `.templates/` 中的章节/措辞以匹配领域。

### 如何共享 SRS？
- 直接共享 `SRS.md`（Markdown 可在 VS Code / GitHub 直接预览）。  
- 需要 PDF 时，可用任意 Markdown→PDF 工具导出。  
- 不提供内置发布命令，建议通过 Git 仓库或团队文档平台分享。

---

## 协作与多项目

### 多人协作的推荐方式？
- 使用 Git 管理。默认工作分支为 `wip`，必要时将稳定版本合并到 `main`。  
- 每个项目独立目录；切换项目用控制面板的 **切换项目** 功能。  
- 工作流程示例：
  1. `git pull` 获取最新版本  
  2. 控制面板切换到目标项目  
  3. 通过聊天/手动编辑完成变更  
  4. `git add . && git commit ...`（在 `wip` 分支）  
  5. 推送并视需要合并到 `main`

### 可以同时处理多个项目吗？
- 可以。每个项目有独立的文件夹和会话文件；切换项目会重置聊天上下文并校验 `wip` 分支。  
- 避免手动重命名项目目录，使用控制面板的 **项目管理 → 重命名**。

---

[⬅️ 返回质量改进](scenario-quality-improvement.md) | [下一篇：错误与故障排除 ➡️](faq-error-messages.md)
