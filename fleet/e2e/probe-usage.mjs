import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
console.log('collections:', names.join(', '));

if (names.includes('usage')) {
  const sample = await db.collection('usage').findOne({});
  console.log('usage fields:', Object.keys(sample ?? {}).join(', '));
  const rows = await db
    .collection('usage')
    .aggregate([
      {
        $group: {
          _id: { model: '$model', endpoint: '$endpoint' },
          n: { $sum: 1 },
          prompt: { $sum: { $ifNull: ['$promptTokens', 0] } },
          completion: { $sum: { $ifNull: ['$completionTokens', 0] } },
        },
      },
    ])
    .toArray();
  for (const row of rows) {
    const ratio = row.completion ? row.prompt / row.completion : 0;
    console.log(
      `  ${String(row._id.model).padEnd(28)} ${String(row._id.endpoint).padEnd(18)} ` +
        `n=${String(row.n).padEnd(5)} in=${String(row.prompt).padEnd(9)} out=${String(row.completion).padEnd(8)} ` +
        `ratio=${ratio ? ratio.toFixed(1) + ':1' : 'n/a'}`
    );
  }
} else {
  console.log('no usage collection: the token mix has to come from elsewhere');
}

await mongoose.disconnect();
