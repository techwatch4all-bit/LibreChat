import { logger } from '@librechat/data-schemas';
import type { HookCallback } from '@librechat/agents';

/**
 * Conservative characters-per-token figure for tool-result text (web scrapes,
 * search summaries, JSON dumps — mixed prose and markup, mostly ASCII).
 * Deliberately LOW so the estimate OVERSTATES token pressure: the guard's job
 * is to leave room for the answer, and an early notice costs one line of
 * context while a late one costs the answer.
 */
export const CHARS_PER_TOKEN = 3.5;

/**
 * Fraction of the effective context budget that tool results alone may fill
 * before the model is told to stop broadening. Below the summarization trigger
 * (this deployment's `token_ratio` fires at 0.55 of total pressure) so the
 * converge notice lands while compaction still has room to help.
 */
export const DEFAULT_CONVERGE_AT_RATIO = 0.5;

/**
 * Fraction at which the guard demands the final answer. Above the point where
 * history+system+the results themselves are known to fit, below where provider
 * truncation or a failed summarization could strand the turn; the model writes
 * from data that is fully in context either way.
 */
export const DEFAULT_FINALIZE_AT_RATIO = 0.72;

/** Tool outputs below this character count are noise to the pressure tally. */
const MIN_COUNTED_OUTPUT_CHARS = 64;

export function estimateToolResultTokens(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/** Serialized length of a tool output, tolerating objects and empty values. */
export function toolOutputChars(toolOutput: unknown): number {
  if (toolOutput == null) {
    return 0;
  }
  if (typeof toolOutput === 'string') {
    return toolOutput.length;
  }
  try {
    return JSON.stringify(toolOutput).length;
  } catch {
    /** Circular or otherwise unserializable output: count a floor so pressure is not under-read. */
    return MIN_COUNTED_OUTPUT_CHARS;
  }
}

export function buildConvergeNotice(filledPercent: number): string {
  return [
    `System notice: tool results this turn now fill roughly ${filledPercent}% of the context window.`,
    'Stop broadening the search. Converge on what you have: prefer reads of specific pages over',
    'new searches, and reserve the remaining window for the final answer.',
  ].join(' ');
}

export function buildFinalizeNotice(filledPercent: number): string {
  return [
    `System notice: tool results this turn now fill roughly ${filledPercent}% of the context window.`,
    'Do not call any more tools. Write your complete final answer now from the tool results',
    'already gathered above — they remain fully available to you. If something is missing,',
    'state the gap explicitly in the answer instead of searching for it.',
  ].join(' ');
}

export interface ContextGuardOptions {
  /** The run's effective context budget in tokens (`computeEffectiveMaxContextTokens` output). */
  contextBudgetTokens?: number;
  convergeAtRatio?: number;
  finalizeAtRatio?: number;
}

/**
 * Builds the run-scoped `PostToolBatch` hook that watches tool-result volume
 * against the context budget.
 *
 * Quality contract: this guard never truncates, drops, or summarizes tool
 * results — truncation is the SDK's separate pre-flight behavior and fading
 * ladder. It only *tells* the model, between rounds, that the window is
 * filling, while everything gathered so far stays verbatim in context. That is
 * what turns "the persona searched 11 times and produced nothing" into "it
 * searched until the window was two-thirds full, then wrote the answer from
 * all of it".
 *
 * The tally counts successful tool outputs only (failures consume no context),
 * and like `stepBudget` it ignores subagent-scoped batches so only the root
 * run's window is measured.
 */
export function createContextGuardHook({
  contextBudgetTokens,
  convergeAtRatio = DEFAULT_CONVERGE_AT_RATIO,
  finalizeAtRatio = DEFAULT_FINALIZE_AT_RATIO,
}: ContextGuardOptions): HookCallback<'PostToolBatch'> {
  let toolResultChars = 0;

  return async (input) => {
    if (contextBudgetTokens == null || contextBudgetTokens <= 0) {
      return {};
    }
    if (input.agentId != null) {
      return {};
    }
    for (const entry of input.entries) {
      if (entry.status !== 'success') {
        continue;
      }
      const chars = toolOutputChars(entry.toolOutput);
      if (chars >= MIN_COUNTED_OUTPUT_CHARS) {
        toolResultChars += chars;
      }
    }

    const toolTokens = estimateToolResultTokens(toolResultChars);
    const usedRatio = toolTokens / contextBudgetTokens;
    if (usedRatio < convergeAtRatio) {
      return {};
    }

    const filledPercent = Math.min(99, Math.round(usedRatio * 100));
    const finalize = usedRatio >= finalizeAtRatio;
    logger.debug(
      `[contextGuard] Tool results ~${toolTokens}/${contextBudgetTokens} tokens (${filledPercent}%) — ${finalize ? 'finalizing' : 'converging'}.`,
      { runId: input.runId },
    );
    return {
      additionalContext: finalize
        ? buildFinalizeNotice(filledPercent)
        : buildConvergeNotice(filledPercent),
    };
  };
}
