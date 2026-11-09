# Satchida Pending Tasks — Session Handoff (2026-11-09)

**STATUS UPDATE 2026-11-10:** tasks 1, 2, 3, 4 and 5 below are DONE and verified in the
2026-11-10 session — see Changes.md's 2026-11-10 entries and Bugs.md B22 for evidence.
Task 1: Option A executed (rotated via `one-api/scripts/admin-token -api-key`); chat.mjs
has zero 401s but its shield corpus targets the retired fleet gateway — operator decision
recorded in Changes.md. Task 2: split committed (91a41f619…738a79c1b) plus the operator's
own 95cf9376d. Task 3: B22 root-caused and fixed live (useKeyboardShortcuts.ts). Tasks
4+5: messages prefetch in ChatRoute.tsx, lane overrides baked into e2e (plain
`npm run lighthouse` works), lane PASS. Remaining: the backlog pointers below.

Resume context for a new AI session. Read this file first, then pick up at the
pending tasks below in priority order. This supersedes
`satchida/HANDOFF-P0-P2-QA.md` — **all five of its steps are DONE and verified;
do not redo any of it** (probe 4/4 PASS, chat.mjs disposition recorded,
lighthouse PASS, Changes.md + Customizations.md appended, final audit delivered).

## Security constraints (mandatory, verbatim inheritance)

- Mimosa 生成前安全约束: 配置凭据时:只从环境变量或密钥服务读取;源码、示例和测试都不要写入可用的凭据字面量。
  (Credentials come only from env vars / secret services; never write usable credential
  literals into source, examples, or tests.)
- Never print secrets (the fleet licence token and the e2e password must never be echoed).
- Database writes are approval-gated: do NOT seed/modify `D:\LAN-AI-Infra\one-api\one-api.db`
  without explicit administrator authorization.
- All replies in English only.
- Do NOT mark any goal complete yourself — the runtime completion verifier decides.

## Repo state (snapshot 2026-11-09 evening)

- Branch `satchida`, HEAD `5369bb31e`, **23 dirty paths, ZERO commits** — all P0–P2
  work plus the QA session's doc/harness edits sit uncommitted in the working tree.
- **Agent work (this goal run):** `Changes.md`, `Customizations.md`,
  `client/src/common/starters.ts` (new), `client/src/components/Chat/Input/__tests__/ConversationStarters.spec.tsx`
  (new), `client/src/components/Chat/Input/ConversationStarters.tsx`,
  `client/src/locales/en/translation.json`, `client/src/style/satchida.css`,
  `satchida/personas/personas.ts`, `satchida/personas/README.md`, `satchida/mcp/README.md`,
  `packages/api/src/mcp/connection.ts`, `api/server/routes/admin/vaults.js`,
  `skill/anythingllm_mcp_server.py`.
- **Agent work (QA session only):** `e2e/setup/authenticate.ts`, `e2e/lighthouse/audit.ts`,
  `e2e/lighthouse/load.spec.ts` (three narrow harness adaptations, see Customizations.md C27).
- **Operator's own concurrent edits (18:54 spacing tweaks — NOT agent work, preserved
  untouched, commit them yourself or leave them):** `client/src/components/Chat/ChatView.tsx`,
  `client/src/components/Chat/Input/ChatForm.tsx`, `client/src/components/Chat/Landing.tsx`.
- **Do NOT commit:** `.mimosa/`, `client/.mimosa/`, `packages/api/.mimosa/` (tool dirs);
  `satchida/HANDOFF-P0-P2-QA.md` and this file are yours to commit or keep local.
- `librechat.yaml` is **gitignored but heavily modified** (rule blocks, deictics, MCP
  matrix, Privacy `webSearch: false`, relative MCP paths, `${ANYTHINGLLM_API_KEY}`
  template). Its changes exist only on this disk — consider a backup copy outside
  the repo before any destructive op.
- Artifacts: probe script at `%TEMP%\satchida-qa\probe.mjs` (outside repo);
  lighthouse reports `.lighthouse/lhr-{1,2,3}.report.json`.
