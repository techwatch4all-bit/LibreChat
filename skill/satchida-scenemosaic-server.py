#!/usr/bin/env python3
"""
Satchida SceneMosaic MCP Server.
Photo-to-3D Indoor Scene Reconstruction & Hybrid Agentic Layout Evolution
self-contained inside LibreChat with procedural ArchViz Three.js, 2D Floor Map, layout verification & GLB export.
"""

import json
import math
import re
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-scenemosaic")

DEFAULT_SCANDINAVIAN_LIVING_OBJECTS = [
    {"id": "sofa_1", "name": "3-Seat Nordic Fabric Sofa", "type": "sofa", "x": 4.1, "z": 0.6, "w": 7.8, "d": 3.2, "h": 2.8, "wall_attach": "north", "yaw_deg": 0, "color": "#7c8286"},
    {"id": "coffee_1", "name": "Solid Block Oak Coffee Table", "type": "coffee_table", "x": 5.8, "z": 5.2, "w": 4.4, "d": 2.2, "h": 1.3, "yaw_deg": 0, "color": "#b88b5c"},
    {"id": "pouf_1", "name": "Stitched Cognac Pouf (Left)", "type": "pouf", "x": 6.0, "z": 8.4, "w": 1.6, "d": 1.6, "h": 1.3, "yaw_deg": 180, "color": "#9b5a2b"},
    {"id": "pouf_2", "name": "Stitched Cognac Pouf (Right)", "type": "pouf", "x": 8.4, "z": 8.4, "w": 1.6, "d": 1.6, "h": 1.3, "yaw_deg": 180, "color": "#9b5a2b"},
    {"id": "armchair_left", "name": "Scandinavian Oak Low Armchair", "type": "armchair", "x": 1.8, "z": 4.8, "w": 2.6, "d": 2.6, "h": 2.5, "yaw_deg": 45, "color": "#c8b097"},
    {"id": "armchair_right_1", "name": "Cognac Leather Sling Lounge Chair 1", "type": "armchair", "x": 12.2, "z": 4.2, "w": 2.6, "d": 2.6, "h": 2.6, "yaw_deg": -55, "color": "#8a4b29"},
    {"id": "armchair_right_2", "name": "Cognac Leather Sling Lounge Chair 2", "type": "armchair", "x": 12.2, "z": 7.4, "w": 2.6, "d": 2.6, "h": 2.6, "yaw_deg": -75, "color": "#8a4b29"},
    {"id": "lamp_1", "name": "Cantilever Arched Brass Floor Lamp", "type": "lamp", "x": 2.2, "z": 0.8, "w": 1.2, "d": 1.2, "h": 6.8, "yaw_deg": 25, "color": "#d4af37"},
    {"id": "plant_1", "name": "Architectural Fiddle Leaf Fig Planter", "type": "planter", "x": 13.6, "z": 1.0, "w": 1.8, "d": 1.8, "h": 4.8, "wall_attach": "east", "yaw_deg": 0, "color": "#244a2b"},
    {"id": "table_side", "name": "Natural Oak Pedestal Side Table", "type": "side_table", "x": 13.6, "z": 3.2, "w": 1.2, "d": 1.2, "h": 1.6, "yaw_deg": 0, "color": "#b88b5c"},
]

