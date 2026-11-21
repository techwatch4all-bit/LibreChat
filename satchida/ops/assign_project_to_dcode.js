const mongoose = require('mongoose');

(async () => {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/LibreChat').asPromise();
  const r = await conn.collection('chatprojects').updateOne(
    { name: 'Live Web Monitor' },
    { $set: { user: '6ac7435ee1878d1bfa7d7a47' } }
  );
  console.log('Project re-assigned to dcode:', r.modifiedCount);
  await conn.close();
})();
