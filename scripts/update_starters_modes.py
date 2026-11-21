with open('client/src/common/starters.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace 'Motion' with 'OpenFilm' in modes
# But let's check exact occurrences
new_text = text.replace("'Motion'", "'OpenFilm'")
with open('client/src/common/starters.ts', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Updated client/src/common/starters.ts with OpenFilm spec")
