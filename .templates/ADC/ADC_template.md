## Assumptions, Dependencies, and Constraints

### Assumptions

#### ADC-ASSU-001: [Assumption Title]

- **Assumption Statement**: [description of what is assumed to be true]
- **Category**: [organizational/technical/business/resource/external]
- **Priority**: [critical/high/medium/low]
- **Confidence Level**: [high/medium/low]
- **Affected Requirements**: [US-XXX-XXX, UC-XXX-XXX, FR-XXX-XXX]
- **Impact if False**: [description of consequences if assumption proves incorrect]
- **Validation Method**: [how this assumption will be verified]
- **Validation Date**: [date/ongoing/TBD]
- **Owner**: [role or person responsible]
- **Status**: [unvalidated/validated/invalidated]
- **Mitigation Strategy**: [actions if assumption proves false]

#### ADC-ASSU-002: [Assumption Title]

- **Assumption Statement**: [description of what is assumed to be true]
- **Category**: [organizational/technical/business/resource/external]
- **Priority**: [critical/high/medium/low]
- **Confidence Level**: [high/medium/low]
- **Affected Requirements**: [US-XXX-XXX, FR-XXX-XXX]
- **Impact if False**: [description of consequences]
- **Validation Method**: [how this assumption will be verified]
- **Validation Date**: [date/ongoing/TBD]
- **Owner**: [role or person responsible]
- **Status**: [unvalidated/validated/invalidated]
- **Mitigation Strategy**: [actions if assumption proves false]

#### ADC-ASSU-003: [Assumption Title]

- **Assumption Statement**: [description of what is assumed to be true]
- **Category**: [organizational/technical/business/resource/external]
- **Priority**: [critical/high/medium/low]
- **Confidence Level**: [high/medium/low]
- **Affected Requirements**: [UC-XXX-XXX, FR-XXX-XXX, NFR-XXX-XXX]
- **Impact if False**: [description of consequences]
- **Validation Method**: [how this assumption will be verified]
- **Validation Date**: [date/ongoing/TBD]
- **Owner**: [role or person responsible]
- **Status**: [unvalidated/validated/invalidated]
- **Mitigation Strategy**: [actions if assumption proves false]

---

### Dependencies

#### ADC-DEPEN-001: [Dependency Title]

- **Dependency Statement**: [description of what external factor is required]
- **Category**: [external system/third-party service/organizational/vendor/infrastructure]
- **Type**: [technical/business/resource/regulatory]
- **Priority**: [critical/high/medium/low]
- **Affected Requirements**: [US-XXX-XXX, UC-XXX-XXX, FR-XXX-XXX]
- **Impact**: [description of impact on project if dependency is not met]
- **Risk Level**: [critical/high/medium/low]
- **Mitigation Strategy**: [actions to reduce dependency risk]
- **Contingency Plan**: [alternative approach if dependency cannot be met]
- **Target Completion**: [date/milestone]
- **Owner**: [external party/system/vendor responsible]
- **Status**: [not started/in progress/blocked/completed]

#### ADC-DEPEN-002: [Dependency Title]

- **Dependency Statement**: [description of what external factor is required]
- **Category**: [external system/third-party service/organizational/vendor/infrastructure]
- **Type**: [technical/business/resource/regulatory]
- **Priority**: [critical/high/medium/low]
- **Affected Requirements**: [FR-XXX-XXX, NFR-XXX-XXX]
- **Impact**: [description of impact on project]
- **Risk Level**: [critical/high/medium/low]
- **Mitigation Strategy**: [actions to reduce dependency risk]
- **Contingency Plan**: [alternative approach if dependency cannot be met]
- **Target Completion**: [date/milestone]
- **Owner**: [external party/system/vendor responsible]
- **Status**: [not started/in progress/blocked/completed]

---

### Constraints

#### ADC-CONST-001: [Constraint Title]

- **Constraint Statement**: [description of limitation that must be accommodated]
- **Category**: [technical/business/regulatory/organizational/budgetary/schedule]
- **Type**: [mandatory/preferred]
- **Priority**: [critical/high/medium/low]
- **Rationale**: [reason why this constraint exists]
- **Affected Requirements**: [US-XXX-XXX, UC-XXX-XXX, FR-XXX-XXX]
- **Impact**: [description of how this limits design or implementation options]
- **Mitigation Strategy**: [approaches to work within the constraint]
- **Source**: [regulation/policy/contract/business decision]
- **Negotiable**: [yes/no]
- **Review Date**: [date when constraint may be reconsidered]

#### ADC-CONST-002: [Constraint Title]

