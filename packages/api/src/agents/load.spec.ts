import {
  Tools,
  ArtifactModes,
  EModelEndpoint,
  parseEphemeralAgentId,
} from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import type { LoadAgentDeps } from './load';
import { loadEphemeralAgent } from './load';
import { resolveSender } from './sender';
import { loadAddedAgent } from './added';

const deps: LoadAgentDeps = {
  getAgent: async () => null,
  getMCPServerTools: async () => null,
};

const baseReq = {
  user: { id: 'user-1' },
  config: {
    modelSpecs: { list: [{ name: 'my-opus-spec', label: 'Spec Label' }] },
  },
  body: {},
} as unknown as Parameters<typeof loadEphemeralAgent>[0]['req'];

async function idFor(modelParameters: Record<string, unknown>) {
  const agent = await loadEphemeralAgent(
    {
      req: baseReq,
      spec: 'my-opus-spec',
      endpoint: 'my-custom-endpoint',
      model_parameters: modelParameters as never,
    },
    deps,
  );
  return agent?.id;
}

/**
 * Documents the #14253 Bug 2 mechanism: the ephemeral agent id (LangGraph node /
 * HITL checkpoint namespace) is derived from `sender = modelLabel ?? modelSpec.label`.
 * When the resume drops `modelLabel`, the id drifts and the paused checkpoint can't be
 * re-entered. The fix keeps `modelLabel` across resume (RESUME_CONTEXT_KEYS), so the
 * original and resumed ids stay equal.
 */
describe('loadEphemeralAgent ephemeral id stability (#14253 Bug 2)', () => {
  test('id changes when modelLabel is lost vs preserved', async () => {
    const withLabel = await idFor({ model: 'claude-opus-4', modelLabel: 'My Opus' });
    const withoutLabel = await idFor({ model: 'claude-opus-4' });
    expect(withLabel).toBeTruthy();
    expect(withoutLabel).toBeTruthy();
    // Original turn (has modelLabel) vs a resume that dropped it → different namespace.
    expect(withLabel).not.toEqual(withoutLabel);
  });

  test('id is stable when modelLabel is preserved across turns', async () => {
    const a = await idFor({ model: 'claude-opus-4', modelLabel: 'My Opus' });
    const b = await idFor({ model: 'claude-opus-4', modelLabel: 'My Opus' });
    expect(a).toEqual(b);
  });
});

/** Custom endpoints carry their configured name in `endpoint` at runtime,
 *  which `TEndpointOption` types as `EModelEndpoint`. */
const customEndpointOption = {
  endpoint: 'my-custom-endpoint' as EModelEndpoint,
  model: 'claude-opus-4',
};

describe('loadEphemeralAgent → resolveSender parity', () => {
  test('the persisted sender matches the spec label encoded into the agent id', async () => {
    const agent = await loadEphemeralAgent(
      {
        req: baseReq,
        spec: 'my-opus-spec',
        endpoint: 'my-custom-endpoint',
        model_parameters: { model: 'claude-opus-4' } as never,
      },
      deps,
    );
    expect(agent?.id).toBeTruthy();
    const sender = resolveSender({
      agent: { id: agent?.id },
      specLabel: 'Spec Label',
      endpointOption: customEndpointOption,
    });
    expect(sender).toBe('Spec Label');
    expect(sender).toBe(parseEphemeralAgentId(agent?.id ?? '')?.sender);
  });

  test('a user modelLabel wins over the spec label in the persisted sender', async () => {
    const agent = await loadEphemeralAgent(
      {
        req: baseReq,
        spec: 'my-opus-spec',
        endpoint: 'my-custom-endpoint',
        model_parameters: { model: 'claude-opus-4', modelLabel: 'My Opus' } as never,
      },
      deps,
    );
    const sender = resolveSender({
      agent: { id: agent?.id },
      specLabel: 'Spec Label',
      endpointOption: { ...customEndpointOption, modelLabel: 'My Opus' },
    });
    expect(sender).toBe('My Opus');
    expect(sender).toBe(parseEphemeralAgentId(agent?.id ?? '')?.sender);
  });
});

