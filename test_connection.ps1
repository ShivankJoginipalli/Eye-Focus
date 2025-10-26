# Quick test to verify Chrome can connect to the eye monitor
Write-Host "`n=== TESTING CHROME CONNECTION ===" -ForegroundColor Cyan
Write-Host "`nThis will test if Chrome can launch the eye monitor.`n" -ForegroundColor White

$testPath = "C:\Users\sjogi\OneDrive\Attachments\Desktop\EyeFocus\Eye-Focus\eye_monitor.bat"

if (!(Test-Path $testPath)) {
    Write-Host "❌ eye_monitor.bat not found at: $testPath" -ForegroundColor Red
    exit 1
}

Write-Host "Testing eye_monitor.bat..." -ForegroundColor Yellow
Write-Host "This should start the eye monitor and show camera logs.`n" -ForegroundColor White

# Run the bat file (simulating what Chrome does)
& $testPath

Write-Host "`n✅ If you saw camera logs above, the connection path works!" -ForegroundColor Green
Write-Host "Now test in Chrome by:" -ForegroundColor Yellow
Write-Host "  1. Reload the extension" -ForegroundColor White
Write-Host "  2. Enable eye tracking in extension popup" -ForegroundColor White
Write-Host "  3. Check background.js console for connection messages`n" -ForegroundColor White
