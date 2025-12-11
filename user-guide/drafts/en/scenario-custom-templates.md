# Customizing Chapter Templates

> **Scenario**: You want SRS Writer to generate documents following your organization's specific format and structure
> **Time required**: 15-30 minutes initial setup

---

## Why Custom Templates?

SRS Writer uses **chapter templates** to guide AI in generating structured content. Templates define:
- Section headers and hierarchy
- Required fields for each requirement type
- ID naming conventions (FR-XXX-001, US-XXX-001, etc.)
- Traceability matrices format
- Acceptance criteria structure

**Default templates** follow IEEE 830 standards, but you can customize them to match:
- Your company's documentation standards
- Industry-specific compliance requirements (HIPAA, SOC 2, etc.)
- Team preferences for requirement structure
- Localized formats (different languages, date formats, etc.)

---

## How Templates Work

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your VSCode Settings                      │
│  srs-writer.templates.frWriter.FR_WRITER_TEMPLATE = "..."   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Template Loading                           │
│  SRS Writer reads your custom template file                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   AI Prompt Assembly                         │
│  Template injected into "TEMPLATE FOR YOUR CHAPTERS" section │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Content Generation                         │
│  AI follows your template structure when writing content     │
└─────────────────────────────────────────────────────────────┘
```

### Key Concept: Template Variables

Each specialist has a **template variable** that ends with `_TEMPLATE`:
- `FR_WRITER_TEMPLATE` - Functional Requirements
- `USER_STORY_WRITER_TEMPLATE` - User Stories
- `NFR_WRITER_TEMPLATE` - Non-Functional Requirements
- etc.

The system automatically detects variables ending with `_TEMPLATE` and injects their content into the AI prompt.

---

## Supported Specialists

**Only content specialists support custom templates.** These are specialists that write specific chapters of the SRS document.

| Specialist | Config Key | Template Variable | Default Template Path |
|------------|------------|-------------------|----------------------|
| Functional Requirements | `frWriter` | `FR_WRITER_TEMPLATE` | `.templates/functional_requirements/functional_requirement_template.md` |
| User Stories | `userStoryWriter` | `USER_STORY_WRITER_TEMPLATE` | `.templates/user_story/user_story_template.md` |
| Non-Functional Requirements | `nfrWriter` | `NFR_WRITER_TEMPLATE` | `.templates/NFR/nfr_template.md` |
| Use Cases | `useCaseWriter` | `USE_CASE_WRITER_TEMPLATE` | `.templates/use_case/use_case_template.md` |
| User Journeys | `userJourneyWriter` | `USER_JOURNEY_WRITER_TEMPLATE` | `.templates/user_journey/user_journey_template.md` |
| Overall Description | `overallDescriptionWriter` | `OVERALL_DESCRIPTION_WRITER_TEMPLATE` | `.templates/overall_description/overall_description_template.md` |
| Summary | `summaryWriter` | `SUMMARY_WRITER_TEMPLATE` | `.templates/summary/summary_template.md` |
| Glossary | `glossaryWriter` | `GLOSSARY_TEMPLATE` | `.templates/glossary/glossary_template.md` |
| Business Rules | `bizReqAndRuleWriter` | `BIZ_REQ_AND_RULE_WRITER_TEMPLATE` | `.templates/biz_req_and_rule/biz_req_and_rule_template.md` |
| Interface Requirements | `ifrAndDarWriter` | `IFR_AND_DAR_WRITER_TEMPLATE` | `.templates/IFR_and_DAR/ifr_and_dar_template.md` |
| Risk Analysis | `riskAnalysisWriter` | `RISK_ANALYSIS_TEMPLATE` | `.templates/risk_analysis/risk_analysis_template.md` |
| ADC (Assumptions, Dependencies, Constraints) | `adcWriter` | `ADC_WRITER_TEMPLATE` | `.templates/ADC/ADC_template.md` |
| Prototype Designer | `prototypeDesigner` | `PROTOTYPE_DESIGNER_TEMPLATE` | `.templates/prototype_designer/prototype_designer_template.md` |

**Not Supported:**
- Process specialists (e.g., `project_initializer`, `requirement_syncer`, `srs_reviewer`)
- Orchestrator and coordination specialists

---

## Step-by-Step: Customizing a Template

### Step 1: Locate the Default Template

Default templates are in the `.templates/` directory of the plugin installation:

```
.templates/
├── functional_requirements/
│   └── functional_requirement_template.md    ← FR template
├── user_story/
│   └── user_story_template.md                ← User Story template
├── NFR/
│   └── nfr_template.md                       ← NFR template
└── ... (other templates)
```

**To find the plugin location:**
1. In VSCode, go to Extensions
2. Find "SRS Writer"
3. Click the gear icon → "Extension Settings"
4. The path is shown in the extension details

### Step 2: Copy and Customize the Template

**Option A: Project-level templates (Recommended)**

Create a templates folder in your project:
```
YourProject/
├── .srs-templates/           ← Your custom templates
│   ├── fr-template.md
│   ├── user-story-template.md
│   └── nfr-template.md
├── SRS.md
└── requirements.yaml
```

**Option B: Global templates**

Create a shared templates folder:
```
~/Documents/srs-templates/
├── company-fr-template.md
├── company-us-template.md
└── company-nfr-template.md
```

### Step 3: Configure VSCode Settings

**Method 1: Settings UI**

1. Open VSCode Settings (`Cmd+,` / `Ctrl+,`)
2. Search for "srs-writer templates"
3. Find the specialist you want to customize (e.g., "Fr Writer")
4. Edit the JSON value:
   ```json
   {
     "FR_WRITER_TEMPLATE": ".srs-templates/fr-template.md"
   }
   ```

**Method 2: settings.json directly**

Add to your workspace or user `settings.json`:

```json
{
  "srs-writer.templates.frWriter": {
    "FR_WRITER_TEMPLATE": ".srs-templates/fr-template.md"
  },
  "srs-writer.templates.userStoryWriter": {
    "USER_STORY_WRITER_TEMPLATE": ".srs-templates/user-story-template.md"
  },
  "srs-writer.templates.nfrWriter": {
    "NFR_WRITER_TEMPLATE": ".srs-templates/nfr-template.md"
  }
}
```

### Step 4: Verify Configuration

After configuring, test by generating content:
```
@srs-writer Generate functional requirements for the user authentication module
```

Check if the output follows your custom template structure.

---

## Template Format and Structure

### File Format Requirements

| Requirement | Details |
|-------------|---------|
| **File format** | Markdown (`.md`) only |
| **Encoding** | UTF-8 |
| **Path type** | Relative to workspace root, or absolute path |
| **File size** | No hard limit, but keep reasonable (< 50KB recommended) |

### Placeholder Syntax

Templates use **square bracket placeholders** to indicate where AI should fill in content:

```markdown
#### FR-[SUBSYSTEM]-001: [Requirement Title]
- **Requirement Name**: [full requirement name]
- **Priority**: [critical/high/medium/low]
- **Description**: [detailed requirement description]
```

**Placeholder types:**

| Type | Example | Purpose |
|------|---------|---------|
| Text placeholder | `[requirement description]` | AI fills with generated text |
| Enum placeholder | `[critical/high/medium/low]` | AI picks from options |
| ID placeholder | `[SUBSYSTEM]`, `[XXX]` | AI generates appropriate ID |
| Reference placeholder | `[FR-XXX-XXX]`, `[US-XXX-XXX]` | AI links to other requirements |

### Template Structure Example

Here's the structure of the default Functional Requirements template:

```markdown
## Functional Requirements

