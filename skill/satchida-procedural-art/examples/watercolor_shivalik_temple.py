"""Example (watercolour): Misty Shivalik Dawn — rustic Hindu stone temple on rocky lake promontory,
Kashmiri Shikara wooden boats on calm water, pine-covered mountain ridges, birds soaring in sky.
Pure NumPy + Pillow code, zero image model.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
import numpy as np
from PIL import Image, ImageDraw
from watercolor import Watercolor, hexc
from core import blob_pts, spline, curve, noise2d

out = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'watercolor_shivalik_temple.png'
stages = sys.argv[sys.argv.index('--stages') + 1] if '--stages' in sys.argv else None

seed = 1017
if 'SATCHIDA_SEED' in os.environ:
    try: seed = int(os.environ['SATCHIDA_SEED'])
    except: pass

p = Watercolor(1920, 1080, seed=seed)
p.paper()
p.stage('paper')
rng = p.rng
Y0 = 610  # Waterline

# -----------------------------------------------------------------------------
# 1. Atmospheric Sky & Opaque Shivalik Mountain Ridges (Layered Depth)
# -----------------------------------------------------------------------------
# Soft dawn atmospheric sky wash (indigo at top, warm amber-mist at horizon)
p.gradient_wash(0, Y0, top=hexc('#2a3752'), bottom=hexc('#edd8c2'), strength=0.62, soft_bottom=45, gran=0.35)

# Far majestic crests (solid opaque underlay + soft indigo watercolor glaze)
crest_pts = [(0, Y0)] + [
    (x, 240 - 85 * np.sin(x / 420) - 45 * np.cos(x / 210 + 0.5) - rng.uniform(0, 12))
    for x in np.linspace(0, 1920, 60)
] + [(1920, Y0)]
m_crest = p.shape(crest_pts, soft=16, ragged=0.3)
crest_col = hexc('#55627d')
p.img = p.img * (1 - m_crest[..., None]) + m_crest[..., None] * crest_col
p.glaze(m_crest, hexc('#3c4962'), 0.45, edge=0.25, gran=0.45)

# Mid-distance mountain ridges with soft mist bands
ridge_pts = [(0, Y0)] + [
    (x, 370 - 70 * np.sin(x / 280 + 1.1) - 30 * np.cos(x / 130) - rng.uniform(0, 10))
    for x in np.linspace(0, 1920, 60)
] + [(1920, Y0)]
m_ridge = p.shape(ridge_pts, soft=10, ragged=0.35)
ridge_col = hexc('#3a4959')
p.img = p.img * (1 - m_ridge[..., None]) + m_ridge[..., None] * ridge_col
p.glaze(m_ridge, hexc('#243242'), 0.55, edge=0.35, gran=0.45)

# Near Shivalik forested slope descending from left and right
slope_left = [(0, Y0)] + [
    (x, 460 + 55 * np.sin(x / 300) - 110 * np.exp(-x / 500) - rng.uniform(0, 8))
    for x in np.linspace(0, 1100, 40)
] + [(1100, Y0)]
m_sleft = p.shape(slope_left, soft=8, ragged=0.3)
sleft_col = hexc('#26343f')
p.img = p.img * (1 - m_sleft[..., None]) + m_sleft[..., None] * sleft_col
p.glaze(m_sleft, hexc('#1c2730'), 0.65, edge=0.35, gran=0.4)

slope_right = [(900, Y0)] + [
    (x, 490 - 65 * np.exp((x - 1920) / 450) + 20 * np.sin(x / 180) - rng.uniform(0, 8))
    for x in np.linspace(900, 1920, 40)
] + [(1920, Y0)]
m_sright = p.shape(slope_right, soft=8, ragged=0.3)
sright_col = hexc('#2b3944')
p.img = p.img * (1 - m_sright[..., None]) + m_sright[..., None] * sright_col
p.glaze(m_sright, hexc('#1e2932'), 0.60, edge=0.35, gran=0.4)

# Multi-layered Himalayan Pine / Deodar clusters planted ON mountain ridges (single fast vector pass)
pine_im = Image.new("L", (1920, 1080), 0)
draw = ImageDraw.Draw(pine_im)

def plant_pine(px, py, h, w):
    draw.line([(px, py), (px, py - h * 0.95)], fill=255, width=max(2, int(w * 0.12)))
    tiers = int(rng.integers(5, 8))
    for i in range(tiers):
        ty = py - h * (0.28 + 0.68 * (i / tiers))
        tw = w * (1.0 - 0.72 * (i / tiers))
        th = h * 0.20
        poly = [
            (px - tw, ty + th * 0.5), (px, ty - th * 0.5), (px + tw, ty + th * 0.5),
            (px, ty + th * 0.2)
        ]
        draw.polygon(poly, fill=255)

for px in np.linspace(40, 1880, 56):
    if 300 < px < 660:  # Reserve temple promontory clearing
        continue
    if px < 900:
        base_h = 460 + 55 * np.sin(px / 300) - 110 * np.exp(-px / 500)
    else:
        base_h = 490 - 65 * np.exp((px - 1920) / 450) + 20 * np.sin(px / 180)
    py = float(base_h + rng.uniform(-10, 40))
    if py > Y0 - 15:
        py = Y0 - 15  # Above waterline
    ph = rng.uniform(55, 105)
    pw = ph * rng.uniform(0.28, 0.40)
    plant_pine(px, py, ph, pw)

pine_arr = np.array(pine_im, dtype=np.float32) / 255.0
p_pine = p.soften(pine_arr, soft=1.5, ragged=0.15)
pine_base_col = hexc('#14211a')
p.img = p.img * (1 - p_pine[..., None]) + p_pine[..., None] * pine_base_col
p.glaze(p_pine, hexc('#0d1712'), 0.75, edge=0.4, gran=0.35)

p.stage('mountains_and_pines')

# -----------------------------------------------------------------------------
# 2. Calm Lake Surface & Soft Reflected Mountain Haze
# -----------------------------------------------------------------------------
water = np.clip((p.YY - Y0) / 4, 0, 1)
p.glaze(water * np.clip(0.38 + (p.YY - Y0) / 480, 0, 1), hexc('#314457'), 0.62, edge=0.06, gran=0.38, variation=0.28)
p.glaze(p.mirror(m_sleft, Y0, soft=12, breakup=0.5), hexc('#233544'), 0.32, edge=0.1)
p.glaze(p.mirror(m_sright, Y0, soft=12, breakup=0.5), hexc('#283b4c'), 0.30, edge=0.1)

shore_mist = np.exp(-((p.YY - (Y0 + 12)) / 35.0) ** 2) * (0.6 + 0.4 * noise2d(p.H, p.W, 140, 3, seed + 1))
p.lift(shore_mist, 0.42)

p.stage('lake')

# -----------------------------------------------------------------------------
# 3. Grounded Promontory & Rustic Stone Hindu Temple (Nagari Shikhara Style)
# -----------------------------------------------------------------------------
TX, TY = 480, Y0 - 20

# Solid rocky lake promontory / shoreline terrain extending out from the left bank
promontory_pts = [
    (180, Y0 + 15), (320, Y0 - 45), (460, Y0 - 55), (600, Y0 - 40),
    (630, Y0 + 20), (520, Y0 + 35), (300, Y0 + 30), (180, Y0 + 20)
]
m_prom = p.shape(promontory_pts, soft=3.0, ragged=0.25)
prom_col = hexc('#3d342c')
p.img = p.img * (1 - m_prom[..., None]) + m_prom[..., None] * prom_col
p.glaze(m_prom, hexc('#261f18'), 0.75, edge=0.5, gran=0.45)
for rk in range(8):
    rx0 = 220 + rk * 45
    p.line([(rx0, Y0 - 30 + rk * 6), (rx0 + 35, Y0 + 10 + rk * 4)], width=2.0, colour=hexc('#1e1711'), strength=0.7)

# Stone stepped ghat plinth on the promontory
ghat_contour = [
    (TX - 110, TY + 15), (TX + 110, TY + 15),
    (TX + 95, TY + 45), (TX - 95, TY + 45)
]
m_ghat = p.shape(ghat_contour, soft=1.8)
ghat_col = hexc('#483a2f')
p.img = p.img * (1 - m_ghat[..., None]) + m_ghat[..., None] * ghat_col
p.glaze(m_ghat, hexc('#33261c'), 0.88, edge=0.5, gran=0.45)
for gy in [TY + 15, TY + 25, TY + 35, TY + 45]:
    p.line([(TX - 105 + (gy - TY) * 0.3, gy), (TX + 105 - (gy - TY) * 0.3, gy)], width=1.5, colour=hexc('#2a211b'), strength=0.7)

# Main Temple Shikhara Sanctuary Architecture
spire_left, spire_right = [], []
base_y = TY + 15
apex_y = TY - 230
for t_val in np.linspace(0, 1, 35):
    cy = base_y - (base_y - apex_y) * t_val
    half_w = 68 * ((1 - t_val) ** 0.65) + 6
    spire_left.append((TX - half_w, cy))
    spire_right.append((TX + half_w, cy))
spire_contour = spire_left + spire_right[::-1]

m_spire = p.shape(spire_contour, soft=2.2, ragged=0.15)
spire_base_col = hexc('#523926')
p.img = p.img * (1 - m_spire[..., None]) + m_spire[..., None] * spire_base_col
p.glaze(m_spire, hexc('#6b472e'), 0.88, edge=0.55, gran=0.52)

# Sunlit side glaze (warm golden ochre on left face)
sun_face = [(TX - 68, base_y), (TX - 8, apex_y), (TX + 2, apex_y), (TX, base_y)]
p.glaze(p.shape(sun_face, soft=3.0), hexc('#9e6b3c'), 0.5, edge=0.2)

# Spire horizontal bhumi tiers (architectural horizontal stone cornices)
for tier_idx in range(1, 10):
    tier_y = base_y - (base_y - apex_y) * (tier_idx / 11.0)
    w_at = 68 * ((1 - (tier_idx / 11.0)) ** 0.65)
    p.line([(TX - w_at * 0.95, tier_y), (TX + w_at * 0.95, tier_y)], width=1.8, colour=hexc('#382317'), strength=0.65)
    p.line([(TX, tier_y - 8), (TX, tier_y + 4)], width=2.0, colour=hexc('#2f1d13'), strength=0.6)

# Temple mandapa (pillared entry porch with sloping stone roof on right)
mandapa_pts = [
    (TX + 50, TY + 15), (TX + 50, TY - 60),
    (TX + 115, TY - 25), (TX + 115, TY + 15)
]
m_mand = p.shape(mandapa_pts, soft=1.8)
p.img = p.img * (1 - m_mand[..., None]) + m_mand[..., None] * hexc('#4d331f')
p.glaze(m_mand, hexc('#593b26'), 0.90, edge=0.5, gran=0.45)
p.line([(TX + 70, TY + 15), (TX + 70, TY - 40)], width=2.5, colour=hexc('#26170d'), strength=0.8)
p.line([(TX + 98, TY + 15), (TX + 98, TY - 32)], width=2.5, colour=hexc('#26170d'), strength=0.8)

sanctum_pts = [(TX - 18, TY + 15), (TX - 18, TY - 35), (TX + 18, TY - 35), (TX + 18, TY + 15)]
m_sanct = p.shape(sanctum_pts, soft=1.2)
p.img = p.img * (1 - m_sanct[..., None]) + m_sanct[..., None] * hexc('#120a05')

# Amalaka and Kalasha
amalaka = [
    (TX - 16, apex_y), (TX - 20, apex_y - 12), (TX + 20, apex_y - 12), (TX + 16, apex_y)
]
p.glaze(p.shape(amalaka, soft=1.2), hexc('#805333'), 0.92, edge=0.6)
kalasha_pts = [
    (TX - 8, apex_y - 12), (TX - 11, apex_y - 26), (TX, apex_y - 36), (TX + 11, apex_y - 26), (TX + 8, apex_y - 12)
]
p.glaze(p.shape(kalasha_pts, soft=1.2), hexc('#b8860b'), 0.95, edge=0.5)

# Staff & Saffron Temple Flag fluttering gently in mountain breeze
p.line([(TX, apex_y - 36), (TX, apex_y - 68)], width=2.2, colour=hexc('#8b6914'), strength=0.9)
flag_curved = spline([
    (TX, apex_y - 68), (TX + 22, apex_y - 64), (TX + 42, apex_y - 58),
    (TX + 20, apex_y - 52), (TX, apex_y - 48)
], 12)
p.glaze(p.shape(flag_curved, soft=1.2), hexc('#e67e22'), 0.95, edge=0.4)

# Temple shoreline reflection in the lake
temple_full_mask = p.shape(spire_contour + mandapa_pts + ghat_contour + promontory_pts, soft=3.0)
p.glaze(p.mirror(temple_full_mask, TY + 45, soft=9, breakup=0.48), hexc('#382012'), 0.40, edge=0.12)

# Bell ringing bracket with small brass temple bell
p.line([(TX + 45, TY - 65), (TX + 45, TY - 82)], width=1.8, colour=hexc('#26170d'), strength=0.7)
bell_pts = [(TX + 40, TY - 82), (TX + 50, TY - 82), (TX + 53, TY - 92), (TX + 37, TY - 92)]
p.glaze(p.shape(bell_pts, soft=1.0), hexc('#d4af37'), 0.92, edge=0.3)

p.stage('temple')

# -----------------------------------------------------------------------------
# 4. Authentic Kashmiri Shikara Wooden Boats on Calm Water
# -----------------------------------------------------------------------------
def render_kashmiri_shikara(bx, by, scale=1.0, canopy_color='#9e2a2b'):
    hull_pts = spline([
        (bx - 165 * scale, by - 16 * scale),
        (bx - 110 * scale, by - 4 * scale),
        (bx - 40 * scale, by + 18 * scale),
        (bx + 70 * scale, by + 18 * scale),
        (bx + 145 * scale, by - 2 * scale),
        (bx + 175 * scale, by - 22 * scale),
        (bx + 110 * scale, by - 5 * scale),
        (bx - 30 * scale, by - 6 * scale),
        (bx - 120 * scale, by - 12 * scale),
        (bx - 165 * scale, by - 16 * scale)
    ], 12)
    hull_mask = p.shape(hull_pts, soft=1.6, ragged=0.15)
    p.img = p.img * (1 - hull_mask[..., None]) + hull_mask[..., None] * hexc('#361e10')
    p.glaze(hull_mask, hexc('#422716'), 0.95, edge=0.65, gran=0.38)
    
    p.line([
        (bx - 160 * scale, by - 15 * scale),
        (bx - 40 * scale, by - 4 * scale),
        (bx + 80 * scale, by - 4 * scale),
        (bx + 170 * scale, by - 20 * scale)
    ], width=2.0 * scale, colour=hexc('#25140b'), strength=0.85)

    cp_x0 = bx - 60 * scale
    cp_x1 = bx + 55 * scale
    cp_top = by - 56 * scale
    cp_base = by - 10 * scale
    
    p.line([(cp_x0 + 8 * scale, cp_base), (cp_x0 + 12 * scale, cp_top)], width=1.8 * scale, colour=hexc('#2a1a0f'), strength=0.8)
    p.line([(cp_x0 + 35 * scale, cp_base), (cp_x0 + 38 * scale, cp_top)], width=1.5 * scale, colour=hexc('#2a1a0f'), strength=0.7)
    p.line([(cp_x1 - 35 * scale, cp_base), (cp_x1 - 38 * scale, cp_top)], width=1.5 * scale, colour=hexc('#2a1a0f'), strength=0.7)
    p.line([(cp_x1 - 8 * scale, cp_base), (cp_x1 - 12 * scale, cp_top)], width=1.8 * scale, colour=hexc('#2a1a0f'), strength=0.8)

    roof_pts = [
        (cp_x0, cp_top + 8 * scale),
        (bx - 5 * scale, cp_top - 4 * scale),
        (cp_x1, cp_top + 8 * scale),
        (cp_x1 - 5 * scale, cp_top + 18 * scale),
        (cp_x0 + 5 * scale, cp_top + 18 * scale)
    ]
    p.glaze(p.shape(roof_pts, soft=1.4), hexc(canopy_color), 0.90, edge=0.45, gran=0.3)

    curtain_left = [(cp_x0 + 4 * scale, cp_top + 16 * scale), (cp_x0 + 18 * scale, cp_top + 16 * scale), (cp_x0 + 10 * scale, cp_base)]
    curtain_right = [(cp_x1 - 4 * scale, cp_top + 16 * scale), (cp_x1 - 18 * scale, cp_top + 16 * scale), (cp_x1 - 10 * scale, cp_base)]
    p.glaze(p.shape(curtain_left, soft=1.2), hexc(canopy_color), 0.85, edge=0.3)
    p.glaze(p.shape(curtain_right, soft=1.2), hexc(canopy_color), 0.85, edge=0.3)

    p.stroke([(bx - 22 * scale, by - 8 * scale), (bx - 18 * scale, by - 36 * scale)], 8.5 * scale, hexc('#2c3e50'), 0.88)
    p.stroke([(bx - 18 * scale, by - 36 * scale), (bx - 17 * scale, by - 44 * scale)], 6.0 * scale, hexc('#d4a373'), 0.92)
    p.stroke([(bx + 18 * scale, by - 8 * scale), (bx + 14 * scale, by - 34 * scale)], 8.5 * scale, hexc('#8e44ad'), 0.82)
    p.stroke([(bx + 14 * scale, by - 34 * scale), (bx + 13 * scale, by - 42 * scale)], 6.0 * scale, hexc('#cda380'), 0.92)

    boatman_x = bx + 120 * scale
    boatman_y = by - 8 * scale
    p.stroke([(boatman_x, boatman_y), (boatman_x - 6 * scale, boatman_y - 34 * scale)], 8.0 * scale, hexc('#3d405b'), 0.92)
    p.stroke([(boatman_x - 6 * scale, boatman_y - 34 * scale), (boatman_x - 6 * scale, boatman_y - 43 * scale)], 5.5 * scale, hexc('#bc6c25'), 0.95)
    p.stroke([(boatman_x - 8 * scale, boatman_y - 44 * scale), (boatman_x - 3 * scale, boatman_y - 45 * scale)], 6.0 * scale, hexc('#e07a5f'), 0.90)

    oar_handle = [(boatman_x - 8 * scale, boatman_y - 28 * scale), (boatman_x + 22 * scale, boatman_y + 30 * scale)]
    p.line(oar_handle, width=2.4 * scale, colour=hexc('#331d10'), strength=0.9)
    blade_cx, blade_cy = boatman_x + 22 * scale, boatman_y + 30 * scale
    blade_pts = [
        (blade_cx - 8 * scale, blade_cy - 4 * scale),
        (blade_cx, blade_cy + 14 * scale),
        (blade_cx + 8 * scale, blade_cy - 4 * scale),
        (blade_cx, blade_cy)
    ]
    p.glaze(p.shape(blade_pts, soft=1.2), hexc('#422716'), 0.95, edge=0.4)

    p.glaze(p.mirror(hull_mask, by + 12 * scale, soft=7, breakup=0.52), hexc('#382012'), 0.42, edge=0.1)

render_kashmiri_shikara(1340, 780, scale=1.05, canopy_color='#a32a29')
render_kashmiri_shikara(910, 895, scale=1.42, canopy_color='#b84a39')
p.stage('shikara_boats')

# -----------------------------------------------------------------------------
# 5. Fine Water Shimmer, Water Lilies & Birds Soaring in Sky (STRICTLY IN SKY)
# -----------------------------------------------------------------------------
rip = np.zeros((p.H, p.W), np.float32)
for _ in range(35):
    ry = rng.uniform(Y0 + 20, 1060)
    rx = rng.uniform(-60, 1820)
    rlen = rng.uniform(140, 480)
    rip = np.maximum(rip, p.band([(rx, ry), (rx + rlen, ry + rng.normal(0, 1.2))], rng.uniform(1.8, 3.8), soft=1.2))
p.lift(rip, 0.48)

pads = []
for _ in range(24):
    lx = rng.uniform(140, 560)
    ly = rng.uniform(740, 1030)
    pads.append((lx, ly, rng.uniform(16, 32), rng.uniform(8, 16)))
p.glaze(p.blobs(pads, rough=0.25, soft=2.0), hexc('#2d5a3f'), 0.75, edge=0.45, gran=0.35)

# Graceful Himalayan eagles / swallows soaring HIGH in the mountain sky (NEVER IN WATER)
def draw_sky_bird(bx, by, span):
    wing_pts = [
        (bx - span, by - span * 0.45), (bx - span * 0.4, by),
        (bx, by + span * 0.15),
        (bx + span * 0.4, by), (bx + span, by - span * 0.45)
    ]
    p.line(wing_pts, width=1.8, colour=hexc('#1c2833'), strength=0.85)

draw_sky_bird(780, 140, 18)
draw_sky_bird(820, 125, 14)
draw_sky_bird(860, 155, 11)
draw_sky_bird(1450, 160, 16)
draw_sky_bird(1490, 145, 13)

p.splatter(hexc('#34495e'), n=22, box=(200, Y0, 1720, 1040), size=(1.0, 2.5), strength=0.4)

p.save(out)
print(f"Masterpiece watercolor generated successfully at {out}")
