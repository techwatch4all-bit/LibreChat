const {
  handleError,
  applyModelSpecPreset,
  resolveModelSpecForEndpoint,
  resolveModelSpecPromptPrefixVariables,
  inspectContent,
  extractChatContent,
  contentFilterBlockResponse,
} = require('@librechat/api');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { hasOperatorControl } = require('~/server/middleware/roles/capabilities');
const {
  EndpointURLs,
  EModelEndpoint,
  isAgentsEndpoint,
  parseCompactConvo,
  getDefaultParamsEndpoint,
} = require('librechat-data-provider');
const azureAssistants = require('~/server/services/Endpoints/azureAssistants');
const assistants = require('~/server/services/Endpoints/assistants');
const { getEndpointsConfig } = require('~/server/services/Config');
const agents = require('~/server/services/Endpoints/agents');
const { updateFilesUsage } = require('~/models');

const buildFunction = {
  [EModelEndpoint.agents]: agents.buildOptions,
  [EModelEndpoint.assistants]: assistants.buildOptions,
  [EModelEndpoint.azureAssistants]: azureAssistants.buildOptions,
};

/**
 * Inspects only the user-authored value substituted for `{{current_user}}`.
 * The surrounding model-spec prompt is administrator-authored, so treating the
 * entire resolved prompt as user provenance would incorrectly apply user
 * content policy to static deployment configuration.
 *
 * `extractChatContent` deliberately gives prompt prefixes both prompt and
 * agent-instruction semantics, preserving the source-specific field controls
 * for the exact value that becomes model-bound.
 *
 * @param {ServerRequest} req
 * @param {unknown} promptPrefixTemplate
 * @returns {import('@librechat/api').ProtectionFinding | null}
 */
function inspectResolvedCurrentUser(req, promptPrefixTemplate) {
  if (
    typeof promptPrefixTemplate !== 'string' ||
    !/{{\s*current_user\s*}}/i.test(promptPrefixTemplate) ||
    !req.user?.name
  ) {
    return null;
  }

  return inspectContent(extractChatContent({ promptPrefix: String(req.user.name) }), {
    filters: req.config?.filters,
  });
}

/** Map a modelSpec name to the Satchida router mode label. */
const SPEC_TO_MODE = {
  Chat: 'Chat',
  Work: 'Work',
  VibeCoder: 'Work',
  Study: 'Study',
  Privacy: 'Privacy',
};

/** Cached lookup: is the current user a member of the "Demo" group? */
let demoMemberIds = null;
let demoCacheTime = 0;
const DEMO_CACHE_TTL = 60_000;

function getGroupModel() {
  try {
    return mongoose.models?.Group || mongoose.model('Group');
  } catch {
    return null;
  }
}

async function isDemoUser(userId) {
  if (!userId) return false;
  const now = Date.now();
  if (demoMemberIds && now - demoCacheTime < DEMO_CACHE_TTL) {
    return demoMemberIds.has(String(userId));
  }
  const Group = getGroupModel();
  if (!Group) {
    demoMemberIds = new Set();
    demoCacheTime = now;
    return false;
  }
  try {
    const demoGroup = await Group.findOne({ name: 'Demo' }).select('memberIds').lean();
    demoMemberIds = new Set((demoGroup?.memberIds || []).map(String));
    demoCacheTime = now;
    return demoMemberIds.has(String(userId));
  } catch (e) {
    logger.error('[buildEndpointOption] Failed to check Demo group membership', e);
    demoMemberIds = new Set();
    demoCacheTime = now;
    return false;
  }
}

