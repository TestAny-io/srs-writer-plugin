# 创建第一个需求文档

> **所需时间**：约 10 分钟  
> **目标**：用一次对话生成完整的需求工件包

---

## 概览

你将通过聊天召唤 `@srs-writer`，让编排器规划并执行一个自动化流程：创建项目目录、生成 `SRS.md`、`requirements.yaml`、`prototype/`，并给出质量建议。无需记忆命令，只需像对同事描述项目一样输入需求。

---

## 步骤 1：打开聊天面板

- macOS：`Cmd+Shift+I`
- Windows/Linux：`Ctrl+Shift+I`

或点击 VS Code 右上角的聊天图标。

---

## 步骤 2：描述你的项目

在输入框输入 `@srs-writer` 开头的消息。

**示例（全新项目）**
```
@srs-writer 需要一个任务管理系统：创建任务、指派成员、
设置截止日期、评论、邮件通知，团队规模 20 人。
```

**示例（基于现有草稿）**
```
@srs-writer 基于 ./drafts/task-app.md 生成正式 SRS，
保留已有用例，补齐非功能和接口要求。
```

> 💡 多给上下文、多给约束，能减少补问并提高质量。

---

## 步骤 3：等待计划与执行

发送后，编排器会：
1) 判定是新建还是改造；2) 生成执行计划；3) 调用 specialist。

常见输出（片段）：
```
🎯 Orchestrator  -> 生成执行计划（plan execution）
📁 project_initializer  -> 创建项目目录、基础文件、切换到 wip 分支
📝 summary_writer / fr_writer / nfr_writer ... -> 逐章写入 SRS.md
✅ srs_reviewer  -> 质量审查与改进建议
```

耗时参考：小型项目 5-10 分钟，中型项目 10-20 分钟。

---

## 步骤 4：查看生成的文件

在当前工作区根目录下，会新建一个项目目录（名称由对话确定）：

```
<workspace>/<projectName>/
├── SRS.md                  # 需求文档（Markdown）
├── requirements.yaml       # 结构化需求（含 FR/NFR/IFR/DAR 等 ID）
└── prototype/              # 原型骨架
    ├── index.html
    ├── theme.css
    └── interactions.js

.session-log/               # 工作区根目录，存放会话文件
```

### `SRS.md`
- 章节来自 `.templates/`，遵循 IEEE 830 结构  
- 内容 specialist 覆盖：摘要、总体描述、用户旅程/用例、功能需求、非功能、接口、数据、风险/约束、原型概览等

### `requirements.yaml`
- 结构化需求，包含实体 ID（如 FR-001、NFR-001、UC-001 等）
- 用于追踪矩阵、自动校验、后续迭代

### `prototype/`
- 基础 HTML/CSS/JS 骨架，便于快速预览 UI 思路

> 质量审查结果由 `srs_reviewer` 在对话中给出（非单独文件），必要时会直接修正文档或给出改进清单。

---

## 进一步迭代

### 补充或修改需求
```
@srs-writer 增加“任务附件上传”，限制 20MB，保留 30 天后自动清理。
```

### 澄清模糊项
```
@srs-writer “通知策略”写得太笼统，请细化触发条件、渠道和频率。
```

### 重新跑质量检查
```
@srs-writer 再做一轮质量审查，按严重度列出需要修改的章节并直接修复。
```

> SRS Writer 会使用语义编辑器（SID 定位）安全更新 `SRS.md` 与 `requirements.yaml`。

---

## 常见问题

- **文件没生成在哪？**  
  检查是否在初始化的工作区执行；项目目录位于工作区根目录下，`.session-log/` 也在根目录。

- **想改项目名或删除项目？**  
  打开 **SRS Writer: Control Panel** → Project Management（重命名会同步目录与会话文件，删除会移到回收站并切换回主会话）。

- **Git 分支不一致？**  
  Control Panel 中的 **Sync Status Check** 或 **Force Sync Context** 可检查/修复，默认工作分支为 `wip`。

---

## 获得更好结果的小贴士

- 提前说明目标受众（客户提案 vs 内部开发）和关键约束（合规、性能、集成范围）。
- 有草稿/笔记就粘贴，路径引用使用相对路径（如 `./docs/draft.md`）。
- 一次只提出一组明确的修改点，减少歧义。

---

[⬅️ 返回首页](home.md) | [下一篇：文档结构与示例 ➡️](getting-started-document-structure.md)
