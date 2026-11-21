const fs = require('fs');

const startersContent = fs.readFileSync('client/src/common/starters.ts', 'utf8');
const startersTitles = Array.from(startersContent.matchAll(/title:\s*'([^']+)'/g)).map(m => m[1]);

const yamlContent = fs.readFileSync('librechat.yaml', 'utf8');
const lines = yamlContent.split('\n');
const yamlTitles = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('—')) {
    const raw = line.replace(/^\s*-\s*\|\-?\s*/, '').replace(/^\s*-\s*"*/, '').split('—')[0].trim().replace(/^"*/, '');
    if (raw.length > 2 && raw.length < 80 && !raw.startsWith('Inputs:') && !raw.startsWith('Before you start:')) {
      yamlTitles.push(raw);
    }
  }
}

const all = Array.from(new Set([...startersTitles, ...yamlTitles]));
console.log('Total unique personas across starters.ts & librechat.yaml:', all.length);

fs.writeFileSync('all_personas.json', JSON.stringify(all, null, 2), 'utf8');
console.log('Saved to all_personas.json');
