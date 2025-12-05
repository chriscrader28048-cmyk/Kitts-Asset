import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, Video, VideoOff, Activity, Globe, MessageSquare, Settings, Languages, BrainCircuit, X, Monitor, Box, Check, Cpu, Zap, ChevronRight, ArrowRightLeft, Cloud, CloudLightning, CloudRain, Sun, CloudSnow, CloudFog, MapPin, TrendingUp, TrendingDown, Info, ScanLine, Target, Presentation, Type, Bold, Moon, Sun as SunIcon, Minimize2, Maximize2, Volume2, VolumeX, MonitorPlay, ArrowRight, Network, Download, Trash2, Smile } from 'lucide-react';
import { WidgetData } from '../services/geminiLive';
import { TranslationItem } from '../App';

interface ArInterfaceProps {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  onConnect: () => void;
  onConnectSystem: () => void;
  onDisconnect: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  transcription: { type: 'user' | 'model'; text: string; isFinal?: boolean }[];
  translationPool: TranslationItem[];
  audioLevel: number;
  isCameraOn: boolean;
  onToggleCamera: () => void;
  // Translation Config
  mode: 'assistant' | 'translator';
  setMode: (mode: 'assistant' | 'translator') => void;
  sourceLang: string;
  setSourceLang: (lang: string) => void;
  targetLang: string;
  setTargetLang: (lang: string) => void;
  isProfessionalMode: boolean;
  setIsProfessionalMode: (val: boolean) => void;
  isCloudTranslationEnabled: boolean;
  setIsCloudTranslationEnabled: (val: boolean) => void;
  onApplyConfig: () => void;
  // Assistant Config
  isFunMode: boolean;
  setIsFunMode: (val: boolean) => void;
  // Visual Config
  theme: 'cyber' | 'matrix' | 'warning' | 'neon';
  setTheme: (t: 'cyber' | 'matrix' | 'warning' | 'neon') => void;
  bgStyle: 'grid' | 'horizon' | 'orbital' | 'hex';
  setBgStyle: (s: 'grid' | 'horizon' | 'orbital' | 'hex') => void;
  // Widgets
  activeWidget: WidgetData | null;
  // Audio Config
  isMuted: boolean;
  onToggleMute: () => void;
  // Actions
  onClear: () => void;
  onDownload: () => void;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ru', name: 'Russian' },
  { code: 'it', name: 'Italian' },
];

const THEMES = {
    cyber: { name: 'Cyber', text: 'text-cyan-400', border: 'border-cyan-500/50', bg: 'bg-cyan-900/40', shadow: 'shadow-[0_0_10px_rgba(6,182,212,0.3)]' },
    matrix: { name: 'Matrix', text: 'text-green-400', border: 'border-green-500/50', bg: 'bg-green-900/40', shadow: 'shadow-[0_0_10px_rgba(74,222,128,0.3)]' },
    warning: { name: 'Warning', text: 'text-amber-400', border: 'border-amber-500/50', bg: 'bg-amber-900/40', shadow: 'shadow-[0_0_10px_rgba(251,191,36,0.3)]' },
    neon: { name: 'Neon', text: 'text-fuchsia-400', border: 'border-fuchsia-500/50', bg: 'bg-fuchsia-900/40', shadow: 'shadow-[0_0_10px_rgba(232,121,249,0.3)]' },
};

