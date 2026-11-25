# Satchida LibreChat Auto-Restart Watchdog
# Checks that LibreChat is running and healthy on port 3080;
# restarts it automatically if killed/stopped and verifies health with retry.

$ErrorActionPreference = "Stop"
$WorkDir = "D:\LAN-AI-Infra\LibreChat"
$LogDir  = Join-Path $WorkDir "logs"
$LogFile = Join-Path $LogDir "watchdog.log"
$HealthUrl = "http://127.0.0.1:3080/api/health"
$EcosystemFile = Join-Path $WorkDir "ecosystem.config.cjs"

if (-not (Test-Path $WorkDir)) {
    throw "Directory $WorkDir is not accessible (drive D: may not be mounted yet)"
}

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
}

function Write-WatchdogLog([string]$Msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$ts] $Msg" -ErrorAction SilentlyContinue
}

$healthy = $false
try {
    $resp = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
        $healthy = $true
    }
} catch {
    $healthy = $false
}

if (-not $healthy) {
    Write-WatchdogLog "LibreChat not responding on $HealthUrl; initiating restart..."

    # Check PM2 first
    $pm2Check = try { & pm2 describe librechat 2>$null } catch { $null }
    if ($LASTEXITCODE -eq 0 -and $pm2Check) {
        Write-WatchdogLog "Restarting LibreChat via PM2..."
        & pm2 restart librechat 2>&1 | Out-Null
    } elseif (Test-Path $EcosystemFile) {
        Write-WatchdogLog "Starting LibreChat via PM2 ecosystem..."
        & pm2 start $EcosystemFile --only librechat 2>&1 | Out-Null
    } else {
        Write-WatchdogLog "Starting LibreChat via direct node process..."
        Start-Process -FilePath "C:\Program Files\nodejs\node.exe" -ArgumentList "api\server\index.js" -WorkingDirectory $WorkDir -WindowStyle Hidden
    }

    # Verification polling loop: up to 30 seconds
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            $checkResp = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($checkResp.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch { }
    }

    if ($ready) {
        Write-WatchdogLog "LibreChat successfully verified healthy on $HealthUrl."
    } else {
        Write-WatchdogLog "ERROR: LibreChat did not become healthy within 30 seconds."
        throw "LibreChat failed health check on $HealthUrl after restart"
    }
}
