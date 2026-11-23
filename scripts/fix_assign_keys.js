const fs = require('fs');
let code = fs.readFileSync('scripts/assign_unique_icons.js', 'utf8');

const replacements = [
  ["'D-to-3D Architectural Floor Plan'", "'2D-to-3D Architectural Floor Plan'"],
  ["'-DOF Robotic Arm IK & Torque Lab'", "'6-DOF Robotic Arm IK & Torque Lab'"],
  ["'D Executive QBR & Revenue Deck'", "'3D Executive QBR & Revenue Deck'"],
  ["'D Mobile App UX Showcase'", "'3D Mobile App UX Showcase'"],
  ["'B1B Math & Geometric Animation'", "'3B1B Math & Geometric Animation'"],
  ["'D Rigged Character Walk-Cycle'", "'2D Rigged Character Walk-Cycle'"]
];

replacements.forEach(([target, rep]) => {
  code = code.replace(target, rep);
});

fs.writeFileSync('scripts/assign_unique_icons.js', code);
console.log('Fixed studioIcons keys in assign_unique_icons.js successfully!');