// --- Whiteboard / External Window Component ---
const WhiteboardWindow: React.FC<{ 
    transcription: { type: 'user' | 'model'; text: string }[], 
    targetLang: string,
    onClose: () => void 
}> = ({ transcription, targetLang, onClose }) => {
    const [fontSize, setFontSize] = useState(24);
    const [isBold, setIsBold] = useState(false);
    const [isDark, setIsDark] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcription]);

    const containerWindow = useMemo(() => {
        const win = window.open('', '', 'width=800,height=600,left=200,top=200');
        if (win) {
            // Copy styles from main window to popup
            Array.from(document.styleSheets).forEach(styleSheet => {
                try {
                    if (styleSheet.href) {
                        const newLink = win.document.createElement('link');
                        newLink.rel = 'stylesheet';
                        newLink.href = styleSheet.href;
                        win.document.head.appendChild(newLink);
                    } else if (styleSheet.cssRules) {
                        const newStyle = win.document.createElement('style');
                        Array.from(styleSheet.cssRules).forEach(rule => {
                            newStyle.appendChild(win.document.createTextNode(rule.cssText));
                        });
                        win.document.head.appendChild(newStyle);
                    }
                } catch (e) { console.error('Style copy error', e); }
            });
            
            // Add Tailwind CDN explicitly as backup
            const script = win.document.createElement('script');
            script.src = "https://cdn.tailwindcss.com";
            win.document.head.appendChild(script);

            // Add Font
            const fontLink = win.document.createElement('link');
            fontLink.href = "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap";
            fontLink.rel = "stylesheet";
            win.document.head.appendChild(fontLink);
            
            win.document.title = `KITTS Whiteboard - ${targetLang} Translation`;
            win.onbeforeunload = onClose;
            return win;
        }
        return null;
    }, []);

    useEffect(() => {
        return () => {
            containerWindow?.close();
        };
    }, [containerWindow]);

    if (!containerWindow) return null;

    return createPortal(
        <div className={`h-screen flex flex-col font-sans transition-colors duration-300 ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
            {/* Control Bar */}
            <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-100'} sticky top-0 z-50`}>
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold tracking-wider flex items-center gap-2">
                        <Presentation className="w-5 h-5 text-cyan-500" />
                        KITTS WHITEBOARD
                    </h1>
                    <span className={`text-xs px-2 py-1 rounded border ${isDark ? 'border-slate-600' : 'border-slate-300'}`}>
                        TARGET: {targetLang.toUpperCase()}
                    </span>
                </div>
                
                <div className="flex items-center gap-6">
                    {/* Font Size */}
                    <div className="flex items-center gap-2">
                        <Type className="w-4 h-4 opacity-50" />
                        <input 
                            type="range" 
                            min="16" 
                            max="64" 
                            value={fontSize} 
                            onChange={(e) => setFontSize(Number(e.target.value))}
                            className="w-32 accent-cyan-500"
                        />
                        <span className="text-xs w-8 text-center">{fontSize}px</span>
                    </div>

                    {/* Weight */}
                    <button 
                        onClick={() => setIsBold(!isBold)} 
                        className={`p-2 rounded hover:bg-black/10 transition-colors ${isBold ? 'bg-cyan-500 text-white' : ''}`}
                        title="Toggle Bold"
                    >
                        <Bold className="w-4 h-4" />
                    </button>

                    {/* Theme */}
                    <button 
                        onClick={() => setIsDark(!isDark)} 
                        className={`p-2 rounded hover:bg-black/10 transition-colors`}
                        title="Toggle Theme"
                    >
                        {isDark ? <SunIcon className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
                    </button>

                    <button 
                        onClick={() => { onClose(); containerWindow.close(); }} 
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-bold ml-4"
                    >
                        CLOSE
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-8 scroll-smooth"
            >
                {transcription.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30">
                        <MessageSquare className="w-24 h-24 mb-4" />
                        <p className="text-2xl">Waiting for audio...</p>
                    </div>
                )}
                <div className="max-w-6xl mx-auto space-y-6">
                    {transcription.filter(t => t.type === 'model').map((msg, idx) => (
                        <div key={idx} className={`animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                            <p 
                                style={{ fontSize: `${fontSize}px` }} 
                                className={`${isBold ? 'font-bold' : 'font-medium'} leading-relaxed whitespace-pre-wrap`}
                            >
                                {msg.text}
                            </p>
                        </div>
                    ))}
                    {/* Ghost element for spacing */}
                    <div className="h-32"></div>
                </div>
            </div>
        </div>,
        containerWindow.document.body
    );
};

const BackgroundLayer: React.FC<{ style: string, themeColor: string }> = ({ style, themeColor }) => {
    const colorMap: Record<string, string> = {
        'text-cyan-400': 'rgba(6, 182, 212, 0.2)',
        'text-green-400': 'rgba(74, 222, 128, 0.2)',
        'text-amber-400': 'rgba(251, 191, 36, 0.2)',
        'text-fuchsia-400': 'rgba(232, 121, 249, 0.2)',
    };
    const color = colorMap[themeColor] || 'rgba(6, 182, 212, 0.2)';

    return (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden text-current" style={{ color }}>
            {style === 'grid' && (
                <div className="absolute inset-0" 
                    style={{ 
                        backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
                        backgroundSize: '80px 80px'
                    }} 
                />
            )}
            
            {style === 'horizon' && (
                <div className="perspective-container w-full h-full">
                    <div className="absolute w-[200%] h-[200%] -left-[50%] -top-[50%] grid-3d grid-move" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                </div>
            )}

            {style === 'orbital' && (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <div className="w-[80vw] h-[80vw] border border-current rounded-full spin-slow border-dashed" />
                    <div className="absolute w-[60vw] h-[60vw] border border-current rounded-full spin-reverse-slow" />
                    <div className="absolute w-[40vw] h-[40vw] border border-current rounded-full spin-slow border-dotted" />
                </div>
            )}

            {style === 'hex' && (
                <div className="absolute inset-0 opacity-20"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='${encodeURIComponent(themeColor.includes('cyan') ? '#06b6d4' : themeColor.includes('green') ? '#4ade80' : themeColor.includes('amber') ? '#fbbf24' : '#e879f9')}' stroke-width='1'/%3E%3C/svg%3E")`,
                    }}
                />
            )}
        </div>
    );
};

