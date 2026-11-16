# Domain language

- **Scheduled run admission**: The claimed-occurrence phase that rehydrates the owner, validates current schedule policy and agent reachability, resolves files and MCP readiness, and only then competes for durable generation capacity. It owns cancellation and lease revalidation until a generation slot is reserved; a slow or failed readiness check never occupies generation capacity.

- **Attached code environment**: A principal- or deployment-authorized stateful workspace owned by an outbound `librechat-code` worker on a user-chosen machine or VM. LibreChat selects it and enforces approval policy, Code API authenticates and dispatches to it, and the worker's local sandbox and capability flags remain the final execution ceiling. The environment interface is runtime-neutral: native SRT, WSL2, Docker/NsJail, and future adapters expose the same workspace operations without leaking host paths or runtime configuration into agent tools.
- **Conversation code-environment decision**: The immutable choice established by a conversation's first accepted submission between validated attached workspaces and continuing without an attached environment. Agent defaults and recent workspace preferences may suggest a draft choice, but only the persisted conversation decision authorizes attached workspace tool registration; later turns, retries, resumes, and alternate ingresses cannot upgrade or replace it. Runs persist a decision only for a conversation that does not store one yet, so no run writes its run-start decision back over a stored one. The one exception to immutability is the owner's explicit move, available where `statefulCodeSessions.conversationMoves.enabled` allows it: when an agent is pointed at a different attached environment after the chat was sealed, the owner may replace the decision's environments with the ones the agents now use, validated against the live worker. A move never changes the workspace of an environment the decision already covers, never upgrades a conversation that continues without an attached environment, and is refused while a generation is running, awaiting approval, or saving its response.
- **Agent run envelope**: the versioned, JSON-safe request contract created after ingress authentication and protocol validation but before agent, provider, tool, or MCP initialization. It carries only the validated protocol payload and the minimum trusted principal identifiers. The execution host rehydrates all runtime state from those identifiers.
- **Agent execution context**: runtime-only, transport-free state rehydrated beside an Agent run envelope. It contains the authenticated user, application configuration, normalized request metadata, and resolved conversation facts needed by initialization, but never Express request/response objects or serialized credentials.
- **Agent execution host**: the protocol-neutral module that owns run admission, disconnect cancellation, provider-start fencing, and terminal settlement. Protocol implementations execute behind its callback interface; HTTP adapters retain validation and final stream rendering.
- **Agent execution enrollment**: the durable, protocol-neutral lifecycle authority for an admitted Agent run. It is created under the authenticated user and tenant before user-owned initialization, rechecks the shared owner-deletion admission fence after registration, exposes the only provider abort signal, fences exact provider start, terminalizes the run, waits for every trailing usage, artifact, and stored-response write, and acknowledges provider drain last. A transient terminalization failure is reconciled after trailing writes; provider drain is never acknowledged while the exact job remains nonterminal. Delete-all holds the owner fence, drains every owner run before selecting its first persistence snapshot, and repeats both the drain and an idempotent owner-persistence sweep after any recovered fence lapse before releasing admission. Exact-conversation deletion additionally performs an unconditional idempotent cleanup over its immutable deleted-ID set because a fully drained run may leave the active index after racing the first delete; only the explicit empty result is benign, while storage failures remain fatal. Chat Completions, Responses, Channels, and future ingress adapters share this authority without moving LibreChat persistence policy into the Agents SDK.
- **Agent turn execution plan**: the immutable, request-local decision compiled once after authentication, agent resolution, and tool initialization. It records the trusted turn origin, conversation lineage, pause capability, binding/action context, and the preferred checkpoint, history, or fresh state-loading strategy without executing the model or owning persistence. Checkpoint failure falls back to durable history within the same Agents lifecycle.
- **Turn delivery routing**: the per-agent, request-local value that decides how each attachment reaches the model on one turn (`provider`, `text`, or `none`). Initialization settles it once, after the provider swap and the Responses API decision, under the endpoint's own name and the media dialect its config declares. Every reader of a turn route consumes that one value rather than deriving it from the agent. A stored route is an upload-time inference that this value resolves again for the turn; a destination the user chose stands.
- **Effective agent selection**: the resolved endpoint and agent identity after an enforced model spec is applied. Authorization and agent loading must consume this same identity before the Agent run envelope is initialized.
- **MCP runtime request body**: trusted chat identifiers supplied only while an MCP server handles an agent request. It enables request-scoped header placeholders without retaining user-specific request data on a shared server definition.
- **MCP direct OpenID bearer**: an operator-trusted remote MCP credential mode that resolves the logged-in user's live OpenID access token into an Authorization header. It may replace one rejected connection after a forced session refresh, but it never replays the rejected tool invocation automatically.
- **MCP OAuth prompt projection**: the client-safe, generation-scoped view of authorization prompts that remain actionable in a resumable Agent stream. It is derived from durable OAuth step state, carries no tokens or flow internals, and lets reconnecting clients render current state without interpreting the replay log.
- **Caller Capability Projection**: the versioned, SDK-owned classification of currently active tools by direct and programmatic callers. Event-driven execution transports this projection as data; LibreChat intersects it with its trusted registry and never recomputes deferred-tool discovery policy or treats the projection as authorization.
- **Subagent thread**: a durable, view-only child conversation owned by one parent conversation and subagent identity. A parent agent may continue it by stable `threadId`; each continuation uses a fresh execution lease restored from the canonical child transcript. It is not an ordinary human-writable chat.
- **Live subagent task owner**: the one API process holding a detached child execution, its abort controller, and its bounded control queue. Redis may route trusted poll/control envelopes to that owner, but it does not migrate or persist the executor; Mongo persists only the logical child thread and its continuation fence.
- **Subagent completion wakeup**: a durable internal `continue` trigger pre-registered before detached child execution so a process crash cannot lose the wakeup. Delivery defers until the child's terminal transcript is persisted, targets the initiating agent and exact parent response branch, carries task metadata rather than child output, waits for the parent generation to settle, and starts the parent turn that collects the result through the existing task store.
- **Agent continuation preparation**: the single source-dispatch seam that resolves a durable `continue` delivery immediately before admission. Bound Event Actor work selects its binding adapter; internal completion work selects an adapter by stable source identity. Preparation may resolve authoritative input and branch state or settle already-consumed work, but it does not own source result truth, delivery ordering, or generation execution.
- **Warm terminal steer continuation**: a queued steer accepted before a generation's terminal boundary may continue the same SDK `Run` without creating a replacement generation. After parallel Stop hooks fold, the serialized StopFinalize phase tells the job store whether another continuation is already planned or terminal progress is forbidden. The store atomically chooses among claiming the current protocol-v2 FIFO batch, keeping empty admission open for an already-planned segment, and sealing admission so every racing or later message becomes an ordinary follow-up. Claimed steer receipts remain the crash-recovery authority; protocol-v1 generations always seal because they cannot recover an ambiguous terminal claim. Tool-batch, preemption, and terminal boundaries share one durable apply-and-inject adapter, while the SDK owns the bounded Stop-continuation loop.
- **Agent queued turn**: a server-owned ordinary follow-up accepted while an Agent generation is active. Its Mongo row is the sole FIFO, payload, and lifecycle authority; the trigger delivery is only a replayable wakeup and Agent execution enrollment is only an execution adapter. The lifecycle reserves the deterministic delivery identity before publication, admits only after the captured branch has a clean durable predecessor outcome, and commits the source-owned generation receipt only after provider invocation has been enrolled. An accepted or deduplicated loopback response requires that exact receipt; a process death before it remains explicit admission-indeterminate evidence instead of silently consuming the text. Admission reconciliation is leased, backoff-scheduled work: exact generation evidence may repair legacy ambiguity, while current source-owned ambiguity never infers provider outcome from transient job state. Aborted or failed predecessors and exhausted admission attempts remain visible terminal rows. Transport-ambiguous enqueue outcomes stay non-resendable until exact request-identity reconciliation succeeds; an elapsed client observation window may hide the warning locally but never converts ambiguity into permission to submit again. Conversation deletion cancels the rows, retires their deliveries, and removes their payloads before deleting the conversation wave.
- **Subagent activity stream**: an observational, task-scoped live projection of bounded child progress for the currently open private panel. It may cross API replicas through Redis, never carries hidden reasoning text, and never controls or settles execution. The durable child thread remains canonical and its existing polling view is the fallback for missed or unavailable live events.
- **Agent event handling outcome**: the durable, generation-fenced result of a previously accepted event delivery. `started` proves generation admission; terminal states distinguish verified tool application, clean completion without action, failure, and cancellation. Transport success remains separate so an accepted event cannot masquerade as completed work.
- **Agent event expected action**: an optional source-declared tool name and bounded argument subset evaluated against host-observed completed run steps. It is evidence policy, not authorization and not a model-authored success claim.
- **Event actor head**: the private, durable pointer on an event-bound child conversation to its latest committed LangGraph checkpoint, plus one previous checkpoint for safe cleanup. Only a qualifying applied action advances it through compare-and-swap; failed, cancelled, or no-action invocations leave it unchanged. A legacy-path event marks the head for a cold rebuild from durable message history before fork mode can resume. Every applied commit conflict, unverified commit, or post-commit persistence failure is retained in a private reconciliation journal that blocks later actor turns instead of continuing from stale state; an exact marker can be cleared only after its checkpoint is verified authoritative, its history is repaired, or its external action is explicitly compensated.
- **Event actor invocation fork**: a delivery-owned checkpoint namespace copied from the event actor head. Every bound Event Actor enters one turn module; `fresh`, `history`, and `checkpoint` are internal state-loading adapters selected automatically from actor state and immutable request capability, never from operator configuration. The history adapter owns its durable turn fence and token ordering, while immutable protocol-v1 tokens remain read-compatible until their jobs drain. A warm invocation receives only the new trusted event, then commits its terminal checkpoint when the expected action is observed or deletes the fork otherwise. When the invocation pauses for approval or Ask User, the SDK emits signed, versioned suspension evidence. The child Conversation is the canonical one-shot suspension authority; the generation job carries only a versioned projection for UI, rolling-deploy routing, and the existing resume endpoint. Current Event Actor hosts select generation protocol v2 automatically; a trusted pre-capability producer remains on history only for the mixed-version drain. A resume shares one identity between its Conversation claim and provider-owner CAS, clears the predecessor projection, and publishes a successor only after a re-pause is canonical. A pending interrupt takes precedence over expected-action evidence from the same segment; if that segment already applied the expected action, publishing its successor pause cold-marks the prior head until a later applied commit replaces it. An ambiguous projection write is accepted only after reading back the exact generation, action, and suspension. The provider-start CAS is written only after client reconstruction and immediately before the continuation gate opens, then retains its exact execution identity after drain, so terminal recovery can compensate a projected claim only when that identity proves execution never began. Durable approval projection is exposed before the persistence barrier opens, preventing a resolved action from being announced afterward. Terminal no-action retirement cancels or settles the exact suspension and releases its delivery-side action admission before public settlement; if retention already removed the child Conversation, the delivery remains authoritative for its exact admission identity. Resume, re-pause, cancellation, and expiry claim or replace that exact suspension before touching its job projection, so later mailbox deliveries stay blocked until terminal history and handling evidence settle.
- **Event actor receipt**: the private, terminal proof stored on the authoritative `AgentTriggerDelivery` row for one bound actor invocation. Its unique delivery identity, terminal resolution, exact checkpoint, and bounded action identity provide replay and recovery for the retention window without storing prompts, events, tool arguments, tool output, or conversation history. It does not own the actor checkpoint; the conversation keeps only the actor head and any active unresolved reconciliation until this receipt is durable.
- **Agent event actor mailbox**: the automatic durable delivery-ordering lane for one authenticated source binding. It keeps later deliveries queued after transport admission until the current child turn records an authoritative terminal handling outcome. It serializes existing coalesced batches and individual events without becoming a second execution controller or actor checkpoint store.
- **Agent trigger capability shield**: the durable mixed-version representation for internal trigger work that only a capability-aware worker may execute. Mongo uses an old-publishable `staging` shell; a queued `leased` shell without an owner or deadline, which old workers cannot claim but can use for bounded lane rechecks; a private lease only during execution; and a legacy-terminal `capability_dead` shell once dead. Private capability fields own current claiming, retry, and dead-letter truth. Redis uses a versioned fail-closed terminal status and recovery index that old replacement scripts and sweepers cannot consume. The shield is an implementation detail at the storage seam, never a deployment switch or user-configured product mode.
- **Theme definition**: a versioned, data-only description of LibreChat semantic colors and shared appearance roles, optionally specialized by light or dark mode. The theme module validates and resolves partial definitions against bundled defaults before adapters apply them. A theme definition does not contain arbitrary CSS, application behavior, or alternate feature layouts.

