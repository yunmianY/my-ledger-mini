# Rename icon files from Chinese paths to ASCII paths.
#
# Usage: double-click tools/rename-icons.bat
#        (or: powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\rename-icons.ps1)
#
# This script is pure ASCII on purpose: PowerShell 5.1 reads .ps1 as ANSI,
# so any non-ASCII character here would break parsing on a GBK system.
# Chinese file names live only in icon-map.json, which is read as UTF-8 explicitly.

$ErrorActionPreference = 'Stop'

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$mapPath = Join-Path $PSScriptRoot 'icon-map.json'
if (-not (Test-Path -LiteralPath $mapPath)) {
  Write-Host "icon-map.json not found: $mapPath"
  exit 1
}

$map = Get-Content -LiteralPath $mapPath -Raw -Encoding UTF8 | ConvertFrom-Json

$moved = 0
$missing = @()

foreach ($prop in $map.PSObject.Properties) {
  $src = Join-Path $root $prop.Name
  $dst = Join-Path $root $prop.Value

  if (-not (Test-Path -LiteralPath $src)) {
    $missing += $prop.Name
    continue
  }

  $dir = Split-Path -Parent $dst
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }

  Move-Item -LiteralPath $src -Destination $dst -Force
  $moved++
}

Write-Host "moved: $moved"

if ($missing.Count -gt 0) {
  Write-Host "missing (source not found):"
  foreach ($item in $missing) {
    Write-Host "  $item"
  }
}

Write-Host "done. Close and reopen the devtools project, then rebuild."
