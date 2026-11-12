#!/usr/bin/env python3
"""
Satchida SceneMosaic MCP Server.
Photo-to-3D Indoor Scene Reconstruction & Hybrid Agentic Layout Evolution
inspired by rxjfighting/SceneMosaic, adapted for native Windows + LibreChat Artifact Preview.
"""

import json
import re
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-scenemosaic")

DEFAULT_OBJECTS = [
    {"id": "sofa_1", "name": "3-Seat Sofa", "type": "sofa", "x": 1.2, "z": 1.2, "w": 7.5, "d": 3.2, "h": 2.6, "wall_attach": "north", "color": "#334155"},
    {"id": "coffee_1", "name": "Coffee Table", "type": "table", "x": 2.8, "z": 5.4, "w": 4.2, "d": 2.2, "h": 1.4, "color": "#78350f"},
    {"id": "tv_1", "name": "Media Console", "type": "wardrobe", "x": 2.2, "z": 11.8, "w": 5.5, "d": 1.6, "h": 2.0, "color": "#1e293b"},
    {"id": "desk_1", "name": "Work Desk", "type": "desk", "x": 11.2, "z": 1.2, "w": 4.8, "d": 2.2, "h": 2.5, "wall_attach": "east", "color": "#78350f"},
    {"id": "plant_1", "name": "Corner Planter", "type": "planter", "x": 14.0, "z": 11.6, "w": 1.8, "d": 1.8, "h": 3.2, "color": "#22c55e"},
]


def _resolve_containment_and_collisions(objects: list[dict], room_w: float, room_d: float) -> list[dict]:
    """Snap wall-attached items, clamp inside room bounds, and nudge overlapping floor objects apart."""
    resolved = []
    margin = 0.4
    for idx, raw in enumerate(objects):
        obj = dict(raw)
        w = max(0.8, min(room_w - 2 * margin, float(obj.get("w", 2.5))))
        d = max(0.8, min(room_d - 2 * margin, float(obj.get("d", 2.5))))
        h = max(0.5, float(obj.get("h", 2.5)))
        x = float(obj.get("x", 1.0))
        z = float(obj.get("z", 1.0))
        attach = str(obj.get("wall_attach", "")).lower()
        if attach == "north":
            z = margin
        elif attach == "south":
            z = room_d - d - margin
        elif attach == "west":
            x = margin
        elif attach == "east":
            x = room_w - w - margin
        x = max(margin, min(room_w - w - margin, x))
        z = max(margin, min(room_d - d - margin, z))
        obj.update({"id": obj.get("id", f"obj_{idx}"), "w": round(w, 2), "d": round(d, 2), "h": round(h, 2), "x": round(x, 2), "z": round(z, 2)})
        resolved.append(obj)

    for i in range(len(resolved)):
        a = resolved[i]
        for j in range(i):
            b = resolved[j]
            ox = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
            oz = min(a["z"] + a["d"], b["z"] + b["d"]) - max(a["z"], b["z"])
            if ox > 0.1 and oz > 0.1:
                if ox < oz:
                    shift = ox + 0.3
                    a["x"] = round(min(room_w - a["w"] - margin, a["x"] + shift) if a["x"] >= b["x"] else max(margin, a["x"] - shift), 2)
                else:
                    shift = oz + 0.3
                    a["z"] = round(min(room_d - a["d"] - margin, a["z"] + shift) if a["z"] >= b["z"] else max(margin, a["z"] - shift), 2)
    return resolved


