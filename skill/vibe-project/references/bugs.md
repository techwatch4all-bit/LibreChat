# Bugs — {{PROJECT_NAME}}

> Living defect log. One row per bug. Match the tabular format used across this workspace's
> `Bugs.md` files.

| ID | Severity | State | Evidence / Impact | Remediation |
|---|---|---|---|---|
| {{BUG-001}} | {{HIGH/MED/LOW}} | {{open / in-progress / closed}} | {{what happens, where (file:line), how bad}} | {{the fix or plan to fix}} |

## Closed

| ID | Severity | State | Evidence / Impact | Remediation |
|---|---|---|---|---|
| — | — | closed | — | — |

## Rules

- A bug is logged the moment it is observed, with evidence (repro steps or `file:line`), not
  after it is fixed.
- `HIGH` = data loss, PII leak, child-safety incident, or total feature breakage. Block launch
  on open HIGH rows.
- `MED` = feature wrong but recoverable. `LOW` = cosmetic / non-blocking.
- Don't paste secrets into this file. Redact anything sensitive (name the key, not the value).
