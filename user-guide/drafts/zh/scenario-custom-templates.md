# 自定义章节模板

> **场景**：你希望 SRS Writer 按照你们组织特定的格式和结构生成文档
> **所需时间**：首次配置 15-30 分钟

---

## 为什么需要自定义模板？

SRS Writer 使用**章节模板**来指导 AI 生成结构化内容。模板定义了：
- 章节标题和层级结构
- 每种需求类型的必需字段
- ID 命名规范（FR-XXX-001、US-XXX-001 等）
- 追溯矩阵的格式
- 验收标准的结构

**默认模板**遵循 IEEE 830 标准，但你可以自定义它们以匹配：
- 你公司的文档标准
- 行业特定的合规要求（HIPAA、SOC 2 等）
- 团队对需求结构的偏好
- 本地化格式（不同语言、日期格式等）

---

## 模板工作原理

### 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    你的 VSCode 设置                          │
│  srs-writer.templates.frWriter.FR_WRITER_TEMPLATE = "..."   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      模板加载                                │
│  SRS Writer 读取你的自定义模板文件                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AI Prompt 组装                            │
│  模板注入到 "TEMPLATE FOR YOUR CHAPTERS" 部分                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      内容生成                                │
│  AI 按照你的模板结构生成内容                                  │
└─────────────────────────────────────────────────────────────┘
```

### 核心概念：模板变量

每个 Specialist 有一个以 `_TEMPLATE` 结尾的**模板变量**：
- `FR_WRITER_TEMPLATE` - 功能需求
- `USER_STORY_WRITER_TEMPLATE` - 用户故事
- `NFR_WRITER_TEMPLATE` - 非功能需求
- 等等...

系统自动检测以 `_TEMPLATE` 结尾的变量，并将其内容注入到 AI prompt 中。

---

## 支持的 Specialist

**只有内容型 Specialist 支持自定义模板。** 这些是负责编写 SRS 文档特定章节的 Specialist。

| Specialist | 配置键 | 模板变量 | 默认模板路径 |
|------------|--------|----------|-------------|
| 功能需求 | `frWriter` | `FR_WRITER_TEMPLATE` | `.templates/functional_requirements/functional_requirement_template.md` |
| 用户故事 | `userStoryWriter` | `USER_STORY_WRITER_TEMPLATE` | `.templates/user_story/user_story_template.md` |
| 非功能需求 | `nfrWriter` | `NFR_WRITER_TEMPLATE` | `.templates/NFR/nfr_template.md` |
| 用例 | `useCaseWriter` | `USE_CASE_WRITER_TEMPLATE` | `.templates/use_case/use_case_template.md` |
| 用户旅程 | `userJourneyWriter` | `USER_JOURNEY_WRITER_TEMPLATE` | `.templates/user_journey/user_journey_template.md` |
| 总体描述 | `overallDescriptionWriter` | `OVERALL_DESCRIPTION_WRITER_TEMPLATE` | `.templates/overall_description/overall_description_template.md` |
| 摘要 | `summaryWriter` | `SUMMARY_WRITER_TEMPLATE` | `.templates/summary/summary_template.md` |
| 术语表 | `glossaryWriter` | `GLOSSARY_TEMPLATE` | `.templates/glossary/glossary_template.md` |
| 业务规则 | `bizReqAndRuleWriter` | `BIZ_REQ_AND_RULE_WRITER_TEMPLATE` | `.templates/biz_req_and_rule/biz_req_and_rule_template.md` |
| 接口需求 | `ifrAndDarWriter` | `IFR_AND_DAR_WRITER_TEMPLATE` | `.templates/IFR_and_DAR/ifr_and_dar_template.md` |
| 风险分析 | `riskAnalysisWriter` | `RISK_ANALYSIS_TEMPLATE` | `.templates/risk_analysis/risk_analysis_template.md` |
| 假设、依赖、约束 | `adcWriter` | `ADC_WRITER_TEMPLATE` | `.templates/ADC/ADC_template.md` |
| 原型设计 | `prototypeDesigner` | `PROTOTYPE_DESIGNER_TEMPLATE` | `.templates/prototype_designer/prototype_designer_template.md` |

**不支持的：**
- 流程型 Specialist（如 `project_initializer`、`requirement_syncer`、`srs_reviewer`）
- Orchestrator 和协调型 Specialist

---

## 分步指南：自定义模板

### 步骤 1：找到默认模板

默认模板在插件安装目录的 `.templates/` 文件夹中：

```
.templates/
├── functional_requirements/
│   └── functional_requirement_template.md    ← FR 模板
├── user_story/
│   └── user_story_template.md                ← 用户故事模板
├── NFR/
│   └── nfr_template.md                       ← NFR 模板
└── ... (其他模板)
```

**查找插件位置：**
1. 在 VSCode 中，进入扩展面板
2. 找到 "SRS Writer"
3. 点击齿轮图标 → "扩展设置"
4. 扩展详情中会显示路径

### 步骤 2：复制并自定义模板

**选项 A：项目级模板（推荐）**

在你的项目中创建模板文件夹：
```
YourProject/
├── .srs-templates/           ← 你的自定义模板
│   ├── fr-template.md
│   ├── user-story-template.md
│   └── nfr-template.md
├── SRS.md
└── requirements.yaml
```

**选项 B：全局模板**

创建共享的模板文件夹：
```
~/Documents/srs-templates/
├── company-fr-template.md
├── company-us-template.md
└── company-nfr-template.md
```

### 步骤 3：配置 VSCode 设置

**方法 1：通过设置界面**

1. 打开 VSCode 设置（`Cmd+,` / `Ctrl+,`）
2. 搜索 "srs-writer templates"
3. 找到你要自定义的 Specialist（如 "Fr Writer"）
4. 编辑 JSON 值：
   ```json
   {
     "FR_WRITER_TEMPLATE": ".srs-templates/fr-template.md"
   }
   ```

**方法 2：直接编辑 settings.json**

在工作区或用户 `settings.json` 中添加：

```json
{
  "srs-writer.templates.frWriter": {
    "FR_WRITER_TEMPLATE": ".srs-templates/fr-template.md"
  },
  "srs-writer.templates.userStoryWriter": {
    "USER_STORY_WRITER_TEMPLATE": ".srs-templates/user-story-template.md"
  },
  "srs-writer.templates.nfrWriter": {
    "NFR_WRITER_TEMPLATE": ".srs-templates/nfr-template.md"
  }
}
```

### 步骤 4：验证配置

配置完成后，测试生成内容：
```
@srs-writer 为用户认证模块生成功能需求
```

检查输出是否遵循你的自定义模板结构。

---

## 模板格式和结构

### 文件格式要求

| 要求 | 详情 |
|------|------|
| **文件格式** | 仅支持 Markdown（`.md`） |
| **编码** | UTF-8 |
| **路径类型** | 相对于工作区根目录，或绝对路径 |
| **文件大小** | 无硬性限制，但建议保持合理（< 50KB） |

### 占位符语法

模板使用**方括号占位符**来指示 AI 应该填充内容的位置：

```markdown
#### FR-[SUBSYSTEM]-001: [需求标题]
- **需求名称**: [完整需求名称]
- **优先级**: [关键/高/中/低]
- **描述**: [详细需求描述]
```

**占位符类型：**

| 类型 | 示例 | 用途 |
|------|------|------|
| 文本占位符 | `[需求描述]` | AI 填充生成的文本 |
| 枚举占位符 | `[关键/高/中/低]` | AI 从选项中选择 |
| ID 占位符 | `[SUBSYSTEM]`、`[XXX]` | AI 生成适当的 ID |
| 引用占位符 | `[FR-XXX-XXX]`、`[US-XXX-XXX]` | AI 链接到其他需求 |

### 模板结构示例

以下是默认功能需求模板的结构：

```markdown
## 功能需求

