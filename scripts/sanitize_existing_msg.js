const mongoose = require('mongoose');

(async () => {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/LibreChat').asPromise();
  const m = await conn.collection('messages').findOne({ messageId: '55538125-7563-4c45-91ca-9dd15dc4052a' });
  if (m && Array.isArray(m.content)) {
    let changed = false;
    m.content.forEach((part) => {
      if (part && part.type === 'text' && typeof part.text === 'string' && (part.text.includes('DSML') || part.text.includes('invoke'))) {
        part.text = part.text
          .replace(/<[|｜]DSML[|｜]tool_calls>[\s\S]*?(<\/[|｜]DSML[|｜]tool_calls>|$)/gi, '')
          .replace(/<[|｜]DSML[|｜][\s\S]*?(<\/[|｜]DSML[|｜][^>]*>|$)/gi, '')
          .replace(/<[|｜]DSML[|｜][\s\S]*$/gi, '')
          .trim();
        changed = true;
      }
    });
    if (changed) {
      await conn.collection('messages').updateOne({ _id: m._id }, { $set: { content: m.content } });
      console.log('Sanitized existing message 55538125 in MongoDB!');
    } else {
      console.log('No DSML in message 55538125');
    }
  }
  await conn.close();
})();
