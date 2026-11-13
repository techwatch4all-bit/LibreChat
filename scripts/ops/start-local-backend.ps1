param(
    # Any GGUF served by llama.cpp. This is one possible backend; the guardrail
    # proxy works with any OpenAI-compatible provider, not just this one.
    [string]$Model      = "D:\LAN-AI-Infra\LLM-models\Ternary-Bonsai-2-9B\Ternary-Bonsai-2-9B-PQ2_0-MTP-Q8_0.gguf",
    [int]   $Port       = 8080,
    [int]   $CtxSize    = 16384,
    [int]   $GpuLayers  = 99,
    [int]   $Parallel   = 1
)

$ErrorActionPreference = "Stop"

$LLAMA_EXE = "D:\LAN-AI-Infra\prism-llama\bin\llama-server.exe"
if (-not (Test-Path $LLAMA_EXE)) {
    $LLAMA_EXE = "D:\LAN-AI-Infra\Satchida-AI-Interface\llama-cpp-cuda\llama-server.exe"
}
if (-not (Test-Path $LLAMA_EXE)) { throw "llama-server.exe not found." }
if (-not (Test-Path $Model))     { throw "Model not found: $Model" }

$LLAMA_URL = "http://127.0.0.1:$Port"

function Test-LlamaHealthy {
    try {
        $p = Invoke-RestMethod -Uri "$LLAMA_URL/health" -TimeoutSec 2 -ErrorAction Stop
        return ($p.status -eq "ok" -or $p.status -eq "no slot available")
    } catch { return $false }
}

$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    if (Test-LlamaHealthy) {
        Write-Host "[OK] llama-server already healthy on port $Port." -ForegroundColor Green
        exit 0
    }
    $proc = Get-Process -Id ($existing | Select-Object -First 1).OwningProcess -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -notmatch "llama") {
        Write-Host "[BLOCKED] Port $Port owned by $($proc.ProcessName) (PID $($proc.Id)); refusing to terminate." -ForegroundColor Red
        exit 1
    }
    $existing | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 700
}

# Anti-repetition + low-reasoning deterministic decoding.
$args = @(
    "--model",           $Model,
    "--ctx-size",        "$CtxSize",
    "--n-gpu-layers",    "$GpuLayers",
    "--parallel",        "$Parallel",
    "--jinja",
    "--flash-attn",      "auto",
    "--host",            "0.0.0.0",
    "--port",            "$Port",

    # --- Decoding: kill the degenerate thinking-loop / padded-summary behavior ---
    "--temp",            "0.2",
    "--top-k",           "20",
    "--top-p",           "0.8",
    "--min-p",           "0.0",
    "--repeat-penalty",  "1.15",
    "--repeat-last-n",   "512",

    # Thinking disabled at the template level ('--reasoning-budget 0' is NOT
    # honored by the Ternary-Bonsai-2 template; '--reasoning off' is, and it
    # keeps message.content clean instead of leaking <think> blocks).
    "--reasoning", "off",
    "--reasoning-format", "deepseek",

    # Hard stop so it can never emit a second summary block after a tool call.
    # (This llama.cpp build uses --reverse-prompt; --stop was removed, and
    # multi-line stop strings cannot survive Start-Process argument joining.)
    "--reverse-prompt",  "</s>",
    "--reverse-prompt",  "<end_of_turn>"
)

Write-Host "[*] Launching llama-server (executor decoding profile) on port $Port ..." -ForegroundColor Cyan
Write-Host "    Model: $Model" -ForegroundColor DarkGray
Start-Process -FilePath $LLAMA_EXE -ArgumentList $args -WindowStyle Hidden

$waited = 0; $ready = $false
while (($waited -lt 40) -and (-not $ready)) {
    Start-Sleep -Seconds 1; $waited++
    if (Test-LlamaHealthy) { $ready = $true; Write-Host "[READY] llama-server healthy after ${waited}s." -ForegroundColor Green }
}
if (-not $ready) { Write-Host "[WARN] Not healthy after 40s." -ForegroundColor Yellow; exit 1 }