# Satchida Security Policy & Credential Hardening

## Overview
This document specifies the security policies, architectural invariants, and defense-in-depth measures implemented across the Satchida distributed multi-tenant platform (LibreChat and Satchida Gateway / one-api).

---

## 1. Core Security Policies & Non-Negotiable Rules

- [x] **No Automated / Scripted Password Mutations**
  - AI agents, automation scripts, and background subagents are strictly prohibited from changing, resetting, or overriding user credentials (especially `admin@satchida.com`) without explicit, interactive operator approval.
  - Ad-hoc scripts (e.g. `set_admin_pwd.js`, `reset-admin-pwd.js`) in `scripts/` or `satchida/ops/` are forbidden and have been purged from the repository.
  - Codified in `AGENTS.md` §8.

- [x] **Zero Plaintext Credentials on Tenant Edge Nodes**
  - Master API keys (OpenAI, Anthropic, Gemini, DeepSeek) must NEVER exist on tenant edge machines.
  - All outbound requests route through Satchida Gateway (`gateway.satchida.com` on port 4000) where keys are injected in-flight over Cloudflare Zero Trust Named Tunnels.

- [x] **Retired Endpoints & Gateway Consolidation**
  - Port `8443` (legacy standalone control-plane script) is retired.
  - All fleet management, telemetry, and security token handshakes must route through Satchida Gateway (`gateway.satchida.com:4000`). Logged in `todo.md`.

---

## 2. Credential Hardening Implementation Checklist

- [x] **Phase 1: In-Memory Volatile Fleet Pepper / Key Management**
  - [x] Implemented `packages/api/src/auth/fleetPepper.ts` to manage the Master Security Key.
  - [x] Handshake retrieval & edge deterministic derivation configured.
  - [x] Stored strictly in process volatile memory (`globalThis.__satchidaFleetPepper`) — NEVER persisted to disk or database.

- [x] **Phase 2: Cryptographic Password Envelope & DB Signature Integrity Gate**
  - [x] In `packages/api/src/auth/password.ts`, wrapped password validation with `calculatePasswordSignature` and `verifyPasswordSignature`.
  - [x] Mandatory signature validation (`passwordSig`): Every local user in MongoDB holds a cryptographic HMAC-SHA256 signature calculated from the stored hash and the in-memory Master Security Pepper.
  - [x] Result: If an AI, script, or local attacker directly modifies `user.password` in MongoDB, the signature check fails and the login attempt is instantly rejected (`404 Incorrect password`).

- [x] **Phase 3: Schema Hardening & Secure Mutation Handlers**
  - [x] Updated `packages/data-schemas/src/schema/user.ts` to include `passwordSig` with `select: false`.
  - [x] Hardened `api/strategies/localStrategy.js` to select `+password +passwordSig`.
  - [x] Updated administrative password reset/creation handlers in `packages/api/src/admin/users.ts` to automatically compute and attach valid HMAC signatures.

- [x] **Phase 4: Stale Session Termination on Password Update**
  - [x] Legitimate password resets via Admin API immediately trigger `deleteAllUserSessions(userId)` and revoke all issued JWT refresh tokens.

- [x] **Phase 5: Automated Verification & Tamper Resistance Tests**
  - [x] Tested legitimate operator login with `Admin@123456`: returned HTTP 200 with 2FA TOTP prompt.
  - [x] Simulated direct MongoDB tampering: injected raw bcrypt hash directly into `admin@satchida.com` record. LibreChat successfully detected the missing/mismatched signature and rejected the attacker login attempt.

---

## 3. Account Reference (Operator Vault)

### 3.1 LibreChat Master Admin
- **Account**: `admin@satchida.com`
- **Role**: `ADMIN`
- **2FA / TOTP**: Enabled (Authenticator App required for admin panel step-up)
- **Active Password**: `Admin@123456`
  *(Note: Keep this stored safely in your personal password manager)*

### 3.2 Satchida Gateway / One-API Master Root
- **Account**: `root`
- **Role**: `Root User` (Superadmin on `gateway.satchida.com:4000`)
- **Security Invariant**: **Mandatory Root Passphrase Authorization**
  - Any password change or credential update for the `root` account requires entering the dedicated **Root Authorization Passphrase**.
  - Without the valid passphrase, the gateway rejects the request with `403 Forbidden` (`Authorization failed: Valid Root Authorization Passphrase is required to change root password`).
  - Configuration & Recovery: Managed in the Gateway UI under **Settings $\to$ Security Vault**, backed by 3 pre-configured security questions for out-of-band human recovery.
  - Codified in `one-api/AGENTS.md` §1 and enforced in `controller/user.go` & `controller/root_passphrase.go`.

---

## 4. The Architecture: High-Entropy Sovereign Operator Passphrase Seal

