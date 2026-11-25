let sharedVoiceAudioContext: AudioContext | null = null;

/**
 * Returns (and lazily creates) a shared AudioContext for Live Voice playback and mic capture.
 * Calling this synchronously inside a click/tap handler unlocks audio on Android Chrome / iOS Safari.
 */
export function getSharedVoiceAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }
  if (!sharedVoiceAudioContext || sharedVoiceAudioContext.state === 'closed') {
    // Use native hardware sampleRate (e.g. 48kHz on Android) so createMediaStreamSource
    // never mismatches the mic stream; 24kHz playback buffers resample automatically.
    sharedVoiceAudioContext = new AudioContextClass();
  }
  if (sharedVoiceAudioContext.state === 'suspended') {
    void sharedVoiceAudioContext.resume().catch(() => {
      /* Ignore resume errors outside gesture */
    });
  }
  return sharedVoiceAudioContext;
}

/**
 * Synchronously unlocks/resumes the shared AudioContext during a user gesture.
 */
export function unlockVoiceAudioContext(): AudioContext | null {
  return getSharedVoiceAudioContext();
}
