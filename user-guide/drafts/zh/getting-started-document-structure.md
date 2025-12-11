# 理解生成的文档结构

> **目的**：知道每个文件的作用、放在哪里，以及它们如何协同工作

---

## 总览

当你启动一个新项目时，SRS Writer 会在工作区根目录下创建一个项目文件夹，并生成以下内容：

```
<workspace>/<projectName>/
├── SRS.md                  # 人类可读的需求文档（Markdown）
├── requirements.yaml       # 结构化需求，含实体 ID 和关系
└── prototype/              # 原型骨架（HTML/CSS/JS）
    ├── index.html
    ├── theme.css
    └── interactions.js

.session-log/               # 位于工作区根目录（请勿手动编辑）
└── srs-writer-session_*.json
```

![image-20251211-215721.png](../images/zh/image-20251211-215721_00000001.jpg)

---

## 📄 SRS.md（主文档）

- **格式**：Markdown，遵循 `.templates/` 中的章节模板，对齐 IEEE 830 思路  
- **内容覆盖**：摘要、总体描述、用户旅程/用例、功能需求（FR）、非功能需求（NFR）、接口/数据（IFR/DAR）、风险与约束、原型概览等  
- **编号与追踪**：实体 ID（如 FR-001、NFR-001、UC-001）在此出现，与 `requirements.yaml` 对应  
- **质量与校验**：`srs_reviewer` 的改进建议通常直接在对话中给出，并可能自动修改文档

> 在 VS Code 中直接阅读/评论；需要导出时，可用 VS Code 的 Markdown 导出插件或复制为 PDF。

---

## 📊 requirements.yaml（结构化需求）

- **作用**：以机器可读的方式存储同一批需求，便于追溯、比对和自动校验  
- **主要字段**（示例）：
  ```yaml
  functionalRequirements:
    - id: FR-001
      title: 用户认证
      description: 用户必须能注册/登录
      priority: High
      status: Draft
      relatedTo:
        - type: derives_from
          id: UC-001   # 关联的用例
  nonFunctionalRequirements:
    - id: NFR-001
      category: Performance
      requirement: 95% 请求 < 500ms
  interfaceRequirements:
    - id: IFR-001
      api: POST /api/tasks
  dataRequirements:
    - id: DAR-001
      entity: Task
      fields:
        - name: title
          type: string
          required: true
  ```
- **校验**：`syntaxChecker` 支持 basic/standard/strict 模式；Schema 位于 `config/schemas/requirement-entity-schemas.yaml`
- **编辑建议**：如需手动改动，保持 ID 稳定；更安全的方式是通过对话让 SRS Writer 使用 YAML 编辑工具更新

---

## 🎨 prototype/（原型骨架）

- `index.html` / `theme.css` / `interactions.js` 三个文件组成的简版原型
- 由 `prototype_designer` specialist 生成，便于快速传达交互思路
- 你可以直接在 VS Code 中预览或继续完善样式/交互

---

## 🗂️ .session-log/（会话文件）

- 位置：工作区根目录，不在项目目录内
- 作用：记录当前会话、项目切换、同步状态等
- 注意：不要手动编辑；如需重命名/删除项目，请通过 Control Panel → Project Management
![image-20251211-215721.gif](../images/zh/image-20251211-215721_00000002.gif)

---

## 文件如何协同

- `SRS.md` 为人类阅读，`requirements.yaml` 为机器理解，两者的 ID 和内容保持同步。
- 变更通过语义编辑器完成：SRS Writer 使用 SID 定位和 YAML key-path 操作，尽量避免误改。
- 质量审查（`srs_reviewer`）的反馈会直接作用在 `SRS.md`/`requirements.yaml`，或在对话中列出需要调整的章节。

---

## 安全修改的最佳实践

- **新增/修改需求**：在聊天中说明修改点，交给 SRS Writer 处理；避免直接手改大量片段。
- **保持 ID 稳定**：ID（FR/NFR/IFR/DAR/UC 等）是追踪关系的锚点，不建议随意重编号。
- **查看 diff**：使用 VS Code 的源代码管理或 `git diff` 检查变更，确认后再提交。

---

[⬅️ 上一篇：创建第一个文档](getting-started-first-document.md) | [下一篇：对话与提示词技巧 ➡️](getting-started-conversation-tips.md)
