# Satchida — Three-Tier Dashboard Design & Pending Work
*Derived from ARCHITECTURE.md, Implementation-plan.md, HANDOVER.md, todo.md — 2026-10-05*
*All items marked ❌ are NOT implemented. All items marked ✅ are verified done.*

---

## Overview — Three Console Levels

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1: OPERATOR CONSOLE  (control.satchida.com:8443)          │
│  Who: Satchida operator only (you)                              │
│  Auth: Cloudflare Service Token + bcrypt operator login         │
│  Sees: ALL tenants, ALL accounts, ALL provider keys             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ manages / provisions
┌──────────────────────────▼──────────────────────────────────────┐
│  TIER 2: CLIENT/TENANT ADMIN PANEL  (<subdomain>.satchida.com)  │
│  Who: School principal / Society secretary / SMB manager        │
│  Auth: Client-provisioned local admin account                   │
│  Sees: Their own tenant only — their users, seats, usage        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ manages / views for
┌──────────────────────────▼──────────────────────────────────────┐
│  TIER 3: END-USER USAGE DASHBOARD  (same LibreChat UI)          │
│  Who: Individual user / parent (for family accounts)            │
│  Auth: LibreChat session (local account or Google OIDC)         │
│  Sees: Their own usage only (+ child's usage if parent)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## TIER 1 — OPERATOR CONSOLE
### Location: `control.satchida.com` → `:8443` (HQ only, Cloudflare Service Token gated)
### Status: ❌ NOT IMPLEMENTED — BUILD FIRST

---

### 1A. Tenant Overview / Fleet Dashboard

**Widget: Global Health Bar**
- Total tenants: N active / N expired / N blocked
- Total active seats (sum across all tenants)
- Total token spend today (across all provider accounts)
- Alert count: nodes not heartbeating in last 6h

**Tenant Table (one row per client node)**

| Column | Source | Notes |
|---|---|---|
| Client Name | `tenants.name` | e.g. "Hiranandani Gardens RWA" |
| Subdomain | `tenants.subdomain` | e.g. `hgrwa.satchida.com` |
| Status Badge | `tenants.status` | ACTIVE (green) / EXPIRED (red) / BLOCKED (dark red) / SUSPENDED (grey) |
| Plan | `tenants.plan` | basic / pro / family / enterprise |
| Seats: Used / Allowed | `tenants.active_seats` / `tenants.allowed_seats` | Live count |
| Licence Expiry | `licence_events.payload.exp` | With countdown: "12 days remaining" |
| Last Heartbeat | `tenants.last_heartbeat` | "2 hours ago" — red if > 6h |
| Node IP | Last heartbeat source IP | Dynamic — changes if client reconnects from different IP |
| Token Spend Today | Aggregated from heartbeat deltas | Cross-account, cross-provider total |
| Token Spend This Month | Rolling 30-day from `heartbeats` table | |
| Actions | Buttons | Renew, Suspend, Revoke, Push Config, View Details |

**Filters:** Status, Plan, Expiry (expiring in 7/30 days), Search by name/subdomain

---

### 1B. Tenant Detail Drilldown

Click any tenant → opens full detail panel:

**Identity & Licence**
- Client ID (UUID)
- Subdomain + tunnel URL
- Plan tier + licence JWT payload (decoded, human-readable)
- Licence issued date, expiry date, issuing operator
- All historical licence events: issued → renewed → upgraded → suspended (timeline)

**Real-Time Node Status**
- Last heartbeat timestamp + source IP (dynamic — shows current client's public IP via tunnel)
- Node version (router_version from heartbeat)
- Currently active sessions: N
- Memory usage (if reported in heartbeat)
- Gateway enforcement status: active / locked / blocked

**Usage — Token & Credit Ledger**
- Token spend: today / this week / this month / all-time
- Spend by provider account: OpenAI-Acc1 / Anthropic-Acc2 / Gemini-Acc3 (breakdown)
- Spend by mode: Chat / Work / Study / Privacy (breakdown)
- Seat utilisation: peak concurrent today, average this week
- Image generation credits: used / allocated this month

**Heartbeat History (rolling 7 days)**
- Timeline chart: was node up or down at each 6-hour slot
- Table: timestamp, status, active_seats, token_usage_delta, node IP

**Licence Event Log (audit)**
- All events: issued, renewed, upgraded, downgraded, suspended, revoked, unblocked
- Each: timestamp, event type, operator who did it, payload diff

**Actions available from this panel:**
- Issue new licence (with plan, seat count, expiry date picker)
- Renew (extend expiry by 1 month / 3 months / 1 year)
- Upgrade / Downgrade plan (with semantics: prorate? reset? preserve? — operator selects)
- Suspend (immediate — locks node within next heartbeat cycle)
- Revoke (permanent — node gets 403 on next heartbeat)
- Unblock (clear block flag after issuing new licence)
- Push Config (send updated `node_state.json` payload via next heartbeat)

---

### 1C. Provider Key Pool Management

**Provider Account Table**

| Column | Notes |
|---|---|
| Account Alias | "OpenAI-Paid-1", "Anthropic-Primary" |
| Provider | OpenAI / Anthropic / Gemini / DeepSeek |
| Key Fingerprint | Last 4 chars only — never full key displayed |
| Monthly Spend Ceiling | ₹X,000 / $X00 — operator-set |
| Spend This Month | Live total from gateway ledger |
| Spend % | Progress bar — red when > 80% |
| Status | Available / At-Ceiling / Error / Retired |
| Tenants Using | Count of tenants routed through this account |
| Last Used | Timestamp |
| Actions | Edit ceiling / Rotate key / Retire |

**Add / Rotate Key Flow:**
1. Operator enters new key in a secure input (never shown back)
2. System stores in `C:\ProgramData\Satchida\keyring\` encrypted at rest
3. Key fingerprint logged to audit trail
4. Old key marked RETIRED, new key becomes AVAILABLE immediately
5. Gateway picks up on next request (no restart needed)

**Routing Rules UI:**
- Which provider accounts serve which plans (e.g. "Pro/Enterprise → OpenAI-Paid-1 primary, Anthropic-Primary fallback")
- Fallback order: drag-and-drop list per plan tier
- Local-vs-cloud preference slider per plan

**Key rotation policy:**
- Alert: key not rotated in > 90 days (configurable)
- Auto-retirement: key can be scheduled for retirement on a future date

---

### 1D. Account Allocations Manager

Per-tenant allocation editor:

| Setting | Type | Notes |
|---|---|---|
| Seat Count | Integer | Max concurrent sessions this tenant can have |
| Token Credits/Month | Integer | Monthly refill amount |
| Image Credits/Month | Integer | Monthly image generation allowance |
| Feature Flags | Multi-select | RAG, Agents, MCP, WebSearch, ImageGen, Think, DeepResearch |
| Family Plan | Toggle + max minors | Enable/disable; set max minor profiles (1–3) |
| Plan Tier | Dropdown | basic / pro / family / enterprise |
| Mode Access | Checkboxes | Chat / Work / Study / Privacy |
| STT/TTS | Toggle | Pre-enable for this tenant |
| Content Filter Level | Dropdown | Standard / Strict (schools) / Family (with DNS filter) |

**Batch Operations:**
- Select multiple tenants → Apply same allocation to all

---

### 1E. Global Admin Settings Page (pushes to ALL tenants via heartbeat)

**MCP Servers Registry**
- Table: name, endpoint URL, transport type (HTTP/SSE/stdio), auth type, enabled tiers
- Add / Edit / Disable per server
- Tier gate: which plan must a user have to see this MCP server
- Changes propagate via next heartbeat → `node_state.json` on each client

**Agent Marketplace Config**
- Table: agent name, category, description, skill list, visible-to tiers
- Enable / Disable agents globally or per tier
- Operator can mark agents as "Featured" (shown first)

**RAG Configuration (global defaults, per-tier overrides)**
- Enable RAG: per plan (off for Basic, on for Pro+)
- Embedding model: `BAAI/bge-m3` (BGE-M3, 1024-dim) — default
- Chunk size: 512 tokens, overlap: 64 tokens
- Similarity threshold: 0.65
- Max results per query: 5

**Content Filtering (global)**
- Guardrails AI: enable/disable, ruleset selection per tier
- DNS filter preset: 1.1.1.3 (Cloudflare) / AdGuard 94.140.14.14 / NextDNS
- ShieldGemma 2B: enable/disable (post-launch, not launch-blocker)
- Guardrails rules pushed to client `node_state.json` → gateway applies before forwarding

**STT / TTS Pre-Configuration**
- STT: Omni at :8080, route `/v1/audio/transcriptions` via gateway
- TTS: enable/disable, voice selection
- Set at operator level → all tenants inherit → users need zero configuration
- Per-tenant override: operator can set different STT endpoint for specific clients

---

### 1F. Reconciliation Console (Payment/UPI Approval)

Per ARCHITECTURE.md §5.3:

**Pending Payments Table**
| Column | |
|---|---|
| User / Tenant | Name + email |
| Plan Requested | |
| Amount Submitted | ₹X |
| UPI Reference / Transaction ID | User-entered |
| Submission Timestamp | |
| Status | Pending / Approved / Rejected |
| Approving Operator | After approval |
| Approval Timestamp | After approval |

**Actions:** Approve → triggers licence issue + subscription activation | Reject (with reason)
**Export:** CSV for bank reconciliation

---

### 1G. Audit Log (Operator Actions)

Every operator action logged immutably:
- Timestamp
- Operator identity (who)
- Action type (issued/revoked/upgraded/key-added/key-rotated/config-pushed)
- Target (tenant client_id or account alias)
- Payload diff (before/after for config changes)
- Source IP of operator browser

Filterable, searchable, paginated. Non-deletable.

---

## TIER 2 — CLIENT/TENANT ADMIN PANEL
### Location: `<subdomain>.satchida.com/client-admin` (within LibreChat)
### Auth: Client-provisioned local admin account (NOT the Satchida operator)
### Status: ❌ NOT IMPLEMENTED

---

### 2A. Tenant Dashboard (Client's Home)

**Summary Row:**
- Active users: N / N seats used
- Token spend today: X,XXX credits
- Token spend this month: XX,XXX credits
- Image credits used: N / N
- Service status: ACTIVE / EXPIRED / BLOCKED

**Account Status Panel:**
- Licence expiry: "Expires in 14 days" (with Renew button that opens UPI payment flow)
- Plan: Pro — Feature list visible to client admin
- Assigned seat count and current usage

---

### 2B. User Account Provisioning

**User List Table:**

| Column | Notes |
|---|---|
| Username / Display Name | |
| Account Type | Standard / Child / Admin |
| Status | Active / Suspended / Pending |
| Seat Used | Whether this user is currently in an active session |
| Tokens Used Today | |
| Tokens Used This Month | |
| Images Generated | Count this month |
| Last Active | Timestamp |
| Family Group | If on Family plan — which family |
| Actions | Edit / Suspend / Delete / Reset Password |

**Create User:**
- Username (for local login)
- Display name
- Role: User / Client Admin / Child (under 18)
- If Child: assign parent account (must be existing user in same tenant)
- If Family plan: assign to family group
- Initial password (must be changed on first login)
- Feature overrides (client admin can restrict below plan defaults, not expand above them)

**Bulk Operations:**
- CSV import: provision N users at once (username, display name, role)
- Bulk suspend / bulk reset passwords

**V10 Protection (built in):**
- First admin already created by Satchida operator during provisioning
- `ALLOW_REGISTRATION=false` enforced — client admin cannot accidentally open self-signup

---

### 2C. Usage Dashboard (Per-User Breakdown)

**Usage Table (per user, this month):**

| Column | |
|---|---|
| User | Name + type badge |
| Chat Messages | Count |
| Tokens Used | Input + output |
| Images Generated | Count |
| RAG Queries | Count |
| Web Searches | Count |
| Last Active | |
| Mode Breakdown | Chat/Work/Study/Privacy usage split |

**Charts:**
- Daily token spend (bar chart, 30 days)
- Mode usage distribution (pie)
- Peak hour heatmap (when is usage highest — useful for capacity planning)

**Per-User Drilldown:**
- Full usage history (not chat content — just metadata: timestamp, mode, tokens, type)
- Session log: when they logged in, session duration
- (Parent view only) chat history if monitoring is enabled on that child account

---

### 2D. Family Account Management (if Family Plan enabled)

**Family Groups:**
- List all family groups in this tenant
- Each group: owner (primary adult), secondary adult, children (up to 3)
- Per-family pool balance: tokens remaining this month

**Create Family Group:**
- Select owner account (must exist as user)
- Assign secondary adult
- Assign child accounts (each must already exist as type: Child)
- Set per-child limits: daily token cap, daily image cap, time schedule

**Parent Controls per Child:**
- Image generation: toggle ON/OFF (default OFF)
- Usage schedule: allowed hours (e.g. 9am–9pm on school days)
- Daily token limit: child's individual cap before family pool is touched
- Monitoring: always ON, non-configurable (child always sees "Parent is watching" badge)
- Suspend child account temporarily

---

### 2E. Audit Log (Client Admin Actions)

What the client admin did within their own tenant:
- Created / deleted / suspended users
- Changed passwords
- Modified family groups
- Changed user permissions

Read-only. Non-deletable. Client admin cannot see operator-level actions.

---

## TIER 3 — END-USER USAGE DASHBOARD
### Location: Settings → Usage (within LibreChat's existing UI)
### Status: ❌ NOT IMPLEMENTED — to be added to LibreChat settings panel

---

### 3A. Personal Usage Summary

**Current period (month):**
- Tokens used: X,XXX / X,XXX (with progress bar)
- Images generated: X / X
- Web searches: X
- RAG queries: X
- Plan: Pro — renews in 14 days

**Today:**
- Messages sent: N
- Tokens: N
- Mode breakdown: mostly Chat, some Work

---

### 3B. Usage History (30 days)

- Daily bar chart: tokens in / tokens out
- Mode usage over time
- Download CSV of own usage (DPDP right to access)

---

### 3C. Parent Dashboard (for Family plan parent/guardian only)

**Child Account Summary:**
- List of children in family
- Each child: current status, usage today, session active Y/N
- Family pool: tokens remaining this month

**Per-Child Detail:**
- Usage stats: same as personal but for child
- Session history: when logged in, how long
- Chat history (full transcript access — parent opted in at account setup)
- Monitoring Banner visible to child: "Your parent [name] can see your conversations"

**Controls (parent can do from this page):**
- Toggle child image generation ON/OFF
- Set/modify usage schedule
- Temporarily suspend child account ("Pause for tonight")
- View/export child's chat history

---

## PENDING IMPLEMENTATION CHECKLIST (ALL THREE TIERS)

### Backend — packages/api and packages/data-schemas

**New schemas needed (packages/data-schemas):**
- [ ] `plan.ts` — tier key, display name, price, seats, token allowance, refill interval
- [ ] `subscription.ts` — user/tenant, plan ref, status, started/expires timestamps
- [ ] `payment.ts` — UPI payment attempts, reference, amount, status, approval audit

**New API modules needed (packages/api/src/):**
- [ ] `billing/provider.ts` — PaymentProvider interface
- [ ] `billing/manual-upi.ts` — ManualUpiProvider implementation
- [ ] `billing/razorpay.ts` — RazorpayUpiProvider (built, inactive until account exists)
- [ ] `admin/reconciliation.ts` — payment approval queue + CSV export
- [ ] `admin/family.ts` — 5 family endpoints (create group, assign members, set limits, get monitoring, get child history)
- [ ] `admin/tenants.ts` — operator CRUD for tenant management
- [ ] `admin/provider-pool.ts` — key pool management (store in keyring, never return raw key)
- [ ] `admin/usage.ts` — per-tenant, per-user usage aggregation endpoints

**New fleet/control-service modules:**
- [ ] `fleet/src/control-service/index.ts` — Express app on :8443
- [ ] `fleet/src/control-service/heartbeat.ts` — HMAC validation, `last_seen` update, response builder
- [ ] `fleet/src/control-service/scheduler.ts` — 15-min sweep, status transitions
- [ ] `fleet/src/control-service/licence.ts` — Ed25519 JWT issue/verify/revoke
- [ ] `fleet/src/control-service/db.ts` — SQLite schema (tenants, heartbeats, licence_events)
- [ ] `fleet/src/sync-agent/agent.ts` — 6-hour client-side poll, HMAC sign, write node_state.json

**Gateway enforcement:**
- [ ] `fleet/src/gateway.mjs` — add status checks: 402 on licence_expired, 403 on node_blocked
- [ ] `fleet/src/gateway.mjs` — add provider pool rotation (read pool from node_state.json, select account, inject key, log usage)

---

### Frontend — client/src

**Operator console SPA (served from control service, NOT from :3080):**
- [ ] `fleet/src/dashboard/` — standalone Vite React app
- [ ] Fleet overview with tenant table, status badges, global health bar
- [ ] Tenant detail drilldown with all panels above
- [ ] Provider key pool management UI
- [ ] Account allocations editor
- [ ] Global admin settings (MCP, agents, RAG, filtering, STT)
- [ ] Reconciliation console (payment approval)
- [ ] Audit log viewer

**Client admin panel (within LibreChat, behind role gate):**
- [ ] `client/src/components/ClientAdmin/Dashboard.tsx` — summary row
- [ ] `client/src/components/ClientAdmin/UserList.tsx` — user table with actions
- [ ] `client/src/components/ClientAdmin/CreateUser.tsx` — provisioning form
- [ ] `client/src/components/ClientAdmin/UsageTable.tsx` — per-user breakdown
- [ ] `client/src/components/ClientAdmin/FamilyManager.tsx` — family group management
- [ ] `client/src/components/ClientAdmin/AuditLog.tsx` — client-level audit

**End-user dashboard (within LibreChat settings):**
- [ ] `client/src/components/Usage/PersonalUsage.tsx` — current period + charts
- [ ] `client/src/components/Usage/UsageHistory.tsx` — 30-day history + CSV export
- [ ] `client/src/components/Family/ParentDashboard.tsx` — child monitoring + controls
- [ ] `client/src/components/Family/MonitoringBanner.tsx` — "Parent is watching" persistent banner on child accounts

---

### Data Flow Summary

```
Operator sets settings in control console
    ↓
HQ SQLite updated
    ↓ (every 6 hours via sync agent)
node_state.json updated on client node
    ↓ (every request)
Gateway reads node_state.json → enforces licence, seats, features, provider routing
    ↓
LibreChat reads node_state.json → shows/hides features per plan
```

```
Client admin provisions user in Tier 2 panel
    ↓
API creates user in MongoDB with correct role + balance config
    ↓ (on user login)
Gateway validates licence JWT → enforces per-user limits from token.limits
    ↓
User sees only their plan's features in LibreChat UI
```

---

## WHAT'S MISSING FROM EXISTING DOCUMENTS

The following are **gaps** not covered anywhere in current architecture/implementation docs:

1. **Tenant node IP tracking** — heartbeat must capture source IP from Cloudflare tunnel headers (`CF-Connecting-IP`) and store in `tenants.last_ip`. Needed for operator console node IP column.

2. **Dynamic usage in real-time** — gateway must POST token usage to control service *within* the heartbeat delta (current design batches it). For operator real-time view, add a lightweight `/fleet/usage-event` endpoint that gateway calls after each response. Can be async/fire-and-forget.

3. **Per-account spend tracking** — current gateway design tracks total spend. Need to break it down by provider account ID so the pool management UI shows per-account spend.

4. **Client admin role** — LibreChat's RBAC has `ADMIN` and `USER`. Need a `CLIENT_ADMIN` role that has user-management permissions within their tenant only but cannot see other tenants. This sits between ADMIN and USER.

5. **Session log** — HANDOVER tracks chat history via auditLog, but session login/logout events are not explicitly captured. Add login event to auditLog for parent dashboard session view.

6. **Payment flow for client** — when client admin's licence is expiring, they need to initiate renewal through the Tier 2 panel (UPI QR + reference submission). This flow is not designed for the client side yet.

7. **Monitoring Banner spec** — the child must always see the banner. It must be:
   - Persistent (cannot be dismissed)
   - Shows parent's display name: "Your parent [Name] can see your conversations"
   - Rendered in the LibreChat header/sidebar, non-interceptable by child
   - Server-enforced: even if child inspects the DOM and removes it, the API still logs everything

8. **CSV export of own data (DPDP)** — under DPDP Act 2023 s.11, a user has the right to access their personal data. The personal usage dashboard must include a "Download my data" button that exports their conversation metadata (not raw content unless they request it) as CSV/JSON.