### 5.1 [Subsystem Name]

#### FR-[SUBSYSTEM]-001: [Requirement Title]
- **Requirement Name**: [full requirement name]
- **Priority**: [critical/high/medium/low]
- **Source Story**: US-XXX-XXX
- **Description**: [detailed requirement description]
- **Acceptance Criteria**:
    - [ ] Normal Scenario: [expected behavior description]
    - [ ] Boundary Condition: [boundary case handling]
    - [ ] Exception Scenario: [error handling behavior]
- **Dependencies**: [FR-XXX-XXX]

---

### Functional Requirements Traceability Matrix

| FR ID | Requirement Name | Priority | Source User Story | Dependencies |
|-------|-----------------|----------|-------------------|--------------|
| FR-XXX-001 | [name] | high | US-AAA-001 | none |

**Total**: [X] functional requirements, covering [Y] subsystems.
```

---

## Constraints and Limitations

### Critical Constraints

| Constraint | Explanation | Impact |
|------------|-------------|--------|
| **Variable naming** | Must end with `_TEMPLATE` (uppercase) | System won't recognize other names |
| **Path resolution** | Relative paths resolve from workspace root | Absolute paths work anywhere |
| **Markdown only** | No YAML, JSON, or other formats for templates | Content won't render correctly |
| **Single file per variable** | One template file per variable | Can't merge multiple files |

### ID Naming Patterns

**Keep consistent ID patterns** - The system relies on these for traceability:

| Entity Type | Pattern | Examples |
|-------------|---------|----------|
| Functional Requirements | `FR-[CATEGORY]-NNN` | FR-AUTH-001, FR-PAY-002 |
| User Stories | `US-[CATEGORY]-NNN` | US-AUTH-001, US-CART-003 |
| Non-Functional Requirements | `NFR-[TYPE]-NNN` | NFR-SEC-001, NFR-PERF-002 |
| Use Cases | `UC-[CATEGORY]-NNN` | UC-AUTH-001, UC-SEARCH-002 |

**Why this matters:**
- `requirements.yaml` parsing depends on these patterns
- Traceability links use these IDs
- Quality reports reference these IDs

### Fields That Should Be Preserved

When customizing templates, **keep these essential fields**:

**For Functional Requirements:**
- ID (FR-XXX-NNN format)
- Requirement Name
- Priority
- Source Story (for traceability)
- Acceptance Criteria
- Dependencies

**For User Stories:**
- ID (US-XXX-NNN format)
- As/I want/So that structure
- Acceptance Criteria
- Priority
- Story Points (optional but recommended)

**For Non-Functional Requirements:**
- ID (NFR-XXX-NNN format)
- Classification (security/performance/reliability/etc.)
- Quantifiable Metric with Target Value
- Verification Method
- Source Requirements

### Traceability Matrices

**Always include traceability matrices** at the end of each section:

```markdown
### Functional Requirements Traceability Matrix

