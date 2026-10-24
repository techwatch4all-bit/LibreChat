# CONTEXT.md Template
# ==================
# This template is filled in by scan_project.ps1 / scan_project.py
# Sections marked {{...}} are replaced by the scanner.
# Sections marked <!-- manual --> require human/AI enrichment after scanning.

---

# {{PROJECT_NAME}} — Project Context

> **AI Agent Directive**: Read this file FIRST before opening any source file.  
> Last updated: {{SCAN_DATE}} by context-scanner v{{SCANNER_VERSION}}

---

## 1. Identity & Stack

| Item | Value |
|---|---|
| Project name | {{PROJECT_NAME}} |
| Path | {{REPO_PATH}} |
| Git branch | {{GIT_BRANCH}} |
| Tech stack | {{TECH_STACK}} |
| Primary language | {{PRIMARY_LANGUAGE}} |
| Framework | {{FRAMEWORK}} |
| Build tool | {{BUILD_TOOL}} |
| Package manager | {{PACKAGE_MANAGER}} |

**One-liner**: <!-- manual: write what this project does in one sentence -->

---

## 2. Repository Map

```
{{REPO_TREE}}
```

---

## 3. Key File Index

| File | Purpose | Lines |
|---|---|---|
{{KEY_FILE_TABLE}}

---

## 4. Architecture Overview

<!-- manual: describe the architecture — data flow, key abstractions, runtime pipeline -->

**Tech stack details**:
{{STACK_DETAILS}}

**Config pipeline**:
<!-- manual: how does config load at startup? -->

**Key abstractions**:
<!-- manual: what are the 3-5 most important concepts to understand? -->

---

## 5. Entry Points & Routes

{{ENTRY_POINTS}}

---

## 6. Top-Level Dependencies

{{DEPENDENCIES}}

---

## 7. Environment Variables

> Values are NEVER stored here — only key names.

{{ENV_VARS}}

---

## 8. Git State

**Branch**: {{GIT_BRANCH}}  
**Remote**: {{GIT_REMOTE}}  

**Last 5 commits**:
```
{{GIT_LOG}}
```

---

## 9. Known Issues (TODOs / FIXMEs)

{{KNOWN_ISSUES}}

---

## 10. Integration Points

<!-- manual: how does this repo connect to sibling repos? -->

| Sibling Repo | Connection Type | Details |
|---|---|---|
| <!-- fill in --> | <!-- iframe / npm / API / import --> | <!-- fill in --> |

---

## 11. Pending Work

<!-- manual: incomplete features, broken things, deferred decisions -->

| Item | Status | Notes |
|---|---|---|
| <!-- fill in --> | ⚠️ / ❌ / 🔨 | <!-- fill in --> |

---

## 12. Session Log

> Append one line per session. Newest on top.

| Date | Agent | What was done |
|---|---|---|
| {{SCAN_DATE}} | context-scanner | Initial CONTEXT.md generated |
