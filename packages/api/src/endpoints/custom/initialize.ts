import { Providers } from '@librechat/agents';
import { logger } from '@librechat/data-schemas';
import {
  ErrorTypes,
  envVarRegex,
  EModelEndpoint,
  FetchTokenConfig,
  extractEnvVariable,
} from 'librechat-data-provider';
import type { AppConfig, IUser } from '@librechat/data-schemas';
import type { TEndpoint } from 'librechat-data-provider';
import type {
  InitializeResultBase,
  EndpointTokenConfig,
  AnthropicModelOptions,
  ProviderInitializeParams,
} from '~/types';
import { getLLMConfig as getAnthropicLLMConfig } from '~/endpoints/anthropic/llm';
import { resolveModelTransportTimeouts } from '~/agents/config';
import { extractDefaultParams } from '~/endpoints/openai/llm';
import { isUserProvided, checkUserKeyExpiry } from '~/utils';
import { getOpenAIConfig } from '~/endpoints/openai/config';
import { getScopedTokenConfigKey } from '~/endpoints/keys';
import { getCustomEndpointConfig } from '~/app/config';
import { resolveEndpointRuntime } from '~/types';
import { fetchModels } from '~/endpoints/models';
import { validateEndpointURL } from '~/auth';
import { tokenConfigCache } from '~/cache';

const { PROXY } = process.env;

function getTenantTokenScope(tenantId?: string | null): string {
  const normalizedTenantId = typeof tenantId === 'string' ? tenantId.trim() : '';
  return normalizedTenantId;
}

/**
 * Cache key for an endpoint's fetched token config. User-scoped when the
 * model fetch can resolve per-user: user-provided key/URL, or header
 * templates forwarded against an admin-trusted base URL â€” making the
 * response, and therefore the derived token config, user-specific. Otherwise
 * tenant-scoped when a tenant id is available because custom endpoint config
 * is resolved per tenant.
 */
export function getTokenConfigKey(
  endpointConfig: Partial<TEndpoint>,
  endpoint: string,
  userId: string,
  tenantId?: string | null,
): string {
  const hasTokenConfig = endpointConfig.tokenConfig != null;
  if (hasTokenConfig) {
    return endpoint;
  }

  const userProvidesKey = isUserProvided(extractEnvVariable(endpointConfig.apiKey ?? ''));
  const userProvidesURL = isUserProvided(extractEnvVariable(endpointConfig.baseURL ?? ''));
  const willForwardUserScopedHeaders = !!endpointConfig?.headers && !userProvidesURL;
  const tenantScope = getTenantTokenScope(tenantId);

  if (userProvidesKey || userProvidesURL || willForwardUserScopedHeaders) {
    return tenantScope
      ? getScopedTokenConfigKey('tenant-user', [tenantScope, endpoint, userId])
      : `${endpoint}:${userId}`;
  }

  return tenantScope ? getScopedTokenConfigKey('tenant', [tenantScope, endpoint]) : endpoint;
}

/**
 * Maps an admin-facing static `tokenConfig` to the billing shape: the UI uses
 * `cacheWrite`/`cacheRead`, but `getCacheMultiplier` indexes `write`/`read`.
 * Adds those keys (preserving the originals) so cache tokens bill at the
 * configured rate instead of the prompt-rate fallback.
 */
function toBillingTokenConfig(
  tokenConfig: Record<string, Record<string, number>>,
): EndpointTokenConfig {
  const result: EndpointTokenConfig = {};
  for (const [model, rates] of Object.entries(tokenConfig)) {
    const mapped = { ...rates } as Record<string, number>;
    if (rates.cacheWrite != null) {
      mapped.write = rates.cacheWrite;
    }
    if (rates.cacheRead != null) {
      mapped.read = rates.cacheRead;
    }
    result[model] = mapped as EndpointTokenConfig[string];
  }
  return result;
}

/**
 * Builds custom options from endpoint configuration
 */
