/**
 * Derives the text a conversation title is generated from.
 *
 * The agents chat body carries the turn as `messages` (the legacy `text` field
 * is absent), while addTitle historically reads only `text` — an empty title
 * source made the title model invent titles from its own context. Resolves the
 * LAST user message's text content when `text` is missing or blank.
 */
export function deriveTitleSourceText(
  text: unknown,
  messages: unknown,
): string {
  if (typeof text === 'string' && text.trim().length > 0) {
    return text;
  }
  if (!Array.isArray(messages)) {
    return '';
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as
      | { role?: string; content?: string | Array<{ type?: string; text?: string }> }
      | undefined;
    if (message == null || (message.role ?? 'user') !== 'user') {
      continue;
    }
    if (typeof message.content === 'string' && message.content.trim().length > 0) {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      const joined = message.content
        .filter((part) => part?.type === 'text' && typeof part.text === 'string' && part.text.trim())
        .map((part) => part.text)
        .join(' ')
        .trim();
      if (joined.length > 0) {
        return joined;
      }
    }
  }
  return '';
}
