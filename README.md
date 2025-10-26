# Eye Focus - YouTube Eye Tracking Extension

An intelligent Chrome extension that pauses YouTube videos when you look away from the screen, with AI-powered video recap features.

## 🎯 Features

- **Eye Tracking**: Automatically pauses videos when you look away for 5+ seconds
- **AI Recap**: Get instant AI-generated summaries when videos pause
- **Interactive Chat**: Ask questions about the video content
- **Smart Detection**: Uses your webcam to track eye gaze in real-time

## 📁 Project Structure

```
Eye-Focus/
├── extension/              # Chrome extension files
│   ├── background.js      # Service worker (handles native messaging)
│   ├── manifest.json      # Extension configuration
│   ├── config.js         # API keys (gitignored)
│   ├── content/
│   │   ├── youtube-detector.js    # Main content script
│   │   └── recap-overlay.css      # Overlay styling
│   ├── popup/
│   │   ├── settings.html  # Extension settings UI
│   │   └── settings.js    # Settings logic
│   └── assets/            # Icons and images
│
├── eye_focus_tracker.py   # Main eye tracking script with visual feedback
├── test_eye_tracking.py   # Simple test to verify camera/eye detection
└── native_messaging_host.json  # Chrome native messaging configuration

## 🚀 Quick Start

### 1. Install Python Dependencies

```powershell
# Activate virtual environment
.venv\Scripts\Activate.ps1

# Install required packages
pip install opencv-python numpy
```

### 2. Test Eye Tracking

Run the test script to verify your camera and eye detection work:

```powershell
python Eye-Focus/test_eye_tracking.py
```

You should see:
- Green box around your face
- Blue boxes around your eyes
- "FOCUSED" when looking at screen
- "LOOKING AWAY" when not looking

Press 'q' to quit.

### 3. Configure Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `Eye-Focus/extension/` folder

### 4. Set Up Native Messaging

The extension needs to communicate with Python for eye tracking.

**Windows:** Register the native messaging host:
```powershell
# Create registry entry
$regPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.eyefocus.monitor"
New-Item -Path $regPath -Force
New-ItemProperty -Path $regPath -Name "(Default)" -Value "C:\Users\YOUR_USERNAME\...\Eye-Focus\native_messaging_host.json"
```

**Update native_messaging_host.json:**
```json
{
  "name": "com.eyefocus.monitor",
  "description": "Eye Focus Monitor",
  "path": "C:\\FULL\\PATH\\TO\\eye_focus_tracker.py",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://YOUR_EXTENSION_ID/"
  ]
}
```

Get your extension ID from `chrome://extensions/`

### 5. Configure API Key

Copy `extension/config.example.js` to `extension/config.js` and add your Groq API key:

```javascript
const API_CONFIG = {
  groqKey: 'your-groq-api-key-here'
};
```

Get a free API key from [Groq](https://console.groq.com/)

### 6. Enable Eye Tracking

1. Click the extension icon in Chrome
2. Check "👁️ Enable Eye Tracking"
3. Open a YouTube video
4. Look away for 5+ seconds - video should pause!

## 🔧 Troubleshooting

### Eye tracking doesn't pause videos

1. **Check extension is enabled**: Click extension icon → ensure eye tracking is ON
2. **Check background script**: Go to `chrome://extensions/` → find extension → click "service worker" to see logs
3. **Test camera**: Run `python test_eye_tracking.py` to verify eye detection works
4. **Check native messaging**: Make sure registry entry and paths are correct

### Camera not working

- Close other apps using camera (Teams, Zoom, etc.)
- Check camera permissions in Windows Settings
- Try running test script to see specific errors

### No AI summaries

- Verify Groq API key in `config.js`
- Check browser console (F12) for API errors
- Ensure you have internet connection

## 📝 Files Explained

- **eye_focus_tracker.py**: Main eye tracking application with calibration and visual UI
- **test_eye_tracking.py**: Simple diagnostic tool to test camera and face/eye detection
- **native_messaging_host.json**: Tells Chrome where to find the Python script
- **extension/background.js**: Receives messages from Python and tells content scripts to pause
- **extension/content/youtube-detector.js**: Detects YouTube videos and handles pausing/AI features

## 🧹 Recently Cleaned Up

Removed duplicate and unused files:
- ❌ `eye_monitor.py` (empty)
- ❌ `gaze_tracking.py`, `eye.py`, `pupil.py`, `calibration.py` (unused dlib-based library)
- ❌ `test_camera.py`, `quick_camera_test.py` (empty)
- ❌ `youtube-detector-part1.js` (duplicate/partial code)
- ❌ Multiple `.bat` files (empty)
- ❌ Scattered `.md` documentation files (consolidated here)

## 📜 License

This project is for educational purposes.
