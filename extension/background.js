// Eye Focus Background Service Worker
console.log('🎯 Eye Focus Background Service Worker loaded');

let nativePort = null;
let eyeTrackingEnabled = false;

// Connect to native messaging host (Python eye monitor)
function connectToNativeApp() {
  try {
    console.log('🔌 Connecting to native app: com.eyefocus.monitor');
    nativePort = chrome.runtime.connectNative('com.eyefocus.monitor');
    
    nativePort.onMessage.addListener((message) => {
      console.log('📨 Message from eye tracker:', message.action);
      
      if (message.action === 'pause_video' && message.reason === 'eyes_away') {
        console.log('🎯 Pause command received - forwarding to YouTube tabs');
        pauseYouTubeVideos();
      }
      else if (message.action === 'debug_frame') {
        // Forward debug frame to YouTube tabs for display
        sendDebugFrame(message.frame, message.focused, message.away_duration);
      }
      else if (message.action === 'camera_error') {
        console.error('❌ Camera error:', message.error);
        sendCameraError(message.error);
      }
    });
    
    nativePort.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error('❌ Native host disconnected with error:', error.message);
      } else {
        console.log('👋 Native host disconnected normally');
      }
      
      nativePort = null;
      
      if (eyeTrackingEnabled) {
        console.log('⏰ Will retry connection in 5 seconds...');
        setTimeout(connectToNativeApp, 5000);
      }
    });
    
    console.log('✅ Connected to eye tracking monitor');
  } catch (error) {
    console.error('❌ Failed to connect to native app:', error);
  }
}

// Pause all YouTube videos
async function pauseYouTubeVideos() {
  try {
    console.log('🔍 Finding YouTube tabs...');
    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    
    console.log(`📺 Found ${tabs.length} YouTube tabs`);
    
    for (const tab of tabs) {
      console.log(`📤 Sending pause command to tab ${tab.id}`);
      chrome.tabs.sendMessage(tab.id, {
        type: 'EYE_TRACKING_PAUSE',
        reason: 'User looked away from screen'
      }).then(() => {
        console.log(`✅ Pause sent to tab ${tab.id}`);
      }).catch((error) => {
        console.log(`⚠️ Could not send to tab ${tab.id}:`, error.message);
      });
    }
  } catch (error) {
    console.error('❌ Error pausing videos:', error);
  }
}

// Send debug frame to YouTube tabs
async function sendDebugFrame(frameData, focused, awayDuration) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'DEBUG_FRAME',
        frame: frameData,
        focused: focused,
        awayDuration: awayDuration
      }).catch(() => {
        // Ignore errors - tab might not have content script loaded
      });
    }
  } catch (error) {
    // Silently fail - debug feature
  }
}

// Send camera error to YouTube tabs
async function sendCameraError(error) {
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'CAMERA_ERROR',
        error: error
      }).catch(() => {});
    }
  } catch (error) {
    // Silently fail
  }
}

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message.type);
  
  if (message.type === 'START_EYE_TRACKING') {
    console.log('▶️ Starting eye tracking...');
    eyeTrackingEnabled = true;
    connectToNativeApp();
    sendResponse({ success: true });
  } 
  else if (message.type === 'STOP_EYE_TRACKING') {
    console.log('⏹️ Stopping eye tracking...');
    eyeTrackingEnabled = false;
    if (nativePort) {
      nativePort.disconnect();
      nativePort = null;
    }
    sendResponse({ success: true });
  }
  else if (message.type === 'GET_EYE_TRACKING_STATUS') {
    sendResponse({ 
      enabled: eyeTrackingEnabled,
      connected: nativePort !== null 
    });
  }
  
  return true; // Keep channel open for async response
});

// Auto-start if enabled in settings
chrome.storage.sync.get({ eyeTrackingEnabled: false }, (settings) => {
  if (settings.eyeTrackingEnabled) {
    console.log('🚀 Auto-starting eye tracking from saved settings');
    eyeTrackingEnabled = true;
    connectToNativeApp();
  } else {
    console.log('💤 Eye tracking not enabled in settings');
  }
});
