import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { TooltipAnchor, Spinner } from '@librechat/client';
import { Pause, Play, Volume2 } from 'lucide-react';
import type { TMessage } from 'librechat-data-provider';
import { cleanSpeechText, extractMessageContent } from '~/utils/speechCleanup';
import { useLatestMessage } from '~/hooks/Messages/useLatestMessage';

const HEADER_VOICE_OPTIONS = [
  {
    id: 'in_female',
    flag: '🇮🇳',
    code: 'F',
    gender: 'female' as const,
    label: 'Indian Female (Neerja)',
  },
  { id: 'in_male', flag: '🇮🇳', code: 'M', gender: 'male' as const, label: 'Indian Male (Prabhat)' },
  { id: 'us_female', flag: '🇺🇸', code: 'F', gender: 'female' as const, label: 'US Female (Jenny)' },
  { id: 'us_male', flag: '🇺🇸', code: 'M', gender: 'male' as const, label: 'US Male (Guy)' },
  { id: 'uk_female', flag: '🇬🇧', code: 'F', gender: 'female' as const, label: 'UK Female (Sonia)' },
  { id: 'uk_male', flag: '🇬🇧', code: 'M', gender: 'male' as const, label: 'UK Male (Ryan)' },
];

export default function HeaderAudioSpeaker() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceId, setVoiceId] = useState<string>(() => {
    const stored = localStorage.getItem('satchida_voice_id');
    if (stored && HEADER_VOICE_OPTIONS.some((v) => v.id === stored)) {
      return stored;
    }
    const legacy = localStorage.getItem('satchida_voice_gender');
    return legacy === 'male' ? 'in_male' : 'in_female';
  });
  const activeVoice = HEADER_VOICE_OPTIONS.find((v) => v.id === voiceId) || HEADER_VOICE_OPTIONS[0];
  const voiceGender = activeVoice.gender;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const { conversationId } = useParams();
  const queryClient = useQueryClient();
  const activeTailMessage = useLatestMessage(0);

  // Initialize or clean up audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.onended = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    audio.onerror = (e) => {
      console.error('Teacher audio playback error:', e);
      setIsPlaying(false);
      setIsPaused(false);
      setIsLoading(false);
    };

    const buttonStateClass = (() => {
      if (isPlaying) {
        return 'border-primary bg-primary/20 text-primary ring-primary/40 animate-pulse ring-2';
      }
      if (isPaused) {
        return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500';
      }
      return '';
    })();

    const speakerIcon = (() => {
      if (isLoading) {
        return <Spinner className="text-primary h-5 w-5" />;
      }
      if (isPlaying) {
        return (
          <Pause
            style={{ width: '1.25rem', height: '1.25rem' }}
            className="text-primary"
            aria-hidden="true"
            focusable="false"
          />
        );
      }
      if (isPaused) {
        return (
          <Play
            style={{ width: '1.25rem', height: '1.25rem' }}
            className="ml-0.5 text-yellow-500"
            aria-hidden="true"
            focusable="false"
          />
        );
      }
      return (
        <Volume2
          style={{ width: '1.25rem', height: '1.25rem' }}
          className="text-text-primary"
          aria-hidden="true"
          focusable="false"
        />
      );
    })();

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const cycleVoice = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const currentIdx = HEADER_VOICE_OPTIONS.findIndex((v) => v.id === voiceId);
      const nextIdx = (currentIdx + 1) % HEADER_VOICE_OPTIONS.length;
      const next = HEADER_VOICE_OPTIONS[nextIdx];
      setVoiceId(next.id);
      localStorage.setItem('satchida_voice_id', next.id);
      localStorage.setItem('satchida_voice_gender', next.gender); // keep legacy key in sync
      // Invalidate cached audio so next play synthesizes with new voice
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      setIsPaused(false);
      currentAudioUrlRef.current = null;
    },
    [voiceId],
  );

  const getRecentDialogue = useCallback((): { studentQuery: string; assistantResponse: string } => {
    let studentQuery = '';
    let assistantResponse = '';

    const messages =
      queryClient.getQueryData<TMessage[]>([QueryKeys.messages, conversationId ?? '']) ?? [];

    if (messages.length > 0) {
      // Find the latest assistant message
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg && !msg.isCreatedByUser && !assistantResponse) {
          assistantResponse = extractMessageContent(msg);
          break;
        }
      }

      // Find the user query that initiated the topic or prompt
      // Look back for a substantive user prompt (skipping trivial commands or looking at the core prompt)
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg && msg.isCreatedByUser) {
          const txt = (typeof msg.content === 'string' ? msg.content : msg.text || '').trim();
          if (txt) {
            // If the user's latest query is short like "generate a ppt...", also capture earlier topic prompt if available
            if (!studentQuery) {
              studentQuery = txt;
            } else if (
              /ppt|powerpoint|slide|pdf|report|visual|quiz|summary|flashcard/i.test(studentQuery) &&
              txt.length > studentQuery.length
            ) {
              studentQuery = `${txt} (Follow-up: ${studentQuery})`;
            }
          }
        }
      }
    }

    if (!assistantResponse && activeTailMessage && !activeTailMessage.isCreatedByUser) {
      assistantResponse = extractMessageContent(activeTailMessage);
    }

    // Fallback: extract directly from DOM
    if (!assistantResponse) {
      const assistantNodes = document.querySelectorAll('.agent-turn, [data-message-id]');
      if (assistantNodes.length > 0) {
        const lastNode = assistantNodes[assistantNodes.length - 1];
        if (lastNode) {
          const clone = lastNode.cloneNode(true) as HTMLElement;
          clone
            .querySelectorAll('details, .thought-container, svg, button, form, table')
            .forEach((el) => el.remove());
          assistantResponse = cleanSpeechText(clone.innerText || clone.textContent || '');
        }
      }
    }

    return { studentQuery, assistantResponse };
  }, [activeTailMessage, conversationId, queryClient]);

  const handleToggleSpeak = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // 1. If currently playing -> PAUSE (resumable)
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setIsPaused(true);
      return;
    }

    // 2. If paused -> RESUME from same position
    if (isPaused && audio.src) {
      try {
        await audio.play();
        setIsPlaying(true);
        setIsPaused(false);
      } catch (e) {
        console.error('Failed to resume audio:', e);
      }
      return;
    }

    // 3. Otherwise, synthesize fresh teacher explanation
    const { studentQuery, assistantResponse } = getRecentDialogue();
    if (!assistantResponse) {
      console.warn('HeaderAudioSpeaker: No dialogue found.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: studentQuery,
          response: assistantResponse,
          voice: voiceGender,
          voiceId: activeVoice.id,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || 'Failed to generate explanation');
      }

      if (json.audioUrl) {
        currentAudioUrlRef.current = json.audioUrl;
        audio.src = json.audioUrl;
        await audio.play();
        setIsPlaying(true);
        setIsPaused(false);
      } else if (json.explanation && 'speechSynthesis' in window) {
        // Fallback to browser synth if audio file couldn't be saved
        const synth = window.speechSynthesis;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanSpeechText(json.explanation));
        utterance.rate = 0.95;
        utterance.onend = () => {
          setIsPlaying(false);
          setIsPaused(false);
        };
        setIsPlaying(true);
        synth.speak(utterance);
      }
    } catch (err) {
      console.error('Teacher voice explanation error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getRecentDialogue, isPaused, isPlaying, voiceGender]);

  const mainTooltip = (() => {
    if (isPlaying) {
      return 'Pause Teacher Explanation (Click to pause, click again to resume)';
    }
    if (isPaused) {
      return 'Resume Teacher Explanation';
    }
    if (isLoading) {
      return 'Master Teacher is preparing spoken lesson...';
    }
    return `Listen: Teacher explains lesson aloud (${voiceGender === 'female' ? 'Neerja (Female)' : 'Prabhat (Male)'})`;
  })();
  const buttonStateClass = (() => {
    if (isPlaying) {
      return 'border-primary bg-primary/20 text-primary ring-primary/40 animate-pulse ring-2';
    }
    if (isPaused) {
      return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500';
    }
    return '';
  })();

  const speakerIcon = (() => {
    if (isLoading) {
      return <Spinner className="text-primary h-5 w-5" />;
    }
    if (isPlaying) {
      return (
        <Pause
          style={{ width: '1.25rem', height: '1.25rem' }}
          className="text-primary"
          aria-hidden="true"
          focusable="false"
        />
      );
    }
    if (isPaused) {
      return (
        <Play
          style={{ width: '1.25rem', height: '1.25rem' }}
          className="ml-0.5 text-yellow-500"
          aria-hidden="true"
          focusable="false"
        />
      );
    }
    return (
      <Volume2
        style={{ width: '1.25rem', height: '1.25rem' }}
        className="text-text-primary"
        aria-hidden="true"
        focusable="false"
      />
    );
  })();

  return (
    <div className="flex items-center gap-1">
      {/* Primary Teacher Speaker Button */}
      <div className="relative flex items-center">
        <TooltipAnchor
          description={`${mainTooltip} (Local / On-device)`}
          render={
            <button
              id="header-audio-speaker-button"
              type="button"
              aria-label={mainTooltip}
              onClick={handleToggleSpeak}
              className={`relative inline-flex size-9 flex-shrink-0 items-center justify-center rounded-xl border border-border-light bg-presentation text-text-primary transition-all ease-in-out hover:bg-surface-tertiary disabled:pointer-events-none disabled:opacity-50 ${buttonStateClass}`}
            >
              {speakerIcon}
            </button>
          }
        />
        <span
          className="shadow-xs pointer-events-none absolute -bottom-1 -right-1 select-none rounded border border-emerald-500/20 bg-emerald-500/15 px-1 py-[0.5px] text-[7.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
          title="On-device Local Speech"
        >
          Local
        </span>
      </div>

      {/* Voice Toggle: cycles across all 6 voices (IN / US / UK × Female / Male) */}
      <TooltipAnchor
        description={`Voice: ${activeVoice.label} — Click to switch`}
        render={
          <button
            type="button"
            onClick={cycleVoice}
            aria-label="Toggle Teacher Voice Accent / Gender"
            className="hidden h-9 items-center justify-center rounded-xl border border-border-light bg-presentation px-2 text-[11px] font-medium text-text-secondary transition-all hover:bg-surface-tertiary hover:text-text-primary sm:inline-flex"
          >
            <span className="text-primary mr-1 font-semibold">{activeVoice.flag}</span>
            {activeVoice.code}
          </button>
        }
      />
    </div>
  );
}
