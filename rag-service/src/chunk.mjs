/**
 * Text chunking for retrieval.
 *
 * Design constraints this satisfies:
 *
 * - **Deterministic.** The same document always produces the same chunks and the
 *   same chunk ids, so re-ingesting a file is idempotent and a stored vector
 *   can be traced back to the exact span it came from.
 * - **Structure-aware.** Splitting on blank lines alone produces one enormous
 *   chunk for a page of unbroken prose and a one-line chunk for a table. Text is
 *   split by paragraph first, then sentences, so chunk sizes stay near the
 *   target without cutting mid-thought.
 * - **Overlapping.** Neighbouring chunks share a tail/head window. A sentence
 *   straddling a boundary would otherwise be unreachable by any query, because
 *   no chunk contains all of it.
 * - **Dependency-free.** No tokenizer download; a word-count approximation is
 *   used for sizing. Embedding models truncate long inputs anyway, so exact
 *   token accounting buys nothing here.
 *
 * Sizes are in words. The defaults target roughly a paragraph-and-a-half, which
 * is the usual sweet spot for retrieval granularity: big enough to carry a
 * complete argument, small enough that several fit in the model's context.
 */

const DEFAULT_TARGET_WORDS = 180;
const DEFAULT_OVERLAP_WORDS = 36;
const MIN_CHUNK_WORDS = 12;

/** Split text into paragraph-ish blocks, keeping headings attached to their body. */
function splitBlocks(text) {
  const normalized = text.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const blocks = [];
  let current = [];

  const flush = () => {
    const joined = current.join('\n').trim();
    if (joined) {
      blocks.push(joined);
    }
    current = [];
  };

  let inFence = false;
  for (const line of lines) {
    // A fenced code block is atomic: splitting it mid-block produces chunks
    // that are not valid code, and code is often the most retrieval-worthy
    // content in a technical document.
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
    }
    if (!inFence && line.trim() === '') {
      flush();
      continue;
    }
    current.push(line);
    if (inFence === false && /^#{1,6}\s/.test(line)) {
      // Keep a heading and the paragraph beneath it in the same block so the
      // chunk carries its own label.
      const next = lines[lines.indexOf(line) + 1];
      if (next === undefined || next.trim() === '') {
        flush();
      }
    }
  }
  flush();
  return blocks;
}

/**
 * Abbreviations after which a period does NOT end a sentence.
 *
 * Without this, "e.g." splits into "Use e." + "g." and "3.14" splits into
 * "3." + "14" — which shreds technical prose into fragments that retrieve
 * badly. This list covers the abbreviations that actually appear in the
 * documents this service ingests (statutes, specs, runbooks, code comments).
 */
const ABBREVIATIONS = new Set([
  'e.g', 'i.e', 'etc', 'vs', 'cf', 'al', 'fig', 'no', 'vol', 'pp',
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'jr', 'sr', 'inc', 'ltd', 'co',
  'sec', 'art', 'ch', 'para', 'ref', 'approx', 'dept', 'est', 'min', 'max',
  'u.s', 'u.k', 'p.s', 'a.m', 'p.m',
]);

/**
 * Split text into sentences.
 *
 * A boundary is a `.`, `!` or `?` that is followed by whitespace and then a
 * capital letter, digit, or opening quote — AND is not preceded by a known
 * abbreviation or a single-letter initial ("J. R. R. Tolkien"). This is a
 * deliberately conservative splitter: over-splitting damages retrieval far
 * more than under-splitting does.
 */
export function splitSentences(text) {
  const source = String(text ?? '');
  if (source.trim() === '') {
    return [];
  }

  const sentences = [];
  let start = 0;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char !== '.' && char !== '!' && char !== '?') {
      continue;
    }

    // Consume a run of terminators plus any closing quote/bracket.
    let end = i + 1;
    while (end < source.length && /[.!?]/.test(source[end])) {
      end += 1;
    }
    while (end < source.length && /["')\]]/.test(source[end])) {
      end += 1;
    }

    const next = source[end];
    if (next === undefined || !/\s/.test(next)) {
      i = end - 1;
      continue;
    }

    const afterSpace = source.slice(end).replace(/^\s+/, '');
    if (afterSpace.length > 0 && !/^[A-Z0-9"'(\[]/.test(afterSpace)) {
      /* Lowercase continuation: almost certainly mid-sentence ("e.g. this"). */
      i = end - 1;
      continue;
    }

    if (char === '.') {
      // Look back over the token immediately preceding the period.
      const before = source.slice(0, i);
      const tokenMatch = before.match(/([A-Za-z][A-Za-z.]*)$/);
      const token = tokenMatch?.[1] ?? '';
      const lowered = token.toLowerCase();
      if (ABBREVIATIONS.has(lowered)) {
        i = end - 1;
        continue;
      }
      /* Single letter before the period is an initial ("J." in "J. R. R."). */
      if (token.length === 1 && /[A-Z]/.test(token)) {
        i = end - 1;
        continue;
      }
      /* A letter-digit pair is a decimal or a version ("3.14", "v1.2"). */
      if (/\d$/.test(before) && /^\d/.test(afterSpace)) {
        i = end - 1;
        continue;
      }
    }

    const candidate = source.slice(start, end).trim();
    if (candidate) {
      sentences.push(candidate);
    }
    start = end;
    i = end - 1;
  }

  const tail = source.slice(start).trim();
  if (tail) {
    sentences.push(tail);
  }
  return sentences.length > 0 ? sentences : [source.trim()];
}

