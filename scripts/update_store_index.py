with open('client/src/store/index.ts', 'r', encoding='utf-8') as f:
    text = f.read()

import_target = "import * as artifacts from './artifacts';"
import_rep = "import * as artifacts from './artifacts';\nimport * as studioLibrary from './studioLibrary';"

text = text.replace(import_target, import_rep, 1)

export_target = "  ...artifacts,"
export_rep = "  ...artifacts,\n  ...studioLibrary,"

text = text.replace(export_target, export_rep, 1)

with open('client/src/store/index.ts', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated store/index.ts')