function buildCustomOptions(
  endpointConfig: Partial<TEndpoint>,
  appConfig?: AppConfig,
  endpointTokenConfig?: Record<string, unknown>,
  forwardHeaders = true,
) {
  const customOptions: Record<string, unknown> = {
    addParams: endpointConfig.addParams,
    dropParams: endpointConfig.dropParams,
    customParams: endpointConfig.customParams,
    titleConvo: endpointConfig.titleConvo,
    titleModel: endpointConfig.titleModel,
    modelDisplayLabel: endpointConfig.modelDisplayLabel,
    titleMethod: endpointConfig.titleMethod ?? 'completion',
    directEndpoint: endpointConfig.directEndpoint,
    titleMessageRole: endpointConfig.titleMessageRole,
    streamRate: endpointConfig.streamRate,
    endpointTokenConfig,
  };

  if (forwardHeaders) {
    customOptions.headers = endpointConfig.headers;
  }

  const allConfig = appConfig?.endpoints?.all;
  if (allConfig?.streamRate != null) {
    customOptions.streamRate = allConfig.streamRate;
  }

  return customOptions;
}

/**
 * Builds a native Anthropic (`/v1/messages`) config for a custom endpoint that
 * declares `provider: anthropic`, pointing the Anthropic client at the custom
 * `baseURL`/`apiKey`. Returns `provider: anthropic` so the agent uses the native
 * Anthropic client instead of the OpenAI-compatible one. Headers stay unresolved
 * here and resolve at request time via `resolveConfigHeaders`.
 */
function buildAnthropicCustomConfig({
  apiKey,
  baseURL,
  modelOptions,
  endpointConfig,
  userProvidesURL,
  allowedAddresses,
}: {
  apiKey: string;
  baseURL: string;
  modelOptions: AnthropicModelOptions;
  endpointConfig: Partial<TEndpoint>;
  userProvidesURL: boolean;
  allowedAddresses?: string[] | null;
}): InitializeResultBase {
  const result = getAnthropicLLMConfig(apiKey, {
    modelOptions,
    proxy: PROXY ?? undefined,
    reverseProxyUrl: baseURL,
    baseURLIsUserProvided: userProvidesURL,
    allowedAddresses,
    headers: userProvidesURL ? undefined : endpointConfig.headers,
    addParams: endpointConfig.addParams,
    dropParams: endpointConfig.dropParams,
    /** Apply admin `customParams.paramDefinitions` defaults (e.g. promptCache,
     *  web_search, thinking) the OpenAI-compatible path gets via `getOpenAIConfig`. */
    defaultParams: extractDefaultParams(endpointConfig.customParams?.paramDefinitions),
  });
  return {
    llmConfig: result.llmConfig as InitializeResultBase['llmConfig'],
    tools: result.tools,
    provider: Providers.ANTHROPIC,
  };
}

/**
 * Initializes a custom endpoint client configuration.
 * This function handles custom endpoints defined in librechat.yaml, including
 * user-provided API keys and URLs.
 *
 * @param params - Configuration parameters
 * @returns Promise resolving to endpoint configuration options
 * @throws Error if config is missing, API key is not provided, or base URL is missing
 */
