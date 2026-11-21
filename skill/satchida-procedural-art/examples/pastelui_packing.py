"""Example (pastel UI): Pack Check — one frame of a product film in the pastel-UI look.

A flat pastel field with a soft pool of light and bokeh; a section pill and a step strip (Documents -> Chargers -> Rain gear -> Go);
a heavy headline with a marker stroke under the key words. A macOS window card, "Packing List · Kyoto, 4 days": on the left
the trip (destination, dates, a four-day forecast, a packing progress bar), on the right the packing assistant's
note, written line by line, with an inline reference chip, green markers under what is packed and a pink highlight
on the one thing that is not -- "light rain in Kyoto on Monday", with an "umbrella not packed" callout. Beside it a checklist panel, "Before you leave":
three rows, two pass with a green check, the third (rain gear) fails with a pink cross, and the verdict "still missing an umbrella".
A magnifier rests on Monday's rain cloud in the forecast, magnifying the real pixels. Three flat companions peek
over the card edges: a violet cloud with a >_ prompt behind the window, a starburst in a cream circle behind the
panel, and the orange pixel critter standing on the panel. No image model.
python3 pastelui_packing.py [out.jpg] [--stages DIR] [--field blue|mint|peach|...]
"""
import os, sys, time
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
from pastelui import PastelUI, Box, INK, BLUE, LILAC, GREEN, PINK, YELLOW, LINE, GREY, WHITE

out = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'pastelui_packing.jpg'
stages = sys.argv[sys.argv.index('--stages') + 1] if '--stages' in sys.argv else None
FIELD = sys.argv[sys.argv.index('--field') + 1] if '--field' in sys.argv else 'blue'
T0 = time.time()
tick = lambda name: print(f'{name:14s} {time.time() - T0:5.1f}s') if os.environ.get('PASTELUI_TIMING') else None

ui = PastelUI(1920, 1080, seed=4, keep_stages=bool(stages))
ui.field(FIELD, glow=(520, 150))

# ===================================================================== layout
WX, WY, WW, WH, SPLIT, BAR = 120, 300, 1090, 600, 400, 54          # window body
PX, PY, PW, PH = 1290, 352, 510, 548                                  # checklist panel
LX0, LX1 = WX + 30, WX + SPLIT - 30                                   # left pane content
RX0, RX1 = WX + SPLIT + 44, WX + WW - 36                              # right pane content
TX, TY0, TLH, TS = RX0, 522, 72, 32                                   # reply text: x, first baseline, line height, size
LINE_Y = [TY0 + i * TLH for i in range(5)]
WEEK = [('Sun', 'partly', '22°'), ('Mon', 'rain', '18°'), ('Tue', 'sun', '23°')]
WXC = Box(LX0 - 2, 546, LX1 + 2, 794, 18)                             # forecast card
COLW = WXC.w / 3
ICON_Y = WXC.y0 + 152
RAIN = (WXC.x0 + COLW * 1.5, ICON_Y)                                  # Monday's icon centre

# ===================================================================== companions behind the cards (drawn first, low z)
ui.layer('cloud', z=5)
ui.cloud(1096, WY - 120 * 0.84 + 60, 120, rot=-4)
ui.layer('spark', z=5)
ui.spark(1470, PY - 124 * 0.8 + 62, 124, spin=8)

# ===================================================================== title: pill, step strip, headline + marker
ui.layer('pill', z=20)
PILL_X1 = ui.pill(120, 112, 'Trip list')
STEPS = ['Documents', 'Chargers', 'Rain gear', 'Go']
for k, cur in [(0, None), (1, 0), (2, 1), (3, 2)]:
    ui.layer(f'steps{k}', z=20)
    ui.steps(PILL_X1 + 26, 112, STEPS, lit=k, current=cur)
HEAD = 'One more check before you go'
ui.layer('mark', z=19)
_, span = ui.headline(116, 236, HEAD, 76, mark='before you go', draw_text=False)
ui.layer('headline', z=20)
ui.headline(116, 236, HEAD, 76, mark='before you go', draw_mark=False)
tick('title')