### 5.1 [子系统名称]

#### FR-[SUBSYSTEM]-001: [需求标题]
- **需求名称**: [完整需求名称]
- **优先级**: [关键/高/中/低]
- **来源用户故事**: US-XXX-XXX
- **描述**: [详细需求描述]
- **验收标准**:
    - [ ] 正常场景: [预期行为描述]
    - [ ] 边界条件: [边界情况处理]
    - [ ] 异常场景: [错误处理行为]
- **依赖关系**: [FR-XXX-XXX]

---

### 功能需求追溯矩阵

| 需求ID | 需求名称 | 优先级 | 来源用户故事 | 依赖关系 |
|--------|----------|--------|--------------|----------|
| FR-XXX-001 | [名称] | 高 | US-AAA-001 | 无 |

**总计**: [X] 条功能需求，覆盖 [Y] 个子系统。
```

---

## 约束和限制

### 关键约束

| 约束 | 说明 | 影响 |
|------|------|------|
| **变量命名** | 必须以 `_TEMPLATE` 结尾（大写） | 系统不会识别其他名称 |
| **路径解析** | 相对路径从工作区根目录解析 | 绝对路径可在任何位置使用 |
| **仅支持 Markdown** | 不支持 YAML、JSON 或其他格式 | 内容无法正确渲染 |
| **每个变量单个文件** | 一个模板变量对应一个模板文件 | 无法合并多个文件 |

### ID 命名模式

**保持一致的 ID 模式** - 系统依赖这些模式进行追溯：

| 实体类型 | 模式 | 示例 |
|----------|------|------|
| 功能需求 | `FR-[类别]-NNN` | FR-AUTH-001, FR-PAY-002 |
| 用户故事 | `US-[类别]-NNN` | US-AUTH-001, US-CART-003 |
| 非功能需求 | `NFR-[类型]-NNN` | NFR-SEC-001, NFR-PERF-002 |
| 用例 | `UC-[类别]-NNN` | UC-AUTH-001, UC-SEARCH-002 |

**为什么这很重要：**
- `requirements.yaml` 解析依赖这些模式
- 追溯链接使用这些 ID
- 质量报告引用这些 ID

### 应该保留的字段

自定义模板时，**保留这些必要字段**：

**功能需求：**
- ID（FR-XXX-NNN 格式）
- 需求名称
- 优先级
- 来源用户故事（用于追溯）
- 验收标准
- 依赖关系

**用户故事：**
- ID（US-XXX-NNN 格式）
- As/I want/So that 结构
- 验收标准
- 优先级
- 故事点（可选但推荐）

**非功能需求：**
- ID（NFR-XXX-NNN 格式）
- 分类（安全/性能/可靠性等）
- 可量化指标及目标值
- 验证方法
- 来源需求

### 追溯矩阵

**始终在每个章节末尾包含追溯矩阵**：

```markdown
### 功能需求追溯矩阵

