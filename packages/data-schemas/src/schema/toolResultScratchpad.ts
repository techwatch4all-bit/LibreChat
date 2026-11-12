import mongoose, { Schema, Types } from 'mongoose';

/**
 * Durable scratchpad for agent tool results that are too large to keep relying
 * on the live conversation window. Every row is written as the tool finishes,
 * BEFORE any compaction can drop the tool call from the model's context, so the
 * full text stays retrievable (and summarizable) for the lifetime of the row.
 * This is the "write it to the scratch pad until it can be summarized" layer:
 * capture is lossless-by-default, and the retention window keeps the collection
 * bounded.
 */
export interface IToolResultScratchpad extends Document {
  conversationId: string;
  /** The SDK run's message id (`threadId`/run lineage), not the UI response id. */
  messageId: string;
  /** The tool call id (`tool_use_id`) the provider assigned. */
  toolId: string;
  toolName: string;
  user: Types.ObjectId;
  /** Full, untruncated tool output as delivered to the message content. */
  fullOutput: string;
  /** Short lead-in excerpt for cheap listing/summarization passes without reading `fullOutput`. */
  digest: string;
  outputChars: number;
  tenantId?: string;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const toolResultScratchpadSchema: Schema<IToolResultScratchpad> = new Schema(
  {
    conversationId: {
      type: String,
      required: true,
    },
    messageId: {
      type: String,
      required: true,
    },
    toolId: {
      type: String,
      required: true,
    },
    toolName: {
      type: String,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fullOutput: {
      type: String,
      required: true,
    },
    digest: {
      type: String,
      default: '',
    },
    outputChars: {
      type: Number,
      required: true,
    },
    tenantId: {
      type: String,
      index: true,
    },
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

/** One row per tool call; the capture hook upserts on retry. */
toolResultScratchpadSchema.index({ messageId: 1, toolId: 1 }, { unique: true });
toolResultScratchpadSchema.index({ conversationId: 1, user: 1, tenantId: 1 });
toolResultScratchpadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default toolResultScratchpadSchema;
