/**
 * Embedding providers for retrieval.
 *
 * WHY THIS IS PLUGGABLE
 * ---------------------
 * This node has no local embedding model: the resident llama-server on :8080 is
 * a chat/VL server started WITHOUT `--embeddings`, and the handover forbids
 * starting a second llama-server (a second process would contend for the same
 * 12 GB of VRAM). So the deployment cannot assume a local embedder exists.
 *
 * That makes an OpenAI-compatible HTTP provider the production path. One
 * implementation covers OpenAI, Azure OpenAI, Groq, Together, Mistral and any
 * llama-server started with `--embeddings` — they share the same wire shape.
 *
 * AND IF NOTHING IS CONFIGURED
 * ----------------------------
 * `createEmbedder` returns null and the RAG routes answer
 * `503 embeddings_not_configured`. It does NOT fall back to a hash, a random
 * vector, or a lexical similarity dressed up as an embedding. A fake vector
 * store returns plausible-looking nonsense: retrieval "works", answers cite
 * sources, and the ranking is meaningless. Failing loudly is the correct
 * behaviour for a capability the operator has not provisioned.
 */

/**
 * Ollama embedding provider.
 *
 * This is the deployment's real local embedder. `nomic-embed-text-v2-moe`
 * (768-dim) and `all-minilm:l6-v2` (384-dim) are already installed on this node,
 * and Ollama is up on :11434. Two consequences that matter for Satchida:
 *
 * - Embeddings are computed locally, so ingesting a document does not send its
 *   text to any third party. For the school and family tenants that is the
 *   difference between a feature that is deployable and one that is not.
 * - No API key is required, so the RAG service works on a node the operator has
 *   not yet provisioned a provider account for.
 *
 * Ollama's `/api/embed` takes a batch and returns `embeddings[]` in request
 * order; the older `/api/embeddings` is single-prompt only and is not used.
 */
async function createOllamaEmbedder(config) {
  const baseUrl = String(config.baseUrl ?? '').replace(/\/+$/, '');
  const model = String(config.model ?? '');
  const batchSize = config.batchSize ?? 16;
  const timeoutMs = config.timeoutMs ?? 120_000;

  if (!baseUrl || !model) {
    throw new EmbeddingError(
      'embeddings_not_configured',
      'RAG_EMBED_BASE_URL and RAG_EMBED_MODEL must both be set for the ollama provider',
    );
  }

  const endpoint = `${baseUrl}/api/embed`;

  async function callProvider(inputs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: inputs }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new EmbeddingError(
          'provider_error',
          `Ollama returned HTTP ${response.status}`,
          body.slice(0, 300),
        );
      }

      const payload = await response.json();
      const vectors = payload?.embeddings;
      if (!Array.isArray(vectors) || vectors.length !== inputs.length) {
        throw new EmbeddingError(
          'malformed_response',
          `Ollama returned ${Array.isArray(vectors) ? vectors.length : 'no'} embeddings for ${inputs.length} input(s)`,
        );
      }
      return vectors.map((v) => {
        if (!Array.isArray(v) || v.length === 0) {
          throw new EmbeddingError('malformed_response', 'Ollama returned an empty embedding');
        }
        return l2Normalize(v.map(Number));
      });
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      if (error?.name === 'AbortError') {
        throw new EmbeddingError('provider_timeout', 'Ollama embedding timed out');
      }
      throw new EmbeddingError(
        'provider_unreachable',
        `Ollama is not reachable at ${baseUrl}. Start it, or point RAG_EMBED_PROVIDER at a hosted provider.`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    model,
    dimensions: 0,
    async embed(inputs) {
      const out = [];
      for (let i = 0; i < inputs.length; i += batchSize) {
        const vectors = await callProvider(inputs.slice(i, i + batchSize));
        for (const vector of vectors) {
          if (this.dimensions === 0) {
            this.dimensions = vector.length;
          } else if (vector.length !== this.dimensions) {
            throw new EmbeddingError(
              'dimension_mismatch',
              `Embedding dimension changed mid-request (${this.dimensions} -> ${vector.length})`,
            );
          }
        }
        out.push(...vectors);
      }
      return out;
    },
  };
}

export class EmbeddingError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'EmbeddingError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * @typedef {object} Embedder
 * @property {string} model
 * @property {number} dimensions Dimension reported by the provider.
 * @property {(input: string[]) => Promise<number[][]>} embed Batch-embed inputs.
 */

/**
 * Cosine-normalize a vector in place.
 *
 * Normalizing at write time means similarity is a plain dot product at query
 * time, and every stored vector has length 1 — so a stored vector that has
 * drifted from its unit norm (a schema migration, a bad cast) shows up as a
 * score anomaly instead of a silent ranking change.
 */
export function l2Normalize(vector) {
  let sumSquares = 0;
  for (const value of vector) {
    sumSquares += value * value;
  }
  if (sumSquares === 0) {
    throw new EmbeddingError('degenerate_vector', 'Embedding provider returned a zero vector');
  }
  const norm = Math.sqrt(sumSquares);
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] /= norm;
  }
  return vector;
}

