import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import {
  Mic,
  MicOff,
  X,
  Volume2,
  AlertCircle,
  RefreshCw,
  Minimize2,
  Maximize2,
  Square,
  Globe,
} from 'lucide-react';
import { useToastContext } from '@librechat/client';
import type { TAskFunction } from '~/common';
import {
  satchiModeAtom,
  satchiWebSearchAtom,
  satchiResearchAtom,
  satchiImageGenAtom,
} from '~/store/satchiStore';
import { cleanSpeechText, extractMessageContent } from '~/utils/speechCleanup';
import { useLatestMessage } from '~/hooks/Messages/useLatestMessage';
import { useAuthContext } from '~/hooks';

interface LiveVoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ask: TAskFunction;
  isSubmitting: boolean;
}

type ConnectionState = 'connecting' | 'connected' | 'error' | 'closed';

type VoiceProfileId = 'in_female' | 'in_male' | 'us_female' | 'us_male' | 'uk_female' | 'uk_male';

interface VoiceOption {
  id: VoiceProfileId;
  label: string;
  shortLabel: string;
  lang: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'in_female', label: 'Indian Female (Neerja)', shortLabel: 'IN Female', lang: 'en-IN' },
  { id: 'in_male', label: 'Indian Male (Prabhat)', shortLabel: 'IN Male', lang: 'en-IN' },
  { id: 'us_female', label: 'US Female (Jenny)', shortLabel: 'US Female', lang: 'en-US' },
  { id: 'us_male', label: 'US Male (Guy)', shortLabel: 'US Male', lang: 'en-US' },
  { id: 'uk_female', label: 'UK Female (Sonia)', shortLabel: 'UK Female', lang: 'en-GB' },
  { id: 'uk_male', label: 'UK Male (Ryan)', shortLabel: 'UK Male', lang: 'en-GB' },
];

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: { transcript: string };
    };
  };
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const TOOL_INTENT_REGEX =
  /\b(search the web|web search|google|latest news|current price|generate an? image|create an? image|generate a video|deep research|check my vault|knowledge vault)\b/i;

const INTERNAL_INFRA_LEAK_REGEX =
  /bifrost|one-?api|cheap(?:er)?inference|deepinfra|openrouter|llamacpp|llama|:8700|:4000|:8080|virtual\s*key|x-bf-vk/i;
const GENERIC_VOICE_UNAVAILABLE =
  'Live Voice is temporarily unavailable right now. Please try again later.';

const ECHO_COOLDOWN_MS = 450;

function sanitizeVoiceError(rawMsg?: string): string {
  if (!rawMsg || INTERNAL_INFRA_LEAK_REGEX.test(rawMsg)) {
    return GENERIC_VOICE_UNAVAILABLE;
  }
  return rawMsg;
}

function formatMicError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Microphone permission denied. Please allow microphone access in your browser settings and retry.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'No microphone detected. Please connect a microphone and retry.';
    }
    if (err.name === 'NotReadableError') {
      return 'Microphone is currently in use by another application.';
    }
  }
  return 'Could not access microphone. Please check your browser audio permissions.';
}

function getInitialVoiceId(): VoiceProfileId {
  const stored = localStorage.getItem('satchida_voice_profile');
  if (stored && VOICE_OPTIONS.some((v) => v.id === stored)) {
    return stored as VoiceProfileId;
  }
  const legacyGender = localStorage.getItem('satchida_voice_gender');
  return legacyGender === 'male' ? 'in_male' : 'in_female';
}

