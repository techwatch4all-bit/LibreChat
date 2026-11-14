import { parseSuggestedQuestions, stripDetailsBlocks } from './suggestedQuestions';

const QUESTIONS_HEADING = '### 💡 Suggested Follow-up Questions';

describe('stripDetailsBlocks', () => {
  test('leaves content untouched when no details markup is present', () => {
    const plain = 'Just an answer.\n\n```js\nconst x = 1;\n```';
    expect(stripDetailsBlocks(plain)).toBe(plain);
  });

  test('converts a raw details/summary reveal into a blockquote', () => {
    const input = [
      'Pick the right option.',
      '',
      '<details>',
      '<summary>Reveal Answer & Derivation</summary>',
      '',
      '**B** is correct because the limit is continuous.',
      '',
      '1. Substitute the value.',
      '2. Cancel the factor.',
      '',
      '</details>',
      '',
      'Follow-up challenge: what happens at x = 0?',
    ].join('\n');

    const output = stripDetailsBlocks(input);

    expect(output).not.toContain('<details');
    expect(output).not.toContain('<summary');
    expect(output).toContain('> **Reveal Answer & Derivation**');
    expect(output).toContain('> **B** is correct because the limit is continuous.');
    expect(output).toContain('> 1. Substitute the value.');
    expect(output).toContain('Follow-up challenge: what happens at x = 0?');
  });

  test('converts escaped details markup emitted as &lt;details&gt;', () => {
    const input = [
      '&lt;details&gt;',
      '&lt;summary&gt;Reveal Answer&lt;/summary&gt;',
      'The answer is **C**.',
      '&lt;/details&gt;',
    ].join('\n');

    const output = stripDetailsBlocks(input);

    expect(output).not.toContain('&lt;details');
    expect(output).not.toContain('&lt;summary');
    expect(output).toContain('> **Reveal Answer**');
    expect(output).toContain('> The answer is **C**.');
  });

  test('accepts attributes on details and summary', () => {
    const input =
      '<details open class="x">\n<summary class="y">Show work</summary>\nBody line.\n</details>';
    const output = stripDetailsBlocks(input);

    expect(output).toContain('> **Show work**');
    expect(output).toContain('> Body line.');
  });

  test('strips inline html from the summary title', () => {
    const input = '<details>\n<summary><strong>Reveal</strong> Answer</summary>\nBody.\n</details>';
    expect(stripDetailsBlocks(input)).toContain('> **Reveal Answer**');
  });

  test('converts every details block in a document', () => {
    const input = [
      '<details><summary>One</summary>A</details>',
      'between',
      '<details><summary>Two</summary>B</details>',
    ].join('\n');

    const output = stripDetailsBlocks(input);

    expect(output).toContain('> **One**');
    expect(output).toContain('> **Two**');
    expect(output).toContain('between');
    expect(output).not.toContain('<details');
  });

  test('never rewrites details markup inside a fenced code block', () => {
    const input = [
      'Here is the html you asked for:',
      '',
      '```html',
      '<details><summary>Reveal</summary>Answer</details>',
      '```',
      '',
      'And outside:',
      '<details><summary>Real</summary>Body</details>',
    ].join('\n');

    const output = stripDetailsBlocks(input);
    const fenced = output.slice(output.indexOf('```html'), output.indexOf('```\n\nAnd outside'));

    expect(fenced).toContain('<details><summary>Reveal</summary>Answer</details>');
    expect(output).toContain('> **Real**');
  });

  test('leaves an unclosed details block alone rather than swallowing the answer', () => {
    const input = 'Intro\n\n<details>\n<summary>Half</summary>\nno close tag';
    expect(stripDetailsBlocks(input)).toBe(input);
  });

  test('is idempotent', () => {
    const once = stripDetailsBlocks('<details><summary>X</summary>Y</details>');
    expect(stripDetailsBlocks(once)).toBe(once);
  });
});

