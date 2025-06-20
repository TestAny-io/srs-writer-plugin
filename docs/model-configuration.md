# 🚀 动态模型配置系统

SRS Writer 插件采用智能的动态模型配置系统，无需硬编码就能适应各种 AI 模型的上下文限制。

## 工作原理

### 1. 多层次自适应策略

系统按以下优先级顺序确定模型配置：

1. **👤 用户配置覆盖** (最高优先级)
2. **🎯 错误学习缓存** (高置信度)
3. **📋 普通推断缓存** (24小时有效)
4. **🔍 启发式推断** (基于模型名称模式)

### 2. 启发式推断规则

系统根据模型名称中的关键词智能推断上下文窗口大小：

- **大上下文模型** (128k tokens): `turbo`, `128k`, `200k`, `long`, `extended`, `claude-3`, `gemini-pro`, `2024`, `2023`
- **中等上下文模型** (32k tokens): `gpt-4`, `claude-2`, `gemini`, `16k`, `32k`
- **小上下文模型** (4k tokens): `gpt-3.5`, `4k`, `2k`, `2022`, `2021`
- **默认保守估计** (8k tokens): 其他未知模型

### 3. 错误反馈学习

当系统遇到上下文超限错误时，会自动：
- 识别错误类型
- 降低该模型的token限制（保守策略）
- 缓存学习结果（高置信度）
- 避免再次发生相同错误

## 用户自定义配置

### VSCode设置配置

在 VSCode 的 `settings.json` 中添加：

```json
{
    "srs-writer.modelConfigs": {
        "gpt-4-custom": {
            "maxTokens": 8000,
            "warningThreshold": 6000,
            "compressionThreshold": 4000
        },
        "claude-3-opus": {
            "maxTokens": 200000,
            "warningThreshold": 150000,
            "compressionThreshold": 120000
        },
        "custom-local-model": {
            "maxTokens": 2048,
            "warningThreshold": 1500,
            "compressionThreshold": 1000
        }
    }
}
```

### 配置参数说明

- **maxTokens**: 模型的最大上下文窗口大小
- **warningThreshold**: 开始警告的token阈值
- **compressionThreshold**: 开始压缩对话历史的阈值

### 工作区配置

也可以在项目的 `.vscode/settings.json` 中配置特定项目的模型设置：

```json
{
    "srs-writer.modelConfigs": {
        "project-specific-model": {
            "maxTokens": 16000,
            "warningThreshold": 12000,
            "compressionThreshold": 8000
        }
    }
}
```

## 系统监控

### 日志监控

系统会记录配置决策过程：

```
📋 Using cached config for gpt-4-turbo (confidence: medium)
🔍 Inferred config for unknown-model: 8000 tokens (medium confidence)
👤 Using user config for custom-model: 4000 tokens
🎯 Using learned config for gpt-3.5-turbo: 3200 tokens (high confidence)
🔧 Learned from context error for gpt-4: 8000 → 6400 tokens
```

### 配置缓存

- **缓存位置**: 内存中的静态Map
- **缓存时效**: 24小时（错误学习缓存永久有效）
- **置信度级别**: low < medium < high

## 最佳实践

### 1. 新模型首次使用

对于全新的未知模型：
```json
{
    "srs-writer.modelConfigs": {
        "new-experimental-model": {
            "maxTokens": 4000,
            "warningThreshold": 3000,
            "compressionThreshold": 2000
        }
    }
}
```

### 2. 本地小模型

对于资源受限的本地模型：
```json
{
    "srs-writer.modelConfigs": {
        "local-llama-7b": {
            "maxTokens": 2048,
            "warningThreshold": 1500,
            "compressionThreshold": 1000
        }
    }
}
```

### 3. 企业内部模型

对于企业部署的定制模型：
```json
{
    "srs-writer.modelConfigs": {
        "company-internal-gpt": {
            "maxTokens": 16384,
            "warningThreshold": 12000,
            "compressionThreshold": 8000
        }
    }
}
```

## 故障排除

### 常见问题

1. **上下文仍然超限**
   - 检查用户配置是否过高
   - 系统会自动学习并调整

2. **压缩过于频繁**
   - 降低 `compressionThreshold`
   - 或增加 `maxTokens`

3. **配置不生效**
   - 确认模型名称匹配
   - 重启 VSCode 刷新配置

### 重置学习缓存

目前需要重启 VSCode 来清除学习缓存。未来版本将提供命令行重置功能。

## 技术细节

### Token估算算法

```typescript
// 中英文混合文本的智能估算
const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length;
return Math.ceil(chineseChars + englishWords * 1.3);
```

### 错误检测模式

系统识别以下错误模式为上下文限制错误：
- `context length`
- `token limit`
- `maximum context`
- `too long`
- `context size`
- 常见token数字：`4096`, `8192`, `16384`, `32768`

---

这个动态配置系统确保了插件能够适应任何现有或未来的AI模型，无需代码更新！ 