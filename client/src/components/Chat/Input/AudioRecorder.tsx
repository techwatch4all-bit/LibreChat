import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { MicOff, Zap, Sparkles } from 'lucide-react';
import { useRecoilValue } from 'recoil';
import {
  IconButton,
  useToastContext,
  TooltipAnchor,
  ListeningIcon,
  Spinner,
} from '@librechat/client';
import { useLocalize, useSpeechToText, useGetAudioSettings, useAuthContext } from '~/hooks';
import { globalAudioId, type TAskFunction } from '~/common';
import { useChatFormContext } from '~/Providers';
import store from '~/store';
import SatchiUpgradeModal from './SatchiUpgradeModal';
import LiveVoiceModal from './LiveVoiceModal';

const isExternalSTT = (speechToTextEndpoint: string) => speechToTextEndpoint === 'external';
export default memo(function AudioRecorder({
  disabled,
  ask,
  methods,
  isSubmitting,
}: {
  disabled: boolean;
  ask: TAskFunction;
  methods: ReturnType<typeof useChatFormContext>;
  isSubmitting: boolean;
}) {
  const { setValue, reset, getValues } = methods;
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const speechSettingsInitialized = useRecoilValue(store.speechSettingsInitialized);
  const recorderDisabled = disabled || !speechSettingsInitialized;
  const [showVoiceUpgradeModal, setShowVoiceUpgradeModal] = useState(false);
  const [showLiveVoiceModal, setShowLiveVoiceModal] = useState(false);

  const userAccountType = (user?.accountType || '').toLowerCase();
  const isProVoice = ['pro', 'pro_family', 'enterprise', 'privacy'].includes(userAccountType);

  const existingTextRef = useRef<string>('');
  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;

  const onTranscriptionComplete = useCallback(
    (text: string) => {
      if (isSubmittingRef.current) {
        showToast({
          message: localize('com_ui_speech_while_submitting'),
          status: 'error',
        });
        return;
      }
      if (text) {
        const globalAudio = document.getElementById(globalAudioId) as HTMLAudioElement | null;
        if (globalAudio) {
          console.log('Unmuting global audio');
          globalAudio.muted = false;
        }
        /** For external STT, append existing text to the transcription */
        const finalText =
          isExternalSTT(speechToTextEndpoint) && existingTextRef.current
            ? `${existingTextRef.current} ${text}`
            : text;
        const submitted = ask({ text: finalText });
        if (submitted === false) {
          return;
        }
        reset({ text: '' });
        existingTextRef.current = '';
      }
    },
    [ask, reset, showToast, localize, speechToTextEndpoint],
  );

  const setText = useCallback(
    (text: string) => {
      let newText = text;
      if (isExternalSTT(speechToTextEndpoint)) {
        /** For external STT, the text comes as a complete transcription, so append to existing */
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      } else {
        /** For browser STT, the transcript is cumulative, so we only need to prepend the existing text once */
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      }
      setValue('text', newText, {
        shouldValidate: true,
      });
    },
    [setValue, speechToTextEndpoint],
  );

  const { isListening, isLoading, startRecording, stopRecording } = useSpeechToText(
    setText,
    onTranscriptionComplete,
  );

  const handleStartRecording = useCallback(() => {
    existingTextRef.current = getValues('text') || '';
    startRecording();
  }, [getValues, startRecording]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
    /** For browser STT, clear the reference since text was already being updated */
    if (!isExternalSTT(speechToTextEndpoint)) {
      existingTextRef.current = '';
    }
  }, [speechToTextEndpoint, stopRecording]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.shiftKey || !event.altKey || event.code !== 'KeyL' || recorderDisabled) {
        return;
      }

      event.preventDefault();
      if (isListening === true) {
        handleStopRecording();
        return;
      }

      handleStartRecording();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleStartRecording, handleStopRecording, isListening, recorderDisabled]);

  const renderIcon = () => {
    if (isListening === true) {
      return <MicOff className="stroke-status-error" />;
    }
    if (isLoading === true) {
      return <Spinner className="stroke-text-secondary" />;
    }
    return <ListeningIcon className="stroke-text-secondary" />;
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <div className="relative flex items-center">
        <TooltipAnchor
          description={`${localize('com_ui_use_micrphone')} (On-device / Local)`}
          render={
            <IconButton
              id="audio-recorder"
              type="button"
              variant="ghost"
              size="theme"
              shape="theme"
              label={localize('com_ui_use_micrphone')}
              onClick={isListening === true ? handleStopRecording : handleStartRecording}
              disabled={recorderDisabled}
              className="p-1 hover:bg-surface-composer-hover"
              aria-pressed={isListening}
            >
              {renderIcon()}
            </IconButton>
          }
        />
        <span
          className="pointer-events-none absolute -bottom-1 -right-0.5 select-none rounded bg-emerald-500/15 px-1 py-[0.5px] text-[7.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
          title="On-device Local Speech"
        >
          Local
        </span>
      </div>

      {isProVoice ? (
        <TooltipAnchor
          description="Satchida Live Voice (Continuous Voice Mode: Browser STT + Fast LLM + Neural TTS)"
          render={
            <button
              type="button"
              onClick={() => setShowLiveVoiceModal(true)}
              className="relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-300 shadow-xs transition-all duration-200 hover:border-violet-400 hover:bg-violet-500/20 active:scale-95"
              aria-label="Satchida Live Voice (Continuous Mode)"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
              </span>
              <Sparkles className="h-2.5 w-2.5 text-violet-300" />
              <span>Live Voice</span>
            </button>
          }
        />
      ) : (
        <TooltipAnchor
          description="Live Voice Mode (Continuous STT + Fast LLM + TTS, Pro Feature) — Upgrade via Site Admin"
          render={
            <button
              type="button"
              onClick={() => setShowVoiceUpgradeModal(true)}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400 transition-all duration-150 hover:border-amber-500/50 hover:bg-amber-500/20 active:scale-95"
              aria-label="Live Voice Pro Gate"
            >
              <Zap className="h-2.5 w-2.5 text-amber-400" />
              <span>Live Voice</span>
              <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[8px] text-amber-300">
                PRO
              </span>
            </button>
          }
        />
      )}

      {showVoiceUpgradeModal && (
        <SatchiUpgradeModal
          open={showVoiceUpgradeModal}
          onOpenChange={setShowVoiceUpgradeModal}
          featureName="voice"
        />
      )}

      {showLiveVoiceModal && (
        <LiveVoiceModal
          open={showLiveVoiceModal}
          onOpenChange={setShowLiveVoiceModal}
          ask={ask}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
});
