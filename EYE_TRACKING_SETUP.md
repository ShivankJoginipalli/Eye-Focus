# Eye Tracking Setup Guide

## Prerequisites
- Python 3.7+
- Webcam
- Windows OS

## Installation Steps

### 1. Install Python Dependencies
```bash
pip install opencv-python numpy dlib
```

### 2. Install Native Messaging Host

**Option A: Manual Registration (Recommended)**
1. Get your Chrome Extension ID:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Find "YouTube Recap Bot with Eye Tracking"
   - Copy the Extension ID (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

2. Edit `native_messaging_host.json`:
   - Replace `YOUR_EXTENSION_ID_HERE` with your actual extension ID
   - Example: `chrome-extension://abcdefghijklmnopqrstuvwxyz123456/`

3. Register the native messaging host:
   - Open Registry Editor (Win+R, type `regedit`)
   - Navigate to: `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts`
   - Create new key: `com.eyefocus.monitor`
   - Set default value to full path of `native_messaging_host.json`
   - Example: `C:\Users\sjogi\OneDrive\Attachments\Desktop\EyeFocus\Eye-Focus\native_messaging_host.json`

**Option B: Use Registration Script**
Run this in PowerShell (as Administrator):
```powershell
$manifestPath = "C:\Users\sjogi\OneDrive\Attachments\Desktop\EyeFocus\Eye-Focus\native_messaging_host.json"
New-Item -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.eyefocus.monitor" -Force
Set-ItemProperty -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.eyefocus.monitor" -Name "(Default)" -Value $manifestPath
```

### 3. Configure Extension
1. Open Chrome
2. Go to `chrome://extensions/`
3. Find "YouTube Recap Bot with Eye Tracking"
4. Click the extension icon
5. Check "👁️ Enable Eye Tracking"

### 4. Start Eye Tracking
The eye tracker starts automatically when you enable it in settings.

## How It Works

1. **Python Eye Tracker** (`eye_monitor.py`):
   - Monitors your eyes using webcam
   - Detects when you look away for 5+ seconds
   - Sends pause command to Chrome

2. **Chrome Extension** (`background.js`):
   - Receives pause commands via native messaging
   - Pauses all YouTube videos
   - Shows recap popup

3. **YouTube Content Script** (`youtube-detector.js`):
   - Pauses video when commanded
   - Shows AI-powered recap
   - Allows interactive chat about video

## Troubleshooting

### Eye tracking not working?
1. Check Python dependencies are installed
2. Verify webcam is working
3. Check native messaging host is registered
4. Look at Chrome console: `chrome://extensions/` → Extension → Inspect views: background

### Python script errors?
Run manually to see errors:
```bash
python eye_monitor.py
```

### Native messaging connection failed?
1. Verify `native_messaging_host.json` has correct extension ID
2. Check file paths are absolute and correct
3. Ensure `eye_monitor.bat` is executable

## Testing

1. Enable eye tracking in extension settings
2. Open YouTube video
3. Look away from screen for 5 seconds
4. Video should pause automatically
5. Recap popup should appear

## Features

✅ Auto-pause when looking away (5 seconds)
✅ AI-powered video recap on pause
✅ Interactive chat about video content
✅ Manual pause still works normally
✅ Transcript-based accurate summaries

Enjoy distraction-free video watching! 👁️🎥
