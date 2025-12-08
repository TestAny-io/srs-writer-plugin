# 文档媒体资源规范指南

本指南帮助 Content Writer 了解如何在文档中正确添加图片和视频，以确保文档能够直接迁移到 docs.testany.io 使用。

---

## 目录结构

在 `user-guide/drafts/` 目录下工作时，请按以下结构组织文件：

```
user-guide/drafts/
├── zh/                          # 中文文档
│   ├── your-document.md
│   └── ...
├── en/                          # 英文文档
│   ├── your-document.md
│   └── ...
└── images/                      # 图片资源
    ├── zh/                      # 中文文档使用的图片
    │   └── image-YYYYMMDD-HHMMSS_xxxxxxxx.png
    └── en/                      # 英文文档使用的图片
        └── image-YYYYMMDD-HHMMSS_xxxxxxxx.png
```

---

## 图片规范

### 1. 图片存放位置

- **中文文档图片**：存放在 `user-guide/drafts/images/zh/` 目录
- **英文文档图片**：存放在 `user-guide/drafts/images/en/` 目录

### 2. 图片命名规范

使用以下格式命名图片文件：

```
image-YYYYMMDD-HHMMSS_xxxxxxxx.png
```

- `YYYYMMDD`：日期（如 `20250108`）
- `HHMMSS`：时间（如 `143025`）
- `xxxxxxxx`：8位十六进制随机字符（如 `9a40ffad`）

**示例**：
- `image-20250108-143025_9a40ffad.png`
- `image-20250108-143512_b2773958.png`

**生成随机后缀的方法**：
```bash
# macOS/Linux
openssl rand -hex 4
# 输出示例: 9a40ffad
```

### 3. 在文档中引用图片

使用 Markdown 标准图片语法，路径使用 `../images/{语言}/` 格式：

**中文文档中引用**：
```markdown
![图片描述](../images/zh/image-20250108-143025_9a40ffad.png)
```

**英文文档中引用**：
```markdown
![Image description](../images/en/image-20250108-143025_9a40ffad.png)
```

### 4. 图片引用示例

```markdown
1. 点击左侧导航栏中的"Gatekeeper"标签。

   ![image-20240113-092126.png](../images/zh/image-20240113-092126_9a40ffad.png)

2. 点击右上角的"创建 Gatekeeper"按钮，弹出创建向导：

   ![image-20240113-092434.png](../images/zh/image-20240113-092434_b2773958.png)
```

---

## 视频规范

### 1. 视频托管平台

所有视频必须上传到 **Cloudflare Stream**，获取视频 ID。

视频 ID 格式：32位十六进制字符串
**示例**：`f64862f9366a9ba83d27ce7fe05e7a46`

### 2. 在文档中嵌入视频

使用特殊的 directive 语法：

```markdown
::video[视频ID]
```

**示例**：
```markdown
::video[f64862f9366a9ba83d27ce7fe05e7a46]
```

### 3. AI 配音声明

如果视频使用了 **AI 生成的配音**，必须在视频下方添加声明：

**英文文档**：
```markdown
::video[f64862f9366a9ba83d27ce7fe05e7a46]

*Note: The voice in this video is AI-generated, not original.*
```

**中文文档**：
```markdown
::video[f64862f9366a9ba83d27ce7fe05e7a46]

*注：本视频中的语音由 AI 生成，非原声配音。*
```

### 4. 视频放置位置

通常将视频放在章节标题下方、正文内容之前：

```markdown
## 功能介绍

本节介绍 Gatekeeper 的基本功能和使用场景。

::video[f64862f9366a9ba83d27ce7fe05e7a46]

*注：本视频中的语音由 AI 生成，非原声配音。*

### 功能概述

Gatekeeper 允许用户...
```

---

## 完整文档示例

```markdown
---
title: "管理测试 Gatekeeper"
slug: "managing-test-gatekeeper"
language: "zh"
source: "/docs/managing-test-gatekeeper"
crawled_at: "2025-01-08 10:06:12"
section: "execution"
sectionTitle: "Test Execution"
sectionTitleZh: "测试执行"
sectionOrder: 8
order: 4
---

## Gatekeeper 简介

在快节奏的软件开发环境中，效率和响应能力至关重要。Gatekeeper 是 Testany 平台的一项功能，允许用户通过 webhook 触发特定的测试组。

::video[f64862f9366a9ba83d27ce7fe05e7a46]

*注：本视频中的语音由 AI 生成，非原声配音。*

## 设置 Gatekeeper

创建 Gatekeeper 只需几个简单步骤：

1. **创建 Gatekeeper：**

   1. 如果您是工作区成员，可以在左侧导航栏看到"Gatekeeper"标签。点击它进入 Gatekeeper 页面。

      ![image-20240113-092126.png](../images/zh/image-20240113-092126_9a40ffad.png)

   2. 点击右上角的"创建 Gatekeeper"按钮，弹出创建向导：

      ![image-20240113-092434.png](../images/zh/image-20240113-092434_b2773958.png)
```

---

## 迁移到 docs.testany.io

当文档准备好迁移时，只需：

1. 将 `zh/` 目录下的 `.md` 文件复制到 `docs.testany.io/public/docs/zh/`
2. 将 `en/` 目录下的 `.md` 文件复制到 `docs.testany.io/public/docs/en/`
3. 将 `images/zh/` 目录下的图片复制到 `docs.testany.io/public/docs/images/zh/`
4. 将 `images/en/` 目录下的图片复制到 `docs.testany.io/public/docs/images/en/`

由于路径格式一致（`../images/{语言}/`），文档无需任何修改即可正常显示。

---

## 注意事项

1. **图片格式**：推荐使用 PNG 格式，确保清晰度
2. **图片尺寸**：建议宽度不超过 1200px，避免文件过大
3. **Alt 文本**：图片的 alt 文本可以使用文件名或简短描述
4. **视频 ID**：确保从 Cloudflare Stream 正确复制视频 ID，不要遗漏字符
5. **中英文分离**：中文和英文文档的图片应分别存放，即使内容相同
6. **命名一致性**：同一张图片在中英文版本中可以使用相同的文件名（只是存放目录不同）

---

## 快速参考

| 资源类型 | 语法 | 示例 |
|---------|------|------|
| 图片（中文） | `![描述](../images/zh/文件名.png)` | `![截图](../images/zh/image-20250108-143025_9a40ffad.png)` |
| 图片（英文） | `![description](../images/en/文件名.png)` | `![screenshot](../images/en/image-20250108-143025_9a40ffad.png)` |
| 视频 | `::video[视频ID]` | `::video[f64862f9366a9ba83d27ce7fe05e7a46]` |
| AI 配音声明（中） | `*注：本视频中的语音由 AI 生成，非原声配音。*` | - |
| AI 配音声明（英） | `*Note: The voice in this video is AI-generated, not original.*` | - |
