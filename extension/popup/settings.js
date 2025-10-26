// Settings popup functionality
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  attachEventListeners();
});

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get({
      pauseDelay: 1,
      showOnPause: true,
      eyeTrackingEnabled: false
    });

    document.getElementById('pauseDelay').value = settings.pauseDelay;
    document.getElementById('showOnPause').checked = settings.showOnPause;
    document.getElementById('eyeTrackingEnabled').checked = settings.eyeTrackingEnabled;
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

function attachEventListeners() {
  // Save Settings button
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  
  // Eye tracking toggle - save immediately
  document.getElementById('eyeTrackingEnabled').addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    
    try {
      // Save setting
      await chrome.storage.sync.set({ eyeTrackingEnabled: enabled });
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: enabled ? 'START_EYE_TRACKING' : 'STOP_EYE_TRACKING'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
          showStatus('❌ Error: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        if (response && response.success) {
          showStatus(enabled ? '👁️ Eye tracking started' : '👁️ Eye tracking stopped', 'success');
        } else {
          showStatus('⚠️ Eye tracking setting saved, but background script not ready', 'info');
        }
      });
    } catch (error) {
      console.error('Error toggling eye tracking:', error);
      showStatus('❌ Error: ' + error.message, 'error');
    }
  });
}

async function saveSettings() {
  try {
    const settings = {
      pauseDelay: parseInt(document.getElementById('pauseDelay').value),
      showOnPause: document.getElementById('showOnPause').checked,
      eyeTrackingEnabled: document.getElementById('eyeTrackingEnabled').checked
    };

    // Validate
    if (isNaN(settings.pauseDelay) || settings.pauseDelay < 0) {
      showStatus('❌ Invalid popup delay value', 'error');
      return;
    }

    await chrome.storage.sync.set(settings);
    showStatus('✅ Settings saved successfully!', 'success');
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('❌ Error saving settings: ' + error.message, 'error');
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('statusMessage');
  if (!statusEl) {
    console.error('Status element not found');
    return;
  }
  
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';
  
  // Auto-hide success messages
  if (type === 'success') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}
