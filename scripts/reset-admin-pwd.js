const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error('ADMIN_PASSWORD is required');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat');
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);
  const res = await mongoose.connection.db
    .collection('users')
    .updateOne(
      { email: 'admin@satchida.local' },
      { $set: { password: hash, provider: 'local', emailVerified: true } },
    );
  console.log('Admin password updated:', res.modifiedCount);
  await mongoose.disconnect();
})();
