# Satchida Chat Toolbar, Subscriptions & Hardware Design

## 1. Chat input controls

The satchida-ai-unified-suite has a mature existing toggle system
(`src/lib/stores/agent-toggles.svelte.ts`), chat pickers
(`use-chat-form-pickers.svelte.ts`), and reasoning/thinking support
(`ReasoningFormat` enum, `chat-template-thinking-detector.ts`).
LibreChat has a different stack (React/TypeScript). The two UIs are
separate products; only the router speaks between them.

**LibreChat chat input bar design (to implement):**

Left side — style selector (segmented or dropdown):
- **Direct** (no prefix prompt — default)
- **Plan** — think before acting; produce a step-by-step plan and ask for approval
- **Build** — execute now; produce the complete deliverable

Right side — mode dropdown (hidden model names):
- **Chat**
- **Work**
- **Study**
- **Privacy** *(Pro / Family / Enterprise only — greyed out + tooltip if not subscribed)*

Icon buttons (shown where available on the plan):

| Icon | Function | Sends to router |
|---|---|---|
| 🌐 Globe | Web search on/off | `satchida_websearch: true/false` in body |
| 🧠 Brain / Think | Thinking/reasoning on | `satchida_think: true` — router adds `{"thinking":{"type":"enabled","budget_tokens":4096}}` to Claude calls, or `enable_thinking=true` for other providers that support it |
| ✨ Wand | Prompt optimiser | Sends to a small local optimiser (Granite 1B) before main call; returns rewritten prompt for user to confirm then send |
| 📎 Attach | File / image attach | Existing LibreChat attach; router flags `vision` capability need |
| 🎙️ Voice | STT input | Existing LibreChat or a local Whisper endpoint |
| 📷 Screenshot | Paste screen region | Triggers vision; needs mmproj model |

**Implementation Status for LibreChat (COMPLETED & VERIFIED 2026-10-07):**
1. `client/src/components/Chat/Input/SatchiStyleSelector.tsx`: Left-side segmented control (`Direct | Plan | Build`).
2. `client/src/components/Chat/Input/SatchiModeSelector.tsx`: Semantic mode selector (`Chat | Work | Study | Privacy`).
3. `client/src/components/Chat/Input/SatchiToolbar.tsx`: Action icons (Globe, Think, Wand, Research, Image).
4. `client/src/store/satchiStore.ts` & `client/src/hooks/useSatchiExtraBody.ts`: Jotai storage atoms + multi-vector heuristic prompt enhancer.
5. `client/src/components/Chat/Input/ChatForm.tsx`: Action row mounting and directive prepending via `submitComposerText`.
6. Unit tests (`SatchiToolbar.spec.tsx` — 11/11 pass).
7. Live inference verified on local llama-server (:8080) with `Qwen2.5-Omni-7B-Q4_K_M` (Direct: 916ms, Plan: 2956ms, Build: 3017ms, Wand: 3194ms).

---

## 2. Subscription tiers

| Tier | Price target | Accounts | Privacy mode | Image gen | Local model | Notes |
|---|---|---|---|---|---|---|
| **Basic / Standard** | Free or freemium | 1 | ✗ | ✗ | ✗ (cloud free only) | Demo / trial |
| **Pro** | ₹499/mo | 1 | ✓ local | ✓ limited | ✓ 30 req/day | Individual professional |
| **Family** | ₹799/mo | 4 (2 adults + 2 child) | ✓ local | ✓ limited | ✓ 30 req/day | See §2.1 for child accounts |
| **Enterprise** | ₹5,000–₹50,000/mo (see PRICING.md) | Seat-based | ✓ local | ✓ (if GPU) | ✓ | Schools, SMBs, SMEs |

### 2.1 Family — child account rules
Child accounts (age < 18) must apply at registration or by parent toggle:
- **Content filter:** router adds a system prompt suffix `CHILD_SAFETY_SUFFIX`
  on every request. Separately, a Cloudflare WAF rule or the router can scan
  outputs. Neither approach is watertight; document this to parents.
- **Mode restrictions:** Privacy mode is available to child accounts (private
  from the internet, not from parents). Work and Study modes are available.
  Chat mode is available with the content filter.
- **Parental dashboard:** parents can review conversation summaries (not
  full logs, to balance privacy), set daily time limits, and toggle
  image generation and web search per child account.
- **Image gen default:** off for child accounts.
- **Adult content:** route must never select a provider whose content policy
  allows adult content for child accounts. Applies even on free providers.
- **DPDP compliance (India):** DPDP Act 2023 requires verifiable parental
  consent before collecting data from children. A consent flow is mandatory
  before account activation. Store the consent timestamp and the parent's
  verified account id. See DPDP-CHILDREN.md.

