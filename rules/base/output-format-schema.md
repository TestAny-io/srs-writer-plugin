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

**🚀 推荐：使用语义编辑格式**：

```json
{
  "edit_instructions": [
    {
      "type": "replace_section",
      "target": {
        "sectionName": "功能需求",
        "position": "replace"
      },
      "content": "## 功能需求\n\n更新后的功能需求内容...",
      "reason": "更新功能需求章节内容",
      "priority": 1
    },
    {
      "type": "insert_after_section", 
      "target": {
        "sectionName": "系统边界",
        "position": "after"
      },
      "content": "## 新增章节\n\n新章节的内容...",
      "reason": "在系统边界后添加新章节",
      "priority": 2
    }
  ]
}
```

**语义编辑指令格式**：

- **`type`**: 编辑类型
  - `"replace_section"`: 替换整个章节
  - `"insert_after_section"`: 在章节后插入新内容
  - `"insert_before_section"`: 在章节前插入新内容
  - `"append_to_list"`: 追加到列表内容
  - `"update_subsection"`: 更新子章节
  - 🚀 **行内编辑类型**:
    - `"update_content_in_section"`: 更新章节内特定内容
    - `"insert_line_in_section"`: 在章节内插入新行
    - `"remove_content_in_section"`: 删除章节内特定内容
    - `"append_to_section"`: 在章节末尾追加内容
    - `"prepend_to_section"`: 在章节开头插入内容
- **`target`**: 目标位置
  - `sectionName`: 目标章节名称（如"功能需求"、"系统架构"）
  - `subsection`: 子章节名称（可选）
  - `position`: 位置类型（`"before"`、`"after"`、`"replace"`、`"append"`）
  - 🚀 **行内编辑定位字段**（可选）:
    - `targetContent`: 要修改/删除的目标内容
    - `afterContent`: 在此内容之后插入
    - `beforeContent`: 在此内容之前插入
    - `contentToRemove`: 要删除的具体内容
- **`content`**: 要插入或替换的内容
- **`reason`**: 编辑原因说明
- **`priority`**: 优先级（数字越大优先级越高，可选，默认0）

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

### 🚀 语义编辑操作详解（推荐）

#### 1. replace_section - 替换整个章节

```json
{
  "type": "replace_section",
  "target": {
    "sectionName": "功能需求",
    "position": "replace"
  },
  "content": "## 功能需求\n\n### 用户管理\n- 用户注册\n- 用户登录\n- 密码重置\n",
  "reason": "更新功能需求章节，添加用户管理功能",
  "priority": 1
}
```

#### 2. insert_after_section - 在章节后插入

```json
{
  "type": "insert_after_section",
  "target": {
    "sectionName": "系统架构",
    "position": "after"
  },
  "content": "\n## 数据库设计\n\n### 用户表\n- 用户ID\n- 用户名\n- 邮箱\n",
  "reason": "在系统架构后添加数据库设计章节",
  "priority": 2
}
```

#### 3. insert_before_section - 在章节前插入

```json
{
  "type": "insert_before_section",
  "target": {
    "sectionName": "附录",
    "position": "before"
  },
  "content": "\n## 术语表\n\n- **API**: 应用程序编程接口\n- **SRS**: 软件需求规格说明书\n",
  "reason": "在附录前添加术语表",
  "priority": 1
}
```

#### 4. append_to_list - 追加到列表

```json
{
  "type": "append_to_list",
  "target": {
    "sectionName": "功能特性",
    "position": "append"
  },
  "content": "- 数据导出功能\n- 报表生成功能\n",
  "reason": "向功能特性列表追加新功能",
  "priority": 1
}
```

#### 5. update_subsection - 更新子章节

```json
{
  "type": "update_subsection", 
  "target": {
    "sectionName": "非功能需求",
    "subsection": "性能要求",
    "position": "replace"
  },
  "content": "### 性能要求\n\n- 响应时间小于200ms\n- 并发用户数支持1000+\n- 系统可用性99.9%\n",
  "reason": "更新性能要求的具体指标",
  "priority": 2
}
```

### 🚀 行内编辑操作（高级功能）

