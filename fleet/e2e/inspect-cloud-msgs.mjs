import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

const user = await db.collection('users').findOne({ email: 'e2e.cloud@satchida.local' });
if (!user) {
  console.log('no cloud user');
} else {
  const msgs = await db
    .collection('messages')
    .find({ user: user._id.toString() })
    .sort({ createdAt: -1 })
    .limit(4)
    .toArray();
  for (const m of msgs) {
    console.log('---');
    console.log('model   :', m.model, '| endpoint:', m.endpoint);
    console.log('content :', JSON.stringify(m.content ?? null).slice(0, 900));
  }
}

await mongoose.disconnect();
