/**
 * GGUF metadata reader — the geometric half of the Satchida capacity probe.
 *
 * Fair-use thresholds are derived from a tenant's own machine (spec section 5.1),
 * and KV-cache footprint cannot be derived from the file size alone. It needs the
 * attention geometry: how many layers, how many key/value heads, and how wide each
 * head is. Those three numbers, plus the KV cache dtype, decide how many sessions
 * fit in VRAM.
 *
 *   kv_bytes_per_token = 2 * layers * kv_heads * head_dim * bytes_per_element
 *
 * The leading 2 is K and V. Everything else is read straight from the GGUF header.
 *
 * Only the header is parsed. Tensor data is never touched, so this is cheap on a
 * multi-gigabyte model and safe to run against a file another process has open.
 *
 * Reference: GGUF v2/v3 spec, https://github.com/ggml-org/ggml/blob/master/docs/gguf.md
 */
import { open } from 'node:fs/promises';

const GGUF_MAGIC = 'GGUF';

/** GGUF metadata value type -> [byteWidth, decoder]. */
const VALUE_TYPES = {
  0: { bytes: 1, name: 'uint8' },
  1: { bytes: 1, name: 'int8' },
  2: { bytes: 2, name: 'uint16' },
  3: { bytes: 2, name: 'int16' },
  4: { bytes: 4, name: 'uint32' },
  5: { bytes: 4, name: 'int32' },
  6: { bytes: 4, name: 'float32' },
  7: { bytes: 1, name: 'bool' },
  8: { bytes: 'var', name: 'string' },
  9: { bytes: 'var', name: 'array' },
  10: { bytes: 8, name: 'uint64' },
  11: { bytes: 8, name: 'int64' },
  12: { bytes: 8, name: 'float64' },
};

/**
 * KV cache dtypes and their effective bits per element.
 *
 * q4_0 is 4.5 bits, not 4: llama.cpp stores one shared exponent byte per 32-value
 * block plus 32 packed 4-bit values, so a block is 18 bytes for 32 values. Reading
 * this as a flat 4 bits understates KV footprint by ~11%, which overstates served
 * concurrency by the same margin. That is the difference between fitting the ninth
 * session in VRAM or not.
 */
export const KV_DTYPE_BITS = {
  f32: 32,
  f16: 16,
  bf16: 16,
  q8_0: 8.5,
  q5_1: 5.5,
  q5_0: 5.5,
  q4_1: 4.5,
  q4_0: 4.5,
  q3_k: 3.5625,
  q2_k: 2.625,
  iq4_nl: 4.5,
  iq4_xs: 4.25,
};

export class GgufError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GgufError';
  }
}

/** Read `length` bytes and advance the cursor. */
async function read(cursor, length) {
  if (length < 0) throw new GgufError(`cannot read ${length} bytes`);
  const end = cursor.offset + length;
  if (end > cursor.buffer.length) {
    throw new GgufError(
      `truncated GGUF: wanted ${length} bytes at offset ${cursor.offset}, `
      + `file has ${cursor.buffer.length - cursor.offset} left`,
    );
  }
  const slice = cursor.buffer.subarray(cursor.offset, end);
  cursor.offset = end;
  return slice;
}

async function readString(cursor) {
  const lengthBytes = await read(cursor, 8);
  const length = Number(lengthBytes.readBigUInt64LE(0));
  if (length > 64 * 1024 * 1024) throw new GgufError(`implausible string length ${length}`);
  return (await read(cursor, length)).toString('utf8');
}

async function readScalar(cursor, type) {
  const spec = VALUE_TYPES[type];
  if (!spec) throw new GgufError(`unknown GGUF value type ${type}`);
  const bytes = await read(cursor, spec.bytes);
  switch (type) {
    case 0: return bytes.readUInt8(0);
    case 1: return bytes.readInt8(0);
    case 2: return bytes.readUInt16LE(0);
    case 3: return bytes.readInt16LE(0);
    case 4: return bytes.readUInt32LE(0);
    case 5: return bytes.readInt32LE(0);
    case 6: return bytes.readFloatLE(0);
    case 7: return bytes.readUInt8(0) !== 0;
    case 10: return Number(bytes.readBigUInt64LE(0));
    case 11: return Number(bytes.readBigInt64LE(0));
    case 12: return bytes.readDoubleLE(0);
    default: throw new GgufError(`unhandled scalar type ${type}`);
  }
}

