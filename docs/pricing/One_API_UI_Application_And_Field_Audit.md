# Satchida Sovereign AI: One-API UI Application & Field Audit Report

> **Execution Report: Applying Finalized MTok, Quota Units, Pricing, and Media Limits via Authenticated One-API Gateway (`http://127.0.0.1:4000`), with In-Depth UI Gap Analysis for Satchida HQ (`satchida-master`).**

---

## 1. Updates Applied to `satchida-master` (Satchida HQ)

The updated token ceilings and pricing policies were submitted and confirmed via the **authenticated One-API REST API** (`/api/tenant/satchida-master/account-plan`):

```
┌─────────────────┬───────────────────┬──────────────────┬─────────────────┬──────────────────┬──────────────────┐
│ ACCOUNT TYPE    │ DISPLAY NAME      │ PRICE (INR)      │ QUOTA UNITS     │ INPUT MTOK       │ OUTPUT MTOK      │
├─────────────────┼───────────────────┼──────────────────┼─────────────────┼──────────────────┼──────────────────┤
│ **basic**       │ Basic Free        │ ₹0               │ 250,000         │ 1 Mtok           │ 1 Mtok           │
│ **standard**    │ Standard Pro      │ ₹299             │ 1,250,000       │ 5 Mtok           │ 5 Mtok           │
│ **family**      │ Family Safety     │ ₹999             │ 3,750,000       │ 15 Mtok          │ 15 Mtok          │
│ **pro**         │ Pro Developer     │ ₹1,499           │ 5,000,000       │ 20 Mtok          │ 20 Mtok          │
│ **pro_family**  │ Pro Family Dev    │ ₹2,499           │ 8,750,000       │ 35 Mtok          │ 35 Mtok          │
│ **privacy**     │ Sovereign Privacy │ ₹3,499           │ 6,250,000       │ 25 Mtok          │ 25 Mtok          │
│ **enterprise**  │ Enterprise Fleet  │ ₹5,000 / seat    │ 15,000,000/seat │ 60 Mtok          │ 60 Mtok          │
└─────────────────┴───────────────────┴──────────────────┴─────────────────┴──────────────────┴──────────────────┘
```

---

## 2. Updates Applied to Global License Tiers (`/api/license-tier/`)

All global tier definitions were updated with token allocations, pricing, and feature matrices:

- **Enterprise:** Price set to **₹25,00,000** (500 seats minimum commitment @ ₹5,000/seat), **30 Billion pooled cloud tokens** (15,000,000 quota units / seat).
- **Pro:** ₹1,499, **20M tokens**, 1.6M priority / 3-hr window, **63 MGUs**.
- **Family:** ₹999, **15M pooled tokens**, 1.2M priority / 3-hr window, **30 MGUs**.
- **Pro Family:** ₹2,499, **35M pooled tokens**, 2.8M priority / 3-hr window, **100 MGUs**.
- **Privacy:** ₹3,499, **25M cloud tokens (ZDR)**, 2.0M priority / 3-hr window, **96 MGUs**.
- **Standard:** ₹299, **5M tokens**, 400K priority / 3-hr window, **0 MGUs**.
- **Basic:** ₹0, **1M tokens**, 75K priority / 3-hr window, **0 MGUs**.

---

## 3. One-API UI Gap Analysis: Missing Fields & Recommended Enhancements

By inspecting `AccountPlanManager.js`, `AccountPlanEditModal.js`, and `LicenseTierSetting.js`, several gaps were identified where the existing UI lacks dedicated columns for our finalized architecture:

### Gap 1: Missing "Media Generation Units (MGU)" Column
- **Current State:** The plan edit modal only accepts `Per-seat cost`, `Seat quota`, `Input Mtok`, and `Output Mtok`.
- **The Issue:** There is no field in the UI for the operator to inspect or edit the monthly MGU allowance (e.g. 30, 63, 100 MGUs).
- **Recommendation:** Add a `media_entitlement_mgu` column to `tenant_account_plans` and a corresponding input in `AccountPlanEditModal.js`.

### Gap 2: Missing "Rolling 3-Hour Window Ceiling"
- **Current State:** The UI displays only a monthly quota.
- **The Issue:** The 3-hour sliding window is currently managed via Bifrost rate limits rather than surfaced in the One-API Tenant Plan screen.
- **Recommendation:** Add a `rolling_window_tokens` field in the plan edit modal so the operator can adjust 3-hour priority limits directly from the table.

### Gap 3: Missing Live Audio Metering Breakdown
- **Current State:** Audio consumption (TTS/STT) is silently deducted from the primary token balance.
- **The Issue:** The Tenant Usage Drawer (`TenantUsageDrawer.js`) shows aggregate prompt and completion tokens, but does not display a dedicated sub-meter for Voice/Audio Minutes consumed.
- **Recommendation:** Add a dedicated **"Voice Talk-Time (Mins)"** telemetry card to the Tenant Analytics dashboard.
