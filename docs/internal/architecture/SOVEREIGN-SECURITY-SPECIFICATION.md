# Sovereign Operator Security Architecture & Multi-Tenant Deployment Specification

**Version**: 1.0  
**Status**: APPROVED ARCHITECTURE  
**Target Subsystems**: LibreChat UI/API, MongoDB Storage Engine, Tenant Edge Node Deployment  
**Scope**: Cryptographic Air-Gap, Host-Level AI Isolation, Cloned Deployment Mechanics

---

## 1. Executive Summary & The Host-Level AI Threat Model

In a distributed edge deployment (e.g. schools, colleges, RWAs, SMEs), LibreChat, AnythingLLM, and MongoDB execute natively on bare-metal Windows 11 hardware without containerization.

When autonomous or developer AI agents (OpenHands, Claude Code, Cursor, Copilot, Antigravity) operate on that machine, **the AI possesses the identical OS user privileges as the running user**. It can read any unencrypted file on disk, launch CLI processes, query localhost ports, and generate arbitrary scripts.

### Core Architectural Invariant:
> **No local security gate may rely on secrets stored in plaintext on the local filesystem.**
> Any secret that exists on disk in `.env`, JSON, or YAML is compromised from the perspective of a local AI agent. Administrative authority must be derived from an **Out-of-Band (OOB) Cryptographic Air-Gap** that the AI cannot forge or guess.

---

## 2. MongoDB Deployment Physics: Can It Be Copied As Files, Or Must It Be Installed?

### 2.1 The Answer:
**MongoDB binaries can be portable/copied, but MongoDB database storage files (`WiredTiger.wt`) must NEVER be blindly copied across running machines, and the Windows Service requires registration.**

### 2.2 Deep-Dive Breakdown:

1. **WiredTiger Engine Lock & Hardware Fingerprints**:
   - MongoDB uses the WiredTiger storage engine (`C:\Program Files\MongoDB\Server\8.3\data` or custom `dbPath`).
   - WiredTiger writes an exclusive lock file (`mongod.lock`) and internal transaction log checkpoints (`journal/WiredTigerLog.*`).
   - If data files are copied while `mongod.exe` is running, the destination database suffers **irrecoverable B-tree block corruption**.
   - Even when cleanly shut down, cloning a pre-populated database to a new tenant PC duplicates:
     - Tenant-specific user IDs (`_id: ObjectId`) and seat tokens.
     - Conversation histories, prompt templates, and audit log chains with conflicting cryptographic sequences (`seq`, `prevHash`).

2. **Windows Service Registration**:
   - MongoDB on Windows runs as a native Win32 service (`MongoDB`, `serviceType: Win32OwnProcess`).
   - Merely copying `C:\Program Files\MongoDB` does **not** register the service in the Windows Service Control Manager (SCM) or configure automatic recovery.
   - The installer sets up registry keys under `HKLM\SYSTEM\CurrentControlSet\Services\MongoDB` and binds NTFS security ACLs to `NT AUTHORITY\SYSTEM`.

### 2.3 Sanctioned Golden Tenant Provisioning Procedure:
Instead of copying raw binary data directories:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 1: Clean Native Installation                                           │
│   winget install --id MongoDB.Server --exact --silent                       │
│   (Automated by scripts/install-tenant-prerequisites.ps1)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 2: Configure Dedicated Tenant mongod.cfg                               │
│   net.bindIp: 127.0.0.1 | net.port: 27017                                   │
│   security.authorization: enabled                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 3: Fresh Seed or Export/Import Baseline via mongodump/mongorestore     │
│   Seed foundational roles (Admin, Basic, Pro, Privacy) and system prompts.  │
│   Zero duplication of user accounts, conversations, or audit sequences.     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 4: Generate Unique Cryptographic Secrets (CSPRNG)                      │
│   Every node receives fresh JWT_SECRET, CREDS_KEY, CREDS_IV, and DB users.  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The Out-of-Band Sovereign Passphrase (Cryptographic Air-Gap)

### 3.1 Problem Statement
If an AI agent can execute Node.js scripts with local DB access or call `/api/admin/*`, it can elevate permissions or wipe 2FA. We need a cryptographic mechanism that **requires human presence** and cannot be bypassed even with full filesystem access.

### 3.2 Asymmetric Challenge-Response Architecture

Rather than storing a shared master password on the tenant machine (which an AI could read from `.env`), the system implements **Asymmetric Ed25519 or HMAC-SHA256 Challenge-Response**:

```
[ Central Sovereign Operator ]                           [ Edge Tenant Node ]
(Operator Phone / Password Mgr)                         (LibreChat + MongoDB)
               │                                                  │
               │  1. Admin clicks "Protected Action" in UI        │
               │     (e.g., Change DB Password, Reset 2FA, Lock)  │
               │                                                  │
               │  2. LibreChat UI displays Challenge Prompt       │
               │     Challenge: <TenantID> + <Nonce> + <Timestamp>│
               │                                                  │
 3. Operator types Challenge into                                 │
    Sovereign Token Generator (PWA/HQ Web)                        │
    Signs with Human Passphrase                                   │
    Generates 6-character Time-Token                              │
               │                                                  │
               │  4. Operator enters Sovereign Token into UI      │
               │                                                  │
               │  5. Verification Kernel verifies signature        │
               │     If valid: Executes action atomically         │
               │     If invalid: Instant lockout & audit alert    │
```