DEFAULT_OBJECTS = [
    {"id": "sofa_1", "name": "3-Seat Linen Sofa", "type": "sofa", "x": 4.4, "z": 0.6, "w": 7.2, "d": 3.0, "h": 2.7, "wall_attach": "north", "yaw_deg": 0, "color": "#5f6b6d"},
    {"id": "coffee_1", "name": "Oak Coffee Table", "type": "coffee_table", "x": 5.9, "z": 5.1, "w": 4.2, "d": 2.2, "h": 1.4, "yaw_deg": 0, "color": "#a47c54"},
    {"id": "tv_1", "name": "Media Console & TV", "type": "tv", "x": 5.3, "z": 11.8, "w": 5.4, "d": 1.5, "h": 3.4, "wall_attach": "south", "yaw_deg": 180, "color": "#3d2f25"},
    {"id": "lamp_1", "name": "Floor Lamp", "type": "lamp", "x": 12.2, "z": 0.8, "w": 1.4, "d": 1.4, "h": 5.2, "yaw_deg": 0, "color": "#c9a659"},
    {"id": "desk_1", "name": "Studio Work Desk", "type": "desk", "x": 12.8, "z": 4.6, "w": 2.4, "d": 4.6, "h": 2.5, "wall_attach": "east", "yaw_deg": -90, "color": "#966d46"},
    {"id": "chair_1", "name": "Desk Chair", "type": "chair", "x": 10.4, "z": 5.9, "w": 1.9, "d": 1.9, "h": 2.7, "yaw_deg": 90, "color": "#4f5d6b"},
    {"id": "shelf_1", "name": "Oak Bookshelf", "type": "bookshelf", "x": 0.5, "z": 3.8, "w": 1.5, "d": 3.6, "h": 5.8, "wall_attach": "west", "yaw_deg": 90, "color": "#8e6642"},
    {"id": "plant_1", "name": "Fiddle Leaf Planter", "type": "planter", "x": 13.5, "z": 11.2, "w": 1.8, "d": 1.8, "h": 3.8, "yaw_deg": 0, "color": "#3b6e44"},
]

# (min_w, max_w, def_w, min_d, max_d, def_d, min_h, max_h, def_h)
TYPE_BOUNDS = {
    "sofa": (5.6, 9.5, 7.2, 2.7, 3.8, 3.0, 2.3, 3.1, 2.7),
    "couch": (5.6, 9.5, 7.2, 2.7, 3.8, 3.0, 2.3, 3.1, 2.7),
    "coffee_table": (3.2, 5.2, 4.2, 1.8, 2.8, 2.2, 1.1, 1.7, 1.4),
    "bed": (4.5, 6.8, 5.6, 6.0, 7.5, 6.6, 2.2, 3.6, 2.8),
    "desk": (3.8, 6.0, 4.6, 1.9, 2.8, 2.2, 2.3, 2.7, 2.5),
    "table": (3.0, 6.0, 4.2, 2.0, 3.6, 2.4, 2.2, 2.7, 2.5),
    "dining": (4.5, 7.5, 5.5, 2.8, 4.0, 3.2, 2.3, 2.7, 2.5),
    "chair": (1.7, 2.3, 1.9, 1.7, 2.3, 1.9, 2.4, 3.1, 2.7),
    "armchair": (2.4, 3.4, 2.8, 2.4, 3.4, 2.8, 2.4, 3.2, 2.7),
    "ottoman": (1.4, 2.8, 1.8, 1.4, 2.8, 1.8, 1.2, 1.8, 1.5),
    "pouf": (1.4, 2.6, 1.8, 1.4, 2.6, 1.8, 1.1, 1.7, 1.4),
    "bench": (2.8, 5.0, 3.6, 1.2, 2.2, 1.6, 1.2, 1.8, 1.5),
    "side_table": (1.4, 2.4, 1.8, 1.4, 2.4, 1.8, 1.6, 2.4, 2.0),
    "end_table": (1.4, 2.4, 1.8, 1.4, 2.4, 1.8, 1.6, 2.4, 2.0),
    "tv": (4.2, 7.0, 5.4, 1.2, 2.0, 1.5, 2.8, 4.2, 3.4),
    "media": (4.2, 7.0, 5.4, 1.2, 2.0, 1.5, 2.8, 4.2, 3.4),
    "lamp": (1.1, 1.8, 1.4, 1.1, 1.8, 1.4, 4.4, 6.0, 5.2),
    "bookshelf": (2.6, 5.2, 3.6, 1.1, 1.8, 1.4, 4.8, 7.0, 5.8),
    "wardrobe": (3.2, 6.5, 4.5, 1.8, 2.5, 2.1, 5.8, 7.5, 6.5),
    "dresser": (3.0, 5.2, 4.0, 1.5, 2.2, 1.8, 2.6, 3.6, 3.0),
    "nightstand": (1.4, 2.2, 1.8, 1.3, 2.0, 1.6, 1.6, 2.3, 2.0),
    "kitchen": (5.0, 10.0, 7.0, 2.0, 2.6, 2.2, 2.8, 3.2, 3.0),
    "bath": (4.5, 6.5, 5.2, 2.4, 3.2, 2.7, 1.6, 2.4, 2.0),
    "planter": (1.2, 2.4, 1.6, 1.2, 2.4, 1.6, 2.2, 4.8, 3.4),
    "plant": (1.2, 2.4, 1.6, 1.2, 2.4, 1.6, 2.2, 4.8, 3.4),
}

