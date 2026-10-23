import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

for (const name of ['tenantentitlements', 'tenantpolicies', 'systemgrants']) {
  const count = await db.collection(name).countDocuments();
  console.log(`${name}: ${count} docs`);
  if (count > 0) {
    const rows = await db.collection(name).find({}).limit(3).toArray();
    console.log(JSON.stringify(rows, null, 1).slice(0, 3000));
  }
}

const withSeat = await db.collection('users').countDocuments({ satchidaSeatAlias: { $exists: true, $ne: null } });
console.log('users with seat alias:', withSeat);

await mongoose.disconnect();
