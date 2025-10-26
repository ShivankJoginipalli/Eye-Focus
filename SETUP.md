# Eye Focus Setup Guide

This guide will help you set up the Eye Focus extension on your own machine.

## Prerequisites

- **Windows 10/11**
- **Python 3.8+** installed
- **Google Chrome** browser
- **Webcam** (built-in or external)

## Step 1: Clone the Repository

```bash
git clone https://github.com/ShivankJoginipalli/Eye-Focus.git
cd Eye-Focus
```

## Step 2: Set Up Python Virtual Environment

```powershell
# Create virtual environment
python -m venv .venv

# Activate it
.venv\Scripts\Activate.ps1

# Install dependencies
pip install opencv-python numpy
```

## Step 3: Load Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension` folder from this repository
5. **Copy the Extension ID** (it will look like: `abcdefghijklmnopqrstuvwxyz123456`)

## Step 4: Update Configuration Files

### A. Update `native_messaging_host.json`

1. Open `native_messaging_host.json` in a text editor
2. Update the `path` to point to your `eye_monitor.bat` file (use full absolute path)
3. Update `allowed_origins` with your extension ID from Step 3:
   ```json
   {
     "path": "C:\\YOUR\\PATH\\TO\\Eye-Focus\\eye_monitor.bat",
     "description": "Eye Focus Monitor - Native messaging host for YouTube eye tracking",
     "allowed_origins": [
       "chrome-extension://YOUR_EXTENSION_ID_HERE/"
     ],
     "type": "stdio",
     "name": "com.eyefocus.monitor"
   }
   ```

### B. Update `eye_monitor.bat`

1. Open `eye_monitor.bat`
2. Update the paths to match your installation:
   ```batch
   @echo off
   "C:\YOUR\PATH\TO\.venv\Scripts\python.exe" "%~dp0eye_monitor_debug_view.py" %*
   ```

## Step 5: Register Native Messaging Host

Run the PowerShell setup script:

```powershell
.\setup_native_messaging.ps1
```

This will register the native messaging host with Chrome.

## Step 6: Test the Setup

1. **Test Camera:**
   ```powershell
   .venv\Scripts\python.exe test_eye_tracking.py
   ```
   - You should see your webcam feed with face/eye detection
   - Press 'q' to quit

2. **Test Extension:**
   - Go to any YouTube video
   - Click the extension icon
   - Enable "👁️ Enable Eye Tracking"
   - You should see a camera overlay in the bottom-left corner

## Step 7: Using Eye Tracking

1. Open a YouTube video
2. Enable eye tracking via the extension popup
3. Camera feed will appear in bottom-left
4. Look away for 5+ seconds → video pauses
5. Video recap overlay will appear when paused

## Troubleshooting

### Camera Not Working
- Close other apps using camera (Teams, Zoom, Skype)
- Run `cleanup_camera.ps1` to kill competing processes
- Check Windows camera privacy settings

### Extension Not Connecting
- Check extension ID matches in `native_messaging_host.json`
- Run `setup_native_messaging.ps1` again
- Reload the extension at `chrome://extensions/`
- Check `eye_monitor_debug.log` for errors

### Python Errors
- Make sure virtual environment is activated
- Reinstall dependencies: `pip install opencv-python numpy`

## Uninstall

1. Remove extension from Chrome
2. Delete registry key:
   ```powershell
   Remove-Item -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.eyefocus.monitor"
   ```
3. Delete the repository folder

## Support

If you encounter issues, check the logs:
- `eye_monitor_debug.log` - Python native messaging logs
- Chrome DevTools Console (F12) - Extension logs

## License

MIT License - Feel free to modify and use!
