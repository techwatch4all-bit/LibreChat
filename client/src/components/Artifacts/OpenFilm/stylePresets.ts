/**
 * Satchida Studio - one-click style presets.
 *
 * Registries for the two in-repo art skills:
 * - skill/satchida-procedural-art: 82 fine-art styles (procedural Python
 *   painting). Each preset carries a vendored 640px benchmark preview served
 *   from /assets/art-presets/<id>.jpg plus a palette for the motion dressing.
 * - skill/satchida-motion-art: the 36 implemented kinetic style recipes plus
 *   the 9 explainer-animation grammars.
 *
 * Clicking a preset injects a deterministic, self-contained film HTML into the
 * editor (window.film contract), so Play / Pause / Scrubber / Mute / MP4 export
 * work immediately inside the Studio panel. Fine-art presets additionally
 * document the matching `generate_procedural_art` MCP call for full-fidelity
 * procedural regeneration in chat.
 */

export interface ArtStylePreset {
  id: string;
  label: string;
  look: string;
  palette: string[];
  preview?: string;
}

export interface MotionPreset {
  id: string;
  label: string;
  look: string;
  palette: string[];
  grammar?: string;
}

const p = (...colors: string[]) => colors;

/* ----------------------------- Art styles (82) ---------------------------- */

export const ART_STYLE_PRESETS: ArtStylePreset[] = [
  { id: 'inkpaint', label: 'Ink Wash', look: 'Chinese ink-wash mountains, mist, seal', palette: p('#1c1c1e', '#8a8f98', '#b03a2e', '#f5f2ea') },
  { id: 'watercolor', label: 'Watercolour', look: 'Transparent washes on cold-press paper', palette: p('#4a7ba6', '#8fb8d4', '#c96f4a', '#fbf8f1') },
  { id: 'papercut', label: 'Paper-Cut Collage', look: 'Torn paper layers, crayon texture, shadows', palette: p('#e4572e', '#f3a712', '#2e86ab', '#fdf6e3') },
  { id: 'colorpencil', label: 'Colored Pencil', look: 'Soft Korean-style pencil layers', palette: p('#f4a6b8', '#a6d8f4', '#f9e27d', '#fff8f2') },
  { id: 'anime', label: 'Anime Background', look: 'Cel-shaded sky, towering cumulus, sun flare', palette: p('#1a4fb8', '#4c9be6', '#d3efff', '#86cf5e') },
  { id: 'editorial', label: 'Riso Editorial', look: 'Spot inks, halftone, misregistration', palette: p('#ff4b3e', '#0061ff', '#ffd23f', '#f6f2ea') },
  { id: 'oilpaint', label: 'Impasto Oil', look: 'Directional strokes, lit paint relief', palette: p('#2b4570', '#a8763e', '#d9b382', '#1c1c1e') },
  { id: 'ukiyoe', label: 'Ukiyo-e', look: 'Woodblock print, bokashi, keyblock lines', palette: p('#26495c', '#7ea8be', '#c96f4a', '#f2e8d5') },
  { id: 'pixelart', label: 'Pixel Art', look: 'Low-res + Bayer dither, crisp upscale', palette: p('#0f380f', '#306230', '#8bac0f', '#9bbc0f') },
  { id: 'clay', label: 'Claymation', look: 'Plasticine relief under studio light', palette: p('#e2945c', '#8fc1bb', '#c96f8e', '#f4ead5') },
  { id: 'cyanotype', label: 'Cyanotype', look: 'Prussian-blue sun print photogram', palette: p('#0b3d91', '#2e5ea8', '#8fb6d9', '#f5f9ff') },
  { id: 'stitch', label: 'Cross-Stitch', look: 'Embroidery on Aida cloth, satin, knots', palette: p('#b23a48', '#3f7a5a', '#d9a441', '#eae0cf') },
  { id: 'panel', label: 'Instrument Panel', look: 'Vintage radio front: walnut, knobs, lamps', palette: p('#5a3e2b', '#c8a97e', '#b03a2e', '#efe6d2') },
  { id: 'sticker', label: 'Sticker Collage', look: 'Die-cut vinyl, washi tape, receipt', palette: p('#ff6b6b', '#4ecdc4', '#ffd93d', '#f7f3ea') },
  { id: 'notebook', label: 'Lab Notebook', look: 'Graph paper, pencil charts, highlighter', palette: p('#2b2d42', '#edc72f', '#d64550', '#fdfcf7') },
  { id: 'chalk', label: 'Chalkboard', look: 'Green slate, chalk lettering, eraser ghosts', palette: p('#253629', '#e8e4d8', '#d9a441', '#c96f4a') },
  { id: 'cyberpunk', label: 'Cyberpunk Neon', look: 'Rain-soaked street, glass-tube signs', palette: p('#0d0221', '#ff2a6d', '#05d9e8', '#d1f7ff') },
  { id: 'cartoon', label: 'Cartoon Hand-drawn', look: 'Blue-pencil roughs, brush-pen, cel shadow', palette: p('#3a5a8c', '#f2c14e', '#e4572e', '#fbf6ee') },
  { id: 'isometric', label: 'Isometric 2.5D', look: 'Pastel miniature model, one sun, data cards', palette: p('#f4a6b8', '#a6d8f4', '#f9e27d', '#3a3a55') },
  { id: 'lineart', label: 'One-Line Drawing', look: 'Single unbroken line, one accent eye', palette: p('#111111', '#c96f4a', '#f8f6f1') },
  { id: 'soft3d', label: 'Soft 3D', look: 'Candy-ball sea, puffy letters, depth of field', palette: p('#ffd1dc', '#a2d2ff', '#fdffb6', '#ffffff') },
  { id: 'morph', label: 'Shape Morph', look: 'Outline morphs with onion-skin ghosts', palette: p('#6c63ff', '#ff6584', '#0f0f1a') },
  { id: 'newscollage', label: 'Magazine Collage', look: 'Dada cut-and-paste on kraft board', palette: p('#8a6f4d', '#1c1c1e', '#b03a2e', '#eae0cf') },
  { id: 'aurora', label: 'Glassmorphism', look: 'Frosted cards over aurora mesh gradient', palette: p('#7f5af0', '#2cb67d', '#16161a', '#e6f1ff') },
  { id: 'bauhaus', label: 'Bauhaus', look: 'Primary geometry as a screen print', palette: p('#d02a20', '#1f5dbf', '#f2b705', '#f4f0e8') },
  { id: 'synthwave', label: 'Synthwave', look: 'Cut sun, neon grid, chrome, VHS wear', palette: p('#12002e', '#ff2a6d', '#05d9e8', '#ffd319') },
  { id: 'perler', label: 'Fuse Beads', look: 'Melted pegboard bead sprites', palette: p('#e63946', '#457b9d', '#f1c40f', '#f4f1ea') },
  { id: 'petroglyph', label: 'Petroglyphs', look: 'Pecked rock art on desert varnish', palette: p('#7a5230', '#3d2b1f', '#c96f4a', '#d9c5a0') },
  { id: 'tomb', label: 'Egyptian Tomb', look: 'Theban wall painting, hieroglyphs', palette: p('#c96f4a', '#d9a441', '#2e5e4e', '#e8dcc0') },
  { id: 'mosaic', label: 'Roman Mosaic', look: 'Tesserae along contours, grout, plaque', palette: p('#8c6b4f', '#b03a2e', '#3d5a80', '#e3d5b8') },
  { id: 'stainedglass', label: 'Stained Glass', look: 'Gothic window, grisaille, lead cames', palette: p('#1f5dbf', '#b03a2e', '#d9a441', '#2a2a35') },
  { id: 'illuminated', label: 'Illuminated Manuscript', look: 'Gold leaf, blackletter, vellum', palette: p('#8a6f2f', '#b03a2e', '#2b2d42', '#f4ecd8') },
  { id: 'codex', label: 'da Vinci Codex', look: 'Iron-gall ink, mirror writing, machines', palette: p('#3d2c29', '#a8763e', '#b3552e', '#ead9b8') },
  { id: 'silhouette', label: 'Silhouette Shade', look: 'Cut-paper profile in gilt oval frame', palette: p('#1c1c1e', '#d9a441', '#e9dfc8') },
  { id: 'letterpress', label: 'Letterpress', look: 'Wood-type playbill, two-colour misprint', palette: p('#b03a2e', '#1c1c1e', '#e8dcc0') },
  { id: 'constructivism', label: 'Constructivism', look: 'Soviet poster, red-black, diagonal wedges', palette: p('#c02c1d', '#161616', '#e8e0d0') },
  { id: 'artdeco', label: 'Art Deco', look: 'Airbrush rays, stepped towers, Deco type', palette: p('#1c2b52', '#c9a227', '#e8dcc0', '#0f1a33') },
  { id: 'comic', label: 'Golden-Age Comic', look: 'Brush-inked cover, Ben-Day dots', palette: p('#d02a20', '#f2b705', '#1f5dbf', '#f2e8d5') },
  { id: 'popart', label: 'Pop Silkscreen', look: 'Warhol colour fields, offset photo black', palette: p('#ff4b8b', '#ffd23f', '#2ec4b6', '#111111') },
  { id: 'lineprinter', label: 'ASCII Printer', look: 'Greenbar line-printer character art', palette: p('#0f1a12', '#33ff66', '#e8e4d8') },
  { id: 'lowpoly', label: 'Low Poly 90s', look: 'Software-rasterized game frame, dither', palette: p('#4a3f8f', '#2ec4b6', '#f2b705', '#101018') },
  { id: 'stencil', label: 'Stencil Graffiti', look: 'Spray stencils on concrete, drips', palette: p('#8f8f8c', '#1c1c1e', '#c02c1d', '#b8b5ad') },
  { id: 'blueprint', label: 'Blueprint', look: 'Ferro-prussiate white-line engineering', palette: p('#0d3b66', '#e8f1ff', '#8fb6d9') },
  { id: 'crayon', label: 'Crayon Kid', look: 'Wax crayon on rough paper', palette: p('#e4572e', '#f3a712', '#2e86ab', '#f6efe4') },
  { id: 'crt', label: 'CRT Terminal', look: 'Phosphor ASCII art, scanlines', palette: p('#04120a', '#33ff66', '#a8ffb0') },
  { id: 'thermal', label: 'Thermal Camera', look: 'Temperature field, false-colour palette', palette: p('#120458', '#c02c1d', '#f2b705', '#f8f7f2') },
  { id: 'delft', label: 'Delft Tiles', look: 'Cobalt blue on tin glaze, tile picture', palette: p('#1a4a8a', '#4a7ba6', '#f5f4ef') },
  { id: 'blackfigure', label: 'Greek Vase', look: 'Attic black-figure, incised detail', palette: p('#b3552e', '#1c1c1e', '#d9a441', '#e8dcc0') },
  { id: 'graphite', label: 'Pencil Sketch', look: 'Graphite hatching on cartridge paper', palette: p('#3d3d3d', '#8a8f98', '#d9d9d4', '#f8f7f2') },
  { id: 'xray', label: 'X-Ray', look: 'Radiopaque bodies, false-colour intensity', palette: p('#04101f', '#1f5dbf', '#66d9e8', '#f2fbff') },
  { id: 'rubberhose', label: 'Rubber Hose', look: '1930s B&W cartoon on old film', palette: p('#e8e4d8', '#2b2b2b', '#b3552e') },
  { id: 'linocut', label: 'Linocut', look: 'Carved lino print, one spot colour', palette: p('#1c1c1e', '#c02c1d', '#f4f0e8') },
  { id: 'vhs', label: 'VHS Home Video', look: 'Camcorder frame, chroma bleed, REC', palette: p('#2b2d42', '#8a8f98', '#d9a441') },
  { id: 'flatvector', label: 'Flat Vector', look: 'Layered geometric landscape, bold palette', palette: p('#26495c', '#e4572e', '#f3a712', '#f6f2ea') },
  { id: 'storybook', label: 'Storybook Animation', look: 'Squash-and-stretch character acting', palette: p('#f4a6b8', '#a6d8f4', '#f9e27d', '#4a4458') },
  { id: 'ballpoint', label: 'Ballpoint Doodle', look: 'Pen doodles, ink blobs, margin notes', palette: p('#1f5dbf', '#c02c1d', '#2e5e4e', '#fdfcf7') },
  { id: 'overlay', label: 'Overlay Sheets', look: 'Tracing-paper separations on a light box', palette: p('#4a7ba6', '#b03a2e', '#d9a441', '#f2f4f8') },
  { id: 'pastelui', label: 'Pastel UI', look: 'Product-film interface on pastel fields', palette: p('#ffd1dc', '#a2d2ff', '#fdffb6', '#2b2d42') },
  { id: 'grading', label: 'Exam Grading', look: 'Red-pen marked answer sheet, stamps', palette: p('#c02c1d', '#2b2d42', '#d9a441', '#f6f2ea') },
  { id: 'shadowpuppet', label: 'Shadow Puppetry', look: 'Leather puppets on lamp-lit screen', palette: p('#b3552e', '#d9a441', '#2b1d0f', '#e8dcc0') },
  { id: 'penwash', label: 'Pen & Wash', look: 'Fineliner + loose watercolour sketch cards', palette: p('#2b2d42', '#4a7ba6', '#c96f4a', '#f8f6f1') },
  { id: 'gouache', label: 'Retro Gouache', look: 'Opaque picture-book portrait layers', palette: p('#c96f4a', '#8fc1bb', '#d9a441', '#e3b587') },
  { id: 'bluebook', label: 'Blue Picture Book', look: 'Soft-blue limited palette, dry ink line', palette: p('#a6d8f4', '#4a7ba6', '#1a4a8a', '#c96f4a') },
  { id: 'jiangnan', label: 'Jiangnan Garden', look: 'Spring garden: willows, moon gate, reflections', palette: p('#6ba368', '#4a7ba6', '#d9a441', '#f2ead8') },
  { id: 'drybrush', label: 'Dry-Brush Blocks', look: 'Mid-century roller-brushed colour blocks', palette: p('#3f7a5a', '#1f5dbf', '#c02c1d', '#f6f2ea') },
  { id: 'twilight', label: 'Twilight Storybook', look: 'Dusk sky, wildflower slope, night half', palette: p('#b8a9d9', '#e8a87c', '#2b2d42', '#f2d8c9') },
  { id: 'nocturne', label: 'Hatched Nocturne', look: 'Directional night strokes, one warm light', palette: p('#1a2647', '#2e4a7a', '#e8a87c', '#f2ead8') },
  { id: 'obsidianui', label: 'Note-App UI', look: 'Dark markdown app, graph view, purple', palette: p('#1a1a2a', '#7f5af0', '#e6e6f0') },
  { id: 'canvasboard', label: 'Canvas Whiteboard', look: 'Dotted board, cards, curved connectors', palette: p('#16161a', '#7f5af0', '#e6e6f0') },
  { id: 'flexoki', label: 'Flexoki Paper', look: 'Warm-paper explainer sheets, ink diagrams', palette: p('#fffcf0', '#1c1c1e', '#d7830e', '#8a8f98') },
  { id: 'pencilbook', label: 'Warm Pencil Storybook', look: 'Layered coloured pencil, paper-tooth', palette: p('#e8a87c', '#a6c8a1', '#8a6f4d', '#f8f2e7') },
  { id: 'colortown', label: 'Colour Town', look: 'Gouache hill town, bunting, wet street', palette: p('#e4572e', '#f3a712', '#2e86ab', '#f6efe4') },
  { id: 'pastelvignette', label: 'Pastel Vignette', look: 'Soft pastel character on white, warm accents', palette: p('#f4a6b8', '#a6d8f4', '#e8a87c', '#fffdf8') },
  { id: 'poetichalloween', label: 'Poetic Halloween', look: 'Melancholic portrait, glowing sheet ghost', palette: p('#2b2d42', '#d9a441', '#e8e4d8', '#1a1a2a') },
  { id: 'oilpastel', label: 'Oil-Pastel Portrait', look: 'Dry waxy strokes, paper-tooth specks', palette: p('#e8a87c', '#2e4a7a', '#1c1c1e', '#f8f2e7') },
  { id: 'sketchbook', label: 'Sketchbook Doodle', look: 'Fine ink lines, rainbow stripes, blush', palette: p('#2b2d42', '#e4572e', '#f3a712', '#2e86ab') },
  { id: 'spotillo', label: 'Flat Spot Illustration', look: 'Everyday vignettes, one red accent', palette: p('#2e4a7a', '#c02c1d', '#d9d9d4', '#fdfcf7') },
  { id: 'grainbook', label: 'Grainy Picture Book', look: 'Mid-century grain, cobalt + vermilion', palette: p('#1f5dbf', '#c02c1d', '#f2b705', '#f4f0e8') },
  { id: 'dreamhills', label: 'Dreamy Hills', look: 'Velvet grass fur, surreal colour fields', palette: p('#b8a9d9', '#e8a87c', '#4a7ba6', '#1a2647') },
  { id: 'sunlitgreen', label: 'Sunlit Greenery', look: 'Painted leaf clusters, dappled light', palette: p('#6ba368', '#3f7a5a', '#f9e27d', '#4a7ba6') },
  { id: 'pixel', label: '1-bit Paint', look: '1984 1-bit paint program framing', palette: p('#ffffff', '#000000') },
];

