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
import os
import re
import io
import base64
import subprocess
import urllib.request
import urllib.parse
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

@mcp.tool()
def fetch_learning_visuals(topic: str, media_type: str = "both", max_results: int = 3) -> str:
    """
    Finds and downloads high-quality educational diagrams, figures, or animated GIFs from Wikimedia Commons.
    Saves files locally to client/public/assets/study/media/ and returns both local markdown embeds and source URLs.
    
    media_type options:
      - 'image': static scientific/curriculum diagrams, anatomy charts, apparatus setups
      - 'gif': animated physical processes, wave propagation, mechanical linkages, chemical cycles
      - 'both': mix of high-yield diagrams and animated GIFs
    max_results: number of visual assets to download and embed (default: 3)
    """
    headers = {"User-Agent": "SatchidaStudyEngine/1.0 (contact@satchida.com)"}
    results = []
    gsr_query = topic
    if media_type == "gif":
        gsr_query += " filetype:bitmap"
        
    url = f"https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch={urllib.parse.quote(gsr_query)}&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|mime|size"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
            pages = data.get("query", {}).get("pages", {})
            for pid, p in pages.items():
                raw_title = p.get("title", "").replace("File:", "")
                ii = p.get("imageinfo", [{}])[0]
                mime = ii.get("mime", "")
                remote_url = ii.get("url", "")
                if not remote_url:
                    continue
                is_gif = (mime == "image/gif") or remote_url.lower().endswith(".gif")
                is_img = mime.startswith("image/")
                
                if media_type == "gif" and not is_gif:
                    continue
                if media_type == "image" and is_gif:
                    continue
                if not is_img:
                    continue
                    
                # Clean filename and normalize extension
                base_name, existing_ext = os.path.splitext(raw_title)
                slug = re.sub(r"[^a-zA-Z0-9_\-]", "_", base_name.lower())[:45]
                ext = existing_ext if existing_ext.lower() in [".jpg", ".jpeg", ".png", ".gif", ".svg"] else (".gif" if is_gif else ".png")
                filename = f"{slug}{ext}"
                
                # Determine absolute path to client/public/assets/study/media
                local_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "client", "public", "assets", "study", "media")
                os.makedirs(local_dir, exist_ok=True)
                local_path = os.path.join(local_dir, filename)
                
                if not os.path.exists(local_path):
                    dl_req = urllib.request.Request(remote_url, headers=headers)
                    with urllib.request.urlopen(dl_req, timeout=12) as dl_res:
                        with open(local_path, "wb") as f:
                            f.write(dl_res.read())
                            
                web_url = f"/assets/study/media/{filename}"
                asset_kind = "Animated GIF" if is_gif else "Curriculum Diagram"
                results.append({
                    "title": base_name,
                    "kind": asset_kind,
                    "type": "gif" if is_gif else "image",
                    "local_url": web_url,
                    "remote_url": remote_url,
                    "markdown_embed": f"![{base_name} - {asset_kind}]({web_url})"
                })
                if len(results) >= max_results:
                    break
        return json.dumps({
            "status": "success",
            "topic": topic,
            "media_type": media_type,
            "count": len(results),
            "visuals": results
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e), "topic": topic})

@mcp.tool()
def search_curated_learning_videos(topic: str, provider: str = "all", max_results: int = 4) -> str:
    """
    Finds verified, highly authoritative educational videos and lecture playlists across Khan Academy,
    MIT OpenCourseWare, Stanford, CrashCourse, 3Blue1Brown, and NPTEL.
    Returns clean, clickable markdown video links with channel/instructor attribution.
    
    provider options:
      - 'all': broad search across all top educational repositories
      - 'khan_academy': Khan Academy concept tutorials & mastery paths
      - 'mit_ocw': MIT OpenCourseWare foundational undergraduate lectures
      - 'crash_course': High-engagement visual concept overviews
      - '3blue1brown': Deep intuitive visual mathematics & physics
      - 'nptel': Indian IIT/IISc engineering curriculum & GATE prep
    max_results: number of video suggestions to retrieve (default: 4)
    """
    channels = {
        "khan_academy": "Khan Academy",
        "mit_ocw": "MIT OpenCourseWare",
        "crash_course": "CrashCourse",
        "3blue1brown": "3Blue1Brown",
        "nptel": "NPTEL-NOC IITM",
        "veritasium": "Veritasium",
        "ted_ed": "TED-Ed"
    }
    
    query = f"{topic} video"
    if provider in channels:
        query = f"{topic} {channels[provider]}"
        
    url = f"http://127.0.0.1:8880/search?q={urllib.parse.quote(query)}&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    videos = []
    seen_urls = set()
    
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
            for item in data.get("results", []):
                u = item.get("url", "")
                t = item.get("title", "")
                snippet = item.get("content", "")
                
                is_yt = "youtube.com" in u or "youtu.be" in u
                is_khan = "khanacademy.org" in u
                is_mit = "ocw.mit.edu" in u
                is_nptel = "nptel.ac.in" in u
                
                if not (is_yt or is_khan or is_mit or is_nptel):
                    continue
                if u in seen_urls:
                    continue
                seen_urls.add(u)
                
                source = "Educational Media"
                for k, v in channels.items():
                    if v.lower() in t.lower() or v.lower() in snippet.lower():
                        source = v
                        break
                if is_khan: source = "Khan Academy"
                elif is_mit: source = "MIT OpenCourseWare"
                elif is_nptel: source = "NPTEL India (IIT/IISc)"
                
                clean_title = re.sub(r" - YouTube.*", "", t).strip()
                videos.append({
                    "title": clean_title,
                    "url": u,
                    "source": source,
                    "markdown_link": f"[{clean_title} ({source})]({u})"
                })
                if len(videos) >= max_results:
                    break
        return json.dumps({
            "status": "success",
            "topic": topic,
            "provider": provider,
            "count": len(videos),
            "videos": videos
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e), "topic": topic})

