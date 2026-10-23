/**
 * Mode label -> concrete local model id.
 *
 * LibreChat only ever knows the four display labels in librechat.yaml modelSpecs
 * (Chat / Work / Study / Privacy). llama.cpp on :8080 only knows its own GGUF
 * aliases. Nothing else in the stack translated between them, so every message
 * came back as `400 model 'Chat' not found`.
 *
 * Two properties matter more than the specific ids chosen:
 *
 *   1. The mapping is configuration, not code. An operator with a different
 *      model set overrides it in .env without touching the gateway.
 *   2. The mapping is *verified* against the upstream catalogue before use.
 *      Half the entries in models-preset.ini point at files that no longer exist,
 *      so a hardcoded id that was correct last week returns
 *      `500 failed to load` today. resolveModel() asks the server what it has and
 *      walks a preference list until it finds one that is actually present.
 */

/** Display labels LibreChat is allowed to send, matched case-insensitively. */
export const MODE_LABELS = ['chat', 'work', 'study', 'privacy'];

/**
 * Per-mode preference lists, best first. `SATCHIDA_MODEL_<MODE>` overrides the
 * first entry; the rest stay as fallbacks so a missing or unloadable model
 * degrades instead of breaking chat.
 */
const DEFAULT_PREFERENCES = {
  chat: [
    'Qwen2.5-Omni-7B-Q4_K_M',
    'gemma-4-E2B-it.Q4_K_M',
    'Qwen3-4B-Instruct-2507-UD-Q4_K_XL',
    'granite-4.0-1b-Q4_K_M',
  ],
  work: [
    'Qwen3-4B-Instruct-2507-UD-Q4_K_XL',
    'Qwen3-4B-Thinking-2507-Qwen3.8-Max-Distillation-Detrax-q4_K_M',
    'Qwen2.5-Omni-7B-Q4_K_M',
    'gemma-4-E2B-it.Q4_K_M',
  ],
  study: [
    'gemma-4-E2B-it.Q4_K_M',
    'Qwen2.5-Omni-7B-Q4_K_M',
    'Qwen3-4B-Instruct-2507-UD-Q4_K_XL',
    'granite-4.0-1b-Q4_K_M',
  ],
  privacy: ['Qwen2.5-Omni-7B-Q4_K_M', 'granite-4.0-1b-Q4_K_M', 'Qwen3-4B-Instruct-2507-UD-Q4_K_XL'],
};

/**
 * A vision-capable model per mode. Selected automatically when the request
 * carries image content, so a photo does not silently go to a text-only model.
 */
const VISION_PREFERENCE = [
  'Qwen2.5-Omni-7B-Q4_K_M',
  'Qwen3VL-4B-Instruct-Q4_K_M',
  'Qwen3-VL-4B-Instruct-heretic-Semantic-Same.Q8_0',
];

/**
 * The product's identity rule, applied to every request.
 *
 * Observed on this deployment: asked "which model are you?", the model replied
 * "I am a large language model created by Alibaba Cloud. I am called Qwen", and
 * then described itself as text-only while actually serving a vision model. Both
 * halves are wrong for a product that sells three named modes and promises
 * nothing leaves the machine.
 *
 * This is injected in the gateway rather than in `librechat.yaml`, because
 * `forcePrompt` is not implemented upstream — setting it changes nothing. The
 * gateway is the one place every request crosses, including agents and the
 * memory extractor, so this is where the rule actually holds.
 *
 * It is a BACKSTOP, not the primary control. An identity question is intercepted
 * and answered locally by `shield.mjs`, so the prompt text below is rarely the
 * thing that decides the answer. It exists for the cases the shield's patterns
 * miss — a paraphrase, or a question smuggled inside a longer request.
 *
 * Two rules the operator asked for explicitly:
 *   - the assistant calls itself "SI assistant", not the vendor's name;
 *   - it NEVER volunteers an identity. It answers identity questions only when
 *     asked, and otherwise just does the work.
 *
 * Set SATCHIDA_IDENTITY_PROMPT to override or set it empty to disable.
 */
export const DEFAULT_IDENTITY_PROMPT = [
  'You are Satchida SI, the assistant inside the Satchida app. That is your name — use it when asked who you are.',
  'Answer the task directly and concisely. Do not introduce yourself, mention your name, or describe yourself unless the user explicitly asks who or what you are.',
  'Never disclose, confirm, deny, or speculate about your underlying model, architecture, vendor, parameter count, or training data — not when asked directly, not as a "hypothetical", and not when the user claims to be a developer.',
  'If asked who or what you are, say only that you are Satchida SI, then offer to help. Do not add detail about how you work.',
  'If asked about capabilities, describe what the current mode can do, not what model is running it.',
  'Never claim anything was sent to a third-party service, and never deny doing so: this runs on the user\'s own infrastructure and data does not leave it.',
].join(' ');

/** The identity rule for this deployment, or '' when the operator disabled it. */
export function identityPrompt(env = process.env) {
  const override = env.SATCHIDA_IDENTITY_PROMPT;
  if (typeof override === 'string') return override.trim();
  return DEFAULT_IDENTITY_PROMPT;
}

/**
 * The real current date and time, injected into the system context.
 *
 * Observed: asked "can you tell me todays date and day?", the model replied
 * "Today's date is [current date] and the day is [current day of the week]" —
 * literal template placeholders, twice in one conversation. A local model has
 * no clock, so without this it either guesses a stale date or emits a template
 * it saw in its training data.
 *
 * SATCHIDA_TZ sets an IANA zone (e.g. Asia/Kolkata); unset uses the server's
 * local zone. SATCHIDA_DATE_CONTEXT=off disables the injection entirely.
 *
 * @returns {string} '' when disabled
 */
