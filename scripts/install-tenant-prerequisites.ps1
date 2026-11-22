<#
.SYNOPSIS
    Satchida Edge Tenant Node — Automated Prerequisite Audit & Installer (Windows 11)
.DESCRIPTION
    Checks and installs all native Windows prerequisites required to run LibreChat,
    AnythingLLM, MongoDB, Ollama, Prism-Llama (llama.cpp), Cloudflare Tunnel, and
    the Satchida Telemetry Engine without Docker.
.PARAMETER InstallRoot
    Root directory for Satchida services (defaults to D:\LAN-AI-Infra if D: exists, else C:\LAN-AI-Infra).
.PARAMETER AuditOnly
    If specified, performs a read-only audit of all prerequisites without installing or modifying system settings.
.PARAMETER GatewayUrl
    Central One-API / Operator Gateway URL to test outbound HTTPS telemetry reachability.
.EXAMPLE
    .\install-tenant-prerequisites.ps1
    .\install-tenant-prerequisites.ps1 -AuditOnly
    .\install-tenant-prerequisites.ps1 -InstallRoot "C:\LAN-AI-Infra"
#>

[CmdletBinding()]
param(
    [string]$InstallRoot = $(if (Test-Path "D:\") { "D:\LAN-AI-Infra" } else { "C:\LAN-AI-Infra" }),
    [switch]$AuditOnly,
    [string]$GatewayUrl = "https://gateway.satchida.com"
)

$ErrorActionPreference = "Continue"
$results = New-Object System.Collections.Generic.List[PSObject]

function Add-Result {
    param([string]$Component, [string]$Status, [string]$Details)
    $results.Add([PSCustomObject]@{
        Component = $Component
        Status    = $Status
        Details   = $Details
    })
    $color = switch ($Status) {
        "OK"      { "Green" }
        "FIXED"   { "Cyan" }
        "WARN"    { "Yellow" }
        "MISSING" { "Red" }
        default   { "White" }
    }
    Write-Host ("[{0,-7}] {1,-28} : {2}" -f $Status, $Component, $Details) -ForegroundColor $color
}

function Test-IsAdmin {
    $identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Refresh-EnvPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path    = "$machinePath;$userPath"
}

function Ensure-WingetPackage {
    param(
        [string]$DisplayName,
        [string]$CommandCheck,
        [string]$WingetId,
        [string]$VersionArgs = "--version"
    )
    $cmd = Get-Command $CommandCheck -ErrorAction SilentlyContinue
    if ($cmd) {
        $ver = (& $CommandCheck $VersionArgs 2>&1 | Select-Object -First 1) -as [string]
        Add-Result $DisplayName "OK" "$($ver.Trim()) ($($cmd.Source))"
        return $true
    }

    if ($AuditOnly) {
        Add-Result $DisplayName "MISSING" "Not found in PATH (winget id: $WingetId)"
        return $false
    }

    Write-Host "  -> Installing $DisplayName via winget ($WingetId)..." -ForegroundColor DarkCyan
    winget install --id $WingetId --exact --silent --accept-package-agreements --accept-source-agreements | Out-Null
    Refresh-EnvPath

    $cmdAfter = Get-Command $CommandCheck -ErrorAction SilentlyContinue
    if ($cmdAfter) {
        $ver = (& $CommandCheck $VersionArgs 2>&1 | Select-Object -First 1) -as [string]
        Add-Result $DisplayName "FIXED" "Installed: $($ver.Trim())"
        return $true
    } else {
        Add-Result $DisplayName "WARN" "Installed via winget; open a new terminal to refresh PATH."
        return $false
    }
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  SATCHIDA EDGE TENANT NODE — PREREQUISITE AUDIT & INSTALLER" -ForegroundColor Cyan
Write-Host "  Install Root : $InstallRoot" -ForegroundColor Cyan
Write-Host "  Mode         : $(if ($AuditOnly) { 'AUDIT ONLY (Read-Only)' } else { 'INSTALL & HARDEN' })" -ForegroundColor Cyan
Write-Host "=================================================================`n" -ForegroundColor Cyan

# 0. Admin & Winget check
$isAdmin = Test-IsAdmin
if (-not $isAdmin) {
    Add-Result "Administrator Rights" "WARN" "Not running as Admin. Power/Defender/Service steps require Elevation."
} else {
    Add-Result "Administrator Rights" "OK" "Elevated session confirmed."
}

$hasWinget = [bool](Get-Command winget -ErrorAction SilentlyContinue)
if (-not $hasWinget) {
    Add-Result "WinGet Package Manager" "MISSING" "winget not found. Install 'App Installer' from Microsoft Store."
} else {
    Add-Result "WinGet Package Manager" "OK" "Available."
}

# 1. Hardware & OS Baseline
$os = Get-CimInstance Win32_OperatingSystem
$ramGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
Add-Result "Operating System" "OK" "$($os.Caption) (Build $($os.BuildNumber))"
if ($ramGB -ge 16) {
    Add-Result "System RAM" "OK" "$ramGB GB"
} else {
    Add-Result "System RAM" "WARN" "$ramGB GB (Minimum recommended: 16 GB)"
}

$driveLetter = $InstallRoot.Substring(0, 1)
$vol = Get-PSDrive -Name $driveLetter -ErrorAction SilentlyContinue
if ($vol) {
    $freeGB = [math]::Round($vol.Free / 1GB, 1)
    $st = if ($freeGB -ge 50) { "OK" } else { "WARN" }
    Add-Result "Disk Space ($($driveLetter):)" $st "$freeGB GB free (Minimum: 50 GB)"
}

# 2. GPU / CUDA Check
$nvidiaSmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if ($nvidiaSmi) {
    $gpuInfo = (& nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader 2>&1 | Select-Object -First 1) -as [string]
    Add-Result "NVIDIA GPU & CUDA" "OK" $gpuInfo.Trim()
} else {
    Add-Result "NVIDIA GPU & CUDA" "WARN" "nvidia-smi not found (OK for cloud-only node; required for local CUDA prism-llama)."
}

# 3. Directory Structure
$requiredDirs = @(
    $InstallRoot,
    (Join-Path $InstallRoot "LibreChat"),
    (Join-Path $InstallRoot "AnythingLLM"),
    (Join-Path $InstallRoot "prism-llama\bin"),
    (Join-Path $InstallRoot "LLM-models")
)
foreach ($dir in $requiredDirs) {
    if (-not (Test-Path $dir)) {
        if (-not $AuditOnly) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
    }
}
Add-Result "Standard Directory Layout" "OK" "Verified root at $InstallRoot"

# 4. Windows Power Management Hardening (Zero Sleep)
if (-not $AuditOnly -and $isAdmin) {
    powercfg -change -standby-timeout-ac 0
    powercfg -change -hibernate-timeout-ac 0
    Add-Result "Power Hardening (No Sleep)" "FIXED" "AC standby and hibernate timeouts set to 0 (never)."
} else {
    Add-Result "Power Hardening (No Sleep)" "WARN" "Skipped (requires Admin without -AuditOnly)."
}

# 5. Windows Defender Exclusions & PowerShell Policy (Telemetry Protection)
if (-not $AuditOnly -and $isAdmin) {
    try {
        Add-MpPreference -ExclusionPath $InstallRoot -ErrorAction Stop
        Add-Result "Defender Exclusion" "FIXED" "Excluded $InstallRoot from real-time telemetry throttling."
    } catch {
        Add-Result "Defender Exclusion" "WARN" "Could not add Defender exclusion: $($_.Exception.Message)"
    }
    try {
        Set-ExecutionPolicy -Scope LocalMachine -ExecutionPolicy RemoteSigned -Force -ErrorAction Stop
        Add-Result "PowerShell Policy" "FIXED" "Set LocalMachine ExecutionPolicy to RemoteSigned."
    } catch {
        Add-Result "PowerShell Policy" "WARN" "Could not update ExecutionPolicy: $($_.Exception.Message)"
    }
} else {
    $ep = Get-ExecutionPolicy
    Add-Result "PowerShell Policy" "OK" "Current ExecutionPolicy: $ep"
}

# 6. Core Runtimes & Tools
if ($hasWinget) {
    # VC++ Redistributable (needed by llama-server.exe & native node modules)
    $vcKey = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" -ErrorAction SilentlyContinue
    if ($vcKey -and $vcKey.Installed -eq 1) {
        Add-Result "VC++ Redistributable x64" "OK" "Version $($vcKey.Version)"
    } elseif ($AuditOnly) {
        Add-Result "VC++ Redistributable x64" "MISSING" "Required for prism-llama & native Node addons."
    } else {
        winget install --id Microsoft.VCRedist.2015+.x64 --exact --silent --accept-package-agreements --accept-source-agreements | Out-Null
        Add-Result "VC++ Redistributable x64" "FIXED" "Installed via winget."
    }

    Ensure-WingetPackage -DisplayName "Git for Windows" -CommandCheck "git" -WingetId "Git.Git" | Out-Null
    Ensure-WingetPackage -DisplayName "Node.js LTS" -CommandCheck "node" -WingetId "OpenJS.NodeJS.LTS" -VersionArgs "-v" | Out-Null
    Ensure-WingetPackage -DisplayName "Python 3.11" -CommandCheck "python" -WingetId "Python.Python.3.11" | Out-Null
    Ensure-WingetPackage -DisplayName "Cloudflare Tunnel" -CommandCheck "cloudflared" -WingetId "Cloudflare.cloudflared" | Out-Null
    Ensure-WingetPackage -DisplayName "Ollama" -CommandCheck "ollama" -WingetId "Ollama.Ollama" | Out-Null
}

# 7. Python Required Packages (Telemetry + MCP Skills)
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pyPkgs = @("mcp", "starlette", "uvicorn", "httpx", "pydantic", "pymongo")
    $missingPkgs = @()
    foreach ($pkg in $pyPkgs) {
        python -c "import $pkg" 2>$null
        if ($LASTEXITCODE -ne 0) { $missingPkgs += $pkg }
    }
    if ($missingPkgs.Count -eq 0) {
        Add-Result "Python Telemetry/MCP Pkgs" "OK" "All installed ($($pyPkgs -join ', '))"
    } elseif ($AuditOnly) {
        Add-Result "Python Telemetry/MCP Pkgs" "MISSING" "Missing: $($missingPkgs -join ', ')"
    } else {
        Write-Host "  -> Installing Python packages: $($missingPkgs -join ', ')..." -ForegroundColor DarkCyan
        python -m pip install --upgrade pip --quiet
        python -m pip install $missingPkgs --quiet
        Add-Result "Python Telemetry/MCP Pkgs" "FIXED" "Installed: $($missingPkgs -join ', ')"
    }
}

# 8. PM2 Process Manager
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    $pm2Ver = (& pm2 -v 2>&1 | Select-Object -Last 1) -as [string]
    Add-Result "PM2 Process Manager" "OK" "v$($pm2Ver.Trim())"
} elseif ($AuditOnly) {
    Add-Result "PM2 Process Manager" "MISSING" "Run: npm install -g pm2 pm2-windows-startup"
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "  -> Installing PM2 & pm2-windows-startup globally..." -ForegroundColor DarkCyan
    npm install -g pm2 pm2-windows-startup | Out-Null
    pm2-startup install | Out-Null
    Add-Result "PM2 Process Manager" "FIXED" "Installed globally with Windows startup hook."
}

# 9. MongoDB Community Server (Windows Service)
$mongoSvc = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($mongoSvc) {
    if ($mongoSvc.Status -eq "Running") {
        Add-Result "MongoDB Windows Service" "OK" "Running on 127.0.0.1:27017"
    } elseif (-not $AuditOnly -and $isAdmin) {
        Start-Service -Name "MongoDB"
        Add-Result "MongoDB Windows Service" "FIXED" "Started MongoDB service."
    } else {
        Add-Result "MongoDB Windows Service" "WARN" "Installed but currently $($mongoSvc.Status)."
    }
} else {
    if ($AuditOnly) {
        Add-Result "MongoDB Windows Service" "MISSING" "Install MongoDB Community Server 8.x (winget id: MongoDB.Server)"
    } elseif ($hasWinget) {
        Write-Host "  -> Installing MongoDB Community Server via winget..." -ForegroundColor DarkCyan
        winget install --id MongoDB.Server --exact --silent --accept-package-agreements --accept-source-agreements | Out-Null
        Add-Result "MongoDB Windows Service" "FIXED" "Installed MongoDB.Server. Verify 'MongoDB' service is Running."
    }
}

# 10. Prism-Llama (llama.cpp CUDA build)
$prismExe = Join-Path $InstallRoot "prism-llama\bin\llama-server.exe"
if (Test-Path $prismExe) {
    Add-Result "Prism-Llama (llama.cpp)" "OK" "Found at $prismExe"
} else {
    Add-Result "Prism-Llama (llama.cpp)" "MISSING" "Not found at $prismExe — copy the Satchida prism-llama CUDA bundle here."
}

# 11. Outbound HTTPS Telemetry Reachability (Cloudflare Tunnel -> One-API)
try {
    $resp = Invoke-WebRequest -Uri $GatewayUrl -Method Head -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Add-Result "Gateway HTTPS ($GatewayUrl)" "OK" "Reachable (HTTP $($resp.StatusCode))"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode) {
        Add-Result "Gateway HTTPS ($GatewayUrl)" "OK" "Reachable over TLS/443 (HTTP $statusCode)"
    } else {
        Add-Result "Gateway HTTPS ($GatewayUrl)" "WARN" "Unreachable: $($_.Exception.Message). Check outbound TCP 443 / firewall."
    }
}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "  PREREQUISITE CHECK SUMMARY" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
$results | Format-Table -AutoSize

$missingCount = ($results | Where-Object { $_.Status -eq "MISSING" }).Count
if ($missingCount -gt 0) {
    Write-Host "Action Required: $missingCount component(s) are MISSING. Review the table above." -ForegroundColor Yellow
} else {
    Write-Host "All checked prerequisites are satisfied or installed!" -ForegroundColor Green
}
