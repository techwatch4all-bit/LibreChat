$ErrorActionPreference = 'SilentlyContinue'

# Find Intel Adapter LUID dynamically from GPUAdapterMemory
$g = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory | Where-Object { $_.SharedUsage -gt 50000000 -and $_.DedicatedUsage -eq 0 } | Select-Object -First 1
$luid = if ($g) { ($g.Name -split '_phys')[0] -replace 'luid_','' } else { '' }

$pct3d = 0
$pctVideo = 0
$pctTotal = 0

if ($luid) {
  $engines = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine | Where-Object { $_.Name -like ('*' + $luid + '*') }
  $pct3d = ($engines | Where-Object { $_.Name -match 'engtype_3D' } | Measure-Object -Property UtilizationPercentage -Sum).Sum
  $pctVideo = ($engines | Where-Object { $_.Name -match 'engtype_VideoProcessing' } | Measure-Object -Property UtilizationPercentage -Sum).Sum
  $pctTotal = ($engines | Measure-Object -Property UtilizationPercentage -Sum).Sum
}

$numCores = [Environment]::ProcessorCount
$pList = Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node|mongod|chrome|llama-server|cloudflared' }
$perfList = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | Where-Object { $_.Name -match 'node|mongod|chrome|llama-server|cloudflared' }

$procs = foreach ($p in $pList) {
  $perf = $perfList | Where-Object { $_.IDProcess -eq $p.ProcessId } | Select-Object -First 1
  $cpu = if ($perf) { [Math]::Round($perf.PercentProcessorTime / $numCores, 1) } else { 0 }
  [PSCustomObject]@{
    pid = $p.ProcessId
    name = $p.Name
    cpu_percent = $cpu
    mem_mb = [Math]::Round($p.WorkingSetSize / 1MB, 1)
    command = if ($p.CommandLine -and $p.CommandLine.Length -gt 120) { $p.CommandLine.Substring(0, 120) + '...' } else { $p.CommandLine }
  }
}

[PSCustomObject]@{
  intel_shared_mb = if ($g) { [Math]::Round($g.SharedUsage / 1MB) } else { 0 }
  intel_util_percent = if ($pctTotal) { [Math]::Min(100, [int]$pctTotal) } else { 0 }
  intel_3d_percent = if ($pct3d) { [Math]::Min(100, [int]$pct3d) } else { 0 }
  intel_video_percent = if ($pctVideo) { [Math]::Min(100, [int]$pctVideo) } else { 0 }
  processes = $procs | Sort-Object -Property mem_mb -Descending | Select-Object -First 25
} | ConvertTo-Json -Compress
