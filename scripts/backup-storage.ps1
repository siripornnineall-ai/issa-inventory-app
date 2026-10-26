# Back up every file in the Supabase Storage buckets to this computer (off-platform copy of the product images etc).
# Works on Windows PowerShell 5.1 and PowerShell 7. This file is ASCII-only on purpose: Windows PowerShell 5.1 misreads UTF-8 without BOM.
#
# Uses only the URL and the *publishable* key from .env.local (the same public values the website ships), so no secret is needed.
# Run:   powershell -ExecutionPolicy Bypass -File scripts\backup-storage.ps1
# Output: <folder above the repo>\backups\storage-YYYY-MM-DD\<bucket>\...   (outside Git on purpose: the GitHub repo is PUBLIC, never commit backups)
# Re-running is safe: files that already exist with the same size are skipped.
param(
  [string]$OutDir = "",
  [string[]]$Buckets = @("product-images", "brand-logos", "storefront-assets")
)

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $repo ".env.local"
if (-not (Test-Path $envFile)) { throw "Missing .env.local at $envFile" }
$vars = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object { if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$') { $vars[$Matches[1]] = $Matches[2] } }
$url = $vars["NEXT_PUBLIC_SUPABASE_URL"]
$key = $vars["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
if (-not $url -or -not $key) { throw ".env.local must define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" }

if (-not $OutDir) { $OutDir = Join-Path (Split-Path $repo -Parent) ("backups\storage-" + (Get-Date -Format "yyyy-MM-dd")) }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$headers = @{ apikey = $key; Authorization = "Bearer $key" }

function Get-Entries([string]$bucket, [string]$prefix) {
  $all = @()
  $offset = 0
  while ($true) {
    $body = @{ prefix = $prefix; limit = 1000; offset = $offset; sortBy = @{ column = "name"; order = "asc" } } | ConvertTo-Json -Depth 4
    $page = Invoke-RestMethod -Method Post -Uri "$url/storage/v1/object/list/$bucket" -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType "application/json"
    if (-not $page -or $page.Count -eq 0) { break }
    $all += $page
    if ($page.Count -lt 1000) { break }
    $offset += 1000
  }
  return $all
}

# All files under a prefix, descending into sub-folders (folder entries have no id)
function Get-Files([string]$bucket, [string]$prefix) {
  $files = @()
  foreach ($e in (Get-Entries $bucket $prefix)) {
    $path = if ($prefix) { "$prefix/$($e.name)" } else { $e.name }
    if ($null -eq $e.id) { $files += Get-Files $bucket $path }
    else { $files += [pscustomobject]@{ Path = $path; Size = [int64]$e.metadata.size } }
  }
  return $files
}

$summary = @()
foreach ($bucket in $Buckets) {
  Write-Host "== $bucket" -ForegroundColor Cyan
  $files = Get-Files $bucket ""
  $got = 0; $skipped = 0; $failed = @(); $bytes = [int64]0
  foreach ($f in $files) {
    $dest = Join-Path (Join-Path $OutDir $bucket) ($f.Path -replace '/', '\')
    if ((Test-Path $dest) -and ((Get-Item $dest).Length -eq $f.Size)) { $skipped++; $bytes += $f.Size; continue }
    New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
    $encoded = ($f.Path -split '/' | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
    try {
      Invoke-WebRequest -Uri "$url/storage/v1/object/public/$bucket/$encoded" -OutFile $dest -UseBasicParsing
      if ((Get-Item $dest).Length -ne $f.Size) { throw "size mismatch (got $((Get-Item $dest).Length), expected $($f.Size))" }
      $got++; $bytes += $f.Size
    } catch {
      $failed += "$($f.Path): $($_.Exception.Message)"
    }
  }
  $summary += [pscustomobject]@{ Bucket = $bucket; ListedFiles = $files.Count; Downloaded = $got; AlreadyHad = $skipped; Failed = $failed.Count; MB = [math]::Round($bytes / 1MB, 1) }
  if ($failed.Count -gt 0) { $failed | ForEach-Object { Write-Warning $_ } }
}
$summary | Format-Table -AutoSize
Write-Host "Saved to $OutDir"
if (($summary | Measure-Object -Property Failed -Sum).Sum -gt 0) { exit 1 }
