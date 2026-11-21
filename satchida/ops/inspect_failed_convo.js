const mongoose = require('mongoose');

(async () => {
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/LibreChat').asPromise();
  const convo = await conn.collection('conversations').findOne({ conversationId: 'd228b650-50a4-5539-8261-8322c2dce835' });
  console.log('Conversation:', convo ? {
    conversationId: convo.conversationId,
    endpoint: convo.endpoint,
    model: convo.model,
    spec: convo.spec,
    tools: convo.tools,
  } : 'Not found');

  const msgs = await conn.collection('messages').find({ conversationId: 'd228b650-50a4-5539-8261-8322c2dce835' }).sort({ createdAt: 1 }).toArray();
  console.log('Messages count:', msgs.length);
  msgs.forEach((m, i) => {
    console.log('--- Message ' + i + ' (' + m.sender + ') ---');
    console.log('Text:', m.text);
    console.log('Plugin / Tools:', {
      plugin: m.plugin,
      plugins: m.plugins,
      tools: m.tools,
      error: m.error
    });
  });

  await conn.close();
})();
