const fs = require('fs');
let code = fs.readFileSync('client/src/common/personaVisuals.ts', 'utf8');

const tail = [
  '  }',
  '',
  '  // Fallback by badge if unmapped',
  '  if (badge) {',
  '    const bEntry = PERSONA_VISUAL_MAP[badge] ?? PERSONA_VISUAL_MAP[normalize(badge)];',
  '    if (bEntry) {',
  '      const Icon = ICON_COMPONENTS[bEntry.icon] ?? Sparkles;',
  '      return { Icon, color: bEntry.color, bg: bEntry.bg };',
  '    }',
  '  }',
  '',
  '  return { Icon: Sparkles, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" };',
  '};',
  ''
].join('\n');

code = code.trim() + '\n' + tail;
fs.writeFileSync('client/src/common/personaVisuals.ts', code);
console.log('Appended clean tail to resolvePersonaVisual successfully!');
