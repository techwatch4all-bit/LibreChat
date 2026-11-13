#!/usr/bin/env python3
"""
Satchida Architect MCP Server.
Whole-building floor plans — rooms, walls, doors, windows, stairs, roofs, multi-level —
rendered as an interactive 3D planner artifact powered by the vendored Axonometra engine
(client/public/assets/vendor/axonometra, MIT, zero-cloud). The server owns validation:
it ports the plan-model mapping (rooms-as-polygons whose edges become the walls, openings
projected onto room edges) and returns a verification block before the artifact.
All units are METRES. Plan coordinates: x to the right, z down; rooms that share an
interior wall must use identical shared-edge coordinates (run along the wall centre line).
"""

import json
import math
import re
from architectural_code_verifier import ArchitecturalVerifier
from mcp.server.mcpserver import MCPServer

M_TO_FT = 3.28084

mcp = MCPServer("satchida-architect")

FLOOR_MATERIALS = ("wood", "oak", "tiles", "carpet", "stone", "concrete")
STAIR_ROTATION = {"-z": 0, "+x": 90, "+z": 180, "-x": 270}
ROOF_TYPES = ("none", "flat", "gable")

# Accepted furniture/building-equipment types (subset of Axonometra FURNITURE_TYPES that
# renders as real models). Unknown types fall back to "sideboard" with the caller's name,
# mirroring the upstream importer.
FURNITURE_TYPES = frozenset({
    "lamp_ceiling", "lamp_downlight", "lamp_spot", "lamp_panel", "lamp_pendant", "lamp_fan",
    "lamp_floor", "lamp_table", "lamp_wall", "led_strip", "lamp_uplight", "lamp_bollard",
    "lamp_garden", "radiator", "ac_unit", "sofa", "sofa_l", "sofa_u", "armchair", "stool",
    "coffee_table", "tv_board", "tv_wall", "sideboard", "shelf", "plant", "rug", "table",
    "table_round", "chair", "bench", "corner_bench", "bar_stool", "kitchen", "kitchen_wall",
    "kitchen_tall", "island", "worktop", "sink", "stove", "dishwasher", "fridge", "bed",
    "bunk_bed", "nightstand", "wardrobe", "dresser", "bathtub", "shower", "wc", "washbasin",
    "washer", "dryer", "desk", "office_chair", "tall_cabinet", "coat_rack", "stairs",
    "stairs_u", "stairwell", "robot_vacuum", "inverter", "home_battery", "wallbox", "meter",
    "parking", "awning", "waste_bin", "mailbox", "wall_switch", "wall_socket", "wifi_ap",
    "water_heater",
})

# (w, d, h) metres — practical defaults for common types when the caller omits sizes.
FURNITURE_DEFAULTS = {
    "sofa": (2.2, 0.95, 0.85), "sofa_l": (2.8, 1.8, 0.85), "armchair": (0.9, 0.9, 0.85),
    "coffee_table": (1.1, 0.6, 0.42), "table": (1.6, 0.9, 0.75), "table_round": (1.2, 1.2, 0.75),
    "chair": (0.45, 0.5, 0.9), "office_chair": (0.6, 0.6, 1.0), "stool": (0.4, 0.4, 0.65),
    "bed": (1.6, 2.0, 0.6), "bunk_bed": (1.0, 2.0, 1.7), "nightstand": (0.45, 0.4, 0.55),
    "wardrobe": (1.8, 0.6, 2.1), "dresser": (1.2, 0.5, 0.9), "desk": (1.4, 0.7, 0.75),
    "kitchen": (2.4, 0.6, 0.9), "island": (1.8, 0.9, 0.9), "fridge": (0.8, 0.7, 1.8),
    "stove": (0.6, 0.6, 0.9), "sink": (0.6, 0.5, 0.9), "dishwasher": (0.6, 0.6, 0.85),
    "bathtub": (1.7, 0.75, 0.6), "shower": (0.9, 0.9, 2.0), "wc": (0.4, 0.65, 0.8),
    "washbasin": (0.6, 0.45, 0.85), "washer": (0.6, 0.6, 0.85), "dryer": (0.6, 0.6, 0.85),
    "tv_board": (1.6, 0.45, 0.5), "tv_wall": (1.4, 0.1, 0.8), "sideboard": (1.6, 0.45, 0.8),
    "shelf": (0.9, 0.35, 1.9), "tall_cabinet": (0.9, 0.5, 2.0), "plant": (0.5, 0.5, 1.3),
    "rug": (2.4, 1.7, 0.02), "bench": (1.4, 0.45, 0.45), "stairs": (1.0, 3.6, 2.7),
    "stairs_u": (2.2, 2.2, 2.7), "stairwell": (1.2, 4.0, 2.7), "ac_unit": (0.9, 0.3, 0.3),
    "water_heater": (0.6, 0.6, 1.6), "robot_vacuum": (0.35, 0.35, 0.1),
}

