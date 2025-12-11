# SRS Writer - AI-Powered Requirements Engineering

> **Turn conversations into a deliverable requirements package in hours, not weeks.**

---

## 🎬 See It In Action

[📺 Watch 2-Minute Demo Video](#) *(Recording in progress)*

![SRS Writer Demo](../../materials/screenshots/demo-overview.png) *(Screenshot placeholder)*

---

## What is SRS Writer?

SRS Writer is a **VS Code extension** that orchestrates 16+ specialists to deliver a complete requirements package (`SRS.md`, `requirements.yaml`, `prototype/`, and session logs) through chat.

**Without SRS Writer**:
- You handcraft structure, quality review, and traceability
- Notes and drafts stay scattered and easy to miss
- Switching projects breaks templates and consistency

**With SRS Writer**:
- ✅ Ship a review-ready requirements package in hours
- ✅ IEEE 830-aligned structure from built-in templates
- ✅ Quality review, syntax checks, and traceability matrix handled automatically
- ✅ Safe semantic edits for ongoing updates

---

## 💬 How It Works

**1. Mention `@srs-writer` in the Chat panel**

```
@srs-writer Need a task management system where users create tasks,
assign them, and track progress
```

**2. The orchestrator builds a plan**
- Detects greenfield vs. brownfield scenarios
- Plans tool calls and specialists to involve
- Auto-loads existing context (`SRS.md`, `requirements.yaml`, `source_draft.md`)

**3. Specialists execute**
- `project_initializer` creates the project folder, Git scaffold, and base files
- Content specialists write each chapter (FR/NFR/IFR/DAR/prototype/risk/summary)
- `srs_reviewer` produces a quality review with fixes
- Semantic editor applies SID-based edits safely

**4. Deliverables**
- `SRS.md` (Markdown)
- `requirements.yaml` (structured entities with IDs)
- `prototype/` (HTML/CSS/JS skeleton)
- Session & operation logs (`.session-log/`)

**That’s it.**

---

## ✨ Core Features

### 💬 Conversation + Plan Execution
Natural chat only—the orchestrator switches between chat Q&A, tool execution, and plan execution modes automatically.

### 📊 Built-in Quality & Syntax Checks
`srs_reviewer` audits structure, completeness, feasibility, and traceability; `syntaxChecker` validates Markdown/YAML (basic/standard/strict).

### 🔄 Safe Semantic Iterations
SID targeting plus the semantic edit engine enable precise insert/replace/delete and YAML key-path edits without collateral damage.

### 🧠 16+ Specialists
Content specialists for FR/NFR/IFR/DAR/prototype/risk/summary/etc., plus process specialists for project initialization, formatting, quality review, and Git operations.

### 🔌 Knowledge & Tool Integration (Optional)
Local knowledge search, enterprise RAG (`srs-writer.rag.enterprise.*`), optional internet search, and VSCode/MCP tool registration with exclude-keyword management.

### 📏 Standards & Templates
Ships with `.templates/` for chapters and IDs, `requirements.yaml` schema at `config/schemas/requirement-entity-schemas.yaml`, ready out of the box.

---

## 🚀 Quick Start (3 Steps)

**Step 1: Prerequisites**
- **VS Code 1.102+**
- **Git** and a **GitHub Copilot subscription** (uses VS Code LM APIs)

**Step 2: Install & Initialize a Workspace**
- After installing, Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)run **SRS Writer: Control Panel**
![srs CLI config](../images/zh/image-20251210-132901_0001.png)
- Or, click the **SRS Writer:** button located in the Status Bar to trigger the popup.
![srs statusbar config](../images/zh/image-20251210-130301_0001.png)
- Choose **Create Workspace & Initialize** 
![srs config Directory 1](../images/zh/image-20251210-133501_0001.png)
- Choose the parent directory in the prompt to initialize the project. The extension will automatically copy `.templates/`, create `.vscode/settings.json`, init Git (`main` + `wip`), and create `.session-log/` session files
![srs config Directory 2](../images/zh/image-20251210-133901_0001.png)
**Step 3: Generate the Docs**

**Open Chat Panel**

Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (macOS)
![srs in CLI](../images/zh/image-20251210-101516_0001.png)
**Start Conversation**
```
@srs-writer Build a requirements spec for a task management system...
```

**See Results**
- Specialists write `SRS.md`, `requirements.yaml`, and `prototype/` based on your request

**⏱️ Total Time: ~10 minutes**

**[Full Installation & Init Guide →]([approved]getting-started-installation.md)**

---

## 💡 Who Uses SRS Writer?

### 👔 Product Managers
Paste notes → structured SRS; automatic “requirement → use case → FR/NFR” traceability.

### 📊 Business Analysts
Rely on reviews, syntax checks, and traceability completion to avoid gaps and conflicts.

### 🏗️ System Architects
Template-backed chapters, entity ID rules, and semantic edits keep complex systems consistent.

### 👥 Development Teams
Turn user stories/backlog items into formal specs; validate changes via diff and session logs.

### 🏢 Enterprise Teams
Need project isolation, Git branch discipline, enterprise RAG, or MCP tool onboarding.

---

## 📚 Documentation

<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">

### 🚀 Getting Started
**10 minutes to your first doc**
- [Installation & Initialization]([approved]getting-started-installation.md)
- [First Document]([approved]getting-started-first-document.md)
- [Document Structure & Examples]([approved]getting-started-document-structure.md)
- [Conversation & Prompt Tips]([approved]getting-started-conversation-tips.md)

### 📖 Scenarios
**Handle real workflows**
- [Control Panel & Status Checks]([approved]scenario-control-panel.md)
- [Import Existing Drafts]([approved]scenario-import-existing.md)
- [Update Requirements](scenario-update-requirements.md)
- [Multi-Project Switching](scenario-multi-project.md)
- [Quality Improvement](scenario-quality-improvement.md)

### ❓ Help & Support
**Find answers quickly**
- [FAQ]([approved]faq-common-questions.md)
- [Troubleshooting]([approved]faq-error-messages.md)
- [Get Help]([approved]faq-getting-help.md)

</div>

---

## 🌐 Language / 语言

📖 [English Documentation](home.md) | [中文文档](../zh/home.md)

---

## 📞 Support & Community

- 💬 [GitHub Discussions](https://github.com/Testany-io/srs-writer-plugin/discussions)
- 🐛 [Report Issues](https://github.com/Testany-io/srs-writer-plugin/issues)
- 📰 [Changelog](https://github.com/Testany-io/srs-writer-plugin/blob/main/CHANGELOG.md)
- ⭐ [Star on GitHub](https://github.com/Testany-io/srs-writer-plugin)

---

## 🎯 What's Next?

<div style="background: #f0f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0066cc;">

**New here?**
👉 Start with [Installation & Initialization]([approved]getting-started-installation.md)

**Already installed?**
👉 Try [Create Your First Document]([approved]getting-started-first-document.md)

**Want sharper outputs?**
👉 Read [Conversation & Prompt Tips]([approved]getting-started-conversation-tips.md)

</div>

---

**Version**: 0.8.2  
**Last Updated**: 2025-11-12  
**License**: Apache-2.0

---

**Built with ❤️ by [Testany.io](https://testany.io)**
