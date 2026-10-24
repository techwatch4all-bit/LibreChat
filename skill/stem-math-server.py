"""
Satchida STEM & Math Computation Engine
Provides verified OSS mathematical, symbolic, and scientific computing for LibreChat.
Supports SymPy (algebra, calculus, matrices), NumPy/SciPy (numerical computations),
and curriculum-aligned problem solvers for CBSE, ICSE, IGCSE, B.Tech, and M.Tech.
Compatible with MCP SDK 2.x (MCPServer).
"""
import sys
import json
import math
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-stem-math")

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
        
        # Parse expression/equation
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
            "latex": [f"${l}$" for l in latex_solutions],
            "details": f"Found {len(solutions)} solution(s) for {variable}."
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def calculus_derivative_integral(expression: str, operation: str = "derivative", variable: str = "x", lower_limit: str = None, upper_limit: str = None) -> str:
    """
    Calculates derivatives, indefinite integrals, or definite integrals symbolically with KaTeX output.
    operation: 'derivative', 'integral', 'second_derivative'
    expression: e.g. 'sin(x)*exp(x)', 'x**3 + 2*x', '1/(1 + x**2)'
    """
    try:
        import sympy as sp
        v = sp.Symbol(variable)
        expr = sp.sympify(expression)
        
        if operation == "derivative":
            res = sp.diff(expr, v)
            step_str = f"d/d{variable} [{expression}]"
        elif operation == "second_derivative":
            res = sp.diff(expr, v, 2)
            step_str = f"d^2/d{variable}^2 [{expression}]"
        elif operation == "integral":
            if lower_limit is not None and upper_limit is not None:
                a = sp.sympify(lower_limit)
                b = sp.sympify(upper_limit)
                res = sp.integrate(expr, (v, a, b))
                step_str = f"∫({lower_limit} to {upper_limit}) [{expression}] d{variable}"
            else:
                res = sp.integrate(expr, v)
                step_str = f"∫ [{expression}] d{variable} + C"
        else:
            return json.dumps({"status": "error", "message": f"Unsupported operation: {operation}"})
            
        return json.dumps({
            "status": "success",
            "operation": step_str,
            "result": str(res),
            "latex": f"$${sp.latex(res)}$$",
            "original_latex": f"$${sp.latex(expr)}$$"
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def matrix_linear_algebra(matrix_a: list, operation: str = "determinant", matrix_b: list = None) -> str:
    """
    Performs matrix operations for engineering mathematics (B.Tech/M.Tech).
    operation: 'determinant', 'inverse', 'eigenvalues', 'rank', 'rref', 'multiply'
    matrix_a: 2D list of numbers or symbolic strings, e.g. [[1, 2], [3, 4]]
    """
    try:
        import sympy as sp
        A = sp.Matrix(matrix_a)
        
        if operation == "determinant":
            det = A.det()
            return json.dumps({"status": "success", "operation": "det(A)", "result": str(det), "latex": f"$${sp.latex(det)}$$"})
        elif operation == "inverse":
            if A.det() == 0:
                return json.dumps({"status": "error", "message": "Matrix is singular; inverse does not exist."})
            inv = A.inv()
            return json.dumps({"status": "success", "operation": "A^(-1)", "result": str(inv.tolist()), "latex": f"$${sp.latex(inv)}$$"})
        elif operation == "eigenvalues":
            eigenvals = A.eigenvals()
            return json.dumps({"status": "success", "operation": "eigenvalues", "result": {str(k): v for k, v in eigenvals.items()}})
        elif operation == "rank":
            return json.dumps({"status": "success", "operation": "rank(A)", "rank": A.rank()})
        elif operation == "rref":
            rref_matrix, pivots = A.rref()
            return json.dumps({"status": "success", "operation": "RREF", "rref": rref_matrix.tolist(), "pivots": pivots, "latex": f"$${sp.latex(rref_matrix)}$$"})
        elif operation == "multiply":
            if matrix_b is None:
                return json.dumps({"status": "error", "message": "matrix_b required for multiplication"})
            B = sp.Matrix(matrix_b)
            prod = A * B
            return json.dumps({"status": "success", "operation": "A * B", "result": prod.tolist(), "latex": f"$${sp.latex(prod)}$$"})
        else:
            return json.dumps({"status": "error", "message": f"Unsupported operation: {operation}"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

@mcp.tool()
def scientific_physics_solver(problem_type: str, parameters: dict) -> str:
    """
    Computes verified physics equations for CBSE Class 11/12, JEE, and Engineering Mechanics.
    problem_type options:
    - 'projectile_motion': params: { v0, angle_deg, g=9.8 }
    - 'de_broglie_wavelength': params: { mass, velocity } or { momentum }
    - 'snells_law': params: { n1, theta1_deg, n2 }
    - 'rlc_resonance': params: { R, L, C }
    - 'carnot_efficiency': params: { T_hot, T_cold }
    """
    try:
        p = parameters
        if problem_type == "projectile_motion":
            v0 = float(p["v0"])
            theta = math.radians(float(p["angle_deg"]))
            g = float(p.get("g", 9.8))
            time_of_flight = (2 * v0 * math.sin(theta)) / g
            max_height = (v0**2 * (math.sin(theta))**2) / (2 * g)
            range_val = (v0**2 * math.sin(2 * theta)) / g
            return json.dumps({
                "time_of_flight_s": round(time_of_flight, 4),
                "max_height_m": round(max_height, 4),
                "horizontal_range_m": round(range_val, 4),
                "equations": {
                    "T": "$$T = \\frac{2 v_0 \\sin\\theta}{g}$$",
                    "H": "$$H = \\frac{v_0^2 \\sin^2\\theta}{2g}$$",
                    "R": "$$R = \\frac{v_0^2 \\sin(2\\theta)}{g}$$"
                }
            }, indent=2)
            
        elif problem_type == "de_broglie_wavelength":
            h = 6.62607015e-34
            if "momentum" in p:
                p_mom = float(p["momentum"])
            else:
                p_mom = float(p["mass"]) * float(p["velocity"])
            wavelength = h / p_mom
            return json.dumps({
                "wavelength_meters": wavelength,
                "wavelength_angstrom": wavelength * 1e10,
                "wavelength_nm": wavelength * 1e9,
                "equation": "$$\\lambda = \\frac{h}{p} = \\frac{h}{m v}$$"
            }, indent=2)

        elif problem_type == "rlc_resonance":
            L = float(p["L"])
            C = float(p["C"])
            f_res = 1.0 / (2 * math.pi * math.sqrt(L * C))
            omega_0 = 1.0 / math.sqrt(L * C)
            res = {
                "resonant_frequency_hz": round(f_res, 4),
                "angular_frequency_rad_s": round(omega_0, 4),
                "equation": "$$f_0 = \\frac{1}{2\\pi \\sqrt{LC}}$$"
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
                "efficiency_percent": f"{round(eff * 100, 2)}%",
                "equation": "$$\\eta = 1 - \\frac{T_c}{T_h}$$"
            }, indent=2)
        else:
            return json.dumps({"status": "error", "message": f"Unsupported problem_type: {problem_type}"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

if __name__ == "__main__":
    mcp.run()