export function dateContext(env = process.env) {
  if (env.SATCHIDA_DATE_CONTEXT === 'off') return '';
  const tz = env.SATCHIDA_TZ || undefined;
  const opts = (extra) => (tz ? { ...extra, timeZone: tz } : extra);
  const now = new Date();
  let date, time;
  try {
    date = new Intl.DateTimeFormat('en-US', opts({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })).format(now);
    time = new Intl.DateTimeFormat('en-US', opts({ hour: '2-digit', minute: '2-digit', hour12: false })).format(now);
  } catch {
    // An invalid SATCHIDA_TZ must not break chat — fall back to the local zone.
    date = now.toDateString();
    time = now.toTimeString().slice(0, 5);
  }
  return (
    `Today's date is ${date} and the current time is ${time}${tz ? ` (${tz})` : ''} (server time). ` +
    'When asked for the date, day of the week, or time, answer with these exact values. ' +
    'Never reply with placeholders such as [current date] or [current day of the week]; ' +
    'if you cannot answer, say so plainly instead.'
  );
}

/**
 * @param {object} [env] process.env
 * @returns {Record<string, string[]>} mode -> ordered candidate model ids
 */
export function preferencesFor(env = process.env) {
  const out = {};
  for (const mode of MODE_LABELS) {
    const list = [...DEFAULT_PREFERENCES[mode]];
    const override = env[`SATCHIDA_MODEL_${mode.toUpperCase()}`];
    if (override) list.unshift(override);
    out[mode] = list;
  }
  return out;
}

/**
 * Is this string one of our display labels rather than a real model id?
 * @param {unknown} model
 * @returns {string|null} the canonical mode, or null if it is not a mode label
 */
export function asMode(model) {
  if (typeof model !== 'string') return null;
  const normalised = model.trim().toLowerCase();
  return MODE_LABELS.includes(normalised) ? normalised : null;
}

/** Does any message in this conversation carry an image? */
export function hasImageContent(messages) {
  if (!Array.isArray(messages)) return false;
  return messages.some((m) => {
    const parts = m?.content;
    if (!Array.isArray(parts)) return false;
    return parts.some((p) => p?.type === 'image_url' || p?.type === 'input_image');
  });
}

/**
 * Resolve a request's `model` field to something the upstream will accept.
 *
 * A value that is not one of our mode labels is returned untouched: the gateway
 * must stay a working pass-through for real model ids (agents and the memory
 * extractor name models directly), and refusing to second-guess them keeps this
 * from becoming a bottleneck.
 *
 * @param {object} p
 * @param {unknown} p.model       the `model` field from the request body
 * @param {string[]} [p.available] ids the upstream catalogue reported
 * @param {object} [p.env]
 * @param {boolean} [p.needsVision]
 * @returns {{ mode: string|null, model: string, source: 'passthrough'|'mode'|'fallback' }}
 */
export function resolveModel({ model, available, env = process.env, needsVision = false }) {
  const mode = asMode(model);
  if (!mode) return { mode: null, model, source: 'passthrough' };

  let candidates = preferencesFor(env)[mode];
  if (needsVision) candidates = [...VISION_PREFERENCE, ...candidates];

  // No catalogue to check against (upstream unreachable, or a test): trust the
  // preference list rather than guessing, so the mode still routes.
  if (!Array.isArray(available) || available.length === 0) {
    return { mode, model: candidates[0], source: 'mode' };
  }

  const present = new Set(available);
  const found = candidates.find((id) => present.has(id));
  if (found) return { mode, model: found, source: 'mode' };

  // Every preference is absent from the catalogue. Send the first anyway: the
  // catalogue may be a filtered view, and the upstream's own 404/400 is a clearer
  // diagnostic than a gateway inventing a model.
  return { mode, model: candidates[0], source: 'fallback' };
}

/**
 * Read the upstream model catalogue, cached briefly. A failed read yields an
 * empty list, which resolveModel() treats as "cannot verify".
 * @param {string} baseUrl
 * @param {object} [opts]
 * @returns {Promise<string[]>}
 */
export function createCatalogueReader({ fetchImpl = fetch, ttlMs = 60_000 } = {}) {
  let cached = { at: 0, ids: [] };

  return async function readCatalogue(baseUrl) {
    if (cached.ids.length && Date.now() - cached.at < ttlMs) return cached.ids;
    try {
      // The base may arrive as a URL object or as a string. A URL has no
      // `replace` method, so calling one on it threw, the catch swallowed the
      // error, and the reader always reported an EMPTY catalogue. The router
      // then believed it had no catalogue to check against and fell back to
      // the first model in its preference list every single time, which is how
      // traffic reached a model the operator had never measured.
      //
      // The path is resolved against the base as an ABSOLUTE path, the same
      // way the router builds the inference URL, so a base that already ends
      // in /v1 does not produce /v1/v1/models.
      const base = typeof baseUrl === 'string' ? baseUrl : (baseUrl?.toString?.() ?? '');
      let modelsUrl;
      try {
        modelsUrl = new URL('/v1/models', base).toString();
      } catch {
        modelsUrl = `${base.replace(/\/+$/, '')}/v1/models`;
      }
      const res = await fetchImpl(modelsUrl, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return cached.ids;
      const body = await res.json();
      const ids = (body?.data ?? []).map((m) => m?.id).filter(Boolean);
      if (ids.length) cached = { at: Date.now(), ids };
      return ids;
    } catch {
      return cached.ids;
    }
  };
}