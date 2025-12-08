# 提升需求质量

> **场景**：SRS 已生成，想在定稿前提升质量与可测试性  
> **耗时**：每轮 10-20 分钟

---

## 质量工具概览

- **`srs_reviewer`**：多维质量审查（完整性、一致性、清晰度、可测试性、追溯性、合规性等），按严重度列出问题并可直接修复。  
- **`syntaxChecker`**：Markdown/YAML 语法检查，支持 basic / standard / strict。  
- **追溯与编号**：`requirements.yaml` 使用实体 ID（FR/NFR/IFR/DAR/UC 等），便于追踪与一致性检查。

---

## 运行质量审查

在聊天中：
```
@srs-writer 做一轮质量检查，按严重度列出需要修改的章节
```

常见响应内容：
- 发现的问题列表（章节/需求 ID + 严重度）
- 改进建议或可自动应用的修复
- 追溯性或可测试性缺口

让 SRS Writer 自动修复：
```
@srs-writer 按上述建议修复并说明改动点
```

> 质量审查结果显示在对话中，不单独生成文件。

---

## 语法与结构校验

`syntaxChecker` 默认开启，配置项位于 `srs-writer.syntaxChecker.*`：
- Markdown：`standard` 模式（常见 lint 规则，避免格式错误）
- YAML：`standard` / `strict`（校验结构与 requirement schema）

如需重新校验：
```
@srs-writer 重新跑一次 Markdown/YAML 语法检查
```

---

## 处理常见质量问题

### 模糊或不可测试
```
@srs-writer FR-005 太笼统，请补充量化指标和验收标准。
```

### 追溯缺口
```
@srs-writer 识别并补全用例/需求/测试之间的追溯关系，保持 ID 稳定。
```

### 章节缺失或不平衡
```
@srs-writer 检查是否缺少接口/数据/风险章节，按模板补齐。
```

### 非功能需求不足
```
@srs-writer 为性能/安全/可靠性补充具体 NFR，附目标值和验证方式。
```

---

## 复核与提交前检查清单

- 质量审查无高优先级未解决项  
- `SRS.md` 与 `requirements.yaml` 的 ID、内容一致  
- 关键章节齐全：摘要、总体描述、用例/旅程、FR、NFR、接口/数据、约束/风险、原型概览  
- Markdown/YAML 语法检查通过  
- Git 处于 `wip` 分支，变更已 `git diff` 自检

---

[⬅️ 上一篇：多项目管理](scenario-multi-project.md) | [下一篇：常见问题 ➡️](faq-common-questions.md)
