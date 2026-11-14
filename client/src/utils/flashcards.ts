export type TFlashcard = {
  id: string;
  cardNum: string;
  front: string;
  back: string;
};

export type ParsedFlashcards = {
  content: string;
  flashcards: TFlashcard[];
};

function cleanCell(text: string): string {
  let cleaned = text.trim();
  while (
    cleaned.length > 4 &&
    ((cleaned.startsWith('**') && cleaned.endsWith('**')) ||
      (cleaned.startsWith('__') && cleaned.endsWith('__')))
  ) {
    cleaned = cleaned.slice(2, -2).trim();
  }
  return cleaned;
}

function isFlashcardHeading(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  return trimmed.includes('flashcard') && (trimmed.startsWith('#') || trimmed.startsWith('**'));
}

function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|') || !trimmed.includes('-')) {
    return false;
  }
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch !== '|' && ch !== '-' && ch !== ':' && ch !== ' ') {
      return false;
    }
  }
  return true;
}

/**
 * Parses markdown tables or card lists under a flashcard heading into structured flashcards
 * and removes the static representation from the rendered markdown.
 */
export function parseFlashcards(rawContent: string): ParsedFlashcards {
  if (!rawContent || !rawContent.toLowerCase().includes('flashcard')) {
    return { content: rawContent, flashcards: [] };
  }

  const lines = rawContent.split('\n');
  let headingIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (isFlashcardHeading(lines[i])) {
      headingIndex = i;
      break;
    }
  }

  if (headingIndex === -1) {
    return { content: rawContent, flashcards: [] };
  }

  let tableStart = -1;
  let tableEnd = -1;

  for (let i = headingIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (tableStart !== -1) {
        tableEnd = i;
        break;
      }
      continue;
    }

    if (line.includes('|')) {
      if (tableStart === -1) {
        tableStart = i;
      }
    } else {
      if (tableStart !== -1) {
        tableEnd = i;
        break;
      }
    }
  }

  if (tableStart !== -1) {
    if (tableEnd === -1) {
      tableEnd = lines.length;
    }

    const tableLines = lines.slice(tableStart, tableEnd).filter((l) => l.trim().length > 0);
    if (tableLines.length >= 2) {
      const cards: TFlashcard[] = [];
      let startRow = 1;
      if (tableLines.length >= 3 && isSeparatorLine(tableLines[1])) {
        startRow = 2;
      }

      for (let i = startRow; i < tableLines.length; i++) {
        const row = tableLines[i].trim();
        if (!row.includes('|')) continue;
        const cells = row
          .split('|')
          .map((c) => c.trim())
          .filter((c, idx, arr) => (idx !== 0 && idx !== arr.length - 1) || c.length > 0);

        if (cells.length >= 2) {
          let cardNum = `Card ${cards.length + 1}`;
          let front = '';
          let back = '';

          if (cells.length >= 3) {
            cardNum = cleanCell(cells[0]) || `Card ${cards.length + 1}`;
            front = cleanCell(cells[1]);
            back = cleanCell(cells[2]);
          } else {
            front = cleanCell(cells[0]);
            back = cleanCell(cells[1]);
          }

          if (front && back) {
            cards.push({
              id: `fc-${cards.length + 1}`,
              cardNum,
              front,
              back,
            });
          }
        }
      }

      if (cards.length > 0) {
        const before = lines.slice(0, headingIndex).join('\n').trimEnd();
        const after = lines.slice(tableEnd).join('\n').trimStart();
        const remaining = before && after ? `${before}\n\n${after}` : before || after;
        return { content: remaining, flashcards: cards };
      }
    }
  }

  return { content: rawContent, flashcards: [] };
}