const countWords = (text) => text.split(/\s+/).filter(Boolean).length;

/**
 * Split one block into sentence-aligned chunks of about `targetWords`.
 * @returns {string[]}
 */
function chunkBlock(block, targetWords) {
  const words = countWords(block);
  if (words <= targetWords * 1.5) {
    return [block];
  }
  // Headings alone are far under target but must stay whole.
  if (/^#{1,6}\s/.test(block) && words < 40) {
    return [block];
  }

  const sentences = splitSentences(block);
  const chunks = [];
  let current = [];
  let currentWords = 0;

  /** Split on word boundaries when a "sentence" is really a run-on line. */
  const splitByWords = (text, size) => {
    const words = text.split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < words.length; i += size) {
      out.push(words.slice(i, i + size).join(' '));
    }
    return out;
  };

  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);

    // Prose with no sentence terminators (a log dump, a minified payload, a
    // long unwrapped line) arrives as one enormous "sentence". Emitting it
    // whole would produce a single chunk that no query can match usefully, so
    // it is divided on word boundaries instead.
    if (sentenceWords > targetWords * 1.5) {
      if (currentWords > 0) {
        chunks.push(current.join(' '));
        current = [];
        currentWords = 0;
      }
      const parts = splitByWords(sentence, targetWords);
      for (const part of parts) {
        chunks.push(part);
      }
      continue;
    }

    if (currentWords > 0 && currentWords + sentenceWords > targetWords) {
      chunks.push(current.join(' '));
      current = [];
      currentWords = 0;
    }
    current.push(sentence);
    currentWords += sentenceWords;
  }
  if (current.length) {
    chunks.push(current.join(' '));
  }
  return chunks;
}

/**
 * Chunk a document into overlapping, retrievable spans.
 *
 * @param {string} text Extracted document text.
 * @param {object} [options]
 * @param {number} [options.targetWords]
 * @param {number} [options.overlapWords] Tail of each chunk repeated as the head
 *   of the next. 0 disables overlap.
 * @param {number} [options.minWords] Chunks below this are merged forward; a
 *   fragment of three words is not worth an embedding.
 * @returns {Array<{ index: number, text: string, wordCount: number }>}
 */
export function chunkText(text, options = {}) {
  const targetWords = options.targetWords ?? DEFAULT_TARGET_WORDS;
  const overlapWords = options.overlapWords ?? DEFAULT_OVERLAP_WORDS;
  const minWords = options.minWords ?? MIN_CHUNK_WORDS;

  if (typeof text !== 'string' || text.trim() === '') {
    return [];
  }

  const pieces = [];
  for (const block of splitBlocks(text)) {
    for (const piece of chunkBlock(block, targetWords)) {
      pieces.push(piece);
    }
  }
  if (pieces.length === 0) {
    return [];
  }

  // Merge undersized fragments into the following piece. Indexed rather than
  // indexOf-based: two identical fragments would otherwise resolve to the same
  // first index and the tail piece would be dropped.
  const merged = [];
  let pending = null;
  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i];
    if (pending) {
      merged.push(`${pending}\n\n${piece}`);
      pending = null;
      continue;
    }
    if (countWords(piece) < minWords && i !== pieces.length - 1) {
      pending = piece;
      continue;
    }
    merged.push(piece);
  }
  if (pending) {
    if (merged.length) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${pending}`;
    } else {
      merged.push(pending);
    }
  }

  // Apply overlap between neighbours.
  if (overlapWords <= 0) {
    return merged.map((t, index) => ({ index, text: t, wordCount: countWords(t) }));
  }

  const out = [];
  for (let i = 0; i < merged.length; i += 1) {
    let text = merged[i];
    if (i > 0) {
      const previousWords = merged[i - 1].split(/\s+/).filter(Boolean);
      const tail = previousWords.slice(Math.max(0, previousWords.length - overlapWords)).join(' ');
      if (tail) {
        text = `${tail}\n\n${text}`;
      }
    }
    out.push({ index: i, text, wordCount: countWords(text) });
  }
  return out;
}