import test from 'node:test';
import assert from 'node:assert/strict';
import { VectorStore } from '../src/vectorstore.mjs';

test('RAG isolation test: two users with identical filenames and chunks NEVER overlap', () => {
  const store = new VectorStore(':memory:');

  const userA = 'user_6734abcd0001';
  const userB = 'user_6734abcd0002';
  const dummyVectorA = [1.0, 0.0, 0.0];
  const dummyVectorB = [0.0, 1.0, 0.0];

  // User A ingests a secret financial report
  store.replaceDocument({
    userId: userA,
    fileId: 'file_fin_2026',
    filename: 'quarterly_financials.xlsx',
    model: 'mock-embed',
    chunks: [
      { index: 0, text: 'User A confidential EBITDA is 42 million', vector: dummyVectorA },
    ],
  });

  // User B ingests their own report with the same filename
  store.replaceDocument({
    userId: userB,
    fileId: 'file_fin_2026',
    filename: 'quarterly_financials.xlsx',
    model: 'mock-embed',
    chunks: [
      { index: 0, text: 'User B confidential EBITDA is 1.2 million', vector: dummyVectorB },
    ],
  });

  // Query as User A looking for financial data
  const resultsA = store.search({
    userId: userA,
    queryVector: dummyVectorA,
    k: 5,
  });

  assert.equal(resultsA.length, 1);
  assert.equal(resultsA[0].text, 'User A confidential EBITDA is 42 million');
  assert.notEqual(resultsA[0].text, 'User B confidential EBITDA is 1.2 million');

  // Query as User B with User A's vector direction
  const resultsB = store.search({
    userId: userB,
    queryVector: dummyVectorA,
    k: 5,
  });

  // User B must NOT see User A's chunk even if User A's chunk matches the vector
  for (const r of resultsB) {
    assert.notEqual(r.text, 'User A confidential EBITDA is 42 million');
  }

  // User A deletes their file; User B's file MUST remain untouched
  store.deleteByFile({ userId: userA, fileId: 'file_fin_2026' });

  const postDeleteA = store.search({ userId: userA, queryVector: dummyVectorA, k: 5 });
  assert.equal(postDeleteA.length, 0);

  const postDeleteB = store.search({ userId: userB, queryVector: dummyVectorB, k: 5 });
  assert.equal(postDeleteB.length, 1);
  assert.equal(postDeleteB[0].text, 'User B confidential EBITDA is 1.2 million');
});
