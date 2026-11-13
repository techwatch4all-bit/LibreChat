# Tenant LibreChat Deployment & Upstream Connectivity Runbook

This document preserves the exact deployment configuration for provisioning a Tenant (Client Edge) PC to connect back to your Central Host (`one-api` / `Bifrost`).

---

## 1. Upstream Connectivity Architecture

- **Central Host (HQ):** Runs `one-api` (:4000) backed by `Bifrost` routing. Bounded by Cloudflare Named Tunnel with Cloudflare Access (Service Auth) + WAF restriction.
- **Tenant PC (Edge Node):** Runs `LibreChat` locally behind symmetric CGNAT (Jio/Airtel).
- **Public Entrypoint:** `https://gateway.satchida.com/v1`

---

## 2. Bifrost Virtual Mode Hierarchy (Zero Hardcoded Model Names)

Tenant LibreChat does **NOT** hardcode upstream model provider names (`gpt-4o`, `claude`, etc.).  
All routing is abstracted through Bifrost's dynamic mode tiering:

- `Chat`
- `Work`
- `Study`
- `Vibecoding`
- `Pro`

Bifrost dynamically resolves the underlying provider model (local Llama fleet, DeepSeek, Claude, or OpenAI) based on the user's role and seat alias (`X-Seat-Alias`, `X-User-Id`).

---

## 3. Exact Tenant `librechat.yaml` Gateway Block

When packaging LibreChat for a tenant PC, replace the local `127.0.0.1:4000` block in `librechat.yaml` with:

```yaml
  - name: Satchida-Gateway
    apiKey: ${SATCHIDA_GATEWAY_VK}
    baseURL: https://gateway.satchida.com/v1
    models:
      default:
      - Chat
      - Work
      - Study
      - Vibecoding
      - Pro
      fetch: false
    titleConvo: true
    titleModel: Chat
    titleMethod: completion
    titlePrompt: 'Invent a short 3-6 word title for this conversation, based ONLY on what the user asked. Reply with the title text only: no quotes, no emojis, no trailing punctuation, no tool names, no explanations.

User message:
{convo}'
    titlePromptTemplate: 'User: {input}'
    summarize: false
    summaryModel: Chat
    forcePrompt: false
    modelDisplayLabel: Satchida AI
    maxToolResultChars: 50000
    headers:
      X-Bifrost-Mode: chat
      X-Seat-Alias: '{{LIBRECHAT_USER_ID}}'
      X-User-Id: '{{LIBRECHAT_USER_ID}}'
      X-User-Name: '{{LIBRECHAT_USER_USERNAME}}'
      CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}
      CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}
    dropParams:
    - user
    addParams:
      stream: true
      chat_template_kwargs:
        enable_thinking: false
```

---

## 4. Tenant Environment Variables (`.env`)

On the tenant PC, provision these environment variables:

```bash
# Cloudflare Service Auth transport credentials (generated in Cloudflare Access)
CF_ACCESS_CLIENT_ID="<your-generated-service-token-client-id>"
CF_ACCESS_CLIENT_SECRET="<your-generated-service-token-secret>"

# Tenant Scoped Virtual Key from central one-api
SATCHIDA_GATEWAY_VK="sk-satchida-tenant-..."
```

---

## 5. Security & Isolation Invariants

1. **Edge Protection:** Cloudflare drops all incoming requests that lack valid `CF-Access-Client-Id` / Secret headers before they ever reach your central machine.
2. **Path Gating:** Cloudflare WAF custom rule blocks all non-`/v1/` routes. The `one-api` admin and management UI is completely invisible and unreachable from the tenant PC or the public internet.
3. **Quota & Rate Enforcement:** Quotas and seat tier allowances are strictly calculated and enforced in-flight at Central HQ by `one-api` and `Bifrost`.
