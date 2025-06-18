好的，Stephan。遵照我们的会议决议，我已经将所有讨论成果和最终决策整理成了正式的《技术方案概要 v1.0》。

这份文档将作为我们MVP阶段开发工作的核心技术指南，确保每一位团队成员都对我们的架构、组件、接口和技术决策有清晰、一致的理解。

---

# 《SRS Writer Plugin for VSCode - 技术方案概要 - v1.0》

## 文档控制信息

**文档ID:** TECH-SRSWRITER-MVP-001  
**版本号:** 1.0  
**状态:** 已批准 (Approved)  
**发布日期:** 2024-12-28  
**作者:** Goodspeed (架构师)  
**贡献者:** Stephan (产品经理), Chris (开发Lead)  
**审批人:** Stephan, Chris, Goodspeed  
**分发列表:** 核心开发团队

### 变更历史

| 版本 | 日期 | 修订人 | 变更描述 |
|------|------|--------|----------|
| 1.0 | 2024-12-28 | Goodspeed | 基于“MVP技术方案对齐会”的最终决策，创建并发布第一版技术方案。 |
| 1.1 | 2024-12-28 | Goodspeed | 采纳并整合了开发Lead (Chris) 的全部Review建议，包括接口增强、项目结构优化、错误分级、开发计划和风险补充。此为最终开发版本。|

---

## 1. 概述 (Overview)

### 1.1 目的
本文档旨在定义SRS Writer Plugin for VSCode **MVP版本**的高层技术架构和实现路径。它是对`SRS-SRSWRITER-MVP-002`需求文档的技术性回应，为开发团队提供清晰、统一的工程指导，确保产品能以高质量、高效率的方式交付。

### 1.2 核心架构原则
本项目遵循**“AI负责创造性生成，代码负责确定性处理”**的核心原则。所有功能实现均应围绕此原则展开，以最大化系统的健壮性、可维护性和性能。

---

## 2. 高层架构与数据流 (High-Level Architecture & Data Flow)

MVP的架构被设计为一个清晰的两阶段流程：**AI生成** 和 **代码解析**。

### 2.1 核心数据流图

```mermaid
graph TD
    subgraph User Interaction
        A[1. 用户在Chat中输入需求] --> B{2. PluginCore 监听命令};
    end

    subgraph "Phase 1: AI Generation (由AICommunicator处理)"
        B --> C[3. PromptManager 准备核心Prompt];
        C --> D[4. AICommunicator 调用 VSCode LM API];
        D --> E[5. LLM返回 "母文档" 字符串];
    end

    subgraph "Phase 2: Code Processing (确定性代码)"
        E --> F((6. SRSParser));
        F -- 解析成功 --> G{7. 生成内存中的文件对象集<br>e.g., {"SRS.md": "...", "fr.yaml": "..."}};
        G --> H[8. FileSystemManager 将对象集写入本地文件];
    end
    
    subgraph Error Handling
        F -- 解析部分失败 --> I[9a. 优雅降级：生成部分文件并记录错误日志];
    end

    H --> J[9b. 成功！用户看到完整文档集];

    classDef phase1 fill:#E3F2FD,stroke:#1E88E5;
    classDef phase2 fill:#E8F5E9,stroke:#43A047;
    class C,D,E phase1;
    class F,G,H phase2;
```

### 2.2 核心组件职责

| 组件名 | 职责 | 实现技术/库 |
| :--- | :--- | :--- |
| **`PluginCore`** | 插件主入口，注册Chat Participant，作为Orchestrator调度其他组件。 | VSCode Extension API |
| **`AICommunicator`** | 封装与`vscode.lm` API的交互，发送请求，接收完整的响应。 | `vscode.lm` API |
| **`PromptManager`** | 管理和填充硬编码在项目中的核心Prompt模板。 | 纯TypeScript/JS |
| **`SRSParser`** | **核心处理单元**。接收母文档字符串，解析并输出结构化的文件对象集。 | TypeScript, `marked.js`, `js-yaml` |
| **`FileSystemManager`**| 负责所有文件系统操作，如创建目录、写入文件。 | VSCode `workspace.fs` API |

---

## 3. 核心组件接口定义 (Core Component Interfaces)

以下是各核心组件之间交互的契约，采用TypeScript接口定义。

```typescript
/**
 * 定义解析器的输出结构
 * 一个以文件名（含扩展名）为键，文件内容为值的对象。
 */
type ParsedArtifacts = {
  [fileName: string]: string; 
};

/**
 * 定义解析选项，用于未来扩展
 */
interface ParseOptions {
  outputFormat?: 'yaml' | 'json';
  includeMetadata?: boolean;
}

/**
 * AI交互模块的接口
 */
interface IAICommunicator {
  /**
   * 基于用户输入生成母文档
   * @param userInput 用户的原始需求字符串
   * @returns Promise<string> AI生成的完整母文档内容
   */
  generateMotherDocument(userInput: string): Promise<string>;
}

/**
 * 解析器模块的接口 - v1.0 (最终版)
 */
interface ISRSParser {
  /**
   * 解析母文档，生成所有最终文件。
   * 必须实现“优雅降级”：即使部分内容解析失败，也应尽力返回成功解析的部分，
   * 并将错误信息包含在返回结果的'writer_log.json'中。
   * @param motherDocumentContent AI生成的母文档字符串
   * @param options 解析选项，用于未来扩展
   * @returns Promise<ParsedArtifacts> 包含所有成功生成的文件和日志的对象
   */
  parse(motherDocumentContent: string, options?: ParseOptions): Promise<ParsedArtifacts>;

  /**
   * 为未来的Web Worker实现预留的异步接口。
   * MVP阶段无需实现此方法。
   */
  parseAsync?(motherDocumentContent: string, options?: ParseOptions): Promise<ParsedArtifacts>;
}

/**
 * 文件系统管理模块的接口
 */
interface IFileSystemManager {
  /**
   * 将解析后的产物写入本地文件系统
   * @param artifacts 解析器返回的文件对象集
   * @param baseDir 要写入的基础目录名, e.g., "srs-task-manager"
   * @returns Promise<void>
   */
  writeArtifacts(artifacts: ParsedArtifacts, baseDir: string): Promise<void>;
}
```