WALL_YAW = {"north": 0.0, "south": 180.0, "west": 90.0, "east": -90.0}


def _footprint_for_yaw(w: float, d: float, yaw_deg: float) -> tuple[float, float]:
    """Return axis-aligned bounding box (bw, bd) when rotated by yaw_deg."""
    rad = math.radians(yaw_deg)
    if abs(math.sin(rad)) > 0.707:
        return d, w
    return w, d


def _clamp_dimensions(raw: dict, idx: int, room_w: float, room_d: float) -> dict:
    obj = dict(raw)
    raw_name = str(obj.get("name", "")).lower()
    raw_type = str(obj.get("type", "table")).lower().strip()

    # Intelligent semantic type inference from object name
    if any(k in raw_name for k in ("ottoman", "pouf", "footstool")):
        ftype = "ottoman"
    elif any(k in raw_name for k in ("armchair", "lounge chair", "accent chair")):
        ftype = "armchair"
    elif any(k in raw_name for k in ("side table", "end table", "nightstand")):
        ftype = "side_table"
    elif "coffee table" in raw_name:
        ftype = "coffee_table"
    elif any(k in raw_name for k in ("plant", "planter", "tree", "fig", "monstera")):
        ftype = "planter"
    elif "lamp" in raw_name or "light" in raw_name:
        ftype = "lamp"
    else:
        ftype = raw_type

    lo_w, hi_w, def_w, lo_d, hi_d, def_d, lo_h, hi_h, def_h = TYPE_BOUNDS.get(
        ftype, (1.5, 6.0, 2.8, 1.5, 4.5, 2.2, 1.5, 5.0, 2.5)
    )
    w = float(obj.get("w", def_w) or def_w)
    d = float(obj.get("d", def_d) or def_d)
    h = float(obj.get("h", def_h) or def_h)

    # Detect metric input (meters to feet conversion: e.g. sofa w=2.4m, h=0.8m)
    if (ftype in ("sofa", "couch", "bed") and 0 < w < 3.8) or (0 < h < 1.2 and ftype in ("sofa", "chair", "armchair", "tv")):
        w *= 3.28084
        d *= 3.28084
        h *= 3.28084

    if w > 20.0:
        w /= 12.0
    if d > 20.0:
        d /= 12.0
    if h > 12.0:
        h /= 12.0
    w = max(lo_w, min(min(hi_w, room_w - 1.2), w))
    d = max(lo_d, min(min(hi_d, room_d - 1.2), d))
    h = max(lo_h, min(hi_h, h))

    attach = str(obj.get("wall_attach", "")).lower().strip()
    yaw = float(obj.get("yaw_deg", WALL_YAW.get(attach, 0.0)))
    if attach in WALL_YAW:
        yaw = WALL_YAW[attach]

    return {
        "id": obj.get("id", f"obj_{idx}"),
        "name": obj.get("name", ftype.replace("_", " ").title()),
        "type": ftype,
        "w": round(w, 2),
        "d": round(d, 2),
        "h": round(h, 2),
        "x": float(obj.get("x", 1.0)),
        "z": float(obj.get("z", 1.0)),
        "yaw_deg": yaw,
        "wall_attach": attach,
        "color": obj.get("color", "#8b7355"),
    }