/* ------------------------ Motion recipes (36, implemented) ---------------- */

export const MOTION_RECIPE_PRESETS: MotionPreset[] = [
  { id: 'cave', label: 'Cave Painting', look: 'Ochre firelit rock, blown handprints', palette: p('#3d2b1f', '#c96f4a', '#e8dcc0') },
  { id: 'egypt', label: 'Egyptian', look: 'Theban tomb registers, hieroglyphs', palette: p('#c96f4a', '#d9a441', '#2e5e4e', '#e8dcc0') },
  { id: 'greek', label: 'Greek Vase', look: 'Black-figure frieze, incised lines', palette: p('#b3552e', '#1c1c1e', '#e8dcc0') },
  { id: 'roman', label: 'Roman Fresco', look: 'Pompeian wall panels, garden scenes', palette: p('#8c2f39', '#3d5a80', '#d9c5a0') },
  { id: 'gothic', label: 'Gothic', look: 'Stained glass, grisaille, silver stain', palette: p('#1f5dbf', '#b03a2e', '#d9a441', '#2a2a35') },
  { id: 'renaissance', label: 'Renaissance', look: 'Chiaroscuro panels, gold ground', palette: p('#5a3e2b', '#d9a441', '#2b2d42', '#f4ecd8') },
  { id: 'impressionism', label: 'Impressionism', look: 'Broken colour, plein-air light', palette: p('#a6d8f4', '#f9e27d', '#6ba368', '#f6f2ea') },
  { id: 'postimp', label: 'Post-Impressionism', look: 'Bold strokes, expressive colour', palette: p('#e8a87c', '#3f7a5a', '#f2b705', '#1c2b52') },
  { id: 'nouveau', label: 'Art Nouveau', look: 'Whiplash lines, decorative panels', palette: p('#6ba368', '#d9a441', '#8a6f2f', '#f4ecd8') },
  { id: 'cubism', label: 'Cubism', look: 'Faceted planes, multiple viewpoints', palette: p('#8a6f4d', '#4a7ba6', '#b3552e', '#e8dcc0') },
  { id: 'bauhaus', label: 'Bauhaus Motion', look: 'Primary geometry, kinetic composition', palette: p('#d02a20', '#1f5dbf', '#f2b705', '#f4f0e8') },
  { id: 'pop', label: 'Pop Art', look: 'Ben-Day dots, colour fields', palette: p('#ff4b8b', '#ffd23f', '#2ec4b6', '#111111') },
  { id: '8bit', label: '8-bit', look: 'NES-era sprites, parallax, dither', palette: p('#0f380f', '#306230', '#8bac0f', '#9bbc0f') },
  { id: 'raytrace', label: 'Ray Traced', look: 'Chrome spheres, checkerboard, glare', palette: p('#1a1a2a', '#8a8f98', '#d9d9d4', '#66d9e8') },
  { id: '2026', label: '2026 Editorial', look: 'Modern kinetic typography, glass cards', palette: p('#16161a', '#7f5af0', '#2cb67d', '#e6f1ff') },
  { id: 'ink', label: 'Ink Motion', look: 'Brush strokes, splashes, washes', palette: p('#1c1c1e', '#8a8f98', '#b03a2e', '#f5f2ea') },
  { id: 'klimt', label: 'Klimt', look: 'Gold leaf patterns, mosaic robes', palette: p('#d9a441', '#8a6f2f', '#2b2d42', '#f4ecd8') },
  { id: 'munch', label: 'Munch', look: 'Wavy expressive lines, anxiety palette', palette: p('#c96f4a', '#1a2647', '#e8a87c') },
  { id: 'dunhuang', label: 'Dunhuang', look: 'Mogao cave murals, flying apsaras', palette: p('#b3552e', '#d9a441', '#2e5e4e', '#e8dcc0') },
  { id: 'kusama', label: 'Kusama', look: 'Infinity dots, pumpkin polka fields', palette: p('#e4572e', '#f6f2ea', '#1c1c1e') },
  { id: 'constructivism', label: 'Constructivist Motion', look: 'Red-black wedges, diagonal montage', palette: p('#c02c1d', '#161616', '#e8e0d0') },
  { id: 'dali', label: 'Dalí Surrealism', look: 'Melting forms, long shadows, desert', palette: p('#d9a441', '#8a6f4d', '#1a2647', '#f2e8d5') },
  { id: 'hopper', label: 'Hopper', look: 'Lonesome light, diner windows, dusk', palette: p('#2b4570', '#e8a87c', '#d9d9d4') },
  { id: 'ghibli', label: 'Ghibli-esque', look: 'Painted skies, lush meadows, wind', palette: p('#4c9be6', '#86cf5e', '#f9e27d', '#f6f2ea') },
  { id: 'vaporwave', label: 'Vaporwave', look: 'Grid horizon, busts, pastel neon', palette: p('#ff71ce', '#01cdfe', '#05ffa1', '#1a0b2e') },
  { id: 'kirby', label: 'Jack Kirby', look: 'Kirby krackle, dynamic foreshortening', palette: p('#ff4b3e', '#ffd23f', '#0061ff', '#f2e8d5') },
  { id: 'monet', label: 'Monet', look: 'Water lilies, atmospheric dissolves', palette: p('#a6d8f4', '#6ba368', '#f4a6b8', '#f6f2ea') },
  { id: 'seurat', label: 'Seurat', look: 'Pointillism, optical mixing', palette: p('#4a7ba6', '#f9e27d', '#6ba368', '#f6f2ea') },
  { id: 'matisse', label: 'Matisse', look: 'Cut-out gouache shapes, pure colour', palette: p('#e4572e', '#3f7a5a', '#1f5dbf', '#f6f2ea') },
  { id: 'haring', label: 'Haring', look: 'Bold outlines, radiant figures', palette: p('#111111', '#ff4b3e', '#ffd23f', '#ffffff') },
  { id: 'rembrandt', label: 'Rembrandt', look: 'Deep chiaroscuro, golden gloom', palette: p('#3d2c29', '#a8763e', '#d9b382', '#1c1c1e') },
  { id: 'rubberhose', label: 'Rubber Hose', look: 'Bouncy 1930s B&W animation', palette: p('#e8e4d8', '#2b2b2b', '#b3552e') },
  { id: 'shadowpuppet', label: 'Shadow Puppet', look: 'Carved leather silhouettes, lamp glow', palette: p('#b3552e', '#d9a441', '#2b1d0f', '#e8dcc0') },
  { id: 'shinkai', label: 'Shinkai', look: 'Lens-flared skies, luminous clouds', palette: p('#1a4fb8', '#4c9be6', '#e8a87c', '#f6f2ea') },
  { id: 'picasso_blue', label: 'Picasso Blue', look: 'Monochrome blue period melancholy', palette: p('#1a4a8a', '#4a7ba6', '#a6d8f4', '#0d2b52') },
  { id: 'rick_morty', label: 'Rick Morty', look: 'Wobbly portal green, scribble shading', palette: p('#97ce4c', '#12b0c9', '#fafdaf', '#1c1c1e') },
];

