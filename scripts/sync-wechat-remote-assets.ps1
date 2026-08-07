[CmdletBinding()]
param(
    [string]$BackendRoot = 'E:\Mahjong-fly-bird-backend'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $repoRoot 'game-client\build\wechatgame\remote'
$destinationRoot = Join-Path $BackendRoot 'game-assets\remote'

if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
    throw "Remote assets were not found. Build the WeChat experience package first: $sourceRoot"
}

$resolvedBackend = (Resolve-Path -LiteralPath $BackendRoot).Path
if (-not $destinationRoot.StartsWith($resolvedBackend, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to copy assets outside the backend workspace: $destinationRoot"
}

New-Item -ItemType Directory -Path $destinationRoot -Force | Out-Null
Copy-Item -Path (Join-Path $sourceRoot '*') -Destination $destinationRoot -Recurse -Force

$bytes = (
    Get-ChildItem -LiteralPath $destinationRoot -Recurse -File |
    Measure-Object -Property Length -Sum
).Sum

Write-Host ('Remote assets synchronized: {0:N2} MiB' -f ($bytes / 1MB))
Write-Host "Caddy URL path: /game-assets/remote/"
Write-Host "Backend directory: $destinationRoot"