### 2.2 Licence token shape (addition to crypto.mjs)
```jsonc
{
  "clientId": "acme",
  "userId": "u123",
  "plan": "pro",          // basic | pro | family | enterprise
  "isChild": false,
  "seats": 1,
  "expiresAt": 1780000000,
  "modes": ["chat","work","study","privacy"],  // plan-gated
  "features": ["websearch","think","image"],
  "limits": { "h5": 80, "day": 300 }           // per-user override
}
```
The router verifies the Ed25519 signature, then uses `token.modes` to gate
the Privacy dropdown and `token.features` to show/hide toolbar icons.

---

## 3. GPU / hardware analysis — 2 × 12 GB vs 1 × 16 GB

### Current: 1 × 16 GB GPU

| Use | VRAM | Concurrent KV slots |
|---|---|---|
| Qwen3VL-4B Q4_K_M + mmproj | ~4 GB | 8 slots at ~0.4 GB each |
| Granite-4.0-1B Q4_K_M | ~1 GB | 16 slots at ~0.1 GB each |
| SDXL / Flux-schnell image gen | ~6–8 GB (full load) | 1 at a time |

Running text + image on one 16 GB card means switching: unload text, load
image gen, unload, reload. At any concurrency > 1 this is untenable.

### Option A: 2 × 12 GB (e.g., RTX 4070 or 3060 12 GB)
Total 24 GB usable as independent pools.

| Card | Dedicated use | Available VRAM | Concurrent slots |
|---|---|---|---|
| GPU 0 (12 GB) | Image gen: Flux-schnell (5 GB) + headroom | 7 GB | 1 image job, queued |
| GPU 1 (12 GB) | Text: Qwen3VL-4B (4 GB) + mmproj | 8 GB | ~12 text slots |

Advantages:
- Text model stays loaded permanently. Image gen never evicts it.
- Qwen3VL with mmproj on GPU 1 handles all vision + text. Work and Study
  vision requests go there.
- 12 text slots with Qwen3VL-4B is adequate for 50 concurrent connections if
  the average think-time (typing, reading) is 20 × the generation time. At
  ~100 tokens/s for a 500-token response, each slot is busy for ~5 seconds.
  At 50 users sending once per minute, average active slots = 50 × 5/60 ≈ 4.
  Comfortable. Peaks at 2-3× = ~12 slots. Fits.
- For Privacy mode under heavy load, the localGate (max 8, queue 64) in the
  router prevents oversubscription.

Disadvantages:
- Two PCIe × 16 slots needed. Many consumer boards have only one full-speed
  slot; the second runs at × 4 or × 8. For inference (sequential token
  streaming, not training), × 4 is acceptable.
- Two cards draw ~200 W combined under load. Account for PSU headroom.
- Cost: two 3060 12 GB ≈ ₹25,000–₹35,000 each (used). One 4080 16 GB
  ≈ ₹65,000–₹80,000 new.

### Option B: Keep 1 × 16 GB, add Granite-1B for Privacy only

| Model | VRAM | Slots |
|---|---|---|
| Qwen3VL-4B + mmproj | ~4 GB | 8 text slots (default) |
| Granite-4.0-1B Q4_K_M | ~1 GB | 12 slots |
| Image gen (on-demand, evict Qwen) | 6–8 GB | 1 at a time |

Run two llama-server instances simultaneously: Granite on port 8091 (already
done — `granite` provider in opencode.jsonc) for Privacy, Qwen3VL on 8080
for Work/Study vision. Image gen unloads one of them. This is complex and
still suffers the eviction problem for image gen.

**Recommendation: Option A (2 × 12 GB) if you expand.** It is the cleanest
separation. For now, the 16 GB card with image gen disabled during peak hours
and Granite 1B for Privacy-mode is a viable staging approach.

### Multi-Granite approach for Privacy under 50+ connections
Running multiple Granite 1B instances (each ~1 GB) on 8 GB of VRAM gives
~6–7 parallel instances, each with their own port. The router localGate
would distribute across them. llama-server does not natively load-balance;
you would need a small round-robin in front. This is feasible but adds
operational complexity. The 2 × 12 GB split is simpler.

---

## 4. Router changes needed (tracked in todo.md)

- Read `token.modes` from licence; gate Privacy at `/v1/chat/completions`
- Read `token.features`; return allowed features list on `/v1/models`
- Child account: inject `CHILD_SAFETY_SUFFIX` system prompt, block
  adult-flagged providers, disable image gen
- Per-user limit override from `token.limits`
- Multi-GPU routing: send local requests to `:8080` (text/vision) or
  `:8091` (granite/privacy) based on mode; expose as two local providers