---

## Satchida product domain

Terms below are specific to this fork's subscription, quota, and payment layer. The upstream
domain language above is unchanged. Design rationale is in `ARCHITECTURE.md`; divergence from
upstream is tracked in `Customizations.md`.

- **Plan**: a named, operator-defined bundle of exactly three things — an RBAC role, a balance
  configuration, and an interface feature set. A plan is not an entitlement system and never
  reimplements one; the role and balance primitives are upstream. Plans are operator data, not
  code, so price and quota changes do not require a deploy.
- **Subscription**: the durable link from a user (and their tenant) to the plan they currently
  hold, with a lifecycle status of `pending_payment`, `active`, `expired`, or `revoked`. Only an
  `active` subscription confers plan entitlements; a `pending_payment` subscription confers
  exactly the Demo tier.
- **Demo account**: a registered, authenticated user with no confirmed payment. It is a plan
  tier, not a separate account type, and it is deliberately time-boxed — a small token
  allowance refilling every 24 hours — so an unpaid user can try the product but cannot use it
  as a free service. Demo is the only tier reachable without a payment confirmation.
- **Payment attempt**: one user's act of selecting a plan and submitting proof of UPI
  payment. It is created `pending` and is not a subscription; approval is what creates a
  subscription. A failed or abandoned attempt leaves the user on Demo.
