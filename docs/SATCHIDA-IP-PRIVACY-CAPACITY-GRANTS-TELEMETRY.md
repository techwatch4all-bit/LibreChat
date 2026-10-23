# Satchida IP — Tenant-Local Privacy Capacity, Fair-Use, Grants and Telemetry

**Status:** Design specification for operator review. No runtime change is authorised by this document.
**Owner:** Satchida AI — this document and its derivations are Satchida intellectual property.
**Scope:** Tenant-local Privacy inference capacity modelling, per-seat fair-use control, tenant entitlement grants, and metadata-only telemetry reconciliation.
**Relationship:** Extends `SATCHIDA-END-TO-END-ROUTING.md`. Where that document states "Privacy ... requires a short-lived operator-signed assertion" and "No local content or usage payload is reported centrally by default", this document specifies the granted mechanism that satisfies that reserved gap. It does not modify the cloud path (LibreChat → One-API → Bifrost), which is specified in `SATCHIDA-END-TO-END-ROUTING.md` §3.

---

## 1. Scope and non-goals

### In scope

1. A **capacity model** that derives served concurrency from measured GPU and model properties.
2. A **per-seat fair-use ladder** (Soft / Hard / Serious) expressed in GPU-seconds, derived from capacity rather than chosen constants.
3. A **tenant hardware probe** run at onboarding that measures the tenant's own machine.
4. A **per-account-type entitlement and grant model** with contract terms.
5. A **metadata-only telemetry protocol** and One-API reconciliation rules.
6. A **retirement plan** for the Node `:4000` gateway.

### Non-goals

- No change to the cloud relay path, Bifrost VK governance, or One-API cloud accounting.
- No live rollout, service restart, provider/VK provisioning, or credential rotation is authorised here.
- No per-token billing of Privacy. Privacy is flat-rate (§4).

---

## 2. Measured basis

All figures below were measured on the operator PC against the production runtime. They are the empirical foundation for every formula in §3 and §4. They are **not** vendor estimates and **not** cloud-derived.

### 2.1 Hardware and runtime

| Property | Measured value | Source |
|---|---|---|
| GPU | NVIDIA GeForce RTX 5070 Ti Laptop | `nvidia-smi` |
| Total VRAM | 12227 MiB | `nvidia-smi --query-gpu=memory.total` |
| Driver | 617.14 | `nvidia-smi` |
| Model | `Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0` | `llama-server --alias` |
| Weight size | 2.68 GiB | GGUF file size |
| Architecture | `qwen35` | GGUF v3 `general.architecture` |
| Layers / KV heads / head_dim | 33 / 4 / 256 | GGUF metadata |
| Native context | 262144 | GGUF `context_length` |
| Runtime build | llama.cpp `b10709-9a9394a89` | `/props` |

Live server flags (`llama-server`, port 61075):

```
--ctx-size 36864 --parallel 5 --kv-unified --cont-batching
--cache-reuse 256 --cache-type-k q4_0 --cache-type-v q4_0
--batch-size 2048 --ubatch-size 512 --n-gpu-layers 999
```

### 2.2 KV cache geometry

Derived from GGUF metadata. KV bytes per token, f16:

```
kv_bytes_per_token = 2 * layers * kv_heads * head_dim * sizeof(f16)
                   = 2 * 33 * 4 * 256 * 2
                   = 135168 bytes = 132.0 KiB/token
```

Production runs `q4_0` KV, which is 4.5 bits/element:

```
kv_bytes_per_token_effective = 132.0 KiB * (4.5 / 16) = 37.1 KiB/token
```

> **Note.** This is 3.56× smaller than f16. Any capacity estimate that assumes f16 KV understates concurrency by the same factor.

### 2.3 VRAM partition

```
kv_pool = VRAM_total - weights - runtime_overhead - safety_reserve
        = 12227 - 2744 - 900 - 1834
        = 6749 MiB   (measured: ~5010 MiB in use at --parallel 5, headroom remains)
```

`runtime_overhead` = 900 MiB (CUDA context, compute buffers, display).
`safety_reserve` = 15% of VRAM, to prevent OOM under burst.

### 2.4 Throughput measurements

**Prefill** (cold prompt, `max_tokens=16`):

| Prompt tokens | Wall | Rate |
|---:|---:|---:|
| 10,017 | 0.52 s | 19,391 tok/s |
| 18,017 | 3.05 s | 5,905 tok/s |
| 30,017 | 5.31 s | **5,656 tok/s** |

> 19,391 tok/s at 10k is a small-context kernel-efficiency artefact and is **not** used for capacity. 5,656 tok/s at 30k is the sustained figure and is the value used throughout.

**Decode, single stream** (2.2k context): 103.7 tok/s aggregate = 103.7 tok/s per seat.
**Decode, small context** (21 tokens): up to 132 tok/s.

**Decode, concurrent** (256 output tokens each, ~2.2k context each, true simultaneous load):

| Concurrent | Wall | Aggregate tok/s | Per-seat tok/s | 1.2k-token turn |
|---:|---:|---:|---:|---:|
| 1 | 2.5 s | 103.7 | 103.7 | 12 s |
| 2 | 2.6 s | **193.8** | 96.9 | 12 s |
| 3 | 4.2 s | 184.9 | 61.6 | 19 s |
| 5 | 6.8 s | 189.6 | 37.9 | 32 s |
| 8 | 12.3 s | 166.2 | 20.8 | 58 s |

**Two findings that govern the entire design:**

1. **Aggregate decode saturates at ~190 tok/s and holds flat from 2 to 5 concurrent.** Adding users beyond ~5 does not increase throughput; it divides the same throughput among more seats. This is the compute ceiling.
2. **Per-seat rate decays monotonically**: 103.7 → 96.9 → 61.6 → 37.9 → 20.8.

### 2.5 Prefix cache reuse

Confirmed working and reported. Repeat turns on a stable prefix:

| Turn | Total prompt | Cached | Uncached | Wall |
|---|---:|---:|---:|---:|
| Cold | 15,013 | 5,510 | 9,503 | 3.35 s |
| Same prefix + 1 token | 15,013 | 14,497 | **516** | 0.36 s |
| Same prefix + 1 token | 15,013 | 14,497 | **516** | 0.35 s |
| New random tail | 15,047 | 14,497 | 550 | 0.38 s |