// --- Widgets ---

const WeatherWidget: React.FC<{ data: any, theme: any }> = ({ data, theme }) => {
    const getIcon = () => {
        const c = data.condition.toLowerCase();
        if (c.includes('rain')) return <CloudRain className="w-16 h-16 text-blue-400 animate-bounce" />;
        if (c.includes('storm')) return <CloudLightning className="w-16 h-16 text-yellow-400 animate-pulse" />;
        if (c.includes('snow')) return <CloudSnow className="w-16 h-16 text-white animate-pulse" />;
        if (c.includes('fog')) return <CloudFog className="w-16 h-16 text-gray-400 animate-pulse" />;
        return <Sun className="w-16 h-16 text-yellow-500 spin-slow" />;
    };
    return (
        <div className={`absolute top-24 right-4 z-30 w-64 ${theme.bg} ${theme.border} border backdrop-blur-md rounded-xl p-4 shadow-2xl animate-in slide-in-from-right duration-700`}>
            <div className="flex items-center gap-4">
                <div className="relative">{getIcon()}</div>
                <div>
                    <div className="text-3xl font-bold text-white font-mono">{data.temperature}</div>
                    <div className={`text-sm uppercase ${theme.text}`}>{data.condition}</div>
                    <div className="text-xs text-white/60 flex items-center gap-1"><Globe className="w-3 h-3"/> {data.location}</div>
                </div>
            </div>
        </div>
    );
};

const MapWidget: React.FC<{ data: any, theme: any }> = ({ data, theme }) => {
    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none animate-in zoom-in duration-500">
            {/* Reticle */}
            <div className={`relative w-64 h-64 border-2 border-dashed rounded-full ${theme.text} animate-[spin_10s_linear_infinite] opacity-50 flex items-center justify-center`}>
                 <Target className="w-8 h-8 opacity-80" />
            </div>
            {/* Info Box */}
            <div className={`absolute top-0 right-[-140px] w-48 ${theme.bg} ${theme.border} border backdrop-blur-md rounded p-3`}>
                 <div className="flex items-center gap-2 mb-1">
                     <MapPin className={`w-4 h-4 ${theme.text} animate-bounce`} />
                     <span className="font-bold text-white text-sm">TARGET ACQUIRED</span>
                 </div>
                 <h3 className={`text-lg font-mono uppercase ${theme.text}`}>{data.name}</h3>
                 <div className="text-xs font-mono text-white/70 mb-2">LAT: {data.lat} <br/> LON: {data.lon}</div>
                 <div className="text-[10px] uppercase text-white/50 border-t border-white/10 pt-1">{data.description}</div>
            </div>
        </div>
    );
};

