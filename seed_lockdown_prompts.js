const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';

const lockdownPrompts = [
  // Pediatric & Infant
  {
    name: 'Infant & Pediatric Emergency Fever/Dehydration Triage',
    oneliner:
      'Pediatric triage for high fever, dehydration, refusal to feed, or breathing distress in isolation',
    category: 'idea',
    command: 'pediatric-triage',
    prompt:
      'The patient is a {{age_months_or_years}} old child presenting with {{symptoms}} (fever temperature: {{fever_temp}}). Duration: {{duration}}. We are in lockdown with no doctor available. Give immediate pediatric guidance: 1) Hydration assessment (fontanelle, tear production, wet diapers in 24h), 2) Safe fever comfort and weight-appropriate dosing precautions, 3) Breathing distress signs (stridor, subcostal retractions, grunting), and 4) Red flags requiring emergency hospital transfer.',
  },
  // Maternal & Women's Acute Health
  {
    name: 'Maternal & Pregnancy Acute Symptom Triage',
    oneliner:
      'Urgent evaluation of pregnancy complications, high blood pressure, spotting, or pelvic pain in lockdown',
    category: 'idea',
    command: 'pregnancy-triage',
    prompt:
      'The patient is pregnant at {{gestational_weeks}} weeks gestation experiencing {{symptoms}}. Blood pressure reading if available: {{blood_pressure}}. We cannot reach our obstetrician due to lockdown. Provide clinical triage: 1) Risk evaluation for preeclampsia, placental issues, or early labor, 2) Safe maternal positioning (e.g., left lateral tilt to avoid supine hypotension), 3) Vital signs and fetal movement monitoring, and 4) Absolute red flag triggers for immediate hospital emergency room transfer.',
  },
  // Senior Citizens & Chronic Disease
  {
    name: 'Senior Citizen Chronic Flare-up & Vital Signs Triage',
    oneliner:
      'Emergency home guidance for hypertension spikes, COPD/oxygen drops, or diabetic crisis in elders',
    category: 'idea',
    command: 'geriatric-triage',
    prompt:
      'A {{age}} year-old elder with known history of {{chronic_conditions}} is experiencing {{acute_symptoms}}. Current vitals: BP {{blood_pressure}}, Pulse {{heart_rate}}, SpO2 {{oxygen_spo2}}%, Blood Glucose {{blood_glucose}} mg/dL. We are isolated in lockdown. Provide: 1) Clinical assessment of current vitals vs dangerous thresholds, 2) Immediate non-pharmacological stabilization and safe medication checks, 3) Stroke (FAST) and cardiac warning assessment, and 4) Emergency transport triggers.',
  },
  // Adolescents & Teen Mental Distress
  {
    name: 'Adolescent Acute Anxiety & Panic Protocol',
    oneliner:
      'Crisis grounding and somatic de-escalation for acute panic attacks, palpitations, or hyperventilation in youth',
    category: 'teach_or_explain',
    command: 'teen-panic-relief',
    prompt:
      'A {{age}} year-old teen is experiencing acute panic/anxiety with symptoms of {{symptoms}} (e.g., racing heart, chest tightness, hyperventilation, dizziness) triggered by isolation or stress. Provide: 1) Immediate somatic de-escalation protocol (Box Breathing 4-4-4-4, 5-4-3-2-1 Sensory Grounding), 2) Distinguishing panic palpitations from medical cardiac events, 3) Safe herbal tea/calming measures, and 4) Reassurance guidance for family members.',
  },
  // Urgent Dental & Orofacial
  {
    name: 'Urgent Dental Infection & Pain Protocol',
    oneliner:
      'Emergency triage and relief for severe toothache, dental abscess, or facial swelling in lockdown',
    category: 'idea',
    command: 'dental-emergency',
    prompt:
      'I have severe acute dental pain in {{tooth_location}} with {{symptoms}} (e.g. throbbing pain, hot/cold sensitivity, gum swelling, facial swelling). All dental clinics are shut due to lockdown. Provide: 1) Clinical assessment of pulpitis vs periapical abscess, 2) Safe home pain management (analgesic timing, warm saltwater rinses, clove oil / Syzygium aromaticum application), 3) Strict contraindications (do not apply aspirin directly to gums), and 4) Airway compromise / facial cellulitis red flags requiring ER intervention.',
  },
];

async function seedLockdownPrompts() {
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
    'Seeding Lifespan Lockdown Prompts for Author:',
    authorName,
    authorId.toString(),
    'Tenant:',
    tenantId,
  );

  for (const item of lockdownPrompts) {
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

seedLockdownPrompts().catch((err) => {
  console.error(err);
  process.exit(1);
});
