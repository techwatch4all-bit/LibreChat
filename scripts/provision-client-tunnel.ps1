<#
.SYNOPSIS
  Create one Cloudflare named tunnel + DNS CNAME per client (satchida.com).
.DESCRIPTION
  Reads CF_API_TOKEN, CF_ACCOUNT_ID, CF_ZONE_ID from the environment (never from the repo).
  Token scope: Account>Cloudflare Tunnel:Edit, Zone>DNS:Edit for satchida.com only.
  Writes credentials JSON to -OutDir (default .\tunnel-creds). Never prints secrets.
  Idempotent: refuses if a tunnel with the same name exists.
.EXAMPLE
  $env:CF_API_TOKEN='...'; $env:CF_ACCOUNT_ID='...'; $env:CF_ZONE_ID='...'
  pwsh -File scripts/provision-client-tunnel.ps1 -Client acme
#>
param(
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]{2,40}$')][string]$Client,
  [string]$Domain = 'satchida.com',
  [string]$OutDir = '.\tunnel-creds'
)
$ErrorActionPreference = 'Stop'
foreach ($v in 'CF_API_TOKEN','CF_ACCOUNT_ID','CF_ZONE_ID') {
  if (-not (Get-Item "env:$v" -ErrorAction SilentlyContinue)) { throw "Missing env var $v" }
}
$h = @{ Authorization = "Bearer $env:CF_API_TOKEN"; 'Content-Type' = 'application/json' }
$base = 'https://api.cloudflare.com/client/v4'
$name = "client-$Client"
$host_ = "$Client.$Domain"

$existing = Invoke-RestMethod -Headers $h -Uri "$base/accounts/$env:CF_ACCOUNT_ID/cfd_tunnel?name=$name&is_deleted=false"
if ($existing.result.Count -gt 0) { throw "Tunnel $name already exists" }

$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)
$body = @{ name = $name; tunnel_secret = $secret; config_src = 'local' } | ConvertTo-Json
$t = Invoke-RestMethod -Method Post -Headers $h -Body $body -Uri "$base/accounts/$env:CF_ACCOUNT_ID/cfd_tunnel"
$id = $t.result.id

$dns = @{ type = 'CNAME'; name = $host_; content = "$id.cfargotunnel.com"; proxied = $true } | ConvertTo-Json
Invoke-RestMethod -Method Post -Headers $h -Body $dns -Uri "$base/zones/$env:CF_ZONE_ID/dns_records" | Out-Null

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$cred = @{ AccountTag = $env:CF_ACCOUNT_ID; TunnelID = $id; TunnelSecret = $secret } | ConvertTo-Json
$credPath = Join-Path $OutDir "$id.json"
[IO.File]::WriteAllText($credPath, $cred, (New-Object Text.UTF8Encoding($false)))

$fp = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($secret))).Replace('-','').Substring(0,8).ToLower()
Write-Host "Tunnel $name created. id=$id host=$host_ secret-fingerprint=$fp"
Write-Host "Credentials: $credPath  (transfer securely to the client node, then delete locally)"
Write-Host "cloudflared config ingress: hostname $host_ -> http://localhost:3080"
