/**
 * Report the latest assistant reply for both E2E seats.
 */
import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

for (const [label, email] of [
  ['PRIVACY', 'e2e.privacy@satchida.local'],
  ['CLOUD  ', 'e2e.cloud@satchida.local'],
]) {
  const user = await db.collection('users').findOne({ email });
  if (!user) {
    console.log(`${label}: no user`);
    continue;
  }
  const msgs = await db
    .collection('messages')
    .find({ user: user._id.toString() })
    .sort({ createdAt: -1 })
    .limit(4)
    .toArray();
  const reply = msgs.find((m) => Array.isArray(m.content) && m.content.some((c) => c.type === 'text'));
  const text = reply?.content?.find((c) => c.type === 'text')?.text ?? '(no text reply)';
  const error = msgs.find((m) => Array.isArray(m.content) && m.content.some((c) => c.type === 'error'));
  console.log(`${label} endpoint=${reply?.endpoint ?? '?'} model=${reply?.model ?? '?'}`);
  console.log(`        reply  : ${JSON.stringify(text).slice(0, 120)}`);
  if (error) {
    console.log(`        error  : ${JSON.stringify(error.content).slice(0, 200)}`);
  }
}

await mongoose.disconnect();
