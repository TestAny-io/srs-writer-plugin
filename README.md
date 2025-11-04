# SRS Writer

<div align="center">

![SRS Writer Logo](https://img.shields.io/badge/SRS-Writer-blue?style=for-the-badge&logo=visual-studio-code)
[![Version](https://img.shields.io/visual-studio-marketplace/v/Testany.srs-writer-plugin?style=for-the-badge&label=Version)](https://marketplace.visualstudio.com/items?itemName=Testany.srs-writer-plugin)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=for-the-badge)](https://opensource.org/licenses/Apache-2.0)
[![VSCode](https://img.shields.io/badge/VSCode-1.102+-blue?style=for-the-badge&logo=visual-studio-code)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![DeepWiki](https://img.shields.io/badge/DeepWiki-TestAny--io%2Fsrs--writer--plugin-blue.svg?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAYAAAAnWDnqAAAAAXNSR0IArs4c6QAAA05JREFUaEPtmUtyEzEQhtWTQyQLHNak2AB7ZnyXZMEjXMGeK/AIi+QuHrMnbChYY7MIh8g01fJoopFb0uhhEqqcbWTp06/uv1saEDv4O3n3dV60RfP947Mm9/SQc0ICFQgzfc4CYZoTPAswgSJCCUJUnAAoRHOAUOcATwbmVLWdGoH//PB8mnKqScAhsD0kYP3j/Yt5LPQe2KvcXmGvRHcDnpxfL2zOYJ1mFwrryWTz0advv1Ut4CJgf5uhDuDj5eUcAUoahrdY/56ebRWeraTjMt/00Sh3UDtjgHtQNHwcRGOC98BJEAEymycmYcWwOprTgcB6VZ5JK5TAJ+fXGLBm3FDAmn6oPPjR4rKCAoJCal2eAiQp2x0vxTPB3ALO2CRkwmDy5WohzBDwSEFKRwPbknEggCPB/imwrycgxX2NzoMCHhPkDwqYMr9tRcP5qNrMZHkVnOjRMWwLCcr8ohBVb1OMjxLwGCvjTikrsBOiA6fNyCrm8V1rP93iVPpwaE+gO0SsWmPiXB+jikdf6SizrT5qKasx5j8ABbHpFTx+vFXp9EnYQmLx02h1QTTrl6eDqxLnGjporxl3NL3agEvXdT0WmEost648sQOYAeJS9Q7bfUVoMGnjo4AZdUMQku50McDcMWcBPvr0SzbTAFDfvJqwLzgxwATnCgnp4wDl6Aa+Ax283gghmj+vj7feE2KBBRMW3FzOpLOADl0Isb5587h/U4gGvkt5v60Z1VLG8BhYjbzRwyQZemwAd6cCR5/XFWLYZRIMpX39AR0tjaGGiGzLVyhse5C9RKC6ai42ppWPKiBagOvaYk8lO7DajerabOZP46Lby5wKjw1HCRx7p9sVMOWGzb/vA1hwiWc6jm3MvQDTogQkiqIhJV0nBQBTU+3okKCFDy9WwferkHjtxib7t3xIUQtHxnIwtx4mpg26/HfwVNVDb4oI9RHmx5WGelRVlrtiw43zboCLaxv46AZeB3IlTkwouebTr1y2NjSpHz68WNFjHvupy3q8TFn3Hos2IAk4Ju5dCo8B3wP7VPr/FGaKiG+T+v+TQqIrOqMTL1VdWV1DdmcbO8KXBz6esmYWYKPwDL5b5FA1a0hwapHiom0r/cKaoqr+27/XcrS5UwSMbQAAAABJRU5ErkJggg==)](https://deepwiki.com/TestAny-io/srs-writer-plugin)

**AI-Powered Requirements Engineering**

[Quick Start](#-quick-start) • [Features](#-features) • [Use Cases](#-use-cases) • [Documentation](#-documentation)

</div>

---

## What is SRS Writer?

SRS Writer is an **AI-powered requirements engineering assistant** that lives in your VSCode editor. It transforms natural language conversations or existing documents into professional Software Requirements Specification (SRS) documents with full traceability, automated quality checks, and interactive prototypes.

**Instead of spending weeks writing requirements manually**, just describe your project in plain language or give it an existing document, even a draft. A team of specialized AI agents will collaborate to create comprehensive, IEEE 830-compliant documentation in minutes.

### Why SRS Writer?

| Traditional Approach | With SRS Writer |
|---------------------|-----------------|
| 📝 Weeks of manual writing | ⚡ **10-20x faster** with AI assistance |
| 🤷 Inconsistent quality | ✅ **Built-in quality checks** (7-dimensional scoring) |
| 📊 Complex tools (DOORS, Jama) | 🎯 **Simple VSCode chat** interface |
| 🔗 Manual traceability | 🤖 **Automatic** requirement linking |
| 📄 Documents out of sync | 🔄 **Bidirectional sync** (Markdown ↔ YAML) |
| 🎨 No prototypes | 🖼️ **Interactive HTML prototypes** from requirements |

---

## ✨ Key Features

### 🤖 Multi-Agent Specialist System

Unlike generic AI assistants, SRS Writer uses a **team of 17+ specialized agents**, each expert in different aspects of requirements engineering:

**Content Specialists** (11+):
- 📋 **Summary Writer** - Executive summaries and project overviews
- 📖 **Overall Description Writer** - System context and environment
- 👤 **User Story Writer** - Agile user stories with acceptance criteria
- 🗺️ **User Journey Writer** - User experience flows and scenarios
- 🎯 **Use Case Writer** - Detailed interaction scenarios
- ⚙️ **Functional Requirements Writer** - Feature specifications (FR-xxx)
- 🚀 **Non-Functional Requirements Writer** - Performance, security, scalability (NFR-xxx)
- 🔌 **Interface Requirements Writer** - API and integration specs (IFR-xxx)
- 💾 **Data Requirements Writer** - Data models and storage (DAR-xxx)
- 📐 **Business Requirements Writer** - Business rules and constraints
- 🎨 **Prototype Designer** - Interactive HTML/CSS/JS prototypes

**Process Specialists** (4+):
- 🚀 **Project Initializer** - Workspace setup and Git integration
- 🔍 **SRS Reviewer** - Quality assessment and compliance checking
- 📝 **Document Formatter** - Professional formatting and structure
- 🔧 **Git Operator** - Version control automation

### 📊 Complete Document Lifecycle

From initial concept to final deliverables:

```
💬 Conversation / Existing Document → 📋 SRS.md → 📄 requirements.yaml → 🎨 Prototype → ✅ Quality Review
```

**What You Get:**

1. **SRS.md** - Professional markdown document with:
   - Executive summary
   - System overview and context
   - User stories, journeys, and use cases
   - Functional and non-functional requirements
   - Interface and data specifications
   - Architecture decisions and constraints

2. **requirements.yaml** - Structured data with:
   - Automatic entity ID extraction (US-xxx, UC-xxx, FR-xxx, etc.)
   - Traceability relationships (which FRs derive from which user stories)
   - Machine-readable format for tooling integration

3. **Interactive Prototypes** - Production-ready HTML with:
   - Responsive design (mobile/tablet/desktop)
   - CSS variable-based theming
   - Interactive JavaScript behaviors
   - Professional styling

### 🎯 Intelligent Orchestration

The **Orchestrator** acts as your project manager:

- **Understands Intent** - Analyzes your request and creates execution plans
- **Coordinates Specialists** - Assigns tasks to the right agents
- **Handles Complexity** - Breaks down multi-step workflows automatically
- **Self-Corrects** - Uses multi-turn dialogue to refine outputs
- **Manages Context** - Maintains project state across conversations

### 🔍 Built-in Quality Assurance

**SRS Reviewer** performs comprehensive quality assessment:

| Dimension | What It Checks |
|-----------|---------------|
| 📐 **Structure** | IEEE 830 compliance, section completeness |
| 📊 **Completeness** | Missing requirements, coverage gaps |
| 🔄 **Consistency** | Contradictions, terminology alignment |
| 💬 **Clarity** | Ambiguity, testability, precision |
| ⚖️ **Feasibility** | Technical viability, resource constraints |
| 💼 **Business Value** | ROI, priority alignment |
| 🤖 **AI Quality** | Hallucination detection, factual accuracy |

**Scoring:** 0-10 scale for each dimension + overall quality score

**Syntax Checker:**
- Markdown linting (markdownlint integration)
- YAML validation (basic/standard/strict modes)
- Configurable rules

**Traceability Completion:**
- Automatic relationship mapping (US → UC → FR → NFR)
- Derived FR computation
- Cross-reference validation

### 🛠️ Advanced Editing Capabilities

**Semantic Document Editing:**
- **SID-based targeting** - Stable, content-based section identifiers
- **Structure-aware** - Maintains document hierarchy
- **Precise modifications** - Replace/insert/delete specific sections
- **Batch operations** - Multiple edits in one transaction

**YAML Editing:**
- **KeyPath operations** - Dot-notation targeting (`functional_requirements.0.priority`)
- **Three parse modes**:
  - `structure` - Explore keys only (90%+ token savings)
  - `content` - Values only (default)
  - `full` - Both structure and values
- **Targeted extraction** - Pull specific paths without reading entire file

### 🔌 Extensibility

**Model Context Protocol (MCP) Support:**
- Dynamic tool discovery from MCP servers
- Three-tier permission control (global/server/tool levels)
- Hot reload on configuration changes
- Enterprise knowledge base integration

**Template System:**
- Customizable section templates (`.md` or `.poml` files)
- Per-specialist template paths
- Professional formatting out of the box

**Multi-Project Workspace:**
- Isolated project contexts
- Git branch integration (`SRS/ProjectName`)
- Session persistence across VSCode restarts

---

## 🚀 Quick Start

### Prerequisites

- **VSCode 1.102+** with chat feature enabled
- **AI Provider:** GitHub Copilot

### Installation

1. Open VSCode Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for **"SRS Writer"**
3. Click **Install**

### First-Time Setup

After installation, initialize your workspace:

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **"SRS Writer: Control Panel"**
3. Select **"Create Workspace & Initialize"**
4. Choose parent directory and enter workspace name
5. SRS Writer will:
   - Create workspace directory
   - Copy `.templates/` folder with professional templates
   - Initialize Git repository with `.gitignore`
   - Create initial commit

**Your workspace is now ready!** Open it in VSCode to start creating SRS documents.

### Create Your First SRS in 3 Steps

**Step 1: Open Chat Panel**

Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (Mac)

**Step 2: Start Conversation**

```
@srs-writer I'm building a task management web app for development teams.
It needs sprint tracking, task assignments, time logging, and team dashboards.
```

**Step 3: Watch the Magic**

SRS Writer will:
1. 🤔 Analyze your requirements
2. 📋 Create execution plan (you can review/modify)
3. 🤖 Activate specialists to write each section
4. 📄 Generate SRS.md + requirements.yaml
5. ✅ Validate quality and traceability

---

## 💡 Use Cases

### 1️⃣ Greenfield Projects (Starting from Scratch)

**Perfect for:** New projects, MVP planning, client proposals

```
@srs-writer Create SRS for a mobile banking app with:
- User authentication (biometric + PIN)
- Account management (view balance, transactions)
- Transfers (internal + external)
- Bill payments
- Push notifications
```

**Result:** Complete SRS with user stories, use cases, functional/non-functional requirements, and prototype.

---

### 2️⃣ Brownfield Projects (Importing Existing Documents)

**Perfect for:** Standardizing legacy docs, importing from other tools

```
@srs-writer Start new project from my draft at /Users/me/docs/project-draft.md
```

SRS Writer will:
- Extract existing requirements
- Standardize format to IEEE 830
- Fill in missing sections
- Create structured YAML data

---

### 3️⃣ Agile → Traditional Documentation

**Perfect for:** Compliance requirements, enterprise delivery, RFP responses

```
@srs-writer We have 50 user stories in Jira. Create a formal SRS document
with functional requirements, use cases, and architecture decisions.
```

SRS Writer bridges Agile and traditional methodologies.

---

### 4️⃣ Iterative Refinement

**Perfect for:** Ongoing projects, change requests, feature additions

```
@srs-writer Update the authentication section to add OAuth 2.0
and social login (Google, Apple, Facebook)
```

**Semantic editing** precisely modifies specific sections without affecting the rest of the document.

---

### 5️⃣ Quality Audits

**Perfect for:** Pre-delivery reviews, compliance checks, quality gates

```
@srs-writer Review my SRS for IEEE 830 compliance and identify gaps
```

**7-dimensional scoring** highlights:
- Missing requirements
- Inconsistencies
- Ambiguous language
- Technical risks
- Business value misalignment

---

### 6️⃣ Prototype Generation

**Perfect for:** Stakeholder demos, design validation, user testing

```
@srs-writer Create an interactive prototype for the user dashboard screen
```

**Multi-stage dialogue:**
1. Confirm requirements
2. Design layout (wireframe)
3. Choose theme (colors, typography)
4. Add interactions (clicks, hovers)

**Output:** Production-ready HTML/CSS/JS with responsive design.

---

## 🎨 Chat Commands

| Command | Description | Example |
|---------|-------------|---------|
| `@srs-writer create` | Start new SRS document | `@srs-writer create an e-commerce platform` |
| `@srs-writer edit` | Modify existing document | `@srs-writer edit the login use case` |
| `@srs-writer review` | Quality assessment | `@srs-writer review my requirements` |
| `@srs-writer sync` | Update YAML from markdown | `@srs-writer sync requirements.yaml` |
| `@srs-writer prototype` | Generate interactive prototype | `@srs-writer prototype the checkout flow` |
| `@srs-writer help` | Show available commands | `@srs-writer help` |
| `@srs-writer new` | Start fresh conversation | `@srs-writer new` |

---

## 🏗️ How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     VSCode Chat Interface                    │
│                  "I need SRS for X project..."               │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   🧠 Orchestrator (AI)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Analyze intent (OODA Loop: Observe → Orient →     │  │
│  │    Decide → Act)                                     │  │
│  │ 2. Create execution plan (multi-step breakdown)      │  │
│  │ 3. Select specialists for each task                  │  │
│  │ 4. Coordinate execution (sequential or parallel)     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                ┌────────────┼────────────┐
                ▼            ▼            ▼
┌─────────────────────┬─────────────────┬──────────────────────┐
│  📝 Content         │  ⚙️ Process     │  🎨 Prototype        │
│  Specialists        │  Specialists    │  Designer            │
├─────────────────────┼─────────────────┼──────────────────────┤
│ • Summary Writer    │ • Project Init  │ • Layout Design      │
│ • FR Writer         │ • SRS Reviewer  │ • Theme Selection    │
│ • NFR Writer        │ • Req Syncer    │ • Interaction Design │
│ • User Story Writer │ • Git Operator  │ • HTML/CSS/JS Gen    │
│ • Use Case Writer   │ • Doc Formatter │                      │
│ • ... (12 total)    │ • ... (5 total) │                      │
└─────────────────────┴─────────────────┴──────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      🛠️ Tool Ecosystem                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • Markdown Editor (semantic SID-based targeting)     │  │
│  │ • YAML Editor (keyPath operations, parse modes)      │  │
│  │ • Scaffold Generator (extract entity IDs)            │  │
│  │ • Traceability Completer (relationship mapping)      │  │
│  │ • Syntax Checker (markdown lint + YAML validation)   │  │
│  │ • File Operations (read/write/create)                │  │
│  │ • Git Operations (branch, commit, push)              │  │
│  │ • MCP Tools (dynamic external tools)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    📊 Output Deliverables                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 📋 SRS.md              Professional markdown document │  │
│  │ 📄 requirements.yaml    Structured data with IDs      │  │
│  │ 🎨 prototype/          Interactive HTML prototypes   │  │
│  │ ✅ quality-report.md    7-dimensional assessment      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Execution Flow Example

**User Request:** *"Create SRS for an e-commerce platform"*

1. **Orchestrator** analyzes intent → Creates 5-step plan:
   ```
   Step 1: Initialize project structure
   Step 2: Generate system overview
   Step 3: Create user stories and use cases
   Step 4: Write functional requirements
   Step 5: Add non-functional requirements
   ```

2. **Project Initializer** (Process Specialist):
   - Creates `/my-ecommerce-project/` directory
   - Initializes `SRS.md` with template
   - Sets up Git branch `SRS/my-ecommerce-project`

3. **Overall Description Writer** (Content Specialist):
   - Reads project context
   - Generates system overview section
   - Writes to SRS.md using semantic edits

4. **User Story Writer** (Content Specialist):
   - Creates user stories (US-001, US-002, ...)
   - Adds acceptance criteria
   - Updates SRS.md

5. **Traceability Completer** (Tool):
   - Analyzes SRS + YAML
   - Computes relationships (US → UC → FR)
   - Updates `requirements.yaml` with `derivedFrom` mappings

6. **SRS Reviewer** (Process Specialist):
   - Performs 7-dimensional quality check
   - Generates quality report
   - Suggests improvements

---

## 🔧 Configuration

SRS Writer is highly customizable through VSCode settings:

### AI Orchestrator

```json
{
  "srsWriter.orchestrator.aiEnabled": true  // Enable AI orchestration mode
}
```

### Syntax Checker

```json
{
  "srsWriter.syntaxChecker.markdownMode": "standard",  // all | standard | no | custom
  "srsWriter.syntaxChecker.yamlLevel": "standard"      // basic | standard | strict
}
```

### Templates

```json
{
  "srsWriter.templates.summaryWriter": "${workspaceFolder}/.templates/summary.md",
  "srsWriter.templates.frWriter": "${workspaceFolder}/.templates/FR.md"
  // ... 11 configurable templates
}
```

### MCP Tools

```json
{
  "srsWriter.mcp.excludeKeywords": ["dangerous", "admin"]  // Filter MCP tools by keyword
}
```

### Knowledge Sources

```json
{
  "srsWriter.knowledge.localPaths": ["/path/to/enterprise/kb"],
  "srsWriter.knowledge.ragEndpoint": "https://rag.company.com/api"
}
```

---

## 📚 Documentation

### Learning Resources

- **Quick Start Guide** - Get started in 5 minutes
- **User Manual** - Comprehensive feature documentation
- **Specialist Guide** - Understanding each specialist's role
- **Tool Reference** - Available tools and their capabilities
- **Template Customization** - Creating custom templates
- **MCP Integration** - Connecting enterprise knowledge bases

### Support

- **GitHub Issues:** [Report bugs or request features](https://github.com/Testany-io/srs-writer-plugin/issues)
- **GitHub Discussions:** [Ask questions and share tips](https://github.com/Testany-io/srs-writer-plugin/discussions)
- **VSCode Marketplace:** [Reviews and ratings](https://marketplace.visualstudio.com/items?itemName=Testany.srs-writer-plugin)

---

## 🏆 What Makes SRS Writer Unique?

### vs. Manual SRS Writing

| Aspect | Manual | SRS Writer |
|--------|--------|------------|
| **Speed** | Weeks | Hours (**10-20x faster**) |
| **Quality** | Varies by author | Consistent (**7-dimensional checks**) |
| **Traceability** | Manual spreadsheets | Automatic (**computed relationships**) |
| **IEEE 830 Compliance** | Requires expertise | Built-in (**template-driven**) |
| **Prototype** | Separate tool | Integrated (**HTML/CSS/JS generation**) |

### vs. Generic AI Tools (ChatGPT, Claude)

| Aspect | Generic AI | SRS Writer |
|--------|------------|------------|
| **Specialization** | General purpose | **17+ domain experts** |
| **VSCode Integration** | Copy-paste | **Native chat participant** |
| **Structured Output** | Text only | **Markdown + YAML + HTML** |
| **Traceability** | Manual linking | **Automatic mapping** |
| **Quality Assurance** | None | **Built-in reviewer** |

### vs. Requirements Tools (DOORS, Jama)

| Aspect | Traditional Tools | SRS Writer |
|--------|-------------------|------------|
| **AI Content Generation** | ❌ None | ✅ **Full AI authoring** |
| **Complexity** | High (enterprise) | Low (**VSCode chat**) |
| **Cost** | $$$$ | $ (**VSCode extension**) |
| **Version Control** | Proprietary | **Git-friendly markdown** |
| **Prototype** | ❌ None | ✅ **Interactive HTML** |

---

## 🧑‍💻 Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/Testany-io/srs-writer-plugin.git
cd srs-writer-plugin

# Install dependencies
yarn install

# Development
yarn watch             # Hot reload during development
yarn build             # Production build
yarn test              # Run test suite
yarn package           # Create VSIX package

# Quality checks
yarn lint              # Code linting
yarn test:coverage     # Test coverage report
yarn test:integration  # Integration testing
```

### Contributing

We welcome contributions! Here are areas we'd love help with:

- 📝 **Additional Specialist Templates** - Create new content generation templates
- 🌐 **Internationalization (i18n)** - Add multi-language support
- 🧪 **Test Coverage** - Improve unit and integration tests
- 📚 **Documentation** - Write guides, tutorials, and examples
- 🐛 **Bug Fixes** - Report and fix issues
- ⚡ **Performance** - Optimize token usage and execution speed

**How to Contribute:**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Ensure all tests pass (`yarn test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

Please ensure your code follows the existing style and includes appropriate tests.

---

## 📄 License

**Apache License 2.0** - See [LICENSE](LICENSE) for details.

**Quick Summary:**
- ✅ Commercial use permitted
- ✅ Modification and distribution allowed
- ✅ Patent protection included
- ✅ Private use authorized
- ⚠️ Trademark use not permitted
- ⚠️ No warranty provided

---

<div align="center">

### Built with ❤️ for the Software Engineering Community

**Powered by Advanced Multi-Agent AI Architecture**

[⭐ Star on GitHub](https://github.com/Testany-io/srs-writer-plugin) • [🐛 Report Bug](https://github.com/Testany-io/srs-writer-plugin/issues) • [💡 Request Feature](https://github.com/Testany-io/srs-writer-plugin/issues) • [💬 Discussions](https://github.com/Testany-io/srs-writer-plugin/discussions)

[![GitHub Stars](https://img.shields.io/github/stars/Testany-io/srs-writer-plugin?style=social)](https://github.com/Testany-io/srs-writer-plugin)
[![VSCode Installs](https://img.shields.io/visual-studio-marketplace/i/Testany.srs-writer-plugin?label=Installs)](https://marketplace.visualstudio.com/items?itemName=Testany.srs-writer-plugin)
[![VSCode Rating](https://img.shields.io/visual-studio-marketplace/r/Testany.srs-writer-plugin?label=Rating)](https://marketplace.visualstudio.com/items?itemName=Testany.srs-writer-plugin)

</div>
