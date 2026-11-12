import mongoose from 'mongoose';
import { logger, createModels } from '..';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createToolResultScratchpadMethods } from './toolResultScratchpad';

logger.silent = true;

let ToolResultScratchpad: mongoose.Model<unknown>;
let methods: ReturnType<typeof createToolResultScratchpadMethods>;
let mongoServer: MongoMemoryServer;

const userA = new mongoose.Types.ObjectId().toString();

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  createModels(mongoose);
  ToolResultScratchpad = mongoose.models.ToolResultScratchpad;
  await ToolResultScratchpad.syncIndexes();
  methods = createToolResultScratchpadMethods(mongoose);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await ToolResultScratchpad.deleteMany({});
});

describe('captureToolResult', () => {
  test('persists the full output with digest and TTL expiry', async () => {
    const fullOutput = `${'x'.repeat(3000)}middle${'y'.repeat(3000)}`;
    const ok = await methods.captureToolResult({
      conversationId: 'conv-1',
      messageId: 'msg-1',
      toolId: 'call_1',
      toolName: 'web_search',
      user: userA,
      fullOutput,
      digest: 'head…tail',
      outputChars: fullOutput.length,
      ttlDays: 7,
    });
    expect(ok).toBe(true);

    const row = (await ToolResultScratchpad.findOne({ messageId: 'msg-1' })
      .lean()) as unknown as {
      fullOutput: string;
      digest: string;
      outputChars: number;
      expiresAt: Date;
    } | null;
    expect(row?.fullOutput).toBe(fullOutput);
    expect(row?.digest).toBe('head…tail');
    expect(row?.outputChars).toBe(fullOutput.length);
    expect(row?.expiresAt).toBeInstanceOf(Date);
  });

  test('upserts: a retry of the same (messageId, toolId) overwrites instead of duplicating', async () => {
    const base = {
      conversationId: 'conv-1',
      messageId: 'msg-2',
      toolId: 'call_2',
      toolName: 'web_search',
      user: userA,
      digest: 'd',
      outputChars: 10,
      ttlDays: 7,
    };
    await methods.captureToolResult({ ...base, fullOutput: 'first' });
    await methods.captureToolResult({ ...base, fullOutput: 'second' });
    expect(await ToolResultScratchpad.countDocuments({ messageId: 'msg-2' })).toBe(1);
    const row = (await ToolResultScratchpad.findOne({ messageId: 'msg-2' })
      .lean()) as unknown as { fullOutput: string } | null;
    expect(row?.fullOutput).toBe('second');
  });

  test('returns false instead of throwing when the write fails', async () => {
    const ok = await methods.captureToolResult({
      // invalid ObjectId forces a cast error on the write
      conversationId: 'conv-err',
      messageId: 'msg-err',
      toolId: 'call-err',
      toolName: 't',
      user: 'not-an-object-id',
      fullOutput: 'x',
      digest: '',
      outputChars: 1,
      ttlDays: 7,
    });
    expect(ok).toBe(false);
  });
});

describe('listConversationScratchpad', () => {
  test('lists a conversation rows with the lean projection only', async () => {
    for (let i = 0; i < 3; i += 1) {
      await methods.captureToolResult({
        conversationId: 'conv-list',
        messageId: `msg-l${i}`,
        toolId: `call_${i}`,
        toolName: 'web_search',
        user: userA,
        fullOutput: 'z'.repeat(2000),
        digest: `d${i}`,
        outputChars: 2000,
        ttlDays: 7,
      });
    }
    const rows = await methods.listConversationScratchpad({ conversationId: 'conv-list', user: userA });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      messageId: 'msg-l0',
      toolId: 'call_0',
      toolName: 'web_search',
      digest: 'd0',
      outputChars: 2000,
    });
  });
});