- Fork workflow reminder: `origin` points at upstream LibreChat; branch off `dev`,
  PRs target `dev` (`gh pr create --base dev`), never open PRs to `main`.

## Completed — do not redo (evidence summary)

| Item | Evidence |
|---|---|
| Live zero-hallucination probe | **4/4 PASS** on `http://127.0.0.1:3080`: Privacy refusal no-number; BCD 10% cites Customs Notification No. 16/2026 (13 May 2026); "I'm **Satchida SI**"; 156 |
| chat.mjs licence-401 disposition | Changes.md blocked-gate entry (root cause `one-api/model/token.go:67`; 11 token rows all 48-char keys vs 354-char JWT, exp ≈ 2026-12-07; docs §11.7) |
| Lighthouse | **1 passed (2.6m), exit 0**; medians LCP 3081.5 ms ≤4500, CLS 0.0168 ≤0.1, TBT 284.5 ms ≤500 |
| Fork bookkeeping | Changes.md main P0→P2 entry (top) + blocked-gate entry; Customizations.md C27 (line 529) |
| Final audit | Delivered with Status/Actions/Evidence/Files/Risks/Next sections |
| Earlier P0–P2 gates | jest starters spec 7/7; fleet `node --test fleet/test/*.test.mjs` 98/98; scoped static-checks pass; yaml 7/7 anti-fabrication tails; key rotation scrubbed |

## Pending task 1 — Licence-401 remediation (APPROVAL-GATED: operator decides first)

`fleet/test/chat.mjs` stays BLOCKED (401 on every request) until one of these is done.
Ask the operator to choose, then execute exactly the chosen option:

- **Option A (recommended): rotate the licence token.** The old 354-char JWT was
  echoed into one-api's SQL error log during diagnosis — treat it as compromised.
  Rotate at the issuer, update `fleet/.state/licence.token`, then re-run
  `node fleet/test/chat.mjs`.
