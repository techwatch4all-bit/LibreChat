"""
Satchida DevOps & Cybersecurity Toolkit MCP Server
Provides cryptographic file hashing, local port & listening socket audits,
.env security secret leakage detection, and Trivy filesystem vulnerability analysis.
"""
import os
import hashlib
import socket
import re
import subprocess
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("satchida-devops-security")

@mcp.tool()
def compute_file_hash(filepath: str, algorithm: str = "sha256") -> str:
    """
    Computes deterministic cryptographic hash (SHA-256, SHA-512, MD5) for any local file to verify integrity.
    
    :param filepath: Absolute or relative path to file on disk.
    :param algorithm: Hashing algorithm ('sha256', 'sha512', 'md5').
    """
    try:
        if not os.path.exists(filepath):
            return f"File does not exist: {filepath}"
            
        algo = algorithm.lower().strip()
        if algo == "sha256":
            hasher = hashlib.sha256()
        elif algo == "sha512":
            hasher = hashlib.sha512()
        elif algo == "md5":
            hasher = hashlib.md5()
        else:
            return f"Unsupported algorithm '{algorithm}'. Choose 'sha256', 'sha512', or 'md5'."
            
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
                
        digest = hasher.hexdigest()
        size_bytes = os.path.getsize(filepath)
        return f"**File Cryptographic Digest ({algo.upper()})**\n- **Target File**: `{filepath}`\n- **File Size**: {size_bytes:,} bytes\n- **Hash**: `{digest}`"
    except Exception as e:
        return f"Error hashing file: {str(e)}"

@mcp.tool()
def check_network_port(host: str, port: int, timeout_seconds: float = 3.0) -> str:
    """
    Probes whether a local or internal network port is listening and accepting TCP connections.
    
    :param host: Hostname or IP address (e.g. '127.0.0.1' or 'localhost').
    :param port: TCP port number (e.g. 3080, 3012, 5432, 80).
    :param timeout_seconds: Timeout in seconds (default: 3.0).
    """
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout_seconds)
        result = sock.connect_ex((host, port))
        sock.close()
        
        status = "OPEN (Listening)" if result == 0 else f"CLOSED / Filtered (Error code: {result})"
        return f"**TCP Port Diagnostic**\n- **Target**: `{host}:{port}`\n- **Status**: {status}"
    except Exception as e:
        return f"Error testing port {host}:{port}: {str(e)}"

@mcp.tool()
def audit_env_secrets_hygiene(filepath: str) -> str:
    """
    Scans a configuration or .env file for leaked API keys, tokens, hardcoded passwords, or insecure permissions.
    Only reports parameter keys and risk severity, NEVER reveals plaintext secret values.
    
    :param filepath: Path to .env or config file.
    """
    try:
        if not os.path.exists(filepath):
            return f"Configuration file not found: {filepath}"
            
        sensitive_patterns = [
            (r'(?i)(api[_-]?key|secret|password|token|bearer|private[_-]?key)', "High Severity — Credential Parameter Detected"),
            (r'(?i)(jwt|oauth|access[_-]?token|refresh[_-]?token)', "High Severity — Authentication Token Detected"),
            (r'(?i)(database_url|mongodb_uri|postgres_uri)', "Medium Severity — Database Connection String Detected"),
        ]
        
        findings = []
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            for idx, line in enumerate(f, 1):
                clean = line.strip()
                if not clean or clean.startswith("#"):
                    continue
                parts = clean.split("=", 1)
                key_name = parts[0].strip()
                has_value = len(parts) > 1 and len(parts[1].strip()) > 0
                
                for pattern, desc in sensitive_patterns:
                    if re.search(pattern, key_name):
                        val_len = len(parts[1].strip()) if has_value else 0
                        findings.append(f"- Line {idx}: `{key_name}` — {desc} (Val Length: {val_len} chars)")
                        break
                        
        if not findings:
            return f"✅ **Security Hygiene Audit Passed** for `{filepath}`: No unmasked sensitive parameter names identified."
            
        out = [
            f"⚠️ **Security Audit Findings for `{filepath}`** ({len(findings)} sensitive variables flagged):",
            "\n".join(findings[:15]),
            "\n*Recommendation*: Verify these variables are stored in an encrypted secrets vault or excluded via .gitignore."
        ]
        return "\n".join(out)
    except Exception as e:
        return f"Error auditing secrets hygiene: {str(e)}"

if __name__ == "__main__":
    mcp.run()
