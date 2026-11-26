import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtom } from 'jotai';
import { useToastContext } from '@librechat/client';
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
  Copy,
  Check,
  CloudSun,
} from 'lucide-react';
import type { SatchiMode } from '~/store/satchiStore';
import type { TAskFunction } from '~/common';
import {
  satchiModeAtom,
  satchiWebSearchAtom,
  satchiResearchAtom,
  satchiImageGenAtom,
  satchiThinkAtom,
} from '~/store/satchiStore';
import { cleanSpeechText, extractMessageContent } from '~/utils/speechCleanup';
import { getSharedVoiceAudioContext } from '~/utils/voiceAudioContext';
import { useLatestMessage } from '~/hooks/Messages/useLatestMessage';
import { useAuthContext, useLocalize, useNewConvo } from '~/hooks';
import { UtterancePitchTracker } from '~/utils/voicePitch';
import OrbVisualizer from './OrbVisualizer';

interface LiveVoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ask: TAskFunction;
  isSubmitting: boolean;
}

type VoiceActionCard =
  | { kind: 'maps'; title: string; subtitle?: string; mapUrl: string; embedUrl?: string }
  | {
      kind: 'weather';
      city: string;
      tempC: number;
      condition: string;
      highC?: number;
      lowC?: number;
      aqi?: number;
      aqiLabel?: string;
      pm25?: number;
    }
  | { kind: 'news'; query: string; items: Array<{ title: string; url: string; source?: string }> }
  | { kind: 'tutor'; title: string; subtitle?: string }
  | {
      kind: 'media';
      platform: 'youtube' | 'spotify';
      title: string;
      query: string;
      openUrl: string;
      embedUrl?: string;
      installUrl?: string;
    };

type ConnectionState = 'connecting' | 'connected' | 'error' | 'closed';

type VoiceProfileId = 'in_female' | 'in_male' | 'us_female' | 'us_male' | 'uk_female' | 'uk_male';

