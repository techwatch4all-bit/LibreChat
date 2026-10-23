import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runProbe,
  measurePrefill,
  measureDecodeSweep,
  verifyCacheReuse,
} from './probe.mjs';

/**
 * A stub llama.cpp endpoint. It reports deterministic usage so the probe's
 * arithmetic can be asserted exactly, and it answers all requests at once rather
 * than in arrival order so the concurrency sweep has something real to measure.
 */
function startStubServer({ cacheReuse = true, failAt = new Set() } = {}) {
  const state = { requests: 0, inFlight: 0, maxInFlight: 0, served: [] };
  const server = createServer(async (req, res) => {
    if (req.url === '/v1/chat/completions') {
      state.requests += 1;
      state.inFlight += 1;
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      let body = '';
      for await (const chunk of req) body += chunk;
      const promptTokens = Math.max(1, Math.floor(body.length / 4.5));
      const n = state.served.length;
      state.served.push(n);

      // Hold briefly so concurrent requests genuinely overlap in flight.
      await new Promise((r) => setTimeout(r, 30));
      state.inFlight -= 1;

      if (failAt.has(n)) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end('{"error":"overloaded"}');
        return;
      }
      // Cache reuse only ever grows with a repeating prefix, so the stub must be
      // monotonic. Alternating by parity would make the two probe requests report
      // the same count and look like a cache failure.
      const cached = cacheReuse ? Math.floor(promptTokens * Math.min(0.95, 0.1 * (n + 1))) : 0;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: 200,
          total_tokens: promptTokens + 200,
          prompt_tokens_details: { cached_tokens: cached },
        },
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, state }));
  });
}

describe('probe measurements', () => {
  test('prefill rate is prompt tokens over elapsed time', async () => {
    const { server, port } = await startStubServer();
    try {
      const result = await measurePrefill(`http://127.0.0.1:${port}`, 'stub');
      assert.ok(result.prompt_tokens > 1000, `prompt was only ${result.prompt_tokens} tokens`);
      assert.ok(result.prefill_tps > 0);
      assert.ok(Number.isFinite(result.seconds));
    } finally {
      server.close();
    }
  });

  test('decode sweep really runs requests concurrently', async () => {
    // If the sweep awaited each request in turn the server would never see more
    // than one in flight, and the measured curve would be single-stream speed
    // repeated rather than real batching behaviour.
    const { server, port, state } = await startStubServer();
    try {
      const sweep = await measureDecodeSweep(`http://127.0.0.1:${port}`, 'stub', [1, 4, 8]);
      assert.equal(state.maxInFlight >= 8, true, `max in flight was ${state.maxInFlight}`);
      assert.ok(sweep.perSeat['1'] > 0);
      assert.ok(sweep.aggregate['8'] > 0);
      assert.ok(sweep.aggregate['8'] > sweep.perSeat['8'], 'aggregate must exceed per-seat');
    } finally {
      server.close();
    }
  });

  test('decode sweep records per-concurrency errors instead of throwing', async () => {
    const { server, port } = await startStubServer({ failAt: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) });
    try {
      const sweep = await measureDecodeSweep(`http://127.0.0.1:${port}`, 'stub', [4]);
      assert.deepEqual(Object.keys(sweep.perSeat), []);
      assert.ok(sweep.errors['4'], 'a fully failed point must be reported');
    } finally {
      server.close();
    }
  });

  test('cache reuse is detected from rising cached_tokens', async () => {
    const { server, port } = await startStubServer({ cacheReuse: true });
    try {
      const cache = await verifyCacheReuse(`http://127.0.0.1:${port}`, 'stub');
      assert.equal(cache.cache_reuse_ok, true);
      assert.ok(cache.second_cached_tokens > cache.first_cached_tokens);
    } finally {
      server.close();
    }
  });

  test('missing prefix cache is reported, not silently assumed', async () => {
    // The whole cost model rests on cached input being cheap. A machine without it
    // must be flagged so its fair-use thresholds are not trusted.
    const { server, port } = await startStubServer({ cacheReuse: false });
    try {
      const cache = await verifyCacheReuse(`http://127.0.0.1:${port}`, 'stub');
      assert.equal(cache.cache_reuse_ok, false);
    } finally {
      server.close();
    }
  });
});

