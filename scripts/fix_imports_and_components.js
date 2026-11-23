const fs = require('fs');
const lucide = require('lucide-react');

const code = fs.readFileSync('client/src/common/personaVisuals.ts', 'utf8');

// Match all "icon": "X"
const iconRegex = /"icon":\s*"([^"]+)"/g;
const icons = new Set();
let match;
while ((match = iconRegex.exec(code)) !== null) {
  icons.add(match[1]);
}

console.log('Total icon names referenced in map:', icons.size);

// Extract the import block for lucide-react
const importStart = code.indexOf("import {");
const importEnd = code.indexOf("} from 'lucide-react';");
const currentImports = code.slice(importStart, importEnd + "} from 'lucide-react';".length);

// Extract ICON_COMPONENTS block
const compStart = code.indexOf("const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {");
const compEnd = code.indexOf("};", compStart);

// Check which referenced icons are not imported or not in ICON_COMPONENTS
const missingInImport = [...icons].filter(ic => !currentImports.includes(ic));
console.log('Missing in import statement:', missingInImport.length, missingInImport);

// Check if all exist in lucide-react
const notInLucide = [...icons].filter(ic => !lucide[ic]);
console.log('Not in lucide-react library:', notInLucide);

// Sort all referenced icons alphabetically
const sortedIcons = [...icons].sort();

const newImport = `import {\n  Sparkles,\n  ` + sortedIcons.join(',\n  ') + `\n} from 'lucide-react';`;

const newComponents = `const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {\n  Sparkles,\n  ` + sortedIcons.join(',\n  ') + `\n};`;

let updatedCode = code;
updatedCode = updatedCode.slice(0, importStart) + newImport + updatedCode.slice(importEnd + "} from 'lucide-react';".length);

// Re-find compStart in updatedCode
const newCompStart = updatedCode.indexOf("const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {");
const newCompEnd = updatedCode.indexOf("};", newCompStart);

updatedCode = updatedCode.slice(0, newCompStart) + newComponents + updatedCode.slice(newCompEnd + 2);

fs.writeFileSync('client/src/common/personaVisuals.ts', updatedCode);
console.log('Updated personaVisuals.ts with complete imports and ICON_COMPONENTS!');
