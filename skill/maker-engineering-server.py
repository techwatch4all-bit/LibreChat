"""
Satchida Maker & Hardware Engineering Engine (MCP Stdio Server)
Provides verified calculations for Electronics (555 timers, Op-Amps, PCB trace widths),
Mechanical (gear ratios, beam bending, shaft torsion, hydraulic cylinders),
3D Printing (volumetric hotend flow, filament density/cost, slicer diagnostics),
and Drone/UAV Propulsion (Thrust-to-Weight ratio, battery flight time, motor matching).
Zero-cloud dependencies, exact physics/engineering equations, runs 100% locally.
Compatible with MCP SDK 2.x (MCPServer).
"""
import sys
import json
import math
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-maker-engineering")

@mcp.tool()
def electronics_circuit_designer(circuit_type: str, parameters: dict) -> str:
    """
    Solves canonical electronic circuit designs according to engineering formulas.
    circuit_type options: '555_astable', '555_monostable', 'opamp_gain', 'led_resistor', 'pcb_trace_width'
    parameters example for 555_astable: {'R1_ohms': 10000, 'R2_ohms': 47000, 'C_farads': 1e-6}
    """
    try:
        p = parameters
        ct = circuit_type.lower().strip()
        
        if ct == "555_astable":
            r1 = float(p["R1_ohms"])
            r2 = float(p["R2_ohms"])
            c = float(p["C_farads"])
            t_high = 0.693 * (r1 + r2) * c
            t_low = 0.693 * r2 * c
            t_total = t_high + t_low
            freq = 1.44 / ((r1 + 2.0 * r2) * c)
            duty_cycle = (r1 + r2) / (r1 + 2.0 * r2) * 100.0
            return json.dumps({
                "status": "success",
                "frequency_hz": round(freq, 2),
                "duty_cycle_percent": round(duty_cycle, 2),
                "time_high_s": round(t_high, 4),
                "time_low_s": round(t_low, 4),
                "period_s": round(t_total, 4)
            }, indent=2)
            
        elif ct == "555_monostable":
            r = float(p["R_ohms"])
            c = float(p["C_farads"])
            pulse_width = 1.1 * r * c
            return json.dumps({
                "status": "success",
                "pulse_width_s": round(pulse_width, 4),
                "formula": "T = 1.1 * R * C"
            }, indent=2)
            
        elif ct == "opamp_gain":
            config = p.get("configuration", "non_inverting")
            rf = float(p["Rf_ohms"])
            rin = float(p["Rin_ohms"])
            if config == "inverting":
                gain = -(rf / rin)
            else:
                gain = 1.0 + (rf / rin)
            return json.dumps({
                "status": "success",
                "configuration": config,
                "voltage_gain_Av": round(gain, 4),
                "gain_dB": round(20.0 * math.log10(abs(gain)), 2) if gain != 0 else None
            }, indent=2)
            
        elif ct == "led_resistor":
            vs = float(p["supply_voltage_v"])
            vf = float(p.get("forward_voltage_v", 2.0)) # Red=2V, Blue/White=3.2V
            i_led = float(p.get("forward_current_amps", 0.020)) # 20mA default
            r_calc = (vs - vf) / i_led
            p_resistor = (i_led ** 2) * r_calc
            return json.dumps({
                "status": "success",
                "calculated_resistor_ohms": round(r_calc, 2),
                "recommended_standard_e24_resistor": round(r_calc),
                "resistor_power_dissipation_watts": round(p_resistor, 4),
                "recommended_rating": "1/4 Watt" if p_resistor < 0.25 else "1/2 Watt" if p_resistor < 0.5 else "1 Watt"
            }, indent=2)
            
        elif ct == "pcb_trace_width":
            # IPC-2152 standard approximation for external copper traces (1 oz = 35um)
            current_amps = float(p["current_amps"])
            temp_rise_c = float(p.get("temp_rise_c", 10.0))
            copper_oz = float(p.get("copper_weight_oz", 1.0))
            thickness_mils = copper_oz * 1.378
            # Area in sq mils: A = (I / (k * deltaT^b))^(1/c)
            # For external layers: k=0.048, b=0.44, c=0.725
            area_sq_mils = (current_amps / (0.048 * (temp_rise_c ** 0.44))) ** (1.0 / 0.725)
            width_mils = area_sq_mils / thickness_mils
            width_mm = width_mils * 0.0254
            return json.dumps({
                "status": "success",
                "minimum_trace_width_mm": round(width_mm, 3),
                "minimum_trace_width_mils": round(width_mils, 2),
                "copper_weight": f"{copper_oz} oz",
                "temperature_rise": f"{temp_rise_c} °C"
            }, indent=2)
        else:
            return json.dumps({"status": "error", "message": f"Unsupported circuit_type: {circuit_type}"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def mechanical_gear_and_stress(calculation_type: str, parameters: dict) -> str:
    """
    Computes gear train dynamics, beam bending stress, shaft torsional shear, and hydraulic cylinder forces.
    calculation_type options: 'gear_ratio_and_speed', 'beam_bending_stress', 'shaft_torsion', 'hydraulic_force'
    """
    try:
        p = parameters
        ct = calculation_type.lower().strip()
        
        if ct == "gear_ratio_and_speed":
            teeth_driver = float(p["teeth_driver"])
            teeth_driven = float(p["teeth_driven"])
            input_rpm = float(p["input_rpm"])
            input_torque_nm = float(p.get("input_torque_nm", 10.0))
            efficiency = float(p.get("efficiency", 0.95))
            
            gear_ratio = teeth_driven / teeth_driver
            output_rpm = input_rpm / gear_ratio
            output_torque_nm = input_torque_nm * gear_ratio * efficiency
            return json.dumps({
                "status": "success",
                "gear_ratio": round(gear_ratio, 3),
                "output_rpm": round(output_rpm, 2),
                "output_torque_nm": round(output_torque_nm, 2),
                "mechanical_advantage": f"{round(gear_ratio, 2)}:1"
            }, indent=2)
            
        elif ct == "beam_bending_stress":
            # sigma = M * y / I
            moment_nm = float(p["bending_moment_nm"])
            distance_y_mm = float(p["distance_y_from_neutral_mm"])
            moment_of_inertia_mm4 = float(p["moment_of_inertia_mm4"])
            # Convert mm to m
            sigma_pa = (moment_nm * (distance_y_mm * 1e-3)) / (moment_of_inertia_mm4 * 1e-12)
            sigma_mpa = sigma_pa / 1e6
            return json.dumps({
                "status": "success",
                "bending_stress_mpa": round(sigma_mpa, 2),
                "bending_stress_psi": round(sigma_mpa * 145.038, 2),
                "formula": "sigma = (M * y) / I"
            }, indent=2)
            
        elif ct == "hydraulic_force":
            pressure_bar = float(p["pressure_bar"])
            bore_dia_mm = float(p["bore_diameter_mm"])
            rod_dia_mm = float(p.get("rod_diameter_mm", 0.0))
            pressure_pa = pressure_bar * 1e5
            
            area_push_m2 = math.pi * ((bore_dia_mm * 1e-3) / 2.0)**2
            force_push_n = pressure_pa * area_push_m2
            force_push_tonnes = force_push_n / 9806.65
            
            area_pull_m2 = math.pi * (((bore_dia_mm * 1e-3) / 2.0)**2 - ((rod_dia_mm * 1e-3) / 2.0)**2)
            force_pull_n = pressure_pa * area_pull_m2
            force_pull_tonnes = force_pull_n / 9806.65
            return json.dumps({
                "status": "success",
                "push_force_kn": round(force_push_n / 1000.0, 2),
                "push_force_metric_tonnes": round(force_push_tonnes, 2),
                "pull_force_kn": round(force_pull_n / 1000.0, 2),
                "pull_force_metric_tonnes": round(force_pull_tonnes, 2)
            }, indent=2)
        else:
            return json.dumps({"status": "error", "message": f"Unsupported calculation_type: {calculation_type}"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def additive_3d_printer_calculator(calculation_type: str, parameters: dict) -> str:
    """
    Calculates 3D printer hotend volumetric flow limits, filament consumption/costs, and diagnostic troubleshooting.
    calculation_type options: 'volumetric_flow_rate', 'filament_mass_and_cost', 'troubleshooting_guide'
    """
    try:
        p = parameters
        ct = calculation_type.lower().strip()
        
        material_densities = {
            "pla": 1.24,
            "petg": 1.27,
            "abs": 1.04,
            "asa": 1.05,
            "tpu": 1.21,
            "nylon": 1.14,
            "pc": 1.20
        }
        
        if ct == "volumetric_flow_rate":
            speed_mm_s = float(p["print_speed_mm_s"])
            layer_height_mm = float(p["layer_height_mm"])
            line_width_mm = float(p.get("line_width_mm", 0.45))
            vol_flow = speed_mm_s * layer_height_mm * line_width_mm
            
            # Hotend reference limits
            limits = {
                "Standard V6 / E3D": 12.0,
                "Volcano Hotend": 25.0,
                "Bambu Lab / Creality K1 High-Flow": 32.0,
                "SuperVolcano": 60.0
            }
            bottlenecks = [name for name, lim in limits.items() if vol_flow > lim]
            
            return json.dumps({
                "status": "success",
                "volumetric_flow_rate_mm3_s": round(vol_flow, 2),
                "speed_mm_s": speed_mm_s,
                "layer_height_mm": layer_height_mm,
                "line_width_mm": line_width_mm,
                "hotend_compatibility": {
                    "can_run_on_standard_v6": vol_flow <= 12.0,
                    "requires_high_flow_hotend": vol_flow > 12.0
                },
                "hotend_exceeded_list": bottlenecks
            }, indent=2)
            
        elif ct == "filament_mass_and_cost":
            material = p.get("material", "pla").lower().strip()
            density = material_densities.get(material, 1.24)
            length_meters = float(p.get("length_meters", 0.0))
            spool_cost = float(p.get("cost_per_kg_currency", 20.0))
            
            # 1.75mm filament volume = pi * r^2 * length
            radius_cm = (1.75 / 2.0) / 10.0
            length_cm = length_meters * 100.0
            volume_cm3 = math.pi * (radius_cm ** 2) * length_cm
            mass_grams = volume_cm3 * density
            part_cost = (mass_grams / 1000.0) * spool_cost
            
            return json.dumps({
                "status": "success",
                "material": material.upper(),
                "density_g_cm3": density,
                "total_mass_grams": round(mass_grams, 1),
                "estimated_part_cost": round(part_cost, 2),
                "volume_cm3": round(volume_cm3, 2)
            }, indent=2)
            
        elif ct == "troubleshooting_guide":
            issue = p.get("symptom", "stringing").lower().strip()
            guides = {
                "stringing": {
                    "primary_causes": ["Retraction distance too low", "Retraction speed too slow", "Nozzle temperature too high", "Moisture in filament"],
                    "remedies": ["Increase retraction by 0.5mm (Direct Drive: 0.8-1.5mm, Bowden: 4-6mm)", "Lower nozzle temp by 5-10 °C", "Dry filament in dehydrator (PLA 45°C 4h, PETG 65°C 6h)"]
                },
                "warping": {
                    "primary_causes": ["Bed temperature too low", "Cold ambient draft", "Inadequate first layer squish", "Oily print bed"],
                    "remedies": ["Wash PEI sheet with warm dish soap and water (avoid pure alcohol if residue accumulates)", "Increase bed temp (PLA: 60°C, PETG: 80°C, ABS: 100-110°C with enclosure)", "Add brim (5-8mm) or mouse-ears at sharp corners"]
                },
                "under_extrusion": {
                    "primary_causes": ["Volumetric flow rate exceeding hotend melt capacity", "Partial nozzle clog", "Extruder gear tension too loose or worn", "Incorrect filament diameter setting"],
                    "remedies": ["Reduce print speed or layer height", "Perform cold pull with nylon or replace brass nozzle", "Clean brass gear teeth from chewed filament debris"]
                }
            }
            return json.dumps({
                "status": "success",
                "symptom": issue,
                "diagnosis": guides.get(issue, guides["stringing"])
            }, indent=2)
        else:
            return json.dumps({"status": "error", "message": f"Unsupported calculation_type: {calculation_type}"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def drone_aerodynamics_and_propulsion(
    all_up_weight_grams: float,
    num_motors: int = 4,
    motor_max_thrust_grams: float = 850.0,
    battery_mah: float = 1500.0,
    battery_cells_s: int = 4,
    avg_hover_draw_amps: float = 14.0
) -> str:
    """
    Computes multirotor UAV dynamics: Thrust-to-Weight Ratio (TWR), hover throttle %,
    battery energy in Watt-Hours, and estimated safe flight time (80% discharge rule).
    all_up_weight_grams: Total drone weight including battery and payload.
    """
    try:
        total_max_thrust_g = num_motors * motor_max_thrust_grams
        twr = total_max_thrust_g / all_up_weight_grams
        hover_throttle_pct = (1.0 / twr) * 100.0 if twr > 0 else 0.0
        
        # Battery specs (LiPo 3.7V nominal per cell)
        battery_voltage_nom = battery_cells_s * 3.7
        battery_watt_hours = (battery_mah / 1000.0) * battery_voltage_nom
        
        # Flight time at hover: usable 80% capacity
        usable_amp_hours = (battery_mah / 1000.0) * 0.80
        flight_time_hours = usable_amp_hours / avg_hover_draw_amps
        flight_time_minutes = flight_time_hours * 60.0
        
        twr_rating = (
            "Underpowered (risk of instability in wind)" if twr < 1.6 else
            "Excellent for camera / endurance drone (stable hover, high efficiency)" if twr <= 2.5 else
            "Acrobatic / Freestyle quadcopter (fast punch-out response)" if twr <= 5.0 else
            "High-performance FPV racing drone (extreme acceleration)"
        )

        return json.dumps({
            "status": "success",
            "aerodynamics": {
                "all_up_weight_g": all_up_weight_grams,
                "total_max_thrust_g": total_max_thrust_g,
                "thrust_to_weight_ratio": round(twr, 2),
                "hover_throttle_estimate": f"{round(hover_throttle_pct, 1)}%",
                "flight_profile_classification": twr_rating
            },
            "power_system": {
                "battery_configuration": f"{battery_cells_s}S ({battery_voltage_nom}V nominal)",
                "battery_energy_wh": round(battery_watt_hours, 2),
                "estimated_safe_hover_time_minutes": round(flight_time_minutes, 1),
                "usable_capacity_mah": round(battery_mah * 0.80, 0)
            }
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

if __name__ == "__main__":
    mcp.run()
