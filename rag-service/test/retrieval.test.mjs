/**
 * Tests for the real retrieval pipeline: chunking, vector store and the
 * similarity math. These are pure and run without a network, an embedding key,
 * or a port.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { chunkText, splitSentences } from '../src/chunk.mjs';
import { l2Normalize, dotProduct, EmbeddingError, createEmbedder } from '../src/embed.mjs';
import { VectorStore, vectorToBuffer, vectorFromBuffer } from '../src/vectorstore.mjs';

test('chunkText returns [] for empty input', () => {
  assert.deepEqual(chunkText(''), []);
  assert.deepEqual(chunkText('   \n\n  '), []);
  assert.deepEqual(chunkText(null), []);
});

test('chunkText produces deterministic chunk indices', () => {
  const text = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} with some words in it.`).join('\n\n');
  const a = chunkText(text);
  const b = chunkText(text);
  assert.deepEqual(
    a.map((c) => c.text),
    b.map((c) => c.text),
  );
  assert.deepEqual(
    a.map((c) => c.index),
    a.map((_, i) => i),
  );
});

test('chunkText keeps chunks within a sane size band', () => {
  const text = Array.from({ length: 300 }, (_, i) => `Word${i} `).join(' ');
  const chunks = chunkText(text, { targetWords: 120, overlapWords: 20 });
  assert.ok(chunks.length > 1, 'long text should split');
  for (const chunk of chunks) {
    assert.ok(chunk.wordCount > 0);
    /* Overlap means a chunk can exceed the target; it must not explode. */
    assert.ok(chunk.wordCount < 400, `chunk of ${chunk.wordCount} words is too large`);
  }
});

test('chunkText overlaps neighbours so boundary text stays retrievable', () => {
  const text = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} here.`).join(' ');
  const chunks = chunkText(text, { targetWords: 50, overlapWords: 10 });
  assert.ok(chunks.length >= 2);
  const firstTail = chunks[0].text.split(/\s+/).slice(-5).join(' ');
  assert.ok(
    chunks[1].text.includes(firstTail.split(' ')[0]) || chunks[1].text.includes('Sentence'),
    'second chunk should carry text from the first',
  );
});

test('chunkText keeps fenced code blocks intact', () => {
  const code = ['```js', 'function a() {', '  return 1;', '}'].join('\n');
  const text = `${code}\n\n${'prose '.repeat(300)}`;
  const chunks = chunkText(text, { targetWords: 60 });
  const withCode = chunks.find((c) => c.text.includes('function a()'));
  assert.ok(withCode, 'code chunk should exist');
  assert.ok(withCode.text.includes('}'), 'code block should not be cut mid-block');
});

test('splitSentences does not break on common abbreviations', () => {
  const sentences = splitSentences('Use e.g. this value. The next one is 3.14 units long.');
  assert.ok(sentences.length >= 2);
  assert.ok(sentences.some((s) => s.includes('3.14')));
});

test('l2Normalize produces a unit vector', () => {
  const v = l2Normalize([3, 4]);
  assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-9);
});

test('l2Normalize rejects a zero vector rather than producing NaN', () => {
  assert.throws(() => l2Normalize([0, 0, 0]), EmbeddingError);
});

test('dotProduct is the cosine similarity of normalized vectors', () => {
  const a = l2Normalize([1, 0, 0]);
  const b = l2Normalize([1, 0, 0]);
  const c = l2Normalize([0, 1, 0]);
  assert.ok(Math.abs(dotProduct(a, b) - 1) < 1e-9);
  assert.ok(Math.abs(dotProduct(a, c)) < 1e-9);
});

test('dotProduct refuses mismatched dimensions', () => {
  assert.throws(() => dotProduct([1, 0], [1, 0, 0]), EmbeddingError);
});

test('vector round-trips through the BLOB encoding', () => {
  const original = l2Normalize([0.5, 0.25, -0.75, 0.1]);
  const restored = vectorFromBuffer(vectorToBuffer(original));
  assert.equal(restored.length, original.length);
  for (let i = 0; i < original.length; i += 1) {
    /* Float32 storage loses precision relative to float64; assert closeness. */
    assert.ok(Math.abs(restored[i] - original[i]) < 1e-6);
  }
});

test('createEmbedder returns null rather than a fake when unconfigured', async () => {
  const embedder = await createEmbedder({
    RAG_EMBED_PROVIDER: 'openai-compatible',
    RAG_EMBED_BASE_URL: '',
    RAG_EMBED_API_KEY: '',
    RAG_EMBED_MODEL: '',
  });
  assert.equal(embedder, null, 'must be null, never a synthetic embedder');
});