# Screens facing a window, or desks turned away from it — daylight ergonomics heuristics.
GLARE_RULES = (
    ("tv_board", "Screen faces the window wall — high glare risk; place it perpendicular to or opposite the windows."),
    ("tv_wall", "Wall-mounted screen on the window wall — high glare risk; move it to a perpendicular wall."),
)


def _r3(v):
    return round(float(v) + 0.0, 3)


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def _snap_grid(v, grid=0.05, tol=0.025):
    """Snap to the plan grid when the value sits within tolerance of it (upstream squareUp behaviour)."""
    nearest = round(v / grid) * grid
    return nearest if abs(v - nearest) <= tol else v


def _rect_points(rect):
    x0, z0, x1, z1 = (float(c) for c in rect)
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]


def _polygon_area(points):
    area = 0.0
    n = len(points)
    for i in range(n):
        x0, z0 = points[i]
        x1, z1 = points[(i + 1) % n]
        area += x0 * z1 - x1 * z0
    return area / 2.0


def _project_on_segment(p, a, b):
    """Return (distance, s, seg_len) — distance from p to segment ab and the projection distance s along ab."""
    abx, abz = b[0] - a[0], b[1] - a[1]
    seg_len = math.hypot(abx, abz)
    if seg_len < 1e-9:
        return math.hypot(p[0] - a[0], p[1] - a[1]), 0.0, 0.0
    t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / (seg_len * seg_len)
    t = _clamp(t, 0.0, 1.0)
    d = math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + abz * t))
    return d, t * seg_len, seg_len


def _same_point(a, b, tol=0.011):
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol


def _edge_key(a, b):
    """Canonical key for an edge so rooms sharing a wall (reversed point order) match."""
    pa = (round(a[0], 3), round(a[1], 3))
    pb = (round(b[0], 3), round(b[1], 3))
    return (pa, pb) if pa <= pb else (pb, pa)


def _norm_room(raw, warnings):
    """Normalize one room input into {name, points, material}; None when unusable."""
    name = str(raw.get("name", "")).strip() or "Room"
    material = raw.get("material", "wood")
    if material not in FLOOR_MATERIALS:
        material = "wood"
    pts = raw.get("points")
    if not pts and raw.get("rect") is not None:
        try:
            pts = _rect_points(raw["rect"])
        except (TypeError, ValueError):
            pts = None
    if not pts or len(pts) < 3:
        warnings.append({"code": "room_invalid", "name": name})
        return None
    points = [[_snap_grid(_r3(p[0])), _snap_grid(_r3(p[1]))] for p in pts]
    area = abs(_polygon_area(points))
    if area < 0.3:
        warnings.append({"code": "room_tiny", "name": name, "area_m2": _r3(area)})
        return None
    return {"name": name, "points": points, "material": material, "area": area}


def _shared_edge_report(rooms, warnings):
    """Rooms sharing a wall must use identical coordinates — near-miss edges draw doubled walls."""
    edges = {}
    for r in rooms:
        pts = r["points"]
        for i in range(len(pts)):
            key = _edge_key(pts[i], pts[(i + 1) % len(pts)])
            edges.setdefault(key, []).append(r["name"])
    near_miss = 0
    names = list(edges)
    for i in range(len(names)):
        a1, b1 = names[i]
        for j in range(i + 1, len(names)):
            a2, b2 = names[j]
            if _collinear_near(a1, b1, a2, b2):
                near_miss += 1
    if near_miss:
        warnings.append({
            "code": "edges_not_shared",
            "detail": (
                f"{near_miss} near-miss wall pair(s): rooms that sit side by side must reuse the "
                "exact same coordinates on the shared edge (within 1 cm), otherwise the engine draws "
                "two separate walls with a gap or a double thickness."
            ),
        })
    return edges


def _collinear_near(a1, b1, a2, b2):
    """True when two edges are roughly collinear, overlapping, yet not identical (near-miss shared walls)."""
    for (p1, q1, p2, q2) in ((a1, b1, a2, b2), (a1, b1, b2, a2)):
        dx1, dz1 = q1[0] - p1[0], q1[1] - p1[1]
        dx2, dz2 = q2[0] - p2[0], q2[1] - p2[1]
        if abs(dx1 * dz2 - dz1 * dx2) > 1e-6:
            continue  # not parallel
        # both horizontal or both vertical, overlapping ranges, offset < 0.15 m
        if abs(dz1) < 1e-6 and abs(dz2) < 1e-6:
            if abs(p1[1] - p2[1]) < 0.15 and _overlap_1d(p1[0], q1[0], p2[0], q2[0]) and not _same_point(p1, p2):
                return True
        if abs(dx1) < 1e-6 and abs(dx2) < 1e-6:
            if abs(p1[0] - p2[0]) < 0.15 and _overlap_1d(p1[1], q1[1], p2[1], q2[1]) and not _same_point(p1, p2):
                return True
    return False


