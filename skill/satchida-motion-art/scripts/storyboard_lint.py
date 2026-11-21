#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""storyboard_lint.py -- mechanically lint a shot list before writing any code.

Usage:
  uv run storyboard_lint.py shot-list.md [--script script.txt]     # or python3 storyboard_lint.py ...

The shot list opens with a style lock (three lines above the table):
  Style: one sentence (one style card or one drawing technique, used for the whole film)
  Palette: palette name (paper/poster/ink/navy/bauhaus/snow/wood/chalk) or 3-6 hex colors
  Character: none / hands and backs only / frames <path> (AI-generated frames)
  Flat-cartoon narrow exception: style starts with 37_rick_morty or 52_south_park and the
    character row starts with "original semantic SVG ..."
  Allow blue-purple: <reason> (optional; write it only when the user explicitly asks for blue-purple)
Then a markdown table (template and examples in references/shot-list-template.md), one shot per row, columns:
  Time | Subject | Action | Camera | On-screen text | Method (optional, recommended) | Tags (optional)
Tables inside code fences are not checked. When a file has several tables, only the first one with
both a "Subject" and an "Action" column is linted.

Per-row checks:
  1 Subject: must not be empty, must not be just a layout word ("title, bullet, text, list, tag,
       caption, card, background, screen, icon"), and must not be an empty scene
       ("empty shot, blank scene, solid color, black screen, all black, gradient")                -> red
  2 Action: must not be empty, must not be only a universal verb ("appears, shows, displays,
       fades in ...")                                                                             -> red
  3 On-screen text <= 8 units (each CJK character counts as one; each word or number run counts as one) -> red
  4 First shot must not be text-led (Subject is a title/word, or on-screen text >= 7 units,
       or Method is y5 kinetic type)                                                              -> red
  6 One shot is 2-6 s; 6-8 s or under 2 s -> yellow; over 8 s -> red; more than a fifth of the
       shots in 6-8 s -> red
  7 Three consecutive shots with the same Camera cell ("hold" and "pan" don't count)              -> yellow
  15 Three consecutive shots all pushing in (slow push, fast push, smash in, zoom in in any mix)  -> yellow
  8 Last shot must not be text-led (centered quote card, pure text card; same test as 4)          -> red
  11 A middle shot that is a text-led shot carrying a number (a standalone number card)           -> yellow
  9 With --script: an Arabic numeral on screen (percentage, year, quantity with unit) that the
     voiceover script never says                                                                  -> red
     (Chinese numerals in the script are also recognized: "bai fen zhi liu shi" = 60%, and so on)
  10 With a "Tags" column: more than 3 tags on one shot                                           -> yellow
Whole-table checks:
  5 Text-led shots <= 30% of the table                                                            -> red
  Method column (checked only when present): one parameterized clip (same .json) longer than 8 s -> red;
     more than 2 clip grammars (style collage)                                                    -> red
  12 Style lock: missing any of "Style", "Palette", "Character"                                   -> red
  13 Palette: a hex color in the blue-purple zone (hue 225-300, saturation >= 0.30) -> red
     ("Allow blue-purple" turns it yellow); more than 6 colors                                    -> yellow
  14 Character: code-drawn / chibi / robot in the Character row -> red; robot, stick figure,
       mascot or cartoon person in Subject while Character is not a frame library -> red;
       y4 used while Character is not a frame library -> red; coin/ball/ion with a face -> yellow
  16 Accent camera moves (fast push, smash in, whip) over a third of the shots                    -> yellow
  Time spans not contiguous, or no camera movement at all in the whole table (all hold and cut)   -> yellow

Exit codes: red 1; only yellow or all green 0; unreadable file or no table 2. Standard library only.
"""
import re
import sys
from pathlib import Path

RED, YELLOW, GREEN = "red", "yellow", "green"

# 1 Subject: if nothing remains after removing these words, quantifiers, direction words, colors and
# punctuation, the cell "has no subject". Chinese entries are kept for legacy bilingual shot lists.
ABSTRACT = sorted("""title subtitle heading headline main heading section title bullet bullet points bullet point text copy body text big text word words list list item checklist tags tag tag tags caption subtitles subtitle card text card cards card background backdrop bg base white background black background
solid color plain solid blank empty frame icon icon empty shot empty scene empty frame empty screen black frame black screen white screen all black all white dark frame negative space gradient gradient background keywords keyword key phrase golden quote quote slogan tagline takeaways takeaway summary conclusion concept content info information element thing stuff diagram schematic illustration image picture picture whiteboard blackboard page layout animation effect
paragraph sentence bullet dot dot symbol numbering number arrow line lines shape shapes square color block gradient bokeh particles particles decoration""".split(), key=len, reverse=True)
FILLER = re.compile(r"[\d一二三四五六七八九十两几个条张行句段组页块排些堆串的和与及跟或上下左右中里边侧旁内外前后大小新白黑红蓝绿黄灰橙紫色底空"
                    r"、，,。.;；:：/／+＋&＆\s（）()\[\]【】「」『』“”\"'‘’\-—–~～·…|]"
                    r"|(?<![a-z])(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million|billion|a|an|the|of|and|or|with|on|in|at|to|for|by|from|into|onto|big|small|new|white|black|red|blue|green|yellow|grey|gray|orange|purple)(?![a-z])")
# 4 When the Subject cell matches these words, the shot is text-led.
TEXTY = re.compile(r"title|subtitle|heading|headline|text|copy|bullets?|checklist|list|caption|subtitle|keyword|quote|slogan|tagline|text card|\btext$|^text", re.I)
# 2 Action: if only universal verbs remain after stripping these modifiers, the cell "has no action".
WEAK = sorted("""appears appear appeared showing show shows displayed display displays presented present presents presenting emerges emerge emerged floats in float in fades in fade in fades out fade out fades in gradually pops up pop up pops in comes out come out comes up come up appears one by one lists list listed lights up light up lit up stays stay stayed stays still holds hold held holds still freezes freeze frozen static motionless motionless unchanged idle remains remain remained sits sit sitting exists exists arranged arranged introduces introduce introduced explains explain explained describes describe described emphasizes emphasize emphasized highlights highlight highlighted annotates annotate annotated writes out write out typed out types out enters enter entered exits exit exited shown showed""".split(), key=len, reverse=True)
ACT_FILLER = re.compile(r"[\d一二三四五六七八九十两几个条张行句段组页块排些堆串的地着了过和与及跟或也都再又并、，,。.;；:：/／+＋\s（）()「」“”\"'\-—–~～…|]"
                        r"|逐条|依次|一一|逐个|逐一|逐渐|渐渐|慢慢|缓缓|然后|开始|同时|接着|陆续|一起|一下|画面|屏幕|上"
                        r"|(?<![a-z])(?:one by one|one at a time|in turn|gradually|slowly|gently|quickly|then|start|starts|start to|starts to|begin|begins|begin to|begins to|meanwhile|simultaneously|next|soon|together|at once|screen|frame|it|its|they|their|the|a|an|of|and|or|with|to|on|in|at)(?![a-z])")
# Camera vocabulary: hold / slow push in / pull out / pan / fast push / smash in / cut (whip = whip pan).
# Usage and duration guidance live in references/shot-language.md
CAM_MOVE = ("push in", "pull out", "pull back", "pan", "whip", "smash in", "crash in", "zoom", "dolly", "move", "push", "cut", "hold")
CAM_IN = ("push in", "pushes in", "fast push", "smash in", "crash in", "zoom in", "zoom-in", "zoomin", "dolly in", "creep in", "move in", "pushes closer", "push")
CAM_ACCENT = ("fast push", "smash in", "crash in", "whip")
# 1 When the Subject cell only contains these words it is an empty scene, not a layout element; the fix is different.
EMPTY_SCENE = re.compile(r"empty shot|empty scene|empty frame|blank scene|blank screen|black frame|black screen|white screen|all black|all white|dark frame|negative space|solid color|plain|solid|gradient|^background$|^bg$|^(black|white) background$", re.I)
EMPTY_CELL = {"", "-", "—", "–", "none", "n/a", "empty", "(empty)", "/", "／", "——"}
GRAMMAR = re.compile(r"\b([ty][1-9])(?:_[a-z_]+)?\b", re.I)
# 12-14 Style lock (the three lines above the table)
LOCK = re.compile(r"^\s*[-*]?\s*(?:\*\*)?(style|palette|character|allow blue-purple)(?:\*\*)?\s*[:：]\s*(.+?)\s*$", re.I)
PALETTES = {"paper", "poster", "ink", "navy", "bauhaus", "snow", "wood", "chalk"}
HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
FLAT_STYLE = re.compile(r"^(?:37_rick_morty|52_south_park)(?=$|[\s：:，,；;·（(])", re.I)
CHAR_BAD = re.compile(r"code-drawn|hand-drawn|hand drawn|svg|SVG|chibi|q-version|stick figure|stick-figure|robot|mascot|cartoon person|cartoon character|flat person")
CHAR_FRAMES = re.compile(r"frame library|frames?|\.png|/")
CHAR_NONE = re.compile(r"none|no character|no face|no people|hands only|hand|back view|backs only|silhouette")
OBJ_CHAR = re.compile(r"robot|stick figure|stick-figure|mascot|cartoon person|cartoon character|chibi|q-version")
OBJ_FACE = re.compile(r"(?<![a-z])(smil\w*|expressions?|long face|eyes?|facial)(?![a-z]).{0,8}(?<![a-z])(coins?|coin|balls?|ball|ions?|ion|electrons?|electron|particles?|particle|molecules?|molecule)(?![a-z])|(?<![a-z])(coins?|coin|balls?|ball|ions?|ion|electrons?|electron|particles?|particle|molecules?|molecule)(?![a-z]).{0,8}(?<![a-z])(smil\w*|expressions?|long face|eyes?|facial)(?![a-z])")


def read_lock(text, table_line=None):
    """Style lock outside the table: {style, palette, character, allow blue-purple}.
    Lines inside code fences don't count; when a key is written several times, the line closest
    above the table wins (only if nothing appears above the table do we look below it)."""
    before, after, fence = {}, {}, False
    for i, ln in enumerate(text.splitlines(), 1):
        if ln.strip().startswith("```"):
            fence = not fence; continue
        m = None if fence else LOCK.match(ln)
        if not m: continue
        key = m.group(1).lower()
        if table_line is None or i < table_line: before[key] = m.group(2).strip()
        else: after.setdefault(key, m.group(2).strip())
    return {**after, **before}


def blue_purple_hex(h):
    h = h if len(h) == 6 else "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    mx, mn = max(r, g, b), min(r, g, b); d = mx - mn
    if d == 0 or mx == 0: return False
    hue = (((g - b) / d) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4) * 60
    return 225 <= hue <= 300 and d / mx >= 0.30 and 0.06 <= mx <= 0.90


def strip_cells(line):
    s = line.strip().replace("｜", "|")
    if s.startswith("|"): s = s[1:]
    if s.endswith("|"): s = s[:-1]
    return [c.strip() for c in s.split("|")]


def find_table(text):
    """Returns (header, rows [(line number, cells)]). Skips code fences; takes the first table that
    has both a Subject column and an Action column."""
    lines, fence, i = text.splitlines(), False, 0
    while i < len(lines):
        ln = lines[i]
        if ln.strip().startswith("```"):
            fence = not fence; i += 1; continue
        if not fence and ln.strip().startswith(("|", "｜")) and i + 1 < len(lines) and re.match(r"^\s*[|｜]?\s*:?-{2,}", lines[i + 1]):
            head = strip_cells(ln)
            rows, j = [], i + 2
            while j < len(lines) and lines[j].strip().startswith(("|", "｜")):
                rows.append((j + 1, strip_cells(lines[j]))); j += 1
            if any("subject" in h.lower() for h in head) and any(("action" in h.lower()) for h in head):
                return head, rows
            i = j; continue
        i += 1
    return None, []


def columns(head):
    col = {}
    for k, h in enumerate(head):
        h = h.lower()
        if "time" in h and "time" not in col: col["time"] = k
        elif "subject" in h and "obj" not in col: col["obj"] = k
        elif "action" in h and "act" not in col: col["act"] = k
        elif ("camera" in h or "cam" in h) and "cam" not in col: col["cam"] = k
        elif "tag" in h and "tags" not in col: col["tags"] = k
        elif "text" in h and "text" not in col: col["text"] = k
        elif "method" in h and "how" not in col: col["how"] = k
    return col


def parse_t(tok):
    tok = tok.strip()
    if ":" in tok:
        m, s = tok.split(":", 1)
        return int(m) * 60 + float(s)
    return float(tok)


def parse_span(cell):
    nums = re.findall(r"\d+:\d+(?:\.\d+)?|\d+(?:\.\d+)?", cell)
    if len(nums) < 2: return None
    a, b = parse_t(nums[0]), parse_t(nums[1])
    return (a, b) if b > a else None


def clean_cell(c):
    c = re.sub(r"<br\s*/?>", " ", c or "")
    return c.strip().strip("`*_").strip()


def is_empty(c):
    return clean_cell(c) in EMPTY_CELL


def obj_residue(obj):
    s = clean_cell(obj).lower()
    for w in ABSTRACT: s = s.replace(w.lower(), "")
    return FILLER.sub("", s)


def act_residue(act, obj=""):
    """What remains after removing universal verbs, layout words and the nouns from the Subject
    cell. "Bullets appear one by one" and "spores appear" both leave nothing."""
    s = clean_cell(act).lower()
    for w in sorted((t for t in FILLER.split(clean_cell(obj).lower()) if len(t) >= 2), key=len, reverse=True): s = s.replace(w, "")
    for w in WEAK + ABSTRACT: s = s.replace(w.lower(), "")
    return ACT_FILLER.sub("", s)


def text_len(t):
    t = clean_cell(t)
    if t in EMPTY_CELL: return 0
    t = re.sub(r"[「」『』“”\"'‘’《》]", "", t)
    return len(re.findall(r"[㐀-鿿]|[A-Za-z0-9][A-Za-z0-9.%°'’]*", t))


def how_kind(how):
    """Method cell -> the kind of visual approach: grammar id (t1...y6), scenes, asset, or the raw text."""
    h = clean_cell(how)
    if h in EMPTY_CELL: return None
    m = GRAMMAR.search(h)
    if m: return m.group(1).lower()
    if re.search(r"scenes?|\.js\b|code-drawn", h, re.I): return "scenes"
    if re.search(r"asset|screenshot|photo|footage|live[- ]action|recording|source image|original image|screen recording", h, re.I): return "asset"
    return h


def clip_name(how):
    m = re.search(r"[^\s|，,：:（）()]+\.json", clean_cell(how))
    return m.group(0) if m else None


def tag_count(cell):
    """Tags cell: split on commas, slashes, semicolons, middle dots; with no separator at all,
    split on whitespace."""
    c = clean_cell(cell)
    if c in EMPTY_CELL: return 0
    parts = [x for x in re.split(r"[、，,／/;；·•|]+", c) if x.strip()]
    if len(parts) <= 1: parts = c.split()
    return len(parts)


# 9 Numbers: only Arabic numerals on screen are checked (Chinese "one" appears everywhere in
# ordinary words and would false-positive); the script accepts both notations, preferring to let a
# match pass rather than flag it wrongly. Chinese-numeral parsing below is legacy logic kept inert
# for English-only scripts.
CN_DIGIT = {"零": 0, "〇": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
CN_UNIT = {"十": 10, "百": 100, "千": 1000}
CN_BIG = {"万": 10 ** 4, "亿": 10 ** 8}
ARABIC = re.compile(r"\d+(?:,\d{3})*(?:\.\d+)?")
CN_NUM = re.compile(r"[零〇一二两三四五六七八九十百千万亿]+(?:点[零〇一二三四五六七八九]+)?")
SRT_NOISE = re.compile(r"\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|^\s*\d+\s*$", re.M)


def cn_ints(s):
    """Chinese integer, possibly two readings: "san bai yi shi ba" -> 318, digit-by-digit
    "er ling er wu" -> 2025, "yi qian er" -> both 1200 and 1002."""
    if not s: return set()
    if all(ch in CN_DIGIT for ch in s):
        return {int("".join(str(CN_DIGIT[ch]) for ch in s))}
    total, sect, num, last = 0, 0, None, None
    for ch in s:
        if ch in CN_DIGIT: num = CN_DIGIT[ch]
        elif ch in CN_UNIT: sect += (1 if num is None else num) * CN_UNIT[ch]; num, last = None, CN_UNIT[ch]
        elif ch in CN_BIG: total += (sect + (num or 0)) * CN_BIG[ch]; sect, num, last = 0, None, CN_BIG[ch]
        else: return set()
    out = {total + sect + (num or 0)}
    if num is not None and last and last > 10 and s[-2] not in "零〇":         # "yi qian er" = 1200, "san wan wu" = 35000
        out.add(total + sect + num * last // 10)
    return out


def cn_values(tok):
    """Chinese number -> [(value, decimal places)]."""
    a, _, b = tok.partition("点")
    ints = cn_ints(a) if a else {0}
    if not b: return [(float(i), 0) for i in ints]
    frac = "".join(str(CN_DIGIT[ch]) for ch in b)
    return [(float(f"{i}.{frac}"), len(frac)) for i in ints]


def scaled(v, dec, after):
    """A number immediately followed by "10k / 100M / k / M": accept both the written number and the
    multiplied one (on-screen 1.2万 = script says 12000). Returns [(value, decimal places)]."""
    out = [(v, dec)]
    m = re.match(r"\s*(万|亿|[kK]|[mM](?![a-zA-Z]))", after)
    if m:
        k = {"万": 4, "亿": 8, "k": 3, "K": 3, "m": 6, "M": 6}[m.group(1)]
        out.append((v * 10 ** k, dec - k))
    return out


def arabic(tok):
    t = tok.replace(",", "")
    return float(t), len(t.partition(".")[2])


def screen_numbers(text):
    """Numbers in the on-screen text cell: [(source text, [(value, decimal places)])]."""
    t = clean_cell(text)
    return [(m.group(0), scaled(*arabic(m.group(0)), t[m.end():])) for m in ARABIC.finditer(t)]


def script_numbers(script):
    """Numbers spoken in the voiceover script: [(value, tolerance)]. Tolerance follows the script's
    own precision: saying "fifteen times" matches on-screen 15.2; saying "fifteen point two"
    requires exactly 15.2 on screen."""
    s = SRT_NOISE.sub(" ", script)
    have = []
    for m in ARABIC.finditer(s):
        have += scaled(*arabic(m.group(0)), s[m.end():])
    for m in CN_NUM.finditer(s):
        for v, d in cn_values(m.group(0)):
            have += scaled(v, d, s[m.end():])
            if s[m.end():m.end() + 1] == "成": have.append((v * 10, d - 1))     # "liu cheng" = 60%
    return {(round(v, 6), 0.5 * 10.0 ** -d + 1e-9) for v, d in have}


def number_in(vals, have):
    return any(abs(x - v) <= tol for x, _ in vals for v, tol in have)


def lint(text, script=None):
    """Returns a dict: rows (per-row results), table (whole-table results), verdict, summary.
    script: full voiceover script text (optional); check 9 runs only when given."""
    head, raw = find_table(text)
    if head is None:
        return {"error": "Shot list not found: need a markdown table whose header has at least a 'Subject' and an 'Action' column (tables inside code fences don't count)."}
    col = columns(head)
    miss = [n for k, n in (("time", "Time"), ("obj", "Subject"), ("act", "Action"), ("cam", "Camera"), ("text", "On-screen text")) if k not in col]
    if miss:
        return {"error": "Shot list missing columns: " + ", ".join(miss) + ". Columns: Time | Subject | Action | Camera | On-screen text | Method."}
    get = lambda cells, k: cells[col[k]] if k in col and col[k] < len(cells) else ""
    rows, table = [], []
    for n, (lineno, cells) in enumerate(raw, 1):
        if all(is_empty(c) for c in cells): continue
        obj, act, cam, txt, how = (get(cells, k) for k in ("obj", "act", "cam", "text", "how"))
        span = parse_span(get(cells, "time"))
        r = {"n": len(rows) + 1, "line": lineno, "obj": clean_cell(obj), "act": clean_cell(act), "cam": clean_cell(cam),
             "text": clean_cell(txt), "how": clean_cell(how), "span": span, "dur": (span[1] - span[0]) if span else None,
             "chars": text_len(txt), "issues": []}
        bad = r["issues"].append
        if is_empty(obj):
            bad((RED, "1 Subject", "Subject is empty", "Name something you can point at in the frame: a person, a hand, a machine, one concrete thing"))
        elif not obj_residue(obj) and EMPTY_SCENE.search(clean_cell(obj)):
            bad((RED, "1 Subject", f"'{r['obj']}' is an empty scene (blank, solid color, black screen); no protagonist in frame", "Even this shot needs a subject doing something; to leave a breath, let the subject hold still or pull out -- don't remove it"))
        elif not obj_residue(obj):
            bad((RED, "1 Subject", f"'{r['obj']}' is not a subject, it is a layout element", "Behind every bullet there is something acting -- draw that thing: 'three reasons' -> three concrete things, one shot each, one action each"))
        if is_empty(act):
            bad((RED, "2 Action", "Action is empty", "Write a verb: falls down, cracks open, drills in, gets cut off"))
        elif not act_residue(act, obj):
            bad((RED, "2 Action", f"'{r['act']}' is only appear/show, there is no action", "Write the subject's own action: where it comes from, where it goes, what it hits, what it becomes"))
        if r["chars"] > 8:
            bad((RED, "3 On-screen text", f"On-screen text is {r['chars']} units, over 8", "Keep one word or half a sentence; hand the rest to the voiceover or captions"))
        r["texty"] = bool(TEXTY.search(r["obj"])) or r["chars"] >= 7 or how_kind(how) == "y5"
        if span is None:
            bad((RED, "6 Duration", f"Cannot read the Time cell '{clean_cell(get(cells, 'time'))}'", "Write it as 0-3 or 0:03-0:07"))
        elif r["dur"] > 8:
            bad((RED, "6 Duration", f"This shot is {r['dur']:g} s, over 8 s", "Split into two or three shots of 2-6 s each; change the picture or the camera move"))
        elif r["dur"] > 6:
            bad((YELLOW, "6 Duration", f"This shot is {r['dur']:g} s (6-8 s allowed only occasionally)", "Split if you can; otherwise make something new happen inside the shot: the subject's next action, pan to the next thing, pull out to see the whole"))
        elif r["dur"] < 2:
            bad((YELLOW, "6 Duration", f"This shot is only {r['dur']:g} s", "Insert shots may be short; if the voiceover cannot finish a sentence here, merge with a neighbor"))
        if is_empty(cam):
            bad((YELLOW, "Camera", "Camera is empty", "Write one of: hold / push in / pull out / pan / smash in / cut"))
        if "tags" in col:
            r["tags"] = tag_count(get(cells, "tags"))
            if r["tags"] > 3:
                bad((YELLOW, "10 Tags", f"This shot carries {r['tags']} tags crowded together", "At most 3 per shot; hand the rest to the voiceover or the next shot; put a tag next to the thing it names, not as a row of glowing pills"))
        rows.append(r)
    if not rows:
        return {"error": "The shot list is empty: one shot per row under the header."}

    # 4 First shot
    f = rows[0]
    if f["texty"]:
        f["issues"].append((RED, "4 Opening", "First shot is text-led (title/word)", "Spend the first 3 s on a small concrete scene: a person or a thing doing one thing related to the topic; give the title one shot later, or not at all"))
    elif f["chars"] >= 4:
        f["issues"].append((YELLOW, "4 Opening", f"First shot already shows {f['chars']} units of text", "Let the picture open the film; keep words for the second shot"))
    # 8 Last shot
    z = rows[-1]
    if len(rows) > 1 and z["texty"]:
        z["issues"].append((RED, "8 Ending", "Last shot is text-led (centered quote card / pure text card)",
                            "End on the subject doing one action: into the pocket, close the book, pull out to see the whole; words may sit on a thing inside the frame, not on a standalone card"))
    # 11 Standalone number cards in the middle: a number on its own solid-color card reads as
    # "a PPT slide got inserted" in blind reviews, over and over.
    for r in rows[1:-1]:
        if r["texty"] and screen_numbers(r["text"]):
            r["issues"].append((YELLOW, "11 Number card", "This shot is a standalone number card",
                                "Smash the number onto a thing in the world: a phone screen, a battery bar, a price tag, a blackboard, paper; never a big-text card on a solid background"))
    # 9 On-screen numbers vs the script
    if script is not None:
        have = script_numbers(script)
        for r in rows:
            miss = [tok for tok, vals in screen_numbers(r["text"]) if not number_in(vals, have)]
            if miss:
                r["issues"].append((RED, "9 Numbers", f"On-screen number(s) {' / '.join(miss)} not found in the script; on-screen numbers and voiceover disagree",
                                    "Check the data source and change the on-screen text to the number the voiceover says (or change the voiceover); both sides must be the same number"))
    # 7 Three consecutive shots with the same camera
    for k in range(2, len(rows)):
        c = rows[k]["cam"]
        if c and not is_empty(c) and c.lower() not in ("hold", "pan") and c == rows[k - 1]["cam"] == rows[k - 2]["cam"]:   # hold may repeat; panning across items on a desk is also normal
            alt = " / ".join(w for w in ("hold", "push in", "pull out", "pan", "cut") if w.lower() != c.lower())
            rows[k]["issues"].append((YELLOW, "7 Camera", f"Three consecutive shots are all '{c}'", f"Change the middle one: {alt}; choose by what the audience should look at in that shot"))
    # 15 Three consecutive shots all pushing in: one push per shot makes the whole film a series of
    # zoom-ins (2026-10-12 Nobel short film: ~48 push-ins over 102 s, judged "too many, too fast, not smooth").
    inward = [any(w in r["cam"].lower() for w in CAM_IN) and "pull" not in r["cam"].lower() and "out" not in r["cam"].lower() for r in rows]
    for k in range(2, len(rows)):
        if inward[k] and inward[k - 1] and inward[k - 2] and not any(i[1] == "7 Camera" for i in rows[k]["issues"]):
            rows[k]["issues"].append((YELLOW, "15 Push in", "Three consecutive shots all pushing in", "After pushing in, come back out: hold, pull out, pan, or hard-cut to a different framing; if the footage itself moves, hold still"))
    # Time-span continuity
    for k in range(1, len(rows)):
        a, b = rows[k - 1]["span"], rows[k]["span"]
        if a and b and abs(b[0] - a[1]) > 0.05:
            rows[k]["issues"].append((YELLOW, "Time", f"Previous shot ends at {a[1]:g}s, this one starts at {b[0]:g}s", "Make the spans contiguous, or mark the empty shot explicitly"))

    n = len(rows)
    texty = [r["n"] for r in rows if r["texty"]]
    if len(texty) / n > 0.30:
        table.append((RED, "5 Text share", f"Text-led shots {len(texty)}/{n} ({len(texty) / n:.0%}), over 30%: shots {', '.join(map(str, texty))}",
                      "Turn half of them into a thing doing something; hand the words to the voiceover and captions"))
    long_ = [r["n"] for r in rows if r["dur"] and 6 < r["dur"] <= 8]
    if len(long_) > max(1, n // 5):
        table.append((RED, "6 Duration", f"{len(long_)} shots run 6-8 s (shots {', '.join(map(str, long_))}); only the occasional one is allowed",
                      "Split them; every shot 2-6 s"))
    if not any(any(w in r["cam"].lower() for w in CAM_MOVE) for r in rows):
        table.append((YELLOW, "Camera", "No camera movement anywhere in the table, only hold and cut", "The delivery gate measures motion inside the shot; all-hold usually means red; add push in, pan or pull out where you want to steer the eye (the subject's own motion also counts)"))
    acc = [r["n"] for r in rows if any(w in r["cam"].lower() for w in CAM_ACCENT)]
    if n >= 6 and len(acc) * 3 > n:
        table.append((YELLOW, "16 Accents", f"Fast push / smash in / whip on {len(acc)}/{n} shots (shots {', '.join(map(str, acc))}); too many accents leaves none",
                      "Reserve them for reveals, reversals and the key number; change the rest to push in, pan, pull out or hold"))
    total = sum(r["dur"] or 0 for r in rows)
    if "how" in col:
        clips = {}
        for r in rows:
            c = clip_name(r["how"])
            if c: clips.setdefault(c, []).append(r)
        for c, rs in clips.items():
            s = sum(r["dur"] or 0 for r in rs)
            if s > 8:
                table.append((RED, "Method", f"Parameterized clip {c} runs {s:g} s (shots {', '.join(str(r['n']) for r in rs)})",
                              "One parameterized clip lasts at most 8 s; longer reads as a PPT page; split into several specs and change the approach in between"))
        grams = sorted({k for k in (how_kind(r["how"]) for r in rows) if k and GRAMMAR.fullmatch(k)})
        if len(grams) > 2:
            table.append((RED, "Method", f"{len(grams)} clip grammars used ({', '.join(grams)}); spliced together that is several art styles",
                          "One film uses at most 2 clip grammars and every spec shares one theme; draw the other shots with scenes on the same palette, or fill the frame with real assets"))
        empty_how = [r["n"] for r in rows if how_kind(r["how"]) is None]
        if empty_how:
            table.append((YELLOW, "Method", f"Shots {', '.join(map(str, empty_how))} have no Method written", "Write which grammar's clip (shotNN.json), scenes/<id>.js, or an asset"))
    else:
        table.append((YELLOW, "Method", "No 'Method' column: cannot check how long one clip runs or how many grammars are used", "Add a column: y2 clip shot01.json / scenes/<id>.js / asset photo"))

    # 12-14 Style lock: one visual language for the whole film, palette out of blue-purple,
    # characters either detailed or faceless
    lock = read_lock(text, raw[0][0] - 2 if raw else None)
    miss = [k for k in ("style", "palette", "character") if not lock.get(k)]
    if miss:
        table.append((RED, "12 Style lock", f"Above the table, missing '{', '.join(miss)}'", "Write three lines above the table -- Style: one sentence, the only one for the film; Palette: a palette name or 3-6 hex colors (references/palettes.md); "
                      "Character: none / hands and backs only / frames <path> (references/character-fidelity.md)"))
    pal = lock.get("palette", "")
    if pal:
        hexes = HEX.findall(pal)
        named = any(nm in pal.lower() for nm in PALETTES)
        bp = [f"#{h}" for h in hexes if blue_purple_hex(h)]
        if bp:
            table.append((YELLOW if lock.get("allow blue-purple") else RED, "13 Palette", f"Blue-purple in the palette: {', '.join(bp)}" + (" (a reason for blue-purple is written)" if lock.get("allow blue-purple") else ""),
                          "Switch to a set from references/palettes.md, or move these colors out of hue 225-300; write 'Allow blue-purple: reason' only when the user explicitly asks for blue-purple"))
        if len(hexes) > 6:
            table.append((YELLOW, "13 Palette", f"The palette has {len(hexes)} colors", "One film uses 3-6 colors: ground, surface, primary text, secondary text, one or two accents"))
        if not hexes and not named:
            table.append((YELLOW, "13 Palette", f"Palette '{pal}' is neither a palette name nor hex colors", "Write a name from references/palettes.md, or 3-6 #hex values"))
    ch = lock.get("character", "")
    frames = bool(ch and CHAR_FRAMES.search(ch))
    # Only the explicitly selected, documented flat-character routes; y4 still needs frames.
    flat_svg = bool(FLAT_STYLE.search(lock.get("style", ""))
                    and ch.lower().startswith("original semantic svg")
                    and not re.search(r"live[- ]action|photoreal|realistic", ch, re.I))
    if ch and CHAR_BAD.search(ch) and not (frames or flat_svg):
        table.append((RED, "14 Character", f"Character says '{ch}': code-drawn people and robots are retired", "With image generation, use AI-generated frames (references/10-characters.md); without, hands, backs, silhouettes, or no people at all"))
    for r in rows:
        if OBJ_CHAR.search(r["obj"]) and not (frames or flat_svg):
            r["issues"].append((RED, "14 Character", f"Subject contains '{OBJ_CHAR.search(r['obj']).group(0)}' but the character row is not a frame library",
                                "Swap this shot to a hand, a back view or a thing; to show a character, build the frame library first per references/character-fidelity.md"))
        if OBJ_FACE.search(r["obj"] + r["act"]):
            r["issues"].append((YELLOW, "14 Character", "Coins, balls, ions and the like were given a face", "Draw a thing as a thing: speak through shape, color and motion, no facial expressions"))
        if how_kind(r["how"]) == "y4" and not frames:
            r["issues"].append((RED, "14 Character", "y4 needs a character frame library but the Character row is not one", "Switch to y2/y5 or scenes and tell it with hands and things; with image generation, build the frame library first"))

    issues = [x for r in rows for x in r["issues"]] + table
    verdict = RED if any(x[0] == RED for x in issues) else YELLOW if issues else GREEN
    numbered = [r["n"] for r in rows if screen_numbers(r["text"])]
    return {"rows": rows, "table": table, "verdict": verdict, "total": total, "texty": texty,
            "script": script is not None, "numbered": numbered}


def report(res):
    if "error" in res: return [res["error"]]
    L = []
    for r in res["rows"]:
        light = RED if any(x[0] == RED for x in r["issues"]) else YELLOW if r["issues"] else GREEN
        span = f"{r['span'][0]:g}-{r['span'][1]:g}s" if r["span"] else "?"
        L.append(f"[{light}] shot {r['n']}  {span:<10} {r['obj'][:18]}")
        for lv, tag, what, fix in r["issues"]:
            L.append(f"      [{lv}] {tag}: {what}. Fix: {fix}")
    L.append("")
    L.append(f"Table: {len(res['rows'])} shots, {res['total']:g} s, {len(res['texty'])} text-led")
    for lv, tag, what, fix in res["table"]:
        L.append(f"  [{lv}] {tag}: {what}. Fix: {fix}")
    L.append("")
    L.append({RED: "Verdict: red. Fix the shot list and rerun this command; do not start writing code before the reds are clear.",
              YELLOW: "Verdict: yellow. You may start; think through each yellow and write the reason into delivery-notes.md.",
              GREEN: "Verdict: green. You may start."}[res["verdict"]])
    if not res.get("script") and res.get("numbered"):
        L.append(f"Shots {', '.join(map(str, res['numbered']))} carry on-screen numbers: add --script script.txt to verify they match the voiceover.")
    L.append("What the machine cannot check, you must: one concrete example carried through the film; one art style throughout; adjacent shots differ in composition; the first 3 s are a small scene, not the title.")
    return L


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if any(a in ("-h", "--help") for a in argv):
        print(__doc__); return 0
    sp = None
    if "--script" in argv:
        k = argv.index("--script")
        if k + 1 >= len(argv):
            print("--script must be followed by the script file path", file=sys.stderr); return 2
        sp = Path(argv[k + 1]); del argv[k:k + 2]
    if len(argv) != 1:
        print(__doc__); return 2
    p = Path(argv[0])
    try:
        text = p.read_text(encoding="utf-8")
        script = sp.read_text(encoding="utf-8") if sp else None
    except OSError as e:
        print(f"Cannot read {e.filename}: {e.strerror}", file=sys.stderr); return 2
    res = lint(text, script)
    print("\n".join(report(res)))
    if "error" in res: return 2
    return 1 if res["verdict"] == RED else 0


if __name__ == "__main__":
    sys.exit(main())