---

## 4. 关键技术决策 (Key Technical Decisions)

| 决策领域 | 最终决议 | 理由与说明 |
| :--- | :--- | :--- |
| **错误处理策略** | **优雅降级 (分级处理)** | 采纳“优雅降级”策略。SRSParser将实现错误分级（CRITICAL, HIGH, MEDIUM, LOW），对非CRITICAL错误进行捕获、记录日志并继续处理，以提供部分可用的结果。 |
| **性能优化** | **1. 状态指示器优先** <br> **2. 先测试，后优化 (Web Worker)** | MVP阶段不实现流式响应，而是提供高质量的状态指示器（旋转图标+进度文本）。Web Worker的实现将基于性能基准测试结果来决策，接口已预留。 |
| **性能基准** | 分级基准 | 小型项目(<20需求): <200ms; 中型(20-50): <500ms; 大型(>50): <1000ms。可接受上限为2秒。 |
| **打包与依赖** | **Webpack优化** | 生产构建必须使用`webpack`进行代码压缩（`terser`）和摇树（`tree-shaking`），以控制最终`.vsix`文件的大小。 |
| **项目结构** | **采纳分层结构** | 采纳开发Lead提出的、按功能（`chat`, `core`, `parser`, `filesystem`）划分的专业目录结构，以提高代码的可维护性和清晰度。 |

---

## 5. 项目结构 (Project Structure)

```markdown
srs-writer-plugin/
├── src/
│   ├── extension.ts              # 插件主入口 (PluginCore)
│   ├── chat/                     # (新增) Chat相关逻辑
│   │   ├── srs-chat-participant.ts
│   │   └── commands.ts
│   ├── core/
│   │   ├── ai-communicator.ts
│   │   └── prompt-manager.ts
│   ├── parser/
│   │   ├── srs-parser.ts
│   │   ├── yaml-generator.ts
│   │   └── markdown-processor.ts
│   ├── filesystem/
│   │   └── file-manager.ts
│   ├── types/                    # (新增) 统一类型定义
│   │   └── index.ts              # (包含ParsedArtifacts, IAICommunicator等)
│   ├── constants/                # (新增) 统一常量管理
│   │   └── index.ts
│   └── utils/
│       ├── logger.ts
│       └── error-handler.ts
│   └── test/
│       └── parser/
│           └── performance.test.ts
├── rules/                        # AI规则/提示词文件
├── templates/                    # SRS内容模板
├── package.json
├── webpack.config.js
└── tsconfig.json
```

---

## 6. 开发计划与优先级 (Development Plan & Priorities) - 新增
基于Chris的建议，我们确定以下开发优先级和时间线作为指导：

- Week 1: 项目启动与核心框架搭建
    - 目标: 搭建项目脚手架，实现插件的基础运行。
    - 任务:
        - 按照已确定的目录结构初始化项目。
        - 实现PluginCore和Chat Participant基础注册。
        - 实现AICommunicator的基本框架，能够发送请求并接收响应。
- Week 2: 核心功能实现
    - 目标: 完成核心的解析与文件生成逻辑。
    - 任务:
        - 关键任务: 实现SRSParser，包括健壮的Markdown解析和优雅降级逻辑。
        - 实现FileSystemManager，完成文件写入。
        - 进行首次端到端集成测试（从用户输入到文件生成）。
- Week 3: 优化、测试与完善
    - 目标: 确保MVP的质量、性能和用户体验达到企业级标准。
    - 任务:
        - 执行性能基准测试，并根据结果决策是否需要立即优化。
        - 实现高质量的状态指示器。
        - 完善错误处理和日志记录。
        - 编写关键单元测试和集成测试。
预估交付: 基于此计划，一个高质量的MVP版本预计可在3周内完成开发并进入内部测试。

---

## 7. 风险与缓解措施 (Risks & Mitigations)

| 风险 | 可能性 | 影响 | 缓解措施 |
| :--- | :--- | :--- | :--- |
| **AI母文档格式不稳定** | 中 | 高 | SRSParser的validateMotherDocument方法提供“快速失败”能力。优雅降级策略也能降低此风险的影响。 |
| **解析性能超标** | 中 | 中 | 严格执行“先测试，后优化”策略。预留parseAsync接口。 |
| **VSCode LM API兼容性** | 中 | 高 | 在AICommunicator中设计适配器模式，为未来支持不同或变化的AI Provider API做准备。初期聚焦于最主流的配置。 |
| **Prompt稳定性** | 中 | 中 | 建立Prompt的版本管理机制。在writer_log.json中记录使用的Prompt版本号，便于问题追溯和回归测试。 ｜

---

**文档结束**