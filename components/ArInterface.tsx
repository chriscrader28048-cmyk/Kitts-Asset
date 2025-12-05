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
                 <h3 className={`text-lg font-mono leading-tight ${theme.text}`}>{data.name}</h3>
                 <div className="flex justify-between text-[10px] opacity-70 font-mono mt-1">
                     <span>LAT: {data.lat}</span>
                     <span>LON: {data.lon}</span>
                 </div>
                 <p className="text-[10px] mt-2 border-t border-white/10 pt-1 leading-normal">{data.description}</p>
            </div>
        </div>
    );
};

const StockWidget: React.FC<{ data: any, theme: any }> = ({ data, theme }) => {
    return (
        <div className={`absolute bottom-32 left-8 z-30 w-56 ${theme.bg} ${theme.border} border backdrop-blur-md rounded-lg p-3 animate-in slide-in-from-left duration-500`}>
            <div className="flex justify-between items-start">
                <div>
                    <span className="text-xs font-bold text-white/50 block">MARKET DATA</span>
                    <h2 className="text-2xl font-bold tracking-wider">{data.symbol}</h2>
                </div>
                {data.trend === 'up' ? 
                    <TrendingUp className="w-6 h-6 text-green-400" /> : 
                    data.trend === 'down' ? 
                    <TrendingDown className="w-6 h-6 text-red-400" /> : 
                    <Activity className="w-6 h-6 text-gray-400" />
                }
            </div>
            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-mono">{data.price}</span>
                <span className={`text-sm ${data.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    {data.change}
                </span>
            </div>
        </div>
    );
};

const InfoWidget: React.FC<{ data: any, theme: any }> = ({ data, theme }) => {
    return (
        <div className={`absolute top-24 left-8 z-30 w-64 ${theme.bg} ${theme.border} border-l-4 backdrop-blur-md p-4 animate-in fade-in duration-700`}>
            <div className="flex items-center gap-2 mb-2">
                <Info className={`w-4 h-4 ${theme.text}`} />
                <span className="text-xs font-bold tracking-widest">{data.category}</span>
            </div>
            <h3 className={`text-xl font-bold mb-2 leading-tight ${theme.text}`}>{data.title}</h3>
            <p className="text-sm leading-relaxed opacity-90">{data.fact}</p>
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
  mode,
  setMode,
  sourceLang,
  setSourceLang,
  targetLang,
  setTargetLang,
  isProfessionalMode,
  setIsProfessionalMode,
  isCloudTranslationEnabled,
  setIsCloudTranslationEnabled,
  onApplyConfig,
  isFunMode,
  setIsFunMode,
  theme,
  setTheme,
  bgStyle,
  setBgStyle,
  activeWidget,
  isMuted,
  onToggleMute,
  onClear,
  onDownload
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'visuals'>('system');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const currentTheme = THEMES[theme];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcription, translationPool, status]);

  return (
    <div className={`relative w-full h-screen overflow-hidden ${currentTheme.text} font-sans selection:bg-cyan-500/30`}>
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-black z-[-1]">
          <BackgroundLayer style={bgStyle} themeColor={currentTheme.text} />
      </div>

      {/* Video Layer */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover opacity-60 transition-opacity duration-1000 ${isCameraOn ? 'opacity-60' : 'opacity-0'}`}
      />
      
      {/* Scanline Overlay */}
      <div className="scan-line text-white/10" />

      {/* Widgets Layer */}
      {activeWidget && activeWidget.type === 'weather' && <WeatherWidget data={activeWidget.data} theme={currentTheme} />}
      {activeWidget && activeWidget.type === 'map' && <MapWidget data={activeWidget.data} theme={currentTheme} />}
      {activeWidget && activeWidget.type === 'stock' && <StockWidget data={activeWidget.data} theme={currentTheme} />}
      {activeWidget && activeWidget.type === 'info' && <InfoWidget data={activeWidget.data} theme={currentTheme} />}

      {/* Whiteboard Portal */}
      {isWhiteboardOpen && (
          <WhiteboardWindow 
            transcription={transcription} 
            targetLang={targetLang}
            onClose={() => setIsWhiteboardOpen(false)} 
          />
      )}

      {/* MAIN CONTAINER */}
      {/* Changed justify-end to justify-center to push content UP and fill the empty space */}
      <div className="relative z-10 w-full h-full flex flex-col justify-center items-center p-4 lg:p-10">
        
        {/* HEADER: Always at top */}
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
            <div className="pointer-events-auto">
                <div className={`flex items-center gap-3 ${currentTheme.border} border px-4 py-2 bg-black/40 backdrop-blur-md rounded-lg`}>
                    <BrainCircuit className={`w-6 h-6 ${currentTheme.text} animate-pulse`} />
                    <div>
                        <h1 className="text-2xl font-bold tracking-widest leading-none">KITTS<span className="text-xs align-top opacity-50 ml-1">AR V3.0</span></h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Activity className="w-3 h-3" />
                            <span className="text-[10px] tracking-widest uppercase">SYS: {status.toUpperCase()}</span>
                        </div>
                    </div>
                </div>
                {isCloudTranslationEnabled && mode === 'translator' && (
                    <div className={`mt-2 flex items-center gap-2 px-3 py-1 rounded border border-blue-500/30 bg-blue-900/20 backdrop-blur-md animate-in slide-in-from-left`}>
                        <CloudLightning className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] text-blue-300 font-bold tracking-wider">GEMINI CLOUD</span>
                    </div>
                )}
            </div>

            <div className="text-right pointer-events-auto">
                <div className="flex flex-col items-end text-[10px] font-mono opacity-70 leading-relaxed">
                    <span>LAT: 123ft</span>
                    <span>CAM: {isCameraOn ? 'ON' : 'OFF'}</span>
                    <span>MODE: {mode.toUpperCase()}</span>
                </div>
            </div>
        </div>


        {/* CENTER CONTENT: Transcription/Translation Windows */}
        <div className={`w-full max-w-6xl transition-all duration-500 ease-in-out ${isFullScreen ? 'fixed inset-4 z-50 h-auto' : 'relative'}`}>
            <div className={`w-full ${isFullScreen ? 'h-full' : 'h-[350px] lg:h-[500px]'} ${currentTheme.bg} ${currentTheme.border} ${currentTheme.shadow} border backdrop-blur-xl rounded-lg flex flex-col overflow-hidden transition-all duration-500`}>
                
                {/* Window Header */}
                <div className={`flex items-center justify-between px-4 py-2 border-b ${currentTheme.border} bg-black/20`}>
                    <div className="flex items-center gap-2">
                        {mode === 'translator' ? <Languages className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                        <span className="text-xs font-bold tracking-wider uppercase">
                            {mode === 'translator' ? 'Translation Stream' : 'System Logs'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onDownload} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Download Log">
                            <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={onClear} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors" title="Clear History">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-1.5 hover:bg-white/10 rounded transition-colors">
                            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-4 scroll-smooth font-mono text-sm space-y-4 custom-scrollbar">
                    
                    {/* TRANSLATOR MODE UI */}
                    {mode === 'translator' ? (
                        <div className="space-y-4">
                            {translationPool.map((item) => (
                                <div key={item.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-white/5 pb-4 last:border-0">
                                    {/* Source */}
                                    <div className="relative group">
                                        <div className="absolute -left-3 top-1 w-1 h-full border-l-2 border-white/10 group-hover:border-white/30 transition-colors" />
                                        <span className="text-[10px] uppercase opacity-40 mb-1 block">{sourceLang === 'Auto' ? 'DETECTED' : sourceLang}</span>
                                        <p className="opacity-80 leading-relaxed whitespace-pre-wrap">{item.sourceText}</p>
                                    </div>
                                    
                                    {/* Target */}
                                    <div className="relative group">
                                         <div className={`absolute -left-3 top-1 w-1 h-full border-l-2 ${item.isCloudTranslated ? 'border-blue-500' : currentTheme.border.replace('border-', 'border-')} transition-colors`} />
                                         <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] uppercase font-bold ${currentTheme.text}`}>{targetLang}</span>
                                            {item.isCloudTranslated && <Check className="w-3 h-3 text-blue-400" />}
                                         </div>
                                         <p className={`text-lg font-medium leading-relaxed whitespace-pre-wrap ${item.isTargetComplete ? 'text-white' : 'text-white/70'} ${!item.isTargetComplete && 'animate-pulse'}`}>
                                            {item.targetText}
                                            {!item.isTargetComplete && <span className="inline-block w-2 h-4 bg-current ml-1 animate-blink"/>}
                                         </p>
                                    </div>
                                </div>
                            ))}
                            {translationPool.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center opacity-30 mt-20">
                                    <ArrowRightLeft className="w-12 h-12 mb-2" />
                                    <p>Ready to translate...</p>
                                </div>
                            )}
                        </div>
                    ) : (
                    /* ASSISTANT MODE UI */
                        <div className="space-y-3">
                            {transcription.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-lg backdrop-blur-sm ${
                                        msg.type === 'user' 
                                            ? 'bg-white/10 border border-white/10 text-right' 
                                            : `${currentTheme.bg} ${currentTheme.border} border`
                                    }`}>
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                    </div>
                                </div>
                            ))}
                             {transcription.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center opacity-30 mt-20">
                                    <MessageSquare className="w-12 h-12 mb-2" />
                                    <p>System ready. Select a mode to begin.</p>
                                </div>
                            )}
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* QUICK CONFIG BAR (Below Window) */}
            <div className="mt-4 flex flex-wrap justify-between items-center gap-4 animate-in slide-in-from-bottom duration-700 delay-100">
                
                {/* Left: Mode Selection */}
                <div className="flex gap-2">
                    <button 
                        onClick={() => { setMode('assistant'); onApplyConfig(); }}
                        className={`px-6 py-3 rounded-lg border flex items-center gap-2 transition-all duration-300 ${
                            mode === 'assistant' 
                            ? `${currentTheme.bg} ${currentTheme.border} ${currentTheme.text} shadow-[0_0_15px_rgba(6,182,212,0.2)]` 
                            : 'border-white/10 bg-black/40 hover:bg-white/5 opacity-60'
                        }`}
                    >
                        <BrainCircuit className="w-5 h-5" />
                        <span className="font-bold tracking-wider">ASSISTANT</span>
                    </button>
                    <button 
                        onClick={() => { setMode('translator'); onApplyConfig(); }}
                        className={`px-6 py-3 rounded-lg border flex items-center gap-2 transition-all duration-300 ${
                            mode === 'translator' 
                            ? `${currentTheme.bg} ${currentTheme.border} ${currentTheme.text} shadow-[0_0_15px_rgba(6,182,212,0.2)]` 
                            : 'border-white/10 bg-black/40 hover:bg-white/5 opacity-60'
                        }`}
                    >
                        <Languages className="w-5 h-5" />
                        <span className="font-bold tracking-wider">TRANSLATOR</span>
                    </button>
                </div>

                {/* Middle: Contextual Config */}
                <div className={`flex-1 flex justify-center transition-all duration-500 ${mode === 'translator' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 hidden lg:flex'}`}>
                     {mode === 'translator' && (
                         <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                             <select 
                                value={sourceLang}
                                onChange={(e) => { setSourceLang(e.target.value); onApplyConfig(); }}
                                className="bg-transparent border-none text-center font-bold focus:ring-0 cursor-pointer hover:text-cyan-400"
                             >
                                 <option value="Auto">Auto Detect</option>
                                 {LANGUAGES.map(l => <option key={l.code} value={l.name} className="bg-black">{l.name}</option>)}
                             </select>
                             <ArrowRight className="w-4 h-4 opacity-50" />
                             <select 
                                value={targetLang}
                                onChange={(e) => { setTargetLang(e.target.value); onApplyConfig(); }}
                                className={`bg-transparent border-none text-center font-bold focus:ring-0 cursor-pointer ${currentTheme.text}`}
                             >
                                 {LANGUAGES.map(l => <option key={l.code} value={l.name} className="bg-black">{l.name}</option>)}
                             </select>
                             
                             <div className="w-px h-4 bg-white/20 mx-2" />
                             
                             <button 
                                onClick={() => setIsWhiteboardOpen(true)}
                                className="p-1.5 hover:bg-white/10 rounded text-cyan-400" 
                                title="Open Whiteboard"
                             >
                                <Presentation className="w-4 h-4" />
                             </button>
                         </div>
                     )}
                     {mode === 'assistant' && (
                         // Removed center fun mode button
                         null
                     )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                     {mode === 'assistant' && (
                        <button 
                            onClick={() => { setIsFunMode(!isFunMode); onApplyConfig(); }}
                            className={`p-3 rounded-full border transition-all ${
                                isFunMode 
                                ? 'bg-pink-500/20 border-pink-500 text-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]' 
                                : 'border-white/10 bg-black/40 hover:bg-white/10'
                            }`}
                            title="Toggle Fun Mode"
                        >
                            <Smile className="w-5 h-5" />
                        </button>
                     )}

                     <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-3 rounded-full border border-white/10 bg-black/40 hover:bg-white/10 transition-colors"
                     >
                        <Settings className="w-5 h-5" />
                     </button>
                     <button 
                        onClick={onToggleCamera}
                        className={`p-3 rounded-full border transition-all ${
                            isCameraOn 
                            ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' 
                            : 'border-white/10 bg-black/40 hover:bg-white/10'
                        }`}
                     >
                        {isCameraOn ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                     </button>
                     <button 
                        onClick={onToggleMute}
                        className={`p-3 rounded-full border transition-all ${
                            isMuted 
                            ? 'bg-red-500/20 border-red-500 text-red-500' 
                            : 'border-white/10 bg-black/40 hover:bg-white/10'
                        }`}
                        title={isMuted ? "Unmute Audio" : "Mute Audio"}
                     >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                     </button>
                     <button 
                        onClick={onConnectSystem}
                        className="p-3 rounded-full border border-white/10 bg-black/40 hover:bg-white/10 transition-colors flex flex-col items-center"
                        title="Share System Audio"
                     >
                        <MonitorPlay className="w-5 h-5" />
                        <span className="text-[8px] mt-0.5 opacity-60">SYS AUDIO</span>
                     </button>

                     {/* Main Connect Button */}
                     {status === 'disconnected' || status === 'error' ? (
                        <button 
                            onClick={onConnect}
                            className={`h-12 w-12 rounded-full ${currentTheme.bg} ${currentTheme.border} border-2 flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_20px_rgba(6,182,212,0.4)]`}
                        >
                            <Mic className={`w-6 h-6 ${currentTheme.text}`} />
                            <span className="text-[8px] absolute -bottom-5 font-bold tracking-wider opacity-80">MIC START</span>
                        </button>
                     ) : (
                         <button 
                            onClick={onDisconnect}
                            className="h-12 w-12 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse"
                         >
                            <div className="w-4 h-4 bg-red-500 rounded-sm" />
                            <span className="text-[8px] absolute -bottom-5 font-bold tracking-wider text-red-500 opacity-80">TERMINATE</span>
                        </button>
                     )}
                </div>
            </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className={`w-full max-w-2xl bg-black ${currentTheme.border} border rounded-2xl overflow-hidden shadow-2xl`}>
                <div className="flex border-b border-white/10">
                    <button 
                        onClick={() => setActiveTab('system')}
                        className={`flex-1 py-4 text-center font-bold tracking-widest hover:bg-white/5 transition-colors ${activeTab === 'system' ? `${currentTheme.text} border-b-2 ${currentTheme.border.replace('border', 'border')}` : 'opacity-50'}`}
                    >
                        SYSTEM CONFIG
                    </button>
                    <button 
                        onClick={() => setActiveTab('visuals')}
                        className={`flex-1 py-4 text-center font-bold tracking-widest hover:bg-white/5 transition-colors ${activeTab === 'visuals' ? `${currentTheme.text} border-b-2 ${currentTheme.border.replace('border', 'border')}` : 'opacity-50'}`}
                    >
                        INTERFACE VISUALS
                    </button>
                    <button onClick={() => setIsSettingsOpen(false)} className="px-6 hover:bg-red-500/20 hover:text-red-500 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 h-[400px] overflow-y-auto custom-scrollbar">
                    {activeTab === 'system' ? (
                        <div className="space-y-8">
                            {/* Translator Settings */}
                            <div className="space-y-4">
                                <h3 className="flex items-center gap-2 text-lg font-bold opacity-80">
                                    <Languages className="w-5 h-5 text-cyan-400" />
                                    TRANSLATOR PROTOCOLS
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs uppercase opacity-50">Source Language</label>
                                        <select 
                                            value={sourceLang}
                                            onChange={(e) => setSourceLang(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded p-3 focus:border-cyan-500 outline-none"
                                        >
                                            <option value="Auto">Auto Detect</option>
                                            {LANGUAGES.map(l => <option key={l.code} value={l.name} className="bg-black">{l.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs uppercase opacity-50">Target Language</label>
                                        <select 
                                            value={targetLang}
                                            onChange={(e) => setTargetLang(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded p-3 focus:border-cyan-500 outline-none"
                                        >
                                            {LANGUAGES.map(l => <option key={l.code} value={l.name} className="bg-black">{l.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded bg-white/5 border border-white/10">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer ${isProfessionalMode ? 'bg-cyan-500 border-cyan-500' : 'border-white/30'}`} onClick={() => setIsProfessionalMode(!isProfessionalMode)}>
                                        {isProfessionalMode && <Check className="w-3 h-3 text-black" />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm">Professional Meeting Mode</div>
                                        <div className="text-xs opacity-50">Optimize for formal vocabulary and continuous streaming</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded bg-white/5 border border-white/10">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer ${isCloudTranslationEnabled ? 'bg-blue-500 border-blue-500' : 'border-white/30'}`} onClick={() => setIsCloudTranslationEnabled(!isCloudTranslationEnabled)}>
                                        {isCloudTranslationEnabled && <Check className="w-3 h-3 text-black" />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm flex items-center gap-2">
                                            Google Cloud Gemini 2.5 Flash
                                            <CloudLightning className="w-3 h-3 text-blue-400" />
                                        </div>
                                        <div className="text-xs opacity-50">Use Flash 2.5 API for high-precision text refinement (Hybrid Mode)</div>
                                    </div>
                                </div>
                            </div>
                            
                            <hr className="border-white/10" />

                            {/* Assistant Settings */}
                            <div className="space-y-4">
                                <h3 className="flex items-center gap-2 text-lg font-bold opacity-80">
                                    <BrainCircuit className="w-5 h-5 text-pink-400" />
                                    ASSISTANT PERSONA
                                </h3>
                                <div className="flex items-center gap-3 p-3 rounded bg-white/5 border border-white/10">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center cursor-pointer ${isFunMode ? 'bg-pink-500 border-pink-500' : 'border-white/30'}`} onClick={() => setIsFunMode(!isFunMode)}>
                                        {isFunMode && <Check className="w-3 h-3 text-black" />}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm flex items-center gap-2">
                                            FUN MODE
                                            <Smile className="w-4 h-4 text-pink-400" />
                                        </div>
                                        <div className="text-xs opacity-50">Enable witty, sarcastic, and humorous responses</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                             {/* Themes */}
                             <div className="space-y-4">
                                <h3 className="flex items-center gap-2 text-lg font-bold opacity-80">
                                    <Zap className="w-5 h-5 text-yellow-400" />
                                    COLOR THEME
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map((t) => (
                                        <button 
                                            key={t}
                                            onClick={() => setTheme(t)}
                                            className={`p-4 rounded border flex flex-col items-center gap-2 transition-all ${theme === t ? `${THEMES[t].border} ${THEMES[t].bg}` : 'border-white/10 hover:bg-white/5'}`}
                                        >
                                            <div className={`w-8 h-8 rounded-full ${THEMES[t].bg} border ${THEMES[t].border}`} />
                                            <span className="text-xs font-bold uppercase">{THEMES[t].name}</span>
                                        </button>
                                    ))}
                                </div>
                             </div>

                             {/* Backgrounds */}
                             <div className="space-y-4">
                                <h3 className="flex items-center gap-2 text-lg font-bold opacity-80">
                                    <Box className="w-5 h-5 text-purple-400" />
                                    ENVIRONMENT LAYER
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {['grid', 'horizon', 'orbital', 'hex'].map((bg) => (
                                        <button 
                                            key={bg}
                                            onClick={() => setBgStyle(bg as any)}
                                            className={`p-4 rounded border text-center uppercase text-sm font-bold transition-all ${bgStyle === bg ? `${currentTheme.border} ${currentTheme.bg} ${currentTheme.text}` : 'border-white/10 hover:bg-white/5'}`}
                                        >
                                            {bg}
                                        </button>
                                    ))}
                                </div>
                             </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-white/10 flex justify-end">
                    <button 
                        onClick={() => { onApplyConfig(); setIsSettingsOpen(false); }}
                        className={`px-8 py-3 rounded font-bold tracking-widest text-black hover:scale-105 transition-transform ${currentTheme.text.replace('text-', 'bg-')}`}
                    >
                        APPLY CONFIG
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ArInterface;