async function buildEndpointOption(req, res, next) {
  req.body = req.body || {};
  let isOperator = false;
  try {
    isOperator = await hasOperatorControl({
      id: req.user?.id ?? req.user?._id?.toString(),
      role: req.user?.role ?? '',
      tenantId: req.user?.tenantId,
      idOnTheSource: req.user?.idOnTheSource ?? null,
    });
  } catch (error) {
    logger.error('[buildEndpointOption] Operator capability lookup failed', error);
    return res.status(500).json({ error: 'Unable to authorize model selection' });
  }

  const allowedSpecs = ['Chat', 'Work', 'VibeCoder', 'Study', 'Privacy'];
  if (!isOperator) {
    const requestedSpec = typeof req.body.spec === 'string' ? req.body.spec : undefined;
    const requestedModel = typeof req.body.model === 'string' ? req.body.model : undefined;
    const spec =
      requestedSpec ?? (allowedSpecs.includes(requestedModel) ? requestedModel : undefined);
    if (!spec || !allowedSpecs.includes(spec)) {
      return res
        .status(403)
        .json({ error: 'A Satchida mode (Chat, Work, VibeCoder, Study, or Privacy) is required' });
    }
    const configuredSpec = req.config?.modelSpecs?.list?.find((item) => item.name === spec);
    if (!configuredSpec?.preset) {
      return res.status(403).json({ error: 'This Satchida mode is not enabled for this tenant' });
    }
    // Ignore caller-supplied endpoint/model/endpointType: the server-owned
    // semantic spec is the only routing input a non-operator may choose.
    req.body.spec = spec;
    req.body.endpoint = configuredSpec.preset.endpoint;
    req.body.model = configuredSpec.preset.model;
    delete req.body.endpointType;
  } else {
    // If an operator supplies a spec or spec name as model, normalize to preset model
    const requestedSpec = typeof req.body.spec === 'string' ? req.body.spec : undefined;
    const requestedModel = typeof req.body.model === 'string' ? req.body.model : undefined;
    const matchedSpec =
      (requestedSpec && allowedSpecs.includes(requestedSpec) ? requestedSpec : undefined) ??
      (requestedModel && allowedSpecs.includes(requestedModel) ? requestedModel : undefined);
    if (matchedSpec) {
      const configuredSpec = req.config?.modelSpecs?.list?.find(
        (item) => item.name === matchedSpec,
      );
      if (configuredSpec?.preset) {
        req.body.spec = matchedSpec;
        if (!req.body.endpoint || allowedSpecs.includes(req.body.endpoint)) {
          req.body.endpoint = configuredSpec.preset.endpoint;
        }
        if (!req.body.model || allowedSpecs.includes(req.body.model)) {
          req.body.model = configuredSpec.preset.model;
        }
      }
    }
  }

  // Check demo group membership early; the redirect itself happens after
  // modelSpec preset application to avoid endpoint-mismatch errors during
  // resolveModelSpecForEndpoint (which checks spec.preset.endpoint against
  // the current endpoint).
  const isDemo = await isDemoUser(req.user?.id ?? req.user?._id?.toString());

  let { endpoint, endpointType } = req.body;
  const isAgents =
    isAgentsEndpoint(endpoint) || req.baseUrl.startsWith(EndpointURLs[EModelEndpoint.agents]);

  let endpointsConfig;
  try {
    endpointsConfig = await getEndpointsConfig(req);
  } catch (error) {
    logger.error('Error fetching endpoints config in buildEndpointOption', error);
  }

  const defaultParamsEndpoint = getDefaultParamsEndpoint(endpointsConfig, endpoint);

  /**
   * A named custom endpoint is not a schema key.
   *
   * `parseCompactConvo` picks the validation schema by endpoint key, and the
   * Satchida endpoints are named ("Satchida", "Satchida-Gateway") rather than
   * keyed, so the parser has to be told they are custom endpoints. Without this
   * every Satchida turn failed with "Error parsing conversation" /
   * "Unknown endpoint: Satchida" before it ever reached the provider.
   *
   * The type is derived from the server's own configured endpoint list and
   * never taken from the request. The endpoint name selects the route, and the
   * schema has to match the route; a caller must not be able to choose the
   * schema by sending a type. The caller-supplied type is still honoured for
   * every endpoint that is NOT a named custom endpoint, because those are
   * keyed and the caller's value is the only way to disambiguate them.
   */
  const customEndpointNames = new Set(
    (req.config?.endpoints?.custom ?? []).map((entry) => entry?.name).filter(Boolean),
  );
  if (endpoint != null && customEndpointNames.has(endpoint)) {
    endpointType = EModelEndpoint.custom;
    req.body.endpointType = endpointType;
  }

  let parsedBody;
  try {
    parsedBody = parseCompactConvo({
      endpoint,
      endpointType,
      conversation: req.body,
      defaultParamsEndpoint,
    });
  } catch (error) {
    logger.error('Error parsing compact conversation', error);
    return handleError(res, { text: 'Error parsing conversation' });
  }

  const appConfig = req.config;
  let appliedModelSpecPrivateFields = new Set();
  if (appConfig.modelSpecs?.list?.length && appConfig.modelSpecs?.enforce) {
    /** @type {{ list: TModelSpec[] }}*/
    const { list } = appConfig.modelSpecs;
    const rawSpec = req.body.spec;
    const spec = parsedBody.spec ?? (typeof rawSpec === 'string' ? rawSpec : undefined);
    const rawChatProjectId = req.body.chatProjectId;
    const parsedBodyForModelSpec =
      parsedBody.chatProjectId === undefined &&
      (typeof rawChatProjectId === 'string' || rawChatProjectId === null)
        ? { ...parsedBody, chatProjectId: rawChatProjectId }
        : parsedBody;

    if (!spec) {
      return handleError(res, { text: 'No model spec selected' });
    }

    const modelSpecResolution = resolveModelSpecForEndpoint({
      modelSpecs: { list },
      spec,
      endpoint,
    });
    if ('error' in modelSpecResolution) {
      return handleError(res, {
        text:
          modelSpecResolution.error === 'invalid-model-spec'
            ? 'Invalid model spec'
            : 'Model spec mismatch',
      });
    }
    const { modelSpec: currentModelSpec } = modelSpecResolution;

    try {
      const result = applyModelSpecPreset({
        modelSpec: currentModelSpec,
        parsedBody: parsedBodyForModelSpec,
        endpoint,
        endpointType,
        defaultParamsEndpoint,
        includePresetDefaults: true,
      });
      parsedBody = result.parsedBody;
      appliedModelSpecPrivateFields = result.appliedPrivateFields;
    } catch (error) {
      logger.error('Error parsing model spec', error);
      return handleError(res, { text: 'Error parsing model spec' });
    }
  } else if (parsedBody.spec && appConfig.modelSpecs?.list) {
    const modelSpecResolution = resolveModelSpecForEndpoint({
      modelSpecs: appConfig.modelSpecs,
      spec: parsedBody.spec,
      endpoint,
    });
    if ('modelSpec' in modelSpecResolution) {
      const { modelSpec } = modelSpecResolution;

      try {
        const result = applyModelSpecPreset({
          modelSpec,
          parsedBody,
          endpoint,
          endpointType,
          defaultParamsEndpoint,
        });
        parsedBody = result.parsedBody;
        appliedModelSpecPrivateFields = result.appliedPrivateFields;
      } catch (error) {
        logger.error('Error parsing model spec', error);
        return handleError(res, { text: 'Error parsing model spec' });
      }
    } else if (modelSpecResolution.error === 'model-spec-mismatch') {
      return handleError(res, { text: 'Model spec mismatch' });
    }
  }

  // --- Demo group routing: redirect Satchida-Gateway → Satchida for demo users ---
  // Done AFTER modelSpec preset application so resolveModelSpecForEndpoint sees
  // the original endpoint ("Satchida-Gateway") and doesn't fail on mismatch.
  // Demo users never hit paid DeepInfra models. They are routed through the
  // Satchida endpoint (Fleet Gateway :4000) with the x-satchida-client: demo
  // header, which the gateway uses to route to the Satchida Router (:4001) for
  // free-first/local-fallback mode resolution per clientOverrides in registry.json.
  if (isDemo && endpoint === 'Satchida-Gateway') {
    const modeLabel = SPEC_TO_MODE[req.body.spec] || req.body.spec;
    endpoint = 'Satchida';
    req.body.endpoint = 'Satchida';
    parsedBody.endpoint = 'Satchida';
    req.body.model = modeLabel;
    parsedBody.model = modeLabel;
    delete parsedBody.endpointType;
    logger.info('[buildEndpointOption] Demo user redirected to Satchida router', {
      spec: req.body.spec,
      userId: req.user?.id ?? req.user?._id?.toString(),
    });
  }

  if (!isAgents && appliedModelSpecPrivateFields.has('promptPrefix')) {
    const promptPrefixTemplate = parsedBody.promptPrefix;
    parsedBody = resolveModelSpecPromptPrefixVariables(
      parsedBody,
      req.user,
      req.body.clientTimestamp,
    );
    const finding = inspectResolvedCurrentUser(req, promptPrefixTemplate);
    if (finding != null) {
      return res.status(400).json(contentFilterBlockResponse(finding));
    }
  }

  try {
    const builder = isAgents
      ? (...args) => buildFunction[EModelEndpoint.agents](req, ...args)
      : buildFunction[endpointType ?? endpoint];

    // TODO: use object params
    req.body = req.body || {}; // Express 5: ensure req.body exists
    req.body.endpointOption = await builder(endpoint, parsedBody, endpointType);

    // Inject the per-client header so the Fleet Gateway routes demo users through
    // the Satchida Router for free-first/local-fallback mode resolution.
    if (isDemo) {
      req.body.endpointOption.headers = {
        ...(req.body.endpointOption.headers || {}),
        'x-satchida-client': 'demo',
      };
    }

    if (req.body.files && !isAgents) {
      req.body.endpointOption.attachments = updateFilesUsage(req.body.files, undefined, {
        user: req.user.id,
        tenantId: req.user.tenantId,
      });
    }

    next();
  } catch (error) {
    logger.error('Error building endpoint option', error);
    return handleError(res, { text: 'Error building endpoint option' });
  }
}

module.exports = buildEndpointOption;
