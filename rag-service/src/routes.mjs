/**
 * Satchida RAG service — real ingestion and retrieval.
 *
 * Implements the LibreChat rag-api wire contract:
 *   GET    /health      liveness + real store statistics
 *   POST   /text        multipart: file_id, file  -> extract, chunk, embed, store
 *   POST   /query       { file_id?, query, k }    -> embed, search, return passages
 *   DELETE /documents   JSON string[] of file_ids -> remove that user's chunks
 *
 * Auth: Bearer <HS256 JWT, payload { id: userId }, signed with JWT_SECRET>.
 * Every store operation is scoped to the token's `id`. There is no route that
 * reads across users, and no caller-supplied user id is trusted.
 *
 * Embeddings: an OpenAI-compatible provider (see embed.mjs). When none is
 * configured the retrieval routes answer 503 `embeddings_not_configured`. They
 * never substitute a synthetic vector — a fake embedder returns confident
 * nonsense with real-looking citations, which is worse than an error.
 */

import { createServer } from 'node:http';
import Busboy from 'busboy';
import { verifyRagToken } from './auth.mjs';
import { extract } from './extract.mjs';
import { chunkText } from './chunk.mjs';
import { createEmbedder, EmbeddingError } from './embed.mjs';
import { VectorStore } from './vectorstore.mjs';

const PORT = Number(process.env.RAG_PORT ?? 8000);
const HOST = process.env.RAG_HOST ?? '127.0.0.1';
const JWT_SECRET = process.env.JWT_SECRET ?? '';
const DB_FILE = process.env.RAG_DB_FILE ?? './data/rag.sqlite';

const MAX_UPLOAD_BYTES = Number(process.env.RAG_MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024);
const MAX_QUERY_CHARS = 8000;
const DEFAULT_K = 5;
const MAX_K = 25;

const store = new VectorStore(DB_FILE);
let embedder = null;
let embedderError = null;
/**
 * Set only after a real provider round-trip succeeds in THIS process.
 *
 * /health must not report "configured" merely because the three environment
 * variables are present: a placeholder or revoked key satisfies that check and
 * then fails every query. The state names below distinguish what is known from
 * what is assumed.
 */
let lastSuccessfulEmbedAt = null;

/** Resolved once at startup and on each ingestion, so a key rotation or a
 *  newly-provisioned embedder takes effect without a restart of the caller. */
async function getEmbedder() {
  if (embedder) return embedder;
  if (embedderError) throw embedderError;
  try {
    embedder = await createEmbedder(process.env);
  } catch (error) {
    embedderError = error instanceof EmbeddingError ? error : null;
    if (embedderError) throw embedderError;
    embedder = null;
  }
  return embedder;
}