def _overlap_1d(a0, a1, b0, b1):
    return min(a1, b1) - max(a0, b0) > 0.05


def _collect_openings(floor_in, rooms, floor_height, warnings):
    """Project door/window inputs onto the nearest room edge — the upstream importer's mapping."""
    edges = []
    for r in rooms:
        pts = r["points"]
        for i in range(len(pts)):
            edges.append({"room": r, "edge": i, "a": pts[i], "b": pts[(i + 1) % len(pts)]})

    raw_openings = []
    for kind, items in (("door", floor_in.get("doors", [])),
                        ("window", floor_in.get("windows", [])),
                        ("garage", floor_in.get("garage_doors", []))):
        for o in items or []:
            raw_openings.append((kind, o))

    openings = []
    dropped = 0
    for kind, o in raw_openings:
        at = o.get("at")
        if not at or len(at) < 2:
            dropped += 1
            continue
        at = [_r3(at[0]), _r3(at[1])]
        reach = 0.35
        best = None
        for e in edges:
            d, s, seg_len = _project_on_segment(at, e["a"], e["b"])
            if d <= reach and s > -0.05 and s < seg_len + 0.05:
                if best is None or d < best["d"]:
                    best = {"room": e["room"], "edge": e["edge"], "s": s, "len": seg_len, "d": d}
        if best is None:
            dropped += 1
            warnings.append({"code": "opening_dropped", "kind": kind, "at": at,
                             "detail": "no room edge within 0.35 m of the given point"})
            continue

        seg_len = best["len"]
        width = _clamp(float(o.get("width", 0.9 if kind == "door" else 1.2)), 0.3, 12.0)
        width = _r3(_clamp(width, 0.3, max(0.3, seg_len - 0.04)))
        offset = _r3(_clamp(best["s"], width / 2 + 0.01, max(width / 2 + 0.01, seg_len - width / 2 - 0.01)))
        height = _r3(_clamp(float(o.get("height", 2.04 if kind != "window" else 1.3)), 0.3, floor_height))
        sill = 0.0
        if kind == "window":
            sill = _r3(_clamp(float(o.get("sill", 0.9)), 0.0, max(0.0, floor_height - height)))
        otype = kind
        if otype == "door" and width >= 2.2:
            otype = "garage"
        leaves = 2 if (otype == "window" and width > 1.4) or (otype == "door" and width > 1.25) else 1
        hinge = "left" if str(o.get("hinge", "left")).lower() != "right" else "right"
        swing = "out" if str(o.get("swing", "in")).lower() == "out" else "in"
        style = o.get("style") or None
        opening = {
            "id": f"opening_{len(openings) + 1}",
            "room_id": best["room"]["id"],
            "edge": best["edge"],
            "offset": offset,
            "wall": None,
            "width": width,
            "type": otype,
            "sill": sill,
            "height": height,
            "hinge": hinge,
            "leaves": leaves,
            "swing": swing,
            "cover": None,
            "contact": None,
            "contact2": None,
            "tilt": None,
        }
        if style:
            opening["style"] = style
        openings.append(opening)
    return openings, dropped


def _furniture_item(o, idx, floor_height):
    ftype = str(o.get("type", "")).lower().strip()
    known = ftype in FURNITURE_TYPES
    name = str(o.get("name", "")).strip() or None
    if not known:
        ftype = "sideboard"
    dw, dd, dh = FURNITURE_DEFAULTS.get(ftype, (1.0, 0.6, 0.8))
    at = o.get("at") or [0.0, 0.0]
    try:
        w = _clamp(float(o.get("w", dw)), 0.05, 15.0)
        d = _clamp(float(o.get("d", dd)), 0.05, 15.0)
        h = _clamp(float(o.get("h", dh)), 0.02, 8.0)
        x = _r3(at[0])
        z = _r3(at[1])
        rotation = int(float(o.get("rotation", 0))) % 360
    except (TypeError, ValueError):
        return None
    item = {
        "id": f"furn_{idx}",
        "type": ftype,
        "x": x,
        "z": z,
        "rotation": rotation,
        "w": _r3(w),
        "d": _r3(d),
        "h": _r3(h),
        "variant": None,
        "entity": None,
        "power": None,
    }
    if name:
        item["name"] = name[:60]
    return item


