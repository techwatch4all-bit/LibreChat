import type { Model } from 'mongoose';
import type { IToolResultScratchpad } from '~/schema/toolResultScratchpad';
import logger from '~/config/winston';

export interface ScratchpadCaptureInput {
  conversationId: string;
  messageId: string;
  toolId: string;
  toolName: string;
  user: string;
  fullOutput: string;
  digest: string;
  outputChars: number;
  tenantId?: string;
  /** Retention window in days; the row's TTL index uses `expiresAt`. */
  ttlDays: number;
}

export interface ScratchpadListInput {
  conversationId: string;
  user: string;
  tenantId?: string;
  limit?: number;
}

export type ToolResultScratchpadMethods = {
  /** Upserts one row per (messageId, toolId); a retry overwrites the same row. */
  captureToolResult: (input: ScratchpadCaptureInput) => Promise<boolean>;
  listConversationScratchpad: (
    input: ScratchpadListInput,
  ) => Promise<Array<Pick<IToolResultScratchpad, 'toolId' | 'toolName' | 'digest' | 'outputChars' | 'messageId'>>>;
};

export function createToolResultScratchpadMethods(mongoose: typeof import('mongoose')): ToolResultScratchpadMethods {
  const getModel = () => mongoose.models.ToolResultScratchpad as Model<IToolResultScratchpad>;

  async function captureToolResult(input: ScratchpadCaptureInput): Promise<boolean> {
    try {
      const Model = getModel();
      const { ttlDays, tenantId, ...rest } = input;
      await Model.updateOne(
        { messageId: input.messageId, toolId: input.toolId },
        {
          $set: {
            ...rest,
            ...(tenantId == null ? {} : { tenantId }),
            expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
          },
        },
        { upsert: true },
      );
      return true;
    } catch (error) {
      /** The scratchpad is a loss-recovery layer, never a turn-blocking dependency:
       * a failed capture logs and moves on rather than failing the tool result. */
      logger.error('[toolResultScratchpad] capture failed:', error);
      return false;
    }
  }

  async function listConversationScratchpad(input: ScratchpadListInput) {
    const Model = getModel();
    return Model.find(
      {
        conversationId: input.conversationId,
        user: input.user,
        ...(input.tenantId == null ? {} : { tenantId: input.tenantId }),
      },
      { toolId: 1, toolName: 1, digest: 1, outputChars: 1, messageId: 1, _id: 0 },
    )
      .sort({ createdAt: 1 })
      .limit(input.limit ?? 100)
      .lean();
  }

  return { captureToolResult, listConversationScratchpad };
}
