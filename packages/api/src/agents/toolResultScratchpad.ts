import { logger } from '@librechat/data-schemas';
import type { HookCallback } from '@librechat/agents';
import { toolOutputChars } from './contextGuard';

/** Tool outputs at or above this size are captured to the scratchpad. Anything
 * smaller stays trivially reconstructible from the conversation and is not
 * worth a row. */
export const DEFAULT_SCRATCHPAD_MIN_CHARS = 1500;

/** Lead-in excerpt kept in the cheap `digest` field for listing/summarizing
 * passes without reading the full output. */
export const SCRATCHPAD_DIGEST_HEAD_CHARS = 1500;
export const SCRATCHPAD_DIGEST_TAIL_CHARS = 500;

/** Default scratchpad retention in days; the collection's TTL index enforces it. */
export const DEFAULT_SCRATCHPAD_TTL_DAYS = 7;

export function buildScratchpadDigest(fullOutput: string): string {
  if (fullOutput.length <= SCRATCHPAD_DIGEST_HEAD_CHARS + SCRATCHPAD_DIGEST_TAIL_CHARS) {
    return fullOutput;
  }
  return `${fullOutput.slice(0, SCRATCHPAD_DIGEST_HEAD_CHARS)}\n…[${fullOutput.length - SCRATCHPAD_DIGEST_HEAD_CHARS - SCRATCHPAD_DIGEST_TAIL_CHARS} chars elided]…\n${fullOutput.slice(-SCRATCHPAD_DIGEST_TAIL_CHARS)}`;
}

export interface ToolScratchpadCapture {
  (input: {
    conversationId: string;
    messageId: string;
    toolId: string;
    toolName: string;
    user: string;
    fullOutput: string;
    digest: string;
    outputChars: number;
    tenantId?: string;
    ttlDays: number;
  }): Promise<boolean>;
}

export interface ToolScratchpadHookOptions {
  userId: string;
  conversationId?: string;
  tenantId?: string;
  captureToolResult: ToolScratchpadCapture;
  minChars?: number;
  ttlDays?: number;
}

/**
 * Builds the run-scoped `PostToolUse` hook that writes every substantial tool
 * result to the durable scratchpad the moment it finishes — BEFORE compaction,
 * fading, or any later truncation can shorten what the model sees.
 *
 * Quality contract: capture never replaces the live output (`updatedOutput` is
 * deliberately NOT used — the model keeps the full result in context exactly as
 * today). The scratchpad is the loss-recovery layer underneath: whatever later
 * happens to the window, the full text is one query away for summarization,
 * re-answer, or operator audit.
 *
 * The write is detached inside the hook body (fire-and-forget per the SDK's
 * `async` hook pattern): capture failures log and move on rather than stalling
 * the tool boundary.
 */
export function createToolScratchpadHook({
  userId,
  conversationId,
  tenantId,
  captureToolResult,
  minChars = DEFAULT_SCRATCHPAD_MIN_CHARS,
  ttlDays = DEFAULT_SCRATCHPAD_TTL_DAYS,
}: ToolScratchpadHookOptions): HookCallback<'PostToolUse'> {
  return (input) => {
    if (input.agentId != null) {
      return {};
    }
    /** Row provenance id: the SDK run's thread/message lineage, present on every hook. */
    const messageId = input.threadId ?? input.runId;
    const stringify = (value: unknown): string => {
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    };
    let fullOutput: string;
    if (typeof input.toolOutput === 'string') {
      fullOutput = input.toolOutput;
    } else if (input.toolOutput == null) {
      fullOutput = '';
    } else {
      fullOutput = stringify(input.toolOutput);
    }
    if (toolOutputChars(fullOutput) < minChars) {
      return {};
    }

    const capture = captureToolResult({
      conversationId: conversationId ?? 'unknown',
      messageId,
      toolId: input.toolUseId,
      toolName: input.toolName,
      user: userId,
      fullOutput,
      digest: buildScratchpadDigest(fullOutput),
      outputChars: fullOutput.length,
      ...(tenantId == null ? {} : { tenantId }),
      ttlDays,
    }).catch((error) => {
      logger.error('[toolScratchpad] detached capture failed', error);
      return false;
    });
    /** Errors are handled in the detached promise; the boundary never waits. */
    void capture;
    return {};
  };
}
