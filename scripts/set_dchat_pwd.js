const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

(async () => {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/LibreChat').asPromise();
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('Demo@123456', salt);
  const res = await conn.collection('users').updateOne(
    { email: 'dchat@satchida.local' },
    { $set: { password: hash, provider: 'local', emailVerified: true } }
  );
  console.log('Password set for dchat@satchida.local:', res.modifiedCount);
  await conn.close();
})();
