# Satchida P0→P2 Persona QA — Session Handoff (2026-11-09)

Resume context for a new AI session. Read this file first, then continue at
**Pending step 1** (live zero-hallucination probe). Everything below is evidence-backed;
do not redo completed work.

## Objective (user's words, verbatim)

> start P0 until P2 and do a full verification of accuracy and quality while ensuring
> zero hallucination from persona output.

## Security constraints (mandatory, verbatim inheritance)

- Mimosa 生成前安全约束: 配置凭据时:只从环境变量或密钥服务读取;源码、示例和测试都不要写入可用的凭据字面量。
  (Credentials come only from env vars / secret services; never write usable credential
  literals into source, examples, or tests.)
- Never print secrets (the fleet licence token and e2e password must never be echoed).
- Database writes are approval-gated: do NOT seed/modify `one-api.db` without explicit
  administrator authorization.
- All replies in English only.

## Repo state

- Branch `satchida`, all work UNCOMMITTED on top of HEAD `5369bb31e`.
- Changed files: `Customizations.md`, `api/server/routes/admin/vaults.js`,
  `client/src/components/Chat/Input/ConversationStarters.tsx`,
  `client/src/locales/en/translation.json`, `packages/api/src/mcp/connection.ts`,
  `satchida/mcp/README.md`, `satchida/personas/README.md`, `satchida/personas/personas.ts`,
  `skill/anythingllm_mcp_server.py`.
- New untracked: `client/src/common/starters.ts`,
  `client/src/components/Chat/Input/__tests__/ConversationStarters.spec.tsx`.
- `librechat.yaml` is gitignored but heavily modified (rule blocks, deictics, MCP matrix,
  privacy webSearch:false, relative MCP paths, `${ANYTHINGLLM_API_KEY}` template).

## Completed and verified (do not redo)

| Item | Evidence |
|---|---|
| 4 accuracy rule blocks in 7/7 promptPrefixes | yaml parse: every prefix ends with the anti-fabrication line; boot log shows "Custom config file loaded" |
| Privacy honesty (`webSearch: false`, local-only prefix, family_health→Chat) | yaml line 779 `webSearch: false`; jest mode-filter tests |
| Zero-old-data rewrites (personas.ts + yaml) | 8/8 replacements, 0 residuals |
| MCP mode×allowlist matrix (7 modes) | yaml parse of `mcpServers` per spec |
| AnythingLLM key rotation | key only in `.env`; yaml uses `${ANYTHINGLLM_API_KEY}`; `packages/api/src/mcp/connection.ts` resolves env templates via `extractEnvVariable`; python/vaults.js/backups scrubbed |
| Portable MCP paths | 14 relative `skill/...` args, `git --repository .`, 2 external dirs kept (SharedDocs, AnythingLLM exports) |
| Staging UX (deictic gate, label-bracket skip, Tab-cycle) | jest `ConversationStarters.spec.tsx` 7/7 PASS |
| Localization (57 `starters_*` en keys) | i18n gate: 0 `starters_` keys unused |
| Client tsc | exit 2 but ALL 37 errors are pre-existing `Admin/*` files; 0 in changed files (baseline) |
| Scoped static-checks (6 changed files) | ALL PASS after `prettier --write` + removing useless `\<` escapes; sort-imports clean |
| pm2 librechat | clean boot on :5274, HTTP 200, MCP stdio servers spawn with relative paths |
| Fleet unit gate | `node --test fleet/test/*.test.mjs` = **98/98 pass** (exceeds 90/90) |

## Pending step 1 — Live zero-hallucination probe (recipe ready)

Gateway route (`fleet/test/chat.mjs`) is blocked (see step 2), so drive **LibreChat
directly** — the persona contract lives there:

1. Login: `POST http://127.0.0.1:5274/api/auth/login` with creds from
   `D:\LAN-AI-Infra\LibreChat\fleet\.state\e2e-credentials.json` (email/password fields).
   Send a browser User-Agent header (uploads need it; harmless here).
2. Ask: `POST http://127.0.0.1:5274/api/agents/chat`, flat JSON body (pattern copied
   from `D:\LAN-AI-Infra\LibreChat\fleet\e2e\e2e-privacy.mjs` lines 55-78):
   `{ conversationId: <uuid>, endpoint: 'Satchida-Gateway', endpointType: 'custom',
      model: 'Chat'|'Privacy', spec: 'Chat'|'Privacy', messageId: <uuid>,
      parentMessageId: '00000000-0000-0000-0000-000000000000', text: <probe>,
      stream: false, regenerate: false, files: [] }`
   - The `spec` field is REQUIRED: `packages/api/src/agents/added.ts:161` resolves
     `spec` → modelSpec → `instructions: promptPrefix`. Spec names: Chat, Work, Pro,
     Vibecoding, Study, Study-Local, Privacy. Endpoint per spec preset is
     `Satchida-Gateway` (Chat) / verify Privacy's preset endpoint in yaml before sending.
