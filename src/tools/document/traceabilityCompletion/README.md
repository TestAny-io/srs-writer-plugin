# Traceability Completion Tool

追溯性同步工具，用于自动计算和填充需求文档中的 `derived_fr`、`ADC_related` 和 `tech_spec_related` 字段。

## 🎯 功能概述

解决SRS生成过程中的时序依赖问题：
- **derived_fr**: 业务需求(US/UC)被哪些技术需求引用 (反向追溯)
- **ADC_related**: 技术需求(FR/NFR/IFR/DAR)引用了哪些ADC约束
- **tech_spec_related**: 功能需求(FR)被哪些技术规范需求(NFR/IFR/DAR)引用 (反向追溯)

## 🏗️ 架构设计

### 核心组件

```
TraceabilityCompleter (主控制器)
├── EntityTypeClassifier (实体类型识别)
├── TraceabilityMapBuilder (追溯映射构建)  
├── DerivedFRComputer (derived_fr计算)
├── ADCRelatedComputer (ADC_related计算)
├── TechSpecRelatedComputer (tech_spec_related计算)
└── 复用现有组件:
    ├── YAMLReader (文件读取)
    ├── YAMLEditor (文件写入)
    └── ScaffoldError (错误处理)
```

### 工作流程

```
Phase 1: 数据读取验证 → Phase 2: 字段清理 → Phase 3: 追溯映射构建
      ↓                     ↓                    ↓
Phase 5: 文件输出    ←  Phase 4: 字段计算填充  ←  悬空引用检测
                           (4a, 4b, 4c)
```

## 🔧 使用方式

### 作为Specialist工具

```typescript
// 工具调用
await traceabilityCompletionTool({
  description: "初始化SRS追溯关系",
  targetFile: "requirements.yaml",
  options: {
    checkOnly: false,  // 是否只验证不写入
    verbose: true      // 详细日志
  }
});
```

### 核心API

```typescript
const completer = new TraceabilityCompleter();

// 同步文件
const result = await completer.syncFile({
  description: "同步追溯关系",
  targetFile: "requirements.yaml"
});

// 只验证不写入
const validation = await completer.validateSync({
  description: "验证追溯关系",
  targetFile: "requirements.yaml"
});
```

## 📊 计算规则

### derived_fr 计算

**适用**: US (用户故事) 和 UC (用例)

```yaml
# 输入
user_stories:
  - id: US-ALERT-001
    title: "用户收到告警通知"
    
functional_requirements:
  - id: FR-ALERT-001
    source_requirements: [US-ALERT-001]
  - id: NFR-PERF-001
    source_requirements: [US-ALERT-001]

# 输出 (自动计算)
user_stories:
  - id: US-ALERT-001
    title: "用户收到告警通知"
    derived_fr: [FR-ALERT-001, NFR-PERF-001]  # 字母升序排序
```

### ADC_related 计算

**适用**: FR, NFR, IFR, DAR (技术需求)

```yaml
# 输入 - ADC约束定义它们影响的技术需求
assumptions:
  - id: ADC-ASSU-001
    summary: "数据源稳定性假设"
    impacted_requirements: [FR-AUTH-001, NFR-PERF-001]

dependencies:
  - id: ADC-DEPEN-001
    summary: "第三方认证依赖" 
    impacted_requirements: [FR-AUTH-001]

# 输出 (自动计算) - 技术需求获得影响它们的ADC约束列表
functional_requirements:
  - id: FR-AUTH-001
    source_requirements: [US-AUTH-001]
    ADC_related: [ADC-ASSU-001, ADC-DEPEN-001]  # 自动填充，字母排序

non_functional_requirements:
  - id: NFR-PERF-001
    source_requirements: [US-AUTH-001]
    ADC_related: [ADC-ASSU-001]  # 自动填充
```

### tech_spec_related 计算

**适用**: FR (功能需求)

```yaml
# 输入 - 技术规范需求引用功能需求
functional_requirements:
  - id: FR-AUTH-001
    source_requirements: [US-AUTH-001]

non_functional_requirements:
  - id: NFR-SEC-001
    source_requirements: [FR-AUTH-001]  # NFR引用FR

interface_requirements:
  - id: IFR-API-001
    source_requirements: [FR-AUTH-001]  # IFR引用FR

data_requirements:
  - id: DAR-USER-001
    source_requirements: [FR-AUTH-001]  # DAR引用FR

# 输出 (自动计算) - 功能需求获得引用它们的技术规范需求列表
functional_requirements:
  - id: FR-AUTH-001
    source_requirements: [US-AUTH-001]
    tech_spec_related: [DAR-USER-001, IFR-API-001, NFR-SEC-001]  # 自动填充，字母排序
```

