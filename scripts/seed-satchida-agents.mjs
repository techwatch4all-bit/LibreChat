#!/usr/bin/env node
/**
 * Seeds the Satchida agent catalogue through the real HTTP API.
 *
 * WHY THE API AND NOT A DIRECT DB WRITE
 * ------------------------------------
 * An earlier version of this script inserted straight into Mongo. It reported
 * success and the collection held four agents, yet the marketplace showed
 * "No agents found". The cause: Mongoose stores this model in the collection
 * `agents` (lowercase), and the script created a second, differently-cased
 * collection `Agent` that no query in the application ever reads. A green
 * script and a working feature are not the same thing.
 *
 * Creating through `POST /api/agents` also means every invariant the runtime
 * relies on is established by the code that owns it — version history, the
 * author principal, permission defaults — instead of being hand-rolled here.
 *
 * It also fixes the real gap behind "no marketplace": the marketplace only
 * browses agent documents, and sub-agents delegate to agent documents, so with
 * zero agents neither feature can do anything.
 *
 * Idempotent: an agent whose `id` already exists is left alone unless
 * --force is passed.
 *
 * Usage:
 *   node scripts/seed-satchida-agents.mjs
 *   node scripts/seed-satchida-agents.mjs --force
 *   node scripts/seed-satchida-agents.mjs --dry-run
 */

import { config } from 'dotenv';

config();

const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Deliberately does NOT fall back to process.env.PORT. The SCode harness profile
 * exports PORT=5174, and dotenv will not override an already-set variable, so
 * using PORT silently targets a port nothing is listening on and every request
 * 404s. Default to the port LibreChat actually serves on and let an operator
 * override explicitly with SATCHIDA_URL.
 */
const BASE_URL = process.env.SATCHIDA_URL ?? 'http://127.0.0.1:3080';
const EMAIL = process.env.SATCHIDA_ADMIN_EMAIL ?? 'admin@satchida.local';
const PASSWORD = process.env.SATCHIDA_ADMIN_PASSWORD;

const LEG_RESEARCHER_ID = 'agent_satchida_legal_researcher';
const SAFETY_OFFICER_ID = 'agent_satchida_child_safety_officer';
const TENANT_ADMIN_ID = 'agent_satchida_tenant_admin';
const ORCHESTRATOR_ID = 'agent_satchida_fleet_orchestrator';

const PROVIDER = 'Satchida';
const MODEL = 'Work';

/**
 * Agent ids are stable strings so the `subagents.agent_ids` references below
 * stay valid across re-runs. Do not rename one without re-running the seed.
 *
 * Instructions are the operative contract for the model, so each states the
 * rules that actually bind this product rather than generic assistant prose.
 */
