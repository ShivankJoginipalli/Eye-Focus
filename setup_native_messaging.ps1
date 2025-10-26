# Eye Focus Setup Script
# Run this script to set up native messaging for the Chrome extension

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "EYE FOCUS - NATIVE MESSAGING SETUP" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Get Extension ID
Write-Host "[Step 1] Getting Extension ID" -ForegroundColor Yellow
Write-Host "1. Open Chrome and go to: chrome://extensions/" -ForegroundColor White
Write-Host "2. Enable 'Developer mode' (top right)" -ForegroundColor White
Write-Host "3. Find 'YouTube Recap Bot with Eye Tracking'" -ForegroundColor White
Write-Host "4. Copy the Extension ID (it looks like: abcdefghijklmnopqrstuvwxyz)`n" -ForegroundColor White

$extensionId = Read-Host "Paste your Extension ID here"

if ([string]::IsNullOrWhiteSpace($extensionId)) {
    Write-Host "`n❌ No Extension ID provided. Exiting..." -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Extension ID: $extensionId" -ForegroundColor Green

# Step 2: Update native_messaging_host.json
Write-Host "`n[Step 2] Updating native_messaging_host.json" -ForegroundColor Yellow

$jsonPath = "C:\Users\sjogi\OneDrive\Attachments\Desktop\EyeFocus\Eye-Focus\native_messaging_host.json"
$batPath = "C:\Users\sjogi\OneDrive\Attachments\Desktop\EyeFocus\Eye-Focus\eye_monitor.bat"

$jsonContent = @{
    name = "com.eyefocus.monitor"
    description = "Eye Focus Monitor - Native messaging host for YouTube eye tracking"
    path = $batPath
    type = "stdio"
    allowed_origins = @("chrome-extension://$extensionId/")
} | ConvertTo-Json

$jsonContent | Set-Content -Path $jsonPath
Write-Host "✅ Updated: $jsonPath" -ForegroundColor Green

# Step 3: Register in Windows Registry
Write-Host "`n[Step 3] Registering native messaging host in Windows Registry" -ForegroundColor Yellow

$regPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.eyefocus.monitor"

try {
    # Create registry key if it doesn't exist
    if (!(Test-Path $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    
    # Set the default value to point to our JSON file
    Set-ItemProperty -Path $regPath -Name "(Default)" -Value $jsonPath
    
    Write-Host "✅ Registry key created: $regPath" -ForegroundColor Green
    Write-Host "✅ Points to: $jsonPath" -ForegroundColor Green
} catch {
    Write-Host "❌ Error creating registry key: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Verify
Write-Host "`n[Step 4] Verification" -ForegroundColor Yellow

Write-Host "Checking files..." -ForegroundColor White
if (Test-Path $jsonPath) {
    Write-Host "  ✅ native_messaging_host.json exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ native_messaging_host.json NOT found" -ForegroundColor Red
}

if (Test-Path $batPath) {
    Write-Host "  ✅ eye_monitor.bat exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ eye_monitor.bat NOT found" -ForegroundColor Red
}

$eyeMonitorPath = "C:\Users\sjogi\OneDrive\Attachments\Desktop\EyeFocus\Eye-Focus\eye_monitor.py"
if (Test-Path $eyeMonitorPath) {
    Write-Host "  ✅ eye_monitor.py exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ eye_monitor.py NOT found" -ForegroundColor Red
}

Write-Host "`nRegistry check..." -ForegroundColor White
$regValue = Get-ItemProperty -Path $regPath -Name "(Default)" -ErrorAction SilentlyContinue
if ($regValue) {
    Write-Host "  ✅ Registry key exists" -ForegroundColor Green
    Write-Host "  ✅ Points to: $($regValue.'(Default)')" -ForegroundColor Green
} else {
    Write-Host "  ❌ Registry key NOT found" -ForegroundColor Red
}

# Final instructions
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SETUP COMPLETE!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Reload your Chrome extension (chrome://extensions/ → click reload button)" -ForegroundColor White
Write-Host "2. Click the extension icon and enable '👁️ Enable Eye Tracking'" -ForegroundColor White
Write-Host "3. Open a YouTube video" -ForegroundColor White
Write-Host "4. Look away for 5+ seconds - the video should pause!" -ForegroundColor White

Write-Host "`nTo view logs:" -ForegroundColor Yellow
Write-Host "  - Go to chrome://extensions/" -ForegroundColor White
Write-Host "  - Find your extension" -ForegroundColor White
Write-Host "  - Click 'service worker' to see background.js logs`n" -ForegroundColor White

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
