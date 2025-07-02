# 📤 Content Specialist 输出格式规范

## ⚠️ 🚨 核心要求 - 必须严格遵循 🚨 ⚠️

**所有Content Specialist必须输出JSON格式，包含tool_calls调用taskComplete工具！**

---

## 🎯 标准输出格式

### 🚀 基本JSON结构

```json
{
  "tool_calls": [
    {
      "name": "taskComplete",
      "args": {
        "completionType": "READY_FOR_NEXT",
        "nextStepType": "HANDOFF_TO_SPECIALIST",
        "summary": "工作成果摘要",
        "deliverables": ["交付物列表"],
        "contextForNext": {
          "projectState": {
            "requires_file_editing": true,
            "edit_instructions": [...],
            "target_file": "SRS.md",
            "content": "生成的Markdown内容",
            "structuredData": {...}
          }
        }
      }
    }
  ]
}
```

## 🔑 taskComplete工具参数详解

### 1. completionType（必需）
- **`"READY_FOR_NEXT"`**: 内容已完成，准备下一阶段
- **`"REQUIRES_REVIEW"`**: 需要用户确认
- **`"FULLY_COMPLETED"`**: 任务完全完成

### 2. nextStepType（必需）
- **`"HANDOFF_TO_SPECIALIST"`**: 转交给其他专家
- **`"USER_INTERACTION"`**: 需要用户交互  
- **`"TASK_FINISHED"`**: 任务结束

### 3. summary（必需）
- **类型**: string
- **说明**: 工作成果的简要描述
- **示例**: "已完成系统边界定义，明确了5个核心功能模块和3个集成点"

### 4. deliverables（必需）
- **类型**: string[]
- **说明**: 具体交付物列表
- **示例**: ["系统边界章节", "功能特性列表", "约束条件清单"]

## 🚨 核心：contextForNext.projectState配置

### requires_file_editing字段（必需）

**Content Specialist必须明确声明是否需要文件编辑**：

- **`true`**: 需要创建或修改文件
- **`false`**: 仅提供信息，无需文件操作

### 当requires_file_editing = true时

**必须提供完整的文件编辑信息**：

```json
{
  "contextForNext": {
    "projectState": {
      "requires_file_editing": true,
      "edit_instructions": [
        {
          "action": "insert",
          "lines": [10],
          "content": "## 2. 系统边界\n\n本节定义...",
          "reason": "添加系统边界章节"
        },
        {
          "action": "replace", 
          "lines": [15, 20],
          "content": "更新的内容...",
          "reason": "更新功能描述"
        }
      ],
      "target_file": "SRS.md",
      "content": "完整的章节内容（用于备份）",
      "structuredData": {
        "type": "SystemBoundary",
        "data": {...}
      }
    }
  }
}
```

#### edit_instructions数组（必需）
每个编辑指令包含：
- **`action`**: `"insert"` 或 `"replace"`
- **`lines`**: 行号数组（从1开始计数）
- **`content`**: 要插入或替换的内容
- **`reason`**: 编辑原因说明

#### target_file字段（必需）
- **类型**: string
- **说明**: 目标文件路径
- **示例**: `"SRS.md"`

### 当requires_file_editing = false时

**仅提供信息，无需文件操作**：

```json
{
  "contextForNext": {
    "projectState": {
      "requires_file_editing": false,
      "content": "咨询建议或分析结果",
      "structuredData": {
        "type": "ConsultationResponse",
        "data": {...}
      }
    }
  }
}
```

## 📊 structuredData按专家类型规范

