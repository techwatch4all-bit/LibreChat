const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat');
  
  const convoId = 'f40a33cb-01a5-5125-8f31-7364d30f0f9b';
  const msgs = await mongoose.connection.collection('messages').find({
    conversationId: convoId
  }).sort({ createdAt: 1 }).toArray();

  if (msgs.length < 2) {
    console.error('Expected at least 2 messages in convo');
    process.exit(1);
  }

  const m1 = msgs[1];
  let p9 = m1.content[9];

  // Replace painting image with the masterpiece render
  p9.text = p9.text.replace(
    /\/generated\/uttarakhand_shivalik_temple_watercolor_png\.png/g,
    '/generated/watercolor_1795321830.png'
  );

  // Replace the audio link
  p9.text = p9.text.replace(
    /\/generated\/uttarakhand_temple_bells_sitar_mp3\.mp3/g,
    '/generated/shivalik_temple_dawn.mp3'
  );

  // Replace the artifact content with the living art artifact
  const livingArtifact = `:::artifact{identifier="motion-misty-shivalik-dawn-uttarakhand-living-art" type="text/html" title="Misty Shivalik Dawn — Uttarakhand Living Art"}
\`\`\`\`html
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#000}
iframe{width:100%;height:100%;border:0;display:block}</style></head>
<body><iframe src="/generated/motion_misty-shivalik-dawn-uttarakhand-living-art_1795322048.html" allow="autoplay"></iframe></body></html>
\`\`\`\`
:::`;

  p9.text = p9.text.replace(/:::artifact\{identifier="motion-misty-shivalik-dawn-uttarakhand"[\s\S]*?:::/, livingArtifact);

  await mongoose.connection.collection('messages').updateOne(
    { _id: m1._id },
    { $set: { content: m1.content } }
  );

  console.log('Successfully updated message with living art painting & artifact in DB!');
  await mongoose.disconnect();
})();
