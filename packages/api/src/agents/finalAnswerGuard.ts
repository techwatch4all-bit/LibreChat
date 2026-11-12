import { logger } from '@librechat/data-schemas';
import { isToolMessage, type BaseMessage } from '@langchain/core/messages';
import type { HookCallback } from '@librechat/agents';

/**
 * How many times this guard may keep a naturally terminal run warm. One is the
 * whole contract: the continuation runs to a terminal state and its own `Stop`
 * fires with `stopHookActive` already true, which the guard always honors — the
 * counter is a second belt for SDK versions that do not set the flag.
 */
export const DEFAULT_FINAL_ANSWER_CONTINUATIONS = 1;

/**
 * True when a run's message history ends on a tool result — the shape of the
 * silent-no-answer failure: the graph reached its terminal state right after
 * executing tools, so the model never wrote the text that consumes them.
 * An answer-less stop can also leave the last assistant message holding bare
 * tool calls, but a terminal state with pending tool calls is an SDK invariant
 * violation, not a guard case; the tool-result ending is the observed one.
 */
export function endsWithUnconsumedToolResult(messages: BaseMessage[]): boolean {
  if (messages.length === 0) {
    return false;
  }
  return isToolMessage(messages[messages.length - 1]);
}

/**
 * The context injected when the guard keeps the run warm. Nothing asks the model
 * to shrink the answer or skip content: the tool results are all in context, and
 * the single job of the continuation turn is to spend them on the answer.
 */
export function buildFinalAnswerInstruction(): string {
  return [
    'System notice: the previous turn ended after a tool call without writing its final answer.',
    'Do not call any more tools. Write your complete final answer now from the information',
    'already gathered in this conversation — every tool result you need is present above.',
    'If a specific item could not be established, say so explicitly in the answer rather than',
    'trying to fill the gap with another tool call.',
  ].join(' ');
}

export interface FinalAnswerGuardOptions {
  /** Maximum continuations this guard may admit. Defaults to 1. */
  maxContinuations?: number;
}

/**
 * Builds the run-scoped `Stop` hook that makes "ran out of steps with tool calls
 * pending" impossible to surface as an answer-less turn.
 *
 * `PostToolBatch` notices (stepBudget, contextGuard) ask the model to converge
 * *before* the wall; this hook is the backstop for the runs that reach the wall
 * anyway — the step limit hit mid-batch, a provider hiccup ended the segment, or
 * the model stopped right after tools. The SDK's `decision: 'block'` starts one
 * more graph segment inside the same stream, with the injected context as the
 * last thing the model reads, so the user gets the answer the turn already paid
 * for instead of a silent action list.
 */
export function createFinalAnswerGuardHook({
  maxContinuations = DEFAULT_FINAL_ANSWER_CONTINUATIONS,
}: FinalAnswerGuardOptions = {}): HookCallback<'Stop'> {
  let continuationsUsed = 0;

  return async (input) => {
    /** A prior continuation is already running; never fight the SDK's own loop guard. */
    if (input.stopHookActive) {
      return {};
    }
    if (continuationsUsed >= maxContinuations) {
      return {};
    }
    /** Zero budget means the SDK cannot honor a warm continuation this run. */
    if (input.continuationBudgetRemaining <= 0) {
      return {};
    }
    if (!endsWithUnconsumedToolResult(input.messages)) {
      return {};
    }
    continuationsUsed += 1;
    logger.warn(
      `[finalAnswerGuard] Run ended on a tool result without an answer; admitting continuation ${continuationsUsed}/${maxContinuations}.`,
      { runId: input.runId, threadId: input.threadId },
    );
    return {
      decision: 'block',
      reason: 'final_answer_guard',
      additionalContext: buildFinalAnswerInstruction(),
    };
  };
}
