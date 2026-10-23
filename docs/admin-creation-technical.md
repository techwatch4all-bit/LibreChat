# LibreChat Admin "Users" tab — creation + seat allocation (technical spec)

This is the build spec for the **tenant self-service** UI: a tenant creates user
accounts on LibreChat and assigns each to an account-type group
(`Basic` / `Pro` / `Family` / `Privacy`, and for `Family` an apartment + role).
On assignment, LibreChat mints a one-api seat token (`tk_<seat>`) for that user
within the operator-set `MaxSeats` cap, stores it as `User.seatToken`, and the
request bridge sends it as `Authorization: Bearer <seatToken>`.

## Architecture (already wired)

- **one-api = quota / seat authority.** Operators own tenants, groups, caps
  (`MaxSeats` per group) and virtual-key rotation. A tenant's harness calls
  one-api *only* with its own `vk_<tenant>` bearer, and one-api enforces
  `MaxSeats` on every allocate (hard `409`).
- **LibreChat = identity / membership layer.** `User.seatToken` holds the bound
  `tk_<seat>`. The request bridge already forwards it.
- **Bearer bridge (already applied):**
  - `openai/initialize.ts` — `let apiKey = user?.seatToken ?? (userProvidesKey ? … : credentials[…])`.
  - `custom/initialize.ts` — `const apiKey = user?.seatToken ?? (userProvidesKey || userProvidesURL ? … : CUSTOM_API_KEY)`.
- **Schema (already applied):** `types/user.ts` + `schema/user.ts` +
  `packages/data-schemas/src/schema/user.ts` add `seatToken: string | null`.
  `IUser` already carries `tenantId`, `familyAccountId`, `familyRole`
  (`'owner'|'adult'|'minor'|null`), `familyLimits`, `guardianId`.

> This is **not** "Option C" (uncapped self-provision): the tenant cannot create
> groups, set caps, or rotate keys — it only spends the headroom the operator
> reserved. `seat moves` (e.g. Basic→Pro) remain the deferred Q2 (see §6).

## one-api seat-allocate API (implemented + tested)

The seat seam the tab calls. Implemented in this repo (`one-api`):

```
middleware/tenant_vauth.go      // TenantVirtualKeyAuth
router/api.go                   // POST /PUT mounts on a tenant-vk group
controller/tenant_token_route_test.go  // 401/403/201 + 409 over MaxSeats + reclaim
```

All green: `go build ./...` passes; `go test ./controller/ -run 'TenantVirtualKey|TenantAllocateSeat'` PASS.

### POST /api/tenant/:tenantId/seat  (tenant self-service allocate)
Auth: `Authorization: Bearer vk_<tenant>` (`TenantVirtualKeyAuth`). The URL
`:tenantId` **must equal** the tenant resolved from the vk (else `403`).

Request body (binds to `model.TenantToken`; JSON keys: `group`, `seat_alias`,
`models`, `expired`):

```jsonc
{
  "group": "Family",        // the account-type group name (Basic/Pro/Family/Privacy) or family apartment "family_A19-501"
  "seat_alias": "usr_anon_adult0", // the user's alias/id this seat binds to
  "models": "gpt-4o",       // optional model allow-list (empty => group default)
  "expired": 0              // optional unix seconds (0 = never)
}
```

Responses:
- `201 { success: true, data: { id, key:"tk_<tenant>_<hex>", group, seat_alias, created_at, ... } }` — `data.key` is the seat token; store it as `User.seatToken`.
- `401` — missing/invalid `vk_` bearer.
- `403` — `:tenantId` ≠ bearer's tenant.
- `404` — group not found for that tenant (group is operator-managed; see §5).
- `409 { success:false, message:"group seat cap exceeded" }` — `MaxSeats` for the group is full.

### PUT /api/tenant/:tenantId/seat/:tokenId/disable  (retire a seat on reassign)
Auth: `Authorization: Bearer vk_<tenant>` (same `:tenantId == bearer tenant` rule).

Response:
- `200 { success: true }`
- `401` / `403` as above; `404` if the token doesn't belong to the tenant.

## LibreChat admin "Users" tab — server (build target)

Extend the existing admin API surface and expose a new admin route.

### 1) Add handlers — `packages/api/src/admin/users.ts`

Add to `AdminUsersDeps` and `createAdminUsersHandlers`:

```ts
// deps added to AdminUsersDeps:
assignSeatToUser: (
  tenantId: string,
  group: string,
  seatAlias: string,
) => Promise<{ key: string; id: string }>; // wraps POST /api/tenant/:tenantId/seat

// returned from createAdminUsersHandlers:
return { listUsers, searchUsers, deleteUser, createUser, assignSeat };
```

`createUser` — create a LibreChat user inside the caller's tenant:

```ts
async function createUser(req, res) {
  const callerTenantId = req.tenantId; // set by a tenant-admin guard (see §2)
  const { email, name, accountType, familyAccountId, familyRole } = req.body;
  // validate accountType ∈ {Basic,Pro,Family,Privacy}; Family => apartment+role
  const password = crypto.randomBytes(12).toString('base64'); // temp pw; tenant resets/uses magic link
  const hash = await bcryptjs.hash(password, BCRYPT salt);
  const user = await User.create({
    email, name, username: email, password: hash, provider: 'local',
    tenantId: callerTenantId, role: SystemRoles.USER,
    familyAccountId: familyAccountId || null,
    familyRole: familyRole || null,
    seatToken: null, // assigned below in assignSeat
  });
  return res.status(201).json({ user: sanitizeUser(user), password });
}
```

`assignSeat` — assign a user to a group → mint a seat → store `seatToken`:

