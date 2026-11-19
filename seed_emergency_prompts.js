const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';

const emergencyPrompts = [
  {
    name: 'Animal Bite & Rabies Prophylaxis Protocol',
    oneliner:
      'Immediate 15-minute wound flush, WHO Category I-III staging, ARV/RIG schedule, and zero-vaccine lockdown action',
    category: 'idea',
    command: 'dog-bite-rabies',
    prompt:
      'I or a family member was bitten by a {{animal_type}} on the {{body_location}}. The bite occurred {{time_elapsed}} ago. Bleeding: {{bleeding_status}}. We are in a lockdown with limited or no immediate hospital access. Provide: 1) Immediate step-by-step mechanical wound washing protocol, 2) WHO exposure category staging and whether Immunoglobulin (RIG) is required, 3) Standard anti-rabies vaccine (ARV) schedule, 4) What to do if no vaccine is available locally (wound cauterization, bacterial antibiotics, animal quarantine rules), and 5) Strict contraindications (e.g. no suturing).',
  },
  {
    name: 'Snakebite Field Triage & Anti-Venom Protocol',
    oneliner:
      'DO-NO-HARM field first aid, immobilization, contraindications (no tourniquet/cutting), and ASV hospital transfer',
    category: 'idea',
    command: 'snakebite-triage',
    prompt:
      'A person was bitten by a snake on the {{bitten_limb}}. Time since bite: {{time_elapsed}}. Snake description: {{snake_description}}. Symptoms: {{symptoms}} (swelling, pain, bleeding, drooping eyelids, breathing difficulty). Provide: 1) Immediate field first aid (limb splinting, positioning below heart level), 2) Deadly contraindications to avoid (tourniquets, cutting, suction), 3) Clinical signs of neurotoxic vs hemotoxic envenomation, and 4) Emergency hospital transfer and Polyvalent ASV directives.',
  },
  {
    name: 'GERD, Gas Trapping & Severe Acidity Relief',
    oneliner:
      'Immediate physical and natural decompression for severe acid reflux, stuck intestinal gas, and burning spasms',
    category: 'idea',
    command: 'gerd-gas-relief',
    prompt:
      'I am suffering from {{symptoms}} (severe burning chest acidity, sour water-brash, painful stuck gas in lower intestine, or bloating) for the past {{duration}}. Provide: 1) Anatomical posture and sleep mechanics (left lateral tilt, head elevation), 2) Yoga gas-release asanas (Pawanmuktasana, Balasana) and clockwise abdominal massage technique, 3) Safe kitchen carminatives (ajwain, black salt, hing, cold milk, DGL), and 4) Differentiating trapped gas / reflux from acute cardiac events or bowel obstruction.',
  },
  {
    name: 'Renal vs Biliary Stone Colic Navigator',
    oneliner:
      'Differentiating kidney stone flank colic from gallbladder attack, imaging modality, and pain management',
    category: 'idea',
    command: 'stone-colic',
    prompt:
      'I have severe acute pain in {{pain_location}} (e.g. flank radiating to groin, or right upper abdomen under ribs after food). Accompanied by: {{symptoms}}. Provide: 1) Clinical differential: Nephrolithiasis (kidney stone) vs Acute Cholecystitis (gallbladder attack), 2) Diagnostic imaging choice (Non-Contrast CT KUB vs Ultrasound Abdomen), 3) Safe antispasmodic and hydration guidelines, and 4) Surgical / infection red flags (fever with chills, jaundice, anuria).',
  },
  {
    name: 'Plantar Fasciitis Heel Pain & Corn Care Protocol',
    oneliner:
      'Relief for morning first-step stabbing heel pain, arch stretching, and safe foot corn management',
    category: 'idea',
    command: 'heel-pain-rehab',
    prompt:
      'I am experiencing severe {{foot_condition}} (stabbing heel pain with first morning steps, or painful hard foot corn on sole) for {{duration}}. Provide: 1) Pathophysiology of plantar fascia strain vs calcaneal spur, 2) Immediate physical therapy routine (frozen water bottle roll, plantar fascia morning stretch), 3) Footwear and arch support guidelines, and 4) Safe foot corn peeling vs dangerous self-cutting (especially for diabetics).',
  },
];

async function seedEmergencyPrompts() {
  await mongoose.connect(uri);
  const dbConn = mongoose.connection.db;

  const adminUser = await dbConn.collection('users').findOne({ email: 'admin@satchida.com' });
  if (!adminUser) {
    console.error('Admin user not found!');
    process.exit(1);
  }
  const authorId = adminUser._id;
  const authorName = adminUser.name || 'Admin';
  const tenantId = adminUser.tenantId || 'satchida-master';

  const promptGroupViewerRole = await dbConn
    .collection('accessroles')
    .findOne({ accessRoleId: 'promptGroup_viewer' });
  const roleId = promptGroupViewerRole ? promptGroupViewerRole._id : null;

  console.log(
    'Seeding Acute & Common Emergency Prompts for Author:',
    authorName,
    authorId.toString(),
    'Tenant:',
    tenantId,
  );

  for (const item of emergencyPrompts) {
    let group = await dbConn.collection('promptgroups').findOne({ command: item.command });
    let groupId;
    let promptId = new ObjectId();

    if (!group) {
      groupId = new ObjectId();
      // 1. Create Prompt
      await dbConn.collection('prompts').insertOne({
        _id: promptId,
        groupId: groupId,
        author: authorId,
        prompt: item.prompt,
        type: 'chat',
        tenantId: tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 2. Create PromptGroup
      await dbConn.collection('promptgroups').insertOne({
        _id: groupId,
        name: item.name,
        numberOfGenerations: 0,
        oneliner: item.oneliner,
        category: item.category,
        productionId: promptId,
        author: authorId,
        authorName: authorName,
        command: item.command,
        tenantId: tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log('Created PromptGroup & Prompt:', item.name, 'Command: /' + item.command);
    } else {
      groupId = group._id;
      console.log('PromptGroup already exists:', item.name);
    }

    // 3. Ensure Public Access ACL Entry exists
    const existingAcl = await dbConn.collection('aclentries').findOne({
      resourceType: 'promptGroup',
      resourceId: groupId,
      principalType: 'public',
    });

    if (!existingAcl) {
      await dbConn.collection('aclentries').insertOne({
        principalType: 'public',
        principalId: null,
        principalModel: undefined,
        resourceType: 'promptGroup',
        resourceId: groupId,
        permBits: 1, // VIEW
        roleId: roleId,
        grantedBy: authorId,
        grantedAt: new Date(),
        tenantId: tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('Granted Public VIEW ACL for PromptGroup:', item.name);
    }
  }

  const totalGroups = await dbConn.collection('promptgroups').countDocuments();
  const totalPrompts = await dbConn.collection('prompts').countDocuments();
  console.log('Completed! Total PromptGroups:', totalGroups, 'Total Prompts:', totalPrompts);
  process.exit(0);
}

seedEmergencyPrompts().catch((err) => {
  console.error(err);
  process.exit(1);
});
