[CmdletBinding()]
param(
    [string]$BackendRoot = 'E:\Mahjong-fly-bird-backend',
    [switch]$Resync
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $repoRoot 'game-client\build\wechatgame\remote'
$targetRoot = Join-Path $BackendRoot 'game-assets\remote'

if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
    throw "New build remote assets were not found. Build first: $sourceRoot"
}

$resolvedBackend = (Resolve-Path -LiteralPath $BackendRoot).Path
$resolvedTarget = if (Test-Path -LiteralPath $targetRoot -PathType Container) {
    (Resolve-Path -LiteralPath $targetRoot).Path
} else {
    $targetRoot
}

if (-not $resolvedTarget.StartsWith($resolvedBackend, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to touch a directory outside the backend workspace: $resolvedTarget"
}

if (Test-Path -LiteralPath $resolvedTarget -PathType Container) {
    $tracked = (git -C $resolvedBackend ls-files 'game-assets/remote' | Measure-Object).Count
    if ($tracked -gt 0) {
        throw "Refusing to delete $resolvedTarget because it contains $tracked git-tracked files."
    }
    Write-Host "Removing generated remote directory: $resolvedTarget"
    Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
}

if ($Resync) {
    & (Join-Path $PSScriptRoot 'sync-wechat-remote-assets.ps1')
} else {
    New-Item -ItemType Directory -Path $resolvedTarget -Force | Out-Null
    Copy-Item -Path (Join-Path $sourceRoot '*') -Destination $resolvedTarget -Recurse -Force
    $bytes = (
        Get-ChildItem -LiteralPath $resolvedTarget -Recurse -File |
        Measure-Object -Property Length -Sum
    ).Sum
    Write-Host ('Backend remote assets refreshed: {0:N2} MiB' -f ($bytes / 1MB))
}
