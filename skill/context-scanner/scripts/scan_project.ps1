<#
.SYNOPSIS
    scan_project.ps1 — Context Scanner for AI Agents
    Scans a project repo and generates a detailed CONTEXT.md

.DESCRIPTION
    Part of the context-scanner skill at D:\LAN-AI-Infra\skills\context-scanner\
    Run this at the start of any project session to avoid re-reading source files.

.PARAMETER RepoPath
    Path to the repository root. Defaults to current directory.

.PARAMETER Force
    Overwrite existing CONTEXT.md without prompting.

.PARAMETER SkipAgentsMd
    Don't append the CONTEXT.md directive to AGENTS.md.

.EXAMPLE
    .\scan_project.ps1 -RepoPath "D:\LAN-AI-Infra\satchida-ai-unified-suite"
    .\scan_project.ps1 -RepoPath "D:\LAN-AI-Infra\open-science-upstream" -Force
    .\scan_project.ps1  # scans current directory
#>

param(
    [string]$RepoPath = (Get-Location).Path,
    [switch]$Force,
    [switch]$SkipAgentsMd
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Constants ──────────────────────────────────────────────────────────────
$SCANNER_VERSION = "1.0.0"
$SCAN_DATE = (Get-Date -Format "yyyy-MM-dd HH:mm")
$SKILL_ROOT = "D:\LAN-AI-Infra\skills\context-scanner"
$IGNORE_FILE = Join-Path $SKILL_ROOT "references\ignore-patterns.txt"
$MAX_TODO_LINES = 25
$MAX_TREE_DEPTH = 3

$IGNORE_DIRS = @(
    "node_modules", ".git", "dist", "build", "target", "__pycache__",
    ".cache", "backup", ".vite", ".svelte-kit", ".next", ".nuxt",
    "out", "coverage", ".turbo", ".yarn", ".pnpm-store", "generated",
    ".husky", ".github", "helm", "specs", ".react-router"
)

# Load additional ignore patterns from file if present
if (Test-Path $IGNORE_FILE) {
    $filePatterns = Get-Content $IGNORE_FILE | Where-Object { $_ -and -not $_.StartsWith("#") }
    $IGNORE_DIRS += $filePatterns
}
$IGNORE_DIRS = $IGNORE_DIRS | Sort-Object -Unique

# ── Helpers ────────────────────────────────────────────────────────────────
function Write-Step { param($msg) Write-Host "  → $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  ⚠ $msg" -ForegroundColor Yellow }

function Should-Skip {
    param([string]$name)
    return $IGNORE_DIRS -contains $name
}

function Get-DirectoryTree {
    param([string]$Path, [int]$Depth = 0, [int]$MaxDepth = 3)
    if ($Depth -gt $MaxDepth) { return }
    $indent = "  " * $Depth
    $items = Get-ChildItem -Path $Path -ErrorAction SilentlyContinue |
             Where-Object { -not (Should-Skip $_.Name) } |
             Sort-Object { $_.PSIsContainer } -Descending |
             Sort-Object Name
    foreach ($item in $items) {
        if ($item.PSIsContainer) {
            "  $indent$($item.Name)/"
            Get-DirectoryTree -Path $item.FullName -Depth ($Depth + 1) -MaxDepth $MaxDepth
        } else {
            "  $indent$($item.Name)"
        }
    }
}

function Detect-TechStack {
    param([string]$Root)
    $stack = @()
    $framework = "Unknown"
    $language = "Unknown"
    $buildTool = "Unknown"
    $pkgMgr = "Unknown"

    # Language detection
    if (Test-Path (Join-Path $Root "Cargo.toml")) { $language = "Rust"; $buildTool = "Cargo" }
    if (Test-Path (Join-Path $Root "pyproject.toml")) { $language = "Python"; $buildTool = "uv/pip" }
    if (Test-Path (Join-Path $Root "go.mod")) { $language = "Go"; $buildTool = "go build" }
    if (Test-Path (Join-Path $Root "package.json")) {
        $language = "TypeScript/JavaScript"
        $pkg = Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($pkg) {
            # Framework detection
            $deps = @{}
            if ($pkg.PSObject.Properties["dependencies"]) { $pkg.dependencies.PSObject.Properties | ForEach-Object { $deps[$_.Name] = $_.Value } }
            if ($pkg.PSObject.Properties["devDependencies"]) { $pkg.devDependencies.PSObject.Properties | ForEach-Object { $deps[$_.Name] = $_.Value } }

            if ($deps.ContainsKey("svelte") -or $deps.ContainsKey("@sveltejs/kit")) { $framework = "SvelteKit" }
            elseif ($deps.ContainsKey("next")) { $framework = "Next.js" }
            elseif ($deps.ContainsKey("react") -and $deps.ContainsKey("@react-router/node")) { $framework = "React Router v7" }
            elseif ($deps.ContainsKey("react")) { $framework = "React" }
            elseif ($deps.ContainsKey("vue")) { $framework = "Vue" }

            if ($deps.ContainsKey("vite") -or ($pkg.PSObject.Properties["devDependencies"] -and $pkg.devDependencies.PSObject.Properties["vite"])) { $buildTool = "Vite" }
            elseif ($deps.ContainsKey("webpack")) { $buildTool = "Webpack" }
            elseif ($deps.ContainsKey("turbopack")) { $buildTool = "Turbopack" }

            # Package manager
            if (Test-Path (Join-Path $Root "pnpm-lock.yaml")) { $pkgMgr = "pnpm" }
            elseif (Test-Path (Join-Path $Root "yarn.lock")) { $pkgMgr = "yarn" }
            elseif (Test-Path (Join-Path $Root "package-lock.json")) { $pkgMgr = "npm" }
            elseif (Test-Path (Join-Path $Root "bun.lockb")) { $pkgMgr = "bun" }

            # Stack addons
            if ($deps.ContainsKey("@tauri-apps/api") -or (Test-Path (Join-Path $Root "src-tauri"))) { $stack += "Tauri" }
            if ($deps.ContainsKey("electron")) { $stack += "Electron" }
            if ($deps.ContainsKey("tailwindcss") -or $deps.ContainsKey("@tailwindcss/vite")) { $stack += "Tailwind CSS" }
            if ($deps.ContainsKey("@radix-ui/react-dialog") -or ($deps.Keys | Where-Object { $_ -like "@radix-ui/*" })) { $stack += "Radix UI" }
            if ($deps.ContainsKey("zustand")) { $stack += "Zustand" }
            if ($deps.ContainsKey("react-query") -or $deps.ContainsKey("@tanstack/react-query")) { $stack += "TanStack Query" }
            if ($deps.ContainsKey("drizzle-orm") -or $deps.ContainsKey("prisma")) { $stack += "ORM" }
        }
    }

    # Tauri check (Rust)
    if (Test-Path (Join-Path $Root "src-tauri\tauri.conf.json")) {
        $stack += "Tauri"
        $tauriConf = Get-Content (Join-Path $Root "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($tauriConf -and $tauriConf.PSObject.Properties["productName"]) {
            # productName already captured in project name
        }
    }

    return @{
        Language   = $language
        Framework  = $framework
        BuildTool  = $buildTool
        PkgMgr     = $pkgMgr
        Stack      = ($stack | Sort-Object -Unique) -join ", "
    }
}

function Get-ProjectName {
    param([string]$Root)
    # Try package.json
    $pkgPath = Join-Path $Root "package.json"
    if (Test-Path $pkgPath) {
        $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($pkg -and $pkg.PSObject.Properties["name"]) { return $pkg.name }
    }
    # Try Cargo.toml
    $cargoPath = Join-Path $Root "Cargo.toml"
    if (Test-Path $cargoPath) {
        $line = Get-Content $cargoPath | Where-Object { $_ -match '^name\s*=' } | Select-Object -First 1
        if ($line) { return ($line -replace '^name\s*=\s*"(.+)".*', '$1') }
    }
    # Fallback to directory name
    return (Split-Path $Root -Leaf)
}

function Get-KeyFiles {
    param([string]$Root)
    $keyFiles = @()
    $important = @(
        "package.json", "Cargo.toml", "pyproject.toml", "go.mod",
        "vite.config.ts", "vite.config.js", "svelte.config.js", "svelte.config.ts",
        "tauri.conf.json", "tauri.conf.json.bak",
        "tsconfig.json", "tsconfig.lib.json",
        "README.md", "AGENTS.md", "CONTEXT.md", "CHANGELOG.md",
        ".env", ".env.example", ".env.development",
        "react-router.config.ts", "electron-builder.config.mjs",
        "playwright.config.ts", "vitest.setup.ts",
        "models-preset.ini", "models-catalog.json",
        "opencode.json", "opencode.jsonc"
    )
    foreach ($fn in $important) {
        $fp = Join-Path $Root $fn
        if (Test-Path $fp -PathType Leaf) {
            $lineCount = (Get-Content $fp -ErrorAction SilentlyContinue).Count
            $purpose = switch ($fn) {
                "package.json"                { "npm package manifest, scripts, dependencies" }
                "Cargo.toml"                  { "Rust package manifest, workspace members, dependencies" }
                "vite.config.ts"              { "Vite build config" }
                "vite.config.js"              { "Vite build config" }
                "svelte.config.js"            { "SvelteKit adapter + route config" }
                "svelte.config.ts"            { "SvelteKit adapter + route config" }
                "tauri.conf.json"             { "Tauri app config: productName, CSP, externalBin, permissions" }
                "tsconfig.json"               { "TypeScript compiler options" }
                "README.md"                   { "Project overview and setup instructions" }
                "AGENTS.md"                   { "AI agent directives and project rules" }
                "CONTEXT.md"                  { "AI agent project memory (this file)" }
                ".env"                        { "Environment variables (values are private)" }
                ".env.example"                { "Environment variable keys reference" }
                "react-router.config.ts"      { "React Router v7 SSR/SPA mode config" }
                "electron-builder.config.mjs" { "Electron desktop build config" }
                "models-preset.ini"           { "llama-server model presets" }
                "models-catalog.json"         { "Available model catalog" }
                "opencode.json"               { "OpenCode runtime config (providers, model, permissions)" }
                default                       { "Project file" }
            }
            $keyFiles += "| ``$fn`` | $purpose | $lineCount |"
        }
    }
    # Also scan src-tauri
    $tauriConf = Join-Path $Root "src-tauri\tauri.conf.json"
    if (Test-Path $tauriConf) {
        $lineCount = (Get-Content $tauriConf -ErrorAction SilentlyContinue).Count
        $keyFiles += "| ``src-tauri/tauri.conf.json`` | Tauri app config: productName, CSP, externalBin, permissions | $lineCount |"
    }
    return $keyFiles
}

function Get-EntryPoints {
    param([string]$Root)
    $entries = @()
    $candidates = @(
        "src\main.ts", "src\main.tsx", "src\index.ts", "src\index.tsx",
        "src\app.ts", "src\app.tsx", "src\root.tsx",
        "src\index.svelte", "src\app.svelte",
        "src-tauri\src\main.rs", "src-tauri\src\lib.rs",
        "src\lib.rs", "src\main.rs",
        "main.py", "app.py", "__main__.py",
        "main.go", "cmd\main.go",
        "app.html", "app.d.ts"
    )
    foreach ($rel in $candidates) {
        $fp = Join-Path $Root $rel
        if (Test-Path $fp -PathType Leaf) {
            $entries += "- ``$rel``"
        }
    }
    # Routes directory
    foreach ($routeDir in @("src\routes", "src\app", "src\pages")) {
        $rd = Join-Path $Root $routeDir
        if (Test-Path $rd -PathType Container) {
            $routeFiles = Get-ChildItem $rd -Recurse -File -Filter "*.svelte" -ErrorAction SilentlyContinue | 
                          Select-Object -First 10 | ForEach-Object { "  - ``$($_.FullName.Replace($Root, '').TrimStart('\').Replace('\', '/'))``" }
            if ($routeFiles) {
                $entries += "- **Routes** (``$routeDir``):"
                $entries += $routeFiles
            }
        }
    }
    if ($entries.Count -eq 0) { $entries += "- No standard entry points detected — check manually" }
    return ,$entries
}

function Get-Dependencies {
    param([string]$Root)
    $lines = @()
    $pkgPath = Join-Path $Root "package.json"
    if (Test-Path $pkgPath) {
        $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($pkg) {
            if ($pkg.PSObject.Properties["dependencies"]) {
                $lines += "### Runtime dependencies"
                $pkg.dependencies.PSObject.Properties | Sort-Object Name | ForEach-Object {
                    $lines += "- ``$($_.Name)``: $($_.Value)"
                }
            }
            if ($pkg.PSObject.Properties["devDependencies"]) {
                $lines += ""
                $lines += "### Dev dependencies (key ones)"
                $pkg.devDependencies.PSObject.Properties | 
                    Where-Object { $_.Name -match "vite|tauri|svelte|react|typescript|vitest|playwright|electron|rollup|esbuild" } |
                    Sort-Object Name | ForEach-Object {
                        $lines += "- ``$($_.Name)``: $($_.Value)"
                    }
            }
        }
    }
    $cargoPath = Join-Path $Root "Cargo.toml"
    if (Test-Path $cargoPath) {
        $lines += "### Rust dependencies (from Cargo.toml)"
        $inDeps = $false
        Get-Content $cargoPath | ForEach-Object {
            if ($_ -match "^\[dependencies\]") { $inDeps = $true; return }
            if ($_ -match "^\[" -and $inDeps) { $inDeps = $false }
            if ($inDeps -and $_ -match "^(\w.+?)\s*=") { $lines += "- ``$($Matches[1])``" }
        }
    }
    if ($lines.Count -eq 0) { $lines += "No package manifest found — add manually" }
    return $lines
}

function Get-EnvVars {
    param([string]$Root)
    $lines = @()
    $envFiles = @(".env.example", ".env.development", ".env")
    foreach ($ef in $envFiles) {
        $fp = Join-Path $Root $ef
        if (Test-Path $fp) {
            $lines += "**From ``$ef``** (keys only — never values):"
            Get-Content $fp | Where-Object { $_ -match "^[A-Z_]+=?" -and $_ -notmatch "^#" } |
                ForEach-Object { $key = ($_ -split "=")[0]; $lines += "- ``$key``" }
            $lines += ""
        }
    }
    # Also grep source for process.env or import.meta.env references
    $envRefs = Get-ChildItem (Join-Path $Root "src") -Recurse -File -Include "*.ts","*.tsx","*.svelte","*.js" -ErrorAction SilentlyContinue |
               Select-String -Pattern "process\.env\.([A-Z_]+)|import\.meta\.env\.([A-Z_]+)" -ErrorAction SilentlyContinue |
               ForEach-Object { 
                   if ($_.Matches[0].Groups[1].Value) { $_.Matches[0].Groups[1].Value }
                   elseif ($_.Matches[0].Groups[2].Value) { $_.Matches[0].Groups[2].Value }
               } | Sort-Object -Unique
    if ($envRefs) {
        $lines += "**Referenced in source code**:"
        $envRefs | ForEach-Object { $lines += "- ``$_``" }
    }
    if ($lines.Count -eq 0) { $lines += "No .env files found — add manually" }
    return $lines
}

function Get-GitState {
    param([string]$Root)
    try {
        $branch = git -C $Root rev-parse --abbrev-ref HEAD 2>$null
        $remote = git -C $Root remote get-url origin 2>$null
        $log = git -C $Root log --oneline -5 2>$null
        return @{
            Branch = if ($branch) { $branch } else { "unknown" }
            Remote = if ($remote) { $remote } else { "no remote" }
            Log    = if ($log) { $log -join "`n" } else { "no commits" }
        }
    } catch {
        return @{ Branch = "unknown"; Remote = "no remote"; Log = "git not available" }
    }
}

function Get-KnownIssues {
    param([string]$Root)
    $lines = @()
    try {
        $results = Get-ChildItem $Root -Recurse -File -Include "*.ts","*.tsx","*.rs","*.svelte","*.js","*.py" -ErrorAction SilentlyContinue |
                   Where-Object { -not (Should-Skip ($_.DirectoryName.Split([IO.Path]::DirectorySeparatorChar) | Select-Object -Last 1)) } |
                   Select-String -Pattern "(TODO|FIXME|HACK|BUG|XXX)[\s:]+(.+)" -ErrorAction SilentlyContinue |
                   Select-Object -First $MAX_TODO_LINES
        foreach ($r in $results) {
            $rel = $r.Path.Replace($Root, "").TrimStart("\").Replace("\", "/")
            $lines += "- ``$rel``:$($r.LineNumber) — $($r.Line.Trim())"
        }
    } catch {}
    if ($lines.Count -eq 0) { $lines += "No TODO/FIXME/HACK comments found." }
    return ,$lines
}

function Get-StackDetails {
    param([string]$Root, [hashtable]$Stack)
    $lines = @()
    # Tauri details
    $tauriConf = Join-Path $Root "src-tauri\tauri.conf.json"
    if (Test-Path $tauriConf) {
        $conf = Get-Content $tauriConf -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($conf) {
            $lines += "**Tauri**:"
            if ($conf.PSObject.Properties["productName"]) { $lines += "  - productName: ``$($conf.productName)``" }
            if ($conf.PSObject.Properties["identifier"]) { $lines += "  - identifier: ``$($conf.identifier)``" }
        }
    }
    # SvelteKit
    $svelteConf = Join-Path $Root "svelte.config.js"
    if (-not (Test-Path $svelteConf)) { $svelteConf = Join-Path $Root "svelte.config.ts" }
    if (Test-Path $svelteConf) {
        $content = Get-Content $svelteConf -Raw
        if ($content -match "adapter-(\w+)") { $lines += "**SvelteKit adapter**: $($Matches[0])" }
    }
    # React Router
    $rrConf = Join-Path $Root "react-router.config.ts"
    if (Test-Path $rrConf) {
        $content = Get-Content $rrConf -Raw
        if ($content -match "ssr:\s*(true|false)") { $lines += "**React Router SSR**: $($Matches[1])" }
    }
    if ($lines.Count -eq 0) { $lines += "Standard $($Stack.Framework) setup — see config files above for details." }
    return $lines
}

function Add-AgentsMdDirective {
    param([string]$Root)
    $agentsPath = Join-Path $Root "AGENTS.md"
    if (-not (Test-Path $agentsPath)) { return }
    $content = Get-Content $agentsPath -Raw
    if ($content -match "MANDATORY FIRST STEP") {
        Write-Warn "AGENTS.md already has CONTEXT.md directive — skipping"
        return
    }
    $directive = @"

## ⚡ MANDATORY FIRST STEP FOR EVERY SESSION

**Read ``CONTEXT.md`` in the repo root BEFORE opening any source file.**

``CONTEXT.md`` contains the architecture map, file index, known issues, and session log.
It was generated by the context-scanner skill. After your session, append one line to
the Session Log table in ``CONTEXT.md`` (date + agent + what was done).
"@
    Add-Content $agentsPath $directive
    Write-OK "Added CONTEXT.md directive to AGENTS.md"
}

# ── Main ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "━━━ Context Scanner v$SCANNER_VERSION ━━━" -ForegroundColor Magenta
Write-Host "  Repo: $RepoPath" -ForegroundColor Gray
Write-Host ""

# Validate
if (-not (Test-Path $RepoPath -PathType Container)) {
    Write-Error "RepoPath does not exist: $RepoPath"
    exit 1
}

$outPath = Join-Path $RepoPath "CONTEXT.md"
if ((Test-Path $outPath) -and -not $Force) {
    Write-Warn "CONTEXT.md already exists. Use -Force to overwrite."
    Write-Host "  Existing: $outPath"
    exit 0
}

# Run analysis
Write-Step "Detecting project name..."
$projectName = Get-ProjectName -Root $RepoPath
Write-OK "Project: $projectName"

Write-Step "Detecting tech stack..."
$stackInfo = Detect-TechStack -Root $RepoPath
Write-OK "Stack: $($stackInfo.Language) / $($stackInfo.Framework) / $($stackInfo.BuildTool)"

Write-Step "Building directory tree (depth $MAX_TREE_DEPTH)..."
$repoTree = Get-DirectoryTree -Path $RepoPath -MaxDepth $MAX_TREE_DEPTH | Out-String
Write-OK "Tree built"

Write-Step "Indexing key files..."
$keyFilesTable = Get-KeyFiles -Root $RepoPath
Write-OK "$($keyFilesTable.Count) key files indexed"

Write-Step "Finding entry points..."
$entryPoints = Get-EntryPoints -Root $RepoPath
Write-OK "$($entryPoints.Count) entry points found"

Write-Step "Extracting dependencies..."
$dependencies = Get-Dependencies -Root $RepoPath
Write-OK "Dependencies extracted"

Write-Step "Scanning environment variables..."
$envVars = Get-EnvVars -Root $RepoPath
Write-OK "Env vars scanned (values hidden)"

Write-Step "Reading git state..."
$gitState = Get-GitState -Root $RepoPath
Write-OK "Branch: $($gitState.Branch)"

Write-Step "Scanning for TODO/FIXME/HACK..."
$knownIssues = Get-KnownIssues -Root $RepoPath
Write-OK "$($knownIssues.Count) known issues found"

Write-Step "Building stack details..."
$stackDetails = Get-StackDetails -Root $RepoPath -Stack $stackInfo
Write-OK "Stack details ready"

# ── Render CONTEXT.md ──────────────────────────────────────────────────────
Write-Step "Writing CONTEXT.md..."

$output = @"
# $projectName — Project Context

> **AI Agent Directive**: Read this file FIRST before opening any source file.  
> Last updated: $SCAN_DATE by context-scanner v$SCANNER_VERSION

---

## 1. Identity & Stack

| Item | Value |
|---|---|
| Project name | $projectName |
| Path | $RepoPath |
| Git branch | $($gitState.Branch) |
| Primary language | $($stackInfo.Language) |
| Framework | $($stackInfo.Framework) |
| Build tool | $($stackInfo.BuildTool) |
| Package manager | $($stackInfo.PkgMgr) |
| Additional stack | $($stackInfo.Stack) |

**One-liner**: <!-- Add a one-sentence project description here -->

---

## 2. Repository Map

``````
$repoTree
``````

---

## 3. Key File Index

| File | Purpose | Lines |
|---|---|---|
$($keyFilesTable -join "`n")

---

## 4. Architecture Overview

<!-- Manual enrichment needed: describe data flow, key abstractions, runtime pipeline -->

**Tech stack details**:
$($stackDetails -join "`n")

**Config pipeline**:
<!-- Describe how config loads at startup -->

**Key abstractions**:
<!-- What are the 3-5 most important concepts to understand? -->

---

## 5. Entry Points & Routes

$($entryPoints -join "`n")

---

## 6. Top-Level Dependencies

$($dependencies -join "`n")

---

## 7. Environment Variables

> Values are NEVER stored here — key names only.

$($envVars -join "`n")

---

## 8. Git State

**Branch**: $($gitState.Branch)  
**Remote**: $($gitState.Remote)  

**Last 5 commits**:
``````
$($gitState.Log)
``````

---

## 9. Known Issues (TODOs / FIXMEs)

$($knownIssues -join "`n")

---

## 10. Integration Points

<!-- Manual: how does this repo connect to sibling repos? -->

| Sibling Repo | Connection Type | Details |
|---|---|---|
| <!-- fill in --> | <!-- iframe / npm / API / import --> | <!-- fill in --> |

---

## 11. Pending Work

<!-- Manual: incomplete features, broken things, deferred decisions -->

| Item | Status | Notes |
|---|---|---|
| <!-- fill in --> | ⚠️ / ❌ / 🔨 | <!-- fill in --> |

---

## 12. Session Log

> Append one line per session. Newest on top.

| Date | Agent | What was done |
|---|---|---|
| $SCAN_DATE | context-scanner v$SCANNER_VERSION | Initial CONTEXT.md generated |
"@

$output | Out-File -FilePath $outPath -Encoding utf8 -Force
Write-OK "Written: $outPath"

# Update AGENTS.md
if (-not $SkipAgentsMd) {
    Write-Step "Checking AGENTS.md..."
    Add-AgentsMdDirective -Root $RepoPath
}

Write-Host ""
Write-Host "━━━ Done ━━━" -ForegroundColor Magenta
Write-Host ""
Write-Host "  📄 CONTEXT.md: $outPath"
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "  1. Open CONTEXT.md and fill in sections marked '<!-- ... -->'"
Write-Host "  2. Add integration points (sibling repos)"
Write-Host "  3. Add pending work items"
Write-Host "  4. Run: git add CONTEXT.md && git commit -m 'docs: add CONTEXT.md via context-scanner'"
Write-Host ""
Write-Host "  Manual sections needing enrichment:" -ForegroundColor Yellow
Write-Host "  - Section 4: Architecture Overview (config pipeline, key abstractions)"
Write-Host "  - Section 10: Integration Points (sibling repos)"
Write-Host "  - Section 11: Pending Work"
Write-Host ""
