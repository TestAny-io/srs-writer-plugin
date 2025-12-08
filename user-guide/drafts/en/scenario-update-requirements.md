# Update and Modify Requirements

> **Scenario**: Requirements change, and you need to update your SRS document
> **Time required**: 5-10 minutes per change

---

## The Problem

Requirements are never set in stone. You need to:
- Add new features
- Modify existing requirements
- Remove deprecated features
- Clarify vague requirements
- Update priorities

**But**: Manual updates are error-prone and time-consuming.

---

## Solution: Tell SRS Writer What Changed

SRS Writer understands change requests in natural language and uses SID-based semantic editing to safely update both `SRS.md` and `requirements.yaml` (keeping IDs and traceability aligned).

---

## Making Changes

### Type 1: Add New Features

**Simple addition**:
```
@srs-writer Add a feature: Users can export task lists as Excel files
```

**Detailed addition**:
```
@srs-writer Add a new feature for bulk operations:

Users should be able to:
- Select multiple tasks (checkbox)
- Bulk actions: Delete, Mark complete, Assign to user, Change priority
- Maximum 100 tasks per operation
- Confirmation dialog before destructive actions
- Progress indicator for long operations
```

**What SRS Writer does**:
1. Creates new functional requirement (e.g., FR-015)
2. Adds to appropriate section in SRS.md
3. Updates requirements.yaml with structured data
4. Links to related requirements
5. Runs quality check

---

### Type 2: Modify Existing Requirements

**Small change**:
```
@srs-writer Change the login requirement from email-only to support
both email and username
```

**Specific change**:
```
@srs-writer Update requirement FR-003 (User Profile):
Add these fields: timezone, language preference, notification settings
```

**Complete rewrite**:
```
@srs-writer Replace the entire "Search" feature (FR-008) with this:

Search should support:
- Full-text search across task title and description
- Filters: assignee, status, priority, tags, date range
- Fuzzy matching for typos
- Search as you type (instant results)
- Save searches as custom views
- Search history (last 10 searches)

Performance: < 100ms for 95% of searches
```

**What gets updated**:
- Requirement description in SRS.md
- Related sections (if dependencies exist)
- requirements.yaml fields
- Version history tracked

---

### Type 3: Delete Features

**Simple removal**:
```
@srs-writer Remove the "Social Sharing" feature - we're not doing it in v1
```

**Remove with explanation**:
```
@srs-writer Delete all requirements related to third-party integrations.
We decided to focus on core features first. Move these to a
"Future Enhancements" section instead of deleting completely.
```

**What SRS Writer does**:
1. Removes from main requirements
2. Optionally moves to "Future" section
3. Updates traceability (removes orphaned links)
4. Updates requirements count in overview

---

### Type 4: Clarify Vague Requirements

**Make specific**:
```
@srs-writer Requirement FR-005 says "System should be fast".
This is too vague. Replace with specific metrics:
- Page load time: < 2 seconds
- API response time: < 200ms (95th percentile)
- Search results: < 100ms
- File upload: Support up to 10MB, complete within 5 seconds
```

**Add details**:
```
@srs-writer The "User Profile" requirement needs more detail.
Specify these profile fields:
- First name, Last name (required)
- Email (required, unique)
- Avatar (optional, max 2MB, JPG/PNG)
- Bio (optional, max 500 chars)
- Department (dropdown: Engineering, Sales, Marketing, Support)
- Role (auto-assigned by admin)
```

---

### Type 5: Change Priorities

**Single requirement**:
```
@srs-writer Change FR-012 (Email Notifications) from Low to High priority.
We need this for v1 after all.
```

**Batch update**:
```
@srs-writer Update priorities for v1 scope:

High priority (must-have for v1):
- FR-001: User Authentication
- FR-003: Task Creation
- FR-007: Task Assignment
- FR-012: Email Notifications

Medium priority (nice-to-have for v1):
- FR-005: File Attachments
- FR-010: Comments

Low priority (defer to v2):
- FR-009: Social Sharing
- FR-014: Advanced Analytics
```

---

## Advanced Update Patterns

### Pattern 1: Conditional Logic

**Add conditions to existing requirements**:

```
@srs-writer Update the "File Upload" requirement (FR-008):

Add conditional logic:
- Free tier users: Max 5MB per file, 100MB total storage
- Pro tier users: Max 50MB per file, 10GB total storage
- Enterprise users: Max 500MB per file, unlimited storage

Also add: Automatic virus scanning for all uploaded files
```

