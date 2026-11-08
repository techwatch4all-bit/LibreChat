#!/usr/bin/env node
/**
 * Provision the Privacy seat for the admin node on the `satchida-master` tenant.
 *
 * Operational bootstrap for Option A (local llama.cpp on :8080). Dry-run by
 * default; `--apply` backs up the prior documents first, then writes.
 *
 * Sequence:
 *   1. Raw-read the TenantEntitlement for the tenant. If it is missing or fails
 *      the runtime validator (e.g. over-allocated: per-type seat limits sum to
 *      more than `seatLimit`), it is repaired with a targeted raw upsert that
 *      bypasses the read-validator — `setTenantEntitlement` itself cannot repair
 *      the document it rejects. The repair raises `seatLimit` to at least the sum
 *      of the per-type allocations and guarantees a `privacy` allocation with
 *      `localPrivacyEnabled: true`; existing account types and e2e seat
 *      assignments are preserved.
 *   2. `reserveTenantSeat` atomically assigns the admin's opaque seat alias to
 *      the `privacy` type; the per-type cap is enforced, so the admin can never
 *      exceed the privacy allocation.
 *   3. `updateUser` stamps the admin doc with `accountType: 'privacy'`,
 *      `tenantId`, `satchidaSeatAlias` and an explicit `seatToken: null`.
 *
 * The admin carries NO `seatToken`, so `isTenantCloudMode` is false and the
 * cloud seat-policy path is skipped: Chat / Study / Work for the admin keep
 * using the operator's Bifrost routing unchanged. Only Privacy detaches to the
 * local llama runtime.
 *
 * Usage:
 *   node fleet/scripts/provision-privacy-seat.mjs            # dry-run
 *   node fleet/scripts/provision-privacy-seat.mjs --apply     # write + backup
 */

import mongoose from 'mongoose';
import { createMethods, createModels } from '@librechat/data-schemas';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const TENANT_ID = process.env.SATCHIDA_TENANT_ID || 'satchida-master';
// Opaque seat pseudonym for the admin node. Matches the user schema regex
// ^[A-Za-z0-9_-]{16,128}$. Fixed and auditable.
const SEAT_ALIAS = 'admin_privacy_seat_001';
const ADMIN_USER_ID = (process.env.SATCHIDA_OPERATOR_USER_ID || '').trim();
const APPLY = process.argv.includes('--apply');
const BACKUP_DIR = join(process.cwd(), 'fleet', '.state');

function log(...args) {
  process.stdout.write(`[provision] ${args.join(' ')}\n`);
}

function allocatedSeats(accountTypes) {
  return Object.values(accountTypes || {}).reduce(
    (sum, alloc) => sum + (Number.isSafeInteger(alloc?.seatLimit) ? alloc.seatLimit : 0),
    0,
  );
}

/** Build a valid entitlement document from the raw stored one (repair). */
function buildRepairedDoc(raw) {
  const accountTypes = { ...(raw?.accountTypes || {}) };
  const privacy = accountTypes.privacy
    ? { ...accountTypes.privacy }
    : { seatLimit: 1, allowedModes: [], allowedCapabilities: [], localPrivacyEnabled: true };
  const modes = new Set(privacy.allowedModes.map((m) => String(m).toLowerCase()));
  if (!modes.has('privacy')) privacy.allowedModes = [...(privacy.allowedModes || []), 'Privacy'];
  privacy.localPrivacyEnabled = true;
  accountTypes.privacy = privacy;

  // Repair the over-allocation: seatLimit must be >= the sum of per-type
  // allocations, otherwise the runtime validator rejects the document and every
  // Privacy request fails before reaching the local model.
  const seatLimit = Math.max(
    allocatedSeats(accountTypes),
    Number.isSafeInteger(raw?.seatLimit) ? raw.seatLimit : 0,
  );

  return {
    tenantId: TENANT_ID,
    plan: raw?.plan || 'enterprise',
    status: raw?.status || 'active',
    seatLimit,
    accountTypes,
    startsAt: raw?.startsAt ?? null,
    expiresAt: raw?.expiresAt ?? null,
    updatedBy: ADMIN_USER_ID,
    updatedAt: new Date(),
  };
}

