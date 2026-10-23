import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
const user = await db.collection('users').findOne({ email: 'e2e.cloud@satchida.local' });
const seatToken = user?.seatToken;
if (!seatToken) {
  console.log('the user has no seat token');
  await mongoose.disconnect();
  process.exit(1);
}

const res = await fetch('http://127.0.0.1:4000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    Authorization: `Bearer ${seatToken}`,
    'X-Satchida-Mode': 'Chat',
  },
  body: JSON.stringify({
    model: 'Chat',
    messages: [{ role: 'user', content: 'Reply with exactly: CLOUD_OK' }],
    max_tokens: 512,
  }),
});
const text = await res.text();
console.log('status:', res.status);
console.log('body  :', text.slice(0, 700));

await mongoose.disconnect();