---

### Pattern 2: Split Requirements

**Break down complex requirements**:

```
@srs-writer Requirement FR-006 "User Management" is too broad.
Split it into separate requirements:

FR-006-A: User Registration
- Email verification
- Password strength requirements

FR-006-B: User Profile Management
- Update profile fields
- Change password
- Upload avatar

FR-006-C: User Roles and Permissions
- Role assignment (admin, user, guest)
- Permission matrix
- Role-based access control
```

---

### Pattern 3: Merge Requirements

**Combine related requirements**:

```
@srs-writer Merge FR-009 (Email Notifications) and FR-011 (Push Notifications)
into a single "Notification System" requirement.

The merged requirement should support:
- Email notifications (mandatory)
- Push notifications (optional)
- SMS notifications (optional, premium feature)
- User preferences: per-notification-type control
- Frequency: immediate, daily digest, weekly summary
```

---

### Pattern 4: Update Based on Feedback

**After stakeholder review**:

```
@srs-writer Stakeholder feedback from review:

1. FR-003 (Task Creation): Add support for recurring tasks
   - Daily, weekly, monthly, custom patterns
   - End condition: after N occurrences or by date

2. FR-007 (Task Assignment): Allow multiple assignees
   - Not just one owner
   - Track individual completion status

3. FR-010 (Reports): Add export to PDF, not just Excel

4. Remove FR-015 (Gamification) - stakeholders don't want this
```

---

## Handling Large-Scale Changes

### Scenario: Major Feature Pivot

**Problem**: Business decides to change direction significantly

**Solution**: Systematic update

```
@srs-writer We're pivoting from B2C to B2B. This affects requirements:

Changes needed:
1. Remove: Individual user registration (was FR-002)
   Replace with: Company-based registration with admin provisioning

2. Remove: Public marketplace features (FR-020 to FR-025)
   Replace with: Private company workspace

3. Add: Multi-tenancy support
   - Data isolation per company
   - Company-level settings and branding
   - Admin dashboard for company admins

4. Update: Pricing requirement (FR-030)
   From: Per-user subscription
   To: Per-company subscription with user tiers

Please update all affected requirements and regenerate the overview sections.
```

---

### Scenario: Compliance Requirements Added

**Problem**: Legal/compliance requirements emerge

**Solution**: Add a new section

```
@srs-writer Add a new section "5. Compliance Requirements" with:

GDPR Compliance:
- User data export (machine-readable format)
- User data deletion (right to be forgotten)
- Consent management
- Data processing agreements

HIPAA Compliance (for healthcare clients):
- Data encryption at rest (AES-256)
- Data encryption in transit (TLS 1.3)
- Audit logging (all access to PHI)
- Business Associate Agreement support
- Access controls (role-based, time-limited)

SOC 2 Type II:
- Security controls documentation
- Regular penetration testing
- Incident response plan
- Change management process
```

---

## Tracking Changes

### View Change History

SRS Writer maintains version history in requirements.yaml:

```yaml
functionalRequirements:
  - id: FR-003
    title: "Task Creation"
    version: 2.1
    lastModified: "2025-11-06"
    changeLog:
      - version: 2.1
        date: "2025-11-06"
        author: "Product Team"
        change: "Added support for recurring tasks"
      - version: 2.0
        date: "2025-11-05"
        change: "Added multiple assignees support"
      - version: 1.0
        date: "2025-11-01"
        change: "Initial requirement"
```

**View changes**:
```
@srs-writer Show me what changed in FR-003 since version 1.0
```

---

### Commit Changes to Git

After updating requirements:

```bash
git add TaskManagement/
git commit -m "Update: Added recurring tasks (FR-003) and multi-assignee support (FR-007)"
git push
```

**Best practice**: Commit after each logical set of changes, not after every single edit.

---

## Direct Editing of SRS.md

You can also edit SRS.md directly in VSCode.

### When to Edit Directly

- ✅ Quick typo fixes
- ✅ Formatting improvements
- ✅ Adding clarifications
- ✅ Inserting diagrams or examples

### When to Use Chat

- ✅ Adding new requirements
- ✅ Restructuring sections
- ✅ Major changes affecting multiple requirements
- ✅ Need automatic sync to requirements.yaml

### After Direct Editing