**行内编辑专门用于更精细的内容修改，比如修改章节内的特定文本、在特定位置插入内容等。**

#### 6. update_content_in_section - 更新章节内特定内容

```json
{
  "type": "update_content_in_section",
  "target": {
    "sectionName": "用户旅程1",
    "targetContent": "平角裤",
    "position": "replace"
  },
  "content": "三角裤",
  "reason": "更正产品名称",
  "priority": 1
}
```

#### 7. insert_line_in_section - 在章节内插入新行

```json
{
  "type": "insert_line_in_section",
  "target": {
    "sectionName": "功能列表",
    "afterContent": "- 用户登录功能",
    "position": "after"
  },
  "content": "- 密码重置功能",
  "reason": "在用户登录功能后添加密码重置功能",
  "priority": 1
}
```

#### 8. remove_content_in_section - 删除章节内特定内容

```json
{
  "type": "remove_content_in_section",
  "target": {
    "sectionName": "已废弃功能",
    "contentToRemove": "- 旧版本兼容性支持",
    "position": "remove"
  },
  "reason": "删除已废弃的功能项",
  "priority": 1
}
```

#### 9. append_to_section - 在章节末尾追加内容

```json
{
  "type": "append_to_section",
  "target": {
    "sectionName": "系统架构",
    "position": "append"
  },
  "content": "\n### 缓存策略\n\n系统采用Redis进行数据缓存，提升查询性能。",
  "reason": "在系统架构章节末尾添加缓存策略说明",
  "priority": 1
}
```

#### 10. prepend_to_section - 在章节开头插入内容

```json
{
  "type": "prepend_to_section",
  "target": {
    "sectionName": "安全要求",
    "position": "prepend"
  },
  "content": "**重要提醒**: 本节涉及系统安全核心要求，请仔细阅读。\n\n",
  "reason": "在安全要求章节开头添加重要提醒",
  "priority": 1
}
```

### 🎯 行内编辑目标定位字段

行内编辑使用以下字段进行精确定位：

- **`targetContent`**: 要修改/删除的目标内容（用于`update_content_in_section`和`remove_content_in_section`）
- **`afterContent`**: 在此内容之后插入（用于`insert_line_in_section`）
- **`beforeContent`**: 在此内容之前插入
- **`contentToRemove`**: 要删除的具体内容（用于`remove_content_in_section`）

### 🔄 行内编辑vs章节编辑选择指南

| 使用场景 | 推荐编辑类型 | 原因 |
|----------|-------------|------|
| 修改整个章节内容 | `replace_section` | 高效，适合大规模改动 |
| 修改章节内某个词语 | `update_content_in_section` | 精确，避免误修改其他内容 |
| 在章节间插入新章节 | `insert_after_section` | 结构性添加 |
| 在章节内插入新段落 | `insert_line_in_section` | 保持章节结构完整 |
| 删除整个章节 | `replace_section` + 空内容 | 结构性删除 |
| 删除章节内特定内容 | `remove_content_in_section` | 精确删除，保持其他内容不变 |


##### 插入新章节
```json
{
  "action": "insert",
  "lines": [25],
  "content": "\n## 2.4 集成要求\n\n系统需要与以下外部系统集成：\n- 第三方支付系统\n- 用户认证服务\n",
  "reason": "添加集成要求章节"
}
```

##### 替换现有内容
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
4. **语义编辑时sectionName不准确或不存在**
5. **混用语义编辑和传统编辑格式**
6. **JSON格式错误或不完整**

### ✅ 最佳实践

#### 🚀 语义编辑最佳实践

1. **优先使用语义编辑格式** - 更安全、更强大
2. **准确的章节名称** - 确保sectionName与文档中的标题完全匹配
3. **合理设置优先级** - 使用priority确保编辑顺序
4. **清晰的编辑意图** - 选择正确的type（replace_section、insert_after_section等）
5. **详细的reason说明** - 解释为什么进行这个编辑操作

#### 📝 通用最佳实践

1. **总是使用完整的JSON格式输出**
2. **总是包含taskComplete工具调用**
3. **明确设置requires_file_editing字段**
4. **确保content内容包含正确的Markdown格式**
5. **structuredData与content内容保持一致**

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

