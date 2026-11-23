const fs = require('fs');
const lucide = require('lucide-react');
const { studioIcons, chatIcons, landingIcons } = require('./assign_unique_icons.js');

const masterMap = {};

function add(clean, original, entry) {
  if (!clean || !entry) return;
  masterMap[clean] = entry;
  if (original && original !== clean) {
    masterMap[original] = entry;
  }
}

// 1. Studio
const studio = JSON.parse(fs.readFileSync('scripts/studio_personas.json', 'utf8'));
studio.forEach(p => {
  const clean = p.raw.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\uFE0E\s]+/u, '').trim();
  const entry = studioIcons[clean] || studioIcons[p.clean];
  if (entry) add(clean, p.raw, entry);
});

// 2. Chat
const chat = JSON.parse(fs.readFileSync('scripts/chat_personas.json', 'utf8'));
chat.forEach(p => {
  const clean = p.title.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\uFE0E\s]+/u, '').trim();
  const entry = chatIcons[clean] || chatIcons[p.title];
  if (entry) add(clean, p.title, entry);
});

// 3. Landing
const landing = JSON.parse(fs.readFileSync('scripts/landing_personas.json', 'utf8'));
landing.forEach(p => {
  const clean = p.raw.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\uFE0F\uFE0E\s]+/u, '').trim();
  const entry = landingIcons[clean] || landingIcons[p.clean];
  if (entry) add(clean, p.raw, entry);
});

// Verify all icons exist in lucide-react
const allIconsUsed = new Set();
for (const [title, entry] of Object.entries(masterMap)) {
  if (!lucide[entry.icon]) {
    console.error(`ERROR: Icon "${entry.icon}" for "${title}" is not in lucide-react!`);
  }
  allIconsUsed.add(entry.icon);
}
allIconsUsed.add('Sparkles');

console.log('Total entries in masterMap:', Object.keys(masterMap).length);
console.log('Total distinct Lucide icons used:', allIconsUsed.size);

const sortedIcons = [...allIconsUsed].sort();

const fileContent = `import type { ComponentType } from 'react';
import {
  ${sortedIcons.join(',\n  ')}
} from 'lucide-react';

export interface PersonaVisual {
  Icon: ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

const ICON_COMPONENTS: Record<string, ComponentType<{ className?: string }>> = {
  ${sortedIcons.join(',\n  ')}
};

export const PERSONA_VISUAL_MAP: Record<string, { icon: string; color: string; bg: string }> = ${JSON.stringify(masterMap, null, 2)};

const normalize = (t: string): string =>
  t.replace(/^[\\u{1F000}-\\u{1FFFF}\\u{2600}-\\u{27BF}\\uFE0F\\uFE0E\\s]+/u, '').trim();

export const resolvePersonaVisual = (title: string, badge?: string): PersonaVisual => {
  const norm = normalize(title);
  const entry = PERSONA_VISUAL_MAP[title] ?? PERSONA_VISUAL_MAP[norm];
  if (entry) {
    const Icon = ICON_COMPONENTS[entry.icon] ?? Sparkles;
    return { Icon, color: entry.color, bg: entry.bg };
  }

  // Fallback by badge if unmapped
  if (badge) {
    const bEntry = PERSONA_VISUAL_MAP[badge] ?? PERSONA_VISUAL_MAP[normalize(badge)];
    if (bEntry) {
      const Icon = ICON_COMPONENTS[bEntry.icon] ?? Sparkles;
      return { Icon, color: bEntry.color, bg: bEntry.bg };
    }
  }

  return { Icon: Sparkles, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' };
};
`;

fs.writeFileSync('client/src/common/personaVisuals.ts', fileContent);
console.log('Generated clean client/src/common/personaVisuals.ts successfully!');