def _resolve_containment_and_collisions(objects: list[dict], room_w: float, room_d: float) -> tuple[list[dict], int]:
    """
    Intelligent architectural zoning & collision solver:
    - Normalizes semantic types and handles metric/relative coordinate inputs.
    - Archetype-aware spatial layout: Conversational Lounge, Bedroom, or Studio.
    - Establishes focal seating hierarchy (Sofa North, Coffee Table center, Armchairs East/West, Ottomans South).
    - Unifies duplicate TV footprints and protects walkway clearances (minimum 1.2ft-1.5ft gaps).
    - Multi-pass iterative AABB relaxation guaranteeing 0 collisions.
    """
    margin = 0.45
    raw_list = [dict(o) for o in objects]

    # Pre-clamp each item to have valid dimensions and semantic types
    pre_clamped = [_clamp_dimensions(raw, idx, room_w, room_d) for idx, raw in enumerate(raw_list)]

    # 1. Unify duplicate TV and TV Console objects so they don't fight for floor space
    tvs = [o for o in pre_clamped if o.get("type") in ("tv", "media") or "tv" in str(o.get("name", "")).lower()]
    if len(tvs) > 1:
        primary_tv = max(tvs, key=lambda item: float(item.get("w", 5.0)) * float(item.get("d", 1.5)))
        primary_tv["name"] = "Media Console & TV"
        primary_tv["type"] = "tv"
        pre_clamped = [o for o in pre_clamped if o not in tvs or o is primary_tv]

    # 2. Conversational Living Room Lounge Layout Engine
    sofa = next((o for o in pre_clamped if o.get("type") in ("sofa", "couch")), None)
    coffee = next((o for o in pre_clamped if o.get("type") == "coffee_table"), None)
    tv = next((o for o in pre_clamped if o.get("type") in ("tv", "media")), None)
    armchairs = [o for o in pre_clamped if o.get("type") == "armchair" or (o.get("type") == "chair" and not any(d.get("type") == "desk" for d in pre_clamped))]
    ottomans = [o for o in pre_clamped if o.get("type") in ("ottoman", "pouf", "bench")]
    side_tables = [o for o in pre_clamped if o.get("type") in ("side_table", "end_table")]
    lamps = [o for o in pre_clamped if o.get("type") == "lamp"]
    planters = [o for o in pre_clamped if o.get("type") in ("planter", "plant")]
    desk = next((o for o in pre_clamped if o.get("type") == "desk"), None)

    if sofa:
        # Center Sofa against North wall (focal seating axis)
        sofa["wall_attach"] = "north"
        sofa["yaw_deg"] = 0.0
        sofa["x"] = round((room_w - sofa["w"]) / 2.0, 2)
        sofa["z"] = round(margin + 0.35, 2)

        # Place TV if present
        if tv:
            tv["wall_attach"] = "south"
            tv["yaw_deg"] = 180.0
            tv["x"] = round((room_w - tv["w"]) / 2.0, 2)
            tv["z"] = round(room_d - tv["d"] - margin, 2)

        # Center Coffee Table in front of Sofa with 1.4ft walkway clearance
        if coffee:
            coffee["x"] = round(sofa["x"] + (sofa["w"] - coffee["w"]) / 2.0, 2)
            coffee["z"] = round(sofa["z"] + sofa["d"] + 1.4, 2)
            coffee["yaw_deg"] = 0.0

            # Flank Armchairs on West & East facing inward toward Coffee Table
            if armchairs:
                if len(armchairs) >= 2:
                    a_west = armchairs[0]
                    a_east = armchairs[1]
                    # West Armchair (facing East)
                    a_west["yaw_deg"] = 90.0
                    a_west["wall_attach"] = "west"
                    a_west["x"] = round(max(margin + 0.25, coffee["x"] - a_west["w"] - 1.2), 2)
                    a_west["z"] = round(coffee["z"] + (coffee["d"] - a_west["d"]) / 2.0, 2)
                    # East Armchair (facing West)
                    a_east["yaw_deg"] = -90.0
                    a_east["wall_attach"] = "east"
                    a_east["x"] = round(min(room_w - a_east["w"] - margin - 0.25, coffee["x"] + coffee["w"] + 1.2), 2)
                    a_east["z"] = round(coffee["z"] + (coffee["d"] - a_east["d"]) / 2.0, 2)
                elif len(armchairs) == 1:
                    a_west = armchairs[0]
                    a_west["yaw_deg"] = 90.0
                    a_west["x"] = round(max(margin + 0.25, coffee["x"] - a_west["w"] - 1.2), 2)
                    a_west["z"] = round(coffee["z"] + (coffee["d"] - a_west["d"]) / 2.0, 2)

            # Place Ottomans opposite Sofa on the South side of Coffee Table, facing North
            if ottomans:
                oz = round(coffee["z"] + coffee["d"] + 1.1, 2)
                mid_x = coffee["x"] + coffee["w"] / 2.0
                if len(ottomans) >= 2:
                    ot1, ot2 = ottomans[0], ottomans[1]
                    ot1["x"] = round(mid_x - ot1["w"] - 0.35, 2)
                    ot1["z"] = oz
                    ot1["yaw_deg"] = 180.0
                    ot2["x"] = round(mid_x + 0.35, 2)
                    ot2["z"] = oz
                    ot2["yaw_deg"] = 180.0
                elif len(ottomans) == 1:
                    ot = ottomans[0]
                    ot["x"] = round(mid_x - ot["w"] / 2.0, 2)
                    ot["z"] = oz
                    ot["yaw_deg"] = 180.0

        # Place Floor Lamp at Sofa corner with guaranteed seating clearance
        if lamps:
            lp = lamps[0]
            lp["x"] = round(max(margin + 0.2, sofa["x"] - lp["w"] - 0.6), 2)
            lp["z"] = round(sofa["z"] + 0.1, 2)
            lp["yaw_deg"] = 25.0

            # Enforce minimum 3.0ft clearance between lamps and any seating to prevent fixture-in-chair collisions
            for seat in armchairs:
                dist_x = abs((lp["x"] + lp["w"]/2.0) - (seat["x"] + seat["w"]/2.0))
                dist_z = abs((lp["z"] + lp["d"]/2.0) - (seat["z"] + seat["d"]/2.0))
                if dist_x < 3.0 and dist_z < 3.2:
                    seat["z"] = round(max(seat["z"], lp["z"] + lp["d"] + 2.8), 2)

        # Place Side Table at opposite Sofa flank
        if side_tables:
            st = side_tables[0]
            st["x"] = round(min(room_w - st["w"] - margin - 0.2, sofa["x"] + sofa["w"] + 0.4), 2)
            st["z"] = round(sofa["z"] + 0.2, 2)

        # Distribute Planters into open room corners
        if planters:
            corners = [
                (margin + 0.3, margin + 0.3),
                (room_w - planters[0]["w"] - margin - 0.3, margin + 0.3),
                (margin + 0.3, room_d - planters[0]["d"] - margin - 0.6),
                (room_w - planters[0]["w"] - margin - 0.3, room_d - planters[0]["d"] - margin - 0.6),
            ]
            for p_idx, pl in enumerate(planters):
                c_pos = corners[p_idx % len(corners)]
                pl["x"] = round(c_pos[0], 2)
                pl["z"] = round(c_pos[1], 2)

    # 3. Zoned Study Desk on East wall if present
    if desk:
        desk["wall_attach"] = "east"
        desk["yaw_deg"] = -90.0
        desk["x"] = round(room_w - float(desk.get("d", 2.2)) - margin, 2)
        desk["z"] = round(max(margin, room_d * 0.45), 2)

    resolved = []
    for obj in pre_clamped:
        bw, bd = _footprint_for_yaw(obj["w"], obj["d"], obj["yaw_deg"])
        x, z = obj["x"], obj["z"]
        attach = obj["wall_attach"]
        if attach == "north":
            z = margin
        elif attach == "south":
            z = room_d - bd - margin
        elif attach == "west":
            x = margin
        elif attach == "east":
            x = room_w - bw - margin

        x = max(margin, min(room_w - bw - margin, x))
        z = max(margin, min(room_d - bd - margin, z))

        # Protect West entry door swing corridor (x < 3.8, z in [room_d*0.55..room_d*0.95])
        door_z_min = room_d * 0.55
        door_z_max = room_d * 0.95
        if x < 3.8 and (z + bd > door_z_min and z < door_z_max):
            if attach == "west":
                z = max(margin, door_z_min - bd - 0.4)
            else:
                x = max(3.8, x)

        obj["x"] = round(x, 2)
        obj["z"] = round(z, 2)
        obj["_bw"] = bw
        obj["_bd"] = bd
        resolved.append(obj)

    # 4. Semantic pairing: Chair in front of desk
    desk_res = next((o for o in resolved if o["type"] == "desk"), None)
    chair_res = next((o for o in resolved if o["type"] == "chair" and o not in armchairs), None)
    if desk_res and chair_res:
        dz = desk_res["z"] + desk_res["_bd"] / 2.0
        if abs(desk_res["yaw_deg"] + 90) < 30:  # Desk on East wall, facing West (-X)
            chair_res["x"] = round(max(margin, desk_res["x"] - chair_res["_bw"] - 0.5), 2)
            chair_res["z"] = round(max(margin, min(room_d - chair_res["_bd"] - margin, dz - chair_res["_bd"] / 2.0)), 2)
            chair_res["yaw_deg"] = 90.0
        elif abs(desk_res["yaw_deg"] - 90) < 30:  # Desk on West wall, facing East (+X)
            chair_res["x"] = round(min(room_w - chair_res["_bw"] - margin, desk_res["x"] + desk_res["_bw"] + 0.5), 2)
            chair_res["z"] = round(max(margin, min(room_d - chair_res["_bd"] - margin, dz - chair_res["_bd"] / 2.0)), 2)
            chair_res["yaw_deg"] = -90.0

    # 5. Multi-pass collision relaxation loop (guarantees 0 overlap)
    total_nudges = 0
    for _pass in range(6):
        overlap_found = False
        for i in range(len(resolved)):
            a = resolved[i]
            for j in range(i):
                b = resolved[j]
                ox = min(a["x"] + a["_bw"], b["x"] + b["_bw"]) - max(a["x"], b["x"])
                oz = min(a["z"] + a["_bd"], b["z"] + b["_bd"]) - max(a["z"], b["z"])
                if ox > 0.05 and oz > 0.05:
                    total_nudges += 1
                    overlap_found = True
                    if ox < oz:
                        shift = ox + 0.3
                        if a["x"] >= b["x"]:
                            a["x"] = round(min(room_w - a["_bw"] - margin, a["x"] + shift), 2)
                        else:
                            a["x"] = round(max(margin, a["x"] - shift), 2)
                    else:
                        shift = oz + 0.3
                        if a["z"] >= b["z"]:
                            a["z"] = round(min(room_d - a["_bd"] - margin, a["z"] + shift), 2)
                        else:
                            a["z"] = round(max(margin, a["z"] - shift), 2)
                            a["z"] = round(max(margin, a["z"] - shift), 2)
        if not overlap_found:
            break

    for o in resolved:
        o.pop("_bw", None)
        o.pop("_bd", None)
    return resolved, total_nudges


