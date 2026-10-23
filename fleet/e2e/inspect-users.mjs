import mongoose from 'mongoose';

const uri = 'mongodb://127.0.0.1:27017/LibreChat';
await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

const users = await db.collection('users').find(
  {},
  { projection: { email: 1, tenantId: 1, satchidaSeatAlias: 1, role: 1, provider: 1, name: 1 } },
).limit(12).toArray();

console.log('users:', users.length);
for (const u of users) {
  console.log(JSON.stringify({
    email: u.email,
    name: u.name,
    provider: u.provider,
    role: u.role,
    tenantId: u.tenantId ?? null,
    seatAlias: u.satchidaSeatAlias ?? null,
  }));
}

const collections = await db.listCollections().toArray();
console.log('collections:', collections.map((c) => c.name).sort().join(', '));

for (const name of ['tenant_privacy_entitlements', 'tenants', 'tenant_seat_aliases']) {
  if (!collections.some((c) => c.name === name)) continue;
  const rows = await db.collection(name).find({}).limit(4).toArray();
  console.log(`${name}:`, JSON.stringify(rows).slice(0, 1500));
}

await mongoose.disconnect();