def _stair_item(s, idx, floor_height, warnings):
    at = s.get("at") or [0.0, 0.0]
    try:
        w = _clamp(float(s.get("width", 1.0)), 0.7, 2.5)
        length = _clamp(float(s.get("length", 3.4)), 1.5, 6.0)
        rise = float(s.get("rise", floor_height + 0.3))
        x = _r3(at[0])
        z = _r3(at[1])
        rises = str(s.get("rises", "-z"))
    except (TypeError, ValueError):
        return None
    if not (floor_height - 0.2 <= rise <= floor_height + 0.7):
        warnings.append({
            "code": "stair_rise_suspect",
            "at": [x, z],
            "detail": f"stair rise {rise:.2f} m vs floor height {floor_height:.2f} m — it should climb "
                      "roughly one floor height (plus the slab) to reach the next level",
        })
    return {
        "id": f"furn_{idx}",
        "type": "stairs",
        "name": "Stairs",
        "x": x,
        "z": z,
        "rotation": STAIR_ROTATION.get(rises, 0),
        "w": _r3(w),
        "d": _r3(length),
        "h": _r3(rise),
        "variant": None,
        "entity": None,
        "power": None,
    }


def _furniture_aabb(f):
    rot = f.get("rotation", 0) % 360
    w, d = f["w"], f["d"]
    if rot in (90, 270):
        w, d = d, w
    return f["x"] - w / 2.0, f["z"] - d / 2.0, f["x"] + w / 2.0, f["z"] + d / 2.0


def _door_swing_conflicts(openings, furniture, rooms):
    """Furniture intersecting a door's swing quarter (width × width square inside the room)."""
    conflicts = []
    blockers = [f for f in furniture if f["type"] not in ("rug", "plant", "robot_vacuum")]
    boxes = [(f.get("name") or f["type"], _furniture_aabb(f)) for f in blockers]
    for o in openings:
        if o["type"] == "window":
            continue
        room = next((r for r in rooms if r["id"] == o["room_id"]), None)
        if room is None:
            continue
        pts = room["points"]
        a, b = pts[o["edge"]], pts[(o["edge"] + 1) % len(pts)]
        ex, ez = b[0] - a[0], b[1] - a[1]
        seg_len = math.hypot(ex, ez)
        if seg_len < 1e-6:
            continue
        ux, uz = ex / seg_len, ez / seg_len
        # inward normal: room outlines run clockwise in plan coords (z down), so the interior
        # lies at (-uz, ux) — e.g. the top edge (u = +x) has its room below it (+z)
        nx, nz = -uz, ux
        cx = a[0] + ux * o["offset"]
        cz = a[1] + uz * o["offset"]
        w = o["width"]
        # swing zone corners: centre ± u*w/2, then w into the room along the normal
        zone = [
            (cx - ux * w / 2, cz - uz * w / 2),
            (cx + ux * w / 2, cz + uz * w / 2),
            (cx + ux * w / 2 + nx * w, cz + uz * w / 2 + nz * w),
            (cx - ux * w / 2 + nx * w, cz - uz * w / 2 + nz * w),
        ]
        zx0 = min(p[0] for p in zone)
        zx1 = max(p[0] for p in zone)
        zz0 = min(p[1] for p in zone)
        zz1 = max(p[1] for p in zone)
        for name, (fx0, fz0, fx1, fz1) in boxes:
            ox = min(zx1, fx1) - max(zx0, fx0)
            oz = min(zz1, fz1) - max(zz0, fz0)
            if ox > 0.05 and oz > 0.05:
                conflicts.append({"door": o["id"], "blockedBy": name})
                break
    return conflicts


def _walkway_gaps(furniture):
    """Min edge-to-edge gap between large furniture pieces (corridors below 0.75 m are flagged)."""
    large = [f for f in furniture if f["type"] in
             ("sofa", "sofa_l", "sofa_u", "bed", "bunk_bed", "wardrobe", "dresser", "table",
              "table_round", "desk", "kitchen", "island", "tall_cabinet", "bathtub", "stairs",
              "stairs_u", "stairwell")]
    boxes = [(f["name"] or f["type"], _furniture_aabb(f)) for f in large]
    gaps = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            n1, (ax0, az0, ax1, az1) = boxes[i]
            n2, (bx0, bz0, bx1, bz1) = boxes[j]
            gap_x = max(bx0 - ax1, ax0 - bx1)  # positive when separated horizontally
            gap_z = max(bz0 - az1, az0 - bz1)
            overlap_x = min(ax1, bx1) - max(ax0, bx0)
            overlap_z = min(az1, bz1) - max(az0, bz0)
            if overlap_x > 0.05 and gap_z > 0:  # passage between them runs north–south
                gaps.append({"between": [n1, n2], "gap_m": _r3(gap_z), "axis": "z"})
            if overlap_z > 0.05 and gap_x > 0:
                gaps.append({"between": [n1, n2], "gap_m": _r3(gap_x), "axis": "x"})
    gaps.sort(key=lambda g: g["gap_m"])
    return gaps


