"""
OmniRoute Infrastructure & AI Inference Auditor Skill Runner
"""
import sys
import os
from pathlib import Path

# Add agents directory to path to import agent
AGENTS_DIR = Path(r"D:\LAN-AI-Infra\agents")
sys.path.insert(0, str(AGENTS_DIR))

from omniroute_audit_agent import OmniRouteAuditor

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="OmniRoute Infrastructure Audit Skill")
    parser.add_argument("--no-fix", action="store_true", help="Audit only without auto-remediation")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    args = parser.parse_args()

    auditor = OmniRouteAuditor(fix=not args.no_fix)
    auditor.run()