```ts
async function assignSeat(req, res) {
  const tenantId = req.tenantId;
  const { userId, group, seatAlias } = req.body;
  // 403 if user.tenantId !== tenantId (cross-tenant guard)
  const seat = await assignSeatToUser(tenantId, group, seatAlias); // calls one-api
  await User.updateOne({ _id: userId }, { $set: { seatToken: seat.key, ...group fields } });
  return res.status(200).json({ seatToken: seat.key });
}
```

`assignSeatToUser` (dep) — HTTP call to one-api (the tenant's `vk_<tenant>` is
held in the tenant config, e.g. `process.env.TENANT_VIRTUAL_KEY` per tenant):

```ts
const assignSeatToUser = async (tenantId, group, seatAlias) => {
  const vk = config.tenants?.[tenantId]?.virtualKey ?? process.env.ONE_API_TENANT_VK;
  const r = await fetch(`${ONE_API_URL}/api/tenant/${tenantId}/seat`, {
    method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${vk}` },
    body: JSON.stringify({ group, seat_alias: seatAlias, models: 'gpt-4o' }),
  });
  if (r.status === 409) throw new SeatCapExceeded();
  if (!r.ok) throw new Error(`one-api allocate failed: ${r.status}`);
  const j = await r.json();
  return { key: j.data.key, id: String(j.data.id) };
};
```

### 2) Tenancy + auth guard for the tenant admin

- Add a middleware that resolves `req.tenantId` from the caller (a tenant admin
  bearer, or a `X-Tenant-Id` header set by the harness edge). It is NOT
  `requireAdmin` (global `role === ADMIN`) — that's the Operator. A tenant admin
  is a LibreChat user whose `role` is e.g. `TENANT_ADMIN` (or whose `tenantId`
  matches) and is scoped to `req.tenantId`.
- Cross-tenant guard: every handler above verifies `user.tenantId ===
  req.tenantId` before mutating.

### 3) Mount the route

The admin handlers are re-exported via `packages/api/src/admin/index.ts` and
re-exported from `packages/api/src/index.ts` (`export * from './admin'`). They
are wired to the Express router in **`packages/api/src/openapi/router.ts`**
(grep that file for `createAdminConfigHandlers(` / `createAdminUsersHandlers(`
to find the admin sub-router), then register the two new endpoints on that same
router, behind the tenant-admin guard:

```
POST   /admin/users              -> createUser
PUT    /admin/users/:id/assign   -> assignSeat   (group + seatAlias)
PUT    /admin/users/:id/disable-seat -> calls one-api PUT /seat/:tokenId/disable
```

### 4) Dependency wiring

`createAdminUsersHandlers` takes a deps bag (`AdminUsersDeps`). Add
`assignSeatToUser` to that deps bag at the call site and pass a `TenantModel`/`UserModel`
reference so `createUser` writes the `tenantId`/`familyAccountId`/`familyRole`/`seatToken`.

## LibreChat admin "Users" tab — client (build target)

> NOTE: packages/client is a **component library** (entry `packages/client/src/index.ts`,
> tsdown build). The LibreChat chat **app** entry/routing lives elsewhere in this
> monorepo — locate it (grep for the Vite/webpack root + route definitions; the app
> uses the MUI component library above). Add the admin page there.

- New route (tenant-admin only): `/admin/users` → "Users" tab.
- Columns: `name | email | accountType (Basic/Pro/Family/Privacy) | familyApartment | familyRole (owner/adult/minor) | seatToken (masked) | status`.
- "Add user" → `POST /admin/users` (createUser) → show temp password once.
- "Assign to group" (dropdown) → `PUT /admin/users/:id/assign` (group + seatAlias) → store `seatToken`. Surface one-api `409` inline as "group cap full — ask the operator to raise MaxSeats for this account type."
- For Family: sub-form for apartment (`family_A19-501`) + role; the `familyAccountId` is a same-tenant sibling user `_id`.
- Reassign across account types (Basic↔Pro) = deferred Q2: `PUT /admin/users/:id/disable-seat` (frees the old seat) + `PUT /admin/users/:id/assign` in the new group.

## OSS product evaluation

| Product | License | Drop-in fit? |
|---|---|---|
| Casbin | Apache-2.0 | No — policy engine only. Already used at one-api (`satchida_enforcer.go`) for authz. |
| CasbinAdmin | Apache-2.0 | No — manages Casbin policies, not account-type seats/groups. |
| Casdoor | Apache-2.0 | No — full IdP; would re-identity LibreChat (violates transport-agnostic / no-3rd-party-idp). |

**Decision:** no OSS product maps this account-type/family/seat model, so build the
slight LibreChat admin tab above and keep Casbin at one-api for authorization.

## Deferred (Q2) — seat moves between account types

The allocate + disable routes are in place. The **Basic→Pro move orchestration**
(disable old seat + allocate new seat in the target group, ideally one atomic op
re-checked against `MaxSeats`) is the deferred Q2. Two options to finalize later:

- (A) Tenant self-service move: LibreChat calls `disable` (old group) then `allocate`
  (new group) — can transiently exceed caps if done in two round-trips; acceptable
  if the operator sets per-account-type headroom.
- (B) Operator-issued move: a single one-api `POST /api/tenant/:id/seat/move` that
  takes `{from_token_id, group}` and atomically disables + mints under one tx.

## Dev test target (sanity check after build)

HGRWA example: tenant creates 3 users → assign `Basic` (3/3 used); 1 → `Pro`
(disable Basic seat, allocate Pro seat); Family: create apartment `family_X`,
assign 2 adult + 2 minor (4 seats, shared `Chat×3` pool). Every allocate over the
group `MaxSeats` returns `409`; the bridge sends `Bearer <user.seatToken>`.