def _orientation_of_edge(a, b):
    """Compass side an edge faces, given plan-up = north (settings.north = 0, z grows southward)."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    # outward normal of a clockwise (z-down) outline: (dz, -dx)
    if abs(dz) > abs(dx):  # near-vertical edge → normal runs along x
        return "east" if dz > 0 else "west"
    # near-horizontal edge → normal runs along z; -z is north
    return "north" if dx > 0 else "south"


def _daylight_report(rooms, openings):
    """Glazing ratio per room (rule of thumb: ≥ 10 % of floor area) and orientation hints."""
    per_room = {r["id"]: {"name": r["name"], "area": abs(_polygon_area(r["points"])), "glass": 0.0,
                          "sides": set(), "windows": 0} for r in rooms}
    for o in openings:
        if o["type"] != "window":
            continue
        room = per_room.get(o["room_id"])
        if room is None:
            continue
        room["glass"] += o["width"] * o["height"]
        room["windows"] += 1
        pts = next((r["points"] for r in rooms if r["id"] == o["room_id"]), None)
        if pts:
            a, b = pts[o["edge"]], pts[(o["edge"] + 1) % len(pts)]
            room["sides"].add(_orientation_of_edge(a, b))
    report = []
    for r in rooms:
        info = per_room[r["id"]]
        if info["windows"] == 0:
            report.append({"room": info["name"], "windows": 0,
                           "note": "no windows — plan artificial light or a light well"})
            continue
        ratio = info["glass"] / max(info["area"], 0.01)
        entry = {"room": info["name"], "windows": info["windows"],
                 "glazing_ratio": round(ratio, 2), "faces": sorted(info["sides"])}
        if ratio < 0.10:
            entry["note"] = "glazing under 10 % of floor area — the room will read dim in daytime"
        if "east" in info["sides"]:
            entry["note"] = (entry.get("note", "") + " " if entry.get("note") else "") + \
                            "east glazing: good morning light (bedrooms, breakfast)"
        report.append(entry)
    return report


def _build_building(plan):
    """Validate the raw plan and produce the Axonometra Building JSON plus a verification block."""
    warnings = []
    settings_in = plan.get("settings") or {}
    roof_in = settings_in.get("roof") or {}
    roof_type = roof_in.get("type", "gable") if roof_in else "none"
    if roof_type not in ROOF_TYPES:
        roof_type = "none"
    wall_exterior = _clamp(float(settings_in.get("wall_exterior", 0.24)), 0.1, 0.6)
    wall_interior = _clamp(float(settings_in.get("wall_interior", 0.12)), 0.06, 0.4)

    floors = []
    stats = {"floors": 0, "rooms": 0, "doors": 0, "windows": 0, "garage_doors": 0, "furniture": 0}
    daylight_all = []
    swing_conflicts = []
    walkway_min = None

    floors_in = plan.get("floors") or []
    if not floors_in:
        raise ValueError("plan.floors must contain at least one floor")

    sorted_in = sorted(enumerate(floors_in), key=lambda kv: float(kv[1].get("elevation", 0)))
    for fi, (_, floor_in) in enumerate(sorted_in):
        name = str(floor_in.get("name", "")).strip() or (f"Floor {fi + 1}" if len(floors_in) > 1 else "Ground floor")
        elevation = _r3(max(0.0, float(floor_in.get("elevation", 0))))
        height = _clamp(float(floor_in.get("height", 2.7)), 1.8, 8.0)

        rooms_in = [r for r in (_norm_room(raw, warnings) for raw in floor_in.get("rooms", [])) if r]
        if not rooms_in:
            warnings.append({"code": "no_rooms", "floor": name})
        rooms = []
        for ri, r in enumerate(rooms_in):
            rooms.append({
                "id": f"room_{fi + 1}_{ri + 1}",
                "name": r["name"],
                "area_id": None,
                "points": r["points"],
                "floor_material": r["material"],
            })
        _shared_edge_report(rooms_in, warnings)

        openings, dropped = _collect_openings(floor_in, rooms, height, warnings)
        if dropped:
            warnings.append({"code": "openings_dropped", "floor": name, "n": dropped})

        furniture = []
        for s in floor_in.get("stairs", []) or []:
            item = _stair_item(s, len(furniture) + 1, height, warnings)
            if item:
                furniture.append(item)
        for o in floor_in.get("furniture", []) or []:
            item = _furniture_item(o, len(furniture) + 1, height)
            if item:
                furniture.append(item)

        swing_conflicts.extend({"floor": name, **c} for c in _door_swing_conflicts(openings, furniture, rooms))
        daylight_all.extend({"floor": name, **d} for d in _daylight_report(rooms, openings))
        gaps = _walkway_gaps(furniture)
        if gaps and (walkway_min is None or gaps[0]["gap_m"] < walkway_min["gap_m"]):
            walkway_min = {"floor": name, **gaps[0]}

        floors.append({
            "id": f"floor_{fi + 1}",
            "name": name,
            "elevation": elevation,
            "height": _r3(height),
            "cut_height": 1.15,
            "rooms": rooms,
            "openings": openings,
            "furniture": furniture,
            "placements": [],
            "background": None,
            "outdoor": [],
            "walls": [],
            "ha_floor": None,
        })
        stats["floors"] += 1
        stats["rooms"] += len(rooms)
        stats["furniture"] += len(furniture)
        for o in openings:
            key = "windows" if o["type"] == "window" else ("garage_doors" if o["type"] == "garage" else "doors")
            stats[key] += 1

    building = {
        "version": 1,
        "floors": floors,
        "settings": {
            "wall_exterior": _r3(wall_exterior),
            "wall_interior": _r3(wall_interior),
            "grid": 0.05,
            "north": 0,
            "roof": {
                "type": roof_type,
                "pitch": _clamp(float(roof_in.get("pitch", 22.5) if roof_in else 22.5), 5.0, 45.0),
                "overhang": _clamp(float(roof_in.get("overhang", 0.45) if roof_in else 0.4), 0.0, 1.0),
            },
        },
        "energy": {
            "meter": None, "grid": None, "grid_invert": False, "solar": None,
            "battery": None, "battery_invert": False, "battery_soc": None,
            "consumption": None, "tariff": None,
        },
        "presence": [],
    }

    if swing_conflicts:
        warnings.append({"code": "door_swing_blocked", "n": len(swing_conflicts),
                         "detail": "furniture stands inside a door's swing zone", "conflicts": swing_conflicts})
    if walkway_min and walkway_min["gap_m"] < 0.75:
        warnings.append({"code": "narrow_walkway", "detail": walkway_min})

    status = "VERIFIED_WITH_WARNINGS" if warnings else "VERIFIED"
    verification = {
        "status": status,
        **stats,
        "warnings": warnings,
        "daylight": daylight_all,
        "walkwayMin": walkway_min,
    }
    return building, verification


def _code_compliance(building):
    """
    Run the ArchitecturalVerifier (IBC / NBC / ADA / Neufert engine) over the validated
    building. Rooms come out in metres; the verifier speaks feet, so bbox dimensions are
    converted. Bathroom passthroughs are inferred from door count (>= 2 doors on a bath
    signals a dual-door passthrough risk; full-bath defaults unless the name says powder/half).
    """
    HALF_BATH_HINTS = ("powder", "half", "guest wc")
    rooms_ft = []
    for fl in building["floors"]:
        door_counts = {}
        for o in fl["openings"]:
            if o["type"] in ("door", "garage"):
                door_counts[o["room_id"]] = door_counts.get(o["room_id"], 0) + 1
        for r in fl["rooms"]:
            xs = [p[0] for p in r["points"]]
            zs = [p[1] for p in r["points"]]
            w_ft = (max(xs) - min(xs)) * M_TO_FT
            d_ft = (max(zs) - min(zs)) * M_TO_FT
            name_l = r["name"].lower()
            is_bath = any(t in name_l for t in ("bath", "toilet", "wc", "washroom"))
            entry = {
                "name": r["name"],
                "w_ft": round(w_ft, 2),
                "d_ft": round(d_ft, 2),
                "is_full_bath": not any(h in name_l for h in HALF_BATH_HINTS),
            }
            if is_bath and door_counts.get(r["id"], 0) >= 2:
                entry["is_passthrough_between_bedrooms"] = True
                entry["doors"] = door_counts[r["id"]]
            rooms_ft.append(entry)

    report = ArchitecturalVerifier({"rooms": rooms_ft, "walls": [], "doors": []}).verify_all()
    return {
        "engine": "IBC/NBC/ADA/Neufert (architectural_code_verifier)",
        "status": report["status"],
        "violations": report["violations"],
        "warnings": report["warnings"],
    }


ARTIFACT_SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>__TITLE__</title>
<style>
  :root { --astryx-surface:#0b1220; --astryx-panel:#0f172a; --astryx-accent:#38bdf8;
          --astryx-text:#e2e8f0; --astryx-text-muted:#94a3b8; --astryx-ok:#34d399; --astryx-warn:#fbbf24; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; height:100%; background:var(--astryx-surface); color:var(--astryx-text);
               font-family: 'Segoe UI', system-ui, sans-serif; }
  #sm-arch-header { position:fixed; top:0; left:0; right:0; height:52px; z-index:10;
    display:flex; align-items:center; gap:14px; padding:0 16px;
    background:linear-gradient(180deg, rgba(15,23,42,.97), rgba(15,23,42,.88));
    border-bottom:1px solid rgba(56,189,248,.18); }
  #sm-arch-header h1 { font-size:15px; font-weight:700; margin:0; letter-spacing:.2px; }
  .chip { font-size:10.5px; padding:4px 9px; border-radius:6px; white-space:nowrap;
          border:1px solid rgba(56,189,248,.3); color:#7dd3fc; background:rgba(56,189,248,.10); }
  .chip.ok { border-color:rgba(52,211,153,.35); color:var(--astryx-ok); background:rgba(52,211,153,.10); }
  .chip.warn { border-color:rgba(251,191,36,.35); color:var(--astryx-warn); background:rgba(251,191,36,.10); }
  #plan { position:fixed; top:52px; left:0; right:0; bottom:0; }
  #boot { position:fixed; top:52px; left:0; right:0; bottom:0; display:flex; align-items:center;
          justify-content:center; color:var(--astryx-text-muted); font-size:13px; z-index:5; }
</style>
</head>
<body>
  <header id="sm-arch-header">__HEADER_CHIPS__</header>
  <div id="plan"></div>
  <div id="boot">Loading the Axonometra planner…</div>
  <script type="module">
    import { mountAxonometra, memoryStore } from "/assets/vendor/axonometra/index.js";
    const BUILDING = __BUILDING__;
    try {
      await mountAxonometra(document.getElementById("plan"), {
        store: memoryStore({ building: BUILDING, revision: 1 }),
        admin: true,
        language: "en",
      });
      document.getElementById("boot").remove();
    } catch (err) {
      const boot = document.getElementById("boot");
      if (boot) boot.textContent = "The planner failed to start: " + ((err && err.message) || err);
    }
  </script>
</body>
</html>"""


