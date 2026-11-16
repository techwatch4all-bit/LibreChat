"""
Satchida Office & Productivity Engine (MCP Stdio Server)
Provides granular spreadsheet and document manipulation tools for Univer AI Office.
Supports surgical cell reads/updates, formula evaluations, and document drafting.
Zero external cloud dependencies, runs 100% locally on the tenant PC.
"""
import sys
import json
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-office-suite")

def _a1_to_coords(a1_str: str):
    a1_str = a1_str.strip().upper()
    col_str = ""
    row_str = ""
    for ch in a1_str:
        if ch.isalpha():
            col_str += ch
        elif ch.isdigit():
            row_str += ch
    col = 0
    for ch in col_str:
        col = col * 26 + (ord(ch) - 64)
    col -= 1
    row = int(row_str) - 1 if row_str else 0
    return max(0, col), max(0, row)

@mcp.tool()
def sheet_get_summary(snapshot_json: str) -> str:
    """
    Returns high-level structural metadata of a spreadsheet (sheet names, row counts, column counts, total data cells)
    without dumping the full cell data into the prompt context.
    """
    try:
        data = json.loads(snapshot_json)
        sheets = data.get("sheets", {})
        sheet_list = []
        for s_id, s in sheets.items():
            cell_data = s.get("cellData", {})
            sheet_list.append({
                "sheetId": s_id,
                "name": s.get("name", "Sheet"),
                "rowCount": s.get("rowCount", 0),
                "columnCount": s.get("columnCount", 0),
                "activeCellRows": len(cell_data)
            })
        return json.dumps({
            "title": data.get("name", "Spreadsheet"),
            "sheetCount": len(sheet_list),
            "sheets": sheet_list
        }, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})

@mcp.tool()
def sheet_get_range(snapshot_json: str, range_a1: str, sheet_id: str = "") -> str:
    """
    Reads cell values from an active sheet snapshot using standard A1 notation (e.g. 'A1:D10' or 'B2:C5').
    """
    try:
        data = json.loads(snapshot_json)
        sheets = data.get("sheets", {})
        target_id = sheet_id if sheet_id in sheets else next(iter(sheets.keys()), "")
        sheet = sheets.get(target_id, {})
        cell_data = sheet.get("cellData", {})

        parts = range_a1.split(":")
        start_col, start_row = _a1_to_coords(parts[0])
        end_col, end_row = _a1_to_coords(parts[1]) if len(parts) > 1 else (start_col, start_row)

        matrix = []
        for r in range(start_row, end_row + 1):
            row_vals = []
            row_obj = cell_data.get(str(r), {})
            for c in range(start_col, end_col + 1):
                cell = row_obj.get(str(c), {})
                row_vals.append(cell.get("v") if isinstance(cell, dict) else None)
            matrix.append(row_vals)

        return json.dumps({
            "sheetName": sheet.get("name", target_id),
            "range": range_a1,
            "values": matrix
        }, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})

@mcp.tool()
def sheet_set_values(snapshot_json: str, start_cell: str, values_json: str, sheet_id: str = "") -> str:
    """
    Surgically updates a block of cells in a spreadsheet snapshot starting at start_cell (e.g. 'A1' or 'C5')
    with a 2D JSON array of values. Returns the updated snapshot JSON string.
    """
    try:
        data = json.loads(snapshot_json)
        sheets = data.get("sheets", {})
        target_id = sheet_id if sheet_id in sheets else next(iter(sheets.keys()), "")
        sheet = sheets.get(target_id, {})
        if "cellData" not in sheet:
            sheet["cellData"] = {}
        cell_data = sheet["cellData"]

        values = json.loads(values_json) if isinstance(values_json, str) else values_json
        base_col, base_row = _a1_to_coords(start_cell)

        for r_idx, row_arr in enumerate(values):
            curr_row = str(base_row + r_idx)
            if curr_row not in cell_data:
                cell_data[curr_row] = {}
            for c_idx, val in enumerate(row_arr):
                curr_col = str(base_col + c_idx)
                cell_data[curr_row][curr_col] = {
                    "v": val,
                    "t": 2 if isinstance(val, (int, float)) else 1
                }

        return json.dumps(data)
    except Exception as e:
        return json.dumps({"error": str(e)})

@mcp.tool()
def doc_insert_text(snapshot_json: str, text: str, position: str = "append") -> str:
    """
    Inserts or appends a formatted text paragraph into an active Univer doc snapshot.
    Returns the updated snapshot JSON string.
    """
    try:
        data = json.loads(snapshot_json)
        if "body" not in data:
            data["body"] = {"dataStream": "\r\n"}
        clean_text = text if text.endswith("\r\n") else text + "\r\n"
        stream = data["body"].get("dataStream", "")
        if position == "prepend":
            data["body"]["dataStream"] = clean_text + stream
        else:
            data["body"]["dataStream"] = stream.rstrip("\r\n") + "\r\n" + clean_text
        return json.dumps(data)
    except Exception as e:
        return json.dumps({"error": str(e)})

if __name__ == "__main__":
    mcp.run()
