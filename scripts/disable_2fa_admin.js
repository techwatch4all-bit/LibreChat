const mongoose = require('mongoose');
(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat');
  const res = await mongoose.connection.collection('users').updateOne(
    { email: 'admin@satchida.com' },
    { $set: { twoFactorEnabled: false } }
  );
  console.log('2FA disabled count:', res.modifiedCount);
  await mongoose.disconnect();
})();