@mcp.tool()
def get_architect_schema() -> str:
    """
    Return the input JSON schema and a worked example for build_architect_plan.
    Call this first if you are unsure how to describe a building. All units are METRES.
    """
    schema = {
        "units": "metres; plan coords x right, z down (front of the building = largest z)",
        "plan": {
            "title": "string",
            "settings": {
                "wall_exterior": "0.24 (m)",
                "wall_interior": "0.12 (m)",
                "roof": {"type": "none | flat | gable", "pitch": "22.5 (deg)", "overhang": "0.45 (m)"},
            },
            "floors": [{
                "name": "Ground floor",
                "elevation": 0,
                "height": 2.7,
                "rooms": [{"name": "Living", "rect": [0, 0, 6, 5], "material": "wood"}],
                "doors": [{"at": [3.0, 5.0], "width": 0.9, "swing": "in"}],
                "windows": [{"at": [1.5, 0], "width": 1.8, "sill": 0.9, "height": 1.3}],
                "garage_doors": [{"at": [4.5, 5], "width": 2.4}],
                "stairs": [{"at": [5.0, 2.0], "width": 1.0, "length": 3.4, "rise": 3.0, "rises": "-z"}],
                "furniture": [{"name": "Sofa", "type": "sofa", "at": [2, 3], "w": 2.2, "d": 0.95, "h": 0.85, "rotation": 180}],
            }],
        },
        "rules": [
            "Rooms that share a wall MUST use identical coordinates on that shared edge (centre line of the wall) — e.g. rect [0,0,6,5] and [0,5,6,9] share the edge z=5 between x=0..6 exactly.",
            "Each room: rect [x0,z0,x1,z1] or polygon points [[x,z],...]. material: wood|oak|tiles|carpet|stone|concrete.",
            "Openings: give the centre point 'at' ON a room edge; the server projects it onto the nearest edge. Door width >= 2.2 becomes a garage door automatically.",
            "Doors: width 0.82 typical, height 2.04. Windows: sill 0.9, height 1.3 typical. Multi-leaf is automatic (door > 1.25 m, window > 1.4 m).",
            "Multi-floor: give each floor its own rooms and a stairs entry; rise should be about the upper floor's height + 0.3. rises: -z | +x | +z | -x.",
            "Furniture types include: sofa, bed, desk, chair, table, kitchen, wardrobe, fridge, stove, wc, shower, bathtub, washer, stairs, stairwell, plant, rug, tv_board, shelf, office_chair, nightstand, dresser, lamp_ceiling, ac_unit, water_heater, wallbox, inverter, parking.",
        ],
        "typologies": {
            "villa_bungalow": "Living, Dining, Courtyard(s), en-suite Master with walk-in dressing, Powder Room, Car Porch; wide corridors (>= 1.05 m), daylight on all habitable rooms.",
            "duplex": "Two mirrored dwelling units sharing one party wall; each unit has its own entrance, kitchen and bathroom; no room of one unit opens into the other.",
            "high_rise": "Symmetrical floor plates around a central core: scissor stair + lift lobby with 2.4 m clearance, at least two remote fire exits per plate (IBC Ch.10 egress), corridor >= 1.2 m on commercial/tower floors.",
            "bunker_silo": "Underground levels: central vertical spiral stair + equipment shaft, airlock vestibules at every entry, lightwells or full artificial lighting (windows=0 is expected — the daylight report notes it), reinforced walls 0.80–1.5 m thick (wall_exterior 0.80+), life-support/hydroponics sectors labelled as rooms.",
            "note": "Every build_architect_plan run executes the IBC/NBC/Neufert code verifier (codeCompliance in the verification block). If it reports CODE_VIOLATIONS, fix the plan (sizes, door counts, bathroom dimensions) and rebuild — do not ship a violating artifact.",
        },
        "worked_example": {
            "title": "Compact 2-room studio",
            "settings": {"roof": {"type": "flat", "pitch": 10, "overhang": 0.4}},
            "floors": [{
                "name": "Ground floor",
                "elevation": 0,
                "height": 2.7,
                "rooms": [
                    {"name": "Living, meals, kitchen", "rect": [0, 0, 5, 4], "material": "oak"},
                    {"name": "Bedroom", "rect": [0, 4, 5, 8], "material": "carpet"},
                ],
                "doors": [{"at": [2.5, 8], "width": 0.95}, {"at": [2.5, 4], "width": 0.82}],
                "windows": [{"at": [0, 2], "width": 1.8}, {"at": [5, 6], "width": 1.5}],
            }],
        },
    }
    return json.dumps(schema, indent=1)