| 需求ID | 需求名称 | 优先级 | 来源用户故事 | 依赖关系 |
|--------|----------|--------|--------------|----------|
```

这些矩阵支持：
- 需求间的交叉引用
- 完整性验证
- 影响分析

---

## 可以自定义的内容

### 安全修改

| 元素 | 示例变更 |
|------|----------|
| **章节标题** | 将"5.1 [子系统名称]"改为"模块：[子系统名称]" |
| **字段标签** | 将"Requirement Name"改为"标题"或本地化术语 |
| **额外字段** | 添加"审核人"、"最后更新"、"版本" |
| **验收标准结构** | 添加更多场景类型（性能、安全） |
| **优先级值** | 使用 P1/P2/P3/P4 代替 关键/高/中/低 |
| **Markdown 格式** | 添加表格、列表样式、强调 |
| **说明/注释** | 添加对编写者的指导说明 |
| **语言** | 翻译成中文、西班牙语等 |

### 示例：添加自定义字段

```markdown
#### FR-[SUBSYSTEM]-001: [需求标题]
- **ID**: FR-[SUBSYSTEM]-001
- **标题**: [需求标题]
- **优先级**: [P1/P2/P3/P4]
- **负责人**: [负责的团队或人员]            ← 新增
- **目标迭代**: [迭代编号]                  ← 新增
- **来源用户故事**: US-XXX-XXX
- **描述**: [详细需求描述]
- **验收标准**:
    - [ ] 正常路径: [预期行为]
    - [ ] 边界情况: [边界处理]
    - [ ] 错误情况: [错误处理]
    - [ ] 性能要求: [性能预期]              ← 新增
- **测试用例**: [TC-XXX-NNN 引用]          ← 新增
- **依赖关系**: [FR-XXX-XXX]
- **审核状态**: [草稿/审核中/已批准]        ← 新增
```

### 示例：企业定制模板

```markdown
## 功能需求规格说明

### 模块 1：[模块名称]

#### FR-[MODULE]-001: [需求标题]

| 属性 | 值 |
|------|-----|
| **需求ID** | FR-[MODULE]-001 |
| **需求名称** | [完整需求名称] |
| **优先级** | [P1/P2/P3/P4] |
| **状态** | [草稿/评审中/已批准/已实现] |
| **负责人** | [姓名] |
| **版本** | [1.0] |

**业务背景**：
[描述该需求的业务背景和价值]

**详细描述**：
[详细的功能需求描述]

**验收标准**：
| AC编号 | 场景类型 | 描述 | 预期结果 |
|--------|----------|------|----------|
| AC-001 | 正常 | [场景描述] | [预期结果] |
| AC-002 | 异常 | [场景描述] | [预期结果] |

**追溯信息**：
- 来源：US-XXX-XXX
- 派生需求：FR-XXX-002, FR-XXX-003
- 相关测试用例：TC-XXX-001, TC-XXX-002

---
```

---

## 不应该修改的内容

### 有风险的修改

| 元素 | 原因 |
|------|------|
| **ID 模式（FR-、US-、NFR-）** | 破坏追溯和 YAML 解析 |
| **删除追溯矩阵** | 丧失交叉引用能力 |
| **删除验收标准** | AI 可能跳过这个关键部分 |
| **文件格式（使用 .yaml、.txt）** | 系统只支持 Markdown |
| **嵌套复杂结构** | AI 可能误解结构 |

### 反模式

**不要这样做：**

```markdown
# 错误：改变了 ID 模式
#### REQ-001: [标题]          ← 应该是 FR-XXX-001

