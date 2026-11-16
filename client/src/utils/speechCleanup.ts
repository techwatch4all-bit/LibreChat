import type { TMessage } from 'librechat-data-provider';

/**
 * Creates a spoken conversational summary suitable for TTS narration,
 * eliminating all non-verbal clutter, metadata, tool logs, checklist symbols,
 * file references, and artifact boilerplate.
 */
export const cleanSpeechText = (raw: string): string => {
  if (!raw) return '';

  let text = raw;

  // 1. Strip think blocks and reasoning
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  text = text.replace(/<details>[\s\S]*?<\/details>/gi, '');

  // 2. Strip artifacts & directives (:::artifact, :::cards, :::quiz, etc.)
  text = text.replace(/:::artifact[\s\S]*?:::/gi, '');
  text = text.replace(/:::[a-zA-Z0-9_-]+[\s\S]*?:::/gi, '');
  text = text.replace(/:::[a-zA-Z0-9_-]+/gi, '');

  // 3. Strip code blocks completely
  text = text.replace(/```[\s\S]*?```/g, '');

  // 4. Strip markdown image tags ![caption](url)
  text = text.replace(/!\[[^\]]*\]\([^\)]+\)/g, '');

  // 5. Strip links [text](url) -> keep text only
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // 6. Strip file paths / extensions commonly in chat (e.g. filename.pdf, filename.pptx)
  text = text.replace(/\b[A-Za-z0-9_-]+\.(pdf|pptx|ppt|docx|doc|png|jpg|gif|svg|zip|json|csv)\b/gi, '');

  // 7. Strip action/tool run notes (e.g. "Ran 3 actions", "I'll grab some verified visual assets...", "Vault saved...")
  text = text.replace(/^(Ran \d+ actions|Ran \w+ action|Running \w+).*$/gmi, '');
  text = text.replace(/^I'll (grab|fetch|collect|generate|pull) some (verified )?visual assets.*$/gmi, '');
  text = text.replace(/^Note: The document was saved to disk.*$/gmi, '');
  text = text.replace(/^PDF Report: Already generated.*$/gmi, '');

  // 8. Strip checklist markers & symbols: [ ], [x], -, *, •, emojis
  text = text.replace(/\[[ xX\u2713\u2714]\]/g, '');
  text = text.replace(/[\u2705\u2714\u2713\u274C\u26A0\uFE0F\uD83C-\uDBFF\uDC00-\uDFFF]/g, '');

  // 9. Strip markdown headings (#, ##, ###)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 10. Strip HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // 11. Strip inline code markers
  text = text.replace(/`([^`]+)`/g, '$1');

  // 12. Strip LaTeX math formulas ($$...$$ and $...$)
  text = text.replace(/\$\$[\s\S]*?\$\$/g, '');
  text = text.replace(/\$[^$]+\$/g, '');

  // 13. Strip standalone bullet punctuation and formatting characters
  text = text.replace(/^[\s\t*•\->]+\s*/gm, '');
  text = text.replace(/[*_~]{1,3}/g, '');

  // 14. Convert common abbreviations so speech engines pronounce them naturally
  text = text.replace(/\bFM\b/g, 'Frequency Modulation');
  text = text.replace(/\bPM\b/g, 'Phase Modulation');
  text = text.replace(/\bvs\.?\b/gi, 'versus');
  text = text.replace(/\be\.g\.?\b/gi, 'for example');
  text = text.replace(/\bi\.e\.?\b/gi, 'that is');

  // 15. Clean up suggested follow-up / quiz sections if at the bottom so it focuses on the explanation
  const followUpIndex = text.search(/Suggested Follow-up|Practice Questions|Quiz Me/i);
  if (followUpIndex > 200) {
    text = text.substring(0, followUpIndex);
  }

  // 16. Normalize punctuation and whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{2,}/g, '\n\n').trim();

  return text;
};

export const extractMessageContent = (message: TMessage): string => {
  let rawText = '';
  if (typeof message.content === 'string') {
    rawText = message.content;
  } else if (Array.isArray(message.content)) {
    rawText = message.content
      .map((part) => {
        if (part == null) {
          return '';
        }
        if (typeof part === 'string') {
          return part;
        }
        if ('text' in part) {
          return part.text || '';
        }
        return '';
      })
      .join('');
  } else {
    rawText = message.text || '';
  }

  return cleanSpeechText(rawText);
};