- **Payment confirmation**: an operator's (or a gateway's) verified act of accepting one
  payment attempt. It is the single point at which an account leaves Demo. Confirmation is
  idempotent by attempt identity, so a replayed webhook or a double-click cannot grant two
  subscriptions or two quota cycles.
- **Manual UPI provider**: the live payment provider. The owner's static UPI QR carries no
  webhook, so confirmation is a human act — the operator reconciles against a banking app and
  approves in the reconciliation console. The user-visible state is identical to the gateway
  state; only the confirmer differs.
- **Razorpay provider**: the deferred payment provider, selected by the `payments.provider`
  configuration lever rather than a code branch. It is implemented against the same interface
  but inactive until an account and credentials exist. It never replaces the manual path's
  semantics; it only changes who performs confirmation.
- **Reconciliation console**: the operator surface listing every account with its registration
  date, last authentication, selected plan, and payment status, filterable and exportable for
  matching against a bank statement. It is required under either provider, because neither
  LibreChat's native admin nor the AGPL admin-panel has any awareness of credits, plans, or
  payments.
- **Seat**: a Family-tier unit of pooled quota. A subscription carries a seat count; inviting a
  member beyond it is refused. Seats govern sharing, not privilege — every seat holds the same
  role.
- **Mode**: the per-conversation execution mode chosen by the user — `Chat`, `Work`, or
  `Privacy`. A mode is not a plan and not a tier; any plan may use any mode its entitlements
  allow. A mode determines *routing and privacy posture*, never capability. It is chosen per
  conversation and is never resolved to a provider or model name in anything the user can see.
