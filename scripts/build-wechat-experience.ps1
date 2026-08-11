[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://')]
    [string]$ServerOrigin,

    [string]$AssetOrigin = '',

    [string]$CreatorPath = 'E:\cocos-creator\Creator\3.8.8\CocosCreator.exe'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Join-Path $repoRoot 'game-client'
$environmentFile = Join-Path $projectRoot 'assets\scripts\app\ExperienceEnvironment.ts'
$builderProfile = Join-Path $projectRoot 'profiles\v2\packages\builder.json'
$tempDirectory = Join-Path $repoRoot '.tmp'
$buildConfigPath = Join-Path $tempDirectory 'wechat-experience-build.json'
$appId = 'wx67f006b9a7827b2a'
$normalizedOrigin = $ServerOrigin.TrimEnd('/')
$normalizedAssetOrigin = if ($AssetOrigin) { $AssetOrigin.TrimEnd('/') } else { $normalizedOrigin }
if (-not $normalizedAssetOrigin.StartsWith('https://', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'AssetOrigin must be an https:// URL when provided.'
}
$assetServer = "$normalizedAssetOrigin/game-assets/"
$experienceEngineModules = @(
    '2d',
    'audio',
    'base',
    'custom-pipeline',
    'gfx-webgl',
    'graphics',
    'tween',
    'ui',
    'custom-pipeline-builtin-scripts'
)

$serverUri = [uri]$normalizedOrigin
if ($serverUri.Host -eq 'example.com' -or $serverUri.Host.EndsWith('.example.com')) {
    throw 'Replace example.com with the HTTPS domain that is registered for this WeChat Mini Game.'
}
if ($serverUri.IsLoopback) {
    throw 'A WeChat experience build cannot use localhost. Provide a phone-accessible HTTPS domain.'
}
$assetUri = [uri]$normalizedAssetOrigin
if ($assetUri.Host -eq 'example.com' -or $assetUri.Host.EndsWith('.example.com')) {
    throw 'AssetOrigin cannot use example.com.'
}
if ($assetUri.IsLoopback) {
    throw 'AssetOrigin cannot be localhost.'
}

if (-not (Test-Path -LiteralPath $CreatorPath -PathType Leaf)) {
    throw "Cocos Creator executable was not found: $CreatorPath"
}

$escapedProjectRoot = [regex]::Escape($projectRoot)
$openProjectProcesses = @(
    Get-CimInstance Win32_Process |
    Where-Object {
        $_.Name -eq 'CocosCreator.exe' -and
        $_.CommandLine -match "--project\s+`"?$escapedProjectRoot`"?(?:\s|$)"
    }
)
if ($openProjectProcesses.Count -gt 0) {
    $processIds = ($openProjectProcesses.ProcessId -join ', ')
    throw "The Cocos project is already open (PID: $processIds). Close it before running this script to avoid an incomplete command-line build."
}

New-Item -ItemType Directory -Path $tempDirectory -Force | Out-Null

$environmentSource = [System.IO.File]::ReadAllText($environmentFile)
$environmentSource = [regex]::Replace(
    $environmentSource,
    "SERVER_ORIGIN:\s*'[^']+'",
    "SERVER_ORIGIN: '$normalizedOrigin'"
)
[System.IO.File]::WriteAllText(
    $environmentFile,
    $environmentSource,
    [System.Text.UTF8Encoding]::new($false)
)

$profile = Get-Content -LiteralPath $builderProfile -Raw -Encoding utf8 | ConvertFrom-Json
$task = $profile.BuildTaskManager.taskMap.PSObject.Properties |
    Select-Object -First 1 |
    ForEach-Object Value

if (-not $task.options) {
    throw 'No reusable WeChat build task was found in builder.json.'
}

$options = $task.options
$options.server = $assetServer
$options.md5Cache = $true
$options.startSceneAssetBundle = $true
$options.useBuiltinServer = $false
$options.debug = $false
$options.engineModulesConfigKey = 'wechatExperience'
$options | Add-Member -MemberType NoteProperty -Name includeModules -Value $experienceEngineModules -Force
$options.overwriteProjectSettings.includeModules.physics = 'off'
$options.overwriteProjectSettings.includeModules.'physics-2d' = 'off'
$options.overwriteProjectSettings.includeModules.'gfx-webgl2' = 'off'
$options.useSplashScreen = $false
$options.outputName = 'wechatgame'
$options.taskName = 'wechatgame'
$options.logDest = 'project://temp/builder/log/wechat-experience.log'
$options.packages = [pscustomobject]@{
    wechatgame = [pscustomobject]@{
        orientation = 'landscapeRight'
        appid = $appId
        buildOpenDataContextTemplate = ''
        separateEngine = $false
        highPerformanceMode = $false
        __version__ = '1.0.4'
    }
}

$options | ConvertTo-Json -Depth 100 |
    Set-Content -LiteralPath $buildConfigPath -Encoding utf8

Write-Host "Building WeChat experience package for $appId"
Write-Host "API origin: $normalizedOrigin"
Write-Host "Remote assets: $assetServer"

$creatorUserData = Join-Path $tempDirectory 'cocos-experience-user-data'
$creatorStdout = Join-Path $tempDirectory 'cocos-experience.stdout.log'
$creatorStderr = Join-Path $tempDirectory 'cocos-experience.stderr.log'
New-Item -ItemType Directory -Path $creatorUserData -Force | Out-Null

$creatorProcess = Start-Process -FilePath $CreatorPath -ArgumentList @(
    "--user-data-dir=`"$creatorUserData`"",
    '--project',
    "`"$projectRoot`"",
    '--build',
    "`"configPath=$buildConfigPath`""
) -RedirectStandardOutput $creatorStdout -RedirectStandardError $creatorStderr -PassThru -Wait
$creatorExitCode = $creatorProcess.ExitCode
if ($creatorExitCode -notin @(0, 36)) {
    throw "Cocos Creator build failed with exit code $creatorExitCode. See $creatorStdout and $creatorStderr."
}

$buildRoot = Join-Path $projectRoot 'build\wechatgame'
$remoteRoot = Join-Path $buildRoot 'remote'
if (-not (Test-Path -LiteralPath $remoteRoot -PathType Container)) {
    throw "Build succeeded but the remote asset directory was not generated: $remoteRoot"
}

$localBytes = (
    Get-ChildItem -LiteralPath $buildRoot -Recurse -File |
    Where-Object { -not $_.FullName.StartsWith($remoteRoot, [System.StringComparison]::OrdinalIgnoreCase) } |
    Measure-Object -Property Length -Sum
).Sum
$remoteBytes = (
    Get-ChildItem -LiteralPath $remoteRoot -Recurse -File |
    Measure-Object -Property Length -Sum
).Sum

$settingsFile = Get-ChildItem -LiteralPath (Join-Path $buildRoot 'src') -Filter 'settings*.json' |
    Select-Object -First 1
if (-not $settingsFile) {
    throw 'Build succeeded but settings.json was not generated.'
}
$settings = Get-Content -LiteralPath $settingsFile.FullName -Raw -Encoding utf8 | ConvertFrom-Json
if ($settings.assets.server -ne $assetServer) {
    throw "Unexpected resource server in build output: $($settings.assets.server)"
}
if ('resources' -notin @($settings.assets.remoteBundles)) {
    throw 'The resources Bundle was not marked as remote in the build output.'
}

$outputProjectConfig = Get-Content -LiteralPath (Join-Path $buildRoot 'project.config.json') -Raw -Encoding utf8 |
    ConvertFrom-Json
if ($outputProjectConfig.appid -ne $appId) {
    throw "Unexpected AppID in build output: $($outputProjectConfig.appid)"
}
if ($outputProjectConfig.compileType -ne 'game') {
    throw "Unexpected WeChat project type: $($outputProjectConfig.compileType). The output must be imported as a Mini Game."
}
$outputProjectConfig.setting.enhance = $false
$outputProjectConfig | Add-Member -MemberType NoteProperty -Name packOptions -Value ([pscustomobject]@{
    ignore = @([pscustomobject]@{
        type = 'folder'
        value = 'remote'
    })
    include = @()
}) -Force
[System.IO.File]::WriteAllText(
    (Join-Path $buildRoot 'project.config.json'),
    ($outputProjectConfig | ConvertTo-Json -Depth 20),
    [System.Text.UTF8Encoding]::new($false)
)

$privateProjectConfig = Join-Path $buildRoot 'project.private.config.json'
if (Test-Path -LiteralPath $privateProjectConfig -PathType Leaf) {
    Remove-Item -LiteralPath $privateProjectConfig -Force
}

foreach ($requiredGameFile in @('game.js', 'game.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $buildRoot $requiredGameFile) -PathType Leaf)) {
        throw "WeChat Mini Game entry file is missing: $requiredGameFile"
    }
}

$gameIcon = Join-Path $projectRoot 'icon\game_icon_144.png'
if (Test-Path -LiteralPath $gameIcon -PathType Leaf) {
    Copy-Item -LiteralPath $gameIcon -Destination (Join-Path $buildRoot 'logo.png') -Force
    Write-Host 'Replaced WeChat loading logo with the game icon.'
} else {
    Write-Host 'Game icon not found; keeping the default WeChat loading logo.'
}

Write-Host ('Local package: {0:N2} MiB' -f ($localBytes / 1MB))
Write-Host ('Remote assets: {0:N2} MiB' -f ($remoteBytes / 1MB))
Write-Host "Build output: $buildRoot"

if ($localBytes -gt 4MB) {
    throw 'The local WeChat package still exceeds the 4 MiB main-package target.'
}
