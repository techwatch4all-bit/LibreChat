const {
  handleError,
  applyModelSpecPreset,
  resolveModelSpecForEndpoint,
  resolveModelSpecPromptPrefixVariables,
  inspectContent,
  extractChatContent,
  contentFilterBlockResponse,
} = require('@librechat/api');
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

  const allowedSpecs = [
    'Chat',
    'Work',
    'VibeCoder',
    'Vibecoding',
    'Study',
    'Study-Local',
    'Privacy',
    'Motion',
    'SceneMosaic',
    'DeepTutor',
    'Health-Wellness',
    'Panchang-Vedic',
    'Architect-Studio',
    'Maker-Hardware',
    'Document-Vault',
    'Office-Suite',
    'Pro',
  ];

  // Studio and advanced tools strictly require Pro, Pro_Family, Enterprise, or Privacy tier
  const STUDIO_SPECS = new Set([
    'motion',
    'scenemosaic',
    'deeptutor',
    'health-wellness',
    'panchang-vedic',
    'architect-studio',
    'maker-hardware',
    'document-vault',
    'office-suite',
    'vibecoding',
    'vibecoder',
    'pro',
  ]);

  const userAccountType = String(req.user?.accountType || '').toLowerCase();
  const isProTier = ['pro', 'pro_family', 'enterprise', 'privacy'].includes(userAccountType);

  const isByokOrAgent =
    req.body.endpoint === 'openAI' ||
    req.body.endpoint === 'anthropic' ||
    req.body.endpoint === 'agents' ||
    Boolean(req.body.agent_id);

  // Tenant Admin and ordinary users cannot use BYOK keys to bypass paywalled Satchida tools
  if (!isOperator && isByokOrAgent) {
    return res.status(403).json({
      error: 'External cloud API keys (BYOK) are restricted to super administrators.',
    });
  }

  if (!isOperator && !isByokOrAgent) {
    const requestedSpec = typeof req.body.spec === 'string' ? req.body.spec : undefined;
    const requestedModel = typeof req.body.model === 'string' ? req.body.model : undefined;
    const spec =
      requestedSpec ?? (allowedSpecs.includes(requestedModel) ? requestedModel : undefined);
    if (!spec || !allowedSpecs.includes(spec)) {
      return res.status(403).json({
        error: 'A Satchida mode (Chat, Work, VibeCoder, Study, Privacy, or Motion) is required',
      });
    }

    // Backend paywall enforcement: block lower tiers from invoking studio tools
    if (STUDIO_SPECS.has(spec.toLowerCase()) && !isProTier) {
      return res.status(403).json({
        error: `Satchida Studio tool '${spec}' requires a Pro, Pro_Family, or Privacy subscription. Upgrade your plan to access this studio.`,
      });
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
