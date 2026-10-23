/**
 * Document text extraction with page boundaries.
 *
 * Page numbers are not decoration here — they are the citation guarantee that
 * RAG-AND-OFFERINGS.md §3 sells. Every page is kept as its own chunk so a
 * retrieved span can always name where it came from.
 *
 * Parsers are the same permissive-licence libraries already used by the
 * LibreChat tree: pdfjs-dist (Apache-2.0) and mammoth (BSD-3-Clause).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const PDF_MAX_PAGES = 3000;

/**
 * @typedef {{ page: number; text: string }} PageText
 * @typedef {{ text: string; pages: PageText[]; pageCount: number; kind: string }} Extracted
 */

/**
 * Extract PDF text page by page.
 * @param {Buffer} buf
 * @returns {Promise<Extracted>}
 */
export async function extractPdf(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // pdf.js >=5 removed PDFDocumentProxy.destroy(); cleanup belongs to the
  // loading task, so we keep a reference and tear down through that.
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;

  const pageCount = doc.numPages;
  if (pageCount > PDF_MAX_PAGES) {
    await loadingTask.destroy();
    throw new Error(`document_too_large:${pageCount}_pages`);
  }

  /** @type {PageText[]} */
  const pages = [];
  for (let n = 1; n <= pageCount; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // Reassemble lines from positioned items so words do not run together.
    const lines = [];
    let current = '';
    let lastY = null;
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue;
      const y = item.transform?.[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (current.trim()) lines.push(current.trim());
        current = '';
      }
      current += item.str;
      if (item.hasEOL) current += ' ';
      lastY = y;
    }
    if (current.trim()) lines.push(current.trim());
    const text = lines.join('\n');
    if (text.trim()) pages.push({ page: n, text });
    page.cleanup();
  }

  await loadingTask.destroy();
  return { text: pages.map((p) => p.text).join('\n\n'), pages, pageCount, kind: 'pdf' };
}

/**
 * Extract DOCX text. Page numbers are unavailable in DOCX flow format, so every
 * paragraph carries an ordinal that we expose as the "section" reference.
 * @param {Buffer} buf
 * @returns {Promise<Extracted>}
 */
export async function extractDocx(buf) {
  const mammoth = require('mammoth');
  const { value } = await mammoth.extractRawText({ buffer: buf });
  const lines = value.split(/\r?\n/).filter((l) => l.trim().length > 0);
  let para = 0;
  const pages = lines.map((text) => {
    para += 1;
    return { page: para, text };
  });
  return { text: lines.join('\n'), pages, pageCount: pages.length, kind: 'docx' };
}

/**
 * Extract plain text / markdown / other text-like formats.
 * @param {Buffer} buf
 * @returns {Promise<Extracted>}
 */
export async function extractPlain(buf) {
  const text = buf.toString('utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return { text, pages: lines.map((t, i) => ({ page: i + 1, text: t })), pageCount: lines.length, kind: 'text' };
}

/**
 * Dispatch on filename/mimetype.
 * @param {Buffer} buf
 * @param {string} filename
 * @param {string} mimetype
 * @returns {Promise<Extracted>}
 */
export async function extract(buf, filename = '', mimetype = '') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf') || mimetype === 'application/pdf') return extractPdf(buf);
  if (lower.endsWith('.docx') || mimetype.includes('wordprocessingml')) return extractDocx(buf);
  if (mimetype.startsWith('text/') || /\.(txt|md|csv|json|yaml|yml)$/.test(lower)) return extractPlain(buf);
  throw new Error(`unsupported_type:${mimetype || lower}`);
}