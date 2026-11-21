const mongoose = require('mongoose');

(async () => {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/LibreChat').asPromise();
  const resAdmin = await conn.collection('roles').updateMany(
    { name: 'ADMIN' },
    { $set: { 'permissions.OPENCODE': { USE: true } } }
  );
  const resUser = await conn.collection('roles').updateMany(
    { name: 'USER' },
    { $set: { 'permissions.OPENCODE': { USE: true } } }
  );
  console.log('ADMIN updated:', resAdmin.modifiedCount, 'USER updated:', resUser.modifiedCount);
  await conn.close();
})();
