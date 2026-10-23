/**
 * Set bcryptjs passwords on the demo accounts (Dchat, Dcode).
 * Uses fixed demo passwords for operator convenience.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { createModels } = require('@librechat/data-schemas');
const connect = require('../config/connect');

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (!DEMO_PASSWORD) {
  console.error('DEMO_PASSWORD is required');
  process.exit(1);
}

const DEMO_ACCOUNTS = [
  { email: 'dchat@satchida.local', username: 'dchat', name: 'Dchat', password: DEMO_PASSWORD },
  { email: 'dcode@satchida.local', username: 'dcode', name: 'Dcode', password: DEMO_PASSWORD },
];

(async () => {
  await connect();
  const { User, Group } = createModels(mongoose);

  for (const acct of DEMO_ACCOUNTS) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(acct.password, salt);

    await User.updateOne(
      { email: acct.email },
      { $set: { password: hash, provider: 'local', emailVerified: true } },
    );

    console.green(`Set password for ${acct.email} (username: ${acct.username})`);
  }

  // Verification
  console.purple('\n=== Verification ===');
  for (const acct of DEMO_ACCOUNTS) {
    const user = await User.findOne({ email: acct.email }).select('+password').lean();
    const passwordOk = user?.password && bcrypt.compareSync(acct.password, user.password);
    console.log(
      `${acct.email}: _id=${user?._id}, provider=${user?.provider}, ` +
        `emailVerified=${user?.emailVerified}, tenantId=${user?.tenantId}, passwordOk=${passwordOk}`,
    );
  }

  // Verify Demo group
  const group = await Group.findOne({ name: 'Demo' }).lean();
  console.log(`Demo group: _id=${group?._id}, memberIds=${JSON.stringify(group?.memberIds)}`);

  mongoose.connection.close();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
