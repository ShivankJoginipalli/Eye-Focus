// Background service worker for eye tracking integration
console.log('🎯 Eye Focus Background Service Worker loaded');

let nativePort = null;
let eyeTrackingEnabled = false;

// Connect to native messaging host
function connectToNativeApp() {
  try {
    nativePort = chrome.runtime.connectNative('com.eyefocus.monitor');
    
    nativePort.onMessage.addListener((message) => {
      console.log('👁️ Received from eye tracker:', message);
      
      if (message.action === 'pause_video' && message.reason === 'eyes_away') {
        // Send message to all YouTube tabs to pause
        pauseYouTubeVideos();
      }
    });
    
    nativePort.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      console.log('👁️ Disconnected from eye tracker');
      if (error) {
        console.error('❌ Disconnect error:', error.message);
      }
      nativePort = null;
      
      if (eyeTrackingEnabled) {
        // Try to reconnect after 5 seconds
        console.log('🔄 Will reconnect in 5 seconds...');
        setTimeout(connectToNativeApp, 5000);
      }
    });
    
    console.log('✅ Connected to eye tracking monitor');
  } catch (error) {
    console.error('❌ Failed to connect to eye tracker:', error);
  }
}

// Pause all YouTube videos
async function pauseYouTubeVideos() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
    
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'EYE_TRACKING_PAUSE',
        reason: 'User looked away from screen'
      }).catch(() => {
        // Ignore errors for tabs without content script
      });
    }
    
    console.log(`👁️ Sent pause command to ${tabs.length} YouTube tabs`);
  } catch (error) {
    console.error('❌ Error pausing videos:', error);
  }
}

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_EYE_TRACKING') {
    eyeTrackingEnabled = true;
    connectToNativeApp();
    sendResponse({ success: true });
  } else if (message.type === 'STOP_EYE_TRACKING') {
    eyeTrackingEnabled = false;
    if (nativePort) {
      nativePort.disconnect();
      nativePort = null;
    }
    sendResponse({ success: true });
  } else if (message.type === 'GET_EYE_TRACKING_STATUS') {
    sendResponse({ 
      enabled: eyeTrackingEnabled,
      connected: nativePort !== null 
    });
  }
  
  return true; // Keep message channel open for async response
});

// Auto-start eye tracking on extension load
chrome.storage.sync.get({ eyeTrackingEnabled: false }, (settings) => {
  if (settings.eyeTrackingEnabled) {
    eyeTrackingEnabled = true;
    connectToNativeApp();
  }
});
