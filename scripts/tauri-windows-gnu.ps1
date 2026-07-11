param(
    [ValidateSet("dev", "build")]
    [string]$Command = "dev"
)

$rustBin = Join-Path $env:LOCALAPPDATA "RustGNU\Rust\bin"
$cargo = Join-Path $rustBin "cargo.exe"
$mingwBin = Get-ChildItem `
    (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_*") `
    -Directory `
    -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName "mingw64\bin" } |
    Where-Object { Test-Path (Join-Path $_ "x86_64-w64-mingw32-gcc.exe") } |
    Select-Object -First 1

if (-not (Test-Path $cargo)) {
    throw "GNU Rust toolchain was not found at $rustBin"
}

if (-not $mingwBin) {
    throw "WinLibs MinGW toolchain was not found under the current user's WinGet packages"
}

$projectRoot = Split-Path $PSScriptRoot -Parent
$tauri = Join-Path $projectRoot "node_modules\.bin\tauri.cmd"

if (-not (Test-Path $tauri)) {
    throw "Tauri CLI is missing. Run npm install first."
}

$env:PATH = "$rustBin;$mingwBin;$env:PATH"
$env:CARGO_TARGET_DIR = Join-Path $env:LOCALAPPDATA "desktop-pet-target"

& $tauri $Command
exit $LASTEXITCODE