| FR ID | Requirement Name | Priority | Source User Story | Dependencies |
|-------|-----------------|----------|-------------------|--------------|
```

These matrices enable:
- Cross-referencing between requirements
- Completeness validation
- Impact analysis

---

## What You CAN Customize

### Safe to Modify

| Element | Example Changes |
|---------|-----------------|
| **Section headers** | Change "5.1 [Subsystem Name]" to "Module: [Subsystem Name]" |
| **Field labels** | Change "Requirement Name" to "Title" or localized term |
| **Additional fields** | Add "Reviewer", "Last Updated", "Version" |
| **Acceptance criteria structure** | Add more scenario types (Performance, Security) |
| **Priority values** | Change to P1/P2/P3/P4 instead of critical/high/medium/low |
| **Markdown formatting** | Add tables, bullet styles, emphasis |
| **Instructions/notes** | Add guidance comments for writers |
| **Language** | Translate to Chinese, Spanish, etc. |

### Example: Adding Custom Fields

```markdown
#### FR-[SUBSYSTEM]-001: [Requirement Title]
- **ID**: FR-[SUBSYSTEM]-001
- **Title**: [requirement title]
- **Priority**: [P1/P2/P3/P4]
- **Owner**: [team or person responsible]           ← Added
- **Sprint Target**: [sprint number]                ← Added
- **Source Story**: US-XXX-XXX
- **Description**: [detailed requirement description]
- **Acceptance Criteria**:
    - [ ] Happy Path: [expected behavior]
    - [ ] Edge Case: [boundary handling]
    - [ ] Error Case: [error handling]
    - [ ] Performance: [performance expectation]     ← Added
- **Test Cases**: [TC-XXX-NNN references]           ← Added
- **Dependencies**: [FR-XXX-XXX]
- **Review Status**: [Draft/In Review/Approved]     ← Added
```

### Example: Localized Template (Chinese)

```markdown
## 功能需求

### 5.1 [子系统名称]

#### FR-[SUBSYSTEM]-001: [需求标题]
- **需求名称**: [完整需求名称]
- **优先级**: [关键/高/中/低]
- **来源用户故事**: US-XXX-XXX
- **详细描述**: [需求详细描述]
- **验收标准**:
    - [ ] 正常场景: [预期行为描述]
    - [ ] 边界条件: [边界情况处理]
    - [ ] 异常场景: [错误处理行为]
- **依赖关系**: [FR-XXX-XXX]

---

### 功能需求追溯矩阵

| 需求ID | 需求名称 | 优先级 | 来源用户故事 | 依赖关系 |
|--------|----------|--------|--------------|----------|
```

---

## What You Should NOT Change

### Risky Modifications

| Element | Why Not |
|---------|---------|
| **ID patterns (FR-, US-, NFR-)** | Breaks traceability and YAML parsing |
| **Removing traceability matrix** | Loses cross-reference capability |
| **Removing acceptance criteria** | AI may skip this critical section |
| **File format (using .yaml, .txt)** | System expects Markdown only |
| **Nested complex structures** | AI may misinterpret structure |

### Anti-Patterns

**Don't do this:**

```markdown
# BAD: Changed ID pattern
#### REQ-001: [Title]          ← Should be FR-XXX-001

