'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  X, 
  Minus, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Trash2, 
  MapPin, 
  AlertTriangle, 
  Building2, 
  Loader2, 
  ChevronDown,
  Maximize2,
  Minimize2,
  HelpCircle,
  Radio,
  Zap,
  ShieldCheck,
  Compass,
  MessageSquare,
  Paperclip,
  Image as ImageIcon,
  Plus,
  Lightbulb,
  BookOpen,
  Phone,
  ExternalLink,
  CheckCircle2,
  CloudRain,
  Truck,
  Navigation,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const QUICK_ACTIONS = [
  {
    id: 'qa1',
    title: 'Best route to Tawang',
    icon: Navigation,
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    query: 'What is the best and safest logistics route to Tawang considering current elevation, mountain road conditions, and landslides?'
  },
  {
    id: 'qa2',
    title: 'Show active hazards in Assam',
    icon: AlertTriangle,
    iconBg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    query: 'Show me all active road hazards, landslides and roadblocks in Assam right now with severity levels.'
  },
  {
    id: 'qa3',
    title: 'Plan a convoy',
    icon: Truck,
    iconBg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    query: 'I need to plan a multi-vehicle relief supply convoy across NER. Suggest optimal staging halts, refuel hubs, and safety checkpoints.'
  },
  {
    id: 'qa4',
    title: 'Weather update (NH-27)',
    icon: CloudRain,
    iconBg: 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
    query: 'What is the current weather forecast, rainfall level and flash-flood alert along the NH-27 transit corridor?'
  },
];