/* --------------------- Explainer grammars (9, from the skill) ------------- */

export const GRAMMAR_PRESETS: MotionPreset[] = [
  { id: '3b1b', label: 'Math Construction', look: 'Strokes draw circles/squares/spirals', palette: p('#0b1020', '#f59e0b', '#e5e7eb'), grammar: '3b1b' },
  { id: 'keynote_ui', label: 'Keynote Cards', look: 'Window card with bullet reveals', palette: p('#0b1020', '#38bdf8', '#e5e7eb'), grammar: 'keynote_ui' },
  { id: 'finance_chart', label: 'Finance Chart', look: 'Animated line/bar with rolling counter', palette: p('#0b1020', '#f59e0b', '#e5e7eb'), grammar: 'finance_chart' },
  { id: 'kurzgesagt', label: 'Flat Explainer', look: 'Rounded shapes popping in', palette: p('#0e1a2b', '#f4a6b8', '#e5e7eb'), grammar: 'kurzgesagt' },
  { id: 'vox', label: 'Highlight Reel', look: 'Highlight-box lines, progress bar', palette: p('#f6f2ea', '#c02c1d', '#1c1c1e'), grammar: 'vox' },
  { id: 'whiteboard', label: 'Whiteboard', look: 'Hand-sketch text drawing itself', palette: p('#f8fafc', '#2563eb', '#0f172a'), grammar: 'whiteboard' },
  { id: 'storytime', label: 'Storytime', look: 'Storybook hill + bouncy character', palette: p('#a6d8f4', '#6ba368', '#f4a6b8'), grammar: 'storytime' },
  { id: 'kinetic_type', label: 'Kinetic Type', look: 'Word-by-word typography reveal', palette: p('#0b1020', '#f59e0b', '#e5e7eb'), grammar: 'kinetic_type' },
  { id: 'presenter_explainer', label: 'Presenter', look: 'Presenter card + typewriter captions', palette: p('#0b1020', '#2cb67d', '#e5e7eb'), grammar: 'presenter_explainer' },
];