/**
 * Build an OpenAI-compatible embedding client.
 *
 * @param {object} config
 * @param {string} config.baseUrl e.g. https://api.openai.com/v1
 * @param {string} config.apiKey  Never logged, never returned in an error.
 * @param {string} config.model
 * @param {number} [config.batchSize]
 * @param {number} [config.timeoutMs]
 * @returns {Promise<Embedder>}
 */
async function createOpenAICompatibleEmbedder(config) {
  const baseUrl = String(config.baseUrl ?? '').replace(/\/+$/, '');
  const apiKey = String(config.apiKey ?? '');
  const model = String(config.model ?? '');
  const batchSize = config.batchSize ?? 64;
  const timeoutMs = config.timeoutMs ?? 60_000;

  if (!baseUrl || !apiKey || !model) {
    throw new EmbeddingError(
      'embeddings_not_configured',
      'RAG_EMBED_BASE_URL, RAG_EMBED_API_KEY and RAG_EMBED_MODEL must all be set',
    );
  }

  const endpoint = `${baseUrl}/embeddings`;

  async function callProvider(inputs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: inputs }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        /* The provider error body can echo the request. It is logged at debug
           only and never returned to the caller. */
        throw new EmbeddingError(
          'provider_error',
          `Embedding provider returned HTTP ${response.status}`,
          body.slice(0, 500),
        );
      }

      const payload = await response.json();
      const data = payload?.data;
      if (!Array.isArray(data) || data.length !== inputs.length) {
        throw new EmbeddingError(
          'malformed_response',
          'Embedding provider response did not match the request',
        );
      }
      /* Providers may return out of order; `index` is authoritative. */
      const ordered = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      return ordered.map((item) => {
        if (!Array.isArray(item.embedding) || item.embedding.length === 0) {
          throw new EmbeddingError('malformed_response', 'Embedding vector missing or empty');
        }
        return l2Normalize(item.embedding.map(Number));
      });
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      if (error?.name === 'AbortError') {
        throw new EmbeddingError('provider_timeout', 'Embedding provider timed out');
      }
      throw new EmbeddingError('provider_unreachable', 'Embedding provider is unreachable');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    model,
    dimensions: 0,
    async embed(inputs) {
      const batches = [];
      for (let i = 0; i < inputs.length; i += batchSize) {
        batches.push(inputs.slice(i, i + batchSize));
      }
      const out = [];
      for (const batch of batches) {
        const vectors = await callProvider(batch);
        for (const vector of vectors) {
          if (this.dimensions === 0) {
            this.dimensions = vector.length;
          } else if (vector.length !== this.dimensions) {
            /* Mixing dimensions in one store silently corrupts ranking: dot
               products of different lengths are not comparable. */
            throw new EmbeddingError(
              'dimension_mismatch',
              `Embedding dimension changed mid-request (${this.dimensions} -> ${vector.length})`,
            );
          }
        }
        out.push(...vectors);
      }
      return out;
    },
  };
}

/**
 * Build an embedder from configuration, or null when none is configured.
 *
 * Returning null rather than throwing lets the caller distinguish "operator has
 * not provisioned embeddings" (503, actionable) from "embeddings are broken"
 * (502, an incident).
 *
 * @param {object} env
 * @returns {Promise<Embedder | null>}
 */
export async function createEmbedder(env = process.env) {
  const provider = (env.RAG_EMBED_PROVIDER ?? 'openai-compatible').toLowerCase();

  if (provider === 'none' || provider === 'disabled') {
    return null;
  }

  if (provider === 'ollama') {
    if (!env.RAG_EMBED_BASE_URL || !env.RAG_EMBED_MODEL) {
      return null;
    }
    return createOllamaEmbedder({
      baseUrl: env.RAG_EMBED_BASE_URL,
      model: env.RAG_EMBED_MODEL,
      batchSize: Number(env.RAG_EMBED_BATCH_SIZE ?? 16),
      timeoutMs: Number(env.RAG_EMBED_TIMEOUT_MS ?? 120_000),
    });
  }

  if (provider === 'openai-compatible' || provider === 'openai') {
    const hasAll = env.RAG_EMBED_BASE_URL && env.RAG_EMBED_API_KEY && env.RAG_EMBED_MODEL;
    if (!hasAll) {
      return null;
    }
    return createOpenAICompatibleEmbedder({
      baseUrl: env.RAG_EMBED_BASE_URL,
      apiKey: env.RAG_EMBED_API_KEY,
      model: env.RAG_EMBED_MODEL,
      batchSize: Number(env.RAG_EMBED_BATCH_SIZE ?? 64),
      timeoutMs: Number(env.RAG_EMBED_TIMEOUT_MS ?? 60_000),
    });
  }

  throw new EmbeddingError('unknown_provider', `Unknown RAG_EMBED_PROVIDER "${provider}"`);
}

/** Dot product of two normalized vectors. */
export function dotProduct(a, b) {
  if (a.length !== b.length) {
    throw new EmbeddingError('dimension_mismatch', 'Cannot compare vectors of different dimensions');
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}