# Import Existing Documents

> **Scenario**: You have meeting notes, PRDs, or other documents and want to convert them into a formal SRS
> **Time required**: 10-15 minutes

---

## Important: Supported File Formats

**SRS Writer can only read file formats that VSCode can read natively** (without additional extensions).

### ✅ Supported Formats (Text-Based)

Out-of-the-box, SRS Writer works with plain text files:

- **Markdown**: `.md`, `.markdown`
- **Plain text**: `.txt`
- **Code files**: `.js`, `.ts`, `.py`, `.java`, `.yaml`, `.json`, etc.
- **HTML**: `.html`
- **XML**: `.xml`
- **CSV**: `.csv`
- **Any text-based format** that VSCode can open in its editor

### ❌ Unsupported Formats (Binary)

These formats **cannot** be read directly:

- **Microsoft Word**: `.doc`, `.docx`
- **PDF**: `.pdf`
- **Microsoft Excel**: `.xls`, `.xlsx`
- **PowerPoint**: `.ppt`, `.pptx`
- **Images**: `.png`, `.jpg`, `.gif` (unless you have VSCode extensions that extract text)

### 🔄 Solution: Convert Binary Files to Text

If your documents are in unsupported formats, you must convert them first.

#### Recommended: Office to Markdown Converter (VSCode Extension)

**The easiest way to convert Office documents** is using Testany's **Office to Markdown Converter** extension.

**What it does**:
- Converts Word (`.docx`), Excel (`.xlsx`, `.xls`), and PowerPoint (`.pptx`) to clean Markdown
- One-click conversion via right-click in VSCode Explorer
- AI-powered image handling: Automatically extracts images and generates alt text
- Preserves formatting: Tables, lists, headings, hyperlinks
- Converts equations to LaTeX format
- Batch processing: Convert multiple files at once

**Installation**:

1. Open VSCode Extensions view (`Cmd+Shift+X` / `Ctrl+Shift+X`)
2. Search: `Office to Markdown Converter`
3. Click **Install**
4. Publisher: **Testany**

**Marketplace**: https://marketplace.visualstudio.com/items?itemName=Testany.office-to-markdown

**How to use**:

1. Place your Office files in your workspace
2. Right-click the file (`.docx`, `.xlsx`, or `.pptx`) in VSCode Explorer
3. Select **"Convert to Markdown"**
4. The extension generates a `.md` file with the same name
5. Now you can use this Markdown file with SRS Writer!

**Example**:
```
MyProject/
├── docs/
│   ├── requirements.docx           ← Original Word file
│   └── requirements.md             ← Auto-generated after conversion ✅
```

**Requirements**:
- VSCode 1.102.0 or higher
- GitHub Copilot installed (for AI-powered image descriptions)

---

#### Alternative Methods (Manual)

If you prefer not to install the extension, you can convert manually:

**Word/PDF → Text**:
- Export from Word: File → Save As → Plain Text (.txt)
- PDF: Use online converters (e.g., pdf2md.com) or copy-paste text content
- Google Docs: File → Download → Plain Text (.txt) or Markdown

**Excel → CSV**:
- Excel: File → Save As → CSV (.csv)
- Then you can paste CSV content into chat

**PowerPoint → Text**:
- Copy slide content to a text file
- Or export notes/outline view

**Best practice**: Use the **Office to Markdown Converter** extension for the best results. It preserves formatting, handles images automatically, and produces clean Markdown that works seamlessly with SRS Writer.

---

## The Problem

You're not starting from scratch. You have: 
- Meeting notes from stakeholder discussions
- Product briefs or PRDs
- User research findings
- Existing documentation in Word/PDF
- Email threads with requirements

**But**: These are unstructured and inconsistent.

**You need**: A formal, standardized SRS document.

---

## Solution: Let SRS Writer Process Your Content

SRS Writer can analyze existing documents and extract structured requirements.

**Important**: Ensure your documents are in a supported text format first (see above).

---

## Method 1: Copy and Paste (Fastest)

### When to Use

- Short documents (< 5 pages)
- Text is readily available
- Quick one-time import

### Steps

**Step 1: Copy your content**