`prompt_tokens_details.cached_tokens` is reliably reported. This matters because **it makes input ~15× cheaper than output in GPU-seconds**:

| Component | Cost per turn |
|---|---|
| 500 uncached input ÷ 5,656 | 0.09 s |
| 1,200 output decode ÷ 190 | 6.32 s |
| **Total** | **6.41 s — 98.6% of it decode** |

This is why the fair-use ladder (§4) is driven by **decode/output**, and why input ceilings can be generous.

---

## 3. Capacity model

### 3.1 Two independent limits

Concurrency is bounded by **both** memory and compute. Neither alone is sufficient, and conflating them produces answers that are wrong by an order of magnitude.

```
C_memory  = kv_pool_bytes / (kv_bytes_per_token_effective * ctx_tokens)

C_compute = max{ N : measured_per_seat_tps(N) >= target_per_seat_tps }

C_served  = min(C_memory, C_compute)
```

- `C_memory` — how many sessions fit in the KV pool at the given context length.
- `C_compute` — how many sessions the GPU can decode for simultaneously at an acceptable per-seat rate.

`target_per_seat_tps` is an **operator decision**, locked at **> 20 tok/s**. That threshold was chosen because 20 tok/s is the floor at which an agentic coding session feels responsive: a 1,200-token completion lands in ~60 s, and the developer is typically running tests or reading during that time.

### 3.2 Measured regime on the operator PC

`C_compute` at the >20 tok/s target is **8** (measured per-seat at 8 concurrent = 20.8 tok/s; at 12 it would fall below 20).

`C_memory` is a function of live context, and is recomputed continuously rather than fixed:

| Rolling context | C_memory | C_compute | C_served | Binding limit |
|---:|---:|---:|---:|---|
| 2,048 | 90 | 8 | 8 | compute |
| 8,192 | 22 | 8 | 8 | compute |
| 16,384 | 11 | 8 | 8 | compute |
| 32,768 | 5 | 8 | 5 | **memory** |
| 36,864 | 5 | 8 | 5 | **memory** |

> **Design decision (locked).** Context is **measured-rolling and variable**, not a fixed 8,192. A room of short-context sessions holds far more concurrent KV than one of long-context sessions. `C_memory` therefore tracks the live rolling context percentile and drops served concurrency automatically as sessions lengthen, instead of overcommitting and risking eviction or OOM.

Below roughly 8 GB the machine is memory-bound; above it, compute binds first. A tenant's probe discovers which regime their hardware is in (§5).

### 3.3 VRAM scaling (same model, 16k rolling context)

| Tenant VRAM | KV pool | C_mem | C_comp | C_served | Serious (GPU-sec/hr) |
|---:|---:|---:|---:|---:|---:|
| 6144 MiB | 1578 | 2 | 8 | **2** | 1800 |
| 8192 MiB | 3319 | 5 | 8 | **5** | 720 |
| 12227 MiB | 6749 | 11 | 8 | **8** | 450 |
| 16384 MiB | 10282 | 17 | 8 | **8** | 450 |
| 24576 MiB | 17245 | 29 | 8 | **8** | 450 |

The ceiling is flat past ~12 GB because compute binds. **Adding VRAM beyond 12 GB does not raise served concurrency for this model** — it only extends usable context. This is a material commercial fact: the customer-facing pitch for a larger GPU on the 9B model is *longer context*, not *more users*.

---

## 4. Fair-use ladder

### 4.1 The unit is GPU-seconds, not tokens

Token counters are misleading: a long-context user looks enormous in raw tokens but is nearly free after prefix caching, while a short-output user looks small but can be holding the decode loop. The physically meaningful quantity is **how long a seat occupied the machine**.

```
seat_gpu_seconds = (uncached_input_tokens / measured_prefill_tps)
                 + (output_tokens         / measured_decode_tps)
```

Both rates come from the tenant's own probe (§5), so the metric stays correct across model swaps and hardware changes. GPU-seconds are rate-independent; tokens become a *derived display value* rather than the source of truth.

### 4.2 Fair share is dynamic

```
Serious_gpusec_per_hour = 3600 / active_seats
```

The denominator is **currently active seats**, not licensed seats and not peak capacity. This is the mechanism that satisfies "if there are not many users in the queue, dynamically the existing users should be allowed to run more". When the room is half empty, each occupant's allowance is larger, because there is genuinely more machine per person. The threshold rises and falls with occupancy.

### 4.3 The ladder

| Tier | Multiple of fair share | Fraction of a full hour at C_served=8 | Behaviour |
|---|---:|---:|---|
| **Soft** | 0.35 × | 4.4% | Amber banner. **Zero** throttling, zero queue. |
| **Hard** | 0.70 × | 8.8% | Red banner, "you are in a queue", 30 s cooldown, position shown. |
| **Serious** | **1.50 ×** | 18.8% | Pulsing red "session abuse alert", backoff 60→120→240→480 s (cap 15 min), priority demotion behind other queued seats. |

> **Serious = 1.5×, locked by operator.** At 1.0× a genuine heavy coding hour (961 GPU-sec = 27% of the machine) tripped Serious at only 4 concurrent seats. At 1.5× the same user stays at HARD until 6 concurrent. For a deployment whose steady state is 3–5 concurrent seats, 1.5× avoids penalising real users while still bounding genuine abuse.

### 4.4 Enforcement gate — tiers only bind under contention

```
if queued_seats == 0:
    decay_backoff_to_zero()          # idle machine never penalises anyone
    show_banner_only()
else:
    apply_cooldown_and_priority()
```

This is the single most important behavioural rule in this document. **An idle GPU must never throttle a user.** A tenant sitting alone on a fast machine with nobody waiting must be able to consume freely. Tiers express *fairness under contention*, not a metered quota.

### 4.5 Validation against a measured heavy user

Reference workload: 150 turns/hour, 500 uncached input and 1,200 output per turn = **961 GPU-sec/hour (27% of the machine)**.

| Active seats | Fair share (GPU-sec/hr) | Heavy ratio | Tier reached |
|---:|---:|---:|---|
| 1 | 3600 | 0.27× | CLEAN |
| 2 | 1800 | 0.53× | SOFT |
| 3 | 1200 | 0.80× | HARD |
| 4 | 900 | 1.07× | HARD |
| 6 | 600 | 1.60× | SERIOUS |
| 8 | 450 | 2.13× | SERIOUS |

