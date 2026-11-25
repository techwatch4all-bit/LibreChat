param(
    [int]$Port        = 8080,
    [int]$PollSeconds = 15
)

# Satchida llama-server watchdog: keeps the Privacy-lane backend alive.
# Polls http://127.0.0.1:$Port/health; when the server is down, runs the
# predefined start profile (start-local-backend.ps1), which is idempotent:
# it exits cleanly if the server is healthy and refuses to kill a port
# owned by a non-llama process. PM2 restarts this watchdog if it exits.

$ErrorActionPreference = "Continue"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $here "start-local-backend.ps1"
$lastStartAttempt = Get-Date "2000-01-01"

function Test-LlamaUp {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3 -ErrorAction Stop
        return ($r.status -eq "ok" -or $r.status -eq "no slot available")
    } catch { return $false }
}

Write-Host "[watchdog] llama-server watchdog started (port $Port, poll ${PollSeconds}s)."
while ($true) {
    if (-not (Test-LlamaUp)) {
        $sinceAttempt = ((Get-Date) - $lastStartAttempt).TotalSeconds
        if ($sinceAttempt -gt 60) {
            Write-Host ("[watchdog] {0} :8080 down - starting llama-server via predefined profile." -f (Get-Date -Format "HH:mm:ss"))
            $lastStartAttempt = Get-Date
            & powershell -NoProfile -ExecutionPolicy Bypass -File $startScript
        }
    }
    Start-Sleep -Seconds $PollSeconds
}