describe('runProbe report', () => {
  test('produces a spec 5.3 shaped report end to end', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'satchida-probe-'));
    const ggufPath = join(dir, 'stub.gguf');
    // Minimal but valid GGUF v3 header.
    const chunks = [];
    const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); chunks.push(b); };
    const str = (s) => {
      const body = Buffer.from(s, 'utf8');
      const len = Buffer.alloc(8); len.writeBigUInt64LE(BigInt(body.length));
      chunks.push(len, body);
    };
    const header = Buffer.alloc(24);
    header.write('GGUF', 0, 'ascii');
    header.writeUInt32LE(3, 4);
    header.writeBigUInt64LE(10n, 8);
    header.writeBigUInt64LE(5n, 16);
    chunks.push(header);
    str('general.architecture'); u32(8); str('qwen35');
    str('qwen35.block_count'); u32(4); u32(33);
    str('qwen35.attention.head_count_kv'); u32(4); u32(4);
    str('qwen35.attention.key_length'); u32(4); u32(256);
    str('qwen35.embedding_length'); u32(4); u32(4096);
    await writeFile(ggufPath, Buffer.concat(chunks));

    const { server, port } = await startStubServer();
    try {
      const report = await runProbe({
        endpoint: `http://127.0.0.1:${port}`,
        model: 'stub-model',
        gguf: ggufPath,
        kvType: 'q4_0',
        tenantId: 'tnt_test',
        ctx: 16384,
        concurrency: [1, 2],
        skipLoad: false,
      });

      assert.equal(report.schema, 'satchida.capacity.probe.v1');
      assert.equal(report.tenant_id, 'tnt_test');
      assert.ok(report.collected_at > 0);
      assert.ok(report.model.kv_bytes_per_token > 0);
      assert.ok(Object.keys(report.throughput.per_seat_tps).length > 0);
      assert.ok(report.cache);
      assert.equal(report.derived.fits, true);
      assert.ok(report.derived.c_served >= 1);
      // The report must carry no prompt content.
      assert.equal(JSON.stringify(report).includes('quick brown fox'), false);
    } finally {
      server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('skip-load returns geometry without generating', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'satchida-probe-'));
    const ggufPath = join(dir, 'stub.gguf');
    const chunks = [];
    const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); chunks.push(b); };
    const str = (s) => {
      const body = Buffer.from(s, 'utf8');
      const len = Buffer.alloc(8); len.writeBigUInt64LE(BigInt(body.length));
      chunks.push(len, body);
    };
    const header = Buffer.alloc(24);
    header.write('GGUF', 0, 'ascii');
    header.writeUInt32LE(3, 4);
    header.writeBigUInt64LE(0n, 8);
    header.writeBigUInt64LE(4n, 16);
    chunks.push(header);
    str('general.architecture'); u32(8); str('qwen35');
    str('qwen35.block_count'); u32(4); u32(33);
    str('qwen35.attention.head_count_kv'); u32(4); u32(4);
    str('qwen35.attention.key_length'); u32(4); u32(256);
    await writeFile(ggufPath, Buffer.concat(chunks));

    const { server, port, state } = await startStubServer();
    try {
      const report = await runProbe({
        endpoint: `http://127.0.0.1:${port}`,
        model: 'stub-model',
        gguf: ggufPath,
        kvType: 'q4_0',
        tenantId: null,
        ctx: 16384,
        concurrency: [1],
        skipLoad: true,
      });
      assert.equal(state.requests, 0, 'skip-load must not call the endpoint');
      assert.equal(report.warnings.some((w) => /throughput not measured/.test(w)), true);
    } finally {
      server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});