# BAD: Removed source tracking
- **Description**: [desc]
  (missing Source Story field)

# BAD: Non-standard priority
- **Priority**: [must-have/should-have/nice-to-have]
  ← System expects critical/high/medium/low
```

---

## Error Handling and Fallbacks

### What Happens If Template File Is Missing?

```typescript
// System behavior:
if (templateFileNotFound) {
  templateContent = '';  // Empty string, no error thrown
  // AI continues without template guidance
}
```

**Result:** AI will generate content but may not follow your expected structure.

### What Happens If Template Variable Name Is Wrong?

```json
// WRONG: Missing _TEMPLATE suffix
{
  "FR_WRITER": ".srs-templates/fr-template.md"  // Won't be detected
}

// CORRECT:
{
  "FR_WRITER_TEMPLATE": ".srs-templates/fr-template.md"
}
```

**Result:** System ignores the configuration silently.

### Debugging Template Issues

1. **Check VSCode Developer Console**
   - `Help` → `Toggle Developer Tools` → `Console`
   - Look for template loading logs

2. **Verify path resolution**
   ```
   @srs-writer Show current template configuration
   ```

3. **Test with simple template first**
   - Start with minimal changes
   - Gradually add customizations

---

## Best Practices

### 1. Start with Default Templates

1. Copy the default template
2. Make small changes
3. Test generation
4. Iterate

### 2. Keep ID Patterns Consistent

```markdown
✅ FR-AUTH-001, FR-AUTH-002, FR-PAY-001
✅ US-CART-001, US-CART-002
✅ NFR-SEC-001, NFR-PERF-001

❌ REQ-001, REQ-002 (no category)
❌ Func-Req-1 (non-standard format)
❌ user_story_1 (underscore, no category)
```

### 3. Maintain Traceability Fields

Always include:
- Source references (where this requirement came from)
- Dependencies (what this requirement depends on)
- Derived requirements (what comes from this)

### 4. Use Workspace Settings for Project-Specific Templates

```
.vscode/
└── settings.json    ← Project-specific template config

YourProject/
├── .srs-templates/  ← Project-specific templates
│   └── fr-template.md
└── ...
```

### 5. Version Control Your Templates

```bash
git add .srs-templates/
git commit -m "Add custom SRS templates for CompanyX standards"
```

---

## Complete Configuration Example

### Project Structure

```
MyProject/
├── .vscode/
│   └── settings.json
├── .srs-templates/
│   ├── fr-template.md
│   ├── us-template.md
│   ├── nfr-template.md
│   └── uc-template.md
├── SRS.md
├── requirements.yaml
└── quality-report.json
```

### settings.json

```json
{
  "srs-writer.templates.frWriter": {
    "FR_WRITER_TEMPLATE": ".srs-templates/fr-template.md"
  },
  "srs-writer.templates.userStoryWriter": {
    "USER_STORY_WRITER_TEMPLATE": ".srs-templates/us-template.md"
  },
  "srs-writer.templates.nfrWriter": {
    "NFR_WRITER_TEMPLATE": ".srs-templates/nfr-template.md"
  },
  "srs-writer.templates.useCaseWriter": {
    "USE_CASE_WRITER_TEMPLATE": ".srs-templates/uc-template.md"
  }
}
```

---

## Troubleshooting

### Template Changes Not Taking Effect

**Symptoms**: Generated content doesn't follow your custom template

**Solutions**:
1. Verify file path is correct (relative to workspace root)
2. Check variable name ends with `_TEMPLATE`
3. Reload VSCode window (`Developer: Reload Window`)
4. Verify file encoding is UTF-8

### AI Ignoring Template Structure

**Symptoms**: Content is generated but structure is different

**Solutions**:
1. Make template structure clearer with explicit headers
2. Add comments in template explaining expected format
3. Reduce template complexity
4. Ensure placeholders are clear: `[description here]` not `...`

### Traceability Links Broken

**Symptoms**: requirements.yaml has parsing errors, links don't work

**Solutions**:
1. Keep ID patterns: `FR-XXX-NNN`, `US-XXX-NNN`
2. Don't change ID prefix patterns
3. Maintain traceability matrix at end of sections

---

## Related Topics

- [Understanding Document Structure](getting-started-document-structure.md)
- [Quality Improvement](scenario-quality-improvement.md)
- [Multi-Project Management](scenario-multi-project.md)

---

[⬅️ Back: Quality Improvement](scenario-quality-improvement.md) | [Next: Getting Help ➡️](faq-getting-help.md)
