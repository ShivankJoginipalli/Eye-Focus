# Kill all EyeFocus Python processes
# Run this before enabling eye tracking in Chrome

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CLEANUP: Kill All Eye Tracking Processes" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Kill all Python processes from EyeFocus
$eyeFocusProcesses = Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*EyeFocus*"
}

if ($eyeFocusProcesses) {
    Write-Host "Found $($eyeFocusProcesses.Count) EyeFocus Python process(es):" -ForegroundColor Yellow
    
    foreach ($proc in $eyeFocusProcesses) {
        Write-Host "  Killing PID $($proc.Id) - Started: $($proc.StartTime)" -ForegroundColor Gray
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    
    Start-Sleep -Seconds 1
    Write-Host "`n✅ All EyeFocus Python processes stopped" -ForegroundColor Green
} else {
    Write-Host "✅ No EyeFocus Python processes running" -ForegroundColor Green
}

# Check for other camera users
Write-Host "`nChecking for other apps using camera..." -ForegroundColor Yellow

$cameraApps = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -match "teams|zoom|skype|discord|obs"
}

if ($cameraApps) {
    Write-Host "`n⚠️  Warning: These apps might be using the camera:" -ForegroundColor Yellow
    foreach ($app in $cameraApps) {
        Write-Host "  • $($app.ProcessName)" -ForegroundColor Red
    }
    Write-Host "`nConsider closing them before using eye tracking.`n" -ForegroundColor Yellow
} else {
    Write-Host "✅ No common camera apps detected`n" -ForegroundColor Green
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "You can now enable eye tracking in Chrome!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan
