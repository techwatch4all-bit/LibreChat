const fs = require('fs');
const filePath = 'client/src/common/starters.ts';
let content = fs.readFileSync(filePath, 'utf8');

const groups = [
  'arch_engineering', 'motion_drones', 'motion_civil_logistics',
  'motion_robotics', 'motion_how_it_works', 'motion_electronics',
  'motion_education', 'motion_networks', 'motion_earth_space', 'motion_history_kids',
  'motion_executive', 'motion_productivity', 'motion_kinetic', 'motion_product',
  'motion_creative', 'motion_media', 'motion_medical', 'motion_wellness',
  'motion_home', 'motion_elderly'
];

let replaced = 0;
for (const id of groups) {
  // Search for category block with this id
  const pattern = new RegExp("(id:\\s*'" + id + "'[\\s\\S]*?modes:\\s*\\[)[^\\]]+(\\])");
  if (pattern.test(content)) {
    content = content.replace(pattern, "$1'Motion', 'OpenFilm'$2");
    replaced++;
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated category modes to include OpenFilm:', replaced);