@mcp.tool()
def build_architect_plan(plan_json: str, title: str = "Architect Studio — Building Plan") -> str:
    """
    Build an interactive 3D whole-building floor-plan artifact (walls, doors, windows, stairs, roof,
    multi-level) from a validated plan, rendered by the vendored Axonometra engine. Users can walk
    through it and keep editing the plan in the artifact.
    - plan_json: JSON string; call get_architect_schema first to learn the exact shape
      ({title, settings:{roof,...}, floors:[{name, elevation, height, rooms:[{name, rect|points, material}],
      doors:[{at,width}], windows:[{at,width,sill,height}], stairs:[{at,width,length,rise,rises}], furniture:[{type,at,...}]}]}).
    - title: artifact title shown in the header bar.
    """
    try:
        plan = json.loads(plan_json)
    except json.JSONDecodeError as exc:
        return f"ERROR: plan_json is not valid JSON: {exc}. Call get_architect_schema for the exact shape."

    try:
        building, verification = _build_building(plan)
    except (KeyError, TypeError, ValueError) as exc:
        return f"ERROR: plan could not be validated: {exc}. Call get_architect_schema for the exact shape."

    compliance = _code_compliance(building)
    verification["codeCompliance"] = compliance
    if compliance["violations"]:
        verification["status"] = "CODE_VIOLATIONS"

    safe_title = str(title or plan.get("title") or "Architect Studio").replace("<", "&lt;").replace(">", "&gt;")
    area_total = 0.0
    for fl in building["floors"]:
        for r in fl["rooms"]:
            area_total += abs(_polygon_area(r["points"]))
    chips = [
        f"<h1>{safe_title}</h1>",
        f"<span class='chip'>{verification['floors']} floor(s)</span>",
        f"<span class='chip'>{verification['rooms']} rooms · {area_total:.0f} m²</span>",
        f"<span class='chip'>{verification['doors']} doors · {verification['windows']} windows</span>",
    ]
    if verification["status"] == "VERIFIED":
        chips.append("<span class='chip ok'>✓ VERIFIED</span>")
    elif verification["status"] == "CODE_VIOLATIONS":
        chips.append(f"<span class='chip warn'>✗ CODE VIOLATIONS ({len(compliance['violations'])})</span>")
    else:
        chips.append(f"<span class='chip warn'>⚠ {len(verification['warnings'])} warning(s)</span>")
    header_chips = "".join(chips)

    payload = json.dumps(building, separators=(",", ":"))
    html = (ARTIFACT_SHELL
            .replace("__TITLE__", safe_title)
            .replace("__HEADER_CHIPS__", header_chips)
            .replace("__BUILDING__", payload))

    lines = [
        "The plan passed validation. Summarize the verification block for the user, then output "
        "ONLY the following HTML artifact verbatim inside a single ```html code block. Do NOT "
        "summarize, rewrite, or omit any part of the html block:\n",
        f"VERIFICATION: {json.dumps(verification)}\n",
        f"```html\n{html}\n```",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run()
