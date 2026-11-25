import { memo, useCallback, useEffect, useRef } from 'react';
import { MicOff } from 'lucide-react';
import { useRecoilValue } from 'recoil';
import {
  IconButton,
  useToastContext,
  TooltipAnchor,
  ListeningIcon,
  Spinner,
} from '@librechat/client';
import { useLocalize, useSpeechToText, useGetAudioSettings } from '~/hooks';
import { globalAudioId, type TAskFunction } from '~/common';
import { useChatFormContext } from '~/Providers';
import store from '~/store';

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
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();
  const speechSettingsInitialized = useRecoilValue(store.speechSettingsInitialized);
  const recorderDisabled = disabled || !speechSettingsInitialized;

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

      {/* Live Voice trigger and modal are hosted in Header.tsx so they work on all viewports */}
    </div>
  );
});
