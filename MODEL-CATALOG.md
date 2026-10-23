# Model Catalogue — INTERNAL ONLY

> ⚠️ **Never expose this document, this filename, or any model identifier to an end user or
> client.** It directly violates the no-provider-marketing rule (`PRIVACY.md` §2.1). This file
> exists so we can price and swap routes. Users see only **Chat / Work / Privacy**.

Pricing captured live from the OpenRouter models API, **2026-10-03**. Re-check before each
pricing decision — these move.

---

## 1. The headline finding

Compute is effectively free at our chosen tier. At 230 customers × 400 queries/month ×
800 tokens (73.6M tokens/month) against ₹1,14,770 monthly revenue:

| Routing | Monthly COGS | % of revenue |
|---|---|---|
| `deepseek-v4-flash` | **₹308** | **0.3%** |
| `deepseek-v4.1-flash:batch` (vision) | ₹1,740 | 1.5% |
| `gpt-6-luna` | ₹2,460 | 2.1% |
| `gpt-6-sol` (frontier) | ₹49,200 | **43%** |

**Never route to frontier by default.** The single configuration decision to protect margin is
keeping the default route in the sub-$0.06/1M band.

---

## 2. Text — recommended tiers

| Tier | Model | in $/1M | out $/1M | Use |
|---|---|---|---|---|
| **Default (Work)** | `deepseek/deepseek-v4-flash` | **0.028** | **0.056** | Best quality-per-rupee |
| Cheap fallback | `inclusionai/ling-3.0-flash` | 0.021 | 0.063 | Lower still |
| Cheap fallback | `mistralai/mistral-nemo` | 0.019 | 0.030 | Cheapest blended |
| Upgrade | `deepseek/deepseek-v4-pro` | 0.209 | 0.418 | When Work mode needs depth |
| Named by operator | `openai/gpt-6-luna` | 0.100 | 0.500 | Batch variant 0.050/0.250 |
| Named by operator | `xiaomi/mimo-v2.6-flash` | 0.140 | 0.280 | Vision-capable |

Free-tier models are `:free` suffixed — 50 requests/day without credits, **1,000 with ≥$10** in
the account. Keep $10+ in the account permanently; it is the cheapest capacity we can buy.

### Also cheap enough to consider

| Model | in | out | Note |
|---|---|---|---|
| `sao10k/l3-lunaris-8b` | 0.040 | 0.050 | Remarkably cheap |
| `openai/gpt-oss-20b` | 0.018 | 0.090 | Strong small model |
| `ibm-granite/granite-4.0-h-micro` | 0.017 | 0.112 | |
| `mistralai/mistral-small-24b-instruct-2501` | 0.050 | 0.080 | Good mid-size |
| `meta-llama/llama-3.1-8b-instruct` | 0.050 | 0.080 | |

---

## 3. Vision — cheapest capable

| Model | in $/1M | out $/1M | Note |
|---|---|---|---|
| **`inclusionai/ling-3.0-flash-vl`** | **0.021** | **0.062** | **Cheapest vision available** |
| **`qwen/qwen3.7-flash`** | **0.030** | **0.130** | Strong multimodal |
| `nex-agi/nex-n2.5-mini` | 0.025 | 0.100 | |
| `google/gemma-3-4b-it` | 0.050 | 0.100 | |
| `mistralai/ministral-8b-2512:batch` | 0.075 | 0.075 | Symmetrical pricing |
| `google/gemma-3-12b-it` | 0.050 | 0.150 | Larger |
| `deepseek/deepseek-v4.1-flash:batch` | 0.112 | 0.336 | Batch halves cost |
| `openai/gpt-4.1-nano:batch` | 0.050 | 0.200 | |

**Recommended:** `ling-3.0-flash-vl` as the default vision route, `qwen3.7-flash` where quality
matters more than cost.

---

## 4. Speech — STT and TTS

### ✅ Confirmed supported natively

Verified in this repository:

| Component | Path |
|---|---|
| STT service | `api/server/services/Files/Audio/STTService.js` |
| TTS service | `api/server/services/Files/Audio/TTSService.spec.js` (+ `TTSService.js`) |
| Speech routes | `api/server/routes/files/speech/index.js` |
| **Custom speech endpoint** | `api/server/services/Files/Audio/getCustomConfigSpeech.js` |
| Rate limiting | `api/server/middleware/limiters/ttsLimiters.js` |