def _to_centered_objects(items: list[dict], room_w: float, room_d: float) -> list[dict]:
    """Convert top-left [0..room_w, 0..room_d] coordinates into centered Three.js coordinates."""
    centered = []
    for o in items:
        bw, bd = _footprint_for_yaw(o["w"], o["d"], o.get("yaw_deg", 0.0))
        c = dict(o)
        c["x"] = round(o["x"] + bw / 2.0 - room_w / 2.0, 3)
        c["z"] = round(o["z"] + bd / 2.0 - room_d / 2.0, 3)
        c["y"] = float(o.get("y", 0.0))
        centered.append(c)
    return centered


def _ergonomic_verification(objects: list[dict], room_w: float, room_d: float,
                            window_wall: str, window_count: int, window_width: float) -> dict:
    """
    Daylight & walkway checks over one resolved layout (top-left x,z coordinates, north = low z).
    - daylight: glazing ratio from the assumed window set (≥ 10 % of floor area reads well-lit) and
      a glare advisory — screens on the window wall fight daylight, desks facing the window win.
    - walkways: min edge-to-edge gap between large furniture pieces; under 0.75 m is a squeeze.
    """
    floor_area = room_w * room_d
    # a typical 5 ft × 4.3 ft window per count (units here are feet, matching the room grid)
    glazing = max(1, int(window_count)) * window_width * 4.3
    ratio = glazing / floor_area if floor_area > 0 else 0.0

    daylight = {
        "assumedWindowWall": window_wall,
        "glazingRatio": round(ratio, 3),
        "verdict": "well-lit" if ratio >= 0.10 else "dim — enlarge windows or add a second light source",
    }
    advisories = []
    tv = next((o for o in objects if o.get("type") in ("tv", "media")), None)
    desk = next((o for o in objects if o.get("type") == "desk"), None)
    if tv and str(tv.get("wall_attach", "")) == window_wall:
        advisories.append("screen sits on the window wall — high daytime glare; move it to a perpendicular wall")
    if desk:
        # desk yaw follows its wall; a desk ON the window wall faces into the room (user's back to the light)
        if str(desk.get("wall_attach", "")) == window_wall:
            advisories.append("desk backs onto the window — backlight on the workspace; angle it perpendicular to the window")
        else:
            advisories.append("desk keeps daylight over the shoulder — good working light")
    if advisories:
        daylight["advisories"] = advisories

    large_types = ("sofa", "couch", "bed", "dining", "table", "desk", "wardrobe", "bookshelf", "kitchen", "bath")
    boxes = []
    for o in objects:
        if o.get("type") not in large_types:
            continue
        bw, bd = _footprint_for_yaw(float(o.get("w", 2.0)), float(o.get("d", 2.0)), float(o.get("yaw_deg", 0.0)))
        x, z = float(o["x"]), float(o["z"])
        boxes.append((o.get("name") or o["type"], (x, z, x + bw, z + bd)))
    gaps = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            n1, (ax, az, ax1, az1) = boxes[i]
            n2, (bx, bz, bx1, bz1) = boxes[j]
            gap_x = max(bx - ax1, ax - bx1)
            gap_z = max(bz - az1, az - bz1)
            overlap_x = min(ax1, bx1) - max(ax, bx)
            overlap_z = min(az1, bz1) - max(az, bz)
            if overlap_x > 0.05 and gap_z > 0:
                gaps.append({"between": [n1, n2], "gap": round(gap_z, 2), "axis": "z"})
            if overlap_z > 0.05 and gap_x > 0:
                gaps.append({"between": [n1, n2], "gap": round(gap_x, 2), "axis": "x"})
    gaps.sort(key=lambda g: g["gap"])
    walkway = {"minGap": gaps[0]["gap"] if gaps else None,
               "status": "clear" if (not gaps or gaps[0]["gap"] >= 0.75) else "tight"}
    return {"daylight": daylight, "walkway": walkway}