describe('loadEphemeralAgent modelSpec capabilities fallback', () => {
  test('inherits modelSpec.artifacts when ephemeralAgent.artifacts is omitted', async () => {
    const req = {
      user: { id: 'user-1' },
      config: {
        modelSpecs: {
          list: [
            { name: 'motion-spec', label: 'Motion Studio', artifacts: true },
            { name: 'custom-art-spec', label: 'Custom', artifacts: 'custom' },
          ],
        },
      },
      body: {},
    } as unknown as Parameters<typeof loadEphemeralAgent>[0]['req'];

    const boolSpecAgent = await loadEphemeralAgent(
      {
        req,
        spec: 'motion-spec',
        endpoint: 'Satchida-Gateway',
        model_parameters: { model: 'Work' } as never,
      },
      deps,
    );
    expect(boolSpecAgent?.artifacts).toBe(ArtifactModes.DEFAULT);

    const customSpecAgent = await loadEphemeralAgent(
      {
        req,
        spec: 'custom-art-spec',
        endpoint: 'Satchida-Gateway',
        model_parameters: { model: 'Work' } as never,
      },
      deps,
    );
    expect(customSpecAgent?.artifacts).toBe(ArtifactModes.CUSTOM);
  });

  test('respects explicit ephemeralAgent.artifacts override and opt-out', async () => {
    const reqWithOverride = {
      user: { id: 'user-1' },
      config: {
        modelSpecs: { list: [{ name: 'motion-spec', label: 'Motion Studio', artifacts: true }] },
      },
      body: { ephemeralAgent: { artifacts: ArtifactModes.SHADCNUI } },
    } as unknown as Parameters<typeof loadEphemeralAgent>[0]['req'];

    const overridden = await loadEphemeralAgent(
      { req: reqWithOverride, spec: 'motion-spec', endpoint: 'Satchida-Gateway' },
      deps,
    );
    expect(overridden?.artifacts).toBe(ArtifactModes.SHADCNUI);

    const reqWithOptOut = {
      ...reqWithOverride,
      body: { ephemeralAgent: { artifacts: '' } },
    } as unknown as Parameters<typeof loadEphemeralAgent>[0]['req'];

    const optedOut = await loadEphemeralAgent(
      { req: reqWithOptOut, spec: 'motion-spec', endpoint: 'Satchida-Gateway' },
      deps,
    );
    expect(optedOut?.artifacts).toBeUndefined();
  });

  test('disables execute_code and skills when modelSpec sets executeCode: false and skills: false', async () => {
    const req = {
      user: { id: 'user-1' },
      config: {
        modelSpecs: {
          list: [
            {
              name: 'motion-spec',
              label: 'Motion Studio',
              executeCode: false,
              skills: false,
            },
          ],
        },
      },
      body: { ephemeralAgent: { execute_code: true } },
    } as unknown as Parameters<typeof loadEphemeralAgent>[0]['req'];

    const agent = await loadEphemeralAgent(
      {
        req,
        spec: 'motion-spec',
        endpoint: 'Satchida-Gateway',
        model_parameters: { model: 'Work' } as never,
      },
      deps,
    );
    expect(agent?.tools).not.toContain(Tools.execute_code);
    expect(agent?.skills_enabled).toBe(false);
    expect(agent?.skills).toEqual([]);
  });

  test('loadAddedAgent mirrors modelSpec.artifacts inheritance and executeCode: false guard', async () => {
    const req = {
      user: { id: 'user-1' },
      config: {
        modelSpecs: {
          list: [
            {
              name: 'motion-spec',
              label: 'Motion Studio',
              artifacts: true,
              executeCode: false,
              skills: false,
            },
          ],
        },
      },
    } as unknown as Parameters<typeof loadAddedAgent>[0]['req'];

    const added = await loadAddedAgent(
      {
        req,
        conversation: {
          endpoint: 'Satchida-Gateway',
          model: 'Work',
          spec: 'motion-spec',
          ephemeralAgent: { execute_code: true },
        } as unknown as TConversation,
      },
      deps,
    );
    expect(added?.artifacts).toBe(ArtifactModes.DEFAULT);
    expect(added?.tools).not.toContain(Tools.execute_code);
    expect(added?.skills_enabled).toBe(false);

    const optedOut = await loadAddedAgent(
      {
        req,
        conversation: {
          endpoint: 'Satchida-Gateway',
          model: 'Work',
          spec: 'motion-spec',
          ephemeralAgent: { artifacts: '' },
        } as unknown as TConversation,
      },
      deps,
    );
    expect(optedOut?.artifacts).toBeUndefined();
  });
});
