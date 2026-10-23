/**
 * Create demo accounts (Dchat, Dcode) and a 'Demo' group in LibreChat's MongoDB.
 *
 * Usage:
 *   node scripts/create-demo-accounts.js
 *
 * Creates two local accounts with bcryptjs-hashed passwords,
 * then creates a 'Demo' group containing both users in memberIds.
 * Passwords are printed once to stdout for operator distribution.
 */
const mongoose = require('mongoose');
const { createModels } = require('@librechat/data-schemas');
const connect = require('../config/connect');

const DEMO_ACCOUNTS = [
  {
    email: 'dchat@satchida.local',
    name: 'Dchat Demo',
    username: 'dchat',
    provider: 'local',
  },
  {
    email: 'dcode@satchida.local',
    name: 'Dcode Demo',
    username: 'dcode',
    provider: 'local',
  },
];

const DEMO_GROUP = {
  name: 'Demo',
  description: 'Demo accounts for Chat and Code modes (free/local routing only)',
  source: 'local',
};

function generatePassword() {
  return 'demo' + Math.random().toString(36).slice(-12);
}

(async () => {
  await connect();

  const { User, Group } = createModels(mongoose);
  const createdUsers = [];

  for (const acct of DEMO_ACCOUNTS) {
    const exists = await User.findOne({
      $or: [{ email: acct.email }, { username: acct.username }],
    });
    if (exists) {
      console.orange(`Account already exists: ${acct.email} — skipping.`);
      const full = await User.findOne({ email: acct.email });
      if (full) {
        createdUsers.push({ ...acct, _id: full._id, password: '(existing — not shown)' });
      }
      continue;
    }
    const password = generatePassword();
    const { registerUser } = require('~/server/services/AuthService');
    const result = await registerUser(
      {
        email: acct.email,
        password,
        name: acct.name,
        username: acct.username,
        confirm_password: password,
      },
      {
        emailVerified: true,
        provider: acct.provider,
      },
    );

    if (result.status !== 200) {
      console.red(`Failed to create ${acct.email}: ${result.message}`);
      process.exit(1);
    }

    const userDoc = await User.findOne({ email: acct.email }).lean();
    if (!userDoc) {
      console.red(`Could not retrieve user document for ${acct.email}`);
      process.exit(1);
    }
    createdUsers.push({ ...acct, _id: userDoc._id, password });
    console.green(`Created account: ${acct.email} (username: ${acct.username})`);
  }

  // Build the memberIds from the _id of each created user
  const memberIds = createdUsers.map((u) => String(u._id));

  // Check if the Demo group already exists
  let group = await Group.findOne({ name: DEMO_GROUP.name, source: 'local' });
  if (group) {
    // Merge memberIds (union, no duplicates)
    const merged = [...new Set([...group.memberIds, ...memberIds])];
    group.memberIds = merged;
    group.description = DEMO_GROUP.description;
    await group.save();
    console.orange(
      `Group '${DEMO_GROUP.name}' already exists — updated memberIds to: ${merged.join(', ')}`,
    );
  } else {
    group = new Group({
      ...DEMO_GROUP,
      memberIds,
    });
    await group.save();
    console.green(`Created group '${DEMO_GROUP.name}' with memberIds: ${memberIds.join(', ')}`);
  }

  // Verification
  console.purple('\n=== Verification ===');
  const verifyGroup = await Group.findOne({ name: 'Demo' }).lean();
  console.log(
    'Group:',
    JSON.stringify(
      {
        _id: verifyGroup?._id,
        name: verifyGroup?.name,
        memberIds: verifyGroup?.memberIds,
        source: verifyGroup?.source,
      },
      null,
      2,
    ),
  );

  for (const u of createdUsers) {
    const doc = await User.findOne({ email: u.email }).lean();
    const inGroup = verifyGroup?.memberIds?.includes(String(doc?._id));
    console.log(`User: ${u.email} — _id=${doc?._id}, in Demo group=${inGroup}`);
    if (u.password !== '(existing — not shown)') {
      console.green(`  Password: ${u.password}`);
    }
  }

  mongoose.connection.close();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
