---
name: satchida-mode-routing
description: Use when configuring, debugging or explaining Satchida model routing — the Chat/Work/Study/Privacy mode contract, the AutoRouter registry, licence and seat enforcement on the gateway, and why real provider names never reach the browser.
when-to-use: Trigger on AutoRouter, registry.json, mode routing, gateway enforcement, seat cap, licence validation, node_state.json, :4000 router, or questions about which model serves a mode.
allowed-tools:
  - fetch_webpage
user-invocable: true
always-apply: false
---

# Satchida Mode Routing

Users see four generic modes. Real provider and model names never leave the router.

## The mode contract

| Mode | Tier order | Data leaves device |
|---|---|---|
| **Chat** | free → paid → local | yes |
| **Work** | pinned → free → paid → local | yes |
| **Study** | pinned → free → paid → local | yes |
| **Privacy** | **local only** | **no** |

`Privacy` is local-only by design, not by configuration preference. It routes to the client's own
llama.cpp process on `:8080`. A request for Privacy with no eligible local route must **fail**; it
must never silently fall back to a cloud provider. This is a privacy guarantee, and a silent
fallback would break a promise made to the customer in writing.

## Where the routing config lives

| File | Role |
|---|---|
| `satchida/router/registry.json` | Providers, models, tier order, pins, limits, mode prompts |
| `fleet/src/gateway.mjs` | Inference front door on `:4000`; licence, seat, balance enforcement |
| `fleet/src/licence.mjs` | Ed25519 licence issue and verify |
| `fleet/src/keystore.mjs` | Sealed key vault |
| `librechat.yaml` | `modelSpecs` — display only; the router decides the actual model |
| `fleet/.state/node_state.json` | Signed policy package written by the sync agent |

**Keys are never in `registry.json`.** It carries `keyEnv` and `keyFrom` references only. Real
provider keys live at HQ only, never on a client machine.

## Provider safety fields

Each provider in the registry carries three fields that are load-bearing:

- `revenueSafe` — whether the provider's terms clearly permit powering paying customers. When
  `false`, that provider serves **internal traffic only**. Several providers are `revenueSafe:false`
  because their terms do not clearly permit commercial use by a third party. Do not flip this to
  `true` to make a demo work — that is serving paying customers on an unverified licence.
- `retention` — `none` | `documented` | `unknown`. `unknown` must never serve a Privacy request.
- `locality` — `local` routes stay on the client machine.

The router's `revenueGate` is `off` and `defaultTraffic` is `internal`. Both are deliberate.

## Debugging order for a failing request

Work down this list; do not guess at a fix.

1. **Is a request arriving at all?** Check the gateway log. No request means LibreChat is not
   reaching `:4000` — check `baseURL` and that the port is live.
2. **`401 no_licence`** — the bearer credential is not resolving. LibreChat sends
   `Authorization: Bearer`. The gateway accepts bearer first, then `x-satchida-licence`, then
   `?licence=`. Confirm the licence resolves from `.env` and that LibreChat was restarted after it
   was added.
3. **`402 seat_cap_exceeded` / `balance_exhausted`** — entitlement, not authentication. The node is
   over its licensed seats or its credit pool.
4. **`403 node_blocked_no_heartbeat`** — licence expired *and* no heartbeat for 48h. Both conditions
   must hold simultaneously. A heartbeat failure during a valid licence is a warning only, never a
   block.
5. **`402 licence_expired`** — hard boundary, no grace period.
6. **`no_route_for_provider`** — a cloud route was requested without a sealed key. Local is the
   default; cloud requires an explicit provider and a sealed key.

## Environment hazards

- **`PORT` is exported in the shell** by the harness profile and it **overrides `.env`**, because
  dotenv does not override an existing `process.env`. Always `unset PORT` before starting the
  backend, or the app listens on the wrong port.
- **The long-running `:4000` process may predate an edit to `gateway.mjs`.** Source passing its
  tests is not evidence that the live process runs that source. Restart deliberately and re-verify.
- **Never start a second llama-server.** `:8080` and `:8091` are the operator's production
  inference, already multi-model on a single GPU. A duplicate process is a VRAM conflict.