export default function LiveVoiceModal({
  open,
  onOpenChange,
  ask,
  isSubmitting,
}: LiveVoiceModalProps) {
  const { token } = useAuthContext();
  const { showToast } = useToastContext();
  const currentMode = useAtomValue(satchiModeAtom);
  const webSearchEnabled = useAtomValue(satchiWebSearchAtom);
  const researchEnabled = useAtomValue(satchiResearchAtom);
  const imageGenEnabled = useAtomValue(satchiImageGenAtom);
  const activeTailMessage = useLatestMessage(0);

  const hasActiveComposerTools = Boolean(webSearchEnabled || researchEnabled || imageGenEnabled);

  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [statusText, setStatusText] = useState('Connecting...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [assistantTranscript, setAssistantTranscript] = useState('');
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [activeRoutingMode, setActiveRoutingMode] = useState<string>(currentMode || 'Chat');
  const [awaitingToolResponse, setAwaitingToolResponse] = useState(false);
  const [lastSpokenMessageId, setLastSpokenMessageId] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [voiceId, setVoiceId] = useState<VoiceProfileId>(getInitialVoiceId);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioQueueRef = useRef<Array<{ audioBase64: string; mimeType: string }>>([]);
  const isPlayingQueueRef = useRef<boolean>(false);
  const isAssistantSpeakingRef = useRef<boolean>(false);
  const ignoreSpeechUntilRef = useRef<number>(0);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const voiceIdRef = useRef(voiceId);
  voiceIdRef.current = voiceId;
  const currentModeRef = useRef(currentMode);
  currentModeRef.current = currentMode;
  const hasToolsRef = useRef(hasActiveComposerTools);
  hasToolsRef.current = hasActiveComposerTools;
  const askRef = useRef(ask);
  askRef.current = ask;

  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') {
      return null;
    }
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const pauseRecognitionForEchoGuard = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
    }
  }, []);

  const resumeRecognitionAfterEchoGuard = useCallback(() => {
    if (
      isMutedRef.current ||
      isAssistantSpeakingRef.current ||
      !recognitionRef.current ||
      wsRef.current?.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    const activeOpt = VOICE_OPTIONS.find((v) => v.id === voiceIdRef.current) || VOICE_OPTIONS[0];
    recognitionRef.current.lang = activeOpt.lang;
    try {
      recognitionRef.current.start();
    } catch {
      // Ignore already started
    }
  }, []);

  const stopAssistantAudio = useCallback(
    (resumeMic = true) => {
      audioQueueRef.current = [];
      isPlayingQueueRef.current = false;
      isAssistantSpeakingRef.current = false;
      ignoreSpeechUntilRef.current = Date.now() + ECHO_COOLDOWN_MS;

      if (finishTimerRef.current) {
        clearTimeout(finishTimerRef.current);
        finishTimerRef.current = null;
      }
      for (const src of activeSourcesRef.current) {
        try {
          src.stop();
          src.disconnect();
        } catch {
          // ignore
        }
      }
      activeSourcesRef.current = [];
      nextPlayTimeRef.current = 0;

      if (htmlAudioRef.current) {
        htmlAudioRef.current.onended = null;
        htmlAudioRef.current.onerror = null;
        htmlAudioRef.current.pause();
        htmlAudioRef.current.src = '';
        htmlAudioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsAssistantSpeaking(false);
      setStatusText(isMutedRef.current ? 'Muted' : 'Listening...');

      if (resumeMic) {
        setTimeout(() => {
          resumeRecognitionAfterEchoGuard();
        }, ECHO_COOLDOWN_MS);
      }
    },
    [resumeRecognitionAfterEchoGuard],
  );

  const schedulePcmChunk = useCallback(
    (base64: string) => {
      const ctx = getAudioContext();
      if (!ctx) {
        return;
      }

      // Convert base64 to Float32Array (16-bit little-endian PCM at 24000Hz)
      const binaryStr = window.atob(base64);
      const len = binaryStr.length;
      if (len < 2) {
        return;
      }
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(len / 2));
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startTime = Math.max(now + 0.02, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(source);
      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx !== -1) {
          activeSourcesRef.current.splice(idx, 1);
        }
      };

      // Continuous speaking state
      isAssistantSpeakingRef.current = true;
      pauseRecognitionForEchoGuard();
      setIsAssistantSpeaking(true);
      setStatusText('Speaking...');

      if (finishTimerRef.current) {
        clearTimeout(finishTimerRef.current);
      }
      const remainingMs = Math.max(50, Math.round((nextPlayTimeRef.current - ctx.currentTime) * 1000));
      finishTimerRef.current = setTimeout(() => {
        if (activeSourcesRef.current.length === 0) {
          isAssistantSpeakingRef.current = false;
          ignoreSpeechUntilRef.current = Date.now() + ECHO_COOLDOWN_MS;
          setIsAssistantSpeaking(false);
          setStatusText(isMutedRef.current ? 'Muted' : 'Listening...');
          setTimeout(() => {
            resumeRecognitionAfterEchoGuard();
          }, ECHO_COOLDOWN_MS);
        }
      }, remainingMs + 50);
    },
    [getAudioContext, pauseRecognitionForEchoGuard, resumeRecognitionAfterEchoGuard],
  );

  const playNextQueuedAudio = useCallback(() => {
    if (isPlayingQueueRef.current) {
      return;
    }
    const next = audioQueueRef.current.shift();
    if (!next) {
      isAssistantSpeakingRef.current = false;
      ignoreSpeechUntilRef.current = Date.now() + ECHO_COOLDOWN_MS;
      setIsAssistantSpeaking(false);
      setStatusText(isMutedRef.current ? 'Muted' : 'Listening...');
      setTimeout(() => {
        resumeRecognitionAfterEchoGuard();
      }, ECHO_COOLDOWN_MS);
      return;
    }

    isPlayingQueueRef.current = true;
    isAssistantSpeakingRef.current = true;
    // STRICT HALF-DUPLEX ECHO GUARD: stop SpeechRecognition while assistant audio plays
    pauseRecognitionForEchoGuard();
    setIsAssistantSpeaking(true);
    setStatusText('Speaking...');

    const audio = new Audio(`data:${next.mimeType};base64,${next.audioBase64}`);
    htmlAudioRef.current = audio;

    const finishChunk = () => {
      isPlayingQueueRef.current = false;
      htmlAudioRef.current = null;
      playNextQueuedAudio();
    };

    audio.onended = finishChunk;
    audio.onerror = finishChunk;
    void audio.play().catch(finishChunk);
  }, [pauseRecognitionForEchoGuard, resumeRecognitionAfterEchoGuard]);

  const enqueueAudioBase64 = useCallback(
    (audioBase64: string, mimeType: string) => {
      if (mimeType.includes('pcm')) {
        schedulePcmChunk(audioBase64);
        return;
      }
      audioQueueRef.current.push({ audioBase64, mimeType });
      playNextQueuedAudio();
    },
    [playNextQueuedAudio, schedulePcmChunk],
  );

  const cleanupSession = useCallback(() => {
    stopAssistantAudio(false);

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        void audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    nextPlayTimeRef.current = 0;

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close(1000, 'Session ended');
      }
      wsRef.current = null;
    }
  }, [stopAssistantAudio]);

  const reportError = useCallback(
    (msg: string) => {
      setConnectionState('error');
      setErrorMessage(msg);
      setStatusText('Unavailable');
      showToast({
        message: msg,
        status: 'error',
      });
    },
    [showToast],
  );

  // When a tool-delegated turn finishes via LibreChat's agent pipeline, synthesize & speak the reply
  useEffect(() => {
    if (!open || !awaitingToolResponse || !activeTailMessage || isSubmitting) {
      return;
    }
    if (!activeTailMessage.isCreatedByUser && activeTailMessage.messageId !== lastSpokenMessageId) {
      const rawText = extractMessageContent(activeTailMessage);
      const cleaned = cleanSpeechText(rawText).slice(0, 600);
      if (cleaned.length > 3) {
        setLastSpokenMessageId(activeTailMessage.messageId);
        setAwaitingToolResponse(false);
        setAssistantTranscript(cleaned);
        setStatusText('Speaking...');
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'voice.synthesize',
              text: cleaned,
              voice: voiceIdRef.current,
            }),
          );
        }
      }
    }
  }, [open, awaitingToolResponse, activeTailMessage, isSubmitting, lastSpokenMessageId]);

  const startSpeechRecognition = useCallback((ws: WebSocket) => {
    if (recognitionRef.current) {
      return;
    }
    const SpeechRecCtor =
      (window as unknown as { SpeechRecognition?: new () => BrowserSpeechRecognition })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeechRecognition })
        .webkitSpeechRecognition;

    if (!SpeechRecCtor) {
      return;
    }

    const activeOpt = VOICE_OPTIONS.find((v) => v.id === voiceIdRef.current) || VOICE_OPTIONS[0];
    const recognition = new SpeechRecCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = activeOpt.lang;
    recognitionRef.current = recognition;

    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      // Drop any acoustic echo while assistant is speaking or within post-speech cooldown tail
      if (
        isMutedRef.current ||
        isAssistantSpeakingRef.current ||
        Date.now() < ignoreSpeechUntilRef.current ||
        ws.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript || '';
        if (res.isFinal) {
          finalText += text;
        } else {
          interim += text;
        }
      }

      if (interim.trim()) {
        setSpokenTranscript(interim.trim());
        setStatusText('Listening...');
      }

      if (finalText.trim()) {
        const cleanFinal = finalText.trim();
        const needsTools = hasToolsRef.current || TOOL_INTENT_REGEX.test(cleanFinal);
        setSpokenTranscript(cleanFinal);
        setAssistantTranscript('');
        setStatusText(needsTools ? 'Running tools...' : 'Thinking...');
        ws.send(
          JSON.stringify({
            type: 'voice.turn',
            text: cleanFinal,
            voice: voiceIdRef.current,
            mode: currentModeRef.current || 'Chat',
            hasTools: needsTools,
          }),
        );
      }
    };

    recognition.onend = () => {
      if (
        recognitionRef.current === recognition &&
        !isMutedRef.current &&
        !isAssistantSpeakingRef.current &&
        ws.readyState === WebSocket.OPEN
      ) {
        setTimeout(() => {
          if (
            recognitionRef.current === recognition &&
            !isMutedRef.current &&
            !isAssistantSpeakingRef.current &&
            ws.readyState === WebSocket.OPEN
          ) {
            try {
              recognition.start();
            } catch {
              // Ignore already started
            }
          }
        }, 200);
      }
    };

    try {
      recognition.start();
    } catch {
      // Ignore start failure
    }
  }, []);

  useEffect(() => {
    if (!open) {
      cleanupSession();
      return;
    }

    let cancelled = false;
    setIsMuted(false);
    setErrorMessage(null);
    setSpokenTranscript('');
    setAssistantTranscript('');
    setAwaitingToolResponse(false);
    setConnectionState('connecting');
    setStatusText('Checking mic...');

    const startRealtimeSession = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        reportError(
          'Live Voice requires a browser with microphone capture support (HTTPS or localhost).',
        );
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        if (!cancelled) {
          reportError(formatMicError(err));
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      mediaStreamRef.current = stream;
      getAudioContext();

      setStatusText('Connecting...');

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams();
      if (token) {
        params.set('token', token);
      }
      params.set('mode', currentModeRef.current || 'Chat');
      params.set('voice', voiceIdRef.current);
      if (hasToolsRef.current) {
        params.set('tools', 'true');
      }
      const wsUrl = `${wsProtocol}//${window.location.host}/api/voice/realtime?${params.toString()}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      let receivedExplicitError = false;

      ws.onmessage = (event) => {
        if (cancelled || typeof event.data !== 'string') {
          return;
        }
        try {
          const msg = JSON.parse(event.data) as {
            type?: string;
            mode?: string;
            satchidaMode?: string;
            voiceId?: VoiceProfileId;
            label?: string;
            lang?: string;
            text?: string;
            delta?: string;
            transcript?: string;
            audioBase64?: string;
            mimeType?: string;
            error?: { message?: string; code?: string };
          };

          if (msg.type === 'session.created') {
            if (msg.satchidaMode) {
              setActiveRoutingMode(msg.satchidaMode);
            }
            if (msg.voiceId && VOICE_OPTIONS.some((v) => v.id === msg.voiceId)) {
              setVoiceId(msg.voiceId);
              localStorage.setItem('satchida_voice_profile', msg.voiceId);
            }
            setConnectionState('connected');
            setStatusText('Listening...');
            startSpeechRecognition(ws);
            return;
          }

          if (msg.type === 'voice.accent_changed' && msg.voiceId) {
            setVoiceId(msg.voiceId);
            localStorage.setItem('satchida_voice_profile', msg.voiceId);
            if (recognitionRef.current && msg.lang) {
              recognitionRef.current.lang = msg.lang;
            }
            return;
          }

          if (msg.type === 'voice.delegate_tools' && msg.text) {
            setAwaitingToolResponse(true);
            setStatusText('Executing tools...');
            askRef.current({ text: msg.text });
            return;
          }

          if (msg.type === 'error') {
            receivedExplicitError = true;
            reportError(sanitizeVoiceError(msg.error?.message));
            return;
          }

          if (msg.type === 'voice.interrupted') {
            stopAssistantAudio(true);
            return;
          }

          if (
            msg.type === 'conversation.item.input_audio_transcription.completed' &&
            msg.transcript
          ) {
            setSpokenTranscript(msg.transcript.trim());
            setAssistantTranscript('');
            setStatusText('Thinking...');
            return;
          }

          if (msg.type === 'response.audio_transcript.delta' && msg.delta) {
            setAssistantTranscript((prev) => prev + msg.delta);
            return;
          }

          if (msg.type === 'response.audio_transcript.done' && msg.transcript) {
            setAssistantTranscript(msg.transcript);
            return;
          }

          if ((msg.type === 'voice.audio_chunk' || msg.type === 'voice.audio') && msg.audioBase64) {
            enqueueAudioBase64(msg.audioBase64, msg.mimeType || 'audio/mpeg');
            return;
          }

          if (msg.type === 'voice.tts_fallback' && msg.transcript && 'speechSynthesis' in window) {
            pauseRecognitionForEchoGuard();
            isAssistantSpeakingRef.current = true;
            const utter = new SpeechSynthesisUtterance(msg.transcript);
            if (msg.lang) {
              utter.lang = msg.lang;
            }
            utter.onstart = () => {
              setIsAssistantSpeaking(true);
              setStatusText('Speaking...');
            };
            utter.onend = () => {
              isAssistantSpeakingRef.current = false;
              ignoreSpeechUntilRef.current = Date.now() + ECHO_COOLDOWN_MS;
              setIsAssistantSpeaking(false);
              setStatusText(isMutedRef.current ? 'Muted' : 'Listening...');
              setTimeout(() => resumeRecognitionAfterEchoGuard(), ECHO_COOLDOWN_MS);
            };
            window.speechSynthesis.speak(utter);
            return;
          }
        } catch {
          // Ignore non-JSON frames
        }
      };

      ws.onerror = () => {
        if (!cancelled && !receivedExplicitError) {
          receivedExplicitError = true;
          reportError(GENERIC_VOICE_UNAVAILABLE);
        }
      };

      ws.onclose = (event) => {
        if (cancelled) {
          return;
        }
        if (!receivedExplicitError && event.code !== 1000) {
          reportError(sanitizeVoiceError(event.reason) || GENERIC_VOICE_UNAVAILABLE);
        }
      };
    };

    void startRealtimeSession();

    return () => {
      cancelled = true;
      cleanupSession();
    };
  }, [
    open,
    retryNonce,
    token,
    cleanupSession,
    enqueueAudioBase64,
    pauseRecognitionForEchoGuard,
    reportError,
    resumeRecognitionAfterEchoGuard,
    startSpeechRecognition,
  ]);

  if (!open) {
    return null;
  }

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      setStatusText(next ? 'Muted' : isAssistantSpeaking ? 'Speaking...' : 'Listening...');
      if (next) {
        pauseRecognitionForEchoGuard();
      } else {
        setTimeout(() => resumeRecognitionAfterEchoGuard(), 100);
      }
      return next;
    });
  };

  const handleAccentChange = (nextVoiceId: VoiceProfileId) => {
    setVoiceId(nextVoiceId);
    localStorage.setItem('satchida_voice_profile', nextVoiceId);
    const opt = VOICE_OPTIONS.find((v) => v.id === nextVoiceId);
    if (recognitionRef.current && opt) {
      recognitionRef.current.lang = opt.lang;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'voice.set_accent',
          voice: nextVoiceId,
        }),
      );
    }
  };

  const handleRetry = () => {
    cleanupSession();
    setRetryNonce((n) => n + 1);
  };

  const isListening = connectionState === 'connected' && !isMuted && !isAssistantSpeaking;
  const currentVoiceOpt = VOICE_OPTIONS.find((v) => v.id === voiceId) || VOICE_OPTIONS[0];

  // Compact minimized floating pill (non-blocking)
  if (isMinimized) {
    return (
      <div className="pointer-events-auto fixed bottom-24 right-6 z-50 flex items-center gap-2 rounded-full border border-violet-500/40 bg-surface-primary/95 px-3 py-2 text-text-primary shadow-2xl backdrop-blur-xl">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${
              isAssistantSpeaking ? 'bg-fuchsia-400' : isMuted ? 'bg-red-400' : 'bg-emerald-400'
            } opacity-75`}
          />
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
              isAssistantSpeaking ? 'bg-fuchsia-500' : isMuted ? 'bg-red-500' : 'bg-emerald-500'
            }`}
          />
        </span>
        <span className="whitespace-nowrap text-xs font-semibold">
          {statusText} · {currentVoiceOpt.shortLabel}
        </span>
        {isAssistantSpeaking && (
          <button
            type="button"
            onClick={() => stopAssistantAudio(true)}
            className="rounded-full bg-amber-500/20 p-1 text-amber-300 hover:bg-amber-500/30"
            title="Interrupt & Speak"
            aria-label="Interrupt and speak"
          >
            <Square className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="rounded-full p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          aria-label="Expand Live Voice"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-full p-1 text-red-400 hover:bg-red-500/20"
          aria-label="End Live Voice"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Non-blocking floating Live Voice Dock — chat page stays 100% interactive behind it
  return (
    <div
      role="region"
      aria-label="Satchida Live Voice"
      className="pointer-events-auto fixed bottom-24 right-6 z-50 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-violet-500/35 bg-surface-primary/95 p-4 text-text-primary shadow-2xl backdrop-blur-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${
                connectionState === 'error'
                  ? 'bg-red-400'
                  : isAssistantSpeaking
                    ? 'bg-fuchsia-400'
                    : isMuted
                      ? 'bg-red-400'
                      : connectionState === 'connecting'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
              } opacity-75`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                connectionState === 'error'
                  ? 'bg-red-500'
                  : isAssistantSpeaking
                    ? 'bg-fuchsia-500'
                    : isMuted
                      ? 'bg-red-500'
                      : connectionState === 'connecting'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="text-xs font-bold tracking-wide text-text-primary">
            Satchida Live Voice
          </span>
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
            {activeRoutingMode}
            {hasActiveComposerTools ? ' + Tools' : ''}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            aria-label="Minimize Live Voice"
            title="Minimize"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            aria-label="Close Live Voice"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Interactive Orb + Status */}
      <div className="my-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (isAssistantSpeaking) {
              stopAssistantAudio(true);
            } else {
              toggleMute();
            }
          }}
          title={isAssistantSpeaking ? 'Tap to interrupt and speak' : isMuted ? 'Unmute' : 'Mute'}
          className={`bg-linear-to-br relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-violet-400/40 from-violet-600/85 via-purple-700/85 to-indigo-900/90 shadow-lg shadow-violet-500/20 transition-transform active:scale-95 ${
            isAssistantSpeaking
              ? 'scale-105 ring-4 ring-fuchsia-400/40'
              : isListening
                ? 'ring-2 ring-emerald-400/30'
                : ''
          }`}
        >
          {connectionState === 'error' ? (
            <AlertCircle className="h-6 w-6 text-red-400" />
          ) : isAssistantSpeaking ? (
            <Volume2 className="h-6 w-6 animate-pulse text-white" />
          ) : isMuted ? (
            <MicOff className="h-6 w-6 text-red-400" />
          ) : (
            <Mic className="h-6 w-6 text-violet-100" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            {statusText}
          </div>
          {errorMessage ? (
            <div
              role="alert"
              className="mt-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs leading-snug text-red-300"
            >
              {errorMessage}
            </div>
          ) : (
            <div className="mt-1 max-h-20 overflow-y-auto text-xs leading-relaxed text-text-secondary">
              {assistantTranscript ? (
                <span className="text-text-primary">{assistantTranscript}</span>
              ) : spokenTranscript ? (
                <span className="italic text-text-primary">&ldquo;{spokenTranscript}&rdquo;</span>
              ) : (
                <span>Speak naturally, or say &ldquo;switch to US male accent&rdquo;.</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Accent Selector */}
      <div className="mb-3 flex items-center gap-2">
        <Globe className="h-3.5 w-3.5 shrink-0 text-violet-400" />
        <select
          aria-label="Select Voice Accent"
          value={voiceId}
          onChange={(e) => handleAccentChange(e.target.value as VoiceProfileId)}
          className="w-full rounded-lg border border-border-light bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-text-primary outline-none focus:border-violet-400"
        >
          {VOICE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-2">
        {connectionState === 'error' ? (
          <button
            type="button"
            onClick={handleRetry}
            className="flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-300 transition-all hover:bg-violet-500/25"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        ) : isAssistantSpeaking ? (
          <button
            type="button"
            onClick={() => stopAssistantAudio(true)}
            className="flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-500/25"
          >
            <Square className="h-3.5 w-3.5" />
            <span>Interrupt</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleMute}
            className={`flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
              isMuted
                ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'border-border-light bg-surface-secondary text-text-primary hover:bg-surface-hover'
            }`}
          >
            {isMuted ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20"
        >
          End
        </button>
      </div>
    </div>
  );
}