- **Chat mode**: the default. Routes to free cloud first, then paid cloud, then local. Makes no
  privacy promise beyond the provider terms it routes to.
- **Work mode**: prefers paid providers because the user is asking for the strongest available
  answer. Same privacy posture as Chat; different ordering.
- **Privacy mode**: the privacy mode. Routes to local inference only, so content never leaves
  infrastructure we operate. Customer-facing description is **"Processed only on infrastructure
  Satchida operates."** Never to a free route, never to a provider whose retention position is
  unknown, and never to a public search engine.
- **Non-retention**: the provider does not retain the prompt after the request completes. It is
  a contractual property, distinct from locality, and it is obtained from the provider's terms —
  never by routing through an intermediary that itself processes the content.
- **Unlinkability**: the provider cannot determine which individual user sent a given prompt.
  Achieved by architecture — one shared key per provider, mixed traffic, and distribution across
  several providers so that no single provider holds a correlated slice of the user base. It is a
  property of the routing design, not of any vendor.
- **Locality**: the content never touches third-party infrastructure. Only local inference
  provides it. A paid Privacy-mode subscriber is buying exactly this property.
- **Privacy promise**: the exact claim the product may make. Always one or more of
  non-retention, unlinkability, and locality — **never "anonymous"**, because Satchida holds the
  credentials and runs the router and is therefore always an identifiable party. The full
  claims ledger, including the claims we must never make, is `PRIVACY.md` §4.
- **No-provider-marketing rule**: no model provider or model name may appear in any user-facing
  surface — interface, responses, plan copy, feature lists, agent or preset names, or config
  values a user can observe. This is a compliance requirement under the provider terms that
  permit wrapping (§A.1) while restricting a competing product (§D.4), not merely a branding
  preference. Adding a provider-branded tier later would breach it.
- **Satchida-side retention**: conversations are stored in MongoDB so users can resume them.
  This is disclosed in the privacy policy and the in-app notice, not concealed. It is also why
  we cannot claim that nothing is retained by anyone.
- **Provider licensing gate**: the checks a provider must pass before entering the routing
  registry — no competing-product use, no multi-account quota stacking, retention documented.
  Retention unknown means the entry is barred from Privacy mode. The gate fails closed.
