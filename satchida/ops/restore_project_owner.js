const mongoose = require('mongoose');

async function run() {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/LibreChat').asPromise();
  const admin = await conn.db.collection('users').findOne({ email: 'admin@satchida.com' });
  const adminId = admin._id.toString();
  
  const r = await conn.db.collection('chatprojects').updateOne(
    { name: 'Live Web Monitor' },
    { $set: { user: adminId } }
  );
  console.log('Restored Live Web Monitor user to admin:', r.modifiedCount);
  await conn.close();
}

run().catch(console.error);
