const fs = require('fs');
let code = fs.readFileSync('client/src/common/starters.ts', 'utf8');

// Normalize line endings for replacement
const target = [
  "    id: 'motion_creative',",
  "    label: '🎨 Art, Cartoon & Sketch',",
  "    labelKey: 'starters_cat_motion_creative',",
  "    group: 'business_creative',",
  "    modes: ['Motion'],",
  "    starters: ["
].join('\r\n');

const replacement = [
  "    id: 'motion_creative',",
  "    label: '🎨 Art, Cartoon & Sketch',",
  "    labelKey: 'starters_cat_motion_creative',",
  "    group: 'business_creative',",
  "    modes: ['Motion', 'OpenFilm', 'Chat'],",
  "    starters: [",
  "      starter({",
  "        title: 'Procedural Watercolor & Wash Art',",
  "        icon: '🎨',",
  "        description:",
  "          'Deterministic 1080p NumPy/Pillow code painting with procedural pigments, paper grain, and wet-on-wet glazes',",
  "        inputs: [",
  "          'Subject: e.g. misty pine mountain with rustic temple, or autumn lake with red canoe',",
  "          'Color Palette: e.g. indigo, ochre, burnt umber',",
  "          'Seed: e.g. 42',",
  "        ],",
  "        deliver:",
  "          'Compose and render a deterministic 1920x1080 watercolor painting using the generate_procedural_art tool with custom procedural washes, atmospheric glazing, and paper grain for [Subject: e.g. misty pine mountain with rustic temple, or autumn lake with red canoe] with palette [Color Palette: e.g. indigo, ochre, burnt umber] and seed [Seed: e.g. 42]. Save to Studio Library and embed inline.',",
  "        contract: 'generate directly with generate_procedural_art tool and embed the returned image link inline.',",
  "        badge: 'Procedural Art',",
  "        badgeKey: 'starters_badge_motion_generative',",
  "        engineTag: 'NumPy · 1080p Painting',",
  "        keywords: ['watercolor', 'procedural', 'art', 'painting', 'numpy', 'pillow', 'code art', 'landscape'],",
  "        mcpServers: ['satchida-tools', 'satchida-motion'],",
  "      }),",
  "      starter({",
  "        title: '3B1B Math & Geometric Animation',",
  "        icon: '⚡',",
  "        description:",
  "          'Euler/Fourier/Calculus educational animation with synchronized voiceover beats, geometry morphs, and MP4 export',",
  "        inputs: [",
  "          'Math Concept: e.g. Fourier Transform, Riemann Zeta Function, or Pythagorean Spiral',",
  "          'Visual Focus: e.g. rotating epicycles, vector fields, or geometric proofs',",
  "        ],",
  "        deliver:",
  "          'Compile an animated mathematical explainer using create_kinetic_motion_clip (grammar: \"3b1b\") featuring animated vector construction, dynamic formulas, formula labels, and sound cues for [Math Concept: e.g. Fourier Transform, Riemann Zeta Function, or Pythagorean Spiral] highlighting [Visual Focus: e.g. rotating epicycles, vector fields, or geometric proofs].',",
  "        contract: MOTION_CONTRACT,",
  "        badge: '3B1B Vector',",
  "        badgeKey: 'starters_badge_motion_math',",
  "        engineTag: 'Vector · 60fps MP4',",
  "        keywords: ['3b1b', 'math', 'geometry', 'fourier', 'animation', 'calculus', 'education'],",
  "        mcpServers: ['satchida-tools', 'satchida-motion'],",
  "      }),",
  "      starter({",
  "        title: 'Traditional Ink Wash & Chinese Painting',",
  "        icon: '🖋️',",
  "        description:",
  "          'Procedural Guohua ink wash with dry-brush boneless strokes, seal stamps, and rice paper fiber textures',",
  "        inputs: [",
  "          'Landscape Scene: e.g. solitary crane in bamboo grove, or karst mountains in mist',",
  "          'Calligraphy Seal Text: e.g. Harmony & Peace',",
  "        ],",
  "        deliver:",
  "          'Render a high-resolution procedural Chinese ink wash painting using generate_procedural_art (style: \"inkpaint\") with procedural ink diffusion, splatters, and red artist seal for [Landscape Scene: e.g. solitary crane in bamboo grove, or karst mountains in mist] bearing seal text [Calligraphy Seal Text: e.g. Harmony & Peace].',",
  "        contract: 'render with generate_procedural_art tool and embed the returned image link inline.',",
  "        badge: 'Ink Wash',",
  "        badgeKey: 'starters_badge_motion_sketch',",
  "        engineTag: 'Procedural Ink · Calligraphy',",
  "        keywords: ['ink', 'inkpaint', 'guohua', 'calligraphy', 'procedural', 'art', 'bamboo'],",
  "        mcpServers: ['satchida-tools', 'satchida-motion'],",
  "      }),"
].join('\r\n');

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('client/src/common/starters.ts', code, 'utf8');
  console.log('Successfully updated starters.ts with CRLF!');
} else {
  console.error('Target still not matched.');
}
