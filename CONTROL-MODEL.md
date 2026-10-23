# Control & Enforcement Model — Satchida AI Harness

How much control we actually have over a client installation, what is technically enforceable,
and where Indian law draws the line. Written against the operator's question: *"how much can we
control while being completely legal in India."*

Related: `VULNERABILITIES.md`, `ARCHITECTURE.md` §11–12, `SOLUTIONS.md`.

---

## 1. The governing principle: reverse-engineering is expected, design for it

**Anything that runs on client hardware is fully readable by the client.** LibreChat is MIT —
they can read every line of our modifications. No amount of obfuscation changes that, and
attempting it would be dishonest engineering.

So we do not defend by hiding. We defend by **keeping the valuable things off their machine.**

| Runs on CLIENT hardware | Stays on OUR infrastructure |
|---|---|
| LibreChat (readable — it is MIT) | Provider API keys |
| Local model + llama.cpp | Router / autorouter |
| RAG service + their documents | Authorisation service: entitlements, seat caps, spend caps |
| Platform database | **Ed25519 private signing key** |

**The consequence that matters:** a client who fully reverse-engineers the LibreChat build on
their own machine obtains **no provider API key, no cloud inference, and no entitlement record** —
because none of those exist there. Enforcement lives server-side, so reverse-engineering the client
side yields nothing worth having.

This is the whole answer to "anyone can reverse-engineer it". Yes — and that is architecturally
irrelevant.

---

## 2. What is enforceable, and where

| Control | Enforced by | Client can bypass? |
|---|---|---|
| Cloud inference at all | **Our gateway** — no valid licence token, no request served | **No** |
| Seat cap | **Our authorisation service**, per request | **No** |
| Spend cap / token balance | **Our gateway**, per request | **No** |
| Plan entitlement (which modes) | **Our gateway** | **No** |
| Licence validity period | Signed token + gateway clock | **No** |
| API key custody | We never issue it to them | **No** |
| Local model, local RAG, Privacy mode | Their hardware, their data | Yes — by design |
| UI config (model names, themes, layout) | Their copy | Yes |

**Per-request authorisation is the key mechanism.** Because every cloud request passes through our
gateway, entitlements are evaluated live rather than trusted from a cached value on the client. A
tampered client can lie to its own UI; it cannot lie to us.

---

## 3. Server-level config: yes, we can push — and here is the honest limit

**It is not a technical limitation.** The client already polls us every few minutes
(`CLOUDFLARE-ACCESS.md` §5). The heartbeat response can carry a **signed config bundle** the
client applies. This is the standard pull model — Ansible, cloud-init, MDM — and needs no inbound
path, which is why CGNAT is irrelevant.

### The limit is trust, not technology

A pushed config is **cooperative**. A client can ignore it or edit the file it lands in. Pushing
therefore:

- ✅ removes manual intervention for a well-behaved client
- ✅ makes drift *visible* — we can report a client whose applied config differs from the signed one
- ❌ does **not** prevent a hostile client from ignoring it

**This is why enforcement is never delegated to config.** The bundle is a convenience and an audit
surface; the gateway is the enforcement surface. Both paths converge on the same outcome for a
hostile client: no licence token, no cloud service.

### Bundle contents

| Include | Never include |
|---|---|
| Endpoint display names, mode enablement | Provider API keys |
| Feature flags per plan | Ed25519 private key |
| RAG namespace and document limits | Payment or customer records |
| Non-secret limits | Anything that would let a client self-authorise |

The bundle is **signed**. A modified bundle fails verification and is refused, so tampering is
detectable even though it is not preventable.

---

## 4. The support admin account — the operator's position, adopted with a correction

### The decision

**We keep a support administrator on every client instance.** The operator's reasoning is accepted:
the *capability* to read client data is ours under the service contract, and a **client-visible
access log proving we never exercised it** is a stronger trust artefact than a claim of incapacity.

### The correction — a credential is not a legal right

This matters and should not be softened in the contract.

> **Holding valid administrator credentials does not create legal authorisation to use them.**

- **IT Act 2000 s.43** (unauthorised access) read with the **BNS 2023** criminal code: access
  without authorisation is potentially a criminal offence **irrespective of credential validity**.
- **DPDP Act 2023**: we are a Data **Processor** for client data. Processors act *on the
  controller's instructions*. Access without instruction is processing outside our mandate — a
  contractual breach first, and potentially a statutory one.
