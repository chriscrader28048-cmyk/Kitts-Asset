import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Tool, Type } from '@google/genai';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, blobToBase64 } from '../utils/audioHelper';

// Configuration
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';

// LATENCY OPTIMIZATION:
// Reduce Video Frame rate to 0.5 FPS (1 frame every 2 seconds) to prioritize Audio Bandwidth
const FRAME_RATE = 0.5; 
const JPEG_QUALITY = 0.4;

// Noise Gate Threshold (0.0 to 1.0). 
const NOISE_THRESHOLD = 0.01; 

// Silence Hangover
const SILENCE_HANGOVER_FRAMES = 4;

// --- Tool Definitions ---

const renderWeatherTool: FunctionDeclaration = {
  name: 'render_weather_widget',
  description: 'Display a holographic weather widget to the user with current conditions.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: { type: Type.STRING, description: 'The city or location name' },
      temperature: { type: Type.STRING, description: 'The current temperature with unit (e.g. 24°C)' },
      condition: { 
        type: Type.STRING, 
        description: 'The weather condition category', 
        enum: ['sunny', 'cloudy', 'rain', 'storm', 'snow', 'fog', 'clear'] 
      }
    },
    required: ['location', 'temperature', 'condition']
  }
};

const renderMapTool: FunctionDeclaration = {
  name: 'render_map_location',
  description: 'Display a tactical map target reticle for a specific geographic location.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Name of the place' },
      lat: { type: Type.STRING, description: 'Approximate Latitude' },
      lon: { type: Type.STRING, description: 'Approximate Longitude' },
      description: { type: Type.STRING, description: 'Short one-line tactical description of the area' }
    },
    required: ['name', 'lat', 'lon', 'description']
  }
};

const renderStockTool: FunctionDeclaration = {
  name: 'render_stock_card',
  description: 'Display a financial market data card.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      symbol: { type: Type.STRING, description: 'Stock/Crypto Ticker (e.g. AAPL, BTC)' },
      price: { type: Type.STRING, description: 'Current price' },
      change: { type: Type.STRING, description: 'Percentage change' },
      trend: { type: Type.STRING, enum: ['up', 'down', 'neutral'], description: 'Market trend direction' }
    },
    required: ['symbol', 'price', 'change', 'trend']
  }
};

const renderInfoTool: FunctionDeclaration = {
  name: 'render_info_card',
  description: 'Display a general knowledge or definition card.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Title of the topic' },
      fact: { type: Type.STRING, description: 'A key summary fact (max 15 words)' },
      category: { type: Type.STRING, description: 'Category (e.g., HISTORY, SCIENCE, BIO)' }
    },
    required: ['title', 'fact', 'category']
  }
};

export type WidgetData = 
  | { type: 'weather'; data: { location: string; temperature: string; condition: string } }
  | { type: 'map'; data: { name: string; lat: string; lon: string; description: string } }
  | { type: 'stock'; data: { symbol: string; price: string; change: string; trend: 'up'|'down'|'neutral' } }
  | { type: 'info'; data: { title: string; fact: string; category: string } };

interface LiveServiceCallbacks {
  onStatusChange: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  onTranscription: (type: 'user' | 'model', text: string, final: boolean) => void;
  onAudioLevel: (level: number) => void;
  onWidgetUpdate: (widget: WidgetData | null) => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private nextStartTime: number = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private callbacks: LiveServiceCallbacks;
  private frameInterval: number | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private isVideoActive: boolean = false;
  private isConnected: boolean = false;
  private mode: 'assistant' | 'translator' = 'assistant';
  private isAudioMuted: boolean = false;
  private isSystemAudio: boolean = false; // Flag for system audio source

  // Reconnection Logic State
  private isIntentionalDisconnect: boolean = false;
  private reconnectTimeout: number | null = null;
  private currentStream: MediaStream | null = null;
  private currentSystemInstruction: string = '';
  
  // VAD State
  private silenceFrameCount: number = 0;

