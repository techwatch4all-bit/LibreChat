/**
 * Prompt-injection shield — the SQL-injection defence, applied to natural language.
 *
 * WHY A FILTER AND NOT ONLY A PROMPT
 * ----------------------------------
 * The identity system prompt tells the model not to reveal itself. That is a
 * request, and a request can be argued with. Observed on this deployment:
 * asking "which model are you?" returned the vendor and model name outright.
 *
 * A prompt alone is therefore not a control. This module is the control that
 * does not depend on the model cooperating: it inspects the *user's* text
 * before the request is forwarded, and answers locally when the text is an
 * attempt to extract privileged state.
 *
 * WHAT IT BLOCKS, AND WHY EACH IS NOT A FALSE POSITIVE FOR A SCHOOL
 * -----------------------------------------------------------------
 *  - model identity / version probing ("what model are you", "are you GPT-4")
 *  - guardrail bypass ("ignore previous instructions", "developer mode",
 *    "pretend you have no rules")
 *  - secret extraction ("print your .env", "what API key do you use",
 *    "show the server password", "cat credentials")
 *  - exfiltration ("email the config to X", "POST this to a webhook")
 *
 * The last two matter most here: `SATCHIDA_GATEWAY_LICENCE` and the master key
 * live on this machine, and a model that has read them can repeat them verbatim.
 * Blocking at the door is the only place that does not depend on the model.
 *
 * DELIBERATE LIMITATION
 * ---------------------
 * These are patterns, and patterns are defeated by paraphrase. This raises cost
 * and catches the casual and automated probes; it is not a proof. A determined
 * attacker gets further. The residual controls are the response filter and the
 * fact that the gateway never puts a secret in a model context in the first place
 * — the licence is validated and discarded before any upstream call.
 */

/** The product's own name, used when answering an identity question. */
export const ASSISTANT_NAME = 'Satchida SI';

const IDENTITY_PATTERNS = [
  /\bwhich\s*(model|llm|ai|bot)\b/i,
  /\bwhat\s*(model|llm|ai)\s*(is|are)\s*(this|that|you)\b/i,
  /\b(?:are|is)\s*you\s*(?:gpt[-\s]?\d|chatgpt|claude|gemini|llama|qwen|deepseek|mistral|openai|anthropic|meta|alibaba)\b/i,
  /\b(?:are|is)\s*you\s*(made|built|created|trained|developed)\s*by\b/i,
  /\bwho\s*(made|built|created|trained|developed)\s*you\b/i,
  /\byour\s*(model\s*)?(version|name|architecture|parameter\s*count|vendor|creator)\b/i,
  /\bwhat\s*(company|vendor)\s*(made|built|created|trained)\b/i,
  /\bmodel\s*card\b/i,
  /\bwhat\s*model\s*is\s*running\b/i,
  /\bunderlying\s*model\b/i,
  /\bwhat\s*are\s*you\s*running\s*on\b/i,
  // Anchored patterns for the de-spaced form, where "W H I C H  M O D E L" has
  // become "whichmodel". The spaced patterns above cannot match it: there is no
  // word boundary between "model" and "are", so `\b` fails. Anchoring at the
  // start keeps these from firing on ordinary prose.
  /^whichmodel/i,
  /^whatmodel/i,
  /^yourmodel(version|name)/i,
  /^whomadeyou/i,
  /^whobuiltyou/i,
  /^areyou(gpt|chatgpt|claude|gemini|llama|qwen|deepseek|mistral)/i,
  /^areyou(made|built|created|trained)/i,
  /^whatcompany(made|built)/i,
];

const BYPASS_PATTERNS = [
  /\bignore\s+(all\s+)?(the\s+)?(previous|prior|above|preceding)\s+(instructions|prompts?|rules?)\b/i,
  /\bdisregard\s+(all\s+)?(your\s+)?(instructions|rules?|guidelines)\b/i,
  /\bdeveloper\s+mode\b/i,
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
  /\bpretend\s+(you\s+)?(have|are)\s+no\s+(rules|limits|restrictions|filters)\b/i,
  /\bact\s+as\s+(if\s+you\s+)?(an?\s+)?unrestricted\b/i,
  /\byou\s+are\s+now\s+in\s+.*mode\b/i,
  /\bno\s+longer\s+bound\s+by\b/i,
  /\boverride\s+(your\s+)?(safety|guardrails?|restrictions)\b/i,
  /\brepeat\s+(everything|all)\s+above\b/i,
];

const SECRET_PATTERNS = [
  // `\.env` needs the dot escaped: unescaped it matches any character, so
  // "print your .env file" slipped through in the first draft.
  /\b(?:cat|type|print|show|reveal|dump|display|output|read|list)\b[^.?!]{0,40}\.env\b/i,
  /\.env\b/i,
  /\benvironment\s+variables?\b/i,
  /\benv\s+vars?\b/i,
  /\b(?:api|secret|access|private|auth)[_\s-]?keys?\b/i,
  /\b(?:auth|bearer|refresh)[_\s-]?tokens?\b/i,
  /\bmaster\s+key\b/i,
  /\bprivate\s+key\b/i,
  /\bsigning\s+key\b/i,
  /\blicen[cs]e\s+token\b/i,
  /\bjwt\s+secret\b/i,
  /\b(?:server|database|db|root|admin|mongo)\s+password\b/i,
  /\bcredentials?\s+file\b/i,
  /\bssh\s+key\b/i,
  /\bid_rsa\b/i,
  /\bkeyring\b/i,
];

