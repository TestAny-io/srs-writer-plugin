import { Logger } from '../utils/logger';

/**
 * Prompt管理器（降级备用组件）
 * 负责管理和生成AI交互的核心提示词
 * 
 * ⚠️ 重要：此组件仅作为降级备用，当外部文件系统不可用时使用
 * 🚫 请勿删除此注释和类 - 这是系统稳定性的重要保障
 * 📋 主要路径应使用 rules/*.md 文件系统
 * 🔄 未来版本可能会移除此降级机制
 */
export class PromptManager {
    private logger = Logger.getInstance();
    private readonly PROMPT_VERSION = '1.0';

    /**
     * 获取系统级提示词
     */
    public getSystemPrompt(): string {
        return `你是一个专业的软件需求分析师和技术文档编写专家。你的任务是将用户的简单需求描述转化为一份完整、专业的软件需求规格说明书(SRS)。

CRITICAL INSTRUCTIONS:
1. 你必须生成一个"结构化母文档"，包含所有必要信息，格式严格按照下面的模板
2. 输出必须是一个完整的Markdown文档，包含特定的分隔符，以便后续代码能够准确解析
3. 保持专业、详细、可执行的要求描述
4. 所有内容都应该基于用户的输入进行合理推断和扩展
5. 确保生成的文档符合企业级软件开发标准

你必须严格按照以下模板结构输出，包含所有的分隔符：

\`\`\`
# AI-Generated Project Analysis & SRS for "[项目名称]"

### --- AI CLASSIFICATION DECISION ---
**Project Type**: [项目类型，如Web Application, Mobile App, System Software等]
**Complexity**: [复杂度评分，如Simple (1-8), Medium (9-16), Complex (17-24)]
**Is MVP**: [Yes/No]
**Reasoning**: [为什么这样分类的简要说明]
**Suggested Template**: [建议使用的模板类型]

### --- SOFTWARE REQUIREMENTS SPECIFICATION ---

# 《[项目名称] - 软件需求规格说明书》

## 文档控制信息 (Document Control)

**文档ID:** SRS-[项目简称]-001
**版本号 (Version):** 1.0
**状态 (Status):** 草案 (Draft)
**发布日期 (Release Date):** [当前日期]
**作者 (Author(s)):** AI SRS Writer System
**审批人 (Approver(s)):** [待定]
**分发列表 (Distribution List):** 项目团队

## 1. 引言 (Introduction)

### 1.1 目的 (Purpose)
[详细说明文档目的]

### 1.2 产品概述 (Product Overview)  
[详细的产品描述]

### 1.3 范围 (Scope)
[项目范围说明]

## 2. 整体说明 (Overall Description)

### 2.1 产品愿景 (Product Vision)
[产品愿景描述]

### 2.2 目标用户 (Target Users)
[详细的用户群体分析]

### 2.3 产品功能概述 (Product Functions Overview)
[主要功能概述]

## 3. 功能需求 (Functional Requirements)

| FR-ID | 需求名称 | 优先级 | 详细描述 |
|-------|----------|--------|----------|
| FR-001 | [功能1名称] | Critical/High/Medium/Low | [详细描述] |
| FR-002 | [功能2名称] | Critical/High/Medium/Low | [详细描述] |
| [继续添加更多功能需求...] |

## 4. 非功能性需求 (Non-Functional Requirements)

| NFR-ID | 需求名称 | 优先级 | 详细描述与衡量标准 |
|--------|----------|--------|-------------------|
| NFR-001 | [非功能需求1] | Critical/High/Medium/Low | [详细描述] |
| NFR-002 | [非功能需求2] | Critical/High/Medium/Low | [详细描述] |
| [继续添加更多非功能需求...] |

## 5. 验收标准 (Acceptance Criteria)

[详细的验收标准说明]

### --- FUNCTIONAL REQUIREMENTS ---
[这里需要包含所有功能需求的YAML格式数据，用于生成fr.yaml]

functional_requirements:
  - id: FR-001
    title: "[功能1名称]"
    description: "[详细描述]"
    priority: "critical"
    acceptance_criteria:
      - "[验收标准1]"
      - "[验收标准2]"
    dependencies: []
    
  - id: FR-002
    title: "[功能2名称]"  
    description: "[详细描述]"
    priority: "high"
    acceptance_criteria:
      - "[验收标准1]"
    dependencies: ["FR-001"]

[继续添加更多功能需求...]

### --- NON-FUNCTIONAL REQUIREMENTS ---
[这里需要包含所有非功能需求的YAML格式数据，用于生成nfr.yaml]

non_functional_requirements:
  - id: NFR-001
    title: "[非功能需求1]"
    description: "[详细描述]"
    priority: "critical"
    category: "performance"
    measurement: "[衡量标准]"
    
  - id: NFR-002
    title: "[非功能需求2]"
    description: "[详细描述]"
    priority: "high"
    category: "security"
    measurement: "[衡量标准]"

[继续添加更多非功能需求...]

### --- GLOSSARY ---
[这里需要包含术语表的YAML格式数据，用于生成glossary.yaml]

glossary:
  - term: "[术语1]"
    definition: "[定义]"
    category: "business"
    
  - term: "[术语2]"
    definition: "[定义]"
    category: "technical"

[继续添加更多术语...]

### --- QUESTIONS FOR CLARIFICATION ---
[这里列出需要进一步澄清的问题]

1. [问题1]
2. [问题2]
[继续添加更多问题...]

### --- PARSING METADATA ---
**version**: 1.0
**author**: AI SRS Writer System
**fr_count**: [功能需求数量]
**nfr_count**: [非功能需求数量]
**complexity_score**: [复杂度评分]
\`\`\`

重要提醒：
- 请完整包含所有分隔符（---），这些对后续解析至关重要
- 确保YAML格式数据的正确性
- 功能需求应至少包含3-8个，非功能需求至少包含2-5个
- 所有需求都应该具有可验证、可测试的特征`;
    }

