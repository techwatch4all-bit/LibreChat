# Satchida — Overnight Autonomous Implementation Plan
*For Claude Sonnet batch execution — all decisions pre-made — no human input required*
*Prepared 2026-10-04 · Operator sleeping — do not prompt, do not pause, complete all phases*

---

> [!CAUTION]
> ## EXECUTION DISCIPLINE — READ BEFORE TOUCHING A SINGLE FILE
>
> **No hallucination.** If you do not know a file path, class name, function signature, or API
> shape — read the actual file first. Never invent them. Never assume they match what you
> expect. Always verify with `view_file` or `run_command` before editing.
>
> **No mock, no fake, no stub, no placeholder logic in production files.** If a feature is not
> ready, it returns an honest HTTP 4xx/5xx with a real error code. It does not return hardcoded
> data, `TODO`, `throw new Error('not implemented')`, or a simulated response.
>
> **Test and verify everything you build.** After each phase:
> 1. Run the TypeScript check for every workspace you touched.
> 2. Run the Jest/node:test suite for the package you touched.
> 3. Make a real HTTP request to the route you built and log the actual response.
> 4. If any check fails: fix it before proceeding to the next phase. Do not leave red tests.
>
> **Live progress tracking.** At the START of each phase section, write to
> `D:\LAN-AI-Infra\LibreChat\OVERNIGHT-LOG.md`:
> ```
> ## Phase [X] — [Name] — STARTED [timestamp]
> ```
> At the END of each phase, append:
> ```
> ## Phase [X] — [Name] — COMPLETED [timestamp]
> Exit criteria: PASS/FAIL for each item
> TypeScript errors: 0 / [N if any, listed]
> Tests: [X passing] / [Y total]
> ```
> If you run out of budget mid-phase, the log tells the next agent exactly where to resume.
>
> **Do not stop to ask the operator a question.** All decisions are pre-made in this document.
> If you encounter an unexpected situation not covered here, use your best judgement based on
> the AGENTS.md rules, log your decision in OVERNIGHT-LOG.md, and continue.

---

## Pre-flight: Read These Files First (in order, no skipping)

1. `D:\LAN-AI-Infra\LibreChat\AGENTS.md` — all module boundary rules
2. `D:\LAN-AI-Infra\LibreChat\HANDOVER.md` — system state, port assignments, bugs
3. `D:\LAN-AI-Infra\LibreChat\SOLUTIONS.md` — settled decisions (do not relitigate)
4. `D:\LAN-AI-Infra\LibreChat\Bugs.md` — known bugs to avoid re-introducing

