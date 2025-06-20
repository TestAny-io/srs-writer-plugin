# SRS Writer Plugin v1.3 架构文档

## 🏗️ 总体架构

### 主要路径（Happy Path）

```text
用户输入 → Chat Participant → Orchestrator → SpecialistExecutor → VSCode API
                                    ↓                ↓
                            rules/orchestrator.md  rules/specialists/*.md
```

### 降级路径（Fallback Path）

```text
用户输入 → Chat Participant → Orchestrator → SpecialistExecutor → VSCode API
                                    ↓                ↓
                            硬编码分类提示词      硬编码专家提示词
```

## 📁 文件结构

### 核心组件

- `src/core/orchestrator.ts` - 意图分类和流程编排
- `src/core/specialist-executor.ts` - 专家执行和提示词管理
- `src/chat/srs-chat-participant.ts` - VSCode Chat 接口

### 提示词文件

- `rules/orchestrator.md` - 意图分类提示词
- `rules/specialists/100_create_srs.md` - 创建SRS专家
- `rules/specialists/200_edit_srs.md` - 编辑SRS专家
- `rules/specialists/300_prototype.md` - 原型设计专家
- `rules/specialists/400_lint_check.md` - 质量检查专家
- `rules/specialists/500_git_operations.md` - Git操作专家
- `rules/specialists/help_response.md` - 帮助响应专家

### 降级备用组件

- `src/core/prompt-manager.ts` - 硬编码提示词管理（降级备用）
- `src/core/ai-communicator.ts` - AI通信封装（降级备用）

## 🔄 工作流程

### 1. 意图分类阶段

1. **主要路径**: 读取 `rules/orchestrator.md`
2. **模板替换**: `{{USER_INPUT}}`, `{{PROJECT_NAME}}` 等
3. **发送给AI**: 获取意图分类结果
4. **降级机制**: 如果文件读取失败，使用硬编码提示词

### 2. 专家执行阶段

1. **主要路径**: 根据意图读取对应的 `rules/specialists/*.md`
2. **模板替换**: 替换上下文变量
3. **发送给AI**: 获取专家响应
4. **降级机制**: 如果文件读取失败，使用硬编码提示词

## 🛡️ 降级机制

### 为什么需要降级机制？

1. **文件系统问题**: 打包环境路径可能不同
2. **权限问题**: 某些环境可能限制文件读取
3. **部署问题**: 文件可能缺失或损坏
4. **开发调试**: 快速测试而不依赖外部文件

### 降级策略

- **自动降级**: 文件读取失败时自动使用硬编码版本
- **日志记录**: 详细记录降级原因
- **功能保障**: 确保核心功能不受影响

## ⚠️ 重要注意事项

### 请勿删除的组件

以下组件标记了 🚫 请勿删除注释，是系统稳定性的重要保障：

1. **硬编码提示词方法**:
   - `buildPromptForSpecialist()`
   - `buildCreateSRSPrompt()`
   - `buildEditSRSPrompt()`
   - `buildHelpPrompt()`
   - `buildGenericPrompt()`
   - `buildClassificationPrompt()`

2. **降级备用组件**:
   - `PromptManager` 类
   - `AICommunicator` 类

### 模板变量系统

支持的模板变量：

- `{{USER_INPUT}}` - 用户输入
- `{{PROJECT_NAME}}` - 项目名称
- `{{HAS_ACTIVE_PROJECT}}` - 是否有活跃项目
- `{{TIMESTAMP}}` - 当前时间戳
- `{{DATE}}` - 当前日期
- `{{INTENT}}` - 用户意图
- `{{LAST_INTENT}}` - 上一次意图
- `{{ACTIVE_FILES}}` - 活跃文件列表

## 🔮 未来规划

### 可能的改进

1. **移除降级机制**: 当文件系统足够稳定时
2. **增强模板系统**: 支持更复杂的条件逻辑
3. **动态专家加载**: 支持插件式专家扩展
4. **提示词版本管理**: 支持A/B测试和版本回滚

### 不建议的操作

1. 删除降级备用代码（除非有充分测试）
2. 修改模板变量格式（会影响兼容性）
3. 移除错误处理逻辑（会影响稳定性）

---

**维护者注意**: 此文档描述了当前架构的设计理念和重要约束，请在重构时仔细考虑降级机制的必要性。