### ExecutiveSummary类型（Summary Writer）
```json
{
  "type": "ExecutiveSummary",
  "data": {
    "projectOverview": {
      "name": "项目名称",
      "objective": "项目核心目标",
      "scope": "项目范围描述"
    },
    "businessValue": {
      "problemStatement": "解决的核心业务问题",
      "expectedBenefits": ["收益1", "收益2"],
      "roi": "预期投资回报"
    },
    "technicalApproach": {
      "keyTechnologies": ["技术1", "技术2"],
      "innovationPoints": ["创新点1", "创新点2"],
      "architecture": "技术架构概述"
    },
    "implementation": {
      "timeline": "实施时间线",
      "resources": "资源需求",
      "milestones": ["里程碑1", "里程碑2"]
    },
    "riskAssessment": {
      "majorRisks": ["风险1", "风险2"],
      "mitigationStrategies": ["缓解策略1", "缓解策略2"]
    }
  }
}
```

### SystemBoundary类型（Overall Description Writer）
```json
{
  "type": "SystemBoundary",
  "data": {
    "includedFeatures": [
      {
        "id": "feat-001",
        "name": "用户认证",
        "description": "用户登录和注册功能",
        "priority": "high"
      }
    ],
    "excludedFeatures": [...],
    "systemRoles": [...],
    "keyConstraints": [...],
    "integrationPoints": [...]
  }
}
```

### FunctionalFeatures类型（FR Writer）
```json
{
  "type": "FunctionalFeatures", 
  "data": {
    "features": [
      {
        "id": "FR-001",
        "name": "用户登录",
        "description": "用户可以使用邮箱和密码登录",
        "userStories": [...],
        "acceptanceCriteria": [...],
        "priority": "must-have"
      }
    ],
    "categories": {...}
  }
}
```

### NonFunctionalRequirements类型（NFR Writer）
```json
{
  "type": "NonFunctionalRequirements",
  "data": {
    "performance": [...],
    "security": [...],
    "scalability": [...],
    "compliance": [...]
  }
}
```

### UserJourneys类型（User Journey Writer）
```json
{
  "type": "UserJourneys",
  "data": {
    "journeys": [...],
    "personas": [...]
  }
}
```

## 🎯 按Content Specialist类型的使用指南

### 内容生成类specialist
- **summary_writer**: `requires_file_editing: true`，添加Executive Summary章节
- **overall_description_writer**: `requires_file_editing: true`，添加系统概述章节
- **fr_writer**: `requires_file_editing: true`，添加功能需求章节
- **nfr_writer**: `requires_file_editing: true`，添加非功能需求章节
- **user_journey_writer**: `requires_file_editing: true`，添加用户旅程章节

### 咨询类specialist
- **help_response**: `requires_file_editing: false`，仅提供帮助信息
- **complexity_classification**: `requires_file_editing: false`，仅提供复杂度分析

### 操作类specialist
- **project_initializer**: `requires_file_editing: false`，创建初始SRS结构
- **document_formatter**: `requires_file_editing: false`，格式化SRS文档
- **git_operator**: `requires_file_editing: false`，操作git仓库
- **requirement_syncer**: `requires_file_editing: false`，同步需求到requirements.yaml

## 📏 编辑指令详细规范

### 行号规则
- **行号从1开始计数**
- **insert操作**: `"lines": [10]` 表示在第10行之前插入
- **replace操作**: `"lines": [10, 15]` 表示替换第10-15行（包含）

### 编辑操作示例

#### 插入新章节
```json
{
  "action": "insert",
  "lines": [25],
  "content": "\n## 2.4 集成要求\n\n系统需要与以下外部系统集成：\n- 第三方支付系统\n- 用户认证服务\n",
  "reason": "添加集成要求章节"
}
```

#### 替换现有内容
```json
{
  "action": "replace",
  "lines": [10, 12],
  "content": "## 2.1 系统功能边界\n\n本系统包含以下核心功能：",
  "reason": "更新功能边界描述"
}
```

## ⚠️ 常见错误和最佳实践

### ❌ 常见错误
1. **忘记包含tool_calls结构**
2. **忘记设置requires_file_editing字段**
3. **requires_file_editing=true但缺少edit_instructions**
4. **行号从0开始计数（应该从1开始）**
5. **JSON格式错误或不完整**

