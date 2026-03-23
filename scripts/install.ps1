# Portly installer for Windows — downloads the latest release binary.

$ErrorActionPreference = "Stop"
$repo = "Bedri-B/Portly"
$installDir = "$env:LOCALAPPDATA\Portly"

Write-Host "Portly installer" -ForegroundColor Cyan
Write-Host "  Install to: $installDir"
Write-Host ""

# Get latest release
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
$tag = $release.tag_name
Write-Host "  Latest release: $tag"

$url = "https://github.com/$repo/releases/download/$tag/portly-windows-amd64.exe"
$dest = Join-Path $installDir "portly.exe"

# Create install directory
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# Download
Write-Host "  Downloading..." -NoNewline
Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
Write-Host " done."

# Add to PATH if not already there
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir", "User")
    Write-Host "  Added $installDir to PATH."
}

Write-Host ""
Write-Host "Installed portly to $dest" -ForegroundColor Green
Write-Host "Open a new terminal and run 'portly' to start."