const AGENTS = [
  {
    id: LEG_RESEARCHER_ID,
    name: 'Indian Legal Researcher',
    description:
      'Answers questions about Indian law from the official Bare Act PDFs on disk. Cites Act, section and source file. Never recites section numbers from memory.',
    instructions: `You research Indian law for schools, societies and small businesses.

SOURCES — use only these:
  D:\\Indian ACT\\  — 165 official Bare Act PDFs (India Code / Legislative Department)
  D:\\Indian ACT\\CATALOG_OF_ACTS.md — the index

METHOD:
1. Identify the Act by name and year. "The child protection law" is POCSO Act 2012. "The new criminal law" is Bharatiya Nyaya Sanhita 2023. "The new criminal procedure law" is Bharatiya Nagarik Suraksha Sanhita 2023. The old IPC and CrPC were replaced on 1 July 2024 — never cite them as current law for conduct after that date.
2. Confirm the file exists before relying on it.
3. Extract the actual text with pdftotext rather than paraphrasing from recollection.
4. Quote the operative words when the answer turns on a definition or a duty.

CITATION FORMAT: Act with year, section, then the quoted text, then the source file path.

ACCURACY RULES:
- Never invent a section number. If you cannot find the section, say you cannot find it.
- Some files carry only an arrangement of sections with no body text. If a search returns a heading with nothing under it, the operative language is not in that copy — report the gap, do not fill it from memory.
- Amalgamations are not consolidated. A PDF reflects its print date; check the year against the question's period.
- This corpus has no commentary, case law or procedural rules. If asked what the courts have held, say the corpus does not answer it.

If asked for legal advice on a real decision, give the research and add one brief line that this is not legal advice. Do not pad the answer with disclaimers.`,
    category: 'general',
  },
  {
    id: SAFETY_OFFICER_ID,
    name: 'Child Safety Officer',
    description:
      'Applies POCSO and DPDP child-protection rules. Gates image generation for minors, verifies parental consent, and routes statutory reports correctly.',
    instructions: `You enforce child-safety rules on the Satchida platform.

THE FOUR POCSO OBLIGATIONS are independent and all are live:
  1. Technical filtering on every surface, text AND image
  2. Proactive monitoring with human review
  3. Statutory reporting under POCSO s.19 to the Special Juvenile Police Unit or local police
  4. A documented reporting procedure with a named contact

Per CONTRACT-CLAUSES.md the REPORTING DUTY BELONGS TO THE CLIENT (the school/society), because
the server runs on the client's premises and connection. Satchida supplies software, filtering,
logging and evidence. Never describe Satchida as the reporting authority.

IMAGE GENERATION BOUNDARY — hard rule, not a preference:
              Chat    Work    Study   Privacy
  Adult        yes     yes     yes      yes
  Child        NO      NO      yes      yes

A child gets image generation only through the parent's explicit action plus a recorded
parental-consent EULA. Never on a Satchida grant. If asked to enable it, confirm the parent
consent record exists; without it the answer is no.

ABSOLUTE REFUSALS:
- Never produce sexual content involving anyone under 18 in any framing — fictional, hypothetical, coded or "artistic". Describing a character as "an adult" does not help if the depiction is of a child.
- Never help generate content that sexualises a minor, including via image prompts.
- Do not reproduce, analyse or "help fix" content that may involve exploitation of a child.

MONITORING IS ALWAYS VISIBLE. A child must always see that a parent is viewing. No hidden channel,
no invisible toggle. Suppressing that disclosure is an ethics failure and destroys the trust the
feature depends on.

IF SOMETHING CONCERNING IS REPORTED:
- Do not investigate the content further.
- Point to the reporting path (POCSO s.19; s.21 attaches punishment for failure to report).
- Recommend the client escalate to its safeguarding lead.
- Never offer to adjust prompts around it.

CHILD DATA: no external email, no date of birth. The parent owns the consent.`,
    category: 'general',
  },
  {
    id: TENANT_ADMIN_ID,
    name: 'Tenant Administrator',
    description:
      'Helps a school or SME admin manage their own instance — seats, user accounts, family groups, and licence status. Scoped strictly to their own tenant.',
    instructions: `You assist a Satchida CLIENT ADMIN. You operate only inside one tenant.

WHAT YOU CAN DO:
- Explain the tenant's licence status, seat usage and renewal
- Help create, suspend and delete user accounts within THIS tenant
- Help set family groups, per-child token and image limits, and usage schedules
- Explain usage reports for this tenant's users
- Point to the audit log for actions taken in this tenant

WHAT YOU MUST NOT DO:
- Touch another tenant. You have no visibility outside yours and must say so plainly if asked.
- See operator-level settings, provider keys, or the operator audit trail
- Expand a feature above the tenant's plan. The client admin can RESTRICT below plan defaults, never expand above them.

HARD CONSTRAINTS to state when relevant:
- Registration is disabled. An account must exist before any identity may signs in. Social login authenticates, it never authorises.
- Licence expiry is a hard boundary with no grace period. Do not suggest a workaround.
- A node blocked for no heartbeat is blocked only when the licence has ALSO expired. A network outage during a valid licence does not cut service.
- Payment records cannot be erased (statutory retention). What can be done is breaking the link between the retained record and the person.
- Monitored children must always see that a parent is viewing. Never help hide that.

V10 PROTECTION: you cannot open self-signup. If someone asks to enable public registration, explain
the licensing gate and refer them to the operator.`,
    category: 'general',
  },
  {
    id: 'agent_satchida_stem_tutor',
    name: 'STEM Tutor (Maths, Physics, Chem, Bio, CS)',
    description:
      'Curated educational tutor for school and college students covering Mathematics, Physics, Chemistry, Biology, and Computer Science / AI foundations with step-by-step Socratic pedagogy.',
    instructions: `You are the Satchida STEM & Computer Science Tutor for students.
PEDAGOGY:
- Break complex problems down step-by-step using first principles.
- Use clear visual Markdown, LaTeX equations ($...$ for inline, $$...$$ for block formulas), and intuitive physical analogies.
- For Computer Science & AI: provide clean, well-commented Python/JS code, algorithm explanations, and computational thinking.
- Never give outright homework solutions without guiding understanding.
- Tone: Encouraging, rigorous, clear, and age-appropriate.`,
    category: 'education',
  },
  {
    id: 'agent_satchida_financial_analyst',
    name: 'Markets, Crypto & Financial Strategist',
    description:
      'Analytical strategist for equity markets, precious metals (gold, silver), foreign exchange, and cryptocurrency. Emphasizes risk management and macro indicators.',
    instructions: `You are an expert quantitative and macroeconomic research strategist.
SCOPE:
- Stocks, precious metals (Gold, Silver COMEX/MCX), FX, and Crypto assets.
- Ground all discussions in objective metrics: market cap, volume, yield curves, Fed policy, inflation, and spot vs futures spreads.
- Always differentiate spot prices from derivative futures contracts and currencies (INR vs USD).
- Risk disclaimer: Provide research and educational analysis; explicitly note that this is not financial or investment advice.`,
    category: 'finance',
  },
  {
    id: 'agent_satchida_executive_assistant',
    name: 'Office & Professional Executive Assistant',
    description:
      'Productivity and communications copilot for corporate and office professionals. Drafting executive memos, meeting briefs, project plans, and Excel/data workflows.',
    instructions: `You are a high-efficiency executive operations assistant.
DELIVERABLES:
- Crisp, executive-ready emails, memos, status updates, and action item trackers.
- Structured meeting agendas, decision frameworks, and presentation outlines.
- Spreadsheet formulas, tabular data modeling, and process workflow optimization.
- Style: Polished, concise, actionable, and strictly business-appropriate.`,
    category: 'productivity',
  },
  {
    id: 'agent_satchida_homemaker_assistant',
    name: 'Homemaker & Family Wellness Specialist',
    description:
      'Practical companion for homemakers and families: household budget management, meal planning, nutrition, family scheduling, and domestic productivity.',
    instructions: `You are a warm, highly practical family wellness and household management companion.
SUPPORT AREAS:
- Balanced weekly meal planning, grocery inventory optimization, and healthy family recipes.
- Household budgeting, savings tracking, and everyday domestic expense management.
- Family health schedules, home organization routines, and stress-free domestic time management.
- Tone: Warm, empathetic, organized, practical, and solution-focused.`,
    category: 'lifestyle',
  },
  {
    id: ORCHESTRATOR_ID,
    name: 'Satchida Fleet Orchestrator',
    description:
      'Delegates work across specialist agents — legal, child safety, education tutor, market analyst, office assistant, and family specialist — and assembles one unified answer.',
    instructions: `You are the coordinator. You do the scoping and synthesis; specialists do the depth.

DELEGATE to these when the task clearly belongs to one of them:
  Indian Legal Researcher              — Indian law, statutes, regulations, Bare Acts
  Child Safety Officer                 — minors, school safety, consent, POCSO, statutory rules
  STEM Tutor (Maths, Physics, CS)      — student learning, science, math, coding, AI concepts
  Markets, Crypto & Financial Strategist — stocks, gold/silver, crypto, macro analysis
  Office & Professional Executive Assistant — corporate workflows, emails, meetings, Excel
  Homemaker & Family Wellness Specialist — meal plans, household budgets, domestic organization
  Tenant Administrator                 — tenant accounts, seats, licences, limits

HOW TO WORK:
1. Read the request and decide whether it needs a specialist at all.
2. Delegate with a self-contained brief. Each sub-agent runs in an isolated context.
3. Synthesise into ONE coherent answer with cross-verified facts. If sources or models cite different numbers (e.g. spot gold vs futures), explicitly explain the distinction rather than presenting contradictory figures.`,
    category: 'general',
    subagents: {
      enabled: true,
      allowSelf: false,
      agent_ids: [
        LEG_RESEARCHER_ID,
        SAFETY_OFFICER_ID,
        TENANT_ADMIN_ID,
        'agent_satchida_stem_tutor',
        'agent_satchida_financial_analyst',
        'agent_satchida_executive_assistant',
        'agent_satchida_homemaker_assistant',
      ],
    },
  },
];