### 3.3 Zero Tenant Duplication Invariant
Because the challenge binds:
$$\text{Signature} = \text{HMAC-SHA256}(\text{TenantID} + ":" + \text{Nonce} + ":" + \text{Action} + ":" + \text{Timestamp}, \text{MasterPassphrase})$$
1. **No Replay**: A token generated for `school-dps-delhi` **will fail** on `hospital-apollo-mumbai`.
2. **Time-Bounded**: Tokens expire in **60 seconds** and the `nonce` is burned into an in-memory cache to prevent replay.
3. **Zero Stored Passphrase**: The tenant PC holds only the verification public key (Ed25519) or a salt-hashed scrypt digest. The plaintext passphrase never touches tenant memory or disk.

---

## 4. LibreChat Security Management UI & API Architecture

To replace fragile CLI scripts, LibreChat's native Admin Panel is extended with dedicated, air-gapped security controls:

### 4.1 Native UI Surfaces (`client/src/components/Admin/Security/`)

1. **Database & Credential Vault (`DatabaseSecurityPanel.tsx`)**:
   - **Live MongoDB Health & Auth Status**: Indicates whether `security.authorization: enabled` is active.
   - **Rotate LibreChat DB Credentials**: 1-click rotation of `librechat_app` password. Automatically updates MongoDB and `.env`, with atomic zero-downtime reconnection.
   - **Rotate Tenant Admin Credentials**: Allows granting/revoking read-only inspection credentials (`tenant_admin_ro`) for client IT.
   - **Air-Gap Seal**: Any mutation requires the Sovereign Passphrase Token.

2. **Account Integrity & Emergency Lockout (`AccountSecurityPanel.tsx`)**:
   - **Account Lock/Unlock**: Toggle `isLocked: true/false` on any user. Immediately revokes active JWTs and terminates all WebSocket sessions.
   - **2FA Management**:
     - Enforce mandatory 2FA on specific user roles (`ADMIN`, `OPERATOR`).
     - Reset 2FA with Sovereign Passphrase approval (dispensing with ad-hoc DB reset scripts).
     - Display unallocated emergency backup codes in a secure, copy-once modal.

3. **Tamper Detection & Audit Sentinel (`SecurityAuditFeed.tsx`)**:
   - Real-time stream of audit logs with cryptographic chain verification (`hash === HMAC(prevHash + action + timestamp)`).
   - Instant visual warning if an out-of-band direct MongoDB write is detected.

### 4.2 Backend API Routes (`packages/api/src/admin/security/`)

| Method | Endpoint | Description | Guard / Protection |
|---|---|---|---|
| `GET` | `/api/admin/security/status` | Reports DB auth, 2FA coverage, and cryptographic health | `requireAdmin` |
| `POST` | `/api/admin/security/challenge` | Generates a single-use monotonic challenge nonce | `requireAdmin` |
| `POST` | `/api/admin/security/mongo/rotate` | Rotates MongoDB app credentials | `requireSovereignToken` |
| `POST` | `/api/admin/security/users/:id/2fa/reset` | Resets 2FA for a user without raw DB scripts | `requireSovereignToken` |
| `POST` | `/api/admin/security/users/:id/lock` | Instantly locks account and invalidates sessions | `requireAdmin` |

---

## 5. Summary: Operational Readiness & Rules for AI Agents

1. **AI Confinement Law**: AI agents operating in the repository must interact with administrative features **exclusively via the authenticated API**. Direct execution of raw database mutation scripts on production databases is classified as a policy violation.
2. **Deterministic Provisioning**: When deploying to new tenant hardware, always run [`scripts/install-tenant-prerequisites.ps1`](scripts/install-tenant-prerequisites.ps1) followed by [`scripts/provision-tenant-node.ps1`](scripts/provision-tenant-node.ps1) with a distinct `TenantVirtualKey`.
3. **No Database File Cloning**: Always provision MongoDB cleanly using native Windows installers and seed fresh tenant databases with unique tenant IDs.


---

## Cloud Drive Workspace Sync — Zero-Storage Browser-Direct Invariant

To uphold the **Zero-Knowledge** and **Zero End-User Credential Storage** guarantees across all tenant edge nodes and Seller Central HQ:

1. **No OAuth Client Secrets Anywhere**: Neither tenant PCs (`.env`) nor Seller Central HQ store `GOOGLE_DRIVE_CLIENT_SECRET` or `ONEDRIVE_CLIENT_SECRET`. Only public, non-secret OAuth App IDs (`GOOGLE_DRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_ID`, optional `ONEDRIVE_TENANT_ID`) are exposed via `GET /api/cloud-drive/status`.
2. **Zero Server-Side Token or Identity Persistence**: Tenant MongoDB databases and operator HQ **never** persist end-user cloud OAuth access tokens, refresh tokens, or Google/Microsoft account identities. No `CloudDriveConnection` collection exists.
3. **Browser-Direct OAuth 2.0 (GIS & PKCE)**:
   - **Google Drive** authenticates directly in the user's browser using Google Identity Services (GIS) Token Client.
   - **Microsoft OneDrive** authenticates directly in the user's browser using OAuth 2.0 Authorization Code Flow with PKCE (`S256`).
4. **In-Memory Session Lifetime Only**: Short-lived access tokens live strictly in browser memory (non-persisted Jotai atom) — never in `localStorage`, `sessionStorage`, cookies, or any backend database. Closing the tab, refreshing, or clicking **Disconnect** immediately destroys the token (and revokes it for Google).
5. **Direct Browser-to-Provider Transfer**: Folder listing, file downloads, and file uploads execute directly between the user's browser and Google Drive / Microsoft Graph APIs. Only the specific file bytes the user explicitly chooses to import/export pass between their browser and their active workspace.
