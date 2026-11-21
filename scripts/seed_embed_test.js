const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

(async () => {
  try {
    const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/LibreChat').asPromise();
    const targetUserId = '6adcd4f7fff2911a26b18593';
    const conversationId = 'art-embed-test-live';
    const userMessageId = uuidv4();
    const botMessageId = uuidv4();
    const now = new Date();

    await conn.collection('conversations').deleteMany({ conversationId });
    await conn.collection('messages').deleteMany({ conversationId });

    const embedHtml = [
      '<!DOCTYPE html>',
      '<html><head><meta charset="utf-8">',
      '<style>html,body{margin:0;height:100%;background:#000}',
      'iframe{width:100%;height:100%;border:0;display:block}</style></head>',
      '<body><iframe src="/generated/probe_embed.html" allow="autoplay"></iframe></body></html>',
    ].join('\n');

    const userText = 'Make a short kinetic clip about Embed Test.';
    const botText = [
      'Here is the compiled kinetic clip, mounted inside the Studio:',
      '',
      ':::artifact{identifier="motion-embed-test" type="text/html" title="Embed Test Clip"}',
      '````html',
      embedHtml,
      '````',
      ':::',
      '',
      'Play, pause, scrub and mute controls live in the Studio timeline.',
    ].join('\n');

    await conn.collection('conversations').insertOne({
      conversationId,
      user: targetUserId,
      tenantId: 'satchida-master',
      title: 'Art Embed Delivery Test',
      endpoint: 'Satchida-Gateway',
      endpointType: 'custom',
      model: 'OpenFilm',
      modelLabel: 'OpenFilm Studio 🎬',
      spec: 'OpenFilm',
      messages: [userMessageId, botMessageId],
      isArchived: false,
      isTemporary: false,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    });

    await conn.collection('messages').insertMany([
      {
        messageId: userMessageId,
        conversationId,
        user: targetUserId,
        tenantId: 'satchida-master',
        sender: 'Admin',
        text: userText,
        isCreatedByUser: true,
        error: false,
        createdAt: new Date(now.getTime() - 2000),
        updatedAt: new Date(now.getTime() - 2000),
        __v: 0,
      },
      {
        messageId: botMessageId,
        parentMessageId: userMessageId,
        conversationId,
        user: targetUserId,
        tenantId: 'satchida-master',
        sender: 'OpenFilm Studio 🎬',
        text: botText,
        content: [{ type: 'text', text: botText }],
        isCreatedByUser: false,
        error: false,
        createdAt: now,
        updatedAt: now,
        __v: 0,
      },
    ]);
    console.log('EMBED_TEST_CONVO_SAVED');
    process.exit(0);
  } catch (e) {
    console.error('SEED_ERR', e.message);
    process.exit(1);
  }
});