# ===================================================================== the window
ui.layer('window', z=10)
win = ui.window(WX, WY, WW, WH, title='Packing List', icon='suitcase', sub='· Kyoto, 4 days', split=SPLIT, bar=BAR)

# left pane: trip, forecast, progress
ui.layer('trip', z=12)
y = WY + BAR + 36
ui.glyph('pin', LX0 + 9, y, 19, '#7d8796', 1.9)
ui.text('Destination', LX0 + 26, y, 17, '#6a7482', 'bold', 'lm', spacing=1)
ui.text('10/12 – 10/15', LX1, y, 15, '#9aa3af', 'regular', 'rm', family='mono')
ui.text('Kyoto', LX0, y + 84, 50, '#18202b', 'heavy')
ui.chip(LX1, y + 84 - 50 * 0.37, 'Leave tomorrow', BLUE, size=16, solid=True, anchor='r')
ui.text('4 days, 3 nights · 1 carry-on', LX0, y + 122, 18, '#8a94a3')
ui.shadow(*WXC, WXC.r, 0, 10, 22, -16, '#143c78', 0.45)
ui.rrect(*WXC, WXC.r, WHITE)
ui.rrect(*WXC, WXC.r, '#e2e8f0', ring=1.0)
ui.tile(WXC.x0 + 18, WXC.y0 + 16, 30, YELLOW, 'sun', radius=9, glyph_size=19, sw=2.2, shadow=False)
ui.text('Forecast', WXC.x0 + 58, WXC.y0 + 31, 18, '#1f2733', 'bold', 'lm')
for i, (d, kind, t) in enumerate(WEEK):
    cx = WXC.x0 + COLW * (i + 0.5)
    ui.text(d, cx, ICON_Y - 66, 17, '#8a94a3', 'regular', 'mm')
    ui.weather(kind, cx, ICON_Y, 50)
    ui.text(t, cx, ICON_Y + 76, 22, '#2b3442', 'bold', 'ms')
py = WXC.y1 + 50
ui.text('Packed', LX0, py, 17, '#8a94a3', 'regular', 'ls')
ui.text('11 / 12', LX1, py, 19, '#2b3442', 'bold', 'rs', family='mono')
ui.bar(LX0, LX1, py + 24, 11 / 12, BLUE, 8)
ui.layer('wx_hl', z=13)                                          # Monday, after the check
hx0, hx1 = WXC.x0 + COLW + 6, WXC.x0 + COLW * 2 - 6
ui.rrect(hx0, WXC.y0 + 58, hx1, WXC.y1 - 10, 16, PINK, 0.08)
ui.rrect(hx0, WXC.y0 + 58, hx1, WXC.y1 - 10, 16, PINK, 0.85, ring=2.0)
tick('left pane')

# right pane: the assistant's note
ui.layer('reply_head', z=12)
hy = WY + BAR + 44
ui.tile(RX0, hy - 23, 46, grad=('#63b6ff', '#1f8ff0'), glyph='suitcase', radius=14, glyph_size=25)
ui.text('Packing assistant', RX0 + 60, hy - 5, 20, '#1f2733', 'bold')
ui.circle(RX0 + 64, hy + 16, 3.5, '#28c840')
ui.text('List ready · 12 items', RX0 + 74, hy + 16, 15, '#8a94a3', 'regular', 'lm')
ui.rrect(RX0, hy + 44, RX1, hy + 45, 0, LINE)
for name, txt, col in [('chip_draft', 'Draft list', '#8a94a3'), ('chip_check', 'Checking', LILAC), ('chip_fail', '1 item missing', PINK)]:
    ui.layer(name, z=12)
    ui.chip(RX1, hy - 4, txt, col, size=16, anchor='r')

