# Portly development environment setup (Windows)
# Run once after cloning: powershell -ExecutionPolicy Bypass -File scripts/dev-setup.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "=== Portly dev setup ===" -ForegroundColor Cyan
Write-Host ""

# Python
Write-Host "[1/3] Python environment" -ForegroundColor Yellow
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Host "  ERROR: Python not found. Install it first." -ForegroundColor Red
    exit 1
}
Write-Host "  Using: python ($(python --version))"
Write-Host "  Installing in editable mode..."
python -m pip install -e . --quiet 2>$null
Write-Host "  Done."
Write-Host ""

# Node
Write-Host "[2/3] Web dashboard" -ForegroundColor Yellow
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "  WARNING: Node.js not found. Dashboard dev server won't work." -ForegroundColor Yellow
    Write-Host "  Install it from https://nodejs.org/"
} else {
    Write-Host "  Using: node $(node --version), npm $(npm --version)"
    Write-Host "  Installing dependencies..."
    Set-Location "$root/web"
    npm install --silent
    Write-Host "  Building dashboard..."
    npm run build --silent
    Set-Location $root
    Write-Host "  Done."
}
Write-Host ""

# Summary
Write-Host "[3/3] Ready!" -ForegroundColor Green
Write-Host ""
Write-Host "  Start developing:"
Write-Host "    python -m portly              # Run server (foreground)"
Write-Host "    python -m portly --daemon     # Run server (background)"
Write-Host ""
Write-Host "  Frontend hot reload:"
Write-Host "    cd web; npm run dev           # Vite dev server on :5173"
Write-Host ""
Write-Host "  Or run both at once:"
Write-Host "    python scripts/dev.py"
Write-Host ""
Write-Host "  Run checks:"
Write-Host "    python scripts/check.py"
Write-Host ""