/** LibreChat rejects requests without a browser User-Agent (middleware/uaParser). */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} -> HTTP ${response.status}: ${JSON.stringify(parsed).slice(0, 300)}`);
  }
  return parsed;
}

async function main() {
  if (!PASSWORD) {
    console.error(
      'Set SATCHIDA_ADMIN_PASSWORD in the environment (or .env) — this script logs in as the operator.\n' +
        'The password is never written to disk or logged.',
    );
    process.exit(1);
  }

  const auth = await api('/api/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = auth.token;
  console.log(`authenticated as ${auth.user?.name ?? EMAIL}`);

  const existing = await api('/api/agents?requiredPermission=1&limit=1000', { token });
  /* The create endpoint assigns its own agent id, so the stable key for
     idempotency is the agent NAME. Keying on the internal `id` field made every
     re-run create a duplicate instead of matching the existing agent. */
  const byName = new Map((existing.data ?? []).map((a) => [a.name, a]));

  const toCreate = AGENTS.filter((a) => !byName.has(a.name));
  const toUpdate = AGENTS.filter((a) => byName.has(a.name));

  console.log(
    `create: ${toCreate.length}  update: ${toUpdate.length}  (force=${FORCE}, dry-run=${DRY_RUN})`,
  );

  if (DRY_RUN) {
    for (const a of AGENTS) {
      console.log(`  ${(byName.has(a.name) ? (FORCE ? 'UPDATE' : 'skip') : 'CREATE').padEnd(6)} ${a.id}`);
    }
    return;
  }

  // Specialists must exist before the orchestrator, and the orchestrator's
  // `subagents.agent_ids` must reference the ids the server ACTUALLY assigned.
  // The create endpoint generates its own agent id and rejects a reference to an
  // id that does not exist, so the real ids are threaded through here rather
  // than assumed.
  /** @type {Map<string, string>} satchida id -> server-assigned agent id */
  const resolvedIds = new Map();

  for (const agent of [...AGENTS].sort((a, b) => Number(!!a.subagents) - Number(!!b.subagents))) {
    const existingAgent = byName.get(agent.name);

    if (existingAgent) {
      resolvedIds.set(agent.id, existingAgent.id);

      /* A delegation graph is resolved by reference, so it is re-derived on every
         run rather than treated as optional content. Leaving it stale is exactly
         how an orchestrator ends up pointing at agents that no longer exist. */
      const patchBody = {
        name: agent.name,
        description: agent.description,
        instructions: agent.instructions,
      };
      if (agent.subagents) {
        patchBody.subagents = {
          ...agent.subagents,
          agent_ids: agent.subagents.agent_ids.map((targetId) => {
            const resolved = resolvedIds.get(targetId);
            if (!resolved) {
              throw new Error(
                `Cannot wire subagent "${agent.id}": target "${targetId}" was not found first.`,
              );
            }
            return resolved;
          }),
        };
      }

      if (!FORCE && !agent.subagents) {
        console.log(`  skip    ${agent.id} -> ${existingAgent.id}`);
        continue;
      }
      await api(`/api/agents/${encodeURIComponent(existingAgent.id)}`, {
        method: 'PATCH',
        token,
        body: patchBody,
      });
      console.log(`  ${FORCE ? 'UPDATED' : 'REWIRED'} ${agent.id} -> ${existingAgent.id}`);
      continue;
    }

    const body = {
      name: agent.name,
      description: agent.description,
      instructions: agent.instructions,
      provider: PROVIDER,
      model: MODEL,
      category: agent.category,
      is_promoted: true,
    };

    if (agent.subagents) {
      const targetIds = agent.subagents.agent_ids.map((id) => {
        const resolved = resolvedIds.get(id);
        if (!resolved) {
          throw new Error(
            `Cannot wire subagent "${agent.id}": target "${id}" was not created or found first.`,
          );
        }
        return resolved;
      });
      body.subagents = { ...agent.subagents, agent_ids: targetIds };
    }

    const created = await api('/api/agents', { method: 'POST', token, body });
    resolvedIds.set(agent.id, created.id);
    console.log(`  CREATED ${agent.id} -> ${created.id}  (${agent.name})`);
  }

  const after = await api('/api/agents?requiredPermission=1&limit=1000', { token });
  const present = new Set((after.data ?? []).map((a) => a.id));
  const missing = AGENTS.filter((a) => !present.has(resolvedIds.get(a.id)));

  console.log(`\nvisible in the marketplace: ${AGENTS.length - missing.length}/${AGENTS.length}`);
  for (const a of AGENTS) {
    const id = resolvedIds.get(a.id);
    console.log(`  ${id && present.has(id) ? 'OK  ' : 'MISS'} ${a.name.padEnd(32)} ${id ?? '(none)'}`);
  }
  if (missing.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});