const mongoose = require('mongoose');
(async () => {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/LibreChat').asPromise();
  const update = {};
  update['$set'] = { twoFactorEnabled: false };
  const res = await conn.collection('users').updateOne(
    { email: 'admin@satchida.com' },
    update
  );
  console.log('Disabled 2FA for admin test:', res.modifiedCount);
  await conn.close();
})();
