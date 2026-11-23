import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Volume2, VolumeX, Pause, Play, Sparkles } from 'lucide-react';
import { TooltipAnchor, Spinner } from '@librechat/client';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { QueryKeys } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import { cleanSpeechText, extractMessageContent } from '~/utils/speechCleanup';
import { useLatestMessage } from '~/hooks/Messages/useLatestMessage';

export default function HeaderAudioSpeaker() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>(() => {
    return (localStorage.getItem('satchida_voice_gender') as 'female' | 'male') || 'female';
  });

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

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const toggleGender = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = voiceGender === 'female' ? 'male' : 'female';
    setVoiceGender(next);
    localStorage.setItem('satchida_voice_gender', next);
    // Invalidate cached audio so next play synthesizes with new voice
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setIsPaused(false);
    currentAudioUrlRef.current = null;
  };

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
          const txt = (typeof msg.content === 'string' ? msg.content : (msg.text || '')).trim();
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
          clone.querySelectorAll('details, .thought-container, svg, button, form, table').forEach((el) => el.remove());
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

  const mainTooltip = isPlaying
    ? 'Pause Teacher Explanation (Click to pause, click again to resume)'
    : isPaused
    ? 'Resume Teacher Explanation'
    : isLoading
    ? 'Master Teacher is preparing spoken lesson...'
    : `Listen: Teacher explains lesson aloud (${voiceGender === 'female' ? 'Neerja (Female)' : 'Prabhat (Male)'})`;

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
              className={`relative inline-flex size-9 flex-shrink-0 items-center justify-center rounded-xl border border-border-light bg-presentation text-text-primary transition-all ease-in-out hover:bg-surface-tertiary disabled:pointer-events-none disabled:opacity-50 ${
                isPlaying
                  ? 'border-primary bg-primary/20 text-primary animate-pulse ring-2 ring-primary/40'
                  : isPaused
                  ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500'
                  : ''
              }`}
            >
              {isLoading ? (
                <Spinner className="h-5 w-5 text-primary" />
              ) : isPlaying ? (
                <Pause
                  style={{ width: '1.25rem', height: '1.25rem' }}
                  className="text-primary"
                  aria-hidden="true"
                  focusable="false"
                />
              ) : isPaused ? (
                <Play
                  style={{ width: '1.25rem', height: '1.25rem' }}
                  className="text-yellow-500 ml-0.5"
                  aria-hidden="true"
                  focusable="false"
                />
              ) : (
                <Volume2
                  style={{ width: '1.25rem', height: '1.25rem' }}
                  className="text-text-primary"
                  aria-hidden="true"
                  focusable="false"
                />
              )}
            </button>
          }
        />
        <span
          className="pointer-events-none absolute -bottom-1 -right-1 select-none rounded bg-emerald-500/15 px-1 py-[0.5px] text-[7.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs"
          title="On-device Local Speech"
        >
          Local
        </span>
      </div>

      {/* Voice Toggle: Neerja (F) vs Prabhat (M) - Indian English */}
      <TooltipAnchor
        description={`Voice: ${voiceGender === 'female' ? 'Female (Neerja, Indian English)' : 'Male (Prabhat, Indian English)'} - Click to switch`}
        render={
          <button
            type="button"
            onClick={toggleGender}
            aria-label="Toggle Teacher Voice Accent / Gender"
            className="hidden sm:inline-flex h-9 px-2 items-center justify-center rounded-xl border border-border-light bg-presentation text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-all"
          >
            <span className="font-semibold text-primary mr-1">🇮🇳</span>
            {voiceGender === 'female' ? 'F' : 'M'}
          </button>
        }
      />
    </div>
  );
}