interface VoiceOption {
  id: VoiceProfileId;
  label: string;
  shortLabel: string;
  lang: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'in_female',
    label: 'Indian Female (Neerja / Kore)',
    shortLabel: 'IN Female',
    lang: 'en-IN',
  },
  { id: 'in_male', label: 'Indian Male (Prabhat / Puck)', shortLabel: 'IN Male', lang: 'en-IN' },
  { id: 'us_female', label: 'US Female (Jenny / Aoede)', shortLabel: 'US Female', lang: 'en-US' },
  { id: 'us_male', label: 'US Male (Guy / Fenrir)', shortLabel: 'US Male', lang: 'en-US' },
  { id: 'uk_female', label: 'UK Female (Sonia / Aoede)', shortLabel: 'UK Female', lang: 'en-GB' },
  { id: 'uk_male', label: 'UK Male (Ryan / Charon)', shortLabel: 'UK Male', lang: 'en-GB' },
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
  const [currentMode, setCurrentMode] = useAtom(satchiModeAtom);
  const [webSearchEnabled, setWebSearchEnabled] = useAtom(satchiWebSearchAtom);
  const [researchEnabled, setResearchEnabled] = useAtom(satchiResearchAtom);
  const [imageGenEnabled, setImageGenEnabled] = useAtom(satchiImageGenAtom);
  const [_thinkLevel, setThinkLevel] = useAtom(satchiThinkAtom);
  const activeTailMessage = useLatestMessage(0);

  const hasActiveComposerTools = Boolean(webSearchEnabled || researchEnabled || imageGenEnabled);

  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [statusText, setStatusText] = useState('Connecting...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const localize = useLocalize();
  const [assistantTranscript, setAssistantTranscript] = useState('');
  const [actionCard, setActionCard] = useState<VoiceActionCard | null>(null);
  const [cardHistory, setCardHistory] = useState<VoiceActionCard[]>([]);
  const [transcriptHistory, setTranscriptHistory] = useState<
    Array<{ role: 'user' | 'assistant'; text: string; time: string }>
  >([]);
  const [showTranscriptDrawer, setShowTranscriptDrawer] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  const touchStartYRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobileViewport(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (showTranscriptDrawer) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptHistory.length, showTranscriptDrawer]);

  // Keep mobile screen awake while Live Voice is open (hands-free / driving)
  useEffect(() => {
    if (!open || typeof navigator === 'undefined') {
      return;
    }
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (nav.wakeLock) {
          const lock = await nav.wakeLock.request('screen');
          if (cancelled) {
            void lock.release();
          } else {
            sentinel = lock;
          }
        }
      } catch {
        // Wake Lock not supported or denied
      }
    };
    void acquire();
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) {
        void sentinel.release().catch(() => {});
      }
    };
  }, [open]);
  const [translatorMode, setTranslatorMode] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [micStreaming, setMicStreaming] = useState(false);
  const [_activeRoutingMode, setActiveRoutingMode] = useState<string>(currentMode || 'Chat');
  const [awaitingToolResponse, setAwaitingToolResponse] = useState(false);
  const [lastSpokenMessageId, setLastSpokenMessageId] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [voiceId, setVoiceId] = useState<VoiceProfileId>(getInitialVoiceId);
  const [liveVoiceMode, setLiveVoiceMode] = useState<'discussion' | 'work'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('satchida_voice_mode');
      if (stored === 'work' || stored === 'discussion') {
        return stored;
      }
    }
    return 'discussion';
  });
  const liveVoiceModeRef = useRef(liveVoiceMode);
  liveVoiceModeRef.current = liveVoiceMode;

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackGainRef = useRef<GainNode | null>(null);
  const captureCleanupRef = useRef<(() => void) | null>(null);
  const captureNodeRef = useRef<AudioNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const playbackDeadlineRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioQueueRef = useRef<Array<{ audioBase64: string; mimeType: string }>>([]);
  const pitchTrackerRef = useRef<UtterancePitchTracker>(new UtterancePitchTracker());
  const pitchFrameCounterRef = useRef<number>(0);
  const isPlayingQueueRef = useRef<boolean>(false);
  const isAssistantSpeakingRef = useRef<boolean>(false);
  const sessionModeRef = useRef<'gemini_live_s2s' | 'bifrost_bridge'>('gemini_live_s2s');
  const hasGreetedRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const { newConversation } = useNewConvo();
  const newConvoRef = useRef(newConversation);
  newConvoRef.current = newConversation;

  const getAudioContext = useCallback((): AudioContext | null => {
    const ctx = getSharedVoiceAudioContext();
    if (ctx) {
      audioContextRef.current = ctx;
    }
    return ctx;
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
      const ctx = audioContextRef.current;
      const gainNode = playbackGainRef.current;
      if (ctx && gainNode) {
        try {
          const t = ctx.currentTime;
          gainNode.gain.cancelScheduledValues(t);
          gainNode.gain.setValueAtTime(gainNode.gain.value, t);
          gainNode.gain.linearRampToValueAtTime(0.0001, t + 0.006);
        } catch {
          // ignore
        }
      }
      for (const src of activeSourcesRef.current) {
        try {
          src.stop(ctx ? ctx.currentTime + 0.008 : 0);
          src.disconnect();
        } catch {
          // ignore
        }
      }
      activeSourcesRef.current = [];
      nextPlayTimeRef.current = 0;
      if (ctx && gainNode) {
        try {
          gainNode.gain.setValueAtTime(1, ctx.currentTime + 0.01);
        } catch {
          // ignore
        }
      }

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

  const markPlaybackIdle = useCallback(() => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    isAssistantSpeakingRef.current = false;
    ignoreSpeechUntilRef.current = Date.now() + ECHO_COOLDOWN_MS;
    setIsAssistantSpeaking(false);
    setStatusText(isMutedRef.current ? 'Muted' : 'Listening...');
    setTimeout(() => {
      resumeRecognitionAfterEchoGuard();
    }, ECHO_COOLDOWN_MS);
  }, [resumeRecognitionAfterEchoGuard]);

  const schedulePcmChunk = useCallback(
    (base64: string) => {
      const ctx = getAudioContext();
      if (!ctx) {
        return;
      }
      if (ctx.state === 'suspended') {
        void ctx.resume();
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
      if (!playbackGainRef.current) {
        const g = ctx.createGain();
        g.gain.value = 1;
        g.connect(ctx.destination);
        playbackGainRef.current = g;
      }
      source.connect(playbackGainRef.current);

      const now = ctx.currentTime;
      const startTime = Math.max(now + 0.04, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.push(source);
      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx !== -1) {
          activeSourcesRef.current.splice(idx, 1);
        }
        if (activeSourcesRef.current.length === 0) {
          markPlaybackIdle();
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
      const remainingMs = Math.max(
        50,
        Math.round((nextPlayTimeRef.current - ctx.currentTime) * 1000),
      );
      playbackDeadlineRef.current = Date.now() + remainingMs + 600;
      const scheduleCheck = (delayMs: number) => {
        finishTimerRef.current = setTimeout(() => {
          if (
            activeSourcesRef.current.length === 0 ||
            ctx.state !== 'running' ||
            Date.now() > playbackDeadlineRef.current
          ) {
            activeSourcesRef.current = [];
            markPlaybackIdle();
          } else {
            // Timer fired slightly before onended — poll shortly so speaking state never gets stuck
            scheduleCheck(100);
          }
        }, delayMs);
      };
      scheduleCheck(remainingMs + 80);
    },
    [getAudioContext, markPlaybackIdle, pauseRecognitionForEchoGuard],
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

    if (captureCleanupRef.current) {
      try {
        captureCleanupRef.current();
      } catch {
        // ignore
      }
      captureCleanupRef.current = null;
    }
    captureNodeRef.current = null;
    if (playbackGainRef.current) {
      try {
        playbackGainRef.current.disconnect();
      } catch {
        // ignore
      }
      playbackGainRef.current = null;
    }
    audioContextRef.current = null;
    nextPlayTimeRef.current = 0;
    playbackDeadlineRef.current = 0;
    setMicStreaming(false);
    setActionCard(null);
    setTranslatorMode(false);
    window.dispatchEvent(new CustomEvent('satchida:voice-session-ended'));

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
        setStatusText('Explaining...');
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          if (sessionModeRef.current === 'gemini_live_s2s') {
            wsRef.current.send(
              JSON.stringify({
                type: 'voice.tutor_explain',
                text: rawText.slice(0, 4000),
              }),
            );
          } else {
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
    }
  }, [open, awaitingToolResponse, activeTailMessage, isSubmitting, lastSpokenMessageId]);

  const handleAccentChange = useCallback((nextVoiceId: VoiceProfileId) => {
    setVoiceId(nextVoiceId);
    voiceIdRef.current = nextVoiceId;
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
  }, []);

  const startCloudAudioStream = useCallback(
    (ws: WebSocket) => {
      const stream = mediaStreamRef.current;
      if (!stream || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      // Clean up any existing capture pipeline (e.g. on dynamic voice switch)
      if (captureCleanupRef.current) {
        try {
          captureCleanupRef.current();
        } catch {
          // ignore
        }
        captureCleanupRef.current = null;
        captureNodeRef.current = null;
      }

      let hasProducedChunk = false;
      let workletWatchdog: ReturnType<typeof setTimeout> | null = null;
      let zeroOnlyWorkletFrames = 0;
      let usingWorklet = false;
      let fallbackToScriptProcessor: (() => void) | null = null;

      const sendPcmChunk = (input: Float32Array, nativeSampleRate: number) => {
        if (!hasProducedChunk) {
          hasProducedChunk = true;
          if (workletWatchdog) {
            clearTimeout(workletWatchdog);
            workletWatchdog = null;
          }
          setMicStreaming(true);
        }
        if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) {
          return;
        }
        if (usingWorklet && fallbackToScriptProcessor) {
          let maxAbs = 0;
          for (let i = 0; i < input.length; i += 8) {
            const v = Math.abs(input[i]);
            if (v > maxAbs) {
              maxAbs = v;
            }
          }
          if (maxAbs === 0) {
            zeroOnlyWorkletFrames += 1;
            if (zeroOnlyWorkletFrames === 35) {
              usingWorklet = false;
              fallbackToScriptProcessor();
              return;
            }
          } else {
            zeroOnlyWorkletFrames = 0;
          }
        }
        const TARGET_RATE = 16000;
        const ratio = nativeSampleRate / TARGET_RATE;
        const outLen = ratio > 1 ? Math.floor(input.length / ratio) : input.length;
        const pcm16 = new Int16Array(outLen);
        for (let i = 0; i < outLen; i++) {
          let sample: number;
          if (ratio > 1) {
            const pos = i * ratio;
            const idx = Math.floor(pos);
            const frac = pos - idx;
            const s0 = input[idx] ?? 0;
            const s1 = input[Math.min(idx + 1, input.length - 1)] ?? s0;
            sample = s0 + (s1 - s0) * frac;
          } else {
            sample = input[i];
          }
          const s = Math.max(-1, Math.min(1, sample));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        ws.send(
          JSON.stringify({
            type: 'voice.audio_input',
            audioBase64: btoa(binary),
            mimeType: 'audio/pcm;rate=16000',
          }),
        );
        pitchTrackerRef.current.pushFrame(input, nativeSampleRate);
        pitchFrameCounterRef.current += 1;
        if (pitchFrameCounterRef.current >= 24) {
          pitchFrameCounterRef.current = 0;
          const stats = pitchTrackerRef.current.flush();
          if (stats && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'voice.acoustic_meta',
                avgPitchHz: stats.avgPitchHz,
                pitchStdHz: stats.pitchStdHz,
              }),
            );
          }
        }
      };

      try {
        // Reuse the already-unlocked AudioContext so Android Chrome never leaves capture suspended
        const captureCtx = getAudioContext();
        if (!captureCtx) {
          return;
        }
        if (captureCtx.state === 'suspended') {
          void captureCtx.resume();
        }
        const nativeSampleRate = captureCtx.sampleRate;
        const source = captureCtx.createMediaStreamSource(stream);
        const silentGain = captureCtx.createGain();
        // Keep gain tiny but non-zero (-100 dB) so Chromium never optimizes away the capture node
        silentGain.gain.value = 0.00001;
        silentGain.connect(captureCtx.destination);

        let aborted = false;
        const teardown = () => {
          aborted = true;
          if (workletWatchdog) {
            clearTimeout(workletWatchdog);
            workletWatchdog = null;
          }
          try {
            if (captureNodeRef.current) {
              captureNodeRef.current.disconnect();
              captureNodeRef.current = null;
            }
            source.disconnect();
            silentGain.disconnect();
          } catch {
            // ignore
          }
        };
        captureCleanupRef.current = teardown;

        const startScriptProcessor = () => {
          if (aborted || ws.readyState !== WebSocket.OPEN) {
            teardown();
            return;
          }

          const processor = captureCtx.createScriptProcessor(4096, 1, 1);
          captureNodeRef.current = processor;
          processor.onaudioprocess = (e) => {
            sendPcmChunk(e.inputBuffer.getChannelData(0), nativeSampleRate);
          };
          source.connect(processor);
          processor.connect(silentGain);
        };

        // Prefer AudioWorklet (Chrome 66+, Safari 14.1+, Firefox 76+)
        // Buffer 2048 samples (~85ms at 24kHz) and connect through silentGain so Chrome always pulls process()
        const tryWorklet = async () => {
          const workletCode = `
          class PcmCapture extends AudioWorkletProcessor {
            constructor() {
              super();
              this._buf = new Float32Array(2048);
              this._offset = 0;
            }
            process(inputs) {
              const ch = inputs[0]?.[0];
              if (!ch) return true;
              let i = 0;
              while (i < ch.length) {
                const take = Math.min(ch.length - i, this._buf.length - this._offset);
                this._buf.set(ch.subarray(i, i + take), this._offset);
                this._offset += take;
                i += take;
                if (this._offset >= this._buf.length) {
                  this.port.postMessage(this._buf.slice());
                  this._offset = 0;
                }
              }
              return true;
            }
          }
          if (!globalThis.__satchidaPcmRegistered) {
            globalThis.__satchidaPcmRegistered = true;
            registerProcessor('pcm-capture', PcmCapture);
          }
        `;
          const blob = new Blob([workletCode], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          try {
            await captureCtx.audioWorklet.addModule(url);
            URL.revokeObjectURL(url);
            if (aborted || ws.readyState !== WebSocket.OPEN) {
              teardown();
              return;
            }
            const workletNode = new AudioWorkletNode(captureCtx, 'pcm-capture');
            captureNodeRef.current = workletNode;
            usingWorklet = true;
            fallbackToScriptProcessor = () => {
              try {
                workletNode.port.onmessage = null;
                workletNode.disconnect();
              } catch {
                // ignore
              }
              captureNodeRef.current = null;
              startScriptProcessor();
            };
            workletNode.port.onmessage = (ev: MessageEvent<Float32Array>) => {
              sendPcmChunk(ev.data, nativeSampleRate);
            };
            source.connect(workletNode);
            workletNode.connect(silentGain);
            captureCleanupRef.current = () => {
              usingWorklet = false;
              workletNode.port.onmessage = null;
              teardown();
            };
            // Some Android Chrome / WebView builds load AudioWorklet without throwing,
            // yet never invoke process(). Fall back to ScriptProcessor if silent after 1.2s.
            workletWatchdog = setTimeout(() => {
              if (!aborted && !hasProducedChunk && ws.readyState === WebSocket.OPEN) {
                usingWorklet = false;
                fallbackToScriptProcessor?.();
              }
            }, 1200);
          } catch {
            URL.revokeObjectURL(url);
            startScriptProcessor();
          }
        };

        if (typeof captureCtx.audioWorklet?.addModule === 'function') {
          void tryWorklet();
        } else {
          startScriptProcessor();
        }

        ws.addEventListener(
          'close',
          () => {
            if (captureCleanupRef.current === teardown) {
              captureCleanupRef.current = null;
            }
            teardown();
          },
          { once: true },
        );
        setStatusText('Listening (Realtime)...');
      } catch {
        // Ignore capture setup errors
      }
    },
    [getAudioContext],
  );

  const startSpeechRecognition = useCallback(
    (ws: WebSocket) => {
      if (recognitionRef.current) {
        return;
      }
      const SpeechRecCtor =
        (window as unknown as { SpeechRecognition?: new () => BrowserSpeechRecognition })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeechRecognition })
          .webkitSpeechRecognition;

      if (!SpeechRecCtor) {
        startCloudAudioStream(ws);
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
          const lower = cleanFinal.toLowerCase();

          // 1. Voice UI Control: Satchida Mode Switching
          if (/\b(?:switch|change|set)\s+(?:to\s+)?work(?:\s+mode)?\b/i.test(lower)) {
            setCurrentMode('Work');
            setLiveVoiceMode('work');
            localStorage.setItem('satchida_voice_mode', 'work');
            setStatusText('Work mode active');
            setSpokenTranscript('Switched to Work mode');
            showToast({ message: 'Mode: Work', status: 'info' });
            return;
          }
          if (/\b(?:switch|change|set)\s+(?:to\s+)?study(?:\s+mode)?\b/i.test(lower)) {
            setCurrentMode('Study');
            setStatusText('Study mode active');
            setSpokenTranscript('Switched to Study mode');
            showToast({ message: 'Mode: Study', status: 'info' });
            return;
          }
          if (
            /\b(?:switch|change|set)\s+(?:to\s+)?(?:discussion|chat)(?:\s+mode)?\b/i.test(lower)
          ) {
            setCurrentMode('Chat');
            setLiveVoiceMode('discussion');
            localStorage.setItem('satchida_voice_mode', 'discussion');
            setStatusText('Discussion mode active');
            setSpokenTranscript('Switched to Discussion mode');
            showToast({ message: 'Mode: Discussion', status: 'info' });
            return;
          }
          if (
            /\b(?:switch|change|set)\s+(?:to\s+)?(?:vibe\s*coding|coding|coder)(?:\s+mode)?\b/i.test(
              lower,
            )
          ) {
            setCurrentMode('VibeCoder');
            setStatusText('VibeCoder mode active');
            setSpokenTranscript('Switched to VibeCoder mode');
            showToast({ message: 'Mode: VibeCoder', status: 'info' });
            return;
          }
          if (/\b(?:switch|change|set)\s+(?:to\s+)?privacy(?:\s+mode)?\b/i.test(lower)) {
            setCurrentMode('Privacy');
            setStatusText('Privacy mode active');
            setSpokenTranscript('Switched to Privacy mode');
            showToast({ message: 'Mode: Privacy', status: 'info' });
            return;
          }

          // 2. Voice UI Control: Tool and MCP Toggles
          if (/\b(?:enable|turn on|activate)\s+web\s*search\b/i.test(lower)) {
            setWebSearchEnabled(true);
            setStatusText('Web Search enabled');
            setSpokenTranscript('Enabled Web Search');
            showToast({ message: 'Web Search: ON', status: 'success' });
            return;
          }
          if (/\b(?:disable|turn off|deactivate)\s+web\s*search\b/i.test(lower)) {
            setWebSearchEnabled(false);
            setStatusText('Web Search disabled');
            setSpokenTranscript('Disabled Web Search');
            showToast({ message: 'Web Search: OFF', status: 'info' });
            return;
          }
          if (/\b(?:enable|turn on|activate)\s+(?:deep\s+)?research\b/i.test(lower)) {
            setResearchEnabled(true);
            setStatusText('Deep Research enabled');
            setSpokenTranscript('Enabled Deep Research');
            showToast({ message: 'Deep Research: ON', status: 'success' });
            return;
          }
          if (/\b(?:disable|turn off|deactivate)\s+(?:deep\s+)?research\b/i.test(lower)) {
            setResearchEnabled(false);
            setStatusText('Deep Research disabled');
            setSpokenTranscript('Disabled Deep Research');
            showToast({ message: 'Deep Research: OFF', status: 'info' });
            return;
          }
          if (/\b(?:enable|turn on|activate)\s+image\s*(?:gen|generation)\b/i.test(lower)) {
            setImageGenEnabled(true);
            setStatusText('Image generation enabled');
            setSpokenTranscript('Enabled Image Generation');
            showToast({ message: 'Image Generation: ON', status: 'success' });
            return;
          }
          if (/\b(?:disable|turn off|deactivate)\s+image\s*(?:gen|generation)\b/i.test(lower)) {
            setImageGenEnabled(false);
            setStatusText('Image generation disabled');
            setSpokenTranscript('Disabled Image Generation');
            showToast({ message: 'Image Generation: OFF', status: 'info' });
            return;
          }
          if (/\b(?:enable|turn on|activate)\s+(?:deep\s+)?thinking\b/i.test(lower)) {
            setThinkLevel('high');
            setStatusText('Deep Thinking enabled');
            setSpokenTranscript('Enabled Deep Thinking');
            showToast({ message: 'Thinking: High', status: 'success' });
            return;
          }
          if (/\b(?:disable|turn off|deactivate)\s+(?:deep\s+)?thinking\b/i.test(lower)) {
            setThinkLevel('off');
            setStatusText('Thinking disabled');
            setSpokenTranscript('Disabled Thinking');
            showToast({ message: 'Thinking: Off', status: 'info' });
            return;
          }

          // 3. Verbal accent/voice switch commands
          if (
            /\b(switch|change|use|set|speak|talk)\b/i.test(lower) &&
            /\b(accent|voice|male|female|us|american|uk|british|indian|india)\b/i.test(lower)
          ) {
            const currentOpt = VOICE_OPTIONS.find((v) => v.id === voiceIdRef.current);
            let nextRegion: 'in' | 'us' | 'uk' = 'in';
            if (currentOpt?.id.startsWith('us')) {
              nextRegion = 'us';
            } else if (currentOpt?.id.startsWith('uk')) {
              nextRegion = 'uk';
            }
            if (/\b(us|u\.s\.|american|united states)\b/i.test(lower)) {
              nextRegion = 'us';
            } else if (/\b(uk|u\.k\.|british|england|london)\b/i.test(lower)) {
              nextRegion = 'uk';
            } else if (/\b(indian|india)\b/i.test(lower)) {
              nextRegion = 'in';
            }

            let nextGender: 'female' | 'male' =
              currentOpt?.id.includes('male') && !currentOpt?.id.includes('female')
                ? 'male'
                : 'female';
            if (/\b(male|man|guy|boy)\b/i.test(lower)) {
              nextGender = 'male';
            } else if (/\b(female|woman|lady|girl)\b/i.test(lower)) {
              nextGender = 'female';
            }

            const nextId = `${nextRegion}_${nextGender}` as VoiceProfileId;
            handleAccentChange(nextId);
            const found = VOICE_OPTIONS.find((v) => v.id === nextId);
            setStatusText(`Switched to ${found?.shortLabel || nextId}`);
            setSpokenTranscript(`Switched to ${found?.label || nextId}`);
            showToast({ message: `Voice: ${found?.shortLabel || nextId}`, status: 'info' });
            return;
          }

          // 4. Work mode, explicit chat insertion, or autonomous deep-research intent
          const isExplicitChatCommand =
            /\b(insert into chat|send to chat|type in chat|write in chat|ask in chat|put in chat)\b/i.test(
              cleanFinal,
            );
          const isDeepResearchCommand =
            /\b(deep\s+research|research\s+this|look\s+into|find\s+out\s+everything|analyze\s+and\s+summarize|summarize\s+research\s+on)\b/i.test(
              cleanFinal,
            );
          const isWorkIntent =
            liveVoiceModeRef.current === 'work' || isExplicitChatCommand || isDeepResearchCommand;

          if (isWorkIntent) {
            if (isDeepResearchCommand) {
              setWebSearchEnabled(true);
              setResearchEnabled(true);
            }
            const promptForChat =
              cleanFinal
                .replace(
                  /^(?:please\s+)?(?:insert|send|type|write|ask|put)\s+(?:this\s+)?(?:in|into|to)\s+chat(?:\s*[:,-]?\s*)?/i,
                  '',
                )
                .trim() || cleanFinal;

            setSpokenTranscript(cleanFinal);
            setAssistantTranscript('');
            setStatusText(
              isDeepResearchCommand ? 'Researching in chat...' : 'Executing in chat...',
            );
            setAwaitingToolResponse(true);
            askRef.current({ text: promptForChat });
            return;
          }

          // 4. Default: Live S2S Discussion turn
          setSpokenTranscript(cleanFinal);
          setAssistantTranscript('');
          setStatusText('Thinking...');
          ws.send(
            JSON.stringify({
              type: 'voice.turn',
              text: cleanFinal,
              voice: voiceIdRef.current,
              mode: 'discussion',
              hasTools: false,
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

      recognition.onerror = () => {
        // Browser STT unavailable or blocked (e.g. Brave/Firefox/iOS Safari): fall back seamlessly to Cloud Realtime PCM
        try {
          recognition.stop();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
        startCloudAudioStream(ws);
      };

      try {
        recognition.start();
      } catch {
        recognitionRef.current = null;
        startCloudAudioStream(ws);
      }
    },
    [
      handleAccentChange,
      setCurrentMode,
      setImageGenEnabled,
      setResearchEnabled,
      setThinkLevel,
      setWebSearchEnabled,
      showToast,
      startCloudAudioStream,
    ],
  );

  useEffect(() => {
    if (!open) {
      cleanupSession();
      return;
    }

    let cancelled = false;
    hasGreetedRef.current = false;
    setIsMuted(false);
    setErrorMessage(null);
    setSpokenTranscript('');
    setAssistantTranscript('');
    setAwaitingToolResponse(false);
    setConnectionState('connecting');
    setStatusText('Checking mic...');
    // Unlock AudioContext immediately on modal open (closer to user gesture for Android Chrome)
    getAudioContext();

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
      params.set('localHour', String(new Date().getHours()));
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
            status?: string;
            isVoiceSwitch?: boolean;
            webSearch?: boolean;
            deepResearch?: boolean;
            newChat?: boolean;
            action?: string;
            value?: string;
            title?: string;
            subtitle?: string;
            mapUrl?: string;
            card?: VoiceActionCard;
            autoSendToChat?: boolean;
            query?: string;
            context?: string;
            enabled?: boolean;
            text?: string;
            delta?: string;
            transcript?: string;
            audioBase64?: string;
            mimeType?: string;
            error?: { message?: string; code?: string };
          };

          if (msg.type === 'session.created') {
            reconnectAttemptsRef.current = 0;
            sessionModeRef.current =
              msg.mode === 'bifrost_bridge' ? 'bifrost_bridge' : 'gemini_live_s2s';
            if (msg.satchidaMode) {
              setActiveRoutingMode(msg.satchidaMode);
            }
            if (msg.voiceId && VOICE_OPTIONS.some((v) => v.id === msg.voiceId)) {
              setVoiceId(msg.voiceId);
              localStorage.setItem('satchida_voice_profile', msg.voiceId);
            }
            setConnectionState('connected');
            const ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') {
              void ctx.resume();
            }

            if (msg.isVoiceSwitch || hasGreetedRef.current) {
              setStatusText(isMutedRef.current ? 'Muted' : 'Listening...');
              return;
            }

            hasGreetedRef.current = true;
            setStatusText('Greeting...');
            // Share optional device location (non-blocking) for local help (nearest doctor, weather, directions)
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (navigator.geolocation?.getCurrentPosition) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(
                      JSON.stringify({
                        type: 'voice.location',
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        timeZone,
                      }),
                    );
                  }
                },
                () => {
                  if (ws.readyState === WebSocket.OPEN && timeZone) {
                    ws.send(JSON.stringify({ type: 'voice.location', timeZone }));
                  }
                },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
              );
            } else if (timeZone) {
              ws.send(JSON.stringify({ type: 'voice.location', timeZone }));
            }
            // S2S mode: stream raw PCM audio directly to backend → Google Gemini Live
            // Bridge mode: use browser SpeechRecognition (text-based turns)
            if (msg.mode === 'gemini_live_s2s') {
              startCloudAudioStream(ws);
            } else {
              // bifrost_bridge: speech-to-text + bridge turn pipeline
              startSpeechRecognition(ws);
              const greetings = [
                'Say only: "Hi, how may I be of assistance?"',
                'Say only: "Hello! How can I help you today?"',
                'Say only: "Hi there, what can I help you with?"',
                'Say only: "Hello, how may I help?"',
              ];
              const greetingPrompt = greetings[Math.floor(Math.random() * greetings.length)];
              ws.send(
                JSON.stringify({
                  type: 'voice.turn',
                  text: greetingPrompt,
                  voice: voiceIdRef.current,
                  mode: 'discussion',
                  hasTools: false,
                }),
              );
            }
            return;
          }

          if (msg.type === 'voice.status' && msg.status) {
            setStatusText(msg.status);
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

          if (msg.type === 'voice.translator_mode') {
            setTranslatorMode(Boolean(msg.enabled));
            setStatusText(msg.enabled ? 'Translator Mode ON' : 'Listening...');
            return;
          }

          if (msg.type === 'voice.ui_action' && msg.action) {
            if (msg.action === 'new_chat') {
              newConvoRef.current();
              setStatusText('Started new chat');
            } else if (
              msg.action === 'set_mode' &&
              msg.value &&
              ['Chat', 'Study', 'Work', 'Pro', 'Privacy', 'Vibecoding'].includes(msg.value)
            ) {
              setCurrentMode(msg.value as unknown as SatchiMode);
              setStatusText(`Switched to ${msg.value} mode`);
            } else if (msg.action === 'scroll_down') {
              window.scrollBy({ top: 400, behavior: 'smooth' });
            } else if (msg.action === 'scroll_up') {
              window.scrollBy({ top: -400, behavior: 'smooth' });
            } else if (msg.action === 'minimize') {
              setIsMinimized(true);
            } else if (msg.action === 'maximize') {
              setIsMinimized(false);
            }
            return;
          }

          if (msg.type === 'voice.action_card') {
            let incomingCard: VoiceActionCard | null = null;
            if (msg.card) {
              incomingCard = msg.card;
            } else if (msg.title && msg.mapUrl) {
              incomingCard = {
                kind: 'maps',
                title: msg.title,
                subtitle: msg.subtitle,
                mapUrl: msg.mapUrl,
              };
            }
            if (incomingCard) {
              setActionCard(incomingCard);
              setCardHistory((prev) => [incomingCard, ...prev].slice(0, 8));
              if (
                incomingCard.kind === 'news' &&
                (msg.autoSendToChat || researchEnabled) &&
                incomingCard.items.length > 0
              ) {
                const summary = incomingCard.items
                  .map((it, idx) => `${idx + 1}. [${it.title}](${it.url})`)
                  .join('\n');
                setStatusText('Summarizing headlines in chat...');
                askRef.current({
                  text: `Summarize these live headlines for "${incomingCard.query}":\n${summary}`,
                });
              }
            }
            return;
          }

          if (msg.type === 'voice.auto_research' && msg.query) {
            setWebSearchEnabled(true);
            setResearchEnabled(true);
            setStatusText('Sending research to chat...');
            const researchPrompt = msg.context
              ? `Research and summarize the findings for "${msg.query}":\n\n${msg.context}`
              : `Research and summarize: ${msg.query}`;
            askRef.current({ text: researchPrompt });
            return;
          }

          if (msg.type === 'voice.delegate_tools' && msg.text) {
            if (msg.newChat) {
              newConvoRef.current();
            }
            if (
              msg.mode &&
              ['Chat', 'Study', 'Work', 'Pro', 'Privacy', 'Vibecoding'].includes(msg.mode)
            ) {
              setCurrentMode(msg.mode as unknown as SatchiMode);
            }
            if (msg.webSearch) {
              setWebSearchEnabled(true);
            }
            if (msg.deepResearch) {
              setResearchEnabled(true);
            }
            setAwaitingToolResponse(true);
            setStatusText(
              msg.mode === 'Study'
                ? 'Opening Study Mode & DeepTutor...'
                : 'Using LibreChat tools...',
            );
            const promptText = msg.text;
            if (msg.newChat) {
              setTimeout(() => askRef.current({ text: promptText }), 150);
            } else {
              askRef.current({ text: promptText });
            }
            return;
          }

          if (msg.type === 'error') {
            receivedExplicitError = true;
            reportError(sanitizeVoiceError(msg.error?.message));
            return;
          }

          if (msg.type === 'voice.interrupted') {
            stopAssistantAudio(true);
            setAssistantTranscript('');
            return;
          }

          if (
            msg.type === 'conversation.item.input_audio_transcription.completed' &&
            msg.transcript
          ) {
            const cleanUser = msg.transcript.trim();
            setSpokenTranscript(cleanUser);
            setAssistantTranscript('');
            setStatusText('Thinking...');
            if (cleanUser) {
              const nowLabel = new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              setTranscriptHistory((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'user' && cleanUser.startsWith(last.text.slice(0, 12))) {
                  return [...prev.slice(0, -1), { role: 'user', text: cleanUser, time: nowLabel }];
                }
                return [...prev.slice(-29), { role: 'user', text: cleanUser, time: nowLabel }];
              });
            }
            return;
          }

          if (msg.type === 'response.audio_transcript.delta' && msg.delta) {
            setAssistantTranscript((prev) => prev + msg.delta);
            return;
          }

          if (msg.type === 'response.audio_transcript.done') {
            if (msg.transcript) {
              setAssistantTranscript(msg.transcript);
            }
            setAssistantTranscript((current) => {
              const finalTxt = (msg.transcript || current || '').trim();
              if (finalTxt) {
                const nowLabel = new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                setTranscriptHistory((prev) => [
                  ...prev.slice(-29),
                  { role: 'assistant', text: finalTxt, time: nowLabel },
                ]);
              }
              return current;
            });
            if (activeSourcesRef.current.length === 0 && isAssistantSpeakingRef.current) {
              markPlaybackIdle();
            }
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
        // Let onclose handle transparent auto-reconnect on transient mobile network drops
      };

      ws.onclose = (event) => {
        if (cancelled) {
          return;
        }
        // Auth / policy rejections (1008) or explicit errors should not auto-retry
        if (receivedExplicitError || event.code === 1000) {
          return;
        }
        if (event.code !== 1008 && reconnectAttemptsRef.current < 4) {
          reconnectAttemptsRef.current += 1;
          const delayMs = Math.min(8000, 1200 * 2 ** (reconnectAttemptsRef.current - 1));
          setConnectionState('connecting');
          setStatusText(`Reconnecting (${reconnectAttemptsRef.current}/4)...`);
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
          }
          reconnectTimerRef.current = setTimeout(() => {
            if (!cancelled) {
              setRetryNonce((n) => n + 1);
            }
          }, delayMs);
          return;
        }
        reportError(sanitizeVoiceError(event.reason) || GENERIC_VOICE_UNAVAILABLE);
      };
    };

    const handleOnline = () => {
      if (!cancelled && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        reconnectAttemptsRef.current = 0;
        setStatusText('Network restored — reconnecting...');
        setRetryNonce((n) => n + 1);
      }
    };
    window.addEventListener('online', handleOnline);

    void startRealtimeSession();

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      cleanupSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    retryNonce,
    token,
    cleanupSession,
    enqueueAudioBase64,
    pauseRecognitionForEchoGuard,
    reportError,
    resumeRecognitionAfterEchoGuard,
    startCloudAudioStream,
    startSpeechRecognition,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }
    // Keep mobile screen awake while Live Voice is active & re-acquire after app switch
    let wakeLock: { release: () => Promise<void> } | null = null;
    const navWithWake = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    const acquireWakeLock = () => {
      if (document.visibilityState === 'visible' && navWithWake.wakeLock?.request) {
        void navWithWake.wakeLock
          .request('screen')
          .then((sentinel) => {
            wakeLock = sentinel;
          })
          .catch(() => {
            // Ignore unsupported / battery-saver rejection
          });
      }
    };
    acquireWakeLock();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
        const ctx = audioContextRef.current;
        if (ctx && ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Auto-pause voice playback on incoming phone call / OS audio interruption
    const ctx = getAudioContext();
    const handleAudioStateChange = () => {
      if (!ctx) {
        return;
      }
      const state = ctx.state as string;
      if (state === 'interrupted') {
        stopAssistantAudio(false);
        setIsMuted(true);
        setStatusText('Paused (call / audio interrupted)');
      } else if (state === 'running' && isMutedRef.current) {
        setStatusText('Tap mic to resume');
      }
    };
    if (ctx) {
      ctx.addEventListener('statechange', handleAudioStateChange);
    }

    // Register Lock-Screen / Notification Media Controls (Android & iOS)
    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Satchida Live Voice',
          artist: 'Hands-Free AI Assistant',
        });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('pause', () => {
          stopAssistantAudio(false);
          setIsMuted(true);
          setStatusText('Muted');
          navigator.mediaSession.playbackState = 'paused';
        });
        navigator.mediaSession.setActionHandler('play', () => {
          setIsMuted(false);
          setStatusText('Listening...');
          navigator.mediaSession.playbackState = 'playing';
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          onOpenChange(false);
        });
      } catch {
        // Ignore unsupported mediaSession action
      }
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (ctx) {
        ctx.removeEventListener('statechange', handleAudioStateChange);
      }
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('stop', null);
        } catch {
          // ignore
        }
      }
      if (wakeLock) {
        void wakeLock.release().catch(() => {});
      }
    };
  }, [open, getAudioContext, stopAssistantAudio, onOpenChange]);

  if (!open) {
    return null;
  }

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      let nextStatus = 'Listening...';
      if (next) {
        nextStatus = 'Muted';
      } else if (isAssistantSpeaking) {
        nextStatus = 'Speaking...';
      }
      setStatusText(nextStatus);
      if (next) {
        pauseRecognitionForEchoGuard();
      } else {
        setTimeout(() => resumeRecognitionAfterEchoGuard(), 100);
      }
      return next;
    });
  };

  const handleRetry = () => {
    cleanupSession();
    setRetryNonce((n) => n + 1);
  };

  const isListening = connectionState === 'connected' && !isMuted && !isAssistantSpeaking;
  const currentVoiceOpt = VOICE_OPTIONS.find((v) => v.id === voiceId) || VOICE_OPTIONS[0];

  let minimizedPingClass = 'bg-emerald-400';
  let minimizedDotClass = 'bg-emerald-500';
  if (isAssistantSpeaking) {
    minimizedPingClass = 'bg-fuchsia-400';
    minimizedDotClass = 'bg-fuchsia-500';
  } else if (isMuted) {
    minimizedPingClass = 'bg-red-400';
    minimizedDotClass = 'bg-red-500';
  }

  // Compact minimized floating pill (non-blocking)
  if (isMinimized) {
    return (
      <div className="pointer-events-auto fixed bottom-24 right-6 z-50 flex items-center gap-2 rounded-full border border-violet-500/40 bg-surface-primary/95 px-3 py-2 text-text-primary shadow-2xl backdrop-blur-xl">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${minimizedPingClass} opacity-75`}
          />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${minimizedDotClass}`} />
        </span>
        <span className="whitespace-nowrap text-xs font-semibold">
          {statusText} · {currentVoiceOpt.shortLabel} ·{' '}
          {liveVoiceMode === 'work' ? 'Work' : 'Realtime'}
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
  let orbState: 'error' | 'speaking' | 'muted' | 'thinking' | 'listening' = 'listening';
  if (connectionState === 'error') {
    orbState = 'error';
  } else if (isAssistantSpeaking) {
    orbState = 'speaking';
  } else if (isMuted) {
    orbState = 'muted';
  } else if (connectionState === 'connecting') {
    orbState = 'thinking';
  }

  let orbAmplitude = 0.45;
  if (isAssistantSpeaking) {
    orbAmplitude = 0.8;
  } else if (isMuted) {
    orbAmplitude = 0.1;
  }

  const getCardChipLabel = (card: VoiceActionCard): string => {
    if (card.kind === 'maps') {
      return `Map: ${card.subtitle || card.title}`;
    }
    if (card.kind === 'media') {
      const provider = card.platform === 'spotify' ? 'Spotify' : 'YouTube';
      return `${provider}: ${card.query}`;
    }
    if (card.kind === 'weather') {
      return `${card.city} ${card.tempC}°C`;
    }
    if (card.kind === 'news') {
      return `News: ${card.query}`;
    }
    return card.title;
  };

  let micButtonRingClass = '';
  if (isAssistantSpeaking) {
    micButtonRingClass = 'scale-105 ring-4 ring-fuchsia-400/40';
  } else if (isListening) {
    micButtonRingClass = 'ring-2 ring-emerald-400/30';
  }

  let micButtonIcon: React.ReactNode = <Mic className="h-4 w-4 text-violet-100" />;
  if (connectionState === 'error') {
    micButtonIcon = <AlertCircle className="h-4 w-4 text-red-400" />;
  } else if (isAssistantSpeaking) {
    micButtonIcon = <Volume2 className="h-4 w-4 animate-pulse text-white" />;
  } else if (isMuted) {
    micButtonIcon = <MicOff className="h-4 w-4 text-red-400" />;
  }

  let transcriptContent: React.ReactNode = (
    <span>{localize('com_ui_live_voice_speak_naturally')}</span>
  );
  if (assistantTranscript) {
    transcriptContent = <span className="text-text-primary">{assistantTranscript}</span>;
  } else if (spokenTranscript) {
    transcriptContent = (
      <span className="italic text-text-primary">&ldquo;{spokenTranscript}&rdquo;</span>
    );
  }

  let primaryControlButton: React.ReactNode;
  if (connectionState === 'error') {
    primaryControlButton = (
      <button
        type="button"
        onClick={handleRetry}
        className="flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-300 transition-all hover:bg-violet-500/25"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>{localize('com_ui_live_voice_retry')}</span>
      </button>
    );
  } else if (isAssistantSpeaking) {
    primaryControlButton = (
      <button
        type="button"
        onClick={() => stopAssistantAudio(true)}
        className="flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-500/25"
      >
        <Square className="h-3.5 w-3.5" />
        <span>{localize('com_ui_live_voice_interrupt')}</span>
      </button>
    );
  } else {
    primaryControlButton = (
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
    );
  }

  return (
    <div
      role="region"
      aria-label="Satchida Live Voice"
      onPointerDown={() => {
        if (audioContextRef.current?.state === 'suspended') {
          void audioContextRef.current.resume();
        }
      }}
      onTouchStart={(e) => {
        touchStartYRef.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartYRef.current !== null && isMobileViewport) {
          const deltaY =
            (e.changedTouches[0]?.clientY ?? touchStartYRef.current) - touchStartYRef.current;
          if (deltaY > 60) {
            setIsMinimized(true);
          }
        }
        touchStartYRef.current = null;
      }}
      className="pointer-events-auto fixed left-2 right-2 top-14 z-[60] rounded-2xl border border-violet-500/35 bg-surface-primary/95 p-3 text-text-primary shadow-2xl backdrop-blur-xl sm:left-auto sm:right-4 sm:top-16 sm:w-[320px]"
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <OrbVisualizer
            state={orbState}
            amplitude={orbAmplitude}
            size={isMobileViewport ? 36 : 24}
          />
          <span className="truncate text-xs font-bold tracking-wide text-text-primary">
            {localize('com_ui_live_voice')}
          </span>
          <select
            aria-label="Select Voice Accent"
            value={voiceId}
            onChange={(e) => handleAccentChange(e.target.value as VoiceProfileId)}
            className="max-w-[115px] truncate rounded-md border border-border-light bg-surface-secondary px-1.5 py-0.5 text-[11px] font-medium text-text-primary outline-none focus:border-violet-400"
          >
            {VOICE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.shortLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {translatorMode && (
            <button
              type="button"
              onClick={() => {
                setTranslatorMode(false);
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(
                    JSON.stringify({ type: 'voice.set_translator_mode', enabled: false }),
                  );
                }
              }}
              className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/25"
              title="Tap to exit Translator Mode"
            >
              <Globe className="h-3 w-3" />
              {localize('com_ui_live_voice_translator_exit')}
            </button>
          )}
          {transcriptHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTranscriptDrawer((prev) => !prev)}
              className="rounded-full border border-border-medium bg-surface-secondary/70 px-2 py-0.5 text-[10px] font-medium text-text-secondary transition-colors hover:text-text-primary"
              title="Toggle voice transcript"
            >
              {showTranscriptDrawer ? 'Hide Log' : `Log (${transcriptHistory.length})`}
            </button>
          )}
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

      {/* Mobile-first scrollable Voice Transcript Drawer */}
      {showTranscriptDrawer && transcriptHistory.length > 0 && (
        <div className="mb-2 rounded-xl border border-border-medium bg-surface-secondary/60 p-2.5 text-xs">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-semibold text-text-primary">
              {localize('com_ui_live_voice_transcript')}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const body = transcriptHistory
                    .map((t) => `${t.role === 'user' ? 'You' : 'Satchida'} (${t.time}): ${t.text}`)
                    .join('\n\n');
                  void navigator.clipboard?.writeText(body);
                  setCopiedTranscript(true);
                  setTimeout(() => setCopiedTranscript(false), 1800);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border-medium px-2 py-0.5 text-[10px] font-medium text-text-secondary hover:text-text-primary"
                title="Copy transcript"
              >
                {copiedTranscript ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copiedTranscript ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const body = transcriptHistory
                    .map(
                      (t) => `**${t.role === 'user' ? 'You' : 'Satchida'}** (${t.time}): ${t.text}`,
                    )
                    .join('\n\n');
                  askRef.current({
                    text: `Here is our voice transcript for reference:\n\n${body}`,
                  });
                  setIsMinimized(true);
                }}
                className="rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-violet-500"
              >
                {localize('com_ui_live_voice_save_to_chat')}
              </button>
            </div>
          </div>
          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1 text-[11px] sm:max-h-36">
            {cardHistory.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1 border-b border-border-medium pb-1.5">
                {cardHistory.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActionCard(c)}
                    className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/25"
                  >
                    {getCardChipLabel(c)}
                  </button>
                ))}
              </div>
            )}
            {transcriptHistory.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-1.5 rounded-lg px-2 py-1 ${
                  item.role === 'user'
                    ? 'bg-surface-tertiary/50 text-text-secondary'
                    : 'bg-violet-500/10 text-text-primary'
                }`}
              >
                <span className="shrink-0 rounded bg-surface-primary/80 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                  {item.role === 'user' ? 'You' : 'Satchida'}
                </span>
                <span className="min-w-0 break-words">{item.text}</span>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      )}

      {/* Rich Action Cards (Maps, Weather, News, DeepTutor) */}
      {actionCard && (
        <div className="mb-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            {actionCard.kind === 'maps' && (
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-text-primary">
                    <span className="font-semibold">{actionCard.title}</span>
                    {actionCard.subtitle ? (
                      <span className="ml-1 text-text-secondary">· {actionCard.subtitle}</span>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={actionCard.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 font-medium text-white hover:bg-emerald-500"
                    >
                      {localize('com_ui_live_voice_navigate')}
                    </a>
                    <button
                      type="button"
                      onClick={() => setActionCard(null)}
                      aria-label="Dismiss card"
                      className="rounded p-0.5 text-text-secondary hover:text-text-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {actionCard.embedUrl && (
                  <iframe
                    src={actionCard.embedUrl}
                    title={actionCard.subtitle || 'Live Map'}
                    className="h-36 w-full rounded-lg border border-emerald-400/20 bg-surface-secondary"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                )}
              </div>
            )}
            {actionCard.kind === 'weather' && (
              <div className="w-full rounded-xl border border-sky-500/25 bg-gradient-to-br from-sky-900/60 to-blue-950/60 p-3 text-white">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-3xl font-bold leading-none">{`${actionCard.tempC}°C`}</div>
                    <div className="mt-1 text-xs font-medium text-sky-200">
                      {actionCard.condition}
                    </div>
                    <div className="mt-0.5 text-[11px] text-sky-300/80">{actionCard.city}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CloudSun className="h-8 w-8 text-sky-300" />
                    <button
                      type="button"
                      onClick={() => setActionCard(null)}
                      aria-label="Dismiss card"
                      className="shrink-0 rounded p-0.5 text-sky-200/80 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {typeof actionCard.highC === 'number' && typeof actionCard.lowC === 'number' && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-sky-200/90">
                    <span>↑ {actionCard.highC}°</span>
                    <span>↓ {actionCard.lowC}°</span>
                    {typeof actionCard.aqi === 'number' && (
                      <span className="rounded-full bg-white/15 px-2 py-0.5 font-semibold text-white">
                        {`AQI ${actionCard.aqi}${actionCard.aqiLabel ? ` · ${actionCard.aqiLabel}` : ''}`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            {actionCard.kind === 'media' && (
              <div className="w-full space-y-2">
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-text-primary">
                    <span className="font-semibold">{actionCard.title}</span>
                    <span className="ml-1 text-text-secondary">· {actionCard.query}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={actionCard.openUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`rounded-lg px-2.5 py-1 font-medium text-white ${
                        actionCard.platform === 'spotify'
                          ? 'bg-emerald-600 hover:bg-emerald-500'
                          : 'bg-red-600 hover:bg-red-500'
                      }`}
                    >
                      {actionCard.platform === 'spotify' ? 'Open Spotify' : 'Open YouTube'}
                    </a>
                    {actionCard.platform === 'spotify' && (
                      <a
                        href={
                          /iphone|ipad|ipod/i.test(navigator.userAgent)
                            ? 'https://apps.apple.com/app/spotify-music-and-podcasts/id324684580'
                            : actionCard.installUrl ||
                              'https://play.google.com/store/apps/details?id=com.spotify.music'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-emerald-400/40 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                      >
                        {localize('com_ui_live_voice_install')}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setActionCard(null)}
                      aria-label="Dismiss card"
                      className="rounded p-0.5 text-text-secondary hover:text-text-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {actionCard.embedUrl && (
                  <iframe
                    src={actionCard.embedUrl}
                    title={actionCard.query}
                    className="h-44 w-full rounded-lg border border-red-400/25 bg-black"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
            )}
            {actionCard.kind === 'tutor' && (
              <>
                <div className="min-w-0 truncate text-text-primary">
                  <span className="font-medium">{actionCard.title}</span>
                  {actionCard.subtitle ? (
                    <span className="ml-1 text-text-secondary">· {actionCard.subtitle}</span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    className="rounded-lg bg-violet-600 px-2.5 py-1 font-medium text-white hover:bg-violet-500"
                  >
                    {localize('com_ui_live_voice_view_chat')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionCard(null)}
                    aria-label="Dismiss card"
                    className="rounded p-0.5 text-text-secondary hover:text-text-primary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
            {actionCard.kind === 'news' && (
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text-primary">
                    {`${localize('com_ui_live_voice_headlines')} · ${actionCard.query}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const summary = actionCard.items
                          .map((it, idx) => `${idx + 1}. [${it.title}](${it.url})`)
                          .join('\n');
                        askRef.current({
                          text: `Summarize these live headlines for "${actionCard.query}":\n${summary}`,
                        });
                        setIsMinimized(true);
                      }}
                      className="rounded-md bg-sky-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-sky-500"
                    >
                      {localize('com_ui_live_voice_send_to_chat')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionCard(null)}
                      aria-label="Dismiss card"
                      className="rounded p-0.5 text-text-secondary hover:text-text-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <ul className="max-h-24 space-y-1 overflow-y-auto pr-1 text-[11px]">
                  {actionCard.items.slice(0, 4).map((item, idx) => (
                    <li key={idx} className="truncate">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-300 hover:underline"
                      >
                        • {item.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="my-2.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (isAssistantSpeaking) {
              stopAssistantAudio(true);
            } else {
              toggleMute();
            }
          }}
          title={(() => {
            if (isAssistantSpeaking) {
              return 'Tap to interrupt and speak';
            }
            return isMuted ? 'Unmute' : 'Mute';
          })()}
          className={`bg-linear-to-br relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet-400/40 from-violet-600/85 via-purple-700/85 to-indigo-900/90 shadow-md shadow-violet-500/20 transition-transform active:scale-95 ${micButtonRingClass}`}
        >
          {micButtonIcon}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            <span>{statusText}</span>
            {micStreaming && !isMuted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {localize('com_ui_live_voice_mic_live')}
              </span>
            )}
          </div>
          {errorMessage ? (
            <div
              role="alert"
              className="mt-0.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] leading-snug text-red-300"
            >
              {errorMessage}
            </div>
          ) : (
            <div className="mt-0.5 max-h-12 overflow-y-auto text-xs leading-snug text-text-secondary">
              {transcriptContent}
            </div>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-2">
        {primaryControlButton}

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20"
        >
          {localize('com_ui_live_voice_end')}
        </button>
      </div>
    </div>
  );
}
