#!/usr/bin/env node
/**
 * Provisions the Satchida master tenant on the HQ instance.
 *
 * WHY THIS EXISTS
 * ---------------
 * The agents, conversations, balances, skills and memories endpoints are all
 * tenant-scoped: `reads.ts` returns `permission_denied` when `user.tenantId` is
 * absent. A user with no tenantId therefore sees an empty Agent Marketplace
 * even when agents exist — the symptom that made "no marketplace" look like a
 * missing feature when it was a missing tenant.
 *
 * The HQ server is itself the master tenant ("satchida"): it serves the
 * operator's own household and office staff directly, and it also serves other
 * client tenants from the same instance.
 *
 * Idempotent. Usage:
 *   node scripts/provision-master-tenant.mjs [--dry-run]
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

const DRY_RUN = process.argv.includes('--dry-run');

export const MASTER_TENANT_ID = 'satchida-master';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set. Source .env first.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const admin = await db
    .collection('users')
    .findOne({ email: 'admin@satchida.local' }, { projection: { _id: 1, tenantId: 1, role: 1 } });

  if (!admin) {
    console.error('admin@satchida.local not found. Cannot provision the master tenant.');
    process.exit(1);
  }

  console.log(`admin _id:      ${admin._id}`);
  console.log(`current tenant: ${admin.tenantId ?? '(none)'}`);
  console.log(`target tenant:  ${MASTER_TENANT_ID}`);

  if (admin.tenantId === MASTER_TENANT_ID) {
    console.log('Already provisioned. Ensuring agents carry the tenant.');
  }

  if (DRY_RUN) {
    const agents = await db
      .collection('Agent')
      .find({ id: { $regex: '^agent_satchida_' } })
      .project({ id: 1, tenantId: 1 })
      .toArray();
    console.log(`\nwould set tenantId on ${agents.length} agent(s):`);
    for (const a of agents) {
      console.log(`  ${a.id} (current: ${a.tenantId ?? 'none'})`);
    }
    await mongoose.disconnect();
    return;
  }

  if (admin.tenantId !== MASTER_TENANT_ID) {
    await db.collection('users').updateOne(
      { email: 'admin@satchida.local' },
      { $set: { tenantId: MASTER_TENANT_ID } },
    );
    console.log(`admin tenantId set to ${MASTER_TENANT_ID}`);
  }

  // Agents must carry the same tenantId or the tenant-scoped list returns
  // nothing. Matched on the seeded id prefix so no user-authored agent is
  // touched.
  const result = await db
    .collection('Agent')
    .updateMany(
      { id: { $regex: '^agent_satchida_' }, tenantId: { $ne: MASTER_TENANT_ID } },
      { $set: { tenantId: MASTER_TENANT_ID } },
    );
  console.log(`agents updated: ${result.modifiedCount}`);

  const agents = await db
    .collection('Agent')
    .find({ id: { $regex: '^agent_satchida_' } })
    .project({ id: 1, name: 1, tenantId: 1 })
    .toArray();
  console.log('\nagents in master tenant:');
  for (const a of agents) {
    console.log(`  ${a.name.padEnd(32)} tenant=${a.tenantId}`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});