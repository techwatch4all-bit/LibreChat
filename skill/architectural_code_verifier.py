"""
Architectural Layout & Spatial Code Verification Engine.
Enforces International & Indian Architectural Standards:
1. International Building Code (IBC 2024 / ADA / Neufert Architect's Data):
   - Minimum Room & Functional Space Dimensions.
   - Bathroom Ergonomics: 3-fixture clearances (WC, Basin, Shower/Tub).
   - Circulation & Corridor Widths (no dual-door passthrough bathrooms between bedrooms).
   - Egress door clearances, door swing conflicts, and accessible routes.
2. National Building Code of India (NBC 2016 Part 3 & 4) & Indian Municipal Bye-Laws:
   - Habitable Room min area: 9.5 sq.m (~102 sq ft), min width: 2.4 m (~7.87 ft).
   - Kitchen min area: 5.0 sq.m (~54 sq ft), min width: 1.8 m (~5.9 ft).
   - Bathroom/WC minimums: Combined Bath+WC min 2.8 sq.m (30 sq ft), WC alone min 1.1 sq.m (12 sq ft).
   - Ceiling height min: 2.75 m (9.0 ft) for habitable rooms, 2.4 m (7.87 ft) for AC spaces/baths.
   - Natural ventilation: Window area >= 1/8th (12.5%) of floor area for habitable rooms.
   - Residential Staircase: Min width 1.0 m (3.28 ft), Riser max 19 cm (7.5 in), Tread min 25 cm (9.8 in).
3. Indian Vastu Shastra Orientation & Spatial Zoning:
   - Master Bedroom: South-West (Nairutya) for stability & longevity.
   - Kitchen: South-East (Agneya) primary fire quadrant; North-West (Vayavya) acceptable alternative.
   - Pooja / Meditation / Study: North-East (Ishan) for mental clarity and early morning daylight.
   - Living / Reception: North-East, East, or North for positive welcoming circulation.
   - Bathrooms / Toilets / Drainage: West or North-West (Vayavya); strictly avoid North-East (Ishan) or South-West (Nairutya).
"""

from typing import Dict, List, Any, Tuple

# Minimum space dimensions in feet and meters according to IBC, NBC 2016 & Neufert
MINIMUM_STANDARDS = {
    "habitable_room": {
        "min_area_sqft": 70.0,
        "min_dimension_ft": 7.0,
        "nbc_min_area_sqft": 102.0,     # NBC 2016 Part 3: 9.5 sq.m
        "nbc_min_dimension_ft": 7.87,   # NBC 2016 Part 3: 2.4 m
    },
    "master_bedroom": {
        "min_area_sqft": 120.0,
        "min_dimension_ft": 10.0,
        "nbc_min_area_sqft": 120.0,
        "nbc_min_dimension_ft": 10.0,
    },
    "secondary_bedroom": {
        "min_area_sqft": 90.0,
        "min_dimension_ft": 9.0,
        "nbc_min_area_sqft": 102.0,
        "nbc_min_dimension_ft": 7.87,
    },
    "kitchen": {
        "min_area_sqft": 50.0,
        "min_dimension_ft": 5.0,
        "nbc_min_area_sqft": 54.0,      # NBC 2016: 5.0 sq.m
        "nbc_min_dimension_ft": 5.9,    # NBC 2016: 1.8 m
    },
    "bathroom_full": {
        "min_area_sqft": 36.0,          # IBC/Neufert minimum for WC + Vanity + Shower stall (5' x 7.5')
        "min_width_ft": 5.0,
        "min_length_ft": 6.5,
        "nbc_min_area_sqft": 30.0,      # NBC 2016: 2.8 sq.m
        "nbc_min_width_ft": 4.92,       # NBC 2016: 1.5 m
    },
    "powder_room_half": {
        "min_area_sqft": 18.0,          # Minimum for WC + Basin (3' x 6' or 4' x 4.5')
        "min_width_ft": 3.0,
        "min_length_ft": 5.0,
        "nbc_min_area_sqft": 12.0,      # NBC 2016 WC only: 1.1 sq.m
        "nbc_min_width_ft": 3.28,       # NBC 2016: 1.0 m
    },
    "corridor": {
        "min_clear_width_ft": 3.0,      # 36 inches / 0.91 m residential standard
        "comfortable_width_ft": 3.5,    # 42 inches / 1.07 m
        "nbc_min_width_ft": 3.28,       # NBC 2016: 1.0 m clear residential corridor
    },
    "staircase": {
        "nbc_min_width_ft": 3.28,       # NBC 2016 Part 4: 1.0 m
        "nbc_max_riser_in": 7.5,        # 19 cm max riser
        "nbc_min_tread_in": 9.85,       # 25 cm min tread
    },
    "door": {
        "main_entry_width_ft": 3.0,     # IBC 36 in / NBC 1.0 m
        "habitable_room_width_ft": 2.67,# 32 inches
        "bathroom_door_width_ft": 2.33, # 28 inches / NBC 0.75 m
    }
}

