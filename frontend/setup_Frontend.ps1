# ============================================
# Sentinel AI - Frontend Structure Setup
# ============================================
# Run this script from the /frontend directory.
#
# It creates ONLY missing folders and files.
# Existing files are NEVER overwritten.
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Sentinel AI Frontend Structure Check" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --------------------------------------------
# Required directories
# --------------------------------------------

$directories = @(
    "src",
    "src\api",

    "src\components",
    "src\components\ui",
    "src\components\layout",
    "src\components\dashboard",
    "src\components\incidents",
    "src\components\copilot",

    "src\context",
    "src\hooks",
    "src\pages",
    "src\types",
    "src\styles"
)

# --------------------------------------------
# Required files
# --------------------------------------------

$files = @(
    "src\App.jsx",
    "src\main.jsx",

    "src\api\client.js",

    "src\components\ui\Badge.jsx",
    "src\components\ui\Button.jsx",
    "src\components\ui\Card.jsx",
    "src\components\ui\Modal.jsx",
    "src\components\ui\Table.jsx",

    "src\components\layout\Sidebar.jsx",
    "src\components\layout\Topbar.jsx",

    "src\components\dashboard\AttackDistributionChart.jsx",
    "src\components\dashboard\AttackTimeline.jsx",
    "src\components\dashboard\LiveFeed.jsx",
    "src\components\dashboard\SummaryCards.jsx",

    "src\components\incidents\IncidentBadge.jsx",
    "src\components\incidents\IncidentDetail.jsx",
    "src\components\incidents\IncidentList.jsx",

    "src\components\copilot\CopilotChat.jsx",

    "src\context\AuthContext.jsx",
    "src\context\ThemeContext.jsx",

    "src\hooks\useWebSocket.js",

    "src\pages\Login.jsx",
    "src\pages\Dashboard.jsx",
    "src\pages\Incidents.jsx",
    "src\pages\IncidentDetailPage.jsx",
    "src\pages\Reports.jsx",

    "src\types\alert.js",
    "src\types\incident.js",
    "src\types\network.js",

    "src\styles\index.css",
    "src\styles\variables.css",
    "src\styles\utilities.css"
)

# --------------------------------------------
# Create directories
# --------------------------------------------

Write-Host "[1/2] Checking directories..." -ForegroundColor Yellow
Write-Host ""

foreach ($directory in $directories) {

    if (Test-Path -LiteralPath $directory -PathType Container) {

        Write-Host "  [EXISTS]  $directory" -ForegroundColor DarkGray

    }
    else {

        New-Item -ItemType Directory -Path $directory -Force | Out-Null

        Write-Host "  [CREATED] $directory" -ForegroundColor Green
    }
}

Write-Host ""

# --------------------------------------------
# Create files
# --------------------------------------------

Write-Host "[2/2] Checking files..." -ForegroundColor Yellow
Write-Host ""

foreach ($file in $files) {

    if (Test-Path -LiteralPath $file -PathType Leaf) {

        Write-Host "  [EXISTS]  $file" -ForegroundColor DarkGray

    }
    else {

        New-Item -ItemType File -Path $file -Force | Out-Null

        Write-Host "  [CREATED] $file" -ForegroundColor Green
    }
}

# --------------------------------------------
# Summary
# --------------------------------------------

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Structure check complete." -ForegroundColor Cyan
Write-Host " Existing files were NOT modified." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Frontend structure:" -ForegroundColor Yellow
Write-Host ""

tree /F src

Write-Host ""
Write-Host "Done." -ForegroundColor Green