Tell SRS Writer to sync:

```
@srs-writer I edited SRS.md manually. Please sync to requirements.yaml
and check for any consistency issues.
```

SRS Writer will:
1. Parse your changes
2. Update requirements.yaml
3. Validate structure
4. Fix any broken links

---

## Common Update Scenarios

### Scenario 1: Agile Sprint Planning

**Use case**: Planning what's in the next sprint

```
@srs-writer Update sprint scope:

Sprint 5 (Nov 6-20):
- FR-015: Export to Excel (move to In Progress)
- FR-016: Import from CSV (move to In Progress)
- FR-012: Email Notifications (move from Backlog to Sprint)

Not in Sprint 5:
- FR-018: Advanced Analytics (keep in Backlog)
```

---

### Scenario 2: Bug Fixes Requiring Requirement Updates

**Use case**: Bug reveals missing requirement

```
@srs-writer We found a bug: Users can submit forms with invalid data.
This reveals a missing requirement.

Add FR-024: Input Validation
- All form fields must be validated client-side and server-side
- Email fields: RFC 5322 format
- Phone numbers: E.164 format
- Dates: ISO 8601 format
- Custom business rules: ZIP code matches country, credit card Luhn check
- Error messages: Specific and actionable
```

---

### Scenario 3: Performance Optimization

**Use case**: App is slow, need to tighten requirements

```
@srs-writer Update performance requirements (NFR-001):

Make these more aggressive:
- Page load: < 2 seconds → < 1 second
- API response: < 500ms → < 200ms
- Database queries: < 200ms → < 100ms

Add new performance requirements:
- Lazy loading: Images load only when in viewport
- Caching: API responses cached for 5 minutes
- Pagination: Max 50 items per page
- Infinite scroll: Pre-fetch next page when 80% scrolled
```

---

### Scenario 4: Security Hardening

**Use case**: Security audit revealed gaps

```
@srs-writer Add security requirements from audit findings:

Authentication:
- FR-002A: Add two-factor authentication (TOTP)
- FR-002B: Add session timeout after 30 min inactivity
- FR-002C: Add password expiration (90 days)

Authorization:
- FR-003A: Implement least-privilege access
- FR-003B: Add audit logging for all sensitive operations

Data Protection:
- NFR-007A: Encrypt sensitive fields at column level
- NFR-007B: Implement key rotation every 90 days
- NFR-007C: Add data masking in logs
```

---

## Quality Check After Updates

After making changes, always verify quality:

```
@srs-writer Run quality check focusing on updated requirements
```

**Check for**:
- Consistency: Do changes conflict with other requirements?
- Traceability: Are links still valid?
- Completeness: Are all aspects covered?

**Fix issues**:
```
@srs-writer Quality check shows FR-015 now conflicts with NFR-003.
FR-015 requires storing 10MB files, but NFR-003 limits uploads to 5MB.
Please resolve this conflict - increase NFR-003 limit to 10MB.
```

---

## Best Practices

### ✅ DO

1. **Explain why** changes are needed
   ```
   @srs-writer Remove social login - stakeholders concerned about privacy
   ```

2. **Update in logical batches**
   - Group related changes
   - Commit to Git after each batch

3. **Review after major changes**
   - Read updated SRS.md
   - Check quality report
   - Validate with team

4. **Document decisions**
   - Add comments in requirements.yaml
   - Update project overview if scope changes

---

### ❌ DON'T

1. **Don't make too many changes at once**
   - Break into smaller updates
   - Easier to review and rollback

2. **Don't forget dependencies**
   ```
   @srs-writer When updating FR-008, check if any other requirements
   depend on it and update those too.
   ```

3. **Don't remove requirements silently**
   - Document why they were removed
   - Consider moving to "Future" instead of deleting

4. **Don't skip quality checks**
   - Always validate after major updates

---

## Next Steps

**You've mastered updating requirements!**

**Explore related scenarios**:
👉 [Multi-Project Management](scenario-multi-project.md)
👉 [Quality Improvement](scenario-quality-improvement.md)

---

**Have questions?** [Visit our FAQ]([approved]faq-common-questions.md) or [ask the community](https://github.com/Testany-io/srs-writer-plugin/discussions).

---

[⬅️ Back: Import Existing]([approved]scenario-import-existing.md) | [Next: Multi-Project Management ➡️](scenario-multi-project.md)
