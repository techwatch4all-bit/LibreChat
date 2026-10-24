---
name: tenant-provisioning
description: Use when provisioning, licensing, suspending or renewing a Satchida client tenant — covers the Ed25519 licence payload, the ACTIVE/EXPIRED/BLOCKED/SUSPENDED state machine, and the six-hour heartbeat contract.
when-to-use: Trigger on tenant, licence, subscription, seat cap, token credits, heartbeat, node_blocked, control.satchida.com, or setting up a school or SME deployment.
allowed-tools:
  - fetch_webpage
user-invocable: true
always-apply: false
---

# Tenant Provisioning

Each client runs a **standalone edge node with its own native MongoDB**. Tenants are never
commingled into a shared database. Tenant isolation is physical, not a query filter.

## Licence contents

A licence is a signed **Ed25519 JWT**. It carries:

```
clientId, plan, allowed_seats, family_enabled, max_minor_profiles,
image_gen_adults_enabled, image_gen_minors_default,
token_credits_monthly, image_credits_monthly, features[]
```

A node verifies the signature offline. The node's `node_state.json` is a **delivered copy of
policy, not authoritative entitlement** — the operator's record at HQ is what counts.

## State machine

```
ACTIVE  → EXPIRED    licence boundary reached
ACTIVE  → BLOCKED    licence expired AND 48h no heartbeat — cannot reach BLOCKED without first EXPIRED
EXPIRED → ACTIVE     operator issues a new licence
BLOCKED → ACTIVE     operator issues a new licence AND manually clears the block flag
```

The ordering constraint matters: **a node cannot become BLOCKED while its licence is still
valid.** That is deliberate — a network outage at a school must not cut the school's service while
they are still paying.

## Heartbeat contract

Client nodes poll `https://control.satchida.com/api/v1/fleet/heartbeat` every 6 hours, signed with
HMAC-SHA256 over `clientId + timestamp + nonce`. The response carries licence validity, plan
package, policy flags and commands.

The control service rejects: bad HMAC, stale timestamp, replayed nonce, unknown or suspended node,
oversized body, and tenant mismatch. Signature comparison is constant-time.

## Enforcement responses

| Condition | Response |
|---|---|
| Licence expired | `402 { code: "licence_expired" }` on every inference request |
| Expired + 48h no heartbeat | `403 { code: "node_blocked_no_heartbeat" }` |
| Heartbeat missed, licence valid | **warning only — node keeps working** |
| Seats over cap | `402 seat_cap_exceeded` |

There is **no grace period on licence expiry**. That is a contract term.

## Provisioning checklist

1. Create the tenant record with a pseudonymous ID, display label and subdomain. Never put a
   conversation, a customer document, or personal data in the control store.
2. Issue the licence with the plan, seats and monthly allowances.
3. Provision the client's local admin account. Disclose it, give it a `.invalid` email address
   (RFC 2606 — provably no mailbox, provably not an OAuth identity), and a unique random password
   the client can revoke.
4. Push the policy through the next heartbeat. Confirm the node actually applied it before
   claiming success.
5. Record the operator identity, action, target and source IP in the audit trail.

## Hard constraints

- **Never place a real provider key on a client machine.** Client config points at the local
  AutoRouter; master keys are injected in-flight at HQ.
- **Never print, echo or log a key.** Name the variable and redact the value.
- **Social login authenticates, it never authorises.** `ALLOW_SOCIAL_REGISTRATION=false` is the
  gate — an identity may sign in to an existing account and can never create one.
- **No Docker on Windows client nodes**, no paid VPN/VPS/Headscale/DERP. Cloudflare Named Tunnels
  only, outbound HTTPS/QUIC, bypassing CGNAT.