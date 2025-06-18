# Rules 目录

此目录用于存放SRS Writer Plugin的业务规则和配置文件。

## 目录结构说明

```markdown
rules/
├── README.md                 # 本说明文件
├── srs-standards/           # SRS标准和规范
│   ├── ieee-830.json       # IEEE 830标准配置
│   ├── iso-25010.json      # ISO 25010质量模型
│   └── custom-templates.json # 自定义模板规则
├── validation/              # 验证规则
│   ├── requirement-rules.json    # 需求验证规则
│   ├── document-structure.json   # 文档结构验证
│   └── naming-conventions.json   # 命名规范
├── prompts/                 # AI提示词规则
│   ├── system-prompts.json      # 系统提示词
│   ├── context-rules.json       # 上下文规则
│   └── response-templates.json  # 响应模板
└── localization/           # 本地化规则
    ├── zh-CN.json          # 中文本地化
    ├── en-US.json          # 英文本地化
    └── template-i18n.json  # 模板国际化
```

## 规则文件格式

所有规则文件都采用JSON格式，具有以下通用结构：

```json
{
  "version": "1.0",
  "name": "规则名称",
  "description": "规则描述",
  "rules": {
    // 具体规则内容
  },
  "metadata": {
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "author": "规则作者"
  }
}
```

## 使用方式

1. **标准规则**: 系统会自动加载标准规则文件
2. **自定义规则**: 用户可以创建自定义规则文件
3. **规则优先级**: 自定义规则会覆盖标准规则
4. **动态加载**: 支持运行时动态加载和更新规则

## 规则类型

### 1. SRS标准规则

- 文档结构标准
- 需求分类规则
- 质量属性定义

### 2. 验证规则

- 需求完整性检查
- 一致性验证
- 可追溯性检查

### 3. 生成规则

- 模板生成规则
- 格式化规则
- 输出规则

### 4. AI交互规则

- 提示词模板
- 上下文管理
- 响应处理

## 扩展指南

如需添加新的业务规则：

1. 在相应的子目录中创建规则文件
2. 遵循统一的JSON格式
3. 在相关代码中注册和使用规则
4. 编写相应的测试用例

## 注意事项

- 规则文件应保持向后兼容
- 修改规则时需要更新版本号
- 重要规则变更需要文档说明
- 建议对规则文件进行版本控制