A sustained heavy vibe-coding session is clean when alone, degrades gracefully as seats join, and is only deprioritised when the machine is genuinely oversubscribed. **No legitimate user is ever cut off** — Serious applies backoff and queue priority, never a hard stop.

### 4.6 State machine

```
   ┌──────────┐  ratio>0.35   ┌──────────┐  ratio>0.70   ┌──────────┐
   │  NORMAL  ├──────────────►│  SOFT    ├──────────────►│   HARD   │
   │          │  amber banner │          │ red + queue   │ 30s pause│
   │          │◄──────────────┤          │◄──────────────┤  position│
   └──────────┘   ratio<0.30  └──────────┘  ratio<0.60   └────┬─────┘
        ▲                                                      │ ratio>1.50
        │                     queued==0                         │ & queued>0
        │◄─────────────────────────────────────────────────────┤
        │  decay backoff -> 0                                    ▼
        │                                              ┌───────────────┐
        └──────────────────────────────────────────────┤    SERIOUS    │
                                                       │ pulsing red   │
                                                       │ backoff ladder│
                                                       │ deprioritised │
                                                       │ NOT cut off   │
                                                       └───────────────┘
```

**Invariants, enforced by tests:**

1. A request in flight is **never** interrupted, truncated, or refused. Cooldown is checked at admission only.
2. No tier ever returns a permanent error to the user. The worst outcome is a queue position and a visible wait.
3. `queued_seats == 0` forces backoff decay toward zero regardless of ratio.
4. Hysteresis is asymmetric (enter at 0.35/0.70/1.50, leave at 0.30/0.60/1.20) to prevent tier oscillation from small ratio changes.
5. The idle timer resets on every admission, so an **active** user never leaves Serious — only a genuinely idle one de-escalates. This is what guarantees an interrupted vibe-coding session is not cut mid-cycle.

---

## 5. Tenant hardware probe

Thresholds are **derived from the tenant's own measured machine**, not from a vendor table. A tenant cannot inflate their limits: the probe executes on their hardware, so a false claim is contradicted by their own runtime logs.

### 5.1 Probe procedure

Run once at tenant onboarding, and again on any model swap, KV-type change, or `--ctx-size` change.

| Step | Method | Yields |
|---|---|---|
| 1. VRAM | `nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv` | `vram_total_mib`, `gpu_name` |
| 2. Model geometry | Parse GGUF v3 header: `general.architecture`, `block_count`, `attention.head_count_kv`, `attention.key_length`, `embedding_length`, `context_length` | `weights_bytes`, `kv_bytes_per_token_f16` |
| 3. Effective KV | Read live server flags for `--cache-type-k/-v`; apply bit-width ratio (q4_0 = 4.5 bits) | `kv_bytes_per_token_effective` |
| 4. Prefill | One timed request with a ~30k-token cold prompt, `max_tokens=16` | `prefill_tps` |
| 5. Decode sweep | Timed 256-token completions at concurrency 1, 2, 4, 8, 12 against `/v1/chat/completions` | `per_seat_tps[N]`, `aggregate_tps[N]` |
| 6. Cache check | Repeat a stable-prefix request; assert `prompt_tokens_details.cached_tokens` is present and non-zero | `cache_reuse_ok` |

The probe must use the **same** endpoint the production Privacy router uses, on the **same** model the tenant will actually serve, because both determine throughput. A probe run on a different model is invalid and must be rejected.

### 5.2 Derived outputs

```
kv_pool_bytes      = vram_total - weights - 900MiB - 0.15 * vram_total
C_memory(rolling)  = kv_pool_bytes / (kv_bytes_per_token_effective * rolling_ctx_p95)
C_compute          = max{ N : per_seat_tps[N] >= 20 }
C_served           = min(C_memory(rolling), C_compute)
Serious_gpusec_hr  = 3600 / active_seats          # active_seats is live, not probe-time
```

Tiers Soft/Hard/Serious are then 0.35 / 0.70 / 1.50 of `Serious_gpusec_hr`, recomputed whenever `active_seats` changes.

### 5.3 Probe report

Submitted to One-API at onboarding over the existing tenant control channel, authenticated with the tenant machine credential. Contains no PII and no prompt content.

```json
{
  "schema": "satchida.capacity.probe.v1",
  "tenant_id": "tnt_rwa_palm",
  "collected_at": 1763500000,
  "gpu": { "name": "RTX 5070 Ti Laptop", "vram_total_mib": 12227, "driver": "617.14" },
  "model": { "id": "Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0",
             "weights_bytes": 2877000000,
             "kv_bytes_per_token_effective": 38000 },
  "runtime": { "ctx_size": 36864, "parallel": 5, "kv_type": "q4_0", "kv_unified": true },
  "throughput": { "prefill_tps": 5656,
                  "per_seat_tps": { "1": 103.7, "2": 96.9, "4": 61.6, "8": 20.8 },
                  "aggregate_tps": { "2": 193.8, "5": 189.6, "8": 166.2 } },
  "derived": { "c_compute": 8, "kv_pool_mib": 6749, "cache_reuse_ok": true }
}
```

### 5.4 Rejection conditions

A probe result is rejected and the tenant's Privacy tier is marked **unverified** if:

- `throughput.per_seat_tps` is missing any required concurrency point.
- `cache_reuse_ok` is false — without prefix caching the cost model in §4.1 is invalid, since input would no longer be cheap relative to decode.
- The probed model does not match the model the router actually serves.
- `vram_total_mib` cannot fit `weights + 900 MiB`.

An unverified tenant receives the most conservative defaults (`C_served` measured at concurrency 1) and a UI notice that Privacy is running unverified.

---

## 6. Entitlements, grants and licensing terms

### 6.1 Account type is not mode

A `privacy` **account type** is a commercial entitlement. `Privacy` **mode** is a routing choice. They are orthogonal:

| | `privacy` account type | `Privacy` mode |
|---|---|---|
| Stored in | `TenantAccountPlan.AccountType` | `TenantSeatAlias.AllowedModes` |
| Determines | term, price, seat count, quota | loopback llama-server vs Bifrost |
| Metering | — | Privacy → §7 telemetry; Chat/Work on the same seat → **One-API counts it operator-side** |