const server = createServer((req, res) => {
  const started = Date.now();
  const send = (status, body) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    });
    res.end(payload);
  };

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  res.on('finish', () => {
    /* Never log the Authorization header, document text, or query text. */
    console.log(`${req.method} ${url.pathname} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });

  // --- unauthenticated: health -------------------------------------------
  if (req.method === 'GET' && url.pathname === '/health') {
    if (JWT_SECRET === '') {
      return send(503, { status: 'unconfigured', detail: 'JWT_SECRET is not set' });
    }
    return send(200, {
      status: 'OK',
      embeddings: embeddingState(),
      ...store.stats(),
    });
  }

  // --- everything else requires a valid token ----------------------------
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    return send(401, { detail: 'missing bearer token' });
  }

  const result = verifyRagToken(auth.slice(7), JWT_SECRET);
  if (!result.ok) {
    return send(401, { detail: result.reason });
  }
  const caller = result.payload.id;

  const route = `${req.method} ${url.pathname}`;

  if (route === 'POST /text') {
    return handleIngest(req, caller, send).catch((error) => sendError(error, send));
  }
  if (route === 'POST /query') {
    return handleQuery(req, caller, send).catch((error) => sendError(error, send));
  }
  if (route === 'DELETE /documents') {
    return handleDelete(req, caller, send).catch((error) => sendError(error, send));
  }
  return send(404, { detail: 'not_found' });
});

/** True when an embedding provider is fully configured (key never inspected). */
function awaitSafeEnv() {
  return Boolean(process.env.RAG_EMBED_BASE_URL && process.env.RAG_EMBED_API_KEY && process.env.RAG_EMBED_MODEL);
}

/**
 * Honest embedding readiness for /health.
 *
 * `configured`            env is set but no provider call has succeeded yet
 * `verified`              a real embedding round-trip succeeded in this process
 * `not_configured`        no provider env
 * `rejected`              the provider answered an error to a real request
 */
function embeddingState() {
  if (!awaitSafeEnv()) {
    return 'not_configured';
  }
  if (lastSuccessfulEmbedAt !== null) {
    return 'verified';
  }
  if (embedderError) {
    return 'rejected';
  }
  return 'configured';
}

function sendError(error, send) {
  if (error instanceof EmbeddingError) {
    const status = error.code === 'embeddings_not_configured' ? 503 : 502;
    return send(status, { detail: error.code, message: error.message });
  }
  console.error('[rag] unhandled error:', error?.message ?? error);
  return send(500, { detail: 'internal_error' });
}

function readJsonBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new EmbeddingError('payload_too_large', 'Request body exceeds the limit'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new EmbeddingError('malformed_json', 'Request body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** Multipart ingest: file_id + file. */
function readUpload(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('multipart/form-data')) {
      reject(new EmbeddingError('expected_multipart', 'POST /text requires multipart/form-data'));
      return;
    }
    let busboy;
    try {
      busboy = Busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: MAX_UPLOAD_BYTES },
      });
    } catch (error) {
      reject(new EmbeddingError('malformed_upload', String(error.message)));
      return;
    }

    let fileId = null;
    let filename = '';
    let mimetype = '';
    const fileChunks = [];

    busboy.on('field', (name, value) => {
      if (name === 'file_id') fileId = value;
    });
    busboy.on('file', (name, stream, info) => {
      filename = info.filename ?? '';
      mimetype = info.mimeType ?? '';
      stream.on('data', (chunk) => fileChunks.push(chunk));
    });
    busboy.on('error', (error) => reject(new EmbeddingError('upload_failed', String(error.message))));
    busboy.on('close', () => {
      resolve({ fileId, filename, mimetype, buffer: Buffer.concat(fileChunks) });
    });
    req.pipe(busboy);
  });
}

async function handleIngest(req, caller, send) {
  const embed = await getEmbedder();
  if (!embed) {
    return send(503, {
      detail: 'embeddings_not_configured',
      message:
        'No embedding provider is configured. Set RAG_EMBED_BASE_URL, RAG_EMBED_API_KEY and RAG_EMBED_MODEL. The service will not substitute synthetic vectors.',
    });
  }

  let fileId;
  let filename;
  let buffer;
  try {
    ({ fileId, filename, buffer } = await readUpload(req));
  } catch (error) {
    return sendError(error, send);
  }

  if (!fileId) {
    return send(400, { detail: 'missing_file_id' });
  }
  if (buffer.length === 0) {
    return send(400, { detail: 'empty_file' });
  }

  /* extract() returns { text, pages, pageCount, kind } — the page structure is
     preserved so a retrieved chunk can be cited back to its source page. */
  let extracted;
  try {
    extracted = await extract(buffer, filename, '');
  } catch (error) {
    /* Extraction failures are a property of the upload (corrupt PDF,
       password-protected, unsupported type), not a server fault. */
    const detail = String(error?.message ?? 'extraction_failed');
    const status = detail.startsWith('unsupported_type') ? 415 : 422;
    return send(status, { detail: 'extraction_failed', reason: detail.slice(0, 120) });
  }

  const text = extracted?.text ?? '';
  if (typeof text !== 'string' || text.trim().length === 0) {
    return send(422, { detail: 'no_extractable_text' });
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return send(422, { detail: 'no_chunks' });
  }

  let vectors;
  try {
    vectors = await embed.embed(chunks.map((c) => c.text));
  } catch (error) {
    /* A provider rejection is an observed fact, not a transient guess: record
       it so /health reports `rejected` rather than a reassuring `configured`. */
    if (error instanceof EmbeddingError) {
      embedderError = error;
    }
    return sendError(error, send);
  }
  lastSuccessfulEmbedAt = Date.now();

  store.replaceDocument({
    userId: caller,
    fileId,
    filename: filename || fileId,
    model: embed.model,
    chunks: chunks.map((chunk, i) => ({ index: chunk.index, text: chunk.text, vector: vectors[i] })),
  });

  /*
   * `text` is REQUIRED by LibreChat: packages/api/src/files/text.ts:134 throws
   * 'RAG API did not return parsed text' and silently falls back to native
   * parsing when it is absent, which would make file upload look half-working.
   * The rest of the fields are diagnostics for the operator.
   */
  return send(200, {
    text,
    fileId,
    filename: filename || fileId,
    chunks: chunks.length,
    model: embed.model,
    dimensions: embed.dimensions,
    textLength: text.length,
    kind: extracted.kind,
    pageCount: extracted.pageCount,
  });
}

async function handleQuery(req, caller, send) {
  const embed = await getEmbedder();
  if (!embed) {
    return send(503, {
      detail: 'embeddings_not_configured',
      message:
        'No embedding provider is configured. Set RAG_EMBED_PROVIDER and RAG_EMBED_BASE_URL / RAG_EMBED_MODEL. The service will not substitute synthetic vectors.',
    });
  }

  const body = await readJsonBody(req);
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return send(400, { detail: 'missing_query' });
  }
  if (query.length > MAX_QUERY_CHARS) {
    return send(413, { detail: 'query_too_long', limit: MAX_QUERY_CHARS });
  }

  const k = Math.min(Math.max(1, Number(body.k) || DEFAULT_K), MAX_K);

  /*
   * LibreChat sends one query PER FILE with `file_id` set, and types the
   * response as `Array<[{ page_content, metadata: { source, page } }, number]>`.
   * A `{ results: [...] }` envelope silently yields no hits, so the wire shape
   * here is a bare array of [hit, score] tuples — not a convenience wrapper.
   * See packages/api/src/files/rag/search.ts:23-28 and context.ts:13-18.
   */
  const fileId = typeof body.file_id === 'string' && body.file_id ? body.file_id : undefined;

  let vector;
  try {
    [vector] = await embed.embed([query]);
    lastSuccessfulEmbedAt = Date.now();
  } catch (error) {
    if (error instanceof EmbeddingError) {
      embedderError = error;
    }
    return sendError(error, send);
  }

  const hits = store.search({ userId: caller, queryVector: vector, k, fileId });

  const payload = hits.map((hit) => [
    {
      page_content: hit.text,
      metadata: {
        source: hit.filename,
        page: hit.chunkIndex,
      },
    },
    Number(hit.score.toFixed(6)),
  ]);

  return send(200, payload);
}

async function handleDelete(req, caller, send) {
  const body = await readJsonBody(req);
  const fileIds = Array.isArray(body) ? body : body.fileIds;
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return send(400, { detail: 'missing_file_ids' });
  }
  let deleted = 0;
  for (const fileId of fileIds) {
    if (typeof fileId !== 'string' || fileId.length === 0) continue;
    deleted += store.deleteByFile({ userId: caller, fileId });
  }
  return send(200, { deleted });
}

server.listen(PORT, HOST, () => {
  console.log(`satchida-rag listening on http://${HOST}:${PORT}`);
  if (JWT_SECRET === '') {
    console.warn('WARNING: JWT_SECRET is not set. /health will report 503.');
  }
  if (!awaitSafeEnv()) {
    console.warn(
      'WARNING: no embedding provider configured. /text and /query will answer 503 embeddings_not_configured.',
    );
  }
  console.log(`vector store: ${DB_FILE}`);
  const stats = store.stats();
  console.log(`store: ${stats.chunks} chunks across ${stats.documents} documents`);
});

const shutdown = () => {
  store.close();
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { server, store };