- **Indian Contract Act 1872**: the service agreement, not the credential, is what confers the right.

**So the right exists only if the client grants it.** That is precisely why the design below is
disclosed and bounded rather than silent.

### Design — not a shared secret

The operator's first suggestion was *same email and password, suffixed `-clientname`*. **That must
not be built**: a derivable suffix over a shared secret is one secret, not N. Discovering it on any
one client compromises every deployment.

**Per-client design:**

| Property | Implementation |
|---|---|
| Username | `satchida-support@<client>.invalid` — `.invalid` is reserved by RFC 2606, so it can never deliver mail or receive a reset |
| Email | Same reserved pattern — **cannot** be used to authenticate via Google OAuth or any mail flow |
| Password | **Unique per client**, 32 bytes from `crypto.randomBytes`, never derived, never reused |
| Role | `ADMIN`, but every access is logged (§4.2) |
| Storage | Held only by us; escrow sealed per client |
| Disclosure | **Named in the service agreement** as a support account, with its purpose and audit rights stated |
| Client visibility | The client can read their own `users` collection and see the account exists — **concealment is not the design** |

### 4.2 Access protocol — mandatory

1. Client raises a ticket and authorises access **in writing**, naming the scope and window
2. We connect (via the Cloudflare mesh, `CLOUDFLARE-ACCESS.md` §5)
3. **Every administrative action is written to an append-only access log** — timestamp, operator
   identity, action, target document id
4. **The log is delivered to the client** at the end of every engagement, whether or not anything
   was accessed
5. No access outside the authorised scope. An empty log is the expected normal state

### 4.3 Revised client-facing wording

`CLIENT-PROPOSAL.md` §4 currently promises *"we do not receive them."* With a support account in
place, the honest wording is stronger because it is verifiable:

> **"Your conversations are stored on hardware you own and operate. We do not access them.**
> Satchida holds a support administrator account on your instance so that we can resolve faults.
> That account is named in this agreement, every use of it is written to an access log, and that
> log is provided to you after each engagement. In normal operation it is never used."

That is defensible, checkable, and does not require the client to take our word for anything.

---

## 5. Cryptographic primitives — verified, no external dependency

Tested on this machine with Node 24 `node:crypto`:

```
Ed25519 supported: true
public key PEM: 113 chars
tampered payload rejected: true
signature: 64 bytes
```

**No npm dependency is required for licence signing.** `crypto.generateKeyPairSync('ed25519')`,
`crypto.sign(null, msg, privateKey)`, `crypto.verify(null, msg, publicKey, sig)`.

### Licence token design

```
payload: client | seats | plan | issued | expires | nonce
signed:  Ed25519, private key held ONLY by us
public:  embedded in the client image (verification key, not a secret)
```

The client verifies locally and offline — which is what allows Privacy mode to work with no
network call at all. But **local verification is for the UI only**; the gateway re-verifies on every
request and is the authority.

---

## 6. What remains genuinely outside our control

Stated so nobody is surprised:

| Not controllable | Why |
|---|---|
| Their `.env` and `librechat.yaml` | Their disk |
| Their LibreChat build | MIT, readable by definition |
| Their MongoDB contents | Their custodian |
| Their hardware and OS | Their asset |
| Physical removal of the device | They own it |
| Deletion of the client sync agent | It can be uninstalled |

**For each, the consequence is the same and acceptable:** no licence token → no cloud inference.
Local model, local RAG and Privacy mode continue, because that is genuinely their data and their
hardware. The product degrades to a private local assistant rather than becoming our service.

---

## 7. Compliance checklist for the control model

- [ ] Service agreement **names the support account**, its purpose, and the client's audit rights
- [ ] Client-visible, append-only **access log**, delivered after every engagement
- [ ] All access **written authorisation** obtained first, with scope and time window
- [ ] Push bundle **contains no secrets** and is **signature-verified** on the client
- [ ] Enforcement code lives **only** in the gateway — never in the shipped bundle
- [ ] `.invalid` email domain used for the support account so no mail or OAuth flow can claim it
- [ ] Per-client password from `crypto.randomBytes`; no derivation, no reuse
- [ ] No access outside the authorised scope, ever

---

*Documented 2026-10-04. Ed25519 primitive verified by execution, not assumption.*