const StockWidget: React.FC<{ data: any, theme: any }> = ({ data, theme }) => {
    const isUp = data.trend === 'up';
    return (
        <div className={`absolute top-24 left-4 z-30 w-56 ${theme.bg} ${theme.border} border backdrop-blur-md rounded-xl p-4 shadow-2xl animate-in slide-in-from-left duration-700`}>
             <div className="flex justify-between items-start mb-2">
                 <span className={`text-xs font-mono uppercase opacity-70 ${theme.text}`}>MARKET DATA</span>
                 {isUp ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
             </div>
             <div className="text-2xl font-bold text-white tracking-widest">{data.symbol}</div>
             <div className="flex items-end gap-2">
                 <span className="text-xl font-mono">{data.price}</span>
                 <span className={`text-sm font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>{data.change}</span>
             </div>
             {/* Fake Graph */}
             <div className="flex items-end gap-1 h-8 mt-2 opacity-50">
                 {Array.from({length: 10}).map((_,i) => (
                     <div key={i} className={`w-full ${isUp ? 'bg-green-500' : 'bg-red-500'}`} style={{height: `${Math.random()*100}%`}}></div>
                 ))}
             </div>
        </div>
    );
};

const InfoWidget: React.FC<{ data: any, theme: any }> = ({ data, theme }) => {
    return (
        <div className={`absolute bottom-32 right-4 z-30 w-72 ${theme.bg} ${theme.border} border backdrop-blur-md rounded-tl-xl rounded-br-xl p-5 shadow-2xl animate-in fade-in slide-in-from-bottom duration-500`}>
             <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                 <ScanLine className={`w-4 h-4 ${theme.text} animate-pulse`} />
                 <span className={`text-xs font-bold tracking-widest ${theme.text}`}>{data.category}</span>
             </div>
             <h3 className="text-lg font-bold text-white mb-1 leading-none">{data.title}</h3>
             <p className="text-sm text-slate-300 leading-snug">{data.fact}</p>
             <div className={`absolute -left-1 top-4 w-1 h-8 ${theme.text.replace('text','bg')}`}></div>
        </div>
    );
};

const ArInterface: React.FC<ArInterfaceProps> = ({ 
  status, 
  onConnect, 
  onConnectSystem,
  onDisconnect, 
  videoRef, 
  transcription,
  translationPool,
  audioLevel,
  isCameraOn,
  onToggleCamera,
  mode, setMode,
  sourceLang, setSourceLang,
  targetLang, setTargetLang,
  isProfessionalMode, setIsProfessionalMode,
  isCloudTranslationEnabled, setIsCloudTranslationEnabled,
  onApplyConfig,
  isFunMode, setIsFunMode,
  theme, setTheme,
  bgStyle, setBgStyle,
  activeWidget,
  isMuted,
  onToggleMute,
  onClear,
  onDownload
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const t = THEMES[theme];
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcription, translationPool]);

  // HUD Data Simulation
  const [hudData, setHudData] = useState({ lat: '34.0522', lon: '-118.2437', alt: '120ft' });
  useEffect(() => {
    const interval = setInterval(() => {
        setHudData({
            lat: (34.0522 + (Math.random() - 0.5) * 0.001).toFixed(4),
            lon: (-118.2437 + (Math.random() - 0.5) * 0.001).toFixed(4),
            alt: (120 + Math.random() * 5).toFixed(0) + 'ft'
        });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleApply = () => {
      onApplyConfig();
      setShowSettings(false);
  };

  return (
    <div className={`relative w-full h-screen bg-black overflow-hidden flex flex-col font-rajdhani ${t.text}`}>
      
      {/* --- Whiteboard Portal --- */}
      {isWhiteboardOpen && (
          <WhiteboardWindow 
              transcription={transcription} 
              targetLang={targetLang}
              onClose={() => setIsWhiteboardOpen(false)}
          />
      )}

      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className={`absolute top-0 left-0 w-full h-full object-cover z-0 transition-opacity duration-500 ${isCameraOn ? 'opacity-50' : 'opacity-0'}`}
      />
      
      <BackgroundLayer style={bgStyle} themeColor={t.text} />
      
      {/* --- WIDGET LAYER --- */}
      {activeWidget?.type === 'weather' && <WeatherWidget data={activeWidget.data} theme={t} />}
      {activeWidget?.type === 'map' && <MapWidget data={activeWidget.data} theme={t} />}
      {activeWidget?.type === 'stock' && <StockWidget data={activeWidget.data} theme={t} />}
      {activeWidget?.type === 'info' && <InfoWidget data={activeWidget.data} theme={t} />}
      
      <div className={`scan-line z-10 ${t.text}`}></div>

      <div className={`relative z-20 w-full h-full mx-auto flex flex-col justify-between p-4 max-w-6xl`}>
        
        {/* HEADER AREA */}
        <div className="flex justify-between items-start pt-6 shrink-0">
            <div className={`hud-border bg-slate-900/80 backdrop-blur-sm p-4 rounded-br-3xl min-w-[150px] ${t.border}`}>
                <h1 className={`text-3xl font-bold tracking-widest ${t.text} leading-none`}>KITTS<span className="text-white text-xs align-top ml-1 opacity-50">AR V3.0</span></h1>
                <div className={`flex items-center gap-2 mt-2 font-mono text-xs opacity-80`}>
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span>SYS: {status.toUpperCase()}</span>
                </div>
                 <div className={`flex items-center gap-2 mt-1 font-mono text-xs opacity-80 text-white`}>
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <span>GEMINI CLOUD</span>
                </div>
            </div>

            <div className={`hud-border bg-slate-900/80 backdrop-blur-sm p-4 px-4 rounded-bl-3xl flex flex-col items-end ${t.border}`}>
                 <div className={`text-right font-mono text-xs mb-2 ${t.text}`}>
                    <div>ALT: {hudData.alt}</div>
                    <div className={!isCameraOn ? 'text-red-400' : ''}>CAM: {isCameraOn ? 'ON' : 'OFF'}</div>
                    <div className={mode === 'translator' ? 'text-white font-bold' : ''}>
                        MODE: {mode.toUpperCase()}
                    </div>
                 </div>
                 {mode === 'translator' && (
                     <div className={`flex items-center gap-2 font-mono text-white ${t.bg} px-2 py-1 rounded border ${t.border} text-xs`}>
                         <span className={t.text}>{sourceLang}</span>
                         <ArrowRightLeft className="w-4 h-4" />
                         <span className="text-white font-bold">{targetLang}</span>
                         {isProfessionalMode && <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                     </div>
                 )}
                 {mode === 'assistant' && isFunMode && (
                     <div className={`flex items-center gap-2 font-mono text-white bg-pink-500/20 px-2 py-1 rounded border border-pink-500 text-xs`}>
                         <Smile className="w-4 h-4 text-pink-400" />
                         <span className="text-pink-300 font-bold">FUN MODE</span>
                     </div>
                 )}
            </div>
        </div>

        {/* Center Reticle - Only show on desktop if enough space */}
        {activeWidget?.type !== 'map' && (
            <div className={`hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-500 ${isCameraOn ? 'opacity-40' : 'opacity-10'}`}>
                <div className={`w-[300px] h-[300px] border border-current rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite] opacity-30`}>
                    <div className="w-[280px] h-[280px] border-t border-b border-current rounded-full"></div>
                </div>
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 ${t.text.replace('text', 'bg')} rounded-full ${t.shadow}`}></div>
            </div>
        )}

        {/* MAIN CONTENT AREA */}
        <div className={`flex-1 flex flex-col justify-end lg:justify-center gap-6 w-full transition-all lg:pb-12`}>
            
            {/* Audio Visualizer */}
            <div className="flex items-center justify-center gap-1 h-8 shrink-0">
                {Array.from({ length: 20 }).map((_, i) => {
                    const distFromCenter = Math.abs(i - 10);
                    const isActive = status === 'connected' && !isMuted;
                    const height = isActive 
                        ? Math.max(4, (audioLevel * 100) * (1 - distFromCenter/15) + Math.random() * 10)
                        : 4;
                    
                    return (
                        <div key={i} className={`w-2 rounded-full transition-all duration-75 ${t.text.replace('text', 'bg')}/80`} style={{ height: `${height}px` }} />
                    );
                })}
            </div>

            {/* TRANSCRIPTION WINDOW */}
            <div className={`${isFullScreen ? 'fixed inset-4 md:inset-6 z-[100] bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl' : `relative bg-slate-900/60 backdrop-blur-md rounded-lg mb-2 h-[250px] lg:h-[450px]`} hud-border overflow-hidden flex flex-col transition-all duration-500 ${t.border}`}>
                 {/* Action Bar */}
                <div className="absolute top-2 right-2 z-20 flex gap-2">
                    <button 
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        className={`p-2 rounded hover:bg-white/10 transition-colors ${t.text} opacity-50 hover:opacity-100`}
                        title={isFullScreen ? "Minimize" : "Maximize"}
                    >
                        {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                    <button 
                        onClick={onDownload}
                        className={`p-2 rounded hover:bg-white/10 transition-colors ${t.text} opacity-50 hover:opacity-100`}
                        title="Download Transcript"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={onClear}
                        className={`p-2 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors ${t.text} opacity-50 hover:opacity-100`}
                        title="Clear Transcript"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>

                <div 
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
                >
                    {transcription.length === 0 && translationPool.length === 0 && (
                        <div className="text-center font-mono mt-16 opacity-50 h-full flex flex-col items-center justify-center">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                            <div>
                                {status === 'disconnected' ? 'System ready. Select a mode to begin.' : 
                                status === 'connecting' ? 'Establishing secure link...' : 'Listening...'}
                            </div>
                        </div>
                    )}

                    {/* --- TRANSLATOR MODE DISPLAY (POOL) --- */}
                    {mode === 'translator' ? (
                        <div className="space-y-4 text-base">
                            {translationPool.map((item) => (
                                <div key={item.id} className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center group">
                                    {/* Source */}
                                    <div className={`text-right ${item.isSourceComplete ? 'opacity-50 text-slate-300' : 'text-white'}`}>
                                        <p className="whitespace-pre-wrap leading-relaxed">{item.sourceText}</p>
                                    </div>
                                    
                                    {/* Arrow */}
                                    <div className="flex justify-center flex-col items-center gap-1">
                                        <ArrowRight className={`w-5 h-5 ${item.isTargetComplete ? t.text : 'text-slate-600'}`} />
                                        {item.isCloudTranslated && (
                                            <Cloud className="w-3 h-3 text-sky-400" title="High-Quality Cloud Translation Active" />
                                        )}
                                    </div>
                                    
                                    {/* Target */}
                                    <div className={`text-left`}>
                                        {item.targetText ? (
                                            <p className={`${t.text} font-medium leading-relaxed whitespace-pre-wrap`}>{item.targetText}</p>
                                        ) : (
                                            <div className="flex items-center gap-1 opacity-50">
                                                <span className="w-1 h-1 rounded-full bg-current animate-bounce"></span>
                                                <span className="w-1 h-1 rounded-full bg-current animate-bounce delay-100"></span>
                                                <span className="w-1 h-1 rounded-full bg-current animate-bounce delay-200"></span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* --- ASSISTANT MODE DISPLAY (LINEAR) --- */
                        transcription.map((msg, idx) => {
                            const isLast = idx === transcription.length - 1;
                            return (
                                <div key={idx} className={`mb-4 ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>
                                    <div className={`inline-block px-4 py-2 rounded-lg tracking-wide whitespace-pre-wrap ${
                                        msg.type === 'user' 
                                            ? `${t.bg} ${t.text} border ${t.border} rounded-br-none` 
                                            : 'bg-slate-800/60 text-white border border-slate-600/50 rounded-bl-none'
                                    }`}>
                                    {msg.type === 'model' && (
                                        <div className={`text-[10px] ${t.text} font-mono mb-1 uppercase tracking-wider flex items-center gap-1`}>
                                            <BrainCircuit className="w-3 h-3" />
                                            KITTS AI
                                        </div>
                                    )}
                                    <span className={`text-base ${isProfessionalMode && msg.type === 'model' ? 'font-medium leading-relaxed' : ''}`}>
                                        {msg.text}
                                    </span>
                                    {isLast && status === 'connected' && (
                                        <span className={`inline-block w-2 h-4 ml-1 align-middle ${t.bg} animate-pulse`}></span>
                                    )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* CONTROLS AREA */}
            <div className="flex items-center justify-between gap-4 w-full">
                
                {/* Mode Selectors */}
                <div className="grid grid-cols-2 gap-4 w-auto">
                    <button 
                        onClick={() => setMode('assistant')}
                        className={`relative p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all group overflow-hidden ${
                            mode === 'assistant' 
                            ? `${t.bg} ${t.border} text-white shadow-lg` 
                            : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        <BrainCircuit className={`w-5 h-5 ${mode === 'assistant' ? t.text : ''}`} />
                        <span className="font-bold tracking-wider text-xs">ASSISTANT</span>
                        {mode === 'assistant' && <div className={`absolute bottom-0 left-0 w-full h-1 ${t.text.replace('text', 'bg')}`}></div>}
                    </button>

                    <button 
                        onClick={() => setMode('translator')}
                        className={`relative p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all group overflow-hidden ${
                            mode === 'translator' 
                            ? `${t.bg} ${t.border} text-white shadow-lg` 
                            : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        <Languages className={`w-5 h-5 ${mode === 'translator' ? t.text : ''}`} />
                        <span className="font-bold tracking-wider text-xs">TRANSLATOR</span>
                        {mode === 'translator' && <div className={`absolute bottom-0 left-0 w-full h-1 ${t.text.replace('text', 'bg')}`}></div>}
                    </button>
                </div>

                {/* Translator Quick Config */}
                {mode === 'translator' && (
                    <div className="hidden lg:flex bg-slate-900/80 backdrop-blur border border-slate-700 p-3 rounded-lg flex-wrap items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-2 flex-1 max-w-xl">
                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="bg-black/50 border border-slate-600 text-white text-xs p-1 rounded outline-none focus:border-cyan-500 w-full">
                                <option value="Auto">Auto Detect</option>
                                {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                            </select>
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="bg-black/50 border border-slate-600 text-white text-xs p-1 rounded outline-none focus:border-cyan-500 w-full">
                                {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {/* Main Connection Controls */}
                <div className="flex justify-center gap-6 items-center relative">
                    <button onClick={() => setShowSettings(true)} className={`absolute -left-16 w-12 h-12 rounded-full border flex items-center justify-center transition-all ${`bg-slate-800/80 border-slate-600 ${t.text} hover:bg-slate-700`}`}>
                        <Settings className="w-5 h-5" />
                    </button>

                    <button onClick={onToggleCamera} className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${isCameraOn ? `${t.bg} ${t.border} ${t.text} ${t.shadow}` : 'bg-slate-800/80 border-slate-600 text-slate-500 hover:text-slate-300'}`}>
                        {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    </button>

                    <button 
                        onClick={onToggleMute} 
                        className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800/80 border-slate-600 text-slate-500 hover:text-slate-300'}`}
                        title={isMuted ? "Unmute Audio" : "Mute Audio (Text Only)"}
                    >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>

                    {status === 'connected' ? (
                        <button onClick={onDisconnect} className="group flex flex-col items-center gap-2">
                            <div className={`w-16 h-16 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center group-hover:bg-red-500/40 transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)]`}>
                                <MicOff className="w-6 h-6 text-red-400" />
                            </div>
                            <span className="text-xs font-mono text-red-400 tracking-wider">TERMINATE</span>
                        </button>
                    ) : (
                        <div className="flex gap-4">
                            <button onClick={onConnectSystem} disabled={status === 'connecting'} className="group flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                <div className="relative w-16 h-16">
                                    {status === 'connecting' && (
                                        <div className={`absolute inset-0 border-4 border-t-current border-r-transparent border-b-current border-l-transparent rounded-full animate-spin ${t.text}`}></div>
                                    )}
                                    <div className={`absolute inset-0 rounded-full bg-slate-800/80 border border-slate-600 flex items-center justify-center group-hover:opacity-80 transition-all hover:bg-slate-700`}>
                                        <MonitorPlay className="w-6 h-6 text-slate-300" />
                                    </div>
                                </div>
                                <span className={`text-xs font-mono text-slate-400 tracking-wider`}>{status === 'connecting' ? 'CONNECTING' : 'SYS AUDIO'}</span>
                            </button>
                            
                            <button onClick={onConnect} disabled={status === 'connecting'} className="group flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                                <div className="relative w-16 h-16">
                                    {status === 'connecting' && (
                                        <div className={`absolute inset-0 border-4 border-t-current border-r-transparent border-b-current border-l-transparent rounded-full animate-spin ${t.text}`}></div>
                                    )}
                                    <div className={`absolute inset-0 rounded-full ${t.bg} border ${t.border} flex items-center justify-center group-hover:opacity-80 transition-all ${t.shadow}`}>
                                        <Mic className={`w-6 h-6 ${t.text}`} />
                                    </div>
                                </div>
                                <span className={`text-xs font-mono ${t.text} tracking-wider`}>{status === 'connecting' ? 'CONNECTING' : 'MIC START'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* SETTINGS MODAL */}
        {showSettings && (
            <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
                <div className={`w-full max-w-md bg-slate-900 border ${t.border} rounded-xl p-6 relative shadow-2xl overflow-y-auto max-h-[90vh]`}>
                    <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                    <h2 className={`text-xl font-bold font-mono mb-6 ${t.text} flex items-center gap-2`}><Settings className="w-5 h-5" /> CONFIGURATION</h2>
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Mobile Translator Settings */}
                        {mode === 'translator' && (
                            <div>
                                <label className={`text-xs font-mono ${t.text} block mb-2`}>LANGUAGES</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="bg-black/50 border border-slate-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-cyan-500 w-full">
                                        <option value="Auto">Auto Detect</option>
                                        {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                                    </select>
                                    <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="bg-black/50 border border-slate-600 text-white text-sm rounded px-3 py-2 outline-none focus:border-cyan-500 w-full">
                                        {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div>
                             <label className={`text-xs font-mono ${t.text} block mb-2`}>TRANSLATION ENGINE</label>
                             <button 
                                onClick={() => setIsCloudTranslationEnabled(!isCloudTranslationEnabled)}
                                className={`w-full py-3 px-4 rounded-lg border flex items-center justify-between transition-all ${isCloudTranslationEnabled ? `${t.bg} ${t.border} text-white` : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                             >
                                 <span className="flex items-center gap-2">
                                     <Cloud className="w-4 h-4" />
                                     CLOUD TEXT TRANSLATION
                                 </span>
                                 <span className="text-xs font-mono">{isCloudTranslationEnabled ? 'ACTIVE' : 'OFF'}</span>
                             </button>
                             <p className="text-xs text-slate-500 mt-2">
                                 Uses Flash API for higher accuracy on completed sentences.
                             </p>
                        </div>
                        <div>
                            <label className={`text-xs font-mono ${t.text} block mb-2`}>INTERFACE THEME</label>
                            <div className="grid grid-cols-2 gap-3">
                                {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map((key) => (
                                    <button key={key} onClick={() => setTheme(key)} className={`py-3 rounded-lg border transition-all capitalize ${theme === key ? `${THEMES[key].bg} ${THEMES[key].border} text-white` : 'border-slate-700 text-slate-400'}`}>{THEMES[key].name}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className={`text-xs font-mono ${t.text} block mb-2`}>BACKGROUND STYLE</label>
                            <div className="grid grid-cols-2 gap-3">
                                {['grid', 'horizon', 'orbital', 'hex'].map((style) => (
                                    <button key={style} onClick={() => setBgStyle(style as any)} className={`flex items-center justify-center gap-2 py-3 rounded-lg border transition-all capitalize ${bgStyle === style ? `${t.bg} ${t.border} text-white` : 'border-slate-700 text-slate-400'}`}>
                                        {style === 'horizon' ? <Monitor className="w-4 h-4"/> : style === 'orbital' ? <Globe className="w-4 h-4"/> : <Box className="w-4 h-4"/>}
                                        {style}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <button onClick={handleApply} className={`w-full py-3 rounded-lg font-bold font-mono tracking-wider transition-all flex items-center justify-center gap-2 mt-6 ${t.bg} ${t.text} border ${t.border} hover:opacity-90 active:scale-95`}>
                        <Check className="w-5 h-5" /> CLOSE & APPLY
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ArInterface;