### 4.1 Threat Model: Preventing AI Self-Authorization & Policy Tampering
Code-level checks (e.g. `if (role === 'ADMIN')`) alone cannot protect a system from an AI agent or automated script that has write access to the filesystem. Without an out-of-band cryptographic physical barrier, an AI could rewrite code files, delete validation logic, and restart services to grant itself or a malicious user elevated privileges.

### 4.2 Time-Bounded HMAC-SHA256 Challenge-Response Protocol
To guarantee that **no AI agent can self-authorize or forge administrative mutations**, all critical operations require a time-bounded cryptographic token derived from a high-entropy human-only passphrase:

1. **The Secret Sovereign Passphrase**:
   - High-entropy, human-held passphrase (64+ bits of true entropy).
   - **Zero-Disk Invariant**: The plaintext passphrase is NEVER written to git, NEVER stored in plain configuration files (`.env`, `.json`, `.yaml`), and NEVER exposed in code.
   - On the node, only a one-way salt-hashed verification digest (`scrypt` / `argon2id`) is accessible to the validation kernel.

2. **Time-Bounded Challenge-Response Token**:
   - Sensitive endpoints require the header:
     ```http
     X-Satchida-Security-Token: <timestamp>:<nonce>:<HMAC_SHA256(timestamp + ":" + nonce + ":" + tenantId + ":" + action, passphrase)>
     ```
   - **Anti-Replay**: Each token contains a monotonic millisecond timestamp and a cryptographically random nonce. The token window is valid for at most **60 seconds**.
   - Nonces are consumed atomically and tracked in memory to permanently prevent replay attacks.
   - **Tenant Binding**: The HMAC signature explicitly binds `tenantId`. A token generated for `dps-rkpuram` can never be reused on `apollo-clinic` or `satchida-master`.

3. **Protected Invariants (Passphrase Seal Required)**:
   - Creation of any new Group (`POST /api/admin/groups`).
   - Deletion of any Group (`DELETE /api/admin/groups/:id`).
   - Group name permanently bans reserved keywords (`admin`, `administrator`, `root`, `superadmin`, `operator`, `system`).
   - Modifying security policies or dead-man lease parameters.

---

## 6. One-API Operator Master Security Vault & Remote Tenant Governance

### 6.1 Non-Technical Operator Model: Centralized Governance in One-API
To eliminate manual CLI execution and prevent human error, all master cryptographic operations are managed through the **One-API Operator Central Web UI** (`control.satchida.com` / `gateway.satchida.com`):
1. **Master Security Key Generation & Vault**:
   - Built directly inside One-API under **Settings $\to$ Security Vault**.
   - With 1-click (**Generate Master Key**), One-API generates a 256-bit Ed25519 asymmetric cryptographic keypair.
   - **Storage Vault**: The private key is encrypted at rest using AES-256-GCM and stored strictly in One-API's database (`one-api.db`). It is **never** exported, never placed in git, and never sent to tenant nodes.
   - **Public Key**: Displayed in the One-API UI for operator reference and embedded in the tenant build (`SATCHIDA_MASTER_PUBLIC_KEY`).
2. **Master Key Rotation (1-Click)**:
   - Clicking **Rotate Master Key** in One-API creates a new keypair, archives the predecessor for a 14-day transition window, and signs new lease tokens for active tenants.

### 6.2 Remote Tenant Lock / Unlock & Licensing Push Pipeline
1. **Tenant Contract Monitoring**:
   - In One-API, each tenant record tracks:
     `contract_end_date`, `grace_period_days` (default 7 days), and `status` (`active` | `locked`).
2. **Lockout Trigger (Contract Expiry)**:
   - If a tenant's contract + grace period expires, One-API marks the tenant as `LOCKED`.
   - On the tenant node:
     - All LibreChat endpoints return `HTTP 402 Payment Required`.
     - The UI renders an un-dismissible **Subscription Expired** screen.
     - Local MongoDB write operations and local GPU inference are blocked.
3. **1-Click Remote Unlock from One-API**:
   - In One-API under **Tenants $\to$ [Select Tenant]**, clicking **Renew / Unlock**:
     1. One-API uses its internal Master Private Key to sign an **Unlock & Lease Extension Directive** bound strictly to that `tenantId`.
     2. The signed token is pushed down the Cloudflare Tunnel to `https://<tenant>.satchida.com/api/admin/license/update` (or retrieved by the tenant's periodic 15-second heartbeat).
     3. Tenant LibreChat verifies the Ed25519 signature against `SATCHIDA_MASTER_PUBLIC_KEY`.
     4. Upon verification, LibreChat automatically updates `satchida.lic`, resets the monotonic clock ledger, and restores full access to LibreChat and MongoDB immediately.
   - **Zero Master Password Transmission**: The human operator never types or exposes the master password on the tenant's PC. Everything is signed at HQ and verified by public key.