def _evolve_variants(base: list[dict], room_w: float, room_d: float) -> dict[str, list[dict]]:
    """Generate 3 SceneMosaic layout evolution variants from the base reconstruction."""
    v1 = _resolve_containment_and_collisions(base, room_w, room_d)
    v2_raw = []
    for o in v1:
        c = dict(o)
        if c.get("type") in ("sofa", "bed"):
            c["x"] = max(0.5, room_w / 2 - c["w"] / 2)
            c["z"] = 0.5
        elif c.get("type") == "table":
            c["x"] = max(0.5, room_w / 2 - c["w"] / 2)
            c["z"] = min(room_d - c["d"] - 0.5, 4.8)
        v2_raw.append(c)
    v2 = _resolve_containment_and_collisions(v2_raw, room_w, room_d)

    v3_raw = [dict(o) for o in v1 if o.get("type") != "wardrobe"]
    for o in v3_raw:
        if o.get("type") == "desk":
            o["x"] = 0.6
            o["z"] = max(0.6, room_d - o["d"] - 0.6)
    v3 = _resolve_containment_and_collisions(v3_raw, room_w, room_d)
    return {"Photo Original": v1, "Open-Flow Ergonomic": v2, "Minimalist Zen": v3}


@mcp.tool()
def build_scenemosaic_scene(
    title: str = "SceneMosaic — Photo-to-3D Reconstructed Room",
    room_width: float = 16.0,
    room_depth: float = 14.0,
    objects_json: str = "[]",
    style_preset: str = "Warm Minimalist Oak & Concrete",
) -> str:
    """
    Reconstruct an interactive Three.js 3D room scene with 3 SceneMosaic evolved layout variants
    from objects extracted from a room photo (or default living/studio room if objects_json is omitted).
    - objects_json: optional JSON array of {name, type: 'sofa'|'bed'|'table'|'dining'|'desk'|'kitchen'|'wardrobe'|'bath'|'planter', x, z, w, d, h, wall_attach?: 'north'|'south'|'east'|'west', color?}
    """
    rw = max(8.0, min(60.0, float(room_width)))
    rd = max(8.0, min(60.0, float(room_depth)))
    objs = json.loads(objects_json) if objects_json.strip() not in ("", "[]") else DEFAULT_OBJECTS
    variants = _evolve_variants(objs, rw, rd)
    safe_title = title.replace("<", "&lt;").replace(">", "&gt;")
    safe_style = style_preset.replace("<", "&lt;").replace(">", "&gt;")
    payload = json.dumps({"width": rw, "depth": rd, "variants": variants, "style": safe_style})

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{safe_title}</title>
  <script src="/assets/vendor/three/three.min.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';"></script>
  <script src="/assets/vendor/three/OrbitControls.js" onerror="this.onerror=null;this.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';"></script>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    html, body {{ width: 100%; height: 100%; overflow: hidden; background: #07111f; color: #f8fafc; font-family: Inter, system-ui, sans-serif; }}
    #webgl {{ position: fixed; inset: 0; width: 100%; height: 100%; display: block; }}
    #badge {{ position: fixed; top: 12px; left: 12px; z-index: 10; background: rgba(15,23,42,0.88); border: 1px solid rgba(56,189,248,0.28); border-radius: 10px; padding: 9px 13px; max-width: 300px; }}
    #badge h1 {{ font-size: 13px; font-weight: 700; color: #f8fafc; }}
    #badge p {{ font-size: 11px; color: #94a3b8; margin-top: 2px; }}
    #hud {{ position: fixed; top: 12px; right: 12px; z-index: 10; width: 220px; background: rgba(15,23,42,0.92); border: 1px solid rgba(56,189,248,0.3); border-radius: 12px; padding: 11px; display: flex; flex-direction: column; gap: 7px; }}
    #hud h3 {{ font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #38bdf8; }}
    .vbtn {{ width: 100%; text-align: left; padding: 6px 9px; border-radius: 7px; border: 1px solid rgba(56,189,248,0.28); background: rgba(56,189,248,0.1); color: #e0f2fe; font-size: 11px; font-weight: 600; cursor: pointer; }}
    .vbtn.active {{ background: #0284c7; border-color: #38bdf8; color: #fff; }}
    #exp {{ margin-top: 4px; padding: 6px 9px; border-radius: 7px; border: 1px solid rgba(16,185,129,0.4); background: rgba(16,185,129,0.15); color: #a7f3d0; font-size: 11px; font-weight: 600; cursor: pointer; }}
  </style>
</head>
<body>
  <canvas id="webgl"></canvas>
  <div id="badge">
    <h1>{safe_title}</h1>
    <p>{safe_style} · {rw:.0f}' × {rd:.0f}'</p>
  </div>
  <div id="hud">
    <h3>SceneMosaic Variants</h3>
    <div id="variants"></div>
    <button id="exp">Export Layout JSON</button>
  </div>
  <script>
    const DATA = {payload};
    const canvas = document.getElementById('webgl');
    const renderer = new THREE.WebGLRenderer({{ canvas, antialias: true, preserveDrawingBuffer: true }});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07111f');
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.3, 200);
    camera.position.set(DATA.width * 0.9, Math.max(DATA.width, DATA.depth) * 0.95, DATA.depth * 1.15);
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xdbeafe, 0.52));
    scene.add(new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.4));
    const sun = new THREE.DirectionalLight(0xfffbeb, 1.1);
    sun.position.set(18, 28, 20);
    sun.castShadow = true;
    scene.add(sun);

    const W = DATA.width, D = DATA.depth;
    const fc = document.createElement('canvas'); fc.width = 128; fc.height = 128;
    const fg = fc.getContext('2d'); fg.fillStyle = '#b88b5c'; fg.fillRect(0, 0, 128, 128);
    fg.strokeStyle = '#8f653b'; fg.lineWidth = 1.5;
    for (let y = 0; y < 128; y += 16) {{ fg.beginPath(); fg.moveTo(0, y); fg.lineTo(128, y); fg.stroke(); }}
    const floorTex = new THREE.CanvasTexture(fc); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 3);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.25, D), new THREE.MeshStandardMaterial({{ color: 0xe6ccb2, map: floorTex, roughness: 0.72 }}));
    floor.receiveShadow = true;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({{ color: 0x94a3b8, roughness: 0.8 }});
    const wallSpecs = [
      [W, 8.5, 0.45, 0, 4.3, -D / 2],
      [0.45, 8.5, D, -W / 2, 4.3, 0],
    ];
    for (const [bw, bh, bd, x, y, z] of wallSpecs) {{
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wallMat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    }}

    const objGroup = new THREE.Group();
    scene.add(objGroup);
    let currentVariant = Object.keys(DATA.variants)[0];

    function addPart(g, geo, mat, x, y, z) {{
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
    }}

    function renderVariant(name) {{
      currentVariant = name;
      while (objGroup.children.length) objGroup.remove(objGroup.children[0]);
      const items = DATA.variants[name] || [];
      for (const f of items) {{
        const g = new THREE.Group();
        const mainMat = new THREE.MeshStandardMaterial({{ color: f.color || '#475569', roughness: 0.65 }});
        const woodMat = new THREE.MeshStandardMaterial({{ color: 0x8b5e3c, roughness: 0.55 }});
        const darkWood = new THREE.MeshStandardMaterial({{ color: 0x3b281c, roughness: 0.6 }});
        const cushionMat = new THREE.MeshStandardMaterial({{ color: 0xe2e8f0, roughness: 0.85 }});
        const steelMat = new THREE.MeshStandardMaterial({{ color: 0x94a3b8, metalness: 0.6, roughness: 0.3 }});
        const glassMat = new THREE.MeshStandardMaterial({{ color: 0x0f172a, roughness: 0.15 }});
        if (f.type === 'sofa') {{
          addPart(g, new THREE.BoxGeometry(f.w, 0.7, f.d), mainMat, 0, 0.45, 0);
          addPart(g, new THREE.BoxGeometry(f.w, 1.4, f.d * 0.22), mainMat, 0, 1.15, -f.d * 0.39);
          addPart(g, new THREE.BoxGeometry(f.w * 0.14, 1.1, f.d), mainMat, -f.w * 0.43, 0.9, 0);
          addPart(g, new THREE.BoxGeometry(f.w * 0.14, 1.1, f.d), mainMat, f.w * 0.43, 0.9, 0);
          addPart(g, new THREE.BoxGeometry(f.w * 0.7, 0.32, f.d * 0.68), cushionMat, 0, 0.92, f.d * 0.08);
        }} else if (f.type === 'bed') {{
          addPart(g, new THREE.BoxGeometry(f.w, 0.65, f.d), woodMat, 0, 0.38, 0);
          addPart(g, new THREE.BoxGeometry(f.w, 2.2, 0.25), darkWood, 0, 1.15, -f.d / 2 + 0.15);
          addPart(g, new THREE.BoxGeometry(f.w * 0.92, 0.55, f.d * 0.92), cushionMat, 0, 0.95, 0.1);
          addPart(g, new THREE.BoxGeometry(f.w * 0.94, 0.22, f.d * 0.56), mainMat, 0, 1.24, f.d * 0.18);
        }} else if (f.type === 'desk') {{
          addPart(g, new THREE.BoxGeometry(f.w, 0.18, f.d), woodMat, 0, f.h - 0.1, 0);
          for (const lx of [-f.w * 0.44, f.w * 0.44]) for (const lz of [-f.d * 0.4, f.d * 0.4]) {{
            addPart(g, new THREE.BoxGeometry(0.16, f.h - 0.18, 0.16), steelMat, lx, (f.h - 0.18) / 2, lz);
          }}
          addPart(g, new THREE.BoxGeometry(f.w * 0.42, 1.1, 0.12), glassMat, 0, f.h + 0.68, -f.d * 0.22);
          addPart(g, new THREE.BoxGeometry(1.3, 0.18, 1.3), mainMat, 0, 1.45, f.d * 0.72);
        }} else if (f.type === 'table') {{
          addPart(g, new THREE.BoxGeometry(f.w, 0.18, f.d), woodMat, 0, f.h - 0.09, 0);
          for (const lx of [-f.w * 0.4, f.w * 0.4]) for (const lz of [-f.d * 0.4, f.d * 0.4]) {{
            addPart(g, new THREE.BoxGeometry(0.16, f.h - 0.16, 0.16), darkWood, lx, (f.h - 0.16) / 2, lz);
          }}
        }} else if (f.type === 'planter') {{
          addPart(g, new THREE.CylinderGeometry(f.w * 0.4, f.w * 0.3, f.h * 0.45, 10), woodMat, 0, f.h * 0.22, 0);
          addPart(g, new THREE.DodecahedronGeometry(f.w * 0.48), new THREE.MeshStandardMaterial({{ color: 0x22c55e }}), 0, f.h * 0.72, 0);
        }} else {{
          addPart(g, new THREE.BoxGeometry(f.w, f.h, f.d), mainMat, 0, f.h / 2, 0);
        }}
        g.position.set(f.x + f.w / 2 - W / 2, 0.14, f.z + f.d / 2 - D / 2);
        objGroup.add(g);
      }}
      document.querySelectorAll('.vbtn').forEach(b => b.classList.toggle('active', b.dataset.name === name));
      renderer.render(scene, camera);
    }}

    const vWrap = document.getElementById('variants');
    Object.keys(DATA.variants).forEach((name, idx) => {{
      const btn = document.createElement('button');
      btn.className = 'vbtn' + (idx === 0 ? ' active' : '');
      btn.dataset.name = name;
      btn.textContent = name;
      btn.onclick = () => renderVariant(name);
      vWrap.appendChild(btn);
    }});

    document.getElementById('exp').onclick = () => {{
      const blob = new Blob([JSON.stringify({{ variant: currentVariant, objects: DATA.variants[currentVariant] }}, null, 2)], {{ type: 'application/json' }});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'scenemosaic-layout.json'; a.click();
    }};

    function resize() {{
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }}
    window.addEventListener('resize', resize);
    resize();
    renderVariant(currentVariant);
    (function loop() {{ requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); }})();
  </script>
</body>
</html>"""

    return (
        "DONE — the SceneMosaic 3D scene HTML is built and verified. "
        "Do NOT edit or rewrite it. Output the `:::artifact{...}` block below verbatim:\n\n"
        f":::artifact{{identifier=\"scenemosaic-3d-scene\" type=\"text/html\" title=\"{safe_title}\"}}\n"
        f"````html\n{html.strip()}\n````\n"
        f":::"
    )


if __name__ == "__main__":
    mcp.run()
