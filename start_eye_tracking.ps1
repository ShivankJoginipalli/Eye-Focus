# Complete Eye Tracking Setup and Start
# This script ensures clean startup

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "EYE TRACKING - COMPLETE SETUP" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Cleanup
Write-Host "[1/3] Cleaning up old processes..." -ForegroundColor Yellow

$eyeFocusProcesses = Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*EyeFocus*"
}

if ($eyeFocusProcesses) {
    Write-Host "  Killing $($eyeFocusProcesses.Count) old Python process(es)..." -ForegroundColor Gray
    $eyeFocusProcesses | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

# Remove lock file if exists
$lockFile = Join-Path $PSScriptRoot ".eye_monitor.lock"
if (Test-Path $lockFile) {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    Write-Host "  Removed stale lock file" -ForegroundColor Gray
}

Write-Host "✅ Cleanup complete`n" -ForegroundColor Green

# Step 2: Check for camera conflicts
Write-Host "[2/3] Checking for camera conflicts..." -ForegroundColor Yellow

$cameraApps = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -match "teams|zoom|skype|discord|obs"
}

if ($cameraApps) {
    Write-Host "  ⚠️  Camera may be in use by:" -ForegroundColor Yellow
    $cameraApps | Select-Object -Unique ProcessName | ForEach-Object {
        Write-Host "    • $($_.ProcessName)" -ForegroundColor Red
    }
    Write-Host ""
    $response = Read-Host "  Continue anyway? (y/n)"
    if ($response -ne 'y') {
        Write-Host "`n❌ Setup cancelled. Please close camera apps and try again.`n" -ForegroundColor Red
        exit 0
    }
} else {
    Write-Host "✅ No camera conflicts detected`n" -ForegroundColor Green
}

# Step 3: Instructions
Write-Host "[3/3] Ready to start!`n" -ForegroundColor Yellow

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NEXT STEPS:" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to Chrome: chrome://extensions/" -ForegroundColor White
Write-Host "2. Reload the 'YouTube Recap Bot' extension (🔄 button)" -ForegroundColor White
Write-Host "3. Click the extension icon in Chrome toolbar" -ForegroundColor White
Write-Host "4. Check '👁️ Enable Eye Tracking'" -ForegroundColor White
Write-Host "5. Go to YouTube and open any video" -ForegroundColor White
Write-Host "6. Camera feed will appear in bottom-right!" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Camera feed shows:" -ForegroundColor Yellow
Write-Host "  🟢 Green border = You're focused" -ForegroundColor Green
Write-Host "  🔴 Red border = Looking away" -ForegroundColor Red
Write-Host "  ⏱️  Timer = Seconds away (pauses at 5s)" -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Press any key to close..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
