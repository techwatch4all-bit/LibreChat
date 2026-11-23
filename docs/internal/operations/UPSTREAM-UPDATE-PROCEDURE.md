# Upstream Update Procedure — Satchida LibreChat fork

**Read this before running `git pull`, `git merge`, `git rebase`, or `git reset` against
`upstream`.**

Adapted from the SCode fork's `docs/UPSTREAM-UPDATE-PROCEDURE.md`, which was written after a
naive update silently reverted that project's rebrand. The same failure mode applies here.

Upstream is `LibreChat-AI/LibreChat`. Most of our work is **edits to upstream-tracked files**,
not new files, so git has no idea which hunks are ours.

---

## 1. Repository layout

```
upstream  →  https://github.com/LibreChat-AI/LibreChat.git     (read-only in practice)
origin    →  your GitHub fork
```

| Branch | Purpose |
|---|---|
| `upstream/main` | Pristine upstream. Never commit to it. |
| `satchida` | **All product work lands here.** Never force-push. |
| `main` | Deployable release branch, cut from `satchida`. |

`satchida` is the integration branch. Upstream updates are rebased onto it deliberately, so a
bad merge is never live until you cut a release. Upstream's own `AGENTS.md` says branch from
`dev` and target `dev`; we track `main` because that is the branch default and the one our
clone starts from.

---

## 2. Why a plain pull is dangerous

| Our change | Lives in | Git's view |
|---|---|---|
| Remove `admin-panel` service | `docker-compose.yml`, `deploy-compose.yml` | ordinary upstream content |
| `balance.enabled` turn-on | `librechat.example.yaml` | ordinary upstream content |
| Brand asset replacement | `client/public/assets/*`, `package.json` | ordinary upstream content |
| Plan/subscription/payment schemas | new files under `packages/data-schemas/src/schema/` | *would survive* |
| Billing and admin modules | new files under `packages/api/src/` | *would survive* |
| Operator console | new files under `client/src/components/Admin/console/` | *would survive* |
| `ARCHITECTURE.md`, `PRICING.md`, etc. | new files | *would survive* |
| Satchida sections in `AGENTS.md`, `CONTEXT.md` | appends to tracked files | ordinary upstream content |

Anything in the "ordinary upstream content" rows can be reverted by a merge, silently or as a
conflict. That is the entire risk surface.

---

## 3. Mandatory pre-update ritual

Not optional, in this order:

```bash
# 1. Back up FIRST — patches of tracked changes + untracked files + manifest
pwsh -File scripts/backup-satchida-librechat.ps1 -Label "pre-upstream-$(git rev-parse --short HEAD)"

# 2. Record exactly where we are
git rev-parse HEAD > /tmp/satchida-base.txt
git status --porcelain

# 3. Fetch and see what is coming
git fetch upstream
git log --oneline satchida..upstream/main
```

The backup script must produce (mirroring the SCode layout so tooling is familiar):

```
backups/<label>/
  tracked.patch      git diff of all tracked modifications
  files/             untracked new files
  brand/             generated assets + the master logo
  MANIFEST.sha256    hashes for verification
```

---

## 4. Find the conflict surface before merging

This is the step people skip, and it is the one that catches silent reverts.

```bash
# Files we changed
git diff --name-only upstream/main...satchida > /tmp/ours.txt

# Files upstream changed
git diff --name-only satchida...upstream/main > /tmp/incoming.txt

# OVERLAP — every file both sides touched. This is what can break.
comm -12 <(sort /tmp/ours.txt) <(sort /tmp/incoming.txt)
```

Review the overlap list before merging. Anything on it needs a deliberate decision, not a
default merge.

Then:

```bash
git checkout satchida
git rebase upstream/main     # or merge, your call — rebase keeps history linear
```

Never `git reset --hard`, never `git checkout -- .`, never `git clean -fd`, never discard
uncommitted work.

---

## 5. Post-update verification — all of it

```bash
npm install
npm run build:data-provider        # from the repo root
```

Then `npx tsc --noEmit` in **every** workspace you touched. A green build is not a typecheck:
`packages/api`, `packages/client`, and `packages/data-schemas` build with `tsdown`, which
emits without checking types.

Then confirm each item. Do not treat a partial pass as a pass.

| Check | Command | Expected |
|---|---|---|
| admin-panel still removed | `grep -c admin-panel docker-compose.yml` | `0` |
| Upstream did not re-add it | `git diff upstream/main -- docker-compose.yml` | shows our removal intact |
| Balance config intact | `grep -n "enabled" librechat.example.yaml` | balance block present |
| Brand assets present | `ls client/public/assets/` | Satchida logo + favicons |
| Corner alpha transparent | see below | `cornerA=0` on every asset |
| Our schemas survived | `ls packages/data-schemas/src/schema/plan.ts` | exists |
| Our API modules survived | `ls packages/api/src/billing/` | exists |
| Satchida doc sections intact | `grep -c "Satchida AI Harness" AGENTS.md` | ≥ 1 |
| Typecheck | `npx tsc --noEmit` per workspace | clean |
| Static checks | `npm run static-checks -- --against upstream/main` | clean |

### Brand asset alpha verification

From `BRAND-ASSETS.md` §5 — mandatory after any update that touches assets:

```powershell
Add-Type -AssemblyName System.Drawing
foreach ($f in @("client\public\assets\logo.png","client\public\assets\favicon-32x32.png")) {
  $b = New-Object System.Drawing.Bitmap((Join-Path $PWD $f))
  "{0}  cornerA={1}  midA={2}" -f $f, $b.GetPixel(1,1).A, $b.GetPixel([int]($b.Width/2),[int]($b.Height/2)).A
  $b.Dispose()
}
```

Expected: `cornerA=0` and `midA > 100` on **every** asset. A non-zero corner means the opaque
white plate has returned — the exact defect documented in `BRAND-ASSETS.md` §2.

---

## 6. High-risk upstream files

A diff in any of these means something may have silently reverted.

| File | Risk |
|---|---|
| `docker-compose.yml`, `deploy-compose.yml` | Upstream re-adds the AGPL `admin-panel` service |
| `librechat.example.yaml` | Balance/plan config blocks conflict or reset |
| `packages/data-provider/src/config.ts` | New `configSchema` keys may collide with `payments.*`, `billing.*` |
| `packages/data-provider/src/permissions.ts` | New `PermissionTypes` may need mapping into our tiers |
| `packages/data-schemas/src/schema/user.ts` | New user fields; our `googleId` reliance |
| `packages/data-schemas/src/schema/balance.ts` | Credit semantics we redefined as ₹0.01 blended cost |
| `packages/api/src/middleware/checkBalance.ts` | Quota enforcement path |
| `packages/api/src/admin/*` | The operator API our console is built on |
| `client/public/assets/` | Brand assets |
| `package.json` | Name/branding |
| `AGENTS.md`, `CONTEXT.md` | Our appended Satchida sections conflict |

---

## 7. Files that must never be reverted

| File | Why |
|---|---|
| `LICENSE` | MIT. Removing or editing the copyright notice is a licence violation. |
| `ARCHITECTURE.md`, `PRICING.md`, `Implementation-plan.md` | Product design record |
| `Customizations.md`, `Changes.md`, `Bugs.md` | Divergence audit trail |
| `UPSTREAM-UPDATE-PROCEDURE.md`, `BRAND-ASSETS.md` | This procedure and the asset rules |
| Satchida sections of `AGENTS.md` / `CONTEXT.md` | Agent and domain contract |

If any appear in an incoming diff, **stop and reconcile by hand**.

Add a `SATCHIDA-NOTICE.md` modelled on the SCode fork's, adapted for MIT: LibreChat is MIT, so
the obligation is retaining the copyright and licence notice in redistribution. Apache-2.0 §4
as used by SCode does not apply here. State the trademark position explicitly — "LibreChat"
and its marks are not granted by the MIT licence.

---

## 8. For an AI agent

You are updating a rebranded, plan-gated fork. Before touching anything:

1. Run the backup script with `-Label "pre-agent-update"`. Non-negotiable.
2. Never `git reset --hard`, `git checkout -- .`, `git clean -fd`, or discard uncommitted work.
3. Never take the upstream side of a conflict in a file listed in §6 or §7 without saying why
   in `Changes.md`.
4. After the update, run **all** of §5. A partial verification is not a verification.
5. Record anything you could not re-apply in `Bugs.md`; record any upstream change you
   deliberately did not adopt in `Customizations.md`.

---

## 9. Recovery

```bash
ls -1t D:/LAN-AI-Infra/Satchida/backups | head
```

Restore by applying `tracked.patch` and copying `files/` back, then verify against
`MANIFEST.sha256`. The manifest exists so a partial restore is detectable — a restore that
silently drops half the assets is worse than one that fails loudly.

---

# Appendix — Upstream LibreChat Upgrade Notes

> *Consolidated from UPGRADING.md to eliminate duplicate documentation.*

# Upgrading LibreChat

## Redis streaming now coalesces deltas by default

Redis-backed streams now batch model and tool-argument deltas in a **25 ms**
window when `STREAM_DELTA_COALESCE_MS` is unset. Explicit `0` keeps per-delta
publication; existing explicit values retain their behavior. In-memory streams
are unchanged, including deployments using `USE_REDIS_STREAMS=false`.

The same window batches durable appends and publications. It reduces Redis
round trips and repeated guard/TTL work, but not Pub/Sub message count at the cost of up to one window of buffering latency and possible loss
of unflushed deltas on process crash. Terminal and non-coalescable barriers still
flush pending batches before proceeding.

Coalescing batches Redis requests, not the subscriber wire format: each event
still publishes as an individually sequenced `chunk` frame. Subscribers from
before batch-frame support can read these publications without a preparatory
configuration change. New subscribers also retain `chunk_batch` decoding for
interoperation with existing opt-in batching producers.

This removes the new default's batch-frame compatibility hazard; it does not
promise compatibility across unrelated generation-protocol changes. If an
existing producer already emits `chunk_batch` frames through explicit opt-in,
keep those producers away from subscribers that predate batch-frame support,
or disable coalescing on those producers before introducing older subscribers.

## Tenant index migration (v0.8.7 and earlier databases)

Upgrading an existing database can log `Index build failed` for User, Role,
Preset, AccessRole, MCPServer, AgentCategory, Message, or Conversation. Older
unique indexes (for example `email_1` or `name_1`) conflict with current non-unique
indexes of the same name. Tenant-scoped compound indexes now enforce uniqueness.
This also affects single-tenant deployments. See #15759 (successor to #14826).

The tenant-index migration is an explicit maintenance command; startup does not
run it automatically. Use the updated code/image containing this command. For a
source checkout, install dependencies and build the packages first (`npm run
build:packages`).

1. Back up MongoDB and stop all LibreChat API replicas and workers that write to
   the database. Keep MongoDB available throughout the migration.
2. Preview known legacy unique indexes using the deployment's `MONGO_URI` and
   connection settings from `.env`:

   ```sh
   npm run migrate:tenant-indexes:dry-run
   ```

3. Apply the migration:

   ```sh
   npm run migrate:tenant-indexes
   ```

   With Docker Compose, stop the API and run a one-off container from the updated
   image while MongoDB remains running. Use the same Compose file flags as your
   deployment (for example, `docker compose -f deploy-compose.yml`). Set the
   working directory to `/app`, where the root npm scripts live; the production
   API image otherwise defaults to `/app/api`:

   ```sh
   docker compose stop api
   docker compose run --rm --no-deps -w /app api npm run migrate:tenant-indexes:dry-run
   docker compose run --rm --no-deps -w /app api npm run migrate:tenant-indexes
   docker compose up -d api
   ```

4. Restart writers only after the command exits successfully (status 0). Verify
   that startup no longer reports these index conflicts.

The command first builds tenant-scoped unique indexes, then drops only known
superseded unique indexes, and explicitly creates current schema indexes for the
affected collections. It preserves custom indexes and current non-unique indexes;
it does not delete documents or use `syncIndexes`/`dropIndexes`. Automatic index
creation is disabled in the maintenance process to prevent races, even when the
server normally enables it. Current indexes are explicitly built even if the
server uses `MONGO_AUTO_INDEX=false`.

The dry run only lists removals: it does not validate replacement builds, database
permissions, or duplicate data. Any listing, dropping, or building error makes
the apply command fail. If replacement creation fails (for example due to
existing duplicates or unsupported database index options), no old constraints
have been dropped. Keep writers stopped, correct the reported problem, and rerun.
A later failure can leave a partial migration; rerunning safely completes it.
Index builds may take time on large collections. Do not drop all indexes to
resolve a failure.
