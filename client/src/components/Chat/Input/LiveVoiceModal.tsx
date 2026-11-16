import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, X, Volume2, VolumeX, Sparkles, AlertCircle } from 'lucide-react';
import { OGDialog, OGDialogTemplate } from '@librechat/client';
import { useSpeechToText, useLocalize } from '~/hooks';
import type { TAskFunction } from '~/common';
import { useLatestMessage } from '~/hooks/Messages/useLatestMessage';
import { cleanSpeechText, extractMessageContent } from '~/utils/speechCleanup';

interface LiveVoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ask: TAskFunction;
  isSubmitting: boolean;
}

export default function LiveVoiceModal({
  open,
  onOpenChange,
  ask,
  isSubmitting,
}: LiveVoiceModalProps) {
  const localize = useLocalize();
  const [isMuted, setIsMuted] = useState(false);
  const [statusText, setStatusText] = useState('Listening...');
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [lastAssistantSpokenId, setLastAssistantSpokenId] = useState<string | null>(null);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>(() => {
    return (localStorage.getItem('satchida_voice_gender') as 'female' | 'male') || 'female';
  });

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const activeTailMessage = useLatestMessage(0);

  // Initialize Audio Player
  useEffect(() => {
    const audio = new Audio();
    audioPlayerRef.current = audio;

    audio.onplay = () => {
      setIsAssistantSpeaking(true);
      setStatusText('Speaking...');
    };

    audio.onended = () => {
      setIsAssistantSpeaking(false);
      setStatusText('Listening...');
    };

    audio.onerror = () => {
      setIsAssistantSpeaking(false);
      setStatusText('Listening...');
    };

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Play spoken audio helper
  const playAudio = useCallback((audioUrl: string) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = audioUrl;
      audioPlayerRef.current.play().catch((err) => {
        console.warn('Live voice autoplay prevented:', err);
      });
    }
  }, []);

  // When modal opens: Immediately play high-fidelity instant greeting
  useEffect(() => {
    if (open) {
      setIsMuted(false);
      setStatusText('Connected');
      setSpokenTranscript('');
      
      const greetingUrl =
        voiceGender === 'male'
          ? '/assets/study/live_voice_greeting_male.mp3'
          : '/assets/study/live_voice_greeting_female.mp3';

      // Slight delay for smooth dialog animation
      const timer = setTimeout(() => {
        playAudio(greetingUrl);
      }, 300);

      return () => {
        clearTimeout(timer);
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
        }
      };
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    }
  }, [open, voiceGender, playAudio]);

  // Handle incoming user transcription
  const handleTranscriptionComplete = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSubmitting || isMuted) {
        return;
      }

      setSpokenTranscript(trimmed);
      setStatusText('Thinking...');

      // Stop any ongoing assistant audio when user starts speaking
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }

      ask({ text: trimmed });
    },
    [ask, isSubmitting, isMuted],
  );

  const handleInterimText = useCallback(
    (text: string) => {
      if (!isMuted && text) {
        setSpokenTranscript(text);
        // Mid-talk interrupt: barge in if assistant is speaking
        if (isAssistantSpeaking && audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          setIsAssistantSpeaking(false);
          setStatusText('Listening...');
        }
      }
    },
    [isMuted, isAssistantSpeaking],
  );

  // Setup STT listener
  const { isListening, startRecording, stopRecording } = useSpeechToText(
    handleInterimText,
    handleTranscriptionComplete,
  );

  // Keep recording alive while modal is open and not muted
  useEffect(() => {
    if (open && !isMuted) {
      startRecording();
    } else {
      stopRecording();
    }
    return () => {
      stopRecording();
    };
  }, [open, isMuted, startRecording, stopRecording]);

  // When assistant finishes generating a response, automatically synthesize & speak it
  useEffect(() => {
    if (!open || !activeTailMessage) {
      return;
    }

    if (
      !activeTailMessage.isCreatedByUser &&
      activeTailMessage.messageId !== lastAssistantSpokenId &&
      !isSubmitting
    ) {
      const rawText = extractMessageContent(activeTailMessage);
      const cleaned = cleanSpeechText(rawText);

      if (cleaned.length > 5) {
        setLastAssistantSpokenId(activeTailMessage.messageId);
        setStatusText('Synthesizing speech...');

        fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: spokenTranscript || 'Explain',
            response: cleaned,
            voice: voiceGender,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data?.audioUrl) {
              playAudio(data.audioUrl);
            } else {
              setStatusText('Listening...');
            }
          })
          .catch((err) => {
            console.error('Failed to synthesize live voice response:', err);
            setStatusText('Listening...');
          });
      }
    }
  }, [open, activeTailMessage, isSubmitting, lastAssistantSpokenId, spokenTranscript, voiceGender, playAudio]);

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      startRecording();
      setStatusText('Listening...');
    } else {
      setIsMuted(true);
      stopRecording();
      setStatusText('Muted');
    }
  };

  const toggleVoiceGender = () => {
    const next = voiceGender === 'female' ? 'male' : 'female';
    setVoiceGender(next);
    localStorage.setItem('satchida_voice_gender', next);
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogTemplate
        title=""
        showCloseButton={false}
        className="relative max-w-[480px] overflow-hidden rounded-3xl border border-violet-500/30 bg-surface-primary/95 p-8 text-text-primary shadow-2xl backdrop-blur-xl"
        main={
          <div className="flex flex-col items-center text-center">
            {/* Header close button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-all"
              aria-label="Close Live Voice"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Glowing Orb Visualizer */}
            <div className="relative my-8 flex items-center justify-center">
              {/* Outer pulsing halo */}
              <div
                className={`absolute h-44 w-44 rounded-full bg-linear-to-tr from-violet-600/30 to-fuchsia-600/30 blur-2xl transition-all duration-700 ${
                  isAssistantSpeaking
                    ? 'scale-125 opacity-100 animate-pulse'
                    : isListening
                      ? 'scale-110 opacity-75'
                      : 'scale-90 opacity-30'
                }`}
              />

              {/* Core interactive voice orb */}
              <div
                className={`relative flex h-32 w-32 items-center justify-center rounded-full border border-violet-400/40 bg-linear-to-br from-violet-600/80 via-purple-700/80 to-indigo-900/90 shadow-lg shadow-violet-500/25 transition-transform duration-300 ${
                  isAssistantSpeaking ? 'scale-110 ring-4 ring-violet-400/50' : ''
                }`}
              >
                {isAssistantSpeaking ? (
                  <Volume2 className="h-12 w-12 text-white animate-bounce" />
                ) : isMuted ? (
                  <MicOff className="h-10 w-10 text-red-400" />
                ) : (
                  <Mic className="h-10 w-10 text-violet-200" />
                )}
              </div>
            </div>

            {/* Status indicator */}
            <div className="mb-2 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full ${
                    isAssistantSpeaking
                      ? 'bg-fuchsia-400'
                      : isMuted
                        ? 'bg-red-400'
                        : 'bg-emerald-400'
                  } opacity-75`}
                />
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    isAssistantSpeaking
                      ? 'bg-fuchsia-500'
                      : isMuted
                        ? 'bg-red-500'
                        : 'bg-emerald-500'
                  }`}
                />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {statusText}
              </span>
            </div>

            <h3 className="text-lg font-bold text-text-primary">
              Satchida Live Voice
            </h3>

            {/* Live transcript or hint */}
            <div className="mt-3 min-h-[52px] max-w-sm rounded-xl border border-border-light bg-surface-secondary/40 p-3 text-xs leading-relaxed text-text-secondary">
              {spokenTranscript ? (
                <span className="text-text-primary italic">"{spokenTranscript}"</span>
              ) : (
                <span>Speak naturally. You can interrupt anytime or ask follow-ups.</span>
              )}
            </div>

            {/* Controls Bar */}
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={toggleMute}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                  isMuted
                    ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    : 'border-border-light bg-surface-secondary text-text-primary hover:bg-surface-hover'
                }`}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-emerald-400" />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>

              <button
                type="button"
                onClick={toggleVoiceGender}
                className="flex items-center gap-1.5 rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-hover transition-all"
                title="Toggle Voice"
              >
                <Sparkles className="h-4 w-4 text-violet-400" />
                <span>{voiceGender === 'female' ? 'Neerja (Female)' : 'Prabhat (Male)'}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all"
              >
                End
              </button>
            </div>
          </div>
        }
        showCancelButton={false}
      />
    </OGDialog>
  );
}
