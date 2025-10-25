// YouTube Recap Bot - Main Content Script
console.log('🎬 YouTube Recap Bot loaded');

class YouTubeRecapBot {
  constructor() {
    this.currentVideo = null;
    this.pauseTimeout = null;
    this.recapOverlay = null;
    this.settings = {
      pauseDelay: 1,
      showOnPause: true,
      aiProvider: 'demo'
    };
    
    console.log('🚀 Initializing YouTube Recap Bot...');
    this.init();
  }

  async init() {
    await this.loadSettings();
    console.log('✅ Settings loaded:', this.settings);
    
    // Wait for page to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupYouTubeDetection());
    } else {
      this.setupYouTubeDetection();
    }
  }

  async loadSettings() {
    try {
      const stored = await chrome.storage.sync.get({
        aiProvider: 'groq',
        groqKey: '',
        huggingfaceKey: '',
        geminiKey: '',
        apiKey: '',
        pauseDelay: 1,
        showOnPause: true
      });
      
      // Use API key from config.js file (which is gitignored)
      const configuredGroqKey = typeof API_CONFIG !== 'undefined' ? API_CONFIG.groqKey : '';
      
      // Map aiProvider to provider for consistency
      this.settings = {
        ...stored,
        provider: stored.aiProvider || 'groq',
        groqKey: configuredGroqKey || stored.groqKey
      };
      
      console.log('📋 Settings loaded - Provider:', this.settings.provider, 'Groq Key:', this.settings.groqKey ? '✓ Set' : '✗ Not set');
    } catch (error) {
      console.error('❌ Error loading settings:', error);
      // Use defaults if storage fails
      const configuredGroqKey = typeof API_CONFIG !== 'undefined' ? API_CONFIG.groqKey : '';
      this.settings = {
        provider: 'groq',
        aiProvider: 'groq',
        groqKey: configuredGroqKey,
        apiKey: '',
        pauseDelay: 1,
        showOnPause: true
      };
    }
  }

  setupYouTubeDetection() {
    console.log('🔍 Setting up YouTube video detection...');
    
    // Try to find video immediately
    const videoPlayer = document.querySelector('video');
    if (videoPlayer) {
      console.log('✅ Video found immediately!');
      this.attachPlayerListeners(videoPlayer);
    } else {
      console.log('⏳ Waiting for video element...');
    }

    // Watch for video element to appear
    const observer = new MutationObserver(() => {
      const newPlayer = document.querySelector('video');
      if (newPlayer && newPlayer !== this.currentVideo) {
        console.log('✅ New video detected!');
        this.attachPlayerListeners(newPlayer);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  attachPlayerListeners(video) {
    this.currentVideo = video;
    
    // Remove old listeners if any
    this.currentVideo.removeEventListener('pause', this.boundHandlePause);
    this.currentVideo.removeEventListener('play', this.boundHandlePlay);
    
    // Create bound versions
    this.boundHandlePause = () => this.handlePause();
    this.boundHandlePlay = () => this.handlePlay();
    
    // Attach new listeners
    this.currentVideo.addEventListener('pause', this.boundHandlePause);
    this.currentVideo.addEventListener('play', this.boundHandlePlay);
    
    console.log('🎧 Event listeners attached to video');
  }

  handlePause() {
    console.log('⏸️ Video paused!');
    
    if (!this.settings.showOnPause) {
      console.log('⚠️ Show on pause is disabled');
      return;
    }
    
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
    }
    
    const delay = this.settings.pauseDelay * 1000;
    console.log(`⏱️ Will show overlay in ${delay}ms`);
    
    this.pauseTimeout = setTimeout(() => {
      console.log('📱 Showing recap overlay now!');
      this.showRecapOverlay();
    }, delay);
  }

  handlePlay() {
    console.log('▶️ Video playing - hiding overlay');
    
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
    }
    this.hideRecapOverlay();
  }

  async showRecapOverlay() {
    if (this.recapOverlay) {
      console.log('⚠️ Overlay already visible');
      return;
    }
    
    console.log('🎨 Creating recap overlay...');
    const context = await this.getVideoContext();
    this.createRecapOverlay(context);
    await this.generateAutoSummary(context);
  }

  async generateAutoSummary(context) {
    console.log('🤖 Generating AI summary...');
    const messageDiv = document.querySelector('.recap-messages');
    if (!messageDiv) return;

    // Add loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot-message';
    loadingDiv.innerHTML = `
      <div class="message-content">
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    messageDiv.appendChild(loadingDiv);

    try {
      const summary = await this.generateAIResponse(context);
      loadingDiv.remove();
      this.addBotMessage(summary);
      console.log('✅ Summary generated!');
    } catch (error) {
      console.error('❌ Error generating summary:', error);
      loadingDiv.remove();
      this.addBotMessage('Sorry, I encountered an error generating the summary. Using demo mode instead.');
      this.addBotMessage(this.generateDemoResponse(context));
    }
  }

  async generateAIResponse(context) {
    const provider = this.settings.aiProvider || 'demo';
    console.log(`🔧 Using AI provider: ${provider}`);

    if (provider === 'demo') {
      return this.generateDemoResponse(context);
    }

    try {
      if (provider === 'groq') {
        return await this.generateGroqResponse(context);
      } else if (provider === 'huggingface') {
        return await this.generateHuggingFaceResponse(context);
      } else if (provider === 'gemini') {
        return await this.generateGeminiResponse(context);
      } else if (provider === 'openai') {
        return await this.generateOpenAIResponse(context);
      } else {
        return this.generateDemoResponse(context);
      }
    } catch (error) {
      console.error(`❌ Error with ${provider}:`, error);
      return this.generateDemoResponse(context);
    }
  }

  async generateGroqResponse(context) {
    const apiKey = this.settings.groqKey;
    if (!apiKey) {
      console.log('⚠️ No Groq API key configured');
      throw new Error('Groq API key not configured');
    }

    console.log(`📝 Generating summary for: ${context.title}`);
    console.log(`⏱️ Video paused at: ${this.formatTime(context.currentTime)} / ${this.formatTime(context.duration)}`);
    
    const hasTranscript = context.captions && context.captions.hasContent;
    console.log(`📄 Has transcript: ${hasTranscript}`);
    
    let prompt;
    
    if (hasTranscript) {
      // We have actual transcript!
      const fullContext = context.captions.fullTranscript.substring(0, 3000);
      const last20 = context.captions.last20Seconds;
      
      console.log(`✅ Using transcript - Full: ${fullContext.length} chars, Last 20s: ${last20.length} chars`);
      
      prompt = `You are summarizing a YouTube video titled "${context.title}" by ${context.channel}.

FULL VIDEO TRANSCRIPT (for context and understanding):
${fullContext}

The user paused at ${this.formatTime(context.currentTime)} out of ${this.formatTime(context.duration)}.

TRANSCRIPT FROM LAST 20 SECONDS ONLY:
"${last20}"

Task: Use the full transcript to understand the video's context, but create exactly 3 bullet points summarizing ONLY what was said/shown in the last 20 seconds.

Be specific and reference the actual content from the last 20 seconds.

Format:
• First key point from last 20 seconds
• Second key point from last 20 seconds
• Third key point from last 20 seconds`;
    } else {
      // No transcript - use title/position only
      console.log('⚠️ No transcript available, using title-based summary');
      prompt = `You are summarizing a YouTube video.

Title: "${context.title}"
Channel: ${context.channel}
Video paused at: ${this.formatTime(context.currentTime)} out of ${this.formatTime(context.duration)}

Based on the video title and where the user paused, provide exactly 3 bullet points summarizing what is likely happening at this point in the video.

Format:
• First key point
• Second key point
• Third key point`;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You create concise bullet-point summaries. When given a full transcript for context and a "last 20 seconds" section, you ONLY summarize the last 20 seconds section, but use the full context to understand what\'s happening.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.6,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Got response from Groq!');
    return data.choices[0].message.content;
  }

  async generateHuggingFaceResponse(context) {
    const apiKey = this.settings.huggingfaceKey;
    if (!apiKey) throw new Error('HuggingFace API key not configured');

    const hasTranscript = context.captions && context.captions.hasContent;
    const transcriptContext = hasTranscript ? 
      `Context: ${context.captions.fullTranscript.substring(0, 1500)}` : 
      '';
    const recentContent = hasTranscript ? 
      `Recent: ${context.captions.last20Seconds}` : 
      `Time: ${context.currentTime}s`;

    const prompt = `Summarize in 3 bullets what happened in the last 20 seconds of "${context.title}": ${transcriptContext} ${recentContent}`;

    const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 200,
          temperature: 0.7,
          return_full_text: false
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const data = await response.json();
    return data[0].generated_text;
  }

  async generateGeminiResponse(context) {
    const apiKey = this.settings.geminiKey;
    if (!apiKey) throw new Error('Gemini API key not configured');

    const hasTranscript = context.captions && context.captions.hasContent;
    const transcriptContext = hasTranscript ? 
      `Full context: ${context.captions.fullTranscript.substring(0, 2000)}` : 
      '';
    const recentContent = hasTranscript ? 
      `Last 20 seconds: ${context.captions.last20Seconds}` : 
      `Video at ${context.currentTime}s`;

    const prompt = `Create exactly 3 bullet points summarizing the last 20 seconds of this YouTube video:
Title: ${context.title}
Channel: ${context.channel}
${transcriptContext}
${recentContent}

Format as:
• Point 1
• Point 2
• Point 3`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  async generateOpenAIResponse(context) {
    const apiKey = this.settings.apiKey;
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const hasTranscript = context.captions && context.captions.hasContent;
    const transcriptContext = hasTranscript ? 
      `Full context: ${context.captions.fullTranscript.substring(0, 2000)}` : 
      '';
    const recentContent = hasTranscript ? 
      `Last 20 seconds: ${context.captions.last20Seconds}` : 
      `Video at ${context.currentTime}s`;

    const prompt = `Summarize in exactly 3 bullet points what happened in the last 20 seconds of "${context.title}" by ${context.channel}. ${transcriptContext} ${recentContent}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You create concise 3-bullet summaries of video content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 250
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  generateDemoResponse(context) {
    const hasTranscript = context.captions && context.captions.hasContent;
    
    if (hasTranscript) {
      const last20Text = context.captions.last20Seconds;
      const words = last20Text.split(' ').slice(0, 30).join(' ');
      
      return `**Quick Recap (Last 20 seconds)**

• ${context.title}
• Paused at ${this.formatTime(context.currentTime)}
• Recent content: "${words}..."

*Configure Groq API in settings for AI-powered summaries!*`;
    }

    return `**Quick Recap**

• **${context.title}** by ${context.channel}
• Currently at ${this.formatTime(context.currentTime)} of ${this.formatTime(context.duration)}
• No transcript available for this video

*Configure a free AI provider in settings for intelligent summaries! Groq is recommended.*`;
  }

  async getVideoContext() {
    console.log('📹 Getting video context...');
    const context = {
      title: '',
      channel: '',
      currentTime: 0,
      duration: 0,
      description: '',
      url: window.location.href,
      tags: [],
      captions: null
    };

    try {
      const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata yt-formatted-string');
      if (titleElement) {
        context.title = titleElement.textContent.trim();
        console.log(`📺 Title: ${context.title}`);
      } else {
        console.log('⚠️ Could not find title element');
      }

      const channelElement = document.querySelector('#channel-name a, ytd-channel-name a');
      if (channelElement) {
        context.channel = channelElement.textContent.trim();
        console.log(`👤 Channel: ${context.channel}`);
      } else {
        console.log('⚠️ Could not find channel element');
      }

      if (this.currentVideo) {
        context.currentTime = Math.floor(this.currentVideo.currentTime);
        context.duration = Math.floor(this.currentVideo.duration);
        console.log(`⏱️ Time: ${context.currentTime}s / ${context.duration}s`);
      }

      const descElement = document.querySelector('#description-inline-expander, #description yt-formatted-string');
      if (descElement) context.description = descElement.textContent.trim().substring(0, 1000);

      console.log('🎯 Attempting to get captions...');
      const captionData = await this.getCaptionsAroundTime(context.currentTime);
      if (captionData) {
        console.log('✅ Got captions from TextTracks!');
        context.captions = captionData;
      } else {
        console.log('⚠️ TextTracks failed, trying YouTube transcript...');
        const transcriptData = await this.getYouTubeTranscript(context.currentTime);
        if (transcriptData) {
          console.log('✅ Got transcript from YouTube API!');
          context.captions = transcriptData;
        } else {
          console.log('❌ No transcript available from any source');
        }
      }

      console.log('📦 Final context:', {
        title: context.title,
        channel: context.channel,
        currentTime: context.currentTime,
        hasCaption: !!context.captions,
        captionLength: context.captions?.last20Seconds?.length || 0
      });

      return context;
    } catch (error) {
      console.error('❌ Error getting context:', error);
      return context;
    }
  }

  async enableCaptions() {
    try {
      console.log('🎬 Attempting to enable captions...');
      // Try to click the captions button
      const captionButton = document.querySelector('.ytp-subtitles-button');
      if (captionButton) {
        const isEnabled = captionButton.getAttribute('aria-pressed') === 'true';
        if (!isEnabled) {
          console.log('🖱️ Clicking caption button...');
          captionButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log('✅ Captions already enabled');
        }
      }
    } catch (error) {
      console.log('⚠️ Could not auto-enable captions:', error);
    }
  }

  async getCaptionsAroundTime(currentTime) {
    try {
      console.log('🔍 Checking for TextTracks...');
      if (!this.currentVideo || !this.currentVideo.textTracks) {
        console.log('❌ No video or textTracks available');
        return null;
      }

      // Try to enable captions first
      await this.enableCaptions();

      console.log(`📊 Found ${this.currentVideo.textTracks.length} text tracks`);

      let activeTrack = null;
      for (let i = 0; i < this.currentVideo.textTracks.length; i++) {
        const track = this.currentVideo.textTracks[i];
        console.log(`Track ${i}: kind=${track.kind}, mode=${track.mode}, language=${track.language}`);
        if (track.kind === 'subtitles' || track.kind === 'captions') {
          if (track.mode === 'showing' || track.mode === 'hidden') {
            activeTrack = track;
            console.log(`✅ Using active track ${i}`);
            break;
          }
        }
      }

      if (!activeTrack && this.currentVideo.textTracks.length > 0) {
        for (let i = 0; i < this.currentVideo.textTracks.length; i++) {
          const track = this.currentVideo.textTracks[i];
          if (track.kind === 'subtitles' || track.kind === 'captions') {
            activeTrack = track;
            activeTrack.mode = 'hidden';
            console.log(`✅ Activated track ${i} in hidden mode`);
            break;
          }
        }
      }

      if (!activeTrack) {
        console.log('❌ No suitable caption track found');
        return null;
      }

      // Wait a moment for cues to load
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!activeTrack.cues || activeTrack.cues.length === 0) {
        console.log('❌ Track has no cues');
        return null;
      }

      console.log(`📝 Found ${activeTrack.cues.length} caption cues`);

      const allCaptions = [];
      const last20SecondsCaptions = [];
      const startTime = Math.max(0, currentTime - 20);

      for (let i = 0; i < activeTrack.cues.length; i++) {
        const cue = activeTrack.cues[i];
        allCaptions.push({
          text: cue.text,
          start: cue.startTime,
          end: cue.endTime
        });

        if (cue.startTime >= startTime && cue.startTime <= currentTime) {
          last20SecondsCaptions.push({
            text: cue.text,
            start: cue.startTime,
            end: cue.endTime
          });
        }
      }

      if (allCaptions.length === 0) {
        console.log('❌ No captions extracted');
        return null;
      }

      console.log(`✅ Extracted ${allCaptions.length} total captions, ${last20SecondsCaptions.length} from last 20s`);
      console.log(`📄 Last 20s preview: ${last20SecondsCaptions.map(c => c.text).join(' ').substring(0, 100)}...`);

      return {
        fullTranscript: allCaptions.map(c => c.text).join(' '),
        last20Seconds: last20SecondsCaptions.map(c => c.text).join(' '),
        hasContent: last20SecondsCaptions.length > 0
      };
    } catch (error) {
      console.error('❌ Error getting captions:', error);
      return null;
    }
  }

  async getYouTubeTranscript(currentTime) {
    try {
      console.log('📜 Reading YouTube transcript...');
      
      // Check if transcript is already loaded
      let transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
      let needToOpen = transcriptSegments.length === 0;
      
      if (needToOpen) {
        console.log('📂 Opening transcript panel...');
        
        // Find transcript button
        const transcriptButton = document.querySelector('button[aria-label*="transcript" i], button[aria-label*="Show transcript" i]');
        
        if (!transcriptButton) {
          const moreActionsButton = document.querySelector('#button-shape > button[aria-label="More actions"]');
          if (moreActionsButton) {
            moreActionsButton.click();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item');
            for (const item of menuItems) {
              if (item.textContent.includes('Show transcript') || item.textContent.includes('Transcript')) {
                item.click();
                await new Promise(resolve => setTimeout(resolve, 800));
                break;
              }
            }
          }
        } else {
          transcriptButton.click();
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
      }
      
      if (transcriptSegments.length === 0) {
        console.log('❌ No transcript segments found');
        return null;
      }
      
      console.log(`✅ Found ${transcriptSegments.length} transcript segments`);
      
      const allCaptions = [];
      const last20SecondsCaptions = [];
      const startTime = Math.max(0, currentTime - 20);
      
      transcriptSegments.forEach((segment) => {
        const timeElement = segment.querySelector('.segment-timestamp');
        const textElement = segment.querySelector('.segment-text');
        
        if (timeElement && textElement) {
          const timeText = timeElement.textContent.trim();
          const text = textElement.textContent.trim();
          
          const timeParts = timeText.split(':').map(p => parseInt(p));
          let timeInSeconds = 0;
          if (timeParts.length === 2) {
            timeInSeconds = timeParts[0] * 60 + timeParts[1];
          } else if (timeParts.length === 3) {
            timeInSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
          }
          
          allCaptions.push({
            text: text,
            start: timeInSeconds,
            time: timeText
          });
          
          if (timeInSeconds >= startTime && timeInSeconds <= currentTime) {
            last20SecondsCaptions.push({
              text: text,
              start: timeInSeconds,
              time: timeText
            });
          }
        }
      });
      
      console.log(`✅ Extracted ${allCaptions.length} total captions`);
      console.log(`✅ Extracted ${last20SecondsCaptions.length} from last 20s`);
      
      const result = {
        fullTranscript: allCaptions.map(c => c.text).join(' '),
        last20Seconds: last20SecondsCaptions.map(c => c.text).join(' '),
        hasContent: last20SecondsCaptions.length > 0
      };
      
      // Close transcript panel if we opened it
      if (needToOpen) {
        const closeButton = document.querySelector('ytd-engagement-panel-title-header-renderer #visibility-button');
        if (closeButton) {
          closeButton.click();
          console.log('✅ Closed transcript panel');
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error reading YouTube transcript:', error);
      return null;
    }
  }

  parseTranscriptFromXML(xmlText, currentTime) {
    try {
      console.log('🔄 Parsing transcript XML...');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const textElements = xmlDoc.querySelectorAll('text');

      console.log(`📄 Found ${textElements.length} text elements in XML`);

      const allCaptions = [];
      const last20SecondsCaptions = [];
      const startTime = Math.max(0, currentTime - 20);

      console.log(`⏱️ Looking for captions between ${startTime}s and ${currentTime}s`);

      textElements.forEach((elem, index) => {
        const start = parseFloat(elem.getAttribute('start'));
        const dur = parseFloat(elem.getAttribute('dur') || '0');
        const text = elem.textContent
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");

        allCaptions.push({
          text: text,
          start: start,
          end: start + dur
        });

        if (start >= startTime && start <= currentTime) {
          last20SecondsCaptions.push({
            text: text,
            start: start,
            end: start + dur
          });
          if (index < 5) {
            console.log(`  ✓ Caption at ${start}s: "${text.substring(0, 50)}..."`);
          }
        }
      });

      console.log(`📊 Extracted ${allCaptions.length} total captions`);
      console.log(`📊 Extracted ${last20SecondsCaptions.length} captions from last 20s`);

      if (allCaptions.length === 0) {
        console.log('❌ No captions found in XML');
        return null;
      }

      const result = {
        fullTranscript: allCaptions.map(c => c.text).join(' '),
        last20Seconds: last20SecondsCaptions.map(c => c.text).join(' '),
        hasContent: last20SecondsCaptions.length > 0
      };

      console.log(`✅ Parsed transcript - Full: ${result.fullTranscript.length} chars, Last 20s: ${result.last20Seconds.length} chars`);
      console.log(`📝 Last 20s preview: "${result.last20Seconds.substring(0, 100)}..."`);

      return result;
    } catch (error) {
      console.error('❌ Error parsing transcript XML:', error);
      return null;
    }
  }

  async generateAutoSummary(context) {
    const messageDiv = document.querySelector('.recap-messages');
    if (!messageDiv) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot-message';
    loadingDiv.innerHTML = `
      <div class="message-content">
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    messageDiv.appendChild(loadingDiv);

    try {
      const summary = await this.generateAIResponse(context, 'summary');
      loadingDiv.remove();
      this.addBotMessage(summary);
    } catch (error) {
      console.error('Error generating summary:', error);
      loadingDiv.remove();
      this.addBotMessage('Sorry, I encountered an error generating the summary. Please check your API settings.');
    }
  }

  async generateAIResponse(context, type = 'summary') {
    const provider = this.settings.aiProvider || 'demo';

    if (provider === 'demo') {
      return this.generateDemoResponse(context);
    }

    try {
      if (provider === 'groq') {
        return await this.generateGroqResponse(context);
      } else if (provider === 'huggingface') {
        return await this.generateHuggingFaceResponse(context);
      } else if (provider === 'gemini') {
        return await this.generateGeminiResponse(context);
      } else if (provider === 'openai') {
        return await this.generateOpenAIResponse(context);
      } else {
        return this.generateDemoResponse(context);
      }
    } catch (error) {
      console.error(`Error with ${provider}:`, error);
      return this.generateDemoResponse(context);
    }
  }

  async generateGroqResponse(context) {
    const apiKey = this.settings.groqKey;
    if (!apiKey) throw new Error('Groq API key not configured');

    const hasTranscript = context.captions && context.captions.hasContent;
    const transcriptContext = hasTranscript ? 
      `Full video context: ${context.captions.fullTranscript.substring(0, 2000)}` : 
      '';
    const recentContent = hasTranscript ? 
      `Last 20 seconds: ${context.captions.last20Seconds}` : 
      `Video at ${context.currentTime}s of ${context.duration}s`;

    const prompt = `You are summarizing a YouTube video titled "${context.title}" by ${context.channel}.

${transcriptContext}

${recentContent}

Provide exactly 3 bullet points summarizing what happened in the last 20 seconds. Be specific and reference actual content from the transcript. Use this format:
• First key point
• Second key point  
• Third key point`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise, specific bullet-point summaries of video content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async generateHuggingFaceResponse(context) {
    const apiKey = this.settings.huggingfaceKey;
    if (!apiKey) throw new Error('HuggingFace API key not configured');

    const hasTranscript = context.captions && context.captions.hasContent;
    const transcriptContext = hasTranscript ? 
      `Context: ${context.captions.fullTranscript.substring(0, 1500)}` : 
      '';
    const recentContent = hasTranscript ? 
      `Recent: ${context.captions.last20Seconds}` : 
      `Time: ${context.currentTime}s`;

    const prompt = `Summarize in 3 bullets what happened in the last 20 seconds of "${context.title}": ${transcriptContext} ${recentContent}`;

    const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 200,
          temperature: 0.7,
          return_full_text: false
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const data = await response.json();
    return data[0].generated_text;
  }

  async generateGeminiResponse(context) {
    const apiKey = this.settings.geminiKey;
    if (!apiKey) throw new Error('Gemini API key not configured');

    const hasTranscript = context.captions && context.captions.hasContent;
    const transcriptContext = hasTranscript ? 
      `Full context: ${context.captions.fullTranscript.substring(0, 2000)}` : 
      '';
    const recentContent = hasTranscript ? 
      `Last 20 seconds: ${context.captions.last20Seconds}` : 
      `Video at ${context.currentTime}s`;

    const prompt = `Create exactly 3 bullet points summarizing the last 20 seconds of this YouTube video:
Title: ${context.title}
Channel: ${context.channel}
${transcriptContext}
${recentContent}

Format as:
• Point 1
• Point 2
• Point 3`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  async generateOpenAIResponse(context) {
    const apiKey = this.settings.apiKey;
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const hasTranscript = context.captions && context.captions.hasContent;
    const transcriptContext = hasTranscript ? 
      `Full context: ${context.captions.fullTranscript.substring(0, 2000)}` : 
      '';
    const recentContent = hasTranscript ? 
      `Last 20 seconds: ${context.captions.last20Seconds}` : 
      `Video at ${context.currentTime}s`;

    const prompt = `Summarize in exactly 3 bullet points what happened in the last 20 seconds of "${context.title}" by ${context.channel}. ${transcriptContext} ${recentContent}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You create concise 3-bullet summaries of video content.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 250
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  generateDemoResponse(context) {
    const hasTranscript = context.captions && context.captions.hasContent;
    
    if (hasTranscript) {
      const last20Text = context.captions.last20Seconds;
      const words = last20Text.split(' ').slice(0, 30).join(' ');
      
      return `**Quick Recap (Demo Mode)**

• ${context.title} by ${context.channel}
• Currently at ${this.formatTime(context.currentTime)} of ${this.formatTime(context.duration)}
• Recent content: "${words}..."

*Configure a free AI provider in settings for AI-powered summaries!*`;
    }

    return `**Quick Recap (Demo Mode)**

• **${context.title}** by ${context.channel}
• Currently at ${this.formatTime(context.currentTime)} of ${this.formatTime(context.duration)}
• Click settings to configure a free AI provider for intelligent summaries

*Groq is recommended - completely free with fast responses!*`;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatBotMessage(text) {
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    const lines = formatted.split('\n');
    let html = '';
    let inList = false;

    for (let line of lines) {
      line = line.trim();
      if (!line) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += '<br>';
        continue;
      }

      if (line.match(/^[•\-\*]\s/)) {
        if (!inList) {
          html += '<ul class="bullet-list">';
          inList = true;
        }
        const content = line.replace(/^[•\-\*]\s/, '');
        html += `<li>${content}</li>`;
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<p>${line}</p>`;
      }
    }

    if (inList) {
      html += '</ul>';
    }

    return html;
  }

  createRecapOverlay(context) {
    const overlay = document.createElement('div');
    overlay.className = 'youtube-recap-overlay';
    overlay.innerHTML = `
      <div class="recap-panel">
        <div class="recap-header">
          <div class="recap-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            Video Recap
          </div>
          <button class="recap-close" id="closeRecap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="recap-messages"></div>
        <div class="recap-input-container">
          <input type="text" class="recap-input" placeholder="Ask about the video..." />
          <button class="recap-send-btn" id="sendMessage">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.recapOverlay = overlay;
    this.currentContext = context;

    setTimeout(() => overlay.classList.add('visible'), 10);

    const closeBtn = overlay.querySelector('#closeRecap');
    closeBtn.addEventListener('click', () => this.hideRecapOverlay());

    // Close when clicking outside the panel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hideRecapOverlay();
      }
    });

    // Handle chat input
    const input = overlay.querySelector('.recap-input');
    const sendBtn = overlay.querySelector('#sendMessage');

    const sendMessage = async () => {
      const message = input.value.trim();
      if (!message) return;

      console.log('💬 User asked:', message);
      console.log('🔧 Current provider:', this.settings.provider);
      
      // Get the correct API key based on provider
      let apiKeyPresent = false;
      if (this.settings.provider === 'groq') {
        apiKeyPresent = !!this.settings.groqKey;
        console.log('🔑 Groq Key present:', apiKeyPresent);
      } else if (this.settings.provider === 'huggingface') {
        apiKeyPresent = !!this.settings.huggingfaceKey;
        console.log('🔑 HuggingFace Key present:', apiKeyPresent);
      } else if (this.settings.provider === 'gemini') {
        apiKeyPresent = !!this.settings.geminiKey;
        console.log('🔑 Gemini Key present:', apiKeyPresent);
      } else if (this.settings.provider === 'openai') {
        apiKeyPresent = !!this.settings.apiKey;
        console.log('🔑 OpenAI Key present:', apiKeyPresent);
      }

      // Check if AI is configured
      if (!this.settings.provider || this.settings.provider === 'demo') {
        this.addUserMessage(message);
        this.addBotMessage(`⚙️ **AI Provider Not Configured**\n\nTo get real answers:\n1. Click the extension icon\n2. Select "Groq" (free!)\n3. Get API key from https://console.groq.com\n4. Save settings\n\nThen ask again!`);
        input.value = '';
        return;
      }

      if (!apiKeyPresent) {
        this.addUserMessage(message);
        this.addBotMessage(`🔑 **API Key Missing**\n\nPlease add your ${this.settings.provider} API key in settings.`);
        input.value = '';
        return;
      }

      this.addUserMessage(message);
      input.value = '';

      await this.handleUserQuestion(message);
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }

  addBotMessage(message) {
    const messagesDiv = this.recapOverlay?.querySelector('.recap-messages');
    if (!messagesDiv) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    messageDiv.innerHTML = `
      <div class="message-content">
        ${this.formatBotMessage(message)}
      </div>
    `;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  addUserMessage(message) {
    const messagesDiv = this.recapOverlay?.querySelector('.recap-messages');
    if (!messagesDiv) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = `
      <div class="message-content">
        ${message}
      </div>
    `;

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  async handleUserQuestion(question) {
    const messagesDiv = this.recapOverlay?.querySelector('.recap-messages');
    if (!messagesDiv) return;

    console.log('🤖 Processing question:', question);
    console.log('📋 Provider:', this.settings.provider);
    console.log('🔑 Has API key:', !!this.settings.apiKey);

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot-message loading-message';
    loadingDiv.innerHTML = `
      <div class="message-content">
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    messagesDiv.appendChild(loadingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    try {
      // Get fresh video context
      const video = document.querySelector('video');
      const currentTime = video ? video.currentTime : this.currentContext.currentTime;
      
      // Check if we need to refresh transcript
      if (!this.currentContext.captions || !this.currentContext.captions.fullTranscript) {
        console.log('📜 Fetching transcript for chat...');
        const transcriptData = await this.getYouTubeTranscript(currentTime);
        if (transcriptData) {
          this.currentContext.captions = transcriptData;
          console.log('✅ Transcript loaded');
        }
      }

      let response;
      const hasTranscript = this.currentContext.captions && this.currentContext.captions.hasContent;
      
      console.log('📝 Has transcript:', hasTranscript);
      
      const contextInfo = {
        title: this.currentContext.title,
        channel: this.currentContext.channel,
        currentTime: currentTime,
        duration: video ? video.duration : 0,
        question: question,
        transcript: hasTranscript ? this.currentContext.captions.fullTranscript : null,
        last20Seconds: hasTranscript ? this.currentContext.captions.last20Seconds : null
      };

      console.log('🎯 Calling AI with provider:', this.settings.provider);

      switch (this.settings.provider) {
        case 'groq':
          response = await this.generateGroqChatResponse(contextInfo);
          break;
        case 'huggingface':
          response = await this.generateHuggingFaceChatResponse(contextInfo);
          break;
        case 'gemini':
          response = await this.generateGeminiChatResponse(contextInfo);
          break;
        case 'openai':
          response = await this.generateOpenAIChatResponse(contextInfo);
          break;
        default:
          response = await this.generateDemoChatResponse(contextInfo);
      }

      console.log('✅ Got AI response');
      loadingDiv.remove();
      this.addBotMessage(response);
    } catch (error) {
      console.error('❌ Chat error:', error);
      loadingDiv.remove();
      this.addBotMessage(`❌ **Error:** ${error.message}\n\nCheck console (F12) for details or verify your API key in settings.`);
    }
  }

  async generateGroqChatResponse(context) {
    const apiKey = this.settings.groqKey;
    if (!apiKey) throw new Error('Groq API key not configured');

    const transcriptContext = context.transcript ? 
      `\n\nVideo transcript:\n${context.transcript.substring(0, 3000)}` : 
      '';

    const prompt = `You are a helpful assistant answering questions about the YouTube video "${context.title}" by ${context.channel}. The user is currently at ${this.formatTime(context.currentTime)}.${transcriptContext}\n\nUser question: ${context.question}\n\nProvide a helpful, concise answer based on the video content.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async generateHuggingFaceChatResponse(context) {
    const apiKey = this.settings.huggingfaceKey;
    if (!apiKey) throw new Error('HuggingFace API key not configured');

    const transcriptContext = context.transcript ? 
      `Video transcript: ${context.transcript.substring(0, 2000)}` : 
      '';

    const prompt = `Answer this question about "${context.title}" by ${context.channel}: ${context.question}. ${transcriptContext}`;

    const response = await fetch('https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 500, temperature: 0.7 }
      })
    });

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const data = await response.json();
    return data[0].generated_text.replace(prompt, '').trim();
  }

  async generateGeminiChatResponse(context) {
    const apiKey = this.settings.geminiKey;
    if (!apiKey) throw new Error('Gemini API key not configured');

    const transcriptContext = context.transcript ? 
      `\n\nVideo transcript:\n${context.transcript.substring(0, 3000)}` : 
      '';

    const prompt = `Answer this question about the YouTube video "${context.title}" by ${context.channel}:${transcriptContext}\n\nQuestion: ${context.question}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  async generateOpenAIChatResponse(context) {
    const apiKey = this.settings.apiKey;
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const transcriptContext = context.transcript ? 
      `\n\nVideo transcript:\n${context.transcript.substring(0, 3000)}` : 
      '';

    const prompt = `Answer this question about "${context.title}" by ${context.channel}:${transcriptContext}\n\nQuestion: ${context.question}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async generateDemoChatResponse(context) {
    return `This is a demo response to: "${context.question}"\n\nTo get real AI-powered answers about "${context.title}", please configure an AI provider in the extension settings.\n\n*Groq is recommended - completely free!*`;
  }

  hideRecapOverlay() {
    if (!this.recapOverlay) return;

    // Close transcript panel if it's open
    const closeButton = document.querySelector('ytd-engagement-panel-title-header-renderer #visibility-button');
    if (closeButton) {
      const panel = document.querySelector('tp-yt-paper-dialog#player-engagement-panel[aria-hidden="false"]');
      if (panel) {
        closeButton.click();
        console.log('✅ Closed transcript panel');
      }
    }

    this.recapOverlay.classList.remove('visible');
    setTimeout(() => {
      if (this.recapOverlay) {
        this.recapOverlay.remove();
        this.recapOverlay = null;
      }
    }, 300);
  }
}

new YouTubeRecapBot();