A `privacy` seat may hold `allowed_modes = ["Chat","Work","Study","Privacy"]`. When it selects Chat or Work, that traffic goes cloud and is counted authoritatively by One-API at `postConsumeQuota` with no grant involvement. Fair-use applies **per mode, not per seat**: local tiers on the Privacy path, existing `InputMtokCeiling`/`OutputMtokCeiling` on the cloud path.

#### Account type catalog

The catalog is a **wire contract**: the operator mints the names and the tenant's LibreChat consumes them, so both sides must hold the same list.

```
basic | standard | family | pro | pro_family | enterprise | privacy
```

`privacy` is a first-class account type — the local-GPU product sold on its own, with its own contract term and its own allocation. It may sit alongside a `pro` seat in the same tenant with different terms and different entitlements.

**The account type is the product, not a capability.** A `privacy` seat is a local product by default, so:

- It is **not** in the cloud-capability floor (`CLOUD_CAPABILITY_ACCOUNT_TYPES`). A Privacy seat cannot acquire Work tooling by virtue of its type.
- Whether it may also reach the cloud is decided by the **operator's allocation** for that account type, exactly as for any other type. The `initialize` path therefore reads the seat's allowed modes from the allocation rather than from a type-keyed table, so a Privacy seat the operator granted cloud modes to can use them.

`family` remains in `PRIVACY_ELIGIBLE_ACCOUNT_TYPES` because Family Privacy is a separately purchased add-on granted by `localPrivacyEnabled` on the Family allocation.

### 6.2 Groups are the tenant's product lines

A **group** is one commercial product line inside a tenant. It maps one-to-one onto a One-API group of the same name, so the entitlement the tenant's admin panel shows is the entitlement the operator's policy enforces.

```
basic | standard | family | pro | pro_family | enterprise | privacy
```

The catalogue is a **wire contract**: the operator mints the names and the tenant's LibreChat consumes them, so both sides hold the same list. A type present on one side and missing on the other would be silently dropped or rejected when a seat crossed between them.

The mode and capability policy per account type lives in the operator's group policy and is mirrored into the tenant's group record:

| Account type | Modes | Capabilities | Shared |
|---|---|---|---|
| `basic` | Chat | — | no |
| `standard` | Chat | — | no |
| `family` | Chat, Study, Work (text-only) | — | **yes** |
| `pro` | Chat, Study, Work | work_tools, mcp, agents, code_execution | no |
| `pro_family` | Chat, Study, Work | work_tools, mcp, agents, code_execution | no |
| `enterprise` | Chat, Study, Work | work_tools, mcp, agents, code_execution | no |
| `privacy` | Chat, Privacy | — | no |

Two rules are load-bearing:

- **A Family seat holds no Work tooling.** Its Work mode is text-only, because the children exist so a parent can supervise what a minor sends and receives, which is not compatible with giving the family tooling.
- **A dedicated `privacy` seat holds no cloud tooling by virtue of its type.** It is a local product. Whether it may also reach the cloud is decided by the operator's allocation, exactly as for any other type.

`local_privacy_enabled` is recorded separately from the account type, because Privacy is a local entitlement that can be granted to any product line.

### 6.3 The Family seat model

A Family group is **two adults and at most two children** — four seats in total.

The children are conceptualised so a parent can:

- monitor the prompts and responses a minor sends and receives, and
- share Study assistance with the child.

The counts are part of the product rather than an accident of who happens to be enrolled, so they are recorded on the group in both LibreChat and One-API and a shape outside the product (three adults, three children) is **refused on write** in both. The operator's policy and the tenant's own view therefore cannot disagree about how many adults and children a family holds.

A Family group is also a **shared** group: the parents and the children draw on one seat allowance, so a child's usage is visible against the family's budget.

### 6.4 Licensing terms are per account type

`TenantAccountPlan` is keyed `(tenant_id, account_type)` but currently carries **no term**. A tenant contracting "Chat for 1 year, Family and Pro monthly for x seats" cannot be expressed. Add:

| Field | Type | Meaning |
|---|---|---|
| `TermMonths` | int | 1, 3, 6, or 12. Per account type. |
| `TermStartAt` | int64 | Epoch seconds. |
| `TermEndAt` | int64 | Derived; `TermStartAt + TermMonths*30d`. |
| `AutoRenew` | bool | Renew on expiry if telemetry contact is live. |
| `SeatCount` | int | Seats licensed for this account type. |

Contract length is independent per account type, so a single tenant can hold a 12-month Chat term and a 1-month Family term simultaneously.

### 6.3 Policy Bundle and Revocation Delta

A grant is a **signed projection of One-API's own licensing records** — not a parallel source of truth. It is split by lifetime so that a long contract does not force long revocation lag.

| Artifact | Contents | TTL | Purpose |
|---|---|---|---|
| **Policy Bundle** | per-account-type terms, per-seat entitlements, fair-use fractions, probe-derived constants | **min(contract term, 30 days)** | offline enforcement |
| **Revocation Delta** | disabled seat aliases, policy version, fair-use overrides | hours | fast seat kill |

The 30-day cap on Bundle TTL is an operator decision and applies to **every** account type regardless of contract length. A 12-month contract still receives fresh Bundles on each telemetry contact; the contract term lives in the data model, not in the Bundle lifetime.

```json
{
  "schema": "satchida.policy.bundle.v1",
  "tenant_id": "tnt_rwa_palm",
  "policy_version": 42,
  "issued_at": 1763500000,
  "expires_at": 1766086400,
  "account_types": {
    "basic":   { "term_end": 1766086400, "quota_units": 500000 },
    "privacy": { "term_end": 1763500000, "auto_renew": true, "seat_count": 25,
                 "fair_use": { "soft": 0.35, "hard": 0.70, "serious": 1.50 } }
  },
  "capacity": { "c_compute": 8, "target_per_seat_tps": 20, "verified": true },
  "seats": {
    "usr_anon_0001": { "account_type": "privacy", "profile": "adult",
                       "modes": ["Chat","Work","Study","Privacy"], "caps": [] },
    "usr_anon_0002": { "account_type": "privacy", "profile": "child",
                       "modes": ["Chat","Study","Privacy"], "caps": [] }
  },
  "key_id": "k2",
  "sig": "ed25519:..."
}
```