describe('parseSuggestedQuestions', () => {
  test('returns the content untouched when there is no follow-up section', () => {
    const content = 'A complete answer with no follow-ups.';
    expect(parseSuggestedQuestions(content)).toEqual({
      mainContent: content,
      questions: [],
    });
  });

  test('parses a bulleted section into chips and removes the heading', () => {
    const content = [
      'Photosynthesis converts light into chemical energy.',
      '',
      QUESTIONS_HEADING,
      '- 🎯 Quiz Me: Test me with three questions on light reactions.',
      '- 🔍 Deep Dive: Explain the Calvin cycle step by step.',
      '- 📖 Study Book: Build a study chapter on chloroplast structure.',
    ].join('\n');

    const { mainContent, questions } = parseSuggestedQuestions(content);

    expect(questions).toEqual([
      '🎯 Quiz Me: Test me with three questions on light reactions.',
      '🔍 Deep Dive: Explain the Calvin cycle step by step.',
      '📖 Study Book: Build a study chapter on chloroplast structure.',
    ]);
    expect(mainContent).toBe('Photosynthesis converts light into chemical energy.');
  });

  test('parses a numbered section', () => {
    const content = [
      'Answer body.',
      '',
      '### 🔄 Suggested Next Questions',
      '1. What is the failure mode?',
      '2. How does it compare with the alternative?',
    ].join('\n');

    expect(parseSuggestedQuestions(content).questions).toEqual([
      'What is the failure mode?',
      'How does it compare with the alternative?',
    ]);
  });

  test('keeps a trailing disclaimer out of the chips and inside the answer', () => {
    const content = [
      'Answer body.',
      '',
      QUESTIONS_HEADING,
      '- How is this used in practice?',
      '- What are the limits?',
      '',
      '> **Disclaimer:** Educational information only. Consult a specialist.',
    ].join('\n');

    const { mainContent, questions } = parseSuggestedQuestions(content);

    expect(questions).toEqual(['How is this used in practice?', 'What are the limits?']);
    expect(mainContent).toContain('Answer body.');
    expect(mainContent).toContain('> **Disclaimer:** Educational information only.');
  });

  test('drops note, disclaimer and warning lines from the chips', () => {
    const content = [
      'Body.',
      '',
      '**Suggested Questions:**',
      '- Real question one?',
      '- Note: this is not a question',
      '- Warning: verify before acting',
      '- Real question two?',
    ].join('\n');

    expect(parseSuggestedQuestions(content).questions).toEqual([
      'Real question one?',
      'Real question two?',
    ]);
  });

  test('cleans decoration around each question', () => {
    const content = [
      'Body.',
      '',
      '### Suggested Questions',
      '- **"How do I size the breaker?"**',
      '- [What gauge wire should I use?]',
      '- `Why does the neutral carry current?`',
    ].join('\n');

    expect(parseSuggestedQuestions(content).questions).toEqual([
      'How do I size the breaker?',
      'What gauge wire should I use?',
      'Why does the neutral carry current?',
    ]);
  });

  test('removes a horizontal rule left above the heading', () => {
    const content = ['Body.', '', '---', QUESTIONS_HEADING, '- One?', '- Two?'].join('\n');
    expect(parseSuggestedQuestions(content).mainContent).toBe('Body.');
  });

  test('deduplicates questions that differ only by case', () => {
    const content = [
      'Body.',
      '',
      QUESTIONS_HEADING,
      '- What is the cost?',
      '- what is the cost?',
      '- How long does it take?',
    ].join('\n');

    expect(parseSuggestedQuestions(content).questions).toEqual([
      'What is the cost?',
      'How long does it take?',
    ]);
  });

  test('caps the chip list so a runaway model cannot flood the answer', () => {
    const bullets = Array.from({ length: 20 }, (_, i) => `- Question number ${i + 1}?`);
    const content = ['Body.', '', QUESTIONS_HEADING, ...bullets].join('\n');

    expect(parseSuggestedQuestions(content).questions).toHaveLength(8);
  });

  test('ignores a passing mention of suggested questions inside prose', () => {
    const content = [
      'Students often ask for suggested questions after a lesson, which is a good habit.',
      '- but this list is prose, not a section',
    ].join('\n');

    expect(parseSuggestedQuestions(content).questions).toEqual([]);
  });

  test('normalizes a details reveal in the answer body', () => {
    const content = [
      '<details>',
      '<summary>Reveal Answer</summary>',
      'It is **A**.',
      '</details>',
      '',
      QUESTIONS_HEADING,
      '- Why is A correct?',
    ].join('\n');

    const { mainContent, questions } = parseSuggestedQuestions(content);

    expect(mainContent).toContain('> **Reveal Answer**');
    expect(mainContent).not.toContain('<details');
    expect(questions).toEqual(['Why is A correct?']);
  });

  test('handles an empty body after the heading', () => {
    expect(parseSuggestedQuestions(`Body.\n\n${QUESTIONS_HEADING}`)).toEqual({
      mainContent: 'Body.',
      questions: [],
    });
  });

  test('accepts a heading without a hash marker when it stands alone', () => {
    const content = ['Body.', '', 'Suggested Follow-up Questions:', '- One?', '- Two?'].join('\n');
    expect(parseSuggestedQuestions(content).questions).toEqual(['One?', 'Two?']);
  });
});
