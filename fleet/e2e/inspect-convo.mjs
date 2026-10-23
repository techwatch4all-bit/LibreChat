import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

const user = await db.collection('users').findOne({ email: 'e2e.cloud@satchida.local' });
const convos = await db
  .collection('conversations')
  .find({ user: user._id.toString() })
  .sort({ updatedAt: -1 })
  .limit(2)
  .toArray();

for (const convo of convos) {
  console.log('=== conversation', convo._id.toString(), 'endpoint', convo.endpoint, 'model', convo.model);
  const msgs = await db
    .collection('messages')
    .find({ conversationId: convo._id.toString() })
    .sort({ createdAt: 1 })
    .toArray();
  for (const m of msgs) {
    console.log('  role', m.role, '| isCreatedByUser', m.isCreatedByUser, '| text:',
      JSON.stringify(m.text ?? m.content).slice(0, 160));
  }
}

await mongoose.disconnect();