### Summary Writer完整输出示例（语义编辑版本）🚀

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
                "type": "insert_after_section",
                "target": {
                  "sectionName": "项目基本信息",
                  "position": "after"
                },
                "content": "\n## Executive Summary\n\n### 项目概述\nJiraMacClient是一个原生macOS客户端应用，旨在为Mac用户提供更优秀的Jira使用体验。该项目致力于解决当前基于Web的Jira界面在macOS平台上用户体验不佳的问题。\n\n### 业务价值\n解决当前基于Web的Jira界面在macOS上用户体验不佳的问题，通过提供原生应用体验来提升团队协作效率。预期可以提升团队工作效率20%，减少用户在不同工具间的上下文切换。\n\n### 技术方案\n采用Swift和SwiftUI构建原生macOS应用，通过Jira REST API实现数据同步。基于MVVM架构模式和Combine框架，确保代码可维护性和性能优化。\n\n### 实施计划\n预计3个月完成MVP版本，包括核心功能开发、测试和发布。分为三个主要里程碑：API集成完成、核心UI实现、测试发布。\n\n### 风险评估\n主要风险包括Jira API变更和用户接受度问题。将通过API版本兼容性设计和持续的用户反馈迭代来缓解这些风险。",
                "reason": "在项目基本信息后添加Executive Summary章节，提供项目整体概览",
                "priority": 1
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

### FR Writer语义编辑示例

```json
{
  "tool_calls": [
    {
      "name": "taskComplete", 
      "args": {
        "completionType": "READY_FOR_NEXT",
        "nextStepType": "HANDOFF_TO_SPECIALIST",
        "summary": "已完成功能需求章节的语义编辑更新，新增用户管理和项目管理功能",
        "deliverables": ["功能需求章节更新", "用户故事定义", "验收标准"],
        "contextForNext": {
          "projectState": {
            "requires_file_editing": true,
            "edit_instructions": [
              {
                "type": "replace_section",
                "target": {
                  "sectionName": "功能需求",
                  "position": "replace"
                },
                "content": "## 功能需求\n\n### 用户管理功能\n\n#### FR-001 用户注册\n**描述**: 新用户可以创建账户来访问系统\n**优先级**: Must-have\n**验收标准**:\n- 用户可以使用邮箱注册\n- 密码必须符合安全要求\n- 注册成功后发送确认邮件\n\n#### FR-002 用户登录\n**描述**: 已注册用户可以登录系统\n**优先级**: Must-have\n**验收标准**:\n- 支持邮箱/用户名登录\n- 记住登录状态\n- 登录失败3次后锁定账户\n\n### 项目管理功能\n\n#### FR-003 项目创建\n**描述**: 用户可以创建新的项目空间\n**优先级**: Must-have\n**验收标准**:\n- 必须提供项目名称和描述\n- 自动生成项目唯一标识\n- 创建者自动成为项目管理员",
                "reason": "更新功能需求章节，添加详细的功能规格和验收标准",
                "priority": 1
              },
              {
                "type": "insert_after_section",
                "target": {
                  "sectionName": "功能需求",
                  "position": "after"
                },
                "content": "\n## 功能优先级矩阵\n\n| 功能ID | 功能名称 | 优先级 | 复杂度 | 预估工期 |\n|--------|----------|---------|---------|----------|\n| FR-001 | 用户注册 | Must-have | Medium | 3天 |\n| FR-002 | 用户登录 | Must-have | Low | 2天 |\n| FR-003 | 项目创建 | Must-have | High | 5天 |",
                "reason": "在功能需求后添加优先级矩阵，便于开发规划",
                "priority": 2
              }
            ],
            "target_file": "SRS.md",
            "content": "功能需求章节内容...",
            "structuredData": {
              "type": "FunctionalFeatures",
              "data": {
                "features": [
                  {
                    "id": "FR-001",
                    "name": "用户注册",
                    "description": "新用户可以创建账户来访问系统",
                    "priority": "must-have",
                    "acceptanceCriteria": ["用户可以使用邮箱注册", "密码必须符合安全要求"]
                  }
                ]
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