/**
 * Read one metadata value, recursing through nested arrays.
 *
 * Hybrid-attention models store per-layer head widths as an array of arrays, so a
 * flat-array fast path is not sufficient. Depth is bounded to keep a malformed file
 * from recursing unboundedly.
 */
async function readValue(cursor, type, depth = 0) {
  if (depth > 8) throw new GgufError('GGUF array nesting is too deep');
  if (type === 8) return readString(cursor);
  if (type === 9) {
    const elementType = (await readScalar(cursor, 4));
    const length = Number((await read(cursor, 8)).readBigUInt64LE(0));
    const elementBytes = VALUE_TYPES[elementType]?.bytes;
    if (elementBytes === 'var') {
      // Variable-width elements (strings, nested arrays) must be decoded one by one.
      const out = [];
      for (let i = 0; i < length; i += 1) out.push(await readValue(cursor, elementType, depth + 1));
      return out;
    }
    if (typeof elementBytes === 'number') {
      const raw = await read(cursor, elementBytes * length);
      const out = [];
      let offset = 0;
      for (let i = 0; i < length; i += 1) {
        out.push(decodeScalar(raw, elementType, offset));
        offset += elementBytes;
      }
      return out;
    }
    throw new GgufError(`unknown GGUF array element type ${elementType}`);
  }
  return readScalar(cursor, type);
}

function decodeScalar(buffer, type, offset) {
  switch (type) {
    case 0: return buffer.readUInt8(offset);
    case 1: return buffer.readInt8(offset);
    case 2: return buffer.readUInt16LE(offset);
    case 3: return buffer.readInt16LE(offset);
    case 4: return buffer.readUInt32LE(offset);
    case 5: return buffer.readInt32LE(offset);
    case 6: return buffer.readFloatLE(offset);
    case 7: return buffer.readUInt8(offset) !== 0;
    case 10: return Number(buffer.readBigUInt64LE(offset));
    case 11: return Number(buffer.readBigInt64LE(offset));
    case 12: return buffer.readDoubleLE(offset);
    default: throw new GgufError(`unhandled array element type ${type}`);
  }
}

/** Keys worth keeping. Everything else is skipped without being materialised. */
const WANTED_SUFFIXES = new Set([
  'architecture',
  'block_count',
  'context_length',
  'embedding_length',
  'head_count',
  'head_count_kv',
  'key_length',
  'value_length',
]);

/** Header cap. Real model headers are tens of KB; 16 MiB is far beyond any real file. */
const MAX_HEADER_BYTES = 16 * 1024 * 1024;

/**
 * Read the geometry needed for capacity planning from a GGUF file.
 *
 * Returns only header metadata. `file_size_bytes` comes from the stat, not the
 * header, so it reflects the whole file on disk.
 */