## ✨ 特性

### 🔄 幂等性保证

- 每次运行都清空computed字段
- 多次运行产生完全相同的结果
- 避免数据累积和不一致

### ⚠️ 悬空引用处理

- 检测`source_requirements`中不存在的ID
- 输出警告信息但继续处理
- 从最终计算结果中排除悬空引用

### 🚀 性能优化

- 目标性能: 1000个实体 < 5秒
- O(n*m)时间复杂度 (n=实体数, m=平均依赖数)
- 内存优化的Map和Set数据结构

### 🛡️ 错误处理

- 基于ScaffoldError的统一错误分类
- 原子性操作：要么全部成功，要么完全不变
- 详细的错误信息和恢复建议

## 📋 支持的实体类型

| 类型 | 前缀 | computed字段 | 说明 |
|------|------|-------------|------|
| **业务需求** ||||
| 用户故事 | `US-` | `derived_fr` | 被哪些技术需求引用 |
| 用例 | `UC-` | `derived_fr` | 被哪些技术需求引用 |
| **技术需求** ||||
| 功能需求 | `FR-` | `ADC_related` | 引用了哪些ADC约束 |
| 非功能需求 | `NFR-` | `ADC_related` | 引用了哪些ADC约束 |
| 接口需求 | `IFR-` | `ADC_related` | 引用了哪些ADC约束 |
| 数据需求 | `DAR-` | `ADC_related` | 引用了哪些ADC约束 |
| **ADC约束** ||||
| 假设 | `ADC-ASSU-` | - | 被技术需求引用 |
| 依赖 | `ADC-DEPEN-` | - | 被技术需求引用 |
| 约束 | `ADC-CONST-` | - | 被技术需求引用 |

## 🧪 测试覆盖

### 单元测试
- `EntityTypeClassifier`: ID类型识别
- `TraceabilityMapBuilder`: 映射构建和验证
- `DerivedFRComputer`: derived_fr计算和验证
- `ADCRelatedComputer`: ADC_related计算和验证

### 集成测试
- 完整的端到端流程
- 文件I/O操作
- 错误处理场景
- 性能基准测试

### 测试数据
- 简单追溯关系
- 复杂网络关系
- ADC约束处理
- 悬空引用场景
- 空文件边界情况

## 🔌 集成方式

### 工具注册

工具已注册到系统的Document层，支持：
- `CallerType.SPECIALIST` 访问控制
- 智能分类: `interactionType: 'autonomous'`
- 风险级别: `riskLevel: 'medium'`

### 依赖关系

```typescript
// 🚀 复用现有组件
import { YAMLReader } from '../yamlEditor/YAMLReader';
import { ScaffoldError, ScaffoldErrorType } from '../scaffoldGenerator/types';
import * as yaml from 'js-yaml';  // 使用相同的YAML配置
```

## 📈 性能指标

- **目标**: 1000个实体 < 5秒
- **实测**: 100个实体 < 100ms
- **内存**: 优化的Map/Set数据结构
- **算法**: O(n*m) 时间复杂度

## 🎉 成功标准

### ✅ 功能完整性
- [x] 正确计算所有derived_fr和ADC_related字段
- [x] 支持所有定义的实体类型和ID前缀规则
- [x] 正确处理悬空引用 (警告并排除)
- [x] 计算结果按字母升序排序
- [x] 幂等性保证

### ✅ 质量保证
- [x] 工具运行稳定，无数据损坏风险
- [x] 处理各种边界情况不崩溃
- [x] 原子性和幂等性得到保证
- [x] 性能满足要求

### ✅ 集成效果
- [x] Specialist能够顺利调用工具
- [x] 解决了SRS.md生成的时序依赖问题
- [x] 工具与rtm-validators职责分离清晰

---

## 🔗 相关文档

- [需求文档](../../../docs/追溯性同步工具开发需求.md)
- [设计文档](../../../design/traceability-completion-tool/)
- [测试报告](../../../test/integration/traceability-completion-tool.integration.test.ts) 