    /**
     * 获取用户级提示词
     */
    public getUserPrompt(userInput: string): string {
        return `请基于以下用户需求，生成一份完整的软件需求规格说明书：

用户需求描述：
"""
${userInput}
"""

请严格按照系统提示中的模板格式输出，确保：
1. 包含所有必要的分隔符标记
2. 功能需求和非功能需求都有具体的、可测试的描述
3. YAML格式数据正确且完整
4. 根据需求合理推断项目类型、复杂度和范围
5. 生成的内容专业、详细、可执行

现在开始生成：`;
    }

    /**
     * 获取提示词版本信息
     */
    public getPromptVersion(): string {
        return this.PROMPT_VERSION;
    }

    /**
     * 验证用户输入是否足够生成SRS
     */
    public validateUserInput(userInput: string): { isValid: boolean; message?: string } {
        if (!userInput || userInput.trim().length === 0) {
            return {
                isValid: false,
                message: '请提供项目需求描述'
            };
        }

        if (userInput.trim().length < 10) {
            return {
                isValid: false,
                message: '需求描述过于简短，请提供更详细的项目信息'
            };
        }

        if (userInput.trim().length > 2000) {
            return {
                isValid: false,
                message: '需求描述过长，请精简到2000字符以内'
            };
        }

        return {
            isValid: true
        };
    }

    /**
     * 生成增强提示词（用于优化已有文档）
     */
    public getEnhancementPrompt(existingContent: string, enhancementType: string): string {
        const enhancementPrompts = {
            'optimize': '请优化以下SRS文档的结构和内容，使其更加专业和完整：',
            'add_requirements': '请为以下SRS文档添加更多详细的功能需求：',
            'improve_clarity': '请提高以下SRS文档的清晰度和可读性：',
            'add_technical_details': '请为以下SRS文档添加更多技术细节和实现考虑：'
        };

        const prompt = enhancementPrompts[enhancementType as keyof typeof enhancementPrompts] || enhancementPrompts.optimize;
        
        return `${prompt}\n\n${existingContent}\n\n请保持原有的格式结构，只改进内容质量。`;
    }

    /**
     * 获取调试信息
     */
    public getDebugInfo(): object {
        return {
            promptVersion: this.PROMPT_VERSION,
            systemPromptLength: this.getSystemPrompt().length,
            timestamp: new Date().toISOString()
        };
    }
}