@mcp.tool()
def solve_pedagogical_algebra(expression: str, operation: str = "solve") -> str:
    """
    Solves or simplifies algebra equations using Google's pedagogical mathsteps engine.
    Returns step-by-step human tutor transformations (e.g. 'ADD_TO_BOTH_SIDES', 'DIVIDE_FROM_BOTH_SIDES')
    with KaTeX formatting for students.
    operation options:
      - 'solve': Solves linear/algebraic equations like '2x + 3 = 11' or '3*x - 7 = 14'
      - 'simplify': Combines like terms and simplifies expressions like '2x + 3x + 5'
    """
    try:
        script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts", "mathsteps-eval.js")
        proc = subprocess.run(
            ["node", script_path, operation, expression],
            capture_output=True,
            text=True,
            timeout=10
        )
        if proc.returncode == 0:
            data = json.loads(proc.stdout)
            # Annotate with readable KaTeX descriptions
            steps = data.get("steps", [])
            annotated_steps = []
            for idx, s in enumerate(steps, 1):
                ctype = s.get("changeType", "").replace("_", " ").title()
                eq_after = s.get("newEquation") or s.get("newNode") or ""
                annotated_steps.append({
                    "step_number": idx,
                    "action": ctype,
                    "result_equation": eq_after,
                    "katex": f"$${eq_after}$$"
                })
            return json.dumps({
                "status": "success",
                "engine": "google-mathsteps",
                "input": expression,
                "operation": operation,
                "step_count": len(annotated_steps),
                "steps": annotated_steps
            }, indent=2)
        else:
            return json.dumps({"status": "error", "message": proc.stderr or "Execution failed"})
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e), "input": expression})