From any source:
- Word documents
- Google Docs
- Confluence pages
- Email threads
- Meeting notes apps (Notion, Obsidian, etc.)

**Step 2: Open SRS Writer Chat**

Press `Cmd+Shift+I` / `Ctrl+Shift+I`

**Step 3: Paste with instructions**

```
@srs-writer I have meeting notes from our project kickoff.
Please generate a formal SRS document based on this content.

[Paste your notes here]
```

**Example**:

```
@srs-writer I have meeting notes from our project kickoff.
Please generate a formal SRS document based on this content.

---
Meeting: E-commerce Platform Kickoff
Date: 2025-11-01
Attendees: Product Team, Engineering, Design

Goals:
- Build online store for small businesses
- Easy product listing and management
- Secure payment processing
- Mobile-friendly

Key Features Discussed:
1. Seller Dashboard
   - Add/edit products with photos
   - Inventory tracking
   - Sales analytics

2. Customer Experience
   - Browse products by category
   - Search with filters
   - Shopping cart
   - Checkout with Stripe

3. Admin Panel
   - User management
   - Order management
   - Report generation

Technical Constraints:
- Must support 1000 concurrent users
- Page load < 2 seconds
- Mobile-first design

Security:
- HTTPS everywhere
- PCI DSS compliance for payments
- Data encryption

Timeline: 3 months MVP
---
```

**Step 4: Review and refine**

SRS Writer will:
1. Extract key requirements
2. Organize into standard SRS structure
3. Add missing details (with assumptions noted)
4. Generate functional and non-functional requirements

**Step 5: Iterate**

After reviewing the generated SRS:

```
@srs-writer Good start! A few additions:

1. Add requirement for email notifications when orders are placed
2. Sellers should be able to offer discount codes
3. Include inventory alerts when stock is low (< 10 units)
```

---

## Method 2: Reference Files (For Larger Documents)

### When to Use

- Large documents (> 5 pages)
- Multiple files
- Files in your workspace

### Steps

**Step 1: Convert and place files in your workspace**

**First, convert binary files to text format** (see "Supported File Formats" section above).

Then put your documents in a folder VSCode can access:
```
MyProject/
├── docs/
│   ├── meeting-notes-2025-11-01.md          ← Markdown (supported)
│   ├── product-brief.txt                    ← Converted from PDF/Word
│   └── user-research.md                     ← Converted from Word
```

**Step 2: Ask SRS Writer to read them**

```
@srs-writer Please read the following files and generate an SRS:
- docs/meeting-notes-2025-11-01.md
- docs/product-brief.txt
- docs/user-research.md

Focus on extracting functional requirements and user needs.
```

> ⚠️ **Important**: SRS Writer can only read plain text files that VSCode can open natively. If you have `.pdf`, `.docx`, or other binary formats, you **must convert them to `.txt` or `.md` first**.
> ℹ️ In the brownfield flow, `project_initializer` copies referenced files into the project folder as `source_draft.md` so the source stays traceable.

**Alternative - Reference specific content**:

```
@srs-writer I have a product brief in docs/product-brief.md.
The key sections are:

- Target Audience: Small business owners
- Core Value Proposition: Easy online store setup in under 1 hour
- Key Features: [list from document]

Please incorporate this into a formal SRS.
```

---

## Method 3: Incremental Import

### When to Use

- Very large or complex documentation
- Multiple sources with overlapping information
- Phased approach preferred

### Steps

**Step 1: Start with overview**

```
@srs-writer Create a new SRS for "E-commerce Platform".

I'll provide requirements in phases. Start with this overview:

Purpose: Enable small businesses to sell online
Target Users: 500 small business owners
Scale: 1000 concurrent customers, 5000 products per seller
```

**Step 2: Add functional requirements**

```
@srs-writer Add functional requirements from this section:

[Paste seller dashboard requirements]
```

**Step 3: Add non-functional requirements**

```
@srs-writer Add non-functional requirements:

[Paste performance, security, scalability requirements]
```

**Step 4: Add UI/UX requirements**

```
@srs-writer Add UI requirements based on our wireframes:

[Describe or paste wireframe annotations]
```

