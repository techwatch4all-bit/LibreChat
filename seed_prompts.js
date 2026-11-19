const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat';

const promptsData = [
  // Health & Emergency
  {
    name: 'Emergency Medical Triage Protocol',
    oneliner:
      'Differential symptom assessment, danger flags, and crisis guidance when isolated or in lockdown',
    category: 'idea',
    command: 'triage',
    prompt:
      'I am experiencing {{symptoms}} for the past {{duration}}. The patient is {{age}} years old. We are in an isolated area with no immediate doctor. Perform a complete clinical triage: differential causes, immediate home comfort measures, natural adjuncts, and non-negotiable red flags for emergency evacuation.',
  },
  {
    name: 'Laboratory Blood Test Diagnostic Planner',
    oneliner: 'Targeted blood investigations and biomarker panels tailored to specific symptoms',
    category: 'idea',
    command: 'bloodtest',
    prompt:
      'I need a comprehensive diagnostic blood test roadmap for {{condition_or_symptoms}}. Detail: 1) Essential blood panels (CBC, ESR/CRP, metabolic, endocrine, organ function), 2) Specific preparation rules (fasting duration, sample timing), and 3) What abnormal high/low markers indicate clinically.',
  },
  {
    name: 'Diagnostic Imaging & Radiology Navigator',
    oneliner:
      'Determine appropriate imaging modality: X-Ray vs USG vs CT vs MRI for acute or chronic conditions',
    category: 'idea',
    command: 'imaging',
    prompt:
      'The patient presents with {{symptoms_or_injury}} lasting for {{duration}}. Recommend the precise imaging modality (X-Ray, Ultrasound USG, CT Scan, or MRI): 1) Best initial scan vs definitive scan, 2) Specific view/protocol (e.g. NCCT KUB, Chest PA view, USG Whole Abdomen), 3) Radiation/contrast safety, and 4) Urgency level.',
  },

  // Study & STEM
  {
    name: 'Socratic STEM Concept Explainer',
    oneliner:
      'Deep intuitive breakdown of complex science/math concepts with visual diagrams and analogies',
    category: 'teach_or_explain',
    command: 'stem-explain',
    prompt:
      'Explain the fundamental mechanism of {{stem_concept}} for a {{grade_or_level}} level student. Break down: 1) First principles intuition with a vivid real-world analogy, 2) Step-by-step physical or mathematical mechanism, 3) High-yield flashcard self-check table, and 4) Common misconceptions.',
  },
  {
    name: 'Step-by-Step Calculus & Physics Solver',
    oneliner:
      'Rigorous mathematical derivation and physics problem solving with verification checks',
    category: 'teach_or_explain',
    command: 'step-solve',
    prompt:
      'Solve the following problem step-by-step: {{problem_statement}}. 1) State given values, constraints, and target unknowns, 2) State the governing theorem or physical law, 3) Show every algebraic and calculus step without skipping, and 4) Dimensional analysis and sanity check on the final answer.',
  },

  // Coding & Architecture
  {
    name: 'Security & Refactoring Code Audit',
    oneliner:
      'Production-grade code review for race conditions, memory leaks, OWASP vulnerabilities, and type safety',
    category: 'code',
    command: 'code-audit',
    prompt:
      'Audit the following {{language_framework}} code for production readiness: {{code_snippet_or_file}}. Focus strictly on: 1) Security vulnerabilities and injection vectors, 2) Race conditions, concurrency hazards, and unhandled promises, 3) Memory leaks and performance bottlenecks, and 4) Refactored idiomatic drop-in replacement.',
  },
  {
    name: 'System Architecture Blueprint & ADR',
    oneliner:
      'Production system design specification with container diagrams, data flow, and trade-offs',
    category: 'code',
    command: 'arch-spec',
    prompt:
      'Design a scalable, highly available system architecture for {{system_goal_or_workload}}. Specify: 1) High-level component topology (C4 container model), 2) Database schema & data partitioning strategy, 3) API contracts and messaging protocol, 4) Failure modes, circuit breakers, and disaster recovery.',
  },

  // Business Strategy & Finance
  {
    name: 'Executive Decision Memo & Strategic Brief',
    oneliner:
      'High-leverage 1-page executive summary synthesizing risks, ROI, and tactical recommendations',
    category: 'finance',
    command: 'exec-brief',
    prompt:
      'Draft an executive decision memo on {{initiative_or_problem}}. Include: 1) Executive Summary (Bottom-line Up Front), 2) Financial impact and estimated ROI for a budget of {{budget_range}}, 3) Top 3 strategic risks and mitigations, and 4) Clear Go / No-Go decision recommendation with 30-60-90 day milestone gates.',
  },

  // Writing & Communications
  {
    name: 'High-Impact Copywriting & Messaging Polish',
    oneliner:
      'Eliminate AI fluff and refine value propositions into crisp, compelling, audience-tailored prose',
    category: 'write',
    command: 'copy-polish',
    prompt:
      'Refine and elevate this draft for {{target_audience}}: {{draft_text}}. Objective: 1) Remove AI buzzwords, cliché fillers, and corporate passive voice, 2) Strengthen the hook and value proposition, 3) Format with rhythm and emotional impact, and 4) Provide 3 distinct tonal variations (Assertive, Conversational, Visionary).',
  },
];

async function seed() {
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

  console.log('Seeding prompts for Author:', authorName, authorId.toString(), 'Tenant:', tenantId);

  for (const item of promptsData) {
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

    // 3. Ensure Public Access ACL Entry exists for this PromptGroup
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

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
