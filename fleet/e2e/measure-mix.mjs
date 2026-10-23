/**
 * Measure the real input:output token mix.
 *
 * The derivation prices an allowance from a blended rate, and the blend is
 * only as good as the mix behind it. For an agentic session the input is the
 * WHOLE conversation re-sent every turn plus the files it read, and the output
 * is the reply and the tool call, so the input dominates by a wide margin.
 *
 * The prompt of a turn is reconstructed from the messages that precede it, so
 * the ratio is measured rather than assumed.
 */
import mongoose from 'mongoose';

await mongoose.connect('mongodb://127.0.0.1:27017/LibreChat', { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;

const conversations = await db.collection('conversations').find({}).toArray();
let systemTokens = 0;
const systemMessages = await db
  .collection('messages')
  .find({ isCreatedByUser: false, text: { $exists: true }, parentMessageId: null })
  .limit(50)
  .toArray();
for (const message of systemMessages) {
  systemTokens = Math.max(systemTokens, message.tokenCount ?? 0);
}

console.log('the system prompt is about', systemTokens, 'tokens\n');

const rows = [];
for (const conversation of conversations) {
  const messages = await db
    .collection('messages')
    .find({ conversationId: conversation._id.toString() })
    .sort({ createdAt: 1 })
    .toArray();
  if (messages.length < 2) continue;

  let history = 0;
  let prompt = 0;
  let completion = 0;
  let turns = 0;
  for (const message of messages) {
    const count = message.tokenCount ?? 0;
    if (message.isCreatedByUser) {
      history += count;
      continue;
    }
    // An assistant turn: its PROMPT is everything said so far, and its OUTPUT
    // is the message itself.
    prompt += history + systemTokens;
    completion += count;
    history += count;
    turns += 1;
  }
  if (turns === 0 || completion === 0) continue;
  rows.push({
    mode: conversation.spec || conversation.endpoint || 'unknown',
    turns,
    prompt,
    completion,
    ratio: prompt / completion,
  });
}

if (!rows.length) {
  console.log('no conversation has a multi-turn history with token counts to measure');
} else {
  rows.sort((a, b) => b.prompt - a.prompt);
  console.log('per conversation:');
  for (const row of rows.slice(0, 12)) {
    console.log(
      `  ${String(row.mode).padEnd(12)} turns=${String(row.turns).padEnd(4)} ` +
        `prompt=${String(row.prompt).padEnd(9)} completion=${String(row.completion).padEnd(7)} ` +
        `ratio=${row.ratio.toFixed(1)}:1`
    );
  }
  const prompt = rows.reduce((sum, row) => sum + row.prompt, 0);
  const completion = rows.reduce((sum, row) => sum + row.completion, 0);
  console.log(
    `\noverall: prompt=${prompt} completion=${completion} ` +
      `ratio=${(prompt / completion).toFixed(1)}:1  (input share ${(prompt / (prompt + completion)).toFixed(4)})`
  );
}

await mongoose.disconnect();