export default function TacticalAiChatWidget({ 
  hazards = [], 
  hubs = [], 
  activeRoute = null, 
  userLocation = null,
  onSelectHazardOnMap = null,
  onSelectHubOnMap = null 
}) {
  const { user, profile, isNodalOfficer, nodalOfficer } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isGpsShared, setIsGpsShared] = useState(true);

  // Extract friendly user display name
  const userName = useMemo(() => {
    return profile?.fullName || profile?.full_name || nodalOfficer?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Operator';
  }, [profile, nodalOfficer, user]);

  const welcomeMessage = useMemo(() => ({
    id: 'welcome-1',
    role: 'assistant',
    content: `Hello ${userName}! 👋\nI'm your **NER-LOGIX assistant**. I can help you with route planning, hazard analysis, convoys, weather updates, and more.\n\nHow can I assist you today?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }), [userName]);

  const [messages, setMessages] = useState([welcomeMessage]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Extract resolved coordinates
  const resolvedCoords = useMemo(() => {
    if (!userLocation) return null;
    if (userLocation.coords) {
      if (Array.isArray(userLocation.coords) && userLocation.coords.length >= 2) {
        return { lat: parseFloat(userLocation.coords[0]), lng: parseFloat(userLocation.coords[1]) };
      }
      if (userLocation.coords.lat != null && userLocation.coords.lng != null) {
        return { lat: parseFloat(userLocation.coords.lat), lng: parseFloat(userLocation.coords.lng) };
      }
    }
    if (userLocation.latitude != null && userLocation.longitude != null) {
      return { lat: parseFloat(userLocation.latitude), lng: parseFloat(userLocation.longitude) };
    }
    if (userLocation.lat != null && userLocation.lng != null) {
      return { lat: parseFloat(userLocation.lat), lng: parseFloat(userLocation.lng) };
    }
    return null;
  }, [userLocation, userLocation?.coords]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const speechRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen, isFullscreen]);

  // Stop speech when component unmounts or closes
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Text-To-Speech
  const speakText = (text, msgId) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    if (speakingMsgId === msgId) {
      setSpeakingMsgId(null);
      return;
    }

    const cleanText = text
      .replace(/\[action:[^\]]+\]/g, '')
      .replace(/[*#_`~]/g, '')
      .replace(/\n+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    if (/[\u0900-\u097F]/.test(cleanText)) {
      utterance.lang = 'hi-IN';
    } else if (/[\u0980-\u09FF]/.test(cleanText)) {
      utterance.lang = 'bn-IN';
    } else {
      utterance.lang = 'en-IN';
    }

    utterance.onstart = () => setSpeakingMsgId(msgId);
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
  };

  // Send message to Gemini route
  const handleSendMessage = async (queryToSend) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const userRole = isNodalOfficer ? 'nodal_officer' : (profile?.role || 'citizen_driver');
      const payload = {
        messages: [...messages, userMsg],
        userQuery: text,
        context: {
          hazards: hazards || [],
          hubs: hubs || [],
          userRole,
          userLocation: isGpsShared && resolvedCoords ? { 
            lat: resolvedCoords.lat, 
            lng: resolvedCoords.lng, 
            accuracy: userLocation?.accuracy || null 
          } : null,
          activeRoute: activeRoute ? {
            originName: activeRoute.originName || activeRoute.summary || activeRoute.name,
            destName: activeRoute.destName,
            distanceKm: activeRoute.distanceKm,
            hazardsOnRouteCount: activeRoute.hazardCount || activeRoute.flaggedHazards?.length || 0,
            sciScore: activeRoute.sciScore,
            weather: activeRoute.weather,
          } : null,
        }
      };

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to get response from AI Copilot.');
      }

      const replyContent = json.data.reply;
      const aiMsgId = `ai-${Date.now()}`;
      const aiMsg = {
        id: aiMsgId,
        role: 'assistant',
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);

      if (!isMuted) {
        speakText(replyContent, aiMsgId);
      }

    } catch (err) {
      console.warn('AI Chat Error:', err?.message || err);
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Notice:** ${err?.message || 'Unable to connect to AI engine. Please check your internet or retry.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Voice recording handlers
  const startVoiceRecording = async () => {
    if (speakingMsgId) stopSpeech();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone input is not supported by your browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processVoiceToText(audioBlob);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 25) {
            stopVoiceRecording();
            return 25;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.warn('Microphone permission notice:', err?.message || err);
      alert('Microphone access was denied. Please allow microphone access in your browser to speak to the AI assistant.');
    }
  };

  const stopVoiceRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const processVoiceToText = async (audioBlob) => {
    try {
      setLoading(true);
      const reader = new FileReader();
      const base64Audio = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result;
          const base64String = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const res = await fetch('/api/ai/voice-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType: audioBlob.type || 'audio/webm',
        }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        const spokenText = json.data.original_transcript || json.data.description_summary || '';
        if (spokenText) {
          handleSendMessage(spokenText);
        }
      }
    } catch (e) {
      console.warn('Voice transcription notice:', e?.message || e);
    } finally {
      setLoading(false);
    }
  };

  // Render markdown with action chips
  const renderFormattedMessage = (content) => {
    const actionRegex = /\[action:(hazard|hub):([^\]]+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = actionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'action', actionType: match[1], actionTarget: match[2] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({ type: 'text', value: content.substring(lastIndex) });
    }

    return (
      <div className="space-y-1 text-xs leading-relaxed break-words">
        {parts.map((p, idx) => {
          if (p.type === 'action') {
            if (p.actionType === 'hazard') {
              return (
                <button
                  key={`act-${idx}`}
                  type="button"
                  onClick={() => onSelectHazardOnMap && onSelectHazardOnMap(p.actionTarget)}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 my-1 mr-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs"
                >
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span>View Hazard on Map</span>
                </button>
              );
            } else if (p.actionType === 'hub') {
              return (
                <button
                  key={`act-${idx}`}
                  type="button"
                  onClick={() => onSelectHubOnMap && onSelectHubOnMap(p.actionTarget)}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 my-1 mr-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs"
                >
                  <Building2 className="w-3 h-3 text-blue-500" />
                  <span>Locate Supply Hub</span>
                </button>
              );
            }
          }

          const paragraphs = p.value.split('\n\n');
          return (
            <div key={`txt-${idx}`} className="space-y-1.5">
              {paragraphs.map((para, pIdx) => {
                const lines = para.split('\n');
                return (
                  <div key={pIdx} className="space-y-0.5">
                    {lines.map((line, lIdx) => {
                      if (line.trim().startsWith('### ') || line.trim().startsWith('## ')) {
                        return (
                          <h4 key={lIdx} className="text-xs font-bold text-slate-900 dark:text-white mt-1.5 mb-0.5">
                            {renderInlineStyles(line.replace(/^#{2,3}\s/, ''))}
                          </h4>
                        );
                      }
                      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                        const item = line.trim().substring(2);
                        return (
                          <div key={lIdx} className="flex items-start space-x-1.5 pl-1">
                            <span className="text-blue-500 font-bold mt-0.5">•</span>
                            <span className="text-slate-700 dark:text-slate-200">{renderInlineStyles(item)}</span>
                          </div>
                        );
                      }
                      return <p key={lIdx} className="text-slate-700 dark:text-slate-200">{renderInlineStyles(line)}</p>;
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const renderInlineStyles = (text) => {
    const boldParts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return boldParts.map((sub, sIdx) => {
      if (sub.startsWith('**') && sub.endsWith('**')) {
        return <strong key={sIdx} className="font-bold text-slate-900 dark:text-white">{sub.slice(2, -2)}</strong>;
      }
      if (sub.startsWith('`') && sub.endsWith('`')) {
        return <code key={sIdx} className="px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-cyan-300 font-mono text-[10px]">{sub.slice(1, -1)}</code>;
      }
      return sub;
    });
  };

  const handleClearChat = () => {
    stopSpeech();
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Hello ${userName}! 👋\nI'm your **NER-LOGIX assistant**. I can help you with route planning, hazard analysis, convoys, weather updates, and more.\n\nHow can I assist you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  };

  // Shared Inner Chat Window Content (Used by both Drawer and Fullscreen Modal)
  const renderChatContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden select-none">
      
      {/* Header Bar */}
      <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
        {/* Left Info */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xs shadow-blue-500/20 shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
              NER-LOGIX AI
            </h3>
            <div className="flex items-center space-x-1 leading-tight mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Online</span>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center space-x-1 text-slate-400">
          <button
            type="button"
            onClick={() => {
              if (!isMuted && speakingMsgId) stopSpeech();
              setIsMuted(!isMuted);
            }}
            className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${isMuted ? 'text-slate-400' : 'text-blue-600 dark:text-blue-400'}`}
            title={isMuted ? "Unmute AI Voice" : "Mute AI Voice"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="Reset Chat"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? "Restore Size" : "Expand Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              stopSpeech();
              setIsOpen(false);
              setIsFullscreen(false);
            }}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Close AI Copilot"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Message & Action Scroll Area */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 select-text">
        
        {/* Subtle Top Timestamp */}
        <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 pl-1 select-none">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} LM
        </div>

        {/* Welcome Message Card */}
        {messages.length === 1 && messages[0].id.startsWith('welcome') && (
          <div className="space-y-3.5 animate-in fade-in duration-300">
            <div className="flex items-start space-x-2.5">
              <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 rounded-2xl p-3 text-xs text-slate-700 dark:text-slate-200 leading-relaxed shadow-2xs">
                <p className="font-semibold text-slate-900 dark:text-white mb-1">Hello {userName}! 👋</p>
                <p className="mb-2">
                  I&apos;m your NER-LOGIX assistant. I can help you with route planning, hazard analysis, convoys, weather updates, and more.
                </p>
                <p className="font-medium text-slate-900 dark:text-white">
                  How can I assist you today?
                </p>
              </div>
            </div>

            {/* Quick Actions List */}
            <div className="pt-1 select-none">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                Quick Actions
              </h4>

              <div className="space-y-2">
                {QUICK_ACTIONS.map((qa) => {
                  const IconComp = qa.icon;
                  return (
                    <button
                      key={qa.id}
                      type="button"
                      onClick={() => handleSendMessage(qa.query)}
                      disabled={loading}
                      className="w-full p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 bg-white dark:bg-slate-800/80 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 flex items-center space-x-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer transition-all shadow-2xs group"
                    >
                      <div className={`p-1.5 rounded-lg border shrink-0 ${qa.iconBg} group-hover:scale-110 transition-transform`}>
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {qa.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Chat Messages */}
        {(messages.length > 1 || !messages[0]?.id?.startsWith('welcome')) && messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSpeakingThis = speakingMsgId === msg.id;

          return (
            <div 
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1 animate-in fade-in duration-200`}
            >
              <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-medium px-1 select-none">
                {!isUser && <Sparkles className="w-3 h-3 text-blue-500" />}
                <span>{isUser ? 'You' : 'NER-LOGIX AI'}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <div 
                className={`p-3 rounded-2xl shadow-2xs transition-all ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-tr-xs max-w-[88%]'
                    : msg.isError
                    ? 'bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-tl-xs max-w-[92%]'
                    : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs max-w-[92%]'
                }`}
              >
                {renderFormattedMessage(msg.content)}

                {/* Spoken Audio Controls */}
                {!isUser && !msg.isError && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] select-none">
                    <button
                      type="button"
                      onClick={() => speakText(msg.content, msg.id)}
                      className={`font-semibold flex items-center space-x-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                        isSpeakingThis 
                          ? 'bg-blue-600 text-white animate-pulse' 
                          : 'text-slate-500 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                    >
                      {isSpeakingThis ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      <span>{isSpeakingThis ? 'Mute' : 'Listen'}</span>
                    </button>
                    <span className="text-slate-400 font-mono text-[9px]">Gemini 3.5</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* AI Loading State */}
        {loading && (
          <div className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 shadow-2xs animate-in fade-in select-none">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
            <span>Consulting real-time GIS data...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Footer */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 select-none">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
          
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type your message..."
            disabled={loading || isRecording}
            className="w-full resize-none bg-transparent outline-none text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 min-h-[30px] max-h-20 scrollbar-none select-text"
          />

          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
            {/* Left Tools */}
            <div className="flex items-center space-x-1 text-slate-400">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={() => alert('Photo evidence will be attached to next query')} 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Attach File"
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Upload Photo Evidence"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                disabled={loading}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  isRecording 
                    ? 'bg-rose-500 text-white animate-pulse' 
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 text-slate-400'
                }`}
                title={isRecording ? "Stop Recording" : "Voice Dictation"}
              >
                {isRecording ? (
                  <span className="flex items-center space-x-1 text-[10px] font-mono font-bold">
                    <MicOff className="w-3.5 h-3.5" />
                    <span>{recordingTime}s</span>
                  </span>
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Right Send Button */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim() || loading || isRecording}
              className="w-7 h-7 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              title="Send Message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Bottom Status Text */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 px-1 font-mono">
          <span>Press Enter to send</span>
          <span className="flex items-center space-x-1">
            <Sparkles className="w-2.5 h-2.5 text-blue-500" />
            <span>Gemini 3.5</span>
          </span>
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* 1. FLOATING SYMBOL BUTTON AT BOTTOM-RIGHT CORNER (Z-INDEX 99999) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-[99999] group w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white flex items-center justify-center shadow-2xl shadow-blue-500/40 border border-white/25 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer animate-in fade-in zoom-in-90"
          title="Open NER-LOGIX AI Copilot"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-7 h-7 text-white animate-pulse" />
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900 animate-ping absolute -top-2 -right-2" />
          </div>
        </button>
      )}

      {/* 2. CHATTING INTERFACE WINDOW (STANDARD BOTTOM-RIGHT DRAWER) */}
      {isOpen && !isFullscreen && (
        <div className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-[99999] w-[94vw] sm:w-[390px] md:w-[410px] h-[540px] max-h-[calc(100vh-5.5rem)] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl shadow-blue-500/20 backdrop-blur-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-5 zoom-in-95 duration-200">
          {renderChatContent()}
        </div>
      )}

      {/* 3. FULLSCREEN EXPANDED MODAL (CENTERED WITH PROPER VIEWPORT CONSTRAINTS) */}
      {isOpen && isFullscreen && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl h-[88vh] max-h-[640px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {renderChatContent()}
          </div>
        </div>
      )}
    </>
  );
}