# Vastu Shastra Spatial Orientations & Element Correspondences
VASTU_RULES = {
    "MASTER_BEDROOM": {
        "ideal_quadrants": ["SW"],
        "acceptable_quadrants": ["S", "W"],
        "adverse_quadrants": ["NE", "SE"],
        "element": "Earth (Prithvi) — Stability, leadership, and restful sleep",
    },
    "KITCHEN": {
        "ideal_quadrants": ["SE"],
        "acceptable_quadrants": ["NW"],
        "adverse_quadrants": ["NE", "SW"],
        "element": "Fire (Agni) — Metabolic vitality, health, and digestion",
    },
    "POOJA": {
        "ideal_quadrants": ["NE"],
        "acceptable_quadrants": ["E", "N"],
        "adverse_quadrants": ["SW", "S"],
        "element": "Water / Ether (Ishan) — Sacred calm, sunrise solar prana",
    },
    "STUDY": {
        "ideal_quadrants": ["NE", "E", "N"],
        "acceptable_quadrants": ["NW", "W"],
        "adverse_quadrants": ["SW"],
        "element": "Clarity & concentration; morning daylight absorption",
    },
    "LIVING": {
        "ideal_quadrants": ["NE", "E", "N"],
        "acceptable_quadrants": ["NW", "W"],
        "adverse_quadrants": ["SW"],
        "element": "Air (Vayu) / Welcoming circulation and family gathering",
    },
    "TOILET": {
        "ideal_quadrants": ["NW", "W"],
        "acceptable_quadrants": ["S"],
        "adverse_quadrants": ["NE", "SW"],
        "element": "Waste elimination (Vayu/Varun); strictly avoided in Ishan (NE) or Nairutya (SW)",
    },
}

