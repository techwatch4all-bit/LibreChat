#!/usr/bin/env python3
"""
Satchida SceneMosaic MCP Server.
Photo-to-3D Indoor Scene Reconstruction & Hybrid Agentic Layout Evolution
self-contained inside LibreChat with procedural ArchViz Three.js + GLB export.
"""

import json
import re
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-scenemosaic")

DEFAULT_OBJECTS = [
    {"id": "sofa_1", "name": "3-Seat Linen Sofa", "type": "sofa", "x": 1.2, "z": 0.9, "w": 7.2, "d": 3.0, "h": 2.6, "wall_attach": "north", "yaw_deg": 0, "color": "#5f6b6d"},
    {"id": "coffee_1", "name": "Oak Coffee Table", "type": "coffee_table", "x": 2.7, "z": 5.0, "w": 4.2, "d": 2.2, "h": 1.35, "yaw_deg": 0, "color": "#a47c54"},
    {"id": "tv_1", "name": "Media Console & TV", "type": "tv", "x": 2.1, "z": 11.4, "w": 5.4, "d": 1.5, "h": 3.4, "wall_attach": "south", "yaw_deg": 180, "color": "#3d2f25"},
    {"id": "lamp_1", "name": "Floor Lamp", "type": "lamp", "x": 9.1, "z": 1.0, "w": 1.3, "d": 1.3, "h": 5.2, "yaw_deg": 0, "color": "#c9a659"},
    {"id": "desk_1", "name": "Studio Work Desk", "type": "desk", "x": 10.6, "z": 4.6, "w": 4.6, "d": 2.2, "h": 2.5, "wall_attach": "east", "yaw_deg": -90, "color": "#966d46"},
    {"id": "chair_1", "name": "Desk Chair", "type": "chair", "x": 11.4, "z": 7.6, "w": 1.8, "d": 1.8, "h": 2.7, "yaw_deg": 180, "color": "#4f5d6b"},
    {"id": "shelf_1", "name": "Oak Bookshelf", "type": "bookshelf", "x": 0.5, "z": 7.4, "w": 1.5, "d": 3.6, "h": 5.8, "wall_attach": "west", "yaw_deg": 90, "color": "#8e6642"},
    {"id": "plant_1", "name": "Fiddle Leaf Planter", "type": "planter", "x": 13.6, "z": 11.3, "w": 1.8, "d": 1.8, "h": 3.8, "yaw_deg": 0, "color": "#3b6e44"},
]


TYPE_HEIGHT_BOUNDS = {
    "coffee_table": (1.1, 1.8, 1.4),
    "sofa": (2.2, 3.2, 2.7),
    "couch": (2.2, 3.2, 2.7),
    "bed": (2.0, 3.8, 2.8),
    "desk": (2.2, 2.8, 2.5),
    "table": (2.2, 2.8, 2.5),
    "dining": (2.3, 2.8, 2.5),
    "chair": (2.2, 3.2, 2.7),
    "armchair": (2.2, 3.2, 2.7),
    "tv": (2.5, 4.4, 3.4),
    "media": (2.5, 4.4, 3.4),
    "lamp": (4.2, 6.2, 5.2),
    "bookshelf": (4.5, 7.2, 5.8),
    "wardrobe": (5.5, 7.5, 6.5),
    "dresser": (2.6, 3.8, 3.1),
    "nightstand": (1.6, 2.4, 2.0),
    "kitchen": (2.8, 3.2, 3.0),
    "bath": (1.6, 2.5, 2.0),
    "planter": (2.2, 4.8, 3.6),
}


def _resolve_containment_and_collisions(objects: list[dict], room_w: float, room_d: float) -> list[dict]:
    """Snap wall-attached items, clamp inside room bounds, and nudge overlapping floor objects apart."""
    resolved = []
    margin = 0.45
    for idx, raw in enumerate(objects):
        obj = dict(raw)
        ftype = str(obj.get("type", "table")).lower().strip()
        w = max(0.7, min(room_w - 2 * margin, float(obj.get("w", 2.4))))
        d = max(0.7, min(room_d - 2 * margin, float(obj.get("d", 2.2))))
        lo_h, hi_h, def_h = TYPE_HEIGHT_BOUNDS.get(ftype, (1.2, 5.5, 2.5))
        raw_h = float(obj.get("h", def_h))
        if raw_h > 12.0:
            raw_h = raw_h / 12.0
        h = max(lo_h, min(hi_h, raw_h))
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
        obj.update({
            "id": obj.get("id", f"obj_{idx}"),
            "name": obj.get("name", obj.get("type", f"Item {idx + 1}")),
            "type": obj.get("type", "table"),
            "w": round(w, 2),
            "d": round(d, 2),
            "h": round(h, 2),
            "x": round(x, 2),
            "z": round(z, 2),
            "yaw_deg": float(obj.get("yaw_deg", 0)),
        })
        resolved.append(obj)

    for i in range(len(resolved)):
        a = resolved[i]
        for j in range(i):
            b = resolved[j]
            ox = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
            oz = min(a["z"] + a["d"], b["z"] + b["d"]) - max(a["z"], b["z"])
            if ox > 0.1 and oz > 0.1:
                if ox < oz:
                    shift = ox + 0.35
                    a["x"] = round(min(room_w - a["w"] - margin, a["x"] + shift) if a["x"] >= b["x"] else max(margin, a["x"] - shift), 2)
                else:
                    shift = oz + 0.35
                    a["z"] = round(min(room_d - a["d"] - margin, a["z"] + shift) if a["z"] >= b["z"] else max(margin, a["z"] - shift), 2)
    return resolved