export async function readGgufGeometry(filePath) {
  const handle = await open(filePath, 'r');
  try {
    const stat = await handle.stat();
    const headerLength = Math.min(stat.size, MAX_HEADER_BYTES);
    const buffer = Buffer.alloc(headerLength);
    await handle.read(buffer, 0, headerLength, 0);

    if (buffer.length < 24) throw new GgufError('file is too small to be a GGUF');
    if (buffer.toString('ascii', 0, 4) !== GGUF_MAGIC) {
      throw new GgufError(`not a GGUF file (magic is ${JSON.stringify(buffer.toString('ascii', 0, 4))})`);
    }

    const version = buffer.readUInt32LE(4);
    if (version !== 2 && version !== 3) {
      throw new GgufError(`unsupported GGUF version ${version}; expected 2 or 3`);
    }

    const tensorCount = Number(buffer.readBigUInt64LE(8));
    const kvCount = Number(buffer.readBigUInt64LE(16));

    const cursor = { buffer, offset: 24 };
    const values = {};

    for (let i = 0; i < kvCount; i += 1) {
      const key = await readString(cursor);
      const type = Number((await read(cursor, 4)).readUInt32LE(0));
      const suffix = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
      if (WANTED_SUFFIXES.has(suffix)) {
        values[suffix] = await readValue(cursor, type);
      } else {
        await readValue(cursor, type);
      }
    }

    return {
      version,
      tensor_count: tensorCount,
      file_size_bytes: stat.size,
      architecture: typeof values.architecture === 'string' ? values.architecture : null,
      block_count: numberOrNull(values.block_count),
      context_length: numberOrNull(values.context_length),
      embedding_length: numberOrNull(values.embedding_length),
      head_count: numberOrNull(values.head_count),
      head_count_kv: numberOrNull(values.head_count_kv),
      key_length: numberOrNull(values.key_length),
      value_length: numberOrNull(values.value_length),
    };
  } finally {
    await handle.close();
  }
}

function numberOrNull(value) {
  if (Array.isArray(value)) {
    const numbers = value.filter((entry) => typeof entry === 'number');
    return numbers.length ? Math.max(...numbers) : null;
  }
  return typeof value === 'number' ? value : null;
}

/**
 * Head width for the K (or V) cache.
 *
 * Hybrid-attention models write `key_length` as a per-layer array. The cache is
 * sized by the widest full-attention layer, so take the maximum rather than the
 * first entry — using the first understates the cache for a model whose later layers
 * are wider.
 */
function resolveHeadDim(geometry, kind) {
  const explicit = kind === 'k' ? geometry.key_length : geometry.value_length;
  if (typeof explicit === 'number' && explicit > 0) return explicit;
  const { head_count, embedding_length } = geometry;
  if (typeof head_count === 'number' && head_count > 0 && typeof embedding_length === 'number') {
    return Math.floor(embedding_length / head_count);
  }
  return null;
}

/**
 * Bytes of KV cache per token, for a given cache dtype.
 *
 * `kvBytesPerToken('...gguf', 'q4_0')` is the number the capacity model needs.
 * Throws rather than guessing when geometry is missing: a wrong KV footprint
 * produces a confidently wrong concurrency number, which is worse than no number.
 */
export function kvBytesPerToken(geometry, kvDtype = 'f16') {
  const bits = KV_DTYPE_BITS[String(kvDtype).toLowerCase()];
  if (!bits) {
    throw new GgufError(
      `unknown KV cache dtype ${JSON.stringify(kvDtype)}; known: ${Object.keys(KV_DTYPE_BITS).join(', ')}`,
    );
  }
  const { block_count, head_count_kv } = geometry;
  if (typeof block_count !== 'number' || block_count <= 0) {
    throw new GgufError('GGUF geometry has no usable block_count');
  }
  if (typeof head_count_kv !== 'number' || head_count_kv <= 0) {
    throw new GgufError('GGUF geometry has no usable head_count_kv');
  }
  const headDimK = resolveHeadDim(geometry, 'k');
  const headDimV = resolveHeadDim(geometry, 'v') ?? headDimK;
  if (!headDimK || !headDimV) {
    throw new GgufError('cannot derive head dimension from GGUF geometry');
  }
  // headDimK + headDimV already accounts for the separate K and V tensors, so the
  // per-token size is layers * kv_heads * (dim_k + dim_v). Multiplying by a further
  // 2 here would double-count and halve the reported concurrency.
  const bytesPerToken = (block_count * head_count_kv * (headDimK + headDimV) * bits) / 8;
  return { bytes_per_token: bytesPerToken, bits, head_dim_k: headDimK, head_dim_v: headDimV };
}

/** Convenience wrapper: geometry plus KV footprint in one call. */
export async function readKvFootprint(filePath, kvDtype = 'f16') {
  const geometry = await readGgufGeometry(filePath);
  return { geometry, kv: kvBytesPerToken(geometry, kvDtype) };
}