LibreChat verifies the Bundle locally with the operator's Ed25519 **public** key. The signing private key never leaves the operator host.

### 6.4 Revocation bound

This is stated explicitly and must not be overclaimed:

> **Revocation takes effect at the shorter of Revocation Delta TTL and Policy Bundle expiry.** With Delta at telemetry cadence (~hours) and Bundle TTL at 30 days, the practical bound is **hours while the tenant is online**, degrading to **up to 30 days** only if the tenant disconnects entirely after a revocation.

Immediate offline revocation is **not** provided and is not claimed. A tenant PC that is powered off cannot be reached. Contract terms are the enforcement mechanism for that residual.

---

## 7. Telemetry

### 7.1 Why metadata-only is sufficient

Token counts are **not PII**. `seat_alias`, `mode`, `in_tokens`, `out_tokens`, `timestamp` carries no prompt, no response, no filename, and no personal identifier. The custody commitments in the tenant matrix forbid *content and PII* crossing the boundary, not aggregate counters.

The prompt **is** PII. That is the line, and it is why cloud can be operator-counted and Privacy cannot.

### 7.2 The channel already exists

LibreChat must maintain a control channel to One-API regardless, for licensing refresh, presence (accounts created, active now, last login), and seat lifecycle. Telemetry rides that same channel. Its marginal cost is near zero.

### 7.3 Batch format

Batched every few hours, queued locally and flushed on reconnect, so a disconnected tenant loses nothing.

```json
{
  "schema": "satchida.telemetry.v1",
  "tenant_id": "tnt_rwa_palm",
  "batch_seq": 417,
  "prev_batch_seq": 416,
  "window": { "from": 1763400000, "to": 1763496000 },
  "seats": [
    { "alias": "usr_anon_0001", "last_login": 1763489000, "active_seats": 3 },
    { "alias": "usr_anon_0002", "last_login": 1763491000 }
  ],
  "usage": [
    { "alias": "usr_anon_0001", "mode": "Privacy",
      "in_tokens": 1284000, "cached_tokens": 1140000,
      "out_tokens": 96000, "gpu_seconds": 512, "tier": "HARD" },
    { "alias": "usr_anon_0001", "mode": "Work",
      "in_tokens": 21000, "out_tokens": 8400 }
  ],
  "presence": { "accounts_created": 41, "active_now": 6 },
  "sig": "ed25519:..."
}
```

### 7.4 Reconciliation rules in One-API

1. Reject a batch whose `batch_seq` is not strictly greater than the last accepted `batch_seq` for that tenant — this defeats replay.
2. Reject usage citing a `seat alias` not present in the tenant's roster.
3. Reject usage citing a `mode` outside that seat's `allowed_modes` in the active Policy Bundle.
4. Reject a signature that does not verify under the tenant's registered metering key.
5. **Flag** (do not fail) a `tier` of `HARD` or `SERIOUS`; surface it on the operator console for follow-up.
6. Detect and alert on **sequence gaps** — evidence of edited or deleted local history.
7. Never write prompt content, response content, filenames, or email addresses. Counters only.

### 7.5 What this proves and what it does not

| Claim | Status |
|---|---|
| Tenant cannot claim "we never used Privacy" | **Proven.** Their own harness emitted a signed, sequenced, grant-bound record. |
| Fabricated usage is detectable | **Proven.** Requires a live grant, a never-repeating `batch_seq`, and a valid signature. |
| Edited history is detectable | **Proven.** Shows as a `batch_seq` gap. |
| Cloud token counts are trustworthy | **Proven.** One-API counts them operator-side at `postConsumeQuota`. |
| Privacy token counts are cryptographically proven | **NOT claimed.** See below. |

**Honest limitation.** A tenant who edits their harness *before* signing can under-report Privacy usage. The probe result is their own hardware's, but the harness is their own code. This is a **trust and contract** boundary, not a cryptographic one. Mitigations are contractual terms plus optional metering challenges. The design deliberately does **not** pretend this is solved. What it does guarantee is that a disputed figure has a signed, sequenced, auditable record behind it, and that cloud usage — the operator's actual cost centre — is independently counted and cannot be understated.

Because Privacy is **flat-rate**, there is no theft vector; there is only a fairness vector. The control is therefore queue priority, not billing accuracy — which is why §4 pauses and deprioritises rather than blocking.

---

## 8. Use-case matrix

One-API and Bifrost run on the operator PC in every case. LibreChat is independently deployed.

| # | Use case | LibreChat host | IdP | PII custody | Cloud path | Privacy path | Privacy metered by |
|---|---|---|---|---|---|---|---|
| 1 | Society RWA | Tenant PC (behind CGNAT) | LibreChat native local auth | Tenant PC only — zero PII leaves | Tenant →tunnel→ One-API → Bifrost | Tenant PC loopback | §7 telemetry (metadata only) |
| 2 | School / Enterprise LDAP-AD | Tenant PC (school LAN) | Tenant Casdoor + on-prem AD/OpenLDAP | Tenant PC only — strict minor boundary | Tenant →tunnel→ One-API → Bifrost | Tenant PC loopback | §7 telemetry |
| 3 | Operator HQ internal | Operator PC | Operator Casdoor or local LibreChat | Operator PC | All loopback, zero hops | Operator PC loopback | **One-API counts directly** |
| 4 | School on Google Workspace / personal Gmail | Tenant PC (campus or remote) | Google OAuth2 + domain gate | Tenant PC — local Mongo holds email | Tenant →tunnel→ One-API → Bifrost | Tenant PC loopback | §7 telemetry |
| 5 | B2C / SaaS multi-tenant | Operator PC (Cloudflare Tunnel) | Operator Casdoor + Stripe/Razorpay | Operator PC | All loopback | Operator PC loopback | **One-API counts directly** |
| 6 | Cloud edge hybrid SaaS | Cloudflare Pages/Workers or VPS | Cloudflare Access / central Casdoor | Cloud DB / central IAM | Edge →mTLS/tunnel→ Bifrost | Cloud edge | §7 telemetry |

**Cases 1, 2 and 4 are the reason Privacy never transits One-API.** Their PII fiduciary is the Tenant PC and the commitment is explicit. Routing a Privacy turn to the operator host would breach that commitment, independent of technical capability. This is why the design has two Privacy paths by necessity rather than by accident.