export async function initializeCustom(
  params: ProviderInitializeParams,
): Promise<InitializeResultBase> {
  const { endpoint, model_parameters, db } = params;
  const { appConfig, user, requestBody } = resolveEndpointRuntime(params);
  const { key: expiresAt } = requestBody;

  const endpointConfig = getCustomEndpointConfig({
    endpoint,
    appConfig,
  });

  if (!endpointConfig) {
    throw new Error(`Config not found for the ${endpoint} custom endpoint.`);
  }

  const CUSTOM_API_KEY = extractEnvVariable(endpointConfig.apiKey ?? '');
  const CUSTOM_BASE_URL = extractEnvVariable(endpointConfig.baseURL ?? '');

  if (CUSTOM_API_KEY.match(envVarRegex)) {
    throw new Error(`Missing API Key for ${endpoint}.`);
  }

  if (CUSTOM_BASE_URL.match(envVarRegex)) {
    throw new Error(`Missing Base URL for ${endpoint}.`);
  }

  const userProvidesKey = isUserProvided(CUSTOM_API_KEY);
  const userProvidesURL = isUserProvided(CUSTOM_BASE_URL);

  // Expiry is only checked when present: the Agents API sends an OpenAI-compatible
  // request body that does not include `key` (the expiry timestamp), so expiresAt
  // will be undefined in that flow. The key is still fetched regardless.
  if (expiresAt && (userProvidesKey || userProvidesURL)) {
    checkUserKeyExpiry(expiresAt, endpoint);
  }

  let userValues = null;
  if (userProvidesKey || userProvidesURL) {
    userValues = await db.getUserKeyValues({ userId: user?.id ?? '', name: endpoint });
  }

  const requestedModel = typeof model_parameters?.model === 'string' ? model_parameters.model : '';
  const satchidaMode = typeof requestBody.model === 'string' ? requestBody.model : requestedModel;
  const normalizedMode = satchidaMode.trim().toLowerCase();
  const isSatchidaEndpoint =
    endpoint.toLowerCase() === 'satchida' || endpoint.toLowerCase() === 'satchida-gateway';
  const isPrivacyMode = isSatchidaEndpoint && normalizedMode === 'privacy';
  const satchidaSeatAlias = (user as IUser & { satchidaSeatAlias?: string })?.satchidaSeatAlias;
  // Operational trace for the Privacy path.
  //
  // The Privacy chain is fail-closed, so a refusal here is invisible from the
  // outside: the seat simply sees "Privacy mode is unavailable". Without this
  // trace there is no way to tell a misrouted request (the endpoint name never
  // matched, so the local runtime was called with the operator's licence token
  // instead of a seat assertion) from a genuine policy refusal. Only routing
  // facts are logged. No token, key or prompt content.
  logger.info(
    `[satchida][custom] route endpoint=${endpoint} mode=${normalizedMode} ` +
      `satchidaEndpoint=${isSatchidaEndpoint} privacyMode=${isPrivacyMode} ` +
      `seatAlias=${Boolean(satchidaSeatAlias)} tenantId=${Boolean(user?.tenantId)}`,
  );
  if (isPrivacyMode && (userProvidesKey || userProvidesURL)) {
    throw new Error(JSON.stringify({ type: ErrorTypes.NO_USER_KEY }));
  }
  const isTenantCloudMode = !!user?.seatToken && !isPrivacyMode;
  const isFamilySeat = user?.accountType === 'family';
  const isChildSeat =
    (user?.familyRole as string | null | undefined) === 'minor' ||
    (user?.familyRole as string | null | undefined) === 'child';
  const semanticMode =
    normalizedMode === 'vibecoder' || normalizedMode === 'vibe_coding'
      ? 'Work'
      : normalizedMode.slice(0, 1).toUpperCase() + normalizedMode.slice(1);
  const toolUseRequested =
    Array.isArray(model_parameters?.tools) && model_parameters.tools.length > 0;
  if (isTenantCloudMode && isSatchidaEndpoint) {
    // The seat's allowed modes come from the operator's allocation for its
    // account type, not from a table keyed by account type here. A type-based
    // table would have to be duplicated here and would drift, and it would
    // make a dedicated `privacy` seat unable to reach the cloud even when the
    // operator had explicitly granted it.
    const seatPolicy =
      user?.tenantId && satchidaSeatAlias
        ? await db.getTenantSeatPolicy?.({
            tenantId: user.tenantId,
            seatAlias: satchidaSeatAlias,
          })
        : undefined;
    if (seatPolicy) {
      const allowed = new Set(seatPolicy.allowedModes.map((mode) => mode.toLowerCase()));
      if (!allowed.has(normalizedMode)) {
        throw new Error(JSON.stringify({ type: ErrorTypes.NO_USER_KEY }));
      }
    } else {
      // Without a policy the seat's modes are unknown, so only the modes every
      // tenant seat is guaranteed to hold are permitted. A dedicated
      // `privacy` seat falls back to Privacy, which is its purpose.
      const fallback = user?.accountType === 'privacy' ? ['privacy'] : ['chat'];
      if (!fallback.includes(normalizedMode)) {
        throw new Error(JSON.stringify({ type: ErrorTypes.NO_USER_KEY }));
      }
    }
    if (isChildSeat && (semanticMode === 'Work' || toolUseRequested))
      throw new Error(JSON.stringify({ type: ErrorTypes.NO_USER_KEY }));
    if (isFamilySeat && toolUseRequested)
      throw new Error(JSON.stringify({ type: ErrorTypes.NO_USER_KEY }));
    if (
      toolUseRequested &&
      !(user as IUser & { tenantSeatCapabilities?: string[] }).tenantSeatCapabilities?.some(
        (capability) => ['work_tools', 'mcp', 'agents', 'code_execution'].includes(capability),
      )
    ) {
      throw new Error(JSON.stringify({ type: ErrorTypes.NO_USER_KEY }));
    }
    if (db.authorizeTenantSeatRequest && user?.tenantId && satchidaSeatAlias) {
      const authorized = await db.authorizeTenantSeatRequest({
        tenantId: user.tenantId,
        seatAlias: satchidaSeatAlias,
        accountType: user.accountType ?? 'basic',
        profileType: isChildSeat ? 'child' : 'adult',
        mode: normalizedMode,
        hasTools: toolUseRequested,
      });
      if (!authorized) throw new Error(JSON.stringify({ type: ErrorTypes.NO_USER_KEY }));
    }
  }
  let privacyAssertion = (user as IUser & { privacyAssertion?: string })?.privacyAssertion;
  if (isPrivacyMode) {
    // The Privacy path is fail-closed. Every one of these checks is unconditional:
    // a Privacy request must never be forwarded to the local runtime without an
    // assertion, without a healthy local model, or with a remote base URL.
    if (!user?.tenantId || !satchidaSeatAlias) {
      throw new Error(JSON.stringify({ type: ErrorTypes.NO_USER_KEY }));
    }
    if (!privacyAssertion) {
      privacyAssertion = await db.getPrivacyAssertion({
        tenantId: user.tenantId,
        seatAlias: satchidaSeatAlias,
        accountType: user.accountType ?? 'basic',
        profileType: isChildSeat ? 'child' : 'adult',
      });
    }
    if (!privacyAssertion) {
      throw new Error(JSON.stringify({ type: ErrorTypes.NO_USER_KEY }));
    }
    const localReady = await db.isPrivacyLocalReady({
      tenantId: user.tenantId,
      seatAlias: satchidaSeatAlias,
    });
    if (!localReady) {
      throw new Error(JSON.stringify({ type: ErrorTypes.NO_USER_KEY }));
    }
    logger.info('[satchida][custom] privacy assertion minted and local runtime reachable');
  }
  const privacyBaseURL = userProvidesURL ? (userValues?.baseURL ?? '') : CUSTOM_BASE_URL;
  if (
    isPrivacyMode &&
    (!privacyAssertion ||
      !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(privacyBaseURL))
  ) {
    throw new Error(JSON.stringify({ type: ErrorTypes.NO_USER_KEY }));
  }
  let apiKey: string | undefined;
  if (isPrivacyMode) {
    apiKey = privacyAssertion;
  } else if (userProvidesKey || userProvidesURL) {
    apiKey = userValues?.apiKey;
  } else {
    apiKey = user?.seatToken ?? CUSTOM_API_KEY;
  }

  let baseURL: string | undefined = CUSTOM_BASE_URL;
  if (!isPrivacyMode && userProvidesURL) {
    baseURL = userValues?.baseURL;
  }

  if ((userProvidesKey || userProvidesURL) && !apiKey) {
    throw new Error(
      JSON.stringify({
        type: ErrorTypes.NO_USER_KEY,
      }),
    );
  }

  if (userProvidesURL && !baseURL) {
    throw new Error(
      JSON.stringify({
        type: ErrorTypes.NO_BASE_URL,
      }),
    );
  }

  if (!apiKey) {
    throw new Error(`${endpoint} API key not provided.`);
  }

  if (!baseURL) {
    throw new Error(`${endpoint} Base URL not provided.`);
  }

  if (userProvidesURL) {
    await validateEndpointURL(baseURL, endpoint, appConfig?.endpoints?.allowedAddresses);
  }

  let endpointTokenConfig: EndpointTokenConfig | undefined;

  const userId = user?.id ?? '';
  const tenantId = user?.tenantId;

  const cache = tokenConfigCache();
  const hasTokenConfig = endpointConfig.tokenConfig != null;
  const tokenKey = getTokenConfigKey(endpointConfig, endpoint, userId, tenantId);

  if (hasTokenConfig) {
    /** A static override is authoritative â€” use it for the agent's billing
     *  and balance checks, not just the advertised UI token config. Mirror
     *  the admin-facing `cacheWrite`/`cacheRead` keys onto the `write`/`read`
     *  keys the billing multiplier reads. */
    endpointTokenConfig = toBillingTokenConfig(
      endpointConfig.tokenConfig as Record<string, Record<string, number>>,
    );
  } else {
    const cachedConfig =
      FetchTokenConfig[endpoint.toLowerCase() as keyof typeof FetchTokenConfig] &&
      (await cache.get(tokenKey));
    endpointTokenConfig = (cachedConfig as EndpointTokenConfig) || undefined;
  }

  if (
    FetchTokenConfig[endpoint.toLowerCase() as keyof typeof FetchTokenConfig] &&
    endpointConfig &&
    endpointConfig.models?.fetch &&
    !endpointTokenConfig
  ) {
    await fetchModels({
      apiKey,
      baseURL,
      baseURLIsUserProvided: userProvidesURL,
      allowedAddresses: appConfig?.endpoints?.allowedAddresses,
      name: endpoint,
      user: userId,
      tokenKey,
      userObject: user,
      // Mirror the security guard in `loadConfigModels`: never forward
      // header overrides when the base URL is user-supplied â€” configured
      // templates like {{LIBRECHAT_OPENID_ID_TOKEN}} would otherwise resolve
      // and leak the user's identity token to a destination the user controls.
      headers: userProvidesURL ? undefined : endpointConfig.headers,
      // Note: when both `headers` and `userObject` are supplied below, the
      // MODEL_QUERIES cache inside `fetchModels` is automatically skipped,
      // which prevents a per-user filtered model list from leaking across
      // users. The token-config cache key (`tokenKey`) is also user-scoped
      // above when these headers will be forwarded.
    });
    endpointTokenConfig = (await cache.get(tokenKey)) as EndpointTokenConfig | undefined;
  }

  const customOptions = buildCustomOptions(
    endpointConfig,
    appConfig,
    endpointTokenConfig,
    !userProvidesURL,
  );

  /**
   * The Satchida mode has to reach the operator's gateway.
   *
   * The gateway refuses a tenant credential that does not declare which mode
   * it is serving, because the mode decides the seat's entitlement: a Privacy
   * request must be refused at the cloud gateway and sent to the tenant's own
   * router instead, and a Work request needs the tool set a Chat seat does
   * not hold. Without the header every cloud request was refused with "A
   * configured mode is required for tenant cloud inference".
   *
   * The mode is the server's own decision, taken from the model spec the
   * request resolved to, and it is never taken from a header the caller sent.
   * The Privacy mode is not sent: Privacy never reaches this gateway.
   */
  if (isSatchidaEndpoint && !isPrivacyMode && semanticMode) {
    customOptions.headers = {
      ...((customOptions.headers as Record<string, string> | undefined) ?? {}),
      'X-Satchida-Mode': semanticMode,
    };
  }

  const clientOptions: Record<string, unknown> = {
    reverseProxyUrl: baseURL ?? null,
    baseURLIsUserProvided: userProvidesURL,
    allowedAddresses: appConfig?.endpoints?.allowedAddresses,
    transportTimeouts: resolveModelTransportTimeouts(appConfig?.endpoints?.agents),
    proxy: PROXY ?? null,
    ...customOptions,
  };

  const modelOptions = { ...(model_parameters ?? {}), user: userId };

  let options: InitializeResultBase;
  if (endpointConfig.provider === EModelEndpoint.anthropic) {
    /** Native Anthropic `/v1/messages` client against the custom baseURL/apiKey.
     *  `useLegacyContent` is intentionally left unset (matches the built-in
     *  Anthropic endpoint, which uses native content formatting). */
    options = buildAnthropicCustomConfig({
      apiKey,
      baseURL,
      modelOptions: modelOptions as AnthropicModelOptions,
      endpointConfig,
      userProvidesURL,
      allowedAddresses: appConfig?.endpoints?.allowedAddresses,
    });
    options.endpointTokenConfig = endpointTokenConfig;
  } else {
    const finalClientOptions = {
      modelOptions,
      ...clientOptions,
    };
    options = getOpenAIConfig(apiKey, finalClientOptions, endpoint);
    if (options != null) {
      options.useLegacyContent = true;
      options.endpointTokenConfig = endpointTokenConfig;
    }
  }

  const streamRate = clientOptions.streamRate as number | undefined;
  if (streamRate != null) {
    options.llmConfig._lc_stream_delay = streamRate;
  }

  return options;
}
