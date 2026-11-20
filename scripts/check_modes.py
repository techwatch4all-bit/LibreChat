import re

with open('client/src/common/starters.ts', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.findall(r'modes:\s*\[([^\]]+)\]', text)
modes = set()
for m in matches:
    for x in m.split(','):
        modes.add(x.strip().strip("'\""))
print('Unique modes in starters.ts:', sorted(list(modes)))
