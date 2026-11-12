import {
  createContextGuardHook,
  estimateToolResultTokens,
  toolOutputChars,
  CHARS_PER_TOKEN,
  DEFAULT_CONVERGE_AT_RATIO,
  DEFAULT_FINALIZE_AT_RATIO,
} from './contextGuard';
import type { PostToolBatchHookInput } from '@librechat/agents';

const buildInput = (
  entries: Array<{ toolOutput?: unknown; status: 'success' | 'error' }>,
  overrides: Partial<PostToolBatchHookInput> = {},
): PostToolBatchHookInput =>
  ({
    hook_event_name: 'PostToolBatch',
    entries: entries.map((e) => ({
      toolName: 'web_search',
      toolInput: {},
      toolUseId: 't',
      status: e.status,
      ...(e.toolOutput != null ? { toolOutput: e.toolOutput } : {}),
    })),
    runId: 'run-1',
    ...overrides,
  }) as unknown as PostToolBatchHookInput;

const signal = new AbortController().signal;

describe('toolOutputChars / estimateToolResultTokens', () => {
  it('counts strings directly and serializes objects', () => {
    expect(toolOutputChars('abcd')).toBe(4);
    expect(toolOutputChars({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length);
    expect(toolOutputChars(null)).toBe(0);
  });

  it('overstates tokens conservatively (chars / 3.5, rounded up)', () => {
    expect(estimateToolResultTokens(CHARS_PER_TOKEN)).toBe(1);
    expect(estimateToolResultTokens(3500)).toBe(1000);
    expect(estimateToolResultTokens(3501)).toBe(1001);
  });
});

describe('createContextGuardHook', () => {
  const call = (
    hook: ReturnType<typeof createContextGuardHook>,
    input: PostToolBatchHookInput,
  ) => hook(input, signal);
  const budget = 10_000;
  /** chars that fill a fraction of the budget at CHARS_PER_TOKEN */
  const charsFor = (fraction: number) => Math.round(budget * fraction * CHARS_PER_TOKEN);

  it('is silent while tool results are well under the converge threshold', async () => {
    const hook = createContextGuardHook({ contextBudgetTokens: budget });
    expect(
      await call(hook, buildInput([{ status: 'success', toolOutput: 'x'.repeat(charsFor(0.2)) }])),
    ).toEqual({});
  });

  it('injects the converge notice past the converge threshold', async () => {
    const hook = createContextGuardHook({ contextBudgetTokens: budget });
    const out = await call(
      hook,
      buildInput([
        { status: 'success', toolOutput: 'x'.repeat(charsFor(DEFAULT_CONVERGE_AT_RATIO + 0.05)) },
      ]),
    );
    const context = (out as { additionalContext?: string }).additionalContext ?? '';
    expect(context).toContain('Converge on what you have');
  });

  it('injects the finalize notice past the finalize threshold and forbids more tools', async () => {
    const hook = createContextGuardHook({ contextBudgetTokens: budget });
    const out = await call(
      hook,
      buildInput([
        { status: 'success', toolOutput: 'x'.repeat(charsFor(DEFAULT_FINALIZE_AT_RATIO + 0.05)) },
      ]),
    );
    const context = (out as { additionalContext?: string }).additionalContext ?? '';
    expect(context).toContain('Do not call any more tools');
    expect(context).toContain('Write your complete final answer now');
  });

  it('accumulates across rounds and skips failed entries and subagent batches', async () => {
    const hook = createContextGuardHook({ contextBudgetTokens: budget });
    /** Two rounds just past converge, with an error entry that must not count. */
    const half = charsFor(DEFAULT_CONVERGE_AT_RATIO) + 1000;
    await call(
      hook,
      buildInput([{ status: 'success', toolOutput: 'x'.repeat(half) }, { status: 'error' }]),
    );
    const out = await call(
      hook,
      buildInput([{ status: 'success', toolOutput: 'x'.repeat(half) }], {
        agentId: 'sub',
      } as Partial<PostToolBatchHookInput>),
    );
    /** Subagent batch: skipped entirely, tally unchanged. */
    expect(out).toEqual({});
    const root = await call(hook, buildInput([{ status: 'success', toolOutput: 'x'.repeat(100) }]));
    const context = (root as { additionalContext?: string }).additionalContext ?? '';
    expect(context.length).toBeGreaterThan(0);
  });

  it('is silent when the run has no computable budget', async () => {
    const hook = createContextGuardHook({});
    expect(
      await call(hook, buildInput([{ status: 'success', toolOutput: 'x'.repeat(500_000) }])),
    ).toEqual({});
  });
});
