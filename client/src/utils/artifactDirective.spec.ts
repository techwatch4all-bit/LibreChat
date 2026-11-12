import { normalizeArtifactDirectives } from './artifactDirective';

const SAMPLE_HTML = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '  <meta charset="UTF-8">',
  '  <title>1,400 sq ft 3BHK Floor Plan</title>',
  '  <style>body { margin: 0; background: #07111f; }</style>',
  '</head>',
  '<body>',
  '  <div id="stage">Plan</div>',
  '  <script>console.log("ready");</script>',
  '</body>',
  '</html>',
].join('\n');

describe('normalizeArtifactDirectives', () => {
  test('returns plain markdown unchanged without allocation', () => {
    const plain = 'Hello world\n\n```js\nconsole.log(1);\n```';
    expect(normalizeArtifactDirectives(plain)).toBe(plain);
  });

  test('preserves already valid :::artifact directives untouched', () => {
    const valid = [
      'Here is your simulation:',
      '',
      ':::artifact{identifier="floor-plan" type="text/html" title="Floor Plan"}',
      '````html',
      SAMPLE_HTML,
      '````',
      ':::',
    ].join('\n');
    expect(normalizeArtifactDirectives(valid)).toBe(valid);
  });

  test('fixes custom directive names carrying type="text/html"', () => {
    const malformed = [
      ':::apartment-blueprint-3d-morph type="text/html"',
      '````html',
      SAMPLE_HTML,
      '````',
      ':::',
    ].join('\n');

    const normalized = normalizeArtifactDirectives(malformed);
    expect(normalized).toContain(
      ':::artifact{identifier="apartment-blueprint-3d-morph" type="text/html" title="Apartment Blueprint 3d Morph"}',
    );
    expect(normalized).not.toContain(':::apartment-blueprint-3d-morph');
  });

  test('fixes custom brace directive names without "artifact"', () => {
    const malformed = [
      ':::floorplan{identifier="my-plan" type="text/html" title="My 3D Plan"}',
      '````html',
      SAMPLE_HTML,
      '````',
      ':::',
    ].join('\n');

    const normalized = normalizeArtifactDirectives(malformed);
    expect(normalized).toContain(
      ':::artifact{identifier="my-plan" type="text/html" title="My 3D Plan"}',
    );
  });

  test('leaves unrelated non-artifact directives alone', () => {
    const admonition = ':::note\nThis is a markdown note.\n:::';
    expect(normalizeArtifactDirectives(admonition)).toBe(admonition);
  });

  test('promotes a closed standalone <!DOCTYPE html> fenced block into :::artifact', () => {
    const raw = `Here is the blueprint:\n\n\`\`\`html\n${SAMPLE_HTML}\n\`\`\`\n\nEnjoy!`;
    const normalized = normalizeArtifactDirectives(raw);
    expect(normalized).toContain(
      ':::artifact{identifier="1-400-sq-ft-3bhk-floor-plan" type="text/html" title="1,400 sq ft 3BHK Floor Plan"}',
    );
    expect(normalized).toContain('````html\n');
    expect(normalized).toContain('\n````\n:::');
    expect(normalized).toContain('Enjoy!');
  });

  test('promotes untagged ``` fences containing a standalone HTML document', () => {
    const raw = `Here is the blueprint:\n\n\`\`\`\n${SAMPLE_HTML}\n\`\`\``;
    const normalized = normalizeArtifactDirectives(raw);
    expect(normalized).toContain(
      ':::artifact{identifier="1-400-sq-ft-3bhk-floor-plan" type="text/html" title="1,400 sq ft 3BHK Floor Plan"}',
    );
    expect(normalized).toContain('````html\n');
    expect(normalized).toContain('\n````\n:::');
  });

  test('wraps unfenced standalone HTML inside malformed or canonical HTML artifacts', () => {
    const unfenced = [':::apartment-blueprint-3d-morph type="text/html"', SAMPLE_HTML, ':::'].join(
      '\n',
    );
    const normalized = normalizeArtifactDirectives(unfenced);
    expect(normalized).toContain(
      ':::artifact{identifier="apartment-blueprint-3d-morph" type="text/html" title="Apartment Blueprint 3d Morph"}\n````html\n<!DOCTYPE html>',
    );
    expect(normalized).toContain('</html>\n````\n:::');
  });

  test('does not wrap an unclosed streaming html code fence prematurely', () => {
    const streaming =
      'Building...\n\n```html\n<!DOCTYPE html>\n<html>\n<head><title>Partial</title>';
    expect(normalizeArtifactDirectives(streaming)).toBe(streaming);
  });

  test('does not promote tiny non-standalone html snippets', () => {
    const snippet = '```html\n<div class="card">\n  <p>Hello</p>\n</div>\n```';
    expect(normalizeArtifactDirectives(snippet)).toBe(snippet);
  });

  test('deduplicates identifiers when multiple standalone html blocks appear', () => {
    const two = `\`\`\`html\n${SAMPLE_HTML}\n\`\`\`\n\n\`\`\`html\n${SAMPLE_HTML}\n\`\`\``;
    const normalized = normalizeArtifactDirectives(two);
    expect(normalized).toContain('identifier="1-400-sq-ft-3bhk-floor-plan"');
    expect(normalized).toContain('identifier="1-400-sq-ft-3bhk-floor-plan-2"');
  });
});