def _to_centered_objects(items: list[dict], room_w: float, room_d: float) -> list[dict]:
    """Convert top-left [0..room_w, 0..room_d] coordinates into centered Three.js coordinates."""
    centered = []
    for o in items:
        c = dict(o)
        c["x"] = round(o["x"] + o["w"] / 2.0 - room_w / 2.0, 3)
        c["z"] = round(o["z"] + o["d"] / 2.0 - room_d / 2.0, 3)
        c["y"] = float(o.get("y", 0.0))
        centered.append(c)
    return centered


def _evolve_variants(base: list[dict], room_w: float, room_d: float) -> list[dict]:
    """Generate 3 SceneMosaic layout evolution variants from the base reconstruction."""
    v1 = _resolve_containment_and_collisions(base, room_w, room_d)

    v2_raw = []
    for o in v1:
        c = dict(o)
        if c.get("type") in ("sofa", "couch", "bed"):
            c["x"] = max(0.5, room_w / 2 - c["w"] / 2)
            c["z"] = 0.55
            c["yaw_deg"] = 0
        elif c.get("type") in ("table", "coffee_table"):
            c["x"] = max(0.5, room_w / 2 - c["w"] / 2)
            c["z"] = min(room_d - c["d"] - 0.6, 4.6)
        elif c.get("type") == "tv":
            c["x"] = max(0.5, room_w / 2 - c["w"] / 2)
            c["z"] = room_d - c["d"] - 0.5
            c["yaw_deg"] = 180
        v2_raw.append(c)
    v2 = _resolve_containment_and_collisions(v2_raw, room_w, room_d)

    v3_raw = [dict(o) for o in v1 if o.get("type") not in ("wardrobe", "bookshelf")]
    for o in v3_raw:
        if o.get("type") == "desk":
            o["x"] = 0.6
            o["z"] = max(0.6, room_d - o["d"] - 0.6)
            o["yaw_deg"] = 0
        elif o.get("type") == "chair":
            o["x"] = 2.0
            o["z"] = max(0.6, room_d - o["d"] - 3.0)
            o["yaw_deg"] = 180
    v3 = _resolve_containment_and_collisions(v3_raw, room_w, room_d)

    return [
        {"name": "Photo Original", "objects": _to_centered_objects(v1, room_w, room_d)},
        {"name": "Open-Flow Ergonomic", "objects": _to_centered_objects(v2, room_w, room_d)},
        {"name": "Minimalist Zen", "objects": _to_centered_objects(v3, room_w, room_d)},
    ]


@mcp.tool()
def build_scenemosaic_scene(
    title: str = "SceneMosaic — Photo-to-3D Reconstructed Room",
    room_width: float = 16.0,
    room_depth: float = 14.0,
    objects_json: str = "[]",
    style_preset: str = "Warm Minimalist Oak & Concrete",
) -> str:
    """
    Reconstruct an interactive photorealistic Three.js 3D room scene with 3 SceneMosaic evolved layout variants
    and GLB export from objects extracted from a room photo (or default studio room if objects_json is omitted).
    - objects_json: optional JSON array of {name, type: 'sofa'|'bed'|'table'|'coffee_table'|'dining'|'desk'|'chair'|'armchair'|'tv'|'bookshelf'|'lamp'|'kitchen'|'wardrobe'|'dresser'|'nightstand'|'bath'|'planter', x, z, w, d, h, yaw_deg?, wall_attach?: 'north'|'south'|'east'|'west', color?}
    """
    rw = max(8.0, min(60.0, float(room_width)))
    rd = max(8.0, min(60.0, float(room_depth)))
    objs = json.loads(objects_json) if objects_json.strip() not in ("", "[]") else DEFAULT_OBJECTS
    variants = _evolve_variants(objs, rw, rd)
    safe_title = title.replace("<", "&lt;").replace(">", "&gt;")
    safe_style = style_preset.replace("<", "&lt;").replace(">", "&gt;")
    payload = json.dumps({"title": safe_title, "roomW": rw, "roomD": rd, "wallH": 9.2, "variants": variants, "stylePreset": safe_style})

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{safe_title}</title>
  <script src="/assets/vendor/three/three.min.js"></script>
  <script src="/assets/vendor/three/OrbitControls.js"></script>
  <script src="/assets/vendor/three/GLTFExporter.js"></script>
  <script src="/assets/vendor/satchida/scenemosaic-studio.js?v=3"></script>
</head>
<body>
  <script>window.SatchidaSceneMosaic.mountWithHUD({payload});</script>
</body>
</html>"""

    clean = re.sub(r"```html|```", "", html).strip()
    return (
        "Output ONLY the following HTML artifact verbatim inside a single ```html code block. "
        "Do NOT summarize, rewrite, or omit any part of it:\n\n"
        f"```html\n{clean}\n```"
    )


if __name__ == "__main__":
    mcp.run()
