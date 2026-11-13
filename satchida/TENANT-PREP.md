# Satchida Tenant Deployment — Prep & Update Playbook

**Read this file before doing any tenant work.** Written for the operator (plain language).
Last updated: 2026-11-13.

---

## 1. How the whole thing works (one paragraph)

This PC is the brain: it runs `one-api` (the AI gateway) and `bifrost`, and the Cloudflare
tunnel hostname `gateway.satchida.com` points HERE. This PC also runs the only LibreChat
instance — it is simultaneously the development, staging and production server for your own
staff. Tenant PCs (schools, SMEs) get a **copy of this LibreChat folder**; on the tenant PC,
the copy talks to your AI gateway over the internet (`gateway.satchida.com`) instead of the
local loopback. Preparing a tenant is therefore always the same job: **make a copy of this
folder, change exactly one configuration block, install nothing else** — and keep the copy
in sync with this PC afterwards.

## 2. The only difference between your PC and a tenant PC

| Item | Your PC (this one) | Tenant PC |
|---|---|---|
| LibreChat endpoint | `127.0.0.1:4099` (local gateway) | `https://gateway.satchida.com/v1` + Cloudflare Access service-token headers |
| AI gateway & keys | one-api + bifrost run here; master keys stay here | never installed; master keys NEVER exist on tenant machines |
| Everything else | — | identical (MCP servers, personas, vendored assets, scripts, node_modules) |

The tenant endpoint block already exists as a ready-made template:
**`librechat.tenant.example.yaml`** in this folder. It is an overlay, not a replacement —
a tenant yaml is this repo's `librechat.yaml` with the `endpoints.custom` section swapped
for the template's section. Nothing else in the yaml changes.

## 3. Preparing a NEW tenant PC (the "first copy" procedure)

Do all steps from this PC. Never run anything on the tenant PC except the final start step.

1. **Stage the copy here first (never disturb the live instance):**
   - Create a staging folder OUTSIDE this repo, e.g. `D:\LAN-AI-Infra\_tenant-staging\<tenant-name>\`.
   - **Copy the whole LibreChat folder** including `node_modules`. Do NOT run `npm install` on
     the tenant — node_modules must be copied so the tenant gets byte-identical, tested code
     (npm versions differ on other machines and `--legacy-peer-deps` quirks would bite).
   - Exclude only junk: `\.git\`, `\.pm2\`, `*.log`, `client\dist\.vite\`, `_scratch\`.
2. **Apply the one tenant difference:**
   - In the staged copy's `librechat.yaml`, replace the `endpoints.custom` section with the
     block from `librechat.tenant.example.yaml`.
   - In the staged copy's `.env`, add the three tenant variables (values from the operator's
     secret store — never paste them into chat or commit them):
     `SATCHIDA_GATEWAY_KEY`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`.
   - If the tenant gets its own Cloudflare tunnel hostname later, that is configured with
     `scripts\provision-client-tunnel.ps1` on the tenant — not from here.
3. **Verify the staged copy BEFORE it leaves this PC:**
   - Start it on a spare port (e.g. `PORT=3095 node api/server/index.js`) and check
     `/health` returns 200 and the architect/motion/Pascal tools appear (PM2-style log shows
     `[MCP][pascal-architect] … 89 tools`).
   - Load `http://127.0.0.1:3095/assets/vendor/axonometra/index.js` — must return JavaScript
     (not the SPA shell).
   - Stop the spare instance (close the terminal / Ctrl+C). The live :3080 instance must
     never be stopped for this.
4. **Move to the tenant PC** (USB drive, LAN share, or remote-copy tool). On the tenant:
   - Install nothing except Node.js (same major version as this PC) and PM2, if not present.
   - `pm2 start ecosystem.config.cjs` from the copied folder — this starts `librechat`
     AND `llama-watchdog` for the tenant's local llama fleet.
   - Run the smoke tests from `docs/TENANT_ARCHITECTURAL_IMPLEMENTATION_PLAN.md` §4:
     (a) offline isolation — cut the internet, confirm the architect/motion artifacts and all
     vendored assets load with zero external requests; (b) `pm2 list` shows both apps online;
     (c) a test chat prompt proves `gateway.satchida.com` auth works (this can only be tested
     from the tenant, because this PC's network rules exclude the tunnel hostname locally).
5. **Record it:** append a line to `Changes.md` (date, tenant name, what was copied, commit hash).

## 4. Keeping tenant(s) UP TO DATE (the "differential copy" procedure)

Whenever this PC's LibreChat gets new work (features, fixes, asset updates):

1. **Commit your work first.** The diff between commits is what travels. Never copy an
   uncommitted tree.
2. **Get the diff:**
   - `git diff --name-only <last-tenant-hash> HEAD` lists every changed file.
   - Add to that list any NEW untracked-but-needed files the same commit introduced
     (`git ls-files --others --exclude-standard`).
   - Also copy `node_modules\@pascal-app\` and any other `node_modules\` paths the diff
     touches (dependency changes travel with node_modules, not git).
3. **Copy only those files onto the tenant copy** (same relative paths). Files on your PC
   are never touched by this — the diff is one-way, from here to the tenant.
4. **On the tenant:** `pm2 restart librechat`, then probe `/health` (200) and spot-check
   the changed feature.
5. **Bookkeep:** note the new "last-tenant-hash" (the commit the tenant is now on) in
   `Changes.md` so the next differential copy starts from the right point.

**Rule:** the live :3080 instance on this PC is production for your staff. Tenant prep work
(staging copies, spare-port runs) must never restart, reconfigure, or edit files of the live
instance. All staging happens in a separate folder.

## 5. Hard invariants (never break these)

- Master AI keys (OpenAI/Anthropic/Gemini/DeepSeek) exist ONLY on this PC. Tenant configs
  point at `gateway.satchida.com`; no key ever ships in the copy, the `.env` template, or chat.
- Each tenant keeps its own MongoDB database — no shared/multi-tenant database code.
- `pm2 start ecosystem.config.cjs` is for TENANT machines only. On this PC the processes are
  already owned by the running PM2 (`librechat`, `llama-watchdog`); starting the ecosystem file
  here would duplicate the llama watchdog — forbidden (see AGENTS.md §6).
- Tenant llama fleet follows AGENTS.md §6 invariants verbatim (preset profile, never bare
  `--model`, never kill by image name). `scripts/ops/llama-watchdog.mjs` is the tenant copy of
  the watchdog; its absolute llama paths must be set for the tenant machine.
- Every tenant prep/update is recorded in `Changes.md` (fork audit trail).