Config surface (`packages/data-provider/src/config.ts`): `tts`, `stt`, and `interface.speechTab`,
each with `ipMax`, `ipWindowInMinutes`, `userMax`, `userWindowInMinutes`.

**`getCustomConfigSpeech` is the key finding:** it means STT/TTS can be pointed at an
OpenAI-compatible speech endpoint we control. So the cheapest audio model available can be used,
and the user's browser never learns which one.

### Voice on Android

The PWA already supports browser speech APIs, but **server-side STT/TTS is what makes it reliable**
— it removes browser support variance and works inside a Capacitor shell. With the gateway in
place, a voice-to-voice turn is: STT (gateway) → text model (gateway) → TTS (gateway) → speaker.

**This is a genuine differentiator for senior citizens and for users typing in regional
languages** — voice beats keyboard for both populations, and neither is served well by the free
alternatives they would otherwise use.

### ⚠️ Pricing not yet captured

Audio token pricing was not extracted in this pass. **To research before pricing the voice
feature.** Do not quote a voice price to a client until this is done — a per-minute audio cost
that turns out higher than the text model would change the whole tier design.

---

## 5. Image generation — local, and effectively free

**Decision: generate locally on the client's 16 GB card.** No aggregator.

### Cost per image

SDXL at 1024×1024 on an RTX 4060 Ti is roughly 10–20 seconds:

```
15 s × 250 W        = 3,750 joules ≈ 0.00104 kWh
0.00104 kWh × ₹8    = ₹0.008 per image
```

**Roughly one paisa per image.** Even with overhead, amortisation and failures, a 16 GB card
produces images for a fraction of a rupee. This is **pure margin at any price above ₹2**.

Compare: every cloud image API bills per megapixel, and the aggregator would also see the prompt.
Local is cheaper *and* private — both advantages at once.

### Why local, not an aggregator

| | Local (16 GB) | Aggregator |
|---|---|---|
| Marginal cost | ~₹0.01 | ₹0.10–2+ per image |
| Prompt privacy | Never leaves the client | Sent to a third party |
| No-provider-marketing rule | ✅ Compliant | ⚠️ Depends on vendor |
| Quality | SDXL-class | Possibly better, but costly at volume |

### 16 GB constraint — queueing

SDXL plus Flux-schnell at 4-bit both fit in 16 GB, but **not alongside a text model serving live
users.** On one card you must choose:

| Strategy | Effect |
|---|---|
| **Time-slice** (recommended) | Text model paused while images generate. Simple, no VRAM conflict |
| Dedicated queue | Requests queue; one runs at a time |
| Sequential GPU | Run image generation only in low-usage windows (night) |

**Recommendation: an explicit image queue with a daily window.** Schools and societies have
overnight idle capacity — generating in a 02:00–06:00 window means images cost zero latency to
text users and the card is otherwise fully available. Users are notified when ready.

Also: **GPU memory must be released properly.** A long-running image job leaking VRAM will
silently degrade every subsequent chat turn. The queue must enforce a hard process restart after
N images.

---

## 6. Capacity and routing summary

| Mode | Route | Monthly cost/customer |
|---|---|---|
| **Chat** | Free routes → `deepseek-v4-flash` → local | ~₹1–5 |
| **Work** | `deepseek-v4-flash`, escalate to `v4-pro` if configured | ~₹7 |
| **Privacy** | Local model on client hardware, zero egress | ₹0 |
| **Voice** | STT/TTS via gateway | **To research** |
| **Images** | Local queue | ~₹0.01/image |

At these prices **the product's economics are set by distribution and support, not compute.**
That conclusion holds the entire business model together, and it is why `ROI.md` treats the
installer's 90-minute target as the number that matters most.

---

## 7. Refresh procedure

Re-run before any pricing decision:

1. Query the aggregator's models endpoint
2. Diff against §2–§3
3. **Confirm no default route has drifted above $0.06/1M blended**
4. Update `INFERENCE.md` §2.2 provider positions if terms have changed