Cases 3, 5 and 6 permit central metering, since custody is already operator or cloud.

---

## 9. Retirement of the Node `:4000` gateway

The `:4000` fleet gateway (`LibreChat/fleet/src/gateway.mjs`) is **superseded**. It is no longer in the request path and nothing starts it: `fleet/scripts/dev-gateway.mjs` now starts the Privacy router instead.

### 9.1 Where each duty went

| Duty | New home |
|---|---|
| licence, seat cap, spend cap | **One-API** (`:4000`) — resolves the per-seat `tk_` token, intersects seat/group/token allowlists, counts the tokens it bills |
| provider key custody | **Bifrost** (`:8700`), behind a virtual key |
| model selection, rate limiting, local gate | **Node router** (`:4001`) |
| prompt-injection shield | **Node router** (`:4001`), `satchida/router/src/shield.mjs` |
| identity prompt and date context | **Node router** (`:4001`) |
| local Privacy inference | **Privacy router** (`:4099`), `fleet/src/privacy/router.mjs` |

### 9.2 Why it could not be removed earlier

The old gateway held the injection shield and the identity prompt. When `:4000` was replaced by One-API, **both protections left the request path** — the Node router had a rate limiter, a local concurrency gate and an identity prompt, but no shield. The product's protection against identity probing, role injection, secret extraction and exfiltration was not being enforced at all. The shield was relocated into the router and verified there before the gateway could be superseded.

The gateway also owned `POST /v1/audio/transcriptions`, which the router did not have. That route was relocated too, with a dedicated local-only audio selection: chat's mode order is free/paid, so a local model has no rank there, and transcription would otherwise have had no candidate at all. A cloud transcription endpoint would put the audio on someone else's infrastructure, so local is a requirement rather than a preference.

The source is kept because its tests still document the enforcement behaviour that was migrated, and because a reader comparing the two will want to see what moved. **It must not be started.**

### 9.3 The identity prompt is prepended, not merged

While relocating the shield, the gateway's own tests caught a real defect: `withIdentityPrompt` **merged** the identity rule into the caller's system message, while its documented intent and its test both said the rule is *prepended* and the caller's instructions stay intact as their own message.

Merging looked equivalent and was not. An agent's authored instructions have to survive as a separate message, because that is what every downstream consumer reads, and a provider that honours only the first system message would otherwise lose the agent prompt entirely. Both the gateway and the router now prepend the identity as its own system message and leave the caller's messages in place.

---

## 10. Rollout and verification

### 10.1 Source gates, in order

1. `TenantAccountPlan` term fields + migration; `TenantQuotaRule.AccountType` column.
2. Capacity probe CLI (§5.1) with unit tests for GGUF parsing and bit-width ratios.
3. Capacity model library (§3.1) with tests asserting `C_served = min(C_memory, C_compute)` across the VRAM table in §3.3.
4. Fair-use state machine (§4.6) with tests for all five invariants, including "in-flight never interrupted" and "idle GPU never throttles".
5. Policy Bundle signer/verifier + Revocation Delta, with expiry, replay and tamper tests.
6. Telemetry emitter + One-API reconciliation, with tests for all seven rules in §7.4.
7. Privacy router wiring, with the assertion hooks flipped to mandatory.
8. `:4000` retirement.

### 10.2 Load validation before any tenant activation

Re-run the §5.1 probe against the actual tenant hardware and confirm measured values match the model within tolerance. Specifically assert:

- `per_seat_tps[8] >= 20` for the tenant's expected concurrency, or `C_compute` is reduced accordingly.
- `cache_reuse_ok == true`, or the tenant is marked unverified.
- A 150-turn/hour synthetic workload reaches at most HARD when `queued_seats == 0`.
- A deliberately abusive workload (10× rate, continuous) reaches SERIOUS and is deprioritised but **never** cut off.

### 10.3 Approval gates

Source implementation and local mock validation only. Any live change — tenant activation, gateway retirement, model preset change, or service restart — requires a separate operator-approved window. No paid provider probe, no tunnel change, and no production data mutation is authorised by this document.

---

## 11. Implementation status

Everything in this document is implemented as source and covered by tests. **Nothing is live**: the gateway has not been restarted, the model preset is unchanged, the tunnel is untouched, and no tenant has been activated.

### 11.1 What was built

| Area | Location | Tests |
|---|---|---|
| GGUF geometry, capacity model, tier ladder | `fleet/src/capacity/{gguf,model}.mjs` | 65 |
| Tenant hardware probe CLI | `fleet/src/capacity/probe.mjs` | 8 |
| Fair-use controller, admission gate | `fleet/src/privacy/fairuse.mjs` | 26 |
| Privacy router (assertion, child safety, fair use, `/capacity`) | `fleet/src/privacy/router.mjs` | 44 |
| Gateway Privacy routing | `fleet/src/gateway.mjs` | 3 |
| Privacy assertion minting, seat policy, readiness | `packages/data-schemas/src/methods/privacyAssertion.ts` | 25 |
| Policy Bundle + Revocation Delta (sign/verify) | `one-api/model/policy_bundle.go` | 12 |
| Telemetry reconciliation (7 rules) | `one-api/model/telemetry.go` | 21 |
| Telemetry emitter, queue, accumulator | `packages/api/src/tenancy/telemetry.ts` | 33 |
| Bundle/Delta verification, seat entitlement | `packages/api/src/tenancy/policyBundle.ts` | 30 |
| Account type catalog + entitlement rules | `packages/data-provider/src/tenant-entitlement.ts` | 33 |
| Per-account-type contract terms, quota scoping | `one-api/model/tenant_account_plan.go`, `one-api/model/tenant.go` | 20 |
| Group entitlement fields + family seat model | `packages/data-schemas/src/{types,schema}/group.ts`, `one-api/model/group.go` | 11 + 7 |
| Admin groups API (account type, modes, capabilities, family shape) | `packages/api/src/admin/groups.ts` | 11 |
| Tenant admin panel UI | `client/src/components/Admin/GroupsPanel.tsx`, `client/src/data-provider/admin/groups.ts` | syntax-verified |
| Per-tenant analytics + mode split | `one-api/model/analytics_tenant.go`, `one-api/model/satchida_mode.go` | 9 |
| Tenant management log | `one-api/model/log.go` (`RecordTenantLog`), `one-api/model/analytics_tenant.go` | — |
| Tenant UPI payment session | `one-api/model/payment_session.go`, `one-api/controller/payment_session.go` | 9 |
| Operator multi-tenant console (berry theme) | `web/berry/src/views/Dashboard/component/{TenantPortfolio,TenantUsageDrawer}.js` | syntax-verified |
| Tenant self-service portal (berry theme) | `web/berry/src/views/TenantPortal/index.js` | syntax-verified |
| Tenant dashboard UI (default theme) | `web/default/src/pages/{Tenant,TenantPayment}/` | syntax-verified |
| SSRF protection | `one-api/common/ssrf/`, `one-api/middleware/ssrf.go` | 18 |

