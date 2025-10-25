// YouTube Recap Bot - Main Content Script
console.log('YouTube Recap Bot loaded');

class YouTubeRecapBot {
  constructor() {
    this.isActive = false;
    this.currentVideo = null;
    this.pauseTimeout = null;
    this.recapOverlay = null;
    this.settings = {
      pauseDelay: 1,
      showOnPause: true
    };
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    console.log('YouTube Recap Bot initialized');
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupYouTubeDetection());
    } else {
      this.setupYouTubeDetection();
    }

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SETTINGS_UPDATED') {
        this.settings = { ...this.settings, ...message.settings };
      }
    });
  }

  async loadSettings() {
    try {
      const stored = await chrome.storage.sync.get({
        aiProvider: 'demo',
        groqKey: '',
        huggingfaceKey: '',
        geminiKey: '',
        apiKey: '',
        pauseDelay: 1,
        showOnPause: true
      });
      this.settings = stored;
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  setupYouTubeDetection() {
    const videoPlayer = document.querySelector('video');
    if (videoPlayer) {
      this.attachPlayerListeners(videoPlayer);
    }

    const observer = new MutationObserver(() => {
      const newPlayer = document.querySelector('video');
      if (newPlayer && newPlayer !== this.currentVideo) {
        this.attachPlayerListeners(newPlayer);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  attachPlayerListeners(video) {
    if (this.currentVideo) {
      this.removePlayerListeners();
    }

    this.currentVideo = video;
    this.currentVideo.addEventListener('pause', () => this.handlePause());
    this.currentVideo.addEventListener('play', () => this.handlePlay());
  }

  removePlayerListeners() {
    if (this.currentVideo) {
      this.currentVideo.removeEventListener('pause', this.handlePause);
      this.currentVideo.removeEventListener('play', this.handlePlay);
    }
  }

  handlePause() {
    if (!this.settings.showOnPause) return;
    
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
    }
    
    const delay = this.settings.pauseDelay * 1000;
    this.pauseTimeout = setTimeout(() => {
      this.showRecapOverlay();
    }, delay);
  }

  handlePlay() {
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
    }
    this.hideRecapOverlay();
  }

  async showRecapOverlay() {
    if (this.recapOverlay) return;
    
    const context = await this.getVideoContext();
    this.createRecapOverlay(context);
    await this.generateAutoSummary(context);
  }

  async getVideoContext() {
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
      if (titleElement) context.title = titleElement.textContent.trim();

      const channelElement = document.querySelector('#channel-name a, ytd-channel-name a');
      if (channelElement) context.channel = channelElement.textContent.trim();

      if (this.currentVideo) {
        context.currentTime = Math.floor(this.currentVideo.currentTime);
        context.duration = Math.floor(this.currentVideo.duration);
      }

      const descElement = document.querySelector('#description-inline-expander, #description yt-formatted-string');
      if (descElement) context.description = descElement.textContent.trim().substring(0, 1000);

      const captionData = await this.getCaptionsAroundTime(context.currentTime);
      if (captionData) {
        context.captions = captionData;
      } else {
        const transcriptData = await this.getYouTubeTranscript(context.currentTime);
        if (transcriptData) context.captions = transcriptData;
      }

      return context;
    } catch (error) {
      console.error('Error getting context:', error);
      return context;
    }
  }
