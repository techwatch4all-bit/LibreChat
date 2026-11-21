const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

(async () => {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/LibreChat').asPromise();
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('Dcode@123456', salt);
  const r = await conn.collection('users').updateOne(
    { email: 'dcode@satchida.local' },
    { $set: { password: hash, twoFactorEnabled: false } }
  );
  console.log('dcode password set:', r.modifiedCount);
  await conn.close();
})();
