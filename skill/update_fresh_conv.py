import pymongo

client = pymongo.MongoClient('mongodb://127.0.0.1:27017')
db = client['LibreChat']

conv_id = '28880f71-33f9-5b1f-9888-5d7bbcd1e2f8'
msg = db['messages'].find_one({'conversationId': conv_id, 'sender': 'Chat'})

text_content = (
    "I will render this new procedural synthwave scenario from scratch with dynamic Python scene generation (`scene_py`), followed by analog soundscape synthesis and an active kinetic motion film.\n\n"
    "### 🌅 Procedural Art Painting\n"
    "![Fresh Custom Synthwave](/generated/fresh_custom_synthwave.png)\n\n"
    "*Deterministic 1920×1080 Synthwave Code Painting — Giant central striped retro sun, infinite perspective laser grid road, distant neon skyline, and flying speeders. Rendered via dynamic scene synthesis with zero static templates.*\n\n"
    "---\n\n"
    "### 🎬 Living Outrun Animation & Studio\n"
    "The motion sequence is active in the OpenFilm Studio panel with synchronized atmospheric perspective, drifting neon horizon, and interactive playback.\n\n"
    ':::artifact{identifier="motion-neon-cyberpunk-sunset-outrun-horizon" type="application/vnd.satchida.film" title="Neon Cyberpunk Sunset — Outrun Horizon"}\n'
    "````html\n"
    '<iframe src="/generated/fresh_neon_sunset_film.html" style="width:100%;height:100%;border:none;" allow="autoplay"></iframe>\n'
    "````\n"
    ":::\n\n"
    "- **Direct HTML Film**: [fresh_neon_sunset_film.html](/generated/fresh_neon_sunset_film.html)\n\n"
    "---\n\n"
    "### 🎵 Mastered Analog Ambient Soundscape\n"
    "A 12-second high-fidelity analog synthwave track synthesized via subtractive analog synthesis (warm detuned saw waves, low-pass filter sweeps, and 16th-note arpeggios with zero clipping or harsh static hiss).\n\n"
    "- 🎧 [Listen / Download: neon_sunset_analog_master.mp3](/generated/neon_sunset_analog_master.mp3)\n"
)

content = [
    {'type': 'text', 'text': text_content}
]

db['messages'].update_one(
    {'_id': msg['_id']},
    {
        '$set': {
            'content': content,
            'text': text_content,
            'error': False,
            'unfinished': False
        }
    }
)

db['conversations'].update_one(
    {'conversationId': conv_id},
    {'$set': {'title': 'Neon Cyberpunk Sunset (Dynamic)'}}
)

print('Updated message in MongoDB successfully!')