**Benefit**: You maintain control and can review at each step.

---

## Tips for Better Imports

### Tip 1: Provide Context

**Bad** ❌:
```
@srs-writer Generate SRS from this:
[Paste 20 pages of mixed content]
```

**Good** ✅:
```
@srs-writer I have meeting notes covering 3 stakeholder sessions.
They discuss requirements for a customer support ticketing system.

Background:
- Current system: Email (hard to track)
- Team size: 10 support agents
- Customer base: 500 B2B companies

Please extract requirements focusing on:
1. Ticket management workflow
2. Agent productivity features
3. Reporting for managers

[Paste notes]
```

---

### Tip 2: Highlight Priorities

Mark what's critical:

```
@srs-writer From these notes, prioritize:

MUST-HAVE for MVP:
- User authentication
- Product listing
- Shopping cart
- Stripe payment

NICE-TO-HAVE for v2:
- Social sharing
- Wishlist
- Product reviews
```

---

### Tip 3: Clarify Ambiguities

If your notes have conflicting information:

```
@srs-writer Note: The meeting notes mention both "email login" and
"social login". We decided to start with email only for MVP,
social login in v2. Please reflect this in the SRS.
```

---

### Tip 4: Specify Audience

```
@srs-writer This SRS is for a client proposal, so make it
professional and business-focused. Include compliance sections
(GDPR, PCI DSS) and executive summary.
```

Or:

```
@srs-writer This is internal documentation for our dev team.
Use technical language and include API specifications.
```

---

## Handling Different Document Types

### Meeting Notes

**Characteristics**: Informal, conversational, may have action items

**Best approach**:
```
@srs-writer These are meeting notes from stakeholder discussions.
They contain decisions, concerns, and feature requests.
Please extract formal requirements, noting any open questions.

[Paste notes]
```

SRS Writer will:
- Extract decisions as requirements
- Flag concerns as risks or constraints
- Identify open questions for follow-up

---

### Product Requirements Documents (PRDs)

**Characteristics**: More structured, but often mixes business and technical

**Best approach**:
```
@srs-writer This PRD describes the business goals and high-level features.
Please create a technical SRS that developers can implement from.
Focus on functional specifications and acceptance criteria.

[Paste PRD]
```

---

### User Research / Interview Transcripts

**Characteristics**: User stories, pain points, desired workflows

**Best approach**:
```
@srs-writer These are user interview transcripts showing pain points
with the current system and desired improvements.

Please convert user needs into formal requirements, maintaining
traceability back to user quotes.

[Paste transcripts]
```

---

### Email Threads

**Characteristics**: Fragmented, decisions mixed with discussion

**Best approach**:

1. First, summarize the thread yourself:
   ```
   Subject: Payment processing requirements

   Decisions made:
   - Use Stripe for credit cards
   - Support Apple Pay and Google Pay
   - Store no card data (PCI compliance)
   - Allow save payment methods for returning customers

   Open questions:
   - Support for international currencies?
   - Refund workflow?
   ```

2. Then ask SRS Writer:
   ```
   @srs-writer Based on this email discussion summary,
   create payment processing requirements.

   [Paste your summary]
   ```

---

### Existing Technical Specs

**Characteristics**: May be overly detailed or outdated

**Best approach**:
```
@srs-writer I have an old technical spec from 2020.
Extract still-relevant requirements, updating terminology
to current standards. Flag anything that seems outdated.

Focus on:
- Core business logic (still relevant)
- Integration points
- Data models

Ignore:
- Specific technology choices (outdated)
- Infrastructure details (will redesign)

[Paste spec]
```

---

## Common Issues and Solutions

### Issue 1: Too Much Information

**Problem**: SRS Writer generates an overly long document

**Solution**: Be selective

```
@srs-writer From these 50 pages of notes, focus only on:
- Core features for MVP
- Critical non-functional requirements (security, performance)
- Must-have integrations

Skip:
- Future roadmap items
- Alternative approaches that were rejected
- Background research
```

---

### Issue 2: Missing Context

**Problem**: Imported content lacks background

**Solution**: Add context first

