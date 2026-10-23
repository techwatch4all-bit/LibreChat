#!/usr/bin/env node
/**
 * RAG service launcher.
 *
 * Exists so the service reads the SAME `.env` LibreChat does, rather than
 * relying on whoever started it to have exported the right variables. The
 * previous arrangement was the reason the service came up on the default
 * :8000 with no JWT_SECRET and no embedding provider: it worked only when the
 * launching shell happened to have the environment.
 *
 * Secret handling: the embedding key is copied from OPENAI_API_KEY into
 * RAG_EMBED_API_KEY inside this process's environment only. It is never
 * written to disk, never echoed, and never included in an error message or a
 * log line. `SATCHIDA_ALLOW_ENV_FILE=0` starts the service with no .env at all,
 * which is what a container or a Windows service should do if it injects
 * secrets from its own store.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/* rag-service/ -> LibreChat/, which is where .env lives. */
const ROOT = path.resolve(HERE, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) {
    return {};
  }
  const out = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const index = line.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

if (process.env.SATCHIDA_ALLOW_ENV_FILE !== '0') {
  const fileEnv = loadEnvFile(path.join(ROOT, '.env'));
  for (const [key, value] of Object.entries(fileEnv)) {
    /* dotenv semantics: an already-set variable wins, so an operator can
       override .env from the shell without editing it. */
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/* The embedding key is the one secret the RAG service needs. Prefer an
   explicit RAG_EMBED_API_KEY; otherwise fall back to the provider key already
   present for the LibreChat instance. */
if (!process.env.RAG_EMBED_API_KEY) {
  process.env.RAG_EMBED_API_KEY = process.env.OPENAI_API_KEY ?? '';
}

const missing = [];
if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
if (process.env.RAG_EMBED_PROVIDER !== 'none' && !process.env.RAG_EMBED_API_KEY) {
  missing.push('RAG_EMBED_API_KEY (or OPENAI_API_KEY)');
}

console.log('satchida-rag starting');
console.log(`  RAG_PORT            ${process.env.RAG_PORT ?? '(default 8000)'}`);
console.log(`  RAG_DB_FILE         ${process.env.RAG_DB_FILE ?? '(default ./data/rag.sqlite)'}`);
console.log(
  `  embeddings          ${
    process.env.RAG_EMBED_PROVIDER === 'none' || !process.env.RAG_EMBED_API_KEY
      ? 'NOT CONFIGURED (/text and /query will answer 503)'
      : `${process.env.RAG_EMBED_BASE_URL} model=${process.env.RAG_EMBED_MODEL}`
  }`,
);
if (missing.length) {
  console.warn(`  WARNING: missing ${missing.join(', ')}`);
}

await import('./src/routes.mjs');