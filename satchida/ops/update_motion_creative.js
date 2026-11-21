const fs = require('fs');
let code = fs.readFileSync('client/src/common/starters.ts', 'utf8');

const target = [
  "    id: 'motion_creative',",
  "    label: '🎨 Art, Cartoon & Sketch',",
  "    labelKey: 'starters_cat_motion_creative',",
  "    group: 'business_creative',",
  "    modes: ['Motion', 'OpenFilm'],"
].join('\r\n');

const replacement = [
  "    id: 'motion_creative',",
  "    label: '🎨 Art, Cartoon & Sketch',",
  "    labelKey: 'starters_cat_motion_creative',",
  "    modes: ['Chat', 'Motion', 'OpenFilm', 'Work'],"
].join('\r\n');

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('client/src/common/starters.ts', code, 'utf8');
  console.log('Successfully updated motion_creative!');
} else {
  console.error('Target not found');
}