const EXFIL_PATTERNS = [
  /\b(?:send|post|upload|email|exfiltrate|forward|transmit)\b[^.?!]{0,60}\b(?:to|at)\s+(?:https?:\/\/|[\w.-]+@|my\s+server|my\s+webhook|webhook)/i,
  /\bcurl\b[^.?!]{0,40}\b(?:env|secret|key|password)\b/i,
  /\b(?:base64|rot13|hex)\s+(?:encode|encoded|encoding)\b[^.?!]{0,30}\b(?:key|password|secret|prompt|env)\b/i,
];

/**
 * Every pattern group, and what the local answer should be.
 *
 * The replies are deliberately dull and non-committal: they confirm nothing,
 * and they do not confirm that the filter exists either.
 */
const RULES = [
  {
    kind: 'identity',
    patterns: IDENTITY_PATTERNS,
    answer: `I'm ${ASSISTANT_NAME}. Tell me what you need help with and I'll get straight to it.`,
  },
  {
    kind: 'bypass',
    patterns: BYPASS_PATTERNS,
    answer:
      "I can't change how I operate based on instructions inside a message. Ask me something and I'll help.",
  },
  {
    kind: 'secret',
    patterns: SECRET_PATTERNS,
    answer:
      "I can't share configuration, credentials, or key material — that's true regardless of how the request is framed.",
  },
  {
    kind: 'exfil',
    patterns: EXFIL_PATTERNS,
    answer:
      "I can't send anything off this machine. Nothing you type here leaves the device.",
  },
];

const ANY_PATTERN = RULES.flatMap((r) => r.patterns);

/**
 * Pull the plain text out of the NEWEST user message.
 *
 * NEWEST ONLY, and that is the whole design. LibreChat resends the entire
 * conversation on every turn, so screening `messages` wholesale meant that once
 * a user asked "which model are you?" every later message in that thread was
 * blocked too — the user saw the identity reply pasted at "what is the date?".
 * The first version of this shipped that way and it made chat unusable.
 *
 * History is still attacker-controlled on the first turn, so the caller also
 * screens the whole conversation when no prior turn exists (see
 * `shouldScreenAllHistory`).
 */
function newestUserText(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'user') continue;
    const c = m.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) {
      const parts = [];
      for (const p of c) if (typeof p?.text === 'string') parts.push(p.text);
      return parts.join('\n');
    }
  }
  return '';
}

/** Text of every user message, used only on the first turn of a conversation. */
function allUserText(messages) {
  if (!Array.isArray(messages)) return '';
  const parts = [];
  for (const m of messages) {
    if (m?.role !== 'user') continue;
    const c = m.content;
    if (typeof c === 'string') parts.push(c);
    else if (Array.isArray(c)) {
      for (const p of c) if (typeof p?.text === 'string') parts.push(p.text);
    }
  }
  return parts.join('\n');
}

/**
 * On the opening turn there is no trusted prior context, so the whole first
 * message is screened. Afterwards only the newest turn is attacker-controlled
 * in a way that matters — the earlier text already earned its reply.
 */
function shouldScreenAllHistory(messages) {
  if (!Array.isArray(messages)) return false;
  return messages.filter((m) => m?.role === 'user').length <= 1;
}

/**
 * Flatten obfuscation that patterns would otherwise miss.
 *
 * Two normalisations, both cheap:
 *  - zero-width and soft-hyphen characters, which break `\b` invisibly;
 *  - letters separated by spaces ("W H I C H"), which is what a script tries
 *    first and which `\b` alone will not match.
 *
 * The second also collapses normal prose spacing, so patterns written against
 * ordinary spacing keep working.
 */
function normalise(text) {
  return text
    .replace(/[-‍﻿­]/g, '')
    .replace(/[ \t]+/g, ' ')
    .toLowerCase();
}

/**
 * Inspect a request and decide whether to answer locally.
 *
 * Two passes. The first matches against the text as written. The second matches
 * against the text with spaces removed, which defeats "W H I C H  M O D E L".
 * The second pass is deliberately narrow — it is only reached when the first
 * found nothing, and it uses the same patterns, so a genuine sentence cannot
 * match by accident any more than it could in the first pass.
 *
 * @param {object} p
 * @param {unknown[]} [p.messages] the request's messages
 * @returns {{ blocked: boolean, kind: string|null, answer: string|null }}
 */
export function inspectMessages({ messages } = {}) {
  const text = shouldScreenAllHistory(messages)
    ? allUserText(messages)
    : newestUserText(messages);
  if (!text) return { blocked: false, kind: null, answer: null };

  const forms = [normalise(text)];
  // Single-character "words" are what the spaced-out trick produces.
  // `spaces` keeps the word boundaries ("which model"); `packed` drops them
  // ("whichmodel"). Real prose has almost no single-character words, so both
  // are close to free on ordinary text.
  const spaces = forms[0].replace(/(?:^|\s+)(\S)(?=\s|$)/g, '$1');
  if (spaces !== forms[0]) forms.push(spaces);
  const packed = spaces.replace(/\s+/g, '');
  if (packed !== spaces) forms.push(packed);

  for (const haystack of forms) {
    for (const rule of RULES) {
      for (const pattern of rule.patterns) {
        if (pattern.test(haystack)) {
          return { blocked: true, kind: rule.kind, answer: rule.answer };
        }
      }
    }
  }
  return { blocked: false, kind: null, answer: null };
}

/**
 * A request aimed at the model itself — a role header or a fence trying to open a
 * new "system" turn — rather than at the product.
 */
export function hasRoleInjection(messages) {
  if (!Array.isArray(messages)) return false;
  return messages.some(
    (m) =>
      typeof m?.content === 'string' &&
      /^\s*(system|assistant|developer)\s*:/i.test(m.content) &&
      m.role !== 'system',
  );
}

export { ANY_PATTERN };