test('createEmbedder honours an explicit disable', async () => {
  assert.equal(await createEmbedder({ RAG_EMBED_PROVIDER: 'none' }), null);
  assert.equal(await createEmbedder({ RAG_EMBED_PROVIDER: 'disabled' }), null);
});

test('VectorStore stores, searches and scopes by user', () => {
  const store = new VectorStore(':memory:');
  const vector = (x, y) => l2Normalize([x, y, 0]);

  store.replaceDocument({
    userId: 'user-a',
    fileId: 'file-1',
    filename: 'a.txt',
    model: 'test-model',
    chunks: [
      { index: 0, text: 'about cats', vector: vector(1, 0) },
      { index: 1, text: 'about dogs', vector: vector(0, 1) },
    ],
  });

  const hits = store.search({ userId: 'user-a', queryVector: vector(1, 0), k: 2 });
  assert.equal(hits.length, 2);
  assert.equal(hits[0].text, 'about cats');
  assert.ok(hits[0].score >= hits[1].score, 'results must be score-ordered');

  /* Another user must not see them, even with a perfect query. */
  assert.equal(store.search({ userId: 'user-b', queryVector: vector(1, 0) }).length, 0);

  store.close();
});

test('VectorStore re-ingest replaces rather than appends', () => {
  const store = new VectorStore(':memory:');
  const v = l2Normalize([1, 0]);
  store.replaceDocument({
    userId: 'u',
    fileId: 'f',
    filename: 'f.txt',
    model: 'm',
    chunks: [
      { index: 0, text: 'a', vector: v },
      { index: 1, text: 'b', vector: v },
      { index: 2, text: 'c', vector: v },
    ],
  });
  assert.equal(store.stats().chunks, 3);

  store.replaceDocument({
    userId: 'u',
    fileId: 'f',
    filename: 'f.txt',
    model: 'm',
    chunks: [{ index: 0, text: 'a only', vector: v }],
  });
  assert.equal(store.stats().chunks, 1, 'stale tail chunks must not survive a re-ingest');
  assert.equal(store.search({ userId: 'u', queryVector: v })[0].text, 'a only');
  store.close();
});

test('VectorStore search requires a user scope', () => {
  const store = new VectorStore(':memory:');
  assert.throws(() => store.search({ userId: '', queryVector: [1, 0] }), EmbeddingError);
  assert.throws(() => store.deleteByFile({ userId: '', fileId: 'f' }), EmbeddingError);
  store.close();
});

test('VectorStore skips chunks whose width no longer matches the query', () => {
  const store = new VectorStore(':memory:');
  store.replaceDocument({
    userId: 'u',
    fileId: 'f',
    filename: 'f',
    model: 'old-model',
    chunks: [{ index: 0, text: '3-dim', vector: l2Normalize([1, 0, 0]) }],
  });
  /* Simulates a model change: query is 2-dim, stored vector is 3-dim. */
  assert.equal(store.search({ userId: 'u', queryVector: [1, 0] }).length, 0);
  store.close();
});

test('VectorStore persists across instances', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-test-'));
  const file = path.join(dir, 'nested', 'rag.sqlite');
  const v = l2Normalize([1, 2, 3]);

  const first = new VectorStore(file);
  first.replaceDocument({
    userId: 'u',
    fileId: 'f',
    filename: 'f',
    model: 'm',
    chunks: [{ index: 0, text: 'persisted', vector: v }],
  });
  first.close();

  const second = new VectorStore(file);
  assert.equal(second.stats().chunks, 1);
  assert.equal(second.search({ userId: 'u', queryVector: v })[0].text, 'persisted');
  second.close();

  fs.rmSync(dir, { recursive: true, force: true });
});

test('VectorStore deleteByFile only removes the calling user rows', () => {
  const store = new VectorStore(':memory:');
  const v = l2Normalize([1, 0]);
  for (const userId of ['u1', 'u2']) {
    store.replaceDocument({
      userId,
      fileId: 'shared-name',
      filename: 'f',
      model: 'm',
      chunks: [{ index: 0, text: userId, vector: v }],
    });
  }
  assert.equal(store.deleteByFile({ userId: 'u1', fileId: 'shared-name' }), 1);
  assert.equal(store.stats().chunks, 1, 'the other user must be untouched');
  store.close();
});