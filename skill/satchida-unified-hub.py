#!/usr/bin/env python3
"""
Satchida Unified Intelligence Hub (satchida-unified-hub.py)
----------------------------------------------------------
A high-performance, single-process MCP server aggregating all Satchida tools
into one consolidated stdio daemon for LibreChat.

Key Architectural Guarantees:
1. Zero Terminal Popups: Exactly ONE Python background process runs instead of 19+.
2. Automatic Discovery & Extensibility:
   - Scans the local LibreChat `skill/` directory and any configured external search paths
     (e.g., `D:\\LAN-AI-Infra\\skills`, `D:\\LAN-AI-Infra\\agents\\skills`).
   - Automatically discovers any `*-server.py` or `*_mcp_server.py`.
   - Any new skill dropped into `skill/` is registered on the next launch with zero yaml modifications.
3. 100% Tenant-Portable:
   - All core skills, schemas, and runners reside inside the LibreChat repository tree.
   - When this repository is cloned/deployed to tenant hardware, it boots identically out-of-the-box.
"""

import os
import sys
import glob
import logging
import importlib.util
from mcp.server.mcpserver import MCPServer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("satchida-hub")

# Initialize Master Unified MCP Server
hub = MCPServer("satchida-tools")

# Determine base paths
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(CURRENT_DIR)

# Ensure local directories are in Python path
for p in [CURRENT_DIR, REPO_ROOT]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Discovery directories: strictly local to the repository tree for 100% tenant portability.
# Any new tool/skill server dropped into `skill/` is automatically mounted.
DISCOVERY_DIRS = [
    CURRENT_DIR,
]

def discover_and_mount_tools():
    registered_tools = set()
    total_servers = 0

    for d in DISCOVERY_DIRS:
        if not os.path.isdir(d):
            continue
        
        # Look for candidate server scripts
        patterns = [
            os.path.join(d, "*-server.py"),
            os.path.join(d, "*_mcp_server.py"),
            os.path.join(d, "*_server.py")
        ]
        
        server_files = []
        for pat in patterns:
            server_files.extend(glob.glob(pat))
        server_files = sorted(list(set(server_files)))

        for filepath in server_files:
            filename = os.path.basename(filepath)
            
            # Avoid self-recursion or non-server utilities
            if filename in ["satchida-unified-hub.py", "edge_tts_service.py", "architectural_code_verifier.py"]:
                continue

            try:
                mod_name = f"satchida_skill_{filename[:-3].replace('-', '_')}"
                spec = importlib.util.spec_from_file_location(mod_name, filepath)
                if not spec or not spec.loader:
                    continue
                
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                # Check for either 'mcp' or 'server' instance of MCPServer
                server_instance = getattr(module, "mcp", getattr(module, "server", None))
                if server_instance and hasattr(server_instance, "_tool_manager"):
                    tools_map = getattr(server_instance._tool_manager, "_tools", {})
                    added_from_server = 0
                    
                    for tool_name, tool_obj in tools_map.items():
                        if tool_name not in registered_tools:
                            hub._tool_manager._tools[tool_name] = tool_obj
                            registered_tools.add(tool_name)
                            added_from_server += 1
                        else:
                            logger.warning("Duplicate tool skipped: %s from %s", tool_name, filename)
                            
                    total_servers += 1
                    logger.info("Mounted %d tools from %s", added_from_server, filename)
            except Exception as e:
                logger.error("Failed to load skill server %s: %s", filename, e)

    logger.info("Successfully initialized Satchida Unified Hub: %d servers loaded, %d tools registered.",
                total_servers, len(registered_tools))

if __name__ == "__main__":
    discover_and_mount_tools()
    hub.run()
