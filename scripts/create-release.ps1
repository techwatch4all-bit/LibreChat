<#
.SYNOPSIS
    Builds and packages a pruned production release of LibreChat.

.DESCRIPTION
    Compiles the frontend client bundle and all internal monorepo packages,
    assembles production runtime assets into release/<version>, and prunes devDependencies.
    The primary development workspace is left completely intact.

.PARAMETER Version
    The release version tag (defaults to v0.8.8-prod).

.EXAMPLE
    .\scripts\create-release.ps1 -Version "v0.8.9"
#>
param (
    [string]$Version = "v0.8.8-prod"
)

$ErrorActionPreference = "Stop"

$repoRoot = "D:\LAN-AI-Infra\LibreChat"
$releaseBase = "$repoRoot\release"
$releaseTarget = "$releaseBase\$Version"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " LibreChat Production Release Pipeline: $Version" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Compile workspace packages and frontend client
Write-Host "`n[1/5] Compiling workspace packages and client bundle in dev workspace..." -ForegroundColor Yellow
Set-Location $repoRoot
npm run frontend

# 2. Prepare target directory
Write-Host "`n[2/5] Preparing target release folder at $releaseTarget..." -ForegroundColor Yellow
if (Test-Path $releaseTarget) {
    Write-Host "Removing existing release at $releaseTarget..." -ForegroundColor DarkGray
    Remove-Item -Path $releaseTarget -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseTarget -Force | Out-Null

# 3. Copy runtime assets
Write-Host "`n[3/5] Copying production runtime assets..." -ForegroundColor Yellow
Copy-Item "$repoRoot\package.json" "$releaseTarget\package.json" -Force
Copy-Item "$repoRoot\package-lock.json" "$releaseTarget\package-lock.json" -Force
Copy-Item "$repoRoot\.env" "$releaseTarget\.env" -Force
Copy-Item "$repoRoot\librechat.yaml" "$releaseTarget\librechat.yaml" -Force
if (Test-Path "$repoRoot\satchida.lic") { Copy-Item "$repoRoot\satchida.lic" "$releaseTarget\satchida.lic" -Force }
if (Test-Path "$repoRoot\rag.yml") { Copy-Item "$repoRoot\rag.yml" "$releaseTarget\rag.yml" -Force }

# Copy config directory
robocopy "$repoRoot\config" "$releaseTarget\config" /E /NFL /NDL /NP /R:1 /W:1 | Out-Null

# Copy api directory (exclude node_modules)
robocopy "$repoRoot\api" "$releaseTarget\api" /E /XD node_modules /XF *.log /NFL /NDL /NP /R:1 /W:1 | Out-Null

# Copy client dist directory and package.json
New-Item -ItemType Directory -Path "$releaseTarget\client" -Force | Out-Null
Copy-Item "$repoRoot\client\package.json" "$releaseTarget\client\package.json" -Force
robocopy "$repoRoot\client\dist" "$releaseTarget\client\dist" /E /NFL /NDL /NP /R:1 /W:1 | Out-Null

# Copy packages dist & package.json
$packages = Get-ChildItem -Path "$repoRoot\packages" -Directory
foreach ($pkg in $packages) {
    $pkgDest = "$releaseTarget\packages\$($pkg.Name)"
    New-Item -ItemType Directory -Path $pkgDest -Force | Out-Null
    Copy-Item "$($pkg.FullName)\package.json" "$pkgDest\package.json" -Force
    if (Test-Path "$($pkg.FullName)\dist") {
        robocopy "$($pkg.FullName)\dist" "$pkgDest\dist" /E /NFL /NDL /NP /R:1 /W:1 | Out-Null
    }
}

# Copy optional infrastructure components
if (Test-Path "$repoRoot\satchida") { robocopy "$repoRoot\satchida" "$releaseTarget\satchida" /E /XD node_modules /XF *.log /NFL /NDL /NP /R:1 /W:1 | Out-Null }
if (Test-Path "$repoRoot\fleet") { robocopy "$repoRoot\fleet" "$releaseTarget\fleet" /E /XD node_modules /XF *.log /NFL /NDL /NP /R:1 /W:1 | Out-Null }
if (Test-Path "$repoRoot\rag-service") { robocopy "$repoRoot\rag-service" "$releaseTarget\rag-service" /E /XD node_modules /XF *.log /NFL /NDL /NP /R:1 /W:1 | Out-Null }

# 4. Install production-only dependencies
Write-Host "`n[4/5] Installing pruned production dependencies (omitting devDependencies)..." -ForegroundColor Yellow
Set-Location $releaseTarget
npm ci --omit=dev --ignore-scripts

# 5. Link latest pointer and verify
Write-Host "`n[5/5] Updating release\latest link and verifying runtime packages..." -ForegroundColor Yellow
$latestLink = "$releaseBase\latest"
if (Test-Path $latestLink) {
    cmd /c rmdir "$latestLink" 2>$null
    if (Test-Path $latestLink) { Remove-Item $latestLink -Force -Recurse }
}
cmd /c mklink /J "$latestLink" "$releaseTarget" | Out-Null

node -e "
const dp = require('librechat-data-provider');
const ds = require('@librechat/data-schemas');
const api = require('@librechat/api');
console.log('✔ All internal workspace packages verified successfully in $releaseTarget');
"

Set-Location $repoRoot

$sizeMB = [math]::Round(((Get-ChildItem -Path $releaseTarget -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB), 2)
Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " Release $Version created successfully!" -ForegroundColor Green
Write-Host " Location: $releaseTarget" -ForegroundColor Green
Write-Host " Latest Pointer: $latestLink" -ForegroundColor Green
Write-Host " Total Size: $sizeMB MB (Dev tooling pruned)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
