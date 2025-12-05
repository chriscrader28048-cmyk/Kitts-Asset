import React, { useRef, useState, useCallback, useEffect } from 'react';
import ArInterface from './components/ArInterface';
import { GeminiLiveService, WidgetData } from './services/geminiLive';
import { GoogleGenAI } from "@google/genai";

type Status = 'disconnected' | 'connecting' | 'connected' | 'error';
type Transcription = { type: 'user' | 'model'; text: string; isFinal?: boolean };

// Pool Item for Translator Mode
export type TranslationItem = {
    id: number;
    sourceText: string;
    targetText: string;
    isSourceComplete: boolean;
    isTargetComplete: boolean;
    isCloudTranslated: boolean; // Flag to track if sent to Flash API
    timestamp: number;
};

const App: React.FC = () => {
  const [status, setStatus] = useState<Status>('disconnected');
  
  // Standard Transcription (Assistant Mode)
  const [transcription, setTranscription] = useState<Transcription[]>([]);
  
  // Translation Pool (Translator Mode)
  const [translationPool, setTranslationPool] = useState<TranslationItem[]>([]);
  
  const [audioLevel, setAudioLevel] = useState(0);
  const [isCameraOn, setIsCameraOn] = useState(false);
  
  // Widget State
  const [activeWidget, setActiveWidget] = useState<WidgetData | null>(null);
  
  // Config State
  const [mode, setMode] = useState<'assistant' | 'translator'>('assistant');
  const [sourceLang, setSourceLang] = useState('Auto');
  const [targetLang, setTargetLang] = useState('Vietnamese');
  const [isProfessionalMode, setIsProfessionalMode] = useState(false);
  const [isCloudTranslationEnabled, setIsCloudTranslationEnabled] = useState(true); // Default to true for better quality
  const [isMuted, setIsMuted] = useState(false);
  const [isSystemAudioMode, setIsSystemAudioMode] = useState(false);
  const [isFunMode, setIsFunMode] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(true); // True = Always listen, False = Wake Word
  const [isAwake, setIsAwake] = useState(true); // Internal state for wake word mode

  // Visual State
  const [theme, setTheme] = useState<'cyber' | 'matrix' | 'warning' | 'neon'>('cyber');
  const [bgStyle, setBgStyle] = useState<'grid' | 'horizon' | 'orbital' | 'hex'>('horizon');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const genAI = useRef(new GoogleGenAI({ apiKey: process.env.API_KEY }));
  const lastInteractionRef = useRef<number>(Date.now());

  // Wake Word & Sleep Timer Logic
  useEffect(() => {
      // If we are in Free Mode, we are always awake.
      if (isFreeMode) {
          setIsAwake(true);
          return;
      }

      // If we are in Standard Mode (Wake Word) and currently awake, check timer.
      const timer = setInterval(() => {
          if (isAwake && Date.now() - lastInteractionRef.current > 30000) {
              console.log("Idle timeout reached. Going to sleep.");
              setIsAwake(false);
          }
      }, 1000);

      return () => clearInterval(timer);
  }, [isFreeMode, isAwake]);

  // Sync Awake state with Service to gate audio output
  useEffect(() => {
      if (serviceRef.current) {
          // If Free Mode -> Output Active.
          // If Standard Mode -> Output Active only if Awake.
          const shouldOutputAudio = isFreeMode || isAwake;
          serviceRef.current.setAudioOutputActive(shouldOutputAudio);
      }
  }, [isFreeMode, isAwake]);


  // Initialize service on mount
  useEffect(() => {
    serviceRef.current = new GeminiLiveService({
      onStatusChange: (s) => setStatus(s),
      onAudioLevel: (l) => setAudioLevel(l),
      onWidgetUpdate: (data) => {
        setActiveWidget(data);
        if (data) {
            setTimeout(() => setActiveWidget(null), 20000);
        }
      },
      onTranscription: (type, text, isFinal) => {
        lastInteractionRef.current = Date.now(); // Update activity on any transcription

        // --- WAKE WORD DETECTION ---
        if (mode === 'assistant' && !isFreeMode && !isAwake && type === 'user') {
            const lowerText = text.toLowerCase();
            const keywords = ['hey kitts', 'hey kids', 'hey mỡ', 'mỡ ơi', 'hello kitts', 'hi kitts'];
            
            if (keywords.some(k => lowerText.includes(k))) {
                console.log("Wake word detected!");
                setIsAwake(true);
                // We add a system message to indicate wake up
                setTranscription(prev => [...prev, { type: 'model', text: '👀 I am listening...' }]);
            }
        }

        // --- TRANSLATOR MODE LOGIC (THE POOL) ---
        if (mode === 'translator') {
            setTranslationPool(prev => {
                const pool = [...prev];
                const terminators = ['.', '?', '!', '。', '？', '！'];
                
                if (type === 'user') {
                    let currentIdx = pool.findIndex(item => !item.isSourceComplete);
                    
                    if (currentIdx === -1) {
                        const newItem: TranslationItem = {
                            id: Date.now(),
                            sourceText: text,
                            targetText: '',
                            isSourceComplete: false,
                            isTargetComplete: false,
                            isCloudTranslated: false,
                            timestamp: Date.now()
                        };
                        const lastChar = text.trim().slice(-1);
                        if (terminators.includes(lastChar)) {
                            newItem.isSourceComplete = true;
                        }
                        return [...pool, newItem];
                    } else {
                        const item = { ...pool[currentIdx] };
                        item.sourceText += text;
                        const lastChar = item.sourceText.trim().slice(-1);
                        if (terminators.includes(lastChar)) {
                            item.isSourceComplete = true;
                        }
                        pool[currentIdx] = item;
                        return pool;
                    }
                } 
                else if (type === 'model') {
                    let targetIdx = pool.findIndex(item => !item.isTargetComplete);
                    if (targetIdx === -1) {
                         if (pool.length > 0) targetIdx = pool.length - 1;
                         else return pool; 
                    }
                    if (!pool[targetIdx].isCloudTranslated) {
                        const item = { ...pool[targetIdx] };
                        item.targetText += text;
                        pool[targetIdx] = item;
                    }
                    return pool;
                }
                return pool;
            });
            setTranscription(prev => [...prev, { type, text }]);
            return;
        }

        // --- ASSISTANT MODE LOGIC (LINEAR) ---
        setTranscription(prev => {
          if (prev.length > 0 && prev[prev.length - 1].type === type) {
            const lastMsg = prev[prev.length - 1];
            const terminators = ['.', '?', '!', '。', '？', '！'];
            const lastChar = lastMsg.text.trim().slice(-1);
            
            if (terminators.includes(lastChar)) {
                 return [...prev, { type, text }];
            }
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = {
              ...lastMsg,
              text: lastMsg.text + text
            };
            return newHistory;
          }
          return [...prev, { type, text }];
        });
      }
    });

    return () => {
      serviceRef.current?.disconnect();
    };
  }, [mode, isFreeMode, isAwake]); // Add isFreeMode, isAwake to dependency array

  // --- HYBRID CLOUD TRANSLATION EFFECT ---
  useEffect(() => {
    if (mode !== 'translator' || !isCloudTranslationEnabled) return;

    const processTranslation = async (item: TranslationItem) => {
        try {
            setTranslationPool(prev => prev.map(p => 
                p.id === item.id ? { ...p, isCloudTranslated: true } : p
            ));

            const prompt = `Translate the following ${sourceLang === 'Auto' ? 'text' : sourceLang} to ${targetLang}. 
            Output ONLY the translation. No notes.
            Text: "${item.sourceText}"`;

            const response = await genAI.current.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });

            const translatedText = response.text;

            if (translatedText) {
                setTranslationPool(prev => prev.map(p => 
                    p.id === item.id ? { 
                        ...p, 
                        targetText: translatedText.trim(), // Replace live preview with high-quality text
                        isTargetComplete: true,
                        isCloudTranslated: true
                    } : p
                ));
            }
        } catch (error) {
            console.error("Cloud translation failed", error);
        }
    };

    translationPool.forEach(item => {
        if (item.isSourceComplete && !item.isCloudTranslated && item.sourceText.trim().length > 1) {
            processTranslation(item);
        }
    });

  }, [translationPool, mode, isCloudTranslationEnabled, sourceLang, targetLang]);


  // Sync mode with service for logic handling
  useEffect(() => {
    if (serviceRef.current) {
        serviceRef.current.setMode(mode);
    }
  }, [mode]);

  useEffect(() => {
      if (serviceRef.current) {
          serviceRef.current.setMuted(isMuted);
      }
  }, [isMuted]);

  // Manage Camera Stream (Video Only)
  useEffect(() => {
    let localVideoStream: MediaStream | null = null;

    const manageCamera = async () => {
      if (isCameraOn) {
        try {
          localVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = localVideoStream;
          }
          serviceRef.current?.setVideoActive(true);
        } catch (e) {
          console.error("Camera access denied or failed", e);
          setIsCameraOn(false);
        }
      } else {
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }
        serviceRef.current?.setVideoActive(false);
      }
    };

    manageCamera();

    return () => {
      if (localVideoStream) {
        localVideoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOn]);

  const handleToggleCamera = useCallback(() => {
    setIsCameraOn(prev => !prev);
  }, []);

  const handleToggleMute = useCallback(() => {
      setIsMuted(prev => !prev);
  }, []);

  const handleClear = useCallback(() => {
      setTranscription([]);
      setTranslationPool([]);
  }, []);

  const handleDownload = useCallback(() => {
      let content = "";
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let filename = `kitts-log-${timestamp}.txt`;

      if (mode === 'translator') {
          content = translationPool.map(item => {
              return `[SOURCE]: ${item.sourceText}\n[TARGET]: ${item.targetText}\n-------------------`;
          }).join('\n\n');
          filename = `kitts-translation-${timestamp}.txt`;
      } else {
          content = transcription.map(item => {
              return `[${item.type.toUpperCase()}]: ${item.text}`;
          }).join('\n\n');
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  }, [mode, transcription, translationPool]);

  const getSystemInstruction = () => {
      const source = sourceLang === 'Auto' ? 'any language' : sourceLang;
      
      if (mode === 'translator') {
          return `ROLE: REAL-TIME SIMULTANEOUS INTERPRETER.
MODE: LOW_LATENCY_STREAMING.

TASK:
1. Listen to [${source}].
2. Output [${targetLang}] translation INSTANTLY.
3. DO NOT BUFFER. DO NOT WAIT for full sentences.
4. Translate phrase-by-phrase (Stream of consciousness).
5. IGNORE all non-speech noise.
6. OUTPUT ONLY TRANSLATED TEXT.
`;
      } else {
          // Assistant Mode
          let basePersona = `You are Kitts, an advanced AR HUD assistant. 
          Your interface is a futuristic heads-up display. 
          You have access to REAL-TIME tools via Google Search.
          
          VISUAL CAPABILITIES:
          1. LOCATIONS: Use 'render_map_location'.
          2. WEATHER: Use 'render_weather_widget'.
          3. STOCKS: Use 'render_stock_card'.
          4. FACTS: Use 'render_info_card'.`;

          if (isFunMode) {
            basePersona = `You are Kitts, a CHAOTIC GOOD, HILARIOUS and WITTY AR assistant.
            Your interface is a futuristic heads-up display.
            
            PERSONALITY:
            - Be sarcastic, funny, and entertaining.
            - Make jokes about the user's questions.
            - Still provide helpful information but with a comedic twist.
            
            VISUAL CAPABILITIES (Still use these tools):
            1. LOCATIONS: Use 'render_map_location'.
            2. WEATHER: Use 'render_weather_widget'.
            3. STOCKS: Use 'render_stock_card'.
            4. FACTS: Use 'render_info_card'.`;
          }

          // Add Wake Word Instruction context for the model
          if (!isFreeMode) {
              return `${basePersona}
              
              WAKE WORD PROTOCOL:
              - You have a name: "Kitts" or "Mỡ".
              - If the user says "Hey Kitts", "Hey Mỡ", or "Mỡ ơi", acknowledge it enthusiastically.
              - Once engaged, continue the conversation normally.
              `;
          }

          return basePersona;
      }
  };

  const restartSession = () => {
    if (status === 'connected' && serviceRef.current && audioStreamRef.current && videoRef.current) {
        const newInstruction = getSystemInstruction();
        // Reset pools on mode switch/config apply
        if (mode === 'translator') {
            setTranslationPool([]);
        } else {
            setTranscription([]);
        }
        setTranscription(prev => [...prev, { type: 'model', text: `[SYSTEM: RECONFIGURING...]` }]);
        
        // IMPORTANT: Set mode before reconnecting to ensure tools are disabled/enabled correctly
        serviceRef.current.setMode(mode);
        serviceRef.current.connect(audioStreamRef.current, videoRef.current, newInstruction, isSystemAudioMode);
    }
  };

  useEffect(() => {
     if (status === 'connected') {
         restartSession();
     }
  }, [mode, isProfessionalMode, isFunMode, isFreeMode, sourceLang, targetLang]);

  const handleApplyConfig = useCallback(() => {
     restartSession();
  }, [status, mode, sourceLang, targetLang, isProfessionalMode, isFunMode, isFreeMode]);

  const handleConnect = useCallback(async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = audioStream;

      const instruction = getSystemInstruction();
      setIsSystemAudioMode(false);
      
      // Ensure mode is set before connecting
      serviceRef.current?.setMode(mode);
      serviceRef.current?.connect(audioStream, videoRef.current!, instruction, false);
      serviceRef.current?.setVideoActive(isCameraOn);
      serviceRef.current?.setMuted(isMuted);
      
      setTranscription([]);
      setTranslationPool([]);
    } catch (e) {
      console.error("Microphone access denied or failed", e);
      alert("Microphone access is required to initiate Kitts.");
    }
  }, [isCameraOn, mode, sourceLang, targetLang, isProfessionalMode, isFunMode, isFreeMode, isMuted]);

  const handleConnectSystemAudio = useCallback(async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1, height: 1 }, 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 16000
            } as any
        });

        if (stream.getAudioTracks().length === 0) {
            alert("NO AUDIO DETECTED. Please ensure you checked 'Share tab audio' or 'Share system audio'.");
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        audioStreamRef.current = stream;
        const instruction = getSystemInstruction();
        setIsSystemAudioMode(true);
        
        serviceRef.current?.setMode(mode);
        serviceRef.current?.connect(stream, videoRef.current!, instruction, true);
        serviceRef.current?.setVideoActive(isCameraOn);
        serviceRef.current?.setMuted(isMuted);

        setTranscription([]);
        setTranslationPool([]);

        stream.getVideoTracks()[0].onended = () => {
            handleDisconnect();
        };

    } catch (e: any) {
        console.error("System audio access denied", e);
        if (e.name === 'NotAllowedError') {
             alert("Permission denied.");
        } else {
             alert("Could not access system audio.");
        }
    }
  }, [isCameraOn, mode, sourceLang, targetLang, isProfessionalMode, isFunMode, isFreeMode, isMuted]);

  const handleDisconnect = useCallback(() => {
    serviceRef.current?.disconnect();
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
  }, []);

  return (
    <ArInterface
      status={status}
      onConnect={handleConnect}
      onConnectSystem={handleConnectSystemAudio}
      onDisconnect={handleDisconnect}
      videoRef={videoRef}
      transcription={transcription}
      translationPool={translationPool}
      audioLevel={audioLevel}
      isCameraOn={isCameraOn}
      onToggleCamera={handleToggleCamera}
      mode={mode} setMode={setMode}
      sourceLang={sourceLang} setSourceLang={setSourceLang}
      targetLang={targetLang} setTargetLang={setTargetLang}
      isProfessionalMode={isProfessionalMode} setIsProfessionalMode={setIsProfessionalMode}
      isCloudTranslationEnabled={isCloudTranslationEnabled} setIsCloudTranslationEnabled={setIsCloudTranslationEnabled}
      onApplyConfig={handleApplyConfig}
      isFunMode={isFunMode} setIsFunMode={setIsFunMode}
      isFreeMode={isFreeMode} setIsFreeMode={setIsFreeMode}
      isAwake={isAwake}
      theme={theme} setTheme={setTheme}
      bgStyle={bgStyle} setBgStyle={setBgStyle}
      activeWidget={activeWidget}
      isMuted={isMuted}
      onToggleMute={handleToggleMute}
      onClear={handleClear}
      onDownload={handleDownload}
    />
  );
};

export default App;