```
@srs-writer Before I paste the meeting notes, here's the context:

Project: Customer Support Portal
Current Situation: Using email, tickets get lost, no metrics
Users: 10 support agents, 500 customers
Goal: Reduce response time from 24h to 4h
Budget: $80k
Timeline: 4 months

Now here are the meeting notes:
[Paste notes]
```

---

### Issue 3: Conflicting Information

**Problem**: Different documents contradict each other

**Solution**: Clarify explicitly

```
@srs-writer I have two documents with conflicting info:

Document A (older): Says we need mobile apps for iOS and Android
Document B (newer): Says we'll start web-only, mobile later

Please use Document B as the source of truth. Generate requirements
for responsive web app, and note mobile apps as future enhancement.
```

---

### Issue 4: Unstructured Content

**Problem**: Notes are all over the place

**Solution**: Let SRS Writer organize

```
@srs-writer These notes are unstructured - mix of features,
technical concerns, and random ideas. Please:

1. Extract clear requirements
2. Categorize into functional vs non-functional
3. Identify and group related requirements
4. Flag anything unclear as "needs clarification"

[Paste messy notes]
```

---

## Quality Check After Import

After importing and generating, always check quality:

```
@srs-writer Run quality check on the imported requirements
```

**Common issues with imported content**:
- ⚠️ Low clarity: Vague language from informal notes
- ⚠️ Low testability: Missing acceptance criteria
- ⚠️ Low completeness: Gaps in requirements

**Fix iteratively**:
```
@srs-writer The quality report shows clarity issues in FR-003, FR-007, FR-012.
Please make these more specific with measurable criteria.
```

---

## Real Example: Complete Import Workflow

Let's walk through a real scenario:

**Starting Point**: Meeting notes from project kickoff

**Step 1: Initial import**
```
@srs-writer Create SRS for "Expense Reporting System"

Background from meeting:
- Company: 200 employees
- Current: Excel spreadsheets (error-prone, no audit trail)
- Users: Employees submit, Finance approves, CFO reviews reports
- Volume: ~500 expense claims per month

Key features discussed:
- Mobile app for expense submission with photo of receipts
- Manager approval workflow
- Integration with accounting system (QuickBooks)
- Monthly reports for CFO

Requirements:
- Employees must be able to submit within 2 minutes
- Managers review within 24 hours
- Automatic policy violations flagged (e.g., over limits)

Generate initial SRS focusing on core workflow.
```

**Step 2: Review generated SRS**

(SRS Writer creates functional requirements for submission, approval, reporting)

**Step 3: Add missing details**
```
@srs-writer Good start. Add these details:

Approval workflow:
- Direct manager approves < $500
- Department head approves $500-$5000
- CFO approves > $5000
- Auto-approve < $50 if within policy

Policy rules:
- Meals: $50/day limit
- Hotel: $200/night limit
- Mileage: $0.58/mile (IRS rate)
- Per diem varies by city (integrate city rate database)
```

**Step 4: Clarify non-functionals**
```
@srs-writer Add specific non-functional requirements:

Performance:
- Mobile app: Submit expense in < 2 minutes
- Web dashboard: Load in < 1 second
- Report generation: < 5 seconds for monthly report

Security:
- Receipt images: Stored encrypted, auto-delete after 7 years
- Audit log: All approvals and changes tracked
- Access: Role-based (employee, manager, finance, admin)
```

**Step 5: Final quality check**
```
@srs-writer Check quality and fix any issues
```

**Result**: Professional SRS ready for development, created in 15 minutes.

---

## Next Steps

**You've successfully imported existing content!**

**Continue refining**:
👉 [Update Requirements](scenario-update-requirements.md)
👉 [Improve Quality](scenario-quality-improvement.md)

**Learn more**:
👉 [Conversation Tips]([approved]getting-started-conversation-tips.md)

---

**Have questions?** [Visit our FAQ]([approved]faq-common-questions.md) or [ask the community](https://github.com/Testany-io/srs-writer-plugin/discussions).

---

[⬅️ Back: Control Panel & Status Checks]([approved]scenario-control-panel.md) | [Next: Update Requirements ➡️](scenario-update-requirements.md)
