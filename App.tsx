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
  const [isCloudTranslationEnabled, setIsCloudTranslationEnabled] = useState(true); 
  const [isMuted, setIsMuted] = useState(false);
  const [isSystemAudioMode, setIsSystemAudioMode] = useState(false);
  const [isFunMode, setIsFunMode] = useState(false);
  const [isFreeMode, setIsFreeMode] = useState(true); 
  const [isAwake, setIsAwake] = useState(true);
  
  // Voice Config
  const [voice, setVoice] = useState('Fenrir');

  // Visual State
  const [theme, setTheme] = useState<'cyber' | 'matrix' | 'warning' | 'neon'>('cyber');
  const [bgStyle, setBgStyle] = useState<'grid' | 'horizon' | 'orbital' | 'hex'>('horizon');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const serviceRef = useRef<GeminiLiveService | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const genAI = useRef(new GoogleGenAI({ apiKey: process.env.API_KEY }));
  const lastInteractionRef = useRef<number>(Date.now());
  const translationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wake Word & Sleep Timer Logic
  useEffect(() => {
      if (isFreeMode) {
          setIsAwake(true);
          return;
      }
      const timer = setInterval(() => {
          if (isAwake && Date.now() - lastInteractionRef.current > 30000) {
              console.log("Idle timeout reached. Going to sleep.");
              setIsAwake(false);
          }
      }, 1000);
      return () => clearInterval(timer);
  }, [isFreeMode, isAwake]);

  useEffect(() => {
      if (serviceRef.current) {
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
        if (data) setTimeout(() => setActiveWidget(null), 20000);
      },
      onTranscription: (type, text, isFinal) => {
        lastInteractionRef.current = Date.now();

        if (!text || text.trim() === '') return;

        // --- WAKE WORD DETECTION ---
        if (mode === 'assistant' && !isFreeMode && !isAwake && type === 'user') {
            const lowerText = text.toLowerCase();
            const keywords = ['hey kitts', 'hey kids', 'hey mỡ', 'mỡ ơi', 'hello kitts', 'hi kitts'];
            if (keywords.some(k => lowerText.includes(k))) {
                console.log("Wake word detected!");
                setIsAwake(true);
                setTranscription(prev => [...prev, { type: 'model', text: '👀 I am listening...' }]);
            }
        }

        // --- TRANSLATOR MODE LOGIC ---
        if (mode === 'translator') {
            // Auto-Finalize Timeout: If user stops speaking for 1.5s, mark line as complete
            if (type === 'user') {
                if (translationTimeoutRef.current) clearTimeout(translationTimeoutRef.current);
                translationTimeoutRef.current = setTimeout(() => {
                    setTranslationPool(prev => {
                        if (prev.length === 0) return prev;
                        const lastIdx = prev.length - 1;
                        if (!prev[lastIdx].isSourceComplete) {
                            const newPool = [...prev];
                            newPool[lastIdx] = { ...newPool[lastIdx], isSourceComplete: true };
                            return newPool;
                        }
                        return prev;
                    });
                }, 1500);
            }

            setTranslationPool(prev => {
                const pool = [...prev];
                const terminators = ['.', '?', '!', '。', '？', '！'];
                
                if (type === 'user') {
                    // Find the current active item (not complete)
                    let currentIdx = pool.findIndex(item => !item.isSourceComplete);
                    
                    // If no active item, create one
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
                        // Append to active item
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
                    // Append AI translation to the first item that isn't fully translated
                    let targetIdx = pool.findIndex(item => !item.isTargetComplete);
                    
                    // Fallback: if all are marked complete but we get more audio, append to the very last one
                    if (targetIdx === -1) {
                         if (pool.length > 0) targetIdx = pool.length - 1;
                         else return pool; 
                    }

                    // Only update if we haven't already replaced it with the Cloud Flash API result
                    if (!pool[targetIdx].isCloudTranslated) {
                        const item = { ...pool[targetIdx] };
                        item.targetText += text;
                        pool[targetIdx] = item;
                    }
                    return pool;
                }
                return pool;
            });
            return;
        }

        // --- ASSISTANT MODE LOGIC ---
        setTranscription(prev => {
          if (prev.length > 0 && prev[prev.length - 1].type === type) {
            const lastMsg = prev[prev.length - 1];
            const terminators = ['.', '?', '!', '。', '？', '！'];
            const lastChar = lastMsg.text.trim().slice(-1);
            if (terminators.includes(lastChar)) {
                 return [...prev, { type, text }];
            }
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = { ...lastMsg, text: lastMsg.text + text };
            return newHistory;
          }
          return [...prev, { type, text }];
        });
      }
    });

    return () => {
      serviceRef.current?.disconnect();
      if (translationTimeoutRef.current) clearTimeout(translationTimeoutRef.current);
    };
  }, [mode, isFreeMode, isAwake]); 

  // --- HYBRID CLOUD TRANSLATION EFFECT ---
  useEffect(() => {
    if (mode !== 'translator' || !isCloudTranslationEnabled) return;
    const processTranslation = async (item: TranslationItem) => {
        try {
            // Mark as processing immediately to prevent double submission
            setTranslationPool(prev => prev.map(p => p.id === item.id ? { ...p, isCloudTranslated: true } : p));
            
            const prompt = `Translate this ${sourceLang === 'Auto' ? 'text' : sourceLang} to ${targetLang}. Output ONLY the translation. Text: "${item.sourceText}"`;
            const response = await genAI.current.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            const translatedText = response.text;
            if (translatedText) {
                setTranslationPool(prev => prev.map(p => 
                    p.id === item.id ? { ...p, targetText: translatedText.trim(), isTargetComplete: true, isCloudTranslated: true } : p
                ));
            }
        } catch (error) {}
    };
    
    // Scan pool for items that are source-complete (user stopped talking) but not yet cloud-translated
    translationPool.forEach(item => {
        if (item.isSourceComplete && !item.isCloudTranslated && item.sourceText.trim().length > 1) {
            processTranslation(item);
        }
    });
  }, [translationPool, mode, isCloudTranslationEnabled, sourceLang, targetLang]);


  useEffect(() => { if (serviceRef.current) serviceRef.current.setMode(mode); }, [mode]);
  useEffect(() => { if (serviceRef.current) serviceRef.current.setMuted(isMuted); }, [isMuted]);

  // Manage Camera Stream
  useEffect(() => {
    let localVideoStream: MediaStream | null = null;
    const manageCamera = async () => {
      if (isCameraOn) {
        try {
          localVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) videoRef.current.srcObject = localVideoStream;
          serviceRef.current?.setVideoActive(true);
        } catch (e) {
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
    return () => { if (localVideoStream) localVideoStream.getTracks().forEach(track => track.stop()); };
  }, [isCameraOn]);

  const handleToggleCamera = useCallback(() => setIsCameraOn(prev => !prev), []);
  const handleToggleMute = useCallback(() => setIsMuted(prev => !prev), []);
  const handleClear = useCallback(() => { setTranscription([]); setTranslationPool([]); }, []);

  const handleDownload = useCallback(() => {
      let content = "";
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      let filename = `kitts-log-${timestamp}.txt`;
      if (mode === 'translator') {
          content = translationPool.map(item => `[SOURCE]: ${item.sourceText}\n[TARGET]: ${item.targetText}\n-------------------`).join('\n\n');
          filename = `kitts-translation-${timestamp}.txt`;
      } else {
          content = transcription.map(item => `[${item.type.toUpperCase()}]: ${item.text}`).join('\n\n');
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
      if (mode === 'translator') {
          const source = sourceLang === 'Auto' ? 'any language' : sourceLang;
          // STRICT FILTERING PROMPT
          return `SYSTEM MODE: STRICT_INTERPRETER.
SOURCE_LANGUAGE: ${source}.
TARGET_LANGUAGE: ${targetLang}.

RULES:
1. LISTEN ONLY for ${source}.
2. IF input is ${source} -> TRANSLATE to ${targetLang} IMMEDIATELY.
3. IF input is background noise, music, or NOT ${source} -> OUTPUT NOTHING. SILENCE.
4. DO NOT transcribe or translate English conversation if Source is not English.
5. KEEP OUTPUT CONCISE. No explanations.`;
      } else {
          let basePersona = `You are Kitts, an advanced AR HUD assistant. REAL-TIME tools via Google Search available.
          VISUAL CAPABILITIES: Use 'render_map_location', 'render_weather_widget', 'render_stock_card', 'render_info_card' when appropriate.`;
          if (isFunMode) {
            basePersona = `You are Kitts, a CHAOTIC GOOD, HILARIOUS and WITTY AR assistant. Be sarcastic and funny. Use visual tools often.`;
          }
          if (!isFreeMode) {
              return `${basePersona}\nWAKE WORD PROTOCOL: Name is "Kitts" or "Mỡ". If heard "Hey Kitts" or "Mỡ ơi", acknowledge enthusiastically.`;
          }
          return basePersona;
      }
  };

  const restartSession = () => {
    if (status === 'connected' && serviceRef.current && audioStreamRef.current && videoRef.current) {
        const newInstruction = getSystemInstruction();
        
        // LOGIC FIX: Explicitly clear the state of the NEW mode to ensure clean slate
        if (mode === 'translator') {
            setTranslationPool([]);
            setTranscription([]); // Also clear transcription so assistant history doesn't linger visually
        } else {
            setTranscription([]);
            setTranslationPool([]); // Clear translator pool
        }
        
        setTranscription(prev => [...prev, { type: 'model', text: `[SYSTEM: RECONFIGURING TO ${mode.toUpperCase()} MODE...]` }]);
        
        serviceRef.current.setMode(mode);
        // Pass voice name
        serviceRef.current.connect(audioStreamRef.current, videoRef.current, newInstruction, isSystemAudioMode, voice);
    }
  };

  // Re-connect when critical config changes
  useEffect(() => {
     if (status === 'connected') {
         restartSession();
     }
  }, [mode, isProfessionalMode, isFunMode, isFreeMode, sourceLang, targetLang, voice]);

  const handleApplyConfig = useCallback(() => {
     restartSession();
  }, [status, mode, sourceLang, targetLang, isProfessionalMode, isFunMode, isFreeMode, voice]);

  const handleConnect = useCallback(async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = audioStream;
      const instruction = getSystemInstruction();
      setIsSystemAudioMode(false);
      
      serviceRef.current?.setMode(mode);
      serviceRef.current?.connect(audioStream, videoRef.current!, instruction, false, voice);
      serviceRef.current?.setVideoActive(isCameraOn);
      serviceRef.current?.setMuted(isMuted);
      
      setTranscription([]);
      setTranslationPool([]);
    } catch (e) {
      alert("Microphone access is required.");
    }
  }, [isCameraOn, mode, sourceLang, targetLang, isProfessionalMode, isFunMode, isFreeMode, isMuted, voice]);

  const handleConnectSystemAudio = useCallback(async () => {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1, height: 1 }, 
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 16000 } as any
        });
        if (stream.getAudioTracks().length === 0) {
            alert("NO AUDIO DETECTED. Check 'Share tab audio'.");
            stream.getTracks().forEach(t => t.stop());
            return;
        }
        audioStreamRef.current = stream;
        const instruction = getSystemInstruction();
        setIsSystemAudioMode(true);
        serviceRef.current?.setMode(mode);
        serviceRef.current?.connect(stream, videoRef.current!, instruction, true, voice);
        serviceRef.current?.setVideoActive(isCameraOn);
        serviceRef.current?.setMuted(isMuted);
        setTranscription([]);
        setTranslationPool([]);
        stream.getVideoTracks()[0].onended = () => handleDisconnect();
    } catch (e: any) {
        if (e.name !== 'NotAllowedError') alert("Could not access system audio.");
    }
  }, [isCameraOn, mode, sourceLang, targetLang, isProfessionalMode, isFunMode, isFreeMode, isMuted, voice]);

  const handleDisconnect = useCallback(() => {
    serviceRef.current?.disconnect();
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (translationTimeoutRef.current) clearTimeout(translationTimeoutRef.current);
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
      voice={voice} setVoice={setVoice}
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