ui.layer('line0', z=14)
ui.text('Leaving tomorrow morning -- here is the check:', TX, LINE_Y[0], TS, '#232a35')
ui.layer('line1', z=14)
x = ui.ref_chip(TX, LINE_Y[1], 'document wallet', glyph='passport', size=26)
ui.text(' has your passport and tickets;', x + 12, LINE_Y[1], TS, '#232a35')
ui.layer('line2_mk', z=13)
w = ui.measure('charger and travel adapter', TS)
ui.marker(TX, TX + w, LINE_Y[2], 13, '#a6e6bd', 0.85, drop=7)
ui.layer('line2', z=14)
ui.text('The charger and travel adapter are packed,', TX, LINE_Y[2], TS, '#232a35')
ui.layer('line3_hl', z=13)
w3 = ui.measure('light rain in Kyoto on Monday', TS)
ui.marker(TX, TX + w3, LINE_Y[3], 40, '#ffbdd5', 0.95, drop=7)
ui.layer('line3', z=14)
W3 = ui.text('light rain in Kyoto on Monday,', TX, LINE_Y[3], TS, '#232a35')
ui.layer('line3_tag', z=15)
ui.callout(TX + W3 + 14, LINE_Y[3] - TS * 0.37, 'umbrella not packed', PINK, glyph='umbrella', size=19)
ui.layer('line4', z=14)
ui.text('Have a good trip!', TX, LINE_Y[4], TS, '#6b7482')
tick('right pane')

# ===================================================================== the checklist panel
ui.layer('panel', z=30)
card = ui.card(PX, PY, PW, PH)
ui.text('Before you leave', PX + 30, PY + 66, 36, '#141a24', 'heavy')
ui.mono_tag(PX + PW - 30, PY + 50, 'CHECK')
ui.text('Three things, one glance each', PX + 30, PY + 104, 18, '#6b7686')
ui.rrect(PX + 30, PY + PH - 104, PX + PW - 30, PY + PH - 103, 0, LINE)
ui.text('This suitcase', PX + 30, PY + PH - 66, 16, '#8a94a3')
ROWS = [('Documents', 'Must bring', 'Passport, tickets', 'passport', BLUE, 'pass', 'All set'),
        ('Chargers', 'Must bring', 'Charger, travel adapter', 'plug', BLUE, 'pass', 'All set'),
        ('Rain gear', 'Check weather', 'Rain on Monday', 'umbrella', LILAC, 'fail', 'Missing')]
RH, RG, RY0 = 100, 14, PY + 128
for i, (lab, tag, sub, gl, tone, res, txt) in enumerate(ROWS):
    ry = RY0 + i * (RH + RG)
    states = ['idle', res] + (['active'] if res == 'fail' else [])
    for st in states:
        ui.layer(f'row{i}_{st}', z=31)
        ui.check_row(PX + 30, ry, PW - 60, RH, lab, tag=tag, sub=sub, glyph=gl, tone=tone, state=st,
                     status=(st != res), progress=0.62)
    ui.layer(f'row{i}_st', z=32)
    ui.row_status(PX + PW - 48, ry + RH / 2, res, txt, tone, RH)
ui.layer('verdict', z=32)
ui.text('Still missing an umbrella', PX + 30, PY + PH - 32, 24, '#1b2230', 'bold')
ui.chip(PX + PW - 30, PY + PH - 50, 'Not packed', PINK, size=21, solid=True, glyph='x', anchor='r', pad=16)
ui.layer('verdict_wait', z=32)
ui.text('Waiting for check', PX + PW - 30, PY + PH - 50, 16, '#a3acb8', 'regular', 'rm')
tick('panel')

# ===================================================================== the critter on the panel, the magnifier
ui.layer('critter', z=35)
ui.critter(1650, PY - 54 + 1, 9)
ui.magnifier(RAIN[0], RAIN[1], 47, 1.42, z=40, handle=58)
ui.end()
tick('drawn')

# ===================================================================== stage by stage (the draw-on GIF), then the final frame
# Things that move get a few in-between poses (stage names 'mv_*': the GIF shows them as quick hard cuts, i.e. real
# motion); everything else cross-fades from stage to stage.
ALL = list(ui.layers)
ease_out = lambda u: 1 - (1 - u) ** 3
ease_back = lambda u: 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2          # overshoots ~6 % and settles
ease_io = lambda u: 3 * u * u - 2 * u ** 3
REST = dict(dx=0.0, dy=0.0, scale=1.0, alpha=1.0, reveal=1.0)