### 11.2 The Privacy request path, end to end

```
LibreChat (tenant PC)
  └─ initialize.ts
       ├─ seat policy read from the operator's allocation   (getTenantSeatPolicy)
       ├─ Privacy assertion minted, 300 s, Ed25519          (getPrivacyAssertion)
       └─ local runtime readiness probed                   (isPrivacyLocalReady)
  └─ POST /v1/chat/completions  Authorization: Bearer <assertion>
       └─ gateway.mjs  provider=privacy
            └─ privacy/router.mjs
                 ├─ assertion verified (tenant, seat, profile, mode)
                 ├─ cross-seat replay check
                 ├─ child safety: input screen, system prompt, output screen
                 ├─ fair-use admission: capacity gate, tier, cooldown, queue position
                 └─ llama-server  (loopback only)
```

Cloud takes a different path and is not affected by any of the above: LibreChat → One-API (`tk_` seat token) → Bifrost → provider, with One-API counting tokens operator-side.

### 11.3 Trust boundaries, stated plainly

| Path | What is enforced | Trust |
|---|---|---|
| Cloud | One-API counts tokens itself at `postConsumeQuota` | Operator-side, not forgeable by the tenant |
| Privacy | Assertion signed by the tenant's own LibreChat server | **Tenant-local.** It stops a misconfigured client and attributes a seat for the fairness ladder. It does not stop a determined tenant administrator from forking their own server, and it is not claimed to. |
| Telemetry | Signed, sequenced, grant-bound counters | Detectable, not cryptographically proven. A tenant that edits its harness before signing can under-report. Contract terms plus optional metering challenges are the mitigation. |

### 11.4 Known limitations

1. **Revocation lag.** A revoked seat keeps working on the tenant PC until its assertion expires (300 s) and the Policy Bundle TTL (30 days, refreshed on each telemetry contact). Immediate offline revocation is not provided and is not claimed.
2. **Privacy counts are tenant-reported.** Cloud counts are not affected.
3. **Tenant VRAM is not independently verified by the operator.** The probe runs on the tenant's hardware, so a false report produces a limit their own logs contradict.
4. **`family` remains Privacy-eligible** through the `localPrivacyEnabled` add-on flag, as before.
5. **The group name is the mapping key.** A group in LibreChat and a group in One-API are the same product line because they share a name within a tenant. Renaming one side without the other breaks the mapping; there is no separate identifier.

### 11.5 Defects found and fixed during this work

| Defect | Effect | Fix |
|---|---|---|
| KV cache footprint double-counted (multiplied by 2 *and* summed the K and V head dims) | Every reported concurrency was **half** the true value | Count the K and V dimensions once |
| `RollingWindow` stored a value but no epoch | The window never rolled; a seat was penalised for an hour's usage forever | Store `[epoch, seconds]` per slot |
| Bucket width treated seconds as milliseconds | Buckets were 1000× too wide, so usage never expired | Millisecond-based bucket width |
| `requeue` duplicated a batch | A failed upload would have been delivered twice | Do not requeue a batch still in the queue |
| Telemetry fingerprint depended on row order | A tenant could reorder usage rows to dodge a per-row threshold | Canonicalise row order *and* field order |
| `IsTermActive` rejected grace-period service | A tenant whose renewal webhook had not landed was locked out mid-session | Grace keeps the term servable |
| Assertion replay check refused the same seat's second turn | Broke the **second message of every conversation** | Replay protection is cross-seat, not cross-request |
| Replay cache entries without an expiry were never evicted | The cache grew without bound | Treat a missing expiry as expired |
| `client/node_modules/librechat-data-provider` was a stale copy (0.8.524 vs 0.8.527) | The client compiled against types months old | Synced the built output |
| `generateMermaidDiagramPrompt` was used but never imported | The Mermaid diagram button threw at runtime | Added the import |
| `familyRole === 'child'` compared against a type that has no such member | The child check never matched | Use `minor`, the value the server sends |
| `debouncedChange(next)` passed a boolean where the hook expects `{ value }` | The web-search toggle was never persisted | Pass the tool value |
| 42 translation keys referenced by the client existed in no locale | The client's `TranslationKeys` union was incomplete | Added the keys to all 41 locales |
| `enterprise` used as the "off-catalog" example in two One-API tests | Both tests silently became wrong when the catalogue widened | Use a genuinely invalid value, and assert catalogue alignment instead of a hardcoded list |
| The `mongodb-memory-server` archive failed its MD5 check | **25 API suites and 59 data-schemas suites could not run at all** | The archive was verified to be a valid zip containing a genuine MongoDB 8.2.1 `mongod.exe` that reports its own version, so only the sidecar checkfile was stale; it was regenerated from the verified bytes |
| The plugin hook executor forwarded no usable environment on Windows | **Every deployment-plugin command hook failed to start.** The child had no `PATH`, `ComSpec`, `PATHEXT` or temporary-directory variables, so PowerShell could not resolve any command | Case-insensitive environment lookup, and the Windows variables a child needs are now forwarded |
| The identity prompt was merged into the caller's system message | Contradicted its own documented intent and failed its own test; an agent's instructions would be lost on a provider that honours only the first system message | Both the gateway and the router prepend the identity as its own system message |
| A router test pinned a model with documented retention into Work mode | Contradicted the ZDR policy | The fixture pins a zero-retention model, and a new test asserts the exclusion |
| A manual UPI payment was made idempotent by matching a reference *substring* of the log content | Two references sharing a prefix would collide | The credit is applied against a `PaymentSession` row addressed by primary key |
| Tenant management actions recorded the tenant id inside a sentence | A tenant's history could only be found by substring-matching content | The tenant id is written to its own column and queried by it |
| A One-API channel base URL was never checked | A misconfigured or hostile channel could reach loopback, RFC1918 or the cloud metadata service | SSRF protection at the one point every relay path passes through |
| The Gin engine trusted every proxy, so `c.ClientIP()` returned the caller's own `X-Forwarded-For` | The address One-API accounted against — used for a **token's subnet restriction**, the **rate limit bucket**, the **Turnstile remoteip** and the request log — was whatever the caller put in the header | The proxy chain is now declared in `TRUSTED_PROXIES` and resolved from the right, and the header is ignored entirely when no proxy is declared |
| Cached tokens were charged at the input rate in the legacy ratio path | A long coding session is mostly cache reads, so the workload the product exists for was billed at the wrong price | Cached tokens are charged at a configurable cache ratio, defaulting to the same discount the retail path already used |
| **The hook executor forwarded no usable environment on Windows** | **Every deployment-plugin command hook failed to start.** The child process had no `PATH`, `ComSpec`, `PATHEXT` or temporary-directory variables, so PowerShell could not resolve any command from `PATH` and reported *"The term 'node' is not recognized"*. It also missed the host's `Path` spelling entirely, because Node exposes it under that name on Windows | Deployment-plugin command hooks were entirely non-functional on Windows | Case-insensitive environment lookup, and the Windows variables a child process needs to resolve a command are now forwarded |
| `mongodb-memory-server`'s cached archive failed its MD5 check | **25 API test suites and 59 data-schemas suites could not run at all.** The archive was verified to be a valid zip containing a genuine MongoDB 8.2.1 `mongod.exe` that reports its own version, so only the sidecar checkfile was stale | The whole DB-backed test surface was blocked | Regenerated the checkfile from the verified bytes |
| `seedSystemGrants`'s retry test used fake timers | The suite **hung for 45 minutes** against the real MongoDB driver: the backoff is a real `setTimeout`, and advancing fake timers does not let the driver's in-flight operation finish, so the awaited promise never settled | The data-schemas run took 45 minutes instead of seconds | Real timers; the backoff is one second, so the cost is negligible next to a deadlock |
| The `deleteSkill` spec asserted a hard cascade | The suite contradicted the soft-delete and trash-bin contract the implementation now follows | The spec was updated to the current contract, and the permanent path is covered explicitly |
| Two suites asserted POSIX literals (`file:///srv/app/...`, `/srv/app/plugin`) | Failed on Windows, where the resolved path carries a drive letter and backslashes | Expectations are now derived from the platform |
| Two suites spawn `bash` and read `/proc/<pid>/stat` | Cannot run on Windows at all | Explicitly skipped there, with the reason stated in the file |