  constructor(callbacks: LiveServiceCallbacks) {
    this.callbacks = callbacks;
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Global Network Recovery Listener
    // If the internet comes back and we were supposed to be connected, reconnect immediately.
    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
            console.log('Network online detected. Checking connection status...');
            if (!this.isIntentionalDisconnect && this.currentStream && (!this.isConnected || this.reconnectTimeout)) {
                console.log('Restoring connection automatically...');
                this.handleConnectionLoss();
            }
        });
    }
  }

  setVideoActive(active: boolean) {
    this.isVideoActive = active;
  }

  setMode(mode: 'assistant' | 'translator') {
      this.mode = mode;
  }

  setMuted(muted: boolean) {
      this.isAudioMuted = muted;
      if (muted) {
          this.activeSources.forEach(s => { try { s.stop(); } catch(e) {} });
          this.activeSources.clear();
      }
  }

  async connect(stream: MediaStream, videoEl: HTMLVideoElement, systemInstruction: string, isSystemAudio: boolean = false) {
    this.isIntentionalDisconnect = false;
    this.currentStream = stream;
    this.videoElement = videoEl;
    this.currentSystemInstruction = systemInstruction;
    this.isSystemAudio = isSystemAudio;

    if (this.reconnectTimeout) {
        window.clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
    }

    // Ensure we start with a clean slate
    await this.cleanupResources();

    this.callbacks.onStatusChange('connecting');
    this.isConnected = true; 
    
    try {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      this.outputNode = this.outputAudioContext.createGain();
      this.analyser = this.outputAudioContext.createAnalyser();
      this.outputNode.connect(this.analyser);
      this.analyser.connect(this.outputAudioContext.destination);

      this.startAudioLevelLoop();
      this.startVideoFrameLoop();

      // OPTIMIZATION: Only use tools in Assistant mode.
      let tools: Tool[] | undefined = undefined;
      
      if (this.mode === 'assistant') {
          tools = [
            { googleSearch: {} },
            { functionDeclarations: [renderWeatherTool, renderMapTool, renderStockTool, renderInfoTool] }
          ];
      }

      console.log(`Connecting in ${this.mode.toUpperCase()} mode. Tools active: ${!!tools}`);

      this.sessionPromise = this.ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
          },
          systemInstruction: systemInstruction,
          tools: tools,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Session Opened');
            this.callbacks.onStatusChange('connected');
            this.setupAudioInput(stream);
          },
          onmessage: this.handleMessage.bind(this),
          onclose: () => {
            console.log('Gemini Live Session Closed');
            // If it wasn't the user who clicked Stop, assume it's a drop or timeout and reconnect.
            if (!this.isIntentionalDisconnect) {
                this.handleConnectionLoss();
            } else {
                this.cleanupResources();
            }
          },
          onerror: (err) => {
            // Log but don't panic. Most "errors" in live streaming are recoverable by restarting.
            console.warn('Gemini Live Stream Interruption:', err);
            
            if (!this.isIntentionalDisconnect) {
                // Aggressively attempt to reconnect instead of showing error state
                this.handleConnectionLoss();
            } else {
                this.callbacks.onStatusChange('error');
                this.cleanupResources();
            }
          },
        },
      });
    } catch (error) {
      console.error('Connection setup failed', error);
      if (!this.isIntentionalDisconnect) {
          this.handleConnectionLoss();
      } else {
          this.cleanupResources();
          this.callbacks.onStatusChange('error');
      }
    }
  }

  private handleConnectionLoss() {
      // Prevent multiple timeouts stacking up
      if (this.reconnectTimeout) return;
      
      console.log('Connection interrupted. Initiating auto-reconnect sequence...');
      
      // Update status to connecting so the UI shows the spinner, not the "Start" button
      this.callbacks.onStatusChange('connecting'); 
      
      this.cleanupResources();
      
      // Fast Retry (1 second) to minimize downtime
      this.reconnectTimeout = window.setTimeout(() => {
          this.reconnectTimeout = null;
          // Double check intent before firing
          if (!this.isIntentionalDisconnect && this.currentStream && this.videoElement) {
              console.log('Reconnecting now...');
              this.connect(this.currentStream, this.videoElement, this.currentSystemInstruction, this.isSystemAudio);
          }
      }, 1000);
  }

  private setupAudioInput(stream: MediaStream) {
    if (!this.inputAudioContext) return;
    try {
      this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
      
      // LATENCY OPTIMIZATION: Reduced buffer size to 1024 (approx 64ms at 16kHz)
      this.processor = this.inputAudioContext.createScriptProcessor(1024, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        if (!this.isConnected) return;

        // Turn-Taking Logic
        if (!this.isSystemAudio && this.mode === 'assistant' && this.activeSources.size > 0) {
            return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        let shouldSend = false;

        // BYPASS VAD in Translator Mode for instant transmission
        if (this.isSystemAudio || this.mode === 'translator') {
            shouldSend = true;
        } else {
             // VAD for Assistant Mode
             let sumSquares = 0;
             for (let i = 0; i < inputData.length; i++) {
                 sumSquares += inputData[i] * inputData[i];
             }
             const rms = Math.sqrt(sumSquares / inputData.length);
             
             if (rms > NOISE_THRESHOLD) {
                 this.silenceFrameCount = 0;
                 shouldSend = true;
             } else {
                 this.silenceFrameCount++;
                 if (this.silenceFrameCount <= SILENCE_HANGOVER_FRAMES) {
                     shouldSend = true;
                 }
             }
        }

        if (!shouldSend) {
            return; 
        }

        const blob = createPcmBlob(inputData);
        this.sessionPromise?.then((session) => {
           if (!this.isConnected) return;
           try {
             const res = session.sendRealtimeInput({ media: blob });
             if (res && typeof res.catch === 'function') {
                res.catch(() => {});
             }
           } catch (err) {
             // Ignore synchronous errors during transmission
           }
        }).catch(() => {});
      };
      
      this.inputSource.connect(this.processor);
      this.processor.connect(this.inputAudioContext.destination);
    } catch (e) {
      console.error("Error setting up audio input", e);
    }
  }

  private startVideoFrameLoop() {
    this.canvasElement = document.createElement('canvas');
    const ctx = this.canvasElement.getContext('2d');
    if (this.frameInterval) clearInterval(this.frameInterval);
    this.frameInterval = window.setInterval(async () => {
      if (!this.videoElement || !this.canvasElement || !ctx || !this.sessionPromise || !this.isVideoActive || !this.isConnected) return;
      try {
        if (this.videoElement.videoWidth === 0) return;
        this.canvasElement.width = this.videoElement.videoWidth / 4; 
        this.canvasElement.height = this.videoElement.videoHeight / 4;
        ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
        this.canvasElement.toBlob(async (blob) => {
          if (blob && this.isConnected) {
            const base64Data = await blobToBase64(blob);
            this.sessionPromise?.then((session) => {
                if (!this.isConnected) return;
                try {
                    const res = session.sendRealtimeInput({
                      media: { data: base64Data, mimeType: 'image/jpeg' }
                    });
                    if (res && typeof res.catch === 'function') {
                        res.catch(() => {});
                    }
                } catch(err) {}
            }).catch(() => {});
          }
        }, 'image/jpeg', JPEG_QUALITY);
      } catch (e) {
        // Silently ignore video frame errors
      }
    }, 1000 / FRAME_RATE);
  }

  private async handleMessage(message: LiveServerMessage) {
    if (!this.isConnected) return;

    if (message.serverContent?.inputTranscription) {
      this.callbacks.onTranscription('user', message.serverContent.inputTranscription.text, false);
    }
    if (message.serverContent?.outputTranscription) {
      this.callbacks.onTranscription('model', message.serverContent.outputTranscription.text, false);
    }

    if (message.toolCall) {
      for (const fc of message.toolCall.functionCalls) {
        let success = false;
        if (fc.name === 'render_weather_widget') {
             this.callbacks.onWidgetUpdate({ type: 'weather', data: fc.args as any });
             success = true;
        } else if (fc.name === 'render_map_location') {
             this.callbacks.onWidgetUpdate({ type: 'map', data: fc.args as any });
             success = true;
        } else if (fc.name === 'render_stock_card') {
             this.callbacks.onWidgetUpdate({ type: 'stock', data: fc.args as any });
             success = true;
        } else if (fc.name === 'render_info_card') {
             this.callbacks.onWidgetUpdate({ type: 'info', data: fc.args as any });
             success = true;
        }

        if (success) {
            this.sessionPromise?.then(session => {
                if (!this.isConnected) return;
                session.sendToolResponse({
                    functionResponses: [{
                        id: fc.id,
                        name: fc.name,
                        response: { result: 'Widget Rendered' }
                    }]
                });
            }).catch(() => {});
        }
      }
    }
    
    if (message.serverContent?.interrupted) {
      this.activeSources.forEach(source => { try { source.stop(); } catch (e) {} });
      this.activeSources.clear();
      this.nextStartTime = 0;
    }

    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    
    if (this.isAudioMuted) {
        return;
    }

    if (base64Audio && this.outputAudioContext && this.outputNode) {
      try {
        const audioBytes = base64ToUint8Array(base64Audio);
        const audioBuffer = await decodeAudioData(audioBytes, this.outputAudioContext);
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode);
        
        // Only block input in ASSISTANT mode. 
        // In Translator mode, we want Full Duplex (speak and listen at same time)
        if (this.mode === 'assistant') {
            this.activeSources.add(source);
            source.addEventListener('ended', () => { 
                this.activeSources.delete(source); 
            });
        }
        
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
      } catch (e) {
        console.error("Error decoding/playing audio", e);
      }
    }
  }

  // ... (rest of class remains same) ...

  private startAudioLevelLoop() {
    const updateLevel = () => {
      if (!this.isConnected) return;
      if (this.analyser) {
        const array = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(array);
        let sum = 0;
        for (let i = 0; i < array.length; i++) sum += array[i];
        this.callbacks.onAudioLevel((sum / array.length) / 255); 
      }
      requestAnimationFrame(updateLevel);
    };
    updateLevel();
  }

  async disconnect() {
    console.log("Terminating session by user command.");
    this.isIntentionalDisconnect = true;
    
    if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
    }
    await this.cleanupResources();
    this.callbacks.onStatusChange('disconnected');
  }

  private async cleanupResources() {
    this.isConnected = false;
    this.sessionPromise = null; // Important: Clear the promise reference
    
    try {
      this.inputSource?.disconnect();
      this.processor?.disconnect();
    } catch (e) {}
    this.inputSource = null;
    this.processor = null;
    
    const inCtx = this.inputAudioContext;
    this.inputAudioContext = null;
    if (inCtx && inCtx.state !== 'closed') try { await inCtx.close(); } catch (e) {}

    const outCtx = this.outputAudioContext;
    this.outputAudioContext = null;
    if (outCtx && outCtx.state !== 'closed') try { await outCtx.close(); } catch (e) {}
    
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }
    this.activeSources.forEach(s => { try { s.stop(); } catch (e) {} });
    this.activeSources.clear();
    this.nextStartTime = 0;
  }
}