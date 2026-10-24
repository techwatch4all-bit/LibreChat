"""
Satchida STEM & Study Engine (MCP Stdio Server)
Provides verified OSS mathematical, scientific, and curriculum computing for LibreChat Study modes.
Powered by SymPy, NumPy, SciPy, Matplotlib.
Zero-cloud dependencies, deterministic results, formatted for KaTeX and Markdown.
Compatible with MCP SDK 2.x (MCPServer).
"""
import sys
import json
import math
import re
import io
import base64
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-stem-study")

@mcp.tool()
def solve_symbolic_math(equation: str, variable: str = "x") -> str:
    """
    Solves algebraic equations, systems of equations, or inequalities symbolically using SymPy.
    Returns exact symbolic solutions with steps and LaTeX rendering.
    Example equation: 'x**2 - 5*x + 6 = 0' or '2*x + 3 = 7'
    """
    try:
        import sympy as sp
        x = sp.Symbol(variable)
        
        if "=" in equation:
            lhs_str, rhs_str = equation.split("=", 1)
            lhs = sp.sympify(lhs_str)
            rhs = sp.sympify(rhs_str)
            eq = sp.Eq(lhs, rhs)
            solutions = sp.solve(eq, x)
        else:
            expr = sp.sympify(equation)
            solutions = sp.solve(expr, x)
            
        latex_solutions = [sp.latex(sol) for sol in solutions]
        return json.dumps({
            "status": "success",
            "solutions": [str(s) for s in solutions],
            "latex_solutions": [f"${ls}$" for ls in latex_solutions],
            "variable": variable,
            "raw_input": equation
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def calculus_derivative_integral(
    expression: str, 
    operation: str = "derivative", 
    variable: str = "x", 
    order: int = 1,
    lower_limit: str = None, 
    upper_limit: str = None
) -> str:
    """
    Computes exact symbolic derivatives, limits, or integrals.
    operation options: 'derivative', 'indefinite_integral', 'definite_integral', 'limit'
    expression example: 'x**3 * sin(x)' or 'exp(-x**2)'
    """
    try:
        import sympy as sp
        x = sp.Symbol(variable)
        expr = sp.sympify(expression)
        
        if operation == "derivative":
            res = sp.diff(expr, x, order)
            return json.dumps({
                "status": "success",
                "operation": f"derivative (order {order})",
                "result": str(res),
                "latex": f"$${sp.latex(res)}$$",
                "input_latex": f"$${sp.latex(expr)}$$"
            }, indent=2)
            
        elif operation == "indefinite_integral":
            res = sp.integrate(expr, x)
            return json.dumps({
                "status": "success",
                "operation": "indefinite_integral",
                "result": f"{str(res)} + C",
                "latex": f"$$\\int {sp.latex(expr)} \\, d{variable} = {sp.latex(res)} + C$$"
            }, indent=2)
            
        elif operation == "definite_integral":
            if not lower_limit or not upper_limit:
                return json.dumps({"status": "error", "message": "lower_limit and upper_limit required"})
            a = sp.sympify(lower_limit)
            b = sp.sympify(upper_limit)
            res = sp.integrate(expr, (x, a, b))
            eval_num = float(res.evalf()) if res.is_real else None
            return json.dumps({
                "status": "success",
                "operation": "definite_integral",
                "result": str(res),
                "numeric_approximation": eval_num,
                "latex": f"$$\\int_{{{sp.latex(a)}}}^{{{sp.latex(b)}}} {sp.latex(expr)} \\, d{variable} = {sp.latex(res)}$$"
            }, indent=2)
            
        elif operation == "limit":
            target = sp.sympify(upper_limit if upper_limit else "0")
            res = sp.limit(expr, x, target)
            return json.dumps({
                "status": "success",
                "operation": "limit",
                "result": str(res),
                "latex": f"$$\\lim_{{{variable} \\to {sp.latex(target)}}} {sp.latex(expr)} = {sp.latex(res)}$$"
            }, indent=2)
        else:
            return json.dumps({"status": "error", "message": f"Unknown operation: {operation}"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def matrix_linear_algebra(matrix_a: list, operation: str = "determinant", matrix_b: list = None) -> str:
    """
    Computes exact linear algebra operations for matrices.
    operation options: 'determinant', 'inverse', 'eigenvalues', 'rref', 'rank', 'multiply', 'characteristic_polynomial'
    matrix_a example: [[1, 2], [3, 4]]
    """
    try:
        import sympy as sp
        A = sp.Matrix(matrix_a)
        
        if operation == "determinant":
            det = A.det()
            return json.dumps({
                "status": "success",
                "determinant": str(det),
                "numeric": float(det.evalf()) if det.is_real else None,
                "latex": f"$$\\det(A) = {sp.latex(det)}$$"
            }, indent=2)
            
        elif operation == "inverse":
            if A.det() == 0:
                return json.dumps({"status": "error", "message": "Matrix is singular (determinant is 0), inverse does not exist."})
            inv = A.inv()
            return json.dumps({
                "status": "success",
                "inverse": [[str(cell) for cell in row] for row in inv.tolist()],
                "latex": f"$$A^{{-1}} = {sp.latex(inv)}$$"
            }, indent=2)
            
        elif operation == "rref":
            rref_m, pivot_cols = A.rref()
            return json.dumps({
                "status": "success",
                "rref": [[str(cell) for cell in row] for row in rref_m.tolist()],
                "pivot_columns": list(pivot_cols),
                "latex": f"$$\\text{{RREF}}(A) = {sp.latex(rref_m)}$$"
            }, indent=2)
            
        elif operation == "eigenvalues":
            eigen_dict = A.eigenvals()
            return json.dumps({
                "status": "success",
                "eigenvalues": {str(k): v for k, v in eigen_dict.items()},
                "latex": ", ".join([f"\\lambda = {sp.latex(k)} \\text{{ (mult: {v})}}" for k, v in eigen_dict.items()])
            }, indent=2)
            
        elif operation == "rank":
            return json.dumps({"status": "success", "rank": A.rank()}, indent=2)
            
        elif operation == "multiply":
            if not matrix_b:
                return json.dumps({"status": "error", "message": "matrix_b required for multiplication"})
            B = sp.Matrix(matrix_b)
            C = A * B
            return json.dumps({
                "status": "success",
                "product": [[str(cell) for cell in row] for row in C.tolist()],
                "latex": f"$$A \\times B = {sp.latex(C)}$$"
            }, indent=2)
        else:
            return json.dumps({"status": "error", "message": f"Unsupported matrix operation: {operation}"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def plot_mathematical_function(
    expression: str, 
    variable: str = "x", 
    x_min: float = -10.0, 
    x_max: float = 10.0, 
    points: int = 400,
    title: str = "Function Plot"
) -> str:
    """
    Plots a mathematical function f(x) over a range and returns a base64 Markdown image.
    expression example: 'sin(x)/x' or 'x**2 - 4*x + 3' or 'exp(-x**2)'
    """
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import numpy as np
        import sympy as sp

        x = sp.Symbol(variable)
        expr = sp.sympify(expression)
        f_num = sp.lambdify(x, expr, modules=["numpy", {"sinc": np.sinc}])

        x_vals = np.linspace(x_min, x_max, points)
        try:
            y_vals = f_num(x_vals)
            if np.isscalar(y_vals):
                y_vals = np.full_like(x_vals, y_vals)
        except Exception:
            y_vals = np.array([float(expr.subs(x, val).evalf()) for val in x_vals], dtype=float)

        fig, ax = plt.subplots(figsize=(7, 4), dpi=120)
        ax.plot(x_vals, y_vals, label=f"${sp.latex(expr)}$", color="#2563eb", linewidth=2.0)
        ax.axhline(0, color="gray", linestyle="--", linewidth=0.8, alpha=0.7)
        ax.axvline(0, color="gray", linestyle="--", linewidth=0.8, alpha=0.7)
        ax.grid(True, linestyle=":", alpha=0.6)
        ax.set_title(title, fontsize=12, fontweight="bold")
        ax.set_xlabel(variable, fontsize=10)
        ax.set_ylabel(f"f({variable})", fontsize=10)
        ax.legend(loc="best", fontsize=10)

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight")
        plt.close(fig)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        return json.dumps({
            "status": "success",
            "expression": expression,
            "markdown_image": f"![{title}](data:image/png;base64,{b64})",
            "range": [x_min, x_max]
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def balance_chemical_equation(reactants: list, products: list) -> str:
    """
    Balances chemical equations using linear stoichiometry nullspaces.
    reactants example: ['C2H6', 'O2']
    products example: ['CO2', 'H2O']
    """
    try:
        import sympy as sp

        def parse_compound(c):
            tokens = re.findall(r'([A-Z][a-z]*)(\d*)', c.strip())
            d = {}
            for elem, count in tokens:
                if elem:
                    d[elem] = d.get(elem, 0) + (int(count) if count else 1)
            return d

        compounds = reactants + products
        all_elements = sorted(list(set(e for c in compounds for e in parse_compound(c))))
        rows = []
        for elem in all_elements:
            row = []
            for c in reactants:
                row.append(parse_compound(c).get(elem, 0))
            for c in products:
                row.append(-parse_compound(c).get(elem, 0))
            rows.append(row)

        M = sp.Matrix(rows)
        ns = M.nullspace()
        if not ns:
            return json.dumps({"status": "error", "message": "Could not balance equation. Verify chemical formulas."})

        vec = ns[0]
        lcm = 1
        for val in vec:
            lcm = sp.lcm(lcm, val.q)
        coeffs = [int(val * lcm) for val in vec]

        r_coeffs = coeffs[:len(reactants)]
        p_coeffs = coeffs[len(reactants):]

        def fmt_half(comp_list, coef_list):
            parts = []
            for c, k in zip(comp_list, coef_list):
                prefix = f"{k} " if k > 1 else ""
                parts.append(f"{prefix}{c}")
            return " + ".join(parts)

        equation_str = f"{fmt_half(reactants, r_coeffs)} -> {fmt_half(products, p_coeffs)}"
        return json.dumps({
            "status": "success",
            "balanced_equation": equation_str,
            "reactants": dict(zip(reactants, r_coeffs)),
            "products": dict(zip(products, p_coeffs))
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def physical_constants_and_units(query: str = "all") -> str:
    """
    Retrieves verified standard CODATA physical and chemical constants or performs unit conversion.
    query options: 'all', 'planck', 'boltzmann', 'speed_of_light', 'gravitational', 'gas_constant', 'electron_mass', 'avogadro'
    """
    try:
        import scipy.constants as const
        constants_table = {
            "speed_of_light": {"symbol": "c", "value": const.c, "unit": "m/s", "desc": "Speed of light in vacuum"},
            "planck_constant": {"symbol": "h", "value": const.h, "unit": "J*s", "desc": "Planck constant"},
            "reduced_planck": {"symbol": "hbar", "value": const.hbar, "unit": "J*s", "desc": "Reduced Planck constant (h / 2pi)"},
            "gravitational_constant": {"symbol": "G", "value": const.G, "unit": "m^3/(kg*s^2)", "desc": "Newtonian constant of gravitation"},
            "elementary_charge": {"symbol": "e", "value": const.e, "unit": "C", "desc": "Elementary charge"},
            "boltzmann_constant": {"symbol": "k_B", "value": const.k, "unit": "J/K", "desc": "Boltzmann constant"},
            "avogadro_number": {"symbol": "N_A", "value": const.N_A, "unit": "mol^-1", "desc": "Avogadro constant"},
            "universal_gas_constant": {"symbol": "R", "value": const.R, "unit": "J/(mol*K)", "desc": "Molar gas constant"},
            "electron_rest_mass": {"symbol": "m_e", "value": const.m_e, "unit": "kg", "desc": "Electron mass"},
            "proton_rest_mass": {"symbol": "m_p", "value": const.m_p, "unit": "kg", "desc": "Proton mass"},
            "permittivity_of_free_space": {"symbol": "epsilon_0", "value": const.epsilon_0, "unit": "F/m", "desc": "Vacuum electric permittivity"},
            "permeability_of_free_space": {"symbol": "mu_0", "value": const.mu_0, "unit": "N/A^2", "desc": "Vacuum magnetic permeability"}
        }
        
        q = query.lower().strip()
        if q == "all":
            return json.dumps({"status": "success", "constants": constants_table}, indent=2)
        
        matched = {k: v for k, v in constants_table.items() if q in k or q in v["symbol"].lower() or q in v["desc"].lower()}
        if matched:
            return json.dumps({"status": "success", "constants": matched}, indent=2)
        else:
            return json.dumps({"status": "not_found", "available_constants": list(constants_table.keys())}, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def scientific_physics_solver(problem_type: str, parameters: dict) -> str:
    """
    Solves canonical curriculum physics problems across Mechanics, Thermodynamics, Optics, and Electromagnetism.
    problem_type options: 'projectile_motion', 'snells_law', 'rlc_resonance', 'carnot_efficiency', 'de_broglie_wavelength'
    parameters example for projectile_motion: {'v0': 20.0, 'theta_deg': 45.0, 'g': 9.8}
    """
    try:
        p = parameters
        if problem_type == "projectile_motion":
            v0 = float(p["v0"])
            theta = math.radians(float(p["theta_deg"]))
            g = float(p.get("g", 9.80665))
            time_of_flight = (2.0 * v0 * math.sin(theta)) / g
            max_height = (v0**2 * (math.sin(theta)**2)) / (2.0 * g)
            horizontal_range = (v0**2 * math.sin(2.0 * theta)) / g
            return json.dumps({
                "status": "success",
                "time_of_flight_s": round(time_of_flight, 4),
                "max_height_m": round(max_height, 4),
                "horizontal_range_m": round(horizontal_range, 4)
            }, indent=2)
            
        elif problem_type == "snells_law":
            n1 = float(p["n1"])
            n2 = float(p["n2"])
            theta1 = math.radians(float(p["theta1_deg"]))
            sin_theta2 = (n1 * math.sin(theta1)) / n2
            if sin_theta2 > 1.0:
                crit_angle = math.degrees(math.asin(n2 / n1)) if n1 > n2 else None
                return json.dumps({
                    "status": "total_internal_reflection",
                    "critical_angle_deg": round(crit_angle, 2) if crit_angle else None
                }, indent=2)
            theta2_deg = math.degrees(math.asin(sin_theta2))
            return json.dumps({
                "status": "refracted",
                "theta2_deg": round(theta2_deg, 4)
            }, indent=2)
            
        elif problem_type == "rlc_resonance":
            L = float(p["L"])
            C = float(p["C"])
            omega_0 = 1.0 / math.sqrt(L * C)
            f_0 = omega_0 / (2.0 * math.pi)
            res = {
                "resonant_frequency_hz": round(f_0, 4),
                "angular_frequency_rad_s": round(omega_0, 4)
            }
            if "R" in p:
                R = float(p["R"])
                Q = (1.0 / R) * math.sqrt(L / C)
                res["quality_factor_Q"] = round(Q, 4)
            return json.dumps(res, indent=2)
            
        elif problem_type == "carnot_efficiency":
            Th = float(p["T_hot"])
            Tc = float(p["T_cold"])
            eff = 1.0 - (Tc / Th)
            return json.dumps({
                "carnot_efficiency": round(eff, 4),
                "efficiency_percent": f"{round(eff * 100, 2)}%"
            }, indent=2)

        elif problem_type == "de_broglie_wavelength":
            import scipy.constants as const
            m = float(p["mass_kg"])
            v = float(p["velocity_m_s"])
            wavelength = const.h / (m * v)
            return json.dumps({
                "status": "success",
                "wavelength_m": wavelength,
                "wavelength_nm": round(wavelength * 1e9, 4),
                "wavelength_angstrom": round(wavelength * 1e10, 4)
            }, indent=2)
        else:
            return json.dumps({"status": "error", "message": f"Unsupported problem_type: {problem_type}"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

if __name__ == "__main__":
    mcp.run()