def move(names, frm, to=REST, n=5, tag='', ease=ease_out, last=True, origin=None, between=None):
    """pose one or more layers from `frm` to `to` over n stages; the last stage is named `tag`"""
    names = [names] if isinstance(names, str) else names
    for k in range(1, n + 1):
        u = ease(k / n)
        p = {key: frm.get(key, REST[key]) + (to.get(key, REST[key]) - frm.get(key, REST[key])) * u for key in REST}
        p['alpha'] = min(1.0, max(0.0, p['alpha']))
        if between: between(p, k / n)
        for nm in names: ui.pose(nm, origin=origin, **p)
        if k < n: ui.stage(f'mv_{tag}{k}')
        elif last: ui.stage(tag)


def pop(name, tag, cx, cy):
    move(name, dict(scale=0.3, alpha=0.0), n=4, tag=tag, ease=ease_back, origin=(cx, cy))


if stages:
    for n in ALL: ui.hide(n)
    for r in (0, 170, 400, 690, 1030):
        ui.wipe(1010, 560, r, prev='lilac', rim_width=26 * (1 - 0.5 * r / 1030)); ui.stage(f'wipe{r:04d}')
    ui.wipe(); ui.stage('field')
    move('window', dict(dy=80, scale=0.96, alpha=0.0), n=6, tag='window', ease=ease_back)
    ui.show('pill', 'steps0'); ui.stage('pill')
    ui.show('headline'); ui.stage('headline')
    move('mark', dict(reveal=0.0), n=4, tag='mark')
    ui.show('trip'); ui.stage('trip')
    ui.show('reply_head', 'chip_draft'); ui.stage('reply_head')
    for nm in ['line0', 'line1', 'line2', 'line3', 'line4']:
        group = [nm, 'line2_mk'] if nm == 'line2' else [nm]
        move(group, dict(reveal=0.0), n=4, tag=nm, ease=ease_io)
    move('panel', dict(dy=70, scale=0.96, alpha=0.0), n=6, tag='panel', ease=ease_back)
    ui.show('row0_idle', 'row1_idle', 'row2_idle', 'verdict_wait'); ui.stage('rows')
    for i in range(2):
        cy = RY0 + i * (RH + RG) + RH / 2
        ui.hide(f'row{i}_idle', f'steps{i}'); ui.show(f'row{i}_pass', f'steps{i + 1}')
        pop(f'row{i}_st', f'check{i}', PX + PW - 110, cy)
    # the third row starts checking: the lens leaves its row, flies over to the forecast and settles on Monday
    ui.hide('row2_idle', 'chip_draft'); ui.show('row2_active', 'chip_check'); ui.stage('row2_active')
    lx, ly = PX + 90 - RAIN[0], RY0 + 2 * (RH + RG) + RH / 2 - RAIN[1]
    move('lens', dict(dx=lx, dy=ly, scale=0.3, alpha=0.0), n=7, tag='lens', ease=ease_io,
         between=lambda p, u: p.update(dy=p['dy'] - 220 * np.sin(np.pi * u), alpha=min(1, 4 * u)))
    ui.hide('row2_active', 'chip_check', 'steps2'); ui.show('row2_fail', 'chip_fail', 'wx_hl', 'line3_hl', 'steps3')
    pop('row2_st', 'check2', PX + PW - 110, RY0 + 2 * (RH + RG) + RH / 2)
    pop('line3_tag', 'tag', TX + W3 + 14, LINE_Y[3] - TS * 0.37)
    ui.hide('verdict_wait'); ui.show('verdict'); ui.stage('verdict')
    move('cloud', dict(dy=150, alpha=1.0), n=5, tag='cloud', ease=ease_back)
    move('spark', dict(dy=150, alpha=1.0), n=5, tag='spark', ease=ease_back)
    move('critter', dict(dy=-110, alpha=0.0), n=4, tag='critter', ease=ease_back, last=False)

# final poses: everything finished
for n in ALL:
    ui.pose(n)
for n in ['steps0', 'steps1', 'steps2', 'chip_draft', 'chip_check', 'verdict_wait',
          'row0_idle', 'row1_idle', 'row2_idle', 'row2_active']:
    ui.hide(n)
ui.save(out, stages_dir=stages)
tick('saved')
print('saved', out)
