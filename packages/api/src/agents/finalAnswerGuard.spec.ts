import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { createFinalAnswerGuardHook, endsWithUnconsumedToolResult } from './finalAnswerGuard';
import type { StopHookInput, StopHookOutput } from '@librechat/agents';

const signal = new AbortController().signal;

const buildInput = (overrides: Partial<StopHookInput> = {}): StopHookInput =>
  ({
    hook_event_name: 'Stop',
    messages: [],
    stopHookActive: false,
    continuationCount: 0,
    continuationBudgetRemaining: 3,
    runId: 'run-1',
    ...overrides,
  }) as StopHookInput;

describe('endsWithUnconsumedToolResult', () => {
  it('is true when the run ends on a tool result', () => {
    const messages = [
      new HumanMessage('find it'),
      new AIMessage({ content: '', tool_calls: [{ name: 'web_search', args: {}, id: 't1' }] }),
      new ToolMessage({ content: 'results…', tool_call_id: 't1' }),
    ];
    expect(endsWithUnconsumedToolResult(messages)).toBe(true);
  });

  it('is false when the run ends on assistant text', () => {
    const messages = [
      new HumanMessage('find it'),
      new AIMessage({ content: '', tool_calls: [{ name: 'web_search', args: {}, id: 't1' }] }),
      new ToolMessage({ content: 'results…', tool_call_id: 't1' }),
      new AIMessage('here is the answer'),
    ];
    expect(endsWithUnconsumedToolResult(messages)).toBe(false);
  });

  it('is false for an empty history', () => {
    expect(endsWithUnconsumedToolResult([])).toBe(false);
  });
});

describe('createFinalAnswerGuard', () => {
  const answered = [new HumanMessage('q'), new AIMessage('the answer')];
  const unanswered = [
    new HumanMessage('q'),
    new ToolMessage({ content: 'results…', tool_call_id: 't1' }),
  ];

  const call = async (
    hook: ReturnType<typeof createFinalAnswerGuardHook>,
    input: StopHookInput,
  ): Promise<StopHookOutput> => hook(input, signal);

  it('blocks once and injects the final-answer instruction when the run ends on a tool result', async () => {
    const hook = createFinalAnswerGuardHook();
    const out = await call(hook, buildInput({ messages: unanswered }));
    expect(out.decision).toBe('block');
    expect(out.additionalContext).toContain('Write your complete final answer now');
    expect(out.reason).toBe('final_answer_guard');
  });

  it('does nothing when the run ends on assistant text', async () => {
    const hook = createFinalAnswerGuardHook();
    expect(await call(hook, buildInput({ messages: answered }))).toEqual({});
  });

  it('does nothing when the stop follows an earlier continuation (stopHookActive)', async () => {
    const hook = createFinalAnswerGuardHook();
    expect(await call(hook, buildInput({ messages: unanswered, stopHookActive: true }))).toEqual({});
  });

  it('admits at most one continuation by default', async () => {
    const hook = createFinalAnswerGuardHook();
    const first = await call(hook, buildInput({ messages: unanswered }));
    expect(first.decision).toBe('block');
    expect(await call(hook, buildInput({ messages: unanswered }))).toEqual({});
  });

  it('honors maxContinuations and never blocks with zero continuation budget', async () => {
    const hook = createFinalAnswerGuardHook({ maxContinuations: 2 });
    expect((await call(hook, buildInput({ messages: unanswered }))).decision).toBe('block');
    expect((await call(hook, buildInput({ messages: unanswered }))).decision).toBe('block');
    expect(await call(hook, buildInput({ messages: unanswered }))).toEqual({});

    const budgetHook = createFinalAnswerGuardHook();
    expect(
      await call(budgetHook, buildInput({ messages: unanswered, continuationBudgetRemaining: 0 })),
    ).toEqual({});
  });
});