- **Option B: insert a `tokens` row** keyed to the current licence JWT into
  `D:\LAN-AI-Infra\one-api\one-api.db` table `tokens` (SQLite, gateway pm2
  `satchida-gateway` on :4000). **Database write — requires explicit approval.**
  - Precondition: back up `one-api.db` first (existing backups in `one-api\backup\`).
  - Rollback: restore the backup file.
  - Value handling: read the token from the file with a script; never print it.
- After either option: verify with `node fleet/test/chat.mjs` (needs the glob form on
  Windows: never `fleet/test/` directory form).

## Pending task 2 — Commit the working tree (currently ZERO commits on branch `satchida`)

Nothing from this goal run has been committed. Propose a split (get confirmation per
commit; do not force-push, do not touch history):

1. `docs(satchida)`: `Changes.md`, `Customizations.md`, handoff docs.
2. `fix(e2e)`: the three `e2e/` lighthouse/auth harness adaptations.
3. `feat(satchida)`: P0–P2 persona/starters code (`personas.ts`, `starters.ts`,
   `ConversationStarters.tsx` + spec, `translation.json`, `satchida.css`,
   `connection.ts`, `vaults.js`, `anythingllm_mcp_server.py`, satchida READMEs).
4. Operator's own ChatView/ChatForm/Landing spacing edits — their call, keep separate.

Exclude `.mimosa/**`. Reminder: `Fixes #N` does not close issues on a `dev` merge.

## Pending task 3 — B22: model dropdown stops opening (BUGS.md §B22, OPEN, HIGH)

Blocks mode switching in the UI (chat itself unaffected). Ariakit `MenuButton`
(`client/src/components/Chat/Menus/Endpoints/CustomMenu.tsx`, `showTimeout: 100`) —
controlled `open` state never flips; `Ctrl+Shift+M` also dead. Ruled out: bundle,
click dispatch, server `/api/config`, tab state. Needs a debugging session with
browser console access (reproduces on a fresh tab after reload).

## Pending task 4 — Chat-shell performance: `/api/messages` third wave + watermark LCP

- The fork fires `/api/messages` in a third request wave (~2.8–4.1 s observed under
  the lighthouse latency hook). Investigate serializing/hoisting that fetch for the
  startup path (see `e2e/lighthouse/README.md` reproduction notes).
- Today the Satchida brand watermark (`div.wm`, `Presentation.tsx:162`,
  `satchida.css:699`) carries the LCP metric (median 3081.5 ms). Transcript-only LCP
  measured ~4.1–4.4 s — **marginal against the 4500 ms budget** — so any visual
  redesign that removes the watermark must fix the startup path first.
- Re-run the lane after changes (recipe in gotchas below).

## Pending task 5 — Optional: bake the lighthouse lane overrides into the harness

The lane only passes with `SATCHIDA_OPERATOR_USER_ID= E2E_BASE_URL=http://localhost:3098
npm run lighthouse`. Two candidate permanent fixes (both `e2e/` only, keep
Customizations.md C27 in sync if you change them):

- `e2e/setup/start-server.js` loads the production `.env` via dotenv, leaking
  `SATCHIDA_OPERATOR_USER_ID` (causes "Configured Satchida operator user does not
  exist" in the isolated harness Mongo). Could strip/override that key for e2e runs.
- Default port collision with the live pm2 instance on :3080 — `E2E_BASE_URL` already
  solves it; a harness default of :3098 would remove the env var.

## Backlog pointers (bigger forks — not started, see memory/docs)

- Operator entitlement API + audit, then tenant-admin seat-limited provisioning
  (account-type caps operator-defined; Family cap 4-vs-5 still undecided — do not
  enforce either silently). Reuse roles/permissions/balances; no duplicate entitlement
  checks.
- **Bifrost Phase 3 and any tunnel retarget (`ai.satchida.com` still → legacy :4000)
  require explicit operator approval. Do not touch.**
- Personas cross-import into `client/src/common/starters.ts` was deliberately
  deferred — see the file header before attempting.

## Baselines (pre-existing — not tasks, do not "fix" without being asked)

- 37 client tsc errors, all in `Admin/*` (0 in changed files).
- Unused `com_admin_*` i18n keys flagged by the i18n gate.
- ~1000+ fork lint errors vs upstream/dev across the branch.

## Environment gotchas

- **Live port is :3080** (pm2 env and `.env` now agree; the old `:5274` pin in
  HANDOFF-P0-P2-QA.md is STALE — nothing listens on 5274). If `EADDRINUSE :3080`
  on restart: orphaned `node api\server\index.js` child holds it — find pid
  (`netstat -ano | grep 3080`), verify cmdline, `taskkill //PID <pid> //F`, `pm2 start librechat`.
- Lighthouse lane recipe: `SATCHIDA_OPERATOR_USER_ID= E2E_BASE_URL=http://localhost:3098
  npm run lighthouse` (from repo root). chrome-launcher 1.2.1 throws a deterministic
  Windows teardown-EPERM after a clean save — `audit.ts` tolerates exactly that case;
  real failures still retry.
- Agents chat probe protocol: `POST /api/agents/chat` (flat JSON, `stream:false`,
  **`spec` field required** → `promptPrefix` via `packages/api/src/agents/added.ts:161`)
  → ONE long-lived `GET /api/agents/chat/stream/{streamId}` that blocks until
  `final:true` (later polls 404 — job GC'd). Text in `on_message_delta` →
  `data.delta.content[].text`; authoritative in `final.responseMessage.text`.
- `node --test fleet/test/*.test.mjs` — glob form only on Windows.
- Mimosa hooks: Write of scripts into the repo tree is blocked — python heredoc to a
  temp dir (outside the repo) is the sanctioned path; split combined Bash commands
  (false-positive on combined calls).
- Jest mock pattern: plain factories for `~/hooks`/`~/Providers`, `jest.requireActual`
  spread ONLY for `~/data-provider` (hooks requireActual causes circular partial-init
  `activateCatalog` crash).
- `useLocalize()` has no fallback param — use `localize(key, { defaultValue })`.
- librechat.yaml is CRLF; parse with the npm `yaml` package (`modelSpecs.list`, not
  `.specifications`).