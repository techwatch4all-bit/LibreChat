"""
Custom Procedural Code Painting - Neon Cyberpunk Skyline with Laser Grid & Monorail
Deterministic NumPy + Pillow fine art engine.
"""
import sys
import os
import math
import numpy as np
from PIL import Image, ImageDraw

def render(out_path):
    W, H = 1920, 1080
    
    # Base sky canvas with deep magenta-indigo gradient
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    
    # Sunset sky gradient
    r_sky = (18 * (1 - y) + 120 * y).astype(np.uint8)
    g_sky = (8 * (1 - y) + 24 * y).astype(np.uint8)
    b_sky = (40 * (1 - y) + 90 * y).astype(np.uint8)
    
    canvas_arr = np.dstack([
        np.broadcast_to(r_sky, (H, W)),
        np.broadcast_to(g_sky, (H, W)),
        np.broadcast_to(b_sky, (H, W))
    ])
    
    img = Image.fromarray(canvas_arr, 'RGB')
    draw = ImageDraw.Draw(img, 'RGBA')
    
    # 1. Giant Retro Neon Sun at Horizon
    sun_x, sun_y, sun_r = W // 2, int(H * 0.52), 220
    for r in range(sun_r, 0, -2):
        frac = r / sun_r
        # warm yellow to electric magenta
        cr = int(255)
        cg = int(180 * frac + 30 * (1 - frac))
        cb = int(60 * frac + 180 * (1 - frac))
        draw.ellipse([sun_x - r, sun_y - r, sun_x + r, sun_y + r], fill=(cr, cg, cb, 255))
        
    # Sun horizontal blinds / scanline cuts
    for cut_y in range(sun_y - 20, sun_y + sun_r, 18):
        h_bar = int(4 + (cut_y - sun_y) * 0.08)
        draw.rectangle([sun_x - sun_r - 20, cut_y, sun_x + sun_r + 20, cut_y + h_bar], fill=(22, 10, 48, 255))
        
    # 2. Distant Cyberpunk Skyscrapers Silhouettes
    np.random.seed(1337)
    b_count = 42
    for b in range(b_count):
        bw = np.random.randint(40, 110)
        bh = np.random.randint(180, 420)
        bx = int(b * (W / b_count) - 20)
        by = int(H * 0.65) - bh
        # Dark silhouette
        draw.rectangle([bx, by, bx + bw, int(H * 0.65)], fill=(12, 16, 36, 255))
        
        # Windows / neon antenna
        if np.random.rand() > 0.3:
            draw.line([bx + bw // 2, by, bx + bw // 2, by - np.random.randint(20, 60)], fill=(0, 240, 255, 200), width=2)
        for wy in range(by + 15, int(H * 0.65) - 20, 12):
            if np.random.rand() > 0.4:
                draw.rectangle([bx + 8, wy, bx + bw - 8, wy + 4], fill=(255, 0, 128, 160))

    # 3. Perspective Neon Grid Ground
    horizon_y = int(H * 0.62)
    draw.rectangle([0, horizon_y, W, H], fill=(8, 10, 24, 255))
    
    # Vanishing point lines
    vp_x = W // 2
    for gx in range(-W, W * 2, 80):
        draw.line([vp_x, horizon_y, gx, H], fill=(0, 255, 220, 140), width=2)
        
    # Transverse perspective lines
    for gy_i in range(1, 16):
        dist_factor = (gy_i / 16.0) ** 2.2
        curr_y = int(horizon_y + dist_factor * (H - horizon_y))
        alpha = int(40 + 190 * (gy_i / 16.0))
        draw.line([0, curr_y, W, curr_y], fill=(255, 0, 180, alpha), width=max(1, int(dist_factor * 4)))

    # Save output
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    img.save(out_path, quality=95)
    print("Rendered cyberpunk masterwork to", out_path)

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "storage/exports/generated/neon_cyberpunk_sunset.png"
    render(out)