/* ----------------------- Deterministic film builder ----------------------- */

interface FilmSpec {
  title: string;
  subtitle: string;
  palette: string[];
  bg: string;
  accent: string;
  ink: string;
  duration: number;
  image?: string;
  motion: number; // layout/motion personality index
  mcpHint?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hashIndex(id: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h % mod;
}

/**
 * Builds a self-contained deterministic film HTML honoring the Studio bridge
 * contract: window.film = { frame(t), duration, width, height, setMuted }.
 * Same picture for the same t -> Play/Pause/Scrubber/Mute/MP4 export all work.
 */
export function buildPresetFilmHTML(preset: FilmSpec): string {
  const W = 1920;
  const H = 1080;
  const DUR = preset.duration;
  const palette = JSON.stringify(preset.palette);
  const imageJson = preset.image ? JSON.stringify(preset.image) : 'null';
  const hint = preset.mcpHint ? esc(preset.mcpHint) : '';
  const motion = hashIndex(preset.title, 3);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(preset.title)}</title>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:${preset.bg}}
  canvas{width:100%;height:100%;object-fit:contain;display:block}
</style>
</head>
<body>
<canvas id="film" width="${W}" height="${H}"></canvas>
<script>
/* Satchida Studio preset film - deterministic. ${hint ? 'MCP: ' + hint : ''} */
(function(){
  var W=${W},H=${H},DUR=${DUR};
  var PALETTE=${palette};
  var IMAGE_SRC=${imageJson};
  var MOTION=${motion};
  var BG=${JSON.stringify(preset.bg)},ACCENT=${JSON.stringify(preset.accent)},INK=${JSON.stringify(preset.ink)};
  var TITLE=${JSON.stringify(preset.title)},SUB=${JSON.stringify(preset.subtitle)};
  var canvas=document.getElementById('film');
  var ctx=canvas.getContext('2d');
  var img=null,imgOk=false;
  if(IMAGE_SRC){img=new Image();img.onload=function(){imgOk=true;};img.src=IMAGE_SRC;}
  function ease(t){t=Math.max(0,Math.min(1,t));return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  function clamp01(v){return v<0?0:v>1?1:v;}
  function pal(i){return PALETTE[((i%PALETTE.length)+PALETTE.length)%PALETTE.length];}
  function roundRect(x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();
    ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
  function frame(t){
    t=Math.max(0,Math.min(t,DUR));
    ctx.fillStyle=BG;ctx.fillRect(0,0,W,H);
    var u=t/DUR;
    // Act 1 (0-60%): art showcase - Ken Burns over benchmark image or palette field
    var u1=clamp01(t/(DUR*0.6));
    if(imgOk){
      var z=1.06+0.12*ease(u1)+(MOTION===1?0.06:0);
      var dx=MOTION===2?Math.sin(u1*3.14)*40:0;
      var iw=W*z,ih=H*z;
      ctx.save();ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();
      ctx.drawImage(img,(W-iw)/2+dx,(H-ih)/2,iw,ih);ctx.restore();
    } else {
      for(var i=0;i<PALETTE.length;i++){
        ctx.fillStyle=pal(i);ctx.globalAlpha=0.85;
        var ph=H/PALETTE.length;
        var off=(1-ease(clamp01(u1*1.4)))*(i%2===0?-W:W)*0.12;
        ctx.fillRect(off,i*ph,W,ph+1);
      }
      ctx.globalAlpha=1;
      for(var b=0;b<14;b++){
        var bx=(b*331%W),by=(b*197%H);
        ctx.fillStyle=INK;ctx.globalAlpha=0.06;
        ctx.beginPath();ctx.arc(bx,by,60+40*Math.sin(b+t),0,6.3);ctx.fill();
      }
      ctx.globalAlpha=1;
    }
    // Act 2 (55-90%): title + look caption reveal
    var u2=clamp01((t-DUR*0.55)/(DUR*0.35));
    var ty=H*0.72;
    ctx.fillStyle='rgba(10,10,14,0.55)';ctx.fillRect(0,H*0.6,W,H*0.4);
    var titleN=Math.floor(TITLE.length*ease(u2));
    ctx.fillStyle=INK;ctx.textAlign='left';ctx.textBaseline='alphabetic';
    ctx.font='800 '+Math.round(H*0.085)+'px sans-serif';
    ctx.fillText(TITLE.slice(0,titleN),W*0.07,ty);
    ctx.fillStyle=ACCENT;ctx.fillRect(W*0.07,ty+H*0.035,W*0.16*ease(u2),H*0.012);
    var subN=Math.floor(SUB.length*ease(clamp01(u2*1.3-0.2)));
    ctx.fillStyle='rgba(229,231,235,0.92)';ctx.font='500 '+Math.round(H*0.036)+'px sans-serif';
    ctx.fillText(SUB.slice(0,subN),W*0.07,ty+H*0.105);
    // Act 3 (85-100%): palette credits
    var u3=clamp01((t-DUR*0.85)/(DUR*0.15));
    if(u3>0){
      PALETTE.forEach(function(col,i){
        ctx.fillStyle=col;ctx.globalAlpha=ease(u3);
        roundRect(W*0.07+i*(H*0.075),H*0.06,H*0.06,H*0.06,10);ctx.fill();
      });
      ctx.globalAlpha=1;
      ctx.fillStyle='rgba(229,231,235,0.75)';ctx.font='500 '+Math.round(H*0.024)+'px sans-serif';
      ctx.textAlign='right';ctx.fillText('Satchida Studio preset',W*0.96,H*0.095);
    }
    // progress rail
    ctx.fillStyle='rgba(148,163,184,0.4)';ctx.fillRect(W*0.03,H*0.94,W*0.94,H*0.008);
    ctx.fillStyle=ACCENT;ctx.fillRect(W*0.03,H*0.94,W*0.94*(t/DUR),H*0.008);
  }
  var muted=false,actx=null,master=null;
  function audio(){ if(!actx){ try{actx=new (window.AudioContext||window.webkitAudioContext)();
    master=actx.createGain();master.gain.value=muted?0:0.5;master.connect(actx.destination);}catch(e){actx=null;} } return actx; }
  function pop(at){ var a=audio(); if(!a)return; var t0=a.currentTime+(at||0);
    var g=a.createGain();g.connect(master);
    g.gain.setValueAtTime(0.0001,t0);g.gain.linearRampToValueAtTime(0.4,t0+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+0.18);
    var o=a.createOscillator();o.type='sine';o.frequency.setValueAtTime(520,t0);
    o.frequency.exponentialRampToValueAtTime(180,t0+0.14);o.connect(g);o.start(t0);o.stop(t0+0.2); }
  function setMuted(v){ muted=!!v; if(master)master.gain.value=muted?0:0.5; }
  var fired={};
  function maybePop(key,cond){ if(cond&&!fired[key]){fired[key]=true;pop(0);} }
  var rafId=null,t0=null,base=0;
  function loop(){ if(t0===null)return; var tt=base+(performance.now()-t0)/1000;
    if(tt>=DUR){frame(DUR);t0=null;return;}
    maybePop('title',tt>DUR*0.55); maybePop('credits',tt>DUR*0.85);
    frame(tt); rafId=requestAnimationFrame(loop); }
  window.addEventListener('message',function(e){
    if(!e.data)return;
    if(e.data.type==='FILM_PLAY'){base=e.data.time||0;t0=performance.now();
      if(!rafId)rafId=requestAnimationFrame(loop);}
    else if(e.data.type==='FILM_PAUSE'){if(t0!==null){base=base+(performance.now()-t0)/1000;t0=null;}
      if(rafId){cancelAnimationFrame(rafId);rafId=null;}}
    else if(e.data.type==='AUDIO_MUTE'){setMuted(e.data.muted);}
  });
  window.film={frame:frame,duration:DUR,width:W,height:H,setMuted:setMuted};
  window.__TIMELINE__={pause:function(t){if(t!=null)frame(t);},seek:function(t){frame(t);}};
  window.__SEEK_FRAME__=frame;
  frame(0);
})();
</script>
</body>
</html>`;
}

/** Vendored 640px benchmark preview served from the repo at /assets/art-presets. */
export const artPreviewUrl = (id: string) => `/assets/art-presets/${id}.jpg`;

export function artStylePresetToFilm(preset: ArtStylePreset): string {
  return buildPresetFilmHTML({
    title: preset.label,
    subtitle: preset.look,
    palette: preset.palette,
    bg: preset.palette[0],
    accent: preset.palette[preset.palette.length - 2] ?? preset.palette[0],
    ink: '#e5e7eb',
    duration: 10,
    image: preset.preview ?? artPreviewUrl(preset.id),
    motion: hashIndex(preset.id, 3),
    mcpHint: `generate_procedural_art(style="${preset.id}", prompt="...", seed=N)`,
  });
}

export function motionPresetToFilm(preset: MotionPreset): string {
  return buildPresetFilmHTML({
    title: preset.label,
    subtitle: preset.look + (preset.grammar ? ` (grammar: ${preset.grammar})` : ' (style recipe)'),
    palette: preset.palette,
    bg: preset.palette[0],
    accent: preset.palette[1] ?? preset.palette[0],
    ink: preset.id === 'whiteboard' || preset.id === 'haring' ? '#0f172a' : '#e5e7eb',
    duration: 8,
    motion: hashIndex(preset.id, 3),
    mcpHint: `create_kinetic_motion_clip(grammar="${preset.grammar ?? preset.id}", spec_json=...)`,
  });
}
