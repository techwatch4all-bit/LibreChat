# Autonomous AI Verification & Audit Prompt

Copy and paste the entire prompt below into another AI agent (such as Claude Code, Antigravity, or Codex) to execute a comprehensive end-to-end verification, cost reconciliation, and bug-fixing pass across `one-api`, `LibreChat`, and `Bifrost`.

***

```markdown
You are an elite AI Systems & Infrastructure Reliability Engineer auditing the multi-tier Satchida AI platform.

### Architecture Overview
1. **Frontend / Chat UI**: LibreChat (`D:\LAN-AI-Infra\LibreChat`), running on port 3080 (PM2 process `librechat`).
2. **Unified AI Gateway & Policy Enforcer**: One-API (`D:\LAN-AI-Infra\one-api`), running on port 4000 (PM2 process `satchida-gateway`).
3. **High-Performance Provider Router & Ledger**: Bifrost (`D:\LAN-AI-Infra\Bifrost`), running on port 8700 (PM2 process `satchida-bifrost`).
4. **Primary Databases**:
   - One-API SQLite: `D:\LAN-AI-Infra\one-api\one-api.db`
   - Bifrost Request Log: `D:\LAN-AI-Infra\Bifrost\data\logs.db` (or SQLite logs configured in Bifrost)
   - LibreChat MongoDB: `mongodb://127.0.0.1:27017/LibreChat`

---

### Core Objectives & Verification Checklist

#### 1. Audit Cost Application & Financial Ledger in One-API
- Inspect `D:\LAN-AI-Infra\one-api\one-api.db` tables: `logs`, `tenant_account_plans`, `license_tiers`, `seat_token_usages`, `seat_token_reservations`, and `tenants`.
- Verify the following cost principles:
  - **Wholesale Pass-Through vs Quota**: Check if upstream costs in USD (`upstream_cost_usd`) accurately reflect actual provider invoices (CheapInference, DeepInfra, OpenRouter, Groq, NousResearch, etc.).
  - **Media / Motion Pricing**: Verify that video models (`grok-imagine-video`, `veo-3.1-lite`, `kling-v2.6-t2v`) and image models (`flux-3-image-klein`) debit the tenant's MGU balance (`media_entitlement_mgu`) and record exact upstream dollar spend.
  - **Zero-Cost & Free Routes**: Verify that free upstream models (`:free`) have `upstream_cost_usd = 0.0` but still accurately meter token consumption (`prompt_tokens`, `completion_tokens`).
  - **No Phantom Rows**: Confirm that `bifrost_direct_sync` reconciles idempotently with One-API's `request_id` without double-counting spend.

#### 2. Verify Canonical Tier & Seat Naming Governance
- Ensure strict adherence to canonical tier names:
  `Basic`, `Standard`, `Family`, `Pro`, `Pro Family`, `Privacy`, `Enterprise`.
- Verify that **Enterprise** seats remain strictly disabled (`quota_units = 0`, `enabled = 0`, `media_entitlement_mgu = 0`) until a dedicated enterprise contract is signed.
- Confirm that `satchida-master` (Satchida HQ) has its seats assigned to clean identifiers:
  - `seat_Tenant_Admin_1e6cca` (Tenant Admin, Basic tier)
  - `admin_privacy_seat_001` (Admin Privacy, Privacy tier)
  - `seat_Golu_8aaeab` (Golu, Pro Family tier)
  - `seat_Mani_8aae24` (Mani, Privacy tier)
- Verify that no raw hashes (e.g. `6adcd4f...`), root accounts (`usr_1`), or virtual key names (`Satchida-HQ (Bifrost Direct)`) pollute the "By Seat" breakdown.

#### 3. Verify Product Modes & Zero "Other / Unknown" Modes
- Canonical product modes are: `chat`, `work`, `study`, `privacy`, `vibecoding`, and `motion`.
- Run an audit on `logs` and query `http://127.0.0.1:4000/api/analytics/tenant/satchida-master/by-mode?hours=24`.
- Ensure `unknown` and `Other` have **0 requests**.
- Verify that `web/berry/src/views/Dashboard/component/TenantUsageDrawer.js` renders proper color chips and labels for all 6 modes.

#### 4. Audit LibreChat Integration & Identity Forwarding
- Inspect `D:\LAN-AI-Infra\LibreChat\.env` and LibreChat custom endpoints (`librechat.yaml`).
- Check header propagation from LibreChat to One-API:
  - `X-Tenant-Id`: Must be `satchida-master` (or extracted per tenant).
  - `X-Seat-Alias`: Must forward the authenticated user's provisioned seat alias.
  - `X-Satchida-Mode`: Must correctly tag incoming prompts (`chat`, `work`, `study`, `privacy`, `vibecoding`, `motion`).
  - `X-User-Name`: Must pass the human-readable display name.
- Verify that LibreChat never falls back to unmetered root relay keys without tenant attribution.

#### 5. Audit Bifrost Gateway & Settlement Pipeline
- Inspect `D:\LAN-AI-Infra\Bifrost`:
  - Check `bifrost-reconciler` (PM2 ID 14) and logs sync.
  - Ensure Bifrost virtual keys tag `customer_id: "satchida-master"`.
  - Check that streaming requests (`is_stream = true`) do not leak buffers in context, and that final chunk accumulation correctly logs token counts and upstream costs.
  - Verify that any media generation job returns a reference ID (`media-settle`) that One-API can match against `bifrost:request_id`.

#### 6. Actionable Bug-Fixing & Self-Healing Protocol
If you detect any of the following, fix them immediately:
1. Any row in `logs` where `mode` is blank or `unknown` $\rightarrow$ classify by `model_name` or default to `chat`.
2. Any seat with a raw hash or system virtual key in `seat_alias` $\rightarrow$ map to its canonical seat alias in `tenant_seat_aliases`.
3. If Go files in `D:\LAN-AI-Infra\one-api` are modified, recompile `satchida-gateway.exe` and restart via PM2 (`pm2 restart satchida-gateway`).
4. If React files in `D:\LAN-AI-Infra\one-api\web\berry` are modified, build and publish (`npm run build` $\rightarrow$ publishes to `web/build/berry`).

When done, output a clean markdown summary listing:
- Checks passed vs issues found and corrected.
- Live API response validation from `http://127.0.0.1:4000/api/analytics/tenant/satchida-master/by-mode` and `/by-seat`.
- Confirmation that PM2 services (`satchida-gateway`, `librechat`, `bifrost-reconciler`) are online and healthy.
```
