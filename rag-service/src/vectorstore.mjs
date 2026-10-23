/**
 * Vector store for the Satchida RAG service.
 *
 * Storage decision
 * ----------------
 * SQLite via node's built-in `node:sqlite`, holding vectors as Float32 BLOBs.
 *
 * This deployment has no Docker, no Redis, and no Postgres — the handover
 * forecloses all three for Windows edge nodes — so `pgvector` (rag.yml) and
 * LanceDB's server mode are unavailable. node:sqlite is built into Node 24,
 * needs no native build on Windows, and is a genuinely durable store.
 *
 * The honest trade-off: retrieval is a brute-force scan. Every query embeds,
 * loads candidate vectors and computes cosine similarity in JS. At the scale
 * this product actually serves — a few thousand chunks per tenant — a linear
 * scan is well under a millisecond and the architecture stays simple and
 * correct. An HNSW index would matter at 10^5+ chunks per tenant; if Satchida
 * ever reaches that, this file is the one to replace, and `search()` is the
 * only interface that would change.
 *
 * Isolation
 * ---------
 * Every row carries `user_id`, and every query is scoped by it. A retrieval
 * service that can be pointed at another user's chunks is a data breach, so
 * the scope is a required argument of both `search` and `deleteByFile`, never
 * an option.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { EmbeddingError, dotProduct } from './embed.mjs';

const SCHEMA_VERSION = 1;

/**
 * @param {Buffer} buffer Float32Array bytes
 * @returns {number[]} plain array for JSON transport and scoring
 */
export function vectorFromBuffer(buffer) {
  const array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  return Array.from(array);
}

/**
 * @param {number[]} vector
 * @returns {Buffer}
 */
export function vectorToBuffer(vector) {
  const array = Float32Array.from(vector);
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

export class VectorStore {
  /**
   * @param {string} file Path to the SQLite database file.
   */
  constructor(file) {
    if (file !== ':memory:') {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    this.db = new DatabaseSync(file);
    this.#migrate();
  }

  #migrate() {
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     TEXT    NOT NULL,
        file_id     TEXT    NOT NULL,
        filename    TEXT    NOT NULL,
        chunk_index INTEGER NOT NULL,
        text        TEXT    NOT NULL,
        dimensions  INTEGER NOT NULL,
        vector      BLOB    NOT NULL,
        model       TEXT    NOT NULL,
        created_at  INTEGER NOT NULL,
        UNIQUE (user_id, file_id, chunk_index)
      );
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_chunks_user_file ON chunks (user_id, file_id);');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_chunks_user ON chunks (user_id);');

    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get('schema_version');
    if (row === undefined) {
      this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(
        'schema_version',
        String(SCHEMA_VERSION),
      );
    } else if (Number(row.value) !== SCHEMA_VERSION) {
      /* No migration path exists yet. Refusing to serve is correct: silently
         running v0 code against a v1 layout corrupts data. */
      throw new Error(
        `Vector store schema version ${row.value} is not supported by this build (expected ${SCHEMA_VERSION})`,
      );
    }
  }

  /**
   * Replace every chunk belonging to one document.
   *
   * Delete-then-insert rather than upsert: a re-ingested file whose chunk count
   * shrank would otherwise leave orphaned tail rows that still match queries
   * and cite text the file no longer contains.
   */
  replaceDocument({ userId, fileId, filename, model, chunks }) {
    const insert = this.db.prepare(`
      INSERT INTO chunks (user_id, file_id, filename, chunk_index, text, dimensions, vector, model, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const del = this.db.prepare('DELETE FROM chunks WHERE user_id = ? AND file_id = ?');
    const now = Date.now();

    this.db.exec('BEGIN');
    try {
      del.run(userId, fileId);
      for (const chunk of chunks) {
        insert.run(
          userId,
          fileId,
          filename,
          chunk.index,
          chunk.text,
          chunk.vector.length,
          vectorToBuffer(chunk.vector),
          model,
          now,
        );
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * Brute-force cosine search over one user's chunks.
   *
   * @param {object} params
   * @param {string} params.userId Required scope.
   * @param {number[]} params.queryVector Normalized query embedding.
   * @param {number} [params.k]
   * @param {number} [params.minScore]
   * @param {string} [params.fileId] Restrict to one document.
   * @returns {Array<{ fileId: string, filename: string, chunkIndex: number, text: string, score: number }>}
   */
  search({ userId, queryVector, k = 5, minScore = 0, fileId }) {
    if (!userId) {
      throw new EmbeddingError('missing_scope', 'userId is required for retrieval');
    }
    const rows = fileId
      ? this.db
          .prepare('SELECT * FROM chunks WHERE user_id = ? AND file_id = ?')
          .all(userId, fileId)
      : this.db.prepare('SELECT * FROM chunks WHERE user_id = ?').all(userId);

    const scored = [];
    for (const row of rows) {
      if (row.dimensions !== queryVector.length) {
        /* A model change leaves old vectors at a different width. Skipping is
           correct; scoring them would be arithmetically meaningless. */
        continue;
      }
      const score = dotProduct(queryVector, vectorFromBuffer(row.vector));
      if (score >= minScore) {
        scored.push({
          fileId: row.file_id,
          filename: row.filename,
          chunkIndex: row.chunk_index,
          text: row.text,
          score,
        });
      }
    }

    /* Ties break on file then chunk so identical scores return a stable order
       across runs — an unstable top-k makes a citation set flicker. */
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.fileId !== b.fileId) return a.fileId < b.fileId ? -1 : 1;
      return a.chunkIndex - b.chunkIndex;
    });
    return scored.slice(0, k);
  }

  deleteByFile({ userId, fileId }) {
    if (!userId) {
      throw new EmbeddingError('missing_scope', 'userId is required for deletion');
    }
    const result = this.db
      .prepare('DELETE FROM chunks WHERE user_id = ? AND file_id = ?')
      .run(userId, fileId);
    return Number(result.changes ?? 0);
  }

  /** Counts, for the health endpoint and for operator verification. */
  stats() {
    const total = this.db.prepare('SELECT COUNT(*) AS n FROM chunks').get();
    const files = this.db
      .prepare('SELECT COUNT(DISTINCT user_id || \'\\x00\' || file_id) AS n FROM chunks')
      .get();
    const users = this.db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM chunks').get();
    const dims = this.db.prepare('SELECT DISTINCT dimensions FROM chunks').all();
    return {
      schemaVersion: SCHEMA_VERSION,
      chunks: Number(total?.n ?? 0),
      documents: Number(files?.n ?? 0),
      users: Number(users?.n ?? 0),
      dimensions: dims.map((d) => Number(d.dimensions)),
    };
  }

  close() {
    try {
      this.db.close();
    } catch {
      /* already closed */
    }
  }
}