**Known port assignments (never change these):**
- `:3080` LibreChat
- `:4000` Satchida gateway (`fleet/src/gateway.mjs`)
- `:8010` RAG service
- `:8080` llama-server (Omni — user's production inference, NEVER touch)
- `:8091` llama-server (Granite — user's second model, NEVER touch)
- `:8443` Fleet control (to be built)

**Never start a new llama-server process.** The user runs production inference at :8080 and :8091.

---

## Part A — Zero-Liability Contract Rewrite

### A1. Rewrite CONTRACT-CLAUSES.md §1 framing

**File:** `D:\LAN-AI-Infra\LibreChat\CONTRACT-CLAUSES.md`

Find and replace the opening description of the relationship. The current framing uses "Service Provider / service agreement" language. Replace the preamble to establish the software licensor position:

Add this block at the top of the file, after the title line, before §1:

```markdown
## Preamble — Nature of This Agreement

This Agreement is a **software licence and support agreement**, not a service agreement.
Satchida (the Licensor) licenses software to the Client (the Licensee). The Licensor does
not operate the software, does not operate any hardware, does not store any end-user data,
and is not the service provider to any end user. The Client operates the software on the
Client's own hardware, for the Client's own users, under the Client's own terms of service.

The Licensor's only obligations are: (a) to deliver a working copy of the software,
(b) to maintain the remote licensing and heartbeat infrastructure, and (c) to provide
support as specified in this Agreement.

All obligations arising from the operation of the software — to users, to regulatory bodies,
to third parties — rest with the Client as the operator and, where applicable, the Data
Fiduciary under applicable Indian law.
```

### A2. Rewrite §10 Limitation of Liability — Remove the Cap Acknowledgement

**Current §10.1 problem:** Writing "liability shall not exceed 3 months' fees" in a contract acknowledges that liability exists — it just caps it. In litigation, opposing counsel argues "you admitted liability, now we argue the quantum."

**Better drafting — maximum disclaimer, cap only as final backstop:**

Replace the entire §10 block with:

```markdown
## 10. Disclaimer of Warranties and Limitation of Liability

> **10.1 As-Is licence.** The software is licensed **"as is"**, without warranty of any kind,
> express or implied. To the maximum extent permitted by applicable law, the Licensor
> expressly disclaims all warranties including, without limitation, warranties of
> merchantability, fitness for a particular purpose, title, and non-infringement.

> **10.2 No service warranty.** The Licensor does not warrant that the software will be
> uninterrupted, error-free, or free of harmful components. The Client accepts full
> responsibility for the consequences of operating the software on its infrastructure.

> **10.3 Complete exclusion of liability.** To the maximum extent permitted by applicable
> law, the Licensor shall have **no liability whatsoever** to the Client or any third party
> for any loss or damage of any kind arising out of or in connection with this Agreement or
> the use or inability to use the software, including but not limited to:
> (a) loss of profits, revenue, or anticipated savings;
> (b) loss of business, contracts, or commercial opportunity;
> (c) loss, corruption, or destruction of data;
> (d) loss of goodwill or reputation;
> (e) claims by the Client's users, employees, regulators, or any third party;
> (f) regulatory fines or penalties arising from the Client's operation of the software;
> (g) any indirect, consequential, special, incidental, or punitive damage.

> **10.4 Statutory backstop.** Where applicable law does not permit complete exclusion of
> liability — and only to that extent — the Licensor's aggregate liability shall not exceed
> the total licence fees paid by the Client in the **three (3) calendar months immediately
> preceding the specific event** giving rise to the claim. This is a statutory minimum
> fallback, not an acknowledgement of liability.

> **10.5 Client indemnity.** The Client shall indemnify, defend, and hold harmless the
> Licensor and its representatives from and against any and all claims, liabilities, losses,
> damages, costs, and expenses (including legal fees on a full indemnity basis) arising from:
> (a) the Client's operation of the software;
> (b) any claim by an end user or third party relating to the Client's service;
> (c) the Client's failure to comply with applicable law, including POCSO, DPDP, IT Act,
>     GST, and any other regulatory obligation;
> (d) the Client's failure to comply with Schedule A of this Agreement;
> (e) any data breach, privacy violation, or regulatory penalty arising at the Client's site;
> (f) any claim relating to the Client's terms of service or EULA with its users.

> **10.6 No privity with end users.** End users of the software have no contractual
> relationship with the Licensor. Any claim an end user may have is solely against the
> Client as operator. The Licensor is not a party to, and accepts no obligation under, any
> agreement between the Client and its users.

> **10.7 Mutual acknowledgement.** The Client acknowledges that:
> (a) it has independently assessed the suitability of the software for its purposes;
> (b) the Licensor's pricing reflects the complete disclaimer of liability in this clause;
> (c) the Client is the operator and Data Fiduciary and accepts those responsibilities.

> **10.8 Exceptions.** Nothing in this clause excludes liability that applicable law
> expressly prohibits excluding, specifically: (a) death or personal injury caused by
> the Licensor's fraud or gross negligence; (b) fraud or fraudulent misrepresentation
> by the Licensor. These exceptions are narrow and do not expand the Licensor's liability
> beyond what the law mandates.
```

**Why this is better than a simple cap:**
- 10.1–10.3: assert zero liability as the primary position
- 10.4: the cap appears only as a "statutory backstop" — framed as compliance with law, not as acknowledgement
- 10.5: client indemnifies YOU for everything — this is the active protection, not the cap
- 10.6: no privity — end users cannot sue you directly at all
- 10.7: client signed knowing all this

---

## Part B — Billing Partner Agreement (One Page)

**File to create:** `D:\LAN-AI-Infra\LibreChat\BILLING-PARTNER-AGREEMENT.md`

```markdown
# Billing Agency Agreement
*Between: [Billing Partner Name] ("the Agent") and [Operator Name] ("the Principal")*
*Date: [DATE]*

This agreement records the terms of a billing agency arrangement between friends.
It is intended to be clear and fair, not adversarial.

## 1. What the Agent does

The Agent invoices Clients of the Principal's software licence business on the Principal's
behalf, collects payment (including GST where applicable), and remits the net amount to the
Principal. The Agent's role is **purely administrative billing** — the Agent has no
involvement in the software, no access to client data, no knowledge of or control over
what the software does or how it is used.

## 2. What the Agent does NOT do

The Agent:
- Does not provide, operate, or support any software or technology service
- Does not store, access, or process any end-user data
- Does not make any representations about the software to clients
- Has no authority to enter into any agreement on the Principal's behalf beyond issuing invoices
- Is not a co-founder, partner, director, shareholder, or officer of any entity related
  to the Principal's business

## 3. Commission

The Agent retains **[X]%** of each collected invoice as commission for the billing service.
The Agent remits the balance (100% minus [X]% minus applicable TDS if deducted at source)
to the Principal within **[7] business days** of clearing each payment.

Commission is calculated on the net amount received, excluding GST.

## 4. GST and tax compliance

The Agent issues tax-compliant GST invoices under the Agent's own GSTIN. The Agent is
responsible for filing and remitting GST collected. The Principal is responsible for
income tax on amounts received. Neither party is responsible for the other's tax obligations.

## 5. Complete immunity of the Agent

The Agent has no liability whatsoever to any client, end user, regulator, ISP, or third
party arising from or connected with the Principal's software, the Principal's business,
or any service the Principal provides. The Agent is a billing intermediary only.

If any client, end user, or third party makes a claim against the Agent arising from the
Principal's software or services, the **Principal shall immediately assume the defence of
that claim** and shall indemnify and hold harmless the Agent from all costs, liability, and
expense arising from it, including legal fees on a full indemnity basis.

Cloudflare, ISPs, and technology infrastructure providers used by the Principal's service
have no relationship with the Agent. Any claim involving that infrastructure is entirely the
Principal's matter.

## 6. Complete immunity of the Principal from billing errors

If the Agent makes an administrative billing error (wrong amount, missed invoice, GST error),
the Agent's liability to the Principal is limited to correcting the error and remitting any
shortfall. The Agent is not liable for consequential loss from billing errors.

## 7. Confidentiality

Both parties treat client names, invoice amounts, and the terms of this agreement as
confidential. Neither discloses them without the other's consent, except as required by law
or a regulator.

## 8. Duration and termination

Either party may end this arrangement with **30 days' written notice** (WhatsApp message
with read receipt is sufficient). Pending invoices and remittances are settled before
the arrangement closes.

## 9. Governing law

This agreement is governed by the laws of India. Disputes are resolved between the parties
directly; if escalated, the courts at [City] have jurisdiction.

## 10. Entire agreement

This is the complete agreement on billing. It does not create any partnership, joint venture,
employment, or agency beyond what is described in clause 1.

Signed (digital or physical):

[Billing Partner Name] _____________________ Date: _______
[Operator Name]        _____________________ Date: _______
```

---

## Part C — Family Profiles Option A — Architecture in LibreChat

### What already exists in LibreChat that we use

- `packages/data-schemas/src/schema/user.ts` — user document with `role` field
- `packages/data-schemas/src/schema/balance.ts` — `tokenCredits`, `imageCredits` per user
- `packages/api/src/middleware/checkBalance.ts` — balance enforcement

### Schema additions (minimal — do not break existing users)

**File:** `packages/data-schemas/src/schema/user.ts`

Add these fields to the existing user schema (append, do not modify existing fields):

```typescript
// Family plan fields — only populated for FAMILY plan users
familyAccountId: {
  type: Types.ObjectId,
  ref: 'User',
  default: null,
  // null = not a family account member
  // self._id = this is the Family Account owner (primary adult)
  // parent._id = this is a sub-profile linked to that owner
},
familyRole: {
  type: String,
  enum: ['owner', 'adult', 'minor', null],
  default: null,
},
guardianId: {
  type: Types.ObjectId,
  ref: 'User',
  default: null,
  // for minor profiles: points to their guardian (familyRole === 'owner' or 'adult')
},
familyLimits: {
  type: {
    imageGenEnabled: { type: Boolean, default: false },
    imageCreditsPerDay: { type: Number, default: null },  // null = no per-day cap
    tokenCreditsPerDay: { type: Number, default: null },
    allowedHoursFrom: { type: String, default: null },   // "07:00"
    allowedHoursTo: { type: String, default: null },     // "21:00"
  },
  default: null,
},
// Monitoring — full access from day 1 per operator decision
parentalMonitoringEnabled: {
  type: Boolean,
  default: true,  // always true for minor profiles
},
parentalConsentAt: { type: Date, default: null },
parentalConsentVersion: { type: String, default: null },
```

### How family accounts work technically

**Creating a child profile (parent does this from their settings page):**

```
POST /api/family/add-profile
Auth: parent's JWT
Body: {
  displayName: "Aarav",
  loginEmail: "aarav.kumar@satchida.family",  // parent chooses
  loginPassword: "...",                         // parent sets
  ageGroup: "minor",
  imageGenEnabled: false,
  imageCreditsPerDay: 5
}

Server:
1. Verify caller has familyRole === 'owner' and plan === 'family'
2. Count existing minor profiles — reject if >= maxMinorProfiles (3)
3. Create new User document:
   - role: 'USER' (standard LibreChat role)
   - familyAccountId: parent._id
   - familyRole: 'minor'
   - guardianId: parent._id
   - familyLimits: { imageGenEnabled: false, imageCreditsPerDay: 5, ... }
   - parentalMonitoringEnabled: true
   - balance: NOT created — child has no balance document
4. Return { profileId, loginEmail }
```

**Credit deduction for child usage:**

The child has no balance document. The gateway/checkBalance middleware is extended:

```typescript
// packages/api/src/middleware/checkBalance.ts — add at top of check:
if (user.familyAccountId && user.familyRole === 'minor') {
  // 1. Enforce child's daily image cap
  if (isImageRequest) {
    const todayCount = await getChildDailyImageCount(user._id);
    if (user.familyLimits.imageCreditsPerDay !== null 
        && todayCount >= user.familyLimits.imageCreditsPerDay) {
      return res.status(402).json({ 
        code: 'child_daily_image_limit', 
        message: 'Daily image limit reached' 
      });
    }
  }
  // 2. Check family pool (debit from parent's balance)
  req.billingUserId = user.familyAccountId;  // debit parent's account
} else {
  req.billingUserId = user._id;
}
// rest of existing checkBalance logic uses req.billingUserId
```

**Parent monitoring — child's conversation visible in parent dashboard:**

```typescript
// packages/api/src/routes/family.ts (new file)
router.get('/conversations/:childId', requireAuth, async (req, res) => {
  const parent = req.user;
  const child = await getUserById(req.params.childId);
  
  // verify parent is the guardian
  if (!child?.guardianId?.equals(parent._id)) {
    return res.status(403).json({ code: 'not_guardian' });
  }
  
  // return child's conversations as if they were the parent's
  const conversations = await getConversationsByUser(child._id);
  return res.json(conversations);
});
```

**Non-dismissible monitoring banner — child sees on every page:**

```typescript
// client/src/components/Family/MonitoringBanner.tsx
import { useLocalize } from '~/hooks';
import { useRecoilValue } from 'recoil'; // or jotai atom

export function MonitoringBanner({ user }) {
  if (user?.familyRole !== 'minor') return null;
  const localize = useLocalize();
  
  return (
    <div 
      role="status" 
      aria-live="polite"
      style={{ 
        position: 'sticky', top: 0, zIndex: 50,
        background: '#FEF3C7', borderBottom: '1px solid #F59E0B',
        padding: '6px 16px', fontSize: '13px', textAlign: 'center'
      }}
    >
      👁 {localize('com_family_monitoring_banner')}
    </div>
  );
}

// Add to client/src/locales/en/translation.json:
// "com_family_monitoring_banner": "Your parent can see your full conversation history here."
```

Mount `<MonitoringBanner user={user} />` in `client/src/components/Chat/ChatView.tsx` just inside the outermost container.

### Account package activation via licence token (answers "can operator control it?")

**Yes — fully.** The heartbeat response already carries `plan` and `allowed_seats`. Extend it:

```json
{
  "ok": true,
  "plan": "family",
  "allowed_seats": 5,
  "family_enabled": true,
  "max_minor_profiles": 3,
  "image_gen_adults_enabled": true,
  "image_gen_minors_default": false,
  "token_credits_monthly": 500000,
  "image_credits_monthly": 500,
  "features": ["chat", "work", "study", "privacy", "rag"],
  "commands": []
}
```

The sync-agent writes this to `node_state.json`. The gateway reads `node_state.json` on every request. When the operator changes a client's plan at HQ:
1. HQ updates the tenant row in SQLite
2. Next heartbeat (within 30s) delivers the new package
3. Gateway hot-reloads — no restart needed
4. Client's users get new capabilities on next request

**The operator can from the HQ console:**
- Enable/disable Family Plan for a client
- Set max minor profiles (1–3)
- Enable/disable image gen for adults
- Set monthly credit allowances
- Add/remove features
- Suspend the entire account (heartbeat returns 403)

All of this without touching the client's machine.

---

## Part D-BRAND — Satchida Rebrand and Theme (Do This BEFORE D0)

### Legality: Can LibreChat be rebranded?

**Yes. MIT licence is unconditionally permissive.** You may:
- Remove all LibreChat name/logo/branding ✅
- Replace with Satchida name/logo/branding ✅
- Distribute the rebranded product ✅
- Use commercially ✅

**Only obligation:** keep the original MIT copyright notice in a `LICENSES/` directory.
Do NOT delete MIT notices — just move them to `LICENSES/LIBRECHAT-MIT.txt`.

### Step 1 — Create LICENSES directory

```powershell
New-Item -ItemType Directory -Force "D:\LAN-AI-Infra\LibreChat\LICENSES"
# Copy the existing MIT notice from package.json or LICENSE file
Copy-Item "D:\LAN-AI-Infra\LibreChat\LICENSE" "D:\LAN-AI-Infra\LibreChat\LICENSES\LIBRECHAT-MIT.txt"
```

### Step 2 — Satchida Theme Tokens

The design reference is the splash proposal at:
`D:\LAN-AI-Infra\Satchida\backups\20261003-011952-after-websearch-privacy-impl-phase1\files\_splash-proposal.html`

Assets are in:
`D:\LAN-AI-Infra\Satchida\backups\20261003-011952-after-websearch-privacy-impl-phase1\files\`

**Do NOT touch LibreChat's existing `dark` and `light` themes.** Add two new themes:
- `satchida-dark` (navy, deep blue — **set as default**) 
- `satchida-light` (blue-tinted pearl white)

**File to create:** `client/src/style/themes/satchida.css`

Derived from the splash proposal CSS variables:

```css
/* =============================================
   Satchida Dark Theme (Navy Deep Blue)
   Default theme — loaded if no preference set
   ============================================= */
[data-theme="satchida-dark"] {
  /* Backgrounds — from splash .dark .mesh gradient */
  --surface-primary:       #060816;   /* near-black navy */
  --surface-secondary:     #0b1333;   /* deep indigo */
  --surface-elevated:      #12245a;   /* mid navy */
  --surface-overlay:       #173474;   /* highlight navy */

  /* Text */
  --text-primary:          #e8f0fe;
  --text-secondary:        #cfe3ff;   /* from splash --tag */
  --text-muted:            #7dd3fc;   /* from splash --dot */

  /* Brand / accent */
  --brand-primary:         #3b82f6;   /* blue-500 */
  --brand-glow:            rgba(61, 127, 181, 0.4);   /* --glow in dark pane */
  --brand-ring-a:          rgba(120, 190, 255, 0);
  --brand-ring-b:          rgba(120, 190, 255, 0.16);
  --brand-ring-c:          rgba(140, 205, 255, 0.42);

  /* Borders */
  --border-subtle:         rgba(120, 190, 255, 0.12);
  --border-default:        rgba(120, 190, 255, 0.22);

  /* Sidebar */
  --sidebar-bg:            #0b1333;
  --sidebar-hover:         rgba(120, 190, 255, 0.08);
  --sidebar-active:        rgba(120, 190, 255, 0.15);

  /* Input */
  --input-bg:              #12245a;
  --input-border:          rgba(120, 190, 255, 0.25);
  --input-focus-ring:      rgba(59, 130, 246, 0.4);
}

/* =============================================
   Satchida Light Theme (Blue-tinted Pearl)
   ============================================= */
[data-theme="satchida-light"] {
  /* Backgrounds — from splash .light .mesh gradient */
  --surface-primary:       #eff6ff;   /* blue-50 */
  --surface-secondary:     #dbeafe;   /* blue-100 */
  --surface-elevated:      #bfdbfe;   /* blue-200 */
  --surface-overlay:       #ffffff;

  /* Text */
  --text-primary:          #1e3a8a;   /* blue-900 */
  --text-secondary:        #1e3a8a;   /* --tag in light pane */
  --text-muted:            #3b82f6;   /* --dot in light pane */

  /* Brand / accent */
  --brand-primary:         #2563eb;   /* blue-600 */
  --brand-glow:            rgba(59, 130, 246, 0.3);   /* --glow in light pane */
  --brand-ring-a:          rgba(37, 99, 235, 0);
  --brand-ring-b:          rgba(37, 99, 235, 0.14);
  --brand-ring-c:          rgba(30, 64, 175, 0.5);

  /* Borders */
  --border-subtle:         rgba(37, 99, 235, 0.08);
  --border-default:        rgba(37, 99, 235, 0.18);

  /* Sidebar */
  --sidebar-bg:            #dbeafe;
  --sidebar-hover:         rgba(37, 99, 235, 0.08);
  --sidebar-active:        rgba(37, 99, 235, 0.15);

  /* Input */
  --input-bg:              #ffffff;
  --input-border:          rgba(37, 99, 235, 0.2);
  --input-focus-ring:      rgba(37, 99, 235, 0.35);
}
```

### Step 3 — Register themes in LibreChat

LibreChat stores the theme preference in `client/src/store/`. Find the theme store atom (likely in `client/src/store/appearance.ts` or similar — READ THE FILE FIRST, do not guess).

Add `'satchida-dark'` and `'satchida-light'` to the allowed themes enum/array.

Set `'satchida-dark'` as the default value for first-time users (no stored preference).

### Step 4 — Logo and splash assets

Logo assets for the splash already exist at:
```
D:\LAN-AI-Infra\Satchida\backups\20261003-011952-after-websearch-privacy-impl-phase1\files\
├── satchida-splash-mandala.png        ← mandala logo mark
├── satchida-splash-wordmark.png       ← wordmark for light theme
└── satchida-splash-wordmark-dark.png  ← wordmark for dark theme
```

**Do:** copy these to `client/public/assets/satchida/` and use them in:
1. The splash/loading screen (`client/src/components/Nav/` — find the loading spinner/logo, READ THE FILE)
2. The `client/public/manifest.json` for PWA icons (resize mandala to 192×192 and 512×512)
3. The page `<title>` tag → change from "LibreChat" to "Satchida"
4. The `client/public/favicon.ico` — use the mandala mark

### Step 5 — Remove LibreChat name from user-visible strings

Search for "LibreChat" in:
- `client/src/locales/en/translation.json`
- `client/public/manifest.json`
- `client/public/index.html` (the `<title>`)
- Any `<title>` or `name` field in `package.json` in `client/`

Replace every user-visible instance with "Satchida". Do NOT rename internal code variables, class names, or imports — only user-visible text strings.

### Step 6 — Animated splash screen using the proposal design

The splash proposal (`_splash-proposal.html`) already has the full CSS for the animated logo — mesh gradient background, pulse ring, mandala, sweep line, and wordmark.

Port the CSS animations to `client/src/components/Auth/SplashScreen.tsx` (or wherever LibreChat shows its loading state — READ THE FILE FIRST).

Use these exact CSS keyframes from the proposal:
- `mesh-drift` — slow background parallax
- `pulse` — travelling ring from centre outward  
- `breathe` — glow ambient
- `sweep-spin` — rotating conic sweep line

Apply the dark theme colours by default (`#060816` background, navy mesh gradient).

### Step 7 — Verify no LibreChat branding remains

```powershell
# Search user-visible strings only (not code identifiers)
Select-String -Path "client\src\locales\en\translation.json" -Pattern "LibreChat" -CaseSensitive
Select-String -Path "client\public\manifest.json" -Pattern "LibreChat" -CaseSensitive
Select-String -Path "client\public\index.html" -Pattern "LibreChat" -CaseSensitive
# Any hits must be fixed before proceeding
```

**Exit criteria for D-BRAND:**
- [ ] `LICENSES/LIBRECHAT-MIT.txt` exists (MIT compliance)
- [ ] `client/src/style/themes/satchida.css` created with both theme blocks
- [ ] `satchida-dark` is the default theme for new users
- [ ] `client/public/assets/satchida/` has all three logo files
- [ ] `<title>` in all HTML entry points says "Satchida"
- [ ] PWA manifest name = "Satchida"
- [ ] Animated splash uses mandala + navy mesh gradient from the proposal
- [ ] No "LibreChat" in any user-visible string (grep confirms)
- [ ] `npx tsc --noEmit` in client/ passes with zero errors

---

## Part D0 — Pre-flight State Check


*Execute in order. Each phase must pass its exit criteria before proceeding to the next.*
*Log all results to `D:\LAN-AI-Infra\LibreChat\OVERNIGHT-LOG.md`.*

### D0 — Pre-execution state check (15 min)

```powershell
# Check what is currently running
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, StartTime
netstat -an | findstr "LISTENING" | findstr ":3080 :4000 :8010 :8080 :8091 :8443"

# Check LibreChat build state
Test-Path "D:\LAN-AI-Infra\LibreChat\client\dist\index.html"
Test-Path "D:\LAN-AI-Infra\LibreChat\.env"
Test-Path "D:\LAN-AI-Infra\LibreChat\librechat.yaml"

# Check gateway tests
Set-Location "D:\LAN-AI-Infra\LibreChat\fleet"
node --test 2>&1 | Select-String "pass|fail|ok"
```

Log the results. Do not proceed to D1 if `:8080` or `:8091` are not listening — the user's production inference is down and something is wrong.

---

### D1 — Fix B2: Add STT route to gateway (2–3 hours)

**Bug:** `fleet/src/gateway.mjs` has no `POST /v1/audio/transcriptions` route. LibreChat STT is broken.

**File:** `D:\LAN-AI-Infra\LibreChat\fleet\src\gateway.mjs`

Add this route (pipe to Omni's STT endpoint):

```javascript
// POST /v1/audio/transcriptions — forward to llama.cpp Omni STT
app.post('/v1/audio/transcriptions', checkLicence, async (req, res) => {
  try {
    const upstream = new URL('/v1/audio/transcriptions', OMNI_BASE);
    // pipe the multipart form data through
    const response = await fetch(upstream.toString(), {
      method: 'POST',
      headers: {
        // forward content-type (multipart boundary is in it)
        'Content-Type': req.headers['content-type'],
      },
      body: req,  // pipe request body directly
      duplex: 'half',
    });
    
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ 
        error: 'STT upstream error', 
        code: 'stt_upstream_error' 
      });
    }
    
    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error('[STT] proxy error:', err.message);
    res.status(503).json({ error: 'STT service unavailable', code: 'stt_unavailable' });
  }
});
```

**Where `OMNI_BASE` is defined:** already in `gateway.mjs` as the Omni endpoint. Use the same constant.

**Test:**
```powershell
# Record a test WAV (use existing test audio or create with PowerShell)
$audio = [System.IO.File]::ReadAllBytes("D:\LAN-AI-Infra\LibreChat\fleet\tests\test-audio.wav")
# OR use curl:
curl -X POST http://localhost:4000/v1/audio/transcriptions `
  -H "Authorization: Bearer test-token" `
  -F "file=@D:\LAN-AI-Infra\LibreChat\fleet\tests\test-audio.wav" `
  -F "model=whisper-1"
# Expected: {"text": "...transcribed text..."}
```

Add a Jest test to `fleet/tests/stt.test.mjs` that mocks the Omni response and verifies the route exists and proxies correctly.

**Exit criteria:** `POST /v1/audio/transcriptions` returns JSON with `text` field. Add test to passing suite.

---

### D2 — Fix contract files (30 min)

**D2a.** Add the preamble block and rewrite §10 in `CONTRACT-CLAUSES.md` per Part A above.

**D2b.** Create `BILLING-PARTNER-AGREEMENT.md` per Part B above (leave [X]%, [DATE], [City] as placeholders).

**D2c.** Verify `TERMS.md` §5 fix is in place (already done in previous session — just verify):
```powershell
Select-String "Non-transferable" "D:\LAN-AI-Infra\LibreChat\TERMS.md"
# Should show "Non-transferable (between accounts)" and mention "Family Plan"
```

---

### D3 — Family schema addition (2–3 hours)

Add the six fields to `packages/data-schemas/src/schema/user.ts` per Part C above.

**Important:** Add the fields inside the existing schema object — do not redefine the schema. Find the closing brace of the schema definition and insert before it.

After editing:
```powershell
Set-Location "D:\LAN-AI-Infra\LibreChat"
npx tsc --noEmit -p packages/data-schemas/tsconfig.json
# Must show zero errors
```

---

### D4 — Family API routes (3–4 hours)

Create `packages/api/src/admin/family.ts` with these routes:
- `POST /api/family/add-profile` — add child/adult profile
- `GET /api/family/profiles` — list all profiles in the family
- `PATCH /api/family/profiles/:profileId/limits` — update child limits
- `GET /api/family/conversations/:childId` — parent views child conversations
- `DELETE /api/family/profiles/:profileId` — remove a profile

Register these routes in `packages/api/src/routes/index.ts` (or equivalent router file).

After editing:
```powershell
npx tsc --noEmit -p packages/api/tsconfig.json
# Must show zero errors
```

---

### D5 — MonitoringBanner component (1 hour)

Create `client/src/components/Family/MonitoringBanner.tsx` per Part C above.

Add the English key to `client/src/locales/en/translation.json`:
```json
"com_family_monitoring_banner": "Your parent can see your full conversation history here."
```

Mount the banner in `client/src/components/Chat/ChatView.tsx`.

Run the TypeScript check:
```powershell
npx tsc --noEmit -p client/tsconfig.json
```

---

### D6 — Heartbeat package extension (1–2 hours)

In `fleet/src/gateway.mjs`, extend the heartbeat response parsing to read the new fields:
`family_enabled`, `max_minor_profiles`, `image_gen_adults_enabled`, `image_gen_minors_default`, `token_credits_monthly`, `image_credits_monthly`, `features`.

Write these to `node_state.json` alongside the existing `plan` and `allowed_seats`.

In the licence enforcement middleware, read these new fields from `node_state.json` and enforce them on requests.

---

### D7 — checkBalance middleware family extension (2 hours)

Extend `packages/api/src/middleware/checkBalance.ts` per the child billing logic in Part C above. The child's usage debits the parent's balance document.

Add the `getChildDailyImageCount` helper to `packages/data-schemas/src/methods/` (or inline in the middleware with a direct query).

---

### D8 — NSSM service verification (30 min)

Check which NSSM services exist:
```powershell
nssm list 2>&1
```

If the following services do NOT exist, create them in this order:
1. `SatchiMongo` → `mongod --dbpath D:\LAN-AI-Infra\LibreChat\data\db --port 27017`
2. `SatchiRouter` → `node D:\LAN-AI-Infra\LibreChat\fleet\src\gateway.mjs` (port 4000)
3. `SatchiRag` → `node D:\LAN-AI-Infra\LibreChat\rag-service\src\server.mjs` (port 8010)
4. `SatchiChat` → `node D:\LAN-AI-Infra\LibreChat\api\server\index.js` (port 3080)

Use dependency ordering: SatchiMongo must be running before the others start.

**Do NOT create a service for llama-server** — the user manages that manually.

---

### D9 — Import sort and static checks (30 min)

```powershell
Set-Location "D:\LAN-AI-Infra\LibreChat"
# Sort imports on all files touched tonight
npm run sort-imports packages/data-schemas/src/schema/user.ts
npm run sort-imports packages/api/src/admin/family.ts
npm run sort-imports packages/api/src/middleware/checkBalance.ts
npm run sort-imports client/src/components/Family/MonitoringBanner.tsx

# Static checks
npm run static-checks -- --against origin/dev
```

---

### D10 — Final verification and log (30 min)

Run these checks and log every result to `OVERNIGHT-LOG.md`:

```powershell
# Gateway tests
Set-Location "D:\LAN-AI-Infra\LibreChat\fleet"
node --test 2>&1

# TypeScript
Set-Location "D:\LAN-AI-Infra\LibreChat"
npx tsc --noEmit -p packages/data-schemas/tsconfig.json
npx tsc --noEmit -p packages/api/tsconfig.json
npx tsc --noEmit -p client/tsconfig.json

# Service health
curl http://localhost:4000/health
curl http://localhost:8010/health
curl http://localhost:3080/api/health

# STT route
curl -X POST http://localhost:4000/v1/audio/transcriptions -H "X-Satchida-Licence: test" -F "file=@fleet/tests/test-audio.wav" -F "model=whisper-1"

# Family: verify user schema has new fields
node -e "const s = require('./packages/data-schemas/dist/schema/user.js'); console.log(Object.keys(s.UserSchema.paths).filter(k => k.startsWith('family')))"
```

Write a summary at the bottom of `OVERNIGHT-LOG.md`:
```
## Overnight Run Summary — [timestamp]
- D1 STT route: PASS/FAIL
- D2 Contract files: PASS/FAIL  
- D3 Family schema: PASS/FAIL
- D4 Family API routes: PASS/FAIL
- D5 MonitoringBanner: PASS/FAIL
- D6 Heartbeat extension: PASS/FAIL
- D7 checkBalance extension: PASS/FAIL
- D8 NSSM services: PASS/FAIL
- D9 Static checks: PASS/FAIL
- TypeScript errors remaining: [list any]
- Gateway tests: [X]/[Y] passing
```

---

## Budget and Wallet Preservation Protocol (Crucial for Sonnet Batch)

To prevent draining wallet balance or running out of context midway through the night:
1. **Milestone Checkpointing**: At every sub-phase completion (e.g., after D-BRAND Step 7, after D1, after D3), immediately commit changes locally (`git commit -m "chore(night-build): completed phase X"`) and append status to `OVERNIGHT-LOG.md`.
2. **Context Compaction**: If context length exceeds 60%, do NOT re-read entire repository directories. Reference only the specific file needed for the next immediate task.
3. **Fail-Fast & Bypass Non-Blockers**: If an external network call or optional library fetch fails, log it as `SKIPPED: [reason]` in `OVERNIGHT-LOG.md` and proceed with native local TypeScript / Express / React implementations.
4. **Never loop**: Never poll or re-run a failing command more than twice. If it fails twice, log error details and proceed to the next independent task.

---

## Decisions Already Made (Do Not Re-ask)

| Topic | Decision |
|---|---|
| Family profile model | Option A — separate logins per profile |
| Max minor profiles | 3 (configurable at plan level) |
| Child monitoring default | Full access from day 1, always on |
| Child image generation default | OFF — parent must explicitly enable |
| Child daily image limit | Checked FIRST before pool balance |
| POCSO named contact in UI | "Operator Admin", configurable email, link to satchida.com/contact |
| No phone number in POCSO contact | Correct — omit |
| Liability framing | Complete B2B Zero Liability — As-Is software licensor, no accepted damages |
| Client execution | Dedicated Schedule B multi-signatory signature page with mandatory entity stamps |
| Billing Partner | Kushalka Tara Educare (Powai, Mumbai) — 2% commission, full legal immunity |
| Jurisdiction | Exclusive jurisdiction of Courts in Mumbai |
| Rebranding | Satchida branding + navy dark theme default + light pearl theme (from splash proposal) |
| Family pooling non-transferable | Fixed in TERMS.md (done) |
| Self-install | Hybrid — remote-assisted first, self-service after |
| Account package via heartbeat | Yes — full plan details in heartbeat response |
| ShieldGemma | Not required for launch — gateway OFF-by-default for child image gen |
| Redis | Omitted — no MIT/Apache native Windows binary |
| vLLM | Rejected — Linux/CUDA only |
| Docker on client nodes | Rejected — native Windows NSSM/PM2 only |
| Helicone | Rejected — redundant |
| AGPL admin-panel | Rejected |
| llama-server ports | :8080 and :8091 — NEVER touch or spawn new instances |

---

## Execution Addendum — Missing Deliverables and Acceptance Gates (2026-10-04)

This addendum supersedes any conflicting or incomplete acceptance wording above. It does not mark any implementation complete. Every phase must be verified against the running product, not only its source or a mocked test.

### A. Confirmed scope gaps — not built by D0–D10

**No operator dashboard exists today.** LibreChat's `/admin` route is not an operator console; upstream admin APIs and per-feature settings dialogs do not provide tenant/licence/seat/spend/health/configuration management. The AGPL-3.0 admin panel remains rejected and must not be installed or shipped. This gap is described elsewhere but is not delivered by D0–D10:
- `Implementation-plan.md` §2d specifies the billing reconciliation API/UI (payments, approvals, CSV).
- `Implementation-plan.md` Part II §1 specifies fleet-control APIs (`/fleet/status`, licence issue/revoke, operator login), but does not deliver an actual usable dashboard UI.
- `ARCHITECTURE.md` §§3.4–5 likewise say a first-party reconciliation/admin console must be built.
- `HANDOVER.md` §0a names the missing multi-tenant operator console, client dashboard, and parent console. These are open work, not existing features.

**No model-provider administration UI exists today.** The deployed `librechat.yaml` config exposes a single generic Satchida endpoint and visible generic modes. `ARCHITECTURE.md` §8.2 describes intended provider routing, and §8.4 says an administrator retains visibility, but neither document specifies a completed operator screen/API for editing routes, credentials, fallback policy, or plan-bound capabilities. Do not expose provider names/keys to end users; follow `Customizations.md`'s no-provider-marketing and master-key custody rules.

Track these as explicit follow-up deliverables, not as D0–D10 completion:
- `D11 — Reconciliation and fleet operator UI`: reconcile Implementation-plan.md §2d with Part II §1 and HANDOVER.md §0a. Deliver billing approval/rejection and CSV; list/search clients; view licence state, seats, spend, health, plan, and last heartbeat; update/suspend/revoke; audit every mutation. Use authenticated APIs, tenant scoping, CSRF protections where applicable, and operator authorization. Do not imply a dashboard exists until a live login and each operation has been verified.
- `D12 — Client admin dashboard`: provide only the signed-in client tenant's users, seat use, usage/spend, audit trail, and support-access log; prove cross-tenant requests are denied.
- `D13 — Parent console and family governance`: implement parental consent, schedule/time limits, per-mode controls, image-generation enablement, and activity reporting only after the family safety gate below passes.
- `D14 — Model routing administration`: specify and build an operator-only route/configuration surface backed by server-side secrets and an explicit approved-provider allowlist. Never return key material or provider identifiers to end-user config. Validate route save, rollback, failure state, and the generic modes shown to a regular user.
- These follow-ups each require their own STARTED/COMPLETED log entries, focused tests, API/client typechecks, deployment build, and live visual acceptance. Do not report them as part of D1–D10 unless actually implemented.

#### Family-document conflict that must be resolved in implementation

Part C's sample says full parent transcript access and monitoring are always enabled; this conflicts with `HANDOVER.md` §7a (transcripts only after a separate explicit parent action, and always visible to the child) and `CHILDREN-SAFETY.md` §5 (recommend categories/topics rather than transcript). Before D3–D7, follow the more privacy-preserving documented design: default to categories/topics and time-of-day; keep transcript access off until explicit, versioned guardian consent; show a persistent, non-dismissible disclosure to the child whenever any parent visibility is active; audit each transcript access. Do not store or collect a child's email if pseudonymous client-provisioned IDs are the selected model. If legally required consent or the account identity model is unresolved, stop the family implementation and record the blocker rather than silently following the unsafe pseudocode.

#### Runtime/build evidence already observed (not completion evidence)

The source tree had not yet been rebuilt when checked: `GET http://127.0.0.1:3080/` returned the old LibreChat title while `/api/config` returned `appTitle: Satchida`; `/admin` served the SPA shell, not an admin console; `/api/admin` and `/api/v1/fleet/heartbeat` returned 404 on this process. The current `librechat.yaml` has one generic Satchida endpoint and Chat/Work/Privacy labels; it has no provider admin UI. D1's tests exercised a mocked upstream, and live transcription had not yet been verified. Record updated results after real build/install/live visual checks; never reuse these initial readings as proof of later state.



### B. Family profile safety gate (applies before D3–D7)

The sample routes and `req.billingUserId` sketch in Part C are architectural pseudocode, not a safe implementation contract. Before writing family code, inspect actual user creation, auth, conversation ownership, balances/reservations, image request paths, route registration, and cache invalidation. Create a short design note in the log identifying the real call chain and contracts.

Minimum invariants:
- Every profile belongs to exactly one family owner/account; all reads and mutations prove the authenticated principal's ownership on the server. Never accept a caller-supplied guardian/family ID as authority.
- Creating/removing profiles uses the established user creation/deletion methods, email uniqueness/tenant rules, password hashing, auth cache invalidation, and cleanup. Do not create a partially initialized account without explicitly resolving its authentication and balance lifecycle.
- Parent transcript access is denied by default until a separate, versioned guardian-consent record authorizes it. The minor must see a persistent, non-dismissible, localized disclosure whenever parent access is enabled and at all transcript-view entry points. Log transcript views as auditable events.
- Apply daily image limits before any family-pool debit; debit must be atomic and use existing balance reservation semantics. Tests must cover concurrent requests, limits at zero/boundary, missing records versus storage errors, and unauthorized cross-family IDs.
- Validate time windows and timezone semantics; fail closed on invalid schedules. Provide loading, empty, success, and failure UI states.
- If these invariants cannot be implemented against real existing contracts, mark D3–D7 blocked/deferred with the exact missing dependency. Do not land an insecure partial route.

### C. D1 STT verification — mock and live checks are separate

A mocked upstream test verifies request construction only. It does not establish the real gateway process has loaded the route, that the endpoint is available, or that transcription works.

Required evidence:
1. Focused test: authorized multipart request preserves its boundary and fields; no licence is rejected before upstream; upstream failure response is safe; timeout/unreachable maps to stable `stt_unavailable`.
2. Typecheck/build the gateway and restart only the identified gateway process after recording its PID/command. Never restart or replace :8080/:8091.
3. Live test using a checked-in/licensed short WAV with known spoken phrase; record HTTP status, safe response JSON, and whether `text` matches expected speech. Do not log audio content or licence token.
4. Test the actual LibreChat microphone/UI if available. A successful curl alone is not end-to-end UI acceptance.
5. If no suitable fixture or user-accessible microphone flow exists, record `LIVE STT UNVERIFIED` and do not report D1 fully complete.

### D. Build, install, and visual acceptance gate

Source edits are not installed behavior. `:3080` serves `client/dist`; its Node backend reads and caches `client/dist/index.html` during process startup. A successful `vite build` may update static asset files but does not replace the running process's cached shell HTML.

For every frontend release/change:
1. Run `npx tsc --noEmit` in `packages/client` and `client`; run focused Jest tests, including the `ThemeSelector` and loading-canvas tests.
2. Run the real package build chain: `npm run build:data-provider`, `npm run build:data-schemas`, `npm run build:api`, `npm run build:client-package`, then `npm run build:client` (or the verified `npm run frontend` wrapper). Record exit status and generated `client/dist/index.html` title, generated `client/dist/manifest.webmanifest`, icon paths, and hashed asset names.
3. Before installing/restarting anything, identify the exact PID, executable, command line, start time, cwd, and port owner. Confirm it is this LibreChat backend and not another service. Do not kill/restart by process name.
4. Install by building to the configured `appConfig.paths.dist` directory, then perform a controlled restart of only the confirmed LibreChat PID using its existing supervisor/method. Preserve a copy of the current dist index/assets or use the existing backup mechanism so rollback is possible. Never overwrite `.env` or operator data.
5. Verify from HTTP after restart: `GET /` and `/index.html` return the Satchida title/bootstrap; `GET /manifest.webmanifest` returns Satchida names and valid assets; all icon/image URLs return 200 with the expected image content-type; JavaScript/CSS bundle URLs referenced by the returned shell return 200. Verify `/api/config` title and real settings.
6. Visually inspect the live browser at `http://127.0.0.1:3080/` for the splash, login page, authenticated landing/chat page, theme selector, both theme appearances, loading/error states, and mobile viewport. Capture screenshots and retain the evidence path in `OVERNIGHT-LOG.md`. Do not accept source code, tests, or HTTP title checks in place of the visual gate.
7. Verify the intended administrator login settings in the actual UI. Separately state whether `/admin`, provider configuration, and operator dashboard are present. The current D0–D10 list does not build an operator dashboard or model-provider administration UI.

If a restart is not safe or the intended running process cannot be identified, stop before restart, retain the successful build artifacts, log exact evidence and rollback path, and mark installation/live visual verification `BLOCKED` rather than `PASS`.

### E. D8 Windows service safeguards

The current example's commands can change system-wide service state and must not run automatically just because a service is absent. First inspect existing service definitions, executable paths, accounts, dependencies, and current process owners. Never create a second MongoDB/gateway/RAG/LibreChat instance on ports already occupied. Never use a generic `Get-Process node | Stop-Process` or equivalent. NSSM installation/service creation/reconfiguration/start requires an explicit operator-approved maintenance window and an identified rollback command. A missing NSSM executable is `UNAVAILABLE`, not permission to download/install it.

### F. D10 completion vocabulary

Use distinct states for each acceptance item:
- `PASS — source/build/test/live/visual` only for the evidence layer actually performed.
- `FAIL` for a check that ran and failed.
- `BLOCKED` when safety/dependency conditions prevent execution.
- `UNVERIFIED` when only a mock, source inspection, or indirect signal exists.
- `OUT OF SCOPE — not implemented by D0–D10` for the operator dashboard and provider administration UI until D11/D12 are delivered.

Never convert `UNVERIFIED`, `BLOCKED`, or `OUT OF SCOPE` to PASS in the overnight summary.

