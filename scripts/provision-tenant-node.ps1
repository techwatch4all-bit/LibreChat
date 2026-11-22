<#
.SYNOPSIS
    Satchida Edge Tenant Node — Automated Zero-Knowledge Provisioning Script
.DESCRIPTION
    Prepares a cloned LibreChat + AnythingLLM installation for a new tenant PC:
    1. Rotates JWT_SECRET, SIG_KEY, and SIG_SALT in AnythingLLM/server/.env using CSPRNG.
    2. Strips master cloud API keys (OPENROUTER_API_KEY, OPENAI_API_KEY, etc.) per Zero-Knowledge policy.
    3. Updates STORAGE_DIR paths in AnythingLLM/server/.env and collector/.env to match InstallRoot.
    4. Preserves the Global Vault (lancedb/, documents/, anythingllm.db) intact.
    5. Configures LibreChat/.env for outbound telemetry & remote lockdown over gateway.satchida.com.
.PARAMETER InstallRoot
    Root directory where LibreChat and AnythingLLM are installed (default: D:\LAN-AI-Infra if D: exists, else C:\LAN-AI-Infra).
.PARAMETER TenantVirtualKey
    The tenant's provisioned virtual key from One-API (e.g., sk-tenant-xxxx).
.PARAMETER GatewayUrl
    Central Operator Gateway URL (default: https://gateway.satchida.com).
.PARAMETER TelemetryIntervalMs
    Heartbeat interval in milliseconds for remote WAN tenants (default: 5000).
.PARAMETER DryRun
    Preview all changes without modifying any .env files.
.EXAMPLE
    .\provision-tenant-node.ps1 -TenantVirtualKey "sk-tenant-abc123"
    .\provision-tenant-node.ps1 -TenantVirtualKey "sk-tenant-abc123" -InstallRoot "C:\LAN-AI-Infra" -DryRun
#>

[CmdletBinding()]
param(
    [string]$InstallRoot = $(if (Test-Path "D:\") { "D:\LAN-AI-Infra" } else { "C:\LAN-AI-Infra" }),
    [Parameter(Mandatory = $true)]
    [string]$TenantVirtualKey,
    [string]$GatewayUrl = "https://gateway.satchida.com",
    [int]$TelemetryIntervalMs = 5000,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function New-RandomHex {
    param([int]$Bytes = 32)
    $buf = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($buf)
    $rng.Dispose()
    return ([System.BitConverter]::ToString($buf) -replace '-', '').ToLowerInvariant()
}

function Set-EnvKey {
    param(
        [string[]]$Lines,
        [string]$Key,
        [string]$Value,
        [string]$Quote = ""
    )
    $formatted = if ($Quote) { "$Key=$Quote$Value$Quote" } else { "$Key=$Value" }
    $found = $false
    $out = foreach ($line in $Lines) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
            $found = $true
            $formatted
        } else {
            $line
        }
    }
    if (-not $found) {
        $out += $formatted
    }
    return ,$out
}

function Remove-EnvKey {
    param([string[]]$Lines, [string]$Key)
    return ,($Lines | Where-Object { $_ -notmatch "^\s*$([regex]::Escape($Key))\s*=" })
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  SATCHIDA TENANT PROVISIONING (ZERO-KNOWLEDGE + KEY ROTATION)" -ForegroundColor Cyan
Write-Host "  Install Root : $InstallRoot" -ForegroundColor Cyan
Write-Host "  Gateway URL  : $GatewayUrl" -ForegroundColor Cyan
Write-Host "  Dry Run      : $DryRun" -ForegroundColor Cyan
Write-Host "=================================================================`n" -ForegroundColor Cyan

$anythingRoot     = Join-Path $InstallRoot "AnythingLLM"
$anythingServerEnv = Join-Path $anythingRoot "server\.env"
$anythingCollEnv  = Join-Path $anythingRoot "collector\.env"
$storageDirWin    = Join-Path $anythingRoot "server\storage"
$storageDirSlash  = $storageDirWin -replace '\\', '/'
$anythingDbPath   = Join-Path $storageDirWin "anythingllm.db"
$lockdownFile     = Join-Path $InstallRoot ".satchida-lockdown.json"
$libreEnv         = Join-Path $InstallRoot "LibreChat\.env"

# 1. Rotate AnythingLLM server/.env keys & strip master cloud keys
if (Test-Path $anythingServerEnv) {
    $lines = Get-Content $anythingServerEnv
    $newJwt  = New-RandomHex -Bytes 32
    $newSigK = New-RandomHex -Bytes 16
    $newSigS = New-RandomHex -Bytes 16

    $lines = Set-EnvKey -Lines $lines -Key "JWT_SECRET"  -Value $newJwt  -Quote "'"
    $lines = Set-EnvKey -Lines $lines -Key "SIG_KEY"     -Value $newSigK -Quote "'"
    $lines = Set-EnvKey -Lines $lines -Key "SIG_SALT"    -Value $newSigS -Quote "'"
    $lines = Set-EnvKey -Lines $lines -Key "STORAGE_DIR" -Value $storageDirWin -Quote "'"
    $lines = Set-EnvKey -Lines $lines -Key "SATCHIDA_LOCKDOWN_FILE" -Value $lockdownFile -Quote "'"

    # Strip any master cloud API keys (Zero-Knowledge Rule #3)
    foreach ($forbidden in @("OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "DEEPSEEK_API_KEY")) {
        $lines = Remove-EnvKey -Lines $lines -Key $forbidden
    }

    if ($DryRun) {
        Write-Host "[DRY-RUN] Would update $anythingServerEnv (rotate JWT_SECRET/SIG_KEY/SIG_SALT, strip cloud keys, set STORAGE_DIR)." -ForegroundColor Yellow
    } else {
        Set-Content -Path $anythingServerEnv -Value $lines -Encoding UTF8
        Write-Host "[OK] Updated $anythingServerEnv (keys rotated, master cloud keys stripped, Global Vault preserved)." -ForegroundColor Green
    }
} else {
    Write-Host "[WARN] AnythingLLM server/.env not found at $anythingServerEnv" -ForegroundColor Yellow
}

# 2. Update AnythingLLM collector/.env STORAGE_DIR
if (Test-Path $anythingCollEnv) {
    $cLines = Get-Content $anythingCollEnv
    $cLines = Set-EnvKey -Lines $cLines -Key "STORAGE_DIR" -Value $storageDirSlash -Quote '"'
    if ($DryRun) {
        Write-Host "[DRY-RUN] Would update $anythingCollEnv (STORAGE_DIR=$storageDirSlash)." -ForegroundColor Yellow
    } else {
        Set-Content -Path $anythingCollEnv -Value $cLines -Encoding UTF8
        Write-Host "[OK] Updated $anythingCollEnv." -ForegroundColor Green
    }
}

# 3. Configure LibreChat/.env for Gateway Telemetry & Lockdown
if (Test-Path $libreEnv) {
    $lLines = Get-Content $libreEnv
    $lLines = Set-EnvKey -Lines $lLines -Key "SATCHIDA_GATEWAY_URL"           -Value $GatewayUrl
    $lLines = Set-EnvKey -Lines $lLines -Key "SATCHIDA_TENANT_VIRTUAL_KEY"    -Value $TenantVirtualKey
    $lLines = Set-EnvKey -Lines $lLines -Key "ANYTHINGLLM_DB_PATH"            -Value $anythingDbPath
    $lLines = Set-EnvKey -Lines $lLines -Key "SATCHIDA_LOCKDOWN_FILE"         -Value $lockdownFile
    $lLines = Set-EnvKey -Lines $lLines -Key "SATCHIDA_TELEMETRY_INTERVAL_MS" -Value $TelemetryIntervalMs.ToString()

    if ($DryRun) {
        Write-Host "[DRY-RUN] Would update $libreEnv with SATCHIDA_GATEWAY_URL, SATCHIDA_TENANT_VIRTUAL_KEY, ANYTHINGLLM_DB_PATH, SATCHIDA_LOCKDOWN_FILE." -ForegroundColor Yellow
    } else {
        Set-Content -Path $libreEnv -Value $lLines -Encoding UTF8
        Write-Host "[OK] Updated $libreEnv for remote telemetry & shared lockdown." -ForegroundColor Green
    }
} else {
    Write-Host "[WARN] LibreChat .env not found at $libreEnv" -ForegroundColor Yellow
}

Write-Host "`nProvisioning complete. Global Vault in '$storageDirWin' was preserved untouched." -ForegroundColor Cyan
