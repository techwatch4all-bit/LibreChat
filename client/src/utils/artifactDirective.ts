const ARTIFACT_MIME_TYPES = new Set([
  'text/html',
  'text/md',
  'text/plain',
  'text/markdown',
  'image/svg+xml',
  'application/vnd.react',
  'application/vnd.ant.react',
  'application/vnd.mermaid',
  'application/vnd.librechat.project',
]);

const ARTIFACT_MIME_REGEX =
  /type\s*=\s*["'](text\/html|text\/md|text\/plain|text\/markdown|image\/svg\+xml|application\/vnd\.react|application\/vnd\.ant\.react|application\/vnd\.mermaid|application\/vnd\.librechat\.project)["']/i;

const ARTIFACT_HTML_TYPE_REGEX = /type\s*=\s*["'](?:text\/html|application\/vnd\.code-html)["']/i;
const MALFORMED_DIRECTIVE_REGEX = /^\s*:::(?!artifact(?:\b|\{))([a-zA-Z][a-zA-Z0-9_-]*)\s*(.+)$/;
const FENCE_OPEN_REGEX = /^\s*([`~]{3,})\s*([a-zA-Z0-9_-]*)\s*$/;
const DOC_TITLE_REGEX = /<title>([^<\r\n]{1,120})<\/title>/i;
const HTML_DOC_START_REGEX = /^\s*(?:<!doctype\s+html\b|<html(?:\s|>))/i;
const HTML_DOC_END_REGEX = /<\/html>\s*$/i;
const RICH_HTML_TAG_REGEX = /<(?:style|script|svg|canvas|head|body)\b/i;

function escapeAttrValue(value: string): string {
  return value
    .replace(/["{}\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function toKebabId(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || 'html-simulation';
}

function parseAttributes(raw: string): Record<string, string> {
  const trimmed = raw.trim().replace(/^\{/, '').replace(/\}$/, '').trim();
  const attrs: Record<string, string> = {};
  const attrPattern = /([a-zA-Z_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match = attrPattern.exec(trimmed);
  while (match) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? '';
    match = attrPattern.exec(trimmed);
  }
  return attrs;
}

function safeBacktickFence(body: string, minLength = 4): string {
  let maxRun = 0;
  const runs = body.match(/`+/g);
  if (runs) {
    for (const run of runs) {
      if (run.length > maxRun) {
        maxRun = run.length;
      }
    }
  }
  return '`'.repeat(Math.max(minLength, maxRun + 1));
}

function isStandaloneHtmlDocument(body: string): boolean {
  const trimmed = body.trim();
  if (!HTML_DOC_START_REGEX.test(trimmed) || !HTML_DOC_END_REGEX.test(trimmed)) {
    return false;
  }
  const lineCount = trimmed.split('\n').length;
  return lineCount >= 15 || RICH_HTML_TAG_REGEX.test(trimmed);
}

function buildArtifactHeader(identifier: string, type: string, title: string): string {
  return `:::artifact{identifier="${escapeAttrValue(identifier)}" type="${escapeAttrValue(type)}" title="${escapeAttrValue(title)}"}`;
}

function allocateIdentifier(baseId: string, usedIds: Set<string>): string {
  const candidate = toKebabId(baseId);
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate);
    return candidate;
  }
  let suffix = 2;
  while (usedIds.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }
  const unique = `${candidate}-${suffix}`;
  usedIds.add(unique);
  return unique;
}

/**
 * Normalizes malformed non-`artifact` directive containers carrying explicit artifact MIME types
 * (e.g. `:::floorplan-3d type="text/html"`) and promotes complete closed standalone `<!DOCTYPE html>`
 * fenced blocks emitted outside an artifact wrapper into valid `:::artifact{...}` directives so
 * LibreChat opens the interactive preview automatically across varying models.
 */
export function normalizeArtifactDirectives(content: string): string {
  if (!content) {
    return content;
  }
  const hasColon = content.includes(':::');
  const hasHtmlHint = /<!doctype\s+html|<html[\s>]/i.test(content);
  if (!hasColon && !hasHtmlHint) {
    return content;
  }

  const lines = content.split(/\r?\n/);
  const output: string[] = [];
  const usedIds = new Set<string>();
  let changed = false;
  let inArtifact = false;
  let artifactIsHtml = false;
  let awaitingArtifactBody = false;
  let outerFence: { char: string; len: number } | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Inside a non-artifact fenced block inside prose, look only for matching close unless we handle html below.
    if (outerFence != null) {
      output.push(line);
      const trimmed = line.trim();
      const closeMatch = trimmed.match(/^([`~]{3,})\s*$/);
      if (
        closeMatch &&
        closeMatch[1][0] === outerFence.char &&
        closeMatch[1].length >= outerFence.len
      ) {
        outerFence = null;
      }
      i += 1;
      continue;
    }

    if (inArtifact) {
      const trimmedStart = line.trimStart();
      if (trimmedStart.startsWith(':::') && !trimmedStart.startsWith(':::artifact')) {
        inArtifact = false;
        artifactIsHtml = false;
        awaitingArtifactBody = false;
        output.push(line);
        i += 1;
        continue;
      }

      if (awaitingArtifactBody) {
        if (line.trim() === '') {
          output.push(line);
          i += 1;
          continue;
        }
        awaitingArtifactBody = false;
        const bodyFenceMatch = line.match(FENCE_OPEN_REGEX);
        if (bodyFenceMatch) {
          outerFence = { char: bodyFenceMatch[1][0], len: bodyFenceMatch[1].length };
          output.push(line);
          i += 1;
          continue;
        }
        if (artifactIsHtml && HTML_DOC_START_REGEX.test(line)) {
          let closeIdx = -1;
          for (let j = i + 1; j < lines.length; j += 1) {
            const candidate = lines[j].trimStart();
            if (candidate.startsWith(':::') && !candidate.startsWith(':::artifact')) {
              closeIdx = j;
              break;
            }
          }
          if (closeIdx !== -1) {
            let endIdx = closeIdx;
            while (endIdx > i && lines[endIdx - 1].trim() === '') {
              endIdx -= 1;
            }
            const body = lines.slice(i, endIdx).join('\n');
            if (isStandaloneHtmlDocument(body)) {
              const outer = safeBacktickFence(body, 4);
              output.push(`${outer}html`);
              output.push(...lines.slice(i, endIdx));
              output.push(outer);
              changed = true;
              i = endIdx;
              continue;
            }
          }
        }
      }

      const fenceMatch = line.match(FENCE_OPEN_REGEX);
      if (fenceMatch) {
        outerFence = { char: fenceMatch[1][0], len: fenceMatch[1].length };
      }
      output.push(line);
      i += 1;
      continue;
    }

    // Track canonical :::artifact{...}
    if (line.trimStart().startsWith(':::artifact')) {
      const idMatch = line.match(/identifier\s*=\s*["']([^"']+)["']/i);
      if (idMatch?.[1]) {
        usedIds.add(idMatch[1].trim());
      }
      inArtifact = true;
      artifactIsHtml = ARTIFACT_HTML_TYPE_REGEX.test(line);
      awaitingArtifactBody = true;
      output.push(line);
      i += 1;
      continue;
    }

    // Rule 1: Normalize malformed `:::<slug> ... type="text/html"` into `:::artifact{...}`
    const malformedMatch = line.match(MALFORMED_DIRECTIVE_REGEX);
    if (malformedMatch) {
      const slug = malformedMatch[1];
      const rawTail = malformedMatch[2];
      if (ARTIFACT_MIME_REGEX.test(rawTail)) {
        const attrs = parseAttributes(rawTail);
        const type = ARTIFACT_MIME_TYPES.has((attrs.type ?? '').toLowerCase())
          ? attrs.type.toLowerCase()
          : 'text/html';
        const identifier = allocateIdentifier(attrs.identifier || slug, usedIds);
        const title = attrs.title || slugToTitle(slug) || 'Interactive Artifact';
        output.push(buildArtifactHeader(identifier, type, title));
        inArtifact = true;
        artifactIsHtml = type === 'text/html' || type === 'application/vnd.code-html';
        awaitingArtifactBody = true;
        changed = true;
        i += 1;
        continue;
      }
    }

    // Rule 2: Promote closed standalone `<!DOCTYPE html>...</html>` code blocks into `:::artifact`
    const fenceMatch = line.match(FENCE_OPEN_REGEX);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      const lang = (fenceMatch[2] ?? '').toLowerCase();

      if (lang === 'html' || lang === 'htm' || lang === '') {
        let closeIdx = -1;
        for (let j = i + 1; j < lines.length; j += 1) {
          const closeMatch = lines[j].trim().match(/^([`~]{3,})\s*$/);
          if (closeMatch && closeMatch[1][0] === char && closeMatch[1].length >= len) {
            closeIdx = j;
            break;
          }
        }

        if (closeIdx !== -1) {
          const body = lines.slice(i + 1, closeIdx).join('\n');
          if (isStandaloneHtmlDocument(body)) {
            const titleMatch = body.match(DOC_TITLE_REGEX);
            const title = escapeAttrValue(titleMatch?.[1] || 'Interactive HTML Simulation');
            const identifier = allocateIdentifier(title, usedIds);
            const outer = safeBacktickFence(body, 4);
            output.push(buildArtifactHeader(identifier, 'text/html', title));
            output.push(`${outer}html`);
            output.push(...lines.slice(i + 1, closeIdx));
            output.push(outer);
            output.push(':::');
            changed = true;
            i = closeIdx + 1;
            continue;
          }
        }
      }

      outerFence = { char, len };
    }

    output.push(line);
    i += 1;
  }

  return changed ? output.join('\n') : content;
}
