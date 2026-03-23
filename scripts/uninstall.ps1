# Portly uninstaller for Windows

$ErrorActionPreference = "Stop"
$installDir = "$env:LOCALAPPDATA\Portly"
$exe = Join-Path $installDir "portly.exe"

# Stop service if running
try { & $exe uninstall 2>$null } catch {}

if (Test-Path $exe) {
    Remove-Item $exe -Force
    Write-Host "Removed $exe"
}

# Remove from PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -like "*$installDir*") {
    $newPath = ($userPath.Split(";") | Where-Object { $_ -ne $installDir }) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "Removed $installDir from PATH."
}

# Remove install directory if empty
if ((Test-Path $installDir) -and (Get-ChildItem $installDir | Measure-Object).Count -eq 0) {
    Remove-Item $installDir -Force
}

Write-Host "Uninstalled." -ForegroundColor Green