- **Constraint Statement**: [description of limitation that must be accommodated]
- **Category**: [technical/business/regulatory/organizational/budgetary/schedule]
- **Type**: [mandatory/preferred]
- **Priority**: [critical/high/medium/low]
- **Rationale**: [reason why this constraint exists]
- **Affected Requirements**: [FR-XXX-XXX, NFR-XXX-XXX]
- **Impact**: [description of how this limits design or implementation options]
- **Mitigation Strategy**: [approaches to work within the constraint]
- **Source**: [regulation/policy/contract/business decision]
- **Negotiable**: [yes/no]
- **Review Date**: [date when constraint may be reconsidered]

#### ADC-CONST-003: [Constraint Title]

- **Constraint Statement**: [description of limitation that must be accommodated]
- **Category**: [technical/business/regulatory/organizational/budgetary/schedule]
- **Type**: [mandatory/preferred]
- **Priority**: [critical/high/medium/low]
- **Rationale**: [reason why this constraint exists]
- **Affected Requirements**: [UC-XXX-XXX, NFR-XXX-XXX]
- **Impact**: [description of how this limits design or implementation options]
- **Mitigation Strategy**: [approaches to work within the constraint]
- **Source**: [regulation/policy/contract/business decision]
- **Negotiable**: [yes/no]
- **Review Date**: [date when constraint may be reconsidered]

---

### Assumptions Summary

| ID | Assumption | Category | Priority | Confidence | Affected Requirements | Status |
|----|------------|----------|----------|------------|----------------------|--------|
| ADC-ASSU-001 | [summary] | organizational | critical | high | US-XXX-001, FR-XXX-001 | validated |
| ADC-ASSU-002 | [summary] | technical | high | medium | FR-XXX-002, NFR-XXX-001 | unvalidated |
| ADC-ASSU-003 | [summary] | business | medium | high | UC-XXX-001 | validated |
| ADC-ASSU-004 | [summary] | resource | high | low | FR-XXX-003, FR-XXX-004 | unvalidated |

**Total**: [X] assumptions, [Y] validated, [Z] pending validation.

---

### Dependencies Summary

| ID | Dependency | Category | Priority | Risk Level | Affected Requirements | Status |
|----|------------|----------|----------|------------|----------------------|--------|
| ADC-DEPEN-001 | [summary] | external system | critical | high | FR-XXX-001, FR-XXX-002 | in progress |
| ADC-DEPEN-002 | [summary] | third-party service | high | medium | FR-XXX-003, NFR-XXX-001 | completed |
| ADC-DEPEN-003 | [summary] | vendor | medium | low | UC-XXX-001 | not started |
| ADC-DEPEN-004 | [summary] | infrastructure | high | high | NFR-XXX-002 | blocked |

**Total**: [X] dependencies, [Y] completed, [Z] in progress, [W] blocked.

---

### Constraints Summary

| ID | Constraint | Category | Type | Priority | Affected Requirements | Negotiable |
|----|------------|----------|------|----------|----------------------|------------|
| ADC-CONST-001 | [summary] | technical | mandatory | critical | FR-XXX-001, NFR-XXX-001 | no |
| ADC-CONST-002 | [summary] | regulatory | mandatory | critical | UC-XXX-001, FR-XXX-002 | no |
| ADC-CONST-003 | [summary] | business | preferred | high | FR-XXX-003 | yes |
| ADC-CONST-004 | [summary] | budgetary | mandatory | high | US-XXX-001 | no |

**Total**: [X] constraints, [Y] mandatory, [Z] preferred.

---

### ADC Traceability Matrix

| ADC Type | ADC ID | ADC Summary | Priority | Affected Use Cases | Affected User Stories | Affected FRs | Affected NFRs |
|----------|--------|-------------|----------|-------------------|----------------------|--------------|---------------|
| Assumption | ADC-ASSU-001 | [summary] | critical | UC-XXX-001 | US-XXX-001 | FR-XXX-001, FR-XXX-002 | NFR-XXX-001 |
| Assumption | ADC-ASSU-002 | [summary] | high | - | US-XXX-002 | FR-XXX-003 | - |
| Dependency | ADC-DEPEN-001 | [summary] | critical | UC-XXX-002 | - | FR-XXX-004 | NFR-XXX-002 |
| Dependency | ADC-DEPEN-002 | [summary] | medium | - | US-XXX-003 | FR-XXX-005 | - |
| Constraint | ADC-CONST-001 | [summary] | critical | UC-XXX-001, UC-XXX-003 | - | FR-XXX-001 | NFR-XXX-001, NFR-XXX-003 |
| Constraint | ADC-CONST-002 | [summary] | high | - | US-XXX-001 | FR-XXX-006 | NFR-XXX-004 |

**Total**: [X] assumptions, [Y] dependencies, [Z] constraints affecting [W] requirements.