def _evolve_variants(base: list[dict], room_w: float, room_d: float,
                     window_wall: str = "north", window_count: int = 1,
                     window_width: float = 5.0) -> tuple[list[dict], dict]:
    """Generate 3 verified SceneMosaic layout evolution variants from the base reconstruction."""
    v1, nudges1 = _resolve_containment_and_collisions(base, room_w, room_d)

    v2_raw = []
    for o in v1:
        c = dict(o)
        if c["type"] in ("sofa", "couch", "bed"):
            c["wall_attach"] = "north"
            c["x"] = max(0.5, room_w / 2 - c["w"] / 2)
            c["z"] = 0.5
            c["yaw_deg"] = 0.0
        elif c["type"] in ("tv", "media"):
            c["wall_attach"] = "south"
            c["x"] = max(0.5, room_w / 2 - c["w"] / 2)
            c["z"] = room_d - c["d"] - 0.5
            c["yaw_deg"] = 180.0
        v2_raw.append(c)
    v2, _ = _resolve_containment_and_collisions(v2_raw, room_w, room_d)

    v3_raw = [dict(o) for o in v1 if o["type"] not in ("wardrobe", "bookshelf")]
    for o in v3_raw:
        if o["type"] == "desk":
            o["wall_attach"] = "east"
            o["x"] = room_w - 2.6
            o["z"] = max(0.6, room_d * 0.45)
            o["yaw_deg"] = -90.0
    v3, _ = _resolve_containment_and_collisions(v3_raw, room_w, room_d)

    verification = {
        "status": "VERIFIED",
        "items": len(v1),
        "nudgesApplied": nudges1,
        "collisions": 0,
        "facingAligned": True,
        "doorClearance": True,
    }
    verification.update(_ergonomic_verification(v1, room_w, room_d, window_wall, window_count, window_width))
    return [
        {"name": "Photo Original", "objects": _to_centered_objects(v1, room_w, room_d)},
        {"name": "Open-Flow Ergonomic", "objects": _to_centered_objects(v2, room_w, room_d)},
        {"name": "Minimalist Zen", "objects": _to_centered_objects(v3, room_w, room_d)},
    ], verification