# 错误：删除了来源追踪
- **描述**: [描述]
  （缺少"来源用户故事"字段）

# 错误：非标准优先级
- **优先级**: [必须有/应该有/可以有]
  ← 系统期望 关键/高/中/低
```

---

## 错误处理和降级

### 模板文件缺失会怎样？

```typescript
// 系统行为：
if (templateFileNotFound) {
  templateContent = '';  // 空字符串，不抛出错误
  // AI 在没有模板指导的情况下继续工作
}
```

**结果：** AI 会生成内容，但可能不遵循你期望的结构。

### 模板变量名错误会怎样？

```json
// 错误：缺少 _TEMPLATE 后缀
{
  "FR_WRITER": ".srs-templates/fr-template.md"  // 不会被检测到
}

// 正确：
{
  "FR_WRITER_TEMPLATE": ".srs-templates/fr-template.md"
}
```

**结果：** 系统静默忽略该配置。

### 调试模板问题

1. **检查 VSCode 开发者控制台**
   - `帮助` → `切换开发人员工具` → `控制台`
   - 查找模板加载日志

2. **验证路径解析**
   ```
   @srs-writer 显示当前模板配置
   ```

3. **先用简单模板测试**
   - 从最小改动开始
   - 逐步添加自定义内容

---

## 最佳实践

### 1. 从默认模板开始

1. 复制默认模板
2. 做小的改动
3. 测试生成效果
4. 迭代优化

### 2. 保持 ID 模式一致

```markdown
✅ FR-AUTH-001, FR-AUTH-002, FR-PAY-001
✅ US-CART-001, US-CART-002
✅ NFR-SEC-001, NFR-PERF-001

❌ REQ-001, REQ-002（没有类别）
❌ Func-Req-1（非标准格式）
❌ user_story_1（下划线，没有类别）
```

### 3. 维护追溯字段

始终包含：
- 来源引用（这个需求从哪里来）
- 依赖关系（这个需求依赖什么）
- 派生需求（从这个需求派生出什么）

### 4. 使用工作区设置存储项目特定模板

```
.vscode/
└── settings.json    ← 项目特定的模板配置

YourProject/
├── .srs-templates/  ← 项目特定的模板
│   └── fr-template.md
└── ...
```

### 5. 版本控制你的模板

```bash
git add .srs-templates/
git commit -m "添加符合公司标准的自定义 SRS 模板"
```

---

## 完整配置示例

### 项目结构

```
MyProject/
├── .vscode/
│   └── settings.json
├── .srs-templates/
│   ├── fr-template.md
│   ├── us-template.md
│   ├── nfr-template.md
│   └── uc-template.md
├── SRS.md
├── requirements.yaml
└── quality-report.json
```

### settings.json

```json
{
  "srs-writer.templates.frWriter": {
    "FR_WRITER_TEMPLATE": ".srs-templates/fr-template.md"
  },
  "srs-writer.templates.userStoryWriter": {
    "USER_STORY_WRITER_TEMPLATE": ".srs-templates/us-template.md"
  },
  "srs-writer.templates.nfrWriter": {
    "NFR_WRITER_TEMPLATE": ".srs-templates/nfr-template.md"
  },
  "srs-writer.templates.useCaseWriter": {
    "USE_CASE_WRITER_TEMPLATE": ".srs-templates/uc-template.md"
  }
}
```

---

## 故障排除

### 模板更改没有生效

**现象**：生成的内容没有遵循你的自定义模板

**解决方案**：
1. 验证文件路径正确（相对于工作区根目录）
2. 检查变量名以 `_TEMPLATE` 结尾
3. 重新加载 VSCode 窗口（`Developer: Reload Window`）
4. 验证文件编码是 UTF-8

### AI 忽略模板结构

**现象**：内容已生成但结构不同

**解决方案**：
1. 使模板结构更清晰，使用明确的标题
2. 在模板中添加注释说明预期格式
3. 降低模板复杂度
4. 确保占位符清晰：使用 `[在此填写描述]` 而不是 `...`

### 追溯链接断开

**现象**：requirements.yaml 有解析错误，链接无法工作

**解决方案**：
1. 保持 ID 模式：`FR-XXX-NNN`、`US-XXX-NNN`
2. 不要更改 ID 前缀模式
3. 在章节末尾保留追溯矩阵

---

## 相关主题

- [理解文档结构](getting-started-document-structure.md)
- [提升质量](scenario-quality-improvement.md)
- [多项目管理](scenario-multi-project.md)

---

[⬅️ 上一篇：提升质量](scenario-quality-improvement.md) | [下一篇：获取帮助 ➡️](faq-getting-help.md)
