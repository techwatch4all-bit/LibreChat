const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

(async () => {
  try {
    const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/LibreChat').asPromise();
    const targetUserId = '6adcd4f7fff2911a26b18593';
    const conversationId = 'art-studio-demo-live';
    const userMessageId = uuidv4();
    const botMessageId = uuidv4();
    const now = new Date();

    await conn.collection('conversations').deleteMany({ conversationId: 'art-studio-demo-live' });
    await conn.collection('messages').deleteMany({ conversationId: 'art-studio-demo-live' });

    const botText = `### 🎨 Satchida Art & Kinetic 3D Motion — Native Studio Delivery

Here are both verified deliverables generated from the self-contained in-repo engines:

---

#### 1. Procedural Fine Art Illustration (\`claude-drawing-skill\`)
Generated via \`skill/claude-drawing-skill/examples/synthwave_coastline.py\` using the multi-pass procedural synthwave engine with neon wireframes, perspective highway grids, and retro sun rays:

![Synthwave Coastline](/assets/synthwave_coastline.jpg)

---

#### 2. Interactive Photorealistic 3D Motion Studio (\`huashu-art-motion\` / Satchida Motion)
Click below to interact with the full 3D panoramic motion studio viewport, featuring real-time perspective controls, continuous terrain flight, dynamic camera transitions, and multi-track audio foley:

:::artifact{identifier="satchida-omni-motion-studio" type="text/html" title="Satchida Omni-Motion 3D Studio"}
\`\`\`html
<iframe src="/motion/omni_studio.html" style="width: 100%; height: 680px; border: none; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.7);" allow="autoplay; fullscreen"></iframe>
\`\`\`
:::`;

    await conn.collection('conversations').insertOne({
      conversationId,
      user: targetUserId,
      tenantId: 'satchida-master',
      title: 'Art & Motion Studio Verification',
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
      __v: 0
    });

    await conn.collection('messages').insertOne({
      messageId: userMessageId,
      conversationId,
      user: targetUserId,
      tenantId: 'satchida-master',
      sender: 'Admin',
      text: 'Demonstrate the delivery and capabilities of claude-drawing-skill and huashu-art-motion inside LibreChat Art with 3D animation and sound effects.',
      isCreatedByUser: true,
      error: false,
      createdAt: new Date(now.getTime() - 2000),
      updatedAt: new Date(now.getTime() - 2000),
      __v: 0
    });

    await conn.collection('messages').insertOne({
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
      __v: 0
    });

    console.log('UPDATED_LIVE_CONVERSATION_WITH_3D_MOTION_AND_FINE_ART');
    await conn.close();
  } catch (err) {
    console.error('Error updating live conversation:', err);
    process.exit(1);
  }
})();
