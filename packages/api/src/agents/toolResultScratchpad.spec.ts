import {
  createToolScratchpadHook,
  buildScratchpadDigest,
  DEFAULT_SCRATCHPAD_MIN_CHARS,
} from './toolResultScratchpad';
import type { PostToolUseHookInput } from '@librechat/agents';

const buildInput = (overrides: Partial<PostToolUseHookInput> = {}): PostToolUseHookInput =>
  ({
    hook_event_name: 'PostToolUse',
    toolName: 'web_search',
    toolInput: { query: 'test' },
    toolOutput: 'x'.repeat(DEFAULT_SCRATCHPAD_MIN_CHARS + 100),
    toolUseId: 'call_1',
    runId: 'run-1',
    threadId: 'thread-1',
    ...overrides,
  }) as PostToolUseHookInput;

describe('buildScratchpadDigest', () => {
  it('returns short outputs verbatim', () => {
    expect(buildScratchpadDigest('short')).toBe('short');
  });

  it('elides the middle for long outputs while keeping head and tail', () => {
    const long = `${'a'.repeat(2000)}${'b'.repeat(5000)}${'c'.repeat(2000)}`;
    const digest = buildScratchpadDigest(long);
    expect(digest).toContain('…[');
    expect(digest.startsWith('a'.repeat(100))).toBe(true);
    expect(digest.endsWith('c'.repeat(100))).toBe(true);
    expect(digest.length).toBeLessThan(long.length / 2);
  });
});

describe('createToolScratchpadHook', () => {
  const signal = new AbortController().signal;
  const call = (
    hook: ReturnType<typeof createToolScratchpadHook>,
    input: PostToolUseHookInput,
  ) => hook(input, signal);
  const makeCapture = () => jest.fn().mockResolvedValue(true);

  it('captures large successful outputs with full text, digest and provenance', async () => {
    const capture = makeCapture();
    const hook = createToolScratchpadHook({
      userId: 'user-1',
      conversationId: 'conv-1',
      captureToolResult: capture,
    });
    const output = 'y'.repeat(4000);
    const out = await call(hook, buildInput({ toolOutput: output }));
    expect(out).toEqual({});
    expect(capture).toHaveBeenCalledTimes(1);
    const arg = capture.mock.calls[0][0];
    expect(arg.fullOutput).toBe(output);
    expect(arg.outputChars).toBe(output.length);
    expect(arg.toolId).toBe('call_1');
    expect(arg.toolName).toBe('web_search');
    expect(arg.user).toBe('user-1');
    expect(arg.conversationId).toBe('conv-1');
    expect(arg.messageId).toBe('thread-1');
    expect(arg.ttlDays).toBe(7);
    expect(arg.digest.length).toBeLessThanOrEqual(output.length);
  });

  it('skips outputs below the minChars gate', async () => {
    const capture = makeCapture();
    const hook = createToolScratchpadHook({ userId: 'u', captureToolResult: capture });
    await call(hook, buildInput({ toolOutput: 'tiny' }));
    expect(capture).not.toHaveBeenCalled();
  });

  it('skips subagent-scoped events and honors minChars/ttlDays overrides', async () => {
    const capture = makeCapture();
    const hook = createToolScratchpadHook({
      userId: 'u',
      captureToolResult: capture,
      minChars: 5000,
      ttlDays: 3,
    });
    await call(hook, 
      buildInput({ agentId: 'sub', toolOutput: 'x'.repeat(6000) } as Partial<PostToolUseHookInput>),
    );
    expect(capture).not.toHaveBeenCalled();
    await call(hook, buildInput({ toolOutput: 'x'.repeat(5001) }));
    expect(capture.mock.calls[0][0].ttlDays).toBe(3);
  });

  it('never rejects even when capture fails (detached, logged)', async () => {
    const capture = jest.fn().mockRejectedValue(new Error('db down'));
    const hook = createToolScratchpadHook({ userId: 'u', captureToolResult: capture });
    expect(call(hook, buildInput())).toEqual({});
    /** Let the detached capture promise settle; an unhandled rejection would fail the suite. */
    await new Promise((resolve) => setImmediate(resolve));
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('serializes object outputs before capture', async () => {
    const capture = makeCapture();
    const hook = createToolScratchpadHook({ userId: 'u', captureToolResult: capture });
    const obj = { data: 'z'.repeat(3000) };
    await call(hook, buildInput({ toolOutput: obj }));
    expect(capture.mock.calls[0][0].fullOutput).toBe(JSON.stringify(obj));
  });
});
