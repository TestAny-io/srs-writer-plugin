# Templates 目录

此目录用于存放SRS Writer Plugin的文档模板和生成模板。

## 目录结构说明

```
templates/
├── README.md                 # 本说明文件
├── srs-documents/           # SRS文档模板
│   ├── standard-srs.yml    # 标准SRS模板
│   ├── agile-srs.yml       # 敏捷开发SRS模板
│   ├── web-app-srs.yml     # Web应用SRS模板
│   ├── mobile-app-srs.yml  # 移动应用SRS模板
│   └── api-srs.yml         # API项目SRS模板
├── sections/               # 章节模板
│   ├── introduction.yml    # 引言章节模板
│   ├── requirements.yml    # 需求章节模板
│   ├── interfaces.yml      # 接口章节模板
│   └── appendices.yml      # 附录章节模板
├── requirements/           # 需求模板
│   ├── functional.yml      # 功能需求模板
│   ├── non-functional.yml  # 非功能需求模板
│   ├── user-stories.yml    # 用户故事模板
│   └── acceptance-criteria.yml # 验收标准模板
├── formats/               # 输出格式模板
│   ├── markdown.hbs       # Markdown输出模板
│   ├── html.hbs          # HTML输出模板
│   ├── docx.hbs          # Word文档模板
│   └── pdf.hbs           # PDF输出模板
└── prompts/              # AI提示词模板
    ├── analysis.hbs      # 需求分析提示词
    ├── generation.hbs    # 文档生成提示词
    ├── review.hbs        # 文档审查提示词
    └── improvement.hbs   # 改进建议提示词
```

## 模板文件格式

### YAML模板格式
```yaml
# 模板元信息
template:
  name: "模板名称"
  version: "1.0"
  description: "模板描述"
  author: "作者"
  tags: ["标签1", "标签2"]

# 模板内容
content:
  # 具体模板结构
```

### Handlebars模板格式
```handlebars
{{!-- 模板注释 --}}
{{#with document}}
  <h1>{{title}}</h1>
  {{#each sections}}
    <h2>{{title}}</h2>
    <p>{{content}}</p>
  {{/each}}
{{/with}}
```

## 模板类型

### 1. 文档模板
- **标准SRS模板**: 基于IEEE 830标准的完整SRS文档模板
- **敏捷SRS模板**: 适用于敏捷开发的轻量级SRS模板
- **领域特定模板**: 针对特定行业或应用类型的SRS模板

### 2. 章节模板
- **引言模板**: 文档目的、范围、定义等标准章节
- **需求模板**: 功能需求、非功能需求的标准格式
- **接口模板**: 用户界面、硬件接口、软件接口模板

### 3. 需求模板
- **功能需求**: 系统功能描述的标准格式
- **非功能需求**: 性能、安全、可用性等需求模板
- **用户故事**: 敏捷开发中的用户故事格式

### 4. 输出格式模板
- **Markdown**: 轻量级标记语言输出
- **HTML**: 网页格式输出
- **Word文档**: 传统文档格式
- **PDF**: 便携式文档格式

## 模板变量

模板支持以下变量类型：

### 文档变量
- `{{document.title}}` - 文档标题
- `{{document.version}}` - 文档版本
- `{{document.author}}` - 文档作者
- `{{document.createdAt}}` - 创建时间

### 项目变量
- `{{project.name}}` - 项目名称
- `{{project.description}}` - 项目描述
- `{{project.stakeholders}}` - 项目干系人

### 需求变量
- `{{requirements}}` - 需求列表
- `{{functionalRequirements}}` - 功能需求
- `{{nonFunctionalRequirements}}` - 非功能需求

### 自定义变量
- 支持用户自定义变量
- 支持条件渲染
- 支持循环渲染

## 使用方式

### 1. 选择模板
```typescript
const template = await templateManager.getTemplate('standard-srs');
```

### 2. 渲染模板
```typescript
const content = await template.render({
  document: documentData,
  project: projectData,
  requirements: requirementsData
});
```

### 3. 自定义模板
```typescript
const customTemplate = {
  name: 'my-custom-template',
  content: '...',
  variables: {...}
};
await templateManager.registerTemplate(customTemplate);
```

## 模板开发指南

### 1. 创建新模板
1. 选择合适的模板类型和格式
2. 定义模板结构和变量
3. 编写模板内容
4. 添加模板元信息
5. 测试模板渲染效果

### 2. 模板最佳实践
- 保持模板结构清晰
- 使用有意义的变量名
- 添加必要的注释
- 提供模板使用示例
- 确保模板的可复用性

### 3. 模板验证
- 语法正确性检查
- 变量完整性验证
- 输出格式验证
- 兼容性测试

## 扩展与自定义

### 1. 自定义模板
用户可以创建自己的模板文件，系统会自动识别和加载。

### 2. 模板继承
支持模板继承，可以基于现有模板创建新模板。

### 3. 动态模板
支持运行时动态生成和修改模板。

### 4. 模板市场
计划支持模板分享和下载功能。

## 注意事项

- 模板文件应遵循统一的命名规范
- 重要模板变更需要版本管理
- 建议对模板文件进行备份
- 自定义模板应保持向后兼容性 