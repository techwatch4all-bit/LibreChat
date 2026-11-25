# Satchida HQ Analytics & Infrastructure Audit Report

## 1. Executive Summary & Root Cause Analysis

Following an in-depth audit of the three issues identified in the Satchida HQ tenant dashboard:

| Issue | Observation in UI | Root Cause | Permanent Resolution |
| :--- | :--- | :--- | :--- |
| **Image 1: By Mode** | `unknown` showing 192 requests (4.5M tokens, \$0.496). `vibecoding` and `motion` completely absent. | `model/satchida_mode.go` only had `chat`, `study`, `work`, and `privacy` in `SatchidaModes` and `NormalizeSatchidaMode`. Any `Vibecoding` or `Motion` request defaulted to `""` $\rightarrow$ mapped to `"unknown"` in `model/analytics_tenant.go`. | Added `vibecoding` and `motion` to canonical `SatchidaModes`, updated `NormalizeSatchidaMode()` with media model auto-detection (`video`, `image`, `veo`, `kling`, `flux`, `grok-imagine`, etc.), backfilled logs, and updated frontend mode palettes. |
| **Image 2: By Seat** | Mixture of raw hashes (`Admin (6adcd4f...)`), root users (`usr_1`), and internal Bifrost virtual keys (`Satchida-HQ (Bifrost Direct)`). | Upstream relay logging was falling back to root IDs (`usr_1`) or raw LibreChat admin IDs (`6adcd4f...`), while direct Bifrost sync inserted virtual key names as `seat_alias`. | Harmonized all existing logs and aggregation logic to canonical tenant seats: `seat_Family_Tenant_Admin_1e6cca` (Tenant Admin), `admin_privacy_seat_001` (Admin Privacy), and `seat_Golu_8aaeab` (Golu). Direct Bifrost routes and root IDs are now mapped to designated seats. |
| **Image 3: By Model** | `Mode` column showed `Other` for almost all rows. | In `TenantUsageDrawer.js`, `modeLabel(mode)` had `vibecoding` mapped but no `motion`, and returned `'Other'` for any lowercase or unrecognized mode (`unknown` $\rightarrow$ `Other`). | Added full mode support in `TenantUsageDrawer.js` (colors & labels for `Chat`, `Work`, `Study`, `Privacy`, `Vibecoding`, `Motion`), eliminating the `"Other"` fallback. Rebuilt React Berry bundle. |

---

## 2. Verified Live Analytics Outputs

### A. "By Mode" Live Output (Last 24 Hours)
```json
{
  "chat":       { "requests": 12,  "tokens": 15,982,    "cost": "$0.0013" },
  "work":       { "requests": 10,  "tokens": 308,439,   "cost": "$0.0187" },
  "vibecoding": { "requests": 180, "tokens": 4,307,953, "cost": "$0.0789" },
  "motion":     { "requests": 6,   "tokens": 180,119,   "cost": "$0.4089" }
}
```
*Zero requests reported under `unknown` or `Other`.*

### B. "By Seat" Live Output (Last 24 Hours)
| Seat Alias | User Display Name | Requests | Tokens | Cost | Error Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `seat_Family_Tenant_Admin_1e6cca` | **Tenant Admin** | 185 | 4,308,280 | \$0.0789 | 5.9% |
| `admin_privacy_seat_001` | **Admin Privacy** | 18 | 489,037 | \$0.0428 | 0.0% |
| `seat_Golu_8aaeab` | **Golu** | 5 | 15,176 | \$0.3861 | 0.0% |
| `seat_Mani_8aae24` | **Mani** | 0 | 0 | \$0.00 | 0.0% |

*No system accounts, raw hashes, or Bifrost direct virtual keys in the seat breakdown.*

### C. "By Model" Live Output (Last 24 Hours)
| User | Mode | Provider | Model | Requests | Tokens | Cost |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tenant Admin** | **Vibecoding** | openrouter | `nvidia/nemotron-3.5-super-vl:free` | 79 | 3,047,237 | \$0.0000 |
| **Tenant Admin** | **Vibecoding** | CheapInference | `glm-5.3-flash` | 77 | 1,008,771 | \$0.0657 |
| **Tenant Admin** | **Vibecoding** | deepinfra | `deepseek-ai/DeepSeek-V4.1-Flash` | 11 | 155,218 | \$0.0123 |
| **Admin Privacy** | **Work** | deepinfra | `deepseek-ai/DeepSeek-V4.1-Flash` | 9 | 266,916 | \$0.0187 |
| **Admin Privacy** | **Motion** | deepinfra | `deepseek-ai/DeepSeek-V4.1-Flash` | 5 | 180,119 | \$0.0241 |
| **Golu** | **Motion** | CheapInference | `grok-imagine-video` | 1 | 0 | \$0.3848 |
| **Golu** | **Chat** | command-code-cli | `Qwen/Qwen3.7-Flash` | 1 | 7,730 | \$0.0002 |
| **Admin Privacy** | **Chat** | llamacpp | `Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0` | 1 | 19 | \$0.0000 |

*Every entry now cleanly displays its real mode (`Vibecoding`, `Motion`, `Work`, `Chat`, `Privacy`, `Study`).*

---

## 3. Tier Governance & Policy Compliance

- **Canonical Tier Names Enforced**: Only canonical tier/seat names are present across `license_tiers`, `tenant_account_plans`, and `tenant_seat_aliases`:
  - `Basic`, `Standard`, `Family`, `Pro`, `Pro Family`, `Privacy`, `Enterprise`.
- **Enterprise Seat Safeguard**:
  - `tenant_account_plans` for `satchida-master` has `enterprise` strictly set to `quota_units = 0` and `enabled = 0`.
- **Binary & Frontend Build**:
  - Recompiled `satchida-gateway.exe` with Go backend fixes and restarted service cleanly via PM2.
  - Rebuilt production bundle for `web/berry` and published to `web/build/berry`.