async function main() {
  if (!ADMIN_USER_ID) {
    throw new Error('SATCHIDA_OPERATOR_USER_ID is not set in the environment');
  }
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set; cannot connect to the seed database');
  }

  log(`connecting to ${mongoUri.split('@').pop()}`);
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });
  // Register schemas (idempotent) so createMethods can bind its collections.
  createModels(mongoose);
  const db = createMethods(mongoose);

  if (
    typeof db.setTenantEntitlement !== 'function' ||
    typeof db.reserveTenantSeat !== 'function' ||
    typeof db.updateUser !== 'function'
  ) {
    throw new Error(
      'data-schemas dist is stale: setTenantEntitlement/reserveTenantSeat/updateUser missing; ' +
        'run `npm run build:data-schemas` and retry',
    );
  }

  // --- Read current state (raw read; the stored doc may fail the validator) ---
  const EntitlementModel = mongoose.models.TenantEntitlement;
  const rawEntitlement = await EntitlementModel.findOne({ tenantId: TENANT_ID }).lean();
  const repairedDoc = rawEntitlement ? buildRepairedDoc(rawEntitlement) : buildRepairedDoc(null);
  const wasInvalid =
    rawEntitlement &&
    (allocatedSeats(rawEntitlement.accountTypes) > rawEntitlement.seatLimit ||
      rawEntitlement.seatLimit == null);

  const User = mongoose.models.User;
  const existingUser = await User.findById(ADMIN_USER_ID)
    .select('+satchidaSeatAlias +accountType +tenantId +seatToken +privacyAssertion')
    .lean();
  if (!existingUser) {
    throw new Error(`admin user not found by SATCHIDA_OPERATOR_USER_ID=${ADMIN_USER_ID}`);
  }

  const seatAlreadyReserved = Boolean(rawEntitlement?.seatAssignments?.[SEAT_ALIAS]);

  const USER_STAMP = {
    tenantId: TENANT_ID,
    satchidaSeatAlias: SEAT_ALIAS,
    accountType: 'privacy',
    // Explicit null: Privacy is local only, so the cloud seat path must stay off
    // for the admin. `seatToken: null` is what `initialize.ts` reads to keep
    // `isTenantCloudMode` false.
    seatToken: null,
    privacyAssertion: null,
  };

  if (!APPLY) {
    log('DRY RUN — no writes. Pass --apply to execute.');
    const preview = {
      tenantId: TENANT_ID,
      seatAlias: SEAT_ALIAS,
      adminEmail: existingUser.email,
      rawEntitlement: rawEntitlement
        ? {
            seatLimit: rawEntitlement.seatLimit,
            allocatedSeats: allocatedSeats(rawEntitlement.accountTypes),
            seatLimitValid: allocatedSeats(rawEntitlement.accountTypes) <= rawEntitlement.seatLimit,
            seatAssignments: rawEntitlement.seatAssignments,
          }
        : null,
      entitlementRepair: wasInvalid
        ? {
            reason: 'over-allocated or invalid; raising seatLimit to cover allocations',
            repairedDoc,
          }
        : { reason: 'no repair needed', seatLimit: repairedDoc.seatLimit },
      seatReservation: { op: 'reserveTenantSeat', accountType: 'privacy', seatAlias: SEAT_ALIAS },
      alreadyReserved: seatAlreadyReserved,
      userStamp: {
        op: 'updateUser (partial $set)',
        userId: ADMIN_USER_ID,
        payload: USER_STAMP,
        current: {
          tenantId: existingUser.tenantId ?? null,
          satchidaSeatAlias: existingUser.satchidaSeatAlias ?? null,
          accountType: existingUser.accountType ?? null,
          seatToken: existingUser.seatToken === undefined ? null : '<set>',
        },
      },
    };
    process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
    await mongoose.disconnect();
    return;
  }

  // --- Backup before any write ---
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `privacy-seat-backup-${stamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        tenantId: TENANT_ID,
        seatAlias: SEAT_ALIAS,
        adminUserId: ADMIN_USER_ID,
        entitlement: rawEntitlement ?? null,
        user: {
          _id: existingUser._id,
          email: existingUser.email,
          tenantId: existingUser.tenantId ?? null,
          satchidaSeatAlias: existingUser.satchidaSeatAlias ?? null,
          accountType: existingUser.accountType ?? null,
          seatToken: existingUser.seatToken === undefined ? null : '<set>',
        },
      },
      null,
      2,
    ),
  );
  log(`backup written -> ${backupPath}`);

  // 1. Entitlement repair or create (raw upsert bypasses the read-validator that
  //    cannot load an invalid document). After this the document is valid, so the
  //    validated methods below succeed.
  const collection = EntitlementModel.collection;
  const { modified, upserted } =
    wasInvalid || !rawEntitlement
      ? await collection.updateOne({ tenantId: TENANT_ID }, { $set: repairedDoc }, { upsert: true })
      : { modified: 0, upserted: 0 };
  let repairAction = 'unchanged';
  if (upserted) {
    repairAction = 'created';
  } else if (wasInvalid) {
    repairAction = 'repaired';
  }
  log(
    `entitlement ${repairAction} (matched=${modified === 0 && !upserted ? 'pre-existing-unchanged' : modified}, seatLimit=${repairedDoc.seatLimit})`,
  );

  // 2. Reserve the admin's seat against the privacy allocation (cap-enforced).
  const reservation = await db.reserveTenantSeat(TENANT_ID, SEAT_ALIAS, 'privacy');
  if (!reservation.ok) {
    throw new Error(`reserveTenantSeat failed: ${reservation.code}`);
  }
  log(`seat reserved: ${SEAT_ALIAS} -> privacy`);

  // 3. Stamp the admin user doc. updateUser does a partial $set and invalidates
  //    the auth user doc cache for the affected user.
  const updated = await db.updateUser(ADMIN_USER_ID, USER_STAMP);
  if (!updated) {
    throw new Error('updateUser returned null; admin stamp failed');
  }
  log(
    `admin stamped: accountType=${updated.accountType} tenantId=${updated.tenantId} ` +
      `satchidaSeatAlias=${updated.satchidaSeatAlias}`,
  );

  log('APPLY complete. Restart the LibreChat PM2 process so the stamped fields flow to req.user.');
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('[provision][FATAL]', error?.message ?? error);
  process.exit(1);
});
