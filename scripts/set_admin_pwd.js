const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

(async () => {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/LibreChat').asPromise();
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('Admin@123456', salt);
  const res = await conn.collection('users').updateOne(
    { email: 'admin@satchida.com' },
    { $set: { password: hash, provider: 'local', emailVerified: true } }
  );
  console.log('Password set for admin@satchida.com:', res.modifiedCount);
  await conn.close();
})();
