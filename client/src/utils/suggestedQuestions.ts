/**
 * Chat answer post-processing for the suggested-question chips.
 *
 * Two things go wrong often enough to be worth one tested module:
 * 1. Models wrap an answer reveal in raw `<details><summary>` HTML. `rehype-raw` is not
 *    installed, so the tags reach the reader as literal text. They are rewritten to a
 *    Markdown blockquote instead, and fenced code is left alone.
 * 2. The follow-up questions section is followed by a disclaimer or a closing note. The
 *    whole tail used to be captured, so the disclaimer became a chip and disappeared from
 *    the answer. It is now split: bullets become chips, everything else goes back into the
 *    rendered Markdown.
 */

export type ParsedSuggestedQuestions = {
  mainContent: string;
  questions: string[];
};

/** A model that emits more than this is padding, not suggesting. */
export const MAX_SUGGESTED_QUESTIONS = 8;

const DETAILS_BLOCK_PATTERN =
  /(?:<details\b[^>]*>|&lt;details\b[^&]{0,400}?&gt;)([\s\S]*?)(?:<\/details\s*>|&lt;\/details\s*&gt;)/gi;
const SUMMARY_PATTERN =
  /<summary\b[^>]*>([\s\S]*?)<\/summary\s*>|&lt;summary\b[^&]{0,400}?&gt;([\s\S]*?)&lt;\/summary\s*&gt;/i;
const HTML_TAG_PATTERN = /<\/?[a-z][^>]{0,300}>/gi;
const REMAINING_ESCAPED_TAG_PATTERN = /&lt;\/?(?:details|summary)\b[^&]{0,400}?&gt;/gi;
const FENCE_LINE_PATTERN = /^\s*([`~]{3,})/;
const FENCE_CLOSE_PATTERN = /^\s*([`~]{3,})\s*$/;
const LIST_ITEM_PATTERN = /^(?:[-*+•]|\d{1,2}[.)])\s+/;
const TRAILING_RULE_PATTERN = /(?:^|\n)\s*(?:[-*_]\s*){3,}$/;
const NON_QUESTION_PREFIX_PATTERN =
  /^(?:note|disclaimer|warning|source|sources|reference|references|see also)\s*:/i;
const HEADING_EMOJI = '[\\p{Extended_Pictographic}\\p{Emoji_Presentation}\\uFE0F\\u200D]';
const SECTION_HEADING_PATTERN = new RegExp(
  '^(?:#{1,6}\\s*)?(?:\\*\\*|__)?\\s*' +
    `${HEADING_EMOJI}*\\s*` +
    '(?:suggested\\s+(?:next\\s+|follow[\\s-]?up\\s+)?questions?' +
    '|follow[\\s-]?up\\s+questions?' +
    '|next\\s+questions?' +
    '|related\\s+questions?' +
    '|questions?\\s+to\\s+(?:ask|explore))' +
    '[\\s:：]*(?:\\*\\*|__)?\\s*$',
  'iu',
);

type Segment = { code: boolean; text: string };

function splitFencedCode(content: string): Segment[] {
  const segments: Segment[] = [];
  let prose: string[] = [];
  let fence: { char: string; len: number } | null = null;

  const flushProse = () => {
    if (prose.length > 0) {
      segments.push({ code: false, text: prose.join('\n') });
      prose = [];
    }
  };

  for (const line of content.split('\n')) {
    if (fence == null) {
      const open = line.match(FENCE_LINE_PATTERN);
      if (open) {
        flushProse();
        fence = { char: open[1][0], len: open[1].length };
        segments.push({ code: true, text: line });
        continue;
      }
      prose.push(line);
      continue;
    }

    segments.push({ code: true, text: line });
    const close = line.match(FENCE_CLOSE_PATTERN);
    if (close && close[1][0] === fence.char && close[1].length >= fence.len) {
      fence = null;
    }
  }

  flushProse();
  return segments;
}

function cleanInline(text: string): string {
  return text.replace(HTML_TAG_PATTERN, '').replace(/\s+/g, ' ').trim();
}