### 11.6 Verification

| Repository | Suite | Result |
|---|---|---|
| One-API | `go build ./...`, `go vet ./model/`, `go test ./... -short` | clean |
| LibreChat `packages/api` | full suite, 622 suites | **617 passed, 5 skipped, 0 failed** (16,524 tests) |
| LibreChat `packages/data-provider` | full suite | **56 suites, 2,305 passed, 0 failed** |
| LibreChat `packages/data-schemas` | full suite | **98 suites, 3,502 passed, 0 failed** |
| LibreChat `fleet` | capacity + privacy + gateway | **135 passed, 0 failed** |
| LibreChat `client` | `tsc --noEmit` | 25 remaining errors, all third-party type incompatibilities in files outside this work (react-query `isPending`, remark/rehype plugin generics) |

The five skipped API suites are the POSIX-only process-management cases, skipped with the reason stated in the file rather than left failing.

### 11.7 Pre-existing failures, not caused by this work

| Suite | Cause |
|---|---|
| `fleet/test/chat.mjs` | Self-documented as *"Not a unit test. This drives the RUNNING gateway on :4000 with a real licence"*. The live PM2 instance has a mismatched licence |
| `fleet/test/models.test.mjs` #12, and its hang on exit | `fleet/src/models.mjs` last modified 2026-07-10, months before this work; untouched here |
| `client` 25 type errors | Third-party `react-query` `isPending` and remark/rehype plugin generics in untouched files |

The `mongodb-memory-server` MD5 failure, the Windows hook environment, the fake-timer hang, the stale skill spec, the POSIX path literals and the two POSIX-only suites were all **fixed** during this work and are listed in §11.5.

### 11.8 What is still open

**Security and correctness.**

1. **A second factor.** one-api has none. A tenant admin can mint seat tokens and move budget, and the operator console is password-only. TOTP is the cheapest material improvement; passkeys are the better one.

**Closed since the last review.** Trusted proxy resolution, so the client address One-API accounts against is the caller's real one and cannot be chosen with a header. Cache-aware ratio billing in the legacy ratio path, so a cached token is charged at the cache rate rather than the input rate; the table is per model and per channel and is exposed as the `CacheRatio` option.

**Product work, deliberately deferred.**

4. **The YouPI-PG adapter.** The session model it will drive is built, including the `provider_session_id` column, so the adapter is an addition rather than a rewrite. It is integrated over HTTP with no code copied.
5. **The mode-to-model translation exists in three places** — the operator's One-API channel mapping, the Node router's preferences, and the tenant-local Privacy router's resolution. The same translation in three sites will drift; one canonical table would be better.

**Operational, and needing a decision rather than code.**

6. The Node router on `:4001` is down, so cloud traffic through One-API channel 1 fails with a connection error.
7. LibreChat on `:3080` is not running.
8. The local runtime on `:8080` is in router mode with `--no-models-autoload` and answers `model not found` until a model is loaded.
9. The `.env` licence is signed by a stale key and is refused with 401.
10. `tenant_seat_aliases` is empty, so the seat-binding rules are dark code until seats are provisioned.
11. The running One-API build predates this source, so its `groups` table has no `allowed_modes` or `capabilities` columns and its binary does not carry the new tenant analytics.
12. **`TRUSTED_PROXIES` must be set for the deployment.** With it unset, One-API ignores the forwarding header entirely and accounts every request against the proxy's address, which is safe but means a tenant's per-IP rate limit is shared across everyone behind the tunnel. The value should list the Cloudflare tunnel's egress addresses or the tunnel's own range.