@mcp.tool()
def get_interactive_stem_simulation(topic: str) -> str:
    """
    Retrieves verified offline PhET interactive HTML5 simulation labs for physical and chemical concepts.
    Returns the local path and responsive Artifact embed link for students to run in-browser offline.
    Supported core topics:
      - 'pendulum' (simple harmonic motion, period vs length/gravity)
      - 'circuit' (Ohm's law, series/parallel DC circuits, lightbulbs, resistors)
      - 'chemical_equations' (conservation of mass, balancing synthesis/combustion)
      - 'projectile_motion' (kinematics, velocity vectors, air resistance, launch angles)
      - 'wave' (transverse waves on a string, frequency, amplitude, damping, tension)
      - 'ohms_law' (V = IR voltage, current, resistance relationship)
      - 'forces_motion' (Newton's laws, net force, friction, acceleration)
      - 'energy_skate_park' (kinetic and potential energy conservation, mechanical energy)
    """
    sim_catalog = {
        "pendulum": {
            "title": "Pendulum Lab",
            "curriculum": "Physics (Class 9-12 / IGCSE / IB): Periodic Motion & Gravity",
            "file": "pendulum-lab.html"
        },
        "circuit": {
            "title": "Circuit Construction Kit: DC",
            "curriculum": "Physics / Electronics: DC Circuits, Switches, Resistors & Ammeters",
            "file": "circuit-construction-kit-dc.html"
        },
        "chemical_equations": {
            "title": "Balancing Chemical Equations Lab",
            "curriculum": "Chemistry (Class 8-12): Mass Conservation & Stoichiometry",
            "file": "balancing-chemical-equations.html"
        },
        "projectile_motion": {
            "title": "Projectile Motion Lab",
            "curriculum": "Physics Mechanics: 2D Kinematics, Velocity Vectors & Trajectories",
            "file": "projectile-motion.html"
        },
        "wave": {
            "title": "Wave on a String Lab",
            "curriculum": "Physics Waves: Frequency, Amplitude, Damping & Wave Speed",
            "file": "wave-on-a-string.html"
        },
        "ohms_law": {
            "title": "Ohm's Law Interactive Lab",
            "curriculum": "Physics / Basic Electrical: V = I * R Proportionality",
            "file": "ohms-law.html"
        },
        "forces_motion": {
            "title": "Forces and Motion: Basics",
            "curriculum": "Physics Mechanics: Newton's Laws of Motion & Friction",
            "file": "forces-and-motion-basics.html"
        },
        "energy_skate_park": {
            "title": "Energy Skate Park: Basics",
            "curriculum": "Physics: Kinetic & Gravitational Potential Energy Conservation",
            "file": "energy-skate-park-basics.html"
        }
    }
    
    t = topic.lower().strip()
    matched_key = None
    for k in sim_catalog:
        if k in t or t in k:
            matched_key = k
            break
            
    if not matched_key:
        if "gravity" in t or "oscillation" in t: matched_key = "pendulum"
        elif "current" in t or "resistor" in t: matched_key = "ohms_law"
        elif "reaction" in t or "stoichiometry" in t: matched_key = "chemical_equations"
        elif "trajectory" in t or "cannon" in t: matched_key = "projectile_motion"
        elif "frequency" in t or "harmonics" in t: matched_key = "wave"
        elif "friction" in t or "newton" in t: matched_key = "forces_motion"
        elif "kinetic" in t or "potential" in t: matched_key = "energy_skate_park"
        
    if matched_key:
        sim = sim_catalog[matched_key]
        sim_url = f"/assets/study/sims/{sim['file']}"
        artifact_embed = f'<iframe src="{sim_url}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>'
        return json.dumps({
            "status": "success",
            "found": True,
            "title": sim["title"],
            "curriculum": sim["curriculum"],
            "sim_url": sim_url,
            "offline_ready": True,
            "embed_code": artifact_embed,
            "direct_link": f"[{sim['title']} (Interactive Offline Lab)]({sim_url})"
        }, indent=2)
    else:
        return json.dumps({
            "status": "not_found",
            "found": False,
            "query": topic,
            "available_simulations": list(sim_catalog.keys())
        }, indent=2)

@mcp.tool()
def query_local_zim_library(query: str, zim_filename: str = None) -> str:
    """
    Searches an offline Kiwix ZIM archive (Wikipedia, WikiMed, Wiktionary) if downloaded to the tenant machine.
    Scans the default directory 'D:/LAN-AI-Infra/ZIM-Library/' or 'C:/LAN-AI-Infra/ZIM-Library/'.
    Zero cloud dependencies. If no ZIM files are stored locally, returns a helpful notice.
    """
    try:
        import libzim
        zim_dirs = ["D:\\LAN-AI-Infra\\ZIM-Library", "C:\\LAN-AI-Infra\\ZIM-Library", "D:\\LAN-AI-Infra\\School\\ZIM"]
        zim_files = []
        for zd in zim_dirs:
            if os.path.exists(zd):
                for f in os.listdir(zd):
                    if f.endswith(".zim"):
                        zim_files.append(os.path.join(zd, f))
                        
        if not zim_files:
            return json.dumps({
                "status": "not_configured",
                "message": "No local .zim archives found. To enable instant offline Wikipedia/Reference lookup, copy your .zim archive to 'D:\\LAN-AI-Infra\\ZIM-Library\\'."
            })
            
        target_zim = zim_files[0]
        if zim_filename:
            for zf in zim_files:
                if zim_filename.lower() in zf.lower():
                    target_zim = zf
                    break
                    
        archive = libzim.Archive(target_zim)
        searcher = libzim.Searcher(archive)
        q = libzim.Query().set_query(query)
        search = searcher.search(q)
        results_count = search.get_estimated_matches()
        
        results = []
        # Get first 3 hits
        results_iter = search.get_results(0, min(3, results_count))
        for res in results_iter:
            entry = archive.get_entry_by_path(res.path)
            item = entry.get_item()
            content = bytes(item.get_data()).decode("utf-8", errors="ignore")[:600]
            clean_snippet = re.sub(r"<[^>]+>", " ", content).strip()
            results.append({
                "title": res.title,
                "path": res.path,
                "snippet": clean_snippet[:300] + "..."
            })
            
        return json.dumps({
            "status": "success",
            "zim_file": os.path.basename(target_zim),
            "estimated_matches": results_count,
            "results": results
        }, indent=2)
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e), "query": query})

if __name__ == "__main__":
    mcp.run()
