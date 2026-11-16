const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat');
    const res = await mongoose.connection.db.collection('users').updateMany(
      {
        $or: [
          { satchidaSeatAlias: { $regex: '^demo_|^lc_' } },
          { seatToken: { $regex: '^tk_' } },
        ],
      },
      {
        $set: { seatToken: null, satchidaSeatAlias: null },
      }
    );
    console.log('LibreChat MongoDB disassociated temp users:', res.modifiedCount);
    await mongoose.disconnect();
  } catch (e) {
    console.error('Mongo error:', e.message);
    process.exit(1);
  }
})();
