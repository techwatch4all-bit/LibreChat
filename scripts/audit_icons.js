const fs = require('fs');

// Read personaVisuals.ts
const code = fs.readFileSync('client/src/common/personaVisuals.ts', 'utf8');

// Extract the PERSONA_VISUAL_MAP object
const assignIdx = code.indexOf('PERSONA_VISUAL_MAP:');
const pStart = code.indexOf('{', code.indexOf('=', assignIdx));
const pEnd = code.lastIndexOf('};', code.indexOf('const normalize ='));
const mapStr = code.slice(pStart, pEnd + 1);

const map = JSON.parse(mapStr);
const starters = require('./audit_all_personas.json');

const normalize = (t) => t.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\uFE0E\s]+/u, '').trim();

// Group by icon to see which icons are repeated across multiple personas
const iconToPersonas = {};
let unmapped = [];

starters.forEach(s => {
  const clean = normalize(s.title);
  const entry = map[s.title] ?? map[clean] ?? (s.badge ? (map[s.badge] ?? map[normalize(s.badge)]) : null);
  if (!entry) {
    unmapped.push(s.title);
  } else {
    if (!iconToPersonas[entry.icon]) iconToPersonas[entry.icon] = [];
    iconToPersonas[entry.icon].push({ title: clean, original: s.title, badge: s.badge });
  }
});

console.log('--- AUDIT REPORT ---');
console.log('Total Personas Audited:', starters.length);
console.log('Unmapped Personas (falling back to Sparkles):', unmapped.length);
if (unmapped.length > 0) {
  console.log('Unmapped list:', unmapped);
}

console.log('\nTotal Distinct Icons Used:', Object.keys(iconToPersonas).length);

// Find duplicates (icons assigned to > 1 persona)
const duplicates = Object.entries(iconToPersonas)
  .filter(([icon, list]) => list.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

console.log(`Icons shared by > 1 persona: ${duplicates.length}`);
duplicates.forEach(([icon, list]) => {
  console.log(`\nIcon "${icon}" is shared by ${list.length} personas:`);
  list.forEach(p => console.log(`   - [${p.badge || ''}] ${p.title}`));
});

fs.writeFileSync('scripts/audit_duplicates.json', JSON.stringify(duplicates, null, 2));
