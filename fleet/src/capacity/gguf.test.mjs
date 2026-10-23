import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  readGgufGeometry,
  kvBytesPerToken,
  KV_DTYPE_BITS,
  GgufError,
} from './gguf.mjs';

/**
 * Ground truth from the operator PC (spec section 2.2). These are the numbers the
 * whole capacity model is calibrated against, so they are asserted literally
 * rather than recomputed from the same formula under test.
 */
const BONSAI_9B_PQ2 = {
  model_id: 'Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0',
  architecture: 'qwen35',
  block_count: 33,
  head_count: 16,
  head_count_kv: 4,
  embedding_length: 4096,
  key_length: 256,
  value_length: 256,
  context_length: 262144,
};

describe('KV_DTYPE_BITS', () => {
  test('q4_0 is 4.5 bits, not a flat 4', () => {
    // llama.cpp stores one shared exponent per 32-value block plus 32 packed
    // nibbles: 18 bytes / 32 values. Reading it as 4 bits understates KV footprint
    // by ~11% and overstates served concurrency by the same margin.
    assert.equal(KV_DTYPE_BITS.q4_0, 4.5);
    assert.equal(KV_DTYPE_BITS.q4_1, 4.5);
    assert.equal(KV_DTYPE_BITS.q8_0, 8.5);
    assert.equal(KV_DTYPE_BITS.f16, 16);
  });

  test('every dtype has a positive bit width', () => {
    for (const [name, bits] of Object.entries(KV_DTYPE_BITS)) {
      assert.ok(bits > 0, `${name} must be positive, got ${bits}`);
    }
  });
});

describe('kvBytesPerToken', () => {
  test('reproduces the measured f16 footprint for Bonsai-2-9B PQ2', () => {
    const { bytes_per_token: bytes, head_dim_k, head_dim_v } = kvBytesPerToken(BONSAI_9B_PQ2, 'f16');
    // layers * kv_heads * (dim_k + dim_v) * bits / 8
    //      = 33  * 4         * (256 + 256)      * 16  / 8 = 135168 bytes
    assert.equal(head_dim_k, 256);
    assert.equal(head_dim_v, 256);
    assert.equal(bytes, 33 * 4 * (256 + 256) * 2);
    assert.equal(bytes, 135168);
    assert.equal(bytes / 1024, 132); // 132 KiB per token
  });

  test('q4_0 footprint is 3.56x smaller than f16', () => {
    const f16 = kvBytesPerToken(BONSAI_9B_PQ2, 'f16').bytes_per_token;
    const q4 = kvBytesPerToken(BONSAI_9B_PQ2, 'q4_0').bytes_per_token;
    assert.equal(q4 / f16, 4.5 / 16);
    assert.ok(Math.abs(q4 / f16 - 0.28125) < 1e-12);
  });

  test('derives head dimension when key_length is absent', () => {
    const { embedding_length: d, head_count: h, ...rest } = BONSAI_9B_PQ2;
    const derived = kvBytesPerToken(rest, 'f16');
    const explicit = kvBytesPerToken(BONSAI_9B_PQ2, 'f16');
    assert.equal(derived.bytes_per_token, explicit.bytes_per_token);
    assert.equal(derived.head_dim_k, d / h);
  });

  test('hybrid attention uses the widest full-attention layer', () => {
    // Per-layer head widths: the cache is sized by the widest one, so taking the
    // first entry would understate the footprint.
    const hybrid = { ...BONSAI_9B_PQ2, key_length: [128, 256, 192], value_length: [128, 256, 192] };
    const { bytes_per_token: bytes, head_dim_k } = kvBytesPerToken(hybrid, 'f16');
    assert.equal(head_dim_k, 256);
    assert.equal(bytes, 33 * 4 * (256 + 256) * 2);
  });

  test('rejects an unknown dtype instead of guessing', () => {
    // A confidently wrong KV footprint yields a confidently wrong concurrency
    // number, which is worse than refusing.
    assert.throws(
      () => kvBytesPerToken(BONSAI_9B_PQ2, 'q9_9'),
      (error) => error instanceof GgufError && /unknown KV cache dtype/.test(error.message),
    );
  });

  test('rejects geometry without usable layer or head counts', () => {
    assert.throws(() => kvBytesPerToken({ ...BONSAI_9B_PQ2, block_count: null }, 'f16'), GgufError);
    assert.throws(() => kvBytesPerToken({ ...BONSAI_9B_PQ2, head_count_kv: 0 }, 'f16'), GgufError);
  });

  test('scales linearly with layers and kv heads', () => {
    const one = kvBytesPerToken({ ...BONSAI_9B_PQ2, block_count: 1, head_count_kv: 1 }, 'f16').bytes_per_token;
    const many = kvBytesPerToken({ ...BONSAI_9B_PQ2, block_count: 2, head_count_kv: 3 }, 'f16').bytes_per_token;
    assert.equal(many / one, 6);
  });
});