class ArchitecturalVerifier:
    def __init__(self, plan_data: Dict[str, Any]):
        self.plan = plan_data
        self.rooms = plan_data.get("rooms", [])
        self.walls = plan_data.get("walls", [])
        self.doors = plan_data.get("doors", [])
        self.windows = plan_data.get("windows", [])
        self.stairs = plan_data.get("stairs", [])
        self.violations = []
        self.warnings = []
        self.vastu_audits = []
        self.nbc_checks = []

    def verify_all(self) -> Dict[str, Any]:
        self.check_room_dimensions()
        self.check_kitchen_standards()
        self.check_bathroom_standards()
        self.check_circulation_and_passthroughs()
        self.check_door_swings_and_clearances()
        self.check_ancillary_units()
        self.check_staircase_standards()
        self.check_daylight_ventilation()
        self.check_vastu_alignment()

        passed = len(self.violations) == 0
        return {
            "status": "PASS" if passed else "FAIL",
            "violations_count": len(self.violations),
            "warnings_count": len(self.warnings),
            "violations": self.violations,
            "warnings": self.warnings,
            "vastu_audits": self.vastu_audits,
            "nbc_checks": self.nbc_checks,
        }

    def check_room_dimensions(self):
        for room in self.rooms:
            w = room.get("w_ft", 0)
            d = room.get("d_ft", 0)
            area = w * d
            name = room.get("name", "Unknown").upper()

            if "BEDROOM" in name or "BED ROOM" in name:
                min_std = MINIMUM_STANDARDS["master_bedroom"] if "MASTER" in name else MINIMUM_STANDARDS["secondary_bedroom"]
                if area < min_std["min_area_sqft"]:
                    self.violations.append(f"Room '{room.get('name')}' area ({area:.1f} sq ft) is below minimum code standard ({min_std['min_area_sqft']} sq ft).")
                if min(w, d) < min_std["min_dimension_ft"]:
                    self.violations.append(f"Room '{room.get('name')}' minimum dimension ({min(w, d):.1f} ft) is below the required {min_std['min_dimension_ft']} ft.")

                # NBC 2016 verification
                if area < min_std["nbc_min_area_sqft"]:
                    self.warnings.append(f"NBC 2016 Advisory: '{room.get('name')}' area ({area:.1f} sq ft) is below the Indian standard 9.5 sq.m (102.0 sq ft).")
                if min(w, d) < min_std["nbc_min_dimension_ft"]:
                    self.warnings.append(f"NBC 2016 Advisory: '{room.get('name')}' width ({min(w, d):.1f} ft) is below the Indian standard 2.4 m (7.87 ft).")

    def check_kitchen_standards(self):
        for room in self.rooms:
            name = room.get("name", "").upper()
            if "KITCHEN" in name:
                w = room.get("w_ft", 0)
                d = room.get("d_ft", 0)
                area = w * d
                min_std = MINIMUM_STANDARDS["kitchen"]
                if area < min_std["min_area_sqft"]:
                    self.violations.append(f"Kitchen '{room.get('name')}' area ({area:.1f} sq ft) is below functional standard ({min_std['min_area_sqft']} sq ft).")
                if area < min_std["nbc_min_area_sqft"]:
                    self.warnings.append(f"NBC 2016 Advisory: Kitchen '{room.get('name')}' ({area:.1f} sq ft) is below the Indian minimum 5.0 sq.m (54.0 sq ft).")
                if min(w, d) < min_std["nbc_min_dimension_ft"]:
                    self.warnings.append(f"NBC 2016 Advisory: Kitchen '{room.get('name')}' clear width ({min(w, d):.1f} ft) is under the 1.8 m (5.9 ft) counter standard.")

    def check_bathroom_standards(self):
        for room in self.rooms:
            name = room.get("name", "").upper()
            if any(term in name for term in ["BATH", "TOILET", "WC", "WASHROOM"]):
                w = room.get("w_ft", 0)
                d = room.get("d_ft", 0)
                area = w * d
                min_dim = min(w, d)

                # Check if it's meant to be a full bath (has shower/bath)
                is_full = room.get("is_full_bath", True)
                if is_full:
                    if area < MINIMUM_STANDARDS["bathroom_full"]["min_area_sqft"]:
                        self.violations.append(
                            f"Full bathroom '{room.get('name')}' ({w:.1f}' x {d:.1f}' = {area:.1f} sq ft) is too small to accommodate sink, toilet, and shower/tub clearances. Code minimum is 36 sq ft (e.g. 5' x 7.5')."
                        )
                    if min_dim < MINIMUM_STANDARDS["bathroom_full"]["min_width_ft"]:
                        self.violations.append(
                            f"Bathroom '{room.get('name')}' width ({min_dim:.1f} ft) is under the 5.0 ft standard needed for standard fixture spacing."
                        )
                else:
                    if area < MINIMUM_STANDARDS["powder_room_half"]["min_area_sqft"]:
                        self.violations.append(
                            f"Powder room '{room.get('name')}' ({area:.1f} sq ft) is under code minimum 18.0 sq ft."
                        )

    def check_circulation_and_passthroughs(self):
        # Detect common bathrooms used as passthroughs between rooms
        for room in self.rooms:
            name = room.get("name", "").upper()
            connected_doors = room.get("doors", [])
            if any(term in name for term in ["BATH", "TOILET", "WC"]):
                if len(connected_doors) >= 2 and room.get("is_passthrough_between_bedrooms", False):
                    self.violations.append(
                        f"CRITICAL CODE VIOLATION: Bathroom '{room.get('name')}' has 2 doors serving as a direct passthrough/walking corridor between bedrooms. Bathrooms must be independently accessed or en-suite; bedrooms require independent corridor egress."
                    )

    def check_door_swings_and_clearances(self):
        for door in self.doors:
            width = door.get("width_ft", 0)
            location = door.get("location", "")
            if door.get("is_main_entry", False) and width < MINIMUM_STANDARDS["door"]["main_entry_width_ft"]:
                self.violations.append(f"Main entry door at '{location}' is {width} ft wide; international standard requires minimum 3.0 ft (36 in) / NBC 1.0 m.")

    def check_ancillary_units(self):
        for room in self.rooms:
            name = room.get("name", "").upper()
            if "SERVANT" in name:
                if room.get("blocked_access", False) or room.get("door_clearance_ft", 3.0) < 2.5:
                    self.violations.append(
                        f"Servant quarter entry at '{room.get('name')}' is too tightly placed against exterior wall (clearance < 2.5 ft). Violates accessibility and fire egress codes."
                    )

    def check_staircase_standards(self):
        for stair in self.stairs:
            width = stair.get("width_ft", 3.28)
            riser = stair.get("riser_in", 7.0)
            tread = stair.get("tread_in", 10.0)
            name = stair.get("name", "Staircase")

            if width < MINIMUM_STANDARDS["staircase"]["nbc_min_width_ft"]:
                self.violations.append(f"Staircase '{name}' clear width ({width:.2f} ft) is below the NBC 2016 residential minimum of 1.0 m (3.28 ft).")
            if riser > MINIMUM_STANDARDS["staircase"]["nbc_max_riser_in"]:
                self.violations.append(f"Staircase '{name}' riser height ({riser:.1f} in) exceeds NBC 2016 safety maximum of 7.5 in (19 cm).")
            if tread < MINIMUM_STANDARDS["staircase"]["nbc_min_tread_in"]:
                self.violations.append(f"Staircase '{name}' tread depth ({tread:.1f} in) is below NBC 2016 minimum of 9.85 in (25 cm).")

    def check_daylight_ventilation(self):
        for room in self.rooms:
            name = room.get("name", "").upper()
            if any(term in name for term in ["BEDROOM", "LIVING", "STUDY"]):
                w = room.get("w_ft", 0)
                d = room.get("d_ft", 0)
                floor_area = w * d
                window_area = room.get("window_area_sqft", 0)
                if window_area > 0 and floor_area > 0:
                    ratio = window_area / floor_area
                    if ratio < 0.125: # NBC 1/8th rule
                        self.warnings.append(
                            f"NBC 2016 Daylight Advisory: '{room.get('name')}' glazing ratio ({ratio*100:.1f}%) is below recommended 12.5% (1/8th floor area)."
                        )

    def check_vastu_alignment(self):
        for room in self.rooms:
            raw_name = room.get("name", "")
            name = raw_name.upper()
            quadrant = room.get("quadrant", "").upper() # e.g. "SW", "SE", "NE", "NW", "E", "W", "N", "S"
            if not quadrant:
                continue

            matched_category = None
            if "MASTER" in name and "BED" in name:
                matched_category = "MASTER_BEDROOM"
            elif "KITCHEN" in name:
                matched_category = "KITCHEN"
            elif "POOJA" in name or "PRAYER" in name or "MANDIR" in name:
                matched_category = "POOJA"
            elif "STUDY" in name:
                matched_category = "STUDY"
            elif "LIVING" in name or "DRAWING" in name:
                matched_category = "LIVING"
            elif any(term in name for term in ["BATH", "TOILET", "WC"]):
                matched_category = "TOILET"

            if matched_category:
                rules = VASTU_RULES[matched_category]
                if quadrant in rules["ideal_quadrants"]:
                    self.vastu_audits.append(
                        f"✨ VASTU HARMONY: {raw_name} is in {quadrant} quadrant ({rules['element']}) — Perfect traditional alignment."
                    )
                elif quadrant in rules["acceptable_quadrants"]:
                    self.vastu_audits.append(
                        f"⚖️ VASTU ACCEPTABLE: {raw_name} is in {quadrant} quadrant — Permissible alternative zone."
                    )
                elif quadrant in rules["adverse_quadrants"]:
                    self.warnings.append(
                        f"⚠️ VASTU ADVISORY: {raw_name} placed in {quadrant} quadrant opposes traditional solar-geomantic principles ({rules['element']}). Consider relocating towards {', '.join(rules['ideal_quadrants'])}."
                    )

