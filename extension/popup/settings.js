// Settings popup functionality
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  attachEventListeners();
});

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get({
      pauseDelay: 1,
      showOnPause: true
    });

    document.getElementById('pauseDelay').value = settings.pauseDelay;
    document.getElementById('showOnPause').checked = settings.showOnPause;
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}
    demoInfo.style.display = 'block';
  } else if (provider === 'groq') {
    groqGroup.style.display = 'block';
  } else if (provider === 'huggingface') {
    huggingfaceGroup.style.display = 'block';
  } else if (provider === 'gemini') {
    geminiGroup.style.display = 'block';
  } else {
    openaiGroup.style.display = 'block';
  }
}

function attachEventListeners() {
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('testConnection').addEventListener('click', testConnection);
  
  // Listen for AI provider changes
  document.getElementById('aiProvider').addEventListener('change', (e) => {
    toggleApiKeyFields(e.target.value);
  });
  
  // Auto-save on certain changes
  document.getElementById('pauseDelay').addEventListener('change', saveSettings);
  document.getElementById('showOnPause').addEventListener('change', saveSettings);
}

async function saveSettings() {
  try {
    const settings = {

function attachEventListeners() {
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
}

async function saveSettings() {
  try {
    const settings = {
      pauseDelay: parseInt(document.getElementById('pauseDelay').value),
      showOnPause: document.getElementById('showOnPause').checked
    };

    await chrome.storage.sync.set(settings);
    showStatus('✅ Settings saved successfully!', 'success');
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('❌ Error saving settings', 'error');
  }
}
  
  if (!apiKey) {
    showStatus('Please enter a Groq API key first', 'error');
    return;
  }

  showStatus('Testing Groq connection...', 'info');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 10
      })
    });

    if (response.ok) {
      showStatus('✅ Groq API connection successful!', 'success');
    } else {
      const error = await response.json();
      showStatus(`❌ Error: ${error.error?.message || response.status}`, 'error');
    }
  } catch (error) {
    showStatus(`❌ Connection failed: ${error.message}`, 'error');
  }
}

async function testHuggingFaceConnection() {
  const token = document.getElementById('huggingfaceKey').value.trim();
  
  if (!token) {
    showStatus('Please enter a Hugging Face token first', 'error');
    return;
  }

  showStatus('Testing Hugging Face connection...', 'info');

  try {
    const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        inputs: 'Say hello',
        parameters: { max_new_tokens: 10 }
      })
    });

    if (response.ok) {
      showStatus('✅ Hugging Face API connection successful!', 'success');
    } else if (response.status === 503) {
      showStatus('⏳ Model is loading. It will work in ~20 seconds!', 'info');
    } else {
      const error = await response.json();
      showStatus(`❌ Error: ${error.error || response.status}`, 'error');
    }
  } catch (error) {
    showStatus(`❌ Connection failed: ${error.message}`, 'error');
  }
}

async function testGeminiConnection() {
  const apiKey = document.getElementById('geminiKey').value.trim();
  
  if (!apiKey) {
    showStatus('Please enter a Gemini API key first', 'error');
    return;
  }

  showStatus('Testing Gemini connection...', 'info');

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Say hello'
          }]
        }]
      })
    });

    if (response.ok) {
      showStatus('✅ Gemini API connection successful!', 'success');
    } else {
      const error = await response.json();
      showStatus(`❌ Error: ${error.error?.message || response.status}`, 'error');
    }
  } catch (error) {
    showStatus(`❌ Connection failed: ${error.message}`, 'error');
  }
}

async function testOpenAIConnection() {
  const apiKey = document.getElementById('apiKey').value.trim();
  
  if (!apiKey) {
    showStatus('Please enter an OpenAI API key first', 'error');
    return;
  }

  showStatus('Testing OpenAI connection...', 'info');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Say hello' }],
        max_tokens: 10
      })
    });

    if (response.ok) {
      showStatus('✅ OpenAI API connection successful!', 'success');
    } else {
      const error = await response.json();
      showStatus(`❌ Error: ${error.error?.message || response.status}`, 'error');
    }
  } catch (error) {
    showStatus(`❌ Connection failed: ${error.message}`, 'error');
  }
}


function showStatus(message, type) {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';
  
  if (type === 'success') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}