/** Renders one `<details>` body as a blockquote reveal. */
function renderDetails(inner: string): string {
  const summary = inner.match(SUMMARY_PATTERN);
  const title = cleanInline(summary ? (summary[1] ?? summary[2] ?? '') : '');
  const bodySource = summary ? inner.slice((summary.index ?? 0) + summary[0].length) : inner;
  const body = bodySource
    .replace(HTML_TAG_PATTERN, '')
    .replace(REMAINING_ESCAPED_TAG_PATTERN, '')
    .trim();

  const header = `> **${title || 'Details'}**`;
  if (!body) {
    return header;
  }

  const quoted = body
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');

  return `${header}\n>\n${quoted}`;
}

/**
 * Rewrites every raw or HTML-escaped `<details>` block as Markdown, leaving fenced code
 * blocks untouched. A block that is never closed keeps its text but loses the stray
 * `<details>`/`<summary>` tags, so a truncated answer still reads as prose instead of
 * showing raw markup.
 */
export function stripDetailsBlocks(content: string): string {
  if (!content || !/details/i.test(content)) {
    return content;
  }

  let changed = false;
  const segments = splitFencedCode(content).map((segment) => {
    if (segment.code) {
      return segment.text;
    }
    let next = segment.text.replace(DETAILS_BLOCK_PATTERN, (_match, inner: string) =>
      renderDetails(inner),
    );
    // Strip any remaining stray unclosed details/summary tags outside code fences
    next = next
      .replace(/<\/?(?:details|summary)\b[^>]*>/gi, '')
      .replace(/&lt;\/?(?:details|summary)\b[^&]{0,400}?&gt;/gi, '');
    if (next !== segment.text) {
      changed = true;
    }
    return next;
  });

  return changed ? segments.join('\n') : content;
}

function stripBoldWrapper(text: string): string {
  let result = text;
  while (
    result.length > 4 &&
    ((result.startsWith('**') && result.endsWith('**')) ||
      (result.startsWith('__') && result.endsWith('__')))
  ) {
    result = result.slice(2, -2).trim();
  }
  return result;
}

function cleanQuestion(raw: string): string {
  let text = raw.replace(LIST_ITEM_PATTERN, '').trim();
  text = stripBoldWrapper(text);
  if (text.length > 2 && text.startsWith('[') && text.endsWith(']')) {
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/^[\s"'“”‘’`]+/, '').replace(/[\s"'“”‘’`]+$/, '');
  return text.replace(/\s+/g, ' ').trim();
}

function isQuestion(text: string): boolean {
  return (
    text.length > 3 &&
    !/^#{1,6}\s/.test(text) &&
    !TRAILING_RULE_PATTERN.test(`\n${text}`) &&
    !NON_QUESTION_PREFIX_PATTERN.test(text)
  );
}

function findSectionHeading(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (SECTION_HEADING_PATTERN.test(lines[i].trim())) {
      return i;
    }
  }
  return -1;
}

/**
 * Splits a finished answer into rendered Markdown and clickable follow-up chips.
 * Chips are deduplicated, cleaned of list/bold/quote decoration and capped.
 */
export function parseSuggestedQuestions(content: string): ParsedSuggestedQuestions {
  if (!content) {
    return { mainContent: content, questions: [] };
  }

  const lines = content.split('\n');
  // Cheap guard: every heading variant contains "question", so a streaming
  // message is not rescanned line by line until that word arrives.
  const headingIndex = /question/i.test(content) ? findSectionHeading(lines) : -1;
  if (headingIndex === -1) {
    return { mainContent: stripDetailsBlocks(content), questions: [] };
  }

  const questions: string[] = [];
  const seen = new Set<string>();
  const trailing: string[] = [];
  let collecting = true;

  for (const line of lines.slice(headingIndex + 1)) {
    const trimmed = line.trim();
    if (collecting) {
      if (!trimmed) {
        continue;
      }
      if (!LIST_ITEM_PATTERN.test(trimmed)) {
        collecting = false;
        trailing.push(line);
        continue;
      }
      const cleaned = cleanQuestion(trimmed);
      const key = cleaned.toLowerCase();
      if (isQuestion(cleaned) && !seen.has(key) && questions.length < MAX_SUGGESTED_QUESTIONS) {
        seen.add(key);
        questions.push(cleaned);
      }
      continue;
    }
    trailing.push(line);
  }

  const body = lines.slice(0, headingIndex).join('\n').trim().replace(TRAILING_RULE_PATTERN, '');
  const trailingText = trailing.join('\n').trim();
  const main = trailingText ? `${body}\n\n${trailingText}` : body;

  return { mainContent: stripDetailsBlocks(main), questions };
}