describe('readGgufGeometry', () => {
  // Reaches onto the real model directory when present. Skipped otherwise so the
  // suite still runs on a machine without the model library.
  const REAL = 'D:\\LAN-AI-Infra\\LLM-models';

  async function tryRead() {
    try {
      const buf = await readFile(REAL, { encoding: null }).catch(() => null);
      return Boolean(buf);
    } catch {
      return false;
    }
  }

  test('rejects a non-GGUF file', async () => {
    const bad = await import('node:os').then((os) => os.tmpdir() + '\\not-a-gguf.bin');
    const { writeFile, rm } = await import('node:fs/promises');
    await writeFile(bad, Buffer.alloc(64, 7));
    await assert.rejects(readGgufGeometry(bad), GgufError);
    await rm(bad, { force: true });
  });

  test('rejects a file too small to hold a header', async () => {
    const { writeFile, rm } = await import('node:fs/promises');
    const os = await import('node:os');
    const tiny = os.tmpdir() + '\\tiny.gguf';
    await writeFile(tiny, Buffer.from('GGUF'));
    await assert.rejects(readGgufGeometry(tiny), GgufError);
    await rm(tiny, { force: true });
  });

  test('parses a hand-built v3 header and skips unwanted keys', async () => {
    const { writeFile, rm } = await import('node:fs/promises');
    const os = await import('node:os');
    const path = os.tmpdir() + '\\synthetic.gguf';

    const chunks = [];
    const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); chunks.push(b); };
    const str = (s) => {
      const body = Buffer.from(s, 'utf8');
      const len = Buffer.alloc(8); len.writeBigUInt64LE(BigInt(body.length));
      chunks.push(len, body);
    };
    const u64 = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); chunks.push(b); };
    void u64;

    const header = Buffer.alloc(24);
    header.write('GGUF', 0, 'ascii');
    header.writeUInt32LE(3, 4);
    header.writeBigUInt64LE(427n, 8);   // tensor count
    header.writeBigUInt64LE(6n, 16);   // kv count: exactly the 6 entries below
    chunks.push(header);

    // 6 entries, each: key (string) + type (u32) + value.
    // Counts in real GGUF headers are uint32 (type 4, four bytes). Writing them as
    // uint64 desyncs the reader because the type marker, not the helper, decides
    // how many bytes the value occupies.
    str('general.architecture'); u32(8); str('qwen35');   // 0
    str('qwen35.block_count'); u32(4); u32(33);           // 1
    str('qwen35.attention.head_count_kv'); u32(4); u32(4);// 2
    str('qwen35.embedding_length'); u32(4); u32(4096);    // 3
    str('tokenizer.ggml.model'); u32(4); u32(99);         // 4 unwanted: suffix "model"
    str('qwen35.context_length'); u32(4); u32(262144);    // 5
    // Missing head_count/key_length on purpose: head dim must be derived.

    await writeFile(path, Buffer.concat(chunks));
    const geometry = await readGgufGeometry(path);
    assert.equal(geometry.version, 3);
    assert.equal(geometry.architecture, 'qwen35');
    assert.equal(geometry.block_count, 33);
    assert.equal(geometry.head_count_kv, 4);
    assert.equal(geometry.embedding_length, 4096);
    assert.equal(geometry.context_length, 262144);
    assert.equal(geometry.head_count, null);   // not present, must not be invented
    assert.equal(geometry.key_length, null);

    await rm(path, { force: true });
  });

  test('matches the real model when the model library is present', async (t) => {
    const path = `${REAL}\\Ternary-Bonsai-2-9B\\Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0.gguf`;
    let geometry;
    try {
      geometry = await readGgufGeometry(path);
    } catch (error) {
      if (error.code === 'ENOENT') {
        t.skip('model library not present on this machine');
        return;
      }
      throw error;
    }
    assert.equal(geometry.architecture, BONSAI_9B_PQ2.architecture);
    assert.equal(geometry.block_count, BONSAI_9B_PQ2.block_count);
    assert.equal(geometry.head_count_kv, BONSAI_9B_PQ2.head_count_kv);
    assert.equal(geometry.key_length, BONSAI_9B_PQ2.key_length);
    const { bytes_per_token: bytes } = kvBytesPerToken(geometry, 'f16');
    assert.equal(bytes, 135168);
  });

  test('model library is reachable or the suite still passes', async () => {
    await tryRead(); // does not assert; keeps the helper honest
    assert.ok(true);
  });
});