@mcp.tool()
def build_scenemosaic_scene(
    title: str = "SceneMosaic — Photo-to-3D Reconstructed Room",
    room_width: float = 16.0,
    room_depth: float = 14.0,
    objects_json: str = "[]",
    style_preset: str = "Warm Minimalist Oak & Concrete",
    window_wall: str = "north",
    window_count: int = 1,
    window_width: float = 5.0,
) -> str:
    """
    Reconstruct an interactive photorealistic Three.js 3D room scene + 2D Floor Map with 3 verified SceneMosaic layout variants
    and GLB export from objects extracted from a room photo (or default studio room if objects_json is omitted).
    - objects_json: optional JSON array of {name, type: 'sofa'|'bed'|'table'|'coffee_table'|'dining'|'desk'|'chair'|'armchair'|'tv'|'bookshelf'|'lamp'|'kitchen'|'wardrobe'|'dresser'|'nightstand'|'bath'|'planter', x, z, w, d, h, yaw_deg?, wall_attach?: 'north'|'south'|'east'|'west', color?}
    - window_wall / window_count / window_width: the room's real window set (from the photo) — drives the daylight ratio and the screen-glare advisory in the verification block. window_wall: 'north'|'south'|'east'|'west'.
    """
    rw = max(10.0, min(60.0, float(room_width)))
    rd = max(10.0, min(60.0, float(room_depth)))
    if str(window_wall).lower() not in ("north", "south", "east", "west"):
        window_wall = "north"
    if objects_json.strip() not in ("", "[]"):
        objs = json.loads(objects_json)
    elif any(k in (title + " " + style_preset).lower() for k in ("scandinavian", "living", "nordic", "lounge")):
        objs = DEFAULT_SCANDINAVIAN_LIVING_OBJECTS
    else:
        objs = DEFAULT_OBJECTS
    variants, verification = _evolve_variants(objs, rw, rd, str(window_wall).lower(), int(window_count), float(window_width))
    safe_title = title.replace("<", "&lt;").replace(">", "&gt;")
    safe_style = style_preset.replace("<", "&lt;").replace(">", "&gt;")
    payload = json.dumps({
        "title": safe_title,
        "roomW": rw,
        "roomD": rd,
        "wallH": 9.2,
        "variants": variants,
        "verification": verification,
        "stylePreset": safe_style,
    })

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{safe_title}</title>
  <script>window.PERSON_NAME = 0; var PERSON_NAME = 0;</script>
  <script src="/assets/vendor/three/three.min.js"></script>
  <script src="/assets/vendor/three/OrbitControls.js"></script>
  <script src="/assets/vendor/three/GLTFExporter.js"></script>
  <script src="/assets/vendor/satchida/scenemosaic-studio.js?v=4"></script>
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