- **Recovery**: re-deriving a complete answer after a turn fails, by discarding the partial
  buffer and re-executing the turn from its beginning on another route. It is a re-execution,
  not a resume, so no side effect from the failed attempt carries over. Free routes are
  preferred so recovery costs close to zero, with local inference as the terminal hop.
- **Free-route budget**: the fixed daily request allowance shared between normal traffic and
  recovery. Reserved deliberately between the two, because recovery fires precisely when
  providers are failing and would otherwise consume the whole pool.
- **Shared deployment** vs **dedicated instance**: the two tenancy modes. Community, Standard,
  Pro, and Family share one installation separated by `tenantId`; Enterprise receives a
  dedicated instance. A plan may exist in both modes; it is the tenancy, not the tier, that
  changes isolation guarantees.

---

## 3. Distributed Edge Fleet & Ingress Domain Model

Specific to the **Satchida Distributed Edge Deployment** over Jio CGNAT via Cloudflare Zero Trust on domain `satchida.com`:

- **Master Fleet Controller (HQ)**: The central control-plane process running at Seller Central HQ on your Windows 11 machine (`127.0.0.1:8443`). It owns the tenant registry, client secret keys, license ledger, seat allocations, and master upstream API keys.
- **HQ Ingress**: Exposed via `cloudflared.exe` Windows Service to:
  - `control.satchida.com`: API endpoint for edge node telemetry, heartbeat polling, and policy dispatch.
  - `office.satchida.com`: Direct LibreChat ingress on port 3080 for your internal office workers.
- **Edge Execution Node**: An autonomous, native Windows 11 desktop running at a client site (school, SME, enterprise) behind symmetric Jio/Airtel CGNAT. It runs native LibreChat (`127.0.0.1:3080`), local MongoDB (`127.0.0.1:27017`), local LanceDB RAG service (`127.0.0.1:8000`), local AutoRouter (`127.0.0.1:4000`), and a dedicated `cloudflared.exe` service.
- **Tenant Subdomain**: Each client receives an isolated named Cloudflare tunnel mapped to `https://<client-subdomain>.satchida.com` (e.g. `https://school-mum.satchida.com` or `https://sme-blr.satchida.com`).
- **Heartbeat & Telemetry Loop**: Outbound HTTPS `POST` from the client's `node-sync-agent` to `https://control.satchida.com/api/v1/fleet/heartbeat` every 15–30 seconds. Carries telemetry and pending administrative expansion requests signed with HMAC-SHA256.
- **Zero-Knowledge Key Custody**: Real provider API keys (OpenAI, Anthropic, Gemini, DeepSeek) never exist on edge nodes. Upstream prompts route through `control.satchida.com` where master keys are injected in-flight after license and quota verification.
- **Llama fleet (`:8080`)**: The Tauri-managed local inference fleet serving the dynamic model catalog. `llama-server.exe` runs with `--models-preset models-preset.ini --models-max 1 --no-models-autoload --ui-mcp-proxy`; the preset is regenerated by Tauri from `C:\LAN-AI-Infra\LLM-models` and `D:\LAN-AI-Infra\LLM-models`, and `/v1/models` is the model-selection list. One load slot (`--models-max 1`): loading a model evicts the previous one. **Invariant**: the fleet is only ever launched with the preset profile (mirroring `satchida-tauri/src-tauri/src/lib.rs`) — never a bare `--model <file>`, which collapses the catalog to one entry. `start-local-backend.ps1` is the executor decoding profile, not the fleet launcher. A cold-start guardian (PM2 `llama-watchdog`, `D:\LAN-AI-Infra\ops-scripts\llama-watchdog.mjs`) may act only when `/health` fails, never against a live instance, and may load the operator default (`Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0`) only right after its own cold start when nothing is loaded. `--no-models-autoload` is deliberate design, never to be removed.
- **Physical Tenant Isolation**: Separate, dedicated MongoDB per client. No cross-tenant data mingling, satisfying India's Digital Personal Data Protection (DPDP) Act by design.

---

## 4. Local Backup Invariant & Storage Location

- **Canonical Repository Backup Directory**: All full repository snapshots, bundle archives, and point-in-time state backups MUST reside strictly under:
  ```
  D:\LAN-AI-Infra\LibreChat\backup\
  ```
- **Active Backup Archive**:
  - `D:\LAN-AI-Infra\LibreChat\backup\LibreChat_satchida_backup_20261116_0950.bundle` (~273 MB, covers complete git commit history and tags on branch `satchida`).
- **Never create external or ad-hoc backup directories** (e.g. `D:\LAN-AI-Infra\backups`); always store backups inside `D:\LAN-AI-Infra\LibreChat\backup\`.