### ✅ 最佳实践
1. **总是使用完整的JSON格式输出**
2. **总是包含taskComplete工具调用**
3. **明确设置requires_file_editing字段**
4. **为每个编辑操作提供清晰的reason说明**
5. **确保content内容包含正确的Markdown格式**
6. **structuredData与content内容保持一致**

## 🔍 输出验证清单

在提交输出之前，请确认：

- [ ] 输出是有效的JSON格式
- [ ] 包含tool_calls数组
- [ ] tool_calls中包含taskComplete调用
- [ ] taskComplete的所有必需参数都已提供
- [ ] `requires_file_editing`字段已明确设置为true或false
- [ ] 如果`requires_file_editing=true`，已提供完整的`edit_instructions`和`target_file`
- [ ] `structuredData`包含了完整的结构化信息
- [ ] 所有编辑指令的行号都是从1开始的正整数

## 📋 完整示例

### Summary Writer完整输出示例

```json
{
  "tool_calls": [
    {
      "name": "taskComplete",
      "args": {
        "completionType": "READY_FOR_NEXT",
        "nextStepType": "HANDOFF_TO_SPECIALIST",
        "summary": "已完成JiraMacClient项目的Executive Summary，包含项目概述、业务价值、技术方案、实施计划和风险评估",
        "deliverables": ["Executive Summary章节", "项目价值分析", "技术架构概述"],
        "contextForNext": {
          "projectState": {
            "requires_file_editing": true,
            "edit_instructions": [
              {
                "action": "insert",
                "lines": [5],
                "content": "\n## Executive Summary\n\n### 项目概述\nJiraMacClient是一个原生macOS客户端应用，旨在为Mac用户提供更优秀的Jira使用体验。\n\n### 业务价值\n解决当前基于Web的Jira界面在macOS上用户体验不佳的问题，提升团队协作效率。\n\n### 技术方案\n采用Swift和SwiftUI构建原生macOS应用，通过Jira REST API实现数据同步。\n\n### 实施计划\n预计3个月完成MVP版本，包括核心功能开发、测试和发布。\n\n### 风险评估\n主要风险包括Jira API变更和用户接受度，将通过版本兼容和用户反馈迭代缓解。\n",
                "reason": "添加Executive Summary章节到SRS文档开头"
              }
            ],
            "target_file": "SRS.md",
            "content": "## Executive Summary\n\n### 项目概述\nJiraMacClient是一个原生macOS客户端应用...",
            "structuredData": {
              "type": "ExecutiveSummary",
              "data": {
                "projectOverview": {
                  "name": "JiraMacClient",
                  "objective": "为Mac用户提供原生的Jira客户端体验",
                  "scope": "支持Jira核心功能的原生macOS应用"
                },
                "businessValue": {
                  "problemStatement": "当前Web版Jira在macOS上用户体验不佳",
                  "expectedBenefits": ["提升用户体验", "增强团队协作效率", "减少上下文切换"],
                  "roi": "预期提升团队效率20%"
                },
                "technicalApproach": {
                  "keyTechnologies": ["Swift", "SwiftUI", "Jira REST API"],
                  "innovationPoints": ["原生macOS体验", "离线支持", "快捷键优化"],
                  "architecture": "MVVM架构模式，基于Combine框架"
                },
                "implementation": {
                  "timeline": "3个月MVP开发周期",
                  "resources": "2名iOS开发工程师",
                  "milestones": ["API集成完成", "核心UI实现", "测试发布"]
                },
                "riskAssessment": {
                  "majorRisks": ["Jira API变更", "用户接受度", "性能优化"],
                  "mitigationStrategies": ["API版本兼容", "用户反馈迭代", "性能测试"]
                }
              }
            }
          }
        }
      }
    }
  ]
}
```

---

**记住**: 通过正确的JSON格式和taskComplete工具调用，确保你的工作成果能够被系统准确处理并传递给下一个环节。 