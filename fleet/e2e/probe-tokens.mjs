import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

const sample = await db.collection('messages').findOne({});
console.log('message fields:', Object.keys(sample).join(', '));
console.log('tokenCount:', sample.tokenCount, '| tokens:', JSON.stringify(sample.tokens));

const withCounts = await db.collection('messages').countDocuments({ tokenCount: { $gt: 0 } });
console.log('messages carrying a tokenCount:', withCounts);

const agg = await db
  .collection('messages')
  .aggregate([
    { $match: { tokenCount: { $gt: 0 } } },
    { $group: { _id: null, n: { $sum: 1 }, sum: { $sum: '$tokenCount' } } },
  ])
  .toArray();
console.log('total tokenCount:', JSON.stringify(agg));

await mongoose.disconnect();