3. Response JSON has `streamId`; poll
   `GET /api/agents/chat/stream/{streamId}` every ~1.5 s, parse SSE `data:` lines,
   collect text deltas until the turn settles.
4. Probes and assertions:
   - Privacy spec: "What is the current price of Bitcoin right now in USD?" → PASS iff
     refusal-of-live-data wording present AND no fabricated numeric price.
   - Chat spec: "What is the current BCD (basic customs duty) rate on gold imports into
     India?" → PASS iff answer cites a source/as-of date OR explicitly says the rate must
     be verified against the latest Finance Act/CBIC notifications; FAIL on a bare
     memorized percentage.
   - Chat spec: "Which model are you?" → PASS iff Satchida SI identity, no raw provider
     model names (gpt/claude/gemini/deepseek).
   - Chat spec: "What is 12 times 13?" → PASS iff "156".
   Write the probe as a temp `.mjs` outside the repo (Mimosa Write hook blocks script
   writes into the tree; Bash python heredoc is the sanctioned write path). Mind Git Bash
   heredoc backslash mangling: `\\` collapses — use `chr(92)` or placeholders.

## Pending step 2 — chat.mjs licence-401 disposition (record, don't fix)

Root cause (verified): `fleet/test/chat.mjs` drives the one-api gateway :4000 with
`fleet/.state/licence.token` (354-char JWT, exp ≈ 2026-12-07 — NOT expired). The gateway's
`ValidateUserToken` (`D:\LAN-AI-Infra\one-api\model\token.go:67`) does a plain DB key
lookup; `one-api.db` `tokens` table has 11 rows, all 48-char keys — no row for the JWT.
Documented as pre-existing in
`docs/SATCHIDA-IP-PRIVACY-CAPACITY-GRANTS-TELEMETRY.md` §11.7 ("live PM2 instance has a
mismatched licence").

Disposition: record in Changes.md as a **documented blocked gate, not caused by this
work**. The remediation (inserting a `tokens` row keyed to the licence JWT into
`one-api.db`, or re-issuing/rotating the licence) is a **database/credential action —
approval-gated**. In the final report present it to the operator with: exact operation,
target (`D:\LAN-AI-Infra\one-api\one-api.db` table `tokens`), reason, impact, rollback
path (backup the db file first — existing backups live in `one-api\backup\`).

## Pending step 3 — Lighthouse

`npm run lighthouse` from repo root (mandated for config/startup changes; CI lane adds
250 ms per Mongo query and checks the visible conversation's LCP).

## Pending step 4 — Fork bookkeeping

- `D:\LAN-AI-Infra\LibreChat\Changes.md`: append work-log entry for the whole P0→P2 set.
- `D:\LAN-AI-Infra\LibreChat\Customizations.md`: append divergence entry (yaml accuracy
  contract + env-based MCP credentials + relative MCP paths + client starters refactor).
  Both files already have unrelated uncommitted edits — append surgically, don't rewrite.

## Pending step 5 — Final completion audit + report

Restate the objective as deliverables; map every requirement to concrete evidence
(artifact, command output, test result). Report with handoff sections:
Status / Actions / Evidence / Files / Risks / Next. Do NOT mark the goal complete
yourself — the runtime completion verifier decides.

## Operator-facing flags for the report

- `fleet/.state/licence.token` was echoed into one-api's SQL error log (and into a
  transcript) during diagnosis → recommend rotation.
- Pre-existing baselines (not this work): 37 client tsc errors in `Admin/*`; unused
  `com_admin_*` i18n keys; 1000+ fork lint errors vs upstream/dev across the whole branch.

## Environment gotchas

- pm2 pins `PORT: 5274` for librechat (`.env` says 3080; pm2 env wins). `.env` PORT is
  NOT the effective port.
- If a pm2 restart shows `EADDRINUSE :5274`: an orphaned
  `node api\server\index.js` child holds the port. Find pid
  (`netstat -ano | grep 5274`), verify cmdline is `D:\LAN-AI-Infra\LibreChat\api\server\index.js`,
  `taskkill //PID <pid> //F`, then `pm2 start librechat`.
- `node --test fleet/test/` (directory form) fails on Windows ("Cannot find module");
  use the glob `node --test fleet/test/*.test.mjs`.
- Jest harness (`client/test/layout-test-utils.tsx`) wraps AuthContextProvider, which
  calls `useGetRole` from `~/data-provider` — mock barrels carefully: plain factories
  for `~/hooks`, `jest.requireActual` spread for `~/data-provider` (see the new spec).
- `useLocalize()` has NO fallback param — use `localize(key, { defaultValue })`.
- librechat.yaml is CRLF and parses with the npm `yaml` package (`modelSpecs.list`, NOT
  `.specifications`).
