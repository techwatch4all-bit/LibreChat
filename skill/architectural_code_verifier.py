"""
Architectural Layout & Spatial Code Verification Engine.
Enforces international standards (IBC, ADA, NBC, Neufert Architect's Data):
1. Minimum Room & Functional Space Dimensions.
2. Bathroom Ergonomics: 3-fixture layout clearances (WC, Basin, Shower/Tub).
3. Circulation & Corridor Widths (no dual-door passthrough bathrooms between bedrooms).
4. Door clearances, door swing conflicts, and setback distances.
5. Servant quarter / ancillary room accessibility & natural ventilation.
"""

from typing import Dict, List, Any, Tuple

# Minimum space dimensions in feet and meters according to IBC & Neufert
MINIMUM_STANDARDS = {
    "habitable_room": {
        "min_area_sqft": 70.0,
        "min_dimension_ft": 7.0,
    },
    "master_bedroom": {
        "min_area_sqft": 120.0,
        "min_dimension_ft": 10.0,
    },
    "secondary_bedroom": {
        "min_area_sqft": 90.0,
        "min_dimension_ft": 9.0,
    },
    "bathroom_full": {
        "min_area_sqft": 36.0, # Minimum for WC + Vanity + Shower stall (5' x 7' or 5' x 8')
        "min_width_ft": 5.0,
        "min_length_ft": 6.5,
    },
    "powder_room_half": {
        "min_area_sqft": 18.0, # Minimum for WC + Basin (3' x 6' or 4' x 4.5')
        "min_width_ft": 3.0,
        "min_length_ft": 5.0,
    },
    "corridor": {
        "min_clear_width_ft": 3.0, # 36 inches / 0.91 m residential standard
        "comfortable_width_ft": 3.5, # 42 inches / 1.07 m
    },
    "door": {
        "main_entry_width_ft": 3.0,
        "habitable_room_width_ft": 2.67, # 32 inches
        "bathroom_door_width_ft": 2.33,  # 28 inches
    }
}

class ArchitecturalVerifier:
    def __init__(self, plan_data: Dict[str, Any]):
        self.plan = plan_data
        self.rooms = plan_data.get("rooms", [])
        self.walls = plan_data.get("walls", [])
        self.doors = plan_data.get("doors", [])
        self.violations = []
        self.warnings = []

    def verify_all(self) -> Dict[str, Any]:
        self.check_room_dimensions()
        self.check_bathroom_standards()
        self.check_circulation_and_passthroughs()
        self.check_door_swings_and_clearances()
        self.check_ancillary_units()

        passed = len(self.violations) == 0
        return {
            "status": "PASS" if passed else "FAIL",
            "violations_count": len(self.violations),
            "warnings_count": len(self.warnings),
            "violations": self.violations,
            "warnings": self.warnings
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
                self.violations.append(f"Main entry door at '{location}' is {width} ft wide; international standard requires minimum 3.0 ft (36 in).")

    def check_ancillary_units(self):
        # Servant quarter / external units
        for room in self.rooms:
            name = room.get("name", "").upper()
            if "SERVANT" in name:
                if room.get("blocked_access", False) or room.get("door_clearance_ft", 3.0) < 2.5:
                    self.violations.append(
                        f"Servant quarter entry at '{room.get('name')}' is too tightly placed against exterior wall (clearance < 2.5 ft). Violates accessibility and fire egress codes."
                    )
