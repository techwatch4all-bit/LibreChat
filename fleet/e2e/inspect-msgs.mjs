import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

const msgs = await db
  .collection('messages')
  .find({ user: '6ad71c47414670e6b16e9a22' })
  .sort({ createdAt: -1 })
  .limit(8)
  .toArray();

for (const m of msgs) {
  console.log('---');
  console.log('role     :', m.role);
  console.log('model    :', m.model, '| endpoint:', m.endpoint, '| error:', m.error ?? '(none)');
  console.log('content  :', JSON.stringify(m.content).slice(0, 700));
}
if (!msgs.length) console.log('no messages for the E2E user');

await mongoose.disconnect();
